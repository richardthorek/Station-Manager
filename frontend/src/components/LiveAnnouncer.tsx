/**
 * Live Announcer Component
 * 
 * Provides aria-live region for announcing dynamic updates to screen readers.
 * - Polite: non-urgent updates (check-ins, data refreshes)
 * - Assertive: urgent alerts (errors, critical notifications)
 * 
 * Usage:
 * ```tsx
 * import { announce } from './components/LiveAnnouncer';
 * 
 * announce('Member checked in successfully', 'polite');
 * announce('Error: Failed to save', 'assertive');
 * ```
 */

import { useEffect, useState } from 'react';
import './LiveAnnouncer.css';

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

export function LiveAnnouncer() {
  const [currentAnnouncements, setCurrentAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const listener = (newAnnouncements: Announcement[]) => {
      setCurrentAnnouncements(newAnnouncements);
    };
    
    listeners.push(listener);
    
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  return (
    <div className="live-announcer">
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {currentAnnouncements
          .filter(a => a.politeness === 'polite')
          .map(a => a.message)
          .join('. ')}
      </div>
      <div 
        role="alert" 
        aria-live="assertive" 
        aria-atomic="true"
        className="sr-only"
      >
        {currentAnnouncements
          .filter(a => a.politeness === 'assertive')
          .map(a => a.message)
          .join('. ')}
      </div>
    </div>
  );
}
