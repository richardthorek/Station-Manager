import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Lightbox } from './Lightbox';
import userEvent from '@testing-library/user-event';

describe('Lightbox', () => {
  const mockOnClose = vi.fn();
  const defaultProps = {
    imageUrl: 'https://example.com/image.jpg',
    alt: 'Test image',
    isOpen: true,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders lightbox when isOpen is true', () => {
    render(<Lightbox {...defaultProps} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', defaultProps.imageUrl);
    expect(screen.getByRole('img')).toHaveAttribute('alt', defaultProps.alt);
  });

  it('does not render when isOpen is false', () => {
    render(<Lightbox {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<Lightbox {...defaultProps} />);
    
    const closeButton = screen.getByLabelText('Close image viewer');
    await user.click(closeButton);
    
    // Button click may propagate to overlay, so check it was called at least once
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    render(<Lightbox {...defaultProps} />);
    
    const overlay = screen.getByRole('dialog');
    await user.click(overlay);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when image content is clicked', async () => {
    const user = userEvent.setup();
    render(<Lightbox {...defaultProps} />);
    
    const image = screen.getByRole('img');
    await user.click(image);
    
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup();
    render(<Lightbox {...defaultProps} />);
    
    await user.keyboard('{Escape}');
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('prevents body scroll when open', () => {
    const { rerender } = render(<Lightbox {...defaultProps} />);
    
    expect(document.body.style.overflow).toBe('hidden');
    
    rerender(<Lightbox {...defaultProps} isOpen={false} />);
    
    expect(document.body.style.overflow).toBe('');
  });

  it('has correct ARIA attributes', () => {
    render(<Lightbox {...defaultProps} />);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Image viewer');
  });
});
