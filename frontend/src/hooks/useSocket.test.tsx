/**
 * useSocket Hook Tests
 * 
 * Tests for the custom Socket.io hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSocket } from './useSocket'
import { io } from 'socket.io-client'
import { StationProvider } from '../contexts/StationContext'
import type { ReactNode } from 'react'

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  }

  return {
    io: vi.fn(() => mockSocket),
  }
})

// Mock the API module required by StationProvider
vi.mock('../services/api', () => ({
  api: {
    getStations: vi.fn().mockResolvedValue([]),
  },
  setCurrentStationId: vi.fn(),
  getCurrentStationId: vi.fn(() => 'default-station'),
}))

describe('useSocket', () => {
  // Wrapper component to provide StationProvider context
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StationProvider>{children}</StationProvider>
  )

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('initializes socket connection', () => {
    renderHook(() => useSocket(), { wrapper })

    expect(io).toHaveBeenCalled()
  })

  it('returns isConnected status', async () => {
    const { result } = renderHook(() => useSocket(), { wrapper })

    // Initially may be disconnected, but should connect
    await waitFor(() => {
      expect(result.current).toHaveProperty('isConnected')
    })
  })

  it('provides emit function', () => {
    const { result } = renderHook(() => useSocket(), { wrapper })

    expect(result.current.emit).toBeDefined()
    expect(typeof result.current.emit).toBe('function')
  })

  it('provides on function', () => {
    const { result } = renderHook(() => useSocket(), { wrapper })

    expect(result.current.on).toBeDefined()
    expect(typeof result.current.on).toBe('function')
  })

  it('provides off function', () => {
    const { result } = renderHook(() => useSocket(), { wrapper })

    expect(result.current.off).toBeDefined()
    expect(typeof result.current.off).toBe('function')
  })

  it('cleans up socket connection on unmount', () => {
    const { unmount } = renderHook(() => useSocket(), { wrapper })

    const mockSocketInstance = (io as ReturnType<typeof vi.fn>).mock.results[0].value
    
    unmount()

    expect(mockSocketInstance.disconnect).toHaveBeenCalled()
  })

  it('can emit events', () => {
    const { result } = renderHook(() => useSocket(), { wrapper })

    const mockSocketInstance = (io as ReturnType<typeof vi.fn>).mock.results[0].value

    result.current.emit('test-event', { data: 'test' })

    expect(mockSocketInstance.emit).toHaveBeenCalledWith('test-event', { data: 'test' })
  })

  it('can register event listeners', () => {
    const { result } = renderHook(() => useSocket(), { wrapper })

    const mockSocketInstance = (io as ReturnType<typeof vi.fn>).mock.results[0].value
    const callback = vi.fn()

    result.current.on('test-event', callback)

    expect(mockSocketInstance.on).toHaveBeenCalledWith('test-event', callback)
  })

  it('can unregister event listeners', () => {
    const { result } = renderHook(() => useSocket(), { wrapper })

    const mockSocketInstance = (io as ReturnType<typeof vi.fn>).mock.results[0].value
    const callback = vi.fn()

    result.current.off('test-event', callback)

    expect(mockSocketInstance.off).toHaveBeenCalledWith('test-event', callback)
  })
})
