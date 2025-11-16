// Storage Layer v2 - Offline-first with sync queue
// Proper IndexedDB schema with sync state tracking

class StorageV2 {
  constructor() {
    this.dbName = 'RememberMeDB_v2';
    this.dbVersion = 2;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[StorageV2] Database initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log(`[StorageV2] Upgrading database to version ${this.dbVersion}`);

        const stores = [
          {
            name: 'contacts',
            keyPath: 'id',
            indexes: [
              { name: 'userId', keyPath: 'userId', options: { unique: false } },
              { name: 'serverId', keyPath: 'serverId', options: { unique: false } },
              { name: 'syncState', keyPath: 'syncState', options: { unique: false } },
              { name: 'userLastModified', keyPath: ['userId', 'lastModified'], options: { unique: false } }
            ]
          },
          {
            name: 'meetings',
            keyPath: 'id',
            indexes: [
              { name: 'userId', keyPath: 'userId', options: { unique: false } },
              { name: 'contactId', keyPath: 'contactId', options: { unique: false } },
              { name: 'syncState', keyPath: 'syncState', options: { unique: false } },
              { name: 'scheduledDate', keyPath: 'scheduledDate', options: { unique: false } }
            ]
          },
          {
            name: 'syncQueue',
            keyPath: 'id',
            indexes: [
              { name: 'entityType', keyPath: 'entityType', options: { unique: false } },
              { name: 'userId', keyPath: 'userId', options: { unique: false } },
              { name: 'status', keyPath: 'status', options: { unique: false } },
              { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } }
            ]
          },
          {
            name: 'userData',
            keyPath: 'userId'
          }
        ];

        for (const storeConfig of stores) {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, { keyPath: storeConfig.keyPath });
            console.log(`[StorageV2] Created store: ${storeConfig.name}`);

            for (const index of storeConfig.indexes || []) {
              store.createIndex(index.name, index.keyPath, index.options);
              console.log(`[StorageV2] Created index: ${storeConfig.name}.${index.name}`);
            }
          }
        }
      };
    });
  }

  createId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get current user ID (enforces authentication)
   * @private
   */
  getCurrentUserId() {
    const user = window.authService?.getCurrentUser();
    if (!user || !user.id) {
      throw new Error('User not authenticated. Cannot perform data operations.');
    }
    return user.id;
  }

  getCurrentUserIdOrNull() {
    return window.authService?.getCurrentUser()?.id || null;
  }

  // ===== CONTACT OPERATIONS =====

  /**
   * Save contact (enforces userId association)
   * @param {Object} contact
   * @param {boolean} skipSyncQueue - Don't add to sync queue (default false)
   * @returns {Promise<string>} Contact ID
   */
  async saveContact(contact, skipSyncQueue = false) {
    if (!this.db) await this.init();

    const userId = this.getCurrentUserId();
    const now = new Date().toISOString();

    // Validate required fields
    if (!contact.firstName) {
      throw new Error('Contact must have firstName');
    }

    const contactId = contact.id || this.createId();

    const contactData = {
      id: contactId,
      serverId: contact.serverId || null,
      userId: userId,
      firstName: contact.firstName,
      lastName: contact.lastName || '',
      company: contact.company || '',
      jobTitle: contact.jobTitle || '',
      email: contact.email || '',
      phone: contact.phone || '',
      notes: contact.notes || '',
      lastMetDate: contact.lastMetDate || null,
      howWeMet: contact.howWeMet || '',
      location: contact.location || '',
      tags: contact.tags || [],
      quickFacts: contact.quickFacts || [],
      lastModified: now,
      lastSynced: contact.lastSynced || null,
      syncState: contact.syncState || 'pending',
      serverVersion: contact.serverVersion || 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['contacts'], 'readwrite');
      const store = transaction.objectStore('contacts');
      const request = store.put(contactData);

      request.onsuccess = async () => {
        console.log(`[StorageV2] Contact saved: ${contactId}`);

        // Add to sync queue
        if (!skipSyncQueue) {
          await this.addToSyncQueue('contact', contactData.serverId ? 'UPDATE' : 'CREATE', {
            id: contactId,
            serverId: contactData.serverId,
            firstName: contactData.firstName,
            lastName: contactData.lastName,
            company: contactData.company,
            jobTitle: contactData.jobTitle,
            email: contactData.email,
            phone: contactData.phone,
            notes: contactData.notes,
            lastMetDate: contactData.lastMetDate,
            howWeMet: contactData.howWeMet,
            location: contactData.location,
            tags: contactData.tags,
            quickFacts: contactData.quickFacts,
            serverVersion: contactData.serverVersion
          });
          console.log('[StorageV2] Contact added to sync queue');
        }

        resolve(contactId);
      };

      request.onerror = () => {
        console.error('[StorageV2] Error saving contact:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all contacts for CURRENT USER ONLY (enforces authentication)
   * @returns {Promise<Array>}
   */
  async getAllContacts() {
    if (!this.db) await this.init();

    const userId = this.getCurrentUserId();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['contacts'], 'readonly');
      const store = transaction.objectStore('contacts');
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        console.log(`[StorageV2] Retrieved ${request.result.length} contacts for user ${userId}`);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[StorageV2] Error getting contacts:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get contact by ID
   * @param {string} contactId
   * @returns {Promise<Object|null>}
   */
  async getContact(contactId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['contacts'], 'readonly');
      const store = transaction.objectStore('contacts');
      const request = store.get(contactId);

      request.onsuccess = () => {
        const contact = request.result;

        // Verify user owns this contact
        const currentUserId = this.getCurrentUserIdOrNull();
        if (contact && currentUserId && contact.userId !== currentUserId) {
          console.warn('[StorageV2] SECURITY: Contact userId mismatch');
          resolve(null);
          return;
        }

        resolve(contact || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete contact (soft delete, sends DELETE to sync queue)
   * @param {string} contactId
   * @returns {Promise<boolean>}
   */
  async deleteContact(contactId) {
    if (!this.db) await this.init();

    const contact = await this.getContact(contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

        // Verify user owns this contact
    const userId = this.getCurrentUserId();
    if (contact.userId !== userId) {
      throw new Error('Cannot delete contact: access denied');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['contacts', 'syncQueue'], 'readwrite');
      const contactStore = transaction.objectStore('contacts');
      const syncQueueStore = transaction.objectStore('syncQueue');

      // Mark as deleted
      contact.deletedAt = new Date().toISOString();
      contact.syncState = 'pending';
      contact.lastModified = new Date().toISOString();

      const updateRequest = contactStore.put(contact);

      updateRequest.onsuccess = async () => {
        // Add DELETE to sync queue
        const syncRequest = syncQueueStore.add({
          id: this.createId(),
          entityType: 'contact',
          action: 'DELETE',
          entityId: contactId,
          entityData: { serverId: contact.serverId },
          userId: userId,
          createdAt: new Date().toISOString(),
          status: 'pending',
          attempts: 0
        });

        syncRequest.onsuccess = () => {
          console.log('[StorageV2] Contact marked as deleted and added to sync queue');
          resolve(true);
        };

        syncRequest.onerror = () => reject(syncRequest.error);
      };

      updateRequest.onerror = () => reject(updateRequest.error);
    });
  }

  /**
   * Clear ALL local data for current user (logout cleanup)
   * @returns {Promise<void>}
   */
  async clearAllData() {
    if (!this.db) await this.init();

    const userId = this.getCurrentUserId();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['contacts', 'syncQueue', 'userData'], 'readwrite');

      const promises = [];

      // Clear contacts
      promises.push(new Promise((res, rej) => {
        const store = transaction.objectStore('contacts');
        const index = store.index('userId');
        const request = index.openCursor(IDBKeyRange.only(userId));

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            res();
          }
        };
        request.onerror = () => rej(request.error);
      }));

      // Clear sync queue
      promises.push(new Promise((res, rej) => {
        const store = transaction.objectStore('syncQueue');
        const index = store.index('userId');
        const request = index.openCursor(IDBKeyRange.only(userId));

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            res();
          }
        };
        request.onerror = () => rej(request.error);
      }));

      Promise.all(promises).then(() => {
        console.log('[StorageV2] All data cleared for user', userId);
        resolve();
      }).catch(reject);
    });
  }

  // ===== SYNC QUEUE OPERATIONS =====

  /**
   * Add item to sync queue
   * @private
   */
  async addToSyncQueue(entityType, action, entityData) {
    const userId = this.getCurrentUserId();

    const queueItem = {
      id: this.createId(),
      entityType: entityType,
      action: action,
      entityId: entityData.id || this.createId(),
      entityData: entityData,
      userId: userId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      error: null
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.add(queueItem);

      request.onsuccess = () => {
        console.log(`[StorageV2] Added to sync queue: ${entityType} ${action}`);
        resolve(queueItem.id);
      };

      request.onerror = () => {
        console.error('[StorageV2] Error adding to sync queue:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all pending sync queue items for current user
   * @returns {Promise<Array>}
   */
  async getPendingSyncItems() {
    if (!this.db) await this.init();

    const userId = this.getCurrentUserId();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const index = store.index('userId');
      const request = index.openCursor(IDBKeyRange.only(userId));

      const items = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (cursor.value.status === 'pending' || cursor.value.status === 'retry') {
            items.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(items);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update sync queue item status
   * @param {string} itemId
   * @param {string} status
   * @param {string} error
   * @returns {Promise<void>}
   */
  async updateSyncItem(itemId, status, error = null) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.get(itemId);

      request.onsuccess = () => {
        const item = request.result;
        if (!item) {
          reject(new Error('Sync item not found'));
          return;
        }

        item.status = status;
        item.error = error;

        if (status === 'retry') {
          item.attempts = (item.attempts || 0) + 1;
        }

        const updateRequest = store.put(item);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove sync queue item (after successful sync or permanent failure)
   * @param {string} itemId
   * @returns {Promise<void>}
   */
  async removeSyncItem(itemId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.delete(itemId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mark contact as synced (updates serverId and syncState)
   * @param {string} contactId
   * @param {Object} serverData
   * @returns {Promise<void>}
   */
  async markContactSynced(contactId, serverData) {
    if (!this.db) await this.init();

    const contact = await this.getContact(contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    contact.serverId = serverData.id;
    contact.serverVersion = serverData.version || 1;
    contact.lastSynced = new Date().toISOString();
    contact.syncState = 'synced';

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['contacts'], 'readwrite');
      const store = transaction.objectStore('contacts');
      const request = store.put(contact);

      request.onsuccess = () => {
        console.log(`[StorageV2] Contact marked as synced: ${contactId}`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }
}

window.storage = new StorageV2();
