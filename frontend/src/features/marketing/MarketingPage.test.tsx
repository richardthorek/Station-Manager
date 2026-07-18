/**
 * MarketingPage Tests
 *
 * Verifies the logged-out front door: branding, plan tiers, sign-up CTAs,
 * and the monthly/annual price toggle.
 */

import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { render } from '../../test/utils/test-utils'
import { MarketingPage } from './MarketingPage'

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}))

describe('MarketingPage', () => {
  it('renders the StationKit hero and brand', () => {
    render(<MarketingPage />)
    // The header wordmark is split across two spans (two-tone "Station"/"Kit"
    // lockup), so a plain string match won't see it — match on full text content.
    expect(screen.getAllByText((_, element) => element?.textContent === 'StationKit').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('shows all three plan tiers plus the suite waitlist', () => {
    render(<MarketingPage />)
    expect(screen.getByRole('heading', { name: 'Community' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Basic' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI Pro' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Complete Kit' })).toBeInTheDocument()
  })

  it('defaults to monthly pricing and points paid CTAs at sign-up with the plan', () => {
    render(<MarketingPage />)
    expect(screen.getByText('A$10')).toBeInTheDocument()
    expect(screen.getByText('A$19')).toBeInTheDocument()

    const basicCta = screen.getByRole('link', { name: /get basic/i })
    expect(basicCta).toHaveAttribute('href', '/signup?plan=basic&interval=monthly')
  })

  it('switches to annual pricing when the toggle is used', () => {
    render(<MarketingPage />)
    fireEvent.click(screen.getByRole('button', { name: /annual/i }))

    expect(screen.getByText('A$100')).toBeInTheDocument()
    expect(screen.getByText('A$190')).toBeInTheDocument()

    const aiCta = screen.getByRole('link', { name: /get ai pro/i })
    expect(aiCta).toHaveAttribute('href', '/signup?plan=ai&interval=annual')
  })

  it('offers a free Community sign-up with no card', () => {
    render(<MarketingPage />)
    const tryFree = screen.getAllByRole('link', { name: /try it free/i })[0]
    expect(tryFree).toHaveAttribute('href', '/signup')
    expect(screen.getByText(/include GST/i)).toBeInTheDocument()
  })

  it('includes a GST-inclusive pricing note', () => {
    render(<MarketingPage />)
    expect(screen.getByText(/include GST/i)).toBeInTheDocument()
  })
})
