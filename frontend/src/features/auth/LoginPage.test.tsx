import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginPage } from './LoginPage'

const login = vi.fn()
const navigate = vi.fn()
let isAuthenticated = false

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ login, isAuthenticated }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderPage(initialEntries: Array<string | { pathname: string; state?: unknown }> = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset()
    navigate.mockReset()
    isAuthenticated = false
  })

  it('defaults to the app picker (not the admin console) after a plain login', async () => {
    login.mockResolvedValue(undefined)
    renderPage()

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'owner' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(login).toHaveBeenCalledWith('owner', 'hunter2'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('honours a deep-link redirect target from location state', async () => {
    login.mockResolvedValue(undefined)
    renderPage([{ pathname: '/login', state: { from: '/admin/brigade-access' } }])

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'owner' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin/brigade-access', { replace: true }))
  })

  it('redirects an already-authenticated visitor away from the login form', async () => {
    isAuthenticated = true
    renderPage()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
  })
})
