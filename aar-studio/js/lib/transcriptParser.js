// Transcript paste parser. Pure — returns plain {speaker, t, text} rows;
// the caller turns them into session segments.
//
// Supported formats (auto-detected):
//  - "teams-docx": the format you get copying a Teams transcript out of the
//    meeting recap / exported DOCX — a header line "Name   m:ss" (name, then
//    whitespace, then a timestamp ending the line) followed by one or more
//    text lines, until the next header.
//  - "vtt": WEBVTT cue files, including <v Speaker>text</v> voice spans.
//  - "speaker-colon": "Name: text" lines.
//  - "plain": fallback — each paragraph becomes one unattributed row.

import { parseClock } from './text.js';

const TEAMS_HEADER = /^(.{1,80}?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$/;
const SPEAKER_COLON = /^([A-Za-z][\w .,'()/-]{0,60}?):\s+(\S.*)$/;
const VTT_TIMING = /^(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s+-->\s+/;

export function parseTranscript(raw) {
  const text = String(raw ?? '').replace(/\r\n?/g, '\n').replace(/ /g, ' ');
  const lines = text.split('\n');
  if (/^﻿?WEBVTT\b/.test(text.trimStart())) return { format: 'vtt', rows: parseVtt(lines) };
  const teams = parseTeamsDocx(lines);
  if (teams.length >= 2) return { format: 'teams-docx', rows: teams };
  const colon = parseSpeakerColon(lines);
  if (colon.length >= 2) return { format: 'speaker-colon', rows: colon };
  return { format: 'plain', rows: parsePlain(text) };
}

function parseTeamsDocx(lines) {
  const rows = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(TEAMS_HEADER);
    // A header must have a non-numeric name part, otherwise "10:30" alone or
    // bare timestamps would match.
    if (m && /[A-Za-z]/.test(m[1])) {
      if (current?.text) rows.push(current);
      current = { speaker: m[1].trim(), t: parseClock(m[2]), text: '' };
    } else if (current && line.trim()) {
      current.text += (current.text ? ' ' : '') + line.trim();
    } else if (current && !line.trim() && current.text) {
      rows.push(current);
      current = null;
    }
  }
  if (current?.text) rows.push(current);
  return rows;
}

function parseSpeakerColon(lines) {
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(SPEAKER_COLON);
    // Limit "names" to a few words so prose containing a colon doesn't match.
    if (m && m[1].trim().split(/\s+/).length <= 5) {
      rows.push({ speaker: m[1].trim(), t: null, text: m[2].trim() });
    } else if (rows.length) {
      rows[rows.length - 1].text += ' ' + line.trim(); // continuation line
    }
  }
  return rows;
}

function parseVtt(lines) {
  const rows = [];
  let t = null;
  let pending = [];
  const flush = () => {
    if (!pending.length) return;
    for (const textLine of pending) {
      const v = textLine.match(/^<v\s+([^>]+)>\s*(.*?)(?:<\/v>)?$/);
      if (v) rows.push({ speaker: v[1].trim(), t, text: v[2].trim() });
      else if (rows.length && rows[rows.length - 1].t === t) rows[rows.length - 1].text += ' ' + textLine;
      else rows.push({ speaker: '', t, text: textLine });
    }
    pending = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (VTT_TIMING.test(line)) {
      flush();
      t = parseClock(line.split('-->')[0].trim());
    } else if (!line) {
      flush();
      t = null;
    } else if (t != null && !/^WEBVTT/.test(line) && !/^NOTE\b/.test(line)) {
      pending.push(line);
    }
  }
  flush();
  return rows.filter((r) => r.text);
}

function parsePlain(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map((p) => ({ speaker: '', t: null, text: p }));
}
