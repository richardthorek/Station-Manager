// Review & edit: transcript text/phase/speaker editing, diarised speaker
// renaming, full findings curation.

import { h, toast } from '../ui.js';
import * as store from '../store.js';
import { CATEGORIES, sessionPhases, createFinding } from '../lib/model.js';
import { fmtClock } from '../lib/text.js';

function speakerPanel(session) {
  const raw = [...new Set(session.segments.map((s) => s.speaker).filter(Boolean))];
  if (!raw.length) return null;
  return h('section', { class: 'panel' },
    h('h2', {}, 'Speakers'),
    h('p', { class: 'muted' }, 'Rename diarised speakers — the new name is used everywhere (board, report, exports).'),
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Transcript name'), h('th', {}, 'Display as'))),
      h('tbody', {}, raw.map((name) => h('tr', {},
        h('td', {}, name),
        h('td', {}, h('input', {
          type: 'text', value: session.speakers[name] ?? '', placeholder: name,
          oninput: (e) => store.update((s) => {
            if (e.target.value.trim()) s.speakers[name] = e.target.value;
            else delete s.speakers[name];
          }, { silent: true }),
        })),
      ))),
    ),
  );
}

function transcriptPanel(session, phases) {
  if (!session.segments.length) return null;
  return h('section', { class: 'panel' },
    h('h2', {}, `Transcript (${session.segments.length} segments)`),
    h('div', { class: 'review-segments' }, session.segments.map((seg) => h('div', { class: 'review-segment' },
      h('div', { class: 'review-segment__meta' },
        seg.t != null ? h('span', { class: 'segment__time' }, fmtClock(seg.t)) : null,
        h('input', {
          type: 'text', class: 'review-segment__speaker', value: seg.speaker, placeholder: 'Speaker',
          oninput: (e) => store.update((s) => { const t = s.segments.find((x) => x.id === seg.id); if (t) t.speaker = e.target.value; }, { silent: true }),
        }),
        h('select', {
          onchange: (e) => store.update((s) => { const t = s.segments.find((x) => x.id === seg.id); if (t) t.phase = e.target.value; }, { silent: true }),
        }, phases.map((p) => h('option', { value: p, selected: p === seg.phase }, p))),
        h('button', { class: 'icon-btn', title: 'Delete segment', onclick: () => store.update((s) => { s.segments = s.segments.filter((x) => x.id !== seg.id); }, { reason: 'segments' }) }, '✕'),
      ),
      h('textarea', {
        rows: 2,
        oninput: (e) => store.update((s) => { const t = s.segments.find((x) => x.id === seg.id); if (t) t.text = e.target.value; }, { silent: true }),
      }, seg.text),
    ))),
  );
}

function findingsPanel(session, phases) {
  return h('section', { class: 'panel' },
    h('h2', {}, `Findings (${session.findings.length})`),
    h('div', { class: 'review-findings' }, session.findings.map((f) => h('div', { class: `review-finding review-finding--${f.category}` },
      h('div', { class: 'review-finding__meta' },
        h('select', {
          onchange: (e) => store.update((s) => { const t = s.findings.find((x) => x.id === f.id); if (t) t.category = e.target.value; }, { silent: true }),
        }, CATEGORIES.map((c) => h('option', { value: c.id, selected: c.id === f.category }, c.label))),
        h('select', {
          onchange: (e) => store.update((s) => { const t = s.findings.find((x) => x.id === f.id); if (t) t.phase = e.target.value; }, { silent: true }),
        }, phases.map((p) => h('option', { value: p, selected: p === f.phase }, p))),
        h('span', { class: `chip ${f.source === 'ai' ? 'chip--ai' : 'chip--manual'}` }, f.source),
        h('button', { class: 'icon-btn', title: 'Delete finding', onclick: () => store.update((s) => { s.findings = s.findings.filter((x) => x.id !== f.id); }, { reason: 'findings' }) }, '✕'),
      ),
      h('textarea', {
        rows: 2,
        oninput: (e) => store.update((s) => { const t = s.findings.find((x) => x.id === f.id); if (t) t.text = e.target.value; }, { silent: true }),
      }, f.text),
      h('input', {
        type: 'text', class: 'review-finding__quote', value: f.quote, placeholder: 'Verbatim quote (optional)',
        oninput: (e) => store.update((s) => { const t = s.findings.find((x) => x.id === f.id); if (t) t.quote = e.target.value; }, { silent: true }),
      }),
    ))),
    h('button', { class: 'btn', onclick: () => {
      store.update((s) => { s.findings.push(createFinding({ category: 'happened', phase: s.currentPhase })); }, { reason: 'findings' });
      toast('Empty finding added — fill it in');
    } }, '+ Add finding'),
  );
}

export function render(container) {
  const session = store.getSession();
  const phases = sessionPhases(session);
  // Findings lead — shaping the insights is the work that matters. Fixing the
  // raw transcript is optional and tucked into an Advanced section so it no
  // longer dominates the page (AAR insight-quality rework 2026-07-04).
  const hasTranscript = session.segments.length || Object.keys(session.speakers ?? {}).length
    || session.segments.some((s) => s.speaker);
  container.append(
    h('h1', {}, 'Edit findings'),
    h('p', { class: 'muted' }, 'Shape the insights the AI surfaced — edit the wording, category, phase or unit, or add your own. This is where the review is made.'),
    findingsPanel(session, phases),
    hasTranscript
      ? h('details', { class: 'advanced' },
          h('summary', {}, 'Advanced: fix the raw transcript & speaker names'),
          h('p', { class: 'muted' }, 'Usually unnecessary — the AI reads through garbled words on its own. Only dive in here if a finding is wrong because a word was badly misheard.'),
          speakerPanel(session),
          transcriptPanel(session, phases),
        )
      : null,
  );
}
