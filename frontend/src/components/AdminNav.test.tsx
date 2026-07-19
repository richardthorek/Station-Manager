import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminNav } from './AdminNav';

const logout = vi.fn();
const switchOrg = vi.fn();
let user: { username: string } | null = { username: 'captain' };
let isPlatformAdmin = false;

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user,
    logout,
    isPlatformAdmin,
    organization: null,
    memberships: [],
    switchOrg,
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

function renderNav(path = '/admin/stations') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminNav />
    </MemoryRouter>,
  );
}

describe('AdminNav', () => {
  beforeEach(() => {
    logout.mockReset();
    user = { username: 'captain' };
    isPlatformAdmin = false;
  });

  it('links to the app picker as home, not another admin page', () => {
    renderNav();
    expect(screen.getByRole('link', { name: /back to stationkit home/i })).toHaveAttribute('href', '/');
  });

  it('lists the three admin sections and marks the current one active', () => {
    renderNav('/admin/brigade-access');
    expect(screen.getByRole('link', { name: 'Stations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crew Access' })).toHaveClass('admin-nav__link--active');
    expect(screen.getByRole('link', { name: 'Organization' })).not.toHaveClass('admin-nav__link--active');
  });

  it('shows the signed-in username in the account menu and signs out on click', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: /account menu for captain/i }));
    expect(screen.getAllByText('captain').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(logout).toHaveBeenCalled();
  });

  it('omits the user block when signed out', () => {
    user = null;
    renderNav();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('shows the Platform link only for platform admins', () => {
    renderNav();
    expect(screen.queryByRole('link', { name: 'Platform' })).not.toBeInTheDocument();

    isPlatformAdmin = true;
    renderNav();
    expect(screen.getByRole('link', { name: 'Platform' })).toBeInTheDocument();
  });
});
