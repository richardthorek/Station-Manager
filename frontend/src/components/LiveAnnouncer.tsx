/**
 * Live Announcer Component
 * 
 * Provides aria-live region for announcing dynamic updates to screen readers.
 * - Polite: non-urgent updates (check-ins, data refreshes)
 * - Assertive: urgent alerts (errors, critical notifications)
 * 
 * Usage:
 * ```tsx
 * import { announce } from '../utils/announcer';
 * 
 * announce('Member checked in successfully', 'polite');
 * announce('Error: Failed to save', 'assertive');
 * ```
 */

import { useEffect, useState } from 'react';
import { subscribeToAnnouncements, type Announcement } from '../utils/announcer';
import './LiveAnnouncer.css';

export function LiveAnnouncer() {
  const [currentAnnouncements, setCurrentAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToAnnouncements((newAnnouncements) => {
      setCurrentAnnouncements(newAnnouncements);
    });
    
    return unsubscribe;
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
