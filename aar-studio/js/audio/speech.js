// Azure AI Speech SDK: lazy load from jsDelivr + a thin transcriber wrapper
// over ConversationTranscriber (diarization on) / SpeechRecognizer (off),
// fed by a 16 kHz mono PCM16 push stream.

const SDK_URL = 'https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@1.42.0/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js';

let sdkPromise = null;

/** Inject the UMD bundle once (CSP allows cdn.jsdelivr.net) and return SpeechSDK. */
export function loadSpeechSdk() {
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      if (globalThis.SpeechSDK) return resolve(globalThis.SpeechSDK);
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.onload = () => {
        if (globalThis.SpeechSDK) resolve(globalThis.SpeechSDK);
        else reject(new Error('Speech SDK script loaded but SpeechSDK global is missing'));
      };
      script.onerror = () => {
        sdkPromise = null; // allow retry
        reject(new Error('Could not load the Azure Speech SDK from cdn.jsdelivr.net — check the network connection and that the CSP allows jsDelivr'));
      };
      document.head.append(script);
    });
  }
  return sdkPromise;
}

/**
 * Create a live transcriber over a push stream.
 * Callbacks: onInterim(text, speakerId), onFinal(text, speakerId, offsetSec),
 * onError(message).
 * Returns { start, stop, push } — push takes an ArrayBuffer of PCM16 @16 kHz.
 */
export function createTranscriber({ sdk, settings, onInterim, onFinal, onError }) {
  if (!settings.speechKey || !settings.speechRegion) {
    throw new Error('No Azure Speech key/region configured — open Settings and fill in the Speech section');
  }
  const speechConfig = sdk.SpeechConfig.fromSubscription(settings.speechKey, settings.speechRegion);
  speechConfig.speechRecognitionLanguage = settings.language || 'en-AU';

  const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
  const pushStream = sdk.AudioInputStream.createPushStream(format);
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

  const offsetSec = (result) => (result.offset != null ? result.offset / 1e7 : null); // 100 ns ticks
  const handleCanceled = (e) => {
    if (e.reason === sdk.CancellationReason.Error) {
      onError(`Speech service error: ${e.errorDetails || e.errorCode}. Check the Speech key/region in Settings.`);
    }
  };

  let engine;
  let startFn;
  let stopFn;
  if (settings.diarization) {
    engine = new sdk.ConversationTranscriber(speechConfig, audioConfig);
    engine.transcribing = (_, e) => onInterim(e.result.text, e.result.speakerId);
    engine.transcribed = (_, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) {
        onFinal(e.result.text, e.result.speakerId, offsetSec(e.result));
      }
    };
    engine.canceled = (_, e) => handleCanceled(e);
    startFn = (res, rej) => engine.startTranscribingAsync(res, rej);
    stopFn = (res, rej) => engine.stopTranscribingAsync(res, rej);
  } else {
    engine = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    engine.recognizing = (_, e) => onInterim(e.result.text, null);
    engine.recognized = (_, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) {
        onFinal(e.result.text, null, offsetSec(e.result));
      }
    };
    engine.canceled = (_, e) => handleCanceled(e);
    startFn = (res, rej) => engine.startContinuousRecognitionAsync(res, rej);
    stopFn = (res, rej) => engine.stopContinuousRecognitionAsync(res, rej);
  }

  return {
    start: () => new Promise((res, rej) => startFn(res, rej)),
    stop: () =>
      new Promise((res) => stopFn(res, res)).then(() => {
        pushStream.close();
        engine.close();
      }),
    push: (arrayBuffer) => pushStream.write(arrayBuffer),
  };
}
