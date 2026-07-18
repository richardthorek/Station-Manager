/**
 * ShowcaseSection — Apple-style scroll showcase on the marketing page.
 *
 * Alternating full-width blocks: explainer copy on one side, a stylised
 * "device frame" on the other playing a screen-recording-style animated demo
 * of the module (sign-in, truck checks, AAR Studio audio capture, reports).
 * Blocks reveal as you scroll (framer-motion whileInView) and each demo only
 * animates while on screen. Ends with a conversion CTA that hands off to the
 * pricing section directly below it.
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { getTransition, transitions } from '../../../utils/animations';
import { SignInDemo } from './SignInDemo';
import { TruckCheckDemo } from './TruckCheckDemo';
import { AarDemo } from './AarDemo';
import { ReportsDemo } from './ReportsDemo';
import './ShowcaseSection.css';

interface ShowcaseBlockProps {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  points: string[];
  demoLabel: string;
  demo: ReactNode;
  /** Flip the frame to the left of the copy on wide screens. */
  reverse?: boolean;
}

const revealVariants = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
};

function ShowcaseBlock({ id, eyebrow, title, lead, points, demoLabel, demo, reverse }: ShowcaseBlockProps) {
  return (
    <motion.article
      className={`showcase-block${reverse ? ' showcase-block--reverse' : ''}`}
      aria-labelledby={`${id}-title`}
      variants={revealVariants}
      initial="initial"
      whileInView="whileInView"
      viewport={{ once: true, amount: 0.25 }}
      transition={getTransition(transitions.slow)}
    >
      <div className="showcase-block__copy">
        <p className="showcase-block__eyebrow">{eyebrow}</p>
        <h3 className="showcase-block__title" id={`${id}-title`}>
          {title}
        </h3>
        <p className="showcase-block__lead">{lead}</p>
        <ul className="showcase-block__points">
          {points.map((point) => (
            <li key={point} className="showcase-block__point">
              <span className="showcase-block__point-icon" aria-hidden="true">
                <Check size={16} strokeWidth={3} />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div className="showcase-block__stage">
        <div className="showcase-frame">
          <div className="showcase-frame__chrome" aria-hidden="true">
            <span className="showcase-frame__dot" />
            <span className="showcase-frame__dot" />
            <span className="showcase-frame__dot" />
            <span className="showcase-frame__chrome-label">{demoLabel}</span>
            <span className="showcase-frame__live">● Live demo</span>
          </div>
          <div className="showcase-frame__screen">{demo}</div>
        </div>
      </div>
    </motion.article>
  );
}

export function ShowcaseSection() {
  return (
    <section className="showcase" aria-labelledby="showcase-heading">
      <motion.header
        className="showcase__intro"
        variants={revealVariants}
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, amount: 0.4 }}
        transition={getTransition(transitions.slow)}
      >
        <p className="showcase__intro-eyebrow">See it in action</p>
        <h2 id="showcase-heading" className="showcase__intro-title">
          The whole station, running itself
        </h2>
        <p className="showcase__intro-lead">
          These aren&rsquo;t mock-ups — they&rsquo;re live, working miniatures of the real thing.
          Watch them run, or reach in and tap.
        </p>
      </motion.header>

      <ShowcaseBlock
        id="showcase-signin"
        eyebrow="Station Sign-In"
        title="One tap, and the whole brigade knows"
        lead="No paper book, no logins, no typing. A member taps their name on the kiosk and every synced device — the wall tablet, the captain's phone, the ops screen — updates in the same second."
        points={[
          'One-tap sign-in and sign-out, built for gloves and 60px targets',
          'Activity tracking: incidents, training, maintenance, hazard reductions',
          'Real-time sync across every kiosk, tablet and phone — no refresh, no polling',
        ]}
        demoLabel="stationkit.com.au/signin"
        demo={<SignInDemo />}
      />

      <ShowcaseBlock
        id="showcase-truckcheck"
        eyebrow="Truck Checks"
        title="Truck checks that actually get done"
        lead="Guided checklists for every appliance, from Cat 1 tankers to command vehicles. Faults don't wait in a paper diary — the moment a check flags an issue, the captain knows."
        points={[
          'Per-appliance templates with readings, photos and notes',
          'Issues flagged to the captain instantly, with a full audit trail',
          'Trends across brigades: spot the truck that keeps failing the same check',
        ]}
        demoLabel="stationkit.com.au/truckcheck"
        demo={<TruckCheckDemo />}
        reverse
      />

      <ShowcaseBlock
        id="showcase-aar"
        eyebrow="AAR Studio · AI"
        title="Debriefs that write themselves"
        lead="Put a phone on the table and run the debrief like a conversation. AAR Studio listens, transcribes every speaker live, and builds the findings board — what to sustain, what to improve, what to action — while the crew is still talking."
        points={[
          'Live audio capture and speaker-by-speaker transcription',
          'AI sorts the discussion into Sustain / Improve / Action findings',
          'Export a polished AAR report before the crew has packed up',
        ]}
        demoLabel="stationkit.com.au/aar"
        demo={<AarDemo />}
      />

      <ShowcaseBlock
        id="showcase-reports"
        eyebrow="Reports & Analytics"
        title="Every hour counted, every claim covered"
        lead="Volunteer hours, attendance, truck-check compliance — tallied automatically from the sign-in book you're already keeping. Export a CSV for grants and audits in one click."
        points={[
          'Volunteer-hour and attendance reporting, per member or per event',
          'Truck-check compliance at a glance across the whole brigade',
          'One-click CSV exports for grant claims and annual returns',
        ]}
        demoLabel="stationkit.com.au/reports"
        demo={<ReportsDemo />}
        reverse
      />

      <motion.div
        className="showcase-cta"
        variants={revealVariants}
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, amount: 0.4 }}
        transition={getTransition(transitions.slow)}
      >
        <h2 className="showcase-cta__title">Ready to bring this to your station?</h2>
        <p className="showcase-cta__lead">
          Set up your brigade in under ten minutes. Start on the free Community plan — no card required — and upgrade whenever you&rsquo;re ready.
        </p>
        <div className="showcase-cta__actions">
          <Link to="/signup" className="showcase-cta__primary">
            Get started free
            <span className="arrow" aria-hidden="true">→</span>
          </Link>
          <a href="#pricing" className="showcase-cta__secondary">
            See plans below
          </a>
        </div>
      </motion.div>
    </section>
  );
}
