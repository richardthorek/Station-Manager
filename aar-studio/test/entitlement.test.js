import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchEntitlements, decideAccess, checkAccess } from '../js/lib/entitlement.js';

// Minimal fetch stub: resolves to { ok, json }. status defaults sensibly.
const okJson = (body) => async () => ({ ok: true, json: async () => body });
const failStatus = () => async () => ({ ok: false, json: async () => ({}) });
const throwsFetch = () => async () => {
  throw new Error('network down');
};

// --- decideAccess (pure) -----------------------------------------------------

test('decideAccess allows a signed-out visitor (local-first)', () => {
  const d = decideAccess({ token: null, entitlementResponse: null });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, 'signed-out');
});

test('decideAccess fails open when the probe returned nothing', () => {
  const d = decideAccess({ token: 'jwt', entitlementResponse: null });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, 'no-probe');
});

test('decideAccess allows when there is no org context (entitlements null)', () => {
  const d = decideAccess({ token: 'jwt', entitlementResponse: { entitlements: null, planCode: null } });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, 'no-org');
});

test('decideAccess blocks a signed-in org without aarStudioEnabled', () => {
  const d = decideAccess({
    token: 'jwt',
    entitlementResponse: { entitlements: { aarStudioEnabled: false }, planCode: 'community' },
  });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, 'not-entitled');
  assert.equal(d.planCode, 'community');
});

test('decideAccess allows an entitled org', () => {
  const d = decideAccess({
    token: 'jwt',
    entitlementResponse: { entitlements: { aarStudioEnabled: true }, planCode: 'ai' },
  });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, 'entitled');
});

test('decideAccess allows when the flag is absent (back-compat, not an explicit false)', () => {
  const d = decideAccess({
    token: 'jwt',
    entitlementResponse: { entitlements: { signInEnabled: true }, planCode: 'basic' },
  });
  assert.equal(d.allowed, true);
});

// --- fetchEntitlements -------------------------------------------------------

test('fetchEntitlements returns null when signed out (no token)', async () => {
  const body = await fetchEntitlements({ fetchImpl: okJson({ entitlements: {} }), token: null });
  assert.equal(body, null);
});

test('fetchEntitlements returns the parsed body on 200', async () => {
  const payload = { entitlements: { aarStudioEnabled: true }, planCode: 'ai' };
  const body = await fetchEntitlements({ fetchImpl: okJson(payload), token: 'jwt' });
  assert.deepEqual(body, payload);
});

test('fetchEntitlements returns null on a non-OK response', async () => {
  const body = await fetchEntitlements({ fetchImpl: failStatus(), token: 'jwt' });
  assert.equal(body, null);
});

test('fetchEntitlements returns null on a network error', async () => {
  const body = await fetchEntitlements({ fetchImpl: throwsFetch(), token: 'jwt' });
  assert.equal(body, null);
});

// --- checkAccess (probe + decide) -------------------------------------------

test('checkAccess blocks an unentitled signed-in org end to end', async () => {
  const fetchImpl = okJson({ entitlements: { aarStudioEnabled: false }, planCode: 'community' });
  const d = await checkAccess({ fetchImpl, token: 'jwt' });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, 'not-entitled');
});

test('checkAccess allows a signed-out visitor without probing', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: true, json: async () => ({}) };
  };
  const d = await checkAccess({ fetchImpl, token: null });
  assert.equal(d.allowed, true);
  assert.equal(called, false);
});

test('checkAccess fails open when the probe errors', async () => {
  const d = await checkAccess({ fetchImpl: throwsFetch(), token: 'jwt' });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, 'no-probe');
});
