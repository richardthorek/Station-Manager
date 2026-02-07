/**
 * Toast Context Definition
 * 
 * Defines the toast notification context and its type.
 * Separated from ToastProvider to satisfy React Fast Refresh requirements.
 */

import { createContext } from 'react';
import type { ToastMessage, ToastType } from '../components/Toast';

export interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType, options?: Partial<ToastMessage>) => string;
  showSuccess: (message: string, options?: Partial<ToastMessage>) => string;
  showError: (message: string, options?: Partial<ToastMessage>) => string;
  showWarning: (message: string, options?: Partial<ToastMessage>) => string;
  showInfo: (message: string, options?: Partial<ToastMessage>) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
