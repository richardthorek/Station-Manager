import { describe, it, expect, vi, beforeEach } from 'vitest';
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

let socket: FakeWebSocket;
let events: { [K in keyof Required<VoiceAgentEvents>]: ReturnType<typeof vi.fn> };

function connect(): VoiceAgentClient {
  const client = new VoiceAgentClient(events, (url) => {
    socket = new FakeWebSocket(url);
    return socket as unknown as WebSocket;
  });
  client.connect({ applianceId: 'app-1', stationId: 'station-9' });
  return client;
}

beforeEach(() => {
  localStorage.setItem('auth_token', 'jwt-abc');
  events = {
    onSessionStarted: vi.fn(),
    onTranscript: vi.fn(),
    onAgentText: vi.fn(),
    onAgentAudio: vi.fn(),
    onBusy: vi.fn(),
    onError: vi.fn(),
    onClose: vi.fn(),
  };
});

describe('VoiceAgentClient', () => {
  it('builds the socket URL with token, appliance, and station', () => {
    connect();
    expect(socket.url).toContain('/ws/agent-check?');
    expect(socket.url).toContain('token=jwt-abc');
    expect(socket.url).toContain('applianceId=app-1');
    expect(socket.url).toContain('stationId=station-9');
    expect(socket.binaryType).toBe('arraybuffer');
  });

  it('dispatches control frames to the right callbacks', () => {
    connect();
    socket.emit({ type: 'session-started', sessionId: 'sess-1' });
    socket.emit({ type: 'transcript', text: 'pump is good' });
    socket.emit({ type: 'agent-text', text: 'Recorded.', completed: true, runId: 'run-1' });
    socket.emit({ type: 'busy', error: 'wait' });
    socket.emit({ type: 'error', error: 'boom' });

    expect(events.onSessionStarted).toHaveBeenCalledWith('sess-1');
    expect(events.onTranscript).toHaveBeenCalledWith('pump is good');
    expect(events.onAgentText).toHaveBeenCalledWith('Recorded.', true, 'run-1');
    expect(events.onBusy).toHaveBeenCalled();
    expect(events.onError).toHaveBeenCalledWith('boom');
  });

  it('pairs an agent-audio header with the following binary frame', () => {
    connect();
    const bytes = new Uint8Array([1, 2, 3]).buffer;

    socket.emitBinary(bytes); // stray binary before any header — ignored
    expect(events.onAgentAudio).not.toHaveBeenCalled();

    socket.emit({ type: 'agent-audio', format: 'audio/mpeg', bytes: 3 });
    socket.emitBinary(bytes);
    expect(events.onAgentAudio).toHaveBeenCalledTimes(1);
    const blob = events.onAgentAudio.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('audio/mpeg');

    socket.emitBinary(bytes); // header consumed — a second binary is ignored
    expect(events.onAgentAudio).toHaveBeenCalledTimes(1);
  });

  it('serialises outbound frames and raw audio chunks', () => {
    const client = connect();
    client.sendText('tyres are fine', true);
    client.startUtterance();
    const pcm = new ArrayBuffer(8);
    client.sendAudioChunk(pcm);
    client.endUtterance();
    client.endSession();

    expect(JSON.parse(socket.sent[0] as string)).toEqual({ type: 'user-text', text: 'tyres are fine', speak: true });
    expect(JSON.parse(socket.sent[1] as string)).toEqual({ type: 'audio-start' });
    expect(socket.sent[2]).toBe(pcm);
    expect(JSON.parse(socket.sent[3] as string)).toEqual({ type: 'audio-end' });
    expect(JSON.parse(socket.sent[4] as string)).toEqual({ type: 'end-session' });
  });

  it('drops sends once the socket is closed and reports onClose', () => {
    const client = connect();
    socket.close();
    expect(events.onClose).toHaveBeenCalled();
    client.sendText('too late');
    expect(socket.sent).toHaveLength(0);
  });

  it('ignores malformed JSON frames', () => {
    connect();
    socket.onmessage?.({ data: 'not json' } as MessageEvent);
    expect(events.onError).not.toHaveBeenCalled();
  });
});
