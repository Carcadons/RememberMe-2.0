# PostgreSQL Setup for RememberMe on Replit

## Overview

RememberMe has been migrated from Replit Database (key-value store) to PostgreSQL (SQL database). This provides better data structure, relationships, and query capabilities.

## Prerequisites

- A Replit account
- Node.js app running on Replit

## Setup Steps

### 1. Add PostgreSQL to your Replit

1. Open your Replit project
2. In the left sidebar, click **Tools**
3. Scroll down and click **Database**
4. Click **Create database**
5. Select **PostgreSQL**
6. Click **Create**

This will automatically:
- Provision a PostgreSQL instance
- Set the `DATABASE_URL` environment variable
- Make the database ready to use

### 2. Install Dependencies

The following packages are already added to `package.json`:

```bash
npm install
```

Required packages:
- `pg` - PostgreSQL client for Node.js
- `bcryptjs` - Password hashing
- `express` - Web framework
- `cors` - CORS middleware
- `body-parser` - Request parsing

### 3. Database Schema

The server automatically creates all tables on first startup. No manual migration needed!

**Tables created:**

#### users
```sql
id UUID PRIMARY KEY
email VARCHAR(255) UNIQUE
password VARCHAR(255)
name VARCHAR(255)
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### contacts
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
data JSONB (stores encrypted contact data)
created_at TIMESTAMP
updated_at TIMESTAMP
synced_at TIMESTAMP
```

#### meetings
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
contact_id UUID REFERENCES contacts(id)
topic VARCHAR(500)
date TIMESTAMP
notes TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### sessions
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
token VARCHAR(255) UNIQUE
created_at TIMESTAMP
expires_at TIMESTAMP
```

### 4. Run the Server

```bash
npm run dev
```

The server will:
1. Connect to PostgreSQL using DATABASE_URL
2. Create all tables if they don't exist
3. Start the Express server
4. Log "[Server] Ready to serve requests"

## API Endpoints

### Authentication

**Register User**
```
POST /api/auth/register
Body: { email, password, name }
```

**Login**
```
POST /api/auth/login
Body: { email, password }
```

**Verify Session**
```
POST /api/auth/verify
Body: { token }
```

**Logout**
```
POST /api/auth/logout
Body: { token }
```

### Contacts

**Get All Contacts**
```
GET /api/contacts
Headers: Authorization: Bearer <token>
```

**Sync Contacts**
```
POST /api/contacts/sync
Headers: Authorization: Bearer <token>
Body: { contacts: [...] }
```

### Meetings

**Create Meeting**
```
POST /api/meetings
Headers: Authorization: Bearer <token>
Body: { contactId, topic, date, notes }
```

**Get Today's Meetings**
```
GET /api/meetings/today
Headers: Authorization: Bearer <token>
```

## Database Management

### Viewing Data

In your Replit:
1. Click **Tools** > **Database**
2. Click the PostgreSQL instance
3. Use the built-in SQL console to query data:

```sql
-- View all users
SELECT * FROM users;

-- View all contacts for a user
SELECT * FROM contacts WHERE user_id = 'user-uuid';

-- Count contacts
SELECT user_id, COUNT(*) FROM contacts GROUP BY user_id;

-- View today's meetings
SELECT * FROM meetings WHERE date >= CURRENT_DATE;
```

### Backup Strategy

Replit automatically backs up your PostgreSQL database. For manual backups:

```bash
# Export database (run in Replit shell)
pg_dump $DATABASE_URL > backup.sql

# Import database
psql $DATABASE_URL < backup.sql
```

## Migration from Replit Database

If you have existing data in Replit Database:

1. Export your old data using the old server endpoints
2. Register/login with the new PostgreSQL server
3. The sync will automatically migrate your contacts
4. Old Replit Database keys can be deleted after migration

## Security Features

- Passwords are hashed with bcrypt
- Sessions use cryptographically random tokens
- All requests require authentication
- Contacts are still encrypted client-side before storing in PostgreSQL
- Database credentials are stored in environment variables

## Troubleshooting

### "DATABASE_URL not found"
- Make sure you added PostgreSQL to your Replit
- Look in **Tools** > **Database** to verify it's created

### "Unable to connect"
- Ensure your Replit has internet access
- Check if PostgreSQL is running in the database tool

### Tables not created
- Check server logs for errors
- Server automatically creates tables on startup
- Manually create using SQL commands if needed

### Sync not working
- Check browser console for errors
- Verify token is being sent in Authorization header
- Check server logs for detailed error messages

## Benefits of PostgreSQL

✅ **Structured Data** - Better data organization
✅ **Relationships** - Foreign keys link users, contacts, meetings
✅ **Query Power** - Complex queries with JOINs
✅ **Performance** - Indexes for fast lookups
✅ **Scalability** - Handles more data efficiently
✅ **ACID** - Transaction safety
✅ **Type Safety** - Data validation at database level

## Technical Details

### Data Flow

```
Client (Browser)
  ↓ encrypted contact data
Frontend JS
  ↓ API call with auth token
Express Server
  ↓ SQL queries
PostgreSQL Database
```

### Encryption

- Contacts are encrypted **client-side** before sending to server
- PostgreSQL stores encrypted JSON blobs
- Server never sees unencrypted contact data
- Zero-knowledge architecture maintained

## Support

For issues:
1. Check server logs: `npm run dev`
2. Check browser console
3. Verify DATABASE_URL is set: `echo $DATABASE_URL`
4. Test database connection: Use Replit Database tool

## Advanced Usage

### Adding New Tables

Edit `server/database.js` and add to `createTables()`:

```javascript
await client.query(`
  CREATE TABLE IF NOT EXISTS new_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )
`);
```

### Adding API Endpoints

Add to `server/index.js`:

```javascript
app.get('/api/custom', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = await database.getSession(token);
  // Your logic here
});
```

## Performance Tips

- Indexes are automatically created for common queries
- Use `CREATE INDEX` for custom queries
- Monitor query performance with `EXPLAIN ANALYZE`
- Batch operations when possible

---

**RememberMe with PostgreSQL** provides enterprise-grade data storage while maintaining privacy and zero-knowledge principles.
