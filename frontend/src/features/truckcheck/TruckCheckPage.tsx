import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../services/api';
import type { Appliance } from '../../types';
import './TruckCheckPage.css';

export function TruckCheckPage() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'start' | 'admin'>('start');

  useEffect(() => {
    loadAppliances();
  }, []);

  async function loadAppliances() {
    try {
      setLoading(true);
      const data = await api.getAppliances();
      setAppliances(data);
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

  function handleViewAdmin() {
    navigate('/truckcheck/admin');
  }

  function handleManageTemplates() {
    navigate('/truckcheck/templates');
  }

  if (loading) {
    return (
      <div className="truckcheck-page">
        <header className="truckcheck-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>Truck Checks</h1>
        </header>
        <main className="truckcheck-main">
          <div className="loading">Loading appliances...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="truckcheck-page">
        <header className="truckcheck-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>Truck Checks</h1>
        </header>
        <main className="truckcheck-main">
          <div className="error">{error}</div>
        </main>
      </div>
    );
  }

  return (
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

      <main className="truckcheck-main">
        <div className="view-tabs">
          <button 
            className={`tab-btn ${view === 'start' ? 'active' : ''}`}
            onClick={() => setView('start')}
          >
            Start Check
          </button>
          <button 
            className={`tab-btn ${view === 'admin' ? 'active' : ''}`}
            onClick={() => setView('admin')}
          >
            Admin
          </button>
        </div>

        {view === 'start' && (
          <div className="start-view">
            <div className="instructions">
              <h2>Select an Appliance to Check</h2>
              <p>Choose the vehicle you want to perform a weekly inspection on.</p>
            </div>

            <div className="appliance-grid">
              {appliances.map((appliance) => (
                <div key={appliance.id} className="appliance-card">
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
                    Start Check
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'admin' && (
          <div className="admin-view">
            <div className="admin-actions">
              <div className="action-card">
                <h3>📊 View Check History</h3>
                <p>Review all completed truck checks and filter by date or appliance.</p>
                <button className="btn-primary" onClick={handleViewAdmin}>
                  View History
                </button>
              </div>

              <div className="action-card">
                <h3>✏️ Manage Checklists</h3>
                <p>Edit checklist items for each appliance.</p>
                <button className="btn-primary" onClick={handleManageTemplates}>
                  Manage Templates
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
