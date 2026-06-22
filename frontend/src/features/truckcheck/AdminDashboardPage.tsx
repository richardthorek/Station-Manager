import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../services/api';
import { downloadCSV, getTodayFormatted } from '../../utils/csvUtils';
import { VehicleManagement } from './VehicleManagement';
import type { CheckRunWithResults, Appliance, IssueResult } from '../../types';
import './AdminDashboard.css';

type ActiveTab = 'history' | 'followups' | 'vehicles';
type IssueFilter = 'outstanding' | 'open' | 'acknowledged' | 'resolved';

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
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [issues, setIssues] = useState<IssueResult[]>([]);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('outstanding');
  // Resolution modal (replaces browser prompt)
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<IssueResult | null>(null);
  const [resolveBy, setResolveBy] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [resolveSaving, setResolveSaving] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'followups') loadIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, issueFilter]);

  async function loadIssues() {
    try {
      const status = issueFilter === 'outstanding' ? undefined : issueFilter;
      const data = await api.getIssues(status);
      setIssues(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleIssueAction(issue: IssueResult, issueStatus: 'acknowledged' | 'resolved') {
    if (issueStatus === 'resolved') {
      setResolveTarget(issue);
      setResolveBy('');
      setResolveNote('');
      setShowResolveModal(true);
      return;
    }
    try {
      await api.updateIssueStatus(issue.id, issue.runId, { issueStatus });
      await loadIssues();
    } catch (err) {
      alert('Failed to update issue');
      console.error(err);
    }
  }

  async function handleResolveSubmit() {
    if (!resolveTarget) return;
    try {
      setResolveSaving(true);
      await api.updateIssueStatus(resolveTarget.id, resolveTarget.runId, {
        issueStatus: 'resolved',
        resolvedBy: resolveBy.trim() || undefined,
        issueNote: resolveNote.trim() || undefined,
      });
      setShowResolveModal(false);
      await loadIssues();
    } catch (err) {
      alert('Failed to resolve issue');
      console.error(err);
    } finally {
      setResolveSaving(false);
    }
  }

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

  async function handleExportResults() {
    try {
      setExportLoading(true);
      setExportFeedback(null);
      const blob = await api.exportTruckCheckResults(
        exportStartDate || undefined,
        exportEndDate || undefined,
      );
      const dateRange = exportStartDate || exportEndDate
        ? `-${exportStartDate || 'all'}-to-${exportEndDate || 'all'}`
        : '';
      downloadCSV(blob, `truckcheck-results${dateRange}-${getTodayFormatted()}.csv`);
      setExportFeedback({ type: 'success', message: 'Export downloaded successfully.' });
    } catch {
      setExportFeedback({ type: 'error', message: 'Export failed. Please try again.' });
    } finally {
      setExportLoading(false);
      setTimeout(() => setExportFeedback(null), 4000);
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
        <main className="dashboard-main" id="main-content" tabIndex={-1}>
          <div className="error">{error}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-top">
          <Link to="/truckcheck" className="back-link">← Back to Vehicle Checks</Link>
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
            className={`tab ${activeTab === 'followups' ? 'active' : ''}`}
            onClick={() => setActiveTab('followups')}
          >
            🔧 Follow-ups
          </button>
          <button 
            className={`tab ${activeTab === 'vehicles' ? 'active' : ''}`}
            onClick={() => setActiveTab('vehicles')}
          >
            🚒 Vehicle Management
          </button>
        </div>
      </header>

      <main className="dashboard-main" id="main-content" tabIndex={-1}>
        {activeTab === 'vehicles' ? (
          <VehicleManagement appliances={appliances} onUpdate={loadData} />
        ) : activeTab === 'followups' ? (
          <div className="followups">
            <div className="filters-section">
              <div className="filter-group">
                <label htmlFor="issue-filter">Show:</label>
                <select
                  id="issue-filter"
                  value={issueFilter}
                  onChange={(e) => setIssueFilter(e.target.value as IssueFilter)}
                  className="filter-select"
                >
                  <option value="outstanding">Outstanding (open + acknowledged)</option>
                  <option value="open">Open</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            {issues.length === 0 ? (
              <div className="no-results"><p>No issues to follow up. 🎉</p></div>
            ) : (
              <div className="runs-list">
                {issues.map((issue) => (
                  <div key={issue.id} className={`run-card has-issues issue-card issue-card--${issue.issueStatus}`}>
                    <div className="run-info">
                      <h3>{issue.applianceName} — {issue.itemName}</h3>
                      <p className="run-date">{formatDate(issue.runStartTime)}</p>
                      {issue.comment && <p className="result-comment">“{issue.comment}”</p>}
                      <p className="issue-meta">
                        <span className={`status-badge issue-status--${issue.issueStatus}`}>{issue.issueStatus}</span>
                        {issue.assignedTo && <span> · assigned to {issue.assignedTo}</span>}
                        {issue.issueStatus === 'resolved' && issue.resolvedBy && <span> · resolved by {issue.resolvedBy}</span>}
                      </p>
                      {issue.issueNote && <p className="result-comment">Resolution: {issue.issueNote}</p>}
                    </div>
                    {issue.issueStatus !== 'resolved' && (
                      <div className="issue-actions">
                        {issue.issueStatus === 'open' && (
                          <button className="btn-secondary" onClick={() => handleIssueAction(issue, 'acknowledged')}>
                            Acknowledge
                          </button>
                        )}
                        <button className="btn-primary" onClick={() => handleIssueAction(issue, 'resolved')}>
                          Mark resolved
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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

        <div className="export-section">
          <div className="export-controls">
            <div className="export-date-range">
              <div className="export-date-input">
                <label htmlFor="export-start">From:</label>
                <input
                  id="export-start"
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  disabled={exportLoading}
                />
              </div>
              <div className="export-date-input">
                <label htmlFor="export-end">To:</label>
                <input
                  id="export-end"
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  disabled={exportLoading}
                />
              </div>
            </div>
            <button
              className="btn-export-csv"
              onClick={handleExportResults}
              disabled={exportLoading}
              aria-busy={exportLoading}
            >
              {exportLoading ? 'Exporting…' : '📥 Export CSV'}
            </button>
          </div>
          {exportFeedback && (
            <p
              className={`export-feedback export-feedback--${exportFeedback.type}`}
              role={exportFeedback.type === 'error' ? 'alert' : 'status'}
            >
              {exportFeedback.message}
            </p>
          )}
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
                <div
                  className="run-header"
                  onClick={() => toggleExpand(run.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleExpand(run.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedRun === run.id}
                  aria-controls={`run-details-${run.id}`}
                >
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
                  <div className="run-details" id={`run-details-${run.id}`}>
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

      {showResolveModal && resolveTarget && (
        <div
          className="modal-overlay"
          role="button"
          tabIndex={0}
          aria-label="Close resolve dialog"
          onClick={(e) => { if (e.target === e.currentTarget && !resolveSaving) setShowResolveModal(false); }}
          onKeyDown={(e) => { if ((e.key === 'Escape' || e.key === 'Enter') && !resolveSaving) setShowResolveModal(false); }}
        >
          <div className="modal-content resolve-modal" role="dialog" aria-modal="true" aria-labelledby="resolve-modal-title">
            <h2 id="resolve-modal-title">Mark issue resolved</h2>
            <p className="resolve-modal__context">
              <strong>{resolveTarget.applianceName}</strong> — {resolveTarget.itemName}
            </p>
            <div className="form-group">
              <label htmlFor="resolve-by">Resolved by</label>
              <input
                id="resolve-by"
                type="text"
                value={resolveBy}
                onChange={(e) => setResolveBy(e.target.value)}
                placeholder="Name of person who resolved this"
                disabled={resolveSaving}
              />
            </div>
            <div className="form-group">
              <label htmlFor="resolve-note">Resolution note <span className="optional">(optional)</span></label>
              <textarea
                id="resolve-note"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="What was done to fix this issue?"
                rows={3}
                disabled={resolveSaving}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowResolveModal(false)} disabled={resolveSaving}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleResolveSubmit} disabled={resolveSaving}>
                {resolveSaving ? 'Saving…' : 'Mark resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
