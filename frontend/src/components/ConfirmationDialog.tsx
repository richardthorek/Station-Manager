/**
 * Confirmation Dialog Component
 * 
 * Reusable confirmation dialog for destructive actions with:
 * - Customizable title, message, and button labels
 * - Danger/destructive action styling
 * - Keyboard accessibility (Escape to cancel, Enter to confirm)
 * - Focus trap
 * - Haptic feedback on mobile
 * - Loading state during action
 */

import { useState, useEffect, type KeyboardEvent, type MouseEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { triggerHaptic, HapticPattern } from '../utils/haptic';
import './ConfirmationDialog.css';

export interface ConfirmationDialogProps {
  /** Dialog title */
  title: string;
  /** Main message/question */
  message: string;
  /** Optional detailed description */
  description?: string;
  /** Confirm button label */
  confirmLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Whether this is a destructive/dangerous action */
  isDangerous?: boolean;
  /** Whether to require typing confirmation (for very destructive actions) */
  requireTextConfirmation?: boolean;
  /** Text to type for confirmation (defaults to "DELETE") */
  confirmationText?: string;
  /** Callback when confirmed */
  onConfirm: () => void | Promise<void>;
  /** Callback when cancelled */
  onCancel: () => void;
}

export function ConfirmationDialog({
  title,
  message,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDangerous = false,
  requireTextConfirmation = false,
  confirmationText = 'DELETE',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typedText, setTypedText] = useState('');
  const modalRef = useFocusTrap<HTMLDivElement>(true);

  const isConfirmationValid = !requireTextConfirmation || typedText === confirmationText;

  /**
   * Handle Escape key to cancel
   */
  useEffect(() => {
    const handleEscape = (event: Event) => {
      if ((event as globalThis.KeyboardEvent).key === 'Escape' && !isProcessing) {
        triggerHaptic(HapticPattern.LIGHT);
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isProcessing, onCancel]);

  /**
   * Handle confirmation
   */
  const handleConfirm = async () => {
    if (!isConfirmationValid || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    triggerHaptic(isDangerous ? HapticPattern.HEAVY : HapticPattern.MEDIUM);

    try {
      await onConfirm();
      // Success - dialog will be closed by parent
    } catch (err) {
      triggerHaptic(HapticPattern.ERROR);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsProcessing(false);
    }
  };

  /**
   * Handle cancellation
   */
  const handleCancel = () => {
    if (!isProcessing) {
      triggerHaptic(HapticPattern.LIGHT);
      onCancel();
    }
  };

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCancel();
    }
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close confirmation dialog"
    >
      <div
        ref={modalRef}
        className={`modal-content confirmation-dialog ${isDangerous ? 'confirmation-dialog-danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
      >
        <div className="modal-header">
          <h2 id="confirmation-dialog-title" className="confirmation-dialog-title">
            {isDangerous && <span className="danger-icon" aria-hidden="true">⚠️</span>}
            {title}
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="close-button"
            aria-label="Close dialog"
            disabled={isProcessing}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p id="confirmation-dialog-description" className="confirmation-message">
            {message}
          </p>

          {description && (
            <p className="confirmation-description">{description}</p>
          )}

          {requireTextConfirmation && (
            <div className="confirmation-input-section">
              <label htmlFor="confirmation-input" className="confirmation-label">
                Type <strong>{confirmationText}</strong> to confirm:
              </label>
              <input
                id="confirmation-input"
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                className="confirmation-input"
                placeholder={confirmationText}
                disabled={isProcessing}
                autoComplete="off"
              />
            </div>
          )}

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          <div className="dialog-actions">
            <button
              onClick={handleCancel}
              className="secondary-button"
              disabled={isProcessing}
              type="button"
            >
              {cancelLabel}
            </button>
            <button
              onClick={handleConfirm}
              className={isDangerous ? 'danger-button' : 'primary-button'}
              disabled={!isConfirmationValid || isProcessing}
              type="button"
            >
              {isProcessing ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
