// RememberMe Database - PostgreSQL
const { Pool } = require('pg');

class Database {
  constructor() {
    this.pool = null;
    this.initialized = false;
  }

  /**
   * Initialize database connection and create tables
   */
  async init() {
    try {
      // Use DATABASE_URL from environment (Replit auto-populates this)
      const connectionString = process.env.DATABASE_URL;

      if (!connectionString) {
        throw new Error('DATABASE_URL not found in environment. Make sure you have added PostgreSQL to your Replit');
      }

      // Create connection pool
      this.pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Test connection
      await this.pool.query('SELECT NOW()');
      console.log('[Database] PostgreSQL connected successfully');

      // Create tables if they don't exist
      await this.createTables();
      console.log('[Database] Tables created/verified');

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('[Database] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  async createTables() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      `);

      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Contacts table - stores encrypted data as JSONB
      await client.query(`
        CREATE TABLE IF NOT EXISTS contacts (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          data JSONB NOT NULL, -- Encrypted contact data stored as JSON
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          synced_at TIMESTAMP WITH TIME ZONE
        );
      `);

      // Meetings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS meetings (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          topic VARCHAR(500),
          date TIMESTAMP WITH TIME ZONE NOT NULL,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Sessions table for authentication
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        );
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_user_created ON contacts(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
        CREATE INDEX IF NOT EXISTS idx_meetings_contact_id ON meetings(contact_id);
        CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      `);

      console.log('[Database] All tables and indexes created');
    } catch (error) {
      console.error('[Database] Error creating tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new user
   */
  async createUser(email, password, name = null) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
        [email, password, name]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('User already exists');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT id, email, password, name, created_at FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT id, email, name, created_at FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Create a contact
   */
  async createContact(userId, contactData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO contacts (user_id, data, synced_at) VALUES ($1, $2, NOW()) RETURNING id, data, created_at, updated_at',
        [userId, JSON.stringify(contactData)]
      );
      return {
        ...result.rows[0],
        data: JSON.parse(result.rows[0].data)
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get all contacts for a user
   */
  async getContacts(userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT id, data, created_at, updated_at FROM contacts WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return result.rows.map(row => ({
        ...row,
        data: JSON.parse(row.data)
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Get a single contact
   */
  async getContact(id, userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT id, data, created_at, updated_at FROM contacts WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      if (result.rows.length === 0) return null;
      return {
        ...result.rows[0],
        data: JSON.parse(result.rows[0].data)
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update a contact
   */
  async updateContact(id, userId, contactData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'UPDATE contacts SET data = $1, updated_at = NOW(), synced_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING id, data, created_at, updated_at',
        [JSON.stringify(contactData), id, userId]
      );
      if (result.rows.length === 0) return null;
      return {
        ...result.rows[0],
        data: JSON.parse(result.rows[0].data)
      };
    } finally {
      client.release();
    }
  }

  /**
   * Delete a contact
   */
  async deleteContact(id, userId) {
    const client = await this.pool.connect();
    try {
      await client.query(
        'DELETE FROM contacts WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      return true;
    } finally {
      client.release();
    }
  }

  /**
   * Create a session
   */
  async createSession(userId, token, expiresAt) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING id, token, created_at, expires_at',
        [userId, token, expiresAt]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Get session by token
   */
  async getSession(token) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT id, user_id, token, created_at, expires_at FROM sessions WHERE token = $1 AND expires_at > NOW()',
        [token]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Delete session
   */
  async deleteSession(token) {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM sessions WHERE token = $1', [token]);
      return true;
    } finally {
      client.release();
    }
  }

  /**
   * Create a meeting
   */
  async createMeeting(meetingData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO meetings (user_id, contact_id, topic, date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [meetingData.userId, meetingData.contactId, meetingData.topic, meetingData.date, meetingData.notes]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Get today's meetings for a user
   */
  async getTodaysMeetings(userId) {
    const client = await this.pool.connect();
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = await client.query(
        `SELECT m.*, c.data as contact_data FROM meetings m
         JOIN contacts c ON m.contact_id = c.id
         WHERE m.user_id = $1 AND m.date >= $2 AND m.date < $3
         ORDER BY m.date ASC`,
        [userId, today, tomorrow]
      );

      return result.rows.map(row => ({
        ...row,
        contact_data: JSON.parse(row.contact_data)
      }));
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
module.exports = new Database();
