/**
 * TrendExplainer Component
 *
 * Provides plain-language explanations and context for chart data.
 * Displays as an info button that shows a tooltip on hover/click.
 *
 * Props:
 * - explanation: Plain-language description of what the data means
 * - recommendation: Optional actionable recommendation
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './TrendExplainer.css';

interface TrendExplainerProps {
  explanation: string;
  recommendation?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function TrendExplainer({
  explanation,
  recommendation,
  position = 'bottom',
}: TrendExplainerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="trend-explainer">
      <button
        className="trend-explainer__button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-label="Show trend explanation"
        aria-expanded={isOpen}
        aria-haspopup="true"
        type="button"
      >
        <span className="trend-explainer__icon" aria-hidden="true">
          ℹ
        </span>
        <span className="trend-explainer__label">Why is this important?</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              className="trend-explainer__backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* Tooltip */}
            <motion.div
              className={`trend-explainer__tooltip trend-explainer__tooltip--${position}`}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              role="tooltip"
              aria-live="polite"
            >
              <button
                className="trend-explainer__close"
                onClick={() => setIsOpen(false)}
                aria-label="Close explanation"
                type="button"
              >
                ×
              </button>

              <div className="trend-explainer__content">
                <h4 className="trend-explainer__title">Understanding This Data</h4>
                <p className="trend-explainer__explanation">{explanation}</p>

                {recommendation && (
                  <div className="trend-explainer__recommendation">
                    <strong>Recommended Action:</strong>
                    <p>{recommendation}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
