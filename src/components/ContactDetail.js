// Contact Detail View Component
class ContactDetailModal {
  constructor() {
    this.modal = null;
    this.currentContact = null;
  }

  init() {
    this.createModalHTML();
  }

  createModalHTML() {
    const modalHTML = `
      <div class="modal" id="contactDetailModal" style="display: none;">
        <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
            <div>
              <h2 id="detailName" style="font-size: 1.5rem;"></h2>
              <p id="detailTitle" style="color: var(--text-secondary);"></p>
            </div>
            <button id="closeDetailModal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
          </div>

          <div id="contactDetailContent">
            <!-- Photo -->
            <div id="detailPhotoContainer" style="text-align: center; margin-bottom: 1.5rem;">
              <div id="detailPhoto" style="width: 120px; height: 120px; border-radius: 50%; background: var(--bg-secondary); margin: 0 auto 0.5rem; display: flex; align-items: center; justify-content: center; font-size: 2.5rem;">
                ?
              </div>
            </div>

            <!-- Quick Actions -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
              <button id="editContactBtn" class="btn btn-primary" style="flex: 1; padding: 0.75rem;">Edit</button>
              <button id="starContactBtn" class="btn btn-secondary" style="flex: 1; padding: 0.75rem;">Star</button>
            </div>

            <!-- Info Sections -->
            <div id="contactInfoSections"></div>

            <!-- Quick Facts -->
            <div id="detailQuickFacts" style="margin-bottom: 1.5rem;">
              <h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: var(--text-secondary);">Memory Triggers</h3>
              <div id="detailFactsList"></div>
            </div>

            <!-- Notes -->
            <div style="margin-bottom: 1.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <h3 style="font-size: 1rem; color: var(--text-secondary);">Interaction Notes</h3>
                <button id="addNoteBtn" class="btn btn-secondary" style="width: auto; padding: 0.5rem 1rem; font-size: 0.875rem;">+ Add Note</button>
              </div>
              <div id="detailNotesList"></div>
            </div>

            <!-- Delete -->
            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
              <button id="deleteContactBtn" class="btn btn-secondary" style="width: 100%; background: var(--danger-color); color: white;">Delete Contact</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('contactDetailModal');

    // Attach event listeners
    document.getElementById('closeDetailModal').onclick = () => this.hide();
    document.getElementById('editContactBtn').onclick = () => this.editContact();
    document.getElementById('starContactBtn').onclick = () => this.toggleStar();
    document.getElementById('addNoteBtn').onclick = () => this.addNote();
    document.getElementById('deleteContactBtn').onclick = () => this.deleteContact();

    this.modal.onclick = (e) => {
      if (e.target === this.modal) this.hide();
    };
  }

  /**
   * Show contact detail
   * @param {string} contactId
   */
  async show(contactId) {
    try {
      this.currentContact = await window.storage.getContact(contactId);
      if (!this.currentContact) {
        window.app.showError('Contact not found');
        return;
      }

      this.render();
      this.modal.style.display = 'flex';
    } catch (error) {
      console.error('[ContactDetail] Error loading contact:', error);
      window.app.showError('Failed to load contact');
    }
  }

  /**
   * Hide modal
   */
  hide() {
    this.modal.style.display = 'none';
    this.currentContact = null;
  }

  /**
   * Render contact details
   */
  render() {
    const contact = this.currentContact;

    // Header
    document.getElementById('detailName').textContent = contact.name;
    document.getElementById('detailTitle').textContent =
      `${contact.title || ''}${contact.title && contact.company ? ' at ' : ''}${contact.company || ''}`;

    // Photo
    const photoContainer = document.getElementById('detailPhoto');
    if (contact.photo) {
      photoContainer.innerHTML = `<img src="${contact.photo}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
      const initials = this.getInitials(contact.name);
      photoContainer.textContent = initials;
    }

    // Info sections
    const infoSections = [];

    if (contact.company) {
      infoSections.push(`
        <div style="margin-bottom: 1rem;">
          <p style="font-size: 0.75rem; color: var(--text-secondary);">Company</p>
          <p style="font-weight: 500; margin-top: 0.25rem;">${contact.company}</p>
        </div>
      `);
    }

    if (contact.howWeMet) {
      infoSections.push(`
        <div style="margin-bottom: 1rem;">
          <p style="font-size: 0.75rem; color: var(--text-secondary);">How you know them</p>
          <p style="margin-top: 0.25rem;">${contact.howWeMet}</p>
        </div>
      `);
    }

    if (contact.lastMet) {
      infoSections.push(`
        <div style="margin-bottom: 1rem;">
          <p style="font-size: 0.75rem; color: var(--text-secondary);">Last met</p>
          <p style="margin-top: 0.25rem;">${this.formatDate(contact.lastMet)}</p>
        </div>
      `);
    }

    if (contact.tags && contact.tags.length > 0) {
      infoSections.push(`
        <div style="margin-bottom: 1rem;">
          <p style="font-size: 0.75rem; color: var(--text-secondary);">Tags</p>
          <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.25rem;">
            ${contact.tags.map(tag => `
              <span style="padding: 0.25rem 0.5rem; background: var(--bg-secondary); border-radius: 12px; font-size: 0.75rem;">
                ${tag}
              </span>
            `).join('')}
          </div>
        </div>
      `);
    }

    document.getElementById('contactInfoSections').innerHTML = infoSections.join('');

    // Quick facts
    const factsContainer = document.getElementById('detailFactsList');
    if (contact.quickFacts && contact.quickFacts.length > 0) {
      factsContainer.innerHTML = contact.quickFacts.map(fact => `
        <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 0.5rem;">
          <p style="font-size: 0.875rem;">${fact}</p>
        </div>
      `).join('');
    } else {
      factsContainer.innerHTML = `<p style="color: var(--text-secondary); font-size: 0.875rem;">No quick facts added</p>`;
    }

    // Notes
    const notesContainer = document.getElementById('detailNotesList');
    if (contact.notes && contact.notes.length > 0) {
      notesContainer.innerHTML = contact.notes.map(noteStr => {
        const [timestamp, ...noteParts] = noteStr.split('|');
        const note = noteParts.join('|');
        const date = new Date(timestamp);

        return `
          <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 0.5rem;">
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
              ${this.formatDate(timestamp)} at ${this.formatTime(timestamp)}
            </p>
            <p style="font-size: 0.875rem; font-style: italic;">"${note}"</p>
          </div>
        `;
      }).join('');
    } else {
      notesContainer.innerHTML = `<p style="color: var(--text-secondary); font-size: 0.875rem;">No notes yet. Add your first interaction note!</p>`;
    }

    // Star button
    const starBtn = document.getElementById('starContactBtn');
    starBtn.textContent = contact.starred ? 'Unstar' : 'Star';
    starBtn.style.background = contact.starred ? 'var(--accent-color)' : 'var(--bg-secondary)';
    starBtn.style.color = contact.starred ? 'white' : 'var(--text-primary)';
  }

  /**
   * Edit contact
   */
  editContact() {
    this.hide();
    if (window.addContactModal) {
      window.addContactModal.edit(this.currentContact);
    }
  }

  /**
   * Toggle star
   */
  async toggleStar() {
    try {
      this.currentContact.starred = !this.currentContact.starred;
      await window.storage.saveContact(this.currentContact);

      // Update UI if needed
      if (typeof window.starredView !== 'undefined') {
        window.starredView.loadStarred();
      }

      this.render();
      window.app.showSuccess(this.currentContact.starred ? 'Contact starred!' : 'Contact unstarred');
    } catch (error) {
      console.error('[ContactDetail] Error toggling star:', error);
    }
  }

  /**
   * Add note
   */
  addNote() {
    const note = prompt('Add an interaction note:');
    if (note && note.trim()) {
      if (!this.currentContact.notes) this.currentContact.notes = [];
      this.currentContact.notes.push(`${new Date().toISOString()}|${note.trim()}`);

      window.storage.saveContact(this.currentContact).then(() => {
        this.render();
        window.app.showSuccess('Note added!');
      });
    }
  }

  /**
   * Delete contact
   */
  deleteContact() {
    if (confirm(`Are you sure you want to delete ${this.currentContact.name}? This cannot be undone.`)) {
      window.storage.deleteContact(this.currentContact.id).then(() => {
        this.hide();
        window.app.showSuccess('Contact deleted');

        // Refresh views
        if (typeof window.todayView !== 'undefined') window.todayView.loadTodaysData();
        if (typeof window.starredView !== 'undefined') window.starredView.loadStarred();
      }).catch(error => {
        console.error('[ContactDetail] Error deleting contact:', error);
        window.app.showError('Failed to delete contact');
      });
    }
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
   * Format date
   * @param {string} dateString
   * @returns {string}
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Format time
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
}

// Export singleton instance
window.contactDetailModal = new ContactDetailModal();
