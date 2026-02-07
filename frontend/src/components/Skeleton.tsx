/**
 * Skeleton Loading Component
 * 
 * Provides skeleton screens for better perceived performance.
 * Shows content placeholders while data is loading.
 * 
 * Features:
 * - Multiple variants (text, circle, rectangle)
 * - Customizable width and height
 * - Smooth shimmer animation
 * - Responsive design
 * - Accessible (aria-busy, aria-label)
 */

import './Skeleton.css';

export interface SkeletonProps {
  /** Variant type */
  variant?: 'text' | 'circle' | 'rectangle';
  /** Width (CSS value) */
  width?: string | number;
  /** Height (CSS value) */
  height?: string | number;
  /** Number of skeleton items to render */
  count?: number;
  /** Additional CSS class */
  className?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  count = 1,
  className = '',
}: SkeletonProps) {
  const getStyle = () => {
    const style: React.CSSProperties = {};
    
    if (width !== undefined) {
      style.width = typeof width === 'number' ? `${width}px` : width;
    }
    
    if (height !== undefined) {
      style.height = typeof height === 'number' ? `${height}px` : height;
    }
    
    return style;
  };

  const skeletonClass = `skeleton skeleton-${variant} ${className}`.trim();

  if (count === 1) {
    return (
      <div
        className={skeletonClass}
        style={getStyle()}
        role="status"
        aria-label="Loading..."
        aria-busy="true"
      >
        <span className="skeleton-shimmer" aria-hidden="true" />
      </div>
    );
  }

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={skeletonClass}
          style={getStyle()}
          role="status"
          aria-label="Loading..."
          aria-busy="true"
        >
          <span className="skeleton-shimmer" aria-hidden="true" />
        </div>
      ))}
    </>
  );
}

/**
 * Skeleton Card - Pre-configured skeleton for card layouts
 */
export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <Skeleton variant="rectangle" height={150} />
      <div style={{ padding: 'var(--spacing-md)' }}>
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" width="80%" height={16} />
        <Skeleton variant="text" width="40%" height={16} />
      </div>
    </div>
  );
}

/**
 * Skeleton List - Pre-configured skeleton for list items
 */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-list-item">
          <Skeleton variant="circle" width={48} height={48} />
          <div className="skeleton-list-content">
            <Skeleton variant="text" width="70%" height={20} />
            <Skeleton variant="text" width="50%" height={16} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Table - Pre-configured skeleton for table rows
 */
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="skeleton-table">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="skeleton-table-cell">
              <Skeleton variant="text" width="80%" height={16} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
