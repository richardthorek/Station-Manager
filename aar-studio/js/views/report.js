// Report studio: every report field editable with a live preview, plus
// exports (snapshot HTML, Markdown summary, session JSON, print-to-PDF),
// and AI report generation from the curated findings.

import { h, toast, download, confirmDanger } from '../ui.js';
import * as store from '../store.js';
import { getSettings } from '../settings.js';
import { emptyReport, renderSnapshotHtml, renderCombinedHtml, renderMarkdown, sessionFilename } from '../lib/exports.js';
import { generateReport } from '../lib/reportGen.js';
import { LlmError, usesGateway } from '../lib/llm.js';

function field(labelText, input) {
  return h('label', { class: 'field' }, h('span', { class: 'field__label' }, labelText), input);
}

let generating = false;

async function generate(statusEl) {
  if (generating) return;
  const session = store.getSession();
  generating = true;
  if (statusEl) statusEl.textContent = 'Generating report from the findings… (this can take a minute on a large model)';
  try {
    const report = await generateReport({ session, settings: getSettings() });
    store.update((s) => { s.report = report; }, { reason: 'report' });
    toast('Report generated — every field below is editable');
  } catch (err) {
    const hint = err instanceof LlmError && err.hint ? ` — ${err.hint}` : '';
    toast(`${err.message}${hint}`, 'error', 8000);
    if (statusEl) statusEl.textContent = '';
  } finally {
    generating = false;
  }
}

export function render(container) {
  const session = store.getSession();

  if (!session.report) {
    const status = h('p', { class: 'muted', role: 'status' });
    const hasFindings = session.findings.length > 0;
    // Most facilitators are on the built-in AI and have never opened Settings
    // — telling them generation "uses the report deployment from ⚙ Settings"
    // is meaningless to that audience (AAR Studio hero review 2026-07-03,
    // AAR-23, same mismatch as AAR-9). Only BYO-Azure users need that detail.
    const gatewayHint = usesGateway(getSettings())
      ? 'Uses this site’s built-in AI — no setup needed.'
      : 'Generation uses the report deployment from ⚙ Settings (falls back to the chat deployment).';
    container.append(
      h('h1', {}, 'Report'),
      h('section', { class: 'panel' },
        h('p', {}, 'No report yet for this session.'),
        h('div', { class: 'btn-row' },
          h('button', {
            class: 'btn btn--primary', disabled: !hasFindings,
            title: hasFindings ? '' : 'Capture and analyse the discussion first — the report is built from the findings',
            onclick: (e) => { e.target.disabled = true; generate(status).finally(() => { e.target.disabled = false; }); },
          }, `✨ Generate with AI (${session.findings.length} findings)`),
          h('button', { class: 'btn', onclick: () => {
            store.update((s) => { s.report = emptyReport(s); }, { reason: 'report' });
          } }, 'Start from a blank template'),
        ),
        status,
        h('p', { class: 'muted' }, `${gatewayHint} Load the Wamboin sample from Home to see a finished report.`),
      ),
    );
    return;
  }

  const r = session.report;
  const preview = h('iframe', { class: 'report-preview', title: 'Report preview' });
  const refresh = () => { preview.srcdoc = renderSnapshotHtml(store.getSession()); };

  // Every edit autosaves silently and refreshes the preview; no re-render so
  // focus is preserved while typing.
  const edit = (apply) => (e) => {
    store.update((s) => apply(s.report, e.target.value), { silent: true });
    refresh();
  };
  const lines = (value) => (value ?? []).join('\n');
  const splitLines = (v) => v.split('\n').map((x) => x.trim()).filter(Boolean);
  const paras = (value) => (value ?? []).join('\n\n');
  const splitParas = (v) => v.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

  const statsBody = h('tbody', {}, r.stats.map((stat, i) => h('tr', {},
    h('td', {}, h('input', { type: 'text', value: stat.value, placeholder: '800', oninput: edit((rep, v) => { rep.stats[i].value = v; }) })),
    h('td', {}, h('input', { type: 'text', value: stat.label, placeholder: 'L/min ground monitor — decisive', oninput: edit((rep, v) => { rep.stats[i].label = v; }) })),
    h('td', {}, h('button', { class: 'icon-btn', onclick: () => store.update((s) => { s.report.stats.splice(i, 1); }, { reason: 'report' }) }, '✕')),
  )));

  const themeRows = r.themes.map((t, i) => h('div', { class: 'theme-row' },
    h('input', { type: 'text', value: t.title, placeholder: 'Theme title', oninput: edit((rep, v) => { rep.themes[i].title = v; }) }),
    h('textarea', { rows: 3, placeholder: 'Theme narrative', oninput: edit((rep, v) => { rep.themes[i].body = v; }) }, t.body),
    h('button', { class: 'icon-btn', onclick: () => store.update((s) => { s.report.themes.splice(i, 1); }, { reason: 'report' }) }, '✕'),
  ));

  const phaseEditors = r.phases.map((p, i) => h('details', { class: 'phase-report', open: true },
    h('summary', {}, p.name),
    field('What happened (narrative)', h('textarea', { rows: 4, oninput: edit((rep, v) => { rep.phases[i].happened = v; }) }, p.happened)),
    field('What went well (one bullet per line)', h('textarea', { rows: 4, oninput: (e) => { store.update((s) => { s.report.phases[i].well = splitLines(e.target.value); }, { silent: true }); refresh(); } }, lines(p.well))),
    field("What didn't go well / lessons (one bullet per line)", h('textarea', { rows: 4, oninput: (e) => { store.update((s) => { s.report.phases[i].didnt = splitLines(e.target.value); }, { silent: true }); refresh(); } }, lines(p.didnt))),
  ));

  const transcriptCheck = h('input', { type: 'checkbox' });
  const genStatus = h('span', { class: 'muted' });

  container.append(
    h('div', { class: 'board-toolbar' },
      h('h1', {}, 'Report'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn--primary', onclick: () => download(sessionFilename(session, 'snapshot', 'html'), renderSnapshotHtml(store.getSession()), 'text/html') }, '⬇ Snapshot HTML'),
        h('button', { class: 'btn', onclick: () => download(sessionFilename(session, 'report', 'html'), renderCombinedHtml(store.getSession(), { includeTranscript: transcriptCheck.checked }), 'text/html') }, '⬇ Combined report'),
        h('label', { class: 'field field--check', title: 'Append the full transcript to the combined report' }, transcriptCheck, h('span', {}, '+ transcript')),
        h('button', { class: 'btn', onclick: () => download(sessionFilename(session, 'summary', 'md'), renderMarkdown(store.getSession()), 'text/markdown') }, '⬇ Markdown'),
        h('button', { class: 'btn', onclick: () => download(sessionFilename(session, 'session', 'json'), store.exportSessionJson(), 'application/json') }, '⬇ Session JSON'),
        h('button', { class: 'btn', onclick: () => { preview.contentWindow?.print(); } }, '🖨 Print / PDF'),
        h('button', { class: 'btn', disabled: !session.findings.length, onclick: async (e) => {
          if (await confirmDanger('Regenerate the report with AI? Your current report (including manual edits) will be replaced.', { confirmLabel: 'Regenerate' })) {
            e.target.disabled = true;
            generate(genStatus).finally(() => { e.target.disabled = false; });
          }
        } }, '✨ Regenerate'),
        genStatus,
      ),
    ),
    h('div', { class: 'report-layout' },
      h('div', { class: 'report-form' },
        field('Headline', h('input', { type: 'text', value: r.headline, oninput: edit((rep, v) => { rep.headline = v; }) })),
        field('Context / property bar (one line, shown on red)', h('textarea', { rows: 2, oninput: edit((rep, v) => { rep.contextBar = v; }) }, r.contextBar)),
        h('fieldset', {},
          h('legend', {}, 'Key stats (aim for 4–6)'),
          h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Value'), h('th', {}, 'Label'), h('th'))), statsBody),
          h('button', { class: 'btn btn--small', onclick: () => store.update((s) => { s.report.stats.push({ value: '', label: '' }); }, { reason: 'report' }) }, '+ Add stat'),
        ),
        field('Incident snapshot (paragraphs, blank line between)', h('textarea', { rows: 5, oninput: (e) => { store.update((s) => { s.report.snapshot = splitParas(e.target.value); }, { silent: true }); refresh(); } }, paras(r.snapshot))),
        h('fieldset', {}, h('legend', {}, 'Per-phase detail'), phaseEditors),
        h('fieldset', {},
          h('legend', {}, 'Cross-cutting themes (0–3)'),
          themeRows,
          h('button', { class: 'btn btn--small', disabled: r.themes.length >= 3, onclick: () => store.update((s) => { s.report.themes.push({ title: '', body: '' }); }, { reason: 'report' }) }, '+ Add theme'),
        ),
        field('Consolidated recommendations (one per line)', h('textarea', { rows: 6, oninput: (e) => { store.update((s) => { s.report.recommendations = splitLines(e.target.value); }, { silent: true }); refresh(); } }, lines(r.recommendations))),
        h('fieldset', {},
          h('legend', {}, 'Top three actions'),
          [0, 1, 2].map((i) => field(`Action ${i + 1}`, h('textarea', { rows: 2, oninput: edit((rep, v) => { rep.actions[i] = v; }) }, r.actions[i] ?? ''))),
        ),
        field('Overall assessment', h('textarea', { rows: 4, oninput: edit((rep, v) => { rep.assessment = v; }) }, r.assessment)),
        field('Verification caveat (report footer)', h('textarea', { rows: 2, oninput: edit((rep, v) => { rep.caveat = v; }) }, r.caveat)),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn--danger', onclick: async () => {
            if (await confirmDanger('Discard the whole report? Findings and transcript are kept.', { confirmLabel: 'Discard' })) {
              store.update((s) => { s.report = null; }, { reason: 'report' });
              toast('Report discarded');
            }
          } }, 'Discard report'),
        ),
      ),
      h('div', { class: 'report-preview-pane' },
        h('h2', {}, 'Live preview — one-page snapshot'),
        preview,
      ),
    ),
  );
  refresh();
}
