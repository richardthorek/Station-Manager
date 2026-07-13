import request from 'supertest';
import express, { Express } from 'express';
import authRouter from '../routes/auth';
import organizationsRouter from '../routes/organizations';
import orgInvitesRouter from '../routes/orgInvites';
import { ensureAdminUserDatabase, initializeAdminUserDatabase, getAdminDb } from '../services/adminUserDbFactory';
import { ensureOrganizationDatabase, initializeOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureOrgAccessDatabase, initializeOrgAccessDatabase } from '../services/orgAccessDbFactory';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/organizations', organizationsRouter);
  app.use('/api/org-invites', orgInvitesRouter);
  return app;
}

describe('Org invites & membership management', () => {
  let app: Express;

  beforeAll(async () => {
    await initializeOrganizationDatabase();
    await initializeOrgAccessDatabase();
    ensureAdminUserDatabase();
    await initializeAdminUserDatabase();
  });

  beforeEach(async () => {
    await (ensureOrganizationDatabase() as unknown as { clear: () => Promise<void> }).clear();
    await (ensureOrgAccessDatabase() as unknown as { clear: () => Promise<void> }).clear();
    await (getAdminDb() as unknown as { clear: () => Promise<void> }).clear();
    app = buildApp();
  });

  async function signup(overrides: Record<string, unknown> = {}) {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        organizationName: 'Bungendore RFS',
        billingEmail: 'captain@example.com',
        username: 'captain',
        password: 'supersecret1',
        email: 'captain@example.com',
        ...overrides,
      });
    return res.body as { token: string; user: { id: string }; organization: { id: string } };
  }

  describe('invite lifecycle', () => {
    it('owner creates an invite link', async () => {
      const { token } = await signup();
      const res = await request(app)
        .post('/api/organizations/current/invites')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'viewer' });
      expect(res.status).toBe(201);
      expect(res.body.invite.role).toBe('viewer');
      expect(res.body.inviteUrl).toContain(`/invite/${res.body.invite.token}`);
    });

    it('an admin cannot mint an owner invite', async () => {
      const { token: ownerToken, organization } = await signup();
      // Create an admin user directly in the org.
      await request(app)
        .post('/api/organizations/current/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ username: 'admin1', password: 'supersecret1', role: 'admin', email: 'admin1@example.com' });
      const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin1', password: 'supersecret1' });
      const adminToken = loginRes.body.token as string;

      const res = await request(app)
        .post('/api/organizations/current/invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'owner' });
      expect(res.status).toBe(403);
      expect(organization.id).toBeTruthy(); // sanity: org exists
    });

    it('lists and revokes invites', async () => {
      const { token } = await signup();
      const create = await request(app)
        .post('/api/organizations/current/invites')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'viewer' });

      const list = await request(app)
        .get('/api/organizations/current/invites')
        .set('Authorization', `Bearer ${token}`);
      expect(list.body.invites).toHaveLength(1);

      const revoke = await request(app)
        .delete(`/api/organizations/current/invites/${create.body.invite.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(revoke.status).toBe(200);
      expect(revoke.body.invite.status).toBe('revoked');
    });

    it('rejects an out-of-range expiresInDays', async () => {
      const { token } = await signup();
      const res = await request(app)
        .post('/api/organizations/current/invites')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'viewer', expiresInDays: 999 });
      expect(res.status).toBe(400);
    });
  });

  describe('public invite acceptance', () => {
    it('GET returns a 404 for an unknown token', async () => {
      const res = await request(app).get('/api/org-invites/does-not-exist');
      expect(res.status).toBe(404);
    });

    it('GET returns a 410 for a revoked invite', async () => {
      const { token } = await signup();
      const create = await request(app)
        .post('/api/organizations/current/invites')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'viewer' });
      await request(app)
        .delete(`/api/organizations/current/invites/${create.body.invite.id}`)
        .set('Authorization', `Bearer ${token}`);
      const res = await request(app).get(`/api/org-invites/${create.body.invite.token}`);
      expect(res.status).toBe(410);
    });

    it('new user can sign up directly via an invite link (multi-use, tracks usage)', async () => {
      const { token, organization } = await signup();
      const create = await request(app)
        .post('/api/organizations/current/invites')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'viewer' });
      const inviteToken = create.body.invite.token as string;

      const signupRes = await request(app)
        .post(`/api/org-invites/${inviteToken}/signup`)
        .send({ username: 'recruit', password: 'longenough1', email: 'recruit@example.com' });
      expect(signupRes.status).toBe(201);
      expect(signupRes.body.organization.id).toBe(organization.id);
      expect(signupRes.body.user.role).toBe('viewer');

      // Multi-use: a second person can use the same link.
      const signupRes2 = await request(app)
        .post(`/api/org-invites/${inviteToken}/signup`)
        .send({ username: 'recruit2', password: 'longenough1', email: 'recruit2@example.com' });
      expect(signupRes2.status).toBe(201);

      const invites = await ensureOrgAccessDatabase().getInvitesByOrganization(organization.id);
      expect(invites[0].usageCount).toBe(2);
    });

    it('existing user can accept an invite and gain a second org membership', async () => {
      const owner1 = await signup();
      const owner2 = await signup({
        organizationName: 'Second Brigade',
        billingEmail: 'owner2@example.com',
        username: 'owner2',
        email: 'owner2@example.com',
      });

      const create = await request(app)
        .post('/api/organizations/current/invites')
        .set('Authorization', `Bearer ${owner1.token}`)
        .send({ role: 'admin' });

      const accept = await request(app)
        .post(`/api/org-invites/${create.body.invite.token}/accept`)
        .set('Authorization', `Bearer ${owner2.token}`);
      expect(accept.status).toBe(200);
      expect(accept.body.memberships.length).toBeGreaterThanOrEqual(2);
    });

    it('rejects accepting when already an active member', async () => {
      const owner1 = await signup();
      const create = await request(app)
        .post('/api/organizations/current/invites')
        .set('Authorization', `Bearer ${owner1.token}`)
        .send({ role: 'admin' });
      const res = await request(app)
        .post(`/api/org-invites/${create.body.invite.token}/accept`)
        .set('Authorization', `Bearer ${owner1.token}`);
      expect(res.status).toBe(409);
    });
  });

  describe('multi-org switching', () => {
    it('switch-org reissues a token scoped to the target org with the right role', async () => {
      const owner1 = await signup();
      const owner2 = await signup({
        organizationName: 'Second Brigade',
        billingEmail: 'owner2@example.com',
        username: 'owner2',
        email: 'owner2@example.com',
      });
      const create = await request(app)
        .post('/api/organizations/current/invites')
        .set('Authorization', `Bearer ${owner1.token}`)
        .send({ role: 'viewer' });
      await request(app)
        .post(`/api/org-invites/${create.body.invite.token}/accept`)
        .set('Authorization', `Bearer ${owner2.token}`);

      const switchRes = await request(app)
        .post('/api/auth/switch-org')
        .set('Authorization', `Bearer ${owner2.token}`)
        .send({ organizationId: owner1.organization.id });
      expect(switchRes.status).toBe(200);
      expect(switchRes.body.user.organizationId).toBe(owner1.organization.id);
      expect(switchRes.body.user.role).toBe('viewer');
    });

    it('switch-org rejects a non-member organization', async () => {
      const owner1 = await signup();
      const owner2 = await signup({
        organizationName: 'Second Brigade',
        billingEmail: 'owner2@example.com',
        username: 'owner2',
        email: 'owner2@example.com',
      });
      const res = await request(app)
        .post('/api/auth/switch-org')
        .set('Authorization', `Bearer ${owner2.token}`)
        .send({ organizationId: owner1.organization.id });
      expect(res.status).toBe(403);
    });
  });

  describe('member role changes and removal', () => {
    async function inviteAndAcceptAsAdmin(ownerToken: string) {
      const create = await request(app)
        .post('/api/organizations/current/invites')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'admin' });
      const signupRes = await request(app)
        .post(`/api/org-invites/${create.body.invite.token}/signup`)
        .send({ username: 'helper', password: 'longenough1', email: 'helper@example.com' });
      return signupRes.body as { token: string; user: { id: string } };
    }

    it('lists members including the founder', async () => {
      const owner = await signup();
      const res = await request(app)
        .get('/api/organizations/current/members')
        .set('Authorization', `Bearer ${owner.token}`);
      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].role).toBe('owner');
    });

    it('owner changes a member role', async () => {
      const owner = await signup();
      const helper = await inviteAndAcceptAsAdmin(owner.token);
      const res = await request(app)
        .put(`/api/organizations/current/members/${helper.user.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ role: 'viewer' });
      expect(res.status).toBe(200);
      expect(res.body.membership.role).toBe('viewer');
    });

    it('blocks demoting the last owner', async () => {
      const owner = await signup();
      const res = await request(app)
        .put(`/api/organizations/current/members/${owner.user.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ role: 'admin' });
      expect(res.status).toBe(403);
    });

    it('blocks removing the last owner', async () => {
      const owner = await signup();
      const res = await request(app)
        .delete(`/api/organizations/current/members/${owner.user.id}`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(res.status).toBe(403);
    });

    it('removes a non-owner member', async () => {
      const owner = await signup();
      const helper = await inviteAndAcceptAsAdmin(owner.token);
      const res = await request(app)
        .delete(`/api/organizations/current/members/${helper.user.id}`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(res.status).toBe(200);

      const list = await request(app)
        .get('/api/organizations/current/members')
        .set('Authorization', `Bearer ${owner.token}`);
      expect(list.body.members).toHaveLength(1);
    });
  });
});
