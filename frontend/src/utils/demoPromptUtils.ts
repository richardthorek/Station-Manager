/**
 * Utility functions for Demo Landing Prompt
 * 
 * These functions manage the localStorage state for whether
 * the user has seen the demo prompt on first visit.
 */

const STORAGE_KEY = 'hasSeenDemoPrompt';

/**
 * Check if user has seen the demo prompt
 */
export function hasSeenDemoPrompt(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Reset the demo prompt flag (for testing)
 */
export function resetDemoPrompt(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Mark the demo prompt as seen
 */
export function markDemoPromptAsSeen(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
}
