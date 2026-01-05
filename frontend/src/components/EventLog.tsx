import { useEffect, useRef, useState, useCallback } from 'react';
import { EventCard } from './EventCard';
import type { EventWithParticipants } from '../types';
import './EventLog.css';

interface EventLogProps {
  events: EventWithParticipants[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onEndEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

export function EventLog({
  events,
  selectedEventId,
  onSelectEvent,
  onEndEvent,
  onDeleteEvent,
  onLoadMore,
  hasMore,
  isLoading,
}: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(false);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    const scrollBottom = scrollHeight - scrollTop - clientHeight;

    // Load more when within 200px of bottom
    if (scrollBottom < 200 && hasMore && !isLoading) {
      onLoadMore();
    }

    setIsNearBottom(scrollBottom < 100);
  }, [hasMore, isLoading, onLoadMore]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const activeEvents = events.filter(e => e.isActive);
  const endedEvents = events.filter(e => !e.isActive);

  return (
    <div className="event-log card">
      <div className="event-log-header">
        <h2>Event Log</h2>
        <span className="event-count">
          {activeEvents.length} active • {endedEvents.length} ended
        </span>
      </div>

      <div className="event-log-content" ref={scrollRef}>
        {events.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <p>No events yet</p>
            <p className="empty-hint">Start a new event to get going!</p>
          </div>
        ) : (
          <>
            {activeEvents.length > 0 && (
              <div className="events-section">
                <h3 className="section-title">Active Events</h3>
                {activeEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isActive={true}
                    isSelected={selectedEventId === event.id}
                    onSelect={onSelectEvent}
                    onEnd={onEndEvent}
                    onDelete={onDeleteEvent}
                  />
                ))}
              </div>
            )}

            {endedEvents.length > 0 && (
              <div className="events-section">
                <h3 className="section-title">Past Events</h3>
                {endedEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isActive={false}
                    isSelected={false}
                    onSelect={() => {}}
                    onEnd={() => {}}
                    onDelete={onDeleteEvent}
                  />
                ))}
              </div>
            )}

            {isLoading && (
              <div className="loading-more">
                <div className="spinner-small"></div>
                <span>Loading more events...</span>
              </div>
            )}

            {!hasMore && events.length > 0 && (
              <div className="end-of-log">
                <span>• End of log •</span>
              </div>
            )}
          </>
        )}
      </div>

      {!isNearBottom && events.length > 5 && (
        <button
          className="scroll-to-bottom"
          onClick={() => {
            scrollRef.current?.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: 'smooth',
            });
          }}
        >
          ↓
        </button>
      )}
    </div>
  );
}
