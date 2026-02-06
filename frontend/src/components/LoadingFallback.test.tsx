import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingFallback } from './LoadingFallback';

describe('LoadingFallback', () => {
  it('renders with default message', () => {
    render(<LoadingFallback />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<LoadingFallback message="Loading features..." />);
    expect(screen.getByText('Loading features...')).toBeInTheDocument();
  });

  it('displays spinner', () => {
    const { container } = render(<LoadingFallback />);
    const spinner = container.querySelector('.loading-spinner');
    expect(spinner).toBeInTheDocument();
  });
});
