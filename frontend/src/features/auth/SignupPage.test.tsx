import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SignupPage } from './SignupPage'

const signup = vi.fn()
const navigate = vi.fn()
const showSuccess = vi.fn()
const { createCheckoutSession } = vi.hoisted(() => ({ createCheckoutSession: vi.fn() }))
const { hasCompletedTruckCheckOnboarding } = vi.hoisted(() => ({ hasCompletedTruckCheckOnboarding: vi.fn(() => true) }))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ signup }),
}))

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ showSuccess }),
}))

// Mock the API module so the real fetch-based client isn't loaded in jsdom.
vi.mock('../../services/api', () => ({
  api: { createCheckoutSession },
}))

vi.mock('../../utils/onboardingUtils', () => ({
  hasCompletedTruckCheckOnboarding,
  markTruckCheckOnboardingComplete: vi.fn(),
}))

// FacilitySearch does its own debounced API lookups — stub it with a simple
// button so signup-flow tests aren't coupled to that behaviour (covered by
// FacilitySearch.test.tsx).
vi.mock('../../components/FacilitySearch', () => ({
  FacilitySearch: ({ onSelect }: { onSelect: (selection: unknown, label: string) => void }) => (
    <button type="button" onClick={() => onSelect({ facilityKey: 'rural-fire:101' }, 'Bungendore RFS — Bungendore, NSW')}>
      Mock select facility
    </button>
  ),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderPage(initialEntries: string[] = ['/signup']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SignupPage />
    </MemoryRouter>,
  )
}

/** Fill step 1 and advance to step 2 (facility search). */
function completeStepOne(overrides: { org?: string; email?: string; username?: string; password?: string } = {}) {
  fireEvent.change(screen.getByLabelText(/brigade \/ organisation name/i), { target: { value: overrides.org ?? 'Bungendore RFS' } })
  fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: overrides.email ?? 'a@b.org' } })
  fireEvent.change(screen.getByLabelText(/owner username/i), { target: { value: overrides.username ?? 'captain' } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: overrides.password ?? 'supersecret1' } })
  fireEvent.click(screen.getByRole('button', { name: /next: find your station/i }))
}

describe('SignupPage', () => {
  beforeEach(() => {
    signup.mockReset()
    navigate.mockReset()
    showSuccess.mockReset()
    createCheckoutSession.mockReset()
  })

  it('renders step 1 of the sign-up form', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument()
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/brigade \/ organisation name/i)).toBeInTheDocument()
  })

  it('rejects a short password before advancing to step 2', () => {
    renderPage()
    completeStepOne({ password: 'short' })
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(screen.queryByText(/mock select facility/i)).not.toBeInTheDocument()
  })

  it('advances to step 2 and submits with the selected facility (no billing intent)', async () => {
    signup.mockResolvedValue(undefined)
    renderPage()

    completeStepOne()
    expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/mock select facility/i))
    expect(screen.getByText(/selected:/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }))

    await waitFor(() => expect(signup).toHaveBeenCalledWith({
      organizationName: 'Bungendore RFS',
      billingEmail: 'a@b.org',
      username: 'captain',
      password: 'supersecret1',
      email: 'a@b.org',
      facility: { facilityKey: 'rural-fire:101' },
    }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
    expect(showSuccess).toHaveBeenCalled()
  })

  it('blocks submit on step 2 until a facility is selected', () => {
    renderPage()
    completeStepOne()
    expect(screen.getByRole('button', { name: /^create account$/i })).toBeDisabled()
  })

  it('starts Stripe checkout when a paid plan is pre-selected', async () => {
    signup.mockResolvedValue(undefined)
    createCheckoutSession.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.test/abc' })

    // Don't actually navigate jsdom on the redirect.
    const hrefSetter = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, set href(v: string) { hrefSetter(v) } },
    })

    renderPage(['/signup?plan=basic&interval=annual'])

    completeStepOne()
    fireEvent.click(screen.getByText(/mock select facility/i))
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    await waitFor(() => expect(createCheckoutSession).toHaveBeenCalledWith('basic', 'annual'))
    await waitFor(() => expect(hrefSetter).toHaveBeenCalledWith('https://checkout.stripe.test/abc'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('falls back to the organization screen when billing is unavailable', async () => {
    signup.mockResolvedValue(undefined)
    createCheckoutSession.mockRejectedValue(new Error('Billing not configured'))

    renderPage(['/signup?plan=ai'])

    completeStepOne({ org: 'X RFS', username: 'cap' })
    fireEvent.click(screen.getByText(/mock select facility/i))
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin/organization?billing=unavailable', { replace: true }))
  })

  it('shows the exact claim-conflict copy and lets the user pick a different facility', async () => {
    signup.mockRejectedValue(new Error(
      "This facility has already been claimed by another organisation. Discuss with your brigade members to get an invite link, or contact support — we've flagged this for review.",
    ))
    renderPage()

    completeStepOne()
    fireEvent.click(screen.getByText(/mock select facility/i))
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }))

    expect(await screen.findByText(/already been claimed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /choose a different facility/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /contact support/i })).toHaveAttribute('href', 'mailto:support@stationkit.com.au')

    // Choosing a different facility clears the selection and disables submit again.
    fireEvent.click(screen.getByRole('button', { name: /choose a different facility/i }))
    expect(screen.getByRole('button', { name: /^create account$/i })).toBeDisabled()
  })

  it('supports going back to step 1 from step 2', () => {
    renderPage()
    completeStepOne()
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/brigade \/ organisation name/i)).toHaveValue('Bungendore RFS')
  })
})
