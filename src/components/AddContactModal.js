// Add/Edit Contact Modal Component
class AddContactModal {
  constructor() {
    this.modal = null;
    this.isEdit = false;
    this.editingContact = null;
  }

  /**
   * Initialize modal UI
   */
  init() {
    this.createModalHTML();
  }

  /**
   * Create modal HTML structure
   */
  createModalHTML() {
    const modalHTML = `
      <div class="modal" id="contactModal" style="display: none;">
        <div class="modal-content" style="max-width: 500px; max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2 id="contactModalTitle">Add New Person</h2>
            <button id="closeContactModal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
          </div>

          <form id="contactForm">
            <!-- Photo upload -->
            <div style="text-align: center; margin-bottom: 1.5rem;">
              <div id="photoPreview" style="width: 100px; height: 100px; border-radius: 50%; background: var(--bg-secondary); margin: 0 auto 0.5rem; display: flex; align-items: center; justify-content: center; font-size: 2rem; cursor: pointer; overflow: hidden;">
                📷
              </div>
              <input type="file" id="photoInput" accept="image/*" style="display: none;">
              <button type="button" id="photoButton" class="btn btn-secondary" style="width: auto; padding: 0.5rem 1rem; font-size: 0.875rem;">Add Photo</button>
            </div>

            <!-- Basic Info -->
            <div style="margin-bottom: 1.5rem;">
              <h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: var(--text-secondary);">Basic Information</h3>

              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500;">Full Name *</label>
              <input type="text" id="contactName" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 1rem; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);">

              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500;">Title</label>
              <input type="text" id="contactTitle" placeholder="e.g., CEO, Marketing Manager" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 1rem; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);">

              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500;">Company</label>
              <input type="text" id="contactCompany" placeholder="e.g., Acme Corp" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 1rem; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);">
            </div>

            <!-- How you know them -->
            <div style="margin-bottom: 1.5rem;">
              <h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: var(--text-secondary);">Context</h3>

              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500;">How I know them</label>
              <input type="text" id="contactHowWeMet" placeholder="e.g., Met at Web Summit 2024" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 1rem; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);">

              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500;">Last Met Date</label>
              <input type="date" id="contactLastMet" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 1rem; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);">
            </div>

            <!-- Quick Facts (Memory Triggers) -->
            <div style="margin-bottom: 1.5rem;">
              <h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: var(--text-secondary);">Quick Facts (Memory Triggers)</h3>
              <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 1rem;">Short facts to jog your memory (max 30 chars each)</p>

              <div id="quickFactsContainer">
                <input type="text" class="quick-fact-input" placeholder="e.g., Kids: Emma & Leo" maxlength="30" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.5rem; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);">
                <input type="text" class="quick-fact-input" placeholder="e.g., Loves espresso martinis" maxlength="30" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.5rem; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);">
                <input type="text" class="quick-fact-input" placeholder="e.g., Working on Series A" maxlength="30" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.5rem; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);">
              </div>

              <button type="button" id="addQuickFact" class="btn btn-secondary" style="width: auto; padding: 0.5rem 1rem; font-size: 0.875rem; margin-top: 0.5rem;">+ Add Another Fact</button>
            </div>

            <!-- Tags -->
            <div style="margin-bottom: 1.5rem;">
              <h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: var(--text-secondary);">Tags</h3>

              <div id="tagsContainer" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
                <span class="tag-option" data-tag="investor" style="padding: 0.25rem 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; font-size: 0.875rem; cursor: pointer;">Investor</span>
                <span class="tag-option" data-tag="client" style="padding: 0.25rem 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; font-size: 0.875rem; cursor: pointer;">Client</span>
                <span class="tag-option" data-tag="partner" style="padding: 0.25rem 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; font-size: 0.875rem; cursor: pointer;">Partner</span>
                <span class="tag-option" data-tag="colleague" style="padding: 0.25rem 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; font-size: 0.875rem; cursor: pointer;">Colleague</span>
                <span class="tag-option" data-tag="friend" style="padding: 0.25rem 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; font-size: 0.875rem; cursor: pointer;">Friend</span>
              </div>

              <input type="text" id="contactTags" placeholder="Custom tags (comma separated)" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);">
            </div>

            <!-- Starred -->
            <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
              <input type="checkbox" id="contactStarred">
              <label for="contactStarred" style="font-size: 0.875rem;">Star this contact for quick access</label>
            </div>

            <!-- Submit buttons -->
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
              <button type="button" id="cancelContact" class="btn btn-secondary" style="flex: 1;">Cancel</button>
              <button type="submit" id="saveContact" class="btn btn-primary" style="flex: 1;">Save Contact</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('contactModal');
    this.attachEventListeners();
  }

  /**
   * Attach event listeners to modal
   */
  attachEventListeners() {
    // Close modal
    document.getElementById('closeContactModal').onclick = () => this.hide();
    document.getElementById('cancelContact').onclick = () => this.hide();

    // Photo upload
    document.getElementById('photoButton').onclick = () => {
      document.getElementById('photoInput').click();
    };

    document.getElementById('photoInput').onchange = (e) => this.handlePhotoUpload(e);

    // Add quick fact
    document.getElementById('addQuickFact').onclick = () => this.addQuickFactInput();

    // Tag selection
    document.querySelectorAll('.tag-option').forEach(tag => {
      tag.onclick = () => this.toggleTag(tag);
    });

    // Form submission
    document.getElementById('contactForm').onsubmit = (e) => {
      e.preventDefault();
      this.saveContact();
    };

    // Close on background click
    this.modal.onclick = (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    };
  }

  /**
   * Show modal
   */
  show() {
    this.modal.style.display = 'flex';
    document.getElementById('contactName').focus();
  }

  /**
   * Hide modal
   */
  hide() {
    this.modal.style.display = 'none';
    this.resetForm();
    this.isEdit = false;
    this.editingContact = null;
  }

  /**
   * Edit existing contact
   * @param {Object} contact
   */
  edit(contact) {
    this.isEdit = true;
    this.editingContact = contact;

    document.getElementById('contactModalTitle').textContent = 'Edit Contact';
    document.getElementById('saveContact').textContent = 'Update Contact';

    // Fill form with contact data
    // Combine firstName and lastName for the name field
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    document.getElementById('contactName').value = fullName;
    document.getElementById('contactTitle').value = contact.title || '';
    document.getElementById('contactCompany').value = contact.company || '';
    document.getElementById('contactHowWeMet').value = contact.howWeMet || '';
    document.getElementById('contactLastMet').value = contact.lastMet || '';
    document.getElementById('contactStarred').checked = contact.starred || false;

    // Set photo if exists
    if (contact.photo) {
      const preview = document.getElementById('photoPreview');
      preview.innerHTML = `<img src="${contact.photo}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    }

    // Set quick facts
    const facts = contact.quickFacts || [];
    const factInputs = document.querySelectorAll('.quick-fact-input');
    facts.forEach((fact, index) => {
      if (factInputs[index]) {
        factInputs[index].value = fact;
      }
    });

    // Set tags
    if (contact.tags) {
      document.getElementById('contactTags').value = contact.tags.filter(tag => {
        const hasPredefined = !!document.querySelector(`[data-tag="${tag}"]`);
        return !hasPredefined;
      }).join(', ');

      // Check predefined tags
      contact.tags.forEach(tag => {
        const tagEl = document.querySelector(`[data-tag="${tag}"]`);
        if (tagEl) {
          tagEl.classList.add('selected');
          tagEl.style.background = 'var(--accent-color)';
          tagEl.style.color = 'white';
        }
      });
    }

    this.show();
  }

  /**
   * Handle photo upload
   * @param {Event} e
   */
  async handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    console.log('[AddContactModal] Photo selected:', file.name);

    try {
      // Use the photo cropper to crop around face
      const croppedImageDataUrl = await window.photoCropper.showManualCropper(file);

      // Update the preview with the cropped image
      const preview = document.getElementById('photoPreview');
      preview.innerHTML = `<img src="${croppedImageDataUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;

      // Store the cropped image data for form submission
      this.croppedPhotoDataUrl = croppedImageDataUrl;

      console.log('[AddContactModal] Photo cropped and preview updated');

    } catch (error) {
      console.error('[AddContactModal] Error cropping photo:', error);

      // Fallback to original image
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = document.getElementById('photoPreview');
        preview.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        this.croppedPhotoDataUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Add another quick fact input
   */
  addQuickFactInput() {
    const container = document.getElementById('quickFactsContainer');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'quick-fact-input';
    input.placeholder = 'Another quick fact';
    input.maxLength = 30;
    input.style.cssText = 'width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.5rem; font-size: 1rem; background: var(--bg-color); color: var(--text-primary);';
    container.appendChild(input);
  }

  /**
   * Toggle tag selection
   * @param {HTMLElement} tagEl
   */
  toggleTag(tagEl) {
    const isSelected = tagEl.classList.contains('selected');

    if (isSelected) {
      tagEl.classList.remove('selected');
      tagEl.style.background = 'var(--bg-secondary)';
      tagEl.style.color = 'var(--text-primary)';
    } else {
      tagEl.classList.add('selected');
      tagEl.style.background = 'var(--accent-color)';
      tagEl.style.color = 'white';
    }
  }

  /**
   * Save contact
   */
  async saveContact() {
    console.log('[AddContactModal] Starting saveContact...');
    console.log('[AddContactModal] isEdit:', this.isEdit);
    console.log('[AddContactModal] editingContact:', this.editingContact);

    const name = document.getElementById('contactName').value.trim();
    console.log('[AddContactModal] Name:', name);

    if (!name) {
      alert('Name is required');
      return;
    }

    // Split name into firstName and lastName
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Validate edit mode state
    if (this.isEdit && !this.editingContact) {
      console.error('[AddContactModal] Error: isEdit is true but editingContact is null');
      alert('Error: Cannot edit contact - no contact loaded');
      return;
    }

    try {
      // Check if encryption is available
      console.log('[AddContactModal] Checking encryption...');
      if (!window.encryption) {
        throw new Error('Encryption module not loaded');
      }

      // Build contact data
      const contact = {
        id: this.isEdit ? this.editingContact.id : window.encryption.generateId(),
        firstName: firstName,
        lastName: lastName,
        title: document.getElementById('contactTitle').value.trim(),
        company: document.getElementById('contactCompany').value.trim(),
        howWeMet: document.getElementById('contactHowWeMet').value.trim(),
        lastMet: document.getElementById('contactLastMet').value,
        starred: document.getElementById('contactStarred').checked,
        createdAt: this.isEdit ? this.editingContact.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        quickFacts: [],
        tags: [],
        notes: []
      };

      console.log('[AddContactModal] Basic contact data:', { id: contact.id, firstName: contact.firstName, lastName: contact.lastName });

      // Get photo
      const photoPreview = document.getElementById('photoPreview');
      const img = photoPreview.querySelector('img');
      if (img) {
        contact.photo = img.src;
        console.log('[AddContactModal] Photo added');
      }

      // Get quick facts
      document.querySelectorAll('.quick-fact-input').forEach(input => {
        if (input.value.trim()) {
          contact.quickFacts.push(input.value.trim());
        }
      });
      console.log('[AddContactModal] Quick facts:', contact.quickFacts);

      // Get selected predefined tags
      document.querySelectorAll('.tag-option.selected').forEach(tag => {
        contact.tags.push(tag.dataset.tag);
      });

      // Get custom tags
      const customTags = document.getElementById('contactTags').value.trim();
      if (customTags) {
        const customTagArray = customTags.split(',').map(t => t.trim()).filter(t => t);
        contact.tags.push(...customTagArray);
      }
      console.log('[AddContactModal] Tags:', contact.tags);

      // Check storage availability
      console.log('[AddContactModal] Checking storage...');
      if (!window.storage) {
        throw new Error('Storage module not loaded');
      }

      // Try to save to storage
      console.log('[AddContactModal] Calling window.storage.saveContact...', contact);
      const result = await window.storage.saveContact(contact);
      console.log('[AddContactModal] saveContact returned:', result);

      // Update UI
      console.log('[AddContactModal] Updating UI...');
      if (typeof window.todayView !== 'undefined') {
        await window.todayView.loadTodaysData();
        console.log('[AddContactModal] Today view reloaded');
      }

      if (typeof window.starredView !== 'undefined') {
        await window.starredView.loadStarred();
        console.log('[AddContactModal] Starred view reloaded');
      }

      if (typeof window.searchView !== 'undefined') {
        console.log('[AddContactModal] Search view reloaded (cleared cache)');
      }

      // Show success
      console.log('[AddContactModal] Showing success message');
      window.app.showSuccess(this.isEdit ? 'Contact updated!' : 'Contact saved!');

      console.log('[AddContactModal] Hiding modal');
      this.hide();

    } catch (error) {
      console.error('[AddContactModal] FULL ERROR:', error);
      console.error('Stack trace:', error.stack);
      alert(`Failed to save contact: ${error.message}`);
    }
    console.log('[AddContactModal] saveContact finished');
  }

  /**
   * Reset form
   */
  resetForm() {
    document.getElementById('contactForm').reset();
    document.getElementById('photoPreview').innerHTML = '📷';

    // Remove extra quick fact inputs
    const factInputs = document.querySelectorAll('.quick-fact-input');
    for (let i = 3; i < factInputs.length; i++) {
      factInputs[i].remove();
    }

    // Reset tags
    document.querySelectorAll('.tag-option').forEach(tag => {
      tag.classList.remove('selected');
      tag.style.background = 'var(--bg-secondary)';
      tag.style.color = 'var(--text-primary)';
    });

    // Reset modal title
    document.getElementById('contactModalTitle').textContent = 'Add New Person';
    document.getElementById('saveContact').textContent = 'Save Contact';
  }
}

// Export singleton instance
window.addContactModal = new AddContactModal();
