import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmationDialog } from './ConfirmationDialog';

describe('ConfirmationDialog', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    title: 'Confirm Action',
    message: 'Are you sure?',
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
  });

  it('renders with title and message', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        description="This action cannot be undone."
      />
    );
    
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} />);
    
    const confirmButton = screen.getByText('Confirm');
    await user.click(confirmButton);
    
    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('calls onCancel when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} />);
    
    const closeButton = screen.getByLabelText('Close dialog');
    await user.click(closeButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('calls onCancel when Escape key is pressed', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} />);
    
    await user.keyboard('{Escape}');
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('renders with danger styling when isDangerous is true', () => {
    const { container } = render(
      <ConfirmationDialog {...defaultProps} isDangerous={true} />
    );
    
    const dialog = container.querySelector('.confirmation-dialog-danger');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('renders danger button when isDangerous is true', () => {
    render(
      <ConfirmationDialog {...defaultProps} isDangerous={true} />
    );
    
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('danger-button');
  });

  it('uses custom button labels when provided', () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        confirmLabel="Delete"
        cancelLabel="Keep"
      />
    );
    
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Keep')).toBeInTheDocument();
  });

  it('shows text confirmation input when requireTextConfirmation is true', () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        requireTextConfirmation={true}
        confirmationText="DELETE"
      />
    );
    
    expect(screen.getByText(/Type/)).toBeInTheDocument();
    expect(screen.getByText('DELETE')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('DELETE')).toBeInTheDocument();
  });

  it('disables confirm button when text confirmation does not match', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmationDialog
        {...defaultProps}
        requireTextConfirmation={true}
        confirmationText="DELETE"
      />
    );
    
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toBeDisabled();
    
    const input = screen.getByPlaceholderText('DELETE');
    await user.type(input, 'WRONG');
    
    expect(confirmButton).toBeDisabled();
  });

  it('enables confirm button when text confirmation matches', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmationDialog
        {...defaultProps}
        requireTextConfirmation={true}
        confirmationText="DELETE"
      />
    );
    
    const confirmButton = screen.getByText('Confirm');
    const input = screen.getByPlaceholderText('DELETE');
    
    await user.type(input, 'DELETE');
    
    expect(confirmButton).not.toBeDisabled();
  });

  it('shows loading state during async confirmation', async () => {
    const user = userEvent.setup();
    const slowConfirm = vi.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
    
    render(
      <ConfirmationDialog
        {...defaultProps}
        onConfirm={slowConfirm}
      />
    );
    
    const confirmButton = screen.getByText('Confirm');
    await user.click(confirmButton);
    
    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();
  });

  it('displays error message when confirmation fails', async () => {
    const user = userEvent.setup();
    const failingConfirm = vi.fn(() => Promise.reject(new Error('Failed to delete')));
    
    render(
      <ConfirmationDialog
        {...defaultProps}
        onConfirm={failingConfirm}
      />
    );
    
    const confirmButton = screen.getByText('Confirm');
    await user.click(confirmButton);
    
    await screen.findByText('Failed to delete');
  });

  it('has correct ARIA attributes', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirmation-dialog-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'confirmation-dialog-description');
  });
});
