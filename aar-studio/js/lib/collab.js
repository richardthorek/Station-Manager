// Collaborative session notes — thin wrapper over Socket.io (loaded from
// jsDelivr, like the Speech SDK). The facilitator hosts a session; participants
// join on their own devices and push timestamped text notes that fan out to the
// room. The relay is ephemeral — the facilitator's browser stores the notes.

const SDK_URL = 'https://cdn.jsdelivr.net/npm/socket.io-client@4.8.1/dist/socket.io.min.js';

let sdkPromise = null;
let socket = null;
// Server-side room membership (socket.join) is tied to the underlying
// connection and does not survive a reconnect — Socket.io transparently
// reconnects after a network blip (or a laptop sleep), but the facilitator
// or participant silently falls out of the room unless they re-announce
// themselves. Replay whichever of these applies on every 'connect' event so
// room notes keep flowing instead of vanishing after a dropout while the
// sender still sees "sent" (AAR Studio hero review 2026-07-03, AAR-7).
let hostState = null; // { code } — set by hostSession
let joinState = null; // { code, label } — set by joinSession

function loadIo() {
  if (globalThis.io) return Promise.resolve(globalThis.io);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.onload = () => (globalThis.io ? resolve(globalThis.io) : reject(new Error('socket.io-client loaded but io global is missing')));
      script.onerror = () => { sdkPromise = null; reject(new Error('Could not load socket.io-client from cdn.jsdelivr.net — check the network and that the CSP allows jsDelivr')); };
      document.head.append(script);
    });
  }
  return sdkPromise;
}

async function getSocket() {
  const io = await loadIo();
  if (!socket) {
    socket = io({ transports: ['websocket', 'polling'] });
    // Fires on the initial connect AND every automatic reconnect — re-join
    // whichever room this tab was last in. Fire-and-forget: this is a
    // background resync, not a user-initiated action awaiting a result.
    socket.on('connect', () => {
      if (hostState) socket.emit('aar:host', { code: hostState.code }, () => {});
      if (joinState) socket.emit('aar:join', { code: joinState.code, label: joinState.label }, () => {});
    });
  }
  return socket;
}

/**
 * Deterministic, legible join code from a session id (stable across reloads,
 * no server state). Avoids I/O/0/1 to reduce mis-reads. e.g. "WAMB-42".
 */
export function codeForSession(id) {
  let hash = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let core = '';
  let n = hash;
  for (let i = 0; i < 4; i++) { core += letters[n % letters.length]; n = Math.floor(n / letters.length); }
  const digits = String(hash % 90 + 10); // 10–99, never starts a code so it stays readable
  return `${core}-${digits}`;
}

/** Full join URL a participant opens on their phone. */
export function joinUrl(code) {
  return `${location.origin}/aar/#/join/${code}`;
}

/** Facilitator: host the session and listen for incoming notes/joins. */
export async function hostSession(code, { onNote, onParticipant } = {}) {
  const s = await getSocket();
  s.off('aar:note');
  s.off('aar:participant-joined');
  if (onNote) s.on('aar:note', onNote);
  if (onParticipant) s.on('aar:participant-joined', onParticipant);
  hostState = { code };
  return new Promise((resolve, reject) => {
    s.emit('aar:host', { code }, (res) => (res?.ok ? resolve(res) : reject(new Error(res?.error || 'Could not host the session'))));
  });
}

/** Participant: join an existing session. */
export async function joinSession(code, label) {
  const s = await getSocket();
  joinState = { code, label };
  return new Promise((resolve, reject) => {
    s.emit('aar:join', { code, label }, (res) => (res?.ok ? resolve(res) : reject(new Error(res?.error || 'Could not join the session'))));
  });
}

/**
 * Subscribe to socket connection state (AAR Studio hero review 2026-07-03,
 * AAR-13). Calls cb(true) on connect and cb(false) on disconnect so a
 * participant's status line reflects reality instead of a write-once
 * "Connected" that lies after the phone sleeps. Returns an unsubscribe fn.
 */
export async function onConnectionChange(cb) {
  const s = await getSocket();
  const onConnect = () => cb(true);
  const onDisconnect = () => cb(false);
  s.on('connect', onConnect);
  s.on('disconnect', onDisconnect);
  return () => { s.off('connect', onConnect); s.off('disconnect', onDisconnect); };
}

/** Participant: send a note. Resolves with the server-stamped note. */
export async function sendNote({ code, text, label, offsetSec = null }) {
  const s = await getSocket();
  return new Promise((resolve, reject) => {
    s.emit('aar:note', { code, text, label, clientTs: Date.now(), offsetSec }, (res) => (res?.ok ? resolve(res.note) : reject(new Error(res?.error || 'Could not send the note'))));
  });
}
