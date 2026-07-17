/**
 * Station Socket.io handlers: join-station credential gating + broadcast
 * payload validation (review F7). Exercised with a mock socket that captures
 * joins, broadcasts, and emitted acks/errors — same pattern as aarCollab.test.ts.
 */

import jwt from 'jsonwebtoken';
import type { Server } from 'socket.io';
import {
  registerStationSocketHandlers,
  resolveJoinStationAuth,
  isValidBroadcastPayload,
  MAX_BROADCAST_PAYLOAD_BYTES,
  type SocketWithStation,
} from '../services/stationSocketHandlers';
import { generateBrigadeAccessToken } from '../services/brigadeAccessService';
import { createTestToken } from './helpers/authHelpers';
import { DEMO_STATION_ID } from '../constants/stations';
import { JWT_SECRET } from '../config/jwtSecret';

interface Broadcast { room: string; event: string; payload: unknown }
interface Emitted { event: string; payload: unknown }

function mockIo() {
  const rooms: Record<string, Broadcast[]> = {};
  const io = {
    to(room: string) {
      return {
        emit: (event: string, payload: unknown) => {
          (rooms[room] ??= []).push({ room, event, payload });
        },
      };
    },
  } as unknown as Server;
  return { io, rooms };
}

function mockSocket() {
  const handlers: Record<string, (data: unknown) => void | Promise<void>> = {};
  const joined: string[] = [];
  const left: string[] = [];
  const emitted: Emitted[] = [];
  let stationId: string | undefined;
  let brigadeId: string | undefined;

  const socket = {
    id: 'sock-1',
    get stationId() { return stationId; },
    set stationId(v: string | undefined) { stationId = v; },
    get brigadeId() { return brigadeId; },
    set brigadeId(v: string | undefined) { brigadeId = v; },
    rooms: new Set(['sock-1']),
    on(event: string, fn: (data: unknown) => void | Promise<void>) { handlers[event] = fn; },
    join(room: string) { joined.push(room); },
    leave(room: string) { left.push(room); },
    emit(event: string, payload: unknown) { emitted.push({ event, payload }); },
  } as unknown as SocketWithStation;

  return { socket, handlers, joined, left, emitted };
}

async function call(handlers: Record<string, (d: unknown) => void | Promise<void>>, event: string, data: unknown) {
  await handlers[event](data);
}

describe('resolveJoinStationAuth', () => {
  it('resolves a valid admin JWT', async () => {
    const token = createTestToken('admin');
    const auth = await resolveJoinStationAuth({ authToken: token });
    expect(auth).toMatchObject({ authenticated: true, credentialType: 'jwt' });
  });

  it('resolves a valid brigade/kiosk token', async () => {
    const brigadeToken = generateBrigadeAccessToken('brigade-1', 'station-1');
    const auth = await resolveJoinStationAuth({ brigadeToken: brigadeToken.token });
    expect(auth).toMatchObject({ authenticated: true, credentialType: 'brigade-token', stationId: 'station-1' });
  });

  it('resolves a valid member-session token', async () => {
    const memberSessionToken = jwt.sign(
      { memberId: 'member-1', stationId: 'station-1', credentialType: 'member-session' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const auth = await resolveJoinStationAuth({ memberSessionToken });
    expect(auth).toMatchObject({ authenticated: true, credentialType: 'member-session', stationId: 'station-1' });
  });

  it('returns null when no credential is supplied', async () => {
    await expect(resolveJoinStationAuth({})).resolves.toBeNull();
  });

  it('returns null for garbage/expired tokens', async () => {
    await expect(resolveJoinStationAuth({ authToken: 'not-a-jwt' })).resolves.toBeNull();
    await expect(resolveJoinStationAuth({ brigadeToken: 'unknown-token' })).resolves.toBeNull();
  });
});

describe('isValidBroadcastPayload', () => {
  it('accepts a plain object under the size cap', () => {
    expect(isValidBroadcastPayload({ memberId: 'm1', name: 'Pat' })).toBe(true);
  });

  it('rejects null, arrays, and non-objects', () => {
    expect(isValidBroadcastPayload(null)).toBe(false);
    expect(isValidBroadcastPayload([1, 2, 3])).toBe(false);
    expect(isValidBroadcastPayload('a string')).toBe(false);
    expect(isValidBroadcastPayload(42)).toBe(false);
  });

  it('rejects oversized payloads', () => {
    const huge = { blob: 'x'.repeat(MAX_BROADCAST_PAYLOAD_BYTES + 1) };
    expect(isValidBroadcastPayload(huge)).toBe(false);
  });
});

describe('registerStationSocketHandlers: join-station', () => {
  it('rejects joining a non-demo station with no credential', async () => {
    const { io } = mockIo();
    const { socket, handlers, emitted, joined } = mockSocket();
    registerStationSocketHandlers(io, socket);

    await call(handlers, 'join-station', { stationId: 'station-1' });

    expect(joined).toEqual([]);
    expect(socket.stationId).toBeUndefined();
    expect(emitted).toEqual([{ event: 'join-error', payload: { message: 'Authentication required to join this station' } }]);
  });

  it('rejects a stationId that is missing entirely', async () => {
    const { io } = mockIo();
    const { socket, handlers, emitted } = mockSocket();
    registerStationSocketHandlers(io, socket);

    await call(handlers, 'join-station', {});

    expect(emitted).toEqual([{ event: 'join-error', payload: { message: 'stationId is required' } }]);
  });

  it('allows joining the public demo station with no credential', async () => {
    const { io } = mockIo();
    const { socket, handlers, joined, emitted } = mockSocket();
    registerStationSocketHandlers(io, socket);

    await call(handlers, 'join-station', { stationId: DEMO_STATION_ID });

    expect(joined).toContain(`station-${DEMO_STATION_ID}`);
    expect(socket.stationId).toBe(DEMO_STATION_ID);
    expect(emitted[0]).toMatchObject({ event: 'joined-station' });
  });

  it('allows an admin JWT to join any station', async () => {
    const { io } = mockIo();
    const { socket, handlers, joined, emitted } = mockSocket();
    registerStationSocketHandlers(io, socket);

    await call(handlers, 'join-station', { stationId: 'station-1', authToken: createTestToken('admin') });

    expect(joined).toContain('station-station-1');
    expect(socket.stationId).toBe('station-1');
    expect(emitted[0]).toMatchObject({ event: 'joined-station' });
  });

  it('allows a brigade token to join only its own station', async () => {
    const { io } = mockIo();
    const brigadeToken = generateBrigadeAccessToken('brigade-1', 'station-1');

    // Matching station succeeds.
    const ok = mockSocket();
    registerStationSocketHandlers(io, ok.socket);
    await call(ok.handlers, 'join-station', { stationId: 'station-1', brigadeToken: brigadeToken.token });
    expect(ok.joined).toContain('station-station-1');
    expect(ok.emitted[0]).toMatchObject({ event: 'joined-station' });

    // Mismatched station is rejected.
    const bad = mockSocket();
    registerStationSocketHandlers(io, bad.socket);
    await call(bad.handlers, 'join-station', { stationId: 'station-2', brigadeToken: brigadeToken.token });
    expect(bad.joined).toEqual([]);
    expect(bad.emitted).toEqual([{ event: 'join-error', payload: { message: 'This credential does not grant access to that station' } }]);
  });

  it('rejects an invalid/expired credential', async () => {
    const { io } = mockIo();
    const { socket, handlers, joined, emitted } = mockSocket();
    registerStationSocketHandlers(io, socket);

    await call(handlers, 'join-station', { stationId: 'station-1', authToken: 'not-a-jwt', brigadeToken: 'unknown' });

    expect(joined).toEqual([]);
    expect(emitted).toEqual([{ event: 'join-error', payload: { message: 'Authentication required to join this station' } }]);
  });

  it('leaves the previous station room when switching stations', async () => {
    const { io } = mockIo();
    const { socket, handlers, joined, left } = mockSocket();
    registerStationSocketHandlers(io, socket);

    await call(handlers, 'join-station', { stationId: DEMO_STATION_ID });
    await call(handlers, 'join-station', { stationId: 'station-1', authToken: createTestToken('admin') });

    expect(left).toContain(`station-${DEMO_STATION_ID}`);
    expect(joined).toContain('station-station-1');
    expect(socket.stationId).toBe('station-1');
  });
});

describe('registerStationSocketHandlers: broadcast relay', () => {
  async function joinedSocket(stationId = 'station-1') {
    const { io, rooms } = mockIo();
    const { socket, handlers } = mockSocket();
    registerStationSocketHandlers(io, socket);
    await call(handlers, 'join-station', { stationId, authToken: createTestToken('admin') });
    return { io, rooms, socket, handlers };
  }

  it('drops checkin/etc events from a socket that never joined a station', async () => {
    const { io, rooms } = mockIo();
    const { socket, handlers } = mockSocket();
    registerStationSocketHandlers(io, socket);

    await call(handlers, 'checkin', { memberId: 'm1' });

    expect(rooms).toEqual({});
  });

  it('rebroadcasts checkin to the joined station room', async () => {
    const { rooms, handlers } = await joinedSocket();

    await call(handlers, 'checkin', { memberId: 'm1', status: 'in' });

    expect(rooms['station-station-1']).toEqual([
      { room: 'station-station-1', event: 'checkin-update', payload: { memberId: 'm1', status: 'in' } },
    ]);
  });

  it.each([
    ['activity-change', 'activity-update'],
    ['member-added', 'member-update'],
    ['event-created', 'event-update'],
    ['event-ended', 'event-update'],
    ['participant-change', 'event-update'],
  ])('rebroadcasts %s as %s', async (sourceEvent, targetEvent) => {
    const { rooms, handlers } = await joinedSocket();

    await call(handlers, sourceEvent, { id: 'x' });

    expect(rooms['station-station-1']).toEqual([
      { room: 'station-station-1', event: targetEvent, payload: { id: 'x' } },
    ]);
  });

  it('drops a malformed (non-object) payload instead of rebroadcasting it', async () => {
    const { rooms, handlers } = await joinedSocket();

    await call(handlers, 'checkin', 'not-an-object');
    await call(handlers, 'checkin', null);
    await call(handlers, 'checkin', ['array', 'not', 'object']);

    expect(rooms['station-station-1']).toBeUndefined();
  });

  it('drops an oversized payload instead of rebroadcasting it', async () => {
    const { rooms, handlers } = await joinedSocket();

    await call(handlers, 'checkin', { blob: 'x'.repeat(MAX_BROADCAST_PAYLOAD_BYTES + 1) });

    expect(rooms['station-station-1']).toBeUndefined();
  });
});
