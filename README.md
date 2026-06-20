# RFS Station Manager (MVP Launch)

A modern, real-time digital sign-in system for Rural Fire Service (RFS) stations. Track member presence and activities across multiple devices with instant synchronization.

> **Brand:** Station Manager is delivered as part of **Bushie Tools** — the customer-facing suite name for the family of approachable tools (Station Manager, AAR Studio, and more) built *for the average bushie*. The logged-out marketing site and the post-login app picker carry the Bushie Tools identity; "Station Manager" remains the name of this app within the suite.

![Version](https://img.shields.io/badge/version-1.0--MVP-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 MVP Launch - Sign-In Only

**This is the MVP (Minimum Viable Product) launch** focused exclusively on the core sign-in functionality. Additional features will be rolled out in version 1.1 and beyond.

### Available Now (v1.0 MVP)
- ✅ **Member Sign-In System**: Quick and easy check-in/out with activity tracking
- ✅ **Real-Time Sync**: Changes appear instantly across all connected devices
- ✅ **Event Management**: Create and manage events with participant tracking
- ✅ **Multi-Device Support**: Works on kiosks, tablets, mobile phones
- ✅ **QR Code Sign-In**: Personal sign-in links and QR codes for each member
- ✅ **Admin Portal**: Station management and brigade access control (authenticated)

### Coming in v1.1
- 🚧 **Truck Check**: Vehicle maintenance tracking and inspection checklists
- 🚧 **Reports & Analytics**: Historical reporting and data export capabilities

## ✨ Features

### Core Functionality
- 🔥 **One-Tap Sign-In**: Quick and easy member check-in/out
- 📱 **Multi-Device Support**: Works on kiosks, mobile phones, and via QR codes
- ⚡ **Real-Time Sync**: Changes appear instantly across all connected devices
- 📋 **Activity Tracking**: Monitor what members are working on
- 👥 **Self-Registration**: New members can register themselves
- 🎨 **Modern UI**: Clean, responsive interface following emergency services branding

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

Visit `http://localhost:5173` to see the application landing page.

**📖 For detailed setup instructions, see [Getting Started Guide](docs/GETTING_STARTED.md)**

## 🗺️ Application Routes

The application uses a feature-based routing structure for scalability:

- **`/`** - Landing page with overview of available features
- **`/signin`** - Station member sign-in system (✅ MVP feature)
- **`/profile/:memberId`** - Member profile with QR code and stats (✅ MVP feature)
- **`/admin/stations`** - Station management (✅ MVP feature, requires authentication)
- **`/admin/brigade-access`** - Brigade access token management (✅ MVP feature, requires authentication)
- **`/truckcheck`** - Vehicle maintenance tracking (🚧 Coming in v1.1)
- **`/reports`** - Reports and analytics (🚧 Coming in v1.1)

Additional features can be easily added as new routes following this pattern.

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

## 📊 Screenshots (MVP Features)

Comprehensive UI screenshots for MVP features have been captured at iPad resolution (landscape & portrait). See the full UI review with screenshots:

**📸 [View Complete UI Review](docs/current_state/UI_REVIEW_20260207.md)**

### Key Screenshots (MVP)
- **Landing Page**: Main dashboard with feature navigation (✅ MVP)
- **Sign-In System**: Member check-in/out with real-time updates (✅ MVP)
- **Admin Pages**: Station management and brigade access control (✅ MVP)

### Coming in v1.1
- **Truck Checks**: Vehicle maintenance tracking interface (🚧 Coming soon)
- **Reports & Analytics**: Dashboard with charts and metrics (🚧 Coming soon)

All screenshots demonstrate:
- ✅ Responsive design (iPad landscape 1024×768 & portrait 768×1024)
- ✅ NSW RFS brand styling (red #e5281B, lime #cbdb2a)
- ✅ Touch-friendly interfaces (60px+ touch targets)
- ✅ WCAG 2.1 Level AA accessibility compliance
- ✅ Real-time updates and visual feedback

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
│ Azure Table     │  ← Data Storage
│ Storage         │    (Production)
└─────────────────┘
```

### Tech Stack

**Frontend:**
- React 19
- TypeScript
- Vite (build tool)
- Socket.io Client
- Framer Motion (animations)

**Backend:**
- Node.js 22
- Express 5
- Socket.io (WebSocket)
- TypeScript
- Azure Table Storage (production)
- In-memory storage (dev)

## 📚 Documentation

- **[Getting Started Guide](docs/GETTING_STARTED.md)** - Local development setup
- **[Azure Deployment Guide](docs/AZURE_DEPLOYMENT.md)** - Production deployment to Azure
- **[API Documentation](docs/API_DOCUMENTATION.md)** - REST API and WebSocket reference
- **[Truck Checks Guide](docs/archive/TRUCK_CHECKS_IMPLEMENTATION.md)** - Vehicle inspection feature documentation (archived)
- **[Storage Migration History](docs/archive/TABLE_STORAGE_MIGRATION_PLAN.md)** - Migration from Cosmos DB to Table Storage (completed, archived)
- **[Storage Decision](docs/archive/FINAL_STORAGE_DECISION.md)** - Decision rationale: Azure Table Storage (archived)
- **[Project Plan](docs/archive/PROJECT_PLAN.md)** - Original project requirements and planning (historical, archived)

## 🚢 Deployment

### Azure Deployment

Deploy to Azure for a production-ready setup:

- **Frontend:** Azure Static Web Apps (Free tier)
- **Backend:** Azure App Service B1 tier (~$13 AUD/month) - e.g., `bungrfsstation`
- **Database:** Azure Cosmos DB (Document DB) with MongoDB API (Free tier available)
- **Real-time:** Socket.io with native WebSocket support

**Estimated cost:** ~$13-25 AUD/month for a volunteer organization

> **Note:** Azure Cosmos DB with MongoDB API is also known as Azure Document DB. They are the same service.

See [Azure Deployment Guide](docs/AZURE_DEPLOYMENT.md) for step-by-step instructions.

### Other Options

- Heroku
- Railway
- Any Node.js hosting platform with WebSocket support

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
│   │   ├── features/   # Feature-based modules
│   │   │   ├── landing/      # Landing page (/)
│   │   │   ├── signin/       # Sign-in feature (/signin)
│   │   │   └── truckcheck/   # Truck check (placeholder)
│   │   ├── components/ # Shared UI components
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

### Feature-Based Routing

The application follows a scalable feature-based routing pattern:

1. **Landing Page (`/`)**: Central hub displaying all available features
2. **Feature Routes (`/feature-name`)**: Each major feature has its own route
3. **Feature Modules**: Self-contained feature directories with components and styles

**Adding a New Feature:**
1. Create a new directory in `frontend/src/features/your-feature`
2. Add `YourFeaturePage.tsx` and `YourFeaturePage.css`
3. Register the route in `App.tsx`
4. Add a feature card to the landing page

### Scripts

**Development with Sample Data (In-Memory Database):**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

**Development with Production Database:**
```bash
# Terminal 1 - Backend
cd backend
npm run dev:prod

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Backend:**
```bash
npm run dev       # Development with sample data (in-memory)
npm run dev:prod  # Development with production database
npm run build     # Build TypeScript
npm start         # Run production build
```

**Frontend:**
```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage report
```

**Backend:**
```bash
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## 🧪 Testing

### Automated Tests

The application includes comprehensive automated test coverage:

**Frontend Tests (Vitest + React Testing Library):**
- 80+ tests covering components, hooks, and pages
- 93%+ code coverage (statements, branches, functions)
- Tests for:
  - Core components (ActivitySelector, MemberList, ActiveCheckIns, Header, EventCard)
  - Feature pages (LandingPage)
  - Custom hooks (useSocket, useTheme)
  - User interactions and state management

**Backend Tests (Jest + Supertest):**
- 45+ integration tests covering all API endpoints
- Tests for members, activities, check-ins, events, truck checks, and achievements
- In-memory database for fast, isolated tests

**Running Tests:**
```bash
# Frontend
cd frontend
npm test              # Run all tests once
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage report

# Backend
cd backend
npm test              # Run all tests once
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage report
```

**CI/CD Testing:**
- All tests run automatically in GitHub Actions on every PR
- Frontend and backend tests run in parallel
- Build only proceeds if all tests pass
- Coverage reports uploaded as artifacts

### Manual Testing

Open multiple browser windows to `http://localhost:5173` and test real-time synchronization:
- Check in on one device, see update on others
- Change activity, see it reflected everywhere
- Add a member, appears for all users

## 🔒 Security

The Station Manager implements multiple layers of security protection:

### Security Headers (Helmet)
- **Content-Security-Policy (CSP)**: Protects against XSS and injection attacks
  - Restricts resource loading to same-origin by default
  - Allows WebSocket connections for real-time features
  - Permits inline styles required by React
- **X-Frame-Options: DENY**: Prevents clickjacking attacks
- **X-Content-Type-Options: nosniff**: Prevents MIME type sniffing
- **Referrer-Policy**: Privacy-focused referrer control
- **Permissions-Policy**: Blocks camera, microphone, geolocation, payment APIs
- **HSTS**: Enforces HTTPS in production (1 year max-age)
- **X-Powered-By**: Hidden to avoid revealing server technology

### Network Security
- **HTTPS Required**: All production traffic uses HTTPS
- **WSS (WebSocket Secure)**: Encrypted WebSocket connections in production
- **CORS Configuration**: Restricted to specific frontend URL
- **Trust Proxy**: Configured for Azure App Service

### Input Security
- **Input Validation**: express-validator on all POST/PUT/DELETE endpoints
- **XSS Protection**: HTML entity escaping for user input
- **Type & Length Validation**: Enforced on all fields
- **Pattern Validation**: Name fields restricted to safe characters
- **Whitespace Trimming**: Automatic sanitization

### Rate Limiting
- **API Routes**: ≈1,000 requests per hour per IP (≈84 per 5-minute window so usage resets every 5 minutes)
- **Auth Routes**: 5 requests per 15 minutes per IP (reserved for future)
- **SPA Fallback**: ≈1,000 requests per hour per IP (aligned with the API limiter)
- **Standard Headers**: RateLimit-* headers for client feedback

### Data Protection
- **No Sensitive Data**: QR codes contain only member IDs
- **Environment Variables**: Secrets not committed to version control
- **Azure Key Vault**: For production secrets (recommended)

### Testing
- **27 Security Header Tests**: Comprehensive validation of all headers
- **25 Input Validation Tests**: Coverage of all validation rules
- **100% Test Pass Rate**: All security tests passing

For detailed security configuration, see [Security & Authentication](docs/AS_BUILT.md#security--authentication) in the as-built documentation.

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
