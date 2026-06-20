// Live listen controller: one shared audio pipeline (room mic / shared tab
// audio / uploaded file) → AudioWorklet tap → 16 kHz mono PCM16 → Azure
// Speech push stream. Final segments land in the session tagged with the
// current phase; auto-extraction runs on the 45 s / 70-word policy. The
// controller is a singleton so it survives view re-renders.

import * as store from '../store.js';
import { getSettings } from '../settings.js';
import { createSegment } from '../lib/model.js';
import { countWords } from '../lib/text.js';
import { rms, downsampleTo16k, createSpeakerLabeler } from '../lib/audioUtils.js';
import { loadSpeechSdk, createTranscriber } from './speech.js';
import { noteNewWords, maybeAutoExtract, analyseNow, fillMetadataFromDiscussion } from '../analyse.js';

export const SOURCES = {
  mic: { label: 'Room microphone', icon: '🎙' },
  display: { label: 'Shared tab / system audio', icon: '🖥' },
  file: { label: 'Audio file', icon: '📂' },
};

// Plain-language messages for the gateway's gating responses.
const SPEECH_TOKEN_HINTS = {
  401: 'Please sign in to your team account to use live listening.',
  402: 'AI session limit reached — upgrade or top up to keep using live listening.',
  403: 'Live listening needs the AI Pro plan. Upgrade to turn it on.',
  503: 'The AI speech service isn’t set up on the server yet. Ask your administrator to configure it.',
};

function gatewayAuthHeader() {
  try {
    const token = globalThis.localStorage?.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Gateway mode: ask the server to vend a short-lived Azure Speech token so the
 * browser never holds a subscription key. Returns { token, region }. Throws a
 * friendly Error on a gating/availability failure.
 */
async function fetchSpeechToken() {
  let res;
  try {
    res = await fetch('/api/ai/speech/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...gatewayAuthHeader() },
      body: JSON.stringify({}),
    });
  } catch {
    throw new Error('Could not reach the AI service to start listening. Check you are online and try again.');
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error ?? ''; } catch { /* not json */ }
    throw new Error(SPEECH_TOKEN_HINTS[res.status] || `Speech service error (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}

const state = {
  status: 'idle', // idle | starting | listening | stopping
  source: null,
  startedAt: null,
  level: 0,
  interim: '',
  interimSpeaker: '',
  error: '',
  recording: false,
  recordingUrl: null,
  recordingName: '',
};

export function getState() {
  return state;
}

// Single UI listener (only the Capture view shows live state); re-registered
// on every render so it always holds fresh DOM references.
let uiListener = null;
export function setUiListener(fn) {
  uiListener = fn;
}
function emit(event = 'state') {
  uiListener?.(event, state);
}

let audioCtx = null;
let workletNode = null;
let sourceNode = null;
let mediaStream = null;
let transcriber = null;
let recorder = null;
let autoTimer = null;
let labeler = null;

async function getInput(sourceKind, file) {
  if (sourceKind === 'mic') {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    return audioCtx.createMediaStreamSource(mediaStream);
  }
  if (sourceKind === 'display') {
    // Video must be requested for tab/screen pickers; audio only flows if the
    // user ticks "share audio" in the picker.
    mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    if (!mediaStream.getAudioTracks().length) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
      throw new Error('No audio in the shared source — pick the Teams tab/window and tick “Share audio” in the browser dialog');
    }
    return audioCtx.createMediaStreamSource(mediaStream);
  }
  if (sourceKind === 'file') {
    const buffer = await audioCtx.decodeAudioData(await file.arrayBuffer());
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.onended = () => stop();
    return src;
  }
  throw new Error(`Unknown audio source: ${sourceKind}`);
}

function startBackupRecording(sourceKind, file) {
  if (!mediaStream || !globalThis.MediaRecorder) return;
  try {
    const audioOnly = new MediaStream(mediaStream.getAudioTracks());
    recorder = new MediaRecorder(audioOnly);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      state.recordingUrl = URL.createObjectURL(blob);
      const ext = (recorder.mimeType || 'audio/webm').includes('ogg') ? 'ogg' : 'webm';
      state.recordingName = `aar-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
      state.recording = false;
      emit();
    };
    recorder.start(1000);
    state.recording = true;
  } catch (err) {
    console.warn('backup recording unavailable', err);
    state.recording = false;
  }
  // An uploaded file needs no backup — the user already has it.
  void sourceKind; void file;
}

function onFinal(text, speakerId, offsetSec) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return;
  const t = offsetSec != null ? Math.round(offsetSec) : Math.round((Date.now() - state.startedAt) / 1000);
  store.update((s) => {
    s.segments.push(createSegment({ t, speaker: labeler(speakerId), text: trimmed, phase: s.currentPhase, source: state.source === 'file' ? 'file' : 'live' }));
  }, { reason: 'segments' });
  state.interim = '';
  state.interimSpeaker = '';
  noteNewWords(countWords(trimmed));
  // No emit needed — the store update above already re-renders the view.
}

/**
 * Start live listening. sourceKind: 'mic' | 'display' | 'file'.
 * options: { file?: File, backup?: boolean }
 */
export async function start(sourceKind, { file = null, backup = false } = {}) {
  if (state.status !== 'idle') return;
  const settings = getSettings();
  state.status = 'starting';
  state.source = sourceKind;
  state.error = '';
  if (state.recordingUrl) { URL.revokeObjectURL(state.recordingUrl); state.recordingUrl = null; }
  emit();

  try {
    const sdk = await loadSpeechSdk();

    // Gateway mode (no user-supplied Speech key): vend a short-lived token from
    // the server. This also runs the AI session allowance/entitlement gate, so a
    // 402/403/503 here stops the start cleanly with a friendly message.
    let liveSettings = settings;
    if (!String(settings.speechKey ?? '').trim()) {
      const { token, region } = await fetchSpeechToken();
      liveSettings = { ...settings, authToken: token, speechRegion: region || settings.speechRegion };
    }

    audioCtx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    await audioCtx.resume();
    await audioCtx.audioWorklet.addModule('./js/audio/worklet.js');

    sourceNode = await getInput(sourceKind, file);

    labeler = createSpeakerLabeler();
    transcriber = createTranscriber({
      sdk,
      settings: liveSettings,
      onInterim: (text, speakerId) => {
        state.interim = text ?? '';
        state.interimSpeaker = labeler(speakerId);
        emit('interim');
      },
      onFinal,
      onError: (message) => {
        state.error = message;
        emit();
        stop();
      },
    });

    workletNode = new AudioWorkletNode(audioCtx, 'pcm-tap');
    const sampleRate = audioCtx.sampleRate;
    workletNode.port.onmessage = ({ data }) => {
      state.level = rms(data);
      transcriber?.push(downsampleTo16k(data, sampleRate).buffer);
      emit('level');
    };
    // Pull the graph through a muted gain so nothing is audible (mic would
    // feed back) but the worklet still processes.
    const mute = audioCtx.createGain();
    mute.gain.value = 0;
    sourceNode.connect(workletNode);
    workletNode.connect(mute);
    mute.connect(audioCtx.destination);

    await transcriber.start();
    if (sourceKind === 'file') sourceNode.start();
    if (backup && sourceKind !== 'file') startBackupRecording(sourceKind, file);

    state.status = 'listening';
    state.startedAt = Date.now();
    autoTimer = setInterval(() => { maybeAutoExtract(); }, 5000);
    emit();

    // If the user ends a screen-share from the browser chrome, stop cleanly.
    mediaStream?.getTracks().forEach((track) => { track.onended = () => stop(); });
  } catch (err) {
    state.error = err?.message ?? String(err);
    await teardown();
    state.status = 'idle';
    emit();
  }
}

async function teardown() {
  clearInterval(autoTimer);
  autoTimer = null;
  if (recorder?.state === 'recording') recorder.stop();
  recorder = null;
  try { workletNode?.port.close(); workletNode?.disconnect(); } catch { /* already gone */ }
  workletNode = null;
  try { sourceNode?.stop?.(); sourceNode?.disconnect(); } catch { /* buffer sources throw if never started */ }
  sourceNode = null;
  mediaStream?.getTracks().forEach((t) => t.stop());
  mediaStream = null;
  const t = transcriber;
  transcriber = null;
  await t?.stop().catch(() => {});
  await audioCtx?.close().catch(() => {});
  audioCtx = null;
  state.level = 0;
  state.interim = '';
  state.interimSpeaker = '';
}

export async function stop() {
  if (state.status !== 'listening' && state.status !== 'starting') return;
  state.status = 'stopping';
  emit();
  await teardown();
  state.status = 'idle';
  emit();
  // Wrap up: analyse whatever the last extraction pass hasn't seen, then fill in
  // any incident details the discussion revealed (title, location, units, type).
  const session = store.getSession();
  if (session?.segments.some((seg) => !seg.analysed && seg.text.trim())) {
    await analyseNow(null, { quiet: true });
  }
  fillMetadataFromDiscussion();
}
