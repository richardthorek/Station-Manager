/**
 * AI gateway: provider adapters, usage metering, and route gating.
 *
 * Provider calls are exercised with an injected/mocked fetch — no live Azure.
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import aiRouter from '../routes/ai';
import {
  chatCompletion,
  issueSpeechToken,
  isOpenAiConfigured,
  isSpeechConfigured,
  isAiConfigured,
  GatewayError,
} from '../services/aiGateway';
import { getUsageDatabase, monthStart, monthlyResetAt } from '../services/usageDatabase';
import { ensureOrganizationDatabase, initializeOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureUsageDatabase, initializeUsageDatabase } from '../services/usageDbFactory';
import type { Organization, PlanCode } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const OPENAI_ENV = ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_KEY', 'AZURE_OPENAI_DEPLOYMENT_CHAT', 'AZURE_OPENAI_DEPLOYMENT_REPORT', 'AZURE_OPENAI_API_VERSION'];
const SPEECH_ENV = ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION'];

function clearAiEnv() {
  for (const k of [...OPENAI_ENV, ...SPEECH_ENV]) delete process.env[k];
}

function configureOpenAi() {
  process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com';
  process.env.AZURE_OPENAI_KEY = 'sk-fake';
  process.env.AZURE_OPENAI_DEPLOYMENT_CHAT = 'gpt-4.1-mini';
  process.env.AZURE_OPENAI_DEPLOYMENT_REPORT = 'gpt-4o';
}

function configureSpeech() {
  process.env.AZURE_SPEECH_KEY = 'speech-fake';
  process.env.AZURE_SPEECH_REGION = 'australiaeast';
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRouter);
  return app;
}

async function makeOrg(planCode: PlanCode, overrides: Partial<Organization['entitlements']> = {}): Promise<Organization> {
  const orgDb = ensureOrganizationDatabase();
  const org = await orgDb.createOrganization({ name: `Org-${planCode}-${Date.now()}-${Math.random()}`, billingEmail: 'a@b.org', planCode });
  if (Object.keys(overrides).length) {
    const updated = await orgDb.updateOrganization(org.id, { entitlements: { ...org.entitlements, ...overrides } });
    return updated as Organization;
  }
  return org;
}

function tokenFor(org: Organization): string {
  return jwt.sign({ userId: 'u1', username: 'cap', role: 'owner', organizationId: org.id }, JWT_SECRET);
}

describe('AI gateway', () => {
  beforeAll(async () => {
    await initializeOrganizationDatabase();
    await initializeUsageDatabase();
  });

  beforeEach(async () => {
    clearAiEnv();
    process.env.ENABLE_ENTITLEMENTS = 'true';
    await (ensureOrganizationDatabase() as unknown as { clear: () => Promise<void> }).clear();
    await (ensureUsageDatabase() as unknown as { clear: () => Promise<void> }).clear();
  });

  afterAll(() => {
    clearAiEnv();
    delete process.env.ENABLE_ENTITLEMENTS;
    (global as { fetch?: unknown }).fetch = undefined;
  });

  // ── config detection ──────────────────────────────────────────────────────
  describe('configuration detection', () => {
    it('reports OpenAI/Speech/any unconfigured by default', () => {
      expect(isOpenAiConfigured()).toBe(false);
      expect(isSpeechConfigured()).toBe(false);
      expect(isAiConfigured()).toBe(false);
    });

    it('reports configured once env vars are set', () => {
      configureOpenAi();
      configureSpeech();
      expect(isOpenAiConfigured()).toBe(true);
      expect(isSpeechConfigured()).toBe(true);
      expect(isAiConfigured()).toBe(true);
    });
  });

  // ── chatCompletion adapter ────────────────────────────────────────────────
  describe('chatCompletion()', () => {
    it('returns 503 when OpenAI is not configured', async () => {
      const result = await chatCompletion({ kind: 'chat', messages: [] });
      expect(result.status).toBe(503);
    });

    it('proxies to Azure and returns status + body + usage', async () => {
      configureOpenAi();
      const fetchImpl = (async () => ({
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 7, completion_tokens: 2 } }),
      })) as unknown as typeof fetch;
      const result = await chatCompletion({ kind: 'chat', messages: [{ role: 'user', content: 'hi' }], fetchImpl });
      expect(result.status).toBe(200);
      expect(result.usage).toEqual({ promptTokens: 7, completionTokens: 2 });
    });

    it('forwards the provider error status (e.g. 400) verbatim', async () => {
      configureOpenAi();
      const fetchImpl = (async () => ({ status: 400, json: async () => ({ error: { message: 'bad schema' } }) })) as unknown as typeof fetch;
      const result = await chatCompletion({ kind: 'chat', messages: [], fetchImpl });
      expect(result.status).toBe(400);
    });

    it('returns 502 when the provider is unreachable', async () => {
      configureOpenAi();
      const fetchImpl = (async () => { throw new Error('network'); }) as unknown as typeof fetch;
      const result = await chatCompletion({ kind: 'chat', messages: [], fetchImpl });
      expect(result.status).toBe(502);
    });

    it('uses the report deployment for kind=report', async () => {
      configureOpenAi();
      let calledUrl = '';
      const fetchImpl = (async (url: string) => {
        calledUrl = url;
        return { status: 200, json: async () => ({ choices: [{ message: { content: '{}' } }] }) };
      }) as unknown as typeof fetch;
      await chatCompletion({ kind: 'report', messages: [], fetchImpl });
      expect(calledUrl).toContain('gpt-4o');
    });
  });

  // ── issueSpeechToken adapter ──────────────────────────────────────────────
  describe('issueSpeechToken()', () => {
    it('throws a 503 GatewayError when Speech is not configured', async () => {
      await expect(issueSpeechToken()).rejects.toMatchObject({ status: 503 });
    });

    it('returns the token and region on success', async () => {
      configureSpeech();
      const fetchImpl = (async () => ({ ok: true, text: async () => 'tok-123' })) as unknown as typeof fetch;
      const result = await issueSpeechToken(fetchImpl);
      expect(result).toEqual({ token: 'tok-123', region: 'australiaeast' });
    });

    it('throws a 502 GatewayError when the token request fails', async () => {
      configureSpeech();
      const fetchImpl = (async () => ({ ok: false, status: 401, text: async () => '' })) as unknown as typeof fetch;
      await expect(issueSpeechToken(fetchImpl)).rejects.toBeInstanceOf(GatewayError);
    });
  });

  // ── usage database ────────────────────────────────────────────────────────
  describe('usage metering', () => {
    it('records and counts usage within the current month', async () => {
      const db = getUsageDatabase();
      await db.clear();
      await db.recordUsage({ organizationId: 'org1', type: 'speech' });
      await db.recordUsage({ organizationId: 'org1', type: 'speech' });
      await db.recordUsage({ organizationId: 'org1', type: 'chat' });
      await db.recordUsage({ organizationId: 'org2', type: 'speech' });
      expect(await db.countUsage('org1', 'speech')).toBe(2);
      expect(await db.countUsage('org1', 'chat')).toBe(1);
      expect(await db.countUsage('org2', 'speech')).toBe(1);
    });

    it('dedupes usage rows sharing a sessionId — a re-vend for the same review counts once (AAR-11)', async () => {
      const db = getUsageDatabase();
      await db.clear();
      // A token-refresh timer / reconnect re-vends for the same meeting.
      await db.recordUsage({ organizationId: 'org1', type: 'speech', sessionId: 's1' });
      await db.recordUsage({ organizationId: 'org1', type: 'speech', sessionId: 's1' });
      await db.recordUsage({ organizationId: 'org1', type: 'speech', sessionId: 's1' });
      // A second, distinct meeting still counts separately.
      await db.recordUsage({ organizationId: 'org1', type: 'speech', sessionId: 's2' });
      expect(await db.countUsage('org1', 'speech')).toBe(2);
    });

    it('monthlyResetAt is the first of next month and after monthStart', () => {
      const now = new Date('2026-06-20T10:00:00Z');
      expect(monthlyResetAt(now).toISOString()).toBe('2026-07-01T00:00:00.000Z');
      expect(monthStart(now).toISOString()).toBe('2026-06-01T00:00:00.000Z');
    });
  });

  // ── route: POST /api/ai/chat ──────────────────────────────────────────────
  describe('POST /api/ai/chat', () => {
    it('returns 503 when OpenAI is not configured', async () => {
      const res = await request(buildApp()).post('/api/ai/chat').send({ messages: [] });
      expect(res.status).toBe(503);
    });

    it('returns 400 when messages is not an array', async () => {
      configureOpenAi();
      const res = await request(buildApp()).post('/api/ai/chat').send({ messages: 'nope' });
      expect(res.status).toBe(400);
    });

    it('proxies and records usage for an AI-enabled org', async () => {
      configureOpenAi();
      (global as { fetch?: unknown }).fetch = (async () => ({
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{}' } }] }),
      })) as unknown as typeof fetch;
      const org = await makeOrg('ai');
      const res = await request(buildApp())
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${tokenFor(org)}`)
        .send({ messages: [{ role: 'user', content: 'hi' }] });
      expect(res.status).toBe(200);
      expect(await ensureUsageDatabase().countUsage(org.id, 'chat')).toBe(1);
    });

    it('returns 403 for an org without the aiEnabled entitlement', async () => {
      configureOpenAi();
      const org = await makeOrg('basic');
      const res = await request(buildApp())
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${tokenFor(org)}`)
        .send({ messages: [{ role: 'user', content: 'hi' }] });
      expect(res.status).toBe(403);
      expect(res.body.feature).toBe('aiEnabled');
    });
  });

  // ── route: POST /api/ai/speech/token ──────────────────────────────────────
  describe('POST /api/ai/speech/token', () => {
    it('returns 503 when Speech is not configured', async () => {
      const res = await request(buildApp()).post('/api/ai/speech/token').send({});
      expect(res.status).toBe(503);
    });

    it('vends a token and records a session for an AI org with allowance', async () => {
      configureSpeech();
      (global as { fetch?: unknown }).fetch = (async () => ({ ok: true, text: async () => 'tok-abc' })) as unknown as typeof fetch;
      const org = await makeOrg('ai');
      const res = await request(buildApp())
        .post('/api/ai/speech/token')
        .set('Authorization', `Bearer ${tokenFor(org)}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.token).toBe('tok-abc');
      expect(await ensureUsageDatabase().countUsage(org.id, 'speech')).toBe(1);
    });

    it('returns 402 when the monthly session allowance is exhausted', async () => {
      configureSpeech();
      (global as { fetch?: unknown }).fetch = (async () => ({ ok: true, text: async () => 'tok-abc' })) as unknown as typeof fetch;
      const org = await makeOrg('ai', { aiIncludedSessions: 0 });
      const res = await request(buildApp())
        .post('/api/ai/speech/token')
        .set('Authorization', `Bearer ${tokenFor(org)}`)
        .send({});
      expect(res.status).toBe(402);
      expect(res.body.remaining).toBe(0);
      expect(res.body.resetAt).toBeTruthy();
    });

    it('returns 403 for a non-AI org', async () => {
      configureSpeech();
      const org = await makeOrg('basic');
      const res = await request(buildApp())
        .post('/api/ai/speech/token')
        .set('Authorization', `Bearer ${tokenFor(org)}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('re-vending for the same sessionId does not consume extra allowance (AAR-11)', async () => {
      configureSpeech();
      (global as { fetch?: unknown }).fetch = (async () => ({ ok: true, text: async () => 'tok-abc' })) as unknown as typeof fetch;
      // A token-refresh timer and a couple of reconnects across one meeting —
      // all for the same review, previously each burned a metered session.
      const org = await makeOrg('ai', { aiIncludedSessions: 1 });
      const app = buildApp();
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/ai/speech/token')
          .set('Authorization', `Bearer ${tokenFor(org)}`)
          .send({ sessionId: 'review-1' });
        expect(res.status).toBe(200);
      }
      expect(await ensureUsageDatabase().countUsage(org.id, 'speech')).toBe(1);

      // A second, distinct review still consumes its own session — and with
      // only 1 included, this one is correctly blocked.
      const res = await request(app)
        .post('/api/ai/speech/token')
        .set('Authorization', `Bearer ${tokenFor(org)}`)
        .send({ sessionId: 'review-2' });
      expect(res.status).toBe(402);
    });
  });

  // ── route: GET /api/ai/usage ──────────────────────────────────────────────
  describe('GET /api/ai/usage', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(buildApp()).get('/api/ai/usage');
      expect(res.status).toBe(401);
    });

    it('returns usage vs allowance for the authenticated org', async () => {
      const org = await makeOrg('ai');
      await ensureUsageDatabase().recordUsage({ organizationId: org.id, type: 'speech' });
      const res = await request(buildApp())
        .get('/api/ai/usage')
        .set('Authorization', `Bearer ${tokenFor(org)}`);
      expect(res.status).toBe(200);
      expect(res.body.used).toBe(1);
      expect(res.body.included).toBe(25);
      expect(res.body.remaining).toBe(24);
      expect(res.body.aiEnabled).toBe(true);
    });
  });
});
