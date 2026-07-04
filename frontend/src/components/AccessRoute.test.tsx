/**
 * AccessRoute tests
 *
 * The gate logic (authed / kiosk / demo → allow; otherwise redirect home) is
 * unit-tested by mocking the three inputs it reads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AccessRoute } from './AccessRoute';

const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockIsKioskMode = vi.fn();
vi.mock('../utils/kioskMode', () => ({
  isKioskMode: () => mockIsKioskMode(),
}));

const mockIsDemoActive = vi.fn();
vi.mock('../utils/demoMode', () => ({
  isDemoActive: () => mockIsDemoActive(),
}));

const mockHasMemberSession = vi.fn();
vi.mock('../utils/memberSession', () => ({
  hasMemberSession: () => mockHasMemberSession(),
}));

function renderGate() {
  return render(
    <MemoryRouter initialEntries={['/signin']}>
      <Routes>
        <Route path="/" element={<div>MARKETING HOME</div>} />
        <Route
          path="/signin"
          element={
            <AccessRoute>
              <div>SIGN-IN BOOK</div>
            </AccessRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('AccessRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    mockIsKioskMode.mockReturnValue(false);
    mockIsDemoActive.mockReturnValue(false);
    mockHasMemberSession.mockReturnValue(false);
  });

  it('redirects a bare visit (no account, no code, no demo) to the front door', () => {
    renderGate();
    expect(screen.getByText('MARKETING HOME')).toBeInTheDocument();
    expect(screen.queryByText('SIGN-IN BOOK')).not.toBeInTheDocument();
  });

  it('allows a signed-in user through', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    renderGate();
    expect(screen.getByText('SIGN-IN BOOK')).toBeInTheDocument();
  });

  it('allows a brigade device (kiosk mode) through', () => {
    mockIsKioskMode.mockReturnValue(true);
    renderGate();
    expect(screen.getByText('SIGN-IN BOOK')).toBeInTheDocument();
  });

  it('allows the public demo through', () => {
    mockIsDemoActive.mockReturnValue(true);
    renderGate();
    expect(screen.getByText('SIGN-IN BOOK')).toBeInTheDocument();
  });

  it('allows a member-session (checked in via personal link) through', () => {
    mockHasMemberSession.mockReturnValue(true);
    renderGate();
    expect(screen.getByText('SIGN-IN BOOK')).toBeInTheDocument();
  });

  it('shows a loading state while auth resolves (no premature redirect)', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
    renderGate();
    expect(screen.queryByText('MARKETING HOME')).not.toBeInTheDocument();
    expect(screen.queryByText('SIGN-IN BOOK')).not.toBeInTheDocument();
  });
});
