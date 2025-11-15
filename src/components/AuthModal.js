// Authentication Modal Component
class AuthModal {
  constructor() {
    this.isLoginMode = true;
  }

  init() {
    console.log('[AuthModal] Initialized');
  }

  /**
   * Show auth modal
   */
  show() {
    console.log('[AuthModal] Showing auth modal, isLoginMode:', this.isLoginMode, 'document:', document);

    const modalHTML = `
      <div class="modal" id="authModal" style="display: flex;">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title" id="authTitle">${this.isLoginMode ? 'Sign In' : 'Create Account'}</h2>
            <button class="modal-close" onclick="window.authModal.hide()">&times;</button>
          </div>
          <div class="modal-body">
            <form id="authForm">
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" id="emailInput" required placeholder="your@email.com">
              </div>

              <div class="form-group" id="nameGroup" style="display: ${this.isLoginMode ? 'none' : 'block'};">
                <label class="form-label">Full Name</label>
                <input type="text" class="form-control" id="nameInput" required placeholder="Your Name">
              </div>

              <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" class="form-control" id="passwordInput" required placeholder="••••••••">
              </div>

              <div id="authError" class="text-danger" style="margin-bottom: 1rem; font-size: 0.875rem; display: none;"></div>

              <div class="card-actions">
                <button type="button" class="btn btn-secondary" onclick="window.authModal.hide()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  ${this.isLoginMode ? 'Sign In' : 'Create Account'}
                </button>
              </div>
            </form>

            <div style="text-align: center; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
              <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                ${this.isLoginMode ? "Don't have an account?" : "Already have an account?"}
              </p>
              <button type="button" class="btn btn-link" id="toggleAuthMode" style="font-size: 0.875rem;">
                ${this.isLoginMode ? 'Create Account' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    console.log('[AuthModal] Inserting modal into DOM');
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    console.log('[AuthModal] Modal inserted');

    this.attachEventListeners();
    console.log('[AuthModal] Event listeners attached');
  }

  /**
   * Hide modal
   */
  hide() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const form = document.getElementById('authForm');
    const toggleBtn = document.getElementById('toggleAuthMode');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    toggleBtn.addEventListener('click', () => {
      this.toggleMode();
    });
  }

  /**
   * Toggle between login and register mode
   */
  toggleMode() {
    this.isLoginMode = !this.isLoginMode;

    const title = document.getElementById('authTitle');
    const nameGroup = document.getElementById('nameGroup');
    const submitBtn = document.querySelector('#authForm button[type="submit"]');
    const toggleBtn = document.getElementById('toggleAuthMode');
    const question = document.querySelector('.modal-body > div:last-child p');

    const modeConfig = {
      title: this.isLoginMode ? 'Sign In' : 'Create Account',
      submit: this.isLoginMode ? 'Sign In' : 'Create Account',
      toggle: this.isLoginMode ? 'Create Account' : 'Sign In',
      question: this.isLoginMode ? "Don't have an account?" : "Already have an account?"
    };

    title.textContent = modeConfig.title;
    submitBtn.textContent = modeConfig.submit;
    toggleBtn.textContent = modeConfig.toggle;
    question.textContent = modeConfig.question;

    nameGroup.style.display = this.isLoginMode ? 'none' : 'block';

    // Clear any errors
    this.hideError();
  }

  /**
   * Handle form submission
   */
  async handleSubmit() {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const name = document.getElementById('nameInput')?.value.trim() || '';

    if (!email || !password || (!this.isLoginMode && !name)) {
      this.showError('Please fill in all fields');
      return;
    }

    // Disable form while processing
    const submitBtn = document.querySelector('#authForm button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait...';

    let result;

    if (this.isLoginMode) {
      result = await window.authService.login(email, password);
    } else {
      result = await window.authService.register(email, password, name);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = this.isLoginMode ? 'Sign In' : 'Create Account';

    if (result.success) {
      console.log('[AuthModal] Authentication successful');
      this.hide();
      window.app.onAuthSuccess();
    } else {
      this.showError(result.error || 'Authentication failed');
    }
  }

  /**
   * Show error message
   * @param {string} message
   */
  showError(message) {
    const errorDiv = document.getElementById('authError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  /**
   * Hide error message
   */
  hideError() {
    const errorDiv = document.getElementById('authError');
    errorDiv.style.display = 'none';
  }
}

// Export singleton instance
window.authModal = new AuthModal();
