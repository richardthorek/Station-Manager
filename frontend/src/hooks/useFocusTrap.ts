/**
 * Focus Trap Hook
 * 
 * Traps focus within a container (e.g., modal dialog) for keyboard accessibility.
 * - Focus cycles between focusable elements
 * - Tab/Shift+Tab wraps around
 * - Returns focus to trigger element on unmount
 * 
 * Usage:
 * ```tsx
 * const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
 * return <div ref={modalRef} role="dialog">...</div>
 * ```
 */

import { useEffect, useRef } from 'react';

const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]'
].join(', ');

export function useFocusTrap<T extends HTMLElement>(isActive: boolean) {
  const containerRef = useRef<T>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Save currently focused element
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    // Get all focusable elements within container
    const getFocusableElements = (): HTMLElement[] => {
      if (!containerRef.current) return [];
      return Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS)
      );
    };

    // Focus first element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Handle Tab key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: focus last if on first
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: focus first if on last
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup: restore focus
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isActive]);

  return containerRef;
}
