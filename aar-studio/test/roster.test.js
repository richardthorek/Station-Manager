import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchStations, fetchMembers, loadRoster } from '../js/lib/roster.js';

const jsonRes = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

test('fetchStations maps the {stations} envelope to {id,name} and skips junk', async () => {
  const fetchImpl = async () => jsonRes({ stations: [
    { id: 's1', name: 'Bungendore' },
    { id: 's2', name: 'Captains Flat' },
    { name: 'no id — dropped' },
  ] });
  const out = await fetchStations({ fetchImpl, token: 'jwt' });
  assert.deepEqual(out, [{ id: 's1', name: 'Bungendore' }, { id: 's2', name: 'Captains Flat' }]);
});

test('fetchStations returns [] when signed out (no request) or on error', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return jsonRes({ stations: [] }); };
  assert.deepEqual(await fetchStations({ fetchImpl, token: null }), []);
  assert.equal(called, false);
  assert.deepEqual(await fetchStations({ fetchImpl: async () => jsonRes({}, false), token: 'jwt' }), []);
});

test('fetchMembers returns active, non-deleted member names and passes stationId', async () => {
  let seenUrl = '';
  const fetchImpl = async (url) => { seenUrl = url; return jsonRes([
    { name: 'Alice', isActive: true },
    { name: 'Bob', isDeleted: true },
    { name: 'Carol' },
  ]); };
  const out = await fetchMembers({ fetchImpl, token: 'jwt', stationId: 's1' });
  assert.deepEqual(out, ['Alice', 'Carol']);
  assert.equal(seenUrl, '/api/members?stationId=s1');
});

test('loadRoster merges + de-dups member names across stations and sorts them', async () => {
  const fetchImpl = async (url) => {
    if (url === '/api/stations') return jsonRes({ stations: [{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }] });
    if (url.startsWith('/api/members') && url.includes('s1')) return jsonRes([{ name: 'Zoe' }, { name: 'Alice' }]);
    if (url.startsWith('/api/members') && url.includes('s2')) return jsonRes([{ name: 'Alice' }, { name: 'Mae' }]);
    return jsonRes([]);
  };
  const { stations, members } = await loadRoster({ fetchImpl, token: 'jwt' });
  assert.deepEqual(stations.map((s) => s.name), ['A', 'B']);
  assert.deepEqual(members, ['Alice', 'Mae', 'Zoe']); // de-duped + sorted
});

test('loadRoster short-circuits to empty when there are no stations', async () => {
  let memberCalls = 0;
  const fetchImpl = async (url) => {
    if (url === '/api/stations') return jsonRes({ stations: [] });
    memberCalls += 1; return jsonRes([]);
  };
  const out = await loadRoster({ fetchImpl, token: 'jwt' });
  assert.deepEqual(out, { stations: [], members: [] });
  assert.equal(memberCalls, 0);
});
