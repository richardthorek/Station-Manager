/**
 * ShowcaseSection Tests
 *
 * The marketing-page scroll showcase: four screen-recording-style demo blocks
 * (sign-in, truck checks, AAR Studio, reports) plus the conversion CTA.
 * The test IntersectionObserver mock never fires, so demos render their idle
 * state and no autoplay timers run — assertions stay deterministic.
 */

import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../../test/utils/test-utils'
import { ShowcaseSection } from './ShowcaseSection'

describe('ShowcaseSection', () => {
  it('renders the intro and all four demo blocks', () => {
    render(<ShowcaseSection />)

    expect(screen.getByRole('heading', { name: /the whole station, running itself/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /one tap, and the whole brigade knows/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /truck checks that actually get done/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /debriefs that write themselves/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /every hour counted/i })).toBeInTheDocument()
  })

  it('funnels visitors to signup and the pricing section', () => {
    render(<ShowcaseSection />)

    const cta = screen.getByRole('link', { name: /get started free/i })
    expect(cta).toHaveAttribute('href', '/signup')
    expect(screen.getByRole('link', { name: /see plans below/i })).toHaveAttribute('href', '#pricing')
  })

  it('lets a visitor tap a member chip in the sign-in demo', async () => {
    const user = userEvent.setup()
    render(<ShowcaseSection />)

    const chip = screen.getByRole('button', { name: /sarah m\., captain — tap to sign in/i })
    expect(chip).toHaveAttribute('aria-pressed', 'false')

    await user.click(chip)

    expect(screen.getByRole('button', { name: /sarah m\., captain — on station/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/1 member on station/i)).toBeInTheDocument()
    expect(screen.getByText(/sarah m\. on station — incident/i)).toBeInTheDocument()
  })

  it('renders the truck check demo checklist and vehicle', () => {
    render(<ShowcaseSection />)

    expect(screen.getByText(/cat 1 — heavy tanker/i)).toBeInTheDocument()
    expect(screen.getByText(/pump operation & pressure/i)).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /vehicle check progress/i })).toBeInTheDocument()
  })

  it('renders the AAR demo capture chrome and findings board', () => {
    render(<ShowcaseSection />)

    expect(screen.getByText(/structure fire debrief/i)).toBeInTheDocument()
    expect(screen.getByText(/ai findings board/i)).toBeInTheDocument()
  })

  it('renders the reports demo chart with accessible data', () => {
    render(<ShowcaseSection />)

    expect(screen.getByRole('img', { name: /bar chart of volunteer hours by month/i })).toBeInTheDocument()
    expect(screen.getByText(/truck checks on time/i)).toBeInTheDocument()
  })
})
