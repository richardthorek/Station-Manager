# Getting Started - RFS Station Manager

This guide will help you set up and run the RFS Station Manager application locally for development and testing.

## Prerequisites

- **Node.js**: Version 18 or higher ([Download](https://nodejs.org/))
- **npm**: Comes with Node.js
- **Git**: For version control
- A code editor (VS Code recommended)

## Project Structure

```
Station-Manager/
├── frontend/          # React + TypeScript frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API services
│   │   ├── types/        # TypeScript types
│   │   └── App.tsx       # Main app component
│   └── package.json
├── backend/           # Node.js + Express backend
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── types/        # TypeScript types
│   │   └── index.ts      # Server entry point
│   └── package.json
├── docs/             # Documentation
└── PLAN.md          # Project plan
```

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/richardthorek/Station-Manager.git
cd Station-Manager
```

### 2. Set Up the Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file to configure authentication (optional for development)
# For development, authentication is disabled by default
# To enable authentication, uncomment and set these variables in .env:
#   REQUIRE_AUTH=true
#   DEFAULT_ADMIN_USERNAME=admin
#   DEFAULT_ADMIN_PASSWORD=YourSecurePassword123

# Start the development server
npm run dev
```

The backend server will start on `http://localhost:3000`

**Authentication Note**: By default, authentication is disabled in development. If you want to test the authentication system:
1. Set `REQUIRE_AUTH=true` in `backend/.env`
2. Set `DEFAULT_ADMIN_PASSWORD=YourSecurePassword123` in `backend/.env`
3. Restart the backend server
4. Login at `http://localhost:5173/login` with username `admin` and your configured password

### 3. Set Up the Frontend

Open a new terminal window:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:5173`

### 4. Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

You should see the RFS Station Manager interface with:
- Current activity selection
- Member sign-in list
- Active check-ins display

## Development Workflow

### Backend Development

```bash
cd backend

# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

**Backend runs on**: `http://localhost:3000`

**API Endpoints**:
- `GET /health` - Health check
- `GET /api/members` - Get all members
- `POST /api/members` - Create new member
- `GET /api/activities` - Get all activities
- `GET /api/activities/active` - Get active activity
- `POST /api/activities/active` - Set active activity
- `POST /api/activities` - Create custom activity
- `GET /api/checkins/active` - Get active check-ins
- `POST /api/checkins` - Check in/out a member
- `DELETE /api/checkins/:memberId` - Undo check-in

### Frontend Development

```bash
cd frontend

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

**Frontend runs on**: `http://localhost:5173`

### Real-Time Features

The application uses WebSockets (Socket.io) for real-time synchronization:
- Check-ins update across all connected devices
- Activity changes propagate immediately
- New members appear instantly

## Features

### Current Activity Selection
- Select from default activities (Training, Maintenance, Meeting)
- Create custom activities
- Changes sync across all devices in real-time

### Member Sign-In
- Quick search to find members
- One-tap check-in
- Visual feedback with animations
- Checked-in members highlighted in green

### Active Check-Ins Display
- See who's currently signed in
- View check-in time and activity
- One-tap undo for corrections
- Shows check-in method (kiosk, mobile, QR)

### Self-Registration
- New members can add themselves
- Generates unique QR code for each member
- Persistent across sessions

## Testing the Application

### Test with Multiple Devices

1. Start both backend and frontend
2. Open `http://localhost:5173` in multiple browser windows/tabs
3. Perform actions in one window
4. Observe real-time updates in other windows

### Sample Data

The application comes pre-loaded with:
- **8 sample members** for testing
- **3 default activities**: Training, Maintenance, Meeting
- Training is set as the default active activity

### Test Scenarios

1. **Basic Check-In**:
   - Click on a member name
   - See them appear in "Currently Signed In"
   - Check appears in all open windows

2. **Undo Check-In**:
   - Click on a checked-in member again, OR
   - Click the undo button (↩️) in the active check-ins list

3. **Change Activity**:
   - Select a different activity
   - See it update in all windows
   - New check-ins use the new activity

4. **Add Custom Activity**:
   - Click "+ Add Custom Activity"
   - Enter activity name
   - Use it for check-ins

5. **Add New Member**:
   - Click "+ Add New Member"
   - Enter member name
   - Member appears for all users

## Configuration

### Backend Configuration (.env)

```env
PORT=3000
FRONTEND_URL=http://localhost:5173
```

### Frontend Configuration (.env)

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

## Troubleshooting

### Port Already in Use

If you see "Port 3000 is already in use":

```bash
# Find and kill the process using port 3000
# On macOS/Linux:
lsof -ti:3000 | xargs kill -9

# On Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### WebSocket Connection Failed

1. Verify backend is running
2. Check CORS settings in backend
3. Verify `VITE_SOCKET_URL` in frontend .env

### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Browser Compatibility

The application works on:
- Chrome/Edge (latest 2 versions)
- Safari (latest 2 versions)
- Firefox (latest 2 versions)
- iOS Safari 13+
- Android Chrome 80+

## Mobile Testing

To test on mobile devices on the same network:

1. Find your computer's local IP address:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```

2. Update frontend .env:
   ```env
   VITE_API_URL=http://YOUR_IP:3000/api
   VITE_SOCKET_URL=http://YOUR_IP:3000
   ```

3. Start both servers:
   ```bash
   cd backend && npm run dev
   cd frontend && npm run dev -- --host
   ```

4. Access from mobile:
   ```
   http://YOUR_IP:5173
   ```

## Performance Tips

- The app supports 50+ concurrent users
- Check-in actions respond in < 500ms
- Real-time updates sync in < 2 seconds
- Works on 3G connections

## Next Steps

- Review [PLAN.md](../PLAN.md) for feature roadmap
- See [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md) for production deployment
- Check [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for API details

## Support

For issues or questions:
1. Check this documentation
2. Review the PLAN.md for design decisions
3. Open an issue on GitHub
