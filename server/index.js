// RememberMe Server - PostgreSQL Backend
// Handles API endpoints for sync, push notifications, and authentication

console.log('[Server] ====== RememberMe Server Starting ======');
console.log('[Server] Environment:', process.env.NODE_ENV || 'development');
console.log('[Server] Database URL configured:', !!process.env.DATABASE_URL);

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const database = require('./database');

// Initialize Express app
const app = express();

// Setup middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
const projectRoot = path.join(__dirname, '..');
app.use(express.static(projectRoot + '/public'));
app.use('/src', express.static(projectRoot + '/src'));

// Initialize database connection
database.init().then(() => {
  console.log('[Server] Database ready');
  startServer();
}).catch(err => {
  console.error('[Server] Database initialization failed:', err.message);
  console.log('[Server] Starting without database...');
  startServer();
});

function startServer() {
  // === HEALTH CHECK ===
  app.get('/api', (req, res) => {
    res.json({
      name: 'RememberMe API',
      version: '2.0.0',
      status: 'operational',
      database: 'PostgreSQL',
      features: {
        sync: true,
        sharing: true,
        auth: true,
        push: false // Can be added with web push service
      }
    });
  });

  // === AUTH ENDPOINTS ===

  // Register new user
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name required' });
      }

      // Use bcrypt for password hashing
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await database.createUser(email, hashedPassword, name);

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      const session = await database.createSession(user.id, token, expiresAt);

      res.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name },
        token: session.token
      });
    } catch (error) {
      console.error('[Server] Registration error:', error);
      res.status(error.message === 'User already exists' ? 409 : 500).json({
        error: error.message || 'Registration failed'
      });
    }
  });

  // Login user
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const user = await database.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate session token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const session = await database.createSession(user.id, token, expiresAt);

      res.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name },
        token: session.token
      });
    } catch (error) {
      console.error('[Server] Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Verify session
  app.post('/api/auth/verify', async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'Token required' });
      }

      const session = await database.getSession(token);

      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      // Get user info
      const user = await database.getUserById(session.user_id);

      res.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name }
      });
    } catch (error) {
      console.error('[Server] Verify error:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  // Logout
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const { token } = req.body;

      if (token) {
        await database.deleteSession(token);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[Server] Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  // === CONTACTS / SYNC ENDPOINTS ===

  // Get all contacts for user
  app.get('/api/contacts', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const session = await database.getSession(token);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const contacts = await database.getContacts(session.user_id);

      res.json({
        success: true,
        contacts: contacts.map(c => ({
          id: c.id,
          ...c.data,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        }))
      });
    } catch (error) {
      console.error('[Server] Get contacts error:', error);
      res.status(500).json({ error: 'Failed to get contacts' });
    }
  });

  // Sync contacts to server (client sends all contacts)
  app.post('/api/contacts/sync', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const { contacts } = req.body;

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!contacts || !Array.isArray(contacts)) {
        return res.status(400).json({ error: 'Contacts array required' });
      }

      const session = await database.getSession(token);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.user_id;
      let synced = 0;

      // For each contact from client, create or update
      for (const contact of contacts) {
        try {
          const existingContact = await database.getContact(contact.id, userId);

          if (existingContact) {
            // Update existing contact if it's newer
            if (new Date(contact.updatedAt) > new Date(existingContact.updated_at)) {
              await database.updateContact(contact.id, userId, contact);
            }
          } else {
            // Create new contact
            await database.createContact(userId, contact);
          }
          synced++;
        } catch (err) {
          console.warn('[Server] Failed to sync contact:', contact.id, err);
        }
      }

      const allContacts = await database.getContacts(userId);

      res.json({
        success: true,
        synced,
        contacts: allContacts.map(c => ({
          id: c.id,
          ...c.data,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        }))
      });
    } catch (error) {
      console.error('[Server] Sync contacts error:', error);
      res.status(500).json({ error: 'Sync failed' });
    }
  });

  // === MEETINGS ENDPOINTS ===

  // Create meeting
  app.post('/api/meetings', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const session = await database.getSession(token);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const meetingData = {
        ...req.body,
        userId: session.user_id
      };

      const meeting = await database.createMeeting(meetingData);

      res.json({
        success: true,
        meeting
      });
    } catch (error) {
      console.error('[Server] Create meeting error:', error);
      res.status(500).json({ error: 'Failed to create meeting' });
    }
  });

  // Get meetings for today
  app.get('/api/meetings/today', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const session = await database.getSession(token);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const meetings = await database.getTodaysMeetings(session.user_id);

      res.json({
        success: true,
        meetings
      });
    } catch (error) {
      console.error('[Server] Get today\'s meetings error:', error);
      res.status(500).json({ error: 'Failed to get meetings' });
    }
  });

  // === START SERVER ===

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log('[Server] ====== SERVER RUNNING ======');
    console.log(`[Server] Port: ${PORT}`);
    console.log('[Server] Database: PostgreSQL');
    console.log('[Server] Ready to serve requests');
  });
}
