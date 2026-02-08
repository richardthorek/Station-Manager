import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { Confetti } from './Confetti';

describe('Confetti', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders confetti pieces when mounted', () => {
    const { container } = render(<Confetti />);
    
    const confettiContainer = container.querySelector('.confetti-container');
    expect(confettiContainer).toBeInTheDocument();
    
    // Should have 50 confetti pieces
    const pieces = container.querySelectorAll('.confetti-piece');
    expect(pieces.length).toBe(50);
  });

  it('uses custom duration when provided', () => {
    const customDuration = 5000;
    const { container } = render(<Confetti duration={customDuration} />);
    
    expect(container.querySelector('.confetti-container')).toBeInTheDocument();
    
    // Fast-forward past default duration but before custom duration
    vi.advanceTimersByTime(3000);
    expect(container.querySelector('.confetti-container')).toBeInTheDocument();
    
    // Fast-forward to custom duration
    vi.advanceTimersByTime(2000);
    waitFor(() => {
      expect(container.querySelector('.confetti-container')).toBeEmptyDOMElement();
    });
  });

  it('cleans up confetti after default duration (3000ms)', () => {
    const { container } = render(<Confetti />);
    
    expect(container.querySelector('.confetti-container')).toBeInTheDocument();
    
    vi.advanceTimersByTime(3000);
    
    waitFor(() => {
      const pieces = container.querySelectorAll('.confetti-piece');
      expect(pieces.length).toBe(0);
    });
  });

  it('applies RFS brand colors to confetti pieces', () => {
    const { container } = render(<Confetti />);
    
    const pieces = container.querySelectorAll('.confetti-piece');
    const rfsColors = [
      'rgb(229, 40, 27)',   // #e5281B - RFS Red
      'rgb(203, 219, 42)',  // #cbdb2a - RFS Lime  
      'rgb(251, 176, 52)',  // #fbb034 - Amber
      'rgb(33, 94, 158)',   // #215e9e - Blue
      'rgb(0, 133, 80)',    // #008550 - Green
      'rgb(76, 175, 80)',   // #4CAF50 - Success Green
    ];
    
    // Check that all pieces have one of the RFS colors
    pieces.forEach((piece) => {
      const bgColor = getComputedStyle(piece).backgroundColor;
      expect(rfsColors).toContain(bgColor);
    });
  });

  it('has aria-hidden attribute on container', () => {
    const { container } = render(<Confetti />);
    
    const confettiContainer = container.querySelector('.confetti-container');
    expect(confettiContainer).toHaveAttribute('aria-hidden', 'true');
  });

  it('positions confetti pieces randomly across the screen', () => {
    const { container } = render(<Confetti />);
    
    const pieces = container.querySelectorAll('.confetti-piece');
    const leftPositions = Array.from(pieces).map((piece) => 
      (piece as HTMLElement).style.left
    );
    
    // All pieces should have different left positions (0-100%)
    const uniquePositions = new Set(leftPositions);
    expect(uniquePositions.size).toBeGreaterThan(40); // Most should be unique
  });
});
