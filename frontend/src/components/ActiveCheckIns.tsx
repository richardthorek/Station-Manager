import type { CheckInWithDetails } from '../types';
import './ActiveCheckIns.css';
import { ActivityTag } from './ActivityTag';

interface ActiveCheckInsProps {
  checkIns: CheckInWithDetails[];
  onUndo: (memberId: string) => void;
}

export function ActiveCheckIns({ checkIns, onUndo }: ActiveCheckInsProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'kiosk':
        return '🖥️';
      case 'mobile':
        return '📱';
      case 'qr':
        return '📸';
      default:
        return '✓';
    }
  };

  return (
    <div className="active-checkins card">
      <h2>Currently Signed In ({checkIns.length})</h2>
      
      {checkIns.length === 0 ? (
        <div className="empty-state">
          <p>No one is currently signed in</p>
          <span className="empty-icon">👥</span>
        </div>
      ) : (
        <div className="checkins-list">
          {checkIns.map(checkIn => (
            <div key={checkIn.id} className="checkin-item fade-in">
              <div className="checkin-info">
                <div className="member-info">
                  <span className="method-icon">{getMethodIcon(checkIn.checkInMethod)}</span>
                  <div>
                    <div className="member-name-display">{checkIn.memberName}</div>
                    <div className="checkin-meta">
                      <ActivityTag name={checkIn.activityName} color={(checkIn as any).activityTagColor || (checkIn as any).tagColor} /> • {formatTime(checkIn.checkInTime)}
                      {checkIn.isOffsite && (
                        <span className="offsite-badge">📍 Offsite</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  className="undo-btn"
                  onClick={() => onUndo(checkIn.memberId)}
                  title="Undo check-in"
                >
                  ↩️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
