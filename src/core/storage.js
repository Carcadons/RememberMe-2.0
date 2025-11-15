// Local Storage Layer for RememberMe
// Handles IndexedDB operations with encryption

class Storage {
  constructor() {
    this.dbName = 'RememberMeDB';
    this.dbVersion = 1;
    this.db = null;
    this.encryptionEnabled = false;
    this.passcode = null;
    this.encryptionKey = null;
  }

  /**
   * Initialize the database
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[Storage] Database initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[Storage] Upgrading database to version', this.dbVersion);

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('contacts')) {
          const contactStore = db.createObjectStore('contacts', { keyPath: 'id' });
          contactStore.createIndex('name', 'name', { unique: false });
          contactStore.createIndex('company', 'company', { unique: false });
          contactStore.createIndex('lastMet', 'lastMet', { unique: false });
          contactStore.createIndex('starred', 'starred', { unique: false });
          console.log('[Storage] Created contacts store');
        }

        if (!db.objectStoreNames.contains('meetings')) {
          const meetingStore = db.createObjectStore('meetings', { keyPath: 'id' });
          meetingStore.createIndex('date', 'date', { unique: false });
          meetingStore.createIndex('personId', 'personId', { unique: false });
          console.log('[Storage] Created meetings store');
        }

        if (!db.objectStoreNames.contains('sync')) {
          db.createObjectStore('sync', { keyPath: 'id' });
          console.log('[Storage] Created sync store');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
          console.log('[Storage] Created settings store');
        }
      };
    });
  }

  /**
   * Enable encryption with passcode
   * @param {string} passcode - User passcode
   */
  async enableEncryption(passcode) {
    try {
      this.passcode = passcode;
      this.encryptionEnabled = true;

      // Store passcode hash for authentication
      const salt = window.encryption.generateSalt();
      const hash = await window.encryption.hashPasscode(passcode, salt);

      await this.setSetting('passcodeHash', hash);
      await this.setSetting('passcodeSalt', window.encryption.arrayBufferToBase64(salt));
      await this.setSetting('encryptionEnabled', 'true');

      console.log('[Storage] Encryption enabled');
    } catch (error) {
      console.error('[Storage] Failed to enable encryption:', error);
      throw error;
    }
  }

  /**
   * Verify passcode
   * @param {string} passcode - Passcode to verify
   * @returns {Promise<boolean>}
   */
  async verifyPasscode(passcode) {
    try {
      const storedHash = await this.getSetting('passcodeHash');
      const storedSalt = await this.getSetting('passcodeSalt');

      if (!storedHash || !storedSalt) {
        return false;
      }

      return await window.encryption.verifyPasscode(passcode, storedHash, storedSalt);
    } catch (error) {
      console.error('[Storage] Passcode verification error:', error);
      return false;
    }
  }

  /**
   * Check if encryption is enabled
   * @returns {Promise<boolean>}
   */
  async isEncryptionEnabled() {
    if (this.encryptionEnabled) return true;

    const enabled = await this.getSetting('encryptionEnabled');
    this.encryptionEnabled = enabled === 'true';
    return this.encryptionEnabled;
  }

  /**
   * Encrypt data if encryption is enabled
   * @param {Object} data - Data to encrypt
   * @returns {Promise<Object>} - Encrypted or plain data
   */
  async encryptIfEnabled(data) {
    try {
      const encryptionEnabled = await this.isEncryptionEnabled();
      console.log('[Storage] encryptIfEnabled - encryptionEnabled:', encryptionEnabled, 'passcode:', !!this.passcode);

      if (!encryptionEnabled || !this.passcode) {
        console.log('[Storage] Not encrypting, returning data as-is', data);
        return data;
      }

      console.log('[Storage] About to encrypt object with passcode');
      const encrypted = await window.encryption.encryptObject(data, this.passcode);
      console.log('[Storage] Encryption successful');
      return encrypted;
    } catch (error) {
      console.error('[Storage] Encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt data if encryption is enabled
   * @param {Object} data - Data to decrypt
   * @returns {Promise<Object>} - Decrypted or plain data
   */
  async decryptIfEnabled(data) {
    const encryptionEnabled = await this.isEncryptionEnabled();

    if (!encryptionEnabled || !this.passcode) {
      return data;
    }

    // Check if data is encrypted (has encrypted field)
    if (!data.encrypted) {
      return data;
    }

    try {
      return await window.encryption.decryptObject(data, this.passcode);
    } catch (error) {
      console.error('[Storage] Decryption failed:', error);
      throw error;
    }
  }

  // === CONTACT OPERATIONS ===

  /**
   * Add or update a contact
   * @param {Object} contact - Contact data
   * @returns {Promise<string>} - Contact ID
   */
  async saveContact(contact) {
    console.log('[Storage] saveContact called with:', contact);

    try {
      if (!this.db) {
        console.log('[Storage] Db not initialized, calling init...');
        await this.init();
      }

      const contactId = contact.id || window.encryption.generateId();
      console.log('[Storage] Generated contact ID:', contactId);

      const now = new Date().toISOString();

      const contactData = {
        ...contact,
        id: contactId,
        createdAt: contact.createdAt || now,
        updatedAt: now,
        synced: false
      };

      console.log('[Storage] Contact data prepared:', contactData);

      // Encrypt if enabled
      console.log('[Storage] About to encrypt (if enabled)...');
      const dataToStore = await this.encryptIfEnabled(contactData);
      console.log('[Storage] Data encrypted (or not), about to save to IndexedDB...');

      return new Promise((resolve, reject) => {
        console.log('[Storage] Creating transaction...');
        const transaction = this.db.transaction(['contacts'], 'readwrite');
        const store = transaction.objectStore('contacts');
        console.log('[Storage] About to call store.put...');
        const request = store.put(dataToStore);

        request.onsuccess = async () => {
          console.log('[Storage] Contact saved successfully:', contactId);

          // Auto-sync to server if user is logged in
          try {
            if (window.authService && window.authService.isAuthenticated && window.syncService) {
              const user = window.authService.getCurrentUser();
              if (user && user.id) {
                console.log('[Storage] Auto-syncing contact to server...');
                await window.syncService.syncInBackground(user.id);
                console.log('[Storage] Auto-sync complete');
              }
            }
          } catch (syncError) {
            console.warn('[Storage] Auto-sync failed:', syncError);
            // Don't reject the save just because sync failed
          }

          resolve(contactId);
        };

        request.onerror = () => {
          console.error('[Storage] Error saving contact:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[Storage] Exception in saveContact:', error);
      throw error;
    }
  }

  /**
   * Get a contact by ID
   * @param {string} id - Contact ID
   * @returns {Promise<Object>}
   */
  async getContact(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['contacts'], 'readonly');
      const store = transaction.objectStore('contacts');
      const request = store.get(id);

      request.onsuccess = async () => {
        if (request.result) {
          const decrypted = await this.decryptIfEnabled(request.result);
          resolve(decrypted);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all contacts
   * @returns {Promise<Array>}
   */
  async getAllContacts() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['contacts'], 'readonly');
      const store = transaction.objectStore('contacts');
      const request = store.getAll();

      request.onsuccess = async () => {
        const contacts = [];
        for (const contact of request.result) {
          try {
            const decrypted = await this.decryptIfEnabled(contact);
            contacts.push(decrypted);
          } catch (error) {
            console.error('[Storage] Failed to decrypt contact:', error);
          }
        }
        resolve(contacts);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Search contacts
   * @param {string} query - Search query
   * @returns {Promise<Array>}
   */
  async searchContacts(query) {
    const contacts = await this.getAllContacts();

    if (!query) return contacts;

    const lowerQuery = query.toLowerCase();
    return contacts.filter(contact => {
      return (
        contact.name?.toLowerCase().includes(lowerQuery) ||
        contact.company?.toLowerCase().includes(lowerQuery) ||
        contact.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        contact.quickFacts?.some(fact => fact.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * Delete a contact
   * @param {string} id - Contact ID
   * @returns {Promise<void>}
   */
  async deleteContact(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['contacts'], 'readwrite');
      const store = transaction.objectStore('contacts');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('[Storage] Contact deleted:', id);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // === MEETING OPERATIONS ===

  /**
   * Save a meeting
   * @param {Object} meeting - Meeting data
   */
  async saveMeeting(meeting) {
    if (!this.db) await this.init();

    const meetingId = meeting.id || window.encryption.generateId();
    const now = new Date().toISOString();

    const meetingData = {
      ...meeting,
      id: meetingId,
      createdAt: meeting.createdAt || now,
      updatedAt: now,
      synced: false
    };

    const dataToStore = await this.encryptIfEnabled(meetingData);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['meetings'], 'readwrite');
      const store = transaction.objectStore('meetings');
      const request = store.put(dataToStore);

      request.onsuccess = () => {
        console.log('[Storage] Meeting saved:', meetingId);
        resolve(meetingId);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get meetings for today
   * @returns {Promise<Array>}
   */
  async getTodaysMeetings() {
    const allMeetings = await this.getAllMeetings();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return allMeetings.filter(meeting => {
      const meetingDate = new Date(meeting.date);
      return meetingDate >= today && meetingDate < tomorrow;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Get a meeting by ID
   * @param {string} id - Meeting ID
   * @returns {Promise<Object>}
   */
  async getMeeting(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['meetings'], 'readonly');
      const store = transaction.objectStore('meetings');
      const request = store.get(id);

      request.onsuccess = async () => {
        if (request.result) {
          const decrypted = await this.decryptIfEnabled(request.result);
          resolve(decrypted);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all meetings
   * @returns {Promise<Array>}
   */
  async getAllMeetings() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['meetings'], 'readonly');
      const store = transaction.objectStore('meetings');
      const request = store.getAll();

      request.onsuccess = async () => {
        const meetings = [];
        for (const meeting of request.result) {
          try {
            const decrypted = await this.decryptIfEnabled(meeting);
            meetings.push(decrypted);
          } catch (error) {
            console.error('[Storage] Failed to decrypt meeting:', error);
          }
        }
        resolve(meetings);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // === SETTINGS OPERATIONS ===

  /**
   * Set a setting
   * @param {string} key - Setting key
   * @param {string} value - Setting value
   */
  async setSetting(key, value) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a setting
   * @param {string} key - Setting key
   */
  async getSetting(key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get unsynced items for sync
   * @param {string} storeName - Store name
   * @returns {Promise<Array>}
   */
  async getUnsynced(storeName) {
    const allItems = storeName === 'contacts'
      ? await this.getAllContacts()
      : await this.getAllMeetings();

    return allItems.filter(item => !item.synced);
  }

  /**
   * Mark item as synced
   * @param {string} storeName - Store name
   * @param {string} id - Item ID
   */
  async markAsSynced(storeName, id) {
    if (!this.db) await this.init();

    const item = storeName === 'contacts'
      ? await this.getContact(id)
      : await this.getMeeting(id);

    if (!item) return;

    item.synced = true;
    item.syncedAt = new Date().toISOString();

    if (storeName === 'contacts') {
      await this.saveContact(item);
    } else {
      await this.saveMeeting(item);
    }
  }

  /**
   * Clear all contacts (for logout)
   */
  async clearAllContacts() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['contacts'], 'readwrite');
      const store = transaction.objectStore('contacts');
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[Storage] All contacts cleared');
        resolve();
      };

      request.onerror = () => {
        console.error('[Storage] Error clearing contacts:', request.error);
        reject(request.error);
      };
    });
  }
}

// Export singleton instance
window.storage = new Storage();
