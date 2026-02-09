import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { StationProvider } from './contexts/StationContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { DemoLandingPrompt } from './components/DemoLandingPrompt';
import { LoadingFallback } from './components/LoadingFallback';
import { OfflineIndicator } from './components/OfflineIndicator';
import { InstallPrompt } from './components/InstallPrompt';
import { SkipToContent } from './components/SkipToContent';
import { LiveAnnouncer } from './components/LiveAnnouncer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ComingSoonPage } from './components/ComingSoonPage';
import { hasSeenDemoPrompt } from './utils/demoPromptUtils';
import { initDB } from './services/offlineStorage';

// Lazy load all route components for better code splitting
const LandingPage = lazy(() => import('./features/landing/LandingPage').then(m => ({ default: m.LandingPage })));
const SignInPage = lazy(() => import('./features/signin/SignInPage').then(m => ({ default: m.SignInPage })));
const SignInLinkPage = lazy(() => import('./features/signin/SignInLinkPage').then(m => ({ default: m.SignInLinkPage })));
const UserProfilePage = lazy(() => import('./features/profile/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const StationManagementPage = lazy(() => import('./features/admin/stations/StationManagementPage').then(m => ({ default: m.StationManagementPage })));
const BrigadeAccessPage = lazy(() => import('./features/admin/brigade-access/BrigadeAccessPage').then(m => ({ default: m.BrigadeAccessPage })));
const LoginPage = lazy(() => import('./features/auth/LoginPage').then(m => ({ default: m.LoginPage })));

/**
 * AnimatedRoutes component - handles route transitions
 * Separated to allow useLocation hook inside Router context
 */
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {/* Landing & Auth */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Sign-In (MVP Feature - Fully Enabled) */}
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/sign-in" element={<SignInLinkPage />} />
        <Route path="/profile/:memberId" element={<UserProfilePage />} />
        
        {/* Truck Check (Coming in v1.1) */}
        <Route 
          path="/truckcheck" 
          element={
            <ComingSoonPage 
              featureName="Truck Check" 
              description="Vehicle maintenance tracking and inspection checklist system is currently under development."
              estimatedRelease="Version 1.1"
            />
          } 
        />
        <Route path="/truckcheck/*" element={<Navigate to="/truckcheck" replace />} />
        
        {/* Reports (Coming in v1.1) */}
        <Route 
          path="/reports" 
          element={
            <ComingSoonPage 
              featureName="Reports & Analytics" 
              description="Historical reporting, analytics, and data export capabilities are currently under development."
              estimatedRelease="Version 1.1"
            />
          } 
        />
        <Route path="/reports/*" element={<Navigate to="/reports" replace />} />
        
        {/* Admin Routes (Protected) */}
        <Route path="/admin/stations" element={<ProtectedRoute><StationManagementPage /></ProtectedRoute>} />
        <Route path="/admin/brigade-access" element={<ProtectedRoute><BrigadeAccessPage /></ProtectedRoute>} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  const [showDemoPrompt, setShowDemoPrompt] = useState(false);

  useEffect(() => {
    // Initialize IndexedDB for offline storage
    initDB().catch(err => {
      console.error('Failed to initialize offline database:', err);
    });

    // Show demo prompt on first visit
    if (!hasSeenDemoPrompt()) {
      // Small delay for better UX
      setTimeout(() => {
        setShowDemoPrompt(true);
      }, 500);
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <StationProvider>
          <ToastProvider>
            <SkipToContent />
            <LiveAnnouncer />
            <OfflineIndicator />
            <InstallPrompt />
            {showDemoPrompt && (
              <DemoLandingPrompt onDismiss={() => setShowDemoPrompt(false)} />
            )}
            <Suspense fallback={<LoadingFallback />}>
              <AnimatedRoutes />
            </Suspense>
          </ToastProvider>
        </StationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
