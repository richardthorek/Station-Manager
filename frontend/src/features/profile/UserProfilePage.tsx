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
      // Defensive checks: ensure data is an array
      setCheckInHistory(Array.isArray(historyData) ? historyData : []);
      setActivities(Array.isArray(activitiesData) ? activitiesData : []);
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

  const getActivityIcon = (activityId: string) => {
    const activityName = getActivityName(activityId).toLowerCase();
    if (activityName.includes('training')) return '📚';
    if (activityName.includes('maintenance')) return '🔧';
    if (activityName.includes('meeting')) return '💬';
    if (activityName.includes('incident')) return '🚒';
    return '📋';
  };

  const groupCheckInsByDate = () => {
    const grouped: { [key: string]: CheckIn[] } = {};
    checkInHistory.forEach(checkIn => {
      const date = new Date(checkIn.checkInTime).toLocaleDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(checkIn);
    });
    return grouped;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const calculateMembershipDuration = () => {
    if (!member) return '';
    const createdAt = new Date(member.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months !== 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      return months > 0 ? `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}` : `${years} year${years !== 1 ? 's' : ''}`;
    }
  };

  const getActiveStreak = () => {
    if (!achievements?.activeStreaks) return 0;
    return achievements.activeStreaks.length;
  };

  const getTotalCheckIns = () => {
    return checkInHistory.length;
  };

  const calculateTotalHours = () => {
    // For now, estimate 2 hours per check-in as we don't have checkOutTime in the CheckIn interface
    // This is a simplified calculation - actual time tracking would require event participants data
    const averageHoursPerCheckIn = 2;
    return checkInHistory.length * averageHoursPerCheckIn;
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

          {/* Enhanced Profile Hero Section */}
          <div className="profile-hero">
            <div className="profile-avatar-container">
              <div className="profile-avatar-wrapper">
                <div className="profile-avatar">
                  {member.name.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
            <div className="profile-hero-info">
              <h1 className="profile-hero-name">{member.name}</h1>
              <div className="profile-hero-rank">{member.rank || 'Visitor'}</div>
              <div className="profile-hero-badges">
                <div className="hero-badge">
                  <span className="badge-icon">📅</span>
                  <span className="badge-text">{calculateMembershipDuration()}</span>
                </div>
                {getActiveStreak() > 0 && (
                  <div className="hero-badge streak-badge">
                    <span className="badge-icon">🔥</span>
                    <span className="badge-text">{getActiveStreak()} streak{getActiveStreak() !== 1 ? 's' : ''}</span>
                  </div>
                )}
                <div className="hero-badge">
                  <span className="badge-icon">✓</span>
                  <span className="badge-text">{getTotalCheckIns()} check-ins</span>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Statistics Dashboard */}
          <div className="stats-dashboard">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-value">{getTotalCheckIns()}</div>
                <div className="stat-label">Total Check-ins</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏱️</div>
              <div className="stat-content">
                <div className="stat-value">{calculateTotalHours()}</div>
                <div className="stat-label">Total Hours</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🔥</div>
              <div className="stat-content">
                <div className="stat-value">{getActiveStreak()}</div>
                <div className="stat-label">Active Streaks</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🏆</div>
              <div className="stat-content">
                <div className="stat-value">{achievements?.totalAchievements || 0}</div>
                <div className="stat-label">Achievements</div>
              </div>
            </div>
          </div>

          <div className="profile-layout">
            <div className="profile-left">
              <div className="profile-card card">
                <h2>Profile Details</h2>
                
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
                <h2>Activity Timeline</h2>

                {checkInHistory.length === 0 ? (
                  <p className="no-history">No check-in history yet.</p>
                ) : (
                  <div className="activity-timeline">
                    {Object.entries(groupCheckInsByDate()).map(([date, checkIns]) => (
                      <div key={date} className="timeline-group">
                        <div className="timeline-date-separator">
                          <span className="timeline-date">{date}</span>
                        </div>
                        {checkIns.map((checkIn) => (
                          <div key={checkIn.id} className="timeline-item">
                            <div className="timeline-marker">
                              <span className="timeline-icon">{getActivityIcon(checkIn.activityId)}</span>
                            </div>
                            <div className="timeline-content">
                              <div className="timeline-header">
                                <span className="timeline-activity">
                                  {getActivityName(checkIn.activityId)}
                                </span>
                                <span className={`timeline-status ${checkIn.isActive ? 'active' : 'completed'}`}>
                                  {checkIn.isActive ? 'Active' : 'Completed'}
                                </span>
                              </div>
                              <div className="timeline-details">
                                <span className="timeline-time">
                                  {new Date(checkIn.checkInTime).toLocaleTimeString()}
                                </span>
                                <span className="timeline-method">
                                  via {checkIn.checkInMethod}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
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
