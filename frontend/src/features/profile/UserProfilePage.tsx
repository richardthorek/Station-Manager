import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { AchievementGrid } from '../../components/AchievementBadge';
import { api } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import type { Member, CheckIn, Activity } from '../../types';
import type { MemberAchievementSummary } from '../../types/achievements';
import './UserProfilePage.css';

export function UserProfilePage() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [checkInHistory, setCheckInHistory] = useState<CheckIn[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [achievements, setAchievements] = useState<MemberAchievementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedRank, setEditedRank] = useState<string>('');
  const [databaseStatus, setDatabaseStatus] = useState<{
    databaseType: 'mongodb' | 'in-memory' | 'table-storage';
    usingInMemory: boolean;
  } | null>(null);
  
  const { isConnected } = useSocket();

  useEffect(() => {
    loadDatabaseStatus();
    if (memberId) {
      loadMemberData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const loadDatabaseStatus = async () => {
    try {
      const status = await api.getStatus();
      setDatabaseStatus({
        databaseType: status.databaseType,
        usingInMemory: status.usingInMemory,
      });
    } catch (err) {
      console.error('Error loading database status:', err);
    }
  };

  const loadMemberData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!memberId) {
        setError('Member ID is required');
        return;
      }

      const [memberData, historyData, activitiesData, achievementsData] = await Promise.all([
        api.getMember(memberId),
        api.getMemberHistory(memberId),
        api.getActivities(),
        api.getMemberAchievements(memberId).catch(() => null), // Don't fail if achievements fail
      ]);
      
      setMember(memberData);
      setCheckInHistory(historyData);
      setActivities(activitiesData);
      setAchievements(achievementsData);
      setEditedName(memberData.name);
      setEditedRank(memberData.rank || 'Visitor');
    } catch (err) {
      console.error('Error loading member data:', err);
      setError('Failed to load member profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!member || !editedName.trim()) {
      return;
    }

    try {
      const updatedMember = await api.updateMember(member.id, editedName.trim(), editedRank || null);
      setMember(updatedMember);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating member:', err);
      alert('Failed to update member');
    }
  };

  const rankOptions = [
    { value: 'Visitor', label: 'Visitor' },
    { value: 'Trainee', label: 'Trainee' },
    { value: 'Firefighter', label: 'Firefighter' },
    { value: 'Captain', label: 'Captain' },
    { value: 'Senior Deputy Captain', label: 'Senior Deputy Captain' },
    { value: 'Deputy Captain', label: 'Deputy Captain' },
    { value: 'Group Officer', label: 'Group Officer' },
    { value: 'Deputy Group Officer', label: 'Deputy Group Officer' },
    { value: 'Operational Officer', label: 'Operational Officer' },
    { value: 'Inspector', label: 'Inspector' },
    { value: 'Superintendent', label: 'Superintendent' },
  ];

  const getActivityName = (activityId: string) => {
    const activity = activities.find(a => a.id === activityId);
    return activity?.name || 'Unknown Activity';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const generateSignInUrl = () => {
    if (!member) return '';
    const identifier = encodeURIComponent(member.name);
    const baseUrl = window.location.origin;
    return `${baseUrl}/sign-in?user=${identifier}`;
  };

  const copySignInUrl = () => {
    const url = generateSignInUrl();
    navigator.clipboard.writeText(url);
    alert('Sign-in URL copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="app">
        <Header isConnected={isConnected} databaseStatus={databaseStatus} />
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="app">
        <Header isConnected={isConnected} databaseStatus={databaseStatus} />
        <div className="error-container">
          <h2>Error</h2>
          <p>{error || 'Member not found'}</p>
          <button className="btn-primary" onClick={() => navigate('/signin')}>
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app profile-app">
      <Header isConnected={isConnected} databaseStatus={databaseStatus} />
      
      <main className="main-content profile-main">
        <div className="profile-container">
          <div className="profile-header">
            <button className="btn-back" onClick={() => navigate('/signin')}>
              ← Back to Sign In
            </button>
          </div>

          <div className="profile-layout">
            <div className="profile-left">
              <div className="profile-card card">
                <h2>User Profile</h2>
                
                <div className="profile-info">
                  <div className="profile-field">
                    <label>Name:</label>
                    {!isEditing ? (
                      <div className="profile-value">
                        <span>{member.name}</span>
                        <button className="btn-edit" onClick={() => setIsEditing(true)}>
                          Edit
                        </button>
                      </div>
                    ) : (
                      <div className="profile-edit">
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          autoFocus
                        />
                        <button className="btn-success" onClick={handleSaveName}>
                          Save
                        </button>
                        <button className="btn-secondary" onClick={() => {
                          setEditedName(member.name);
                          setEditedRank(member.rank || 'Visitor');
                          setIsEditing(false);
                        }}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="profile-field">
                    <label>Rank:</label>
                    {!isEditing ? (
                      <div className="profile-value">
                        <span>{member.rank || 'Visitor'}</span>
                        <button className="btn-edit" onClick={() => setIsEditing(true)}>
                          Edit
                        </button>
                      </div>
                    ) : (
                      <div className="profile-edit">
                        <select
                          value={editedRank}
                          onChange={(e) => setEditedRank(e.target.value)}
                          className="rank-dropdown"
                        >
                          {rankOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="profile-field">
                    <label>Member ID:</label>
                    <span className="profile-value">{member.id}</span>
                  </div>

                  <div className="profile-field">
                    <label>Member Since:</label>
                    <span className="profile-value">{formatDate(member.createdAt)}</span>
                  </div>

                  <div className="profile-field">
                    <label>Last Updated:</label>
                    <span className="profile-value">{formatDate(member.updatedAt)}</span>
                  </div>
                </div>

                <div className="profile-signin-link">
                  <h3>Personal Sign-In Link</h3>
                  <p className="signin-link-description">
                    Use this link or QR code to quickly check in to the active event:
                  </p>
                  <div className="signin-link-box">
                    <input
                      type="text"
                      value={generateSignInUrl()}
                      readOnly
                      className="signin-link-input"
                    />
                    <button className="btn-primary" onClick={copySignInUrl}>
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>

              {/* Achievements Section */}
              {achievements && (
                <div className="achievements-card card">
                  <h2>🏆 Achievements</h2>
                  <div className="achievements-stats">
                    <div className="achievement-stat">
                      <span className="stat-number">{achievements.totalAchievements}</span>
                      <span className="stat-label">Total Achievements</span>
                    </div>
                    <div className="achievement-stat">
                      <span className="stat-number">{achievements.activeStreaks.length}</span>
                      <span className="stat-label">Active Streaks</span>
                    </div>
                    <div className="achievement-stat">
                      <span className="stat-number">{achievements.recentlyEarned.length}</span>
                      <span className="stat-label">Recently Earned</span>
                    </div>
                  </div>
                  
                  {achievements.totalAchievements === 0 && achievements.progress.length === 0 ? (
                    <p className="no-achievements">
                      Start checking in to events to earn achievements! 🎯
                    </p>
                  ) : (
                    <>
                      {achievements.recentlyEarned.length > 0 && (
                        <div className="achievements-section">
                          <h3>Recently Earned</h3>
                          <AchievementGrid
                            achievements={achievements.recentlyEarned}
                            variant="compact"
                            showRecent={true}
                          />
                        </div>
                      )}
                      
                      {achievements.achievements.length > 0 && (
                        <div className="achievements-section">
                          <h3>All Achievements</h3>
                          <AchievementGrid
                            achievements={achievements.achievements}
                            variant="compact"
                          />
                        </div>
                      )}
                      
                      {achievements.progress.length > 0 && (
                        <div className="achievements-section">
                          <h3>In Progress</h3>
                          <AchievementGrid
                            progress={achievements.progress.slice(0, 6)}
                            variant="full"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="profile-right">
              <div className="history-card card">
                <h2>Check-In History</h2>
                
                {checkInHistory.length === 0 ? (
                  <p className="no-history">No check-in history yet.</p>
                ) : (
                  <div className="history-list">
                    <div className="history-header">
                      <span>Date & Time</span>
                      <span>Activity</span>
                      <span>Method</span>
                      <span>Status</span>
                    </div>
                    {checkInHistory.map((checkIn) => (
                      <div key={checkIn.id} className="history-item">
                        <span className="history-date">
                          {formatDate(checkIn.checkInTime)}
                        </span>
                        <span className="history-activity">
                          {getActivityName(checkIn.activityId)}
                        </span>
                        <span className="history-method">
                          {checkIn.checkInMethod}
                        </span>
                        <span className={`history-status ${checkIn.isActive ? 'active' : 'completed'}`}>
                          {checkIn.isActive ? 'Active' : 'Completed'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
