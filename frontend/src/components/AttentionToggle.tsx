/**
 * AttentionToggle Component
 *
 * Toggle switch for filtering content to show only critical/urgent items.
 * Provides "Show critical issues" functionality for report sections.
 *
 * Props:
 * - label: Toggle label text
 * - enabled: Whether filtering is enabled
 * - onChange: Callback when toggle state changes
 * - issueCount: Number of issues/critical items (displayed as badge)
 */

import { motion } from 'framer-motion';
import './AttentionToggle.css';

interface AttentionToggleProps {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  issueCount?: number;
}

export function AttentionToggle({
  label,
  enabled,
  onChange,
  issueCount = 0,
}: AttentionToggleProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(!enabled);
    }
  };

  return (
    <div className="attention-toggle">
      <button
        className={`attention-toggle__button ${enabled ? 'attention-toggle__button--active' : ''}`}
        onClick={() => onChange(!enabled)}
        onKeyDown={handleKeyDown}
        role="switch"
        aria-checked={enabled}
        aria-label={`${label}${issueCount > 0 ? `, ${issueCount} issues found` : ''}`}
        type="button"
      >
        <span className="attention-toggle__icon" aria-hidden="true">
          {enabled ? '👁️' : '⚠️'}
        </span>
        <span className="attention-toggle__label">{label}</span>
        {issueCount > 0 && (
          <motion.span
            className="attention-toggle__badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {issueCount}
          </motion.span>
        )}
      </button>

      {enabled && issueCount === 0 && (
        <motion.div
          className="attention-toggle__message"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <span className="attention-toggle__success-icon" aria-hidden="true">
            ✓
          </span>
          No critical issues found
        </motion.div>
      )}
    </div>
  );
}
