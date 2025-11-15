// Authentication Service
class AuthService {
  constructor() {
    this.apiUrl = this.getApiUrl();
    this.user = null;
    this.isAuthenticated = false;
  }

  /**
   * Get API URL (works for both localhost and Replit)
   */
  getApiUrl() {
    // For Replit deployment
    if (window.location.hostname.includes('repl.co') || window.location.hostname.includes('replit.app')) {
      return '';
    }
    // For local development
    return window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
  }

  /**
   * Register new user
   * @param {string} email
   * @param {string} password
   * @param {string} name
   */
  async register(email, password, name) {
    console.log('[Auth] Registering user:', email);

    try {
      const response = await fetch(`${this.apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password: this.hashPassword(password),
          name
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      console.log('[Auth] Registration successful:', data.user.id);

      // Store user session
      this.user = data.user;
      this.isAuthenticated = true;
      this.saveSession();

      return { success: true, user: data.user };

    } catch (error) {
      console.error('[Auth] Registration error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Login user
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    console.log('[Auth] Logging in user:', email);

    try {
      const response = await fetch(`${this.apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password: this.hashPassword(password)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      console.log('[Auth] Login successful:', data.user.id);

      // Store user session
      this.user = data.user;
      this.isAuthenticated = true;
      this.saveSession();

      return { success: true, user: data.user };

    } catch (error) {
      console.error('[Auth] Login error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Logout user
   */
  logout() {
    console.log('[Auth] Logging out user');
    this.user = null;
    this.isAuthenticated = false;
    this.clearSession();
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    if (!this.user) {
      this.loadSession();
    }
    return this.user;
  }

  /**
   * Check if user is authenticated
   */
  checkAuth() {
    console.log('[Auth] Checking auth status, current isAuthenticated:', this.isAuthenticated);
    if (!this.isAuthenticated) {
      this.loadSession();
      console.log('[Auth] After loadSession, isAuthenticated:', this.isAuthenticated);
    }
    return this.isAuthenticated;
  }

  /**
   * Save session to localStorage
   */
  saveSession() {
    if (this.user) {
      localStorage.setItem('rememberme_user', JSON.stringify(this.user));
      localStorage.setItem('rememberme_auth', 'true');
    }
  }

  /**
   * Load session from localStorage
   */
  loadSession() {
    try {
      const userData = localStorage.getItem('rememberme_user');
      const authStatus = localStorage.getItem('rememberme_auth');

      if (userData && authStatus === 'true') {
        this.user = JSON.parse(userData);
        this.isAuthenticated = true;
        console.log('[Auth] Session loaded for user:', this.user.id);
      }
    } catch (error) {
      console.error('[Auth] Error loading session:', error);
      this.clearSession();
    }
  }

  /**
   * Clear session
   */
  clearSession() {
    localStorage.removeItem('rememberme_user');
    localStorage.removeItem('rememberme_auth');
  }

  /**
   * Hash password for authentication
   * In zero-knowledge architecture, client handles password hashing
   * @param {string} password
   */
  hashPassword(password) {
    // Simple hash for demo - in production use proper client-side hashing
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Verify user session with server
   */
  async verifySession() {
    if (!this.user) return false;

    try {
      const response = await fetch(`${this.apiUrl}/api/auth/user/${this.user.id}`);
      const data = await response.json();

      if (data.success) {
        console.log('[Auth] Session verified for user:', this.user.id);
        return true;
      }

      this.logout();
      return false;

    } catch (error) {
      console.error('[Auth] Session verification error:', error);
      return false;
    }
  }
}

// Export singleton instance
window.authService = new AuthService();
