/**
 * Rollover Service
 * 
 * Handles automatic deactivation of events that have exceeded their expiry time.
 * Events are automatically deactivated after a configurable number of hours (default: 12).
 * This allows activities that start at any time of day to automatically expire after
 * the appropriate duration.
 * 
 * Key behaviors:
 * - Expired events remain visible in the UI (just marked as inactive)
 * - Events cannot be modified when inactive (unless reactivated first)
 * - Events become inactive either manually OR after 12 hours
 * - Time-based event expiry (configurable via EVENT_EXPIRY_HOURS)
 * - Manual rollover trigger for immediate expiry check
 * - Logging of rollover actions
 */

import type { IDatabase } from './dbFactory';
import type { Event } from '../types';

/**
 * Configuration for event expiry
 * Default: 12 hours after event start time
 */
export const EVENT_EXPIRY_HOURS = parseInt(process.env.EVENT_EXPIRY_HOURS || '12', 10);

/**
 * Check if an event has expired based on its start time
 * This only checks if the event SHOULD be expired based on time,
 * not whether it's already been marked as inactive.
 * 
 * @param event - The event to check
 * @param expiryHours - Number of hours after which event expires (default: EVENT_EXPIRY_HOURS)
 * @returns true if the event should be expired based on time
 */
export function isEventExpired(event: Event, expiryHours: number = EVENT_EXPIRY_HOURS): boolean {
  const now = new Date();
  const eventStart = new Date(event.startTime);
  const expiryTime = new Date(eventStart.getTime() + expiryHours * 60 * 60 * 1000);
  
  return now >= expiryTime;
}

/**
 * Mark events as inactive if they've expired based on time.
 * This mutates the events in the database by calling endEvent.
 * Events remain visible, just marked as inactive.
 * 
 * @param events - Array of events to check and potentially expire
 * @param db - Database instance for updating events
 * @returns Array of event IDs that were auto-expired
 */
export async function autoExpireEvents(events: Event[], db: IDatabase): Promise<string[]> {
  const expiredEventIds: string[] = [];
  
  for (const event of events) {
    // Only auto-expire events that are still active AND have exceeded time limit
    if (event.isActive && isEventExpired(event)) {
      const result = await db.endEvent(event.id);
      if (result) {
        expiredEventIds.push(event.id);
        console.log(`🕐 Auto-expired event: ${event.activityName} (started: ${event.startTime.toISOString()})`);
      }
    }
  }
  
  if (expiredEventIds.length > 0) {
    console.log(`✅ Auto-expiry: ${expiredEventIds.length} event(s) marked inactive`);
  }
  
  return expiredEventIds;
}

/**
 * Deactivate all expired events in the database
 * This is used by the manual rollover endpoint.
 * 
 * @param db - Database instance
 * @returns Array of deactivated event IDs
 */
export async function deactivateExpiredEvents(db: IDatabase): Promise<string[]> {
  // Get ALL events (not just active ones) to check for auto-expiry
  const allEvents = await db.getEvents(100, 0);
  return autoExpireEvents(allEvents, db);
}
