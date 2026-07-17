/**
 * Station real-time sync (Socket.io) — join-station room membership plus the
 * check-in/activity/member/event broadcast relay.
 *
 * Security model (review F7): `join-station` requires the same credential the
 * equivalent REST reads accept — an admin JWT (any role), a brigade/kiosk
 * token, or a member-session token (AC-1) — scoped to the station being
 * joined (an admin JWT may join any station; a brigade/member token only the
 * station it was minted for). The public demo station stays open, matching
 * `requireSession`/`flexibleAuth`'s demo bypass. Before F7, `join-station`
 * accepted any client-claimed `stationId` with no credential at all, so a
 * socket that merely knew a station id could join its room and inject
 * spoofed real-time updates onto that station's kiosks.
 *
 * Broadcast payloads are shape-validated (plain object, size-bounded) before
 * being rebroadcast to the room, so a joined socket can't flood its station's
 * kiosks with oversized or malformed junk.
 */

import type { Server, Socket } from 'socket.io';
import { logger } from './logger';
import { DEMO_STATION_ID } from '../constants/stations';
import {
  verifyJwtAuthResult,
  resolveBrigadeTokenAuthResult,
  verifyMemberSessionAuthResult,
  type AuthResult,
} from '../middleware/flexibleAuth';

export interface SocketWithStation extends Socket {
  stationId?: string;
  brigadeId?: string;
}

interface JoinStationPayload {
  stationId?: unknown;
  brigadeId?: unknown;
  authToken?: unknown;
  brigadeToken?: unknown;
  memberSessionToken?: unknown;
}

/**
 * Resolve whichever credential a `join-station` payload carries to an
 * AuthResult, mirroring the credential model `requireSession`/`flexibleAuth`
 * enforce on the equivalent REST reads.
 */
export async function resolveJoinStationAuth(data: JoinStationPayload): Promise<AuthResult | null> {
  if (typeof data.authToken === 'string' && data.authToken) {
    const jwtResult = verifyJwtAuthResult(data.authToken);
    if (jwtResult) return jwtResult;
  }
  if (typeof data.brigadeToken === 'string' && data.brigadeToken) {
    const brigadeResult = await resolveBrigadeTokenAuthResult(data.brigadeToken);
    if (brigadeResult) return brigadeResult;
  }
  if (typeof data.memberSessionToken === 'string' && data.memberSessionToken) {
    const memberResult = verifyMemberSessionAuthResult(data.memberSessionToken);
    if (memberResult) return memberResult;
  }
  return null;
}

// Plenty of headroom for a check-in/event/member payload; bounds the abuse
// case of a joined socket flooding its station room with oversized junk.
export const MAX_BROADCAST_PAYLOAD_BYTES = 32 * 1024;

export function isValidBroadcastPayload(data: unknown): boolean {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  try {
    return JSON.stringify(data).length <= MAX_BROADCAST_PAYLOAD_BYTES;
  } catch {
    return false;
  }
}

/**
 * Register a station-scoped room broadcast handler: rebroadcasts `sourceEvent`
 * as `targetEvent` to the socket's joined station room, after checking the
 * socket has joined a station and the payload passes shape validation.
 */
function registerStationBroadcast(
  io: Server,
  socket: SocketWithStation,
  sourceEvent: string,
  targetEvent: string
): void {
  socket.on(sourceEvent, (data: unknown) => {
    logger.debug(`WebSocket event: ${sourceEvent}`, { data, stationId: socket.stationId });

    if (!socket.stationId) {
      logger.warn(`Socket attempted ${sourceEvent} without joining station`, { socketId: socket.id });
      return;
    }

    if (!isValidBroadcastPayload(data)) {
      logger.warn(`Socket ${sourceEvent} payload rejected — invalid shape`, {
        socketId: socket.id,
        stationId: socket.stationId,
      });
      return;
    }

    io.to(`station-${socket.stationId}`).emit(targetEvent, data);
  });
}

/**
 * Register station room-join + broadcast-relay handlers on a freshly
 * connected socket. Call from within io.on('connection', ...).
 */
export function registerStationSocketHandlers(io: Server, socket: SocketWithStation): void {
  socket.on('join-station', async (data: JoinStationPayload) => {
    const stationId = typeof data?.stationId === 'string' ? data.stationId.trim() : '';
    const brigadeId = typeof data?.brigadeId === 'string' && data.brigadeId ? data.brigadeId : undefined;

    if (!stationId) {
      logger.warn('Client attempted to join without stationId', { socketId: socket.id });
      socket.emit('join-error', { message: 'stationId is required' });
      return;
    }

    // The public demo station stays open (consistent with requireSession/
    // flexibleAuth's demo bypass — CLAUDE.md: "demo station auth is
    // intentionally bypassed").
    if (stationId !== DEMO_STATION_ID) {
      const auth = await resolveJoinStationAuth(data);

      if (!auth) {
        logger.warn('Socket join-station rejected — no valid credential', { socketId: socket.id, stationId });
        socket.emit('join-error', { message: 'Authentication required to join this station' });
        return;
      }

      // An admin JWT (any role) may observe any station, matching
      // requireSession's read model. A brigade/kiosk or member-session token
      // is scoped to the single station it was minted for.
      const scopedToStation = auth.credentialType === 'jwt' || auth.stationId === stationId;
      if (!scopedToStation) {
        logger.warn('Socket join-station rejected — credential does not match station', {
          socketId: socket.id,
          stationId,
          credentialType: auth.credentialType,
        });
        socket.emit('join-error', { message: 'This credential does not grant access to that station' });
        return;
      }
    }

    // Leave previous station rooms if any
    if (socket.stationId) {
      socket.leave(`station-${socket.stationId}`);
      if (socket.brigadeId) {
        socket.leave(`brigade-${socket.brigadeId}`);
      }
    }

    socket.stationId = stationId;
    socket.brigadeId = brigadeId;

    socket.join(`station-${stationId}`);
    if (brigadeId) {
      socket.join(`brigade-${brigadeId}`);
    }

    logger.info('Client joined station room', {
      socketId: socket.id,
      stationId,
      brigadeId,
      rooms: Array.from(socket.rooms),
    });

    socket.emit('joined-station', { stationId, brigadeId });
  });

  socket.on('disconnect', () => {
    logger.info('WebSocket client disconnected', {
      socketId: socket.id,
      stationId: socket.stationId,
      brigadeId: socket.brigadeId,
    });
  });

  registerStationBroadcast(io, socket, 'checkin', 'checkin-update');
  registerStationBroadcast(io, socket, 'activity-change', 'activity-update');
  registerStationBroadcast(io, socket, 'member-added', 'member-update');
  registerStationBroadcast(io, socket, 'event-created', 'event-update');
  registerStationBroadcast(io, socket, 'event-ended', 'event-update');
  registerStationBroadcast(io, socket, 'participant-change', 'event-update');
}
