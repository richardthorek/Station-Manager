import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
vi.mock('./audioIO', () => ({
  MicCapture: vi.fn().mockImplementation(function () {
    return micMock;
  }),
  playAudioBlob: (blob: Blob) => playAudioBlobMock(blob),
}));

vi.mock('../../../services/api', () => ({
  api: {
    getAppliance: vi.fn().mockResolvedValue({ id: 'app-1', name: 'Tanker 1' }),
  },
}));

import { VoiceCheckPage } from './VoiceCheckPage';

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
  act(() => capturedEvents.onSessionStarted?.('sess-1'));
  await waitFor(() => expect(screen.getByText('Ready')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  micMock.start.mockResolvedValue(undefined);
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
    await waitFor(() => expect(micMock.start).toHaveBeenCalled());
    expect(screen.getByText('Listening…')).toBeInTheDocument();

    await user.pointer({ keys: '[/MouseLeft]', target: talk });
    expect(micMock.stop).toHaveBeenCalled();
    expect(clientMock.endUtterance).toHaveBeenCalled();
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
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
    expect(playAudioBlobMock).toHaveBeenCalledWith(blob);
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

  it('ends the session and closes the socket on unmount', async () => {
    const { unmount } = renderPage();
    unmount();
    expect(clientMock.endSession).toHaveBeenCalled();
    expect(clientMock.close).toHaveBeenCalled();
    expect(micMock.stop).toHaveBeenCalled();
  });
});
