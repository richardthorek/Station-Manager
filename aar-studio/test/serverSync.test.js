import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toServerBody,
  isAuthed,
  pushSession,
  listServerSessions,
  fetchServerSession,
  deleteServerSession,
} from '../js/lib/serverSync.js';

const storageWith = (token) => ({ getItem: (k) => (k === 'auth_token' ? token : null) });

test('isAuthed reflects presence of the SPA token', () => {
  assert.equal(isAuthed(storageWith('jwt')), true);
  assert.equal(isAuthed(storageWith(null)), false);
});

test('toServerBody lifts title/date and serialises the whole session as payload', () => {
  const session = { id: 's1', schemaVersion: 1, incident: { title: '  Grass fire  ', date: '2026-06-21' } };
  const body = toServerBody(session);
  assert.equal(body.title, 'Grass fire');
  assert.equal(body.incidentDate, '2026-06-21');
  assert.equal(body.schemaVersion, 1);
  assert.deepEqual(JSON.parse(body.payload), session);
});

test('toServerBody falls back to a friendly title when none is set', () => {
  assert.equal(toServerBody({ id: 's1' }).title, 'Untitled review');
});

test('pushSession PUTs to the id-scoped URL with a bearer header', async () => {
  let seen = null;
  const fetchImpl = async (url, opts) => { seen = { url, opts }; return { ok: true, status: 200 }; };
  const res = await pushSession({ id: 's1', incident: { title: 'x' } }, { fetchImpl, token: 'jwt' });
  assert.equal(res.ok, true);
  assert.equal(seen.url, '/api/aar-sessions/s1');
  assert.equal(seen.opts.method, 'PUT');
  assert.equal(seen.opts.headers.Authorization, 'Bearer jwt');
});

test('pushSession is a no-op (no fetch) when signed out', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, status: 200 }; };
  const res = await pushSession({ id: 's1' }, { fetchImpl, token: null });
  assert.equal(res.ok, false);
  assert.equal(res.skipped, 'unauthenticated');
  assert.equal(called, false);
});

test('pushSession swallows network failures (best-effort)', async () => {
  const fetchImpl = async () => { throw new Error('offline'); };
  const res = await pushSession({ id: 's1' }, { fetchImpl, token: 'jwt' });
  assert.equal(res.ok, false);
  assert.equal(res.skipped, 'network');
});

test('listServerSessions maps rows to home-card summaries and marks them remote', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ sessions: [
    { id: 'a', title: 'A', incidentDate: '2026-06-01', updatedAt: '2026-06-02', createdByName: 'Bob' },
  ] }) });
  const list = await listServerSessions({ fetchImpl, token: 'jwt' });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'a');
  assert.equal(list[0].remote, true);
  assert.equal(list[0].createdByName, 'Bob');
});

test('listServerSessions returns [] when signed out or on error', async () => {
  assert.deepEqual(await listServerSessions({ token: null }), []);
  const fail = async () => ({ ok: false, status: 500 });
  assert.deepEqual(await listServerSessions({ fetchImpl: fail, token: 'jwt' }), []);
});

test('fetchServerSession parses the payload blob back into a session object', async () => {
  const session = { id: 'a', schemaVersion: 1, incident: { title: 'A' } };
  const fetchImpl = async () => ({ ok: true, json: async () => ({ session: { id: 'a', payload: JSON.stringify(session) } }) });
  assert.deepEqual(await fetchServerSession('a', { fetchImpl, token: 'jwt' }), session);
});

test('deleteServerSession DELETEs the id-scoped URL', async () => {
  let seen = null;
  const fetchImpl = async (url, opts) => { seen = { url, method: opts.method }; return { ok: true, status: 200 }; };
  const res = await deleteServerSession('a', { fetchImpl, token: 'jwt' });
  assert.equal(res.ok, true);
  assert.equal(seen.url, '/api/aar-sessions/a');
  assert.equal(seen.method, 'DELETE');
});
