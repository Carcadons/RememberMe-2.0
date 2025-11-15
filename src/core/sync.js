// Sync Service - Synchronizes contacts with Replit Database
class SyncService {
  constructor() {
    this.apiUrl = this.getApiUrl();
    this.isSyncing = false;
    this.lastSyncTime = localStorage.getItem('rememberme_lastSync') || null;
  }

  getApiUrl() {
    // For Replit deployment
    if (window.location.hostname.includes('repl.co') || window.location.hostname.includes('replit.app')) {
      return '';
    }
    // For local development
    return window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
  }

  /**
   * Get full user data with contacts from server
   * @param {string} userId
   */
  async syncFromServer(userId) {
    if (this.isSyncing) return { success: false, error: 'Already syncing' };

    console.log('[Sync] Starting sync FROM server for user:', userId);
    this.isSyncing = true;

    try {
      // Get contacts from server
      const response = await fetch(
        `${this.apiUrl}/api/sync/contacts?userId=${userId}${this.lastSyncTime ? `&since=${this.lastSyncTime}` : ''}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      console.log(`[Sync] Received ${data.contacts.length} contacts from server`);

      if (data.contacts.length > 0) {
        // Clear local data and replace with server data
        await window.storage.clearAllContacts();

        // Save server contacts locally
        for (const contact of data.contacts) {
          await window.storage.saveContact(contact, false); // false = don't sync back
        }

        console.log('[Sync] Local database updated with server data');
      }

      // Update last sync time
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('rememberme_lastSync', this.lastSyncTime);

      this.isSyncing = false;
      return { success: true, contacts: data.contacts };

    } catch (error) {
      console.error('[Sync] Sync from server error:', error);
      this.isSyncing = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Push local contacts to server
   * @param {string} userId
   */
  async syncToServer(userId) {
    if (this.isSyncing) return { success: false, error: 'Already syncing' };

    console.log('[Sync] Starting sync TO server for user:', userId);
    this.isSyncing = true;

    try {
      // Get all local contacts
      const localContacts = await window.storage.getAllContacts();
      console.log(`[Sync] Preparing to sync ${localContacts.length} contacts to server`);

      if (localContacts.length === 0) {
        this.isSyncing = false;
        return { success: true, synced: 0 };
      }

      // Send to server
      const response = await fetch(`${this.apiUrl}/api/sync/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          contacts: localContacts
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      console.log(`[Sync] Successfully synced ${data.synced} contacts to server`);

      // Update last sync time
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('rememberme_lastSync', this.lastSyncTime);

      this.isSyncing = false;
      return { success: true, synced: data.synced };

    } catch (error) {
      console.error('[Sync] Sync to server error:', error);
      this.isSyncing = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Full two-way sync (bi-directional)
   * Server is the source of truth
   * @param {string} userId
   */
  async syncFull(userId) {
    if (this.isSyncing) return { success: false, error: 'Already syncing' };

    console.log('[Sync] Starting FULL sync for user:', userId);

    try {
      // First, push local changes to server
      const pushResult = await this.syncToServer(userId);

      if (!pushResult.success) {
        console.warn('[Sync] Push failed, attempting pull only');
      }

      // Then, pull from server (server wins on conflicts)
      const pullResult = await this.syncFromServer(userId);

      if (!pullResult.success) {
        console.error('[Sync] Pull failed');
        return { success: false, error: pullResult.error };
      }

      console.log('[Sync] Full sync completed successfully');
      return {
        success: true,
        pushed: pushResult.synced || 0,
        pulled: pullResult.contacts?.length || 0
      };

    } catch (error) {
      console.error('[Sync] Full sync error:', error);
      return { success: false, error: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Perform initial sync after login
   * This completely replaces local data with server data
   * @param {string} userId
   */
  async initialSync(userId) {
    console.log('[Sync] Performing initial sync for user:', userId);

    try {
      // Clear local data completely
      await window.storage.clearAllContacts();

      // Get all data from server
      const response = await fetch(`${this.apiUrl}/api/sync/contacts?userId=${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Initial sync failed');
      }

      console.log(`[Sync] Initial sync received ${data.contacts.length} contacts`);

      // Save all server data locally
      if (data.contacts.length > 0) {
        for (const contact of data.contacts) {
          await window.storage.saveContact(contact, false);
        }
      }

      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('rememberme_lastSync', this.lastSyncTime);

      return { success: true, contacts: data.contacts };

    } catch (error) {
      console.error('[Sync] Initial sync error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync in background without blocking UI
   * @param {string} userId
   */
  async syncInBackground(userId) {
    if (this.isSyncing) {
      console.log('[Sync] Background sync skipped - already syncing');
      return;
    }

    console.log('[Sync] Starting background sync');

    try {
      await this.syncFull(userId);
    } catch (error) {
      console.error('[Sync] Background sync error:', error);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      hasSynced: !!this.lastSyncTime
    };
  }

  /**
   * Reset sync state (useful on logout)
   */
  reset() {
    this.isSyncing = false;
    this.lastSyncTime = null;
    localStorage.removeItem('rememberme_lastSync');
    console.log('[Sync] Sync state reset');
  }
}

// Export singleton instance
window.syncService = new SyncService();
