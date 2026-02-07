/**
 * Toast Notification Component
 * 
 * Displays temporary notifications for success, error, info, and warning messages.
 * Auto-dismisses after a configurable duration with animations using Framer Motion.
 * 
 * Features:
 * - Multiple notification types (success, error, info, warning)
 * - Auto-dismiss with configurable duration
 * - Manual dismiss with close button
 * - Stacked notifications with proper z-index
 * - Keyboard accessible (Escape to close)
 * - ARIA live regions for screen readers
 * - Haptic feedback on mobile
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic, HapticPattern } from '../utils/haptic';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // in milliseconds, 0 = no auto-dismiss
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

/**
 * Single toast notification
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const { id, type, message, duration = 5000, action } = toast;

  // Auto-dismiss after duration
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, onDismiss]);

  // Haptic feedback on mount
  useEffect(() => {
    if (type === 'error') {
      triggerHaptic(HapticPattern.ERROR);
    } else if (type === 'success') {
      triggerHaptic(HapticPattern.SUCCESS);
    } else {
      triggerHaptic(HapticPattern.LIGHT);
    }
  }, [type]);

  const handleDismiss = () => {
    triggerHaptic(HapticPattern.LIGHT);
    onDismiss(id);
  };

  const handleActionClick = () => {
    if (action?.onClick) {
      triggerHaptic(HapticPattern.MEDIUM);
      action.onClick();
      onDismiss(id);
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  };

  const getAriaRole = () => {
    return type === 'error' || type === 'warning' ? 'alert' : 'status';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`toast toast-${type}`}
      role={getAriaRole()}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="toast-content">
        <span className="toast-icon" aria-hidden="true">
          {getIcon()}
        </span>
        <span className="toast-message">{message}</span>
      </div>

      <div className="toast-actions">
        {action && (
          <button
            onClick={handleActionClick}
            className="toast-action-button"
            type="button"
          >
            {action.label}
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="toast-close-button"
          aria-label="Dismiss notification"
          type="button"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

/**
 * Container for all toast notifications
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  // Handle escape key to dismiss top toast
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && toasts.length > 0) {
        onDismiss(toasts[toasts.length - 1].id);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [toasts, onDismiss]);

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
