/**
 * LandingPage Tests
 * 
 * Tests for the main landing page with feature navigation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '../../test/utils/test-utils'
import { LandingPage } from './LandingPage'
import type { EntitlementFeature } from '../../contexts/AuthContext'

// Mock the useTheme hook
vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}))

// Controllable auth context. Default mirrors the real "no org context"
// (single-tenant / kiosk back-compat) state so the existing un-gated
// expectations hold; individual tests override it to exercise entitlement
// gating on the app-picker cards.
type AuthOverrides = {
  entitlements: Record<string, boolean> | null
  hasFeature: (f: EntitlementFeature) => boolean
}
const defaultAuth: AuthOverrides = {
  entitlements: null,
  hasFeature: () => true,
}
let authState: AuthOverrides = { ...defaultAuth }

vi.mock('../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/AuthContext')>()
  return {
    ...actual,
    useAuth: () => ({
      isAuthenticated: false,
      user: null,
      logout: vi.fn(),
      requireAuth: false,
      entitlements: authState.entitlements,
      hasFeature: authState.hasFeature,
    }),
  }
})

afterEach(() => {
  authState = { ...defaultAuth }
})

describe('LandingPage', () => {
  it('renders the landing page', () => {
    render(<LandingPage />)

    expect(screen.getByText('StationKit')).toBeInTheDocument()
    // Verify the main heading is present (text may vary)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('displays header with branding', () => {
    render(<LandingPage />)

    // Verify brand name is present
    expect(screen.getByText('StationKit')).toBeInTheDocument()
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

  it('displays all feature cards as active (v1.1)', () => {
    render(<LandingPage />)

    // Verify all main feature cards are present
    expect(screen.getByText('Station Sign-In')).toBeInTheDocument()
    expect(screen.getByText('Vehicle Check')).toBeInTheDocument()
    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument()
    expect(screen.getByText('Station Management')).toBeInTheDocument()

    // Verify all feature links are active and route correctly (v1.1 un-gated)
    expect(screen.getByRole('link', { name: /go to sign-in/i })).toHaveAttribute('href', '/signin')
    expect(screen.getByRole('link', { name: /go to vehicle check/i })).toHaveAttribute('href', '/truckcheck')
    expect(screen.getByRole('link', { name: /go to reports/i })).toHaveAttribute('href', '/reports')

    // Verify the "Coming in v1.1" gating has been removed entirely
    expect(screen.queryByText('Coming in v1.1')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /coming soon/i })).not.toBeInTheDocument()
  })

  it('renders the suite sibling-app launcher cards', () => {
    render(<LandingPage />)

    // StationKit suite apps appear on the launcher.
    expect(screen.getByText('Fire Santa Run')).toBeInTheDocument()
    expect(screen.getByText('Fire Break Calculator')).toBeInTheDocument()
    // The seasonal badge surfaces on Fire Santa Run.
    expect(screen.getByText('Seasonal')).toBeInTheDocument()
  })

  it('links sibling apps externally when entitlements are absent (back-compat)', () => {
    render(<LandingPage />)

    // With no org/entitlement context the launcher leaves sibling apps unlocked
    // (single-tenant / kiosk back-compat) and links out to them.
    const santaLink = screen.getByRole('link', { name: /open fire santa run/i })
    expect(santaLink).toHaveAttribute('target', '_blank')
    expect(santaLink).toHaveAttribute('href', expect.stringMatching(/santa/i))
  })

  it('gates a core module card with a lock affordance when the org lacks the feature', () => {
    // Org present but Reports not entitled — the Reports card should show the
    // same "Not in your plan" lock prompt as the AAR Studio / suite cards
    // instead of a live "Go to Reports" link.
    authState = {
      entitlements: { signInEnabled: true, truckCheckEnabled: true, reportsEnabled: false },
      hasFeature: (f) => f !== 'reportsEnabled',
    }
    render(<LandingPage />)

    // The active Reports link is gone…
    expect(screen.queryByRole('link', { name: /go to reports/i })).not.toBeInTheDocument()
    // …replaced by an upgrade prompt that routes to the plan page.
    const lockedLink = screen.getByRole('link', {
      name: /reports & analytics is not included in your plan/i,
    })
    expect(lockedLink).toHaveAttribute('href', '/admin/organization')

    // Entitled modules keep their live links.
    expect(screen.getByRole('link', { name: /go to sign-in/i })).toHaveAttribute('href', '/signin')
    expect(screen.getByRole('link', { name: /go to vehicle check/i })).toHaveAttribute('href', '/truckcheck')
  })
})
