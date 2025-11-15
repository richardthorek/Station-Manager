import type { EventWithParticipants } from '../types';
import './CurrentEventParticipants.css';

interface CurrentEventParticipantsProps {
  event: EventWithParticipants | null;
}

export function CurrentEventParticipants({ event }: CurrentEventParticipantsProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'kiosk':
        return '🖥️';
      case 'mobile':
        return '📱';
      case 'qr':
        return '📸';
      default:
        return '✓';
    }
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
            Started {formatTime(event.startTime)}
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
              <div key={participant.id} className="participant-card">
                <div className="participant-header">
                  <span className="method-icon">{getMethodIcon(participant.checkInMethod)}</span>
                  <span className="participant-name">{participant.memberName}</span>
                </div>
                <div className="participant-footer">
                  <span className="participant-time">{formatTime(participant.checkInTime)}</span>
                  {participant.isOffsite && (
                    <span className="offsite-badge">📍 Offsite</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
