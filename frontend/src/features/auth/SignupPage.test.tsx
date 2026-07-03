import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SignupPage } from './SignupPage'

const signup = vi.fn()
const navigate = vi.fn()
const showSuccess = vi.fn()
const { createCheckoutSession } = vi.hoisted(() => ({ createCheckoutSession: vi.fn() }))

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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderPage() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>,
  )
}

describe('SignupPage', () => {
  beforeEach(() => {
    signup.mockReset()
    navigate.mockReset()
    showSuccess.mockReset()
    createCheckoutSession.mockReset()
  })

  it('renders the sign-up form', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/brigade \/ organisation name/i)).toBeInTheDocument()
  })

  it('submits and navigates to the app picker on success (no billing intent)', async () => {
    signup.mockResolvedValue(undefined)
    renderPage()

    fireEvent.change(screen.getByLabelText(/brigade \/ organisation name/i), { target: { value: 'Bungendore RFS' } })
    fireEvent.change(screen.getByLabelText(/contact \/ billing email/i), { target: { value: 'a@b.org' } })
    fireEvent.change(screen.getByLabelText(/owner username/i), { target: { value: 'captain' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'supersecret1' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(signup).toHaveBeenCalledWith({
      organizationName: 'Bungendore RFS',
      billingEmail: 'a@b.org',
      username: 'captain',
      password: 'supersecret1',
    }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
    expect(showSuccess).toHaveBeenCalled()
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

    render(
      <MemoryRouter initialEntries={['/signup?plan=basic&interval=annual']}>
        <SignupPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/brigade \/ organisation name/i), { target: { value: 'Bungendore RFS' } })
    fireEvent.change(screen.getByLabelText(/contact \/ billing email/i), { target: { value: 'a@b.org' } })
    fireEvent.change(screen.getByLabelText(/owner username/i), { target: { value: 'captain' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'supersecret1' } })
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    await waitFor(() => expect(createCheckoutSession).toHaveBeenCalledWith('basic', 'annual'))
    await waitFor(() => expect(hrefSetter).toHaveBeenCalledWith('https://checkout.stripe.test/abc'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('falls back to the organization screen when billing is unavailable', async () => {
    signup.mockResolvedValue(undefined)
    createCheckoutSession.mockRejectedValue(new Error('Billing not configured'))

    render(
      <MemoryRouter initialEntries={['/signup?plan=ai']}>
        <SignupPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/brigade \/ organisation name/i), { target: { value: 'X RFS' } })
    fireEvent.change(screen.getByLabelText(/contact \/ billing email/i), { target: { value: 'a@b.org' } })
    fireEvent.change(screen.getByLabelText(/owner username/i), { target: { value: 'cap' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'supersecret1' } })
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin/organization?billing=unavailable', { replace: true }))
  })

  it('rejects a short password before calling signup', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/brigade \/ organisation name/i), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText(/contact \/ billing email/i), { target: { value: 'a@b.org' } })
    fireEvent.change(screen.getByLabelText(/owner username/i), { target: { value: 'cap' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(signup).not.toHaveBeenCalled()
  })
})
