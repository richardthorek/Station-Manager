// Session data model: factories, constants and import validation. Pure.

import { uid, friendlyDateTime } from './text.js';

export const SCHEMA_VERSION = 1;
export const GENERAL_PHASE = 'General';
export const DEFAULT_PHASES = ['Arrival', 'Rescue', 'Suppression', 'Overhaul'];

export const CATEGORIES = [
  { id: 'happened', label: 'What happened', short: 'Happened' },
  { id: 'well', label: 'What went well', short: 'Went well' },
  { id: 'didnt', label: "What didn't go well", short: "Didn't go well" },
  { id: 'next', label: 'What would we do next time', short: 'Next time' },
];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const INCIDENT_TYPES = [
  'Structure Fire', 'Bush/Grass Fire', 'Motor Vehicle Accident',
  'Storm/Flood', 'HAZMAT', 'Search/Rescue', 'Other',
];

export function createSession(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: uid(),
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    incident: { title: '', date: '', location: '', type: '' },
    aar: { date: '', location: '', facilitator: '' },
    units: [],
    phases: [...DEFAULT_PHASES],
    currentPhase: GENERAL_PHASE,
    segments: [],
    findings: [],
    notes: [],
    speakers: {},
    report: null,
    ...partial,
  };
}

/**
 * A room note: free text contributed live by a participant from their own
 * device during the review. `t` is the offset (seconds) from recording start
 * when known; `label` attributes the note ("Room" or a participant name).
 */
export function createNote({ text = '', label = 'Room', t = null, wallTs = Date.now() } = {}) {
  return { id: uid(), text: String(text), label: String(label || 'Room'), t, wallTs, source: 'note', analysed: false };
}

export function createSegment({ t = null, speaker = '', text = '', phase = GENERAL_PHASE, source = 'paste' } = {}) {
  return { id: uid(), t, speaker, text, phase, source, analysed: false };
}

export function createFinding({ category, phase = GENERAL_PHASE, text = '', quote = '', unit = '', segmentIds = [], source = 'manual' }) {
  if (!CATEGORY_IDS.includes(category)) category = 'happened';
  return { id: uid(), category, phase, unit: String(unit ?? ''), text, quote, segmentIds, source, createdAt: new Date().toISOString() };
}

/** Distinct, non-empty attending-unit names — the options for tagging a finding to a unit. */
export function sessionUnitNames(session) {
  const names = (session?.units ?? []).map((u) => String(u.unit ?? '').trim()).filter(Boolean);
  return [...new Set(names)];
}

/**
 * What to show as a review's name. Real incident title if the user (or the AI)
 * has one; otherwise a friendly fallback from when it was started, so a review
 * is never shown as "Untitled". `created` is the session's createdAt.
 */
export function displayTitle(session) {
  const title = session?.incident?.title?.trim();
  if (title) return title;
  const created = session?.createdAt ? new Date(session.createdAt) : new Date();
  return `Review — ${friendlyDateTime(created)}`;
}

/** Phases available for tagging: configured phases + the implicit General bucket. */
export function sessionPhases(session) {
  const phases = (session.phases ?? []).filter(Boolean);
  return phases.includes(GENERAL_PHASE) ? phases : [...phases, GENERAL_PHASE];
}

/** Display name for a (possibly diarised) speaker, via the rename map. */
export function speakerName(session, raw) {
  return (raw && session.speakers?.[raw]) || raw || 'Unknown';
}

/**
 * Validate + normalise an imported session object. Throws on structural
 * problems; fills gaps so older/hand-edited exports still load.
 */
export function normaliseSession(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Not a session object');
  if (obj.schemaVersion != null && obj.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`Session schemaVersion ${obj.schemaVersion} is newer than this app supports (${SCHEMA_VERSION})`);
  }
  const base = createSession();
  const s = {
    ...base,
    ...obj,
    id: typeof obj.id === 'string' && obj.id ? obj.id : base.id,
    schemaVersion: SCHEMA_VERSION,
    incident: { ...base.incident, ...(obj.incident ?? {}) },
    aar: { ...base.aar, ...(obj.aar ?? {}) },
    units: Array.isArray(obj.units) ? obj.units.map((u) => ({ unit: String(u.unit ?? ''), role: String(u.role ?? '') })) : [],
    phases: Array.isArray(obj.phases) && obj.phases.length ? obj.phases.map(String).filter((p) => p && p !== GENERAL_PHASE) : [...DEFAULT_PHASES],
    speakers: obj.speakers && typeof obj.speakers === 'object' ? { ...obj.speakers } : {},
    report: obj.report && typeof obj.report === 'object' ? obj.report : null,
  };
  s.segments = (Array.isArray(obj.segments) ? obj.segments : []).map((seg) => ({
    ...createSegment(), ...seg,
    id: seg.id || uid(),
    text: String(seg.text ?? ''),
    analysed: Boolean(seg.analysed),
  }));
  s.findings = (Array.isArray(obj.findings) ? obj.findings : []).map((f) => ({
    ...createFinding({ category: f.category }), ...f,
    id: f.id || uid(),
    category: CATEGORY_IDS.includes(f.category) ? f.category : 'happened',
    unit: String(f.unit ?? ''),
    segmentIds: Array.isArray(f.segmentIds) ? f.segmentIds : [],
  }));
  s.notes = (Array.isArray(obj.notes) ? obj.notes : []).map((n) => ({
    ...createNote(), ...n,
    id: n.id || uid(),
    text: String(n.text ?? ''),
    label: String(n.label || 'Room'),
    analysed: Boolean(n.analysed),
  }));
  if (!sessionPhases(s).includes(s.currentPhase)) s.currentPhase = GENERAL_PHASE;
  return s;
}
