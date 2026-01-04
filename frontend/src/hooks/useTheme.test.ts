/**
 * useTheme Hook Tests
 * 
 * Tests for the custom theme hook.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Reset document theme attribute
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('initializes with light theme by default', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')
  })

  it('applies theme to document', () => {
    renderHook(() => useTheme())

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('toggles theme from light to dark', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('toggles theme from dark to light', () => {
    // Set initial theme to dark
    localStorage.setItem('rfs-theme-preference', 'dark')
    
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('light')
  })

  it('saves theme preference to localStorage', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(localStorage.getItem('rfs-theme-preference')).toBe('dark')
  })

  it('loads theme preference from localStorage', () => {
    localStorage.setItem('rfs-theme-preference', 'dark')

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
  })

  it('sets theme preference directly', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setThemePreference('dark')
    })

    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem('rfs-theme-preference')).toBe('dark')
  })

  it('provides system theme', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.systemTheme).toBeDefined()
    expect(['light', 'dark']).toContain(result.current.systemTheme)
  })

  it('can use system theme', () => {
    // Set a custom theme first
    localStorage.setItem('rfs-theme-preference', 'dark')
    
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')

    act(() => {
      result.current.useSystemTheme()
    })

    // Should switch to system theme
    expect(result.current.theme).toBe(result.current.systemTheme)
    // Should remove localStorage preference
    expect(localStorage.getItem('rfs-theme-preference')).toBeNull()
  })
})
