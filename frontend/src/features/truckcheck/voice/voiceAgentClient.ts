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
  /** `resumed` is true when this reconnected into an existing session — fetch its turn history to rehydrate the transcript. */
  onSessionStarted?: (sessionId: string, resumed: boolean) => void;
  /** Fired once per reconnect attempt after an unexpected disconnect, before the retry delay. */
  onReconnecting?: (attempt: number) => void;
  onTranscript?: (text: string) => void;
  onAgentText?: (text: string, completed: boolean, runId?: string) => void;
  onAgentAudio?: (audio: Blob) => void;
  onBusy?: () => void;
  onError?: (error: string) => void;
  /** Fired only once reconnection has been abandoned (or the client/server ended the session deliberately) — not on every transient drop. */
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
  resumed?: boolean;
  text?: string;
  completed?: boolean;
  runId?: string;
  error?: string;
  format?: string;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 8000;

export class VoiceAgentClient {
  private ws: WebSocket | null = null;
  private pendingAudioFormat: string | null = null;
  private readonly events: VoiceAgentEvents;
  private readonly wsFactory: WebSocketFactory;

  private lastOptions: VoiceAgentConnectOptions | null = null;
  private lastSessionId: string | null = null;
  private intentionalClose = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(events: VoiceAgentEvents, wsFactory: WebSocketFactory = (url) => new WebSocket(url)) {
    this.events = events;
    this.wsFactory = wsFactory;
  }

  connect(options: VoiceAgentConnectOptions): void {
    this.lastOptions = options;
    this.intentionalClose = false;
    this.openSocket(options);
  }

  private openSocket(options: VoiceAgentConnectOptions): void {
    const token = localStorage.getItem('auth_token') ?? '';
    const params = new URLSearchParams({ token, applianceId: options.applianceId });
    if (options.stationId) params.set('stationId', options.stationId);
    // A3 code review F9: resume the previous session (server rehydrates it by
    // id) instead of always starting a new one on reconnect, so a dropped
    // connection doesn't abandon an in-progress check.
    if (this.lastSessionId) params.set('resumeSessionId', this.lastSessionId);
    // In dev, the SPA runs on the Vite dev server (default :5173) while the
    // backend runs on :3000 with no proxy between them — window.location.host
    // would point this at Vite, which doesn't serve /ws/agent-check, and the
    // feature would be untestable locally. Mirror useSocket.ts's/api.ts's
    // existing dev-vs-prod origin split instead of introducing a new pattern
    // (A3 code review F7).
    const base = import.meta.env.PROD ? window.location.origin : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000');
    const scheme = base.startsWith('https:') ? 'wss' : 'ws';
    const host = base.replace(/^https?:\/\//, '');
    const url = options.url ?? `${scheme}://${host}/ws/agent-check?${params.toString()}`;

    const ws = this.wsFactory(url);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (event: MessageEvent) => this.handleMessage(event.data);
    ws.onclose = () => this.handleClose();
    ws.onerror = () => this.events.onError?.('Connection error');
    this.ws = ws;
  }

  /** Unexpected disconnect: retry with backoff up to a cap; a deliberate close never reaches here reconnecting. */
  private handleClose(): void {
    if (this.intentionalClose || !this.lastOptions) {
      this.events.onClose?.();
      return;
    }
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.events.onClose?.();
      return;
    }
    this.reconnectAttempt += 1;
    this.events.onReconnecting?.(this.reconnectAttempt);
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempt - 1), RECONNECT_MAX_DELAY_MS);
    this.reconnectTimer = setTimeout(() => {
      if (this.lastOptions) this.openSocket(this.lastOptions);
    }, delay);
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
    // The server closes the socket in response — mark this deliberate so
    // handleClose() doesn't treat the server's close as a drop to recover from.
    this.intentionalClose = true;
    this.sendFrame({ type: 'end-session' });
  }

  close(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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
        if (frame.sessionId) {
          this.lastSessionId = frame.sessionId;
          this.reconnectAttempt = 0;
          this.events.onSessionStarted?.(frame.sessionId, frame.resumed === true);
        }
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
