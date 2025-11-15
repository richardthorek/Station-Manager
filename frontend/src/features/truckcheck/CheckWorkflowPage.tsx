import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../services/api';
import type { Appliance, ChecklistTemplate, CheckRun, CheckResult, CheckStatus } from '../../types';
import './CheckWorkflow.css';

export function CheckWorkflowPage() {
  const { applianceId } = useParams<{ applianceId: string }>();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  
  const [appliance, setAppliance] = useState<Appliance | null>(null);
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [checkRun, setCheckRun] = useState<CheckRun | null>(null);
  const [results, setResults] = useState<Map<string, CheckResult>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedBy, setCompletedBy] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (applianceId) {
      loadData();
    }
  }, [applianceId]);

  async function loadData() {
    try {
      setLoading(true);
      const [applianceData, templateData] = await Promise.all([
        api.getAppliance(applianceId!),
        api.getTemplate(applianceId!),
      ]);
      setAppliance(applianceData);
      setTemplate(templateData);
    } catch (err) {
      setError('Failed to load checklist');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartCheck() {
    if (!completedBy.trim() || !applianceId) return;
    
    try {
      const run = await api.createCheckRun(applianceId, completedBy, completedBy);
      setCheckRun(run);
      setShowNamePrompt(false);
    } catch (err) {
      setError('Failed to start check');
      console.error(err);
    }
  }

  async function handleItemResult(itemId: string, itemName: string, itemDescription: string, status: CheckStatus, comment?: string) {
    if (!checkRun) return;

    try {
      const result = await api.createCheckResult(
        checkRun.id,
        itemId,
        itemName,
        itemDescription,
        status,
        comment
      );
      
      const newResults = new Map(results);
      newResults.set(itemId, result);
      setResults(newResults);

      // Move to next item if not the last
      if (template && currentIndex < template.items.length - 1) {
        setCurrentIndex(currentIndex + 1);
        scrollToItem(currentIndex + 1);
      } else {
        // Navigate to summary
        navigate(`/truckcheck/summary/${checkRun.id}`);
      }
    } catch (err) {
      setError('Failed to save result');
      console.error(err);
    }
  }

  function scrollToItem(index: number) {
    if (scrollContainerRef.current) {
      const itemHeight = scrollContainerRef.current.scrollHeight / (template?.items.length || 1);
      scrollContainerRef.current.scrollTo({
        top: itemHeight * index,
        behavior: 'smooth',
      });
    }
  }

  function handlePrevious() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      scrollToItem(currentIndex - 1);
    }
  }

  function handleNext() {
    if (template && currentIndex < template.items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      scrollToItem(currentIndex + 1);
    }
  }

  if (loading) {
    return (
      <div className="workflow-page">
        <header className="workflow-header">
          <Link to="/truckcheck" className="back-link">← Back</Link>
          <h1>Loading...</h1>
        </header>
      </div>
    );
  }

  if (error || !appliance || !template) {
    return (
      <div className="workflow-page">
        <header className="workflow-header">
          <Link to="/truckcheck" className="back-link">← Back</Link>
          <h1>Error</h1>
        </header>
        <main className="workflow-main">
          <div className="error">{error || 'Failed to load checklist'}</div>
        </main>
      </div>
    );
  }

  if (showNamePrompt) {
    return (
      <div className="workflow-page">
        <header className="workflow-header">
          <div className="header-top">
            <Link to="/truckcheck" className="back-link">← Back</Link>
            <button className="theme-toggle-btn" onClick={toggleTheme}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
          <h1>{appliance.name} Check</h1>
        </header>
        <main className="workflow-main">
          <div className="name-prompt">
            <h2>Enter Your Name</h2>
            <p>Please enter your name to begin the check</p>
            <input
              type="text"
              value={completedBy}
              onChange={(e) => setCompletedBy(e.target.value)}
              placeholder="Your name"
              className="name-input"
              autoFocus
            />
            <button 
              className="btn-primary" 
              onClick={handleStartCheck}
              disabled={!completedBy.trim()}
            >
              Start Check
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="workflow-page">
      <header className="workflow-header">
        <div className="header-top">
          <Link to="/truckcheck" className="back-link">← Cancel</Link>
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        <h1>{appliance.name} Check</h1>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${((currentIndex + 1) / template.items.length) * 100}%` }}
          />
        </div>
        <p className="progress-text">
          Item {currentIndex + 1} of {template.items.length}
        </p>
      </header>

      <main className="workflow-main" ref={scrollContainerRef}>
        <div className="items-container">
          {template.items.map((item, index) => (
            <CheckItemCard
              key={item.id}
              item={item}
              isActive={index === currentIndex}
              result={results.get(item.id)}
              onResult={(status, comment) => handleItemResult(item.id, item.name, item.description, status, comment)}
            />
          ))}
        </div>
      </main>

      <footer className="workflow-footer">
        <button 
          className="btn-secondary" 
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          ← Previous
        </button>
        <button 
          className="btn-secondary" 
          onClick={handleNext}
          disabled={currentIndex === template.items.length - 1}
        >
          Next →
        </button>
      </footer>
    </div>
  );
}

interface CheckItemCardProps {
  item: { id: string; name: string; description: string; referencePhotoUrl?: string };
  isActive: boolean;
  result?: CheckResult;
  onResult: (status: CheckStatus, comment?: string) => void;
}

function CheckItemCard({ item, isActive, result, onResult }: CheckItemCardProps) {
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);

  function handleStatus(status: CheckStatus) {
    if (status === 'issue') {
      setShowComment(true);
    } else {
      onResult(status, comment || undefined);
      setComment('');
      setShowComment(false);
    }
  }

  function handleSubmitWithComment() {
    onResult('issue', comment || undefined);
    setComment('');
    setShowComment(false);
  }

  return (
    <div className={`check-item-card ${isActive ? 'active' : ''} ${result ? 'completed' : ''}`}>
      <h2>{item.name}</h2>
      <p className="item-description">{item.description}</p>
      
      {result && (
        <div className={`result-badge ${result.status}`}>
          {result.status === 'done' && '✓ Done'}
          {result.status === 'issue' && '⚠ Issue'}
          {result.status === 'skipped' && '○ Skipped'}
        </div>
      )}

      {!result && isActive && (
        <div className="item-actions">
          {!showComment ? (
            <>
              <button className="btn-done" onClick={() => handleStatus('done')}>
                ✓ Done
              </button>
              <button className="btn-issue" onClick={() => handleStatus('issue')}>
                ⚠ Issue
              </button>
              <button className="btn-skip" onClick={() => handleStatus('skipped')}>
                Skip
              </button>
            </>
          ) : (
            <div className="comment-section">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe the issue..."
                className="comment-input"
                autoFocus
              />
              <div className="comment-actions">
                <button className="btn-secondary" onClick={() => setShowComment(false)}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleSubmitWithComment}>
                  Submit Issue
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
