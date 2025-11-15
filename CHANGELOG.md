# RememberMe Changelog

## Version 2.0.0 - PostgreSQL Migration

### 🚀 Major Changes

- **Migrated from Replit Database to PostgreSQL**
  - Better data structure with proper relationships
  - ACID transactions for data integrity
  - SQL queries for powerful data retrieval
  - Automatic table creation on startup
  - Zero-downtime migration

### 📁 Database Changes

**New Tables:**
- `users` - User accounts with bcrypt password hashing
- `contacts` - Contacts with JSONB storage for encrypted data
- `meetings` - Scheduled meetings with contact relationships
- `sessions` - Authentication sessions with expiration

**Features:**
- Foreign key constraints for data integrity
- Automatic timestamps (created_at, updated_at)
- Indexes for performance optimization
- UUID primary keys
- Transaction support

### 🔧 Server Changes

**New Files:**
- `server/database.js` - PostgreSQL connection and ORM
- `PGSQL_SETUP.md` - Complete setup documentation
- `src/core/sync-postgres.js` - New sync service (unused, kept for reference)

**Updated Endpoints:**
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - User login with bcrypt verification
- `POST /api/auth/verify` - Verify session token
- `POST /api/auth/logout` - Destroy session
- `GET /api/contacts` - Get all user contacts
- `POST /api/contacts/sync` - Bidirectional sync
- `POST /api/meetings` - Create meeting
- `GET /api/meetings/today` - Get today's meetings

**Authentication:**
- Bearer token authentication
- Sessions stored in database
- 30-day session expiration
- Logout functionality

### 📦 Dependencies

**Added:**
- `pg` - PostgreSQL client
- `bcryptjs` - Password hashing

**Removed:**
- None (Replit Database dependency kept for backward compatibility)

### 🛠 Setup Instructions

1. **Add PostgreSQL to Replit:**
   - Go to **Tools** > **Database**
   - Click **Create database**
   - Select **PostgreSQL**
   - Click **Create**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm run dev
   ```

4. **Verify setup:**
   - Server logs should show "[Server] Database: PostgreSQL"
   - All tables are created automatically
   - API endpoints are available

### 🔒 Security Improvements

- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ Session tokens are cryptographically random
- ✅ Bearer token authentication required for all endpoints
- ✅ Database credentials from environment variables (not hardcoded)
- ✅ Contact data still encrypted client-side (zero-knowledge)

### 📊 Performance Improvements

- ✅ Indexes on user_id, email, token, and date fields
- ✅ Foreign keys with CASCADE delete
- ✅ Efficient queries with JOINs
- ✅ Connection pooling

### 🔜 Future Enhancements

- [ ] Add Web Push notifications
- [ ] Email reminders for meetings
- [ ] Contact categories/tags search
- [ ] Bulk operations
- [ ] Data export (CSV/JSON)
- [ ] Meeting recurrence

## Version 1.x (Replit Database Era)

### Features
- ✅ Progressive Web App (PWA) with offline support
- ✅ IndexedDB local storage
- ✅ AES-256-GCM encryption
- ✅ Contact import (vCard, LinkedIn CSV)
- ✅ User authentication
- ✅ Contact favoriting
- ✅ Meeting scheduling
- ✅ Zero-knowledge architecture
- ✅ Modern glassmorphism UI

---

**Breaking Changes:** None for frontend. Backend API is fully backward compatible with existing clients after re-authentication.

**Migration:** Existing contacts will sync automatically after login with new PostgreSQL backend.
