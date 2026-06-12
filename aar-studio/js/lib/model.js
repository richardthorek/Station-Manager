// Session data model: factories, constants and import validation. Pure.

import { uid } from './text.js';

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
    speakers: {},
    report: null,
    ...partial,
  };
}

export function createSegment({ t = null, speaker = '', text = '', phase = GENERAL_PHASE, source = 'paste' } = {}) {
  return { id: uid(), t, speaker, text, phase, source, analysed: false };
}

export function createFinding({ category, phase = GENERAL_PHASE, text = '', quote = '', segmentIds = [], source = 'manual' }) {
  if (!CATEGORY_IDS.includes(category)) category = 'happened';
  return { id: uid(), category, phase, text, quote, segmentIds, source, createdAt: new Date().toISOString() };
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
    segmentIds: Array.isArray(f.segmentIds) ? f.segmentIds : [],
  }));
  if (!sessionPhases(s).includes(s.currentPhase)) s.currentPhase = GENERAL_PHASE;
  return s;
}
