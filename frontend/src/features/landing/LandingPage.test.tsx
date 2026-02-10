/**
 * LandingPage Tests
 * 
 * Tests for the main landing page with feature navigation.
 */

import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '../../test/utils/test-utils'
import { LandingPage } from './LandingPage'

// Mock the useTheme hook
vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}))

describe('LandingPage', () => {
  it('renders the landing page', () => {
    render(<LandingPage />)

    expect(screen.getByText('Station Manager')).toBeInTheDocument()
    // Verify the main heading is present (text may vary)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('displays header with branding', () => {
    render(<LandingPage />)

    // Verify brand name is present
    expect(screen.getByText('Station ManagerP')).toBeInTheDocument()
  })

  it('displays theme toggle button', () => {
    render(<LandingPage />)

    // Updated: aria-label now includes the current theme mode
    const themeToggle = screen.getByRole('button', { name: /switch to (dark|light) mode/i })
    expect(themeToggle).toBeInTheDocument()
  })

  it('has navigation link to sign-in (MVP feature)', () => {
    render(<LandingPage />)

    // Check for Sign-In link (MVP feature - enabled)
    const signInLink = screen.getByRole('link', { name: /go to sign-in/i })
    expect(signInLink).toHaveAttribute('href', '/signin')
  })

  it('displays all feature cards with coming soon for non-MVP features', () => {
    render(<LandingPage />)

    // Verify all main feature cards are present
    expect(screen.getByText('Station Sign-In')).toBeInTheDocument()
    expect(screen.getByText('Truck Check')).toBeInTheDocument()
    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument()
    expect(screen.getByText('Station Management')).toBeInTheDocument()

    // Verify sign-in link is accessible (MVP feature)
    expect(screen.getByRole('link', { name: /go to sign-in/i })).toBeInTheDocument()
    
    // Verify non-MVP features have disabled buttons with coming soon message
    const truckCheckButton = screen.getByRole('button', { name: /truck checks coming soon/i })
    expect(truckCheckButton).toBeDisabled()
    
    const reportsButton = screen.getByRole('button', { name: /reports and analytics coming soon/i })
    expect(reportsButton).toBeDisabled()
    
    // Verify "Coming in v1.1" badges are present
    const comingSoonBadges = screen.getAllByText('Coming in v1.1')
    expect(comingSoonBadges).toHaveLength(2) // Truck Check and Reports
  })
})
