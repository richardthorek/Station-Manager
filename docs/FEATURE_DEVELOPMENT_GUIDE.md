# Developer Guide - Adding New Features

This guide explains how to add new features to the RFS Station Manager using the scalable feature-based routing pattern.

## Architecture Overview

The application uses a feature-based architecture where:
- Each major feature is a self-contained module
- Features are accessible via clean root-level routes (e.g., `/signin`, `/truckcheck`)
- The landing page (`/`) serves as a central hub for all features
- Shared components, hooks, and services are available to all features

## Project Structure

```
frontend/src/
├── features/              # Feature modules (main application features)
│   ├── landing/          # Landing page
│   │   ├── LandingPage.tsx
│   │   └── LandingPage.css
│   ├── signin/           # Sign-in feature
│   │   ├── SignInPage.tsx
│   │   └── SignInPage.css
│   └── truckcheck/       # Truck check feature
│       ├── TruckCheckPage.tsx
│       └── TruckCheckPage.css
├── components/           # Shared UI components (reusable)
│   ├── Header.tsx
│   ├── ActivitySelector.tsx
│   └── ...
├── hooks/                # Custom React hooks
├── services/             # API and external services
├── types/                # TypeScript type definitions
├── App.tsx              # Main router configuration
└── main.tsx             # Application entry point
```

## Adding a New Feature

Follow these steps to add a new feature to the application:

### Step 1: Create Feature Directory

Create a new directory under `frontend/src/features/`:

```bash
mkdir -p frontend/src/features/your-feature
```

### Step 2: Create Feature Component

Create the main page component `YourFeaturePage.tsx`:

```typescript
import { Link } from 'react-router-dom';
import './YourFeaturePage.css';

export function YourFeaturePage() {
  return (
    <div className="your-feature-page">
      <header className="your-feature-header">
        <Link to="/" className="back-link">← Back to Home</Link>
        <h1>Your Feature Name</h1>
      </header>

      <main className="your-feature-main">
        {/* Your feature content here */}
      </main>
    </div>
  );
}
```

### Step 3: Create Feature Styles

Create `YourFeaturePage.css` with NSW RFS branding:

```css
.your-feature-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
  color: #ffffff;
}

.your-feature-header {
  background: #E2231A;  /* NSW RFS Red */
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.back-link {
  display: inline-block;
  color: #ffffff;
  text-decoration: none;
  margin-bottom: 1rem;
}

.your-feature-header h1 {
  font-size: 2.5rem;
  margin: 0;
  color: #ffffff;
}

.your-feature-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}
```

### Step 4: Register the Route

Update `frontend/src/App.tsx` to add your route:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './features/landing/LandingPage';
import { SignInPage } from './features/signin/SignInPage';
import { TruckCheckPage } from './features/truckcheck/TruckCheckPage';
import { YourFeaturePage } from './features/your-feature/YourFeaturePage';  // Add import

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/truckcheck" element={<TruckCheckPage />} />
        <Route path="/your-feature" element={<YourFeaturePage />} />  {/* Add route */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### Step 5: Add to Landing Page

Update `frontend/src/features/landing/LandingPage.tsx` to add a feature card:

```typescript
<div className="feature-card">
  <div className="feature-icon">🎯</div>
  <h3>Your Feature Name</h3>
  <p>Brief description of what this feature does.</p>
  <Link to="/your-feature" className="feature-link">
    Go to Feature
    <span className="arrow">→</span>
  </Link>
</div>
```

For placeholder/coming soon features, use:

```typescript
<div className="feature-card feature-card-disabled">
  <div className="feature-icon">🎯</div>
  <h3>Your Feature Name</h3>
  <p>Brief description of what this feature does.</p>
  <div className="feature-link feature-link-disabled">
    Coming Soon
    <span className="badge">Future</span>
  </div>
</div>
```

## Design Standards

### NSW RFS Branding

Always use the official NSW RFS brand colors:

- **Primary Red**: `#E2231A`
- **Black**: `#000000`
- **White**: `#FFFFFF`
- **Lime Green Accent**: `#C6D931`

### Typography

- **Font**: Public Sans (Google Fonts)
- Use clear hierarchy with appropriate heading levels
- Maintain readability with proper contrast

### UI Principles

- **Large Touch Targets**: Minimum 60px for interactive elements (kiosk-friendly)
- **High Contrast**: Ensure visibility in various lighting conditions
- **Responsive Design**: Mobile-first, works on all screen sizes
- **Accessibility**: Semantic HTML, proper ARIA labels
- **Consistent Spacing**: Use rem units for spacing
- **Subtle Animations**: Provide feedback without distraction

## API Integration

### Using the API Service

Import and use the centralized API service:

```typescript
import { api } from '../../services/api';

// Example: Fetch data
const data = await api.getMembers();

// Example: Post data
const result = await api.createMember(name);
```

### Real-Time Updates with Socket.io

Use the `useSocket` hook for real-time functionality:

```typescript
import { useSocket } from '../../hooks/useSocket';

function MyComponent() {
  const { isConnected, emit, on, off } = useSocket();

  useEffect(() => {
    const handleUpdate = (data) => {
      // Handle real-time update
    };

    on('my-event', handleUpdate);
    return () => off('my-event', handleUpdate);
  }, [on, off]);

  const sendUpdate = () => {
    emit('my-event', data);
  };
}
```

## Backend Integration

If your feature requires backend endpoints:

### 1. Define Types

Add types in `backend/src/types/index.ts`:

```typescript
export interface YourType {
  id: string;
  name: string;
  createdAt: Date;
}
```

### 2. Add Database Methods

Update `backend/src/services/database.ts`:

```typescript
// Add CRUD methods for your feature
getYourData(): YourType[] {
  // Implementation
}

createYourData(data: YourType): YourType {
  // Implementation
}
```

### 3. Create Routes

Create `backend/src/routes/your-feature.ts`:

```typescript
import { Router } from 'express';
import { db } from '../services/database';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = db.getYourData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

export default router;
```

### 4. Register Routes

Update `backend/src/index.ts`:

```typescript
import yourFeatureRouter from './routes/your-feature';

app.use('/api/your-feature', yourFeatureRouter);
```

## Testing Your Feature

### Manual Testing

1. Start the backend: `cd backend && npm run dev`
2. Start the frontend: `cd frontend && npm run dev`
3. Navigate to `http://localhost:5173`
4. Test navigation to your feature via landing page
5. Test all interactive elements
6. Test on different screen sizes

### Build Testing

```bash
# Test production build
cd frontend
npm run build
npm run preview
```

## Best Practices

### Code Organization

- Keep features self-contained and independent
- Share common components via the `components/` directory
- Use TypeScript for type safety
- Follow existing naming conventions

### Component Design

- Create small, focused components
- Use functional components with hooks
- Implement proper error handling
- Add loading states for async operations

### Performance

- Lazy load heavy components if needed
- Optimize images and assets
- Minimize re-renders with `useMemo` and `useCallback`
- Keep bundle size in check

### Accessibility

- Use semantic HTML elements
- Add proper ARIA labels
- Ensure keyboard navigation works
- Test with screen readers if possible

## Common Patterns

### Page Layout Template

Most feature pages follow this structure:

```typescript
export function YourFeaturePage() {
  return (
    <div className="page-container">
      {/* Header with navigation */}
      <header className="page-header">
        <Link to="/" className="back-link">← Back</Link>
        <h1>Page Title</h1>
      </header>

      {/* Main content area */}
      <main className="page-main">
        <div className="content-wrapper">
          {/* Your content */}
        </div>
      </main>

      {/* Optional footer */}
      <footer className="page-footer">
        {/* Footer content */}
      </footer>
    </div>
  );
}
```

### Error Handling Pattern

```typescript
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getData();
      // Process data
    } catch (err) {
      setError('Failed to load data');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  loadData();
}, []);
```

## Deployment Considerations

- Features are bundled together in production
- Routes are handled client-side (SPA)
- Ensure environment variables are set correctly
- Test routing in production build

## Getting Help

- Review existing features for examples
- Check the main README.md for general information
- Refer to API documentation in `docs/API_DOCUMENTATION.md`
- Follow the deployment guide in `docs/AZURE_DEPLOYMENT.md`

## Summary

The feature-based routing pattern provides:
- **Scalability**: Easy to add new features
- **Maintainability**: Features are self-contained
- **User Experience**: Clean URLs and intuitive navigation
- **Developer Experience**: Clear structure and conventions

Follow this guide to maintain consistency and quality across all features!
