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
global.fetch = vi.fn((url) => {
  // Mock auth config endpoint
  if (typeof url === 'string' && url.includes('/auth/config')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ requireAuth: false }),
    } as Response)
  }
  
  // Mock auth/me endpoint
  if (typeof url === 'string' && url.includes('/auth/me')) {
    return Promise.resolve({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Not authenticated' }),
    } as Response)
  }
  
  // Default mock for other endpoints
  return Promise.resolve({
    ok: true,
    json: async () => ({}),
  } as Response)
}) as typeof fetch

// Suppress console errors in tests (optional - can be removed if you want to see all errors)
// Only suppress specific known errors
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
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
