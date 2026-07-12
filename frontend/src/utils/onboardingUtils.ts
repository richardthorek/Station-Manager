/**
 * Utility functions for Onboarding Wizard
 *
 * These functions manage the localStorage state for whether
 * the user has completed the onboarding wizard and truck checks setup.
 */

const STORAGE_KEY = 'hasCompletedOnboarding';
const TRUCK_CHECK_STORAGE_KEY = 'hasCompletedTruckCheckOnboarding';

/**
 * Check if user has completed the main onboarding
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

/**
 * Check if user has completed the truck check onboarding wizard
 */
export function hasCompletedTruckCheckOnboarding(): boolean {
  return localStorage.getItem(TRUCK_CHECK_STORAGE_KEY) === 'true';
}

/**
 * Reset the truck check onboarding flag (for testing or re-showing)
 */
export function resetTruckCheckOnboarding(): void {
  localStorage.removeItem(TRUCK_CHECK_STORAGE_KEY);
}

/**
 * Mark the truck check onboarding as completed
 */
export function markTruckCheckOnboardingComplete(): void {
  localStorage.setItem(TRUCK_CHECK_STORAGE_KEY, 'true');
}
