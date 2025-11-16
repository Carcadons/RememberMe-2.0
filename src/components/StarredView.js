// Starred Contacts View Component
class StarredView {
  constructor() {
    this.container = document.getElementById('starredList');
    this.emptyState = document.getElementById('starredEmpty');
    this.contacts = [];
  }

  /**
   * Initialize starred view
   */
  init() {
    console.log('[StarredView] Initialized');
  }

  /**
   * Load starred contacts
   */
  async loadStarred() {
    try {
      console.log('[StarredView] Loading starred contacts...');

      const allContacts = await window.storage.getAllContacts();
      this.contacts = allContacts.filter(contact => contact.starred);

      console.log(`[StarredView] Found ${this.contacts.length} starred contacts`);

      this.render();

    } catch (error) {
      console.error('[StarredView] Error loading starred contacts:', error);
      this.showError('Failed to load starred contacts');
    }
  }

  /**
   * Render starred contacts
   */
  render() {
    if (this.contacts.length === 0) {
      this.showEmptyState();
      return;
    }

    this.hideEmptyState();

    const html = `
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 1.5rem; font-weight: 600;">Starred Contacts</h2>
        <span style="color: var(--text-secondary); font-size: 0.875rem;">
          ${this.contacts.length} contact${this.contacts.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div class="starred-list">
        ${this.contacts.map(contact => this.renderContactCard(contact)).join('')}
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  /**
   * Render contact card
   * @param {Object} contact
   * @returns {string}
   */
  renderContactCard(contact) {
    // Combine firstName and lastName for display (fallback to name for backwards compatibility)
    const displayName = contact.firstName && contact.lastName
      ? `${contact.firstName} ${contact.lastName}`.trim()
      : (contact.firstName || contact.name || '');

    const initials = this.getInitials(displayName);
    const photoHtml = contact.photo
      ? `<img src="${contact.photo}" alt="${displayName}" class="person-photo">`
      : `<div class="person-photo">${initials}</div>`;

    const quickFacts = contact.quickFacts || [];
    const lastNotes = contact.notes ? contact.notes.slice(-2) : [];

    return `
      <div class="person-card" style="position: relative;">
        <!-- Unstar button -->
        <button onclick="window.starredView.unstarContact('${contact.id}')"
                style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #f39c12; z-index: 10;">
          ★
        </button>

        <div class="person-header" onclick="window.app.showContactDetail('${contact.id}')">
          ${photoHtml}
          <div class="person-info">
            <h3>${displayName}</h3>
            <p>${contact.title || 'No title'}${contact.company ? ` at ${contact.company}` : ''}</p>
            ${contact.howWeMet ? `<p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${contact.howWeMet}</p>` : ''}
            ${contact.lastMet ? `<p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Last met: ${this.formatDate(contact.lastMet)}</p>` : ''}
          </div>
        </div>

        ${quickFacts.length > 0 ? `
          <div class="memory-chips">
            ${quickFacts.slice(0, 3).map(fact => `
              <div class="memory-chip">
                <span style="font-size: 0.7rem;">💡</span>
                <span>${this.truncate(fact, 25)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${lastNotes.length > 0 ? `
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
            <p style="font-size: 0.75rem; color: var(--text-secondary);">Recent notes:</p>
            ${lastNotes.map(note => `
              <p style="font-size: 0.8rem; margin-top: 0.25rem; font-style: italic;">
                "${this.truncate(note, 80)}"
              </p>
            `).join('')}
          </div>
        ` : ''}

        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" style="flex: 1; padding: 0.5rem; font-size: 0.875rem;"
                  onclick="window.starredView.addNote('${contact.id}')">
            Add Note
          </button>
          <button class="btn btn-primary" style="flex: 1; padding: 0.5rem; font-size: 0.875rem;"
                  onclick="window.starredView.editContact('${contact.id}')">
            Edit
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Event listeners are attached inline for simplicity
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    this.container.classList.add('hidden');
    this.emptyState.classList.remove('hidden');
  }

  /**
   * Hide empty state
   */
  hideEmptyState() {
    this.emptyState.classList.add('hidden');
    this.container.classList.remove('hidden');
  }

  /**
   * Show error message
   * @param {string} message
   */
  showError(message) {
    this.container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--danger-color);">
        <p>${message}</p>
      </div>
    `;
    this.hideEmptyState();
  }

  /**
   * Unstar contact
   * @param {string} contactId
   */
  async unstarContact(contactId) {
    try {
      const contact = await window.storage.getContact(contactId);
      if (contact) {
        contact.starred = false;
        await window.storage.saveContact(contact);
        await this.loadStarred();
        window.app.showSuccess('Contact unstarred');
      }
    } catch (error) {
      console.error('[StarredView] Error unstarring contact:', error);
      window.app.showError('Failed to unstar contact');
    }
  }

  /**
   * Add note to contact
   * @param {string} contactId
   */
  addNote(contactId) {
    // Will open note modal
    const note = prompt('Add a quick note:');
    if (note && note.trim()) {
      window.storage.getContact(contactId).then(contact => {
        if (contact) {
          if (!contact.notes) contact.notes = [];
          contact.notes.push(`${new Date().toISOString()}|${note.trim()}`);
          window.storage.saveContact(contact).then(() => {
            this.loadStarred();
            window.app.showSuccess('Note added!');
          });
        }
      });
    }
  }

  /**
   * Edit contact
   * @param {string} contactId
   */
  editContact(contactId) {
    window.storage.getContact(contactId).then(contact => {
      if (contact && window.addContactModal) {
        window.addContactModal.edit(contact);
      }
    });
  }

  /**
   * Get initials from name
   * @param {string} name
   * @returns {string}
   */
  getInitials(name) {
    if (!name) return '?';
    return name.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /**
   * Format date for display
   * @param {string} dateString
   * @returns {string}
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day} ${month} ${year}`;
  }

  /**
   * Truncate text to length
   * @param {string} text
   * @param {number} length
   * @returns {string}
   */
  truncate(text, length) {
    if (!text || text.length <= length) return text;
    return text.slice(0, length) + '...';
  }
}

// Export singleton instance
window.starredView = new StarredView();
