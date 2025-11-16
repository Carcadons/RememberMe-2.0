// Debug script to test contact user scoping
// Run this in browser console after logging in

window.debugContacts = {
  async testContactScoping() {
    console.log('=== DEBUG: Contact User Scoping ===');

    // Check current user
    const user = window.authService.getCurrentUser();
    console.log('Current user:', user?.id, user?.email);

    if (!user) {
      console.error('No user logged in!');
      return;
    }

    // Check local contacts
    console.log('\n--- Local IndexedDB Contacts ---');
    const localContacts = await window.storage.getAllContacts();
    console.log(`Found ${localContacts.length} local contacts`);

    localContacts.forEach((contact, i) => {
      console.log(`Contact ${i + 1}:`, {
        id: contact.id,
        name: contact.name,
        userId: contact.userId,
        synced: contact.synced
      });
    });

    // Check server contacts
    console.log('\n--- Server PostgreSQL Contacts ---');
    try {
      const response = await fetch('/api/contacts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('rememberme_token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        console.log(`Found ${data.contacts.length} server contacts`);

        data.contacts.forEach((contact, i) => {
          console.log(`Server Contact ${i + 1}:`, {
            id: contact.id,
            name: contact.name,
            userId: contact.userId,
            createdAt: contact.createdAt
          });
        });
      } else {
        console.error('Failed to get server contacts:', data.error);
      }
    } catch (error) {
      console.error('Error fetching server contacts:', error);
    }

    // Test sync
    console.log('\n--- Testing Sync ---');
    const syncResult = await window.syncService.initialSync();
    console.log('Sync result:', syncResult);

    // Check contacts after sync
    const contactsAfterSync = await window.storage.getAllContacts();
    console.log(`\nContacts after sync: ${contactsAfterSync.length}`);

    console.log('=== DEBUG Complete ===');
  },

  async createTestContact() {
    console.log('Creating test contact...');

    const user = window.authService.getCurrentUser();
    if (!user) {
      console.error('Must be logged in to create test contact');
      return;
    }

    const testContact = {
      name: `TEST CONTACT - User: ${user.id}`,
      title: 'Test Position',
      company: 'Test Company',
      userId: user.id, // Explicitly set userId
      synced: false
    };

    console.log('Test contact data:', testContact);

    try {
      const contactId = await window.storage.saveContact(testContact);
      console.log('Test contact saved with ID:', contactId);

      // Sync to server
      const syncResult = await window.syncService.syncToServer();
      console.log('Sync result:', syncResult);

    } catch (error) {
      console.error('Error creating test contact:', error);
    }
  },

  async checkDatabaseSchema() {
    console.log('=== Checking PostgreSQL Schema ===');

    try {
      // This would require direct DB access, so we'll just check the server response format
      const response = await fetch('/api/contacts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('rememberme_token')}`
        }
      });

      const data = await response.json();

      if (data.success && data.contacts.length > 0) {
        const sampleContact = data.contacts[0];
        console.log('Sample contact structure:', Object.keys(sampleContact));
        console.log('Sample contact:', sampleContact);
      }

    } catch (error) {
      console.error('Error checking schema:', error);
    }
  }
};

console.log('Debug utilities loaded!');
console.log('Usage:');
console.log('- debugContacts.testContactScoping()');
console.log('- debugContacts.createTestContact()');
console.log('- debugContacts.checkDatabaseSchema()');
console.log('');
console.log('IMPORTANT: Run testContactScoping() before and after logout/login to see what changes!');
