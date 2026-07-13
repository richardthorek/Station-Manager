import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OrgInvitePage } from './OrgInvitePage';

const getInviteInfo = vi.fn();
const acceptInvite = vi.fn();
const signupViaInvite = vi.fn();
const switchOrg = vi.fn();
const showSuccess = vi.fn();

let isAuthenticated = false;

vi.mock('../../services/api', () => ({
  api: {
    getInviteInfo: (...args: unknown[]) => getInviteInfo(...args),
    acceptInvite: (...args: unknown[]) => acceptInvite(...args),
    signupViaInvite: (...args: unknown[]) => signupViaInvite(...args),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated, switchOrg }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ showSuccess, showError: vi.fn() }),
}));

function renderPage(token = 'abc123') {
  return render(
    <MemoryRouter initialEntries={[`/invite/${token}`]}>
      <Routes>
        <Route path="/invite/:token" element={<OrgInvitePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrgInvitePage', () => {
  beforeEach(() => {
    getInviteInfo.mockReset();
    acceptInvite.mockReset();
    signupViaInvite.mockReset();
    switchOrg.mockReset();
    showSuccess.mockReset();
    isAuthenticated = false;
  });

  it('shows a friendly message for an expired/revoked invite', async () => {
    getInviteInfo.mockRejectedValue(new Error('This invite has expired or been revoked'));
    renderPage();
    expect(await screen.findByText(/expired or been revoked/i)).toBeInTheDocument();
  });

  describe('signed in', () => {
    beforeEach(() => {
      isAuthenticated = true;
      getInviteInfo.mockResolvedValue({ organizationName: 'Bungendore RFS', role: 'viewer', expiresAt: new Date().toISOString() });
    });

    it('shows a join prompt and accepts on click', async () => {
      acceptInvite.mockResolvedValue({ membership: { organizationId: 'org-1' }, memberships: [] });
      renderPage();

      expect(await screen.findByRole('heading', { name: /join bungendore rfs/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /join bungendore rfs/i }));

      await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith('abc123'));
      await waitFor(() => expect(switchOrg).toHaveBeenCalledWith('org-1'));
    });
  });

  describe('signed out', () => {
    beforeEach(() => {
      isAuthenticated = false;
      getInviteInfo.mockResolvedValue({ organizationName: 'Bungendore RFS', role: 'admin', expiresAt: new Date().toISOString() });
    });

    it('creates a new account directly via the invite', async () => {
      signupViaInvite.mockResolvedValue({
        token: 'jwt-token',
        user: { id: 'u1', username: 'recruit' },
        organization: { name: 'Bungendore RFS' },
      });
      renderPage();

      expect(await screen.findByRole('heading', { name: /join bungendore rfs/i })).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'recruit' } });
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'recruit@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'longenough1' } });
      fireEvent.click(screen.getByRole('button', { name: /create account & join/i }));

      await waitFor(() =>
        expect(signupViaInvite).toHaveBeenCalledWith('abc123', {
          username: 'recruit',
          password: 'longenough1',
          email: 'recruit@example.com',
        }),
      );
    });

    it('offers a sign-in-first path', async () => {
      renderPage();
      expect(await screen.findByRole('heading', { name: /join bungendore rfs/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /sign in first/i }));
      expect(screen.getByRole('link', { name: /sign in with your existing account/i })).toBeInTheDocument();
    });
  });
});
