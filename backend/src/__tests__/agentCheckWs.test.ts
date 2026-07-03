/**
 * Integration tests for the /ws/agent-check WebSocket (A3 inc 2+3) — a real
 * HTTP server + ws client, with the agent loop and Azure speech mocked, so the
 * whole frame protocol (auth, text turns, push-to-talk audio, TTS reply) is
 * exercised over the wire.
 */

jest.mock('../services/agentLoop', () => ({
  runAgentTurn: jest.fn(),
}));
jest.mock('../services/agentSpeech', () => ({
  ...jest.requireActual('../services/agentSpeech'),
  recognizeSpeech: jest.fn(),
  synthesizeSpeech: jest.fn(),
}));

import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import { attachAgentCheckWs } from '../routes/agentCheck';
import { runAgentTurn } from '../services/agentLoop';
import { recognizeSpeech, synthesizeSpeech } from '../services/agentSpeech';
import { ensureAgentSessionDatabase } from '../services/agentSessionDbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { ensureDatabase } from '../services/dbFactory';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const runAgentTurnMock = runAgentTurn as jest.Mock;
const recognizeSpeechMock = recognizeSpeech as jest.Mock;
const synthesizeSpeechMock = synthesizeSpeech as jest.Mock;

let server: Server;
let port: number;
/** Real appliance fixture — the WS now resolves applianceId against the DB (A3 code review F1). */
let applianceId: string;

type Frame = { json?: Record<string, unknown>; binary?: Buffer };

/** ws client wrapper that queues frames and lets tests await the next one. */
class TestClient {
  ws: WebSocket;
  private frames: Frame[] = [];
  private waiters: Array<(f: Frame) => void> = [];

  constructor(query: string) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws/agent-check${query}`);
    this.ws.on('message', (data, isBinary) => {
      const frame: Frame = isBinary
        ? { binary: data as Buffer }
        : { json: JSON.parse(data.toString()) as Record<string, unknown> };
      const waiter = this.waiters.shift();
      if (waiter) waiter(frame);
      else this.frames.push(frame);
    });
  }

  async open(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });
  }

  next(timeoutMs = 4000): Promise<Frame> {
    const queued = this.frames.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for a frame')), timeoutMs);
      this.waiters.push((f) => {
        clearTimeout(timer);
        resolve(f);
      });
    });
  }

  send(frame: Record<string, unknown>): void {
    this.ws.send(JSON.stringify(frame));
  }

  close(): void {
    this.ws.close();
  }
}

// Each call gets its own userId by default so unrelated tests never share
// the per-user connection-cap counter (A3 code review F4) by accident; tests
// that deliberately want the same user across several connections pass an
// explicit userId.
let tokenCounter = 0;
function token(opts: { username?: string; organizationId?: string; userId?: string } = {}): string {
  return jwt.sign(
    { userId: opts.userId ?? `user-${++tokenCounter}`, username: opts.username ?? 'ws-tester', role: 'admin', organizationId: opts.organizationId },
    JWT_SECRET,
  );
}

function connect(query: string): TestClient {
  return new TestClient(query);
}

async function openSession(
  opts: { applianceId?: string; organizationId?: string; username?: string } = {},
): Promise<{ client: TestClient; sessionId: string }> {
  const params = new URLSearchParams({
    token: token({ username: opts.username, organizationId: opts.organizationId }),
    applianceId: opts.applianceId ?? applianceId,
  });
  const client = connect(`?${params.toString()}`);
  await client.open();
  const started = await client.next();
  expect(started.json?.type).toBe('session-started');
  return { client, sessionId: started.json?.sessionId as string };
}

beforeAll(async () => {
  server = createServer();
  attachAgentCheckWs(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;

  const truckChecksDb = await ensureTruckChecksDatabase();
  const appliance = await truckChecksDb.createAppliance('WS Test Tanker', 'fixture');
  applianceId = appliance.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  jest.clearAllMocks();
  runAgentTurnMock.mockResolvedValue({ text: 'Copy that.', toolCallsMade: 0, completed: false });
  synthesizeSpeechMock.mockResolvedValue({ status: 200, audio: Buffer.from([0xff, 0xf3, 0x42]) });
});

describe('connection & auth', () => {
  it('rejects an upgrade without a token', async () => {
    const client = new TestClient('?applianceId=x');
    await expect(client.open()).rejects.toThrow(/401/);
  });

  it('rejects an upgrade with a bad token', async () => {
    const client = new TestClient('?token=not-a-jwt');
    await expect(client.open()).rejects.toThrow(/401/);
  });

  it('rejects an upgrade with no applianceId', async () => {
    const client = connect(`?token=${token()}`);
    await expect(client.open()).rejects.toThrow(/400/);
  });

  it('rejects an upgrade for an unknown applianceId', async () => {
    const client = connect(`?token=${token()}&applianceId=does-not-exist`);
    await expect(client.open()).rejects.toThrow(/404/);
  });

  it('allows an upgrade whose Origin is on the allowlist (A3 code review F6)', async () => {
    const params = new URLSearchParams({ token: token(), applianceId });
    const client = new WebSocket(`ws://127.0.0.1:${port}/ws/agent-check?${params.toString()}`, { origin: 'http://localhost:5173' });
    await new Promise<void>((resolve, reject) => {
      client.once('open', () => resolve());
      client.once('error', reject);
    });
    client.close();
  });

  it('rejects an upgrade whose Origin is not on the allowlist (A3 code review F6)', async () => {
    const params = new URLSearchParams({ token: token(), applianceId });
    const client = new WebSocket(`ws://127.0.0.1:${port}/ws/agent-check?${params.toString()}`, { origin: 'https://evil.example.com' });
    const opened = new Promise<void>((resolve, reject) => {
      client.once('open', () => resolve());
      client.once('error', reject);
    });
    await expect(opened).rejects.toThrow(/403/);
  });

  it('creates a session and announces it on connect', async () => {
    const { client, sessionId } = await openSession();
    const session = await ensureAgentSessionDatabase().getSession(sessionId);
    expect(session?.applianceId).toBe(applianceId);
    expect(session?.initiatedBy).toBe('ws-tester');
    client.close();
  });

  it('marks an abandoned session aborted on disconnect', async () => {
    const { client, sessionId } = await openSession();
    client.close();
    await new Promise((r) => setTimeout(r, 150));
    const session = await ensureAgentSessionDatabase().getSession(sessionId);
    expect(session?.status).toBe('aborted');
  });

  it('does not overwrite an already-completed session back to aborted on disconnect (A3 code review F10)', async () => {
    const { client, sessionId } = await openSession();
    // Simulate complete_run having finished its DB write in the window just
    // before the close handler runs — the in-memory `session` object the
    // handler closes over would still say 'active' were it not re-reading
    // the persisted status fresh.
    await ensureAgentSessionDatabase().updateSession(sessionId, { status: 'completed', endedAt: new Date() });
    client.close();
    await new Promise((r) => setTimeout(r, 150));
    const session = await ensureAgentSessionDatabase().getSession(sessionId);
    expect(session?.status).toBe('completed');
  });
});

describe('liveness — pong-timeout terminates a dead connection (A3 code review F9)', () => {
  afterEach(() => {
    delete process.env.AGENT_WS_PING_INTERVAL_MS;
  });

  it('terminates and marks the session aborted when pings go unanswered', async () => {
    // Short interval just for this test — getPingIntervalMs() reads the env
    // fresh per connection rather than freezing it at module load.
    process.env.AGENT_WS_PING_INTERVAL_MS = '40';
    const { client, sessionId } = await openSession();

    // Simulate a connection that dies without a clean TCP close (a radio
    // drop, a backgrounded PWA suspended by the OS): pause the underlying
    // socket so incoming ping frames from the server are never read, and
    // therefore never answered with a pong.
    const rawSocket = (client.ws as unknown as { _socket: { pause: () => void } })._socket;
    rawSocket.pause();

    // Poll server-side state rather than the client's own 'close' event —
    // pausing the socket to suppress the pong can also delay the paused
    // client from ever observing the server's forced close.
    const db = ensureAgentSessionDatabase();
    const deadline = Date.now() + 5000;
    let session = await db.getSession(sessionId);
    while (session?.status === 'active' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
      session = await db.getSession(sessionId);
    }
    expect(session?.status).toBe('aborted');

    client.ws.terminate();
  }, 10000);
});

describe('organization scoping (A3 code review F1/F2/F3)', () => {
  let ownOrgId: string;
  let otherOrgId: string;
  let communityOrgId: string;
  let scopedApplianceId: string;

  beforeAll(async () => {
    const orgDb = ensureOrganizationDatabase();
    const ownOrg = await orgDb.createOrganization({ name: 'Own Brigade', billingEmail: 'own@example.com', planCode: 'ai' });
    const otherOrg = await orgDb.createOrganization({ name: 'Other Brigade', billingEmail: 'other@example.com', planCode: 'ai' });
    const communityOrg = await orgDb.createOrganization({ name: 'Community Brigade', billingEmail: 'community@example.com', planCode: 'community' });
    ownOrgId = ownOrg.id;
    otherOrgId = otherOrg.id;
    communityOrgId = communityOrg.id;

    const mainDb = await ensureDatabase();
    const station = await mainDb.createStation({
      name: 'Scoped Station',
      brigadeId: 'scoped-brigade',
      brigadeName: 'Scoped Brigade',
      hierarchy: { jurisdiction: 'NSW', area: 'Area', district: 'District', brigade: 'Scoped Brigade', station: 'Scoped Station' },
      isActive: true,
      organizationId: ownOrgId,
    });

    const truckChecksDb = await ensureTruckChecksDatabase();
    const appliance = await truckChecksDb.createAppliance('Scoped Tanker', 'fixture', undefined, station.id);
    scopedApplianceId = appliance.id;
  });

  it('allows an upgrade when the caller org matches the appliance station org', async () => {
    const { client } = await openSession({ applianceId: scopedApplianceId, organizationId: ownOrgId });
    client.close();
  });

  it('blocks a cross-tenant upgrade — caller org differs from the appliance station org (F1)', async () => {
    const client = connect(`?${new URLSearchParams({ token: token({ organizationId: otherOrgId }), applianceId: scopedApplianceId }).toString()}`);
    await expect(client.open()).rejects.toThrow(/403/);
  });

  it('carries organizationId onto the created session (F2)', async () => {
    const { client, sessionId } = await openSession({ applianceId: scopedApplianceId, organizationId: ownOrgId });
    const session = await ensureAgentSessionDatabase().getSession(sessionId);
    expect(session?.organizationId).toBe(ownOrgId);
    client.close();
  });

  it('blocks an upgrade when the caller org lacks the aiEnabled entitlement (F3)', async () => {
    const client = connect(`?${new URLSearchParams({ token: token({ organizationId: communityOrgId }), applianceId }).toString()}`);
    await expect(client.open()).rejects.toThrow(/403/);
  });

  it('allows an upgrade for a caller with no org context regardless of plan (kiosk/demo back-compat)', async () => {
    // No organizationId on the token at all — every other test in this file
    // already exercises this path via openSession()'s default, but it's worth
    // asserting explicitly right next to the entitlement-blocking test above.
    const { client } = await openSession();
    client.close();
  });
});

describe('resumeSessionId — reconnect resumes the previous session (A3 code review F9)', () => {
  it('resumes an active session for the same appliance and flags resumed=true', async () => {
    const { client: first, sessionId } = await openSession();
    first.close();
    await new Promise((r) => setTimeout(r, 100));
    // Reopen it as 'active' again — simulating the client reconnecting before
    // anything else marked it aborted/completed.
    await ensureAgentSessionDatabase().updateSession(sessionId, { status: 'active' });

    const params = new URLSearchParams({ token: token(), applianceId, resumeSessionId: sessionId });
    const second = connect(`?${params.toString()}`);
    await second.open();
    const started = await second.next();
    expect(started.json).toEqual({ type: 'session-started', sessionId, resumed: true });
    second.close();
  });

  it('falls back to a fresh session when resumeSessionId is for a different appliance', async () => {
    const { client: first, sessionId } = await openSession();
    first.close();
    await ensureAgentSessionDatabase().updateSession(sessionId, { status: 'active' });

    const otherAppliance = await (await ensureTruckChecksDatabase()).createAppliance('Another Tanker', 'fixture');
    const params = new URLSearchParams({ token: token(), applianceId: otherAppliance.id, resumeSessionId: sessionId });
    const second = connect(`?${params.toString()}`);
    await second.open();
    const started = await second.next();
    expect(started.json?.sessionId).not.toBe(sessionId);
    expect(started.json?.resumed).toBe(false);
    second.close();
  });

  it('falls back to a fresh session when the referenced session is already completed', async () => {
    const { client: first, sessionId } = await openSession();
    await ensureAgentSessionDatabase().updateSession(sessionId, { status: 'completed' });
    first.close();

    const params = new URLSearchParams({ token: token(), applianceId, resumeSessionId: sessionId });
    const second = connect(`?${params.toString()}`);
    await second.open();
    const started = await second.next();
    expect(started.json?.sessionId).not.toBe(sessionId);
    expect(started.json?.resumed).toBe(false);
    second.close();
  });

  it('falls back to a fresh session when resumeSessionId does not exist', async () => {
    const params = new URLSearchParams({ token: token(), applianceId, resumeSessionId: 'does-not-exist' });
    const client = connect(`?${params.toString()}`);
    await client.open();
    const started = await client.next();
    expect(started.json?.resumed).toBe(false);
    client.close();
  });
});

describe('per-user/per-session limits (A3 code review F4)', () => {
  it('rejects a new connection once a user already has the max connections open', async () => {
    const sharedToken = token({ userId: 'cap-tester' });
    const clients: TestClient[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const params = new URLSearchParams({ token: sharedToken, applianceId });
        const c = connect(`?${params.toString()}`);
        await c.open();
        await c.next(); // session-started
        clients.push(c);
      }

      const params = new URLSearchParams({ token: sharedToken, applianceId });
      const fourth = connect(`?${params.toString()}`);
      await expect(fourth.open()).rejects.toThrow(/429/);
    } finally {
      clients.forEach((c) => c.close());
    }
  });

  it('rejects user-text longer than the character cap without calling the loop', async () => {
    const { client } = await openSession();
    client.send({ type: 'user-text', text: 'x'.repeat(2001) });
    const frame = await client.next();
    expect(frame.json?.error).toMatch(/too long/i);
    expect(runAgentTurnMock).not.toHaveBeenCalled();
    client.close();
  });

  it('rejects further turns once the per-session turn cap is reached', async () => {
    const { client } = await openSession();
    for (let i = 0; i < 60; i++) {
      client.send({ type: 'user-text', text: `turn ${i}` });
      await client.next(); // agent-text reply
    }
    client.send({ type: 'user-text', text: 'one too many' });
    const frame = await client.next();
    expect(frame.json).toEqual(expect.objectContaining({ type: 'error' }));
    expect(frame.json?.error).toMatch(/turn limit/i);
    client.close();
  }, 15000);
});

describe('text turns', () => {
  it('answers user-text with agent-text and no audio by default', async () => {
    const { client } = await openSession();
    client.send({ type: 'user-text', text: 'tyres are good' });

    const reply = await client.next();
    expect(reply.json).toEqual(expect.objectContaining({ type: 'agent-text', text: 'Copy that.', completed: false }));
    expect(runAgentTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({ applianceId }),
      'tyres are good',
      expect.anything(),
    );
    expect(synthesizeSpeechMock).not.toHaveBeenCalled();
    client.close();
  });

  it('speaks the reply when user-text asks for it', async () => {
    const { client } = await openSession();
    client.send({ type: 'user-text', text: 'read it back', speak: true });

    expect((await client.next()).json?.type).toBe('agent-text');
    const header = await client.next();
    expect(header.json).toEqual(expect.objectContaining({ type: 'agent-audio', format: 'audio/mpeg', bytes: 3 }));
    const audio = await client.next();
    expect(audio.binary && Buffer.compare(audio.binary, Buffer.from([0xff, 0xf3, 0x42]))).toBe(0);
    client.close();
  });

  it('rejects empty user-text', async () => {
    const { client } = await openSession();
    client.send({ type: 'user-text', text: '   ' });
    expect((await client.next()).json?.type).toBe('error');
    expect(runAgentTurnMock).not.toHaveBeenCalled();
    client.close();
  });
});

describe('push-to-talk audio turns', () => {
  it('recognises buffered PCM, emits transcript, runs the turn, and speaks the reply', async () => {
    recognizeSpeechMock.mockResolvedValue({ status: 200, text: 'pump is primed' });
    const { client } = await openSession();

    client.send({ type: 'audio-start' });
    client.ws.send(Buffer.from([1, 2, 3, 4]));
    client.ws.send(Buffer.from([5, 6]));
    client.send({ type: 'audio-end' });

    expect((await client.next()).json).toEqual({ type: 'transcript', text: 'pump is primed' });
    expect((await client.next()).json?.type).toBe('agent-text');
    expect((await client.next()).json?.type).toBe('agent-audio');
    expect((await client.next()).binary).toBeDefined();

    // The server wrapped the concatenated PCM in a WAV container.
    const wav: Buffer = recognizeSpeechMock.mock.calls[0][0];
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.readUInt32LE(40)).toBe(6); // data chunk size = 4 + 2 bytes
    expect(runAgentTurnMock).toHaveBeenCalledWith(expect.anything(), 'pump is primed', expect.anything());
    client.close();
  });

  it('handles silence (no match) with a canned prompt instead of running the loop', async () => {
    recognizeSpeechMock.mockResolvedValue({ status: 200 });
    const { client, sessionId } = await openSession();

    client.send({ type: 'audio-start' });
    client.ws.send(Buffer.from([9, 9]));
    client.send({ type: 'audio-end' });

    expect((await client.next()).json).toEqual({ type: 'transcript', text: '' });
    expect((await client.next()).json?.text).toMatch(/did not catch/i);
    expect(runAgentTurnMock).not.toHaveBeenCalled();

    // The canned reply is persisted as a turn, not just sent over the wire —
    // previously it bypassed db.addTurn entirely, leaving a transcript gap
    // for exactly this kind of exchange (A3 code review F13).
    const turns = await ensureAgentSessionDatabase().getTurnsForSession(sessionId);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toEqual(expect.objectContaining({ role: 'agent', text: expect.stringMatching(/did not catch/i) }));

    client.close();
  });

  it('surfaces STT provider errors as error frames', async () => {
    recognizeSpeechMock.mockResolvedValue({ status: 503, error: 'Speech is not configured on this server' });
    const { client } = await openSession();

    client.send({ type: 'audio-start' });
    client.ws.send(Buffer.from([1]));
    client.send({ type: 'audio-end' });

    expect((await client.next()).json).toEqual({ type: 'error', error: 'Speech is not configured on this server' });
    client.close();
  });

  it('rejects audio-end without a capture in progress and drops stray binary', async () => {
    const { client } = await openSession();
    client.ws.send(Buffer.from([1, 2, 3])); // no audio-start — dropped silently
    client.send({ type: 'audio-end' });
    expect((await client.next()).json?.error).toMatch(/no audio capture/i);
    expect(recognizeSpeechMock).not.toHaveBeenCalled();
    client.close();
  });

  it('aborts an utterance that exceeds the size cap', async () => {
    const { client } = await openSession();
    client.send({ type: 'audio-start' });
    // Accumulate over MAX_UTTERANCE_BYTES (2 MiB) across several chunks, each
    // comfortably under the WS-level maxPayload cap (256 KiB, A3 code review
    // F5) so this exercises the app-level accumulation check, not the
    // protocol-level single-message limit.
    for (let i = 0; i < 9; i++) {
      client.ws.send(Buffer.alloc(250 * 1024));
    }
    expect((await client.next()).json?.error).toMatch(/too long/i);

    client.send({ type: 'audio-end' });
    expect((await client.next()).json?.error).toMatch(/no audio capture/i);
    client.close();
  });

  it('rejects a single WS message larger than maxPayload at the protocol level (A3 code review F5)', async () => {
    const { client } = await openSession();
    await new Promise<void>((resolve) => {
      client.ws.once('close', () => resolve());
      client.ws.send(Buffer.alloc(300 * 1024)); // over the 256 KiB maxPayload cap
    });
    expect(client.ws.readyState).toBe(WebSocket.CLOSED);
  });

  it('reports empty capture (no chunks) with a canned prompt', async () => {
    const { client, sessionId } = await openSession();
    client.send({ type: 'audio-start' });
    client.send({ type: 'audio-end' });
    expect((await client.next()).json).toEqual({ type: 'transcript', text: '' });
    expect((await client.next()).json?.text).toMatch(/did not hear anything/i);
    expect(recognizeSpeechMock).not.toHaveBeenCalled();

    const turns = await ensureAgentSessionDatabase().getTurnsForSession(sessionId);
    expect(turns).toHaveLength(1); // persisted, not just sent (A3 code review F13)
    expect(turns[0].role).toBe('agent');

    client.close();
  });

  it('does not silently discard buffered audio when audio-start fires twice (A3 code review F14)', async () => {
    recognizeSpeechMock.mockResolvedValue({ status: 200, text: 'from the first press' });
    const { client } = await openSession();

    client.send({ type: 'audio-start' });
    client.ws.send(Buffer.from([1, 2, 3, 4]));
    client.send({ type: 'audio-start' }); // double-fired pointerdown — ignored, capture already open
    client.ws.send(Buffer.from([5, 6]));
    client.send({ type: 'audio-end' });

    expect((await client.next()).json).toEqual({ type: 'transcript', text: 'from the first press' });
    // Both chunks survived — the second audio-start didn't wipe the buffer.
    const wav: Buffer = recognizeSpeechMock.mock.calls[0][0];
    expect(wav.readUInt32LE(40)).toBe(6); // data chunk size = 4 + 2 bytes, not just 2
    client.close();
  });
});
