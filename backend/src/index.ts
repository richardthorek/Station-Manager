import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import membersRouter from './routes/members';
import activitiesRouter from './routes/activities';
import checkinsRouter from './routes/checkins';

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/members', membersRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/checkins', checkinsRouter);

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
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export { io };
