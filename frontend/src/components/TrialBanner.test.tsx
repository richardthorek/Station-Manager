import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TrialBanner } from './TrialBanner';

let isAuthenticated = false;
let isLoading = false;

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated, isLoading }),
}));

vi.mock('../services/api', () => ({
  api: { getBillingStatus: vi.fn() },
}));

import { api } from '../services/api';
const mockGetBillingStatus = api.getBillingStatus as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  isAuthenticated = false;
  isLoading = false;
});

describe('TrialBanner', () => {
  it('does not call getBillingStatus for a logged-out visitor (Q42, found 2026-07-17)', async () => {
    render(<TrialBanner />);
    // Give any stray effect a tick to fire before asserting it didn't.
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGetBillingStatus).not.toHaveBeenCalled();
  });

  it('does not call getBillingStatus while auth is still resolving', async () => {
    isLoading = true;
    render(<TrialBanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGetBillingStatus).not.toHaveBeenCalled();
  });

  it('calls getBillingStatus once signed in, and shows the banner when trialing', async () => {
    isAuthenticated = true;
    mockGetBillingStatus.mockResolvedValue({
      status: 'trialing',
      trialEndsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    });

    render(<TrialBanner />);

    await waitFor(() => expect(mockGetBillingStatus).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Free trial:/)).toBeInTheDocument();
  });

  it('renders nothing when signed in but not trialing', async () => {
    isAuthenticated = true;
    mockGetBillingStatus.mockResolvedValue({ status: 'active', trialEndsAt: null });

    const { container } = render(<TrialBanner />);

    await waitFor(() => expect(mockGetBillingStatus).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });
});
