// Contacts/Search Component - Displays and searches contacts
class SearchView {
  constructor() {
    this.container = document.getElementById('contactsList');
    this.searchInput = document.getElementById('searchInput');
    this.emptyState = document.getElementById('contactsEmpty');
    this.allContacts = [];
    this.activeTouchCard = null;
  }

  /**
   * Get display name from contact (combines firstName and lastName, or falls back to name)
   * @param {Object} contact
   * @returns {string}
   */
  getDisplayName(contact) {
    return contact.firstName
      ? (contact.lastName ? `${contact.firstName} ${contact.lastName}` : contact.firstName)
      : (contact.name || '');
  }

  /**
   * Initialize search
   */
  init() {
    this.attachEventListeners();
    this.loadAllContacts();
    console.log('[Search] Initialized');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.searchInput.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });

    this.searchInput.addEventListener('focus', () => {
      if (this.allContacts.length === 0) {
        this.loadAllContacts();
      }
    });

    // Clear search on Escape
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.searchInput.value = '';
        this.clearResults();
      }
    });

    // CRITICAL FIX: Add touch/click event delegation for contact cards (iOS compatibility)
    this.container.addEventListener('click', (e) => {
      const contactCard = e.target.closest('.person-card');
      if (contactCard && !e.target.classList.contains('btn')) {
        e.preventDefault();
        e.stopPropagation();
        const contactId = contactCard.dataset.contactId;
        if (contactId) {
          console.log('[Search] Contact card clicked:', contactId);
          this.viewContact(contactId);
        }
      }
    });

    // Handle touch events for iOS
    this.container.addEventListener('touchstart', (e) => {
      const contactCard = e.target.closest('.person-card');
      if (contactCard && !e.target.classList.contains('btn')) {
        this.activeTouchCard = contactCard;
        contactCard.style.opacity = '0.7';
      }
    }, { passive: true });

    this.container.addEventListener('touchend', (e) => {
      const contactCard = e.target.closest('.person-card');
      if (contactCard && !e.target.classList.contains('btn')) {
        contactCard.style.opacity = '1';
        if (this.activeTouchCard === contactCard) {
          const contactId = contactCard.dataset.contactId;
          if (contactId) {
            console.log('[Search] Contact card touched:', contactId);
            this.viewContact(contactId);
          }
        }
        this.activeTouchCard = null;
      }
    });

    this.container.addEventListener('touchcancel', () => {
      if (this.activeTouchCard) {
        this.activeTouchCard.style.opacity = '1';
        this.activeTouchCard = null;
      }
    });
  }

  /**
   * Load all contacts for searching
   */
  async loadAllContacts() {
    try {
      this.allContacts = await window.storage.getAllContacts();
      console.log(`[Search] Loaded ${this.allContacts.length} contacts for search`);
      this.renderAllContacts();
    } catch (error) {
      console.error('[Search] Error loading contacts:', error);
    }
  }

  /**
   * Handle search input with fuzzy matching
   * @param {string} query
   */
  async handleSearch(query) {
    if (!query.trim()) {
      this.renderAllContacts();
      return;
    }

    if (this.allContacts.length === 0) {
      await this.loadAllContacts();
    }

    try {
      const results = this.fuzzySearch(query, this.allContacts);
      this.renderResults(results, query);
    } catch (error) {
      console.error('[Search] Search error:', error);
    }
  }

  /**
   * Fuzzy search implementation
   * @param {string} query
   * @param {Array} contacts
   * @returns {Array} - Matched contacts with scores
   */
  fuzzySearch(query, contacts) {
    const queryLower = query.toLowerCase();
    const results = [];

    for (const contact of contacts) {
      let score = 0;
      const matches = [];

      // Search in name
      const displayName = this.getDisplayName(contact);
      const nameMatch = this.calculateMatchScore(queryLower, displayName.toLowerCase());
      if (nameMatch > 0) {
        score += nameMatch * 3; // Higher weight for name
        matches.push('name');
      }

      // Search in company
      if (contact.company) {
        const companyMatch = this.calculateMatchScore(queryLower, contact.company.toLowerCase());
        if (companyMatch > 0) {
          score += companyMatch * 2;
          matches.push('company');
        }
      }

      // Search in tags
      if (contact.tags && contact.tags.length > 0) {
        for (const tag of contact.tags) {
          const tagMatch = this.calculateMatchScore(queryLower, tag.toLowerCase());
          if (tagMatch > 0) {
            score += tagMatch * 1.5;
            matches.push('tag');
            break;
          }
        }
      }

      // Search in quick facts
      if (contact.quickFacts && contact.quickFacts.length > 0) {
        for (const fact of contact.quickFacts) {
          const factMatch = this.calculateMatchScore(queryLower, fact.toLowerCase());
          if (factMatch > 0) {
            score += factMatch * 1.5;
            matches.push('fact');
            break;
          }
        }
      }

      // Search in how we met
      if (contact.howWeMet) {
        const howMatch = this.calculateMatchScore(queryLower, contact.howWeMet.toLowerCase());
        if (howMatch > 0) {
          score += howMatch;
          matches.push('howWeMet');
        }
      }

      // If we have any matches, add to results
      if (score > 0) {
        results.push({
          contact,
          score,
          matches
        });
      }
    }

    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate match score (0-1)
   * @param {string} query
   * @param {string} text
   * @returns {number}
   */
  calculateMatchScore(query, text) {
    // Exact match
    if (text === query) return 1;

    // Starts with
    if (text.startsWith(query)) return 0.9;

    // Contains
    if (text.includes(query)) return 0.7;

    // Word boundary match
    const words = text.split(/\s+/);
    for (const word of words) {
      if (word.startsWith(query)) return 0.6;
    }

    // Fuzzy match (character by character)
    let queryIndex = 0;
    let matchCount = 0;

    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        matchCount++;
        queryIndex++;
      }
    }

    if (queryIndex === query.length) {
      return 0.5 * (matchCount / query.length);
    }

    return 0;
  }

  /**
   * Render all contacts in alphabetical order
   */
  renderAllContacts() {
    if (this.allContacts.length === 0) {
      this.container.classList.add('hidden');
      if (this.emptyState) {
        this.emptyState.classList.remove('hidden');
      }
      return;
    }

    // Hide empty state, show contacts
    if (this.emptyState) {
      this.emptyState.classList.add('hidden');
    }
    this.container.classList.remove('hidden');

    // Sort contacts alphabetically by name
    const sortedContacts = [...this.allContacts].sort((a, b) =>
      this.getDisplayName(a).localeCompare(this.getDisplayName(b))
    );

    const html = `
      <div style="margin-bottom: 1rem;">
        <h2 style="font-size: 1.5rem; font-weight: 600;">All Contacts</h2>
        <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.25rem;">
          ${sortedContacts.length} contact${sortedContacts.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div class="search-results-list">
        ${sortedContacts.map(contact => this.renderContactCard(contact)).join('')}
      </div>
    `;

    this.container.innerHTML = html;
  }

  /**
   * Render search results
   * @param {Array} results
   * @param {string} query
   */
  renderResults(results, query) {
    if (results.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <h3>No contacts found</h3>
          <p>No contacts match "${query}"</p>
        </div>
      `;
      return;
    }

    const html = `
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 1.5rem; font-weight: 600;">Search Results</h2>
        <span style="color: var(--text-secondary); font-size: 0.875rem;">
          ${results.length} result${results.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div class="search-results-list">
        ${results.map(({ contact }) => this.renderContactCard(contact)).join('')}
      </div>
    `;

    this.container.innerHTML = html;
  }

  /**
   * Render contact card for search results
   * @param {Object} contact
   * @returns {string}
   */
  renderContactCard(contact) {
    const displayName = this.getDisplayName(contact);
    const initials = this.getInitials(displayName);
    const photoHtml = contact.photo
      ? `<img src="${contact.photo}" alt="${displayName}" class="person-photo">`
      : `<div class="person-photo">${initials}</div>`;

    const quickFacts = contact.quickFacts || [];

    return `
      <div class="person-card" data-contact-id="${contact.id}" style="cursor: pointer; -webkit-tap-highlight-color: transparent;">
        <div class="person-header">
          ${photoHtml}
          <div class="person-info">
            <h3>${displayName}</h3>
            <p>${contact.title || 'No title'}${contact.company ? ` at ${contact.company}` : ''}</p>
            ${contact.howWeMet ? `<p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${contact.howWeMet}</p>` : ''}
          </div>
          ${contact.starred ? '<div style="color: #f39c12;">★</div>' : ''}
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
      </div>
    `;
  }

  /**
   * Clear search results
   */
  clearResults() {
    this.container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 80px; height: 80px; opacity: 0.3;">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <h3>Search your contacts</h3>
        <p>Find people by name, company, or tags</p>
      </div>
    `;
  }

  /**
   * View contact details
   * @param {string} contactId
   */
  viewContact(contactId) {
    console.log('[Search] Viewing contact:', contactId);
    // Will open detail modal
    window.app.showContactDetail(contactId);
  }

  /**
   * Edit contact
   * @param {string} contactId
   */
  editContact(contactId) {
    // Implementation will be in contact detail view
    console.log('[Search] Editing contact:', contactId);
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
window.searchView = new SearchView();
