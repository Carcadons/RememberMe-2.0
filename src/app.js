// Main Application Controller for RememberMe
// Initializes and coordinates all components

class RememberMeApp {
  constructor() {
    this.currentView = 'todayView';
    this.initialized = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('[App] Initializing RememberMe...');

    try {
      // Show loading state
      this.showLoading();

      // Register service worker
      await this.registerServiceWorker();

      // Initialize storage
      await window.storage.init();

      // Initialize security
      await window.security.init();

      // Initialize UI components
      if (window.todayView) await window.todayView.init();
      if (window.searchView) window.searchView.init();
      if (window.starredView) window.starredView.init();
      if (window.addContactModal) window.addContactModal.init();
      if (window.contactDetailModal) window.contactDetailModal.init();

      // Set up event listeners
      this.setupEventListeners();

      // Check authentication
      const needsAuth = await this.checkAuthentication();

      if (!needsAuth) {
        // Load data if no auth required
        await this.loadData();
      }

      this.initialized = true;
      console.log('[App] RememberMe initialized successfully');

    } catch (error) {
      console.error('[App] Initialization error:', error);
      this.showError('Failed to initialize app. Please refresh.');
    } finally {
      this.hideLoading();
    }
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

      console.log('[App] Data loaded successfully');
    } catch (error) {
      console.error('[App] Error loading data:', error);
      this.showError('Failed to load data');
    }
  }

  /**
   * Hide all data (when locking app)
   */
  hideAllData() {
    this.container.innerHTML = '';
    this.showEmptyState();
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

    // Floating action button
    const addBtn = document.getElementById('addPersonBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.addNewPerson();
      });
    }

    // Auth button
    const authButton = document.getElementById('authButton');
    if (authButton) {
      // Already handled in security module
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
      case 'searchView':
        window.searchView.init();
        break;
      case 'starredView':
        await window.starredView.loadStarred();
        break;
    }
  }

  /**
   * Add new person
   */
  addNewPerson() {
    console.log('[App] Add new person clicked');
    if (window.addContactModal) {
      window.addContactModal.show();
    }
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
