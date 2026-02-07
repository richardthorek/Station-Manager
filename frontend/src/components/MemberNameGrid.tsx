import { useState, useMemo } from 'react';
import type { Member, EventWithParticipants } from '../types';
import './MemberNameGrid.css';

interface MemberNameGridProps {
  members: Member[];
  events: EventWithParticipants[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onCheckIn: (memberId: string) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

export function MemberNameGrid({
  members,
  events,
  selectedEventId,
  onSelectEvent,
  onCheckIn,
  isExpanded,
  onToggleExpanded,
}: MemberNameGridProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Get only active events
  const activeEvents = events.filter(e => e.isActive);

  // Get selected event
  const selectedEvent = activeEvents.find(e => e.id === selectedEventId) || null;

  // Get participant IDs for the selected event
  const participantIds = useMemo(() => {
    if (!selectedEvent) return new Set<string>();
    return new Set(selectedEvent.participants.map(p => p.memberId));
  }, [selectedEvent]);

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
    <div className={`member-name-grid-container ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Event Tabs - if multiple active events */}
      {activeEvents.length > 1 && (
        <div className="event-tabs" role="tablist" aria-label="Active Events">
          {activeEvents.map(event => (
            <button
              key={event.id}
              role="tab"
              aria-selected={selectedEventId === event.id}
              aria-controls={`event-panel-${event.id}`}
              className={`event-tab ${selectedEventId === event.id ? 'active' : ''}`}
              onClick={() => onSelectEvent(event.id)}
            >
              <span className="event-tab-name">{event.activityName}</span>
              <span className="event-tab-count">{event.participantCount}</span>
            </button>
          ))}
        </div>
      )}

      {/* Header with expand/collapse control */}
      <div className="member-grid-header">
        <div className="header-content">
          <h2 className="event-title">
            {selectedEvent ? selectedEvent.activityName : 'Select an Event'}
          </h2>
          {selectedEvent && (
            <span className="participant-summary">
              {selectedEvent.participantCount} signed in • {displayedMembers.length} members
            </span>
          )}
        </div>
        <button
          className="toggle-expand-btn"
          onClick={onToggleExpanded}
          aria-label={isExpanded ? 'Collapse member grid' : 'Expand member grid'}
          aria-expanded={isExpanded}
        >
          {isExpanded ? '▼ Collapse' : '▲ Expand'}
        </button>
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div
          className="member-grid-content"
          role="tabpanel"
          id={selectedEvent ? `event-panel-${selectedEvent.id}` : undefined}
          aria-labelledby={selectedEvent ? `event-tab-${selectedEvent.id}` : undefined}
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
                    onClick={() => onCheckIn(member.id)}
                    aria-label={`${member.name}${isSignedIn ? ' (signed in)' : ''}`}
                    aria-pressed={isSignedIn}
                  >
                    <span className="member-name-text">{member.name}</span>
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
    </div>
  );
}
