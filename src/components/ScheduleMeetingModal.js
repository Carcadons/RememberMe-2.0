// Schedule Meeting Modal Component
// Quickly schedule a meeting with an existing contact
class ScheduleMeetingModal {
  constructor() {
    this.modal = null;
    this.contacts = [];
  }

  init() {
    this.createModalHTML();
    this.loadContacts();
  }

  createModalHTML() {
    const modalHTML = `
      <div class="modal" id="scheduleMeetingModal" style="display: none;">
        <div class="modal-content" style="max-width: 500px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2 id="scheduleModalTitle">Schedule Meeting</h2>
            <button id="closeScheduleModal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
          </div>

          <form id="scheduleMeetingForm">
            <!-- Contact Selection -->
            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500;">Select Contact *</label>
              <select id="contactSelect" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);">
                <option value="">Choose a contact...</option>
              </select>
              <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;">Or <a href="#" id="createNewContactLink" style="color: var(--accent-color);">create a new contact</a></p>
            </div>

            <!-- Meeting Date -->
            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500;">Meeting Date *</label>
              <input type="date" id="meetingDate" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.5rem; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);">
              <p style="font-size: 0.75rem; color: var(--text-secondary);">When you're meeting (in the future)</p>
            </div>

            <!-- Meeting Topic -->
            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500;">Meeting Topic</label>
              <input type="text" id="meetingTopic" placeholder="e.g., Product demo, Coffee catch-up" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.5rem; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);">
              <p style="font-size: 0.75rem; color: var(--text-secondary);">Optional: What you'll discuss</p>
            </div>

            <!-- Meeting Notes -->
            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500;">Notes</label>
              <textarea id="meetingNotes" placeholder="Any preparation notes, agenda items, etc." rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.5rem; font-size: 1rem; background: var(--bg-color); color: var(--text-primary); font-family: inherit; resize: vertical;"></textarea>
              <p style="font-size: 0.75rem; color: var(--text-secondary);">Optional: Private notes for yourself</p>
            </div>

            <!-- Submit buttons -->
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
              <button type="button" id="cancelSchedule" class="btn btn-secondary" style="flex: 1;">Cancel</button>
              <button type="submit" id="saveSchedule" class="btn btn-primary" style="flex: 1;">Schedule Meeting</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('scheduleMeetingModal');
    this.attachEventListeners();
  }

  attachEventListeners() {
    // Close modal
    document.getElementById('closeScheduleModal').onclick = () => this.hide();
    document.getElementById('cancelSchedule').onclick = () => this.hide();

    // Create new contact link
    document.getElementById('createNewContactLink').onclick = (e) => {
      e.preventDefault();
      this.hide();
      if (window.addContactModal) {
        window.addContactModal.show();
      }
    };

    // Form submission
    document.getElementById('scheduleMeetingForm').onsubmit = (e) => {
      e.preventDefault();
      this.scheduleMeeting();
    };

    // Close on background click
    this.modal.onclick = (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    };
  }

  async loadContacts() {
    try {
      this.contacts = await window.storage.getAllContacts();
      this.populateContactSelect();
    } catch (error) {
      console.error('[ScheduleMeetingModal] Error loading contacts:', error);
    }
  }

  populateContactSelect() {
    const select = document.getElementById('contactSelect');
    const currentValue = select.value;

    // Clear existing options except the first
    select.innerHTML = '<option value="">Choose a contact...</option>';

    // Sort contacts alphabetically
    const sortedContacts = [...this.contacts].sort((a, b) => {
      const nameA = this.getDisplayName(a).toLowerCase();
      const nameB = this.getDisplayName(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Add contacts to select
    sortedContacts.forEach(contact => {
      const option = document.createElement('option');
      option.value = contact.id;
      option.textContent = this.getDisplayName(contact);
      select.appendChild(option);
    });

    // Restore selection if still valid
    if (currentValue && this.contacts.find(c => c.id === currentValue)) {
      select.value = currentValue;
    }
  }

  getDisplayName(contact) {
    return contact.firstName
      ? (contact.lastName ? `${contact.firstName} ${contact.lastName}` : contact.firstName)
      : (contact.name || 'Unknown');
  }

  show() {
    // Load contacts fresh each time
    this.loadContacts();

    // Set today's date as default
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    document.getElementById('meetingDate').value = todayStr;

    // Clear form
    document.getElementById('contactSelect').value = '';
    document.getElementById('meetingTopic').value = '';
    document.getElementById('meetingNotes').value = '';

    // Show modal
    this.modal.style.display = 'flex';
    document.getElementById('contactSelect').focus();
  }

  hide() {
    this.modal.style.display = 'none';
  }

  async scheduleMeeting() {
    const contactId = document.getElementById('contactSelect').value;
    const meetingDate = document.getElementById('meetingDate').value;
    const meetingTopic = document.getElementById('meetingTopic').value;
    const meetingNotes = document.getElementById('meetingNotes').value;

    if (!contactId || !meetingDate) {
      alert('Please select a contact and meeting date');
      return;
    }

    try {
      // Load the contact
      const contact = await window.storage.getContact(contactId);
      if (!contact) {
        alert('Contact not found');
        return;
      }

      // Update contact with next meeting date
      contact.nextMeetingDate = meetingDate;
      contact.updatedAt = new Date().toISOString();

      await window.storage.saveContact(contact);

      // Show success
      window.app.showSuccess('Meeting scheduled!');

      // Refresh views
      if (window.todayView) {
        await window.todayView.loadTodaysData();
      }

      this.hide();

    } catch (error) {
      console.error('[ScheduleMeetingModal] Error scheduling meeting:', error);
      alert('Failed to schedule meeting');
    }
  }
}

// Export singleton instance
window.scheduleMeetingModal = new ScheduleMeetingModal();
