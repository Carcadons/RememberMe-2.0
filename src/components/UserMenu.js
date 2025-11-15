// User Menu Component
class UserMenu {
  constructor() {
    this.isOpen = false;
  }

  init() {
    this.attachEventListeners();
    this.updateConnectionStatus();
    console.log('[UserMenu] Initialized');
  }

  attachEventListeners() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Toggle dropdown
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Logout button
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        this.hide();
        await window.app.logout();
      });
    }

    // Close when clicking outside
    document.addEventListener('click', () => {
      if (this.isOpen) {
        this.hide();
      }
    });

    // Handle online/offline events
    window.addEventListener('online', () => {
      this.updateConnectionStatus('online');
      console.log('[UserMenu] Connection: online');
    });

    window.addEventListener('offline', () => {
      this.updateConnectionStatus('offline');
      console.log('[UserMenu] Connection: offline');
    });

    // Check connection periodically
    setInterval(() => {
      this.checkConnection();
    }, 5000);
  }

  /**
   * Toggle menu open/close
   */
  toggle() {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Show user menu
   */
  show() {
    const dropdown = document.getElementById('userMenuDropdown');
    const user = window.authService.getCurrentUser();

    // Update user info
    if (user) {
      document.getElementById('userName').textContent = user.name || 'User';
      document.getElementById('userEmail').textContent = user.email || '';
      document.getElementById('userInitial').textContent = user.name ? user.name.charAt(0).toUpperCase() : '👤';
    }

    dropdown.classList.remove('hidden');
    this.isOpen = true;
    console.log('[UserMenu] Menu shown');
  }

  /**
   * Hide user menu
   */
  hide() {
    const dropdown = document.getElementById('userMenuDropdown');
    dropdown.classList.add('hidden');
    this.isOpen = false;
    console.log('[UserMenu] Menu hidden');
  }

  /**
   * Update connection status indicator
   */
  updateConnectionStatus(status = null) {
    const indicator = document.getElementById('connectionStatus');

    if (!indicator) return;

    // Check actual status if not provided
    if (!status) {
      status = navigator.onLine ? 'online' : 'offline';
    }

    if (status === 'online') {
      indicator.innerHTML = `
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
        <span>Online</span>
      `;
      indicator.style.background = 'rgba(16, 185, 129, 0.1)';
      indicator.style.color = '#10b981';
      indicator.title = 'Online - Connected to server';
    } else {
      indicator.innerHTML = `
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444;"></span>
        <span>Offline</span>
      `;
      indicator.style.background = 'rgba(239, 68, 68, 0.1)';
      indicator.style.color = '#ef4444';
      indicator.title = 'Offline - Using local data';
    }
  }

  /**
   * Check actual server connection
   */
  async checkConnection() {
    if (!navigator.onLine) {
      this.updateConnectionStatus('offline');
      return;
    }

    // Try to ping the server
    try {
      const response = await fetch('', { method: 'HEAD' });
      if (response.ok) {
        this.updateConnectionStatus('online');
      } else {
        this.updateConnectionStatus('offline');
      }
    } catch (error) {
      this.updateConnectionStatus('offline');
    }
  }
}

// Export singleton instance
window.userMenu = new UserMenu();
