import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonCard,
  SkeletonList,
  SkeletonTable,
  SkeletonMemberCard,
  SkeletonEventCard,
  SkeletonProfile,
  SkeletonReportCard,
} from './Skeleton';

describe('Skeleton', () => {
  it('renders single skeleton with default variant', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('.skeleton-text');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders circle variant', () => {
    const { container } = render(<Skeleton variant="circle" />);
    const skeleton = container.querySelector('.skeleton-circle');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders rectangle variant', () => {
    const { container } = render(<Skeleton variant="rectangle" />);
    const skeleton = container.querySelector('.skeleton-rectangle');
    expect(skeleton).toBeInTheDocument();
  });

  it('applies custom width and height', () => {
    const { container } = render(<Skeleton width="200px" height={50} />);
    const skeleton = container.querySelector('.skeleton');
    expect(skeleton).toHaveStyle({ width: '200px', height: '50px' });
  });

  it('renders multiple skeletons when count is specified', () => {
    const { container } = render(<Skeleton count={3} />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons).toHaveLength(3);
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="custom-skeleton" />);
    const skeleton = container.querySelector('.custom-skeleton');
    expect(skeleton).toBeInTheDocument();
  });

  it('has correct ARIA attributes', () => {
    render(<Skeleton />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveAttribute('aria-label', 'Loading...');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
  });

  it('includes shimmer animation element', () => {
    const { container } = render(<Skeleton />);
    const shimmer = container.querySelector('.skeleton-shimmer');
    expect(shimmer).toBeInTheDocument();
  });
});

describe('SkeletonCard', () => {
  it('renders skeleton card with image and text placeholders', () => {
    const { container } = render(<SkeletonCard />);
    const card = container.querySelector('.skeleton-card');
    const skeletons = container.querySelectorAll('.skeleton');
    
    expect(card).toBeInTheDocument();
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('SkeletonList', () => {
  it('renders default number of list items', () => {
    const { container } = render(<SkeletonList />);
    const listItems = container.querySelectorAll('.skeleton-list-item');
    expect(listItems).toHaveLength(3);
  });

  it('renders custom number of list items', () => {
    const { container } = render(<SkeletonList count={5} />);
    const listItems = container.querySelectorAll('.skeleton-list-item');
    expect(listItems).toHaveLength(5);
  });

  it('each list item has circle and text skeletons', () => {
    const { container } = render(<SkeletonList count={1} />);
    const circle = container.querySelector('.skeleton-circle');
    const texts = container.querySelectorAll('.skeleton-text');
    
    expect(circle).toBeInTheDocument();
    expect(texts.length).toBeGreaterThan(0);
  });
});

describe('SkeletonTable', () => {
  it('renders default number of rows', () => {
    const { container } = render(<SkeletonTable />);
    const rows = container.querySelectorAll('.skeleton-table-row');
    expect(rows).toHaveLength(5);
  });

  it('renders custom number of rows and columns', () => {
    const { container } = render(<SkeletonTable rows={3} columns={4} />);
    const rows = container.querySelectorAll('.skeleton-table-row');
    const firstRowCells = rows[0].querySelectorAll('.skeleton-table-cell');
    
    expect(rows).toHaveLength(3);
    expect(firstRowCells).toHaveLength(4);
  });
});

describe('SkeletonMemberCard', () => {
  it('renders member card skeleton with default count', () => {
    const { container } = render(<SkeletonMemberCard />);
    expect(container.querySelector('.skeleton-member-grid')).toBeInTheDocument();
    const cards = container.querySelectorAll('.skeleton-member-card');
    expect(cards).toHaveLength(6);
  });

  it('renders member card skeleton with custom count', () => {
    const { container } = render(<SkeletonMemberCard count={4} />);
    const cards = container.querySelectorAll('.skeleton-member-card');
    expect(cards).toHaveLength(4);
  });
});

describe('SkeletonEventCard', () => {
  it('renders event card skeleton with default count', () => {
    const { container } = render(<SkeletonEventCard />);
    expect(container.querySelector('.skeleton-event-list')).toBeInTheDocument();
    const cards = container.querySelectorAll('.skeleton-event-card');
    expect(cards).toHaveLength(2);
  });

  it('renders event card skeleton with custom count', () => {
    const { container } = render(<SkeletonEventCard count={3} />);
    const cards = container.querySelectorAll('.skeleton-event-card');
    expect(cards).toHaveLength(3);
  });
});

describe('SkeletonProfile', () => {
  it('renders profile skeleton with correct structure', () => {
    const { container } = render(<SkeletonProfile />);
    expect(container.querySelector('.skeleton-profile')).toBeInTheDocument();
    expect(container.querySelector('.skeleton-profile-header')).toBeInTheDocument();
    expect(container.querySelector('.skeleton-profile-stats')).toBeInTheDocument();
  });
});

describe('SkeletonReportCard', () => {
  it('renders report card skeleton with default count', () => {
    const { container } = render(<SkeletonReportCard />);
    expect(container.querySelector('.skeleton-reports-grid')).toBeInTheDocument();
    const cards = container.querySelectorAll('.skeleton-report-card');
    expect(cards).toHaveLength(4);
  });

  it('renders report card skeleton with custom count', () => {
    const { container } = render(<SkeletonReportCard count={6} />);
    const cards = container.querySelectorAll('.skeleton-report-card');
    expect(cards).toHaveLength(6);
  });
});
