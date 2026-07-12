/**
 * TruckCheckDemo — marketing-page demo of the guided vehicle check workflow.
 *
 * Plays like a screen recording: while on screen, checklist items resolve one
 * by one (one deliberately flags an issue), the progress bar fills, a summary
 * appears, then the loop resets. Honors reduced motion by rendering the
 * completed state statically. No network calls — pure local state.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Droplets, Truck } from 'lucide-react';
import { useInView } from '../../../hooks/useInView';
import { useReducedMotion } from '../../../utils/animations';
import './TruckCheckDemo.css';

type ItemStatus = 'pending' | 'checking' | 'pass' | 'issue';

interface DemoCheckItem {
  id: string;
  label: string;
  reading?: string;
  issueNote?: string;
}

const DEMO_ITEMS: DemoCheckItem[] = [
  { id: 'fuel', label: 'Fuel level', reading: '¾ tank' },
  { id: 'water', label: 'Water tank level', reading: '3,000 L — full' },
  { id: 'pump', label: 'Pump operation & pressure', reading: '700 kPa' },
  { id: 'beacons', label: 'Emergency beacons & siren', issueNote: 'Left rear beacon cracked — logged for repair' },
  { id: 'hoses', label: 'Hoses & connections' },
  { id: 'firstaid', label: 'First aid kit' },
];

const STEP_MS = 1100;
const RESET_PAUSE_STEPS = 4; // extra ticks to hold the finished state before looping

export function TruckCheckDemo() {
  const [panelRef, inView] = useInView<HTMLDivElement>();
  const reducedMotion = useReducedMotion();
  // step counts resolved items; runs past the end to hold the summary on screen.
  const [step, setStep] = useState(() => (reducedMotion ? DEMO_ITEMS.length : 0));

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const timer = window.setInterval(() => {
      setStep((prev) => (prev >= DEMO_ITEMS.length + RESET_PAUSE_STEPS ? 0 : prev + 1));
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [inView, reducedMotion]);

  const resolvedCount = Math.min(step, DEMO_ITEMS.length);
  const complete = resolvedCount === DEMO_ITEMS.length;
  const progressPct = Math.round((resolvedCount / DEMO_ITEMS.length) * 100);

  const statusFor = (index: number): ItemStatus => {
    if (index < resolvedCount) return DEMO_ITEMS[index].issueNote ? 'issue' : 'pass';
    if (index === resolvedCount && !complete) return 'checking';
    return 'pending';
  };

  return (
    <div className="truckcheck-demo" ref={panelRef}>
      <div className="truckcheck-demo__topbar">
        <span className="truckcheck-demo__vehicle">
          <Truck size={16} strokeWidth={2} aria-hidden />
          Cat 1 — Heavy Tanker
        </span>
        <span className="truckcheck-demo__schedule">
          <Droplets size={14} strokeWidth={2} aria-hidden />
          Weekly check
        </span>
      </div>

      <div
        className="truckcheck-demo__progress"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Vehicle check progress"
      >
        <span className="truckcheck-demo__progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <ul className="truckcheck-demo__list">
        {DEMO_ITEMS.map((item, index) => {
          const status = statusFor(index);
          return (
            <li key={item.id} className={`truckcheck-demo__item truckcheck-demo__item--${status}`}>
              <span className="truckcheck-demo__item-icon" aria-hidden="true">
                {status === 'pass' && <Check size={16} strokeWidth={3} />}
                {status === 'issue' && <AlertTriangle size={16} strokeWidth={2.5} />}
              </span>
              <span className="truckcheck-demo__item-body">
                <span className="truckcheck-demo__item-label">{item.label}</span>
                {status === 'pass' && item.reading && (
                  <span className="truckcheck-demo__item-reading">{item.reading}</span>
                )}
                {status === 'issue' && item.issueNote && (
                  <span className="truckcheck-demo__item-note">{item.issueNote}</span>
                )}
              </span>
              <span className="truckcheck-demo__item-state" aria-hidden="true">
                {status === 'checking' ? 'Checking…' : ''}
              </span>
            </li>
          );
        })}
      </ul>

      <div
        className={`truckcheck-demo__summary${complete ? ' truckcheck-demo__summary--visible' : ''}`}
        aria-hidden={!complete}
      >
        <AlertTriangle size={16} strokeWidth={2.5} aria-hidden />
        Check complete — 1 issue flagged to the captain, instantly.
      </div>
    </div>
  );
}
