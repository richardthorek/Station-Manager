import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { api } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { setMemberSessionToken } from '../../utils/memberSession';
import './SignInLinkPage.css';

export function SignInLinkPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already-checked-in'>('loading');
  const [message, setMessage] = useState('');
  const [memberName, setMemberName] = useState('');
  const [databaseStatus, setDatabaseStatus] = useState<{
    databaseType: 'mongodb' | 'in-memory' | 'table-storage';
    usingInMemory: boolean;
  } | null>(null);
  const { isConnected, emit } = useSocket();

  useEffect(() => {
    // Load database status on mount
    const initDatabaseStatus = async () => {
      try {
        const status = await api.getStatus();
        setDatabaseStatus({
          databaseType: status.databaseType,
          usingInMemory: status.usingInMemory,
        });
      } catch (err) {
        console.error('Error loading database status:', err);
      }
    };
    
    initDatabaseStatus();

    const userIdentifier = searchParams.get('user');
    const stationId = searchParams.get('station'); // Extract stationId from URL
    
    const performCheckIn = async () => {
      if (!userIdentifier) {
        setStatus('error');
        setMessage('No user identifier provided in URL');
        return;
      }

      try {
        setStatus('loading');
        const result = await api.urlCheckIn(userIdentifier, stationId || undefined);

        setMemberName(result.member);

        // AC-1: the backend mints a short-lived, station-scoped read session
        // on every successful (or already-checked-in) response — store it so
        // this browser can now open the live sign-in book via AccessRoute.
        if (result.sessionToken) {
          setMemberSessionToken(result.sessionToken);
        }

        if (result.action === 'already-checked-in') {
          setStatus('already-checked-in');
          setMessage(`${result.member} is already checked in.`);
        } else if (result.action === 'checked-in') {
          setStatus('success');
          setMessage(`Successfully checked in ${result.member}!`);
          // Emit socket event for real-time updates - this will trigger a refresh on connected sign-in pages
          emit('event-update', { type: 'participant-added', checkIn: result.checkIn });
        }
      } catch (err) {
        console.error('URL check-in error:', err);
        setStatus('error');
        setMessage('Failed to check in. Please try again or check in manually.');
      }
    };
    
    performCheckIn();
  }, [searchParams, emit]);

  // AC-1: a successful check-in mints a station-scoped member-session, so
  // this visitor can now legitimately open the live sign-in book (AccessRoute
  // recognises the stored session token). On error there's no session to use,
  // so send them home instead.
  const handleGoToSignIn = () => {
    navigate(status === 'error' ? '/' : '/signin');
  };

  if (status === 'loading') {
    return (
      <div className="app">
        <Header isConnected={isConnected} databaseStatus={databaseStatus} />
        <main className="signin-link-container" id="main-content" tabIndex={-1}>
          <div className="signin-link-content">
            <div className="spinner"></div>
            <h2>Processing Check-In...</h2>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Header isConnected={isConnected} databaseStatus={databaseStatus} />
      
      <main className="signin-link-container" id="main-content" tabIndex={-1}>
        <div className="signin-link-content">
          {status === 'success' && (
            <div className="status-icon success">✓</div>
          )}
          
          {status === 'already-checked-in' && (
            <div className="status-icon info">ℹ</div>
          )}
          
          {status === 'error' && (
            <div className="status-icon error">✕</div>
          )}

          <h2 className={`status-title ${status}`}>
            {status === 'success' && 'Check-In Successful!'}
            {status === 'already-checked-in' && 'Already Checked In'}
            {status === 'error' && 'Check-In Failed'}
          </h2>

          <p className="status-message">{message}</p>

          {memberName && (
            <div className="member-info">
              <strong>Member:</strong> {memberName}
            </div>
          )}

          <div className="action-buttons">
            <button className="btn-primary" onClick={handleGoToSignIn}>
              {status === 'error' ? 'Go Home' : 'Go to Sign-In Book'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
