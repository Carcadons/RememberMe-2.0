// RememberMe Server - Replit Backend
// Handles API endpoints for sync, push notifications, and shared cards

console.log('[Server] ====== RememberMe Server Starting ======');
console.log('[Server] Environment:', process.env.NODE_ENV || 'development');
const express = require('express');
const Database = require('@replit/database');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cors = require('cors');

// Initialize Express app
console.log('[Server] Creating Express app...');
const app = express();
const db = new Database();
console.log('[Server] App and Database initialized');

// Setup middleware
console.log('[Server] Configuring middleware...');
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
console.log('[Server] Middleware configured');

// Serve static files from the project root
const path = require('path');
const projectRoot = path.join(__dirname, '..');

console.log('[Server] Project root:', projectRoot);
console.log('[Server] Public directory:', projectRoot + '/public');

// Log directory contents
const fs = require('fs');
console.log('[Server] Checking public directory...');
try {
  const publicFiles = fs.existsSync(projectRoot + '/public')
    ? fs.readdirSync(projectRoot + '/public')
    : [];
  console.log('[Server] Public directory files:', publicFiles);
} catch (e) {
  console.error('[Server] Error reading public dir:', e);
}

console.log('[Server] Setting up static file serving...');
app.use(express.static(projectRoot + '/public'));
console.log('[Server] Static files will be served from /public');

app.use('/src', express.static(projectRoot + '/src'));
console.log('[Server] Source files will be served from /src');

// Log route setup
console.log('[Server] Setting up routes...');
console.log('[Server] Static file routes:');
console.log('[Server]  - /* -> /public/');
console.log('[Server]  - /src/* -> /src/');

// === CORE API ENDPOINTS ===

// Health check for API
app.get('/api', (req, res) => {
  res.json({
    name: 'RememberMe API',
    version: '1.0.0',
    status: 'operational',
    features: {
      sync: true,
      sharing: true,
      push: true
    }
  });
});

// Serve PWA at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// === SYNC ENDPOINTS ===

// Sync contacts
app.post('/api/sync/contacts', async (req, res) => {
  try {
    const { contacts, userId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: 'Invalid contacts data' });
    }

    // Store encrypted contacts in Replit DB
    const key = `user:${userId}:contacts`;
    const existingData = await db.get(key).catch(() => ({}));

    const updatedContacts = { ...existingData };
    contacts.forEach(contact => {
      updatedContacts[contact.id] = {
        ...contact,
        syncedAt: new Date().toISOString(),
        lastModified: contact.lastModified || new Date().toISOString()
      };
    });

    await db.set(key, updatedContacts);

    res.json({
      success: true,
      synced: contacts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sync contacts error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Get synced contacts
app.get('/api/sync/contacts', async (req, res) => {
  try {
    const { userId, since } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const key = `user:${userId}:contacts`;
    const contacts = await db.get(key).catch(() => ({}));

    // Filter by timestamp if provided
    let filteredContacts = contacts;
    if (since) {
      filteredContacts = Object.values(contacts).filter(
        contact => new Date(contact.lastModified) > new Date(since)
      );
    } else {
      filteredContacts = Object.values(contacts);
    }

    res.json({
      success: true,
      contacts: filteredContacts,
      count: filteredContacts.length
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Sync meetings
app.post('/api/sync/meetings', async (req, res) => {
  try {
    const { meetings, userId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!meetings || !Array.isArray(meetings)) {
      return res.status(400).json({ error: 'Invalid meetings data' });
    }

    const key = `user:${userId}:meetings`;
    const existingData = await db.get(key).catch(() => ({}));

    const updatedMeetings = { ...existingData };
    meetings.forEach(meeting => {
      updatedMeetings[meeting.id] = {
        ...meeting,
        syncedAt: new Date().toISOString(),
        lastModified: meeting.lastModified || new Date().toISOString()
      };
    });

    await db.set(key, updatedMeetings);

    res.json({
      success: true,
      synced: meetings.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sync meetings error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Get synced meetings
app.get('/api/sync/meetings', async (req, res) => {
  try {
    const { userId, since } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const key = `user:${userId}:meetings`;
    const meetings = await db.get(key).catch(() => ({}));

    let filteredMeetings = meetings;
    if (since) {
      filteredMeetings = Object.values(meetings).filter(
        meeting => new Date(meeting.lastModified) > new Date(since)
      );
    } else {
      filteredMeetings = Object.values(meetings);
    }

    res.json({
      success: true,
      meetings: filteredMeetings,
      count: filteredMeetings.length
    });

  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// === SHARING ENDPOINTS ===

// Generate shareable link
app.post('/api/share/generate', async (req, res) => {
  try {
    const { contactId, userId, expiresIn = 86400 } = req.body; // Default 24 hours

    if (!userId || !contactId) {
      return res.status(400).json({ error: 'User ID and Contact ID required' });
    }

    // Generate share token
    const shareId = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + (expiresIn * 1000);

    const shareData = {
      shareId,
      contactId,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      viewCount: 0,
      accessLog: []
    };

    // Store in DB
    await db.set(`share:${shareId}`, shareData);

    // Generate share URL
    const shareUrl = `${req.protocol}://${req.get('host')}/share/${shareId}`;

    res.json({
      success: true,
      shareId,
      url: shareUrl,
      expiresAt: shareData.expiresAt
    });

  } catch (error) {
    console.error('Generate share error:', error);
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

// Get shared contact
app.get('/api/share/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    const { password } = req.query;

    // Get share data
    const shareData = await db.get(`share:${shareId}`);

    if (!shareData) {
      return res.status(404).json({ error: 'Link not found or expired' });
    }

    // Check if expired
    if (Date.now() > new Date(shareData.expiresAt).getTime()) {
      await db.delete(`share:${shareId}`);
      return res.status(410).json({ error: 'Link has expired' });
    }

    // Get user contact data
    const userKey = `user:${shareData.userId}:contacts`;
    const contacts = await db.get(userKey).catch(() => ({}));
    const contact = contacts[shareData.contactId];

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Update access log
    shareData.viewCount += 1;
    shareData.accessLog.push({
      accessedAt: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    await db.set(`share:${shareId}`, shareData);

    res.json({
      success: true,
      contact,
      shareInfo: {
        viewCount: shareData.viewCount,
        expiresAt: shareData.expiresAt
      }
    });

  } catch (error) {
    console.error('Get share error:', error);
    res.status(500).json({ error: 'Failed to fetch shared contact' });
  }
});

// === PUSH NOTIFICATION ENDPOINTS ===

// Subscribe to push notifications
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { subscription, userId } = req.body;

    if (!userId || !subscription) {
      return res.status(400).json({ error: 'User ID and subscription required' });
    }

    // Store push subscription
    const key = `user:${userId}:push-subscription`;
    await db.set(key, {
      subscription,
      createdAt: new Date().toISOString(),
      enabled: true
    });

    res.json({ success: true, message: 'Subscribed to push notifications' });

  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Unsubscribe from push notifications
app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const key = `user:${userId}:push-subscription`;
    await db.delete(key);

    res.json({ success: true, message: 'Unsubscribed from push notifications' });

  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// Send push notification (for testing or server-initiated)
app.post('/api/push/send', async (req, res) => {
  try {
    const { userId, title, body, data = {} } = req.body;

    if (!userId || !title) {
      return res.status(400).json({ error: 'User ID and title required' });
    }

    // Get push subscription
    const key = `user:${userId}:push-subscription`;
    const subscriptionData = await db.get(key);

    if (!subscriptionData || !subscriptionData.enabled) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Send push notification (requires web-push library in production)
    // For now, return success
    res.json({
      success: true,
      message: 'Push notification queued',
      subscription: subscriptionData.subscription
    });

  } catch (error) {
    console.error('Send push error:', error);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

// === UTILITY ENDPOINTS ===

// Get user stats
app.get('/api/stats', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const contactsKey = `user:${userId}:contacts`;
    const meetingsKey = `user:${userId}:meetings`;

    const contacts = await db.get(contactsKey).catch(() => ({}));
    const meetings = await db.get(meetingsKey).catch(() => ({}));

    res.json({
      success: true,
      stats: {
        contacts: Object.keys(contacts).length,
        meetings: Object.keys(meetings).length,
        lastSync: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Cleanup expired shares
app.post('/api/cleanup', async (req, res) => {
  try {
    // Get all share keys
    const keys = await db.list();
    const shareKeys = keys.filter(key => key.startsWith('share:'));

    let cleaned = 0;

    for (const key of shareKeys) {
      try {
        const shareData = await db.get(key);

        if (Date.now() > new Date(shareData.expiresAt).getTime()) {
          await db.delete(key);
          cleaned++;
        }
      } catch (error) {
        console.error(`Failed to cleanup ${key}:`, error);
      }
    }

    res.json({
      success: true,
      cleaned,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// === ERROR HANDLING ===

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`RememberMe API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
