import { getOrgAccessDatabase } from '../services/orgAccessDatabase';

describe('OrgAccessDatabase', () => {
  let db: ReturnType<typeof getOrgAccessDatabase>;

  beforeEach(async () => {
    db = getOrgAccessDatabase();
    await db.clear();
  });

  describe('memberships', () => {
    it('creates and reads a membership', async () => {
      const membership = await db.createMembership({ userId: 'u1', organizationId: 'org1', role: 'owner' });
      expect(membership.status).toBe('active');
      const found = await db.getMembership('u1', 'org1');
      expect(found?.id).toBe(membership.id);
    });

    it('rejects creating a duplicate active membership', async () => {
      await db.createMembership({ userId: 'u1', organizationId: 'org1', role: 'owner' });
      await expect(db.createMembership({ userId: 'u1', organizationId: 'org1', role: 'admin' })).rejects.toThrow(
        'Membership already exists',
      );
    });

    it('revives a removed membership instead of duplicating it', async () => {
      const first = await db.createMembership({ userId: 'u1', organizationId: 'org1', role: 'viewer' });
      await db.updateMembership(first.id, { status: 'removed' });
      const revived = await db.createMembership({ userId: 'u1', organizationId: 'org1', role: 'admin' });
      expect(revived.id).toBe(first.id);
      expect(revived.role).toBe('admin');
      expect(revived.status).toBe('active');
    });

    it('lists memberships by user and by organization', async () => {
      await db.createMembership({ userId: 'u1', organizationId: 'org1', role: 'owner' });
      await db.createMembership({ userId: 'u1', organizationId: 'org2', role: 'viewer' });
      await db.createMembership({ userId: 'u2', organizationId: 'org1', role: 'admin' });

      expect((await db.getMembershipsByUser('u1')).length).toBe(2);
      expect((await db.getMembershipsByOrganization('org1')).length).toBe(2);
    });
  });

  describe('invites', () => {
    it('creates an invite with a unique token and default fields', async () => {
      const invite = await db.createInvite({
        organizationId: 'org1',
        role: 'viewer',
        createdBy: 'u1',
        expiresAt: new Date(Date.now() + 1000),
      });
      expect(invite.token).toBeTruthy();
      expect(invite.status).toBe('active');
      expect(invite.usageCount).toBe(0);
      expect(await db.getInviteByToken(invite.token)).toEqual(invite);
    });

    it('updates status and usage count', async () => {
      const invite = await db.createInvite({
        organizationId: 'org1',
        role: 'viewer',
        createdBy: 'u1',
        expiresAt: new Date(Date.now() + 1000),
      });
      const updated = await db.updateInvite(invite.id, { usageCount: 1 });
      expect(updated?.usageCount).toBe(1);
      const revoked = await db.updateInvite(invite.id, { status: 'revoked' });
      expect(revoked?.status).toBe('revoked');
    });
  });

  describe('claim conflicts', () => {
    it('creates a conflict in open status and filters by status', async () => {
      await db.createClaimConflict({
        facilityKey: 'rural-fire:1',
        facilityName: 'Test Brigade',
        existingOrganizationId: 'org1',
        attemptedOrgName: 'Other Brigade',
        attemptedByUsername: 'other',
        attemptedByEmail: 'other@example.com',
      });
      expect((await db.getClaimConflicts('open')).length).toBe(1);
      expect((await db.getClaimConflicts('resolved')).length).toBe(0);
    });

    it('resolves a conflict', async () => {
      const conflict = await db.createClaimConflict({
        facilityKey: 'rural-fire:1',
        facilityName: 'Test Brigade',
        existingOrganizationId: 'org1',
        attemptedOrgName: 'Other Brigade',
        attemptedByUsername: 'other',
        attemptedByEmail: 'other@example.com',
      });
      const resolved = await db.updateClaimConflict(conflict.id, {
        status: 'resolved',
        resolution: 'dismissed',
        resolvedBy: 'platform-admin',
        resolvedAt: new Date(),
      });
      expect(resolved?.status).toBe('resolved');
      expect(resolved?.resolution).toBe('dismissed');
    });
  });
});
