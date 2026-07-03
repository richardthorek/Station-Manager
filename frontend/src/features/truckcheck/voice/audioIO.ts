/**
 * Browser audio I/O shell for the voice agent (A3 inc 3) — microphone capture
 * and reply playback. Deliberately thin: the encoding maths lives in the
 * tested audioEncoding.ts, and this file (getUserMedia / AudioContext /
 * HTMLAudioElement — none available in jsdom) is coverage-excluded alongside
 * the other browser-only utilities in vite.config.ts.
 */

import { downsampleTo16k, floatToPcm16 } from './audioEncoding';

export class MicCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;

  get isActive(): boolean {
    return this.stream !== null;
  }

  /** Start capturing; each chunk is 16 kHz PCM16 ready for the wire. */
  async start(onChunk: (pcm: ArrayBuffer) => void): Promise<void> {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    this.context = new AudioContext();
    // iOS Safari can hand back a context in 'suspended' state — e.g. if the
    // getUserMedia permission prompt's delay broke the user-gesture chain —
    // in which case onaudioprocess still fires but delivers silence, with no
    // error, so the UI shows "Listening…" while capturing nothing
    // (A3 code review F8). Explicitly resume, and fail loudly rather than
    // silently capturing nothing if it still isn't running afterwards.
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.source = this.context.createMediaStreamSource(this.stream);
    // ScriptProcessor is deprecated but universally supported and sufficient
    // for push-to-talk; an AudioWorklet can replace it without touching callers.
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    const inputRate = this.context.sampleRate;
    this.processor.onaudioprocess = (event) => {
      const samples = event.inputBuffer.getChannelData(0);
      onChunk(floatToPcm16(downsampleTo16k(samples, inputRate)));
    };
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);

    if (this.context.state !== 'running') {
      this.stop();
      throw new Error('Microphone audio context did not start (browser blocked it)');
    }
  }

  stop(): void {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close().catch(() => undefined);
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.context = null;
  }
}

// Shortest valid silent WAV (44-byte header, zero data bytes) as a data URI —
// no network request, and silent so nothing is audibly played.
const SILENT_CLIP = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

/**
 * Unlock audio playback for this page. Call this synchronously from within a
 * genuine user-gesture handler (e.g. pointerdown on the talk button) — iOS
 * Safari rejects `HTMLMediaElement.play()` calls made outside a gesture call
 * stack, so without this the agent's spoken reply (played later, async, when
 * the WS message arrives) is silently blocked on iPad with no visible error
 * (A3 code review F8). Playing a silent clip here unlocks the element for
 * later `.play()` calls on the same page; safe to call on every gesture.
 */
export function unlockAudioPlayback(): void {
  const audio = new Audio(SILENT_CLIP);
  audio.play().catch(() => {
    // If even this is rejected, a real reply's play() will be too;
    // playAudioBlob's own rejection handler reports that when it happens.
  });
}

/**
 * Play one agent reply, revoking the object URL when done. Reports a
 * blocked/failed play via `onError` instead of failing silently — previously
 * a rejected `.play()` (e.g. the autoplay policy on iPad) was swallowed with
 * no feedback, so the member saw the agent's text reply but never knew audio
 * was supposed to play too (A3 code review F8).
 */
export function playAudioBlob(blob: Blob, onError?: (message: string) => void): void {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  const cleanup = () => URL.revokeObjectURL(url);
  audio.onended = cleanup;
  audio.onerror = () => {
    cleanup();
    onError?.("The agent's spoken reply could not be played.");
  };
  audio.play().catch(() => {
    cleanup();
    onError?.('Playback was blocked by the browser — showing the reply as text only.');
  });
}
