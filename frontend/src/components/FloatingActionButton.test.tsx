import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloatingActionButton } from './FloatingActionButton';

describe('FloatingActionButton', () => {
  let mockVibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockVibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      value: mockVibrate,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render FAB with icon and aria-label', () => {
    const handleClick = vi.fn();
    render(
      <FloatingActionButton
        icon="+"
        onClick={handleClick}
        ariaLabel="Add new item"
      />
    );

    const button = screen.getByRole('button', { name: 'Add new item' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('+');
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <FloatingActionButton
        icon="+"
        onClick={handleClick}
        ariaLabel="Add new item"
      />
    );

    const button = screen.getByRole('button', { name: 'Add new item' });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should trigger haptic feedback on click', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <FloatingActionButton
        icon="+"
        onClick={handleClick}
        ariaLabel="Add new item"
        enableHaptic={true}
      />
    );

    const button = screen.getByRole('button', { name: 'Add new item' });
    await user.click(button);

    expect(mockVibrate).toHaveBeenCalledWith(30);
  });

  it('should not trigger haptic feedback when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <FloatingActionButton
        icon="+"
        onClick={handleClick}
        ariaLabel="Add new item"
        enableHaptic={false}
      />
    );

    const button = screen.getByRole('button', { name: 'Add new item' });
    await user.click(button);

    expect(mockVibrate).not.toHaveBeenCalled();
  });

  it('should apply correct position class', () => {
    const handleClick = vi.fn();
    const { rerender } = render(
      <FloatingActionButton
        icon="+"
        onClick={handleClick}
        ariaLabel="Add new item"
        position="bottom-right"
      />
    );

    let button = screen.getByRole('button', { name: 'Add new item' });
    expect(button).toHaveClass('fab-bottom-right');

    rerender(
      <FloatingActionButton
        icon="+"
        onClick={handleClick}
        ariaLabel="Add new item"
        position="bottom-left"
      />
    );
    button = screen.getByRole('button', { name: 'Add new item' });
    expect(button).toHaveClass('fab-bottom-left');
  });

  it('should render when hideOnScroll is false', () => {
    const handleClick = vi.fn();
    render(
      <FloatingActionButton
        icon="+"
        onClick={handleClick}
        ariaLabel="Add new item"
        hideOnScroll={false}
      />
    );

    const button = screen.getByRole('button', { name: 'Add new item' });
    expect(button).toBeInTheDocument();
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <FloatingActionButton
        icon="+"
        onClick={handleClick}
        ariaLabel="Add new item"
      />
    );

    const button = screen.getByRole('button', { name: 'Add new item' });
    await user.tab();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
