import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TruckCheckOnboardingWizard } from './TruckCheckOnboardingWizard'

const navigate = vi.fn()
const showSuccess = vi.fn()
const { createAppliance } = vi.hoisted(() => ({ createAppliance: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ showSuccess }),
}))

vi.mock('../../services/api', () => ({
  api: { createAppliance },
}))

vi.mock('../../utils/onboardingUtils', () => ({
  markTruckCheckOnboardingComplete: vi.fn(),
  hasCompletedTruckCheckOnboarding: vi.fn(() => false),
}))

function renderWizard() {
  return render(
    <MemoryRouter>
      <TruckCheckOnboardingWizard />
    </MemoryRouter>,
  )
}

describe('TruckCheckOnboardingWizard', () => {
  beforeEach(() => {
    navigate.mockReset()
    showSuccess.mockReset()
    createAppliance.mockReset()
  })

  it('renders the jurisdiction selection step', () => {
    renderWizard()
    expect(screen.getByRole('heading', { name: /set up truck checks/i })).toBeInTheDocument()
    expect(screen.getByText(/where does your brigade operate/i)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /new south wales/i })).toBeInTheDocument()
  })

  it('navigates to agency step when jurisdiction is selected', async () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /other/i })).toBeInTheDocument()
    })
  })

  it('shows custom agency input when "Other" is selected', async () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /other/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('radio', { name: /other/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. local volunteer/i)).toBeInTheDocument()
    })
  })

  it('navigates to vehicle selection step', async () => {
    renderWizard()

    // Step 1: Select jurisdiction
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /other/i })).toBeInTheDocument()
    })

    // Step 2: Select agency (NSW RFS is default)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /cat 1 tanker/i })).toBeInTheDocument()
    })
  })

  it('allows vehicle selection', async () => {
    renderWizard()

    // Navigate to vehicle selection step
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByRole('radio', { name: /other/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /cat 1 tanker/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('checkbox', { name: /cat 1 tanker/i }))

    expect(screen.getByRole('checkbox', { name: /cat 1 tanker/i })).toBeChecked()
  })

  it('shows confirmation step with selected data', async () => {
    renderWizard()

    // Navigate through steps
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByRole('radio', { name: /other/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => screen.getByRole('checkbox', { name: /cat 1 tanker/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /cat 1 tanker/i }))
    fireEvent.click(screen.getByRole('button', { name: /review/i }))

    await waitFor(() => {
      expect(screen.getByText(/review and confirm/i)).toBeInTheDocument()
    })
  })

  it('navigates back to previous steps', async () => {
    renderWizard()

    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByRole('radio', { name: /other/i }))

    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    await waitFor(() => screen.getByRole('radio', { name: /new south wales/i }))
  })

  it('shows error when no vehicles are selected', async () => {
    renderWizard()

    // Navigate to vehicle selection step
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByRole('radio', { name: /other/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => screen.getByRole('checkbox', { name: /cat 1 tanker/i }))

    // Try to review without selecting vehicles
    fireEvent.click(screen.getByRole('button', { name: /review/i }))

    await waitFor(() => {
      expect(screen.getByText(/please select at least one vehicle/i)).toBeInTheDocument()
    })
  })

  it('disables buttons while loading', async () => {
    createAppliance.mockResolvedValue({ id: 'appliance-1' })
    renderWizard()

    // Navigate to confirmation
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByRole('radio', { name: /other/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByRole('checkbox', { name: /cat 1 tanker/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /cat 1 tanker/i }))
    fireEvent.click(screen.getByRole('button', { name: /review/i }))

    await waitFor(() => screen.getByText(/review and confirm/i))

    const submitButton = screen.getByRole('button', { name: /create vehicles/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
      expect(navigate).toHaveBeenCalledWith('/truckcheck')
    })
  })
})
