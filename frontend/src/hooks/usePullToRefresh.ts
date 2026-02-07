import { useRef, useCallback, type TouchEvent } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  resistance?: number;
  enableHaptic?: boolean;
}

interface PullToRefreshState {
  isPulling: boolean;
  pullDistance: number;
}

interface PullToRefreshHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: () => void;
  state: PullToRefreshState;
}

/**
 * Custom hook for implementing pull-to-refresh gesture
 *
 * Features:
 * - Detects pull-down gesture at top of scrollable container
 * - Visual feedback with pull distance
 * - Configurable threshold and resistance
 * - Optional haptic feedback
 *
 * @param options - Configuration object with refresh callback and settings
 * @returns Touch event handlers and current pull state
 */
export function usePullToRefresh(options: PullToRefreshOptions): PullToRefreshHandlers {
  const {
    onRefresh,
    threshold = 80,
    resistance = 2.5,
    enableHaptic = true,
  } = options;

  const touchStartY = useRef<number>(0);
  const scrollTop = useRef<number>(0);
  const isPulling = useRef<boolean>(false);
  const pullDistance = useRef<number>(0);
  const isRefreshing = useRef<boolean>(false);

  /**
   * Trigger haptic feedback if supported
   */
  const triggerHaptic = useCallback(() => {
    if (enableHaptic && 'vibrate' in navigator) {
      navigator.vibrate(20);
    }
  }, [enableHaptic]);

  /**
   * Handle touch start event
   */
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const target = e.currentTarget as HTMLElement;
    scrollTop.current = target.scrollTop;
    touchStartY.current = e.touches[0].clientY;

    // Only enable pull if at the top of the scroll container
    if (scrollTop.current <= 0) {
      isPulling.current = true;
    }
  }, []);

  /**
   * Handle touch move event
   */
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current || isRefreshing.current) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // Only pull down (positive deltaY) and apply resistance
    if (deltaY > 0) {
      pullDistance.current = Math.min(deltaY / resistance, threshold * 1.5);

      // Prevent default scrolling when pulling
      if (pullDistance.current > 10) {
        e.preventDefault();
      }
    }
  }, [resistance, threshold]);

  /**
   * Handle touch end event - trigger refresh if threshold exceeded
   */
  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || isRefreshing.current) {
      isPulling.current = false;
      pullDistance.current = 0;
      return;
    }

    // Check if pull exceeded threshold
    if (pullDistance.current >= threshold) {
      isRefreshing.current = true;
      triggerHaptic();

      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        isRefreshing.current = false;
      }
    }

    // Reset state
    isPulling.current = false;
    pullDistance.current = 0;
    touchStartY.current = 0;
  }, [threshold, onRefresh, triggerHaptic]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    state: {
      isPulling: isPulling.current,
      pullDistance: pullDistance.current,
    },
  };
}
