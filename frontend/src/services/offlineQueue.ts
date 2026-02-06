import {
  addToQueue,
  getPendingActions,
  updateQueuedAction,
  removeFromQueue,
  clearSyncedActions,
  type QueuedAction,
} from './offlineStorage';

type SyncCallback = (success: boolean, error?: string) => void;

class OfflineQueueManager {
  private syncInProgress = false;
  private syncCallbacks: SyncCallback[] = [];
  private onlineListener: (() => void) | null = null;

  constructor() {
    // Initialize online/offline event listeners
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for online/offline detection
   */
  private setupEventListeners() {
    this.onlineListener = () => {
      console.log('[OfflineQueue] Connection restored, syncing pending actions...');
      this.syncPendingActions();
    };

    window.addEventListener('online', this.onlineListener);
  }

  /**
   * Cleanup event listeners
   */
  public cleanup() {
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
    }
  }

  /**
   * Check if the device is online
   */
  public isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Queue an action for later sync
   */
  public async queueAction(
    type: QueuedAction['type'],
    endpoint: string,
    method: QueuedAction['method'],
    data: unknown
  ): Promise<string> {
    const id = await addToQueue({
      type,
      endpoint,
      method,
      data,
    });

    // If we're online, try to sync immediately
    if (this.isOnline()) {
      setTimeout(() => this.syncPendingActions(), 100);
    }

    return id;
  }

  /**
   * Sync all pending actions when connection is restored
   */
  public async syncPendingActions(): Promise<void> {
    if (this.syncInProgress) {
      console.log('[OfflineQueue] Sync already in progress, skipping...');
      return;
    }

    if (!this.isOnline()) {
      console.log('[OfflineQueue] Device is offline, cannot sync');
      return;
    }

    this.syncInProgress = true;
    console.log('[OfflineQueue] Starting sync...');

    try {
      const pendingActions = await getPendingActions();
      console.log(`[OfflineQueue] Found ${pendingActions.length} pending actions`);

      let successCount = 0;
      let failCount = 0;

      for (const action of pendingActions) {
        try {
          await this.syncAction(action);
          successCount++;
        } catch (error) {
          console.error('[OfflineQueue] Failed to sync action:', action, error);
          failCount++;
          
          // Update retry count and mark as failed if too many retries
          const newRetryCount = action.retryCount + 1;
          if (newRetryCount >= 3) {
            await updateQueuedAction(action.id, {
              status: 'failed',
              retryCount: newRetryCount,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          } else {
            await updateQueuedAction(action.id, {
              retryCount: newRetryCount,
              status: 'pending',
            });
          }
        }
      }

      console.log(`[OfflineQueue] Sync complete. Success: ${successCount}, Failed: ${failCount}`);

      // Clear synced actions
      await clearSyncedActions();

      // Notify callbacks
      this.notifyCallbacks(failCount === 0);
    } catch (error) {
      console.error('[OfflineQueue] Sync error:', error);
      this.notifyCallbacks(false, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync a single action
   */
  private async syncAction(action: QueuedAction): Promise<void> {
    console.log('[OfflineQueue] Syncing action:', action);

    // Mark as syncing
    await updateQueuedAction(action.id, { status: 'syncing' });

    // Determine the base URL
    const apiBase = import.meta.env.VITE_API_URL || 
      (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');
    const baseUrl = apiBase.endsWith('/api') ? apiBase : `${apiBase.replace(/\/$/, '')}/api`;
    
    // Construct full URL
    const url = action.endpoint.startsWith('http') 
      ? action.endpoint 
      : `${baseUrl}${action.endpoint.startsWith('/') ? '' : '/'}${action.endpoint}`;

    const response = await fetch(url, {
      method: action.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(action.data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // Mark as synced
    await updateQueuedAction(action.id, { status: 'synced' });
    
    // Remove from queue after a delay (so UI can show it was synced)
    setTimeout(() => {
      removeFromQueue(action.id);
    }, 2000);
  }

  /**
   * Add a callback to be notified when sync completes
   */
  public onSyncComplete(callback: SyncCallback): () => void {
    this.syncCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all callbacks
   */
  private notifyCallbacks(success: boolean, error?: string) {
    for (const callback of this.syncCallbacks) {
      try {
        callback(success, error);
      } catch (err) {
        console.error('[OfflineQueue] Error in sync callback:', err);
      }
    }
  }

  /**
   * Get count of pending actions
   */
  public async getPendingCount(): Promise<number> {
    const pending = await getPendingActions();
    return pending.length;
  }

  /**
   * Force sync now (for manual trigger)
   */
  public forceSyncNow(): Promise<void> {
    return this.syncPendingActions();
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueueManager();
