/**
 * Sign-In Page Component
 * 
 * Main interface for member sign-in/sign-out and event management.
 * 
 * Features:
 * - Event-based attendance tracking
 * - Real-time participant updates via WebSocket
 * - Member search and quick sign-in
 * - Event creation and management
 * - Activity selection (training, maintenance, meetings)
 * - Infinite scroll event log
 * - User management (add/edit members)
 * 
 * Real-time synchronization ensures all connected devices see updates instantly.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Constants
const STATION_SWITCH_DELAY_MS = 300; // Match CSS animation duration
import { Header } from '../../components/Header';
import { EventLog } from '../../components/EventLog';
import { CurrentEventParticipants } from '../../components/CurrentEventParticipants';
import { MemberList } from '../../components/MemberList';
import { MemberNameGrid } from '../../components/MemberNameGrid';
import { UserManagement } from '../../components/UserManagement';
import { BulkImportModal } from '../../components/BulkImportModal';
import { NewEventModal } from '../../components/NewEventModal';
import { ExportData } from '../../components/ExportData';
import { FloatingActionButton } from '../../components/FloatingActionButton';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { PageTransition } from '../../components/PageTransition';
import { useSocket } from '../../hooks/useSocket';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useToast } from '../../hooks/useToast';
import { useStation } from '../../contexts/StationContext';
import { api } from '../../services/api';
import { announce } from '../../utils/announcer';
import { formatErrorMessage } from '../../utils/errorHandler';
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
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [showExportData, setShowExportData] = useState(false);
  const [confirmEndEvent, setConfirmEndEvent] = useState<string | null>(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<string | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState<{
    databaseType: 'mongodb' | 'in-memory' | 'table-storage';
    usingInMemory: boolean;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGridExpanded, setIsGridExpanded] = useState(true);
  const [isSwitchingStation, setIsSwitchingStation] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  const { isConnected, emit, on, off } = useSocket();
  const { showSuccess, showError, showWarning } = useToast();
  const { selectedStation } = useStation();

  // Get selected event
  const selectedEvent = selectedEventId
    ? events.find(e => e.id === selectedEventId) || null
    : null;

  // Check if we have any active events
  const hasActiveEvents = events.some(e => e.isActive);

  // Auto-expand grid when events become active
  useEffect(() => {
    if (hasActiveEvents) {
      setIsGridExpanded(true);
    }
  }, [hasActiveEvents]);

  // Listen for station changes and reload data
  useEffect(() => {
    // Skip initial load (handled by loadInitialData)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only reload when station actually changes
    if (selectedStation) {
      const reloadDataForNewStation = async () => {
        setIsSwitchingStation(true);
        try {
          await Promise.all([
            loadMembers(),
            loadActivities(),
            loadEvents(true),
          ]);
          announce(`Switched to ${selectedStation.brigadeName} - ${selectedStation.name}`);
        } catch (err) {
          console.error('Error reloading data for new station:', err);
          announce('Failed to reload data for new station');
        } finally {
          // Small delay to ensure smooth transition
          setTimeout(() => setIsSwitchingStation(false), STATION_SWITCH_DELAY_MS);
        }
      };

      reloadDataForNewStation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStation?.id]);

  // Initial data load
  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const errorMessage = formatErrorMessage(err);
      setError(errorMessage);
      showError(errorMessage);
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

  const loadMembers = useCallback(async () => {
    try {
      const data = await api.getMembers();
      // Defensive check: ensure data is an array
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading members:', err);
    }
  }, []);

  const loadActivities = async () => {
    try {
      const data = await api.getActivities();
      // Defensive check: ensure data is an array
      setActivities(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading activities:', err);
    }
  };

  const loadEvents = useCallback(async (reset: boolean = false) => {
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
      // Defensive check: ensure data is an array
      const eventsArray = Array.isArray(data) ? data : [];
      
      if (reset) {
        setEvents(eventsArray);
        setOffset(eventsArray.length);
        // Auto-select first active event
        const firstActive = eventsArray.find(e => e.isActive);
        if (firstActive && !selectedEventId) {
          setSelectedEventId(firstActive.id);
        }
      } else {
        setEvents(prev => [...prev, ...eventsArray]);
        setOffset(prev => prev + eventsArray.length);
      }

      setHasMore(eventsArray.length === limit);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, offset, selectedEventId]);

  const handleCreateEvent = async (activityId: string) => {
    try {
      const event = await api.createEvent(activityId);
      setEvents([event, ...events]);
      setSelectedEventId(event.id);
      emit('event-created', event);
      
      // Show success toast
      const activity = activities.find(a => a.id === activityId);
      showSuccess(`Event started: ${activity?.name || 'New event'}`);
    } catch (err) {
      console.error('Error creating event:', err);
      showError(formatErrorMessage(err));
    }
  };

  const handleEndEvent = async (eventId: string) => {
    setConfirmEndEvent(null);
    try {
      const updatedEvent = await api.endEvent(eventId);
      setEvents(prevEvents => prevEvents.map(e => e.id === eventId ? updatedEvent : e));
      
      // If ending the selected event, select another active event
      if (selectedEventId === eventId) {
        const nextActive = events.find(e => e.isActive && e.id !== eventId);
        setSelectedEventId(nextActive?.id || null);
      }
      
      emit('event-ended', updatedEvent);
      showSuccess('Event ended successfully');
    } catch (err) {
      console.error('Error ending event:', err);
      showError(formatErrorMessage(err));
    }
  };

  const handleReactivateEvent = async (eventId: string) => {
    try {
      const updatedEvent = await api.reactivateEvent(eventId);
      setEvents(prevEvents => prevEvents.map(e => e.id === eventId ? updatedEvent : e));
      setSelectedEventId(updatedEvent.id);
      setIsGridExpanded(true);
      emit('event-update', updatedEvent);
      showSuccess('Event reopened — you can continue updating participants');
    } catch (err) {
      console.error('Error reactivating event:', err);
      showError(formatErrorMessage(err));
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    setConfirmDeleteEvent(null);
    try {
      await api.deleteEvent(eventId);
      
      // Remove the event from the list
      setEvents(prevEvents => prevEvents.filter(e => e.id !== eventId));
      
      // If deleting the selected event, select another active event
      if (selectedEventId === eventId) {
        const nextActive = events.find(e => e.isActive && e.id !== eventId);
        setSelectedEventId(nextActive?.id || null);
      }
      
      emit('event-deleted', { eventId });
      showSuccess('Event deleted');
    } catch (err) {
      console.error('Error deleting event:', err);
      showError(formatErrorMessage(err));
    }
  };

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const handleCheckIn = async (memberId: string) => {
    if (!selectedEventId) {
      showWarning('Please select or start an event first');
      return;
    }

    try {
      const result = await api.addEventParticipant(selectedEventId, memberId, 'mobile');
      
      // Reload the specific event to get updated participants
      const updatedEvent = await api.getEvent(selectedEventId);
      setEvents(prevEvents => prevEvents.map(e => e.id === selectedEventId ? updatedEvent : e));
      
      // Announce check-in to screen readers and show success toast
      const member = members.find(m => m.id === memberId);
      if (member) {
        announce(`${member.name} checked in successfully`, 'polite');
        showSuccess(`${member.name} checked in`);
      }
      
      emit('participant-change', { eventId: selectedEventId, ...result });
    } catch (err) {
      console.error('Error checking in:', err);
      const errorMessage = formatErrorMessage(err);
      announce(`Error: ${errorMessage}`, 'assertive');
      showError(errorMessage);
    }
  };

  const handleRemoveParticipant = async (memberId: string) => {
    if (!selectedEventId) {
      showWarning('Please select an event first');
      return;
    }

    try {
      // Use the same endpoint - it toggles, so it will remove if already checked in
      const result = await api.addEventParticipant(selectedEventId, memberId, 'mobile');
      
      // Reload the specific event to get updated participants
      const updatedEvent = await api.getEvent(selectedEventId);
      setEvents(prevEvents => prevEvents.map(e => e.id === selectedEventId ? updatedEvent : e));
      
      // Announce check-out to screen readers and show success toast
      const member = members.find(m => m.id === memberId);
      if (member) {
        announce(`${member.name} checked out`, 'polite');
        showSuccess(`${member.name} checked out`);
      }
      
      emit('participant-change', { eventId: selectedEventId, ...result });
    } catch (err) {
      console.error('Error removing participant:', err);
      const errorMessage = formatErrorMessage(err);
      announce(`Error: ${errorMessage}`, 'assertive');
      showError(errorMessage);
    }
  };

  const handleAddMember = async (name: string) => {
    try {
      const member = await api.createMember(name);
      setMembers([...members, member]);
      announce(`Success: ${name} added as new member`, 'polite');
      showSuccess(`${name} added as new member`);
      emit('member-added', member);
    } catch (err) {
      console.error('Error adding member:', err);
      const errorMessage = formatErrorMessage(err);
      announce(`Error: ${errorMessage}`, 'assertive');
      showError(errorMessage);
    }
  };

  const handleLoadMoreEvents = useCallback(() => {
    loadEvents(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, loadingMore]);

  const handleCreateActivity = async (name: string) => {
    try {
      const activity = await api.createActivity(name);
      setActivities([...activities, activity]);
      showSuccess(`Activity "${name}" created`);
    } catch (err) {
      console.error('Error creating activity:', err);
      showError(formatErrorMessage(err));
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      await api.deleteActivity(activityId);
      
      // Remove the activity from the list
      setActivities(activities.filter(a => a.id !== activityId));
      
      emit('activity-deleted', { activityId });
      showSuccess('Activity deleted');
    } catch (err) {
      console.error('Error deleting activity:', err);
      showError(formatErrorMessage(err));
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

  const handleBulkImport = async (membersToImport: Array<{
    firstName?: string;
    lastName?: string;
    name: string;
    rank?: string;
  }>) => {
    try {
      const result = await api.executeMemberImport(membersToImport);

      // Reload members to include newly imported ones
      await loadMembers();

      // Emit socket event for all successful imports
      result.successful.forEach(member => {
        emit('member-added', member);
      });

      return result;
    } catch (err) {
      console.error('Error importing members:', err);
      throw err;
    }
  };

  const handleRefreshMembers = async () => {
    await loadMembers();
  };

  const handleOpenBulkImport = () => {
    setShowUserManagement(false);
    setShowBulkImport(true);
  };

  const handleCloseBulkImport = () => {
    setShowBulkImport(false);
    loadMembers(); // Reload members after import
  };

  // Get participants signed into selected event to highlight in member list
  const activeParticipantIds = selectedEvent?.participants.map(p => p.memberId) || [];

  // Handle pull-to-refresh on main content
  const handlePullToRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await Promise.all([
        loadMembers(),
        loadEvents(true),
      ]);
      announce('Content refreshed');
    } catch (err) {
      console.error('Error refreshing:', err);
      announce('Failed to refresh content');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [isRefreshing, loadEvents, loadMembers]);

  // Pull-to-refresh handlers
  const pullToRefreshHandlers = usePullToRefresh({
    onRefresh: handlePullToRefresh,
    threshold: 80,
    resistance: 2.5,
    enableHaptic: true,
  });

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
    <PageTransition variant="slideFromBottom">
      <div className="app">
      <Header 
        isConnected={isConnected} 
        databaseStatus={databaseStatus}
        onManageUsers={() => setShowUserManagement(true)}
        onExportData={() => setShowExportData(!showExportData)}
        onAddActivityType={() => {
          const name = prompt('Enter activity name:');
          if (name) handleCreateActivity(name);
        }}
      />

      <main
        ref={mainContentRef}
        className="main-content"
        {...pullToRefreshHandlers}
      >
        {isRefreshing && (
          <div className="pull-to-refresh-indicator">
            <div className="spinner"></div>
            <span>Refreshing...</span>
          </div>
        )}

        {/* Station switching overlay */}
        {isSwitchingStation && (
          <div className="station-switching-overlay">
            <div className="station-switching-content">
              <div className="spinner"></div>
              <span>Switching Brigade...</span>
              {selectedStation && (
                <span className="station-name-small">{selectedStation.brigadeName}</span>
              )}
            </div>
          </div>
        )}

        {showExportData && (
          <div className="export-data-section">
            <ExportData />
          </div>
        )}

        {/* Show full-width member grid when there are active events and grid is expanded */}
        {hasActiveEvents && isGridExpanded ? (
          <MemberNameGrid
            members={members}
            events={events}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
            onCheckIn={handleCheckIn}
            onStartNewEvent={() => setShowNewEventModal(true)}
            onEndEvent={handleEndEvent}
            onCollapse={() => setIsGridExpanded(false)}
          />
        ) : (
          /* Show three-column layout when no active events or grid is collapsed */
          <div className="content-grid">
          <div className="left-column">
            <EventLog
              events={events}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              onEndEvent={(eventId) => setConfirmEndEvent(eventId)}
              onDeleteEvent={(eventId) => setConfirmDeleteEvent(eventId)}
              onLoadMore={handleLoadMoreEvents}
              hasMore={hasMore}
              isLoading={loadingMore}
              onStartNewEvent={() => setShowNewEventModal(true)}
              onExpandGrid={hasActiveEvents ? () => setIsGridExpanded(true) : undefined}
              onReactivateEvent={handleReactivateEvent}
            />
          </div>

          <div className="middle-column">
            <CurrentEventParticipants 
              event={selectedEvent} 
              onRemoveParticipant={handleRemoveParticipant}
            />
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
              onRefresh={handleRefreshMembers}
            />
          </div>
        </div>
        )}
      </main>

      {showUserManagement && (
        <UserManagement
          members={members}
          onClose={() => setShowUserManagement(false)}
          onUpdateMember={handleUpdateMember}
          onBulkImport={handleOpenBulkImport}
        />
      )}

      {showBulkImport && (
        <BulkImportModal
          existingMembers={members}
          onClose={() => setShowBulkImport(false)}
          onImportComplete={handleCloseBulkImport}
          onImport={handleBulkImport}
        />
      )}

      <NewEventModal
        isOpen={showNewEventModal}
        activities={activities}
        onClose={() => setShowNewEventModal(false)}
        onCreate={handleCreateEvent}
        onDeleteActivity={handleDeleteActivity}
      />

      {/* Floating Action Buttons */}
      <FloatingActionButton
        icon="+"
        onClick={() => setShowUserManagement(true)}
        ariaLabel="Add new member"
        position="bottom-right"
        scrollContainerRef={mainContentRef}
      />

      <FloatingActionButton
        icon="📅"
        onClick={() => setShowNewEventModal(true)}
        ariaLabel="Create new event"
        position="bottom-left"
        scrollContainerRef={mainContentRef}
      />

      {/* Confirmation Dialogs */}
      {confirmEndEvent && (
        <ConfirmationDialog
          title="End Event"
          message={`Are you sure you want to end this event? All participants will be checked out.`}
          confirmLabel="End Event"
          cancelLabel="Cancel"
          isDangerous={true}
          onConfirm={() => handleEndEvent(confirmEndEvent)}
          onCancel={() => setConfirmEndEvent(null)}
        />
      )}

      {confirmDeleteEvent && (
        <ConfirmationDialog
          title="Delete Event"
          message="Are you sure you want to delete this event? This action cannot be undone."
          description="All event data and participant records will be permanently removed."
          confirmLabel="Delete Event"
          cancelLabel="Cancel"
          isDangerous={true}
          onConfirm={() => handleDeleteEvent(confirmDeleteEvent)}
          onCancel={() => setConfirmDeleteEvent(null)}
        />
      )}
    </div>
    </PageTransition>
  );
}
