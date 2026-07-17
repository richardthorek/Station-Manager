import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { VoiceAgentEvents, VoiceAgentConnectOptions } from './voiceAgentClient';

const clientMock = {
  connect: vi.fn(),
  sendText: vi.fn(),
  startUtterance: vi.fn(),
  sendAudioChunk: vi.fn(),
  endUtterance: vi.fn(),
  endSession: vi.fn(),
  close: vi.fn(),
};
let capturedEvents: VoiceAgentEvents;

vi.mock('./voiceAgentClient', () => ({
  VoiceAgentClient: vi.fn().mockImplementation(function (events: VoiceAgentEvents) {
    capturedEvents = events;
    return clientMock;
  }),
}));

const micMock = { start: vi.fn(), stop: vi.fn(), isActive: false };
const playAudioBlobMock = vi.fn();
const unlockAudioPlaybackMock = vi.fn();
vi.mock('./audioIO', () => ({
  MicCapture: vi.fn().mockImplementation(function () {
    return micMock;
  }),
  playAudioBlob: (blob: Blob, onError?: (message: string) => void) => playAudioBlobMock(blob, onError),
  unlockAudioPlayback: () => unlockAudioPlaybackMock(),
}));

vi.mock('../../../services/api', () => ({
  api: {
    getAppliance: vi.fn().mockResolvedValue({ id: 'app-1', name: 'Tanker 1' }),
    getAgentSessionTurns: vi.fn(),
  },
}));

// Q28: voice check needs a real station context — default to "yes, one is
// selected" so the existing connect-on-mount tests below are unaffected;
// the no-station-context case gets its own test.
const isDefaultStationMock = vi.fn().mockReturnValue(false);
vi.mock('../../../contexts/StationContext', () => ({
  useStation: () => ({ isDefaultStation: isDefaultStationMock }),
}));

import { VoiceCheckPage } from './VoiceCheckPage';
import { api } from '../../../services/api';

const getAgentSessionTurnsMock = vi.mocked(api.getAgentSessionTurns);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/truckcheck/voice/app-1']}>
      <Routes>
        <Route path="/truckcheck/voice/:applianceId" element={<VoiceCheckPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Connect + session-started so the page is in the ready state. */
async function renderReady() {
  renderPage();
  act(() => capturedEvents.onSessionStarted?.('sess-1', false));
  await waitFor(() => expect(screen.getByText('Ready')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  micMock.start.mockResolvedValue(undefined);
  getAgentSessionTurnsMock.mockResolvedValue([]);
  isDefaultStationMock.mockReturnValue(false);
});

describe('VoiceCheckPage', () => {
  it('connects on mount and shows the appliance name once loaded', async () => {
    renderPage();
    expect(clientMock.connect).toHaveBeenCalledWith(
      expect.objectContaining<Partial<VoiceAgentConnectOptions>>({ applianceId: 'app-1' }),
    );
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Tanker 1/)).toBeInTheDocument());
  });

  it('moves to Ready on session-started and enables the controls', async () => {
    await renderReady();
    expect(screen.getByRole('button', { name: /hold to talk/i })).not.toBeDisabled();
  });

  it('sends typed text and renders both sides of the exchange', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.type(screen.getByLabelText(/type a message/i), 'tyres are good');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(clientMock.sendText).toHaveBeenCalledWith('tyres are good', false);
    expect(screen.getByText('tyres are good')).toBeInTheDocument();
    expect(screen.getByText('Thinking…')).toBeInTheDocument();

    act(() => capturedEvents.onAgentText?.('Recorded tyres as done.', false, 'run-1'));
    expect(screen.getByText('Recorded tyres as done.')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('drives push-to-talk through the mic and the client', async () => {
    const user = userEvent.setup();
    await renderReady();
    const talk = screen.getByRole('button', { name: /hold to talk/i });

    await user.pointer({ keys: '[MouseLeft>]', target: talk });
    expect(clientMock.startUtterance).toHaveBeenCalled();
    // Unlocked synchronously within the gesture, not after the mic promise
    // resolves — iOS Safari requires this to still be in the gesture's call
    // stack (A3 code review F8).
    expect(unlockAudioPlaybackMock).toHaveBeenCalled();
    await waitFor(() => expect(micMock.start).toHaveBeenCalled());
    expect(screen.getByText('Listening…')).toBeInTheDocument();

    await user.pointer({ keys: '[/MouseLeft]', target: talk });
    expect(micMock.stop).toHaveBeenCalled();
    expect(clientMock.endUtterance).toHaveBeenCalled();
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
  });

  it('does not truncate the recording when the pointer merely drifts off the button (A3 code review F16)', async () => {
    const user = userEvent.setup();
    await renderReady();
    const talk = screen.getByRole('button', { name: /hold to talk/i });

    await user.pointer({ keys: '[MouseLeft>]', target: talk });
    await waitFor(() => expect(micMock.start).toHaveBeenCalled());
    expect(screen.getByText('Listening…')).toBeInTheDocument();

    // Pointer visually leaves the button's bounds (gloves/wet hands/natural
    // drift while gesturing) without ever releasing — previously this alone
    // ended the utterance via onPointerLeave. Pointer capture means the
    // browser keeps routing up/cancel to this element regardless, and the
    // component no longer has an onPointerLeave handler to react to this.
    fireEvent.pointerLeave(talk);
    expect(clientMock.endUtterance).not.toHaveBeenCalled();
    expect(micMock.stop).not.toHaveBeenCalled();
    expect(screen.getByText('Listening…')).toBeInTheDocument();

    // Actually releasing still ends it normally.
    await user.pointer({ keys: '[/MouseLeft]', target: talk });
    expect(clientMock.endUtterance).toHaveBeenCalled();
  });

  it('recovers with a status message when the microphone is unavailable', async () => {
    micMock.start.mockRejectedValue(new Error('denied'));
    const user = userEvent.setup();
    await renderReady();

    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: /hold to talk/i }) });
    await waitFor(() => expect(screen.getByText(/microphone unavailable/i)).toBeInTheDocument());
    expect(clientMock.endUtterance).toHaveBeenCalled();
  });

  it('renders voice transcripts and plays agent audio', async () => {
    await renderReady();
    act(() => capturedEvents.onTranscript?.('pump is primed'));
    expect(screen.getByText('pump is primed')).toBeInTheDocument();

    const blob = new Blob([new Uint8Array([1])], { type: 'audio/mpeg' });
    act(() => capturedEvents.onAgentAudio?.(blob));
    expect(playAudioBlobMock).toHaveBeenCalledWith(blob, expect.any(Function));
  });

  it('shows a status message when playback is blocked (A3 code review F8)', async () => {
    await renderReady();
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/mpeg' });
    act(() => capturedEvents.onAgentAudio?.(blob));

    // Simulate the browser rejecting .play() (e.g. iOS autoplay policy) by
    // invoking the onError callback VoiceCheckPage passed to playAudioBlob.
    const onErrorCallback = playAudioBlobMock.mock.calls[0][1] as (message: string) => void;
    act(() => onErrorCallback('Playback was blocked by the browser — showing the reply as text only.'));
    expect(screen.getByText(/playback was blocked/i)).toBeInTheDocument();
  });

  it('shows completion and links to the run summary', async () => {
    await renderReady();
    act(() => capturedEvents.onAgentText?.('All done. Goodbye.', true, 'run-42'));

    expect(screen.getByText('Check complete')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view check summary/i })).toHaveAttribute('href', '/truckcheck/summary/run-42');
    expect(screen.getByRole('button', { name: /hold to talk/i })).toBeDisabled();
  });

  it('shows errors from the agent as status bubbles', async () => {
    await renderReady();
    act(() => capturedEvents.onError?.('Speech is not configured on this server'));
    expect(screen.getByText(/not configured/i)).toBeInTheDocument();
  });

  it('recovers from a busy frame instead of leaving the UI permanently disabled (A3 code review F11)', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.type(screen.getByLabelText(/type a message/i), 'hello');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Thinking…')).toBeInTheDocument();

    // The server rejected this turn as busy instead of replying — without
    // onBusy, `busy` would stay true forever and every control would be
    // permanently disabled with no way to recover short of a reload.
    act(() => capturedEvents.onBusy?.());

    expect(screen.getByText(/still working on the last message/i)).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hold to talk/i })).not.toBeDisabled();
  });

  it('ends the session and closes the socket on unmount', async () => {
    const { unmount } = renderPage();
    unmount();
    expect(clientMock.endSession).toHaveBeenCalled();
    expect(clientMock.close).toHaveBeenCalled();
    expect(micMock.stop).toHaveBeenCalled();
  });

  describe('reconnect (A3 code review F9)', () => {
    it('shows Reconnecting… when the client reports a retry, then Ready again once resumed', async () => {
      await renderReady();
      act(() => capturedEvents.onReconnecting?.(1));
      expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /hold to talk/i })).toBeDisabled();

      act(() => capturedEvents.onSessionStarted?.('sess-1', true));
      await waitFor(() => expect(screen.getByText('Ready')).toBeInTheDocument());
    });

    it('rehydrates the transcript from persisted turns on a resumed session', async () => {
      getAgentSessionTurnsMock.mockResolvedValue([
        { role: 'user', text: 'pump is primed', sequence: 0 },
        { role: 'tool', text: 'record_result → {...}', sequence: 1 },
        { role: 'agent', text: 'Recorded as done.', sequence: 2 },
      ]);
      await renderReady();

      act(() => capturedEvents.onSessionStarted?.('sess-1', true));

      await waitFor(() => expect(getAgentSessionTurnsMock).toHaveBeenCalledWith('sess-1'));
      expect(await screen.findByText('pump is primed')).toBeInTheDocument();
      expect(screen.getByText('Recorded as done.')).toBeInTheDocument();
      // Tool turns are transcript bookkeeping, not conversation — not rendered as bubbles.
      expect(screen.queryByText(/record_result/)).not.toBeInTheDocument();
    });

    it('shows a status message when rehydration fails', async () => {
      getAgentSessionTurnsMock.mockRejectedValue(new Error('network'));
      await renderReady();
      act(() => capturedEvents.onSessionStarted?.('sess-1', true));
      expect(await screen.findByText(/could not restore the earlier transcript/i)).toBeInTheDocument();
    });
  });

  describe('no station context (Q28)', () => {
    it('shows a redirect message instead of connecting', () => {
      isDefaultStationMock.mockReturnValue(true);
      renderPage();

      expect(screen.getByText(/needs a station selected/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /go back to the vehicle roster/i })).toBeInTheDocument();
      expect(clientMock.connect).not.toHaveBeenCalled();
    });
  });
});
