import type { CheckInWithDetails } from '../types';
import './ActiveCheckIns.css';
import { ActivityTag } from './ActivityTag';
import { CollapsibleSection } from './CollapsibleSection';

interface ActiveCheckInsProps {
  checkIns: CheckInWithDetails[];
  onUndo: (memberId: string) => void;
  /** Whether to wrap in collapsible section (default: false) */
  collapsible?: boolean;
}

export function ActiveCheckIns({ checkIns, onUndo, collapsible = false }: ActiveCheckInsProps) {
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

  const content = (
    <>
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
                      <ActivityTag name={checkIn.activityName} color={checkIn.activityTagColor || checkIn.tagColor} /> • {formatTime(checkIn.checkInTime)}
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
                  aria-label={`Undo check-in for ${checkIn.memberName}`}
                >
                  ↩️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (collapsible) {
    return (
      <div className="active-checkins card">
        <CollapsibleSection
          title="Currently Signed In"
          badgeCount={checkIns.length}
          storageKey="activeCheckIns.expanded"
          defaultExpanded={true}
        >
          {content}
        </CollapsibleSection>
      </div>
    );
  }

  return (
    <div className="active-checkins card">
      <h2>Currently Signed In ({checkIns.length})</h2>
      {content}
    </div>
  );
}
