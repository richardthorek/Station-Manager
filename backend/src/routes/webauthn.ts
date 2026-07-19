/**
 * WebAuthn (passkey) sign-in.
 *
 * Additive to username/password — never replaces it. Registration only
 * happens here, from an authenticated Station Manager session (the suite's
 * account settings own credential management); sign-IN is usable from any
 * suite app's own login screen, since the RP ID is the shared parent domain
 * (see config/webauthn.ts) — a sibling app runs the ceremony itself, then
 * POSTs the assertion here cross-origin to complete sign-in.
 *
 * Endpoints:
 * - POST   /api/auth/passkey/register/options  (auth required)
 * - POST   /api/auth/passkey/register/verify    (auth required)
 * - POST   /api/auth/passkey/login/options      (public)
 * - POST   /api/auth/passkey/login/verify       (public)
 * - GET    /api/auth/passkey/credentials        (auth required)
 * - DELETE /api/auth/passkey/credentials/:id    (auth required)
 */

import { Router, Request, Response } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type { WebAuthnCredential as SimpleWebAuthnCredential } from '@simplewebauthn/server';
import { getAdminDb } from '../services/adminUserDbFactory';
import { authMiddleware } from '../middleware/auth';
import { sensitiveActionRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../services/logger';
import { WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME, expectedOrigins } from '../config/webauthn';
import {
  storeRegistrationChallenge,
  takeRegistrationChallenge,
  storeLoginChallenge,
  takeLoginChallenge,
} from '../services/webAuthnChallengeStore';
import { completeSignIn } from './auth';

const router = Router();

/** Default label for a newly-registered passkey until the user renames it. */
function defaultCredentialName(existingCount: number): string {
  return existingCount === 0 ? 'Passkey' : `Passkey ${existingCount + 1}`;
}

// ---------------------------------------------------------------------------
// Registration — authenticated only. "Add a passkey" in account settings.
// ---------------------------------------------------------------------------

router.post('/register/options', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const adminDb = getAdminDb();
    const user = await adminDb.getUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existingCredentials = await adminDb.getWebAuthnCredentialsByUser(user.id);

    const options = await generateRegistrationOptions({
      rpName: WEBAUTHN_RP_NAME,
      rpID: WEBAUTHN_RP_ID,
      userName: user.username,
      userID: new TextEncoder().encode(user.id),
      userDisplayName: user.username,
      excludeCredentials: existingCredentials.map((c) => ({
        id: c.id,
        transports: c.transports as any,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    storeRegistrationChallenge(user.id, options.challenge);
    res.json(options);
  } catch (error) {
    logger.error('Error generating passkey registration options', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const expectedChallenge = takeRegistrationChallenge(req.user.userId);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Registration session expired — please try again' });
    }

    const { response, name } = req.body ?? {};
    if (!response) return res.status(400).json({ error: 'Missing registration response' });

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigins(),
      expectedRPID: WEBAUTHN_RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey registration could not be verified' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const adminDb = getAdminDb();
    const existingCount = (await adminDb.getWebAuthnCredentialsByUser(req.user.userId)).length;

    await adminDb.saveWebAuthnCredential({
      id: credential.id,
      userId: req.user.userId,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.transports,
      name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 60) : defaultCredentialName(existingCount),
      createdAt: new Date(),
    });

    logger.info('Passkey registered', { userId: req.user.userId, credentialId: credential.id });
    res.status(201).json({ verified: true });
  } catch (error) {
    logger.error('Error verifying passkey registration', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Sign-in — public. Usable from any suite app's own login screen.
// ---------------------------------------------------------------------------

router.post('/login/options', sensitiveActionRateLimiter, async (_req: Request, res: Response) => {
  try {
    // No allowCredentials: a fully "usernameless" / discoverable-credential
    // flow — the browser's own picker shows every passkey it holds for this
    // RP ID, so the caller never has to type a username first.
    const options = await generateAuthenticationOptions({
      rpID: WEBAUTHN_RP_ID,
      userVerification: 'preferred',
    });

    const flowId = storeLoginChallenge(options.challenge);
    res.json({ flowId, options });
  } catch (error) {
    logger.error('Error generating passkey login options', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login/verify', sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  try {
    const { flowId, response } = req.body ?? {};
    if (!flowId || !response) {
      return res.status(400).json({ error: 'Missing flowId or response' });
    }

    const expectedChallenge = takeLoginChallenge(flowId);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Sign-in session expired — please try again' });
    }

    const adminDb = getAdminDb();
    const stored = await adminDb.getWebAuthnCredentialById(response.id);
    if (!stored) {
      return res.status(401).json({ error: 'Passkey not recognised' });
    }

    const credential: SimpleWebAuthnCredential = {
      id: stored.id,
      publicKey: isoBase64URL.toBuffer(stored.publicKey),
      counter: stored.counter,
      transports: stored.transports as any,
    };

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigins(),
      expectedRPID: WEBAUTHN_RP_ID,
      credential,
    });

    if (!verification.verified) {
      return res.status(401).json({ error: 'Passkey sign-in could not be verified' });
    }

    const now = new Date();
    await adminDb.updateWebAuthnCredentialCounter(stored.id, verification.authenticationInfo.newCounter, now);

    const user = await adminDb.getUserById(stored.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Account not found or inactive' });
    }
    user.lastLoginAt = now;
    await adminDb.updateUser(user.id, { lastLoginAt: now });

    logger.info('User signed in with passkey', { userId: user.id, credentialId: stored.id });
    res.json(await completeSignIn(user, res));
  } catch (error) {
    logger.error('Error verifying passkey sign-in', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Management — authenticated only. Listing/removing lives in Station Manager.
// ---------------------------------------------------------------------------

router.get('/credentials', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const credentials = await getAdminDb().getWebAuthnCredentialsByUser(req.user.userId);
    res.json(
      credentials.map((c) => ({
        id: c.id,
        name: c.name,
        deviceType: c.deviceType,
        createdAt: c.createdAt,
        lastUsedAt: c.lastUsedAt,
      })),
    );
  } catch (error) {
    logger.error('Error listing passkeys', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/credentials/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const deleted = await getAdminDb().deleteWebAuthnCredential(req.params.id, req.user.userId);
    if (!deleted) return res.status(404).json({ error: 'Passkey not found' });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting passkey', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
