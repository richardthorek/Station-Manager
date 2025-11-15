import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import membersRouter from './routes/members';
import activitiesRouter from './routes/activities';
import checkinsRouter from './routes/checkins';
import eventsRouter from './routes/events';
import { db } from './services/database';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend build (for production)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: 'in-memory'
  });
});

// API Routes
app.use('/api/members', membersRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/checkins', checkinsRouter);
app.use('/api/events', eventsRouter);

// Serve frontend for all other routes (SPA fallback)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

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

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
  try {
    // Start HTTP server (using in-memory database, no connection needed)
    httpServer.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Database: In-memory storage`);
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
