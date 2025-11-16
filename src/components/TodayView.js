// Today View Component
// Shows meetings and people you're meeting with today

class TodayView {
  constructor() {
    this.container = document.getElementById('todayList');
    this.emptyState = document.getElementById('todayEmpty');
    this.meetings = [];
  }

  /**
   * Initialize today view
   */
  async init() {
    console.log('[TodayView] Initializing...');
    await this.loadTodaysData();
    console.log('[TodayView] Initialized');
  }

  /**
   * Load today's meetings and contacts
   */
  async loadTodaysData() {
    try {
      console.log('[TodayView] Loading today\'s data...');

      // Get today's meetings from both sources:
      // 1. Full meeting records from meetings table
      // 2. Contacts with nextMeetingDate scheduled for today
      const [todaysMeetings, scheduledContacts] = await Promise.all([
        window.storage.getTodaysMeetings(),
        window.storage.getTodaysScheduledContacts()
      ]);

      // Combine both lists
      this.meetings = [...todaysMeetings, ...scheduledContacts];
      console.log(`[TodayView] Found ${todaysMeetings.length} full meetings and ${scheduledContacts.length} scheduled contacts. Total: ${this.meetings.length}`);

      // Get all contacts for mapping
      this.contacts = await window.storage.getAllContacts();

      this.render();

    } catch (error) {
      console.error('[TodayView] Error loading today\'s data:', error);
      this.showError('Failed to load today\'s meetings');
    }
  }

  /**
   * Render the today view
   */
  render() {
    if (this.meetings.length === 0) {
      this.showEmptyState();
      return;
    }

    this.hideEmptyState();

    const html = this.meetings.map(meeting => {
      const contact = this.contacts.find(c => c.id === meeting.personId);
      return this.renderMeetingCard(meeting, contact);
    }).join('');

    this.container.innerHTML = `
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 1.5rem; font-weight: 600;">Today's Meetings</h2>
        <span style="color: var(--text-secondary); font-size: 0.875rem;">
          ${this.meetings.length} meeting${this.meetings.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div class="meetings-list">
        ${html}
      </div>
    `;

    // Add click handlers
    this.attachEventListeners();
  }

  /**
   * Render a single meeting card
   * @param {Object} meeting - Meeting data
   * @param {Object} contact - Contact data
   * @returns {string} - HTML string
   */
  renderMeetingCard(meeting, contact) {
    if (!contact) {
      return `
        <div class="person-card" style="opacity: 0.7;">
          <div class="person-header">
            <div class="person-photo">
              ?
            </div>
            <div class="person-info">
              <h3>Unknown Person</h3>
              <p>Contact not found</p>
            </div>
          </div>
          <div class="meeting-details" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <p style="font-size: 0.875rem; color: var(--text-secondary);">Time</p>
                <p style="font-weight: 600;">${this.formatTime(meeting.date)}</p>
              </div>
              <div style="text-align: right;">
                <p style="font-size: 0.875rem; color: var(--text-secondary);">Topic</p>
                <p style="font-weight: 600;">${meeting.topic || 'No topic'}</p>
              </div>
            </div>
            ${meeting.notes ? `
              <div style="margin-top: 1rem;">
                <p style="font-size: 0.875rem; color: var(--text-secondary);">Last note</p>
                <p style="font-size: 0.875rem; margin-top: 0.25rem;">${meeting.notes}</p>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    // Combine firstName and lastName for display (fallback to name for backwards compatibility)
    const displayName = contact.firstName && contact.lastName
      ? `${contact.firstName} ${contact.lastName}`.trim()
      : (contact.firstName || contact.name || '');

    const initials = this.getInitials(displayName);
    const photoHtml = contact.photo
      ? `<img src="${contact.photo}" alt="${displayName}" class="person-photo">`
      : `<div class="person-photo">${initials}</div>`;

    const quickFacts = contact.quickFacts || [];
    const recentNotes = contact.notes ? contact.notes.slice(-1) : [];

    return `
      <div class="person-card" data-contact-id="${contact.id}" data-meeting-id="${meeting.id}">
        <div class="person-header">
          ${photoHtml}
          <div class="person-info">
            <h3>${displayName}</h3>
            <p>${contact.title || 'No title'}${contact.company ? ` at ${contact.company}` : ''}</p>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
              Meeting at ${this.formatTime(meeting.date)}
            </p>
          </div>
          <div style="margin-left: auto;">
            ${contact.starred ? '<div style="color: #f39c12;">★</div>' : ''}
          </div>
        </div>

        ${contact.howWeMet ? `
          <div style="margin: 0.75rem 0; padding: 0.75rem; background: rgba(52, 152, 219, 0.1); border-radius: 8px;">
            <p style="font-size: 0.75rem; color: var(--text-secondary);">How you know them</p>
            <p style="font-size: 0.875rem; margin-top: 0.25rem;">${contact.howWeMet}</p>
          </div>
        ` : ''}

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

        ${meeting.topic ? `
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
            <p style="font-size: 0.75rem; color: var(--text-secondary);">Today's topic</p>
            <p style="font-size: 0.875rem; margin-top: 0.25rem;">${meeting.topic}</p>
          </div>
        ` : ''}

        ${recentNotes.length > 0 ? `
          <div style="margin-top: 0.75rem;">
            <p style="font-size: 0.75rem; color: var(--text-secondary);">Last interaction</p>
            <p style="font-size: 0.875rem; margin-top: 0.25rem; font-style: italic;">
              "${this.truncate(recentNotes[0], 100)}"
            </p>
          </div>
        ` : ''}

        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" style="flex: 1; padding: 0.5rem; font-size: 0.875rem;"
                  onclick="window.todayView.openMeetingNotes('${meeting.id}')">
            Add Note
          </button>
          <button class="btn btn-primary" style="flex: 1; padding: 0.5rem; font-size: 0.875rem;"
                  onclick="window.todayView.viewContact('${contact.id}')">
            View Profile
          </button>
        </div>
      </div>
    `;
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
   * Attach event listeners
   */
  attachEventListeners() {
    // Add any interactive event listeners here
    console.log('[TodayView] Event listeners attached');
  }

  /**
   * Open meeting notes modal
   * @param {string} meetingId
   */
  openMeetingNotes(meetingId) {
    console.log('[TodayView] Opening notes for meeting:', meetingId);
    // TO DO: Implement notes modal
    alert('Meeting notes feature coming soon!');
  }

  /**
   * View full contact profile
   * @param {string} contactId
   */
  viewContact(contactId) {
    console.log('[TodayView] Viewing contact:', contactId);
    // TO DO: Implement contact detail view
    alert('Contact profile feature coming soon!');
  }

  /**
   * Mark meeting as completed
   * @param {string} meetingId
   */
  async completeMeeting(meetingId) {
    try {
      const meeting = await window.storage.getMeeting(meetingId);
      if (meeting) {
        meeting.completed = true;
        meeting.completedAt = new Date().toISOString();
        await window.storage.saveMeeting(meeting);
        await this.loadTodaysData();
      }
    } catch (error) {
      console.error('[TodayView] Error completing meeting:', error);
    }
  }

  /**
   * Add quick note to meeting
   * @param {string} meetingId
   * @param {string} note
   */
  async addQuickNote(meetingId, note) {
    try {
      const meeting = await window.storage.getMeeting(meetingId);
      if (meeting) {
        if (!meeting.notes) meeting.notes = '';
        meeting.notes += `\n${new Date().toLocaleString()}: ${note}`;
        await window.storage.saveMeeting(meeting);
        await this.loadTodaysData();
      }
    } catch (error) {
      console.error('[TodayView] Error adding note:', error);
    }
  }

  /**
   * Mark meeting as completed
   * @param {string} meetingId
   */
  async markMeetingCompleted(meetingId) {
    try {
      const meeting = await window.storage.getMeeting(meetingId);
      if (meeting) {
        meeting.completed = true;
        meeting.completedAt = new Date().toISOString();
        await window.storage.saveMeeting(meeting);
        await this.loadTodaysData();
      }
    } catch (error) {
      console.error('[TodayView] Error completing meeting:', error);
    }
  }

  /**
   * Format time for display
   * @param {string} dateString
   * @returns {string}
   */
  formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
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
window.todayView = new TodayView();
