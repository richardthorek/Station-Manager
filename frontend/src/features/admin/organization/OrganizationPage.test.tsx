import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrganizationPage } from './OrganizationPage';

const getCurrentOrganization = vi.fn();
const getOrgMembers = vi.fn();
const getOrgInvites = vi.fn();
const createOrgInvite = vi.fn();
const revokeOrgInvite = vi.fn();
const updateOrgMemberRole = vi.fn();
const removeOrgMember = vi.fn();
const updateProfile = vi.fn();
const getAiUsage = vi.fn();
const getBillingStatus = vi.fn();
const createSantaAddonCheckoutSession = vi.fn();
const exportOrganizationData = vi.fn();

vi.mock('../../../services/api', () => ({
  api: {
    getCurrentOrganization: (...a: unknown[]) => getCurrentOrganization(...a),
    getOrgMembers: (...a: unknown[]) => getOrgMembers(...a),
    getOrgInvites: (...a: unknown[]) => getOrgInvites(...a),
    createOrgInvite: (...a: unknown[]) => createOrgInvite(...a),
    revokeOrgInvite: (...a: unknown[]) => revokeOrgInvite(...a),
    updateOrgMemberRole: (...a: unknown[]) => updateOrgMemberRole(...a),
    removeOrgMember: (...a: unknown[]) => removeOrgMember(...a),
    updateProfile: (...a: unknown[]) => updateProfile(...a),
    getAiUsage: (...a: unknown[]) => getAiUsage(...a),
    getBillingStatus: (...a: unknown[]) => getBillingStatus(...a),
    createSantaAddonCheckoutSession: (...a: unknown[]) => createSantaAddonCheckoutSession(...a),
    exportOrganizationData: (...a: unknown[]) => exportOrganizationData(...a),
    getOrganizationUsers: vi.fn().mockResolvedValue({ users: [] }),
  },
}));

const ORG = {
  id: 'org-1',
  name: 'Bungendore RFS',
  slug: 'bungendore-rfs',
  billingEmail: 'a@b.org',
  planCode: 'community' as const,
  status: 'active' as const,
  entitlements: {
    signInEnabled: true,
    truckCheckEnabled: true,
    reportsEnabled: false,
    aiEnabled: false,
    maxStations: 1,
    maxDevices: 1,
    aiIncludedSessions: 0,
  },
};

let authUser: { role: 'owner' | 'admin' | 'viewer'; email?: string | null } | null = { role: 'owner', email: 'a@b.org' };

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    organization: ORG,
    user: authUser,
    refreshOrganization: vi.fn(),
  }),
}));

vi.mock('../../../components/AdminNav', () => ({ AdminNav: () => <nav /> }));

function renderPage() {
  return render(
    <MemoryRouter>
      <OrganizationPage />
    </MemoryRouter>,
  );
}

describe('OrganizationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = { role: 'owner', email: 'a@b.org' };
    getCurrentOrganization.mockResolvedValue({ organization: ORG, plans: [] });
    getOrgMembers.mockResolvedValue({
      members: [{ userId: 'u1', username: 'captain', email: 'a@b.org', role: 'owner', status: 'active', createdAt: new Date().toISOString() }],
    });
    getOrgInvites.mockResolvedValue({ invites: [] });
    getBillingStatus.mockResolvedValue({
      planCode: 'community',
      status: 'active',
      trialEndsAt: null,
      hasPaymentMethod: false,
      stripeConfigured: false,
      santaAddon: { available: false, status: 'none', interval: null },
    });
  });

  it('lists members with their roles', async () => {
    renderPage();
    expect(await screen.findByText('captain')).toBeInTheDocument();
    expect(screen.getAllByText('a@b.org').length).toBeGreaterThan(0);
  });

  it('creates an invite link', async () => {
    createOrgInvite.mockResolvedValue({ invite: { id: 'inv-1' }, inviteUrl: 'http://x/invite/tok' });
    getOrgInvites
      .mockResolvedValueOnce({ invites: [] })
      .mockResolvedValueOnce({
        invites: [
          {
            id: 'inv-1',
            token: 'tok',
            organizationId: 'org-1',
            role: 'viewer',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            status: 'active',
            usageCount: 0,
            createdBy: 'u1',
            createdAt: new Date().toISOString(),
            inviteUrl: 'http://x/invite/tok',
          },
        ],
      });
    renderPage();
    await screen.findByText('captain');

    fireEvent.click(screen.getByRole('button', { name: /generate link/i }));

    await waitFor(() => expect(createOrgInvite).toHaveBeenCalledWith({ role: 'viewer', expiresInDays: 7 }));
    expect(await screen.findByRole('button', { name: /copy link/i })).toBeInTheDocument();
  });

  it('shows a legacy-email banner and lets the user save it', async () => {
    authUser = { role: 'owner', email: null };
    updateProfile.mockResolvedValue({ user: {} });
    renderPage();
    await screen.findByText('captain');

    expect(screen.getByText(/add an email to your account/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ email: 'new@example.com' }));
  });

  it('removes a member', async () => {
    getOrgMembers
      .mockResolvedValueOnce({
        members: [
          { userId: 'u1', username: 'captain', email: 'a@b.org', role: 'owner', status: 'active', createdAt: new Date().toISOString() },
          { userId: 'u2', username: 'helper', email: 'h@b.org', role: 'viewer', status: 'active', createdAt: new Date().toISOString() },
        ],
      })
      .mockResolvedValueOnce({
        members: [{ userId: 'u1', username: 'captain', email: 'a@b.org', role: 'owner', status: 'active', createdAt: new Date().toISOString() }],
      });
    removeOrgMember.mockResolvedValue({ success: true });
    renderPage();

    await screen.findByText('helper');
    const row = screen.getByText('helper').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /remove/i }));

    await waitFor(() => expect(removeOrgMember).toHaveBeenCalledWith('u2'));
  });

  it('hides the Santa Run add-on offer when not available', async () => {
    renderPage();
    await screen.findByText('captain');
    expect(screen.queryByText(/fire santa run add-on/i)).not.toBeInTheDocument();
  });

  it('shows the Santa Run add-on offer and starts checkout for the chosen interval', async () => {
    getBillingStatus.mockResolvedValue({
      planCode: 'community',
      status: 'active',
      trialEndsAt: null,
      hasPaymentMethod: false,
      stripeConfigured: true,
      santaAddon: { available: true, status: 'none', interval: null },
    });
    createSantaAddonCheckoutSession.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/test' });
    renderPage();

    await screen.findByText(/fire santa run add-on/i);
    fireEvent.click(screen.getByRole('button', { name: /a\$10\/year/i }));

    await waitFor(() => expect(createSantaAddonCheckoutSession).toHaveBeenCalledWith('annual'));
  });

  it('lets the owner export organization data', async () => {
    exportOrganizationData.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('captain');

    fireEvent.click(screen.getByRole('button', { name: /export organisation data/i }));

    await waitFor(() => expect(exportOrganizationData).toHaveBeenCalled());
  });

  it('hides the export button for a non-owner', async () => {
    authUser = { role: 'admin', email: 'a@b.org' };
    renderPage();
    await screen.findByText('captain');

    expect(screen.queryByRole('button', { name: /export organisation data/i })).not.toBeInTheDocument();
  });
});
