import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../services/api';
import { VehicleManagement } from './VehicleManagement';
import type { CheckRunWithResults, Appliance } from '../../types';
import './AdminDashboard.css';

type ActiveTab = 'history' | 'vehicles';

export function AdminDashboardPage() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('history');
  const [checkRuns, setCheckRuns] = useState<CheckRunWithResults[]>([]);
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [selectedAppliance, setSelectedAppliance] = useState<string>('all');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadCheckRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAppliance, issuesOnly]);

  async function loadData() {
    try {
      const appliancesData = await api.getAppliances();
      // Defensive check: ensure data is an array
      setAppliances(Array.isArray(appliancesData) ? appliancesData : []);
      await loadCheckRuns();
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCheckRuns() {
    try {
      const filters: { applianceId?: string; withIssues?: boolean } = {};
      if (selectedAppliance !== 'all') {
        filters.applianceId = selectedAppliance;
      }
      if (issuesOnly) {
        filters.withIssues = true;
      }
      
      const data = await api.getCheckRuns(filters);
      // Defensive check: ensure data is an array
      setCheckRuns(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load check runs');
      console.error(err);
    }
  }

  function toggleExpand(runId: string) {
    setExpandedRun(expandedRun === runId ? null : runId);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="admin-dashboard">
        <header className="dashboard-header">
          <h1>Loading...</h1>
        </header>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <header className="dashboard-header">
          <Link to="/truckcheck" className="back-link">← Back</Link>
          <h1>Error</h1>
        </header>
        <main className="dashboard-main">
          <div className="error">{error}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-top">
          <Link to="/truckcheck" className="back-link">← Back to Truck Checks</Link>
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        <h1>Admin Dashboard</h1>
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📊 Check History
          </button>
          <button 
            className={`tab ${activeTab === 'vehicles' ? 'active' : ''}`}
            onClick={() => setActiveTab('vehicles')}
          >
            🚒 Vehicle Management
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        {activeTab === 'vehicles' ? (
          <VehicleManagement appliances={appliances} onUpdate={loadData} />
        ) : (
          <>
        <div className="filters-section">
          <div className="filter-group">
            <label htmlFor="appliance-filter">Filter by Appliance:</label>
            <select
              id="appliance-filter"
              value={selectedAppliance}
              onChange={(e) => setSelectedAppliance(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Appliances</option>
              {appliances.map((appliance) => (
                <option key={appliance.id} value={appliance.id}>
                  {appliance.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={issuesOnly}
                onChange={(e) => setIssuesOnly(e.target.checked)}
              />
              <span>Issues Only</span>
            </label>
          </div>
        </div>

        <div className="stats-summary">
          <div className="stat-card">
            <span className="stat-number">{checkRuns.length}</span>
            <span className="stat-label">Total Checks</span>
          </div>
          <div className="stat-card issues">
            <span className="stat-number">
              {checkRuns.filter(r => r.hasIssues).length}
            </span>
            <span className="stat-label">With Issues</span>
          </div>
        </div>

        <div className="runs-list">
          {checkRuns.length === 0 ? (
            <div className="no-results">
              <p>No check runs found matching the selected filters.</p>
            </div>
          ) : (
            checkRuns.map((run) => (
              <div key={run.id} className={`run-card ${run.hasIssues ? 'has-issues' : ''}`}>
                <div className="run-header" onClick={() => toggleExpand(run.id)}>
                  <div className="run-info">
                    <h3>{run.applianceName}</h3>
                    <p className="run-date">{formatDate(run.startTime)}</p>
                    <p className="run-completed-by">
                      Completed by: {run.completedByName || run.completedBy}
                    </p>
                  </div>
                  <div className="run-summary">
                    {run.hasIssues && (
                      <span className="issue-badge">
                        ⚠ {run.results.filter(r => r.status === 'issue').length} Issue(s)
                      </span>
                    )}
                    <span className="expand-icon">
                      {expandedRun === run.id ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {expandedRun === run.id && (
                  <div className="run-details">
                    <div className="results-grid">
                      {run.results.map((result) => (
                        <div key={result.id} className={`result-item ${result.status}`}>
                          <div className="result-info">
                            <h4>{result.itemName}</h4>
                            <span className={`status-badge ${result.status}`}>
                              {result.status === 'done' && '✓ Done'}
                              {result.status === 'issue' && '⚠ Issue'}
                              {result.status === 'skipped' && '○ Skipped'}
                            </span>
                          </div>
                          {result.comment && (
                            <p className="result-comment">{result.comment}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {run.additionalComments && (
                      <div className="additional-comments">
                        <h4>Additional Comments:</h4>
                        <p>{run.additionalComments}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        </>
        )}
      </main>
    </div>
  );
}
