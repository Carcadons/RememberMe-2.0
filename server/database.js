// Database Layer v2 - Proper Relational Schema
// Complete redesign with proper tables, user isolation, and audit logging

const { Pool } = require('pg');

class DatabaseV2 {
  constructor() {
    this.pool = null;
    this.initialized = false;
  }

  /**
   * Initialize database connection and create all tables
   */
  async init() {
    try {
      const connectionString = process.env.DATABASE_URL;

      if (!connectionString) {
        throw new Error('DATABASE_URL not found in environment');
      }

      this.pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      await this.pool.query('SELECT NOW()');
      console.log('[DatabaseV2] PostgreSQL connected successfully');

      await this.createTables();
      console.log('[DatabaseV2] All tables created/verified');

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('[DatabaseV2] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Create all tables with proper relational structure
   */
  async createTables() {
    const client = await this.pool.connect();
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

      console.log('[DatabaseV2] Creating tables...');

      // Users table - proper password_hash column name
      await client.query(`
        CREATE TABLE IF NOT EXISTS users_v2 (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login_at TIMESTAMP WITH TIME ZONE,
          deleted_at TIMESTAMP WITH TIME ZONE
        )
      `);

      // Contacts table - properly normalized
      await client.query(`
        CREATE TABLE IF NOT EXISTS contacts_v2 (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users_v2(id) ON DELETE CASCADE,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          company VARCHAR(255),
          job_title VARCHAR(255),
          email VARCHAR(255),
          phone VARCHAR(50),
          notes TEXT,
          last_met_date DATE,
          how_we_met VARCHAR(500),
          location VARCHAR(255),
          synced_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by UUID NOT NULL REFERENCES users_v2(id),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_by UUID NOT NULL REFERENCES users_v2(id),
          version INTEGER DEFAULT 1,
          deleted_at TIMESTAMP WITH TIME ZONE
        )
      `);

      // Contact tags - many-to-many
      await client.query(`
        CREATE TABLE IF NOT EXISTS contact_tags_v2 (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          contact_id UUID NOT NULL REFERENCES contacts_v2(id) ON DELETE CASCADE,
          tag VARCHAR(100) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(contact_id, tag)
        )
      `);

      // Quick facts - structured
      await client.query(`
        CREATE TABLE IF NOT EXISTS contact_quick_facts_v2 (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          contact_id UUID NOT NULL REFERENCES contacts_v2(id) ON DELETE CASCADE,
          fact_type VARCHAR(50) NOT NULL,
          fact_content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Sessions table - proper authentication
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions_v2 (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users_v2(id) ON DELETE CASCADE,
          token VARCHAR(255) UNIQUE NOT NULL,
          device_info VARCHAR(500),
          ip_address INET,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Sync state tracking
      await client.query(`
        CREATE TABLE IF NOT EXISTS sync_state_v2 (
          user_id UUID PRIMARY KEY REFERENCES users_v2(id) ON DELETE CASCADE,
          last_sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          sync_version INTEGER DEFAULT 0,
          device_ids TEXT[] DEFAULT '{}'
        )
      `);

      // Audit log
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_log_v2 (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users_v2(id),
          action VARCHAR(50) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id UUID NOT NULL,
          entity_version INTEGER,
          old_values JSONB,
          new_values JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      await this.createIndexes(client);
      await this.createAuditTriggers(client);

      console.log('[DatabaseV2] All tables created successfully');
    } catch (error) {
      console.error('[DatabaseV2] Error creating tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create performance indexes
   */
  async createIndexes(client) {
    console.log('[DatabaseV2] Creating indexes...');

    const indexes = [
      // Contacts indexes
      `CREATE INDEX IF NOT EXISTS idx_contacts_v2_user_deleted ON contacts_v2(user_id, deleted_at) WHERE deleted_at IS NULL`,
      `CREATE INDEX IF NOT EXISTS idx_contacts_v2_name ON contacts_v2(user_id, last_name, first_name) WHERE deleted_at IS NULL`,
      `CREATE INDEX IF NOT EXISTS idx_contacts_v2_company ON contacts_v2(user_id, company) WHERE deleted_at IS NULL AND company IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_contacts_v2_email ON contacts_v2(user_id, email) WHERE deleted_at IS NULL`,

      // Tags indexes
      `CREATE INDEX IF NOT EXISTS idx_contact_tags_v2_contact ON contact_tags_v2(contact_id)`,
      `CREATE INDEX IF NOT EXISTS idx_contact_tags_v2_tag ON contact_tags_v2(tag)`,
      `CREATE INDEX IF NOT EXISTS idx_contact_tags_v2_user ON contact_tags_v2(contact_id, tag)`,

      // Quick facts indexes
      `CREATE INDEX IF NOT EXISTS idx_quick_facts_v2_contact ON contact_quick_facts_v2(contact_id)`,
      `CREATE INDEX IF NOT EXISTS idx_quick_facts_v2_type ON contact_quick_facts_v2(fact_type)`,

      // Sessions indexes
      `CREATE INDEX IF NOT EXISTS idx_sessions_v2_token ON sessions_v2(token)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_v2_user_expires ON sessions_v2(user_id, expires_at)`,

      // Audit log indexes
      `CREATE INDEX IF NOT EXISTS idx_audit_log_v2_user_date ON audit_log_v2(user_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_log_v2_entity ON audit_log_v2(entity_type, entity_id)`
    ];

    for (const index of indexes) {
      await client.query(index);
    }

    console.log('[DatabaseV2] All indexes created');
  }

  /**
   * Create audit triggers for automatic change tracking
   */
  async createAuditTriggers(client) {
    console.log('[DatabaseV2] Creating audit triggers...');

    const triggerFunction = `
      CREATE OR REPLACE FUNCTION audit_trigger_function_v2()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (TG_OP = 'DELETE') THEN
          INSERT INTO audit_log_v2 (user_id, action, entity_type, entity_id, entity_version, old_values, created_at)
          VALUES (OLD.updated_by, 'DELETE', TG_TABLE_NAME, OLD.id, OLD.version, to_jsonb(OLD), NOW());
          RETURN OLD;
        ELSIF (TG_OP = 'UPDATE') THEN
          INSERT INTO audit_log_v2 (user_id, action, entity_type, entity_id, entity_version, old_values, new_values, created_at)
          VALUES (NEW.updated_by, 'UPDATE', TG_TABLE_NAME, NEW.id, NEW.version, to_jsonb(OLD), to_jsonb(NEW), NOW());
          RETURN NEW;
        ELSIF (TG_OP = 'INSERT') THEN
          INSERT INTO audit_log_v2 (user_id, action, entity_type, entity_id, entity_version, new_values, created_at)
          VALUES (NEW.created_by, 'CREATE', TG_TABLE_NAME, NEW.id, NEW.version, to_jsonb(NEW), NOW());
          RETURN NEW;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `;

    await client.query(triggerFunction);

    // Apply triggers to tables
    const tables = ['contacts_v2'];
    for (const table of tables) {
      // Drop existing trigger if it exists
      await client.query(`
        DROP TRIGGER IF EXISTS ${table}_audit_trigger ON ${table}
      `);

      // Create new trigger
      await client.query(`
        CREATE TRIGGER ${table}_audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function_v2()
      `);
    }

    console.log('[DatabaseV2] Audit triggers created');
  }

  // ===== USER OPERATIONS =====

  /**
   * Create new user with proper password hashing
   * @param {string} email
   * @param {string} passwordHash - Already hashed password
   * @param {string} name
   * @returns {Promise<Object>}
   */
  async createUser(email, passwordHash, name = null) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO users_v2 (email, password_hash, name)
        VALUES ($1, $2, $3)
        RETURNING id, email, name, created_at
      `, [email, passwordHash, name]);

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('User already exists');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user by email
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async getUserByEmail(email) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT id, email, password_hash, name, created_at
        FROM users_v2
        WHERE email = $1
      `, [email]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Get user by ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getUserById(id) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT id, email, name, created_at
        FROM users_v2
        WHERE id = $1
      `, [id]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  // ===== CONTACT OPERATIONS =====

  /**
   * Create contact with proper user scoping
   * @param {string} userId
   * @param {Object} contactData
   * @returns {Promise<Object>}
   */
  async createContact(userId, contactData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO contacts_v2 (
          user_id, first_name, last_name, company, job_title, email, phone,
          notes, last_met_date, how_we_met, location, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, first_name, last_name, company, job_title, email, phone,
                  notes, last_met_date, how_we_met, location, created_at, updated_at
      `, [
        userId, contactData.firstName, contactData.lastName,
        contactData.company, contactData.jobTitle, contactData.email,
        contactData.phone, contactData.notes, contactData.lastMetDate,
        contactData.howWeMet, contactData.location, userId, userId
      ]);

      const contact = result.rows[0];

      // Save tags if present
      if (contactData.tags && contactData.tags.length > 0) {
        await this.saveContactTags(contact.id, contactData.tags, client);
      }

      // Save quick facts if present
      if (contactData.quickFacts && contactData.quickFacts.length > 0) {
        await this.saveQuickFacts(contact.id, contactData.quickFacts, client);
      }

      return contact;
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all contacts for a specific user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getContacts(userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT id, first_name, last_name, company, job_title, email, phone,
               notes, last_met_date, how_we_met, location, created_at, updated_at
        FROM contacts_v2
        WHERE user_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
      `, [userId]);

      const contacts = [];

      for (const contact of result.rows) {
        const enrichedContact = {
          ...contact,
          tags: await this.getContactTags(contact.id, client),
          quickFacts: await this.getQuickFacts(contact.id, client)
        };
        contacts.push(enrichedContact);
      }

      return contacts;
    } finally {
      client.release();
    }
  }

  /**
   * Get single contact by ID
   * @param {string} contactId
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getContact(contactId, userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT id, first_name, last_name, company, job_title, email, phone,
               notes, last_met_date, how_we_met, location, created_at, updated_at
        FROM contacts_v2
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      `, [contactId, userId]);

      if (result.rows.length === 0) return null;

      const contact = result.rows[0];
      contact.tags = await this.getContactTags(contact.id, client);
      contact.quickFacts = await this.getQuickFacts(contact.id, client);

      return contact;
    } finally {
      client.release();
    }
  }

  /**
   * Update contact with versioning
   * @param {string} contactId
   * @param {string} userId
   * @param {Object} updateData
   * @returns {Promise<Object|null>}
   */
  async updateContact(contactId, userId, updateData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        UPDATE contacts_v2
        SET first_name = $1, last_name = $2, company = $3, job_title = $4,
            email = $5, phone = $6, notes = $7, last_met_date = $8,
            how_we_met = $9, location = $10, updated_by = $11,
            version = version + 1, updated_at = NOW()
        WHERE id = $12 AND user_id = $13 AND deleted_at IS NULL
        RETURNING id, first_name, last_name, company, job_title, email, phone,
                  notes, last_met_date, how_we_met, location, created_at, updated_at, version
      `, [
        updateData.firstName, updateData.lastName, updateData.company,
        updateData.jobTitle, updateData.email, updateData.phone,
        updateData.notes, updateData.lastMetDate, updateData.howWeMet,
        updateData.location, userId, contactId, userId
      ]);

      if (result.rows.length === 0) return null;

      const contact = result.rows[0];

      // Update tags if provided
      if (updateData.tags) {
        await client.query('DELETE FROM contact_tags_v2 WHERE contact_id = $1', [contactId]);
        await this.saveContactTags(contactId, updateData.tags, client);
      }

      // Update quick facts if provided
      if (updateData.quickFacts) {
        await client.query('DELETE FROM contact_quick_facts_v2 WHERE contact_id = $1', [contactId]);
        await this.saveQuickFacts(contactId, updateData.quickFacts, client);
      }

      contact.tags = await this.getContactTags(contactId, client);
      contact.quickFacts = await this.getQuickFacts(contactId, client);

      return contact;
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Soft delete contact
   * @param {string} contactId
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async deleteContact(contactId, userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        UPDATE contacts_v2
        SET deleted_at = NOW(), updated_by = $1, version = version + 1
        WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
        RETURNING id
      `, [userId, contactId, userId]);

      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  // ===== RELATION OPERATIONS =====

  /**
   * Save tags for a contact
   * @private
   */
  async saveContactTags(contactId, tags, client) {
    for (const tag of tags) {
      await client.query(`
        INSERT INTO contact_tags_v2 (contact_id, tag)
        VALUES ($1, $2)
        ON CONFLICT (contact_id, tag) DO NOTHING
      `, [contactId, tag]);
    }
  }

  /**
   * Get tags for a contact
   * @private
   */
  async getContactTags(contactId, client) {
    const result = await client.query(`
      SELECT tag FROM contact_tags_v2
      WHERE contact_id = $1
      ORDER BY created_at
    `, [contactId]);

    return result.rows.map(row => row.tag);
  }

  /**
   * Save quick facts for a contact
   * @private
   */
  async saveQuickFacts(contactId, quickFacts, client) {
    for (const fact of quickFacts) {
      await client.query(`
        INSERT INTO contact_quick_facts_v2 (contact_id, fact_type, fact_content)
        VALUES ($1, $2, $3)
      `, [contactId, fact.type || 'general', fact.content]);
    }
  }

  /**
   * Get quick facts for a contact
   * @private
   */
  async getQuickFacts(contactId, client) {
    const result = await client.query(`
      SELECT fact_type as type, fact_content as content
      FROM contact_quick_facts_v2
      WHERE contact_id = $1
      ORDER BY created_at
    `, [contactId]);

    return result.rows;
  }

  // ===== SESSION OPERATIONS =====

  /**
   * Create session
   * @param {string} userId
   * @param {string} token
   * @param {Date} expiresAt
   * @param {Object} deviceInfo
   * @returns {Promise<Object>}
   */
  async createSession(userId, token, expiresAt, deviceInfo = null) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO sessions_v2 (user_id, token, expires_at, device_info)
        VALUES ($1, $2, $3, $4)
        RETURNING id, token, created_at, expires_at
      `, [userId, token, expiresAt, deviceInfo]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Get session by token (only if not expired)
   * @param {string} token
   * @returns {Promise<Object|null>}
   */
  async getSession(token) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT id, user_id, token, created_at, expires_at
        FROM sessions_v2
        WHERE token = $1 AND expires_at > NOW()
      `, [token]);

      if (result.rows.length > 0) {
        // Update last active
        await client.query(`
          UPDATE sessions_v2
          SET last_active_at = NOW()
          WHERE token = $1
        `, [token]);
      }

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Delete session (logout)
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async deleteSession(token) {
    const client = await this.pool.connect();
    try {
      const result = await client.query('DELETE FROM sessions_v2 WHERE token = $1', [token]);
      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Get sync state for user
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getSyncState(userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT last_sync_timestamp, sync_version, device_ids
        FROM sync_state_v2
        WHERE user_id = $1
      `, [userId]);

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Update sync state
   * @param {string} userId
   * @param {Object} syncData
   * @returns {Promise<Object>}
   */
  async updateSyncState(userId, syncData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO sync_state_v2 (user_id, last_sync_timestamp, sync_version, device_ids)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
          last_sync_timestamp = $2,
          sync_version = $3,
          device_ids = $4
        RETURNING *
      `, [userId, syncData.lastSyncTimestamp, syncData.syncVersion, syncData.deviceIds]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }
}

module.exports = new DatabaseV2();
