import { useSyncExternalStore, useState, type KeyboardEvent } from 'react';
import type { EventWithParticipants } from '../types';
import './EventCard.css';

interface EventCardProps {
  event: EventWithParticipants;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (eventId: string) => void;
  onEnd: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  onReactivate?: (eventId: string) => void;
}

export function EventCard({ event, isActive, isSelected, onSelect, onEnd, onDelete, onReactivate }: EventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const DAY_MS = 24 * 60 * 60 * 1000;

  const now = useSyncExternalStore(
    (onStoreChange) => {
      const id = window.setInterval(onStoreChange, 60_000);
      return () => window.clearInterval(id);
    },
    () => Date.now(),
    () => Date.now()
  );

  const canReactivate = !isActive && event.endTime
    ? now - new Date(event.endTime).getTime() <= DAY_MS
    : false;

  const handleCardKeyDown = (eventKey: KeyboardEvent<HTMLDivElement>) => {
    if (isActive && (eventKey.key === 'Enter' || eventKey.key === ' ')) {
      eventKey.preventDefault();
      onSelect(event.id);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return 'Today';
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getDuration = () => {
    const start = new Date(event.startTime);
    const end = event.endTime ? new Date(event.endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const durationMin = Math.floor(durationMs / 60000);
    
    if (durationMin < 60) {
      return `${durationMin}m`;
    }
    const hours = Math.floor(durationMin / 60);
    const minutes = durationMin % 60;
    return `${hours}h ${minutes}m`;
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

  return (
    <div
      className={`event-card ${isActive ? 'active' : 'ended'} ${isSelected ? 'selected' : ''}`}
      onClick={isActive ? () => onSelect(event.id) : undefined}
      onKeyDown={isActive ? handleCardKeyDown : undefined}
      role="button"
      tabIndex={isActive ? 0 : -1}
      aria-pressed={isActive ? isSelected : undefined}
      aria-label={`Event ${event.activityName}${isActive ? ' active' : ' ended'}`}
      aria-disabled={!isActive}
    >
      <div className="event-card-header">
        <div className="event-title-row">
          <div className="event-title">
            <span className="activity-icon">📋</span>
            <h3>{event.activityName}</h3>
          </div>
          <div className="event-header-actions">
            {isActive && <span className="active-badge">Active</span>}
            <div className="participant-count">
              <span className="count-icon">👥</span>
              <span className="count">{event.participantCount}</span>
            </div>
            <button
              className="expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          </div>
        </div>

        <div className="event-meta">
          <span className="event-date">{formatDate(event.startTime)}</span>
          <span className="event-time">
            {formatTime(event.startTime)}
            {event.endTime && ` - ${formatTime(event.endTime)}`}
          </span>
          <span className="event-duration">({getDuration()})</span>
        </div>
      </div>

      {isExpanded && (
        <div className="event-card-body">
          {event.participants.length === 0 ? (
            <p className="no-participants">No participants yet</p>
          ) : (
            <div className="participants-list">
              {event.participants.map((participant) => (
                <div key={participant.id} className="participant-item">
                  <span className="method-icon">{getMethodIcon(participant.checkInMethod)}</span>
                  <div className="participant-info">
                    <span className="participant-name">{participant.memberName}</span>
                    <span className="participant-time">{formatTime(participant.checkInTime)}</span>
                  </div>
                  {participant.isOffsite && (
                    <span className="offsite-badge">📍 Offsite</span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <div className="event-card-actions">
            <button
              className="btn-end-event"
              onClick={(e) => {
                e.stopPropagation();
                onEnd(event.id);
              }}
              disabled={!isActive}
            >
              {isActive ? 'End Event' : 'Event Ended'}
            </button>

            {canReactivate && onReactivate && (
              <button
                className="btn-reactivate-event"
                onClick={(e) => {
                  e.stopPropagation();
                  onReactivate(event.id);
                }}
              >
                Reopen (24h)
              </button>
            )}
            
            <button
              className="btn-delete-event"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Are you sure you want to delete this ${event.activityName} event? This cannot be undone.`)) {
                  onDelete(event.id);
                }
              }}
              title="Delete event"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
