// Security and Authentication Module
// Handles passcode setup, biometrics, and app lock

class Security {
  constructor() {
    this.isAuthenticated = false;
    this.authTimeout = null;
    this.AUTH_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
    this.biometricAvailable = false;
  }

  /**
   * Initialize security module
   */
  async init() {
    console.log('[Security] Initializing...');

    // Check if passcode is already set
    const passcodeHash = await window.storage.getSetting('passcodeHash');
    const passcodeSet = !!passcodeHash;

    if (passcodeSet) {
      console.log('[Security] Passcode is already set');
      this.updateAuthButton(true);
    } else {
      console.log('[Security] No passcode set');
      this.updateAuthButton(false);
    }

    // Check for biometric availability
    await this.checkBiometricAvailability();

    console.log('[Security] Initialized');
  }

  /**
   * Check if biometrics are available
   */
  async checkBiometricAvailability() {
    // Check if WebAuthn is available
    if (window.PublicKeyCredential) {
      try {
        // Check if platform authenticator is available
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        this.biometricAvailable = available;
        console.log('[Security] Biometric auth available:', available);
      } catch (error) {
        console.log('[Security] Biometric auth not available:', error);
        this.biometricAvailable = false;
      }
    } else {
      console.log('[Security] WebAuthn not available');
      this.biometricAvailable = false;
    }
  }

  /**
   * Update auth button based on state
   * @param {boolean} passcodeSet
   */
  updateAuthButton(passcodeSet) {
    const authButton = document.getElementById('authButton');
    const authText = document.getElementById('authText');

    if (passcodeSet) {
      if (this.isAuthenticated) {
        authText.textContent = 'Locked';
        authButton.onclick = () => this.lockApp();
      } else {
        authText.textContent = 'Unlock';
        authButton.onclick = () => this.showAuthModal('unlock');
      }
    } else {
      authText.textContent = 'Set Passcode';
      authButton.onclick = () => this.showAuthModal('setup');
    }
  }

  /**
   * Show authentication modal
   * @param {string} mode - 'setup' or 'unlock'
   */
  showAuthModal(mode = 'setup') {
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authTitle');
    const desc = document.getElementById('authDesc');
    const input = document.getElementById('passcodeInput');
    const confirmBtn = document.getElementById('confirmAuthBtn');

    // Reset state
    input.value = '';
    this.hideError();

    if (mode === 'setup') {
      title.textContent = 'Set Passcode';
      desc.textContent = 'Create a 6-digit passcode to secure your data';
      confirmBtn.textContent = 'Set Passcode';
      confirmBtn.onclick = () => this.handleSetupPasscode();
    } else {
      title.textContent = 'Unlock';
      desc.textContent = 'Enter your passcode to unlock';
      confirmBtn.textContent = 'Unlock';
      confirmBtn.onclick = () => this.handleUnlock();
    }

    modal.classList.add('active');
    input.focus();

    // Handle Enter key
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        confirmBtn.click();
      }
    };

    // Handle cancel
    document.getElementById('cancelAuthBtn').onclick = () => {
      this.hideAuthModal();
    };
  }

  /**
   * Hide auth modal
   */
  hideAuthModal() {
    const modal = document.getElementById('authModal');
    modal.classList.remove('active');
    this.hideError();
  }

  /**
   * Show error message
   * @param {string} message
   */
  showError(message) {
    const errorEl = document.getElementById('authError');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  /**
   * Hide error message
   */
  hideError() {
    const errorEl = document.getElementById('authError');
    errorEl.style.display = 'none';
  }

  /**
   * Handle passcode setup
   */
  async handleSetupPasscode() {
    const passcode = document.getElementById('passcodeInput').value;

    if (!passcode || passcode.length !== 6) {
      this.showError('Passcode must be 6 digits');
      return;
    }

    if (!/^\d+$/.test(passcode)) {
      this.showError('Passcode must be numeric');
      return;
    }

    try {
      // Enable encryption
      await window.storage.enableEncryption(passcode);

      // Mark as authenticated
      this.isAuthenticated = true;
      this.startAuthTimer();

      // Update UI
      this.updateAuthButton(true);
      this.hideAuthModal();

      // Initialize app with data
      await window.app.loadData();

      this.showSuccess('Passcode set successfully!');

    } catch (error) {
      console.error('Setup passcode error:', error);
      this.showError('Failed to set passcode. Please try again.');
    }
  }

  /**
   * Handle app unlock
   */
  async handleUnlock() {
    const passcode = document.getElementById('passcodeInput').value;

    if (!passcode) {
      this.showError('Please enter your passcode');
      return;
    }

    try {
      // Verify passcode
      const isValid = await window.storage.verifyPasscode(passcode);

      if (isValid) {
        // Store passcode for decryption
        window.storage.passcode = passcode;
        this.isAuthenticated = true;
        this.startAuthTimer();

        // Update UI
        this.updateAuthButton(true);
        this.hideAuthModal();

        // Initialize app with data
        await window.app.loadData();

        this.showSuccess('Unlocked successfully!');
      } else {
        this.showError('Invalid passcode. Please try again.');
        document.getElementById('passcodeInput').value = '';
        document.getElementById('passcodeInput').focus();
      }

    } catch (error) {
      console.error('Unlock error:', error);
      this.showError('Failed to unlock. Please try again.');
    }
  }

  /**
   * Lock the app
   */
  lockApp() {
    this.isAuthenticated = false;
    window.storage.passcode = null;

    // Clear sensitive data from UI
    window.app.hideAllData();

    this.updateAuthButton(true);
    this.showSuccess('App locked');

    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }
  }

  /**
   * Start authentication timeout timer
   */
  startAuthTimer() {
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
    }

    this.authTimeout = setTimeout(() => {
      console.log('[Security] Auth timeout - locking app');
      this.lockApp();
    }, this.AUTH_TIMEOUT_MS);

    console.log('[Security] Auth timer started');
  }

  /**
   * Reset auth timer on user activity
   */
  resetAuthTimer() {
    if (this.isAuthenticated && this.authTimeout) {
      console.log('[Security] Resetting auth timer');
      this.startAuthTimer();
    }
  }

  /**
   * Attempt biometric authentication
   */
  async authenticateWithBiometrics() {
    if (!this.biometricAvailable) {
      this.showError('Biometric authentication not available');
      return false;
    }

    try {
      // Create credential request for biometric auth
      const publicKey = {
        challenge: new Uint8Array(32),
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname
      };

      const credential = await navigator.credentials.get({
        publicKey
      });

      if (credential) {
        console.log('[Security] Biometric authentication successful');
        this.isAuthenticated = true;
        this.startAuthTimer();
        this.updateAuthButton(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Security] Biometric auth failed:', error);
      return false;
    }
  }

  /**
   * Change passcode
   * @param {string} oldPasscode
   * @param {string} newPasscode
   */
  async changePasscode(oldPasscode, newPasscode) {
    try {
      // Verify old passcode
      const isValid = await window.storage.verifyPasscode(oldPasscode);
      if (!isValid) {
        throw new Error('Current passcode is incorrect');
      }

      // Re-encrypt all data with new passcode
      const contacts = await window.storage.getAllContacts();
      const meetings = await window.storage.getAllMeetings();

      // Temporarily disable encryption
      window.storage.encryptionEnabled = false;
      window.storage.passcode = null;

      // Re-enable with new passcode
      await window.storage.enableEncryption(newPasscode);
      window.storage.passcode = newPasscode;

      // Save all data with new encryption
      for (const contact of contacts) {
        await window.storage.saveContact(contact);
      }

      for (const meeting of meetings) {
        await window.storage.saveMeeting(meeting);
      }

      this.showSuccess('Passcode changed successfully!');
    } catch (error) {
      console.error('Change passcode error:', error);
      throw error;
    }
  }

  /**
   * Check if app should be locked
   * @returns {Promise<boolean>}
   */
  async shouldLockApp() {
    const passcodeSet = await window.storage.getSetting('passcodeHash');
    const encryptionEnabled = await window.storage.isEncryptionEnabled();

    return passcodeSet && encryptionEnabled && !this.isAuthenticated;
  }

  /**
   * Require authentication wrapper
   * @param {Function} callback - Function to call after authentication
   */
  async requireAuth(callback) {
    const shouldLock = await this.shouldLockApp();

    if (shouldLock && !this.isAuthenticated) {
      this.showAuthModal('unlock');
      // Store callback to execute after auth
      this.pendingCallback = callback;
    } else {
      this.resetAuthTimer();
      callback();
    }
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
}

// Export singleton instance
window.security = new Security();

// Listen for user activity to reset auth timer
['click', 'touchstart', 'keydown'].forEach(event => {
  document.addEventListener(event, () => {
    if (window.security) {
      window.security.resetAuthTimer();
    }
  });
});
