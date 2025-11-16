// Sync Service v2 - Uses batch sync API and sync queue
class SyncService {
  constructor() {
    this.apiUrl = this.getApiUrl();
    this.isSyncing = false;
  }

  getApiUrl() {
    if (window.location.hostname.includes('repl.co') || window.location.hostname.includes('replit.app')) {
      return '';
    }
    return window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
  }

  /**
   * Get full user data with contacts from server (v2 API)
   */
  async syncFromServer() {
    if (this.isSyncing) return { success: false, error: 'Already syncing' };

    console.log('[SyncV2] Starting sync FROM server');
    this.isSyncing = true;

    try {
      const token = window.authService.token;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${this.apiUrl}/api/v2/contacts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      console.log(`[SyncV2] Received ${data.contacts.length} contacts from server`);

      if (data.contacts.length > 0) {
        for (const contact of data.contacts) {
          await window.storage.saveContact(contact, true);
        }
        console.log('[SyncV2] Local database updated with server data');
      }

      this.isSyncing = false;
      return { success: true, contacts: data.contacts };

    } catch (error) {
      console.error('[SyncV2] Sync from server error:', error);
      this.isSyncing = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Push local sync queue to server (v2 batch sync API)
   */
  async syncToServer() {
    if (this.isSyncing) {
      console.warn('[SyncV2] Already syncing, skipping');
      return { success: false, error: 'Already syncing' };
    }

    const token = window.authService.token;
    if (!token) {
      console.warn('[SyncV2] Not authenticated, cannot sync');
      return { success: false, error: 'Not authenticated' };
    }

    console.log('[SyncV2] Starting sync TO server');
    this.isSyncing = true;

    try {
      const pendingItems = await window.storage.getPendingSyncItems();
      console.log(`[SyncV2] Preparing to sync ${pendingItems.length} items from queue`);

      if (pendingItems.length === 0) {
        console.log('[SyncV2] No pending items to sync');
        this.isSyncing = false;
        return { success: true, synced: 0 };
      }

      const operations = pendingItems.map(item => ({
        entityType: item.entityType,
        action: item.action,
        entityId: item.entityId,
        entityData: item.entityData
      }));

      console.log('[SyncV2] Sending batch sync request...');
      const response = await fetch(`${this.apiUrl}/api/v2/sync/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ operations })
      });

      console.log('[SyncV2] Response received, status:', response.status);
      const data = await response.json();
      console.log('[SyncV2] Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || `Sync failed: ${response.status}`);
      }

      console.log(`[SyncV2] Successfully synced ${data.processed} operations to server`);

      for (const item of pendingItems) {
        try {
          await window.storage.removeSyncItem(item.id);
          console.log('[SyncV2] Removed item from sync queue:', item.id);
        } catch (err) {
          console.warn('[SyncV2] Failed to remove item from queue:', item.id, err);
        }
      }

      this.isSyncing = false;
      return {
        success: true,
        synced: data.processed,
        conflicts: data.conflicts || [],
        errors: data.errors || []
      };

    } catch (error) {
      console.error('[SyncV2] Sync to server error:', error);
      this.isSyncing = false;
      if (window.app) {
        window.app.showWarning(`Sync failed: ${error.message}. Data saved locally only.`);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Full two-way sync using sync queue
   */
  async syncFull() {
    if (this.isSyncing) return { success: false, error: 'Already syncing' };

    console.log('[SyncV2] Starting FULL sync');

    try {
      const pushResult = await this.syncToServer();

      if (!pushResult.success) {
        console.warn('[SyncV2] Push failed, attempting pull only');
      }

      const pullResult = await this.syncFromServer();

      if (!pullResult.success) {
        console.error('[SyncV2] Pull failed');
        return { success: false, error: pullResult.error };
      }

      console.log('[SyncV2] Full sync completed successfully');
      return {
        success: true,
        pushed: pushResult.synced || 0,
        pulled: pullResult.contacts?.length || 0
      };

    } catch (error) {
      console.error('[SyncV2] Full sync error:', error);
      return { success: false, error: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Perform initial sync after login (server-wins)
   */
  async initialSync() {
    const user = window.authService.getCurrentUser();
    console.log('[SyncV2] Performing initial sync for user:', user?.id);

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      await window.storage.clearAllData();
      const response = await fetch(`${this.apiUrl}/api/v2/contacts`, {
        headers: {
          'Authorization': `Bearer ${window.authService.token}`
        }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Initial sync failed');
      }

      console.log(`[SyncV2] Initial sync received ${data.contacts.length} contacts`);

      if (data.contacts.length > 0) {
        for (const contact of data.contacts) {
          await window.storage.saveContact(contact, true);
        }
      }

      return { success: true, contacts: data.contacts };

    } catch (error) {
      console.error('[SyncV2] Initial sync error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing
    };
  }

  /**
   * Reset sync state
   */
  reset() {
    this.isSyncing = false;
    console.log('[SyncV2] Sync state reset');
  }
}

// Export singleton instance
window.syncService = new SyncService();
