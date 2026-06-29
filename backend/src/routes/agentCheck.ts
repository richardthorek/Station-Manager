/**
 * Agent Check Routes — A3 voice-agent backend plumbing (inc 1 stub).
 *
 * WebSocket endpoint:
 *   WS /ws/agent-check
 *   Accepts a JWT in the first Upgrade query param (?token=...) or
 *   Authorization header. Creates an AgentSession, keeps the connection
 *   alive with 30-second pings (well inside Azure App Service's 60 s idle
 *   timeout), and echoes control frames back so the PWA can verify the link.
 *   Full Azure Speech ↔ Azure OpenAI tool-loop will be wired in inc 2+.
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

        ws.on('message', async (data, isBinary) => {
          if (isBinary) {
            // Binary PCM audio will be forwarded to Azure Speech STT in inc 2
            return;
          }
          try {
            const msg = JSON.parse(data.toString()) as { type: string; [key: string]: unknown };
            if (msg.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong' }));
            }
            // Additional control message types (end-session etc.) will be handled in inc 2
          } catch {
            // Non-JSON text ignored
          }
        });

        ws.on('close', async () => {
          clearInterval(client.pingTimer);
          try {
            const db = ensureAgentSessionDatabase();
            await db.updateSession(session.id, { status: 'completed', endedAt: new Date() });
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
