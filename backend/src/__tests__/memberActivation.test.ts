/**
 * Member invite & activation tests (C4).
 *
 * Covers:
 *  - POST /api/members/:id/invite (admin-only) — token generation
 *  - GET  /api/members/activate/:token (public) — token validation
 *  - POST /api/members/activate/:token (public) — account creation
 */

import request from 'supertest';
import express, { Express } from 'express';
import membersRouter from '../routes/members';
import memberActivationRouter from '../routes/memberActivation';
import { ensureDatabase } from '../services/dbFactory';
import { authHeader } from './helpers/authHelpers';

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  // Public activation routes are mounted before the authenticated members router,
  // mirroring index.ts.
  app.use('/api/members', memberActivationRouter);
  app.use('/api/members', membersRouter);
});

async function firstMemberId(): Promise<string> {
  const res = await request(app).get('/api/members');
  return res.body[0].id;
}

describe('POST /api/members/:id/invite', () => {
  it('rejects an unauthenticated request', async () => {
    const id = await firstMemberId();
    await request(app).post(`/api/members/${id}/invite`).expect(401);
  });

  it('rejects a non-admin (viewer) token', async () => {
    const id = await firstMemberId();
    await request(app)
      .post(`/api/members/${id}/invite`)
      .set(authHeader('viewer'))
      .expect(403);
  });

  it('returns 404 for a non-existent member', async () => {
    await request(app)
      .post('/api/members/does-not-exist/invite')
      .set(authHeader('admin'))
      .expect(404);
  });

  it('generates an invite URL + token for an admin', async () => {
    const id = await firstMemberId();
    const res = await request(app)
      .post(`/api/members/${id}/invite`)
      .set(authHeader('admin'))
      .send({ email: 'recruit@example.com' })
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.inviteUrl).toContain(`/activate/${res.body.token}`);

    // The member is now flagged invited with the token persisted.
    const db = await ensureDatabase();
    const member = await db.getMemberByInviteToken(res.body.token);
    expect(member?.id).toBe(id);
    expect(member?.authStatus).toBe('invited');
    expect(member?.inviteEmail).toBe('recruit@example.com');
  });
});

describe('GET /api/members/activate/:token', () => {
  it('returns 404 for an unknown token', async () => {
    await request(app).get('/api/members/activate/no-such-token').expect(404);
  });

  it('returns the member name for a valid invite token', async () => {
    const id = await firstMemberId();
    const invite = await request(app)
      .post(`/api/members/${id}/invite`)
      .set(authHeader('admin'))
      .expect(200);

    const res = await request(app)
      .get(`/api/members/activate/${invite.body.token}`)
      .expect(200);

    expect(res.body).toHaveProperty('memberName');
    expect(typeof res.body.memberName).toBe('string');
  });

  it('returns 409 once the member is already active', async () => {
    const db = await ensureDatabase();
    const member = await db.createMember('Already Active', {});
    await db.updateMemberAuth(member.id, { authStatus: 'active', inviteToken: 'used-token-1' });

    await request(app).get('/api/members/activate/used-token-1').expect(409);
  });
});

describe('POST /api/members/activate/:token', () => {
  async function freshInviteToken(): Promise<string> {
    const id = await firstMemberId();
    const res = await request(app)
      .post(`/api/members/${id}/invite`)
      .set(authHeader('admin'))
      .expect(200);
    return res.body.token;
  }

  it('rejects a short username', async () => {
    const token = await freshInviteToken();
    await request(app)
      .post(`/api/members/activate/${token}`)
      .send({ username: 'ab', password: 'longenough1' })
      .expect(400);
  });

  it('rejects a short password', async () => {
    const token = await freshInviteToken();
    await request(app)
      .post(`/api/members/activate/${token}`)
      .send({ username: 'validuser', password: 'short' })
      .expect(400);
  });

  it('returns 404 for an unknown token', async () => {
    await request(app)
      .post('/api/members/activate/nope')
      .send({ username: 'validuser2', password: 'longenough1' })
      .expect(404);
  });

  it('creates an account and marks the member active, clearing the token', async () => {
    const db = await ensureDatabase();
    const member = await db.createMember('Recruit One', {});
    await db.updateMemberAuth(member.id, { authStatus: 'invited', inviteToken: 'activ-token-1' });

    const res = await request(app)
      .post('/api/members/activate/activ-token-1')
      .send({ username: 'recruit-one', password: 'longenough1' })
      .expect(200);

    expect(res.body.success).toBe(true);

    const updated = await db.getMemberById(member.id);
    expect(updated?.authStatus).toBe('active');
    expect(updated?.inviteToken).toBeFalsy();

    // Token is now consumed.
    await request(app).get('/api/members/activate/activ-token-1').expect(404);
  });

  it('returns 409 when the chosen username is already taken', async () => {
    const db = await ensureDatabase();
    const member = await db.createMember('Recruit Two', {});
    await db.updateMemberAuth(member.id, { authStatus: 'invited', inviteToken: 'activ-token-2' });

    await request(app)
      .post('/api/members/activate/activ-token-2')
      .send({ username: 'recruit-one', password: 'longenough1' })
      .expect(409);
  });
});
