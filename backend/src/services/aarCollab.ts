/**
 * AAR Studio collaborative session relay (Socket.io).
 *
 * Lets a room contribute timestamped text notes to a live After Action Review:
 * one facilitator hosts a session (a short join code); participants join on
 * their own devices and push notes that fan out to everyone in the room.
 *
 * The relay is intentionally **stateless and ephemeral** — notes are not
 * persisted server-side. The facilitator's browser is the source of truth and
 * stores notes in its session (localStorage). This keeps the no-backend spirit
 * of AAR Studio while reusing the existing Socket.io server (no new infra).
 *
 * Events (room = `aar-<CODE>`):
 *  - `aar:host`  {code}                → facilitator joins the room
 *  - `aar:join`  {code, label?}        → participant joins; others get `aar:participant-joined`
 *  - `aar:note`  {code, text, label?, clientTs?, offsetSec?}
 *                                      → server stamps + broadcasts `aar:note` to the room
 */

import { v4 as uuidv4 } from 'uuid';
import type { Server, Socket } from 'socket.io';
import { logger } from './logger';

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,11}$/;
export const MAX_NOTE_LENGTH = 2000;
export const MAX_LABEL_LENGTH = 40;
const NOTE_MIN_INTERVAL_MS = 300;

export interface AarNote {
  id: string;
  text: string;
  label: string;
  serverTs: number;
  clientTs?: number;
  offsetSec?: number | null;
}

export function isValidCode(code: unknown): code is string {
  return typeof code === 'string' && CODE_RE.test(code);
}

export function normalizeCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const upper = code.trim().toUpperCase();
  return isValidCode(upper) ? upper : null;
}

export function sanitizeLabel(label: unknown): string {
  if (typeof label !== 'string') return 'Room';
  const clean = label.trim().slice(0, MAX_LABEL_LENGTH);
  return clean || 'Room';
}

function roomName(code: string): string {
  return `aar-${code}`;
}

/**
 * Build the server-stamped note from a raw participant payload, or null when
 * the text is empty/invalid.
 */
export function buildNote(data: {
  text?: unknown;
  label?: unknown;
  clientTs?: unknown;
  offsetSec?: unknown;
}): AarNote | null {
  const text = typeof data?.text === 'string' ? data.text.trim().slice(0, MAX_NOTE_LENGTH) : '';
  if (!text) return null;
  return {
    id: uuidv4(),
    text,
    label: sanitizeLabel(data?.label),
    serverTs: Date.now(),
    clientTs: typeof data?.clientTs === 'number' ? data.clientTs : undefined,
    offsetSec: typeof data?.offsetSec === 'number' ? data.offsetSec : null,
  };
}

type Ack = ((response: unknown) => void) | undefined;

/**
 * Register the AAR collab handlers on a freshly connected socket. Call from
 * within io.on('connection', ...).
 */
export function registerAarCollabHandlers(io: Server, socket: Socket): void {
  let lastNoteAt = 0;

  socket.on('aar:host', (data: { code?: string }, ack: Ack) => {
    const code = normalizeCode(data?.code);
    if (!code) { ack?.({ ok: false, error: 'invalid-code' }); return; }
    socket.join(roomName(code));
    logger.info('AAR session hosted', { socketId: socket.id, code });
    ack?.({ ok: true });
  });

  socket.on('aar:join', (data: { code?: string; label?: string }, ack: Ack) => {
    const code = normalizeCode(data?.code);
    if (!code) { ack?.({ ok: false, error: 'invalid-code' }); return; }
    socket.join(roomName(code));
    socket.to(roomName(code)).emit('aar:participant-joined', { label: sanitizeLabel(data?.label) });
    logger.debug('AAR participant joined', { socketId: socket.id, code });
    ack?.({ ok: true });
  });

  socket.on('aar:note', (data: { code?: string; text?: string; label?: string; clientTs?: number; offsetSec?: number | null }, ack: Ack) => {
    const code = normalizeCode(data?.code);
    if (!code) { ack?.({ ok: false, error: 'invalid-code' }); return; }

    const now = Date.now();
    if (now - lastNoteAt < NOTE_MIN_INTERVAL_MS) { ack?.({ ok: false, error: 'too-fast' }); return; }

    const note = buildNote(data);
    if (!note) { ack?.({ ok: false, error: 'empty' }); return; }
    lastNoteAt = now;

    // Fan out to the rest of the room (facilitator + other participants).
    socket.to(roomName(code)).emit('aar:note', note);
    ack?.({ ok: true, note });
  });
}
