import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelpButton } from './HelpButton';
import { WikiProvider } from '../contexts/WikiProvider';
import { api } from '../services/api';
import { WikiSearchUnavailableError } from '../services/wikiSearchError';

// Deliberately a plain full replacement, no vi.importActual — see
// WikiDocument.test.tsx for why (pulls the whole giant api.ts into coverage).
vi.mock('../services/api', () => ({
  api: {
    getWikiManifest: vi.fn(),
    getWikiPage: vi.fn(),
    getWikiImageUrl: vi.fn((filename: string) => `/api/wiki/user-guide/images/${filename}`),
    searchWiki: vi.fn(),
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

  it('opens the panel, loads the contextual page content, but lands on search instead of scrolling to it', async () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    const user = userEvent.setup();
    renderAt('/signin');

    await user.click(screen.getByRole('button', { name: /help and user guide/i }));

    // The whole guide is fetched and rendered as one document...
    expect(await screen.findByText(/how to check in and out/i)).toBeInTheDocument();
    expect(api.getWikiPage).toHaveBeenCalledWith('sign-in', 'user-guide');
    // ...but the drawer doesn't jump straight to it — it opts out of the auto-scroll
    // so the just-opened search box and suggestions stay in view instead of being
    // scrolled straight past.
    expect(scrollSpy).not.toHaveBeenCalled();

    scrollSpy.mockRestore();
  });

  it('shows suggested questions for the current route as the search landing state', async () => {
    const user = userEvent.setup();
    renderAt('/signin');

    await user.click(screen.getByRole('button', { name: /help and user guide/i }));

    expect(await screen.findByRole('button', { name: 'How do I check in and out?' })).toBeInTheDocument();
  });

  it('shows the sidebar contents alongside the content', async () => {
    const user = userEvent.setup();
    renderAt('/signin');

    await user.click(screen.getByRole('button', { name: /help and user guide/i }));

    await waitFor(() => expect(screen.getByText('Everyday use')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Sign-in book' })).toBeInTheDocument();
  });

  it('does not render inside the platform admin console', () => {
    renderAt('/admin/platform');
    expect(screen.queryByRole('button', { name: /help and user guide/i })).not.toBeInTheDocument();
  });

  it('opens without a contextual page on a route with no mapping, but still loads the guide', async () => {
    const user = userEvent.setup();
    renderAt('/account');

    await user.click(screen.getByRole('button', { name: /help and user guide/i }));

    await waitFor(() => expect(screen.getByRole('link', { name: 'Sign-in book' })).toBeInTheDocument());
  });

  it('filters the sidebar as the user types in the search box', async () => {
    const user = userEvent.setup();
    renderAt('/account');

    await user.click(screen.getByRole('button', { name: /help and user guide/i }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Sign-in book' })).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search the guide/i), 'nothing matches this');

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Sign-in book' })).not.toBeInTheDocument());
    expect(screen.getByText(/no pages match/i)).toBeInTheDocument();
  });

  it('runs a grounded AI search on Enter and shows the answer with a clickable source', async () => {
    vi.mocked(api.searchWiki).mockResolvedValue({
      answer: 'Tap Sign In on the kiosk and select your name.',
      covered: true,
      sources: ['sign-in'],
    });
    const user = userEvent.setup();
    renderAt('/account');

    await user.click(screen.getByRole('button', { name: /help and user guide/i }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Sign-in book' })).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search the guide/i), 'how do I check in?{Enter}');

    expect(await screen.findByText(/tap sign in on the kiosk/i)).toBeInTheDocument();
    expect(api.searchWiki).toHaveBeenCalledWith('how do I check in?', 'user-guide');
    expect(screen.getByRole('button', { name: 'Sign-in book' })).toBeInTheDocument();
  });

  it('shows an unavailable hint instead of an error when AI search is not configured', async () => {
    vi.mocked(api.searchWiki).mockRejectedValue(new WikiSearchUnavailableError());
    const user = userEvent.setup();
    renderAt('/account');

    await user.click(screen.getByRole('button', { name: /help and user guide/i }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Sign-in book' })).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search the guide/i), 'anything{Enter}');

    expect(await screen.findByText(/isn't switched on/i)).toBeInTheDocument();
  });
});
