import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { offlineQueue } from '../services/offlineQueue';
import { getAllQueuedActions, type QueuedAction } from '../services/offlineStorage';
import './OfflineIndicator.css';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        setSyncing(true);
        // Sync will complete automatically via offlineQueue
        setTimeout(() => setSyncing(false), 2000);
      }
    };

    const updateQueuedActions = async () => {
      const actions = await getAllQueuedActions();
      setQueuedActions(actions);
    };

    // Initial load
    updateQueuedActions();

    // Setup listeners
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Poll for queued actions every 2 seconds
    const intervalId = setInterval(updateQueuedActions, 2000);

    // Listen for sync completion
    const unsubscribe = offlineQueue.onSyncComplete((success) => {
      setSyncing(false);
      updateQueuedActions();
      if (success) {
        console.log('[OfflineIndicator] Sync completed successfully');
      }
    });

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(intervalId);
      unsubscribe();
    };
  }, []);

  const pendingActions = queuedActions.filter(a => a.status === 'pending' || a.status === 'syncing');
  const failedActions = queuedActions.filter(a => a.status === 'failed');

  const handleManualSync = () => {
    setSyncing(true);
    offlineQueue.forceSyncNow().finally(() => {
      setSyncing(false);
    });
  };

  const getActionLabel = (action: QueuedAction): string => {
    switch (action.type) {
      case 'checkin':
        return 'Check-in';
      case 'checkout':
        return 'Check-out';
      case 'create-member':
        return 'New member';
      case 'create-event':
        return 'Create event';
      case 'end-event':
        return 'End event';
      case 'update-activity':
        return 'Update activity';
      default:
        return 'Action';
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // Don't show anything if we're online and have no pending actions
  if (isOnline && pendingActions.length === 0 && failedActions.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="offline-indicator"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className={`offline-indicator__banner ${isOnline ? 'online' : 'offline'}`}>
          <div className="offline-indicator__status">
            <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
            <span className="status-text">
              {!isOnline && 'Offline - Changes will sync when connected'}
              {isOnline && syncing && 'Syncing...'}
              {isOnline && !syncing && pendingActions.length > 0 && `${pendingActions.length} action(s) pending`}
              {isOnline && !syncing && pendingActions.length === 0 && failedActions.length > 0 && `${failedActions.length} action(s) failed`}
              {isOnline && !syncing && pendingActions.length === 0 && failedActions.length === 0 && 'All changes synced'}
            </span>
          </div>

          {(pendingActions.length > 0 || failedActions.length > 0) && (
            <div className="offline-indicator__actions">
              <button
                className="view-queue-btn"
                onClick={() => setShowQueue(!showQueue)}
                aria-label={showQueue ? 'Hide queue' : 'Show queue'}
              >
                {showQueue ? 'Hide' : 'View'} ({pendingActions.length + failedActions.length})
              </button>
              {isOnline && pendingActions.length > 0 && (
                <button
                  className="sync-now-btn"
                  onClick={handleManualSync}
                  disabled={syncing}
                  aria-label="Sync now"
                >
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {showQueue && (pendingActions.length > 0 || failedActions.length > 0) && (
            <motion.div
              className="offline-indicator__queue"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="queue-header">
                <h3>Queued Actions</h3>
              </div>
              <div className="queue-list">
                {pendingActions.map((action) => (
                  <div key={action.id} className={`queue-item ${action.status}`}>
                    <div className="queue-item__icon">
                      {action.status === 'syncing' ? '⏳' : '⏸️'}
                    </div>
                    <div className="queue-item__details">
                      <div className="queue-item__label">{getActionLabel(action)}</div>
                      <div className="queue-item__time">{formatTimestamp(action.timestamp)}</div>
                    </div>
                    <div className="queue-item__status">
                      {action.status === 'syncing' ? 'Syncing...' : 'Pending'}
                    </div>
                  </div>
                ))}
                {failedActions.map((action) => (
                  <div key={action.id} className="queue-item failed">
                    <div className="queue-item__icon">❌</div>
                    <div className="queue-item__details">
                      <div className="queue-item__label">{getActionLabel(action)}</div>
                      <div className="queue-item__time">{formatTimestamp(action.timestamp)}</div>
                      {action.error && (
                        <div className="queue-item__error">{action.error}</div>
                      )}
                    </div>
                    <div className="queue-item__status">
                      Failed ({action.retryCount} retries)
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
