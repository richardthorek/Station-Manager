/**
 * KPI Card Component
 *
 * Displays a key performance indicator with:
 * - Count-up animation on mount
 * - Gradient background
 * - Sparkline trend chart
 * - Trend indicator (up/down arrow with percentage)
 *
 * Props:
 * - title: Card title
 * - value: Current value (number)
 * - previousValue: Previous period value for comparison
 * - suffix: Optional suffix (%, hours, etc.)
 * - sparklineData: Array of numbers for mini trend chart
 * - color: Color theme ('red' | 'lime' | 'blue' | 'green' | 'amber')
 * - icon: Optional icon component
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import './KPICard.css';

interface KPICardProps {
  title: string;
  value: number;
  previousValue?: number;
  suffix?: string;
  sparklineData?: number[];
  color?: 'red' | 'lime' | 'blue' | 'green' | 'amber';
  icon?: React.ReactNode;
  decimals?: number;
}

export function KPICard({
  title,
  value,
  previousValue,
  suffix = '',
  sparklineData = [],
  color = 'red',
  icon,
  decimals = 0,
}: KPICardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  // Count-up animation
  useEffect(() => {
    const duration = 1000; // 1 second
    const steps = 60;
    const stepValue = value / steps;
    const stepDuration = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(stepValue * currentStep);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value]);

  // Calculate trend percentage
  const trendPercentage = previousValue && previousValue !== 0
    ? ((value - previousValue) / previousValue) * 100
    : 0;

  const isPositive = trendPercentage > 0;
  const isNegative = trendPercentage < 0;

  // Format sparkline data for recharts
  const chartData = sparklineData.map((val, index) => ({ value: val, index }));

  return (
    <motion.div
      className={`kpi-card kpi-card--${color}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="kpi-card__header">
        <h3 className="kpi-card__title">{title}</h3>
        {icon && <div className="kpi-card__icon">{icon}</div>}
      </div>

      <div className="kpi-card__content">
        <div className="kpi-card__value">
          {displayValue.toFixed(decimals)}{suffix}
        </div>

        {previousValue !== undefined && trendPercentage !== 0 && (
          <div className={`kpi-card__trend ${isPositive ? 'kpi-card__trend--up' : ''} ${isNegative ? 'kpi-card__trend--down' : ''}`}>
            {isPositive && <span className="kpi-card__trend-arrow">↑</span>}
            {isNegative && <span className="kpi-card__trend-arrow">↓</span>}
            <span className="kpi-card__trend-value">
              {Math.abs(trendPercentage).toFixed(1)}%
            </span>
            <span className="kpi-card__trend-label">vs previous period</span>
          </div>
        )}
      </div>

      {sparklineData.length > 0 && (
        <div className="kpi-card__sparkline">
          <ResponsiveContainer width="100%" height={40}>
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="currentColor"
                strokeWidth={2}
                dot={false}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
