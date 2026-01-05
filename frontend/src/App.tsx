import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './features/landing/LandingPage';
import { SignInPage } from './features/signin/SignInPage';
import { SignInLinkPage } from './features/signin/SignInLinkPage';
import { UserProfilePage } from './features/profile/UserProfilePage';
import { TruckCheckPage } from './features/truckcheck/TruckCheckPage';
import { CheckWorkflowPage } from './features/truckcheck/CheckWorkflowPage';
import { CheckSummaryPage } from './features/truckcheck/CheckSummaryPage';
import { AdminDashboardPage } from './features/truckcheck/AdminDashboardPage';
import { TemplateSelectionPage } from './features/truckcheck/TemplateSelectionPage';
import { TemplateEditorPage } from './features/truckcheck/TemplateEditorPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { DemoModeBanner } from './components/DemoModeBanner';
import { useDemoMode } from './hooks/useDemoMode';

function App() {
  const { isDemoMode, bannerDismissed, dismissBanner } = useDemoMode();

  return (
    <BrowserRouter>
      {isDemoMode && !bannerDismissed && (
        <DemoModeBanner onDismiss={dismissBanner} />
      )}
      <Routes>
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
