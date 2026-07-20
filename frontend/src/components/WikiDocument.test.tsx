import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WikiDocument } from './WikiDocument';
import { api } from '../services/api';

// Deliberately a plain full replacement, no vi.importActual — pulling anything
// real out of api.ts (even one export) drags its ~2200-line ApiService class
// into the coverage-instrumented module graph. WikiSearchUnavailableError
// (used by HelpButton.test.tsx) lives in its own tiny file for exactly this reason.
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
      pages: [
        { slug: 'getting-started', title: 'Getting started', description: 'How to begin' },
        { slug: 'sign-in', title: 'Sign-in book', description: 'Checking in and out' },
        { slug: 'broken-page', title: 'Broken page', description: 'Fails to load' },
      ],
    },
  ],
};

function pageFor(slug: string) {
  if (slug === 'getting-started') {
    return Promise.resolve({
      slug,
      title: 'Getting started',
      markdown:
        '# Getting started\n\n' +
        'See [Sign-in book](sign-in.md) for details, or the [external docs](https://example.com/help).\n\n' +
        'There is also a [privacy link](/privacy).\n\n' +
        '![A screenshot](images/getting-started.png)\n\n' +
        '![An external image](https://cdn.example.com/pic.png)',
    });
  }
  if (slug === 'sign-in') {
    return Promise.resolve({ slug, title: 'Sign-in book', markdown: '# Sign-in book\n\nHow to check in and out.' });
  }
  return Promise.reject(new Error('not found'));
}

function renderDoc(props: Partial<React.ComponentProps<typeof WikiDocument>> = {}) {
  return render(<WikiDocument section="user-guide" {...props} />);
}

describe('WikiDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getWikiManifest).mockResolvedValue(manifest);
    vi.mocked(api.getWikiPage).mockImplementation((slug) => pageFor(slug));
  });

  it('shows an error when the guide fails to load', async () => {
    vi.mocked(api.getWikiManifest).mockRejectedValue(new Error('network down'));
    renderDoc();
    expect(await screen.findByText(/could not load the help contents/i)).toBeInTheDocument();
  });

  it('skips a page whose content failed to fetch, without breaking the rest', async () => {
    renderDoc();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());
    // 'broken-page' is in the manifest (still listed in the sidebar) but getWikiPage rejects
    // for it — its content section must not render or crash the rest of the document.
    expect(document.getElementById('broken-page')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /guide contents/i })).toHaveTextContent('Broken page');
  });

  it('clicking a sidebar link scrolls to that section', async () => {
    const user = userEvent.setup();
    const scrollSpy = vi.fn();
    renderDoc();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());

    const section = document.getElementById('sign-in')!;
    section.scrollIntoView = scrollSpy;

    const sidebarLink = screen.getByRole('navigation', { name: /guide contents/i }).querySelector('a[href="#sign-in"]')!;
    await user.click(sidebarLink);
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('renders internal, external, and plain markdown links distinctly', async () => {
    renderDoc();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());

    // Internal .md link is rewritten to an in-page anchor with no target.
    const internal = screen.getAllByRole('link', { name: 'Sign-in book' }).find((el) => el.getAttribute('href') === '#sign-in');
    expect(internal).toBeTruthy();

    const external = screen.getByRole('link', { name: 'external docs' });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');

    const plain = screen.getByRole('link', { name: 'privacy link' });
    expect(plain).toHaveAttribute('href', '/privacy');
    expect(plain).not.toHaveAttribute('target');
  });

  it('clicking an internal markdown link scrolls instead of navigating', async () => {
    const user = userEvent.setup();
    renderDoc();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());

    const scrollSpy = vi.fn();
    document.getElementById('sign-in')!.scrollIntoView = scrollSpy;

    const internal = screen.getAllByRole('link', { name: 'Sign-in book' }).find((el) => el.getAttribute('href') === '#sign-in')!;
    await user.click(internal);
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('resolves relative wiki images and leaves external images untouched', async () => {
    renderDoc();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());

    const resolved = screen.getByAltText('A screenshot');
    expect(resolved).toHaveAttribute('src', '/api/wiki/user-guide/images/getting-started.png');

    const untouched = screen.getByAltText('An external image');
    expect(untouched).toHaveAttribute('src', 'https://cdn.example.com/pic.png');
  });

  it('clears the search box via the clear button', async () => {
    const user = userEvent.setup();
    renderDoc();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/search the guide/i);
    await user.type(input, 'sign');
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear search/i }));
    expect(input).toHaveValue('');
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });

  it('runs AI search from the Ask AI button (not just Enter)', async () => {
    vi.mocked(api.searchWiki).mockResolvedValue({ answer: 'Use the sign-in book.', covered: true, sources: ['sign-in'] });
    const user = userEvent.setup();
    renderDoc();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search the guide/i), 'how do I check in?');
    await user.click(screen.getByRole('button', { name: /ask ai/i }));

    expect(await screen.findByText(/use the sign-in book/i)).toBeInTheDocument();
  });

  it('drops an AI-cited source slug that has no matching loaded page', async () => {
    vi.mocked(api.searchWiki).mockResolvedValue({
      answer: 'See the relevant page.',
      covered: true,
      sources: ['does-not-exist', 'sign-in'],
    });
    const user = userEvent.setup();
    renderDoc();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search the guide/i), 'test{Enter}');

    await screen.findByText(/see the relevant page/i);
    // Only one source chip renders (for the real page) — the nonexistent slug is silently dropped.
    expect(screen.getAllByRole('button', { name: 'Sign-in book' })).toHaveLength(1);
  });

  it('shows a generic error message when AI search fails for a non-configuration reason', async () => {
    vi.mocked(api.searchWiki).mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderDoc();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search the guide/i), 'test{Enter}');
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('does not fetch pages after unmounting mid-load', async () => {
    let resolveManifest: (value: typeof manifest) => void;
    vi.mocked(api.getWikiManifest).mockReturnValue(
      new Promise((resolve) => {
        resolveManifest = resolve;
      })
    );

    const { unmount } = renderDoc();
    unmount();
    resolveManifest!(manifest);

    // Give the (now-cancelled) effect a tick to run; it must not call getWikiPage post-unmount.
    await new Promise((r) => setTimeout(r, 0));
    expect(api.getWikiPage).not.toHaveBeenCalled();
  });

  it('auto-scrolls to initialSlug on mount by default', async () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    const onActivePageChange = vi.fn();
    renderDoc({ initialSlug: 'sign-in', onActivePageChange });

    await waitFor(() => expect(onActivePageChange).toHaveBeenCalledWith('sign-in'));
    expect(scrollSpy).toHaveBeenCalled();

    scrollSpy.mockRestore();
  });

  it('does not auto-scroll or report an active page when autoScrollToInitialSlug is false', async () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    const onActivePageChange = vi.fn();
    renderDoc({ initialSlug: 'sign-in', autoScrollToInitialSlug: false, onActivePageChange });

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());
    expect(onActivePageChange).not.toHaveBeenCalled();
    expect(scrollSpy).not.toHaveBeenCalled();

    scrollSpy.mockRestore();
  });

  it('shows suggested questions for the given initialSlug, and tapping one runs an AI search', async () => {
    vi.mocked(api.searchWiki).mockResolvedValue({
      answer: 'Tap Sign In on the kiosk.',
      covered: true,
      sources: ['sign-in'],
    });
    const user = userEvent.setup();
    renderDoc({ initialSlug: 'sign-in', autoScrollToInitialSlug: false });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());

    const suggestion = screen.getByRole('button', { name: 'How do I check in and out?' });
    await user.click(suggestion);

    expect(api.searchWiki).toHaveBeenCalledWith('How do I check in and out?', 'user-guide');
    expect(await screen.findByText(/tap sign in on the kiosk/i)).toBeInTheDocument();
  });

  it('hides suggested questions once the user has typed a query or gotten an AI answer', async () => {
    const user = userEvent.setup();
    renderDoc({ initialSlug: 'sign-in', autoScrollToInitialSlug: false });
    await waitFor(() => expect(screen.getByRole('button', { name: 'How do I check in and out?' })).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search the guide/i), 'x');
    expect(screen.queryByRole('button', { name: 'How do I check in and out?' })).not.toBeInTheDocument();
  });

  it('falls back to default suggested questions when there is no initialSlug', async () => {
    renderDoc({ initialSlug: null, autoScrollToInitialSlug: false });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'How do I check in and out?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How do I complete a truck check?' })).toBeInTheDocument();
  });

  it('re-scrolls when initialSlug changes to a different page while mounted', async () => {
    const onActivePageChange = vi.fn();
    const { rerender } = renderDoc({ initialSlug: 'getting-started', onActivePageChange });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign-in book' })).toBeInTheDocument());
    expect(onActivePageChange).toHaveBeenCalledWith('getting-started');

    onActivePageChange.mockClear();
    rerender(<WikiDocument section="user-guide" initialSlug="sign-in" onActivePageChange={onActivePageChange} />);
    await waitFor(() => expect(onActivePageChange).toHaveBeenCalledWith('sign-in'));
  });
});
