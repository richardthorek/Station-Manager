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

  async function handleItemResult(itemId: string, itemName: string, itemDescription: string, status: CheckStatus, comment?: string, photoUrl?: string) {
    if (!checkRun) return;

    try {
      const result = await api.createCheckResult(
        checkRun.id,
        itemId,
        itemName,
        itemDescription,
        status,
        comment,
        photoUrl
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
    if (scrollContainerRef.current && template) {
      const cards = scrollContainerRef.current.querySelectorAll('.check-item-card');
      if (cards[index]) {
        cards[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
  
  function jumpToItem(index: number) {
    setCurrentIndex(index);
    scrollToItem(index);
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
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentIndex + 1) / template.items.length) * 100}%` }}
            />
          </div>
          <div className="progress-milestones">
            {template.items.map((item, index) => (
              <button
                key={item.id}
                className={`milestone ${index === currentIndex ? 'active' : ''} ${results.has(item.id) ? 'completed' : ''}`}
                onClick={() => jumpToItem(index)}
                title={item.name}
                aria-label={`Jump to ${item.name}`}
              >
                <span className="milestone-number">{index + 1}</span>
                {results.has(item.id) && (
                  <span className="milestone-check">✓</span>
                )}
              </button>
            ))}
          </div>
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
              onResult={(status, comment, photoUrl) => handleItemResult(item.id, item.name, item.description, status, comment, photoUrl)}
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
  onResult: (status: CheckStatus, comment?: string, photoUrl?: string) => void;
}

function CheckItemCard({ item, isActive, result, onResult }: CheckItemCardProps) {
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [storageEnabled, setStorageEnabled] = useState(false);

  useEffect(() => {
    checkStorageStatus();
  }, []);

  async function checkStorageStatus() {
    try {
      const status = await api.getStorageStatus();
      setStorageEnabled(status.enabled);
    } catch (err) {
      console.error('Failed to check storage status:', err);
    }
  }

  function handleStatus(status: CheckStatus) {
    if (status === 'issue') {
      setShowComment(true);
    } else {
      onResult(status, comment || undefined, uploadedPhotoUrl || undefined);
      setComment('');
      setShowComment(false);
      setUploadedPhotoUrl(null);
    }
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!storageEnabled) {
      alert('Photo upload is not available. Azure Storage is not configured.');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image file must be smaller than 10MB');
      return;
    }

    try {
      setUploading(true);
      const response = await api.uploadResultPhoto(file);
      setUploadedPhotoUrl(response.photoUrl);
    } catch (err) {
      console.error('Failed to upload photo:', err);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleSubmitWithComment() {
    onResult('issue', comment || undefined, uploadedPhotoUrl || undefined);
    setComment('');
    setShowComment(false);
    setUploadedPhotoUrl(null);
  }

  return (
    <div className={`check-item-card ${isActive ? 'active' : ''} ${result ? 'completed' : ''}`}>
      <div className="item-content">
        <h2>{item.name}</h2>
        <p className="item-description">{item.description}</p>
        
        {/* Reference photo if available */}
        {item.referencePhotoUrl ? (
          <div className="reference-photo">
            <img src={item.referencePhotoUrl} alt={`Reference for ${item.name}`} />
            <p className="photo-caption">Reference Photo</p>
          </div>
        ) : (
          <div className="reference-photo-placeholder">
            <div className="photo-icon">📷</div>
            <p className="photo-text">No reference photo available</p>
          </div>
        )}
        
        {result ? (
          <div className="result-display">
            <div className={`result-badge ${result.status}`}>
              {result.status === 'done' && '✓ Done'}
              {result.status === 'issue' && '⚠ Issue'}
              {result.status === 'skipped' && '○ Skipped'}
            </div>
            {result.comment && (
              <p className="result-comment">Comment: {result.comment}</p>
            )}
            {result.photoUrl && (
              <div className="result-photo">
                <img src={result.photoUrl} alt="Issue documentation" />
                <p className="photo-caption">Uploaded Photo</p>
              </div>
            )}
            {isActive && (
              <p className="edit-hint">Scroll to next item or use navigation buttons</p>
            )}
          </div>
        ) : isActive ? (
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
                
                {/* Photo upload for issue documentation */}
                {storageEnabled && (
                  <div className="photo-upload-section">
                    <label className="upload-label-text">
                      Add Photo (Optional)
                    </label>
                    {uploadedPhotoUrl ? (
                      <div className="uploaded-photo-preview">
                        <img src={uploadedPhotoUrl} alt="Uploaded issue" />
                        <button 
                          className="remove-photo-btn"
                          onClick={() => setUploadedPhotoUrl(null)}
                        >
                          Remove Photo
                        </button>
                      </div>
                    ) : (
                      <div className="photo-upload-control">
                        <input
                          type="file"
                          id="photo-upload"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={uploading}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="photo-upload" className="upload-button">
                          {uploading ? '📤 Uploading...' : '📸 Add Photo'}
                        </label>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="comment-actions">
                  <button className="btn-secondary" onClick={() => {
                    setShowComment(false);
                    setUploadedPhotoUrl(null);
                  }}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={handleSubmitWithComment}>
                    Submit Issue
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="item-waiting">
            <p>Scroll or navigate to this item to complete</p>
          </div>
        )}
      </div>
    </div>
  );
}
