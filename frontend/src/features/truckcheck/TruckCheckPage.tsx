/**
 * Truck Check Landing Page
 * 
 * Hub for vehicle inspection workflows.
 * 
 * Features:
 * - View all appliances (fire trucks, bulk water carriers, command vehicles)
 * - Start new vehicle inspections
 * - View active check runs
 * - Join collaborative inspections
 * - Access admin dashboard
 * - Manage vehicles and checklists
 * 
 * Supports collaborative checking where multiple members can work on the same vehicle.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { PageTransition } from '../../components/PageTransition';
import { api } from '../../services/api';
import type { Appliance, CheckRun } from '../../types';
import './TruckCheckPage.css';

export function TruckCheckPage() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [activeChecks, setActiveChecks] = useState<Map<string, CheckRun>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAppliances();
  }, []);

  async function loadAppliances() {
    try {
      setLoading(true);
      const [appliancesData, checkRunsData] = await Promise.all([
        api.getAppliances(),
        api.getCheckRuns()
      ]);
      // Defensive checks: ensure data is an array
      setAppliances(Array.isArray(appliancesData) ? appliancesData : []);
      
      // Map active checks by appliance ID
      const activeMap = new Map<string, CheckRun>();
      const checkRuns = Array.isArray(checkRunsData) ? checkRunsData : [];
      checkRuns
        .filter((run: CheckRun) => run.status === 'in-progress')
        .forEach((run: CheckRun) => {
          activeMap.set(run.applianceId, run);
        });
      setActiveChecks(activeMap);
    } catch (err) {
      setError('Failed to load appliances');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleStartCheck(applianceId: string) {
    navigate(`/truckcheck/check/${applianceId}`);
  }

  if (loading) {
    return (
      <PageTransition variant="fade">
        <div className="truckcheck-page">
        <header className="truckcheck-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>Truck Checks</h1>
        </header>
        <main className="truckcheck-main" id="main-content" tabIndex={-1}>
          <div className="loading">Loading appliances...</div>
        </main>
      </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition variant="fade">
        <div className="truckcheck-page">
        <header className="truckcheck-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>Truck Checks</h1>
        </header>
        <main className="truckcheck-main" id="main-content" tabIndex={-1}>
          <div className="error">{error}</div>
        </main>
      </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition variant="slideFromBottom">
      <div className="truckcheck-page">
      <header className="truckcheck-header">
        <div className="header-top">
          <Link to="/" className="back-link">← Back to Home</Link>
          <button 
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        <h1>Truck Checks</h1>
        <p className="subtitle">Weekly vehicle inspection system</p>
      </header>

      <main className="truckcheck-main" id="main-content" tabIndex={-1}>
        <div className="view-tabs">
          <Link to="/truckcheck/admin" className="tab-link">
            ⚙️ Admin Dashboard
          </Link>
        </div>

        <div className="start-view">
          <div className="instructions">
            <h2>Select an Appliance to Check</h2>
            <p>Choose the vehicle you want to perform a weekly inspection on.</p>
          </div>

          <div className="appliance-grid">
            {appliances.map((appliance) => {
              const activeCheck = activeChecks.get(appliance.id);
              return (
                <div key={appliance.id} className="appliance-card">
                  {activeCheck && (
                    <div className="active-check-badge">
                      🔄 Check in progress
                      <span className="contributors-count">
                        {activeCheck.contributors?.length || 1} contributor{(activeCheck.contributors?.length || 1) > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {appliance.photoUrl ? (
                    <img src={appliance.photoUrl} alt={appliance.name} className="appliance-photo" />
                  ) : (
                    <div className="appliance-icon">🚛</div>
                  )}
                  <h3>{appliance.name}</h3>
                  {appliance.description && (
                    <p className="appliance-description">{appliance.description}</p>
                  )}
                  <button 
                    className="btn-primary"
                    onClick={() => handleStartCheck(appliance.id)}
                  >
                    {activeCheck ? 'Join Check' : 'Start Check'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
    </PageTransition>
  );
}
