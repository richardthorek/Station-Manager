import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountPage } from './AccountPage';

const updateProfile = vi.fn();
const changePassword = vi.fn();

vi.mock('../../services/api', () => ({
  api: {
    updateProfile: (...a: unknown[]) => updateProfile(...a),
    changePassword: (...a: unknown[]) => changePassword(...a),
  },
}));

vi.mock('../../components/PasskeysSection', () => ({
  PasskeysSection: () => <section data-testid="passkeys-section" />,
}));

const logout = vi.fn();
const switchOrg = vi.fn();
const refreshOrganization = vi.fn();

let user: { username: string; email?: string | null } | null = { username: 'captain', email: 'captain@example.com' };
let organization: { id: string; name: string } | null = { id: 'org-1', name: 'Bungendore RFS' };
let memberships: Array<{ organizationId: string; organizationName: string; role: string }> = [
  { organizationId: 'org-1', organizationName: 'Bungendore RFS', role: 'owner' },
];

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user, organization, memberships, switchOrg, refreshOrganization, logout }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>,
  );
}

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    user = { username: 'captain', email: 'captain@example.com' };
    organization = { id: 'org-1', name: 'Bungendore RFS' };
    memberships = [{ organizationId: 'org-1', organizationName: 'Bungendore RFS', role: 'owner' }];
  });

  it('shows the username read-only and saves an updated email', async () => {
    updateProfile.mockResolvedValue({ user: {} });
    renderPage();

    expect(screen.getByText('captain')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ email: 'new@example.com' }));
    expect(await screen.findByText('Email saved')).toBeInTheDocument();
  });

  it('rejects a password change when the confirmation does not match', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass1' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different1' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('changes the password when current and confirmation are valid', async () => {
    changePassword.mockResolvedValue({ success: true });
    renderPage();

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass1' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'oldpass1', newPassword: 'newpass123' }),
    );
    expect(await screen.findByText('Password changed')).toBeInTheDocument();
  });

  it('renders the passkeys section', () => {
    renderPage();
    expect(screen.getByTestId('passkeys-section')).toBeInTheDocument();
  });

  it('shows a plain-text hint for a single-org user with no switcher', () => {
    renderPage();
    expect(screen.getByText(/you belong to/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^switch$/i })).not.toBeInTheDocument();
  });

  it('lists organisations and switches to a non-current one', async () => {
    memberships = [
      { organizationId: 'org-1', organizationName: 'Bungendore RFS', role: 'owner' },
      { organizationId: 'org-2', organizationName: 'Second Brigade', role: 'viewer' },
    ];
    switchOrg.mockResolvedValue(undefined);
    renderPage();

    expect(screen.getByText('Second Brigade')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^switch$/i }));

    await waitFor(() => expect(switchOrg).toHaveBeenCalledWith('org-2'));
  });

  it('signs out on click', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^sign out$/i }));
    expect(logout).toHaveBeenCalled();
  });
});
