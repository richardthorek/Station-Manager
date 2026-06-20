/**
 * AAR collaborative-notes relay: validation helpers + Socket.io handler wiring.
 * Exercised with a mock socket that captures joins, broadcasts and acks.
 */

import type { Server, Socket } from 'socket.io';
import {
  registerAarCollabHandlers,
  isValidCode,
  normalizeCode,
  sanitizeLabel,
  buildNote,
  MAX_NOTE_LENGTH,
  MAX_LABEL_LENGTH,
} from '../services/aarCollab';

interface Broadcast { room: string; event: string; payload: unknown }

function mockSocket() {
  const handlers: Record<string, (data: unknown, ack?: (r: unknown) => void) => void> = {};
  const joined: string[] = [];
  const broadcasts: Broadcast[] = [];
  const socket = {
    id: 'sock-1',
    on(event: string, fn: (data: unknown, ack?: (r: unknown) => void) => void) { handlers[event] = fn; },
    join(room: string) { joined.push(room); },
    to(room: string) {
      return { emit: (event: string, payload: unknown) => broadcasts.push({ room, event, payload }) };
    },
  } as unknown as Socket;
  registerAarCollabHandlers({} as Server, socket);
  return { handlers, joined, broadcasts };
}

function call(handlers: Record<string, (d: unknown, a?: (r: unknown) => void) => void>, event: string, data: unknown) {
  let ack: unknown;
  handlers[event](data, (r) => { ack = r; });
  return ack as { ok: boolean; error?: string; note?: { id: string; text: string; label: string } };
}

describe('aarCollab helpers', () => {
  it('isValidCode accepts well-formed codes and rejects junk', () => {
    expect(isValidCode('WAMB-42')).toBe(true);
    expect(isValidCode('A1')).toBe(true);
    expect(isValidCode('')).toBe(false);
    expect(isValidCode('has space')).toBe(false);
    expect(isValidCode('toolongcodehere')).toBe(false);
    expect(isValidCode(42)).toBe(false);
  });

  it('normalizeCode upcases and validates', () => {
    expect(normalizeCode(' wamb-42 ')).toBe('WAMB-42');
    expect(normalizeCode('nope nope')).toBeNull();
    expect(normalizeCode(null)).toBeNull();
  });

  it('sanitizeLabel trims, caps length, and defaults to Room', () => {
    expect(sanitizeLabel('  Pat  ')).toBe('Pat');
    expect(sanitizeLabel('')).toBe('Room');
    expect(sanitizeLabel(undefined)).toBe('Room');
    expect(sanitizeLabel('x'.repeat(100)).length).toBe(MAX_LABEL_LENGTH);
  });

  it('buildNote trims/caps text and returns null for empty', () => {
    expect(buildNote({ text: '   ' })).toBeNull();
    const note = buildNote({ text: '  hello  ', label: 'Pat', clientTs: 123, offsetSec: 5 });
    expect(note).toMatchObject({ text: 'hello', label: 'Pat', clientTs: 123, offsetSec: 5 });
    expect(note?.id).toBeTruthy();
    expect(buildNote({ text: 'y'.repeat(MAX_NOTE_LENGTH + 50) })?.text.length).toBe(MAX_NOTE_LENGTH);
  });
});

describe('aarCollab Socket.io handlers', () => {
  it('aar:host joins the room and acks ok', () => {
    const { handlers, joined } = mockSocket();
    const ack = call(handlers, 'aar:host', { code: 'wamb-42' });
    expect(ack.ok).toBe(true);
    expect(joined).toContain('aar-WAMB-42');
  });

  it('aar:host rejects an invalid code', () => {
    const { handlers, joined } = mockSocket();
    const ack = call(handlers, 'aar:host', { code: 'bad code!' });
    expect(ack.ok).toBe(false);
    expect(joined).toHaveLength(0);
  });

  it('aar:join joins and notifies the room', () => {
    const { handlers, joined, broadcasts } = mockSocket();
    const ack = call(handlers, 'aar:join', { code: 'WAMB-42', label: 'Pat' });
    expect(ack.ok).toBe(true);
    expect(joined).toContain('aar-WAMB-42');
    expect(broadcasts).toEqual([{ room: 'aar-WAMB-42', event: 'aar:participant-joined', payload: { label: 'Pat' } }]);
  });

  it('aar:note broadcasts a stamped note to the room and acks it', () => {
    const { handlers, broadcasts } = mockSocket();
    const ack = call(handlers, 'aar:note', { code: 'WAMB-42', text: 'BA crew rotated late', label: 'Pat' });
    expect(ack.ok).toBe(true);
    expect(ack.note?.text).toBe('BA crew rotated late');
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]).toMatchObject({ room: 'aar-WAMB-42', event: 'aar:note' });
    expect((broadcasts[0].payload as { text: string }).text).toBe('BA crew rotated late');
  });

  it('aar:note rejects an empty note', () => {
    const { handlers, broadcasts } = mockSocket();
    const ack = call(handlers, 'aar:note', { code: 'WAMB-42', text: '   ' });
    expect(ack.ok).toBe(false);
    expect(broadcasts).toHaveLength(0);
  });

  it('aar:note throttles rapid-fire notes from one socket', () => {
    const { handlers, broadcasts } = mockSocket();
    const first = call(handlers, 'aar:note', { code: 'WAMB-42', text: 'one' });
    const second = call(handlers, 'aar:note', { code: 'WAMB-42', text: 'two' });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.error).toBe('too-fast');
    expect(broadcasts).toHaveLength(1);
  });

  it('aar:note rejects an invalid code', () => {
    const { handlers, broadcasts } = mockSocket();
    const ack = call(handlers, 'aar:note', { code: 'nope nope', text: 'hi' });
    expect(ack.ok).toBe(false);
    expect(broadcasts).toHaveLength(0);
  });
});
