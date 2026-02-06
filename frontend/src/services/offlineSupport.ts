import { offlineQueue } from './offlineQueue';
import { cacheData, getCachedData } from './offlineStorage';
import type { Member, CheckIn, EventWithParticipants } from '../types';

/**
 * Wrapper around API service calls to add offline support
 */

/**
 * Check if the device is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Execute a function with offline queue support
 * If offline, queue the action; if online, execute immediately
 */
export async function withOfflineSupport<T>(
  onlineAction: () => Promise<T>,
  offlineQueueAction: {
    type: 'checkin' | 'checkout' | 'create-member' | 'create-event' | 'end-event' | 'update-activity' | 'other';
    endpoint: string;
    method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    data: unknown;
  },
  fallbackData?: T
): Promise<T> {
  if (isOnline()) {
    try {
      const result = await onlineAction();
      return result;
    } catch (error) {
      // If we get a network error while "online", we might have just lost connection
      console.warn('[OfflineSupport] Network error, queueing action:', error);
      await offlineQueue.queueAction(
        offlineQueueAction.type,
        offlineQueueAction.endpoint,
        offlineQueueAction.method,
        offlineQueueAction.data
      );
      
      if (fallbackData) {
        return fallbackData;
      }
      throw error;
    }
  } else {
    // Queue for later
    console.log('[OfflineSupport] Offline, queueing action');
    await offlineQueue.queueAction(
      offlineQueueAction.type,
      offlineQueueAction.endpoint,
      offlineQueueAction.method,
      offlineQueueAction.data
    );
    
    if (fallbackData) {
      return fallbackData;
    }
    
    throw new Error('Device is offline. Action queued for sync when connection is restored.');
  }
}

/**
 * Execute a GET request with caching support
 * If offline, return cached data; if online, fetch and cache
 */
export async function withCaching<T>(
  onlineAction: () => Promise<T>,
  cacheKey: string,
  cacheTimeMs: number = 60 * 60 * 1000 // 1 hour default
): Promise<T> {
  if (isOnline()) {
    try {
      const result = await onlineAction();
      // Cache the result
      await cacheData(cacheKey, result, cacheTimeMs);
      return result;
    } catch (error) {
      console.warn('[OfflineSupport] Network error, trying cache:', error);
      // Try to return cached data
      const cached = await getCachedData<T>(cacheKey);
      if (cached) {
        console.log('[OfflineSupport] Returning cached data for:', cacheKey);
        return cached;
      }
      throw error;
    }
  } else {
    // Return cached data
    const cached = await getCachedData<T>(cacheKey);
    if (cached) {
      console.log('[OfflineSupport] Offline, returning cached data for:', cacheKey);
      return cached;
    }
    throw new Error('Device is offline and no cached data available.');
  }
}

/**
 * Helper to create offline-aware check-in
 */
export async function offlineCheckIn(
  memberId: string,
  method: 'kiosk' | 'mobile' | 'qr',
  activityId?: string,
  location?: string,
  isOffsite?: boolean
): Promise<{ action: string; checkIn: CheckIn } | null> {
  const endpoint = '/checkins';
  const data = { memberId, method, activityId, location, isOffsite };
  
  if (!isOnline()) {
    await offlineQueue.queueAction('checkin', endpoint, 'POST', data);
    
    // Return a temporary check-in object
    return {
      action: 'checked-in',
      checkIn: {
        id: `temp-${Date.now()}`,
        memberId,
        stationId: 'current',
        checkInTime: new Date().toISOString(),
        checkOutTime: null,
        method,
        checkInMethod: method,
        activityId,
        location,
        isOffsite,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as CheckIn,
    };
  }
  
  return null; // Let the caller handle online case normally
}

/**
 * Helper to create offline-aware member creation
 */
export async function offlineCreateMember(name: string): Promise<Member | null> {
  const endpoint = '/members';
  const data = { name };
  
  if (!isOnline()) {
    await offlineQueue.queueAction('create-member', endpoint, 'POST', data);
    
    // Return a temporary member object
    return {
      id: `temp-${Date.now()}`,
      stationId: 'current',
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checkInCount: 0,
      totalHours: 0,
      rank: null,
      qrCode: null,
    } as unknown as Member;
  }
  
  return null; // Let the caller handle online case normally
}

/**
 * Helper to create offline-aware event creation
 */
export async function offlineCreateEvent(
  name: string,
  type: string,
  description?: string
): Promise<EventWithParticipants | null> {
  const endpoint = '/events';
  const data = { name, type, description };
  
  if (!isOnline()) {
    await offlineQueue.queueAction('create-event', endpoint, 'POST', data);
    
    // Return a temporary event object
    return {
      id: `temp-${Date.now()}`,
      stationId: 'current',
      name,
      type,
      description,
      startTime: new Date().toISOString(),
      endTime: null,
      participants: [],
      participantCount: 0,
      activityId: null,
      activityName: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as EventWithParticipants;
  }
  
  return null; // Let the caller handle online case normally
}

/**
 * Helper to create offline-aware event end
 */
export async function offlineEndEvent(eventId: string): Promise<void> {
  const endpoint = `/events/${eventId}/end`;
  
  if (!isOnline()) {
    await offlineQueue.queueAction('end-event', endpoint, 'POST', {});
    return;
  }
}

/**
 * Show a toast/notification about offline status
 */
export function showOfflineNotification(message: string = 'Action queued. Will sync when connection is restored.') {
  // This could be enhanced with a toast library
  console.log('[OfflineSupport]', message);
  
  // Simple browser notification (could be replaced with a better toast)
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Offline Mode', {
      body: message,
      icon: '/android-chrome-192x192.png',
    });
  }
}
