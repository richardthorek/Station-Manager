/**
 * LandingPage Tests
 * 
 * Tests for the main landing page with feature navigation.
 */

import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

    const themeToggle = screen.getByLabelText('Toggle theme')
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
})
