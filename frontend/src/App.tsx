import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { StationProvider } from './contexts/StationContext';
import { DemoLandingPrompt } from './components/DemoLandingPrompt';
import { hasSeenDemoPrompt } from './utils/demoPromptUtils';
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
import { CrossStationReportsPage } from './features/reports/CrossStationReportsPage';
import { StationManagementPage } from './features/admin/stations/StationManagementPage';

function App() {
  const [showDemoPrompt, setShowDemoPrompt] = useState(false);

  useEffect(() => {
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
        {showDemoPrompt && (
          <DemoLandingPrompt onDismiss={() => setShowDemoPrompt(false)} />
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
          <Route path="/reports/cross-station" element={<CrossStationReportsPage />} />
          <Route path="/admin/stations" element={<StationManagementPage />} />
        </Routes>
      </StationProvider>
    </BrowserRouter>
  );
}

export default App;
