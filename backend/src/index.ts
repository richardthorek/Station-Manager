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
import { Server, Socket } from 'socket.io';
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
      // Allow self-hosted scripts and Microsoft Clarity analytics
      scriptSrc: [
        "'self'",
        "https://www.clarity.ms", // Microsoft Clarity analytics (dynamically loads script)
        "https://scripts.clarity.ms", // Microsoft Clarity script files
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
        "https://www.clarity.ms", // Microsoft Clarity analytics endpoint
        "https://fonts.googleapis.com", // Google Fonts CSS (Fetch API)
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

// Extend Socket interface to include station context
interface SocketWithStation extends Socket {
  stationId?: string;
  brigadeId?: string;
}

// Socket.io connection handling with room-based isolation
io.on('connection', (socket: SocketWithStation) => {
  logger.info('WebSocket client connected', { socketId: socket.id });

  // Handle station room joining
  socket.on('join-station', async (data: { stationId: string; brigadeId?: string }) => {
    const { stationId, brigadeId } = data;
    
    // Validate stationId is provided
    if (!stationId) {
      logger.warn('Client attempted to join without stationId', { socketId: socket.id });
      socket.emit('join-error', { message: 'stationId is required' });
      return;
    }
    
    // Leave previous station rooms if any
    if (socket.stationId) {
      socket.leave(`station-${socket.stationId}`);
      if (socket.brigadeId) {
        socket.leave(`brigade-${socket.brigadeId}`);
      }
    }
    
    // Store station context on socket instance
    socket.stationId = stationId;
    socket.brigadeId = brigadeId;
    
    // Join station-specific room
    socket.join(`station-${stationId}`);
    
    // Join brigade-specific room if provided
    if (brigadeId) {
      socket.join(`brigade-${brigadeId}`);
    }
    
    logger.info('Client joined station room', { 
      socketId: socket.id, 
      stationId, 
      brigadeId,
      rooms: Array.from(socket.rooms)
    });
    
    // Acknowledge successful join
    socket.emit('joined-station', { stationId, brigadeId });
  });

  socket.on('disconnect', () => {
    logger.info('WebSocket client disconnected', { 
      socketId: socket.id,
      stationId: socket.stationId,
      brigadeId: socket.brigadeId
    });
  });

  // Handle check-in events - now station-scoped
  socket.on('checkin', (data) => {
    logger.debug('WebSocket event: checkin', { data, stationId: socket.stationId });
    
    // Validate socket has joined a station
    if (!socket.stationId) {
      logger.warn('Socket attempted checkin without joining station', { socketId: socket.id });
      return;
    }
    
    // Broadcast only to same station
    io.to(`station-${socket.stationId}`).emit('checkin-update', data);
  });

  // Handle activity change events - now station-scoped
  socket.on('activity-change', (data) => {
    logger.debug('WebSocket event: activity-change', { data, stationId: socket.stationId });
    
    if (!socket.stationId) {
      logger.warn('Socket attempted activity-change without joining station', { socketId: socket.id });
      return;
    }
    
    // Broadcast only to same station
    io.to(`station-${socket.stationId}`).emit('activity-update', data);
  });

  // Handle member addition - now station-scoped
  socket.on('member-added', (data) => {
    logger.debug('WebSocket event: member-added', { data, stationId: socket.stationId });
    
    if (!socket.stationId) {
      logger.warn('Socket attempted member-added without joining station', { socketId: socket.id });
      return;
    }
    
    // Broadcast only to same station
    io.to(`station-${socket.stationId}`).emit('member-update', data);
  });

  // Handle event creation - now station-scoped
  socket.on('event-created', (data) => {
    logger.debug('WebSocket event: event-created', { data, stationId: socket.stationId });
    
    if (!socket.stationId) {
      logger.warn('Socket attempted event-created without joining station', { socketId: socket.id });
      return;
    }
    
    // Broadcast only to same station
    io.to(`station-${socket.stationId}`).emit('event-update', data);
  });

  // Handle event end - now station-scoped
  socket.on('event-ended', (data) => {
    logger.debug('WebSocket event: event-ended', { data, stationId: socket.stationId });
    
    if (!socket.stationId) {
      logger.warn('Socket attempted event-ended without joining station', { socketId: socket.id });
      return;
    }
    
    // Broadcast only to same station
    io.to(`station-${socket.stationId}`).emit('event-update', data);
  });

  // Handle participant added/removed - now station-scoped
  socket.on('participant-change', (data) => {
    logger.debug('WebSocket event: participant-change', { data, stationId: socket.stationId });
    
    if (!socket.stationId) {
      logger.warn('Socket attempted participant-change without joining station', { socketId: socket.id });
      return;
    }
    
    // Broadcast only to same station
    io.to(`station-${socket.stationId}`).emit('event-update', data);
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
    
    // Start HTTP server first - don't block on RFS data loading
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
