// App bootstrap: hash router, nav, re-render policy.

import { h, clear } from './ui.js';
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
  sessionLabel.textContent = session ? displayTitle(session) : '';
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
  store.resumeLastSession();
  if (!location.hash) location.hash = store.getSession() ? '#/board' : '#/home';
  render();
}

boot();
