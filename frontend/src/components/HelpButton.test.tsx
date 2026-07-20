import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelpButton } from './HelpButton';
import { WikiProvider } from '../contexts/WikiProvider';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getWikiManifest: vi.fn(),
    getWikiPage: vi.fn(),
    getWikiImageUrl: vi.fn((filename: string) => `/api/wiki/user-guide/images/${filename}`),
  },
}));

const manifest = {
  sections: [
    {
      heading: 'Everyday use',
      pages: [{ slug: 'sign-in', title: 'Sign-in book', description: 'Checking in and out' }],
    },
  ],
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WikiProvider>
        <HelpButton />
      </WikiProvider>
    </MemoryRouter>
  );
}

describe('HelpButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getWikiManifest).mockResolvedValue(manifest);
    vi.mocked(api.getWikiPage).mockResolvedValue({
      slug: 'sign-in',
      title: 'Sign-in book',
      markdown: '# Sign-in book\n\nHow to check in and out.',
    });
  });

  it('opens the panel at a contextual page for the current route', async () => {
    const user = userEvent.setup();
    renderAt('/signin');

    await user.click(screen.getByRole('button', { name: /help and user guide/i }));

    expect(await screen.findByText(/how to check in and out/i)).toBeInTheDocument();
    expect(api.getWikiPage).toHaveBeenCalledWith('sign-in', 'user-guide');
  });

  it('shows the table of contents after navigating back', async () => {
    const user = userEvent.setup();
    renderAt('/signin');

    await user.click(screen.getByRole('button', { name: /help and user guide/i }));
    await screen.findByText(/how to check in and out/i);

    await user.click(screen.getByRole('button', { name: /all help topics/i }));

    await waitFor(() => expect(screen.getByText('Sign-in book')).toBeInTheDocument());
    expect(screen.getByText('Everyday use')).toBeInTheDocument();
  });

  it('does not render inside the platform admin console', () => {
    renderAt('/admin/platform');
    expect(screen.queryByRole('button', { name: /help and user guide/i })).not.toBeInTheDocument();
  });

  it('opens at the table of contents on a route with no contextual mapping', async () => {
    const user = userEvent.setup();
    renderAt('/account');

    await user.click(screen.getByRole('button', { name: /help and user guide/i }));

    await waitFor(() => expect(screen.getByText('Sign-in book')).toBeInTheDocument());
    expect(api.getWikiPage).not.toHaveBeenCalled();
  });
});
