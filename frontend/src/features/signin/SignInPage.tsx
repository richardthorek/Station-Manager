import { useState, useEffect, useCallback } from 'react';
import { Header } from '../../components/Header';
import { EventLog } from '../../components/EventLog';
import { CurrentEventParticipants } from '../../components/CurrentEventParticipants';
import { MemberList } from '../../components/MemberList';
import { UserManagement } from '../../components/UserManagement';
import { NewEventModal } from '../../components/NewEventModal';
import { useSocket } from '../../hooks/useSocket';
import { api } from '../../services/api';
import type { Member, Activity, EventWithParticipants } from '../../types';
import './SignInPage.css';

export function SignInPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [events, setEvents] = useState<EventWithParticipants[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState<{
    databaseType: 'mongodb' | 'in-memory';
    usingInMemory: boolean;
  } | null>(null);

  const { isConnected, emit, on, off } = useSocket();

  // Get selected event
  const selectedEvent = selectedEventId 
    ? events.find(e => e.id === selectedEventId) || null 
    : null;

  // Initial data load
  useEffect(() => {
    loadInitialData();
  }, []);

  // Socket event listeners
  useEffect(() => {
    const handleEventUpdate = () => {
      loadEvents(true);
    };

    const handleMemberUpdate = () => {
      loadMembers();
    };

    on('event-update', handleEventUpdate);
    on('member-update', handleMemberUpdate);

    return () => {
      off('event-update', handleEventUpdate);
      off('member-update', handleMemberUpdate);
    };
  }, [on, off]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMembers(),
        loadActivities(),
        loadEvents(true),
        loadDatabaseStatus(),
      ]);
    } catch (err) {
      setError('Failed to load initial data');
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDatabaseStatus = async () => {
    try {
      const status = await api.getStatus();
      setDatabaseStatus({
        databaseType: status.databaseType,
        usingInMemory: status.usingInMemory,
      });
    } catch (err) {
      console.error('Error loading database status:', err);
      // Don't fail if status can't be loaded
    }
  };

  const loadMembers = async () => {
    try {
      const data = await api.getMembers();
      setMembers(data);
    } catch (err) {
      console.error('Error loading members:', err);
    }
  };

  const loadActivities = async () => {
    try {
      const data = await api.getActivities();
      setActivities(data);
    } catch (err) {
      console.error('Error loading activities:', err);
    }
  };

  const loadEvents = async (reset: boolean = false) => {
    try {
      const currentOffset = reset ? 0 : offset;
      const limit = 50;

      if (reset) {
        setLoadingMore(true);
      } else {
        if (loadingMore) return;
        setLoadingMore(true);
      }

      const data = await api.getEvents(limit, currentOffset);
      
      if (reset) {
        setEvents(data);
        setOffset(data.length);
        // Auto-select first active event
        const firstActive = data.find(e => e.isActive);
        if (firstActive && !selectedEventId) {
          setSelectedEventId(firstActive.id);
        }
      } else {
        setEvents(prev => [...prev, ...data]);
        setOffset(prev => prev + data.length);
      }

      setHasMore(data.length === limit);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCreateEvent = async (activityId: string) => {
    try {
      const event = await api.createEvent(activityId);
      setEvents([event, ...events]);
      setSelectedEventId(event.id);
      emit('event-created', event);
    } catch (err) {
      console.error('Error creating event:', err);
      alert('Failed to create event');
    }
  };

  const handleEndEvent = async (eventId: string) => {
    try {
      const updatedEvent = await api.endEvent(eventId);
      setEvents(events.map(e => e.id === eventId ? updatedEvent : e));
      
      // If ending the selected event, select another active event
      if (selectedEventId === eventId) {
        const nextActive = events.find(e => e.isActive && e.id !== eventId);
        setSelectedEventId(nextActive?.id || null);
      }
      
      emit('event-ended', updatedEvent);
    } catch (err) {
      console.error('Error ending event:', err);
      alert('Failed to end event');
    }
  };

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const handleCheckIn = async (memberId: string) => {
    if (!selectedEventId) {
      alert('Please select or start an event first');
      return;
    }

    try {
      const result = await api.addEventParticipant(selectedEventId, memberId, 'mobile');
      
      // Reload the specific event to get updated participants
      const updatedEvent = await api.getEvent(selectedEventId);
      setEvents(events.map(e => e.id === selectedEventId ? updatedEvent : e));
      
      emit('participant-change', { eventId: selectedEventId, ...result });
    } catch (err) {
      console.error('Error checking in:', err);
      alert('Failed to check in');
    }
  };

  const handleAddMember = async (name: string) => {
    try {
      const member = await api.createMember(name);
      setMembers([...members, member]);
      emit('member-added', member);
    } catch (err) {
      console.error('Error adding member:', err);
      alert('Failed to add member');
    }
  };

  const handleLoadMoreEvents = useCallback(() => {
    loadEvents(false);
  }, [offset, loadingMore]);

  const handleCreateActivity = async (name: string) => {
    try {
      const activity = await api.createActivity(name);
      setActivities([...activities, activity]);
    } catch (err) {
      console.error('Error creating activity:', err);
      alert('Failed to create activity');
    }
  };

  const handleUpdateMember = async (id: string, name: string) => {
    try {
      const updatedMember = await api.updateMember(id, name);
      setMembers(members.map(m => m.id === id ? updatedMember : m));
      emit('member-update', updatedMember);
    } catch (err) {
      console.error('Error updating member:', err);
      throw err;
    }
  };
  // Get participants signed into selected event to highlight in member list
  const activeParticipantIds = selectedEvent?.participants.map(p => p.memberId) || [];

  if (loading) {
    return (
      <div className="app">
        <Header isConnected={isConnected} databaseStatus={databaseStatus} />
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading Station Manager...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <Header isConnected={isConnected} databaseStatus={databaseStatus} />
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="btn-primary" onClick={loadInitialData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header isConnected={isConnected} databaseStatus={databaseStatus} />
      
      <main className="main-content">
        <div className="page-header">
          <button 
            className="btn-manage-users" 
            onClick={() => setShowUserManagement(true)}
          >
            ⚙️ Manage Users
          </button>
        </div>
        <div className="toolbar">
          <button className="btn-new-event" onClick={() => setShowNewEventModal(true)}>
            + Start New Event
          </button>
          <button className="btn-add-activity" onClick={() => {
            const name = prompt('Enter activity name:');
            if (name) handleCreateActivity(name);
          }}>
            + Add Activity Type
          </button>
        </div>

        <div className="content-grid">
          <div className="left-column">
            <EventLog
              events={events}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              onEndEvent={handleEndEvent}
              onLoadMore={handleLoadMoreEvents}
              hasMore={hasMore}
              isLoading={loadingMore}
            />
          </div>

          <div className="middle-column">
            <CurrentEventParticipants event={selectedEvent} />
          </div>

          <div className="right-column">
            <MemberList
              members={members}
              activeCheckIns={activeParticipantIds.map(id => ({
                memberId: id,
                id: '',
                activityId: '',
                checkInTime: '',
                checkInMethod: 'mobile' as const,
                isOffsite: false,
                isActive: true,
                createdAt: '',
                updatedAt: '',
                memberName: '',
                activityName: '',
              }))}
              onCheckIn={handleCheckIn}
              onAddMember={handleAddMember}
            />
          </div>
        </div>
      </main>

      {showUserManagement && (
        <UserManagement
          members={members}
          onClose={() => setShowUserManagement(false)}
          onUpdateMember={handleUpdateMember}
        />
      )}
      <NewEventModal
        isOpen={showNewEventModal}
        activities={activities}
        onClose={() => setShowNewEventModal(false)}
        onCreate={handleCreateEvent}
      />
    </div>
  );
}
