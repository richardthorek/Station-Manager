import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { api } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import './SignInLinkPage.css';

export function SignInLinkPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already-checked-in'>('loading');
  const [message, setMessage] = useState('');
  const [memberName, setMemberName] = useState('');
  const { isConnected, emit } = useSocket();

  useEffect(() => {
    const userIdentifier = searchParams.get('user');
    
    if (!userIdentifier) {
      setStatus('error');
      setMessage('No user identifier provided in URL');
      return;
    }

    handleUrlCheckIn(userIdentifier);
  }, [searchParams]);

  const handleUrlCheckIn = async (identifier: string) => {
    try {
      setStatus('loading');
      const result = await api.urlCheckIn(identifier);
      
      setMemberName(result.member);
      
      if (result.action === 'already-checked-in') {
        setStatus('already-checked-in');
        setMessage(`${result.member} is already checked in.`);
      } else if (result.action === 'checked-in') {
        setStatus('success');
        setMessage(`Successfully checked in ${result.member}!`);
        // Emit socket event for real-time updates
        emit('checkin', result);
      }
    } catch (err) {
      console.error('URL check-in error:', err);
      setStatus('error');
      setMessage('Failed to check in. Please try again or check in manually.');
    }
  };

  const handleGoToSignIn = () => {
    navigate('/signin');
  };

  if (status === 'loading') {
    return (
      <div className="app">
        <Header isConnected={isConnected} />
        <div className="signin-link-container">
          <div className="signin-link-content">
            <div className="spinner"></div>
            <h2>Processing Check-In...</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header isConnected={isConnected} />
      
      <div className="signin-link-container">
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
              Go to Sign-In Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
