import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../services/api';
import type { CheckRunWithResults } from '../../types';
import './CheckSummary.css';

export function CheckSummaryPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  
  const [checkRun, setCheckRun] = useState<CheckRunWithResults | null>(null);
  const [additionalComments, setAdditionalComments] = useState('');
  const [declaration, setDeclaration] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (runId) {
      loadCheckRun();
    }
  }, [runId]);

  async function loadCheckRun() {
    try {
      setLoading(true);
      const data = await api.getCheckRun(runId!);
      setCheckRun(data);
    } catch (err) {
      setError('Failed to load check run');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!runId || !declaration.trim()) {
      alert('Please enter your name in the declaration field');
      return;
    }

    try {
      setSubmitting(true);
      await api.completeCheckRun(runId, additionalComments || undefined);
      
      // Navigate back to truck check home
      navigate('/truckcheck', { 
        state: { message: 'Check completed successfully!' } 
      });
    } catch (err) {
      setError('Failed to complete check');
      console.error(err);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="summary-page">
        <header className="summary-header">
          <h1>Loading...</h1>
        </header>
      </div>
    );
  }

  if (error || !checkRun) {
    return (
      <div className="summary-page">
        <header className="summary-header">
          <Link to="/truckcheck" className="back-link">← Back</Link>
          <h1>Error</h1>
        </header>
        <main className="summary-main">
          <div className="error">{error || 'Failed to load check run'}</div>
        </main>
      </div>
    );
  }

  const issueCount = checkRun.results.filter(r => r.status === 'issue').length;
  const doneCount = checkRun.results.filter(r => r.status === 'done').length;
  const skippedCount = checkRun.results.filter(r => r.status === 'skipped').length;

  return (
    <div className="summary-page">
      <header className="summary-header">
        <div className="header-top">
          <Link to="/truckcheck" className="back-link">← Back</Link>
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        <h1>Check Summary</h1>
        <p className="subtitle">{checkRun.applianceName}</p>
      </header>

      <main className="summary-main">
        <div className="summary-card">
          <div className="summary-stats">
            <div className="stat done">
              <span className="stat-number">{doneCount}</span>
              <span className="stat-label">Done</span>
            </div>
            <div className="stat issue">
              <span className="stat-number">{issueCount}</span>
              <span className="stat-label">Issues</span>
            </div>
            <div className="stat skipped">
              <span className="stat-number">{skippedCount}</span>
              <span className="stat-label">Skipped</span>
            </div>
          </div>

          <div className="results-list">
            <h2>Check Results</h2>
            {checkRun.results.map((result) => (
              <div key={result.id} className={`result-item ${result.status}`}>
                <div className="result-header">
                  <h3>{result.itemName}</h3>
                  <span className={`status-badge ${result.status}`}>
                    {result.status === 'done' && '✓ Done'}
                    {result.status === 'issue' && '⚠ Issue'}
                    {result.status === 'skipped' && '○ Skipped'}
                  </span>
                </div>
                {result.comment && (
                  <p className="result-comment">
                    <strong>Comment:</strong> {result.comment}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="additional-comments-section">
            <h2>Additional Comments (Optional)</h2>
            <textarea
              value={additionalComments}
              onChange={(e) => setAdditionalComments(e.target.value)}
              placeholder="Add any additional observations or comments about this check..."
              className="comments-textarea"
            />
          </div>

          <div className="declaration-section">
            <h2>Declaration</h2>
            <p className="declaration-text">
              I declare that I have completed this check to the best of my ability and 
              that the information provided is accurate.
            </p>
            <input
              type="text"
              value={declaration}
              onChange={(e) => setDeclaration(e.target.value)}
              placeholder="Enter your full name"
              className="declaration-input"
            />
          </div>

          <div className="submit-section">
            <button
              className="btn-submit"
              onClick={handleSubmit}
              disabled={!declaration.trim() || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Check'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
