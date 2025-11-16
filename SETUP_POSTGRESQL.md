# PostgreSQL Setup Guide for Replit

This guide explains how to set up PostgreSQL for the RememberMe app on Replit.

## Prerequisites

- Replit account
- RememberMe app deployed on Replit
- PostgreSQL tool available in Replit (comes with most Replit accounts)

## Setup Steps

### 1. Add PostgreSQL to Your Replit

1. Open your Replit project
2. Click on the **Tools** tab (left sidebar) or **"+"** button to add a tool
3. Search for **"PostgreSQL"** or **"Database"**
4. Click **"Add PostgreSQL"** or **"Add Database"**
5. Your PostgreSQL database will be automatically provisioned

### 2. Configure Environment Variable

Replit automatically creates a `DATABASE_URL` environment variable when you add PostgreSQL.

To verify:

1. Open the **Secrets** tab (padlock icon) in the left sidebar
2. Look for `DATABASE_URL` - it should be automatically set
3. The format will be: `postgresql://username:password@host:port/database_name`

### 3. Initialize the Database

The database is automatically initialized when you start the server. The `server/database.js` file will:

1. Connect to PostgreSQL using the `DATABASE_URL`
2. Create all necessary tables (users, contacts, meetings, sessions)
3. Create indexes for optimal performance

### 4. Verify Database Connection

Start your server and watch the logs for:

```
[Server] PostgreSQL connected successfully
[Server] Tables created/verified
```

If you see errors like "DATABASE_URL not found", it means:
- PostgreSQL hasn't been added to your Replit yet
- Or the database is still provisioning (wait a few minutes)

### 5. Test the App

1. **Register a new account** - This creates a user in the `users` table
2. **Add a contact** - This saves data to the `contacts` table
3. **Verify in Replit**:
   - Go to the PostgreSQL tool
   - Run: `SELECT * FROM users;` to see your user
   - Run: `SELECT * FROM contacts;` to see contacts

## Database Schema

The PostgreSQL database includes:

### Users Table
- `id` - UUID primary key
- `email` - Unique email address
- `password` - Hashed password
- `name` - User name

### Contacts Table
- `id` - UUID primary key
- `user_id` - References users.id (associates contact with user)
- `data` - JSONB column storing encrypted contact data
- `created_at`, `updated_at`, `synced_at` - Timestamps

### Meetings Table
- `id` - UUID primary key
- `user_id` - References users.id
- `contact_id` - References contacts.id
- `topic`, `date`, `notes` - Meeting details

### Sessions Table
- `id` - UUID primary key
- `user_id` - References users.id
- `token` - Session token
- `created_at`, `expires_at` - Session timestamps

## Troubleshooting

### Database URL Not Found

**Error**: `DATABASE_URL not found in environment`

**Solution**:
1. Add PostgreSQL tool to your Replit (see Step 1)
2. Wait 1-2 minutes for provisioning
3. Restart the server
4. Check Secrets tab to verify DATABASE_URL exists

### Connection Timeout

**Error**: `connection timeout`

**Solution**:
- Check if Replit has internet access
- Verify DATABASE_URL is correct in Secrets
- Try stopping and restarting the PostgreSQL tool

### SSL Errors

The database connection uses SSL in production mode. If you encounter SSL issues:

The code automatically handles this:
```javascript
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
```

## Migration from Replit Database

If you were previously using Replit Database:

1. **Export your data** before migrating (if needed)
2. Add PostgreSQL tool to your Replit
3. The app will automatically create new tables
4. Old contacts in IndexedDB will sync to PostgreSQL when user logs in

**Note**: Data from the old Replit Database is not automatically migrated. Users will need to re-login to sync their IndexedDB contacts to PostgreSQL.

## Local Development

For local development without PostgreSQL:

The server will still start without a database:
```
[Server] DATABASE_URL not found - running without database
[Server] Server running on http://localhost:3000
```

This allows you to test the frontend, but backend APIs requiring the database will fail.

To set up PostgreSQL locally:
1. Install PostgreSQL: `brew install postgresql` (macOS)
2. Start PostgreSQL: `brew services start postgresql`
3. Create database: `createdb rememberme`
4. Set DATABASE_URL: `export DATABASE_URL=postgresql://localhost/rememberme`
5. Run the app

## Security Notes

- **Passwords are hashed** using bcrypt before storage
- **Contact data is encrypted** on the client-side before sending to server
- **Tokens are used** for session management
- **UUIDs** are used for all IDs to prevent enumeration

## Backup

Replit automatically backs up your PostgreSQL database. You can also manually export:

1. Open PostgreSQL tool
2. Use `pg_dump` or the export feature
3. Store backups securely
