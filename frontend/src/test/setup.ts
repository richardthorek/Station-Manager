/**
 * Vitest Test Setup
 * 
 * This file runs before all tests to set up the testing environment.
 * Configures jsdom and extends matchers with @testing-library/jest-dom.
 */

import '@testing-library/jest-dom'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia for responsive design tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // Deprecated
    removeListener: () => {}, // Deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
} as unknown as typeof IntersectionObserver

// Mock fetch API for authentication calls
// Note: We resolve promises immediately to avoid "act(...)" warnings in tests.
// The AuthProvider's useEffect makes fetch calls on mount, and these need to
// complete synchronously in the test environment to avoid state updates outside act(...).
global.fetch = vi.fn((url) => {
  // Create immediately resolved promises for synchronous test behavior
  // Mock auth config endpoint
  if (typeof url === 'string' && url.includes('/auth/config')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ requireAuth: false }),
    } as Response)
  }
  
  // Mock auth/me endpoint
  if (typeof url === 'string' && url.includes('/auth/me')) {
    return Promise.resolve({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Not authenticated' }),
    } as Response)
  }
  
  // Default mock for other endpoints
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
}) as typeof fetch

// Suppress console errors in tests
// We suppress specific known errors that are expected in the test environment
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Suppress specific React warnings if needed
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Not implemented: HTMLFormElement.prototype.submit')
    ) {
      return
    }
    
    // Suppress act(...) warnings from AuthProvider's async initialization
    // The AuthProvider makes fetch calls in useEffect which are properly mocked,
    // but these async operations trigger act warnings in the test environment.
    // These warnings don't indicate real issues - the async behavior is intentional.
    if (
      typeof args[0] === 'string' &&
      args[0].includes('An update to') &&
      args[0].includes('inside a test was not wrapped in act')
    ) {
      return
    }
    
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
