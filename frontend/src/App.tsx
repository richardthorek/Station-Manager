import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { StationProvider } from './contexts/StationContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoadingFallback } from './components/LoadingFallback';
import { OfflineIndicator } from './components/OfflineIndicator';
import { InstallPrompt } from './components/InstallPrompt';
import { SkipToContent } from './components/SkipToContent';
import { LiveAnnouncer } from './components/LiveAnnouncer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { FeatureRoute } from './components/FeatureRoute';
import { TrialBanner } from './components/TrialBanner';
import { initDB } from './services/offlineStorage';

// Lazy load all route components for better code splitting
const LandingPage = lazy(() => import('./features/landing/LandingPage').then(m => ({ default: m.LandingPage })));
const MarketingPage = lazy(() => import('./features/marketing/MarketingPage').then(m => ({ default: m.MarketingPage })));
const SignInPage = lazy(() => import('./features/signin/SignInPage').then(m => ({ default: m.SignInPage })));
const SignInLinkPage = lazy(() => import('./features/signin/SignInLinkPage').then(m => ({ default: m.SignInLinkPage })));
const UserProfilePage = lazy(() => import('./features/profile/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const StationManagementPage = lazy(() => import('./features/admin/stations/StationManagementPage').then(m => ({ default: m.StationManagementPage })));
const BrigadeAccessPage = lazy(() => import('./features/admin/brigade-access/BrigadeAccessPage').then(m => ({ default: m.BrigadeAccessPage })));
const LoginPage = lazy(() => import('./features/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./features/auth/SignupPage').then(m => ({ default: m.SignupPage })));
const OrganizationPage = lazy(() => import('./features/admin/organization/OrganizationPage').then(m => ({ default: m.OrganizationPage })));

// Truck Check routes (v1.1)
const TruckCheckPage = lazy(() => import('./features/truckcheck/TruckCheckPage').then(m => ({ default: m.TruckCheckPage })));
const AdminDashboardPage = lazy(() => import('./features/truckcheck/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const CheckWorkflowPage = lazy(() => import('./features/truckcheck/CheckWorkflowPage').then(m => ({ default: m.CheckWorkflowPage })));
const CheckSummaryPage = lazy(() => import('./features/truckcheck/CheckSummaryPage').then(m => ({ default: m.CheckSummaryPage })));
const TemplateSelectionPage = lazy(() => import('./features/truckcheck/TemplateSelectionPage').then(m => ({ default: m.TemplateSelectionPage })));
const TemplateEditorPage = lazy(() => import('./features/truckcheck/TemplateEditorPage').then(m => ({ default: m.TemplateEditorPage })));
const VehicleTypesPage = lazy(() => import('./features/truckcheck/VehicleTypesPage').then(m => ({ default: m.VehicleTypesPage })));

// Reports routes (v1.1)
const ReportsPageEnhanced = lazy(() => import('./features/reports/ReportsPageEnhanced').then(m => ({ default: m.ReportsPageEnhanced })));
const AdvancedReportsPage = lazy(() => import('./features/reports/AdvancedReportsPage').then(m => ({ default: m.AdvancedReportsPage })));
const CrossStationReportsPage = lazy(() => import('./features/reports/CrossStationReportsPage').then(m => ({ default: m.CrossStationReportsPage })));

/**
 * HomeRoute — decides what the root path shows.
 *
 * Logged-out visitors get the public marketing / pricing page (the Bushie
 * Tools front door). Signed-in users — and anyone in demo mode (?demo=true) —
 * get the app-picker, which is now the post-login home.
 */
function HomeRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const isDemo = new URLSearchParams(useLocation().search).get('demo') === 'true';

  if (isLoading) return <LoadingFallback />;
  if (isAuthenticated || isDemo) return <LandingPage />;
  return <MarketingPage />;
}

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
        <Route path="/" element={<HomeRoute />} />
        <Route path="/apps" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Sign-In — gated by the signInEnabled entitlement (maintenance-only brigades can hide it) */}
        <Route path="/signin" element={<FeatureRoute feature="signInEnabled" title="Sign-in book"><SignInPage /></FeatureRoute>} />
        <Route path="/sign-in" element={<SignInLinkPage />} />
        <Route path="/profile/:memberId" element={<UserProfilePage />} />

        {/* Truck Check (v1.1) — gated by truckCheckEnabled */}
        <Route path="/truckcheck" element={<FeatureRoute feature="truckCheckEnabled" title="Truck check"><TruckCheckPage /></FeatureRoute>} />
        <Route path="/truckcheck/admin" element={<FeatureRoute feature="truckCheckEnabled" title="Truck check"><AdminDashboardPage /></FeatureRoute>} />
        <Route path="/truckcheck/check/:applianceId" element={<FeatureRoute feature="truckCheckEnabled" title="Truck check"><CheckWorkflowPage /></FeatureRoute>} />
        <Route path="/truckcheck/summary/:runId" element={<FeatureRoute feature="truckCheckEnabled" title="Truck check"><CheckSummaryPage /></FeatureRoute>} />
        <Route path="/truckcheck/select" element={<FeatureRoute feature="truckCheckEnabled" title="Truck check"><TemplateSelectionPage /></FeatureRoute>} />
        <Route path="/truckcheck/templates/:applianceId" element={<FeatureRoute feature="truckCheckEnabled" title="Truck check"><TemplateEditorPage /></FeatureRoute>} />
        <Route path="/truckcheck/vehicle-types" element={<FeatureRoute feature="truckCheckEnabled" title="Truck check"><VehicleTypesPage /></FeatureRoute>} />

        {/* Reports (v1.1) — gated by reportsEnabled */}
        <Route path="/reports" element={<FeatureRoute feature="reportsEnabled" title="Reports"><ReportsPageEnhanced /></FeatureRoute>} />
        <Route path="/reports/advanced" element={<FeatureRoute feature="reportsEnabled" title="Reports"><AdvancedReportsPage /></FeatureRoute>} />
        <Route path="/reports/cross-station" element={<FeatureRoute feature="reportsEnabled" title="Reports"><CrossStationReportsPage /></FeatureRoute>} />

        {/* Admin Routes (Protected) */}
        <Route path="/admin/stations" element={<ProtectedRoute><StationManagementPage /></ProtectedRoute>} />
        <Route path="/admin/brigade-access" element={<ProtectedRoute><BrigadeAccessPage /></ProtectedRoute>} />
        <Route path="/admin/organization" element={<ProtectedRoute><OrganizationPage /></ProtectedRoute>} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  useEffect(() => {
    // Initialize IndexedDB for offline storage
    initDB().catch(err => {
      console.error('Failed to initialize offline database:', err);
    });
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <StationProvider>
          <ToastProvider>
            <SkipToContent />
            <LiveAnnouncer />
            <TrialBanner />
            <OfflineIndicator />
            <InstallPrompt />
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
