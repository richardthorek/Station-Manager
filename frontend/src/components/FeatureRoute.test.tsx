import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FeatureRoute } from './FeatureRoute'

const authState = {
  hasFeature: vi.fn(),
  isLoading: false,
}

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

function renderGated() {
  return render(
    <MemoryRouter>
      <FeatureRoute feature="truckCheckEnabled" title="Truck check">
        <div>Protected content</div>
      </FeatureRoute>
    </MemoryRouter>,
  )
}

describe('FeatureRoute', () => {
  it('renders children when the feature is entitled', () => {
    authState.isLoading = false
    authState.hasFeature.mockReturnValue(true)
    renderGated()
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('renders the locked panel when the feature is not entitled', () => {
    authState.isLoading = false
    authState.hasFeature.mockReturnValue(false)
    renderGated()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(screen.getByText(/isn't on your plan/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view upgrade options/i })).toHaveAttribute(
      'href',
      '/admin/organization',
    )
  })

  it('shows the loading fallback while auth is resolving', () => {
    authState.isLoading = true
    authState.hasFeature.mockReturnValue(false)
    renderGated()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })
})
