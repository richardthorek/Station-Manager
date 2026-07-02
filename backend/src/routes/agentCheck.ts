/**
 * Agent Check Routes — A3 voice-agent backend plumbing (inc 1 stub).
 *
 * WebSocket endpoint:
 *   WS /ws/agent-check
 *   Accepts a JWT in the first Upgrade query param (?token=...) or
 *   Authorization header. Creates an AgentSession and keeps the connection
 *   alive with 30-second pings (well inside Azure App Service's 60 s idle
 *   timeout). `user-text` frames drive the Azure OpenAI tool loop
 *   (agentLoop.ts) and come back as `agent-text` — text mode is the permanent
 *   debug surface. Voice is push-to-talk: `audio-start`, then binary frames of
 *   raw 16 kHz 16-bit mono PCM, then `audio-end` → server-side Azure STT →
 *   `transcript` frame → tool loop → `agent-text` + an `agent-audio` header
 *   frame followed by one binary MP3 message (server-side Azure TTS).
 *
 * REST endpoints (mounted at /api/agent-sessions):
 *   GET /api/agent-sessions/:id        — fetch a session by id
 *   GET /api/agent-sessions/:id/turns  — fetch turns for a session
 */

import { Router, Request, Response } from 'express';
import { IncomingMessage, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth';
import { ensureAgentSessionDatabase } from '../services/agentSessionDbFactory';
import { AgentToolExecutor } from '../services/agentTools';
import { runAgentTurn } from '../services/agentLoop';
import { recognizeSpeech, synthesizeSpeech, buildWavFile, TTS_MIME_TYPE } from '../services/agentSpeech';
import { logger } from '../services/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// ── REST router ───────────────────────────────────────────────────────────────

export const agentCheckRouter = Router();

agentCheckRouter.use(authMiddleware);

agentCheckRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = ensureAgentSessionDatabase();
    const session = await db.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ session });
  } catch (error) {
    logger.error('Failed to get agent session', { error, id: req.params.id });
    res.status(500).json({ error: 'Failed to get session' });
  }
});

agentCheckRouter.get('/:id/turns', async (req: Request, res: Response) => {
  try {
    const db = ensureAgentSessionDatabase();
    const session = await db.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const turns = await db.getTurnsForSession(req.params.id);
    res.json({ turns });
  } catch (error) {
    logger.error('Failed to get agent turns', { error, id: req.params.id });
    res.status(500).json({ error: 'Failed to get turns' });
  }
});

// ── WebSocket upgrade handler ─────────────────────────────────────────────────

const PING_INTERVAL_MS = 30_000;

// Push-to-talk utterance cap: ~65 s of 16 kHz 16-bit mono PCM. The STT
// short-audio endpoint tops out at 60 s, so anything past this is a stuck key.
const MAX_UTTERANCE_BYTES = 2 * 1024 * 1024;

interface AuthenticatedClient {
  ws: WebSocket;
  sessionId: string;
  pingTimer: ReturnType<typeof setInterval>;
}

export function attachAgentCheckWs(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? '', 'ws://localhost');
    if (url.pathname !== '/ws/agent-check') return;

    // Extract token from ?token= query param or Authorization header
    const tokenFromQuery = url.searchParams.get('token') ?? undefined;
    const authHeader = req.headers['authorization'];
    const tokenFromHeader = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    const token = tokenFromQuery ?? tokenFromHeader;

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    let payload: { userId?: string; username?: string } = {};
    try {
      payload = jwt.verify(token, JWT_SECRET) as typeof payload;
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, async (ws) => {
      const applianceId = url.searchParams.get('applianceId') ?? 'unknown';
      const stationId = url.searchParams.get('stationId') ?? undefined;
      const memberId = url.searchParams.get('memberId') ?? undefined;
      const initiatedBy = payload.username ?? url.searchParams.get('initiatedBy') ?? 'unknown';

      try {
        const db = ensureAgentSessionDatabase();
        const session = await db.createSession({
          applianceId,
          stationId,
          memberId,
          initiatedBy,
          modality: 'voice',
          models: [],
        });

        const client: AuthenticatedClient = {
          ws,
          sessionId: session.id,
          pingTimer: setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.ping();
          }, PING_INTERVAL_MS),
        };

        logger.info('Agent check WS connected', { sessionId: session.id, applianceId });

        // Send session-started control frame
        ws.send(JSON.stringify({ type: 'session-started', sessionId: session.id }));

        const executor = new AgentToolExecutor(session);
        // One turn at a time per connection: the loop mutates run state, so a
        // second utterance mid-turn is rejected rather than interleaved.
        let turnInFlight = false;
        // Push-to-talk capture buffer: non-null between audio-start/audio-end.
        let utterance: Buffer[] | null = null;
        let utteranceBytes = 0;

        const send = (frame: Record<string, unknown>) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
        };

        /** TTS the reply and follow the header frame with one binary MP3 message. */
        const speakReply = async (text: string) => {
          const tts = await synthesizeSpeech(text);
          if (tts.audio && ws.readyState === WebSocket.OPEN) {
            send({ type: 'agent-audio', format: TTS_MIME_TYPE, bytes: tts.audio.length });
            ws.send(tts.audio);
          }
        };

        const runTurnAndReply = async (text: string, speak: boolean) => {
          if (turnInFlight) {
            send({ type: 'busy', error: 'Still working on the previous message' });
            return;
          }
          turnInFlight = true;
          try {
            const outcome = await runAgentTurn(session, text, executor);
            send({ type: 'agent-text', text: outcome.text, completed: outcome.completed, runId: session.runId });
            if (speak) await speakReply(outcome.text);
          } catch (err) {
            logger.error('Agent turn failed', { error: err, sessionId: session.id });
            send({ type: 'error', error: 'Agent turn failed' });
          } finally {
            turnInFlight = false;
          }
        };

        ws.on('message', async (data, isBinary) => {
          if (isBinary) {
            // Raw 16 kHz 16-bit mono PCM chunks of the current utterance.
            if (utterance === null) return; // no capture in progress — drop
            const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
            utteranceBytes += chunk.length;
            if (utteranceBytes > MAX_UTTERANCE_BYTES) {
              utterance = null;
              send({ type: 'error', error: 'Utterance too long — release the talk button and try again' });
              return;
            }
            utterance.push(chunk);
            return;
          }
          try {
            const msg = JSON.parse(data.toString()) as { type: string; text?: unknown; speak?: unknown };
            if (msg.type === 'ping') {
              send({ type: 'pong' });
              return;
            }
            if (msg.type === 'end-session') {
              ws.close(1000, 'Ended by client');
              return;
            }
            if (msg.type === 'audio-start') {
              if (turnInFlight) {
                send({ type: 'busy', error: 'Still working on the previous message' });
                return;
              }
              utterance = [];
              utteranceBytes = 0;
              return;
            }
            if (msg.type === 'audio-end') {
              if (utterance === null) {
                send({ type: 'error', error: 'No audio capture in progress' });
                return;
              }
              const pcm = Buffer.concat(utterance);
              utterance = null;
              if (pcm.length === 0) {
                send({ type: 'transcript', text: '' });
                send({ type: 'agent-text', text: 'I did not hear anything — hold the button and speak.', completed: false, runId: session.runId });
                return;
              }
              const stt = await recognizeSpeech(buildWavFile(pcm));
              if (stt.error) {
                send({ type: 'error', error: stt.error });
                return;
              }
              if (!stt.text) {
                send({ type: 'transcript', text: '' });
                send({ type: 'agent-text', text: 'Sorry, I did not catch that — try again a little closer to the microphone.', completed: false, runId: session.runId });
                return;
              }
              send({ type: 'transcript', text: stt.text });
              await runTurnAndReply(stt.text, true);
              return;
            }
            if (msg.type === 'user-text') {
              const text = typeof msg.text === 'string' ? msg.text.trim() : '';
              if (!text) {
                send({ type: 'error', error: 'user-text requires a non-empty text field' });
                return;
              }
              await runTurnAndReply(text, msg.speak === true);
            }
          } catch {
            // Non-JSON text ignored
          }
        });

        ws.on('close', async () => {
          clearInterval(client.pingTimer);
          try {
            // complete_run already finalises the session; an early disconnect
            // without it is an abort, not a completed check.
            if (session.status === 'active') {
              const db = ensureAgentSessionDatabase();
              await db.updateSession(session.id, { status: 'aborted', endedAt: new Date() });
            }
          } catch (err) {
            logger.error('Failed to close agent session', { error: err, sessionId: session.id });
          }
          logger.info('Agent check WS closed', { sessionId: session.id });
        });

        ws.on('error', (err) => {
          clearInterval(client.pingTimer);
          logger.error('Agent check WS error', { error: err, sessionId: session.id });
        });
      } catch (err) {
        logger.error('Failed to create agent session for WS connection', { error: err });
        ws.close(1011, 'Internal error');
      }
    });
  });
}
