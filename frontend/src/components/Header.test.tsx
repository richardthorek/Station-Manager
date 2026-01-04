/**
 * Header Component Tests
 * 
 * Tests for the main application header component.
 */

import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '../test/utils/test-utils'
import { Header } from './Header'

// Mock the useTheme hook
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}))

describe('Header', () => {
  it('renders the header', () => {
    render(<Header isConnected={true} />)

    expect(screen.getByText('Station Manager')).toBeInTheDocument()
    expect(screen.getByText('🚒')).toBeInTheDocument()
  })

  it('shows connected status when connected', () => {
    render(<Header isConnected={true} />)

    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('shows disconnected status when not connected', () => {
    render(<Header isConnected={false} />)

    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('shows database warning when using in-memory database', () => {
    render(
      <Header
        isConnected={true}
        databaseStatus={{
          databaseType: 'in-memory',
          usingInMemory: true,
        }}
      />
    )

    expect(screen.getByText('Memory Only')).toBeInTheDocument()
  })

  it('does not show database warning when using persistent database', () => {
    render(
      <Header
        isConnected={true}
        databaseStatus={{
          databaseType: 'table-storage',
          usingInMemory: false,
        }}
      />
    )

    expect(screen.queryByText('Memory Only')).not.toBeInTheDocument()
  })

  it('renders theme toggle button', () => {
    render(<Header isConnected={true} />)

    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
  })
})
