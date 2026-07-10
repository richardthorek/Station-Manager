/**
 * Truck Check Landing Page — the vehicle roster.
 *
 * The single "at a glance" board for a brigade's fleet. Each vehicle row shows:
 * - identity (name, make/model/year, registration)
 * - when it was last checked, the result (e.g. 10/12 OK) and who did it
 * - whether a check is currently in progress (with who's on it)
 * - outstanding issues
 *
 * Actions per vehicle:
 * - Start / Resume a check
 * - Finalise or Cancel a check left open from a previous session
 * - Voice check (AI-gated)
 *
 * Stays live via the `truck-check-update` socket event so a kiosk board reflects
 * checks starting, completing and being cancelled elsewhere without a refresh.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Moon, Sun, Settings2, Wrench, Truck, TriangleAlert, Mic } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { PageTransition } from '../../components/PageTransition';
import { api } from '../../services/api';
import type { Appliance, CheckRun, CheckRunWithResults, IssueResult } from '../../types';
import './TruckCheckPage.css';

interface LastCheck {
  when: string;
  doneCount: number;
  totalCount: number;
  issueCount: number;
  by: string;
}

export function TruckCheckPage() {
  const { theme, toggleTheme } = useTheme();
  const { hasFeature } = useAuth();
  const { on, off } = useSocket();
  const navigate = useNavigate();
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [activeChecks, setActiveChecks] = useState<Map<string, CheckRun>>(new Map());
  const [lastChecks, setLastChecks] = useState<Map<string, LastCheck>>(new Map());
  const [openIssues, setOpenIssues] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadAppliances = useCallback(async () => {
    try {
      const [appliancesData, checkRunsData, issuesData] = await Promise.all([
        api.getAppliances(),
        api.getCheckRuns(),
        api.getIssues().catch(() => [] as IssueResult[]),
      ]);
      setAppliances(Array.isArray(appliancesData) ? appliancesData : []);

      const checkRuns: CheckRunWithResults[] = Array.isArray(checkRunsData) ? checkRunsData : [];

      // Active (in-progress) run per appliance.
      const activeMap = new Map<string, CheckRun>();
      checkRuns
        .filter((run) => run.status === 'in-progress')
        .forEach((run) => activeMap.set(run.applianceId, run));
      setActiveChecks(activeMap);

      // Most recent completed run per appliance → the roster summary line.
      const lastMap = new Map<string, LastCheck>();
      checkRuns
        .filter((run) => run.status === 'completed')
        .forEach((run) => {
          const when = (run.endTime || run.startTime) as unknown as string;
          const existing = lastMap.get(run.applianceId);
          if (existing && new Date(when) <= new Date(existing.when)) return;
          const results = run.results ?? [];
          lastMap.set(run.applianceId, {
            when,
            doneCount: results.filter((r) => r.status === 'done').length,
            totalCount: results.length,
            issueCount: results.filter((r) => r.status === 'issue').length,
            by: run.completedByName || run.completedBy || 'Unknown',
          });
        });
      setLastChecks(lastMap);

      // Count outstanding (open/acknowledged) issues per appliance.
      const issueMap = new Map<string, number>();
      (Array.isArray(issuesData) ? issuesData : []).forEach((issue: IssueResult) => {
        if (issue.issueStatus !== 'resolved') {
          issueMap.set(issue.applianceId, (issueMap.get(issue.applianceId) || 0) + 1);
        }
      });
      setOpenIssues(issueMap);
    } catch (err) {
      setError('Failed to load vehicles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppliances();
  }, [loadAppliances]);

  // Keep the roster live: any truck-check activity elsewhere re-syncs the board.
  useEffect(() => {
    function handleUpdate() {
      loadAppliances();
    }
    on('truck-check-update', handleUpdate);
    return () => off('truck-check-update', handleUpdate);
  }, [on, off, loadAppliances]);

  function handleStartCheck(applianceId: string) {
    navigate(`/truckcheck/check/${applianceId}`);
  }

  function handleFinalise(run: CheckRun) {
    navigate(`/truckcheck/summary/${run.id}`);
  }

  async function handleCancel(run: CheckRun) {
    if (!window.confirm(
      `Cancel the in-progress check on ${run.applianceName}? This discards its progress and cannot be undone.`,
    )) {
      return;
    }
    try {
      setCancellingId(run.id);
      await api.cancelCheckRun(run.id);
      await loadAppliances();
    } catch (err) {
      console.error(err);
      alert('Failed to cancel the check. Please try again.');
    } finally {
      setCancellingId(null);
    }
  }

  function formatLastChecked(iso?: string): string {
    if (!iso) return 'Never checked';
    const then = new Date(iso);
    const days = Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return 'Last week';
    return then.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  if (loading) {
    return (
      <PageTransition variant="fade">
        <div className="truckcheck-page">
          <header className="truckcheck-header">
            <Link to="/" className="back-link">← Back to Home</Link>
            <h1>Vehicle Checks</h1>
          </header>
          <main className="truckcheck-main" id="main-content" tabIndex={-1}>
            <div className="loading">Loading vehicles…</div>
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
            <h1>Vehicle Checks</h1>
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
              {theme === 'light' ? <Moon size={20} strokeWidth={2} aria-hidden /> : <Sun size={20} strokeWidth={2} aria-hidden />}
            </button>
          </div>
          <h1>Vehicle Roster</h1>
          <p className="subtitle">Weekly vehicle inspections at a glance</p>
        </header>

        <main className="truckcheck-main" id="main-content" tabIndex={-1}>
          <div className="view-tabs">
            <Link to="/truckcheck/admin" className="tab-link">
              <Settings2 size={16} strokeWidth={2} aria-hidden /> Admin Dashboard
            </Link>
            <Link to="/truckcheck/vehicle-types" className="tab-link">
              <Wrench size={16} strokeWidth={2} aria-hidden /> Templates &amp; Vehicle Types
            </Link>
          </div>

          {appliances.length === 0 ? (
            <div className="roster-empty">
              <div className="roster-empty__icon"><Truck size={40} strokeWidth={2} aria-hidden /></div>
              <h2>No vehicles yet</h2>
              <p>Add your brigade's vehicles from the Admin Dashboard to start running weekly checks.</p>
              <Link to="/truckcheck/admin" className="btn-primary">Go to Admin Dashboard</Link>
            </div>
          ) : (
            <div className="roster-grid">
              {appliances.map((appliance) => {
                const activeCheck = activeChecks.get(appliance.id);
                const last = lastChecks.get(appliance.id);
                const issueCount = openIssues.get(appliance.id) || 0;
                const identity = [
                  [appliance.make, appliance.model, appliance.year].filter(Boolean).join(' '),
                  appliance.registration,
                ].filter(Boolean).join(' · ');

                return (
                  <div
                    key={appliance.id}
                    className={`roster-card${activeCheck ? ' roster-card--active' : ''}${issueCount ? ' roster-card--has-issues' : ''}`}
                  >
                    <div className="roster-card__media">
                      {appliance.photoUrl ? (
                        <img src={appliance.photoUrl} alt={appliance.name} className="roster-card__photo" />
                      ) : (
                        <div className="roster-card__icon" aria-hidden="true"><Truck size={28} strokeWidth={2} /></div>
                      )}
                    </div>

                    <div className="roster-card__body">
                      <div className="roster-card__title-row">
                        <h3 className="roster-card__name">{appliance.name}</h3>
                        {issueCount > 0 && (
                          <span className="roster-chip roster-chip--issue" title="Outstanding issues">
                            <TriangleAlert size={14} strokeWidth={2} aria-hidden /> {issueCount}
                          </span>
                        )}
                      </div>
                      {identity && <p className="roster-card__identity">{identity}</p>}

                      {activeCheck ? (
                        <div className="roster-card__status roster-card__status--active">
                          <span className="roster-status-dot" aria-hidden="true" />
                          Check in progress
                          <span className="roster-card__contributors">
                            {' · '}
                            {(activeCheck.contributors?.length || 1)} on it
                            {activeCheck.completedByName || activeCheck.completedBy
                              ? ` (${activeCheck.completedByName || activeCheck.completedBy})`
                              : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="roster-card__status">
                          {last ? (
                            <>
                              <span className="roster-card__result">
                                {last.issueCount > 0
                                  ? `${last.doneCount}/${last.totalCount} OK · ${last.issueCount} issue${last.issueCount > 1 ? 's' : ''}`
                                  : `${last.doneCount}/${last.totalCount} OK`}
                              </span>
                              <span className="roster-card__meta">
                                {formatLastChecked(last.when)} · by {last.by}
                              </span>
                            </>
                          ) : (
                            <span className="roster-card__meta roster-card__meta--never">Never checked</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="roster-card__actions">
                      {activeCheck ? (
                        <>
                          <button className="btn-primary" onClick={() => handleStartCheck(appliance.id)}>
                            Resume
                          </button>
                          <button className="btn-secondary" onClick={() => handleFinalise(activeCheck)}>
                            Finalise
                          </button>
                          <button
                            className="btn-danger"
                            onClick={() => handleCancel(activeCheck)}
                            disabled={cancellingId === activeCheck.id}
                          >
                            {cancellingId === activeCheck.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn-primary" onClick={() => handleStartCheck(appliance.id)}>
                            Start Check
                          </button>
                          {hasFeature('aiEnabled') && (
                            <button
                              className="btn-voice-check"
                              onClick={() => navigate(`/truckcheck/voice/${appliance.id}`)}
                            >
                              <Mic size={16} strokeWidth={2} aria-hidden /> Voice
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </PageTransition>
  );
}
