/**
 * SignInDemo — interactive marketing-page demo of one-tap station sign-in.
 *
 * A miniature kiosk: tap any member chip to sign them in or out, exactly like
 * the real sign-in book. While the panel is on screen an auto-play loop signs
 * members in one by one (pausing whenever the visitor interacts) and a live
 * feed mirrors what every synced device would show. No network calls — pure
 * local state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RadioTower } from 'lucide-react';
import { useInView } from '../../../hooks/useInView';
import { prefersReducedMotion, useReducedMotion } from '../../../utils/animations';
import './SignInDemo.css';

interface FeedEntry {
  id: number;
  text: string;
}

/** Board + feed evolve together so every transition is one pure state update
 * (StrictMode double-invokes updaters — side effects inside them duplicate
 * feed lines). */
interface BoardState {
  signedIn: ReadonlySet<string>;
  feed: FeedEntry[];
  nextFeedId: number;
}

interface DemoMember {
  id: string;
  name: string;
  role: string;
  activity: string;
}

const DEMO_MEMBERS: DemoMember[] = [
  { id: 'm1', name: 'Sarah M.', role: 'Captain', activity: 'Incident' },
  { id: 'm2', name: 'Dave K.', role: 'Deputy', activity: 'Incident' },
  { id: 'm3', name: 'Priya S.', role: 'Firefighter', activity: 'Training' },
  { id: 'm4', name: 'Tom B.', role: 'Firefighter', activity: 'Training' },
  { id: 'm5', name: 'Grace L.', role: 'Firefighter', activity: 'Maintenance' },
  { id: 'm6', name: 'Macca R.', role: 'Firefighter', activity: 'Maintenance' },
];

const AUTOPLAY_INTERVAL_MS = 2200;
const INTERACTION_PAUSE_MS = 6000;
const MAX_FEED_ENTRIES = 3;

/** Pure transition: toggle one member and record the matching feed line. */
function toggleOnBoard(prev: BoardState, member: DemoMember): BoardState {
  const signedIn = new Set(prev.signedIn);
  const text = signedIn.has(member.id)
    ? `${member.name} signed out — synced to all devices`
    : `${member.name} on station — ${member.activity}`;
  if (signedIn.has(member.id)) {
    signedIn.delete(member.id);
  } else {
    signedIn.add(member.id);
  }
  return {
    signedIn,
    feed: [{ id: prev.nextFeedId, text }, ...prev.feed].slice(0, MAX_FEED_ENTRIES),
    nextFeedId: prev.nextFeedId + 1,
  };
}

export function SignInDemo() {
  const [panelRef, inView] = useInView<HTMLDivElement>();
  const reducedMotion = useReducedMotion();
  const [board, setBoard] = useState<BoardState>(() => ({
    // Reduced motion skips the autoplay loop, so start with a populated board.
    signedIn: prefersReducedMotion() ? new Set(['m1', 'm3']) : new Set(),
    feed: [],
    nextFeedId: 1,
  }));
  const pausedUntilRef = useRef(0);

  const toggleMember = useCallback((member: DemoMember, viaTap: boolean) => {
    if (viaTap) {
      pausedUntilRef.current = Date.now() + INTERACTION_PAUSE_MS;
    }
    setBoard((prev) => toggleOnBoard(prev, member));
  }, []);

  // Autoplay: sign members in one at a time while visible, then reset.
  useEffect(() => {
    if (!inView || reducedMotion) return;

    const timer = window.setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return;
      setBoard((prev) => {
        const nextMember = DEMO_MEMBERS.find((m) => !prev.signedIn.has(m.id));
        if (!nextMember) {
          // Everyone is on station — quietly reset the board for the next pass.
          return { signedIn: new Set(), feed: [], nextFeedId: prev.nextFeedId };
        }
        return toggleOnBoard(prev, nextMember);
      });
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [inView, reducedMotion]);

  const { signedIn, feed } = board;
  const onStationCount = signedIn.size;

  return (
    <div className="signin-demo" ref={panelRef}>
      <div className="signin-demo__topbar">
        <span className="signin-demo__title">Brigade Sign-In</span>
        <span className="signin-demo__sync" aria-live="off">
          <span className="signin-demo__sync-dot" aria-hidden="true" />
          <RadioTower size={14} strokeWidth={2} aria-hidden />
          Synced to 3 devices
        </span>
      </div>

      <div className="signin-demo__grid" role="group" aria-label="Demo member sign-in grid — tap a name to sign them in">
        {DEMO_MEMBERS.map((member) => {
          const isIn = signedIn.has(member.id);
          return (
            <button
              key={member.id}
              type="button"
              className={`signin-demo__chip${isIn ? ' signin-demo__chip--in' : ''}`}
              onClick={() => toggleMember(member, true)}
              aria-pressed={isIn}
              aria-label={`${member.name}, ${member.role} — ${isIn ? 'on station, tap to sign out' : 'tap to sign in'}`}
            >
              <span className="signin-demo__avatar" aria-hidden="true">
                {member.name.charAt(0)}
              </span>
              <span className="signin-demo__chip-body">
                <span className="signin-demo__chip-name">{member.name}</span>
                <span className="signin-demo__chip-role">{isIn ? member.activity : member.role}</span>
              </span>
              <span className="signin-demo__chip-status" aria-hidden="true">
                {isIn ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>

      <div className="signin-demo__footer">
        <span className="signin-demo__count">
          {onStationCount} {onStationCount === 1 ? 'member' : 'members'} on station
        </span>
        <ul className="signin-demo__feed" aria-label="Live sign-in feed">
          {feed.map((entry) => (
            <li key={entry.id} className="signin-demo__feed-item">
              {entry.text}
            </li>
          ))}
          {feed.length === 0 && <li className="signin-demo__feed-item signin-demo__feed-item--empty">Tap a name above — that&rsquo;s the whole sign-in.</li>}
        </ul>
      </div>
    </div>
  );
}
