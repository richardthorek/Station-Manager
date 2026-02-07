/**
 * Heat Map Chart Component
 *
 * Displays check-in patterns by day of week and hour of day
 * Shows intensity using color gradients
 *
 * Props:
 * - data: Array of check-in data with timestamps
 * - startDate: Start of date range
 * - endDate: End of date range
 */

import { useMemo } from 'react';
import './HeatMapChart.css';

interface HeatMapChartProps {
  data: Array<{ checkInTime: string }>;
  startDate: Date;
  endDate: Date;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function HeatMapChart({ data }: HeatMapChartProps) {
  // Process data into day/hour buckets
  const heatMapData = useMemo(() => {
    const buckets: Record<number, Record<number, number>> = {};

    // Initialize all buckets to 0
    for (let day = 0; day < 7; day++) {
      buckets[day] = {};
      for (let hour = 0; hour < 24; hour++) {
        buckets[day][hour] = 0;
      }
    }

    // Count check-ins by day and hour
    data.forEach((item) => {
      const date = new Date(item.checkInTime);
      const day = date.getDay();
      const hour = date.getHours();
      buckets[day][hour]++;
    });

    return buckets;
  }, [data]);

  // Find max value for color scaling
  const maxValue = useMemo(() => {
    let max = 0;
    Object.values(heatMapData).forEach((dayData) => {
      Object.values(dayData).forEach((count) => {
        max = Math.max(max, count);
      });
    });
    return max || 1; // Avoid division by zero
  }, [heatMapData]);

  // Get color intensity based on value
  const getColorIntensity = (value: number): string => {
    if (value === 0) return 'rgba(188, 190, 192, 0.1)'; // Light grey for empty
    const intensity = value / maxValue;
    const red = 229;
    const green = 40;
    const blue = 27;
    return `rgba(${red}, ${green}, ${blue}, ${intensity * 0.9 + 0.1})`;
  };

  return (
    <div className="heat-map">
      <div className="heat-map__chart">
        {/* Hour labels (top) */}
        <div className="heat-map__hours">
          <div className="heat-map__corner"></div>
          {HOURS.map((hour) => (
            <div key={hour} className="heat-map__hour-label">
              {hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
            </div>
          ))}
        </div>

        {/* Grid with day labels */}
        {DAYS.map((day, dayIndex) => (
          <div key={day} className="heat-map__row">
            <div className="heat-map__day-label">{day}</div>
            {HOURS.map((hour) => {
              const value = heatMapData[dayIndex]?.[hour] || 0;
              return (
                <div
                  key={hour}
                  className="heat-map__cell"
                  style={{ backgroundColor: getColorIntensity(value) }}
                  title={`${day} ${hour}:00 - ${value} check-ins`}
                  role="gridcell"
                  aria-label={`${day} ${hour}:00: ${value} check-ins`}
                >
                  {value > 0 && value}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="heat-map__legend">
        <span className="heat-map__legend-label">Less</span>
        <div className="heat-map__legend-scale">
          {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
            <div
              key={intensity}
              className="heat-map__legend-box"
              style={{
                backgroundColor:
                  intensity === 0
                    ? 'rgba(188, 190, 192, 0.1)'
                    : `rgba(229, 40, 27, ${intensity * 0.9 + 0.1})`,
              }}
            ></div>
          ))}
        </div>
        <span className="heat-map__legend-label">More</span>
      </div>

      {maxValue > 0 && (
        <div className="heat-map__info">
          Peak activity: {maxValue} check-ins
        </div>
      )}
    </div>
  );
}
