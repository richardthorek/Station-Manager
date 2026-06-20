// App bootstrap: hash router, nav, re-render policy.

import { h, clear } from './ui.js';
import * as store from './store.js';
import { displayTitle } from './lib/model.js';
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

window.addEventListener('hashchange', render);

store.subscribe((reason) => {
  // Field-level edits use {silent:true}; everything else re-renders the view.
  if (reason === 'save-error') return;
  render();
});

store.resumeLastSession();
if (!location.hash) location.hash = store.getSession() ? '#/board' : '#/home';
render();
