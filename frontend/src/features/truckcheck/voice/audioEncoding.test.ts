import { describe, it, expect } from 'vitest';
import { downsampleTo16k, floatToPcm16, TARGET_SAMPLE_RATE } from './audioEncoding';

describe('downsampleTo16k', () => {
  it('returns the input untouched at 16 kHz', () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    expect(downsampleTo16k(input, TARGET_SAMPLE_RATE)).toBe(input);
  });

  it('halves the sample count from 32 kHz by averaging pairs', () => {
    const input = new Float32Array([0, 1, 0.5, 0.5, -1, 1]);
    const out = downsampleTo16k(input, 32000);
    expect(out.length).toBe(3);
    expect(out[0]).toBeCloseTo(0.5);
    expect(out[1]).toBeCloseTo(0.5);
    expect(out[2]).toBeCloseTo(0);
  });

  it('handles the common 48 kHz browser rate', () => {
    const input = new Float32Array(4800); // 100 ms at 48 kHz
    const out = downsampleTo16k(input, 48000);
    expect(out.length).toBe(1600); // 100 ms at 16 kHz
  });

  it('refuses to upsample', () => {
    expect(() => downsampleTo16k(new Float32Array(4), 8000)).toThrow(/upsample/i);
  });
});

describe('floatToPcm16', () => {
  it('encodes little-endian signed 16-bit values', () => {
    const view = new DataView(floatToPcm16(new Float32Array([0, 0.5, -0.5])));
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(Math.trunc(0.5 * 0x7fff));
    expect(view.getInt16(4, true)).toBe(-0.5 * 0x8000);
  });

  it('clamps out-of-range samples instead of wrapping', () => {
    const view = new DataView(floatToPcm16(new Float32Array([2, -2])));
    expect(view.getInt16(0, true)).toBe(0x7fff);
    expect(view.getInt16(2, true)).toBe(-0x8000);
  });

  it('produces two bytes per sample', () => {
    expect(floatToPcm16(new Float32Array(320)).byteLength).toBe(640);
  });
});
