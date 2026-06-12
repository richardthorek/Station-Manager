// Home: session list, new session, JSON import, sample session.

import { h, toast, download, pickFile, confirmDanger } from '../ui.js';
import * as store from '../store.js';
import { sessionFilename } from '../lib/exports.js';

async function loadSample() {
  const res = await fetch('./data/sample-session.json');
  if (!res.ok) throw new Error(`Sample not found (${res.status})`);
  store.importSessionJson(await res.text());
  location.hash = '#/board';
  toast('Wamboin sample session loaded — explore Board, Review and Report');
}

async function importJson() {
  const file = await pickFile('application/json,.json');
  if (!file) return;
  try {
    store.importSessionJson(await file.text());
    location.hash = '#/setup';
    toast('Session imported');
  } catch (err) {
    toast(`Import failed: ${err.message}`, 'error');
  }
}

export function render(container) {
  const sessions = store.listSessions();

  container.append(
    h('section', { class: 'hero' },
      h('h1', {}, 'AAR Studio'),
      h('p', {}, 'Facilitate, live-present and package After Action Reviews for fire brigade incidents. Everything stays in this browser; AI calls go straight to your Azure resources.'),
      h('div', { class: 'hero__actions' },
        h('button', { class: 'btn btn--primary btn--big', onclick: () => { store.newSession(); location.hash = '#/setup'; } }, 'New AAR session'),
        h('button', { class: 'btn btn--big', onclick: importJson }, 'Import session JSON'),
        h('button', { class: 'btn btn--big', onclick: () => loadSample().catch((e) => toast(e.message, 'error')) }, 'Load Wamboin sample'),
      ),
    ),
    h('section', {},
      h('h2', {}, 'Saved sessions'),
      sessions.length
        ? h('table', { class: 'table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Incident'), h('th', {}, 'Incident date'), h('th', {}, 'Findings'), h('th', {}, 'Segments'), h('th', {}, 'Updated'), h('th', {}, ''))),
            h('tbody', {}, sessions.map((s) => h('tr', {},
              h('td', {}, h('a', { href: '#/board', onclick: () => store.openSession(s.id) }, s.title)),
              h('td', {}, s.incidentDate),
              h('td', {}, String(s.findings)),
              h('td', {}, String(s.segments)),
              h('td', {}, s.updatedAt ? new Date(s.updatedAt).toLocaleString() : ''),
              h('td', { class: 'table__actions' },
                h('button', { class: 'btn btn--small', onclick: () => {
                  const session = store.openSession(s.id);
                  download(sessionFilename(session, 'session', 'json'), store.exportSessionJson(session), 'application/json');
                } }, 'Export'),
                h('button', { class: 'btn btn--small btn--danger', onclick: () => {
                  if (confirmDanger(`Delete "${s.title}"? This cannot be undone (export it first if unsure).`)) {
                    store.deleteSession(s.id);
                    toast('Session deleted');
                  }
                } }, 'Delete'),
              ),
            ))),
          )
        : h('p', { class: 'muted' }, 'No sessions yet. Start one, or load the Wamboin sample to see a finished AAR.'),
    ),
  );
}
