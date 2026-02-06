/**
 * Header Component Tests
 * 
 * Tests for the main application header component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../test/utils/test-utils'
import { Header } from './Header'
import { StationProvider } from '../contexts/StationContext'
import type { Station } from '../types'

// Mock the useTheme hook
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}))

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getStations: vi.fn(),
  },
  setCurrentStationId: vi.fn(),
  getCurrentStationId: vi.fn(() => 'default-station'),
}))

import { api } from '../services/api'

const mockStations: Station[] = [
  {
    id: 'default-station',
    name: 'Test Station',
    brigadeId: 'test-brigade',
    brigadeName: 'Test Brigade',
    hierarchy: {
      jurisdiction: 'NSW',
      area: 'Test Area',
      district: 'Test District',
      brigade: 'Test Brigade',
      station: 'Test Station',
    },
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getStations).mockResolvedValue(mockStations)
  })

  const renderWithProvider = (props: React.ComponentProps<typeof Header>) => {
    return render(
      <StationProvider>
        <Header {...props} />
      </StationProvider>
    )
  }

  it('renders the header', async () => {
    renderWithProvider({ isConnected: true })

    expect(screen.getByText('Station Manager')).toBeInTheDocument()
    expect(screen.getByText('🚒')).toBeInTheDocument()
    
    // Wait for station selector to load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select station/i })).toBeInTheDocument()
    })
  })

  it('shows connected status when connected', async () => {
    renderWithProvider({ isConnected: true })

    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('shows disconnected status when not connected', async () => {
    renderWithProvider({ isConnected: false })

    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('shows database warning when using in-memory database', async () => {
    renderWithProvider({
      isConnected: true,
      databaseStatus: {
        databaseType: 'in-memory',
        usingInMemory: true,
      },
    })

    expect(screen.getByText('Memory Only')).toBeInTheDocument()
  })

  it('does not show database warning when using persistent database', async () => {
    renderWithProvider({
      isConnected: true,
      databaseStatus: {
        databaseType: 'table-storage',
        usingInMemory: false,
      },
    })

    expect(screen.queryByText('Memory Only')).not.toBeInTheDocument()
  })

  it('renders theme toggle button', async () => {
    renderWithProvider({ isConnected: true })

    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
  })

  it('does not render admin menu when no callbacks provided', async () => {
    renderWithProvider({ isConnected: true })

    expect(screen.queryByLabelText('Admin menu')).not.toBeInTheDocument()
  })

  it('renders admin menu button when callbacks provided', async () => {
    const onManageUsers = vi.fn()
    const onExportData = vi.fn()
    const onAddActivityType = vi.fn()

    renderWithProvider({
      isConnected: true,
      onManageUsers,
      onExportData,
      onAddActivityType,
    })

    expect(screen.getByLabelText('Admin menu')).toBeInTheDocument()
  })

  it('opens and closes admin menu on button click', async () => {
    const onManageUsers = vi.fn()
    const user = userEvent.setup()
    
    renderWithProvider({
      isConnected: true,
      onManageUsers,
    })

    const menuButton = screen.getByLabelText('Admin menu')
    
    // Initially, menu items should not be visible
    expect(screen.queryByText('Manage Users')).not.toBeInTheDocument()

    // Click to open menu
    await user.click(menuButton)
    
    // Menu items should now be visible
    expect(screen.getByText('Manage Users')).toBeInTheDocument()

    // Click to close menu
    await user.click(menuButton)
    
    // Menu items should be hidden again
    await waitFor(() => {
      expect(screen.queryByText('Manage Users')).not.toBeInTheDocument()
    })
  })

  it('calls onManageUsers when menu item clicked', async () => {
    const onManageUsers = vi.fn()
    const user = userEvent.setup()
    
    renderWithProvider({
      isConnected: true,
      onManageUsers,
    })

    // Open menu
    await user.click(screen.getByLabelText('Admin menu'))
    
    // Click menu item
    await user.click(screen.getByText('Manage Users'))
    
    expect(onManageUsers).toHaveBeenCalledTimes(1)
  })

  it('closes menu when clicking outside', async () => {
    const onManageUsers = vi.fn()
    const user = userEvent.setup()
    
    renderWithProvider({
      isConnected: true,
      onManageUsers,
    })

    // Open menu
    await user.click(screen.getByLabelText('Admin menu'))
    expect(screen.getByText('Manage Users')).toBeInTheDocument()

    // Click outside (on the header itself)
    await user.click(screen.getByText('Station Manager'))
    
    // Menu should close
    await waitFor(() => {
      expect(screen.queryByText('Manage Users')).not.toBeInTheDocument()
    })
  })

  it('closes menu when pressing Escape key', async () => {
    const onManageUsers = vi.fn()
    const user = userEvent.setup()
    
    renderWithProvider({
      isConnected: true,
      onManageUsers,
    })

    // Open menu
    await user.click(screen.getByLabelText('Admin menu'))
    expect(screen.getByText('Manage Users')).toBeInTheDocument()

    // Press Escape
    await user.keyboard('{Escape}')
    
    // Menu should close
    await waitFor(() => {
      expect(screen.queryByText('Manage Users')).not.toBeInTheDocument()
    })
  })
})
