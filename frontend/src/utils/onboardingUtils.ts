/**
 * Utility functions for Onboarding Wizard
 *
 * These functions manage the localStorage state for whether
 * the user has completed the onboarding wizard.
 */

const STORAGE_KEY = 'hasCompletedOnboarding';

/**
 * Check if user has completed the onboarding
 */
export function hasCompletedOnboarding(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Reset the onboarding flag (for testing or re-showing)
 */
export function resetOnboarding(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Mark the onboarding as completed
 */
export function markOnboardingComplete(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
}
