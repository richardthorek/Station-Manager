import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminNav } from './AdminNav';

const logout = vi.fn();
let user: { username: string } | null = { username: 'captain' };

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user, logout }),
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
  });

  it('links to the app picker as home, not another admin page', () => {
    renderNav();
    expect(screen.getByRole('link', { name: /back to bushie tools home/i })).toHaveAttribute('href', '/');
  });

  it('lists the three admin sections and marks the current one active', () => {
    renderNav('/admin/brigade-access');
    expect(screen.getByRole('link', { name: 'Stations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crew Access' })).toHaveClass('admin-nav__link--active');
    expect(screen.getByRole('link', { name: 'Organization' })).not.toHaveClass('admin-nav__link--active');
  });

  it('shows the signed-in username and signs out on click', () => {
    renderNav();
    expect(screen.getByText('captain')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(logout).toHaveBeenCalled();
  });

  it('omits the user block when signed out', () => {
    user = null;
    renderNav();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });
});
