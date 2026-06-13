import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rms, floatToPcm16, downsampleTo16k, createSpeakerLabeler } from '../js/lib/audioUtils.js';

test('rms of silence is 0 and of a full-scale square wave is 1', () => {
  assert.equal(rms(new Float32Array(256)), 0);
  const square = new Float32Array(256).map((_, i) => (i % 2 ? 1 : -1));
  assert.ok(Math.abs(rms(square) - 1) < 1e-6);
  assert.equal(rms(null), 0);
});

test('floatToPcm16 clamps and scales', () => {
  assert.equal(floatToPcm16(0), 0);
  assert.equal(floatToPcm16(1), 32767);
  assert.equal(floatToPcm16(-1), -32768);
  assert.equal(floatToPcm16(2), 32767);   // clamp
  assert.equal(floatToPcm16(-2), -32768); // clamp
});

test('downsampleTo16k produces the right length and preserves a DC signal', () => {
  const input = new Float32Array(48000).fill(0.5); // 1 s @ 48 kHz
  const out = downsampleTo16k(input, 48000);
  assert.equal(out.length, 16000);
  assert.ok(out instanceof Int16Array);
  assert.equal(out[8000], floatToPcm16(0.5));
});

test('downsampleTo16k passes 16 kHz input through (converted to PCM16)', () => {
  const input = Float32Array.from([0, 0.5, -0.5, 1]);
  const out = downsampleTo16k(input, 16000);
  assert.deepEqual([...out], [0, floatToPcm16(0.5), floatToPcm16(-0.5), 32767]);
});

test('downsampleTo16k refuses to upsample', () => {
  assert.throws(() => downsampleTo16k(new Float32Array(10), 8000), /upsample/);
});

test('speaker labeler is stable, ordered by first appearance, and skips Unknown', () => {
  const label = createSpeakerLabeler();
  assert.equal(label('Guest-3'), 'Speaker 1');
  assert.equal(label('Guest-1'), 'Speaker 2');
  assert.equal(label('Guest-3'), 'Speaker 1'); // stable
  assert.equal(label('Unknown'), '');
  assert.equal(label(null), '');
});
