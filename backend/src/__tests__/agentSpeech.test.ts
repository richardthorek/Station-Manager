/**
 * Unit tests for the voice-agent speech adapters (A3 inc 3) — Azure Speech
 * short-audio STT and TTS REST calls with a mocked provider.
 */

import { recognizeSpeech, synthesizeSpeech, TTS_OUTPUT_FORMAT } from '../services/agentSpeech';

const wav = Buffer.from('RIFF-fake-wav');

function jsonReply(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

function audioReply(bytes: Buffer, status = 200) {
  return {
    ok: status < 400,
    status,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as Response;
}

beforeEach(() => {
  process.env.AZURE_SPEECH_KEY = 'unit-test-key';
  process.env.AZURE_SPEECH_REGION = 'australiaeast';
  delete process.env.AZURE_SPEECH_VOICE;
  delete process.env.AZURE_SPEECH_LANGUAGE;
});

afterAll(() => {
  delete process.env.AZURE_SPEECH_KEY;
  delete process.env.AZURE_SPEECH_REGION;
});

describe('recognizeSpeech', () => {
  it('returns 503 without calling the provider when speech is unconfigured', async () => {
    delete process.env.AZURE_SPEECH_KEY;
    const fetchMock = jest.fn();
    const out = await recognizeSpeech(wav, fetchMock as unknown as typeof fetch);
    expect(out.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs WAV to the regional STT endpoint and returns the display text', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonReply({ RecognitionStatus: 'Success', DisplayText: 'Tyres are all good.' }));
    const out = await recognizeSpeech(wav, fetchMock as unknown as typeof fetch);

    expect(out).toEqual({ status: 200, text: 'Tyres are all good.' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('australiaeast.stt.speech.microsoft.com');
    expect(url).toContain('language=en-AU');
    expect((init.headers as Record<string, string>)['Ocp-Apim-Subscription-Key']).toBe('unit-test-key');
    expect((init.headers as Record<string, string>)['Content-Type']).toContain('samplerate=16000');
  });

  it('treats silence / NoMatch as a successful empty result', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonReply({ RecognitionStatus: 'NoMatch' }));
    const out = await recognizeSpeech(wav, fetchMock as unknown as typeof fetch);
    expect(out.status).toBe(200);
    expect(out.text).toBeUndefined();
  });

  it('surfaces provider HTTP errors and network failures', async () => {
    const failing = jest.fn().mockResolvedValue(jsonReply({}, 401));
    expect((await recognizeSpeech(wav, failing as unknown as typeof fetch)).status).toBe(401);

    const throwing = jest.fn().mockRejectedValue(new Error('offline'));
    expect((await recognizeSpeech(wav, throwing as unknown as typeof fetch)).status).toBe(502);
  });
});

describe('synthesizeSpeech', () => {
  it('returns 503 without calling the provider when speech is unconfigured', async () => {
    delete process.env.AZURE_SPEECH_REGION;
    const fetchMock = jest.fn();
    const out = await synthesizeSpeech('hello', fetchMock as unknown as typeof fetch);
    expect(out.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs SSML with the AU voice and returns MP3 bytes', async () => {
    const mp3 = Buffer.from([0xff, 0xf3, 0x01, 0x02]);
    const fetchMock = jest.fn().mockResolvedValue(audioReply(mp3));
    const out = await synthesizeSpeech('Check the pump next.', fetchMock as unknown as typeof fetch);

    expect(out.status).toBe(200);
    expect(Buffer.compare(out.audio!, mp3)).toBe(0);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://australiaeast.tts.speech.microsoft.com/cognitiveservices/v1');
    expect(init.body).toContain("voice name='en-AU-NatashaNeural'");
    expect(init.body).toContain('Check the pump next.');
    expect((init.headers as Record<string, string>)['X-Microsoft-OutputFormat']).toBe(TTS_OUTPUT_FORMAT);
  });

  it('escapes XML-significant characters in the reply text', async () => {
    const fetchMock = jest.fn().mockResolvedValue(audioReply(Buffer.from([1])));
    await synthesizeSpeech(`Tank is < half & "low"`, fetchMock as unknown as typeof fetch);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toContain('Tank is &lt; half &amp; &quot;low&quot;');
  });

  it('honours the AZURE_SPEECH_VOICE override', async () => {
    process.env.AZURE_SPEECH_VOICE = 'en-AU-WilliamNeural';
    const fetchMock = jest.fn().mockResolvedValue(audioReply(Buffer.from([1])));
    await synthesizeSpeech('hi', fetchMock as unknown as typeof fetch);
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toContain("voice name='en-AU-WilliamNeural'");
  });

  it('surfaces provider HTTP errors and network failures', async () => {
    const failing = jest.fn().mockResolvedValue(audioReply(Buffer.from([]), 429));
    expect((await synthesizeSpeech('hi', failing as unknown as typeof fetch)).status).toBe(429);

    const throwing = jest.fn().mockRejectedValue(new Error('offline'));
    expect((await synthesizeSpeech('hi', throwing as unknown as typeof fetch)).status).toBe(502);
  });
});
