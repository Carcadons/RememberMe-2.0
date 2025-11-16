// Main Application Controller for RememberMe
// Initializes and coordinates all components

class RememberMeApp {
  constructor() {
    console.log('[App] App constructor called');
    this.currentView = 'todayView';
    this.initialized = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('[App] ====== APPLICATION STARTUP ======');
    this.initialized = false;  // Initialize this property

    console.log('[App] Environment:', {
      userAgent: navigator.userAgent.substring(0, 100),
      platform: navigator.platform,
      language: navigator.language,
      online: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled,
      serviceWorker: 'serviceWorker' in navigator,
      indexedDB: 'indexedDB' in window,
      crypto: 'crypto' in window && 'subtle' in window.crypto
    });

    // Check if we're on the login page
    if (window.location.pathname === '/login.html' || window.location.pathname === '/login') {
      console.log('[App] On login page, skipping app initialization');
      return;
    }

    // Check authentication - if not authenticated, redirect to login
    console.log('[App] Checking initial authentication...');
    try {
      // CRITICAL: Wait for authService to be available
      if (window.authService) {
        console.log('[App] Auth service available, checking auth...');
        const isAuthenticated = window.authService.checkAuth();
        console.log('[App] Auth check result:', isAuthenticated);

        if (!isAuthenticated) {
          console.log('[App] NOT AUTHENTICATED - Redirecting to login NOW');
          window.location.href = '/login.html';
          return;
        }
        console.log('[App] User is authenticated, proceeding...');
      } else {
        console.error('[App] CRITICAL: Auth service NOT AVAILABLE - redirecting to login');
        window.location.href = '/login.html';
        return;
      }
    } catch (error) {
      console.error('[App] CRITICAL AUTH ERROR:', error);
      window.location.href = '/login.html';
      return;
    }

    try {
      // Show loading state
      console.log('[App] Showing loading state');
      this.showLoading();

      // Register service worker
      console.log('[App] Starting service worker registration...');
      await this.registerServiceWorker();
      console.log('[App] Service worker registration complete');

      // Initialize storage
      console.log('[App] Initializing storage...');
      await window.storage.init();
      console.log('[App] Storage initialized');

      // Initialize security
      console.log('[App] Initializing security...');
      await window.security.init();
      console.log('[App] Security initialized');

      // Initialize UI components
      console.log('[App] Initializing UI components...');
      console.log('[App] UI Component availability:', {
        todayView: !!window.todayView,
        searchView: !!window.searchView,
        starredView: !!window.starredView,
        addContactModal: !!window.addContactModal,
        contactDetailModal: !!window.contactDetailModal,
        authModal: !!window.authModal,
        authService: !!window.authService,
        syncService: !!window.syncService,
        storage: !!window.storage,
        security: !!window.security,
        encryption: !!window.encryption
      });

      if (window.todayView) {
        console.log('[App] Initializing TodayView...');
        await window.todayView.init();
        console.log('[App] TodayView initialized');
      }

      if (window.searchView) {
        console.log('[App] Initializing SearchView...');
        window.searchView.init();
        console.log('[App] SearchView initialized');
      }

      if (window.starredView) {
        console.log('[App] Initializing StarredView...');
        window.starredView.init();
        console.log('[App] StarredView initialized');
      }

      if (window.addContactModal) {
        console.log('[App] Initializing AddContactModal...');
        window.addContactModal.init();
        console.log('[App] AddContactModal initialized');
      }

      if (window.contactDetailModal) {
        console.log('[App] Initializing ContactDetailModal...');
        window.contactDetailModal.init();
        console.log('[App] ContactDetailModal initialized');
      }

      if (window.authModal) {
        console.log('[App] Initializing AuthModal...');
        window.authModal.init();
        console.log('[App] AuthModal initialized');
      }

      if (window.userMenu) {
        console.log('[App] Initializing UserMenu...');
        window.userMenu.init();
        console.log('[App] UserMenu initialized');
      }

      // Set up event listeners
      console.log('[App] Setting up event listeners...');
      this.setupEventListeners();
      console.log('[App] Event listeners configured');

      // Check user authentication
      console.log('[App] Checking user authentication...');
      await this.checkUserAuth();
    } catch (error) {
      console.error('[App] ====== APPLICATION INITIALIZATION FAILED ======');
      console.error('[App] Error:', error);
      console.error('[App] Stack:', error.stack);
      this.showError('Failed to initialize app. Please refresh.');
    } finally {
      // Only hide loading if user is authenticated
      // If not authenticated, modal is showing so don't hide loading
      const isAuthenticated = window.authService && window.authService.checkAuth();
      if (isAuthenticated) {
        console.log('[App] Hiding loading state');
        this.hideLoading();
      } else {
        console.log('[App] Keeping loading hidden, waiting for auth modal');
      }
    }
  }

  /**
   * Check if user is authenticated
   */
  async checkUserAuth() {
    console.log('[App] checkUserAuth called, checking authService...');

    if (!window.authService) {
      console.error('[App] AuthService not initialized!');
      return;
    }

    const isAuthenticated = window.authService.checkAuth();
    console.log('[App] isAuthenticated result:', isAuthenticated);

    if (!isAuthenticated) {
      console.log('[App] User not authenticated, showing auth modal');
      // Show auth modal instead of local passcode for first-time users
      this.hideLoading(); // Hide loading before showing modal

      // Verify modal exists before showing
      if (window.authModal) {
        console.log('[App] AuthModal found, showing...');
        // Set initialized to false so nothing loads until auth
        this.initialized = false;
        setTimeout(() => {
          window.authModal.show();
        }, 100);
      } else {
        console.error('[App] AuthModal not initialized!');
      }
      return;
    }

    const user = window.authService.getCurrentUser();
    console.log('[App] User authenticated:', user.id);

    // Verify session with server
    const isValid = await window.authService.verifySession();

    if (!isValid) {
      console.log('[App] Session invalid, showing auth modal');
      this.hideLoading(); // Hide loading before showing modal
      window.authModal.show();
      return;
    }

    // Perform initial sync (server data replaces local cache)
    console.log('[App] Performing initial sync...');
    const syncResult = await window.syncService.initialSync(user.id);

    if (syncResult.success) {
      console.log(`[App] Initial sync complete: ${syncResult.contacts?.length || 0} contacts loaded`);
    } else {
      console.warn('[App] Initial sync failed:', syncResult.error);
      // Continue with local data
    }

    // Load UI data
    console.log('[App] Loading UI data...');
    await this.loadData();
  }

  /**
   * Handle successful authentication
   */
  async onAuthSuccess() {
    const user = window.authService.getCurrentUser();
    const token = window.authService.token;
    console.log('[App] Authentication successful for user:', user.id);

    // Perform initial sync after login
    this.showLoading();

    try {
      // First, pull data from server to see what's there
      console.log('[App] Pulling initial data from server...');
      const syncFromResult = await window.syncService.syncFromServer();
      console.log(`[App] Pulled ${syncFromResult.contacts?.length || 0} contacts from server`);

      // Check local data
      console.log('[App] Checking local data...');
      const localContacts = await window.storage.getAllContacts();
      console.log(`[App] Found ${localContacts.length} local contacts`);

      // If user has local contacts that aren't on server, sync them up
      const unsyncedContacts = await window.storage.getUnsynced('contacts');
      if (unsyncedContacts.length > 0) {
        console.log(`[App] Found ${unsyncedContacts.length} unsynced contacts, syncing to server...`);
        await window.syncService.syncToServer();
      }

      // Reload UI with merged data
      console.log('[App] Reloading UI...');
      await this.loadData();

      // Refresh all views
      console.log('[App] Refreshing views...');
      if (window.todayView && this.currentView === 'todayView') {
        await window.todayView.loadTodaysData();
      }
      if (window.searchView) {
        window.searchView.loadAllContacts();
      }
      if (window.starredView) {
        await window.starredView.loadStarred();
      }

      this.showSuccess('Welcome back!');
      console.log('[App] Auth success complete');
    } catch (error) {
      console.error('[App] Auth success handler error:', error);
      this.showError('Failed to sync data');
    } finally {
      this.hideLoading();
    }

    // Mark app as initialized
    this.initialized = true;
    console.log('[App] ====== APPLICATION INITIALIZED SUCCESSFULLY ======');
  }

  /**
   * Register service worker
   */
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[App] Service Worker registered:', registration);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          console.log('[App] Service Worker update found');
        });

        // Check for waiting service worker
        if (registration.waiting) {
          console.log('[App] Service Worker waiting');
        }

      } catch (error) {
        console.error('[App] Service Worker registration failed:', error);
      }
    } else {
      console.warn('[App] Service Workers not supported');
    }
  }

  /**
   * Check authentication status
   * @returns {Promise<boolean>} - Returns true if authentication is needed
   */
  async checkAuthentication() {
    const needsAuth = await window.security.shouldLockApp();

    if (needsAuth) {
      console.log('[App] Authentication required');
      // Show lock screen (handled by security module)
      return true;
    }

    console.log('[App] Authentication not required');
    return false;
  }

  /**
   * Load application data
   */
  async loadData() {
    console.log('[App] Loading application data...');
    try {
      // Load today's view
      await window.todayView.loadTodaysData();

      // Load Contacts view
      if (window.searchView) {
        await window.searchView.loadAllContacts();
      }

      // Load Starred view
      if (window.starredView) {
        await window.starredView.loadStarred();
      }

      console.log('[App] All data loaded successfully');
    } catch (error) {
      console.error('[App] Error loading data:', error);
      this.showError('Failed to load data');
    }
  }

  /**
   * Logout user
   */
  async logout() {
    if (!confirm('Are you sure you want to logout? All local data will be cleared.')) {
      return;
    }

    console.log('[App] Logging out user');
    this.showLoading();

    try {
      // Get user ID before logout - store it for cleanup
      console.log('[App] Getting current user...');
      const user = window.authService.getCurrentUser();
      console.log('[App] User:', user?.id);

      // Clear sync state BEFORE clearing data to avoid conflicts
      console.log('[App] Clearing sync state...');
      window.syncService.reset();

      // Logout from auth service FIRST (this clears session but maintains user ref)
      console.log('[App] Logging out from auth service...');
      window.authService.logout();
      console.log('[App] Auth service logout complete');

      // Clear local data with fallback user handling
      console.log('[App] Clearing local data...');
      try {
        if (user?.id) {
          // Use direct IndexedDB operations with stored user ID for cleanup
          await this.clearUserData(user.id);
          console.log('[App] User data cleared for user:', user.id);
        } else {
          console.warn('[App] No user ID available for cleanup, skipping data clearing');
        }
      } catch (cleanupError) {
        console.error('[App] Error clearing user data:', cleanupError);
        // Continue with logout despite cleanup error
      }

      // Clear UI
      console.log('[App] Clearing UI...');
      this.clearAllViews();

      this.hideLoading();
      console.log('[App] Loading hidden');

      // Show success message
      console.log('[App] Showing success message');
      this.showSuccess('Logged out successfully');

      // Redirect to login page with immediate redirect to avoid state confusion
      console.log('[App] Redirecting to login page...');
      window.location.href = '/login.html';

      console.log('[App] Logout complete');

    } catch (error) {
      console.error('[App] Logout error:', error);
      this.hideLoading();
      this.showError('Logout failed');
    }
  }

  /**
   * Clear user data with explicit user ID
   * @param {string} userId
   */
  async clearUserData(userId) {
    console.log(`[App] Clearing user data for ${userId}...`);

    if (!window.storage || !window.storage.db) {
      console.warn('[App] Storage not initialized, skipping user data cleanup');
      return;
    }

    try {
      const transaction = window.storage.db.transaction(['contacts', 'syncQueue', 'userData'], 'readwrite');

      // Clear contacts for specific user
      const contactsPromise = new Promise((resolve, reject) => {
        try {
          const store = transaction.objectStore('contacts');
          const index = store.index('userId');
          const request = index.openCursor(IDBKeyRange.only(userId));

          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              const canDelete = cursor.value.userId === userId;
              if (canDelete) {
                cursor.delete();
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          request.onerror = () => reject(request.error);
        } catch (error) {
          console.warn('[App] Error clearing contacts:', error);
          // Don't fail the logout if contacts clear fails
          resolve();
        }
      });

      // Clear sync queue for specific user
      const syncPromise = new Promise((resolve, reject) => {
        try {
          const store = transaction.objectStore('syncQueue');
          const index = store.index('userId');
          const request = index.openCursor(IDBKeyRange.only(userId));

          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          request.onerror = () => reject(request.error);
        } catch (error) {
          console.warn('[App] Error clearing sync queue:', error);
          resolve();
        }
      });

      await Promise.all([contactsPromise, syncPromise]);
      console.log(`[App] User data cleared for user ${userId}`);
    } catch (error) {
      console.error(`[App] Error in clearUserData for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Clear all view data
   */
  clearAllViews() {
    document.getElementById('todayList').innerHTML = '';
    document.getElementById('contactsList').innerHTML = '';
    document.getElementById('starredList').innerHTML = '';

    document.getElementById('todayEmpty').classList.remove('hidden');
    document.getElementById('todayList').classList.add('hidden');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    console.log('[App] Setting up event listeners...');

    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = button.dataset.view;
        this.switchView(viewId);
      });
    });

    // Floating action button (opens FAB menu)
    const addBtn = document.getElementById('addPersonBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.toggleFabMenu();
      });
    }

    // FAB Menu Backdrop (closes menu when clicked)
    const fabMenuBackdrop = document.getElementById('fabMenuBackdrop');
    if (fabMenuBackdrop) {
      fabMenuBackdrop.addEventListener('click', () => {
        this.hideFabMenu();
      });
    }

    // Schedule Meeting button
    const scheduleMeetingBtn = document.getElementById('scheduleMeetingBtn');
    if (scheduleMeetingBtn) {
      scheduleMeetingBtn.addEventListener('click', () => {
        console.log('[App] Schedule Meeting (FAB) clicked');
        this.hideFabMenu();
        this.scheduleMeeting();
      });
    }

    // Desktop import buttons (in empty state)
    const importBtn = document.getElementById('importContactsBtnDesktop');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        this.importContacts();
      });
    }

    const linkedinBtn = document.getElementById('importLinkedinBtnDesktop');
    if (linkedinBtn) {
      linkedinBtn.addEventListener('click', () => {
        this.importLinkedinContacts();
      });
    }

    // Mobile FAB menu buttons
    const addManualBtnMobile = document.getElementById('addManualContactBtn');
    if (addManualBtnMobile) {
      addManualBtnMobile.addEventListener('click', () => {
        console.log('[App] Create Contact (FAB) clicked');
        this.hideFabMenu();
        this.addNewPerson();
      });
    }

    const importContactsBtnMobile = document.getElementById('importContactsBtnMobile');
    if (importContactsBtnMobile) {
      importContactsBtnMobile.addEventListener('click', () => {
        console.log('[App] Import iPhone Contacts (FAB) clicked');
        this.hideFabMenu();
        this.importContacts();
      });
    }

    const importLinkedinBtnMobile = document.getElementById('importLinkedinBtnMobile');
    if (importLinkedinBtnMobile) {
      importLinkedinBtnMobile.addEventListener('click', () => {
        console.log('[App] Import LinkedIn (FAB) clicked');
        this.hideFabMenu();
        this.importLinkedinContacts();
      });
    }

    // Handle visibility change (for auth timeout)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[App] App became visible');
        if (window.security.isAuthenticated) {
          window.security.resetAuthTimer();
        }
      }
    });

    // Handle online/offline
    window.addEventListener('online', () => {
      console.log('[App] Online');
      this.showSuccess('Back online');
    });

    window.addEventListener('offline', () => {
      console.log('[App] Offline');
      this.showWarning('You are offline');
    });

    // Close FAB menu when clicking outside
    document.addEventListener('click', (e) => {
      const fabMenu = document.getElementById('fabMenu');
      const fab = document.getElementById('addPersonBtn');

      if (fabMenu && !fabMenu.classList.contains('hidden')) {
        if (!fabMenu.contains(e.target) && !fab.contains(e.target)) {
          this.hideFabMenu();
        }
      }
    });

    console.log('[App] Event listeners set up');
  }

  /**
   * Switch between views
   * @param {string} viewId - ID of view to show
   */
  switchView(viewId) {
    console.log('[App] Switching to view:', viewId);

    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    // Remove active from all tabs
    document.querySelectorAll('.tab-button').forEach(tab => {
      tab.classList.remove('active');
    });

    // Show selected view
    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.add('active');
      this.currentView = viewId;
    }

    // Activate corresponding tab
    const tabButton = document.querySelector(`[data-view="${viewId}"]`);
    if (tabButton) {
      tabButton.classList.add('active');
    }

    // Show/hide FAB and import menu based on view
    const fab = document.getElementById('addPersonBtn');
    const importMenu = document.getElementById('importMenu');

    if (fab && importMenu) {
      if (viewId === 'contactsView') {
        // Show FAB on Contacts page
        fab.style.display = 'flex';
      } else {
        // Hide FAB on other pages
        fab.style.display = 'none';
        importMenu.classList.add('hidden');
      }
    }

    // Load data based on view
    this.loadViewData(viewId);
  }

  /**
   * Load data for specific view
   * @param {string} viewId
   */
  async loadViewData(viewId) {
    switch (viewId) {
      case 'todayView':
        await window.todayView.loadTodaysData();
        break;
      case 'contactsView':
        window.searchView.init();
        break;
      case 'starredView':
        await window.starredView.loadStarred();
        break;
    }
  }

  /**
   * Toggle import menu visibility
   */
  toggleImportMenu() {
    const importMenu = document.getElementById('importMenu');
    const isHidden = importMenu.classList.contains('hidden');

    if (isHidden) {
      console.log('[App] Showing import menu');
      importMenu.classList.remove('hidden');
      importMenu.style.display = 'flex';
    } else {
      console.log('[App] Hiding import menu');
      this.hideImportMenu();
    }
  }

  /**
   * Hide import menu
   */
  hideImportMenu() {
    const importMenu = document.getElementById('importMenu');
    console.log('[App] Hiding import menu');
    importMenu.classList.add('hidden');
    importMenu.style.display = 'none';
  }

  /**
   * FAB Menu Functions
   */
  toggleFabMenu() {
    const fabMenu = document.getElementById('fabMenu');
    const fabBtn = document.getElementById('addPersonBtn');

    if (!fabMenu || !fabBtn) return;

    if (fabMenu.classList.contains('active')) {
      this.hideFabMenu();
    } else {
      this.showFabMenu();
    }
  }

  showFabMenu() {
    console.log('[App] Showing FAB menu');
    const fabMenu = document.getElementById('fabMenu');
    const fabBtn = document.getElementById('addPersonBtn');

    if (!fabMenu || !fabBtn) return;

    fabMenu.classList.remove('hidden');
    fabMenu.classList.add('active');
    fabBtn.classList.add('active');
  }

  hideFabMenu() {
    console.log('[App] Hiding FAB menu');
    const fabMenu = document.getElementById('fabMenu');
    const fabBtn = document.getElementById('addPersonBtn');

    if (!fabMenu || !fabBtn) return;

    fabMenu.classList.remove('active');

    // Wait for animation to complete before hiding completely
    setTimeout(() => {
      if (!fabMenu.classList.contains('active')) {
        fabMenu.classList.add('hidden');
      }
    }, 300);

    fabBtn.classList.remove('active');
  }

  /**
   * Add new person (from FAB menu)
   */
  addNewPerson() {
    console.log('[App] Add new person clicked');
    this.hideFabMenu();
    if (window.addContactModal) {
      window.addContactModal.show();
    }
  }

  /**
   * Schedule a meeting (from FAB menu)
   */
  scheduleMeeting() {
    console.log('[App] Schedule Meeting clicked');
    if (window.addContactModal) {
      // Configure the modal for quick schedule mode
      window.addContactModal.showQuickSchedule();
    }
  }

  /**
   * Import contacts from iPhone/iOS
   */
  importContacts() {
    console.log('[App] Import contacts clicked');

    // Create hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vcf,text/vcard';
    input.style.display = 'none';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      console.log('[App] Selected file:', file.name, file.type, file.size);
      this.showLoading();

      try {
        const text = await file.text();
        console.log('[App] File loaded, parsing vCard...');
        const contacts = this.parseVCard(text);
        console.log('[App] Parsed', contacts.length, 'contacts');

        if (contacts.length === 0) {
          this.showError('No contacts found in file');
          return;
        }

        // Bulk import
        let imported = 0;
        for (const contact of contacts) {
          try {
            await window.storage.saveContact(contact);
            imported++;
            console.log('[App] Imported contact:', contact.name);
          } catch (error) {
            console.error('[App] Error importing contact:', contact.name, error);
          }
        }

        this.hideLoading();
        this.showSuccess(`Imported ${imported} contacts!`);

        // Refresh views
        if (typeof window.todayView !== 'undefined') {
          await window.todayView.loadTodaysData();
        }
        if (typeof window.starredView !== 'undefined') {
          await window.starredView.loadStarred();
        }

      } catch (error) {
        console.error('[App] Error reading file:', error);
        this.hideLoading();
        this.showError('Failed to read contacts file');
      }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  /**
   * Import contacts from LinkedIn
   */
  importLinkedinContacts() {
    console.log('[App] LinkedIn import clicked');

    const modalHTML = `
      <div class="modal" id="linkedinModal" style="display: flex;">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">Import LinkedIn Contacts</h2>
            <button class="modal-close" onclick="this.closest('.modal').style.display='none'">&times;</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 1rem;">LinkedIn doesn't allow direct importing, but you can export your connections to a CSV file and import them here:</p>

            <h3 style="font-size: 1rem; margin-bottom: 0.5rem;">Step 1: Export from LinkedIn</h3>
            <ol style="margin-bottom: 1.5rem; padding-left: 1.5rem;">
              <li>Go to <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank">LinkedIn Data Export</a></li>
              <li>Check "Connections"</li>
              <li>Click "Request archive"</li>
              <li>Wait for email (usually minutes)</li>
              <li>Download the CSV file</li>
            </ol>

            <h3 style="font-size: 1rem; margin-bottom: 0.5rem;">Step 2: Import CSV</h3>
            <p style="margin-bottom: 1rem;">Select the CSV file you downloaded from LinkedIn:</p>

            <input type="file" id="linkedinFile" accept=".csv" style="margin-bottom: 1.5rem;">

            <div class="card-actions">
              <button class="btn btn-secondary" onclick="this.closest('.modal').style.display='none'">Cancel</button>
              <button class="btn btn-primary" id="processLinkedinBtn">Import LinkedIn CSV</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('linkedinModal');

    // Handle CSV import
    const processBtn = document.getElementById('processLinkedinBtn');
    processBtn.onclick = async () => {
      const input = document.getElementById('linkedinFile');
      const file = input.files[0];

      if (!file) {
        this.showError('Please select a CSV file');
        return;
      }

      console.log('[App] Processing LinkedIn CSV:', file.name);
      this.showLoading();

      try {
        const text = await file.text();
        const contacts = this.parseLinkedinCSV(text);
        console.log('[App] Parsed', contacts.length, 'LinkedIn contacts');

        // Bulk import
        let imported = 0;
        for (const contact of contacts) {
          try {
            await window.storage.saveContact(contact);
            imported++;
          } catch (error) {
            console.error('[App] Error importing LinkedIn contact:', contact.name, error);
          }
        }

        this.hideLoading();
        modal.style.display = 'none';
        this.showSuccess(`Imported ${imported} LinkedIn connections!`);

        // Refresh views
        if (typeof window.todayView !== 'undefined') {
          await window.todayView.loadTodaysData();
        }
        if (typeof window.starredView !== 'undefined') {
          await window.starredView.loadStarred();
        }

      } catch (error) {
        console.error('[App] Error processing LinkedIn CSV:', error);
        this.hideLoading();
        this.showError('Failed to process LinkedIn file');
        modal.style.display = 'none';
      }
    };

    // Clean up when closing
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };
  }

  /**
   * Parse LinkedIn CSV format
   * @param {string} csvText - CSV file contents
   * @returns {Array} - Array of contact objects
   */
  parseLinkedinCSV(csvText) {
    console.log('[App] Parsing LinkedIn CSV...');

    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const contacts = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      // Create contact from LinkedIn data
      const firstName = row['First Name'] || '';
      const lastName = row['Last Name'] || '';
      const contact = {
        id: window.encryption.generateId(),
        firstName: firstName,
        lastName: lastName,
        title: row['Position'] || '',
        company: row['Company'] || '',
        email: row['Email Address'] || '',
        phone: row['Phone Number'] || '',
        quickFacts: [],
        tags: ['linkedin', 'imported'],
        starred: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add context
      if (row['Connected On']) {
        contact.howWeMet = `Connected on LinkedIn: ${row['Connected On']}`;
      }

      // Add URL as quick fact
      if (row['URL']) {
        contact.quickFacts.push(`LinkedIn: ${row['URL']}`);
      }

      if (contact.firstName) {
        contacts.push(contact);
      }
    }

    console.log('[App] Parsed', contacts.length, 'LinkedIn contacts');
    return contacts;
  }

  /**
   * Parse vCard format to contact objects
   * @param {string} vcardText - vCard file contents
   * @returns {Array} - Array of contact objects
   */
  parseVCard(vcardText) {
    console.log('[App] Parsing vCard data...');

    // Split multiple vCards
    const cards = vcardText.split(/BEGIN:VCARD/gi).filter(card => card.trim());
    const contacts = [];

    for (const card of cards) {
      const contact = {
        id: window.encryption.generateId(),
        name: '',
        title: '',
        company: '',
        email: '',
        phone: '',
        quickFacts: [],
        tags: [],
        starred: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const lines = card.split('\n');

      for (const line of lines) {
        const cleanLine = line.trim();

        // Name (structured N field - preferred for parsing)
        if (cleanLine.match(/N[:;]/i)) {
          const nameParts = cleanLine.replace(/.*N[:;]*/i, '').split(';');
          // N format: LastName;FirstName;MiddleName;Prefix;Suffix
          contact.firstName = nameParts[1] || '';
          contact.lastName = nameParts[0] || '';
        }

        // Name (Full Name - fallback if N field not present)
        if (cleanLine.match(/FN[:;]/i) && !contact.firstName) {
          const fullName = cleanLine.replace(/.*FN[:;]*/i, '').replace(/^:/, '').trim();
          // Try to split full name into first/last
          const nameParts = fullName.split(' ');
          contact.firstName = nameParts[0] || '';
          contact.lastName = nameParts.slice(1).join(' ') || '';
        }

        // Organization/Company
        if (cleanLine.includes('ORG:')) {
          contact.company = cleanLine.replace(/.*ORG[:;]*/i, '').split(';')[0].trim();
        }

        // Title
        if (cleanLine.includes('TITLE:')) {
          contact.title = cleanLine.replace(/.*TITLE:/i, '').trim();
        }

        // Email
        if (cleanLine.match(/EMAIL[:;]/i)) {
          const emailMatch = cleanLine.match(/EMAIL.*:(.*)/i);
          if (emailMatch && !contact.email) {
            contact.email = emailMatch[1].trim();
          }
        }

        // Phone
        if (cleanLine.match(/TEL[:;]/i)) {
          const telMatch = cleanLine.match(/TEL.*:(.*)/i);
          if (telMatch && !contact.phone) {
            contact.phone = telMatch[1].trim();
          }
        }
      }

      if (contact.firstName) {
        contacts.push(contact);
      }
    }

    console.log('[App] Parsed', contacts.length, 'valid contacts');
    return contacts;
  }

  /**
   * Show contact detail
   * @param {string} contactId
   */
  showContactDetail(contactId) {
    if (window.contactDetailModal) {
      window.contactDetailModal.show(contactId);
    }
  }

  /**
   * Request background sync
   */
  async requestSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-contacts');
        console.log('[App] Background sync scheduled');
        this.showSuccess('Sync scheduled');
      } catch (error) {
        console.error('[App] Sync registration failed:', error);
      }
    } else {
      console.warn('[App] Background sync not supported');
      // Fallback: sync immediately
      this.syncData();
    }
  }

  /**
   * Sync data with server
   */
  async syncData() {
    if (!navigator.onLine) {
      this.showWarning('Offline - sync will happen when back online');
      return;
    }

    try {
      console.log('[App] Starting sync...');

      // Get unsynced contacts
      const unsyncedContacts = await window.storage.getUnsynced('contacts');
      const unsyncedMeetings = await window.storage.getUnsynced('meetings');

      if (unsyncedContacts.length === 0 && unsyncedMeetings.length === 0) {
        console.log('[App] Nothing to sync');
        return;
      }

      // Send to server (in production, replace with your API)
      console.log('[App] Syncing', unsyncedContacts.length, 'contacts');
      console.log('[App] Syncing', unsyncedMeetings.length, 'meetings');

      // Mark as synced locally
      for (const contact of unsyncedContacts) {
        await window.storage.markAsSynced('contacts', contact.id);
      }

      for (const meeting of unsyncedMeetings) {
        await window.storage.markAsSynced('meetings', meeting.id);
      }

      console.log('[App] Sync completed');
      this.showSuccess('Sync completed');

    } catch (error) {
      console.error('[App] Sync error:', error);
      this.showError('Sync failed');
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
      loadingState.classList.add('active');
    }
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
      loadingState.classList.remove('active');
    }
  }

  /**
   * Show error message
   * @param {string} message
   */
  showError(message) {
    // TO DO: Implement proper error UI
    console.error('[App] Error:', message);
  }

  /**
   * Show success message
   * @param {string} message
   */
  showSuccess(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: #27ae60;
      color: white;
      padding: 12px 24px;
      border-radius: 24px;
      z-index: 1000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideUp 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * Show warning message
   * @param {string} message
   */
  showWarning(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: #f39c12;
      color: white;
      padding: 12px 24px;
      border-radius: 24px;
      z-index: 1000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideUp 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new RememberMeApp();
    window.app.init();
  });
} else {
  window.app = new RememberMeApp();
  window.app.init();
}
