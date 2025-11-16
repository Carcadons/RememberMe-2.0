// Sync Service - PostgreSQL Version
// Synchronizes contacts with PostgreSQL backend

class SyncService {
  constructor() {
    this.apiUrl = this.getApiUrl();
    this.isSyncing = false;
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
   * Get authentication token
   */
  getAuthToken() {
    const token = localStorage.getItem('rememberme_token');
    return token;
  }

  /**
   * Sync contacts from server
   */
  async syncFromServer() {
    if (this.isSyncing) return { success: false, error: 'Already syncing' };

    const token = this.getAuthToken();
    if (!token) return { success: false, error: 'Not authenticated' };

    console.log('[Sync] Starting sync FROM server');
    this.isSyncing = true;

    try {
      const response = await fetch(`${this.apiUrl}/api/contacts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      console.log(`[Sync] Received ${data.contacts.length} contacts from server`);

      if (data.contacts.length > 0) {
        // Don't clear contacts first - just overwrite/add them
        // This prevents data loss if sync fails
        console.log('[Sync] Saving contacts to local database...');

        for (const contact of data.contacts) {
          // Mark as synced so they don't get pushed back to server
          await window.storage.saveContact({ ...contact, synced: true }, false);
        }

        console.log('[Sync] Local database updated with server data');
      } else {
        console.log('[Sync] No contacts on server');
      }

      this.isSyncing = false;
      return { success: true, contacts: data.contacts };
    } catch (error) {
      console.error('[Sync] Sync from server error:', error);
      this.isSyncing = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync contacts to server
   */
  async syncToServer() {
    if (this.isSyncing) {
      console.warn('[Sync] Already syncing, skipping');
      return { success: false, error: 'Already syncing' };
    }

    const token = this.getAuthToken();
    if (!token) {
      console.warn('[Sync] Not authenticated, cannot sync');
      return { success: false, error: 'Not authenticated' };
    }

    console.log('[Sync] Starting sync TO server');
    this.isSyncing = true;

    try {
      // Only sync unsynced contacts to avoid duplicates
      const unsyncedContacts = await window.storage.getUnsynced('contacts');
      console.log(`[Sync] Preparing to sync ${unsyncedContacts.length} unsynced contacts to server`);

      if (unsyncedContacts.length === 0) {
        console.log('[Sync] No unsynced contacts to sync');
        this.isSyncing = false;
        return { success: true, synced: 0 };
      }

      console.log('[Sync] Sending request to server...');
      const response = await fetch(`${this.apiUrl}/api/contacts/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contacts: unsyncedContacts })
      });

      console.log('[Sync] Response received, status:', response.status);
      const data = await response.json();
      console.log('[Sync] Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || `Sync failed: ${response.status}`);
      }

      console.log(`[Sync] Successfully synced ${data.synced} contacts to server`);

      // Mark contacts as synced locally
      console.log('[Sync] Marking contacts as synced locally...');
      for (const contact of unsyncedContacts) {
        try {
          await window.storage.markAsSynced('contacts', contact.id);
          console.log('[Sync] Marked contact as synced:', contact.id);
        } catch (err) {
          console.warn('[Sync] Failed to mark contact as synced:', contact.id, err);
        }
      }

      this.isSyncing = false;
      return { success: true, synced: data.synced };
    } catch (error) {
      console.error('[Sync] Sync to server error:', error);
      this.isSyncing = false;
      // Show error to user
      if (window.app) {
        window.app.showWarning(`Sync failed: ${error.message}. Data saved locally only.`);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Full two-way sync
   */
  async syncFull() {
    if (this.isSyncing) return { success: false, error: 'Already syncing' };

    try {
      const pushResult = await this.syncToServer();
      const pullResult = await this.syncFromServer();

      if (!pullResult.success) {
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
   * Initial sync after login
   */
  async initialSync() {
    console.log('[Sync] Performing initial sync');

    try {
      // First, push any unsynced changes
      console.log('[Sync] Step 1: Pushing unsynced changes to server');
      const pushResult = await this.syncToServer();

      if (!pushResult.success) {
        console.warn('[Sync] Push failed:', pushResult.error);
      } else {
        console.log(`[Sync] Push successful, synced ${pushResult.synced || 0} contacts`);
      }

      // Then, pull from server (this is the critical part for login)
      console.log('[Sync] Step 2: Pulling contacts from server');
      const pullResult = await this.syncFromServer();

      if (!pullResult.success) {
        console.error('[Sync] Pull failed:', pullResult.error);
        return { success: false, error: pullResult.error };
      }

      console.log(`[Sync] Initial sync complete, loaded ${pullResult.contacts?.length || 0} contacts from server`);

      return {
        success: true,
        contacts: pullResult.contacts || [],
        pushed: pushResult.synced || 0,
        pulled: pullResult.contacts?.length || 0
      };
    } catch (error) {
      console.error('[Sync] Initial sync error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      isAuthenticated: !!this.getAuthToken()
    };
  }

  /**
   * Reset sync state
   */
  reset() {
    this.isSyncing = false;
    console.log('[Sync] Sync state reset');
  }
}

// Export singleton instance
window.syncService = new SyncService();
