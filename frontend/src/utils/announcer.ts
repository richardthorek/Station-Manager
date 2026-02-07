/**
 * Screen Reader Announcement Utility
 * 
 * Provides a way to announce messages to screen readers via aria-live regions.
 * Must be used in conjunction with the LiveAnnouncer component.
 * 
 * Usage:
 * ```tsx
 * import { announce } from '../utils/announcer';
 * 
 * announce('Member checked in successfully', 'polite');
 * announce('Error: Failed to save', 'assertive');
 * ```
 */

interface Announcement {
  message: string;
  politeness: 'polite' | 'assertive';
  id: number;
}

let announcements: Announcement[] = [];
let listeners: Array<(announcements: Announcement[]) => void> = [];
let nextId = 0;

export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite') {
  const announcement: Announcement = {
    message,
    politeness,
    id: nextId++
  };
  
  announcements = [...announcements, announcement];
  listeners.forEach(listener => listener(announcements));

  // Clear announcement after it's been read (3 seconds)
  setTimeout(() => {
    announcements = announcements.filter(a => a.id !== announcement.id);
    listeners.forEach(listener => listener(announcements));
  }, 3000);
}

export function subscribeToAnnouncements(listener: (announcements: Announcement[]) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export type { Announcement };
