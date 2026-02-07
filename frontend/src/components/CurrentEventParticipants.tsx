import { useState, useEffect } from 'react';
import type { EventWithParticipants } from '../types';
import './CurrentEventParticipants.css';

interface CurrentEventParticipantsProps {
  event: EventWithParticipants | null;
  onRemoveParticipant?: (memberId: string) => void;
}

export function CurrentEventParticipants({ event, onRemoveParticipant }: CurrentEventParticipantsProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute for duration calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every 60 seconds

    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDuration = (checkInTime: string): string => {
    const start = new Date(checkInTime);
    const diffMs = currentTime.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getEventDuration = (startTime: string): string => {
    const start = new Date(startTime);
    const diffMs = currentTime.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just started';
    if (diffMins < 60) return `${diffMins} minutes`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours === 1) return mins > 0 ? `1 hour ${mins} min` : '1 hour';
    return mins > 0 ? `${hours} hours ${mins} min` : `${hours} hours`;
  };

  // Hidden for now - device icons not needed
  // const getMethodIcon = (method: string) => {
  //   switch (method) {
  //     case 'kiosk':
  //       return '🖥️';
  //     case 'mobile':
  //       return '📱';
  //     case 'qr':
  //       return '📸';
  //     default:
  //       return '✓';
  //   }
  // };

  const getRankHelmetClass = (rank: string | null | undefined) => {
    if (!rank) return 'helmet-white'; // Default visitor - white helmet
    
    const normalizedRank = rank.toLowerCase().trim();
    
    // Red helmets - Brigade leadership
    if (normalizedRank === 'captain') {
      return 'helmet-red'; // Captain - red helmet
    } else if (normalizedRank === 'senior deputy captain') {
      return 'helmet-red-white-stripes'; // Senior Deputy Captain - red with 2 white stripes
    } else if (normalizedRank === 'deputy captain') {
      return 'helmet-white-red-stripe'; // Deputy Captain - white with red stripe
    }
    
    // Orange helmets - District/Group leadership
    else if (
      normalizedRank === 'group officer' ||
      normalizedRank === 'deputy group officer' ||
      normalizedRank === 'operational officer' ||
      normalizedRank === 'inspector' ||
      normalizedRank === 'superintendent'
    ) {
      return 'helmet-orange'; // Orange helmet for district ranks
    }
    
    // White helmets - Visitors, trainees, firefighters, and default
    // visitor, trainee, firefighter all get white helmets
    return 'helmet-white'; // Default to white
  };

  if (!event) {
    return (
      <div className="current-event-participants card">
        <h2>Current Event</h2>
        <div className="no-event-state">
          <span className="empty-icon">📋</span>
          <p>No event selected</p>
          <p className="hint">Select or start an event to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="current-event-participants card">
      <div className="current-event-header">
        <div className="event-title-section">
          <h2>Current Event</h2>
          <div className="event-name">
            <span className="activity-icon">📋</span>
            <span>{event.activityName}</span>
            {event.isActive && <span className="active-indicator">● Active</span>}
          </div>
          <div className="event-time">
            Started {formatTime(event.startTime)} • <span className="event-duration">{getEventDuration(event.startTime)}</span>
          </div>
        </div>
      </div>

      <div className="participants-section">
        <h3>Signed In ({event.participantCount})</h3>
        
        {event.participants.length === 0 ? (
          <div className="empty-participants">
            <p>No participants yet</p>
            <p className="hint">Tap names on the right to sign in</p>
          </div>
        ) : (
          <div className="participants-grid">
            {event.participants.map((participant) => (
              <div
                key={participant.id}
                className={`participant-card ${onRemoveParticipant ? 'clickable' : ''}`}
                onClick={() => onRemoveParticipant && onRemoveParticipant(participant.memberId)}
                role={onRemoveParticipant ? 'button' : undefined}
                tabIndex={onRemoveParticipant ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onRemoveParticipant && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onRemoveParticipant(participant.memberId);
                  }
                }}
                title={onRemoveParticipant ? 'Click to remove participant' : undefined}
              >
                <div className="participant-header">
                  <div className={`rank-helmet ${getRankHelmetClass(participant.memberRank)}`}></div>
                  <span className="participant-name">{participant.memberName}</span>
                </div>
                <div className="participant-footer">
                  <span className="participant-time">{formatTime(participant.checkInTime)}</span>
                  <span className="participant-duration">{getDuration(participant.checkInTime)}</span>
                  {participant.isOffsite && (
                    <span className="offsite-badge">📍 Offsite</span>
                  )}
                </div>
                {onRemoveParticipant && (
                  <div className="remove-hint">Tap to remove</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
