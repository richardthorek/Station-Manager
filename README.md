# RFS Station Manager

A modern, real-time digital sign-in system for Rural Fire Service (RFS) stations. Track member presence and activities across multiple devices with instant synchronization.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### Core Functionality
- 🔥 **One-Tap Sign-In**: Quick and easy member check-in/out
- 📱 **Multi-Device Support**: Works on kiosks, mobile phones, and via QR codes
- ⚡ **Real-Time Sync**: Changes appear instantly across all connected devices
- 📋 **Activity Tracking**: Monitor what members are working on
- 👥 **Self-Registration**: New members can register themselves
- 🎨 **Modern UI**: Clean, responsive interface following NSW RFS branding

### Technical Highlights
- Built with React + TypeScript for type safety
- Node.js backend with Express and Socket.io
- Real-time WebSocket communication
- Responsive design for all screen sizes
- Optimized for low-bandwidth environments
- NSW RFS brand colors and styling

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/richardthorek/Station-Manager.git
cd Station-Manager

# Install and run backend
cd backend
npm install
cp .env.example .env
npm run dev

# In a new terminal, install and run frontend
cd frontend
npm install
cp .env.example .env
npm run dev
```

Visit `http://localhost:5173` to see the application.

**📖 For detailed setup instructions, see [Getting Started Guide](docs/GETTING_STARTED.md)**

## 📱 Usage

### Sign In
1. Search or scroll to find your name
2. Tap your name to check in
3. See yourself appear in "Currently Signed In"
4. Tap again to undo check-in

### Change Activity
1. Click on an activity button (Training, Maintenance, Meeting)
2. Or create a custom activity
3. All new check-ins will use the selected activity

### Add New Members
1. Click "+ Add New Member"
2. Enter the member's name
3. They'll appear in the member list with a unique QR code

## 📊 Screenshots

### Main Interface
- Activity selector showing current activity
- Member list with search functionality
- Active check-ins display with timestamps

### Features
- Real-time updates across devices
- Visual feedback with animations
- NSW RFS brand styling (red, black, white, lime green)

## 🏗️ Architecture

```
┌─────────────────┐
│  React Frontend │  ← User Interface
│   (TypeScript)  │
└────────┬────────┘
         │ HTTP + WebSocket
┌────────▼────────┐
│  Node.js Backend│  ← API + Real-time
│   (Express +    │
│    Socket.io)   │
└────────┬────────┘
         │
┌────────▼────────┐
│   In-Memory DB  │  ← Data Storage
│ (Future: Azure  │     (Development)
│  Cosmos/Table)  │
└─────────────────┘
```

### Tech Stack

**Frontend:**
- React 18
- TypeScript
- Vite (build tool)
- Socket.io Client
- Framer Motion (animations)

**Backend:**
- Node.js 18+
- Express
- Socket.io (WebSocket)
- TypeScript
- In-memory storage (dev)

## 📚 Documentation

- **[Getting Started Guide](docs/GETTING_STARTED.md)** - Local development setup
- **[Azure Deployment Guide](docs/AZURE_DEPLOYMENT.md)** - Production deployment
- **[API Documentation](docs/API_DOCUMENTATION.md)** - REST API and WebSocket reference
- **[PLAN.md](PLAN.md)** - Comprehensive project plan and requirements

## 🚢 Deployment

### Azure (Recommended)

Deploy to Azure for a production-ready setup:
- Azure App Service (Backend with WebSockets)
- Azure Static Web Apps (Frontend)
- Azure Cosmos DB or Table Storage (Database)

**Estimated cost**: ~$13-15 AUD/month for low-traffic volunteer organization

See [Azure Deployment Guide](docs/AZURE_DEPLOYMENT.md) for detailed instructions.

### Other Options
- Heroku
- Railway
- Vercel (frontend) + Render (backend)
- Self-hosted VPS

## 🎨 Design

### NSW RFS Brand Colors
- **Primary Red**: #E2231A
- **Black**: #000000
- **White**: #FFFFFF
- **Lime Green Accent**: #C6D931

### Typography
- **Font**: Public Sans (Google Fonts)

### UI Principles
- Large touch targets (60px minimum)
- High contrast for visibility
- Subtle animations for feedback
- Responsive across all devices
- Accessibility-focused

## 🛠️ Development

### Project Structure

```
Station-Manager/
├── frontend/           # React application
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── services/   # API services
│   │   └── types/      # TypeScript definitions
│   └── dist/           # Build output
├── backend/            # Node.js server
│   ├── src/
│   │   ├── routes/     # Express routes
│   │   ├── services/   # Business logic
│   │   └── types/      # TypeScript definitions
│   └── dist/           # Build output
└── docs/               # Documentation
```

### Scripts

**Backend:**
```bash
npm run dev     # Development with hot reload
npm run build   # Build TypeScript
npm start       # Run production build
```

**Frontend:**
```bash
npm run dev     # Development server
npm run build   # Production build
npm run preview # Preview production build
```

## 🧪 Testing

Open multiple browser windows to `http://localhost:5173` and test real-time synchronization:
- Check in on one device, see update on others
- Change activity, see it reflected everywhere
- Add a member, appears for all users

## 🔒 Security

- HTTPS required in production
- CORS configuration for frontend
- WebSocket security (WSS in production)
- No sensitive data in QR codes
- Input validation on all endpoints

Future enhancements may include optional authentication for admin functions.

## 📈 Performance

- Page load: < 2 seconds on 3G
- Real-time sync: < 2 seconds
- Check-in response: < 500ms
- Supports 50+ concurrent users

## 🗺️ Roadmap

### Version 1.0 (Current)
- ✅ Digital sign-in system
- ✅ Real-time synchronization
- ✅ Activity tracking
- ✅ Multi-device support
- ✅ Self-registration

### Future Versions
- QR code scanning for quick check-in
- Historical reporting and analytics
- Midnight rollover automation
- Admin dashboard
- Mobile app (PWA enhancement)
- Offline support
- Export data to CSV
- Custom notifications

See [PLAN.md](PLAN.md) for detailed feature planning.

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- NSW Rural Fire Service for design guidelines
- The volunteer RFS community

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/richardthorek/Station-Manager/issues)
- **Documentation**: See `/docs` folder
- **Questions**: Open a discussion on GitHub

## 🎯 Project Status

**Status**: ✅ Version 1.0 Complete - Ready for Local Testing

The first iteration is complete with all core features implemented:
- Frontend with modern, responsive UI
- Backend API with real-time WebSocket support
- Complete documentation
- Ready for local development and testing

Next steps:
1. Local testing and feedback
2. Azure deployment setup
3. Production testing
4. Station rollout

---

**Built with ❤️ for the RFS volunteer community**