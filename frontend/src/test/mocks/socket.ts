/**
 * Mock Socket.io Client
 * 
 * Provides a mock implementation of Socket.io for testing components
 * that use the useSocket hook.
 */

import { vi } from 'vitest'

export interface MockSocket {
  connect: () => void
  disconnect: () => void
  on: (event: string, callback: (...args: any[]) => void) => void
  off: (event: string, callback?: (...args: any[]) => void) => void
  emit: (event: string, data?: any) => void
  connected: boolean
  id: string
}

// Create a mock socket instance
export const createMockSocket = (options: { connected?: boolean } = {}): MockSocket => {
  const eventListeners = new Map<string, Set<(...args: any[]) => void>>()
  
  const mockSocket: MockSocket = {
    connected: options.connected ?? true,
    id: 'mock-socket-id',
    
    connect: vi.fn(),
    
    disconnect: vi.fn(),
    
    on: vi.fn((event: string, callback: (...args: any[]) => void) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set())
      }
      eventListeners.get(event)!.add(callback)
    }),
    
    off: vi.fn((event: string, callback?: (...args: any[]) => void) => {
      if (!eventListeners.has(event)) return
      
      if (callback) {
        eventListeners.get(event)!.delete(callback)
      } else {
        eventListeners.delete(event)
      }
    }),
    
    emit: vi.fn((event: string, data?: any) => {
      // Simulate server response for certain events
      // This can be expanded as needed
    }),
  }
  
  // Helper method to trigger events (for testing)
  ;(mockSocket as any).triggerEvent = (event: string, ...args: any[]) => {
    const listeners = eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => callback(...args))
    }
  }
  
  return mockSocket
}

// Mock the io function from socket.io-client
export const mockIo = vi.fn(() => createMockSocket())

// Mock the entire socket.io-client module
vi.mock('socket.io-client', () => ({
  io: mockIo,
}))
