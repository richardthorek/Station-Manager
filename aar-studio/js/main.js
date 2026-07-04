// App bootstrap: hash router, nav, re-render policy.

import { h, clear, toast } from './ui.js';
import * as store from './store.js';
import { displayTitle } from './lib/model.js';
import { checkAccess } from './lib/entitlement.js';
import { openSettingsDialog } from './settings.js';
import * as home from './views/home.js';
import * as setup from './views/setup.js';
import * as capture from './views/capture.js';
import * as board from './views/board.js';
import * as review from './views/review.js';
import * as report from './views/report.js';
import * as join from './views/join.js';

const ROUTES = [
  { hash: '#/home', label: 'Reviews', view: home, always: true },
  { hash: '#/setup', label: 'Details', view: setup },
  { hash: '#/capture', label: 'Record', view: capture },
  { hash: '#/board', label: 'Findings', view: board },
  { hash: '#/review', label: 'Edit', view: review },
  { hash: '#/report', label: 'Report', view: report },
];

const main = document.getElementById('view');
const nav = document.getElementById('nav');
const sessionLabel = document.getElementById('session-label');

function currentRoute() {
  return ROUTES.find((r) => r.hash === location.hash) ?? ROUTES[0];
}

/**
 * A live, in-session warning that a backup push found the team's cloud copy
 * newer than this device's edits (409) — shown on every view, not just
 * discovered later on Home, so a facilitator can't keep editing a copy that's
 * silently only saving locally (AAR Studio hero review 2026-07-03, AAR-15).
 */
function syncConflictBanner() {
  return h('div', { class: 'sync-conflict-banner', role: 'alert' },
    h('span', {}, 'A newer team copy exists — your edits are saving to this device only.'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn btn--small', onclick: async () => {
        const ok = await store.loadLatestFromTeam();
        toast(ok ? 'Loaded the team’s latest copy' : 'Could not load the latest copy — try again', ok ? 'info' : 'error');
      } }, 'Load latest'),
      h('button', { class: 'btn btn--small btn--primary', onclick: () => {
        store.keepMineAsCopy();
        toast('Saved your edits as a new copy');
      } }, 'Keep mine as a copy'),
    ),
  );
}

function renderNav() {
  const session = store.getSession();
  clear(nav);
  for (const r of ROUTES) {
    nav.append(h('a', {
      href: r.hash,
      class: `nav__link${currentRoute() === r ? ' nav__link--active' : ''}${!r.always && !session ? ' nav__link--disabled' : ''}`,
    }, r.label));
  }
  nav.append(h('button', { class: 'nav__settings', title: 'Settings', 'aria-label': 'Settings', onclick: openSettingsDialog }, '⚙'));
  // Active-review indicator: a clear chip so it's never ambiguous which review
  // you're in. Tap it to jump back to that review's board; the ✕ closes it and
  // returns to the review list (AAR session-clarity rework 2026-07-04).
  clear(sessionLabel);
  if (session) {
    sessionLabel.append(
      h('span', { class: 'topbar__session-icon', 'aria-hidden': 'true' }, '📋'),
      h('a', { class: 'topbar__session-name', href: '#/board', title: 'Open this review’s findings' }, displayTitle(session)),
      h('button', {
        class: 'topbar__session-close', title: 'Close this review', 'aria-label': 'Close this review',
        onclick: () => { store.closeSession(); location.hash = '#/home'; },
      }, '✕'),
    );
  }
}

function render() {
  // Participant join page: a standalone "add a note" screen reached from a
  // share link. No session required; the facilitator nav is hidden.
  if (location.hash.startsWith('#/join')) {
    document.body.classList.add('join-mode');
    clear(nav);
    sessionLabel.textContent = '';
    clear(main);
    join.render(main);
    return;
  }
  document.body.classList.remove('join-mode');

  const route = currentRoute();
  if (!route.always && !store.getSession()) {
    location.hash = '#/home';
    return;
  }
  renderNav();
  clear(main);
  if (store.getSyncConflict()) main.append(syncConflictBanner());
  route.view.render(main);
}

/**
 * Plan-gate screen shown when a signed-in user's Station Manager org is not on a
 * plan that includes AAR Studio. Replaces the app rather than booting it, so the
 * cloud-sync / AI features (which the backend 403s for this org) aren't reached
 * through a UI that looks fully functional. Signed-out local-first use is never
 * gated — this only fires on a positive "not entitled" signal.
 */
function renderGate() {
  clear(nav);
  sessionLabel.textContent = '';
  document.body.classList.remove('join-mode');
  clear(main);
  main.append(
    h('section', { class: 'gate' },
      h('h1', { class: 'gate__title' }, 'AAR Studio needs the AI plan'),
      h('p', { class: 'gate__lead' },
        'After Action Reviews — AI-assisted transcript analysis, the findings board, and shared cloud reviews — are part of the AI plan. Your organisation is on a plan that doesn’t include AAR Studio yet.'),
      h('div', { class: 'gate__actions' },
        h('a', { class: 'gate__btn', href: '/admin/organization' }, 'View plans & upgrade'),
        h('a', { class: 'gate__btn gate__btn--secondary', href: '/' }, 'Back to Bushie Tools')),
      h('p', { class: 'gate__hint' },
        'Already upgraded? Make sure AAR Studio is switched on under your organisation’s modules, then reload.'),
    ),
  );
}

window.addEventListener('hashchange', render);

store.subscribe((reason) => {
  // Field-level edits use {silent:true}; everything else re-renders the view.
  if (reason === 'save-error') return;
  render();
});

/**
 * Boot the app behind the entitlement gate. The check fails open (signed-out,
 * no org, or a transient probe failure all proceed), so the only outcome that
 * blocks is a positive "org not entitled" signal.
 */
async function boot() {
  const access = await checkAccess();
  if (!access.allowed) {
    renderGate();
    return;
  }
  // `?demo` deep link: load the bundled example review straight onto the board
  // (for sharing a walkthrough link). Strip the query afterwards so a later
  // reload returns to the normal home rather than clobbering the session again.
  // Fails open — if the example can't be fetched, fall through to a normal boot.
  if (new URLSearchParams(location.search).has('demo')) {
    try {
      await home.loadExampleSession();
      history.replaceState(null, '', location.pathname + location.hash);
      return;
    } catch {
      // ignore and boot normally
    }
  }
  store.resumeLastSession();
  if (!location.hash) location.hash = store.getSession() ? '#/board' : '#/home';
  render();
}

boot();
