import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import membersRouter from './routes/members';
import activitiesRouter from './routes/activities';
import checkinsRouter from './routes/checkins';
import eventsRouter from './routes/events';
import truckChecksRouter from './routes/truckChecks';
import { ensureDatabase } from './services/dbFactory';
import { ensureTruckChecksDatabase } from './services/truckChecksDbFactory';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Rate limiter for SPA fallback route (serving index.html)
const spaRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend build (for production)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Health check
app.get('/health', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const dbType = process.env.MONGODB_URI ? 'mongodb' : 'in-memory';
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: dbType,
      environment: process.env.NODE_ENV || 'development'
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
app.get('/api/status', async (req, res) => {
  try {
    await ensureDatabase();
    await ensureTruckChecksDatabase();
    const dbType = process.env.MONGODB_URI ? 'mongodb' : 'in-memory';
    const isProduction = process.env.NODE_ENV === 'production';
    const usingInMemory = dbType === 'in-memory';
    
    res.json({ 
      status: 'ok',
      databaseType: dbType,
      isProduction,
      usingInMemory,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to check database status'
    });
  }
});

// API Routes
app.use('/api/members', membersRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/checkins', checkinsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/truck-checks', truckChecksRouter);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Handle check-in events
  socket.on('checkin', (data) => {
    // Broadcast to all other clients
    socket.broadcast.emit('checkin-update', data);
  });

  // Handle activity change events
  socket.on('activity-change', (data) => {
    // Broadcast to all clients including sender
    io.emit('activity-update', data);
  });

  // Handle member addition
  socket.on('member-added', (data) => {
    socket.broadcast.emit('member-update', data);
  });

  // Handle event creation
  socket.on('event-created', (data) => {
    io.emit('event-update', data);
  });

  // Handle event end
  socket.on('event-ended', (data) => {
    io.emit('event-update', data);
  });

  // Handle participant added/removed
  socket.on('participant-change', (data) => {
    io.emit('event-update', data);
  });
});

// Serve frontend for all other GET routes (SPA fallback) - Must be last!
app.get(/^\/(?!api).*/, spaRateLimiter, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connections
    console.log('🚀 Starting server...');
    await ensureDatabase();
    await ensureTruckChecksDatabase();
    
    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      if (process.env.MONGODB_URI) {
        console.log(`Database: MongoDB/Cosmos DB (persistent)`);
      } else {
        console.log(`Database: In-memory (data will be lost on restart)`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(async () => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  httpServer.close(async () => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Start the server
startServer();

export { io };
