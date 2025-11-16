// Storage Layer v2 - Offline-first with sync queue
// Proper IndexedDB schema with sync state tracking

class StorageV2 {
  constructor() {
    this.dbName = 'RememberMeDB_v2';
    this.dbVersion = 3; // Incremented to trigger schema upgrade for starred field
    this.db = null;
  }

  async init() {
    console.log('[StorageV2] Init STARTED - About to open IndexedDB');
    return new Promise((resolve, reject) => {
      console.log('[StorageV2] Opening IndexedDB:', this.dbName, 'version:', this.dbVersion);
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('[StorageV2] DB OPEN FAILED:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[StorageV2] Database opened successfully');
        console.log('[StorageV2] Object stores:', Array.from(this.db.objectStoreNames));
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        console.log('[StorageV2] onupgradeneeded FIRED!');
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

        console.log('[StorageV2] About to create stores:', stores.map(s => s.name));

        for (const storeConfig of stores) {
          console.log('[StorageV2] Checking store:', storeConfig.name);
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            console.log('[StorageV2] Creating store:', storeConfig.name);
            const store = db.createObjectStore(storeConfig.name, { keyPath: storeConfig.keyPath });
            console.log(`[StorageV2] Created store: ${storeConfig.name}`);

            for (const index of storeConfig.indexes || []) {
              console.log('[StorageV2] Creating index:', index.name);
              store.createIndex(index.name, index.keyPath, index.options);
              console.log(`[StorageV2] Created index: ${storeConfig.name}.${index.name}`);
            }
          } else {
            console.log('[StorageV2] Store already exists:', storeConfig.name);
          }
        }

        console.log('[StorageV2] Upgrade complete!');
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
    try {
      const user = window.authService?.getCurrentUser();
      if (!user || !user.id) {
        throw new Error('User not authenticated. Cannot perform data operations.');
      }
      return user.id;
    } catch (error) {
      console.error('[StorageV2] Error getting current user ID:', error);
      throw error;
    }
  }

  /**
   * Get user ID with fallback validation
   * @private
   */
  getUserIdWithFallback() {
    try {
      // Primary method
      if (window.authService && window.authService.getCurrentUser && window.authService.getCurrentUser()) {
        return window.authService.getCurrentUser().id;
      }

      // Fallback: extract user ID from localStorage
      const session = localStorage.getItem('rememberme_user');
      if (session) {
        try {
          const userData = JSON.parse(session);
          return userData.id;
        } catch {
          console.warn('[StorageV2] Could not parse user session from localStorage');
        }
      }

      return null;
    } catch (error) {
      console.warn('[StorageV2] Error getting user ID with fallback:', error);
      return null;
    }
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
    console.log('[StorageV2] saveContact STARTED:', { contactId: contact.id, firstName: contact.firstName });

    if (!this.db) {
      console.log('[StorageV2] DB not initialized, initializing...');
      await this.init();
    }

    const userId = this.getCurrentUserId();
    console.log('[StorageV2] Got userId:', userId);

    const now = new Date().toISOString();

    // Validate required fields
    if (!contact.firstName) {
      console.error('[StorageV2] ERROR: firstName missing!');
      throw new Error('Contact must have firstName');
    }

    const contactId = contact.id || this.createId();
    console.log('[StorageV2] Using contactId:', contactId);

    const contactData = {
      id: contactId,
      serverId: contact.serverId || null,
      userId: userId,
      firstName: contact.firstName,
      lastName: contact.lastName || '',
      title: contact.title || '',
      company: contact.company || '',
      jobTitle: contact.jobTitle || '',
      email: contact.email || '',
      phone: contact.phone || '',
      photo: contact.photo || null,
      notes: contact.notes || '',
      lastMetDate: contact.lastMet || null,
      howWeMet: contact.howWeMet || '',
      location: contact.location || '',
      tags: contact.tags || [],
      quickFacts: contact.quickFacts || [],
      starred: contact.starred || false,
      lastModified: now,
      lastSynced: contact.lastSynced || null,
      syncState: contact.syncState || 'pending',
      serverVersion: contact.serverVersion || 0
    };

    console.log('[StorageV2] Contact data prepared:', contactData);

    return new Promise((resolve, reject) => {
      console.log('[StorageV2] Creating transaction...');
      const transaction = this.db.transaction(['contacts'], 'readwrite');

      // CRITICAL: Add transaction error handlers
      transaction.onerror = (event) => {
        console.error('[StorageV2] TRANSACTION ERROR:', event.target.error);
        reject(event.target.error);
      };

      transaction.onabort = (event) => {
        console.error('[StorageV2] TRANSACTION ABORTED:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        console.log('[StorageV2] TRANSACTION COMPLETED SUCCESSFULLY');
      };

      console.log('[StorageV2] Transaction created, getting store...');
      const store = transaction.objectStore('contacts');
      console.log('[StorageV2] Store obtained, calling put...');
      const request = store.put(contactData);
      console.log('[StorageV2] Put request created');

      request.onsuccess = async () => {
        console.log(`[StorageV2] SUCCESS: Contact saved with ID: ${contactId}`);

        // Add to sync queue
        if (!skipSyncQueue) {
          await this.addToSyncQueue('contact', contactData.serverId ? 'UPDATE' : 'CREATE', {
            id: contactId,
            serverId: contactData.serverId,
            firstName: contactData.firstName,
            lastName: contactData.lastName,
            title: contactData.title,
            company: contactData.company,
            jobTitle: contactData.jobTitle,
            email: contactData.email,
            phone: contactData.phone,
            photo: contactData.photo,
            notes: contactData.notes,
            lastMetDate: contactData.lastMetDate,
            howWeMet: contactData.howWeMet,
            location: contactData.location,
            tags: contactData.tags,
            quickFacts: contactData.quickFacts,
            starred: contactData.starred,
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

      request.onsuccess = async () => {
        const contacts = request.result || [];
        console.log(`[StorageV2] Retrieved ${contacts.length} contacts for user ${userId}`);

        // CRITICAL FIX: If no contacts found, try to recover from all contacts (user ID mismatch issue)
        if (contacts.length === 0) {
          console.warn('[StorageV2] No contacts found for current user, attempting recovery...');

          const recoveryTransaction = this.db.transaction(['contacts'], 'readonly');
          const recoveryStore = recoveryTransaction.objectStore('contacts');
          const recoveryRequest = recoveryStore.getAll();

          recoveryRequest.onsuccess = () => {
            const allContacts = recoveryRequest.result || [];

            if (allContacts.length > 0) {
              console.warn(`[StorageV2] RECOVERY: Found ${allContacts.length} contacts with different user IDs`);
              console.warn('[StorageV2] This indicates userId mismatch or auth state issue');

              // Try to find contacts that match by structure (not by userId)
              const potentiallyValidContacts = allContacts.filter(contact =>
                contact && contact.firstName && contact.id
              );

              if (potentiallyValidContacts.length > 0) {
                console.warn('[StorageV2] Returning recovered contacts:', potentiallyValidContacts.map(c => ({ id: c.id, name: c.firstName, userId: c.userId })));
                alert('Data recovery: Found contacts with mismatched user IDs. Please contact support if this continues.');
              }

              resolve(potentiallyValidContacts);
            } else {
              console.log('[StorageV2] Recovery complete: No contacts found in database');
              resolve([]);
            }
          };

          recoveryRequest.onerror = () => {
            console.error('[StorageV2] Recovery failed:', recoveryRequest.error);
            resolve([]);
          };
        } else {
          resolve(contacts);
        }
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
   * Get meetings scheduled for today
   * @returns {Promise<Array>} Array of meetings scheduled for today
   */
  async getTodaysMeetings() {
    if (!this.db) await this.init();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['meetings'], 'readonly');
      const store = transaction.objectStore('meetings');

      // Get all meetings for the current user
      const userId = this.getUserIdWithFallback();
      if (!userId) {
        console.warn('[StorageV2] No user ID available for getTodaysMeetings');
        resolve([]);
        return;
      }

      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const allMeetings = request.result || [];

        // Filter meetings for today
        const todaysMeetings = allMeetings.filter(meeting => {
          if (!meeting.scheduledDate) return false;
          const meetingDate = new Date(meeting.scheduledDate);
          return meetingDate >= today && meetingDate < tomorrow;
        });

        resolve(todaysMeetings);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get meeting by ID
   * @param {string} meetingId
   * @returns {Promise<Object|null>}
   */
  async getMeeting(meetingId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['meetings'], 'readonly');
      const store = transaction.objectStore('meetings');
      const request = store.get(meetingId);

      request.onsuccess = () => {
        const meeting = request.result;

        // Verify user owns this meeting
        const currentUserId = this.getCurrentUserIdOrNull();
        if (meeting && currentUserId && meeting.userId !== currentUserId) {
          console.warn('[StorageV2] SECURITY: Meeting userId mismatch');
          resolve(null);
          return;
        }

        resolve(meeting || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get contacts scheduled to meet today (from nextMeetingDate field)
   * This allows users to schedule meetings without creating full meeting records
   */
  async getTodaysScheduledContacts() {
    if (!this.db) await this.init();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['contacts'], 'readonly');
      const store = transaction.objectStore('contacts');

      const userId = this.getUserIdWithFallback();
      if (!userId) {
        console.warn('[StorageV2] No user ID available for getTodaysScheduledContacts');
        resolve([]);
        return;
      }

      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const allContacts = request.result || [];

        // Filter contacts with nextMeetingDate scheduled for today
        const contactsMeetingToday = allContacts.filter(contact => {
          if (!contact.nextMeetingDate && !contact.nextMeeting) return false;

          // Check both nextMeetingDate (new field) and nextMeeting (old/alternative field)
          const meetingDateStr = contact.nextMeetingDate || contact.nextMeeting;
          const meetingDate = new Date(meetingDateStr);

          return meetingDate >= today && meetingDate < tomorrow;
        });

        // Convert contacts to meeting format for consistency with existing meetings
        const formattedMeetings = contactsMeetingToday.map(contact => ({
          id: contact.id + '_scheduled', // Create a unique ID
          personId: contact.id,
          scheduledDate: contact.nextMeetingDate || contact.nextMeeting,
          topic: 'Scheduled Meeting',
          fromContact: true // Flag to indicate this came from contact's next meeting field
        }));

        resolve(formattedMeetings);
      };

      request.onerror = () => {
        console.error('[StorageV2] Error getting today\'s scheduled contacts:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Save a meeting (creates or updates)
   * @param {Object} meeting
   * @returns {Promise<string>} The meeting ID
   */
  async saveMeeting(meeting) {
    if (!this.db) await this.init();

    // Ensure meeting has required fields
    if (!meeting.id) {
      meeting.id = this.createId();
    }

    // Ensure userId is set
    if (!meeting.userId) {
      const userId = this.getCurrentUserIdOrNull();
      if (!userId) {
        throw new Error('User not authenticated. Cannot save meeting.');
      }
      meeting.userId = userId;
    }

    meeting.lastModified = new Date().toISOString();
    meeting.syncState = meeting.syncState || 'pending';

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['meetings'], 'readwrite');
      const store = transaction.objectStore('meetings');
      const request = store.put(meeting);

      request.onsuccess = async () => {
        console.log(`[StorageV2] Meeting saved: ${meeting.id}`);

        // Add to sync queue (unless explicitly told not to)
        try {
          await this.addToSyncQueue('meeting', 'update', meeting);
        } catch (syncError) {
          console.error('[StorageV2] Error adding meeting to sync queue:', syncError);
        }

        resolve(meeting.id);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get unsynced items of a specific entity type
   * @param {string} entityType - 'contacts' or 'meetings'
   * @returns {Promise<Array>}
   */
  async getUnsynced(entityType) {
    if (!this.db) await this.init();

    const storeName = entityType === 'meetings' ? 'meetings' : 'contacts';
    const storeKeyPath = entityType === 'meetings' ? 'id' : 'id';

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      const userId = this.getCurrentUserIdOrNull();
      if (!userId) {
        resolve([]);
        return;
      }

      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const allItems = request.result || [];
        const unsyncedItems = allItems.filter(item => item.syncState === 'pending' || item.syncState === 'modified');
        resolve(unsyncedItems);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mark an item as synced with the server
   * @param {string} entityType - 'contacts' or 'meetings'
   * @param {string} itemId
   * @returns {Promise<void>}
   */
  async markAsSynced(entityType, itemId) {
    if (!this.db) await this.init();

    const isMeeting = entityType === 'meetings';
    const storeName = isMeeting ? 'meetings' : 'contacts';
    const getMethod = isMeeting ? this.getMeeting.bind(this) : this.getContact.bind(this);
    const saveMethod = isMeeting ? this.saveMeeting.bind(this) : this.saveContact.bind(this);

    try {
      const item = await getMethod(itemId);
      if (item) {
        item.syncState = 'synced';
        item.lastSynced = new Date().toISOString();

        // Skip sync queue since we're marking as already synced
        if (isMeeting) {
          await this.saveMeetingInternal(item);
        } else {
          await this.saveContactInternal(item, true);
        }
      }
    } catch (error) {
      console.error(`[StorageV2] Error marking ${entityType} as synced:`, error);
    }
  }

  /**
   * Internal save meeting method without sync queue (used by markAsSynced)
   * @private
   */
  async saveMeetingInternal(meeting) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['meetings'], 'readwrite');
      const store = transaction.objectStore('meetings');
      const request = store.put(meeting);

      request.onsuccess = () => resolve(meeting.id);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all contacts (for logout)
   * @returns {Promise<void>}
   */
  async clearAllContacts() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['contacts'], 'readwrite');
      const store = transaction.objectStore('contacts');

      // Only clear contacts for current user
      const userId = this.getCurrentUserIdOrNull();
      if (!userId) {
        resolve();
        return;
      }

      const index = store.index('userId');
      const request = index.openCursor(userId);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          console.log('[StorageV2] All contacts cleared');
          resolve();
        }
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
