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

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const runAgentTurnMock = runAgentTurn as jest.Mock;
const recognizeSpeechMock = recognizeSpeech as jest.Mock;
const synthesizeSpeechMock = synthesizeSpeech as jest.Mock;

let server: Server;
let port: number;

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

function token(username = 'ws-tester'): string {
  return jwt.sign({ userId: 'user-1', username, role: 'admin' }, JWT_SECRET);
}

async function openSession(): Promise<{ client: TestClient; sessionId: string }> {
  const client = new TestClient(`?token=${token()}&applianceId=app-ws-test`);
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

  it('creates a session and announces it on connect', async () => {
    const { client, sessionId } = await openSession();
    const session = await ensureAgentSessionDatabase().getSession(sessionId);
    expect(session?.applianceId).toBe('app-ws-test');
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
});

describe('text turns', () => {
  it('answers user-text with agent-text and no audio by default', async () => {
    const { client } = await openSession();
    client.send({ type: 'user-text', text: 'tyres are good' });

    const reply = await client.next();
    expect(reply.json).toEqual(expect.objectContaining({ type: 'agent-text', text: 'Copy that.', completed: false }));
    expect(runAgentTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({ applianceId: 'app-ws-test' }),
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
    const { client } = await openSession();

    client.send({ type: 'audio-start' });
    client.ws.send(Buffer.from([9, 9]));
    client.send({ type: 'audio-end' });

    expect((await client.next()).json).toEqual({ type: 'transcript', text: '' });
    expect((await client.next()).json?.text).toMatch(/did not catch/i);
    expect(runAgentTurnMock).not.toHaveBeenCalled();
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
    client.ws.send(Buffer.alloc(2 * 1024 * 1024 + 1));
    expect((await client.next()).json?.error).toMatch(/too long/i);

    client.send({ type: 'audio-end' });
    expect((await client.next()).json?.error).toMatch(/no audio capture/i);
    client.close();
  });

  it('reports empty capture (no chunks) with a canned prompt', async () => {
    const { client } = await openSession();
    client.send({ type: 'audio-start' });
    client.send({ type: 'audio-end' });
    expect((await client.next()).json).toEqual({ type: 'transcript', text: '' });
    expect((await client.next()).json?.text).toMatch(/did not hear anything/i);
    expect(recognizeSpeechMock).not.toHaveBeenCalled();
    client.close();
  });
});
