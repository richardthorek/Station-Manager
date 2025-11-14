import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ActivitySelector } from './components/ActivitySelector';
import { MemberList } from './components/MemberList';
import { ActiveCheckIns } from './components/ActiveCheckIns';
import { useSocket } from './hooks/useSocket';
import { api } from './services/api';
import type { Member, Activity, CheckInWithDetails, ActiveActivity } from './types';
import './App.css';

function App() {
  const [members, setMembers] = useState<Member[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeActivity, setActiveActivity] = useState<ActiveActivity | null>(null);
  const [activeCheckIns, setActiveCheckIns] = useState<CheckInWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isConnected, emit, on, off } = useSocket();

  // Initial data load
  useEffect(() => {
    loadInitialData();
  }, []);

  // Socket event listeners
  useEffect(() => {
    const handleCheckInUpdate = () => {
      loadActiveCheckIns();
    };

    const handleActivityUpdate = () => {
      loadActiveActivity();
    };

    const handleMemberUpdate = () => {
      loadMembers();
    };

    on('checkin-update', handleCheckInUpdate);
    on('activity-update', handleActivityUpdate);
    on('member-update', handleMemberUpdate);

    return () => {
      off('checkin-update', handleCheckInUpdate);
      off('activity-update', handleActivityUpdate);
      off('member-update', handleMemberUpdate);
    };
  }, [on, off]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMembers(),
        loadActivities(),
        loadActiveActivity(),
        loadActiveCheckIns(),
      ]);
    } catch (err) {
      setError('Failed to load initial data');
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
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

  const loadActiveActivity = async () => {
    try {
      const data = await api.getActiveActivity();
      setActiveActivity(data);
    } catch (err) {
      console.error('Error loading active activity:', err);
    }
  };

  const loadActiveCheckIns = async () => {
    try {
      const data = await api.getActiveCheckIns();
      setActiveCheckIns(data);
    } catch (err) {
      console.error('Error loading check-ins:', err);
    }
  };

  const handleSelectActivity = async (activityId: string) => {
    try {
      const data = await api.setActiveActivity(activityId);
      setActiveActivity(data);
      emit('activity-change', data);
    } catch (err) {
      console.error('Error setting active activity:', err);
      alert('Failed to set active activity');
    }
  };

  const handleCreateActivity = async (name: string) => {
    try {
      const activity = await api.createActivity(name);
      setActivities([...activities, activity]);
    } catch (err) {
      console.error('Error creating activity:', err);
      alert('Failed to create activity');
    }
  };

  const handleCheckIn = async (memberId: string) => {
    try {
      const result = await api.checkIn(memberId, 'mobile');
      await loadActiveCheckIns();
      emit('checkin', result);
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

  const handleUndoCheckIn = async (memberId: string) => {
    try {
      await api.undoCheckIn(memberId);
      await loadActiveCheckIns();
      emit('checkin', { action: 'undone', memberId });
    } catch (err) {
      console.error('Error undoing check-in:', err);
      alert('Failed to undo check-in');
    }
  };

  if (loading) {
    return (
      <div className="app">
        <Header isConnected={isConnected} />
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
        <Header isConnected={isConnected} />
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
      <Header isConnected={isConnected} />
      
      <main className="main-content">
        <div className="content-grid">
          <div className="left-column">
            <ActivitySelector
              activities={activities}
              activeActivity={activeActivity}
              onSelectActivity={handleSelectActivity}
              onCreateActivity={handleCreateActivity}
            />
            
            <ActiveCheckIns
              checkIns={activeCheckIns}
              onUndo={handleUndoCheckIn}
            />
          </div>

          <div className="right-column">
            <MemberList
              members={members}
              activeCheckIns={activeCheckIns}
              onCheckIn={handleCheckIn}
              onAddMember={handleAddMember}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
