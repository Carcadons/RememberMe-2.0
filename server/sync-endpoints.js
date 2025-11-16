// Sync Endpoints v2 - Batch Sync API
// Handles sync queue operations with conflict resolution and batch processing

const express = require('express');
const router = express.Router();
const db = require('./database');
const crypto = require('crypto');

// ===== MIDDLEWARE =====

/**
 * Authentication middleware
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const session = await db.getSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.userId = session.user_id;
    req.sessionId = session.id;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Generate deterministic UUID from local ID
 * Ensures same contact gets same server ID across syncs
 */
function generateServerId(localId, userId) {
  const hash = crypto.createHash('sha256');
  hash.update(`${userId}:${localId}`);
  return hash.digest('hex').substring(0, 32);
}

/**
 * Transform client contact format to server format
 */
function transformContactToServerFormat(contact, userId) {
  return {
    firstName: contact.firstName || contact.first_name,
    lastName: contact.lastName || contact.last_name,
    company: contact.company || '',
    jobTitle: contact.jobTitle || contact.title || '',
    email: contact.email || '',
    phone: contact.phone || '',
    notes: contact.notes || '',
    lastMetDate: contact.lastMetDate || contact.last_met_date || null,
    howWeMet: contact.howWeMet || contact.how_we_met || '',
    location: contact.location || '',
    tags: contact.tags || [],
    quickFacts: contact.quickFacts || contact.quick_facts || []
  };
}

/**
 * Transform server contact format to client format
 */
function transformContactToClientFormat(contact) {
  return {
    id: contact.id,
    serverId: contact.id,
    userId: contact.user_id,
    firstName: contact.first_name,
    lastName: contact.last_name,
    company: contact.company,
    jobTitle: contact.job_title,
    email: contact.email,
    phone: contact.phone,
    notes: contact.notes,
    lastMetDate: contact.last_met_date,
    howWeMet: contact.how_we_met,
    location: contact.location,
    tags: contact.tags || [],
    quickFacts: contact.quick_facts || [],
    createdAt: contact.created_at,
    updatedAt: contact.updated_at,
    deletedAt: contact.deleted_at,
    createdBy: contact.created_by,
    updatedBy: contact.updated_by,
    version: contact.version
  };
}

/**
 * Check for conflicts between client and server versions
 */
function detectConflict(clientData, serverData) {
  if (!serverData) return null;

  const conflict = {
    hasConflict: false,
    fields: {}
  };

  // Check if versions differ and timestamps differ
  const clientVersion = clientData.version || 0;
  const serverVersion = serverData.version || 0;

  if (clientVersion !== serverVersion) {
    // Check key fields for differences
    const fieldsToCheck = ['first_name', 'last_name', 'company', 'job_title', 'email', 'phone', 'notes'];

    fieldsToCheck.forEach(field => {
      const clientValue = clientData[field] || '';
      const serverValue = serverData[field] || '';

      if (clientValue !== serverValue) {
        conflict.hasConflict = true;
        conflict.fields[field] = {
          client: clientValue,
          server: serverValue
        };
      }
    });
  }

  return conflict.hasConflict ? conflict : null;
}

/**
 * Resolve conflict (server wins for now - can implement user choice later)
 */
function resolveConflict(clientData, serverData) {
  // Server wins strategy
  return {
    resolved: { ...serverData },
    strategy: 'server_wins'
  };
}

// ===== SYNC ENDPOINTS =====

/**
 * GET /api/v2/contacts
 * Get all contacts for authenticated user
 */
router.get('/contacts', authenticateToken, async (req, res) => {
  try {
    const contacts = await db.getContacts(req.userId);

    // Transform to client format
    const clientContacts = contacts.map(transformContactToClientFormat);

    res.json({
      success: true,
      contacts: clientContacts,
      syncVersion: Date.now()
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

/**
 * POST /api/v2/sync/batch
 * Process batch sync operations from client
 * Body: { operations: [{entityType, action, entityId, entityData}] }
 */
router.post('/sync/batch', authenticateToken, async (req, res) => {
  const { operations } = req.body;

  if (!operations || !Array.isArray(operations)) {
    return res.status(400).json({ error: 'Invalid request format' });
  }

  console.log(`[SyncBatch] Processing ${operations.length} operations for user ${req.userId}`);

  const results = {
    success: true,
    processed: 0,
    conflicts: [],
    errors: [],
    syncedIds: {}
  };

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    for (const op of operations) {
      try {
        let result;

        switch (op.entityType) {
          case 'contact':
            result = await processContactOperation(op, req.userId, client);
            break;

          default:
            throw new Error(`Unsupported entity type: ${op.entityType}`);
        }

        if (result) {
          results.processed++;

          if (result.conflict) {
            results.conflicts.push({
              operation: op,
              conflict: result.conflict
            });
          }

          if (result.serverId) {
            results.syncedIds[op.entityId] = result.serverId;
          }
        }

      } catch (error) {
        console.error(`[SyncBatch] Error processing operation:`, op, error);
        results.errors.push({
          operation: op,
          error: error.message
        });
      }
    }

    // Update sync state
    await db.updateSyncState(req.userId, {
      lastSyncTimestamp: new Date().toISOString(),
      syncVersion: Date.now(),
      deviceIds: [] // TO DO: Track device IDs
    });

    await client.query('COMMIT');

    console.log(`[SyncBatch] Completed: ${results.processed} processed, ${results.conflicts.length} conflicts, ${results.errors.length} errors`);

    res.json(results);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Sync batch error:', error);
    res.status(500).json({ error: 'Sync failed', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * Process individual contact operation
 */
async function processContactOperation(operation, userId, client) {
  const { action, entityId, entityData } = operation;

  switch (action) {
    case 'CREATE':
      return await createContact(entityData, userId, client);

    case 'UPDATE':
      return await updateContact(entityId, entityData, userId, client);

    case 'DELETE':
      return await deleteContact(entityId, entityId, userId, client);

    case 'RESTORE':
      return await restoreContact(entityId, entityData, userId, client);

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Create contact (with potential conflict detection if already exists)
 */
async function createContact(entityData, userId, client) {
  // Check if contact already exists (possible duplicate sync)
  const existingContact = await db.getContact(entityData.serverId || generateServerId(entityData.id, userId), userId);

  if (existingContact) {
    console.log('[Sync] Contact already exists, treating as update:', entityData.id);
    return await updateContact(entityData.id, entityData, userId, client);
  }

  const contactData = transformContactToServerFormat(entityData, userId);

  // Create tags and quick facts
  const contact = await db.createContact(userId, {
    ...contactData,
    tags: entityData.tags || [],
    quickFacts: entityData.quickFacts || []
  });

  console.log('[Sync] Created contact:', contact.id);

  return {
    serverId: contact.id,
    conflict: null
  };
}

/**
 * Update contact with conflict detection
 */
async function updateContact(localId, entityData, userId, client) {
  // Try to find by server ID first, then local ID
  let contactId = entityData.serverId;

  if (!contactId) {
    // Generate deterministic server ID from local ID
    contactId = generateServerId(localId, userId);
  }

  const existingContact = await db.getContact(contactId, userId);

  if (!existingContact) {
    // Contact doesn't exist, treat as create
    console.log('[Sync] Contact not found, creating instead:', localId);
    return await createContact(entityData, userId, client);
  }

  // Check for conflicts
  const conflict = detectConflict(entityData, existingContact);

  let resolvedData = entityData;

  if (conflict) {
    console.log('[Sync] Conflict detected for contact:', contactId);
    const resolution = resolveConflict(entityData, existingContact);
    resolvedData = resolution.resolved;
  }

  // Perform update
  await db.updateContact(contactId, userId, {
    ...transformContactToServerFormat(entityData, userId),
    tags: entityData.tags || [],
    quickFacts: entityData.quickFacts || []
  });

  console.log('[Sync] Updated contact:', contactId);

  return {
    serverId: contactId,
    conflict: conflict
  };
}

/**
 * Soft delete contact
 */
async function deleteContact(localId, entityData, userId, client) {
  const contactId = entityData.serverId || generateServerId(localId, userId);

  const success = await db.deleteContact(contactId, userId);

  if (success) {
    console.log('[Sync] Deleted contact:', contactId);
    return { serverId: contactId };
  }

  throw new Error('Contact not found or already deleted');
}

/**
 * Restore soft-deleted contact
 */
async function restoreContact(localId, entityData, userId, client) {
  // TO DO: Implement restore logic
  throw new Error('Restore not implemented');
}

/**
 * GET /api/v2/sync/state
 * Get current sync state
 */
router.get('/sync/state', authenticateToken, async (req, res) => {
  try {
    const syncState = await db.getSyncState(req.userId);

    res.json({
      success: true,
      syncState: syncState || {
        lastSyncTimestamp: null,
        syncVersion: 0,
        deviceIds: []
      }
    });
  } catch (error) {
    console.error('Error fetching sync state:', error);
    res.status(500).json({ error: 'Failed to fetch sync state' });
  }
});

module.exports = router;
