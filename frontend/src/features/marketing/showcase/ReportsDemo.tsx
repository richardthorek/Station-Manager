/**
 * ReportsDemo — marketing-page demo of reports & analytics.
 *
 * KPI tiles count up and a six-month volunteer-hours bar chart grows into
 * place when scrolled into view, like a dashboard loading on screen. Single
 * series (validated #2563EB via --ui-blue on light and dark surfaces), peak
 * bar direct-labelled, per-bar hover/focus tooltips. No network calls.
 */

import { useEffect, useState } from 'react';
import { BarChart3, FileDown } from 'lucide-react';
import { useInView } from '../../../hooks/useInView';
import { useReducedMotion } from '../../../utils/animations';
import './ReportsDemo.css';

interface MonthDatum {
  month: string;
  hours: number;
}

const MONTHS: MonthDatum[] = [
  { month: 'Feb', hours: 148 },
  { month: 'Mar', hours: 176 },
  { month: 'Apr', hours: 139 },
  { month: 'May', hours: 214 },
  { month: 'Jun', hours: 187 },
  { month: 'Jul', hours: 201 },
];

const MAX_HOURS = Math.max(...MONTHS.map((m) => m.hours));
const TOTAL_HOURS = MONTHS.reduce((sum, m) => sum + m.hours, 0);
const COUNT_UP_MS = 900;
const COUNT_UP_FRAMES = 30;

/** Counts a stat tile up from 0 once the panel scrolls into view. */
function useCountUp(target: number, active: boolean, reducedMotion: boolean): number {
  const [value, setValue] = useState(() => (reducedMotion ? target : 0));

  useEffect(() => {
    if (!active || reducedMotion) return;
    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      const t = Math.min(frame / COUNT_UP_FRAMES, 1);
      // Ease-out so the tally slows as it lands on the real figure.
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) window.clearInterval(timer);
    }, COUNT_UP_MS / COUNT_UP_FRAMES);
    return () => window.clearInterval(timer);
  }, [active, reducedMotion, target]);

  return value;
}

export function ReportsDemo() {
  const [panelRef, inView] = useInView<HTMLDivElement>();
  const reducedMotion = useReducedMotion();
  const [started, setStarted] = useState(reducedMotion);

  useEffect(() => {
    if (inView) setStarted(true);
  }, [inView]);

  const hoursValue = useCountUp(TOTAL_HOURS, started, reducedMotion);
  const checksValue = useCountUp(96, started, reducedMotion);

  return (
    <div className="reports-demo" ref={panelRef}>
      <div className="reports-demo__topbar">
        <span className="reports-demo__title">
          <BarChart3 size={16} strokeWidth={2} aria-hidden />
          Brigade dashboard
        </span>
        <span className="reports-demo__export">
          <FileDown size={14} strokeWidth={2} aria-hidden />
          Export CSV
        </span>
      </div>

      <div className="reports-demo__kpis">
        <div className="reports-demo__kpi">
          <span className="reports-demo__kpi-value">{hoursValue.toLocaleString()}</span>
          <span className="reports-demo__kpi-label">Volunteer hours — 6 months</span>
        </div>
        <div className="reports-demo__kpi">
          <span className="reports-demo__kpi-value">{checksValue}%</span>
          <span className="reports-demo__kpi-label">Truck checks on time</span>
        </div>
      </div>

      <figure className="reports-demo__chart-figure">
        <figcaption className="reports-demo__chart-title">Volunteer hours by month</figcaption>
        <div className={`reports-demo__chart${started ? ' reports-demo__chart--grown' : ''}`} role="img" aria-label={`Bar chart of volunteer hours by month: ${MONTHS.map((m) => `${m.month} ${m.hours}`).join(', ')}.`}>
          {MONTHS.map((datum) => {
            const isPeak = datum.hours === MAX_HOURS;
            return (
              <div key={datum.month} className="reports-demo__col">
                {isPeak && <span className="reports-demo__bar-label">{datum.hours}</span>}
                <div
                  className={`reports-demo__bar${isPeak ? ' reports-demo__bar--peak' : ''}`}
                  style={{ height: `${(datum.hours / MAX_HOURS) * 100}%` }}
                  tabIndex={0}
                  aria-label={`${datum.month}: ${datum.hours} hours`}
                >
                  <span className="reports-demo__tooltip" role="tooltip">
                    {datum.month} — {datum.hours} hrs
                  </span>
                </div>
                <span className="reports-demo__axis-label" aria-hidden="true">
                  {datum.month}
                </span>
              </div>
            );
          })}
        </div>
      </figure>
    </div>
  );
}
