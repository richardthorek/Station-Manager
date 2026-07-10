/**
 * Voice Check Page (A3 inc 3) — push-to-talk truck check with the AI agent.
 *
 * Connects to /ws/agent-check, streams push-to-talk audio to the backend
 * (server-side Azure STT → tool loop → server-side Azure TTS), renders the
 * running transcript, and plays the agent's spoken replies. A text composer
 * doubles as the fallback for quiet environments and as the debug surface.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../services/api';
import { VoiceAgentClient } from './voiceAgentClient';
import { MicCapture, playAudioBlob, unlockAudioPlayback } from './audioIO';
import './VoiceCheckPage.css';

type Role = 'user' | 'agent' | 'status';

interface TranscriptEntry {
  id: number;
  role: Role;
  text: string;
}

type ConnectionState = 'connecting' | 'ready' | 'reconnecting' | 'closed';

export function VoiceCheckPage() {
  const { applianceId } = useParams<{ applianceId: string }>();
  const [applianceName, setApplianceName] = useState<string>('');
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [runId, setRunId] = useState<string | undefined>();
  const [draft, setDraft] = useState('');

  const clientRef = useRef<VoiceAgentClient | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const holdingRef = useRef(false);
  const nextIdRef = useRef(0);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const addEntry = useCallback((role: Role, text: string) => {
    setEntries((prev) => [...prev, { id: nextIdRef.current++, role, text }]);
  }, []);

  useEffect(() => {
    if (!applianceId) return;

    api.getAppliance(applianceId)
      .then((appliance) => setApplianceName(appliance.name))
      .catch(() => setApplianceName(''));

    const mic = new MicCapture();
    micRef.current = mic;

    const client = new VoiceAgentClient({
      onSessionStarted: (sessionId, resumed) => {
        setConnection('ready');
        if (resumed) {
          // A dropped connection resumed into its previous session (A3 code
          // review F9) — pull the persisted turn history back so the visible
          // transcript matches what the server actually has, instead of
          // silently starting from a blank slate.
          api.getAgentSessionTurns(sessionId)
            .then((turns) => {
              nextIdRef.current = 0;
              setEntries(
                turns
                  .filter((t) => (t.role === 'user' || t.role === 'agent') && t.text)
                  .map((t) => ({ id: nextIdRef.current++, role: t.role as Role, text: t.text ?? '' })),
              );
            })
            .catch(() => addEntry('status', 'Reconnected, but could not restore the earlier transcript.'));
        }
      },
      onReconnecting: () => {
        setConnection('reconnecting');
      },
      onTranscript: (text) => {
        if (text) addEntry('user', text);
      },
      onAgentText: (text, isCompleted, turnRunId) => {
        addEntry('agent', text);
        setBusy(false);
        if (turnRunId) setRunId(turnRunId);
        if (isCompleted) setCompleted(true);
      },
      onAgentAudio: (audio) => {
        playAudioBlob(audio, (message) => addEntry('status', message));
      },
      onBusy: () => {
        // The server rejected whatever we just sent because a previous turn
        // hadn't finished yet. Without this, `busy` (already set true by the
        // action that triggered it) would never clear and the talk button /
        // composer would stay disabled forever with no explanation — the
        // only way out was reloading the page, which abandons the check
        // (A3 code review F11).
        setBusy(false);
        addEntry('status', 'Still working on the last message — try that again in a moment.');
      },
      onError: (error) => {
        addEntry('status', error);
        setBusy(false);
      },
      onClose: () => {
        setConnection('closed');
        setBusy(false);
        setRecording(false);
      },
    });
    clientRef.current = client;
    client.connect({ applianceId });

    return () => {
      mic.stop();
      client.endSession();
      client.close();
    };
  }, [applianceId, addEntry]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [entries]);

  const canInteract = connection === 'ready' && !busy && !completed;

  const startHold = useCallback(async (event: PointerEvent<HTMLButtonElement>) => {
    if (!canInteract || holdingRef.current) return;
    // Pointer capture keeps pointerup/pointercancel targeted at this button
    // even if the finger drifts off its bounds mid-press (gloves, wet hands,
    // gesturing while talking) — without it, onPointerLeave was the only
    // signal for "finger moved off the button" and fired on ordinary drift,
    // truncating the utterance mid-sentence with no warning
    // (A3 code review F16).
    event.currentTarget.setPointerCapture(event.pointerId);
    // Unlock playback synchronously, still within this gesture's call stack —
    // iOS Safari blocks .play() outside a gesture, so doing this later (when
    // the agent's audio actually arrives, asynchronously) would be too late.
    unlockAudioPlayback();
    holdingRef.current = true;
    setRecording(true);
    clientRef.current?.startUtterance();
    try {
      await micRef.current?.start((pcm) => {
        if (holdingRef.current) clientRef.current?.sendAudioChunk(pcm);
      });
      // Released before the mic came up — finish the (empty) utterance cleanly.
      if (!holdingRef.current) micRef.current?.stop();
    } catch {
      holdingRef.current = false;
      setRecording(false);
      addEntry('status', 'Microphone unavailable — check browser permissions, or type instead.');
      clientRef.current?.endUtterance();
    }
  }, [canInteract, addEntry]);

  const endHold = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (!holdingRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    holdingRef.current = false;
    micRef.current?.stop();
    setRecording(false);
    setBusy(true);
    clientRef.current?.endUtterance();
  }, []);

  const sendDraft = useCallback(() => {
    const text = draft.trim();
    if (!text || !canInteract) return;
    addEntry('user', text);
    setBusy(true);
    setDraft('');
    clientRef.current?.sendText(text, false);
  }, [draft, canInteract, addEntry]);

  const connectionLabels: Record<ConnectionState, string> = {
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting…',
    closed: 'Disconnected',
    ready: recording ? 'Listening…' : busy ? 'Thinking…' : 'Ready',
  };
  const statusLabel = completed ? 'Check complete' : connectionLabels[connection];

  return (
    <div className="voice-check-page">
      <header className="voice-check-header">
        <Link to="/truckcheck" className="back-link">← Vehicle Check</Link>
        <h1>Voice Check{applianceName ? ` — ${applianceName}` : ''}</h1>
        <span className={`voice-status voice-status--${completed ? 'complete' : connection}`}>{statusLabel}</span>
      </header>

      <main className="voice-check-main">
        <div className="voice-transcript" role="log" aria-live="polite" aria-label="Conversation transcript">
          {entries.length === 0 && (
            <p className="voice-transcript-hint">
              Hold the talk button and describe each item as you walk around the truck.
              The agent records results for you and flags any issues.
            </p>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className={`voice-bubble voice-bubble--${entry.role}`}>
              {entry.text}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>

        {completed && runId && (
          <Link to={`/truckcheck/summary/${runId}`} className="voice-summary-link">
            View check summary →
          </Link>
        )}

        <div className="voice-controls">
          <button
            type="button"
            className={`voice-talk-button${recording ? ' voice-talk-button--recording' : ''}`}
            disabled={!canInteract && !recording}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            aria-pressed={recording}
          >
            {recording ? '🎙 Release to send' : '🎙 Hold to talk'}
          </button>

          <form
            className="voice-composer"
            onSubmit={(event) => {
              event.preventDefault();
              sendDraft();
            }}
          >
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Or type instead…"
              aria-label="Type a message to the agent"
              disabled={!canInteract}
            />
            <button type="submit" disabled={!canInteract || !draft.trim()}>Send</button>
          </form>
        </div>
      </main>
    </div>
  );
}
