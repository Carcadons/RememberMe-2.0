// Security Module - Simplified (no passcode, just app protection)
class Security {
  constructor() {
    this.isAuthenticated = false;
  }

  init() {
    console.log('[Security] Initialized (passcode removed)');
  }

  // Placeholder for backward compatibility
  async shouldLockApp() {
    return false; // Always unlocked since we use email/password auth
  }
}

// Export singleton instance
window.security = new Security();
