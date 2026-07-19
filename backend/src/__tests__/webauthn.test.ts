/**
 * WebAuthn (passkey) Routes Tests
 *
 * Registration is authenticated only (account settings); sign-in is public
 * and usable from any suite app. `@simplewebauthn/server`'s verify/generate
 * functions are mocked — cryptographic attestation/assertion verification is
 * that library's own well-tested concern; these tests exercise the route
 * logic around it (challenge lifecycle, credential storage/scoping, auth
 * gating, response shape).
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import webauthnRouter from '../routes/webauthn';
import { getAdminUserDatabase } from '../services/adminUserDatabase';
import { getOrganizationDatabase } from '../services/organizationDatabase';
import { _clearWebAuthnChallenges } from '../services/webAuthnChallengeStore';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const mockGenerateRegistrationOptions = jest.fn();
const mockVerifyRegistrationResponse = jest.fn();
const mockGenerateAuthenticationOptions = jest.fn();
const mockVerifyAuthenticationResponse = jest.fn();

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: (...args: unknown[]) => mockGenerateRegistrationOptions(...args),
  verifyRegistrationResponse: (...args: unknown[]) => mockVerifyRegistrationResponse(...args),
  generateAuthenticationOptions: (...args: unknown[]) => mockGenerateAuthenticationOptions(...args),
  verifyAuthenticationResponse: (...args: unknown[]) => mockVerifyAuthenticationResponse(...args),
}));

jest.mock('../services/adminUserDbFactory', () => {
  const { getAdminUserDatabase } = require('../services/adminUserDatabase');
  return {
    getAdminDb: () => getAdminUserDatabase(),
  };
});

jest.mock('../services/organizationDbFactory', () => {
  const { getOrganizationDatabase } = require('../services/organizationDatabase');
  return {
    ensureOrganizationDatabase: () => getOrganizationDatabase(),
  };
});

function authHeaderFor(userId: string, username: string): string {
  return `Bearer ${jwt.sign({ userId, username, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })}`;
}

describe('WebAuthn (passkey) Routes', () => {
  let app: express.Application;
  let adminDb: ReturnType<typeof getAdminUserDatabase>;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/auth/passkey', webauthnRouter);

    adminDb = getAdminUserDatabase();
    await adminDb.clear();
    _clearWebAuthnChallenges();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await adminDb.clear();
    _clearWebAuthnChallenges();
  });

  describe('POST /register/options', () => {
    it('requires authentication', async () => {
      await request(app).post('/api/auth/passkey/register/options').expect(401);
    });

    it('returns registration options for the authenticated user', async () => {
      const user = await adminDb.createAdminUser('alice', 'password123', 'admin');
      mockGenerateRegistrationOptions.mockResolvedValue({ challenge: 'abc123', rp: {}, user: {} });

      const res = await request(app)
        .post('/api/auth/passkey/register/options')
        .set('Authorization', authHeaderFor(user.id, user.username))
        .expect(200);

      expect(res.body.challenge).toBe('abc123');
      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({ userName: 'alice' }),
      );
    });
  });

  describe('POST /register/verify', () => {
    it('requires authentication', async () => {
      await request(app).post('/api/auth/passkey/register/verify').send({ response: {} }).expect(401);
    });

    it('400s when there is no registration challenge in flight', async () => {
      const user = await adminDb.createAdminUser('bob', 'password123', 'admin');
      await request(app)
        .post('/api/auth/passkey/register/verify')
        .set('Authorization', authHeaderFor(user.id, user.username))
        .send({ response: {} })
        .expect(400);
    });

    it('stores the credential and returns 201 on a verified registration', async () => {
      const user = await adminDb.createAdminUser('carol', 'password123', 'admin');
      mockGenerateRegistrationOptions.mockResolvedValue({ challenge: 'the-challenge' });

      await request(app)
        .post('/api/auth/passkey/register/options')
        .set('Authorization', authHeaderFor(user.id, user.username))
        .expect(200);

      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: { id: 'cred-1', publicKey: new Uint8Array([1, 2, 3]), counter: 0 },
          credentialDeviceType: 'multiDevice',
          credentialBackedUp: true,
        },
      });

      const res = await request(app)
        .post('/api/auth/passkey/register/verify')
        .set('Authorization', authHeaderFor(user.id, user.username))
        .send({ response: { id: 'cred-1' }, name: 'My Laptop' })
        .expect(201);

      expect(res.body.verified).toBe(true);

      const stored = await adminDb.getWebAuthnCredentialsByUser(user.id);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ id: 'cred-1', userId: user.id, name: 'My Laptop', counter: 0 });
    });

    it('400s when verification fails', async () => {
      const user = await adminDb.createAdminUser('dave', 'password123', 'admin');
      mockGenerateRegistrationOptions.mockResolvedValue({ challenge: 'the-challenge' });
      await request(app)
        .post('/api/auth/passkey/register/options')
        .set('Authorization', authHeaderFor(user.id, user.username))
        .expect(200);

      mockVerifyRegistrationResponse.mockResolvedValue({ verified: false });

      await request(app)
        .post('/api/auth/passkey/register/verify')
        .set('Authorization', authHeaderFor(user.id, user.username))
        .send({ response: { id: 'cred-2' } })
        .expect(400);

      expect(await adminDb.getWebAuthnCredentialsByUser(user.id)).toHaveLength(0);
    });
  });

  describe('POST /login/options', () => {
    it('requires no authentication and returns a flowId', async () => {
      mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'login-challenge' });

      const res = await request(app).post('/api/auth/passkey/login/options').expect(200);

      expect(res.body.flowId).toBeDefined();
      expect(res.body.options.challenge).toBe('login-challenge');
      // Discoverable/usernameless flow — no allowCredentials narrowing.
      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
        expect.not.objectContaining({ allowCredentials: expect.anything() }),
      );
    });
  });

  describe('POST /login/verify', () => {
    it('400s when flowId or response is missing', async () => {
      await request(app).post('/api/auth/passkey/login/verify').send({}).expect(400);
    });

    it('400s when the sign-in session has expired (unknown flowId)', async () => {
      await request(app)
        .post('/api/auth/passkey/login/verify')
        .send({ flowId: 'nope', response: { id: 'cred-1' } })
        .expect(400);
    });

    it('401s when the credential id is not recognised', async () => {
      mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'c' });
      const { body } = await request(app).post('/api/auth/passkey/login/options').expect(200);

      await request(app)
        .post('/api/auth/passkey/login/verify')
        .send({ flowId: body.flowId, response: { id: 'unknown-cred' } })
        .expect(401);
    });

    it('401s when verification does not pass', async () => {
      const user = await adminDb.createAdminUser('erin', 'password123', 'admin');
      await adminDb.saveWebAuthnCredential({
        id: 'cred-erin',
        userId: user.id,
        publicKey: Buffer.from([1, 2, 3]).toString('base64url'),
        counter: 0,
        deviceType: 'singleDevice',
        backedUp: false,
        name: 'Passkey',
        createdAt: new Date(),
      });

      mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'c' });
      const { body } = await request(app).post('/api/auth/passkey/login/options').expect(200);

      mockVerifyAuthenticationResponse.mockResolvedValue({ verified: false });

      await request(app)
        .post('/api/auth/passkey/login/verify')
        .send({ flowId: body.flowId, response: { id: 'cred-erin' } })
        .expect(401);
    });

    it('signs the user in, bumps the counter, and sets the session cookie on success', async () => {
      const user = await adminDb.createAdminUser('frank', 'password123', 'admin');
      await adminDb.saveWebAuthnCredential({
        id: 'cred-frank',
        userId: user.id,
        publicKey: Buffer.from([1, 2, 3]).toString('base64url'),
        counter: 4,
        deviceType: 'singleDevice',
        backedUp: false,
        name: 'Passkey',
        createdAt: new Date(),
      });

      mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'c' });
      const { body: optionsBody } = await request(app).post('/api/auth/passkey/login/options').expect(200);

      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 5 },
      });

      const res = await request(app)
        .post('/api/auth/passkey/login/verify')
        .send({ flowId: optionsBody.flowId, response: { id: 'cred-frank' } })
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('frank');
      expect(res.headers['set-cookie']?.[0]).toMatch(/^sk_session=/);

      const [updated] = await adminDb.getWebAuthnCredentialsByUser(user.id);
      expect(updated.counter).toBe(5);
      expect(updated.lastUsedAt).toBeDefined();
    });

    it('replaying the same flowId a second time fails (single-use challenge)', async () => {
      const user = await adminDb.createAdminUser('gina', 'password123', 'admin');
      await adminDb.saveWebAuthnCredential({
        id: 'cred-gina',
        userId: user.id,
        publicKey: Buffer.from([1, 2, 3]).toString('base64url'),
        counter: 0,
        deviceType: 'singleDevice',
        backedUp: false,
        name: 'Passkey',
        createdAt: new Date(),
      });

      mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'c' });
      const { body } = await request(app).post('/api/auth/passkey/login/options').expect(200);

      mockVerifyAuthenticationResponse.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 1 } });

      await request(app)
        .post('/api/auth/passkey/login/verify')
        .send({ flowId: body.flowId, response: { id: 'cred-gina' } })
        .expect(200);

      await request(app)
        .post('/api/auth/passkey/login/verify')
        .send({ flowId: body.flowId, response: { id: 'cred-gina' } })
        .expect(400);
    });
  });

  describe('GET /credentials', () => {
    it('requires authentication', async () => {
      await request(app).get('/api/auth/passkey/credentials').expect(401);
    });

    it('only lists the caller\'s own credentials, and never exposes the public key', async () => {
      const alice = await adminDb.createAdminUser('alice2', 'password123', 'admin');
      const bob = await adminDb.createAdminUser('bob2', 'password123', 'admin');
      await adminDb.saveWebAuthnCredential({
        id: 'cred-alice', userId: alice.id, publicKey: 'secret-key', counter: 0,
        deviceType: 'multiDevice', backedUp: true, name: 'Alice Passkey', createdAt: new Date(),
      });
      await adminDb.saveWebAuthnCredential({
        id: 'cred-bob', userId: bob.id, publicKey: 'secret-key-2', counter: 0,
        deviceType: 'multiDevice', backedUp: true, name: 'Bob Passkey', createdAt: new Date(),
      });

      const res = await request(app)
        .get('/api/auth/passkey/credentials')
        .set('Authorization', authHeaderFor(alice.id, alice.username))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Alice Passkey');
      expect(res.body[0].publicKey).toBeUndefined();
    });
  });

  describe('DELETE /credentials/:id', () => {
    it('requires authentication', async () => {
      await request(app).delete('/api/auth/passkey/credentials/cred-1').expect(401);
    });

    it("404s deleting someone else's credential", async () => {
      const alice = await adminDb.createAdminUser('alice3', 'password123', 'admin');
      const bob = await adminDb.createAdminUser('bob3', 'password123', 'admin');
      await adminDb.saveWebAuthnCredential({
        id: 'cred-bob3', userId: bob.id, publicKey: 'k', counter: 0,
        deviceType: 'singleDevice', backedUp: false, name: 'Bob Passkey', createdAt: new Date(),
      });

      await request(app)
        .delete('/api/auth/passkey/credentials/cred-bob3')
        .set('Authorization', authHeaderFor(alice.id, alice.username))
        .expect(404);

      expect(await adminDb.getWebAuthnCredentialsByUser(bob.id)).toHaveLength(1);
    });

    it('deletes the caller\'s own credential', async () => {
      const alice = await adminDb.createAdminUser('alice4', 'password123', 'admin');
      await adminDb.saveWebAuthnCredential({
        id: 'cred-alice4', userId: alice.id, publicKey: 'k', counter: 0,
        deviceType: 'singleDevice', backedUp: false, name: 'Alice Passkey', createdAt: new Date(),
      });

      await request(app)
        .delete('/api/auth/passkey/credentials/cred-alice4')
        .set('Authorization', authHeaderFor(alice.id, alice.username))
        .expect(204);

      expect(await adminDb.getWebAuthnCredentialsByUser(alice.id)).toHaveLength(0);
    });
  });
});
