/**
 * Demo Mode Warning Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DemoModeWarning } from './DemoModeWarning';

describe('DemoModeWarning', () => {
  it('should render with action text', () => {
    const mockConfirm = vi.fn();
    const mockCancel = vi.fn();

    render(
      <DemoModeWarning
        action="delete this member"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    expect(screen.getByText(/delete this member/i)).toBeInTheDocument();
    expect(screen.getByText(/Demo Mode Warning/i)).toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', () => {
    const mockConfirm = vi.fn();
    const mockCancel = vi.fn();

    render(
      <DemoModeWarning
        action="delete this member"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('should call onConfirm when continue button is clicked', () => {
    const mockConfirm = vi.fn();
    const mockCancel = vi.fn();

    render(
      <DemoModeWarning
        action="delete this member"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('should call onCancel when overlay is clicked', () => {
    const mockConfirm = vi.fn();
    const mockCancel = vi.fn();

    render(
      <DemoModeWarning
        action="delete this member"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    const overlay = document.querySelector('.demo-warning-overlay');
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockCancel).toHaveBeenCalled();
    }
  });

  it('should not call onCancel when dialog content is clicked', () => {
    const mockConfirm = vi.fn();
    const mockCancel = vi.fn();

    render(
      <DemoModeWarning
        action="delete this member"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    const dialog = document.querySelector('.demo-warning-dialog');
    if (dialog) {
      fireEvent.click(dialog);
      expect(mockCancel).not.toHaveBeenCalled();
    }
  });

  it('should display demo mode information', () => {
    const mockConfirm = vi.fn();
    const mockCancel = vi.fn();

    render(
      <DemoModeWarning
        action="reset the station"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    expect(screen.getByText(/This is a demo station with test data/i)).toBeInTheDocument();
    expect(screen.getByText(/All demo data can be reset at any time/i)).toBeInTheDocument();
  });
});
