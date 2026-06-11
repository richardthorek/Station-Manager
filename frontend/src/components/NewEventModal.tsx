import { useState, useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import type { Activity } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './NewEventModal.css';

interface NewEventModalProps {
  isOpen: boolean;
  activities: Activity[];
  onClose: () => void;
  onCreate: (activityId: string) => void;
  onCreateActivity?: (name: string) => Promise<Activity | null>;
  onDeleteActivity: (activityId: string) => void;
}

export function NewEventModal({ isOpen, activities, onClose, onCreate, onCreateActivity, onDeleteActivity }: NewEventModalProps) {
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);
  const addActivityInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  const handleClose = () => {
    setSelectedActivityId('');
    setShowAddActivity(false);
    setNewActivityName('');
    onClose();
  };

  const handleAddActivity = async () => {
    const name = newActivityName.trim();
    if (!name || !onCreateActivity || isCreatingActivity) return;

    setIsCreatingActivity(true);
    try {
      const activity = await onCreateActivity(name);
      if (activity) {
        // Select the new activity so the user can start the event immediately
        setSelectedActivityId(activity.id);
        setNewActivityName('');
        setShowAddActivity(false);
      }
    } finally {
      setIsCreatingActivity(false);
    }
  };

  // Focus the name input when the add-activity form opens
  useEffect(() => {
    if (showAddActivity) {
      addActivityInputRef.current?.focus();
    }
  }, [showAddActivity]);

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClose();
    }
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  const handleCreate = () => {
    if (selectedActivityId) {
      onCreate(selectedActivityId);
      setSelectedActivityId('');
      onClose();
    }
  };

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: Event) => {
      if ((event as globalThis.KeyboardEvent).key === 'Escape') {
        setSelectedActivityId('');
        setShowAddActivity(false);
        setNewActivityName('');
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close new event dialog"
    >
      <div 
        ref={modalRef}
        className="modal-content" 
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        aria-describedby="event-modal-description"
      >
        <div className="modal-header">
          <h2 id="event-modal-title">Start New Event</h2>
          <button 
            type="button"
            className="modal-close" 
            onClick={handleClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p id="event-modal-description" className="modal-description">
            Select an activity type to start a new event. Participants can sign in to this event.
          </p>

          {activities.length === 0 && (
            <div className="activity-empty-state" role="status">
              <p className="activity-empty-state-title">No activity types yet</p>
              <p className="activity-empty-state-hint">
                Add your first activity type below to start an event.
              </p>
            </div>
          )}

          <div className="activity-grid" role="radiogroup" aria-label="Activity type selection">
            {activities.map((activity) => (
              <div key={activity.id} className="activity-option-wrapper">
                <button
                  type="button"
                  className={`activity-option ${selectedActivityId === activity.id ? 'selected' : ''}`}
                  onClick={() => setSelectedActivityId(activity.id)}
                  role="radio"
                  aria-checked={selectedActivityId === activity.id}
                  aria-label={`${activity.name}${activity.isCustom ? ' (custom activity)' : ''}`}
                >
                  <span className="activity-icon" aria-hidden="true">📋</span>
                  <span className="activity-name">{activity.name}</span>
                  {activity.isCustom && (
                    <span className="custom-badge">Custom</span>
                  )}
                </button>
                {activity.isCustom && (
                  <button
                    type="button"
                    className="activity-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to delete the "${activity.name}" activity? This cannot be undone.`)) {
                        onDeleteActivity(activity.id);
                      }
                    }}
                    aria-label={`Delete ${activity.name} activity`}
                    title="Delete activity"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>

          {onCreateActivity && (
            showAddActivity ? (
              <div className="add-activity-form">
                <label htmlFor="new-activity-name" className="sr-only">New activity name</label>
                <input
                  id="new-activity-name"
                  ref={addActivityInputRef}
                  type="text"
                  className="add-activity-input"
                  placeholder="Activity name..."
                  value={newActivityName}
                  maxLength={200}
                  onChange={(e) => setNewActivityName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddActivity();
                    }
                  }}
                  disabled={isCreatingActivity}
                />
                <div className="add-activity-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleAddActivity}
                    disabled={!newActivityName.trim() || isCreatingActivity}
                  >
                    {isCreatingActivity ? 'Adding…' : 'Add'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowAddActivity(false);
                      setNewActivityName('');
                    }}
                    disabled={isCreatingActivity}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="add-activity-toggle"
                onClick={() => setShowAddActivity(true)}
              >
                + Add activity type
              </button>
            )
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleCreate}
            disabled={!selectedActivityId}
            aria-disabled={!selectedActivityId}
          >
            Start Event
          </button>
        </div>
      </div>
    </div>
  );
}
