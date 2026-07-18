/**
 * useTheme Hook Tests
 *
 * Tests for the custom theme hook.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

/** Swaps the global matchMedia mock (set up in test/setup.ts) so a test can
 * simulate a specific OS theme, and capture the registered change listener
 * so a test can simulate the OS flipping theme live. */
function mockMatchMedia(initialMatches: boolean) {
  let changeListener: ((e: MediaQueryListEvent) => void) | undefined
  let matches = initialMatches

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() { return matches },
    media: query,
    onchange: null,
    addEventListener: (_event: string, listener: (e: MediaQueryListEvent) => void) => {
      changeListener = listener
    },
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))

  return {
    fireChange: (newMatches: boolean) => {
      matches = newMatches
      changeListener?.({ matches: newMatches } as MediaQueryListEvent)
    },
  }
}

describe('useTheme', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    window.matchMedia = originalMatchMedia
  })

  it('follows the system theme when no preference is stored', () => {
    mockMatchMedia(true) // OS is dark

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('defaults to light when the system is light and nothing is stored', () => {
    mockMatchMedia(false)

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')
  })

  it('live-updates when the OS theme changes and no explicit preference is stored', () => {
    const media = mockMatchMedia(false)

    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')

    act(() => {
      media.fireChange(true)
    })

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('toggles theme from light to dark', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('toggles theme from dark to light', () => {
    localStorage.setItem('rfs-theme-preference', 'dark')
    mockMatchMedia(false)

    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('light')
  })

  it('saves an explicit toggle to localStorage', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(localStorage.getItem('rfs-theme-preference')).toBe('dark')
  })

  it('an explicit stored preference overrides the system theme', () => {
    localStorage.setItem('rfs-theme-preference', 'dark')
    mockMatchMedia(false) // OS is light, but the stored override wins

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
  })

  it('a stored override stops following further OS changes', () => {
    localStorage.setItem('rfs-theme-preference', 'light')
    const media = mockMatchMedia(false)

    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')

    act(() => {
      media.fireChange(true) // OS flips to dark
    })

    // Explicit override still wins.
    expect(result.current.theme).toBe('light')
  })
})
