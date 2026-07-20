import request from 'supertest';
import express, { Express } from 'express';
import authRouter from '../routes/auth';
import wikiRouter from '../routes/wiki';
import { ensureAdminUserDatabase, initializeAdminUserDatabase, getAdminDb } from '../services/adminUserDbFactory';
import { ensureOrganizationDatabase, initializeOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureOrgAccessDatabase, initializeOrgAccessDatabase } from '../services/orgAccessDbFactory';
import { getFacilitiesParser } from '../services/facilitiesParser';
import { installFacilitiesFixture, restoreFacilitiesFixture } from './helpers/facilitiesFixture';
import { getWikiPage } from '../services/wikiContentService';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/wiki', wikiRouter);
  return app;
}

describe('Wiki routes', () => {
  let app: Express;

  beforeAll(async () => {
    installFacilitiesFixture();
    await initializeOrganizationDatabase();
    await initializeOrgAccessDatabase();
    ensureAdminUserDatabase();
    await initializeAdminUserDatabase();
  });

  afterAll(() => {
    restoreFacilitiesFixture();
  });

  beforeEach(async () => {
    getFacilitiesParser().resetForTesting();
    await (ensureOrganizationDatabase() as unknown as { clear: () => Promise<void> }).clear();
    await (ensureOrgAccessDatabase() as unknown as { clear: () => Promise<void> }).clear();
    await (getAdminDb() as unknown as { clear: () => Promise<void> }).clear();
    app = buildApp();
  });

  describe('user-guide (public)', () => {
    it('returns a manifest with sections and known pages', async () => {
      const res = await request(app).get('/api/wiki/user-guide');
      expect(res.status).toBe(200);
      expect(res.body.sections.length).toBeGreaterThan(0);
      const slugs = res.body.sections.flatMap((s: { pages: { slug: string }[] }) => s.pages.map((p) => p.slug));
      expect(slugs).toContain('getting-started');
      expect(slugs).toContain('admin-guide');
    });

    it('serves a page by slug', async () => {
      const res = await request(app).get('/api/wiki/user-guide/pages/getting-started');
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe('getting-started');
      expect(res.body.markdown).toContain('#');
    });

    it('serves the readme as the landing page', async () => {
      const res = await request(app).get('/api/wiki/user-guide/pages/readme');
      expect(res.status).toBe(200);
      expect(res.body.markdown).toContain('Station Manager');
    });

    it('404s for an unknown slug', async () => {
      const res = await request(app).get('/api/wiki/user-guide/pages/does-not-exist');
      expect(res.status).toBe(404);
    });

    it('404s for a slug that is not in the manifest even if the file exists on disk', async () => {
      // README.md exists but only reachable via the 'readme' slug, not its raw filename
      const res = await request(app).get('/api/wiki/user-guide/pages/README');
      expect(res.status).toBe(404);
    });

    it('serves a known image, readable cross-origin (needed for the :5173/:3000 dev split)', async () => {
      const res = await request(app).get('/api/wiki/user-guide/images/sign-in-board-desktop.png');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/png/);
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it('404s for an unknown image', async () => {
      const res = await request(app).get('/api/wiki/user-guide/images/nope.png');
      expect(res.status).toBe(404);
    });
  });

  describe('user-guide search (public, AI-gated)', () => {
    it('rejects a missing query', async () => {
      const res = await request(app).post('/api/wiki/user-guide/search').send({});
      expect(res.status).toBe(400);
    });

    it('rejects an overlong query', async () => {
      const res = await request(app)
        .post('/api/wiki/user-guide/search')
        .send({ query: 'a'.repeat(501) });
      expect(res.status).toBe(400);
    });

    it('503s when AI is not configured (test env has no Azure OpenAI credentials)', async () => {
      const res = await request(app).post('/api/wiki/user-guide/search').send({ query: 'how do I check in?' });
      expect(res.status).toBe(503);
    });
  });

  describe('platform-admin (gated)', () => {
    async function signup(): Promise<string> {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          organizationName: 'Bungendore RFS',
          billingEmail: 'captain@example.com',
          username: 'captain',
          password: 'supersecret1',
          email: 'captain@example.com',
        });
      return res.body.token as string;
    }

    async function platformAdminToken(): Promise<string> {
      const adminDb = getAdminDb();
      await adminDb.createAdminUser('root-admin', 'supersecret1', 'owner');
      const res = await request(app).post('/api/auth/login').send({ username: 'root-admin', password: 'supersecret1' });
      return res.body.token as string;
    }

    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/wiki/platform-admin');
      expect(res.status).toBe(401);
    });

    it('rejects a non-platform-admin', async () => {
      const token = await signup();
      const res = await request(app).get('/api/wiki/platform-admin').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('serves the manifest and a page to a platform admin', async () => {
      process.env.PLATFORM_ADMIN_USERNAMES = 'root-admin';
      try {
        const token = await platformAdminToken();
        const manifest = await request(app).get('/api/wiki/platform-admin').set('Authorization', `Bearer ${token}`);
        expect(manifest.status).toBe(200);
        const slugs = manifest.body.sections.flatMap((s: { pages: { slug: string }[] }) => s.pages.map((p) => p.slug));
        expect(slugs).toContain('organizations');

        const page = await request(app)
          .get('/api/wiki/platform-admin/pages/organizations')
          .set('Authorization', `Bearer ${token}`);
        expect(page.status).toBe(200);
        expect(page.body.title).toBe('Organizations');
      } finally {
        delete process.env.PLATFORM_ADMIN_USERNAMES;
      }
    });
  });

  describe('wikiContentService path safety', () => {
    it('rejects slugs outside the known whitelist even with traversal characters', () => {
      expect(getWikiPage('user-guide', '../../../etc/passwd')).toBeNull();
      expect(getWikiPage('user-guide', 'getting-started/../../../etc/passwd')).toBeNull();
    });
  });
});
