/**
 * InsightCard Component
 *
 * Displays a contextual insight with severity-based visual indicators.
 * Used in the AI Station Pulse and throughout reports to highlight
 * important trends, anomalies, and recommendations.
 *
 * Props:
 * - type: Severity level ('success' | 'warning' | 'critical' | 'info')
 * - title: Insight headline
 * - message: Main insight description
 * - recommendation: Optional actionable recommendation
 */

import { motion } from 'framer-motion';
import './InsightCard.css';

interface InsightCardProps {
  type: 'success' | 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  recommendation?: string;
}

const ICON_MAP = {
  success: '✓',
  warning: '⚠',
  critical: '!',
  info: 'ℹ',
};

export function InsightCard({ type, title, message, recommendation }: InsightCardProps) {
  return (
    <motion.div
      className={`insight-card insight-card--${type}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      role="article"
      aria-labelledby={`insight-title-${title.replace(/\s+/g, '-')}`}
    >
      <div className="insight-card__icon" aria-hidden="true">
        {ICON_MAP[type]}
      </div>
      <div className="insight-card__content">
        <h3
          className="insight-card__title"
          id={`insight-title-${title.replace(/\s+/g, '-')}`}
        >
          {title}
        </h3>
        <p className="insight-card__message">{message}</p>
        {recommendation && (
          <div className="insight-card__recommendation">
            <strong>Recommendation:</strong> {recommendation}
          </div>
        )}
      </div>
    </motion.div>
  );
}
