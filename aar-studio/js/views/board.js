// Live findings board: four category columns, phase chips and filter,
// quick add, edit/delete, fullscreen high-contrast Present mode.

import { h, toast } from '../ui.js';
import * as store from '../store.js';
import { CATEGORIES, sessionPhases, createFinding } from '../lib/model.js';
import { analyseNow } from '../analyse.js';

let phaseFilter = null; // null = all

function findingCard(f, phases) {
  const card = h('div', { class: `finding finding--${f.category}` });
  const body = h('div', { class: 'finding__text' }, f.text);
  card.append(
    body,
    h('div', { class: 'finding__meta' },
      h('span', { class: 'chip chip--phase' }, f.phase),
      f.source === 'ai' ? h('span', { class: 'chip chip--ai', title: f.quote ? `“${f.quote}”` : 'AI extracted' }, 'AI') : null,
      h('span', { class: 'finding__tools' },
        h('button', { class: 'icon-btn', title: 'Edit', 'aria-label': 'Edit finding', onclick: () => editInline() }, '✎'),
        h('button', { class: 'icon-btn', title: 'Delete', 'aria-label': 'Delete finding', onclick: () => store.update((s) => { s.findings = s.findings.filter((x) => x.id !== f.id); }, { reason: 'findings' }) }, '✕'),
      ),
    ),
    f.quote ? h('div', { class: 'finding__quote' }, `“${f.quote}”`) : null,
  );

  function editInline() {
    const textArea = h('textarea', { rows: 3 }, f.text);
    const catSel = h('select', {}, CATEGORIES.map((c) => h('option', { value: c.id, selected: c.id === f.category }, c.label)));
    const phaseSel = h('select', {}, phases.map((p) => h('option', { value: p, selected: p === f.phase }, p)));
    const editor = h('div', { class: 'finding__editor' },
      textArea,
      h('div', { class: 'btn-row' },
        catSel, phaseSel,
        h('button', { class: 'btn btn--small btn--primary', onclick: () => {
          store.update((s) => {
            const target = s.findings.find((x) => x.id === f.id);
            if (target) Object.assign(target, { text: textArea.value.trim(), category: catSel.value, phase: phaseSel.value });
          }, { reason: 'findings' });
        } }, 'Save'),
        h('button', { class: 'btn btn--small', onclick: () => store.update(() => {}, { reason: 'findings' }) }, 'Cancel'),
      ),
    );
    card.replaceChildren(editor);
    textArea.focus();
  }

  return card;
}

function quickAdd(phases) {
  const input = h('input', { type: 'text', placeholder: 'Quick-add a finding…', class: 'quick-add__input' });
  const catSel = h('select', {}, CATEGORIES.map((c) => h('option', { value: c.id }, c.label)));
  const phaseSel = h('select', {}, phases.map((p) => h('option', { value: p, selected: p === store.getSession().currentPhase }, p)));
  const add = () => {
    if (!input.value.trim()) return;
    store.update((s) => {
      s.findings.push(createFinding({ category: catSel.value, phase: phaseSel.value, text: input.value.trim(), source: 'manual' }));
    }, { reason: 'findings' });
    toast('Finding added');
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  return h('div', { class: 'quick-add' }, input, catSel, phaseSel, h('button', { class: 'btn btn--primary', onclick: add }, 'Add'));
}

function togglePresent() {
  const on = document.body.classList.toggle('present');
  if (on) document.documentElement.requestFullscreen?.().catch(() => {});
  else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

export function render(container) {
  const session = store.getSession();
  const phases = sessionPhases(session);
  if (phaseFilter && !phases.includes(phaseFilter)) phaseFilter = null;
  const status = h('span', { class: 'muted' });

  const visible = session.findings.filter((f) => !phaseFilter || f.phase === phaseFilter);

  const filterChips = h('div', { class: 'phase-filter' },
    h('button', { class: `chip chip--filter${phaseFilter === null ? ' chip--on' : ''}`, onclick: () => { phaseFilter = null; rerender(); } }, `All (${session.findings.length})`),
    phases.map((p) => {
      const n = session.findings.filter((f) => f.phase === p).length;
      return h('button', { class: `chip chip--filter${phaseFilter === p ? ' chip--on' : ''}`, onclick: () => { phaseFilter = phaseFilter === p ? null : p; rerender(); } }, `${p} (${n})`);
    }),
  );

  const columns = h('div', { class: 'board' }, CATEGORIES.map((cat) => {
    const items = visible.filter((f) => f.category === cat.id);
    return h('div', { class: `board__col board__col--${cat.id}` },
      h('div', { class: 'board__head' }, h('span', {}, cat.label), h('span', { class: 'board__count' }, String(items.length))),
      h('div', { class: 'board__cards' },
        items.length ? items.map((f) => findingCard(f, phases)) : h('p', { class: 'muted board__empty' }, '—'),
      ),
    );
  }));

  function rerender() {
    // local UI state (filter) changed — re-render without touching the store
    container.replaceChildren();
    render(container);
  }

  container.append(
    h('div', { class: 'board-toolbar' },
      h('h1', {}, 'Findings board'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => analyseNow(status) }, '✨ Analyse new transcript'),
        status,
        h('button', { class: 'btn', onclick: togglePresent, title: 'Fullscreen high-contrast view for the projector' }, '⛶ Present'),
      ),
    ),
    filterChips,
    quickAdd(phases),
    columns,
    h('button', { class: 'present-exit btn', onclick: togglePresent }, 'Exit present mode (Esc)'),
  );
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('present')) document.body.classList.remove('present');
});
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('present');
});
