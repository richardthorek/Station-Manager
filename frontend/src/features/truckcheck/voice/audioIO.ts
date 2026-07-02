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

/** Play one agent reply, revoking the object URL when done. */
export function playAudioBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  audio.onerror = () => URL.revokeObjectURL(url);
  void audio.play().catch(() => URL.revokeObjectURL(url));
}
