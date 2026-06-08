import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SignupPage } from './SignupPage'

const signup = vi.fn()
const navigate = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ signup }),
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
  })

  it('renders the sign-up form', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/brigade \/ organisation name/i)).toBeInTheDocument()
  })

  it('submits and navigates to the organization screen on success', async () => {
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
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin/organization', { replace: true }))
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
