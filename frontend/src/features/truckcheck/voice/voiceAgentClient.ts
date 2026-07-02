/**
 * WebSocket client for the voice-agent check (A3) — the browser side of the
 * /ws/agent-check frame protocol. JSON control frames both ways; outbound
 * binary frames are raw 16 kHz PCM16 utterance chunks; an inbound
 * `agent-audio` header frame is followed by exactly one binary MP3 message.
 *
 * The WebSocket constructor is injectable so the client is fully testable in
 * jsdom without a server.
 */

export interface VoiceAgentEvents {
  onSessionStarted?: (sessionId: string) => void;
  onTranscript?: (text: string) => void;
  onAgentText?: (text: string, completed: boolean, runId?: string) => void;
  onAgentAudio?: (audio: Blob) => void;
  onBusy?: () => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

export interface VoiceAgentConnectOptions {
  applianceId: string;
  stationId?: string;
  /** Override the socket URL (tests); defaults to same-origin /ws/agent-check. */
  url?: string;
}

export type WebSocketFactory = (url: string) => WebSocket;

interface InboundFrame {
  type: string;
  sessionId?: string;
  text?: string;
  completed?: boolean;
  runId?: string;
  error?: string;
  format?: string;
}

export class VoiceAgentClient {
  private ws: WebSocket | null = null;
  private pendingAudioFormat: string | null = null;
  private readonly events: VoiceAgentEvents;
  private readonly wsFactory: WebSocketFactory;

  constructor(events: VoiceAgentEvents, wsFactory: WebSocketFactory = (url) => new WebSocket(url)) {
    this.events = events;
    this.wsFactory = wsFactory;
  }

  connect(options: VoiceAgentConnectOptions): void {
    const token = localStorage.getItem('auth_token') ?? '';
    const params = new URLSearchParams({ token, applianceId: options.applianceId });
    if (options.stationId) params.set('stationId', options.stationId);
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = options.url ?? `${scheme}://${window.location.host}/ws/agent-check?${params.toString()}`;

    const ws = this.wsFactory(url);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (event: MessageEvent) => this.handleMessage(event.data);
    ws.onclose = () => this.events.onClose?.();
    ws.onerror = () => this.events.onError?.('Connection error');
    this.ws = ws;
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private sendFrame(frame: Record<string, unknown>): void {
    if (this.isOpen) this.ws!.send(JSON.stringify(frame));
  }

  sendText(text: string, speak = false): void {
    this.sendFrame({ type: 'user-text', text, speak });
  }

  startUtterance(): void {
    this.sendFrame({ type: 'audio-start' });
  }

  sendAudioChunk(pcm: ArrayBuffer): void {
    if (this.isOpen) this.ws!.send(pcm);
  }

  endUtterance(): void {
    this.sendFrame({ type: 'audio-end' });
  }

  endSession(): void {
    this.sendFrame({ type: 'end-session' });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== 'string') {
      // Binary payload — only expected directly after an agent-audio header.
      if (this.pendingAudioFormat && data instanceof ArrayBuffer) {
        const blob = new Blob([data], { type: this.pendingAudioFormat });
        this.pendingAudioFormat = null;
        this.events.onAgentAudio?.(blob);
      }
      return;
    }

    let frame: InboundFrame;
    try {
      frame = JSON.parse(data) as InboundFrame;
    } catch {
      return;
    }

    switch (frame.type) {
      case 'session-started':
        if (frame.sessionId) this.events.onSessionStarted?.(frame.sessionId);
        break;
      case 'transcript':
        this.events.onTranscript?.(frame.text ?? '');
        break;
      case 'agent-text':
        this.events.onAgentText?.(frame.text ?? '', frame.completed === true, frame.runId);
        break;
      case 'agent-audio':
        this.pendingAudioFormat = frame.format ?? 'audio/mpeg';
        break;
      case 'busy':
        this.events.onBusy?.();
        break;
      case 'error':
        this.events.onError?.(frame.error ?? 'Unknown error');
        break;
      default:
        break; // pong etc.
    }
  }
}
