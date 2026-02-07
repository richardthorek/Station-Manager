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
    expect(screen.getByText('Digital management tools for fire stations')).toBeInTheDocument()
  })

  it('displays welcome section', () => {
    render(<LandingPage />)

    expect(screen.getByText('Welcome to Station Manager')).toBeInTheDocument()
    expect(screen.getByText(/A modern, real-time digital management system/i)).toBeInTheDocument()
  })

  it('displays theme toggle button', () => {
    render(<LandingPage />)

    // Updated: aria-label now includes the current theme mode
    const themeToggle = screen.getByRole('button', { name: /switch to (dark|light) mode/i })
    expect(themeToggle).toBeInTheDocument()
  })

  it('has navigation links to features', () => {
    render(<LandingPage />)

    // Check for Sign-In link
    const signInLink = screen.getByRole('link', { name: /go to sign-in/i })
    expect(signInLink).toHaveAttribute('href', '/signin')

    // Check for Truck Checks link
    const truckCheckLink = screen.getByRole('link', { name: /go to truck checks/i })
    expect(truckCheckLink).toHaveAttribute('href', '/truckcheck')
  })

  it('displays all feature cards and they are accessible', () => {
    render(<LandingPage />)

    // Verify all main feature cards are present
    expect(screen.getByText('Station Sign-In')).toBeInTheDocument()
    expect(screen.getByText('Truck Check')).toBeInTheDocument()
    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument()
    expect(screen.getByText('Station Management')).toBeInTheDocument()

    // Verify info cards are present
    expect(screen.getByText('Multi-Device Support')).toBeInTheDocument()
    expect(screen.getByText('Real-Time Sync')).toBeInTheDocument()
    expect(screen.getByText('Professional Branding')).toBeInTheDocument()

    // Verify all clickable links are accessible
    expect(screen.getByRole('link', { name: /go to sign-in/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to truck checks/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to reports/i })).toBeInTheDocument()
  })
})
