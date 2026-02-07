/**
 * Haptic Feedback Utility
 *
 * Provides consistent haptic feedback across the application.
 * Uses the Vibration API (supported on iOS Safari, Chrome Android, etc.)
 *
 * Browser Support:
 * - ✅ Chrome Android 32+
 * - ✅ Edge Android 79+
 * - ✅ Safari iOS 13+ (requires user gesture)
 * - ❌ Desktop browsers (silently ignored)
 */

/**
 * Haptic feedback patterns
 */
export const HapticPattern = {
  /** Light tap - For button presses, toggles */
  LIGHT: 10,

  /** Medium tap - For FAB presses, swipe actions */
  MEDIUM: 30,

  /** Heavy tap - For important actions, confirmations */
  HEAVY: 50,

  /** Success pattern - For successful operations */
  SUCCESS: [10, 50, 10, 50],

  /** Error pattern - For errors, failures */
  ERROR: [50, 100, 50],

  /** Selection pattern - For selecting items */
  SELECTION: [5, 25],
} as const;

/**
 * Trigger haptic feedback
 *
 * @param pattern - Vibration pattern (number in ms or array of patterns)
 * @returns true if vibration was triggered, false if not supported or failed
 *
 * @example
 * ```ts
 * // Light tap
 * triggerHaptic(HapticPattern.LIGHT);
 *
 * // Medium tap for FAB
 * triggerHaptic(HapticPattern.MEDIUM);
 *
 * // Success pattern
 * triggerHaptic(HapticPattern.SUCCESS);
 *
 * // Custom pattern
 * triggerHaptic([10, 50, 10]);
 * ```
 */
export function triggerHaptic(
  pattern: number | readonly number[] = HapticPattern.MEDIUM
): boolean {
  if (!('vibrate' in navigator)) {
    return false;
  }

  try {
    // Convert readonly array to regular array for vibrate API
    const vibratePattern = Array.isArray(pattern) ? [...pattern] : pattern;
    return navigator.vibrate(vibratePattern);
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
    return false;
  }
}

/**
 * Cancel ongoing vibration
 */
export function cancelHaptic(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(0);
  }
}

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return 'vibrate' in navigator;
}

/**
 * React hook for haptic feedback
 *
 * @param enabled - Whether haptic feedback is enabled (default: true)
 * @returns Object with haptic functions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { vibrate, vibrateSuccess } = useHaptic();
 *
 *   return (
 *     <button onClick={() => vibrate(HapticPattern.MEDIUM)}>
 *       Click me
 *     </button>
 *   );
 * }
 * ```
 */
export function useHaptic(enabled = true) {
  const vibrate = (pattern: number | readonly number[] = HapticPattern.MEDIUM) => {
    if (enabled) {
      triggerHaptic(pattern);
    }
  };

  return {
    /** Trigger haptic with custom pattern */
    vibrate,
    /** Light tap haptic */
    vibrateLight: () => vibrate(HapticPattern.LIGHT),
    /** Medium tap haptic */
    vibrateMedium: () => vibrate(HapticPattern.MEDIUM),
    /** Heavy tap haptic */
    vibrateHeavy: () => vibrate(HapticPattern.HEAVY),
    /** Success pattern haptic */
    vibrateSuccess: () => vibrate(HapticPattern.SUCCESS),
    /** Error pattern haptic */
    vibrateError: () => vibrate(HapticPattern.ERROR),
    /** Selection pattern haptic */
    vibrateSelection: () => vibrate(HapticPattern.SELECTION),
    /** Cancel ongoing vibration */
    cancel: cancelHaptic,
    /** Check if supported */
    isSupported: isHapticSupported(),
  };
}
