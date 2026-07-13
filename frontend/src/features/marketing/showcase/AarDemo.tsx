/**
 * AarDemo — marketing-page demo of AAR Studio's audio capture + AI findings.
 *
 * Plays like a screen recording: an animated waveform "records" the debrief,
 * transcript lines appear with speaker labels (adapted from the bundled AAR
 * Studio sample session), and AI findings slide onto the Sustain / Improve /
 * Action board as the discussion progresses. Loops while on screen; reduced
 * motion renders the completed state. No network calls — pure local state.
 */

import { useEffect, useState } from 'react';
import { Mic, Sparkles } from 'lucide-react';
import { useInView } from '../../../hooks/useInView';
import { useReducedMotion } from '../../../utils/animations';
import './AarDemo.css';

interface TranscriptLine {
  speaker: string;
  text: string;
}

interface Finding {
  kind: 'sustain' | 'improve' | 'action';
  label: string;
  text: string;
}

const TRANSCRIPT: TranscriptLine[] = [
  {
    speaker: 'Pump operator',
    text: 'Honest call from me — I set the pump up ten metres from the smoke. Should have set up further back; you can always move up.',
  },
  {
    speaker: 'Captain',
    text: 'The overhead imagery just doesn’t show the driveway topography at all. We couldn’t do a proper 360 until thirty minutes in.',
  },
  {
    speaker: 'Pump operator',
    text: 'Once the ground monitor was going at eight hundred litres a minute it knocked it down — and we actually conserved water doing it.',
  },
];

const FINDINGS: Finding[] = [
  { kind: 'improve', label: 'Improve', text: 'Set the pump further back on arrival — you can always move up.' },
  { kind: 'action', label: 'Action', text: 'Request updated access imagery for rural properties in the area.' },
  { kind: 'sustain', label: 'Sustain', text: 'Ground-monitor tactics knocked the fire down and conserved water.' },
];

// Each tick reveals one transcript line, then one finding, then holds and loops.
const TOTAL_STEPS = TRANSCRIPT.length + FINDINGS.length;
const STEP_MS = 2400;
const RESET_PAUSE_STEPS = 2;
const WAVE_BAR_COUNT = 28;
const WAVE_BARS = Array.from({ length: WAVE_BAR_COUNT }, (_, i) => i);

export function AarDemo() {
  const [panelRef, inView] = useInView<HTMLDivElement>();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(() => (reducedMotion ? TOTAL_STEPS : 0));

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const timer = window.setInterval(() => {
      setStep((prev) => (prev >= TOTAL_STEPS + RESET_PAUSE_STEPS ? 0 : prev + 1));
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [inView, reducedMotion]);

  const visibleLines = Math.min(step, TRANSCRIPT.length);
  const visibleFindings = Math.max(0, Math.min(step - TRANSCRIPT.length, FINDINGS.length));
  const recording = !reducedMotion && inView && step < TOTAL_STEPS;
  // Fake session clock keyed to progress so the loop reads like a recording.
  const clock = `${String(12 + Math.min(step, TOTAL_STEPS)).padStart(2, '0')}:${String((17 + step * 9) % 60).padStart(2, '0')}`;

  return (
    <div className="aar-demo" ref={panelRef}>
      <div className="aar-demo__topbar">
        <span className="aar-demo__title">
          <Mic size={16} strokeWidth={2} aria-hidden />
          Structure fire debrief
        </span>
        <span className={`aar-demo__rec${recording ? ' aar-demo__rec--live' : ''}`}>
          <span className="aar-demo__rec-dot" aria-hidden="true" />
          {recording ? 'Recording' : 'Captured'} {clock}
        </span>
      </div>

      <div className={`aar-demo__wave${recording ? ' aar-demo__wave--live' : ''}`} aria-hidden="true">
        {WAVE_BARS.map((i) => (
          <span key={i} className="aar-demo__wave-bar" />
        ))}
      </div>

      <ul className="aar-demo__transcript" aria-label="Live transcript">
        {TRANSCRIPT.slice(0, visibleLines).map((line) => (
          <li key={line.speaker + line.text.slice(0, 12)} className="aar-demo__line">
            <span className="aar-demo__speaker">{line.speaker}</span>
            <span className="aar-demo__text">{line.text}</span>
          </li>
        ))}
      </ul>

      <div className="aar-demo__board">
        <span className="aar-demo__board-title">
          <Sparkles size={14} strokeWidth={2} aria-hidden />
          AI findings board
        </span>
        <ul className="aar-demo__findings" aria-label="AI-extracted findings">
          {FINDINGS.slice(0, visibleFindings).map((finding) => (
            <li key={finding.kind} className={`aar-demo__finding aar-demo__finding--${finding.kind}`}>
              <span className="aar-demo__finding-label">{finding.label}</span>
              <span className="aar-demo__finding-text">{finding.text}</span>
            </li>
          ))}
          {visibleFindings === 0 && (
            <li className="aar-demo__finding aar-demo__finding--placeholder">
              Findings appear here as the crew talks…
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
