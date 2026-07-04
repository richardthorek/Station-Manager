// Live findings board: four category columns, phase chips and filter,
// quick add, edit/delete, fullscreen high-contrast Present mode.

import { h, toast } from '../ui.js';
import * as store from '../store.js';
import { CATEGORIES, sessionPhases, sessionUnitNames, createFinding } from '../lib/model.js';
import { findMergeSuggestions, mergeFindings } from '../lib/dedupe.js';
import { analyseNow, getPersistentError, dismissPersistentError } from '../analyse.js';

let phaseFilter = null; // null = all
// Pairs the facilitator chose to "keep both", keyed by sorted finding-id pair.
// Session-local (resets on reload) so dismissed suggestions don't reappear.
const dismissedPairs = new Set();

const pairKey = (a, b) => [a.id, b.id].sort().join('|');

/** A unit-attribution <select>: a blank "no unit" option plus each attending unit. */
function unitSelect(units, selected = '') {
  return h('select', { 'aria-label': 'Attribute finding to a unit' },
    h('option', { value: '', selected: !selected }, '— no unit'),
    units.map((u) => h('option', { value: u, selected: u === selected }, u)),
  );
}

/**
 * A latched 401/402/403 from auto-extraction (AAR-10): a single dismissible
 * banner instead of an identical toast every 45s for the rest of the meeting.
 * Dismissing lets the next auto-extract pass try again.
 */
function aiErrorBanner() {
  const err = getPersistentError();
  if (!err) return null;
  return h('div', { class: 'ai-error-banner', role: 'alert' },
    h('span', {}, `${err.message}${err.hint ? ` — ${err.hint}` : ''}`),
    h('button', { class: 'btn btn--small', onclick: () => { dismissPersistentError(); store.update(() => {}, { reason: 'live' }); } }, 'Dismiss'),
  );
}

function mergeSuggestionsPanel(session) {
  const suggestions = findMergeSuggestions(session.findings)
    .filter((p) => !dismissedPairs.has(pairKey(p.a, p.b)));
  if (!suggestions.length) return null;

  const catLabel = (id) => (CATEGORIES.find((c) => c.id === id)?.label ?? id);

  return h('section', { class: 'merge-panel', role: 'region', 'aria-label': 'Possible duplicate findings' },
    h('div', { class: 'merge-panel__head' },
      h('span', { class: 'merge-panel__title' }, `⚠ ${suggestions.length} possible duplicate${suggestions.length > 1 ? 's' : ''}`),
      h('span', { class: 'muted' }, 'Merge to combine, or keep both.'),
    ),
    h('ul', { class: 'merge-panel__list', role: 'list' }, suggestions.map((p) => {
      const item = h('li', { class: 'merge-suggestion', role: 'listitem', 'aria-label': `Possible duplicate in ${catLabel(p.a.category)}` },
        h('div', { class: 'merge-suggestion__texts' },
          h('p', { class: 'merge-suggestion__text' }, p.a.text),
          h('p', { class: 'merge-suggestion__text' }, p.b.text),
        ),
        h('div', { class: 'merge-suggestion__actions btn-row' },
          h('button', {
            class: 'btn btn--small btn--primary',
            'aria-label': 'Merge these two findings into one',
            onclick: () => {
              store.update((s) => {
                const a = s.findings.find((x) => x.id === p.a.id);
                const b = s.findings.find((x) => x.id === p.b.id);
                if (!a || !b) return;
                Object.assign(a, mergeFindings(a, b));
                s.findings = s.findings.filter((x) => x.id !== b.id);
              }, { reason: 'findings' });
              toast('Findings merged');
            },
          }, 'Merge'),
          h('button', {
            class: 'btn btn--small',
            'aria-label': 'Keep both findings',
            onclick: () => { dismissedPairs.add(pairKey(p.a, p.b)); store.update(() => {}, { reason: 'findings' }); },
          }, 'Keep both'),
        ),
      );
      return item;
    })),
  );
}

function findingCard(f, phases, units) {
  const card = h('div', { class: `finding finding--${f.category}`, role: 'listitem' });
  // The card is the primary edit surface — tap the text to refine the insight
  // (the whole point of AAR Studio is shaping findings, not transcript). The
  // meta-row buttons stopPropagation so a delete tap doesn't also open the
  // editor (AAR insight-quality rework 2026-07-04).
  const body = h('div', {
    class: 'finding__text', role: 'button', tabindex: '0', title: 'Tap to edit this finding',
    onclick: () => editInline(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editInline(); } },
  }, f.text);
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  card.append(
    body,
    h('div', { class: 'finding__meta' },
      h('span', { class: 'chip chip--phase' }, f.phase),
      f.unit ? h('span', { class: 'chip chip--unit', title: `Attributed to ${f.unit}` }, f.unit) : null,
      f.source === 'ai' ? h('span', { class: 'chip chip--ai', title: f.quote ? `“${f.quote}”` : 'AI extracted' }, 'AI') : null,
      h('span', { class: 'finding__tools' },
        h('button', { class: 'icon-btn', title: 'Edit', 'aria-label': 'Edit finding', onclick: stop(() => editInline()) }, '✎'),
        h('button', { class: 'icon-btn', title: 'Delete', 'aria-label': 'Delete finding', onclick: stop(() => store.update((s) => { s.findings = s.findings.filter((x) => x.id !== f.id); }, { reason: 'findings' })) }, '✕'),
      ),
    ),
    f.quote ? h('div', { class: 'finding__quote' }, `“${f.quote}”`) : null,
  );

  function editInline() {
    const textArea = h('textarea', { rows: 3 }, f.text);
    const catSel = h('select', {}, CATEGORIES.map((c) => h('option', { value: c.id, selected: c.id === f.category }, c.label)));
    const phaseSel = h('select', {}, phases.map((p) => h('option', { value: p, selected: p === f.phase }, p)));
    const unitSel = units.length ? unitSelect(units, f.unit) : null;
    const editor = h('div', { class: 'finding__editor' },
      textArea,
      h('div', { class: 'btn-row' },
        catSel, phaseSel, unitSel,
        h('button', { class: 'btn btn--small btn--primary', onclick: () => {
          store.update((s) => {
            const target = s.findings.find((x) => x.id === f.id);
            if (target) Object.assign(target, { text: textArea.value.trim(), category: catSel.value, phase: phaseSel.value, unit: unitSel ? unitSel.value : f.unit });
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

function quickAdd(phases, units) {
  const input = h('input', { type: 'text', placeholder: 'Quick-add a finding…', class: 'quick-add__input' });
  const catSel = h('select', {}, CATEGORIES.map((c) => h('option', { value: c.id }, c.label)));
  const phaseSel = h('select', {}, phases.map((p) => h('option', { value: p, selected: p === store.getSession().currentPhase }, p)));
  const unitSel = units.length ? unitSelect(units) : null;
  const add = () => {
    if (!input.value.trim()) return;
    store.update((s) => {
      s.findings.push(createFinding({ category: catSel.value, phase: phaseSel.value, unit: unitSel ? unitSel.value : '', text: input.value.trim(), source: 'manual' }));
    }, { reason: 'findings' });
    toast('Finding added');
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  return h('div', { class: 'quick-add' }, input, catSel, phaseSel, unitSel, h('button', { class: 'btn btn--primary', onclick: add }, 'Add'));
}

function togglePresent() {
  const on = document.body.classList.toggle('present');
  if (on) document.documentElement.requestFullscreen?.().catch(() => {});
  else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

export function render(container) {
  const session = store.getSession();
  const phases = sessionPhases(session);
  const units = sessionUnitNames(session);
  if (phaseFilter && !phases.includes(phaseFilter)) phaseFilter = null;
  const status = h('span', { class: 'muted', role: 'status', 'aria-live': 'polite' });

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
    return h('div', { class: `board__col board__col--${cat.id}`, role: 'group', 'aria-label': `${cat.label} (${items.length})` },
      h('div', { class: 'board__head' }, h('span', {}, cat.label), h('span', { class: 'board__count', 'aria-hidden': 'true' }, String(items.length))),
      h('div', { class: 'board__cards', role: 'list' },
        items.length ? items.map((f) => findingCard(f, phases, units)) : h('p', { class: 'muted board__empty' }, '—'),
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
    aiErrorBanner(),
    filterChips,
    mergeSuggestionsPanel(session),
    quickAdd(phases, units),
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
