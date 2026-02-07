/**
 * Toast Context and Hook
 * 
 * Provides global toast notification management with:
 * - Add/remove toasts from anywhere in the app
 * - Automatic ID generation
 * - Queue management
 * - Type-safe toast creation helpers
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ToastContainer } from '../components/Toast';
import type { ToastMessage, ToastType } from '../components/Toast';

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType, options?: Partial<ToastMessage>) => string;
  showSuccess: (message: string, options?: Partial<ToastMessage>) => string;
  showError: (message: string, options?: Partial<ToastMessage>) => string;
  showWarning: (message: string, options?: Partial<ToastMessage>) => string;
  showInfo: (message: string, options?: Partial<ToastMessage>) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

function generateToastId(): string {
  return `toast-${Date.now()}-${++toastIdCounter}`;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', options?: Partial<ToastMessage>): string => {
      const id = generateToastId();
      const toast: ToastMessage = {
        id,
        type,
        message,
        duration: 5000, // Default 5 seconds
        ...options,
      };

      setToasts((prev) => [...prev, toast]);
      return id;
    },
    []
  );

  const showSuccess = useCallback(
    (message: string, options?: Partial<ToastMessage>): string => {
      return showToast(message, 'success', { duration: 3000, ...options });
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string, options?: Partial<ToastMessage>): string => {
      return showToast(message, 'error', { duration: 7000, ...options });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, options?: Partial<ToastMessage>): string => {
      return showToast(message, 'warning', { duration: 5000, ...options });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, options?: Partial<ToastMessage>): string => {
      return showToast(message, 'info', { duration: 4000, ...options });
    },
    [showToast]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const value: ToastContextValue = {
    toasts,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismissToast,
    dismissAll,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

/**
 * Hook to access toast notifications
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { showSuccess, showError } = useToast();
 *   
 *   const handleSave = async () => {
 *     try {
 *       await api.save();
 *       showSuccess('Changes saved successfully!');
 *     } catch (error) {
 *       showError('Failed to save changes. Please try again.');
 *     }
 *   };
 * }
 * ```
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
