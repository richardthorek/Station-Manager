import { useState } from 'react';
import type { Activity } from '../types';
import './NewEventModal.css';

interface NewEventModalProps {
  isOpen: boolean;
  activities: Activity[];
  onClose: () => void;
  onCreate: (activityId: string) => void;
}

export function NewEventModal({ isOpen, activities, onClose, onCreate }: NewEventModalProps) {
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');

  if (!isOpen) return null;

  const handleCreate = () => {
    if (selectedActivityId) {
      onCreate(selectedActivityId);
      setSelectedActivityId('');
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedActivityId('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Start New Event</h2>
          <button className="modal-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Select an activity type to start a new event. Participants can sign in to this event.
          </p>

          <div className="activity-grid">
            {activities.map((activity) => (
              <button
                key={activity.id}
                className={`activity-option ${selectedActivityId === activity.id ? 'selected' : ''}`}
                onClick={() => setSelectedActivityId(activity.id)}
              >
                <span className="activity-icon">📋</span>
                <span className="activity-name">{activity.name}</span>
                {activity.isCustom && (
                  <span className="custom-badge">Custom</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={!selectedActivityId}
          >
            Start Event
          </button>
        </div>
      </div>
    </div>
  );
}
