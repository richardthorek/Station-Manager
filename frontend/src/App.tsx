import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { StationProvider } from './contexts/StationContext';
import { ToastProvider } from './contexts/ToastContext';
import { DemoLandingPrompt } from './components/DemoLandingPrompt';
import { LoadingFallback } from './components/LoadingFallback';
import { OfflineIndicator } from './components/OfflineIndicator';
import { InstallPrompt } from './components/InstallPrompt';
import { SkipToContent } from './components/SkipToContent';
import { LiveAnnouncer } from './components/LiveAnnouncer';
import { hasSeenDemoPrompt } from './utils/demoPromptUtils';
import { initDB } from './services/offlineStorage';

// Lazy load all route components for better code splitting
const LandingPage = lazy(() => import('./features/landing/LandingPage').then(m => ({ default: m.LandingPage })));
const SignInPage = lazy(() => import('./features/signin/SignInPage').then(m => ({ default: m.SignInPage })));
const SignInLinkPage = lazy(() => import('./features/signin/SignInLinkPage').then(m => ({ default: m.SignInLinkPage })));
const UserProfilePage = lazy(() => import('./features/profile/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const TruckCheckPage = lazy(() => import('./features/truckcheck/TruckCheckPage').then(m => ({ default: m.TruckCheckPage })));
const CheckWorkflowPage = lazy(() => import('./features/truckcheck/CheckWorkflowPage').then(m => ({ default: m.CheckWorkflowPage })));
const CheckSummaryPage = lazy(() => import('./features/truckcheck/CheckSummaryPage').then(m => ({ default: m.CheckSummaryPage })));
const AdminDashboardPage = lazy(() => import('./features/truckcheck/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const TemplateSelectionPage = lazy(() => import('./features/truckcheck/TemplateSelectionPage').then(m => ({ default: m.TemplateSelectionPage })));
const TemplateEditorPage = lazy(() => import('./features/truckcheck/TemplateEditorPage').then(m => ({ default: m.TemplateEditorPage })));
const ReportsPage = lazy(() => import('./features/reports/ReportsPageEnhanced').then(m => ({ default: m.ReportsPageEnhanced })));
const CrossStationReportsPage = lazy(() => import('./features/reports/CrossStationReportsPage').then(m => ({ default: m.CrossStationReportsPage })));
const StationManagementPage = lazy(() => import('./features/admin/stations/StationManagementPage').then(m => ({ default: m.StationManagementPage })));
const BrigadeAccessPage = lazy(() => import('./features/admin/brigade-access/BrigadeAccessPage').then(m => ({ default: m.BrigadeAccessPage })));

/**
 * AnimatedRoutes component - handles route transitions
 * Separated to allow useLocation hook inside Router context
 */
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/sign-in" element={<SignInLinkPage />} />
        <Route path="/profile/:memberId" element={<UserProfilePage />} />
        <Route path="/truckcheck" element={<TruckCheckPage />} />
        <Route path="/truckcheck/check/:applianceId" element={<CheckWorkflowPage />} />
        <Route path="/truckcheck/summary/:runId" element={<CheckSummaryPage />} />
        <Route path="/truckcheck/admin" element={<AdminDashboardPage />} />
        <Route path="/truckcheck/templates" element={<TemplateSelectionPage />} />
        <Route path="/truckcheck/templates/:applianceId" element={<TemplateEditorPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/cross-station" element={<CrossStationReportsPage />} />
        <Route path="/admin/stations" element={<StationManagementPage />} />
        <Route path="/admin/brigade-access" element={<BrigadeAccessPage />} />
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
    </BrowserRouter>
  );
}

export default App;
