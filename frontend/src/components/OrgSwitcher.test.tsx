import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrgSwitcher } from './OrgSwitcher';

const switchOrg = vi.fn();
const showError = vi.fn();
let organization: { id: string; name: string } | null = { id: 'org-1', name: 'Bungendore RFS' };
let memberships: Array<{ organizationId: string; organizationName: string; role: string }> = [];

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ organization, memberships, switchOrg }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError, showSuccess: vi.fn() }),
}));

describe('OrgSwitcher', () => {
  beforeEach(() => {
    switchOrg.mockReset();
    showError.mockReset();
    organization = { id: 'org-1', name: 'Bungendore RFS' };
    memberships = [
      { organizationId: 'org-1', organizationName: 'Bungendore RFS', role: 'owner' },
      { organizationId: 'org-2', organizationName: 'Second Brigade', role: 'viewer' },
    ];
  });

  it('renders nothing for a single-org user', () => {
    memberships = [{ organizationId: 'org-1', organizationName: 'Bungendore RFS', role: 'owner' }];
    const { container } = render(<OrgSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists all orgs the user belongs to and switches on selection', async () => {
    render(<OrgSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /bungendore rfs/i }));

    expect(screen.getByText('Second Brigade')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Second Brigade'));

    await waitFor(() => expect(switchOrg).toHaveBeenCalledWith('org-2'));
  });

  it('shows an error toast when switching fails', async () => {
    switchOrg.mockRejectedValue(new Error('nope'));
    render(<OrgSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /bungendore rfs/i }));
    fireEvent.click(screen.getByText('Second Brigade'));

    await waitFor(() => expect(showError).toHaveBeenCalledWith('nope'));
  });
});
