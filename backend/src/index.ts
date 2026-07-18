/**
 * Station Manager - Backend Server
 * 
 * Main entry point for the Express server that powers the Station Manager application.
 * Provides REST API endpoints for member management, activity tracking, check-ins, events,
 * and truck checks. Includes WebSocket support via Socket.io for real-time synchronization.
 * 
 * Key Features:
 * - Member sign-in/sign-out tracking
 * - Activity and event management
 * - Real-time updates across devices
 * - Truck check workflows
 * - Azure Table Storage integration
 * - In-memory database for development
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from common locations (no overrides) before any other imports
const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env.local'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env.local'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '.env'),
];

candidateEnvPaths.forEach(envPath => {
  dotenv.config({ path: envPath, override: false });
});

// Fail fast in production if JWT_SECRET is missing or still the dev default —
// every auth token (admin JWT, brigade token, member session, device token) is
// forgeable otherwise. Must run before any other module reads JWT_SECRET.
import { isJwtSecretUnconfigured } from './config/jwtSecret';
if (process.env.NODE_ENV === 'production' && isJwtSecretUnconfigured()) {
  // eslint-disable-next-line no-console
  console.error(
    'FATAL: JWT_SECRET is not set (or is the dev default) in production. Refusing to start.'
  );
  process.exit(1);
}

// Initialize Azure Application Insights early (before other imports)
// This ensures all subsequent operations can be tracked
import { initializeAppInsights, flushAppInsights } from './services/appInsights';
initializeAppInsights();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import membersRouter from './routes/members';
import memberActivationRouter from './routes/memberActivation';
import activitiesRouter from './routes/activities';
import checkinsRouter from './routes/checkins';
import eventsRouter from './routes/events';
import truckChecksRouter from './routes/truckChecks';
import reportsRouter from './routes/reports';
import stationsRouter from './routes/stations';
import brigadeAccessRouter from './routes/brigadeAccess';
import devicesRouter from './routes/devices';
import exportRouter from './routes/export';
import authRouter from './routes/auth';
import organizationsRouter from './routes/organizations';
import orgInvitesRouter from './routes/orgInvites';
import facilitiesRouter from './routes/facilities';
import platformRouter from './routes/platform';
import billingRouter from './routes/billing';
import aiRouter from './routes/ai';
import aarSessionsRouter from './routes/aarSessions';
import { createAchievementRoutes } from './routes/achievements';
import { ensureDatabase } from './services/dbFactory';
import { ensureTruckChecksDatabase } from './services/truckChecksDbFactory';
import { getRFSFacilitiesParser } from './services/rfsFacilitiesParser';
import { getVersionInfo } from './services/version';
import { seedDemoStationIfNeeded } from './services/demoStationSeeder';
import { seedStandardVehicleTypesIfNeeded } from './services/standardVehicleTypeSeeder';
import { apiRateLimiter, aiRateLimiter, spaRateLimiter } from './middleware/rateLimiter';
import { requireFeature } from './middleware/entitlements';
import { requireSession } from './middleware/flexibleAuth';
import { kioskModeMiddleware } from './middleware/kioskModeMiddleware';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLoggingMiddleware } from './middleware/requestLogging';
import { logger } from './services/logger';
import { ensureAdminUserDatabase, initializeAdminUserDatabase } from './services/adminUserDbFactory';
import { initializeOrganizationDatabase } from './services/organizationDbFactory';
import { initializeOrgAccessDatabase } from './services/orgAccessDbFactory';
import { initializeUsageDatabase } from './services/usageDbFactory';
import { initializeBillingEventDatabase } from './services/billingEventDbFactory';
import { initializeAarSessionDatabase } from './services/aarSessionDbFactory';
import { initializeVehicleTypeDatabase, getVehicleTypeDb } from './services/vehicleTypeDbFactory';
import { initializeApplianceZoneDatabase } from './services/applianceZoneDbFactory';
import { initializeDeviceDatabase } from './services/deviceDbFactory';
import { initializeApplianceEquipmentDatabase } from './services/applianceEquipmentDbFactory';
import { initializeAgentSessionDatabase } from './services/agentSessionDbFactory';
import { agentCheckRouter, attachAgentCheckWs } from './routes/agentCheck';
import { allowedOriginsList } from './utils/allowedOrigins';
import { CORS_ALLOWED_HEADERS } from './config/corsHeaders';
import { registerAarCollabHandlers } from './services/aarCollab';
import { registerStationSocketHandlers, type SocketWithStation } from './services/stationSocketHandlers';
import { handleFatalProcessError } from './services/fatalErrorHandler';

const app = express();
const httpServer = createServer(app);

// Attach raw WS handler for voice-agent sessions (A3).
// Must be registered before Socket.io attaches its own 'upgrade' listener so our
// path check runs first; non-matching paths fall through to Socket.io.
attachAgentCheckWs(httpServer);

// Allowed origins for CORS (used by Express, Socket.io, and the raw
// agent-check WS upgrade handler) — shared via utils/allowedOrigins.ts rather
// than exported from here, since agentCheck.ts's attachAgentCheckWs() runs
// synchronously above and importing anything back from this file would be
// circular (A3 code review F6).

const io = new Server(httpServer, {
  // engine.io's default destroyUpgrade behaviour ends ANY upgrade socket it
  // didn't handle itself after 1 s with no bytes written — including a
  // /ws/agent-check upgrade still awaiting its pre-upgrade DB validation
  // (several Table Storage round trips in prod), which killed voice-check
  // connections mid-handshake whenever validation outlasted the timer. The
  // agent-check handler (attached above) takes over the cleanup duty instead,
  // rejecting upgrade paths nobody handles with an immediate 404.
  destroyUpgrade: false,
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin or from allowed origins
      if (!origin || allowedOriginsList.includes(origin)) {
        callback(null, true);
      } else {
        // Deny CORS headers for unlisted origins, but do NOT throw: a throw
        // turns every same-origin asset request that carries an Origin header
        // into a 500. Same-origin requests don't need CORS headers, so they
        // still succeed; genuine cross-origin requests are blocked by the
        // browser (no ACAO header), which is the intended behaviour.
        callback(null, false);
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3000;

// Trust first proxy (Azure App Service) for correct client IP identification
// This enables express-rate-limit to work correctly with X-Forwarded-For header
app.set('trust proxy', 1);

// Make Socket.io instance available to routes
app.set('io', io);

// Security headers middleware - must be applied early
// Helmet provides protection against common web vulnerabilities
app.use(helmet({
  // Content Security Policy - controls what resources can be loaded
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Allow self-hosted scripts and Microsoft Clarity analytics
      scriptSrc: [
        "'self'",
        "https://www.clarity.ms", // Microsoft Clarity analytics (dynamically loads script)
        "https://scripts.clarity.ms", // Microsoft Clarity script files
        "https://static.cloudflareinsights.com", // Cloudflare Insights analytics script
      ],
      // Allow inline styles for React and Google Fonts stylesheet
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for React inline styles
        "https://fonts.googleapis.com", // Google Fonts CSS
      ],
      imgSrc: ["'self'", "data:", "blob:", "https:"], // Allow data URIs and external images
      connectSrc: [
        "'self'",
        "ws:", "wss:", // WebSocket connections for Socket.io
        // Q42 (found 2026-07-17): Clarity's collection endpoint isn't a fixed
        // host — it shards across many single/double-letter subdomains
        // (c/e/f/g/z.clarity.ms, etc.) chosen at runtime, per Microsoft's own
        // CSP guidance. Enumerating a few (as this used to) misses most of
        // them; the wildcard is the documented-correct allowlist.
        "https://*.clarity.ms", // Microsoft Clarity analytics — all sharded collection endpoints
        "https://fonts.googleapis.com", // Google Fonts CSS (Fetch API)
        "https://fonts.gstatic.com", // Google Fonts files — the service worker fetch()es
                                     // these to cache them; connect-src governs SW fetch,
                                     // so font-src alone isn't enough (CSP error otherwise)
        // cloudflareinsights.com is its own domain, not a subdomain of
        // cloudflare.com — *.cloudflare.com never matches it, so the actual
        // beacon endpoint (https://cloudflareinsights.com/cdn-cgi/rum) was
        // silently blocked despite this allowlist looking Cloudflare-shaped.
        "https://*.cloudflare.com", "https://cloudflareinsights.com", // Cloudflare Insights analytics endpoints
      ],
      // Allow self-hosted fonts, data URIs, and Google Fonts
      fontSrc: [
        "'self'",
        "data:",
        "https://fonts.gstatic.com", // Google Fonts files
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // Prevent clickjacking by disabling iframe embedding
  xFrameOptions: {
    action: 'deny'
  },
  // Referrer policy for privacy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
}));

// Add Permissions-Policy header manually for browser feature restrictions
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  next();
});

// CORS Configuration
// Log configured allowed origins for debugging
logger.info('CORS allowed origins configured', { origins: allowedOriginsList });

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, server-to-server, Postman)
    // or requests from allowed origins
    if (!origin || allowedOriginsList.includes(origin)) {
      callback(null, true);
    } else {
      // Deny CORS headers for unlisted origins, but do NOT throw. Throwing turns
      // every request that carries an Origin header — including same-origin
      // asset fetches (module scripts, stylesheets) — into a 500, which takes
      // the whole site down if FRONTEND_URLS is missing or wrong. Same-origin
      // requests don't need CORS headers and still succeed; genuine cross-origin
      // callers are blocked client-side by the browser (no ACAO), as intended.
      logger.warn('CORS request blocked', { origin, allowedOrigins: allowedOriginsList });
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: CORS_ALLOWED_HEADERS,
}));

// Stripe webhook needs the raw (unparsed) body to verify its signature.
// This must be registered before express.json() so the stream is not consumed first.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// Middleware
app.use(express.json());

// Response compression - reduces bandwidth and improves load times
// Configured with balanced settings for production use
app.use(compression({
  level: 6,        // Compression level (0-9): 6 is balanced between speed and compression
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress responses if explicitly disabled via header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use default compression filter (compresses text-based content types)
    return compression.filter(req, res);
  }
}));

app.use(requestIdMiddleware); // Add unique request ID to each request
app.use(requestLoggingMiddleware); // Log all HTTP requests and responses
app.use(kioskModeMiddleware); // Detect and validate kiosk mode from brigade token

// Serve static files from frontend build (for production).
// Vite emits content-hashed filenames under /assets, so those are immutable —
// let browsers and the kiosk tablets cache them for a year instead of
// revalidating every asset on each load. Everything else (index.html, sw.js,
// manifest, icons) keeps no-cache/short caching so app updates roll out
// promptly via the usual SW update flow.
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath, {
  setHeaders: (res, filePath) => {
    if (/[\\/]assets[\\/]/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('.webmanifest') || filePath.endsWith('manifest.json')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      // Icons, robots.txt, workbox runtime, etc — cache for a day.
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  },
}));

// Serve the AAR Studio companion app (a no-build vanilla static bundle) as part
// of this single App Service deployment, reachable from the app picker at /aar.
// It needs a more permissive policy than the main app — it calls Azure AI Speech
// and Azure OpenAI directly from the browser, lazy-loads the Speech SDK from
// jsDelivr, renders the report preview in a srcdoc iframe, and uses the
// microphone / display-capture for live listening. Those needs used to live in
// staticwebapp.config.json; under App Service they are enforced here, scoped to
// /aar so the main app keeps Helmet's stricter global policy. Guarded by
// existsSync so a deployment that doesn't bundle aar-studio still boots cleanly.
const aarStudioPath = process.env.AAR_STUDIO_PATH || path.join(__dirname, '../../aar-studio');
if (fs.existsSync(path.join(aarStudioPath, 'index.html'))) {
  const aarCsp = [
    "default-src 'self'",
    // Q42 (found 2026-07-17): this override replaces Helmet's global CSP
    // wholesale, so the main app's Cloudflare Insights allowance (script-src)
    // doesn't carry over here — Cloudflare's edge-injected beacon script was
    // silently blocked on every /aar load.
    "script-src 'self' https://cdn.jsdelivr.net https://static.cloudflareinsights.com blob:",
    "worker-src 'self' blob:",
    // connect-src also governs the SW/browser fetch() for Google-Fonts CSS, and
    // the same-origin Socket.io connection (ws:/wss:) used by collaborative notes.
    // cloudflareinsights.com (the beacon endpoint) is its own domain, not a
    // subdomain of cloudflare.com — see the matching note on the global CSP.
    "connect-src 'self' ws: wss: https://cdn.jsdelivr.net https://fonts.googleapis.com https://*.openai.azure.com https://*.cognitiveservices.azure.com https://*.services.ai.azure.com https://*.api.cognitive.microsoft.com wss://*.stt.speech.microsoft.com https://*.cloudflare.com https://cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "frame-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  app.use('/aar', (req, res, next) => {
    // Override Helmet's global CSP / Permissions-Policy for the AAR sub-app only.
    res.setHeader('Content-Security-Policy', aarCsp);
    res.setHeader('Permissions-Policy', 'microphone=(self), display-capture=(self), camera=()');
    next();
  }, express.static(aarStudioPath));
  logger.info('AAR Studio mounted at /aar', { path: aarStudioPath });
} else {
  logger.warn('AAR Studio bundle not found; /aar will not be served', { path: aarStudioPath });
}

// Health check
app.get('/health', async (req, res) => {
  try {
    // Report initialization status
    if (databaseInitializing) {
      // Server is up but databases are still initializing
      // Return 200 so Azure considers container healthy
      const versionInfo = getVersionInfo();
      res.status(200).json({
        status: 'initializing',
        message: 'Server is starting, databases initializing in background',
        timestamp: new Date().toISOString(),
        database: 'initializing',
        environment: process.env.NODE_ENV || 'development',
        version: versionInfo
      });
      return;
    }
    
    // Check if database initialization failed
    if (databaseError) {
      res.status(503).json({
        status: 'degraded',
        message: 'Server is running but database initialization failed',
        error: databaseError,
        timestamp: new Date().toISOString(),
        database: 'error',
        environment: process.env.NODE_ENV || 'development',
        version: getVersionInfo()
      });
      return;
    }
    
    // Databases are initialized, report full status
    const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
    const dbType = storageConnectionString && !explicitlyDisabled ? 'table-storage' : 'in-memory';
    const versionInfo = getVersionInfo();
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: dbType,
      environment: process.env.NODE_ENV || 'development',
      version: versionInfo
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Database status endpoint for frontend
app.get('/api/status', apiRateLimiter, async (req, res) => {
  try {
    // Report initialization status
    if (databaseInitializing) {
      const versionInfo = getVersionInfo();
      res.json({
        status: 'initializing',
        message: 'Databases initializing in background',
        databaseType: 'initializing',
        isProduction: process.env.NODE_ENV === 'production',
        usingInMemory: false,
        timestamp: new Date().toISOString(),
        version: versionInfo
      });
      return;
    }
    
    // Check if database initialization failed
    if (databaseError) {
      res.status(503).json({
        status: 'degraded',
        message: 'Database initialization failed',
        error: databaseError,
        databaseType: 'error',
        isProduction: process.env.NODE_ENV === 'production',
        usingInMemory: false,
        timestamp: new Date().toISOString(),
        version: getVersionInfo()
      });
      return;
    }
    
    // Databases are initialized
    const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
    const dbType = storageConnectionString && !explicitlyDisabled ? 'table-storage' : 'in-memory';
    const isProduction = process.env.NODE_ENV === 'production';
    const usingInMemory = dbType === 'in-memory';
    const versionInfo = getVersionInfo();
    
    res.json({ 
      status: 'ok',
      databaseType: dbType,
      isProduction,
      usingInMemory,
      timestamp: new Date().toISOString(),
      version: versionInfo
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to check database status'
    });
  }
});

// API Routes with rate limiting.
// Feature gating (requireFeature) is a no-op unless ENABLE_ENTITLEMENTS=true,
// so single-tenant deployments and the demo are unaffected. When enabled, an
// authenticated org's plan/toggles decide which modules are reachable — e.g. a
// maintenance-only brigade can disable the sign-in book, and standard plans
// have AI gated off.
app.use('/api/auth', apiRateLimiter, authRouter);
app.use('/api/organizations', apiRateLimiter, organizationsRouter);
// Public: invite-link preview/accept/signup and the signup facility lookup.
app.use('/api/org-invites', apiRateLimiter, orgInvitesRouter);
app.use('/api/facilities', apiRateLimiter, facilitiesRouter);
// Platform admin (PLATFORM_ADMIN_USERNAMES allowlist): claim-conflict review.
app.use('/api/platform', apiRateLimiter, platformRouter);
app.use('/api/billing', apiRateLimiter, billingRouter);
app.use('/api/ai', aiRateLimiter, aiRouter);
app.use('/api/aar-sessions', apiRateLimiter, requireFeature('aarStudioEnabled'), aarSessionsRouter);
// requireSession({ readsOnly:true }) closes the anonymous data-exposure hole
// (UAT 2026-06-22): reads on members/truck-checks/reports now require a signed-in
// session, a valid kiosk token, or the public demo station. Write-path kiosk
// actions (check-ins, truck-check results) keep their existing pass-through.
// Public activation routes must be mounted before requireSession so no token is required
app.use('/api/members', apiRateLimiter, memberActivationRouter);
app.use('/api/members', apiRateLimiter, requireSession({ readsOnly: true }), membersRouter);
// AC-4 walk-up sweep (2026-07-17): activities/checkins/events relied solely on
// their internal flexibleAuth, which only enforces auth when
// ENABLE_DATA_PROTECTION=true — the same env-conditional footgun Q29 flagged
// for REQUIRE_AUTH. checkins/events in particular return member names, ranks,
// check-in timestamps and location (EventParticipant/CheckIn) — the same
// class of anonymous PII leak the F1 fix closed on members/reports/truck-checks,
// just not caught by that sweep. requireSession (readsOnly) is unconditional,
// so reads are gated regardless of that env var; kiosk writes (check-in,
// event create/end, participant add) keep their existing pass-through.
app.use('/api/activities', apiRateLimiter, requireSession({ readsOnly: true }), activitiesRouter);
app.use('/api/checkins', apiRateLimiter, requireSession({ readsOnly: true }), requireFeature('signInEnabled'), checkinsRouter);
app.use('/api/events', apiRateLimiter, requireSession({ readsOnly: true }), requireFeature('signInEnabled'), eventsRouter);
app.use('/api/stations', apiRateLimiter, stationsRouter);
app.use('/api/truck-checks', apiRateLimiter, requireSession({ readsOnly: true }), requireFeature('truckCheckEnabled'), truckChecksRouter);
app.use('/api/reports', apiRateLimiter, requireSession({ readsOnly: true }), requireFeature('reportsEnabled'), reportsRouter);
app.use('/api/brigade-access', apiRateLimiter, brigadeAccessRouter);
app.use('/api/devices', apiRateLimiter, devicesRouter);
// Same anonymous-read gate as /api/reports above: the export endpoints return
// the full member roster (name, rank, member number, QR check-in code) and
// check-in/event/truck-check history as CSV. Without requireSession they were
// reachable by fully credential-less callers — the same class of hole the
// 2026-06-22 UAT fix closed on members/reports/truck-checks, but /api/export
// was missed in that sweep. requireFeature alone does NOT gate anonymous
// requests (it passes through when there is no org context).
app.use('/api/export', apiRateLimiter, requireSession({ readsOnly: true }), requireFeature('reportsEnabled'), exportRouter);

// Achievement routes (now handles database selection per-request based on demo mode).
// Q36 (found 2026-07-17 investigating Q9): this had no auth gate at all — unlike
// members/checkins/events, achievement/streak data reveals attendance patterns,
// the same PII class the F1/AC-4 fixes closed elsewhere. requireSession
// (readsOnly, unconditional) matches the members mount's treatment.
app.use('/api/achievements', apiRateLimiter, requireSession({ readsOnly: true }), createAchievementRoutes());
app.use('/api/agent-sessions', apiRateLimiter, requireFeature('aiEnabled'), agentCheckRouter);

// Socket.io connection handling with room-based isolation
io.on('connection', (socket: SocketWithStation) => {
  logger.info('WebSocket client connected', { socketId: socket.id });

  // AAR Studio collaborative session notes (ephemeral room relay).
  registerAarCollabHandlers(io, socket);

  // Station room join/leave + check-in/activity/member/event broadcast relay
  // (review F7 — join-station now requires the same credential model the
  // equivalent REST reads use; see services/stationSocketHandlers.ts).
  registerStationSocketHandlers(io, socket);
});

// Serve frontend for all other GET routes (SPA fallback) - Must be last!
// Exclude /assets/* (frontend static assets), /aar/* (the AAR Studio sub-app,
// served above), and /ws/* (WebSocket upgrade handler) so they don't get the React index.html.
app.get(/^\/(?!api|assets|aar|ws).*/, spaRateLimiter, (req, res) => {
  // The SPA shell must never be cached hard — a stale index.html would point
  // at purged hashed assets after the next deploy.
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: err.stack,
    requestId: req.id,
    method: req.method,
    path: req.path,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Track database initialization status
let databaseInitialized = false;
let databaseInitializing = true;
let databaseError: string | null = null;

// Initialize database and start server
async function startServer() {
  try {
    logger.info('Starting server...');
    
    // Start HTTP server FIRST (before database initialization)
    // This ensures Azure health checks pass immediately
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Database initialization will continue in background...');
    });
    
    // Initialize database connections in background (non-blocking)
    // This allows the server to respond to health checks while databases connect
    initializeDatabasesInBackground();
    
    // Load RFS facilities data in background (non-blocking)
    // This allows the server to start immediately even if data loading is slow
    const parser = getRFSFacilitiesParser();
    parser.loadData().catch((error) => {
      logger.error('Background RFS data loading failed', { error });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

/**
 * Initialize databases in background after server starts
 * This prevents blocking the HTTP server startup
 */
async function initializeDatabasesInBackground() {
  try {
    logger.info('Initializing databases in background...');
    
    // Initialize main database
    await ensureDatabase();
    logger.info('Main database initialized');
    
    // Initialize truck checks database
    await ensureTruckChecksDatabase();
    logger.info('Truck checks database initialized');
    
    // Ensure the Organization store and Admin User store are available for
    // self-service signup, regardless of whether a default admin is configured.
    await initializeOrganizationDatabase();
    await initializeOrgAccessDatabase();
    await initializeUsageDatabase();
    await initializeBillingEventDatabase();
    await initializeAarSessionDatabase();
    await initializeVehicleTypeDatabase();
    await initializeApplianceZoneDatabase();
    await initializeApplianceEquipmentDatabase();
    await initializeDeviceDatabase();
    await initializeAgentSessionDatabase();
    ensureAdminUserDatabase();

    // Initialize admin user database with default credentials if configured
    const defaultAdminUsername = process.env.DEFAULT_ADMIN_USERNAME;
    const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    const requireAuth = process.env.REQUIRE_AUTH === 'true';

    if (defaultAdminUsername && defaultAdminPassword) {
      await initializeAdminUserDatabase(defaultAdminUsername, defaultAdminPassword);
      logger.info('✅ Admin user database initialized');
    } else {
      if (requireAuth) {
        logger.error('❌ CONFIGURATION ERROR: REQUIRE_AUTH=true but DEFAULT_ADMIN_USERNAME and DEFAULT_ADMIN_PASSWORD are required!');
        logger.error('   Authentication will fail. Set both DEFAULT_ADMIN_USERNAME and DEFAULT_ADMIN_PASSWORD environment variables to create admin account.');
      } else {
        logger.warn('⚠️  No default admin credentials configured. Set DEFAULT_ADMIN_USERNAME and DEFAULT_ADMIN_PASSWORD to enable authentication.');
      }
    }
    
    // Log authentication status
    logger.info('Authentication status', { 
      requireAuth, 
      jwtConfigured: !!process.env.JWT_SECRET,
      defaultAdminConfigured: !!defaultAdminPassword,
    });
    
    // Log database type
    const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
    const useTableStorage = storageConnectionString && !explicitlyDisabled;
    if (useTableStorage) {
      const suffix = process.env.TABLE_STORAGE_TABLE_SUFFIX ? ` (tables suffixed '${process.env.TABLE_STORAGE_TABLE_SUFFIX}')` : '';
      const prefix = process.env.TABLE_STORAGE_TABLE_PREFIX ? ` (tables prefixed '${process.env.TABLE_STORAGE_TABLE_PREFIX}')` : '';
      logger.info(`Database: Azure Table Storage${prefix || suffix ? ` ${prefix}${suffix}` : ''}`);
    } else {
      logger.info('Database: In-memory (data will be lost on restart)');
    }
    
    // Seed demo station data (for in-memory database or on first startup)
    await seedDemoStationIfNeeded();

    // Seed standard vehicle type templates
    const vehicleTypeDb = getVehicleTypeDb();
    await seedStandardVehicleTypesIfNeeded(vehicleTypeDb);

    // Mark as initialized
    databaseInitialized = true;
    databaseInitializing = false;
    logger.info('✅ All databases initialized successfully');
  } catch (error) {
    databaseInitializing = false;
    databaseError = error instanceof Error ? error.message : String(error);
    logger.error('Failed to initialize databases', { error });
    logger.warn('Server is running but database operations may fail');
  }
}

// Process-level crash handlers (review F3 / MASTER_PLAN Q30) — see
// services/fatalErrorHandler.ts for why these exist and why they exit rather
// than try to keep serving requests.
process.on('uncaughtException', (error) => {
  handleFatalProcessError('uncaughtException', error, flushAppInsights, (code) => process.exit(code));
});

process.on('unhandledRejection', (reason) => {
  handleFatalProcessError('unhandledRejection', reason, flushAppInsights, (code) => process.exit(code));
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  const { flushAppInsights } = await import('./services/appInsights');
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    // Flush any pending Application Insights telemetry
    flushAppInsights(() => {
      process.exit(0);
    });
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  const { flushAppInsights } = await import('./services/appInsights');
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    // Flush any pending Application Insights telemetry
    flushAppInsights(() => {
      process.exit(0);
    });
  });
});

// Start the server
startServer();

export { io };
