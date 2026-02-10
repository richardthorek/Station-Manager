/**
 * Tests for InsightCard Component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InsightCard } from './InsightCard';

describe('InsightCard', () => {
  it('should render title and message', () => {
    render(
      <InsightCard
        type="info"
        title="Test Title"
        message="Test message content"
      />
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message content')).toBeInTheDocument();
  });

  it('should render recommendation when provided', () => {
    render(
      <InsightCard
        type="warning"
        title="Warning"
        message="Something needs attention"
        recommendation="Take this action"
      />
    );

    expect(screen.getByText(/Take this action/)).toBeInTheDocument();
    expect(screen.getByText('Recommendation:')).toBeInTheDocument();
  });

  it('should apply correct class for success type', () => {
    const { container } = render(
      <InsightCard
        type="success"
        title="Success"
        message="All good"
      />
    );

    const card = container.querySelector('.insight-card--success');
    expect(card).toBeInTheDocument();
  });

  it('should apply correct class for warning type', () => {
    const { container } = render(
      <InsightCard
        type="warning"
        title="Warning"
        message="Needs attention"
      />
    );

    const card = container.querySelector('.insight-card--warning');
    expect(card).toBeInTheDocument();
  });

  it('should apply correct class for critical type', () => {
    const { container } = render(
      <InsightCard
        type="critical"
        title="Critical"
        message="Urgent issue"
      />
    );

    const card = container.querySelector('.insight-card--critical');
    expect(card).toBeInTheDocument();
  });

  it('should apply correct class for info type', () => {
    const { container } = render(
      <InsightCard
        type="info"
        title="Info"
        message="FYI"
      />
    );

    const card = container.querySelector('.insight-card--info');
    expect(card).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(
      <InsightCard
        type="info"
        title="Accessible Title"
        message="Message"
      />
    );

    const article = screen.getByRole('article');
    expect(article).toBeInTheDocument();
    expect(article).toHaveAttribute('aria-labelledby');
  });

  it('should not render recommendation section when not provided', () => {
    render(
      <InsightCard
        type="info"
        title="No Rec"
        message="Message only"
      />
    );

    expect(screen.queryByText('Recommendation:')).not.toBeInTheDocument();
  });
});
