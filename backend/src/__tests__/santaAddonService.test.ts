/**
 * Unit tests for the Santa Run add-on entitlement resolution
 * (services/santaAddonService.ts).
 */

import { isSantaAddonEntitled, resolveEffectiveEntitlements } from '../services/santaAddonService';
import { getDefaultEntitlements } from '../constants/plans';

describe('isSantaAddonEntitled', () => {
  it('is false with no santaAddon field', () => {
    expect(isSantaAddonEntitled({})).toBe(false);
  });

  it('is false when status is none', () => {
    expect(isSantaAddonEntitled({ santaAddon: { status: 'none' } })).toBe(false);
  });

  it('is false when cancelled', () => {
    expect(isSantaAddonEntitled({ santaAddon: { status: 'canceled' } })).toBe(false);
  });

  it('is true when active', () => {
    expect(isSantaAddonEntitled({ santaAddon: { status: 'active' } })).toBe(true);
  });

  it('is true when trialing', () => {
    expect(isSantaAddonEntitled({ santaAddon: { status: 'trialing' } })).toBe(true);
  });

  it('is true when past_due (grace window)', () => {
    expect(isSantaAddonEntitled({ santaAddon: { status: 'past_due' } })).toBe(true);
  });
});

describe('resolveEffectiveEntitlements', () => {
  it('returns the plan entitlements unchanged when the plan already grants santaRunEnabled', () => {
    const entitlements = getDefaultEntitlements('basic');
    const org = { entitlements, santaAddon: undefined };
    expect(resolveEffectiveEntitlements(org)).toBe(entitlements);
  });

  it('returns the plan entitlements unchanged for a Community org with no add-on', () => {
    const entitlements = getDefaultEntitlements('community');
    const org = { entitlements, santaAddon: undefined };
    const result = resolveEffectiveEntitlements(org);
    expect(result.santaRunEnabled).toBe(false);
  });

  it('ORs santaRunEnabled in for a Community org with an active add-on, without touching other flags', () => {
    const entitlements = getDefaultEntitlements('community');
    const org = { entitlements, santaAddon: { status: 'active' as const } };
    const result = resolveEffectiveEntitlements(org);
    expect(result.santaRunEnabled).toBe(true);
    expect(result.fireBreakEnabled).toBe(false);
    expect(result).not.toBe(entitlements); // a new object, original untouched
    expect(entitlements.santaRunEnabled).toBe(false);
  });

  it('does not grant santaRunEnabled for a Community org with a cancelled add-on', () => {
    const entitlements = getDefaultEntitlements('community');
    const org = { entitlements, santaAddon: { status: 'canceled' as const } };
    expect(resolveEffectiveEntitlements(org).santaRunEnabled).toBe(false);
  });
});
