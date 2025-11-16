// RememberMe Server v2 - PostgreSQL Backend with Relational Schema
// Complete rewrite with proper user isolation and sync

console.log('[ServerV2] ====== RememberMe Server v2 Starting ======');
console.log('[ServerV2] Environment:', process.env.NODE_ENV || 'development');
console.log('[ServerV2] Database URL configured:', !!process.env.DATABASE_URL);

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const syncRoutes = require('./sync-endpoints');

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
db.init().then(() => {
  console.log('[ServerV2] Database v2 initialized successfully');
  startServer();
}).catch(err => {
  console.error('[ServerV2] Database initialization failed:', err.message);
  console.error('[ServerV2] Server cannot start without database');
  process.exit(1);
});

function startServer() {

  // === HEALTH CHECK ===
  app.get('/api/v2', (req, res) => {
    res.json({
      name: 'RememberMe API v2',
      version: '2.0.0',
      status: 'operational',
      database: 'PostgreSQL v2 (Relational)',
      features: {
        sync: 'batch sync with queue',
        sharing: true,
        auth: 'session-based',
        push: false,
        audit: true,
        userIsolation: true
      }
    });
  });

  // === MOUNT SYNC ROUTES ===
  // All sync endpoints under /api/v2
  app.use('/api/v2', syncRoutes);

  // === AUTH ENDPOINTS (v2) ===

  // Health check for auth
  app.get('/api/v2/auth', (req, res) => {
    res.json({ status: 'auth endpoints ready', version: 'v2' });
  });

  // Register new user
  app.post('/api/v2/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;

      // Validation
      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          error: 'Email, password, and name required'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await db.createUser(email, hashedPassword, name);

      // Create session
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const session = await db.createSession(user.id, token, expiresAt, {
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      console.log(`[ServerV2] User registered: ${user.email}`);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at
        },
        token: session.token,
        syncState: null // New user, no sync state yet
      });

    } catch (error) {
      console.error('[ServerV2] Registration error:', error);

      if (error.message === 'User already exists') {
        return res.status(409).json({
          success: false,
          error: 'Email already registered'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }
  });

  // Login user
  app.post('/api/v2/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password required'
        });
      }

      // Get user
      const user = await db.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Create session
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const session = await db.createSession(user.id, token, expiresAt, {
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Get sync state
      const syncState = await db.getSyncState(user.id);

      console.log(`[ServerV2] User logged in: ${user.email}`);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at
        },
        token: session.token,
        syncState: syncState
      });

    } catch (error) {
      console.error('[ServerV2] Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  });

  // Verify session
  app.post('/api/v2/auth/verify', async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token required'
        });
      }

      const session = await db.getSession(token);
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired session'
        });
      }

      // Get user
      const user = await db.getUserById(session.user_id);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      // Get sync state
      const syncState = await db.getSyncState(user.id);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        syncState: syncState
      });

    } catch (error) {
      console.error('[ServerV2] Verify error:', error);
      res.status(500).json({
        success: false,
        error: 'Verification failed'
      });
    }
  });

  // Logout
  app.post('/api/v2/auth/logout', async (req, res) => {
    try {
      const { token } = req.body;

      if (token) {
        const deleted = await db.deleteSession(token);
        if (deleted) {
          console.log('[ServerV2] Session deleted');
        }
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('[ServerV2] Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  });

  // === MIGRATION ENDPOINTS (temporary for migration) ===

  /**
   * POST /api/v2/migrate/user
   * For migrating existing users from old system
   */
  app.post('/api/v2/migrate/user', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      // Hash password (use same algorithm as old system)
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user (will fail if already exists, which is fine)
      try {
        await db.createUser(email, hashedPassword, email.split('@')[0]);
      } catch (err) {
        // User might already exist, continue
      }

      res.json({ success: true });

    } catch (error) {
      console.error('[ServerV2] User migration error:', error);
      res.status(500).json({ error: 'Migration failed' });
    }
  });

  // === START SERVER ===

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log('[ServerV2] ====== SERVER RUNNING ======');
    console.log(`[ServerV2] Port: ${PORT}`);
    console.log(`[ServerV2] Database: PostgreSQL v2 (Relational)`);
    console.log(`[ServerV2] API Version: v2`);
    console.log('[ServerV2] Features:');
    console.log('  - User isolation: ✓');
    console.log('  - Relational schema: ✓');
    console.log('  - Batch sync: ✓');
    console.log('  - Conflict resolution: ✓');
    console.log('  - Audit logging: ✓');
    console.log('[ServerV2] Ready to serve requests');
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[ServerV2] SIGTERM received, shutting down gracefully');
  if (db.pool) {
    db.pool.end();
  }
  process.exit(0);
});
