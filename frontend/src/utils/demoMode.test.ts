/**
 * demoMode util tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDemoActive, activateDemo, exitDemo } from './demoMode';

describe('demoMode', () => {
  beforeEach(() => {
    sessionStorage.clear();
    // Reset the URL to a clean path with no query string.
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('is inactive with no URL param and no persisted flag', () => {
    expect(isDemoActive()).toBe(false);
  });

  it('is active when ?demo=true is in the URL', () => {
    window.history.replaceState({}, '', '/?demo=true');
    expect(isDemoActive()).toBe(true);
  });

  it('persists across navigation once activated', () => {
    activateDemo();
    // Even after the query param is gone, the session flag keeps it active.
    window.history.replaceState({}, '', '/signin');
    expect(isDemoActive()).toBe(true);
  });

  it('clears on exitDemo', () => {
    activateDemo();
    exitDemo();
    expect(isDemoActive()).toBe(false);
  });
});
