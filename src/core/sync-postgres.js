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
        await window.storage.clearAllContacts();

        for (const contact of data.contacts) {
          await window.storage.saveContact(contact, false);
        }

        console.log('[Sync] Local database updated with server data');
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
    if (this.isSyncing) return { success: false, error: 'Already syncing' };

    const token = this.getAuthToken();
    if (!token) return { success: false, error: 'Not authenticated' };

    console.log('[Sync] Starting sync TO server');
    this.isSyncing = true;

    try {
      // Only sync unsynced contacts to avoid duplicates
      const unsyncedContacts = await window.storage.getUnsynced('contacts');
      console.log(`[Sync] Preparing to sync ${unsyncedContacts.length} unsynced contacts to server`);

      if (unsyncedContacts.length === 0) {
        this.isSyncing = false;
        return { success: true, synced: 0 };
      }

      const response = await fetch(`${this.apiUrl}/api/contacts/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contacts: unsyncedContacts })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      console.log(`[Sync] Successfully synced ${data.synced} contacts to server`);

      // Mark contacts as synced locally
      for (const contact of unsyncedContacts) {
        try {
          await window.storage.markAsSynced('contacts', contact.id);
        } catch (err) {
          console.warn('[Sync] Failed to mark contact as synced:', contact.id, err);
        }
      }

      this.isSyncing = false;
      return { success: true, synced: data.synced };
    } catch (error) {
      console.error('[Sync] Sync to server error:', error);
      this.isSyncing = false;
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
      const result = await this.syncFull();
      return result;
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
