/**
 * CRITICAL CONTACT DEBUG DIAGNOSTICS
 * Tests for the contact loss bug after logout/login
 */

window.CONTACT_DEBUG = {
    results: {},

    /**
     * SCENARIO 1: Check if data is being saved initially
     */
    async testInitialDataSaving() {
        console.log('🧪 CONTACT DEBUG: Testing initial data saving...');

        try {
            // Create a test contact
            const testContact = {
                firstName: 'Debug Test',
                lastName: 'Contact',
                title: 'Test Contact',
                email: 'debug@test.com'
            };

            console.log('[DEBUG] Creating test contact...');
            const contactId = await window.storage.saveContact(testContact);
            console.log(`[DEBUG] Contact saved with ID: ${contactId}`);

            // Check IndexedDB storage
            console.log('[DEBUG] Checking IndexedDB storage...');
            const db = window.storage.db;
            const transaction = db.transaction(['contacts'], 'readonly');
            const store = transaction.objectStore('contacts');

            const getRequest = store.get(contactId);
            getRequest.onsuccess = () => {
                const contact = getRequest.result;
                console.log('[DEBUG] CONTACT FOUND IN INDEXEDDB:');
                console.log('Contact ID:', contact.id);
                console.log('User ID:', contact.userId);
                console.log('First name:', contact.firstName);
                console.log('Last name:', contact.lastName);
                console.log('Title:', contact.title);
                console.log('Sync state:', contact.syncState);
                console.log('Last modified:', contact.lastModified);

                this.results.initialSave = {
                    success: true,
                    contact: contact,
                    timestamp: new Date().toISOString()
                };
            };

            getRequest.onerror = () => {
                console.error('[DEBUG] ERROR: Contact not found in IndexedDB!');
                this.results.initialSave = {
                    success: false,
                    error: 'Contact not found in IndexedDB',
                    timestamp: new Date().toISOString()
                };
            };

            // Wait for transaction to complete
            transaction.oncomplete = () => {
                console.log('[DEBUG] IndexedDB transaction completed');
            };

        } catch (error) {
            console.error('[DEBUG] ERROR in initialSave test:', error);
            this.results.initialSave = {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    },

    /**
     * SCENARIO 2: Check what happens on logout
     */
    async testLogoutBehavior() {
        console.log('🧪 CONTACT DEBUG: Testing logout behavior...');

        // Get current user ID BEFORE logout
        const user = window.authService?.getCurrentUser();
        const userId = user?.id;

        if (!userId) {
            console.error('[DEBUG] ERROR: No user session found');
            this.results.logoutBehavior = {
                success: false,
                error: 'No user session found',
                timestamp: new Date().toISOString()
            };
            return;
        }

        console.log(`[DEBUG] User ID before logout: ${userId}`);

        // Check contacts before logout
        try {
            const contactsBefore = await window.storage.getAllContacts();
            console.log(`[DEBUG] Found ${contactsBefore.length} contacts before logout`);

            // Store pre-logout state for comparison
            this.results.preLogoutContacts = contactsBefore;
            this.results.preLogoutUserId = userId;

            // Hook into logout process to capture what happens
            const originalLogout = window.app.logout;
            window.app.logout = async function() {
                console.log('[DEBUG] INTERCEPTED: logout called, checking IndexedDB before clearing...');

                // Quick check of database before clear operation
                try {
                    const db = window.storage.db;
                    const transaction = db.transaction(['contacts'], 'readonly');
                    const store = transaction.objectStore('contacts');

                    const index = store.index('userId');
                    const countRequest = index.count(userId);

                    countRequest.onsuccess = () => {
                        console.log(`[DEBUG] CONTACTS IN INDEXEDDB BEFORE CLEAR: ${countRequest.result}`);
                    };

                    // Restore original logout
                    window.app.logout = originalLogout;

                    // CALL ORIGINAL LOGOUT
                    await originalLogout.call(window.app);

                    console.log('[DEBUG] Original logout completed');

                } catch (error) {
                    console.error('[DEBUG] Error during logout intercept:', error);
                }
            };

            this.results.logoutBehavior = {
                success: true,
                preLogoutContactCount: contactsBefore.length,
                preLogoutUserId: userId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[DEBUG] ERROR testing logout behavior:', error);
            this.results.logoutBehavior = {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    },

    /**
     * SCENARIO 3: Check what happens after login
     */
    async testPostLoginData() {
        console.log('🧪 CONTACT DEBUG: Testing post-login data...');

        // This should be called AFTER login
        try {
            const user = window.authService?.getCurrentUser();
            const userId = user?.id;

            if (!userId) {
                console.error('[DEBUG] ERROR: No user session after login');
                this.results.postLoginData = {
                    success: false,
                    error: 'No user session after login',
                    timestamp: new Date().toISOString()
                };
                return;
            }

            console.log(`[DEBUG] User ID after login: ${userId}`);
            console.log(`[DEBUG] Previous user ID: ${this.results.preLogoutUserId}`);

            // Compare user IDs
            const userIdChanged = userId !== this.results.preLogoutUserId;
            console.log(`[DEBUG] User ID changed: ${userIdChanged}`);

            // Get contacts after login
            const contactsAfter = await window.storage.getAllContacts();
            console.log(`[DEBUG] Found ${contactsAfter.length} contacts after login`);

            // Check IndexedDB directly
            const db = window.storage.db;
            const transaction = db.transaction(['contacts'], 'readonly');
            const store = transaction.objectStore('contacts');
            const index = store.index('userId');

            const getRequest = index.getAll(userId);
            getRequest.onsuccess = () => {
                const contactsForUser = getRequest.result;
                console.log(`[DEBUG] INDEXEDDB shows ${contactsForUser.length} contacts for current user`);

                // Check for old user data
                if (this.results.preLogoutUserId) {
                    const oldGetRequest = index.getAll(this.results.preLogoutUserId);
                    oldGetRequest.onsuccess = () => {
                        const oldContacts = oldGetRequest.result;
                        console.log(`[DEBUG] INDEXEDDB shows ${oldContacts.length} contacts for old user`);
                    };
                }
            };

            this.results.postLoginData = {
                success: true,
                postLoginContactCount: contactsAfter.length,
                postLoginUserId: userId,
                userIdChanged: userIdChanged,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[DEBUG] ERROR testing post-login data:', error);
            this.results.postLoginData = {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    },

    /**
     * SCENARIO 4: Check for JavaScript errors
     */
    testConsoleErrors() {
        console.log('🧪 CONTACT DEBUG: Setting up console error monitoring...');

        // Store original console methods
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalLog = console.log;

        this.results.consoleErrors = {
            errors: [],
            warnings: [],
            logs: [],
            timestamp: new Date().toISOString()
        };

        // Override console.error
        console.error = (...args) => {
            originalError.apply(console, args);
            const errorStr = args.join(' ');
            if (errorStr.includes('auth') || errorStr.includes('IndexedDB') ||
                errorStr.includes('sync') || errorStr.includes('storage') ||
                errorStr.includes('contact')) {
                console.log('🚨 DEBUG INTERCEPTED ERROR:', errorStr);
            }
            this.results.consoleErrors.errors.push(errorStr);
        };

        // Override console.warn
        console.warn = (...args) => {
            originalWarn.apply(console, args);
            const warnStr = args.join(' ');
            this.results.consoleErrors.warnings.push(warnStr);
        };

        // Override console.log for debug
        console.log = (...args) => {
            originalLog.apply(console, args);
            const logStr = args.join(' ');
            if (logStr.includes('[DEBUG]') || logStr.includes('sync') ||
                logStr.includes('storage') || logStr.includes('auth')) {
                this.results.consoleErrors.logs.push(logStr);
            }
        };

        console.log('[DEBUG] Console error monitoring activated');
    },

    /**
     * SCENARIO 5: Check sync service logs
     */
    testSyncService() {
        console.log('🧪 CONTACT DEBUG: Checking sync service behavior...');

        // Intercept sync service calls
        if (window.syncService) {
            const originalInitialSync = window.syncService.initialSync;
            const originalSyncFromServer = window.syncService.syncFromServer;

            window.syncService.initialSync = async function(userId) {
                console.log(`[DEBUG] INTERCEPTED initialSync called with userId: ${userId}`);

                try {
                    const result = await originalInitialSync.call(this, userId);
                    console.log('[DEBUG] initialSync result:', result);

                    // Check what sync did to local data
                    if (result.success) {
                        const contacts = await window.storage.getAllContacts();
                        console.log(`[DEBUG] AFTER initialSync: Found ${contacts.length} contacts`);
                    }

                    return result;
                } catch (error) {
                    console.error('[DEBUG] initialSync error:', error);
                    throw error;
                }
            };

            window.syncService.syncFromServer = async function() {
                console.log('[DEBUG] INTERCEPTED syncFromServer called');

                try {
                    const result = await originalSyncFromServer.call(this);
                    console.log('[DEBUG] syncFromServer result:', result);

                    // Check what sync did to local data
                    if (result.success) {
                        const contacts = await window.storage.getAllContacts();
                        console.log(`[DEBUG] AFTER syncFromServer: Found ${contacts.length} contacts`);
                    }

                    return result;
                } catch (error) {
                    console.error('[DEBUG] syncFromServer error:', error);
                    throw error;
                }
            };

            console.log('[DEBUG] Intercepted sync service methods');
        }

        this.results.syncService = {
            status: 'intercepted',
            timestamp: new Date().toISOString()
        };
    },

    /**
     * Run all diagnostics
     */
    async runAllDiagnostics() {
        console.log('🔬 CONTACT DEBUG: Starting full diagnostic test suite...');
        console.log('======================================================');

        // Setup monitoring first
        this.testConsoleErrors();
        this.testSyncService();

        // Test initial data saving
        await this.testInitialDataSaving();

        // Wait for user to trigger logout
        console.log('[DEBUG] DIAGNOSTIC: Please click logout when ready to test logout behavior...');

        return this.results;
    },

    /**
     * Print diagnostic summary
     */
    printSummary() {
        console.log('📊 CONTACT DEBUG: Diagnostic Summary');
        console.log('=====================================');
        console.log(JSON.stringify(this.results, null, 2));

        // Analyze results
        if (this.results.initialSave) {
            if (this.results.initialSave.success) {
                console.log('✅ Contacts are being saved to IndexedDB initially');
            } else {
                console.log('❌ CRITICAL: Contacts are NOT being saved to IndexedDB initially!');
            }
        }

        if (this.results.postLoginData) {
            const lostContacts = this.results.preLogoutContacts?.length > 0 &&
                                this.results.postLoginData.postLoginContactCount === 0;

            if (lostContacts) {
                console.log('❌ CONTACT LOSS CONFIRMED: All contacts lost after logout/login');
                console.log(`   Pre-logout: ${this.results.preLogoutContacts.length} contacts`);
                console.log(`   Post-login: ${this.results.postLoginData.postLoginContactCount} contacts`);
            } else {
                console.log('✅ No contact loss detected');
            }
        }

        return this.results;
    }
};

// Export for global use
window.CONTACT_DEBUG = CONTACT_DEBUG;

console.log('[DEBUG] CONTACT DEBUG ready to use. Type CONTACT_DEBUG.runAllDiagnostics() to start testing');