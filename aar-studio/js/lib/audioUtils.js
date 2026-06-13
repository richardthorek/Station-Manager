// Pure audio helpers: resampling to the 16 kHz mono PCM16 the Speech SDK
// push stream wants, level metering, and stable diarised-speaker labels.
// No DOM / Web Audio — covered by node --test.

/** Root-mean-square level of a Float32 block (0..~1). */
export function rms(float32) {
  if (!float32?.length) return 0;
  let sum = 0;
  for (let i = 0; i < float32.length; i++) sum += float32[i] * float32[i];
  return Math.sqrt(sum / float32.length);
}

/** Clamp a float sample [-1,1] to a signed 16-bit int. */
export function floatToPcm16(sample) {
  const s = Math.max(-1, Math.min(1, sample));
  return Math.round(s < 0 ? s * 0x8000 : s * 0x7fff);
}

/**
 * Downsample a Float32 block at `fromRate` to 16 kHz mono PCM16
 * (linear interpolation — fine for speech).
 * @returns {Int16Array}
 */
export function downsampleTo16k(float32, fromRate, toRate = 16000) {
  if (fromRate < toRate) throw new Error(`Cannot upsample ${fromRate} → ${toRate}`);
  if (fromRate === toRate) return Int16Array.from(float32, floatToPcm16);
  const ratio = fromRate / toRate;
  const outLength = Math.floor(float32.length / ratio);
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, float32.length - 1);
    const frac = pos - i0;
    out[i] = floatToPcm16(float32[i0] * (1 - frac) + float32[i1] * frac);
  }
  return out;
}

/**
 * Stable display labels for diarised speaker ids ("Guest-1" → "Speaker 1",
 * first-seen order). Unknown/absent ids get no label.
 */
export function createSpeakerLabeler() {
  const map = new Map();
  return (rawId) => {
    if (!rawId || rawId === 'Unknown') return '';
    if (!map.has(rawId)) map.set(rawId, `Speaker ${map.size + 1}`);
    return map.get(rawId);
  };
}
