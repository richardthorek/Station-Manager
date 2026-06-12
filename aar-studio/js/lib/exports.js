// Report template + export renderers (one-page snapshot HTML, Markdown
// summary, findings register). Pure string building — testable under node.

import { CATEGORIES, GENERAL_PHASE, categoryLabel, sessionPhases, speakerName } from './model.js';
import { escapeHtml as esc, fmtClock, slugify } from './text.js';

/** Blank report structure, pre-filled from session metadata. */
export function emptyReport(session) {
  return {
    headline: session.incident.title || '',
    contextBar: '',
    stats: [],                       // [{ value, label }] — aim for 4–6
    snapshot: [],                    // paragraphs
    phases: (session.phases ?? []).map((name) => ({ name, happened: '', well: [], didnt: [] })),
    themes: [],                      // [{ title, body }] — 0–3 cross-cutting
    recommendations: [],             // strings
    actions: ['', '', ''],           // top three
    assessment: '',
    caveat: 'Compiled from the AAR meeting transcript — verify names, callsigns and figures before wider distribution.',
  };
}

export function sessionFilename(session, suffix, ext) {
  return `${slugify(session.incident.title || 'aar')}-${suffix}.${ext}`;
}

function subLine(session) {
  const bits = [];
  if (session.incident.type) bits.push(esc(session.incident.type));
  const aarBits = [];
  if (session.aar.date) aarBits.push(`AAR held ${esc(session.aar.date)}`);
  if (session.aar.location) aarBits.push(esc(session.aar.location));
  if (aarBits.length) bits.push(aarBits.join(', '));
  return bits.join(' &nbsp;&middot;&nbsp; ');
}

/**
 * One-page executive snapshot, a standalone HTML document: dark header,
 * red context bar, stats row, the incident, who attended, What worked /
 * Lessons columns, Top three actions footer.
 */
export function renderSnapshotHtml(session) {
  const r = session.report ?? emptyReport(session);
  const stats = (r.stats ?? []).filter((s) => s.value || s.label);
  const statsRow = stats.length
    ? `<table class="factrow"><tr>${stats.map((s) => `<td><span class="num">${esc(s.value)}</span><span class="lbl">${esc(s.label)}</span></td>`).join('')}</tr></table>`
    : '';

  const unitRows = [];
  const units = session.units ?? [];
  for (let i = 0; i < units.length; i += 2) {
    const pair = [units[i], units[i + 1]].filter(Boolean)
      .map((u) => `<td class="unit">${esc(u.unit)}</td><td>${esc(u.role)}</td>`).join('\n          ');
    unitRows.push(`      <tr>${pair}</tr>`);
  }

  const well = (r.phases ?? []).flatMap((p) => p.well ?? []);
  const didnt = (r.phases ?? []).flatMap((p) => p.didnt ?? []);
  const bullet = (text) => {
    // "Bold lead. rest" — bold up to the first sentence break, like the example.
    const m = String(text).match(/^(.{3,80}?[.:])\s+(.*)$/s);
    return m ? `<li><b>${esc(m[1])}</b> ${esc(m[2])}</li>` : `<li>${esc(text)}</li>`;
  };

  const themes = (r.themes ?? []).filter((t) => t.title || t.body)
    .map((t) => `<h2>${esc(t.title)}</h2><div class="incident"><p>${esc(t.body)}</p></div>`).join('\n');

  const actions = (r.actions ?? []).filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(r.headline || session.incident.title || 'AAR Snapshot')}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color:#1a1f24; font-size:9.2pt; line-height:1.32; }
  .page { max-width:210mm; margin:0 auto; }
  .header { background:#15212b; color:#fff; padding:16px 24px 13px 24px; }
  .header .kicker { font-size:8pt; letter-spacing:2.5px; color:#e8b84b; text-transform:uppercase; font-weight:bold; }
  .header h1 { font-size:19pt; font-weight:bold; margin-top:3px; letter-spacing:0.3px; }
  .header .sub { font-size:9pt; color:#b9c4cd; margin-top:4px; }
  .header .sub b { color:#fff; }
  .redbar { background:#c8102e; color:#fff; padding:6px 24px; font-size:8.6pt; }
  .section { padding:0 24px; }
  .factrow { width:100%; border-collapse:collapse; margin-top:10px; table-layout:fixed; }
  .factrow td { text-align:center; padding:7px 4px; background:#f1f4f6; border-left:3px solid #fff; vertical-align:top; }
  .factrow td:first-child { border-left:none; }
  .factrow .num { font-size:15pt; font-weight:bold; color:#c8102e; display:block; }
  .factrow .lbl { font-size:7.2pt; text-transform:uppercase; letter-spacing:0.6px; color:#4a5560; display:block; margin-top:2px; }
  h2 { font-size:9.5pt; text-transform:uppercase; letter-spacing:1.4px; color:#15212b; border-bottom:2px solid #c8102e; padding-bottom:2px; margin:11px 0 5px 0; }
  .incident p { margin-bottom:4px; }
  .brigades { width:100%; border-collapse:collapse; margin-top:2px; }
  .brigades td { font-size:8.4pt; padding:3px 8px 3px 0; vertical-align:top; }
  .brigades .unit { font-weight:bold; white-space:nowrap; color:#15212b; padding-right:10px; }
  .cols { width:100%; border-collapse:collapse; margin-top:2px; }
  .cols > tbody > tr > td { width:50%; vertical-align:top; }
  .cols td.left { padding-right:11px; }
  .cols td.right { padding-left:11px; border-left:1px solid #dde3e8; }
  .colhead { font-size:9pt; font-weight:bold; text-transform:uppercase; letter-spacing:1px; padding:4px 8px; margin-bottom:5px; color:#fff; }
  .good { background:#1f7a4d; }
  .bad  { background:#c8102e; }
  ul { list-style:none; }
  ul li { padding-left:13px; position:relative; margin-bottom:4px; font-size:8.7pt; }
  ul.g li:before { content:"+"; position:absolute; left:0; color:#1f7a4d; font-weight:bold; }
  ul.b li:before { content:"!"; position:absolute; left:0; color:#c8102e; font-weight:bold; }
  li b { color:#15212b; }
  .actions { background:#15212b; color:#fff; margin:11px 24px 0 24px; padding:9px 14px 8px 14px; }
  .actions .ah { font-size:8pt; letter-spacing:2px; text-transform:uppercase; color:#e8b84b; font-weight:bold; margin-bottom:4px; }
  .actions table { width:100%; border-collapse:collapse; }
  .actions td { vertical-align:top; font-size:8.4pt; line-height:1.3; padding-right:12px; width:33%; }
  .actions .n { color:#e8b84b; font-weight:bold; font-size:11pt; padding-right:6px; }
  .footer { padding:7px 24px 10px 24px; font-size:7.2pt; color:#7a8590; }
  @media print { .page { max-width:none; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="kicker">After Action Review &mdash; Executive Snapshot</div>
    <h1>${esc(r.headline || session.incident.title)}</h1>
    <div class="sub">${subLine(session)}</div>
  </div>
${r.contextBar ? `  <div class="redbar">${esc(r.contextBar)}</div>` : ''}
  <div class="section">
    ${statsRow}
${(r.snapshot ?? []).length ? `    <h2>The incident</h2>
    <div class="incident">${(r.snapshot ?? []).map((p) => `<p>${esc(p)}</p>`).join('\n')}</div>` : ''}
${unitRows.length ? `    <h2>Who attended</h2>
    <table class="brigades">
${unitRows.join('\n')}
    </table>` : ''}
    <table class="cols"><tbody><tr>
      <td class="left">
        <div class="colhead good">What worked</div>
        <ul class="g">
${well.map(bullet).join('\n')}
        </ul>
      </td>
      <td class="right">
        <div class="colhead bad">Lessons &mdash; fix next time</div>
        <ul class="b">
${didnt.map(bullet).join('\n')}
        </ul>
      </td>
    </tr></tbody></table>
${themes}
  </div>
${actions.length ? `  <div class="actions">
    <div class="ah">Top three actions</div>
    <table><tr>
${actions.map((a, i) => `      <td><span class="n">${i + 1}</span>${esc(a)}</td>`).join('\n')}
    </tr></table>
  </div>` : ''}
${r.assessment ? `  <div class="section"><h2>Overall assessment</h2><div class="incident"><p>${esc(r.assessment)}</p></div></div>` : ''}
${r.caveat ? `  <div class="footer">${esc(r.caveat)}</div>` : ''}
</div>
</body>
</html>
`;
}

/** Markdown summary document (report + findings register). */
export function renderMarkdown(session) {
  const r = session.report ?? emptyReport(session);
  const out = [];
  out.push(`# After Action Review — ${r.headline || session.incident.title || 'Untitled incident'}`, '');
  const meta = [];
  if (session.aar.date || session.aar.location) meta.push(`**AAR conducted:** ${[session.aar.date, session.aar.location].filter(Boolean).join(', ')}`);
  if (session.aar.facilitator) meta.push(`**Facilitator:** ${session.aar.facilitator}`);
  if (session.incident.date || session.incident.location) meta.push(`**Incident:** ${[session.incident.type, session.incident.date, session.incident.location].filter(Boolean).join(', ')}`);
  if (session.phases?.length) meta.push(`**Format:** ${session.phases.join(' → ')}`);
  if (r.caveat) meta.push(`**Note:** ${r.caveat}`);
  if (meta.length) out.push(meta.join('\n'), '');

  if (r.contextBar) out.push(`> ${r.contextBar}`, '');
  if (r.stats?.length) {
    out.push('| | |', '|---|---|');
    for (const s of r.stats) out.push(`| **${s.value}** | ${s.label} |`);
    out.push('');
  }
  if (r.snapshot?.length) out.push('## Incident snapshot', '', ...r.snapshot.flatMap((p) => [p, '']));

  if (session.units?.length) {
    out.push('## Attending units', '', '| Unit | Role |', '|------|------|');
    for (const u of session.units) out.push(`| ${u.unit} | ${u.role} |`);
    out.push('');
  }

  for (const p of r.phases ?? []) {
    if (!p.happened && !(p.well?.length) && !(p.didnt?.length)) continue;
    out.push(`## ${p.name}`, '');
    if (p.happened) out.push(p.happened, '');
    if (p.well?.length) out.push('### What went well', '', ...p.well.map((b) => `- ${b}`), '');
    if (p.didnt?.length) out.push("### What didn't / lessons", '', ...p.didnt.map((b) => `- ${b}`), '');
  }

  for (const t of r.themes ?? []) {
    if (!t.title && !t.body) continue;
    out.push(`## ${t.title}`, '', t.body, '');
  }

  if (r.recommendations?.length) {
    out.push('## Consolidated recommendations', '', ...r.recommendations.map((rec, i) => `${i + 1}. ${rec}`), '');
  }
  const actions = (r.actions ?? []).filter(Boolean);
  if (actions.length) out.push('## Top three actions', '', ...actions.map((a, i) => `${i + 1}. **${a}**`), '');
  if (r.assessment) out.push('## Overall assessment', '', r.assessment, '');

  out.push(...renderFindingsRegister(session));
  return out.join('\n');
}

/** Findings register section (Markdown lines). */
export function renderFindingsRegister(session) {
  if (!session.findings?.length) return [];
  const out = ['## Findings register', ''];
  for (const phase of sessionPhases(session)) {
    const inPhase = session.findings.filter((f) => f.phase === phase);
    if (!inPhase.length) continue;
    out.push(`### ${phase}`, '');
    for (const cat of CATEGORIES) {
      for (const f of inPhase.filter((x) => x.category === cat.id)) {
        const quote = f.quote ? ` — “${f.quote}”` : '';
        out.push(`- **[${cat.short}]** ${f.text}${quote}`);
      }
    }
    out.push('');
  }
  return out;
}

/** Plain-text transcript (speaker rename map applied) for appendices. */
export function renderTranscriptText(session) {
  return (session.segments ?? [])
    .map((s) => {
      const t = s.t != null ? `[${fmtClock(s.t)}] ` : '';
      const sp = s.speaker ? `${speakerName(session, s.speaker)}: ` : '';
      return `${t}${sp}${s.text}`;
    })
    .join('\n\n');
}

// re-export for view convenience
export { categoryLabel, GENERAL_PHASE };
