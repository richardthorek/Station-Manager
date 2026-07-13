import {
  canChangeRole,
  canInviteRole,
  canRemoveMember,
  isOrgRole,
  violatesLastOwner,
} from '../services/orgMembershipRules';
import type { OrganizationMembership } from '../types';

function membership(overrides: Partial<OrganizationMembership> = {}): OrganizationMembership {
  return {
    id: 'm1',
    userId: 'u1',
    organizationId: 'org1',
    role: 'owner',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('isOrgRole', () => {
  it('accepts owner/admin/viewer and rejects anything else', () => {
    expect(isOrgRole('owner')).toBe(true);
    expect(isOrgRole('admin')).toBe(true);
    expect(isOrgRole('viewer')).toBe(true);
    expect(isOrgRole('superadmin')).toBe(false);
    expect(isOrgRole(undefined)).toBe(false);
  });
});

describe('canInviteRole', () => {
  it.each([
    ['owner', 'owner', true],
    ['owner', 'admin', true],
    ['owner', 'viewer', true],
    ['admin', 'admin', true],
    ['admin', 'viewer', true],
    ['admin', 'owner', false],
    ['viewer', 'viewer', false],
    ['viewer', 'admin', false],
  ] as const)('inviter=%s invitee=%s => %s', (inviter, invitee, expected) => {
    expect(canInviteRole(inviter, invitee)).toBe(expected);
  });
});

describe('canChangeRole', () => {
  it('only an owner may grant the owner role', () => {
    expect(canChangeRole('owner', 'viewer', 'owner')).toBe(true);
    expect(canChangeRole('admin', 'viewer', 'owner')).toBe(false);
  });

  it('only an owner may change an existing owner', () => {
    expect(canChangeRole('owner', 'owner', 'admin')).toBe(true);
    expect(canChangeRole('admin', 'owner', 'admin')).toBe(false);
  });

  it('admin may move a viewer to admin and back', () => {
    expect(canChangeRole('admin', 'viewer', 'admin')).toBe(true);
    expect(canChangeRole('admin', 'admin', 'viewer')).toBe(true);
  });

  it('viewer can never change roles', () => {
    expect(canChangeRole('viewer', 'viewer', 'admin')).toBe(false);
  });
});

describe('canRemoveMember', () => {
  it('anyone may remove themself', () => {
    expect(canRemoveMember('viewer', 'viewer', true)).toBe(true);
  });

  it('owner may remove anyone', () => {
    expect(canRemoveMember('owner', 'owner', false)).toBe(true);
    expect(canRemoveMember('owner', 'admin', false)).toBe(true);
  });

  it('admin may remove non-owners but not an owner', () => {
    expect(canRemoveMember('admin', 'viewer', false)).toBe(true);
    expect(canRemoveMember('admin', 'owner', false)).toBe(false);
  });

  it('viewer may not remove anyone else', () => {
    expect(canRemoveMember('viewer', 'viewer', false)).toBe(false);
  });
});

describe('violatesLastOwner', () => {
  it('blocks demoting the sole owner', () => {
    const memberships = [membership({ userId: 'u1', role: 'owner' })];
    expect(violatesLastOwner(memberships, { userId: 'u1', newRole: 'admin' })).toBe(true);
  });

  it('blocks removing the sole owner', () => {
    const memberships = [membership({ userId: 'u1', role: 'owner' })];
    expect(violatesLastOwner(memberships, { userId: 'u1', remove: true })).toBe(true);
  });

  it('allows demoting an owner when another active owner remains', () => {
    const memberships = [
      membership({ id: 'm1', userId: 'u1', role: 'owner' }),
      membership({ id: 'm2', userId: 'u2', role: 'owner' }),
    ];
    expect(violatesLastOwner(memberships, { userId: 'u1', newRole: 'admin' })).toBe(false);
  });

  it('ignores removed memberships when counting owners', () => {
    const memberships = [
      membership({ id: 'm1', userId: 'u1', role: 'owner' }),
      membership({ id: 'm2', userId: 'u2', role: 'owner', status: 'removed' }),
    ];
    expect(violatesLastOwner(memberships, { userId: 'u1', remove: true })).toBe(true);
  });

  it('is a no-op when the change does not touch an active owner', () => {
    const memberships = [
      membership({ id: 'm1', userId: 'u1', role: 'owner' }),
      membership({ id: 'm2', userId: 'u2', role: 'viewer' }),
    ];
    expect(violatesLastOwner(memberships, { userId: 'u2', remove: true })).toBe(false);
  });
});
