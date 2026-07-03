import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceAgentClient, type VoiceAgentEvents } from './voiceAgentClient';

/** Minimal WebSocket stand-in the client can drive in jsdom. */
class FakeWebSocket {
  static OPEN = WebSocket.OPEN;
  readyState = WebSocket.OPEN;
  binaryType = 'blob';
  sent: unknown[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {}

  send(data: unknown): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  }

  emit(frame: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(frame) } as MessageEvent);
  }

  emitBinary(buffer: ArrayBuffer): void {
    this.onmessage?.({ data: buffer } as MessageEvent);
  }
}

let sockets: FakeWebSocket[];
let events: { [K in keyof Required<VoiceAgentEvents>]: ReturnType<typeof vi.fn> };

/** The most recently created underlying socket (reconnects create new ones). */
function latestSocket(): FakeWebSocket {
  return sockets[sockets.length - 1];
}

function connect(): VoiceAgentClient {
  const client = new VoiceAgentClient(events, (url) => {
    const socket = new FakeWebSocket(url);
    sockets.push(socket);
    return socket as unknown as WebSocket;
  });
  client.connect({ applianceId: 'app-1', stationId: 'station-9' });
  return client;
}

beforeEach(() => {
  localStorage.setItem('auth_token', 'jwt-abc');
  sockets = [];
  events = {
    onSessionStarted: vi.fn(),
    onReconnecting: vi.fn(),
    onTranscript: vi.fn(),
    onAgentText: vi.fn(),
    onAgentAudio: vi.fn(),
    onBusy: vi.fn(),
    onError: vi.fn(),
    onClose: vi.fn(),
  };
});

describe('VoiceAgentClient', () => {
  it('builds the socket URL with token, appliance, and station, with no resumeSessionId on a fresh connect', () => {
    connect();
    const socket = latestSocket();
    expect(socket.url).toContain('/ws/agent-check?');
    expect(socket.url).toContain('token=jwt-abc');
    expect(socket.url).toContain('applianceId=app-1');
    expect(socket.url).toContain('stationId=station-9');
    expect(socket.url).not.toContain('resumeSessionId');
    expect(socket.binaryType).toBe('arraybuffer');
  });

  it('targets the backend directly (localhost:3000) in dev rather than the Vite dev-server origin (A3 code review F7)', () => {
    // vitest runs with import.meta.env.PROD === false, so this exercises the
    // same dev-vs-prod split as useSocket.ts/api.ts — previously this used
    // window.location.host unconditionally, which in dev is the Vite server
    // (default :5173), and nothing serves /ws/agent-check there.
    connect();
    expect(latestSocket().url).toMatch(/^ws:\/\/localhost:3000\/ws\/agent-check\?/);
  });

  it('dispatches control frames to the right callbacks', () => {
    connect();
    latestSocket().emit({ type: 'session-started', sessionId: 'sess-1' });
    latestSocket().emit({ type: 'transcript', text: 'pump is good' });
    latestSocket().emit({ type: 'agent-text', text: 'Recorded.', completed: true, runId: 'run-1' });
    latestSocket().emit({ type: 'busy', error: 'wait' });
    latestSocket().emit({ type: 'error', error: 'boom' });

    expect(events.onSessionStarted).toHaveBeenCalledWith('sess-1', false);
    expect(events.onTranscript).toHaveBeenCalledWith('pump is good');
    expect(events.onAgentText).toHaveBeenCalledWith('Recorded.', true, 'run-1');
    expect(events.onBusy).toHaveBeenCalled();
    expect(events.onError).toHaveBeenCalledWith('boom');
  });

  it('passes resumed=true through from the session-started frame', () => {
    connect();
    latestSocket().emit({ type: 'session-started', sessionId: 'sess-1', resumed: true });
    expect(events.onSessionStarted).toHaveBeenCalledWith('sess-1', true);
  });

  it('pairs an agent-audio header with the following binary frame', () => {
    connect();
    const bytes = new Uint8Array([1, 2, 3]).buffer;

    latestSocket().emitBinary(bytes); // stray binary before any header — ignored
    expect(events.onAgentAudio).not.toHaveBeenCalled();

    latestSocket().emit({ type: 'agent-audio', format: 'audio/mpeg', bytes: 3 });
    latestSocket().emitBinary(bytes);
    expect(events.onAgentAudio).toHaveBeenCalledTimes(1);
    const blob = events.onAgentAudio.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('audio/mpeg');

    latestSocket().emitBinary(bytes); // header consumed — a second binary is ignored
    expect(events.onAgentAudio).toHaveBeenCalledTimes(1);
  });

  it('serialises outbound frames and raw audio chunks', () => {
    const client = connect();
    client.sendText('tyres are fine', true);
    client.startUtterance();
    const pcm = new ArrayBuffer(8);
    client.sendAudioChunk(pcm);
    client.endUtterance();

    const socket = latestSocket();
    expect(JSON.parse(socket.sent[0] as string)).toEqual({ type: 'user-text', text: 'tyres are fine', speak: true });
    expect(JSON.parse(socket.sent[1] as string)).toEqual({ type: 'audio-start' });
    expect(socket.sent[2]).toBe(pcm);
    expect(JSON.parse(socket.sent[3] as string)).toEqual({ type: 'audio-end' });
  });

  it('ignores malformed JSON frames', () => {
    connect();
    latestSocket().onmessage?.({ data: 'not json' } as MessageEvent);
    expect(events.onError).not.toHaveBeenCalled();
  });

  describe('deliberate close (A3 code review F9)', () => {
    it('client.close() reports onClose immediately with no reconnect attempt', () => {
      const client = connect();
      client.close();
      expect(events.onClose).toHaveBeenCalled();
      expect(events.onReconnecting).not.toHaveBeenCalled();
      expect(sockets).toHaveLength(1); // no reconnect socket opened
    });

    it('drops sends once deliberately closed', () => {
      const client = connect();
      client.close();
      client.sendText('too late');
      expect(latestSocket().sent).toHaveLength(0);
    });

    it('endSession() sends the frame and is treated as deliberate, not a drop to recover from', () => {
      const client = connect();
      client.endSession();
      expect(JSON.parse(latestSocket().sent[0] as string)).toEqual({ type: 'end-session' });

      // The server would now close the socket in response; simulate that.
      latestSocket().close();
      expect(events.onClose).toHaveBeenCalled();
      expect(events.onReconnecting).not.toHaveBeenCalled();
      expect(sockets).toHaveLength(1);
    });
  });

  describe('unexpected disconnect — reconnect with backoff (A3 code review F9)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('retries with the previous sessionId as resumeSessionId instead of reporting onClose immediately', () => {
      connect();
      latestSocket().emit({ type: 'session-started', sessionId: 'sess-1' });

      latestSocket().close(); // unexpected — not via client.close()/endSession()
      expect(events.onReconnecting).toHaveBeenCalledWith(1);
      expect(events.onClose).not.toHaveBeenCalled();
      expect(sockets).toHaveLength(1); // reconnect is scheduled, not immediate

      vi.advanceTimersByTime(1000); // first backoff delay
      expect(sockets).toHaveLength(2);
      expect(latestSocket().url).toContain('resumeSessionId=sess-1');
    });

    it('resets the attempt counter once a reconnect succeeds', () => {
      connect();
      latestSocket().emit({ type: 'session-started', sessionId: 'sess-1' });
      latestSocket().close();
      vi.advanceTimersByTime(1000);
      latestSocket().emit({ type: 'session-started', sessionId: 'sess-1', resumed: true });

      // A second drop after a successful resume starts the backoff over at attempt 1, not 2.
      latestSocket().close();
      expect(events.onReconnecting).toHaveBeenLastCalledWith(1);
    });

    it('backs off exponentially and gives up after the attempt cap, then reports onClose', () => {
      connect();
      latestSocket().emit({ type: 'session-started', sessionId: 'sess-1' });

      const expectedDelays = [1000, 2000, 4000, 8000, 8000]; // capped at 8s; 5 attempts total
      for (const delay of expectedDelays) {
        latestSocket().close();
        expect(events.onClose).not.toHaveBeenCalled();
        vi.advanceTimersByTime(delay);
      }
      // The 5th reconnect attempt's socket also drops — attempts are exhausted.
      latestSocket().close();
      expect(events.onReconnecting).toHaveBeenCalledTimes(5);
      expect(events.onClose).toHaveBeenCalled();
    });
  });
});
