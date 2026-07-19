import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';

const logout = vi.fn();
let user: { username: string; email?: string | null } | null = { username: 'captain', email: 'captain@example.com' };

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user, logout }),
}));

function renderMenu() {
  return render(
    <MemoryRouter>
      <AccountMenu />
    </MemoryRouter>,
  );
}

describe('AccountMenu', () => {
  beforeEach(() => {
    logout.mockReset();
    user = { username: 'captain', email: 'captain@example.com' };
  });

  it('renders nothing when signed out', () => {
    user = null;
    const { container } = renderMenu();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the username as the trigger label', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: /account menu for captain/i })).toBeInTheDocument();
  });

  it('opens the dropdown with username, email, My Account link, and sign out', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /account menu for captain/i }));

    expect(screen.getAllByText('captain').length).toBeGreaterThan(0);
    expect(screen.getByText('captain@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /my account/i })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
  });

  it('signs out and closes the menu on click', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /account menu for captain/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));

    expect(logout).toHaveBeenCalled();
    expect(screen.queryByRole('menuitem', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('does not show an email row when the user has none', () => {
    user = { username: 'captain', email: null };
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /account menu for captain/i }));

    expect(screen.queryByText('captain@example.com')).not.toBeInTheDocument();
  });
});
