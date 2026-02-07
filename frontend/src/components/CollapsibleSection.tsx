import { useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './CollapsibleSection.css';

interface CollapsibleSectionProps {
  /** Section title */
  title: string;
  /** Content to display when expanded */
  children: ReactNode;
  /** Default expanded state (default: true) */
  defaultExpanded?: boolean;
  /** localStorage key for persisting state (optional) */
  storageKey?: string;
  /** Badge count to display next to title (optional) */
  badgeCount?: number;
  /** CSS class name (optional) */
  className?: string;
}

/**
 * Collapsible Section Component
 *
 * Features:
 * - Expand/collapse with smooth animation
 * - Persistent state via localStorage (optional)
 * - Badge count indicator
 * - Touch-friendly (44px minimum touch target)
 * - Keyboard accessible
 */
export function CollapsibleSection({
  title,
  children,
  defaultExpanded = true,
  storageKey,
  badgeCount,
  className = '',
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? saved === 'true' : defaultExpanded;
    }
    return defaultExpanded;
  });

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, String(isExpanded));
    }
  }, [isExpanded, storageKey]);

  const toggleExpanded = () => {
    setIsExpanded(prev => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded();
    }
  };

  return (
    <div className={`collapsible-section ${className}`}>
      <button
        type="button"
        className="collapsible-header"
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-controls={`collapsible-content-${storageKey || title}`}
      >
        <span className="collapsible-title">
          {title}
          {badgeCount !== undefined && badgeCount > 0 && (
            <span className="collapsible-badge" aria-label={`${badgeCount} items`}>
              {badgeCount}
            </span>
          )}
        </span>
        <span
          className={`collapsible-icon ${isExpanded ? 'expanded' : 'collapsed'}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={`collapsible-content-${storageKey || title}`}
            className="collapsible-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="collapsible-content-inner">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
