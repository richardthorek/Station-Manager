/**
 * Pure audio-encoding helpers for the voice agent (A3 inc 3).
 *
 * The backend speech pipeline runs at 16 kHz 16-bit mono PCM; the browser
 * captures Float32 at the device rate (typically 44.1/48 kHz). These helpers
 * do the downsample + PCM16 conversion so audioIO.ts can stay a thin
 * browser-API shell.
 */

export const TARGET_SAMPLE_RATE = 16000;

/**
 * Downsample mono Float32 samples to the target rate by averaging each
 * source window (cheap low-pass + decimate; fine for speech).
 */
export function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === TARGET_SAMPLE_RATE) return input;
  if (inputRate < TARGET_SAMPLE_RATE) {
    throw new Error(`Cannot upsample from ${inputRate} Hz`);
  }
  const ratio = inputRate / TARGET_SAMPLE_RATE;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

/** Convert Float32 samples ([-1, 1]) to little-endian signed 16-bit PCM bytes. */
export function floatToPcm16(input: Float32Array): ArrayBuffer {
  const out = new DataView(new ArrayBuffer(input.length * 2));
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    out.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return out.buffer;
}
