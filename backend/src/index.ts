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

// Initialize Azure Application Insights early (before other imports)
// This ensures all subsequent operations can be tracked
import { initializeAppInsights } from './services/appInsights';
initializeAppInsights();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import membersRouter from './routes/members';
import activitiesRouter from './routes/activities';
import checkinsRouter from './routes/checkins';
import eventsRouter from './routes/events';
import truckChecksRouter from './routes/truckChecks';
import reportsRouter from './routes/reports';
import demoRouter from './routes/demo';
import stationsRouter from './routes/stations';
import brigadeAccessRouter from './routes/brigadeAccess';
import exportRouter from './routes/export';
import { createAchievementRoutes } from './routes/achievements';
import { ensureDatabase } from './services/dbFactory';
import { ensureTruckChecksDatabase } from './services/truckChecksDbFactory';
import { getRFSFacilitiesParser } from './services/rfsFacilitiesParser';
import { getVersionInfo } from './services/version';
import { apiRateLimiter, spaRateLimiter } from './middleware/rateLimiter';
import { demoModeMiddleware } from './middleware/demoModeMiddleware';
import { kioskModeMiddleware } from './middleware/kioskModeMiddleware';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLoggingMiddleware } from './middleware/requestLogging';
import { logger } from './services/logger';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
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
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
      imgSrc: ["'self'", "data:", "blob:", "https:"], // Allow data URIs and external images
      connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket connections for Socket.io
      fontSrc: ["'self'", "data:"],
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

// Middleware
app.use(cors());
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
app.use(demoModeMiddleware); // Detect demo mode from query parameter
app.use(kioskModeMiddleware); // Detect and validate kiosk mode from brigade token

// Serve static files from frontend build (for production)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Health check
app.get('/health', async (req, res) => {
  try {
    await ensureDatabase();
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
      error: 'Database connection failed'
    });
  }
});

// Database status endpoint for frontend
app.get('/api/status', apiRateLimiter, async (req, res) => {
  try {
    await ensureDatabase();
    await ensureTruckChecksDatabase();
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

// API Routes with rate limiting
app.use('/api/demo', apiRateLimiter, demoRouter);
app.use('/api/members', apiRateLimiter, membersRouter);
app.use('/api/activities', apiRateLimiter, activitiesRouter);
app.use('/api/checkins', apiRateLimiter, checkinsRouter);
app.use('/api/events', apiRateLimiter, eventsRouter);
app.use('/api/stations', apiRateLimiter, stationsRouter);
app.use('/api/truck-checks', apiRateLimiter, truckChecksRouter);
app.use('/api/reports', apiRateLimiter, reportsRouter);
app.use('/api/brigade-access', apiRateLimiter, brigadeAccessRouter);
app.use('/api/export', apiRateLimiter, exportRouter);

// Achievement routes (now handles database selection per-request based on demo mode)
app.use('/api/achievements', apiRateLimiter, createAchievementRoutes());

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info('WebSocket client connected', { socketId: socket.id });

  socket.on('disconnect', () => {
    logger.info('WebSocket client disconnected', { socketId: socket.id });
  });

  // Handle check-in events
  socket.on('checkin', (data) => {
    logger.debug('WebSocket event: checkin', { data });
    // Broadcast to all other clients
    socket.broadcast.emit('checkin-update', data);
  });

  // Handle activity change events
  socket.on('activity-change', (data) => {
    logger.debug('WebSocket event: activity-change', { data });
    // Broadcast to all clients including sender
    io.emit('activity-update', data);
  });

  // Handle member addition
  socket.on('member-added', (data) => {
    logger.debug('WebSocket event: member-added', { data });
    socket.broadcast.emit('member-update', data);
  });

  // Handle event creation
  socket.on('event-created', (data) => {
    logger.debug('WebSocket event: event-created', { data });
    io.emit('event-update', data);
  });

  // Handle event end
  socket.on('event-ended', (data) => {
    logger.debug('WebSocket event: event-ended', { data });
    io.emit('event-update', data);
  });

  // Handle participant added/removed
  socket.on('participant-change', (data) => {
    logger.debug('WebSocket event: participant-change', { data });
    io.emit('event-update', data);
  });
});

// Serve frontend for all other GET routes (SPA fallback) - Must be last!
app.get(/^\/(?!api).*/, spaRateLimiter, (req, res) => {
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

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connections
    logger.info('Starting server...');
    await ensureDatabase();
    await ensureTruckChecksDatabase();
    
    // Load RFS facilities data
    const parser = getRFSFacilitiesParser();
    await parser.loadData();
    
    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
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
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

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
