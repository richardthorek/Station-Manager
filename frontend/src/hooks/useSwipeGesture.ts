import { useRef, useCallback, type TouchEvent } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  enableHaptic?: boolean;
}

interface SwipeGestureHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: () => void;
}

/**
 * Custom hook for handling swipe gestures on touch devices
 *
 * Features:
 * - Detects left and right swipe gestures
 * - Configurable swipe threshold (default 50px)
 * - Optional haptic feedback (vibration)
 * - Prevents accidental swipes (minimum distance required)
 *
 * @param options - Configuration object with callbacks and settings
 * @returns Touch event handlers to attach to the element
 */
export function useSwipeGesture(options: SwipeGestureOptions): SwipeGestureHandlers {
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
    enableHaptic = true,
  } = options;

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);

  /**
   * Trigger haptic feedback if supported
   */
  const triggerHaptic = useCallback(() => {
    if (enableHaptic && 'vibrate' in navigator) {
      // Short vibration (10ms) for subtle feedback
      navigator.vibrate(10);
    }
  }, [enableHaptic]);

  /**
   * Handle touch start event
   */
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  /**
   * Handle touch move event
   */
  const handleTouchMove = useCallback((e: TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  }, []);

  /**
   * Handle touch end event - determine if swipe occurred
   */
  const handleTouchEnd = useCallback(() => {
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = touchEndY.current - touchStartY.current;

    // Check if horizontal swipe (more horizontal than vertical movement)
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);

    // Only process if horizontal swipe and exceeds threshold
    if (isHorizontalSwipe && Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && onSwipeRight) {
        // Swipe right
        triggerHaptic();
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        // Swipe left
        triggerHaptic();
        onSwipeLeft();
      }
    }

    // Reset values
    touchStartX.current = 0;
    touchStartY.current = 0;
    touchEndX.current = 0;
    touchEndY.current = 0;
  }, [threshold, onSwipeLeft, onSwipeRight, triggerHaptic]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}
