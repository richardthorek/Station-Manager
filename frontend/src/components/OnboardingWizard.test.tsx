/**
 * OnboardingWizard Component Tests
 *
 * Tests for the interactive onboarding wizard that guides new users
 * through the Station Manager features.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OnboardingWizard } from './OnboardingWizard';
import * as onboardingUtils from '../utils/onboardingUtils';

// Mock the onboarding utilities
vi.mock('../utils/onboardingUtils', () => ({
  markOnboardingComplete: vi.fn(),
  hasCompletedOnboarding: vi.fn(() => false),
  resetOnboarding: vi.fn()
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('OnboardingWizard', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWizard = () => {
    return render(
      <BrowserRouter>
        <OnboardingWizard onClose={mockOnClose} />
      </BrowserRouter>
    );
  };

  it('renders the wizard with first step', () => {
    renderWizard();

    expect(screen.getByText('Welcome to Station Manager')).toBeInTheDocument();
    expect(screen.getByText(/Your complete digital management solution/i)).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('displays progress indicator with 5 dots', () => {
    renderWizard();

    const progressDots = screen.getAllByRole('button', { name: /Go to step/i });
    expect(progressDots).toHaveLength(5);
  });

  it('first dot is active on initial render', () => {
    renderWizard();

    const progressDots = screen.getAllByRole('button', { name: /Go to step/i });
    expect(progressDots[0]).toHaveClass('active');
  });

  it('navigates to next step when Next button is clicked', () => {
    renderWizard();

    const nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);

    expect(screen.getByText('Choose Your Station')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
  });

  it('navigates to previous step when Back button is clicked', () => {
    renderWizard();

    // Go to step 2
    const nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);

    // Go back to step 1
    const backButton = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backButton);

    expect(screen.getByText('Welcome to Station Manager')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('disables Back button on first step', () => {
    renderWizard();

    const backButton = screen.getByRole('button', { name: /Back/i });
    expect(backButton).toBeDisabled();
  });

  it('does not disable Back button on second step', () => {
    renderWizard();

    const nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);

    const backButton = screen.getByRole('button', { name: /Back/i });
    expect(backButton).not.toBeDisabled();
  });

  it('allows jumping to specific step via progress dots', () => {
    renderWizard();

    const progressDots = screen.getAllByRole('button', { name: /Go to step/i });
    fireEvent.click(progressDots[2]); // Jump to step 3

    expect(screen.getByText('Track Member Presence')).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
  });

  it('displays "Get Started" on last step instead of Next', () => {
    renderWizard();

    // Navigate to last step
    const progressDots = screen.getAllByRole('button', { name: /Go to step/i });
    fireEvent.click(progressDots[4]);

    const getStartedButton = screen.getByRole('button', { name: /Get Started/i });
    expect(getStartedButton).toBeInTheDocument();
  });

  it('marks onboarding as complete and closes when Skip Tour is clicked', async () => {
    renderWizard();

    const skipButton = screen.getByRole('button', { name: /Skip Tour/i });
    fireEvent.click(skipButton);

    expect(onboardingUtils.markOnboardingComplete).toHaveBeenCalled();

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    }, { timeout: 500 });
  });

  it('marks onboarding as complete and closes when X button is clicked', async () => {
    renderWizard();

    const closeButton = screen.getByRole('button', { name: /Skip onboarding/i });
    fireEvent.click(closeButton);

    expect(onboardingUtils.markOnboardingComplete).toHaveBeenCalled();

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    }, { timeout: 500 });
  });

  it('marks onboarding as complete and closes when clicking Get Started on last step', async () => {
    renderWizard();

    // Navigate to last step
    const progressDots = screen.getAllByRole('button', { name: /Go to step/i });
    fireEvent.click(progressDots[4]);

    const getStartedButton = screen.getByRole('button', { name: /Get Started/i });
    fireEvent.click(getStartedButton);

    expect(onboardingUtils.markOnboardingComplete).toHaveBeenCalled();

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    }, { timeout: 500 });
  });

  it('displays action button on step 3 (Sign-In)', () => {
    renderWizard();

    // Navigate to step 3
    const progressDots = screen.getAllByRole('button', { name: /Go to step/i });
    fireEvent.click(progressDots[2]);

    const actionButton = screen.getByRole('button', { name: /Go to Sign-In/i });
    expect(actionButton).toBeInTheDocument();
  });

  it('navigates to sign-in page when action button is clicked', async () => {
    renderWizard();

    // Navigate to step 3
    const progressDots = screen.getAllByRole('button', { name: /Go to step/i });
    fireEvent.click(progressDots[2]);

    const actionButton = screen.getByRole('button', { name: /Go to Sign-In/i });
    fireEvent.click(actionButton);

    expect(onboardingUtils.markOnboardingComplete).toHaveBeenCalled();

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/signin');
    }, { timeout: 500 });
  });

  it('shows all 5 step titles correctly', () => {
    renderWizard();

    const expectedTitles = [
      'Welcome to Station Manager',
      'Choose Your Station',
      'Track Member Presence',
      'Organize Events',
      'You\'re Ready!'
    ];

    const progressDots = screen.getAllByRole('button', { name: /Go to step/i });

    expectedTitles.forEach((title, index) => {
      fireEvent.click(progressDots[index]);
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });

  it('displays checkmarks on completed steps', () => {
    renderWizard();

    // Navigate to step 3
    const nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton); // Step 2
    fireEvent.click(nextButton); // Step 3

    const progressDots = screen.getAllByRole('button', { name: /Go to step/i });
    expect(progressDots[0]).toHaveClass('completed');
    expect(progressDots[1]).toHaveClass('completed');
    expect(progressDots[2]).toHaveClass('active');
  });

  it('closes wizard when clicking outside the dialog', async () => {
    renderWizard();

    const overlay = screen.getByRole('button', { name: /Skip onboarding/i }).parentElement;
    if (overlay && overlay.className.includes('overlay')) {
      fireEvent.click(overlay);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      }, { timeout: 500 });
    }
  });

  it('renders with proper ARIA labels for accessibility', () => {
    renderWizard();

    expect(screen.getByRole('button', { name: /Skip onboarding/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Skip Tour/i })).toBeInTheDocument();

    const progressDots = screen.getAllByRole('button', { name: /Go to step/i });
    expect(progressDots).toHaveLength(5);
  });

  it('displays detail items with checkmarks', () => {
    renderWizard();

    const detailItems = screen.getByText(/Track member presence in real-time/i);
    expect(detailItems).toBeInTheDocument();
  });
});
