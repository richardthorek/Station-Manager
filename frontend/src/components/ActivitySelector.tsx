import { useEffect, useRef, useState } from 'react';
import type { Activity, ActiveActivity } from '../types';
import './ActivitySelector.css';

interface ActivitySelectorProps {
  activities: Activity[];
  activeActivity: ActiveActivity | null;
  onSelectActivity: (activityId: string) => void;
  onCreateActivity: (name: string) => void;
}

export function ActivitySelector({
  activities,
  activeActivity,
  onSelectActivity,
  onCreateActivity,
}: ActivitySelectorProps) {
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');
  const newActivityInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (showNewActivity) {
      newActivityInputRef.current?.focus();
    }
  }, [showNewActivity]);

  const handleCreateActivity = () => {
    if (newActivityName.trim()) {
      onCreateActivity(newActivityName.trim());
      setNewActivityName('');
      setShowNewActivity(false);
    }
  };

  const currentActivity = activities.find(a => a.id === activeActivity?.activityId);

  return (
    <div className="activity-selector card">
      <h2>Current Activity</h2>
      
      <div className="current-activity">
        <div className="activity-display">
          <span className="activity-icon">📋</span>
          <span className="activity-name">{currentActivity?.name || 'No Activity Selected'}</span>
        </div>
      </div>

      <div className="activity-list">
        <h3>Select Activity</h3>
        <div className="activity-buttons">
          {activities.map(activity => (
            <button
              key={activity.id}
              className={`activity-btn ${activity.id === activeActivity?.activityId ? 'active' : ''}`}
              onClick={() => onSelectActivity(activity.id)}
            >
              {activity.name}
              {activity.isCustom && <span className="custom-badge">Custom</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="new-activity-section">
        {!showNewActivity ? (
          <button className="btn-accent" onClick={() => setShowNewActivity(true)}>
            + Add Custom Activity
          </button>
        ) : (
          <div className="new-activity-form">
            <input
              type="text"
              placeholder="Activity name..."
              value={newActivityName}
              onChange={(e) => setNewActivityName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateActivity()}
              ref={newActivityInputRef}
            />
            <div className="form-actions">
              <button className="btn-success" onClick={handleCreateActivity}>
                Add
              </button>
              <button className="btn-secondary" onClick={() => {
                setShowNewActivity(false);
                setNewActivityName('');
              }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
