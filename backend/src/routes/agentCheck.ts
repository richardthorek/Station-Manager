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
import { entitlementsEnabled } from '../middleware/entitlements';
import { ensureAgentSessionDatabase } from '../services/agentSessionDbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { ensureDatabase } from '../services/dbFactory';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { resolveKioskAccess } from '../services/kioskAccessResolver';
import { AgentToolExecutor } from '../services/agentTools';
import { runAgentTurn } from '../services/agentLoop';
import { recognizeSpeech, synthesizeSpeech, buildWavFile, TTS_MIME_TYPE } from '../services/agentSpeech';
import { logger } from '../services/logger';
import type { AgentSession } from '../types';
import { allowedOriginsList } from '../utils/allowedOrigins';
import { JWT_SECRET } from '../config/jwtSecret';

// ── REST router ───────────────────────────────────────────────────────────────

export const agentCheckRouter = Router();

agentCheckRouter.use(authMiddleware);

/**
 * A session with no `organizationId` predates org-scoping or was started by a
 * kiosk/demo caller with no org context — treated as unowned (back-compat),
 * matching `requireFeature`'s "no org context passes through" convention.
 * A caller with an org may only read a session that has no org, or the same org.
 */
function canReadSession(req: Request, session: { organizationId?: string }): boolean {
  const callerOrgId = req.user?.organizationId;
  if (!callerOrgId || !session.organizationId) return true;
  return session.organizationId === callerOrgId;
}

agentCheckRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = ensureAgentSessionDatabase();
    const session = await db.getSession(req.params.id);
    if (!session || !canReadSession(req, session)) {
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
    if (!session || !canReadSession(req, session)) {
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

const DEFAULT_PING_INTERVAL_MS = 30_000;

/** Read fresh per-connection (not frozen at module load) so tests can override it via env. */
function getPingIntervalMs(): number {
  const override = Number(process.env.AGENT_WS_PING_INTERVAL_MS);
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_PING_INTERVAL_MS;
}

// Push-to-talk utterance cap: ~65 s of 16 kHz 16-bit mono PCM. The STT
// short-audio endpoint tops out at 60 s, so anything past this is a stuck key.
const MAX_UTTERANCE_BYTES = 2 * 1024 * 1024;

// A typed message or a transcribed utterance is never legitimately longer
// than this — bounds the prompt fed to Azure OpenAI (A3 code review F4).
const MAX_USER_TEXT_CHARS = 2000;

// Bounds per-session Azure OpenAI/TTS spend: a real truck check walks a few
// dozen checklist items at most (A3 code review F4).
const MAX_TURNS_PER_SESSION = 60;

// Bounds how many concurrent voice-check connections one credential can hold
// open at once — without this, one JWT could open unlimited sockets, each
// driving its own STT/GPT/TTS spend with no throttle (A3 code review F4).
const MAX_CONNECTIONS_PER_USER = 3;
const connectionsByUser = new Map<string, number>();

interface AuthenticatedClient {
  ws: WebSocket;
  sessionId: string;
  pingTimer: ReturnType<typeof setInterval>;
}

/**
 * Reject an upgrade in progress with a plain HTTP status line (before any WS
 * framing exists). Typed structurally (not `net.Socket`/`Duplex`) since only
 * `write`/`destroy` are used, and Node's `upgrade` event hands back a bare
 * `stream.Duplex` rather than a full `net.Socket`.
 */
function rejectUpgrade(socket: { write: (data: string) => void; destroy: () => void }, status: number, reason: string): void {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\n\r\n`);
  socket.destroy();
}

// Bounds any single WS message (JSON control frame or one binary audio
// chunk) — well above a real audio chunk (~8 KB) or control frame, but far
// below the `ws` v8 default of 100 MiB a client could otherwise send to
// force the server to buffer + JSON.parse a huge payload (A3 code review F5).
const MAX_WS_MESSAGE_BYTES = 256 * 1024;

/**
 * Whether this upgrade's Origin is permitted. Mirrors the app-wide origin
 * convention (Express CORS + Socket.io in index.ts), which allows: a request
 * with no Origin (non-browser client), an allow-listed Origin, and — crucially
 * — any **same-origin** request even when it isn't on the allowlist.
 *
 * Express and Socket.io tolerate a missing/incomplete FRONTEND_URLS because
 * their origin callbacks merely *withhold CORS headers* for unlisted origins
 * (`callback(null, false)`); a same-origin caller needs no CORS headers and
 * still succeeds. This raw upgrade handler instead *rejects* the socket, so
 * before this it was the one endpoint that hard-403'd a same-origin voice-check
 * upgrade whenever FRONTEND_URLS didn't list the live domain — e.g. after the
 * app moved to a custom domain, on which Socket.io kept working (same-origin
 * soft-allow) while the voice check broke. Genuine cross-origin callers that
 * aren't allow-listed are still rejected: that cross-site-WebSocket-hijacking
 * protection is the reason to inspect Origin at all.
 */
function isUpgradeOriginAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser client (matches Express/Socket.io)
  if (allowedOriginsList.includes(origin)) return true;
  try {
    const originHost = new URL(origin).host;
    // App Service/Cloudflare preserve the custom-domain Host; prefer the
    // forwarded host when a trusted proxy rewrote it.
    const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
    const host = forwardedHost || req.headers.host;
    return Boolean(host) && originHost === host; // same-origin
  } catch {
    return false; // malformed Origin — reject
  }
}

// Socket.io/engine.io's own upgrade path — the one other legitimate WebSocket
// endpoint on this HTTP server. Everything else is nobody's, and must be
// closed by us (see below).
const SOCKET_IO_PATH_PREFIX = '/socket.io/';

export function attachAgentCheckWs(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_MESSAGE_BYTES });

  httpServer.on('upgrade', async (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? '', 'ws://localhost');
    if (url.pathname !== '/ws/agent-check') {
      // index.ts disables engine.io's destroyUpgrade (its 1 s kill-timer ended
      // our own slow-validating upgrades mid-handshake), which also disables
      // engine.io's cleanup of upgrade requests nobody claims. Take that duty
      // over here: anything that isn't ours and isn't Socket.io's gets an
      // immediate 404 instead of an open socket that would otherwise hang
      // (and leak a connection) forever.
      if (!url.pathname.startsWith(SOCKET_IO_PATH_PREFIX)) {
        rejectUpgrade(socket, 404, 'Not Found');
      }
      return;
    }

    // A3 code review F6: Socket.io on this same httpServer already runs every
    // connection through this same allowlist; the raw WS upgrade had no
    // equivalent check, so the app's CORS/origin policy silently didn't apply
    // here. Browsers always send Origin on a WS handshake; a missing Origin
    // (non-browser client) and any same-origin request are allowed through,
    // matching the existing Express/Socket.io convention (see
    // isUpgradeOriginAllowed).
    if (!isUpgradeOriginAllowed(req)) {
      logger.warn('Agent check WS: origin not allowed', { origin: req.headers.origin, host: req.headers.host });
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    // Extract token from ?token= query param or Authorization header
    const tokenFromQuery = url.searchParams.get('token') ?? undefined;
    const authHeader = req.headers['authorization'];
    const tokenFromHeader = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    const token = tokenFromQuery ?? tokenFromHeader;

    if (!token) {
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }

    let payload: { userId?: string; username?: string; organizationId?: string } = {};
    // Kiosk-scoped connections (resolved below, once we know the JWT didn't
    // verify) are restricted to their own station once the appliance is
    // looked up — a station-scoped token must not open a voice session for
    // another station's appliance.
    let kioskStationId: string | undefined;
    try {
      payload = jwt.verify(token, JWT_SECRET) as typeof payload;
    } catch {
      // Not an admin JWT — Voice Check is reachable via FeatureRoute alone
      // (no ProtectedRoute), so a walk-up kiosk/tablet signed in with its
      // brigade/device token, never an admin JWT, must still be able to open
      // this socket. Fall back to the same kiosk-token resolver every other
      // endpoint uses (flexibleAuth/requireSession) — without this, any
      // non-admin visitor hit an unconditional 401 on connect, surfaced to
      // them as a bare "Connection error".
      const resolved = await resolveKioskAccess(token);
      if (!resolved) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }
      kioskStationId = resolved.stationId;
      if (resolved.stationId) {
        const mainDb = await ensureDatabase();
        const station = await mainDb.getStationById(resolved.stationId);
        payload = { organizationId: station?.organizationId, username: 'kiosk' };
      }
    }

    if (payload.userId) {
      const openConnections = connectionsByUser.get(payload.userId) ?? 0;
      if (openConnections >= MAX_CONNECTIONS_PER_USER) {
        logger.warn('Agent check WS: per-user connection cap reached', { userId: payload.userId, openConnections });
        rejectUpgrade(socket, 429, 'Too Many Requests');
        return;
      }
    }

    const applianceId = url.searchParams.get('applianceId');
    if (!applianceId) {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }

    // A3 code-review F1/F3: the WS previously trusted applianceId/entitlements
    // unchecked. Resolve the appliance and, when the caller has an org context,
    // verify (a) the appliance's station belongs to the same org — closing the
    // cross-tenant read/write hole — and (b) the org's plan actually includes
    // aiEnabled, mirroring requireFeature('aiEnabled') on the REST mount. A
    // caller with no org context (kiosk/demo/single-tenant) passes through
    // unchanged, consistent with every other entitlement gate in this codebase.
    let stationIdFromAppliance: string | undefined;
    // A3 code-review F9: a client whose connection drops (App Service idle
    // timeout, a network blip) can ask to resume its previous session rather
    // than always starting a fresh one — the WS layer never survived a
    // reconnect at all before this. Only honoured when it genuinely belongs
    // to this appliance, is still active, and (when org-scoped) the same org
    // as the fresh tenancy/entitlement checks above — the same rules as a
    // brand-new session, just skipping session creation.
    let resumedSession: AgentSession | null = null;
    try {
      const truckChecksDb = await ensureTruckChecksDatabase();
      const appliance = await truckChecksDb.getApplianceById(applianceId);
      if (!appliance) {
        rejectUpgrade(socket, 404, 'Not Found');
        return;
      }
      stationIdFromAppliance = appliance.stationId;

      if (kioskStationId && appliance.stationId && kioskStationId !== appliance.stationId) {
        logger.warn('Agent check WS: kiosk token station does not match appliance station', {
          applianceId,
          kioskStationId,
          applianceStationId: appliance.stationId,
        });
        rejectUpgrade(socket, 403, 'Forbidden');
        return;
      }

      if (payload.organizationId && appliance.stationId) {
        const mainDb = await ensureDatabase();
        const station = await mainDb.getStationById(appliance.stationId);
        if (station?.organizationId && station.organizationId !== payload.organizationId) {
          logger.warn('Agent check WS: cross-tenant appliance access blocked', {
            applianceId,
            callerOrgId: payload.organizationId,
            applianceOrgId: station.organizationId,
          });
          rejectUpgrade(socket, 403, 'Forbidden');
          return;
        }
      }

      if (entitlementsEnabled() && payload.organizationId) {
        const org = await ensureOrganizationDatabase().getOrganizationById(payload.organizationId);
        if (org && !org.entitlements.aiEnabled) {
          logger.info('Agent check WS blocked by entitlements', { organizationId: org.id, planCode: org.planCode });
          rejectUpgrade(socket, 403, 'Forbidden');
          return;
        }
      }

      const resumeSessionId = url.searchParams.get('resumeSessionId');
      if (resumeSessionId) {
        const candidate = await ensureAgentSessionDatabase().getSession(resumeSessionId);
        const orgMatches = !payload.organizationId || !candidate?.organizationId || candidate.organizationId === payload.organizationId;
        if (candidate && candidate.applianceId === applianceId && candidate.status === 'active' && orgMatches) {
          resumedSession = candidate;
        } else {
          logger.info('Agent check WS: resumeSessionId not resumable — starting a fresh session', { resumeSessionId, applianceId });
        }
      }
    } catch (err) {
      logger.error('Agent check WS: pre-upgrade validation failed', { error: err, applianceId });
      rejectUpgrade(socket, 500, 'Internal Server Error');
      return;
    }

    wss.handleUpgrade(req, socket, head, async (ws) => {
      const stationId = url.searchParams.get('stationId') ?? stationIdFromAppliance;
      const memberId = url.searchParams.get('memberId') ?? undefined;
      const initiatedBy = payload.username ?? url.searchParams.get('initiatedBy') ?? 'unknown';

      if (payload.userId) {
        connectionsByUser.set(payload.userId, (connectionsByUser.get(payload.userId) ?? 0) + 1);
      }

      try {
        const db = ensureAgentSessionDatabase();
        const session = resumedSession ?? await db.createSession({
          applianceId,
          stationId,
          organizationId: payload.organizationId,
          memberId,
          initiatedBy,
          modality: 'voice',
          models: [],
        });

        // Pong-timeout: a connection that dies without a clean TCP close (a
        // cellular radio drop, the OS suspending a backgrounded PWA) never
        // fires 'close', so the ping loop would otherwise fire into a dead
        // socket forever and the AgentSession/CheckRun would sit as a phantom
        // 'active'/'in-progress' record indefinitely (A3 code review F9).
        // Standard `ws` liveness pattern: terminate if the previous ping's
        // pong never arrived — terminate() fires 'close', which runs the
        // normal (now race-safe, per F10) cleanup path.
        let isAlive = true;
        ws.on('pong', () => { isAlive = true; });

        const client: AuthenticatedClient = {
          ws,
          sessionId: session.id,
          pingTimer: setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) return;
            if (!isAlive) {
              logger.warn('Agent check WS: no pong received — terminating dead connection', { sessionId: session.id });
              ws.terminate();
              return;
            }
            isAlive = false;
            ws.ping();
          }, getPingIntervalMs()),
        };

        logger.info('Agent check WS connected', { sessionId: session.id, applianceId });

        // Send session-started control frame. `resumed` tells the client
        // whether this is a continuation (fetch turn history to rehydrate
        // the transcript) or a brand-new session.
        ws.send(JSON.stringify({ type: 'session-started', sessionId: session.id, resumed: Boolean(resumedSession) }));

        const executor = new AgentToolExecutor(session);
        // One turn at a time per connection: the loop mutates run state, so a
        // second utterance mid-turn is rejected rather than interleaved.
        let turnInFlight = false;
        // Bounds per-session AI spend (A3 code review F4) — resumed sessions
        // start this back at 0, since it's a fresh connection's local
        // counter, not a persisted lifetime count; the cap is meant to bound
        // one connection's runaway loop, not penalise a reconnect.
        let turnCount = 0;
        // Push-to-talk capture buffer: non-null between audio-start/audio-end.
        let utterance: Buffer[] | null = null;
        let utteranceBytes = 0;

        const send = (frame: Record<string, unknown>) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
        };

        const turnCapReached = (): boolean => {
          if (turnCount < MAX_TURNS_PER_SESSION) return false;
          send({ type: 'error', error: 'This check has reached its turn limit for one session — please finish up, or start a new voice check.' });
          return true;
        };

        /** TTS the reply and follow the header frame with one binary MP3 message. */
        const speakReply = async (text: string) => {
          const tts = await synthesizeSpeech(text);
          if (tts.audio && ws.readyState === WebSocket.OPEN) {
            send({ type: 'agent-audio', format: TTS_MIME_TYPE, bytes: tts.audio.length });
            ws.send(tts.audio);
          }
        };

        /**
         * Send + persist a canned agent reply that doesn't go through the
         * tool loop (silence / no-match). Previously these bypassed
         * `db.addTurn` entirely, so the persisted transcript was missing
         * exactly the exchanges most useful for reviewing what happened
         * during a check (A3 code review F13).
         */
        const sendCannedReply = async (text: string) => {
          send({ type: 'agent-text', text, completed: false, runId: session.runId });
          try {
            const db = ensureAgentSessionDatabase();
            const turns = await db.getTurnsForSession(session.id);
            await db.addTurn({ sessionId: session.id, role: 'agent', text, sequence: turns.length });
          } catch (err) {
            logger.error('Failed to persist canned agent reply', { error: err, sessionId: session.id });
          }
        };

        /**
         * Claim the turn slot synchronously (no `await` between the check and
         * the set), so there is never a window where a second frame can start
         * a turn before this one is marked in-flight (A3 code review F10,
         * trigger 2).
         */
        const tryClaimTurn = (): boolean => {
          if (turnInFlight) return false;
          turnInFlight = true;
          return true;
        };

        /** Run a turn assuming the slot is already claimed; always releases it. */
        const runClaimedTurn = async (text: string, speak: boolean) => {
          turnCount++;
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

        const runTurnAndReply = async (text: string, speak: boolean) => {
          if (turnCapReached()) return;
          if (!tryClaimTurn()) {
            send({ type: 'busy', error: 'Still working on the previous message' });
            return;
          }
          await runClaimedTurn(text, speak);
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
          let msg: { type: string; text?: unknown; speak?: unknown };
          try {
            msg = JSON.parse(data.toString()) as typeof msg;
          } catch {
            return; // Non-JSON text ignored
          }

          try {
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
              if (utterance !== null) {
                // A capture is already open — a double-fired pointerdown (a
                // known touchscreen quirk) must not silently wipe out audio
                // already buffered for the current utterance
                // (A3 code review F14).
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

              if (turnCapReached()) return;

              // Claim the turn slot here — before the recognizeSpeech await —
              // not inside runTurnAndReply. Claiming it only after STT resolves
              // left a window where a concurrent frame could start a turn first
              // (A3 code review F10, trigger 2). The outer finally guarantees
              // release on every exit path (silence, no-match, STT error);
              // runClaimedTurn's own finally covers the success path — setting
              // turnInFlight = false twice is harmless.
              if (!tryClaimTurn()) {
                send({ type: 'busy', error: 'Still working on the previous message' });
                return;
              }
              try {
                if (pcm.length === 0) {
                  send({ type: 'transcript', text: '' });
                  await sendCannedReply('I did not hear anything — hold the button and speak.');
                  return;
                }
                const stt = await recognizeSpeech(buildWavFile(pcm));
                if (stt.error) {
                  send({ type: 'error', error: stt.error });
                  return;
                }
                if (!stt.text) {
                  send({ type: 'transcript', text: '' });
                  await sendCannedReply('Sorry, I did not catch that — try again a little closer to the microphone.');
                  return;
                }
                send({ type: 'transcript', text: stt.text });
                await runClaimedTurn(stt.text, true);
              } finally {
                turnInFlight = false;
              }
              return;
            }
            if (msg.type === 'user-text') {
              const raw = typeof msg.text === 'string' ? msg.text.trim() : '';
              if (!raw) {
                send({ type: 'error', error: 'user-text requires a non-empty text field' });
                return;
              }
              if (raw.length > MAX_USER_TEXT_CHARS) {
                send({ type: 'error', error: `Message too long (max ${MAX_USER_TEXT_CHARS} characters)` });
                return;
              }
              await runTurnAndReply(raw, msg.speak === true);
            }
          } catch (err) {
            logger.error('Agent check WS: message handling failed', { error: err, sessionId: session.id, type: msg.type });
            send({ type: 'error', error: 'Internal error handling your message' });
          }
        });

        ws.on('close', async () => {
          clearInterval(client.pingTimer);
          if (payload.userId) {
            const remaining = (connectionsByUser.get(payload.userId) ?? 1) - 1;
            if (remaining <= 0) connectionsByUser.delete(payload.userId);
            else connectionsByUser.set(payload.userId, remaining);
          }
          try {
            // complete_run already finalises the session; an early disconnect
            // without it is an abort, not a completed check. Re-read the
            // persisted status here instead of trusting the in-memory `session`
            // object: complete_run mutates it only *after* its own DB writes
            // resolve, so a socket that drops in that window would otherwise
            // see a stale 'active' and overwrite a genuinely completed session
            // back to 'aborted' (A3 code review F10).
            const db = ensureAgentSessionDatabase();
            const current = await db.getSession(session.id);
            if (current?.status === 'active') {
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
