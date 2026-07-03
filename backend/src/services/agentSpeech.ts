/**
 * Voice-agent speech adapters (A3 inc 3) — Azure Speech REST, server-side.
 *
 * Per the D3 decision, audio is proxied through the backend: the PWA never
 * holds a speech key or talks to Azure directly. Inc 3 uses the short-audio
 * REST endpoints with push-to-talk utterances (≤60 s of 16 kHz mono PCM WAV),
 * which needs no SDK and is fully unit-testable; a streaming/continuous
 * recogniser can replace recognizeSpeech behind the same WS frames later.
 *
 * Env (already used by the AAR speech-token vend): AZURE_SPEECH_KEY,
 * AZURE_SPEECH_REGION. Optional: AZURE_SPEECH_VOICE (default en-AU-NatashaNeural),
 * AZURE_SPEECH_LANGUAGE (default en-AU).
 */

import { logger } from './logger';

const DEFAULT_VOICE = 'en-AU-NatashaNeural';
const DEFAULT_LANGUAGE = 'en-AU';

/** Output format for TTS replies — mp3 plays natively in every PWA target. */
export const TTS_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
export const TTS_MIME_TYPE = 'audio/mpeg';

export interface RecognitionResult {
  /** HTTP-ish status: 200 on success (even when nothing was recognised). */
  status: number;
  /** Recognised utterance; undefined when nothing was recognised or on error. */
  text?: string;
  error?: string;
}

export interface SynthesisResult {
  status: number;
  /** MP3 bytes; undefined on error. */
  audio?: Buffer;
  error?: string;
}

/** Sample rate the whole voice pipeline runs at (client downsamples to this). */
export const PCM_SAMPLE_RATE = 16000;

/**
 * Wrap raw 16 kHz 16-bit mono PCM in a WAV container (44-byte RIFF header),
 * the shape the STT short-audio endpoint expects. The client streams bare PCM
 * chunks over the WS; the server does the (trivial) containerising.
 */
export function buildWavFile(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = PCM_SAMPLE_RATE * 2; // mono, 16-bit
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);          // PCM fmt chunk size
  header.writeUInt16LE(1, 20);           // PCM format
  header.writeUInt16LE(1, 22);           // channels
  header.writeUInt32LE(PCM_SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);           // block align
  header.writeUInt16LE(16, 34);          // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function speechConfig(): { key: string; region: string } | null {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  return key && region ? { key, region } : null;
}

/**
 * Recognise one push-to-talk utterance. `wavAudio` must be a complete WAV
 * container of 16 kHz 16-bit mono PCM (the client encodes this shape).
 */
export async function recognizeSpeech(wavAudio: Buffer, fetchImpl: typeof fetch = fetch): Promise<RecognitionResult> {
  const config = speechConfig();
  if (!config) {
    return { status: 503, error: 'Speech is not configured on this server' };
  }

  const language = process.env.AZURE_SPEECH_LANGUAGE || DEFAULT_LANGUAGE;
  const url = `https://${config.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=simple`;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.key,
        'Content-Type': `audio/wav; codecs=audio/pcm; samplerate=${PCM_SAMPLE_RATE}`,
        Accept: 'application/json',
      },
      body: new Uint8Array(wavAudio),
    });
  } catch (err) {
    logger.error('Agent speech: could not reach Azure STT', { error: err });
    return { status: 502, error: 'Could not reach the speech provider' };
  }

  if (!res.ok) {
    logger.warn('Agent speech: STT request failed', { status: res.status });
    return { status: res.status, error: `Speech recognition failed (${res.status})` };
  }

  let body: { RecognitionStatus?: string; DisplayText?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { status: 502, error: 'Speech provider returned a non-JSON response' };
  }

  if (body.RecognitionStatus !== 'Success' || !body.DisplayText) {
    // Silence / no match is a normal outcome, not an error.
    return { status: 200 };
  }
  return { status: 200, text: body.DisplayText };
}

/** Escape text for embedding in SSML. */
function escapeXml(text: string): string {
  return text
    // Strip control characters that are not valid XML Chars (e.g. a stray
    // byte from a mis-decoded upstream payload echoed into the LLM reply) —
    // entity-escaping alone doesn't help here, since these bytes are illegal
    // in XML regardless of escaping, and would otherwise make Azure TTS
    // reject the whole SSML request with no user-visible reply
    // (A3 code review, reuse/simplification section).
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Synthesise an agent reply to MP3 with the configured Australian voice. */
export async function synthesizeSpeech(text: string, fetchImpl: typeof fetch = fetch): Promise<SynthesisResult> {
  const config = speechConfig();
  if (!config) {
    return { status: 503, error: 'Speech is not configured on this server' };
  }

  const voice = process.env.AZURE_SPEECH_VOICE || DEFAULT_VOICE;
  const language = process.env.AZURE_SPEECH_LANGUAGE || DEFAULT_LANGUAGE;
  const url = `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml =
    `<speak version='1.0' xml:lang='${language}'>` +
    `<voice name='${voice}'>${escapeXml(text)}</voice>` +
    `</speak>`;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': TTS_OUTPUT_FORMAT,
      },
      body: ssml,
    });
  } catch (err) {
    logger.error('Agent speech: could not reach Azure TTS', { error: err });
    return { status: 502, error: 'Could not reach the speech provider' };
  }

  if (!res.ok) {
    logger.warn('Agent speech: TTS request failed', { status: res.status });
    return { status: res.status, error: `Speech synthesis failed (${res.status})` };
  }

  const audio = Buffer.from(await res.arrayBuffer());
  return { status: 200, audio };
}
