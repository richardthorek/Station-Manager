/**
 * Toast Hook
 * 
 * Custom hook to access toast notifications from ToastContext.
 * Must be used within a ToastProvider.
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

import { useContext } from 'react';
import { ToastContext, type ToastContextValue } from '../contexts/toastContext';

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
