// Session setup: incident, AAR meeting details, attending units, phases.

import { h, toast } from '../ui.js';
import * as store from '../store.js';
import { INCIDENT_TYPES, GENERAL_PHASE } from '../lib/model.js';

function field(labelText, input) {
  return h('label', { class: 'field' }, h('span', { class: 'field__label' }, labelText), input);
}

// Field edits persist silently (autosave) without re-rendering, so typing
// keeps focus. Structural edits (rows added/removed) re-render.
function bind(getValue, apply) {
  return {
    oninput: (e) => store.update((s) => apply(s, e.target.value ?? getValue(e)), { silent: true }),
  };
}

export function render(container) {
  const s = store.getSession();

  const text = (value, apply, attrs = {}) =>
    h('input', { type: 'text', value, ...attrs, ...bind(() => value, apply) });

  const unitsBody = h('tbody', {}, s.units.map((u, i) => h('tr', {},
    h('td', {}, text(u.unit, (sess, v) => { sess.units[i].unit = v; }, { placeholder: 'Unit / agency' })),
    h('td', {}, text(u.role, (sess, v) => { sess.units[i].role = v; }, { placeholder: 'Role on the ground' })),
    h('td', {}, h('button', { class: 'btn btn--small btn--danger', onclick: () => store.update((sess) => sess.units.splice(i, 1)) }, '✕')),
  )));

  const phaseList = h('div', { class: 'phase-editor' },
    s.phases.map((p, i) => h('div', { class: 'phase-editor__row' },
      text(p, (sess, v) => { sess.phases[i] = v; }),
      h('button', { class: 'btn btn--small btn--danger', title: 'Remove phase', onclick: () => store.update((sess) => sess.phases.splice(i, 1)) }, '✕'),
    )),
    h('div', { class: 'muted' }, `Plus an implicit “${GENERAL_PHASE}” bucket for anything not tied to a phase.`),
  );

  container.append(
    h('h1', {}, 'Review details'),
    h('p', { class: 'muted setup-intro' },
      'All optional — you can leave any of this blank and the app will fill in the title, location and crews from the discussion. Edit anything here or later.'),
    h('div', { class: 'form-grid' },
      h('fieldset', {},
        h('legend', {}, 'Incident'),
        field('Title', text(s.incident.title, (sess, v) => { sess.incident.title = v; }, { placeholder: 'e.g. Structure fire — 12 Smith St (or leave blank)' })),
        field('Date', h('input', { type: 'date', value: s.incident.date, ...bind(null, (sess, v) => { sess.incident.date = v; }) })),
        field('Location', text(s.incident.location, (sess, v) => { sess.incident.location = v; })),
        field('Type', h('select', {
          onchange: (e) => store.update((sess) => { sess.incident.type = e.target.value; }, { silent: true }),
        }, [h('option', { value: '', selected: !s.incident.type }, '—'),
            ...INCIDENT_TYPES.map((t) => h('option', { value: t, selected: s.incident.type === t }, t))])),
      ),
      h('fieldset', {},
        h('legend', {}, 'AAR meeting'),
        field('Date', h('input', { type: 'date', value: s.aar.date, ...bind(null, (sess, v) => { sess.aar.date = v; }) })),
        field('Location', text(s.aar.location, (sess, v) => { sess.aar.location = v; }, { placeholder: 'e.g. Bungendore Station' })),
        field('Facilitator', text(s.aar.facilitator, (sess, v) => { sess.aar.facilitator = v; })),
      ),
    ),
    h('fieldset', {},
      h('legend', {}, 'Attending units'),
      h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Unit'), h('th', {}, 'Role'), h('th', {}, ''))),
        unitsBody,
      ),
      h('button', { class: 'btn', onclick: () => store.update((sess) => sess.units.push({ unit: '', role: '' })) }, '+ Add unit'),
    ),
    h('details', { class: 'advanced' },
      h('summary', {}, 'Advanced: incident phases'),
      h('p', { class: 'muted' }, 'The AI groups findings into these phases automatically — you only need to change them for an unusual job.'),
      phaseList,
      h('button', { class: 'btn', onclick: () => store.update((sess) => sess.phases.push('')) }, '+ Add phase'),
    ),
    h('div', { class: 'page-actions' },
      h('button', { class: 'btn btn--primary btn--big', onclick: () => { toast('Saved'); location.hash = '#/capture'; } }, 'Start recording →'),
    ),
  );
}
