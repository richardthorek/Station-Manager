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
 * Cancellation error codes that mean "the credential died", not "the audio/
 * network died" — these are the ones a fresh token can plausibly recover from.
 * (AAR Studio hero review 2026-07-03, AAR-6.)
 */
export function isAuthCancellation(sdk, e) {
  if (e?.reason !== sdk.CancellationReason.Error) return false;
  const code = e.errorCode;
  return code === sdk.CancellationErrorCode.AuthenticationFailure
    || code === sdk.CancellationErrorCode.ConnectionFailure;
}

/**
 * Create a live transcriber over a push stream.
 * Callbacks: onInterim(text, speakerId), onFinal(text, speakerId, offsetSec),
 * onError(message, { authFlavoured }) — authFlavoured hints that a fresh
 * token/reconnect may fix it (vs. a genuine mic/config problem).
 * Returns { start, stop, push, updateAuthToken } — push takes an ArrayBuffer
 * of PCM16 @16 kHz; updateAuthToken swaps in a freshly-vended gateway token
 * without tearing down the connection (Azure Speech SDK auth tokens expire
 * after ~10 minutes — a live AAR meeting regularly runs longer).
 */
export function createTranscriber({ sdk, settings, onInterim, onFinal, onError }) {
  if (!settings.speechRegion || (!settings.authToken && !settings.speechKey)) {
    throw new Error('No Azure Speech credentials available — sign in to use the built-in AI, or set a Speech key/region in Settings');
  }
  // Gateway mode vends a short-lived authorization token (no subscription key in
  // the browser); direct mode uses the user's own Speech key from Settings.
  const speechConfig = settings.authToken
    ? sdk.SpeechConfig.fromAuthorizationToken(settings.authToken, settings.speechRegion)
    : sdk.SpeechConfig.fromSubscription(settings.speechKey, settings.speechRegion);
  speechConfig.speechRecognitionLanguage = settings.language || 'en-AU';

  const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
  const pushStream = sdk.AudioInputStream.createPushStream(format);
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

  // Gateway mode (the default — no user-supplied Speech key) vs. a BYO-Azure
  // developer/self-host override: the two audiences need different advice,
  // and telling a bushie on the built-in AI to "check the Speech key in
  // Settings" sends them into a page that isn't meant for them (AAR Studio
  // hero review 2026-07-03, AAR-9).
  const gatewayMode = Boolean(settings.authToken);
  const offsetSec = (result) => (result.offset != null ? result.offset / 1e7 : null); // 100 ns ticks
  const handleCanceled = (e) => {
    if (e.reason === sdk.CancellationReason.Error) {
      const authFlavoured = isAuthCancellation(sdk, e);
      const hint = authFlavoured
        ? 'Reconnecting…'
        : gatewayMode
          ? 'Try again in a moment — if it keeps happening, tell your administrator.'
          : 'Check the Speech key/region in Settings.';
      onError(`Speech service error: ${e.errorDetails || e.errorCode}. ${hint}`, { authFlavoured });
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
    // Swap in a freshly-vended token on the live connection — the SDK applies
    // it to the next reconnect without needing a new recognizer instance.
    updateAuthToken: (token) => { engine.authorizationToken = token; },
  };
}
