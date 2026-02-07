import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast, ToastContainer } from './Toast';
import type { ToastMessage } from './Toast';

describe('Toast', () => {
  const mockOnDismiss = vi.fn();

  const successToast: ToastMessage = {
    id: '1',
    type: 'success',
    message: 'Operation successful',
    duration: 3000,
  };

  const errorToast: ToastMessage = {
    id: '2',
    type: 'error',
    message: 'An error occurred',
    duration: 5000,
  };

  const toastWithAction: ToastMessage = {
    id: '3',
    type: 'info',
    message: 'Action available',
    duration: 0,
    action: {
      label: 'Retry',
      onClick: vi.fn(),
    },
  };

  beforeEach(() => {
    mockOnDismiss.mockClear();
  });

  it('renders success toast with correct message', () => {
    render(<Toast toast={successToast} onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
  });

  it('renders error toast with correct styling', () => {
    const { container } = render(<Toast toast={errorToast} onDismiss={mockOnDismiss} />);
    const toastElement = container.querySelector('.toast-error');
    expect(toastElement).toBeInTheDocument();
  });

  it('calls onDismiss when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<Toast toast={successToast} onDismiss={mockOnDismiss} />);
    
    const closeButton = screen.getByLabelText('Dismiss notification');
    await user.click(closeButton);
    
    expect(mockOnDismiss).toHaveBeenCalledWith('1');
  });

  it('auto-dismisses after duration', async () => {
    render(<Toast toast={successToast} onDismiss={mockOnDismiss} />);
    
    await waitFor(() => {
      expect(mockOnDismiss).toHaveBeenCalledWith('1');
    }, { timeout: 3500 });
  });

  it('does not auto-dismiss when duration is 0', async () => {
    render(<Toast toast={toastWithAction} onDismiss={mockOnDismiss} />);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('renders action button when provided', () => {
    render(<Toast toast={toastWithAction} onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('calls action onClick and dismisses when action button is clicked', async () => {
    const user = userEvent.setup();
    const actionOnClick = vi.fn();
    const toast: ToastMessage = {
      ...toastWithAction,
      action: { label: 'Retry', onClick: actionOnClick },
    };
    
    render(<Toast toast={toast} onDismiss={mockOnDismiss} />);
    
    const actionButton = screen.getByText('Retry');
    await user.click(actionButton);
    
    expect(actionOnClick).toHaveBeenCalled();
    expect(mockOnDismiss).toHaveBeenCalledWith('3');
  });

  it('has correct ARIA attributes', () => {
    render(<Toast toast={errorToast} onDismiss={mockOnDismiss} />);
    
    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveAttribute('aria-live', 'assertive');
    expect(toastElement).toHaveAttribute('aria-atomic', 'true');
  });
});

describe('ToastContainer', () => {
  const mockOnDismiss = vi.fn();

  const toasts: ToastMessage[] = [
    { id: '1', type: 'success', message: 'First toast' },
    { id: '2', type: 'error', message: 'Second toast' },
    { id: '3', type: 'info', message: 'Third toast' },
  ];

  beforeEach(() => {
    mockOnDismiss.mockClear();
  });

  it('renders multiple toasts', () => {
    render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);
    
    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
    expect(screen.getByText('Third toast')).toBeInTheDocument();
  });

  it('dismisses top toast on Escape key', async () => {
    const user = userEvent.setup();
    render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);
    
    await user.keyboard('{Escape}');
    
    expect(mockOnDismiss).toHaveBeenCalledWith('3'); // Last toast in array
  });

  it('renders empty container when no toasts', () => {
    const { container } = render(<ToastContainer toasts={[]} onDismiss={mockOnDismiss} />);
    
    const toastContainer = container.querySelector('.toast-container');
    expect(toastContainer).toBeInTheDocument();
    expect(toastContainer?.children.length).toBe(0);
  });
});
