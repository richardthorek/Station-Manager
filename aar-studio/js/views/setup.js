// Session setup: incident, AAR meeting details, attending units, phases.

import { h, toast } from '../ui.js';
import * as store from '../store.js';
import { INCIDENT_TYPES, GENERAL_PHASE } from '../lib/model.js';
import { isAuthed } from '../lib/serverSync.js';
import { loadRoster } from '../lib/roster.js';

const STATION_LIST_ID = 'roster-stations';
const MEMBER_LIST_ID = 'roster-members';

/**
 * When signed in, turn the free-text location/facilitator fields into
 * roster-backed typeaheads by filling the page's <datalist> elements. Additive
 * and best-effort: the inputs stay plain free text if the roster can't load, so
 * the signed-out flow is unchanged.
 */
async function populateRoster(container) {
  if (!isAuthed()) return;
  const { stations, members } = await loadRoster();
  const fill = (id, values) => {
    const list = container.querySelector(`#${id}`);
    if (!list || !values.length) return;
    list.replaceChildren(...values.map((v) => h('option', { value: v })));
  };
  fill(STATION_LIST_ID, stations.map((s) => s.name));
  fill(MEMBER_LIST_ID, members);
}

function field(labelText, input) {
  return h('label', { class: 'field' }, h('span', { class: 'field__label' }, labelText), input);
}

// Field edits persist silently (autosave) without re-rendering, so typing
// keeps focus. Structural edits (rows added/removed) re-render.
function bind(getValue, apply, isDisabled) {
  return {
    oninput: (e) => {
      if (isDisabled) return;
      store.update((s) => apply(s, e.target.value ?? getValue(e)), { silent: true });
    },
  };
}

export function render(container) {
  const s = store.getSession();
  const isDemo = s.isDemo;

  const text = (value, apply, attrs = {}) =>
    h('input', { type: 'text', value, disabled: isDemo, ...attrs, ...bind(() => value, apply, isDemo) });

  const unitsBody = h('tbody', {}, s.units.map((u, i) => h('tr', {},
    h('td', {}, text(u.unit, (sess, v) => { sess.units[i].unit = v; }, { placeholder: 'Unit / agency' })),
    h('td', {}, text(u.role, (sess, v) => { sess.units[i].role = v; }, { placeholder: 'Role on the ground' })),
    h('td', {}, h('button', { class: 'btn btn--small btn--danger', disabled: isDemo, onclick: () => store.update((sess) => sess.units.splice(i, 1)) }, '✕')),
  )));

  const phaseList = h('div', { class: 'phase-editor' },
    s.phases.map((p, i) => h('div', { class: 'phase-editor__row' },
      text(p, (sess, v) => { sess.phases[i] = v; }),
      h('button', { class: 'btn btn--small btn--danger', disabled: isDemo, title: 'Remove phase', onclick: () => store.update((sess) => sess.phases.splice(i, 1)) }, '✕'),
    )),
    h('div', { class: 'muted' }, `Plus an implicit “${GENERAL_PHASE}” bucket for anything not tied to a phase.`),
  );

  container.append(
    h('h1', {}, 'Review details'),
    h('p', { class: 'muted setup-intro' },
      isDemo ? 'This is a sample demo — review details are read-only.' : 'All optional — you can leave any of this blank and the app will fill in the title, location and crews from the discussion. Edit anything here or later.'),
    h('div', { class: 'form-grid' },
      h('fieldset', {},
        h('legend', {}, 'Incident'),
        field('Title', text(s.incident.title, (sess, v) => { sess.incident.title = v; }, { placeholder: 'e.g. Structure fire — 12 Smith St (or leave blank)' })),
        field('Date', h('input', { type: 'date', disabled: isDemo, value: s.incident.date, ...bind(null, (sess, v) => { sess.incident.date = v; }, isDemo) })),
        field('Location', text(s.incident.location, (sess, v) => { sess.incident.location = v; sess.incident.locationIsAuto = false; }, { list: STATION_LIST_ID })),
        field('Type', h('select', {
          disabled: isDemo,
          onchange: (e) => store.update((sess) => { sess.incident.type = e.target.value; }, { silent: true }),
        }, [h('option', { value: '', selected: !s.incident.type }, '—'),
            ...INCIDENT_TYPES.map((t) => h('option', { value: t, selected: s.incident.type === t }, t))])),
      ),
      h('fieldset', {},
        h('legend', {}, 'AAR meeting'),
        field('Date', h('input', { type: 'date', disabled: isDemo, value: s.aar.date, ...bind(null, (sess, v) => { sess.aar.date = v; }, isDemo) })),
        field('Location', text(s.aar.location, (sess, v) => { sess.aar.location = v; }, { placeholder: 'e.g. Example Station', list: STATION_LIST_ID })),
        field('Facilitator', text(s.aar.facilitator, (sess, v) => { sess.aar.facilitator = v; }, { list: MEMBER_LIST_ID })),
      ),
    ),
    h('fieldset', {},
      h('legend', {}, 'Attending units'),
      h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Unit'), h('th', {}, 'Role'), h('th', {}, ''))),
        unitsBody,
      ),
      h('button', { class: 'btn', disabled: isDemo, onclick: () => store.update((sess) => sess.units.push({ unit: '', role: '' })) }, '+ Add unit'),
    ),
    h('details', { class: 'advanced' },
      h('summary', {}, 'Advanced: incident phases'),
      h('p', { class: 'muted' }, isDemo ? 'Sample demo — read-only' : 'The AI groups findings into these phases automatically — you only need to change them for an unusual job.'),
      phaseList,
      h('button', { class: 'btn', disabled: isDemo, onclick: () => store.update((sess) => sess.phases.push('')) }, '+ Add phase'),
    ),
    // Roster typeaheads (filled async when signed in; harmless when empty).
    h('datalist', { id: STATION_LIST_ID }),
    h('datalist', { id: MEMBER_LIST_ID }),
    h('div', { class: 'page-actions' },
      h('button', { class: 'btn btn--primary btn--big', onclick: () => { toast('Saved'); location.hash = '#/capture'; } }, 'Start recording →'),
    ),
  );

  // Pull station/member names from the SM roster to back the typeaheads.
  populateRoster(container).catch(() => {});
}
