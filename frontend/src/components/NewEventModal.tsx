import { useState, useEffect, type KeyboardEvent, type MouseEvent } from 'react';
import type { Activity } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './NewEventModal.css';

interface NewEventModalProps {
  isOpen: boolean;
  activities: Activity[];
  onClose: () => void;
  onCreate: (activityId: string) => void;
  onDeleteActivity: (activityId: string) => void;
}

export function NewEventModal({ isOpen, activities, onClose, onCreate, onDeleteActivity }: NewEventModalProps) {
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  const handleClose = () => {
    setSelectedActivityId('');
    onClose();
  };

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
