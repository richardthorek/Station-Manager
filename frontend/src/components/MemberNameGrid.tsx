import { useState, useMemo } from 'react';
import type { Member, EventWithParticipants } from '../types';
import './MemberNameGrid.css';

interface MemberNameGridProps {
  members: Member[];
  events: EventWithParticipants[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onCheckIn: (memberId: string) => void;
  onCheckOut?: (memberId: string) => void;
  onStartNewEvent: () => void;
  onEndEvent: (eventId: string) => void;
  onCollapse: () => void;
}

export function MemberNameGrid({
  members,
  events,
  selectedEventId,
  onSelectEvent,
  onCheckIn,
  onCheckOut,
  onStartNewEvent,
  onEndEvent,
  onCollapse,
}: MemberNameGridProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Get only active events
  const activeEvents = events.filter(e => e.isActive);

  // Get selected event
  const selectedEvent = activeEvents.find(e => e.id === selectedEventId) || null;

  // Get participant IDs for the selected event
  const participantIds = useMemo(() => {
    const event = events.find(e => e.id === selectedEventId);
    if (!event) return new Set<string>();
    return new Set(event.participants.map(p => p.memberId));
  }, [events, selectedEventId]);

  const getRankHelmetClass = (rank: string | null | undefined) => {
    if (!rank) return 'helmet-white';
    const normalizedRank = rank.toLowerCase().trim();

    if (normalizedRank === 'captain') return 'helmet-red';
    if (normalizedRank === 'senior deputy captain') return 'helmet-red-white-stripes';
    if (normalizedRank === 'deputy captain') return 'helmet-white-red-stripe';

    if (
      normalizedRank === 'group officer' ||
      normalizedRank === 'deputy group officer' ||
      normalizedRank === 'operational officer' ||
      normalizedRank === 'inspector' ||
      normalizedRank === 'superintendent'
    ) {
      return 'helmet-orange';
    }

    return 'helmet-white';
  };

  // Filter and sort members
  const displayedMembers = useMemo(() => {
    let filtered = members;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(term) ||
        m.rank?.toLowerCase().includes(term) ||
        m.memberNumber?.toLowerCase().includes(term)
      );
    }

    // Sort alphabetically
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, searchTerm]);

  // If no active events, don't show the grid
  if (activeEvents.length === 0) {
    return null;
  }

  return (
    <div className="member-name-grid-container">
      {/* Event Tabs - always show for active events */}
      <div className="event-tabs-header">
        <button
          className="collapse-grid-btn"
          onClick={onCollapse}
          aria-label="Collapse to three-column view"
          title="Switch to three-column view"
        >
          ⊟
        </button>
        <div className="event-tabs" role="tablist" aria-label="Active Events">{activeEvents.map(event => (
            <div
              key={event.id}
              role="tab"
              aria-selected={selectedEventId === event.id}
              aria-controls={`event-panel-${event.id}`}
              className={`event-tab ${selectedEventId === event.id ? 'active' : ''}`}
              onClick={() => onSelectEvent(event.id)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectEvent(event.id);
                }
              }}
            >
              <div className="event-tab-content">
                <span className="event-tab-name">{event.activityName}</span>
                <span className="event-tab-count">{event.participantCount} signed in</span>
              </div>
              {selectedEvent?.id === event.id && (
                <button
                  className="event-end-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEndEvent(event.id);
                  }}
                  aria-label={`End ${event.activityName}`}
                  title="End event"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          className="new-event-btn"
          onClick={onStartNewEvent}
          aria-label="Start new event"
          title="Start new event"
        >
          + New Event
        </button>
      </div>

      {/* Member Grid Content */}
      {selectedEvent && (
        <div
          className="member-grid-content"
          role="tabpanel"
          id={`event-panel-${selectedEvent.id}`}
          aria-labelledby={`event-tab-${selectedEvent.id}`}
        >
          {/* Search bar */}
          <div className="grid-search-bar">
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="grid-search-input"
              aria-label="Search members"
            />
            {searchTerm && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Member name grid */}
          <div className="member-name-grid" role="list" aria-label="Member list">
            {displayedMembers.length > 0 ? (
              displayedMembers.map(member => {
                const isSignedIn = participantIds.has(member.id);
                return (
                  <button
                    key={member.id}
                    className={`member-name-btn ${isSignedIn ? 'signed-in' : ''}`}
                    onClick={() => (isSignedIn && onCheckOut ? onCheckOut(member.id) : onCheckIn(member.id))}
                    aria-label={`${member.name}${isSignedIn ? ' (signed in)' : ''}`}
                    aria-pressed={isSignedIn}
                  >
                    <div className="member-card-content">
                      <span className="member-name-text">{member.name}</span>
                      {member.rank && (
                        <span className="member-rank-badge">
                          <span
                            className={`member-rank-helmet ${getRankHelmetClass(member.rank)}`}
                            role="img"
                            aria-label={member.rank}
                          ></span>
                        </span>
                      )}
                    </div>
                    {isSignedIn && <span className="check-mark" aria-hidden="true">✓</span>}
                  </button>
                );
              })
            ) : (
              <div className="no-members-message">
                {searchTerm ? 'No members found' : 'No members available'}
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedEvent && activeEvents.length > 0 && (
        <div className="no-event-selected">
          <p>Select an event tab above to view members</p>
        </div>
      )}
    </div>
  );
}
