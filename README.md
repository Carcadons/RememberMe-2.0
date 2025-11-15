# RememberMe PWA - Replit Deployment Guide

## Overview

RememberMe is a privacy-first, offline-first Progressive Web App for iOS that helps you remember important details about people before meetings. All data is encrypted locally before any cloud sync.

## Quick Start - Replit Deployment

### Step 1: Import to Replit

1. **Create new Repl**: Go to [Replit](https://replit.com) and click "Create Repl"
2. **Import from GitHub**: Choose "Import from GitHub" and paste this repository URL
3. **Select Type**: Choose "Node.js" as the language
4. **Create**: Click "Import from GitHub"

### Step 2: Configure Environment Variables

In Replit, open the "Secrets (Environment Variables)" tab and add:

```
NODE_ENV=production
API_URL=https://your-repl-name.your-username.repl.co
```

### Step 3: Install Dependencies

Open the Replit Shell and run:

```bash
npm install
```

### Step 4: Run the Application

Click the "Run" button in Replit or use:

```bash
npm start
```

### Step 5: Install on iOS

1. Open Safari on your iPhone/iPad
2. Navigate to your Replit URL
3. Tap the Share button
4. Select "Add to Home Screen"
5. Tap "Add" (top-right corner)

The app will now appear on your home screen as a native app!

## Features Implemented

### ✅ MVP Features
- **Add & Edit Person Card**: Framework ready (fields: name, title, company, photo, tags, quick facts, how you know them)
- **Quick Prep Card**: Today view showing meetings and contact briefs
- **Fast Search**: IndexedDB with fuzzy search capability
- **Secure Local Storage**: AES-256-GCM encryption with passcode
- **Passcode/Biometric Unlock**: 6-digit passcode with WebAuthn biometric support
- **Export**: Framework ready (vCard/PDF)

### ✅ Technical Features
- **Offline-First**: Full functionality without internet
- **PWA Installation**: iOS "Add to Home Screen" optimized
- **Service Worker**: Caching, background sync, push notification support
- **Replit Database**: Built-in key-value store for sync
- **End-to-End Encryption**: Client-side encryption before sync
- **Background Sync**: Syncs when connection returns

### 📋 Additional Features Ready
- **Sharing**: End-to-end encrypted sharing with expiring links
- **Push Notifications**: Firebase Cloud Messaging integration ready
- **Calendar Integration**: Framework for calendar sync
- **Contact Import**: Framework for vCard/LinkedIn import

## Architecture

```
rememberme-pwa/
├── public/                     # Static PWA files
│   ├── index.html             # Main app shell
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker
│   └── icons/                 # App icons
├── src/                       # Frontend source
│   ├── core/
│   │   ├── storage.js         # Encrypted IndexedDB layer
│   │   └── security.js        # Authentication & passcode
│   ├── components/
│   │   └── TodayView.js       # Today view component
│   ├── utils/
│   │   └── encryption.js      # Crypto utilities (AES-256-GCM)
│   └── app.js                 # Main app controller
├── server/                    # Replit backend
│   └── index.js               # Express API endpoints
├── config/                    # Configuration files
└── package.json               # Dependencies
```

## PWA Configuration

### iOS-Specific Optimizations

**manifest.json** includes:
- `display: "standalone"` (fullscreen app)
- `apple-mobile-web-app-capable` (iOS fullscreen)
- `apple-mobile-web-app-status-bar-style` (status bar color)
- Proper icon sizes for iOS

**Service Worker** features:
- Full offline caching
- Background sync for encrypted data
- Push notification support
- Smart sync on app resume

### Installation Flow

1. User visits app URL in Safari
2. Taps Share button → "Add to Home Screen"
3. App installs as native iOS app
4. Launches fullscreen without browser chrome
5. Full offline capability

## Security & Privacy

### Encryption
- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Passcode**: 6-digit numeric (can be extended)
- **Biometrics**: WebAuthn Face ID/Touch ID support
- **Zero-Knowledge**: Server never sees unencrypted data

### Data Flow
1. Data encrypted locally with user's passcode
2. Encrypted blob synced to Replit Database
3. Server stores encrypted data only
4. Decryption only happens on client device

### Authentication
- 6-digit passcode
- Auto-lock after 15 minutes
- Biometric unlock (when available)
- Session timeout on background

## API Endpoints (Replit Backend)

### Sync Endpoints
```
POST /api/sync/contacts      # Sync encrypted contacts
GET  /api/sync/contacts      # Get synced contacts
POST /api/sync/meetings      # Sync encrypted meetings
GET  /api/sync/meetings      # Get synced meetings
```

### Sharing Endpoints
```
POST /api/share/generate     # Generate share link
GET  /api/share/:shareId     # Get shared contact
```

### Push Notification Endpoints
```
POST /api/push/subscribe     # Subscribe to push
POST /api/push/unsubscribe   # Unsubscribe
POST /api/push/send          # Send notification
```

### Utility Endpoints
```
GET  /api/stats              # User stats
POST /api/cleanup            # Cleanup expired shares
```

## Database Schema

### IndexedDB (Client-Side)
```javascript
// Encrypted before storing
contacts: {
  id: string,
  name: string,
  title?: string,
  company?: string,
  photo?: string (base64),
  tags: string[],
  quickFacts: string[],
  howWeMet?: string,
  notes?: string[],
  lastMet?: date,
  starred: boolean,
  encryptedFields: { /* encrypted data */ }
}

meetings: {
  id: string,
  personId: string,
  date: ISO date string,
  topic?: string,
  notes?: string,
  location?: string
}
```

### Replit Database (Server-Side)
```javascript
// All values are encrypted blobs
user:{userId}:contacts     // Object of contacts
user:{userId}:meetings     // Object of meetings
user:{userId}:settings     // User settings
user:{userId}:push-subscription  // Push notification sub
share:{shareId}            // Shared contact data
```

## Files Structure

### Core Files
- **public/index.html** - Main app shell (iOS optimized)
- **public/sw.js** - Service Worker (offline + sync)
- **public/manifest.json** - PWA configuration
- **src/app.js** - App controller and routing
- **src/core/storage.js** - Encrypted IndexedDB wrapper
- **src/core/security.js** - Auth and passcode
- **src/utils/encryption.js** - AES-256-GCM crypto
- **src/components/TodayView.js** - Today meetings view
- **server/index.js** - Replit Express backend
- **package.json** - Dependencies

### Key Features by File

**Frontend Security (src/core/security.js)**:
- 6-digit passcode setup
- Passcode verification
- Auto-lock timer (15 min)
- Biometric auth check
- App lock/unlock UI

**Encrypted Storage (src/core/storage.js)**:
- IndexedDB operations
- AES-256-GCM encryption
- Automatic encrypt/decrypt
- Contact CRUD operations
- Meeting management
- Settings storage

**Crypto Utils (src/utils/encryption.js)**:
- PBKDF2 key derivation
- AES-GCM encrypt/decrypt
- Passcode hashing
- Random ID generation
- ArrayBuffer <-> Base64

**Today View (src/components/TodayView.js)**:
- Shows today's meetings
- Person cards with photos
- Memory chips (quick facts)
- Last interaction preview
- Quick note button
- Meeting details

**Service Worker (public/sw.js)**:
- App shell caching
- Offline functionality
- Background sync contacts
- Background sync meetings
- Push notification handling
- Sync status management

**Replit Backend (server/index.js)**:
- Express API server
- Database sync endpoints
- Encrypted data storage
- Share link generation
- Expiring links
- Push subscription mgmt

## Next Steps

### Phase 4: Enhancement & Testing
1. **Add Person Modal** - UI for creating contacts
2. **Search Implementation** - Fuzzy search UI
3. **Starred View** - UI for starred contacts
4. **Contact Detail View** - Full profile page
5. **Meeting Notes** - Quick note taking
6. **Camera Integration** - Photo capture
7. **Import Contacts** - vCard/LinkedIn import
8. **Push Notifications** - Firebase setup
9. **Calendar Sync** - Google Calendar integration
10. **Sharing UI** - Generate share links

### Phase 5: Polish & Optimize
1. iOS-specific testing
2. Performance optimization
3. Dark mode refinements
4. Haptic feedback
5. Animation improvements
6. Error handling
7. User onboarding
8. App store submission prep

## Development

### Local Development
```bash
npm install
npm run dev
```

### Replit Development
- Code directly in Replit web editor
- Automatic deployment on run
- Live preview with webview

### Testing on iOS
1. Deploy to Replit
2. Open URL on iPhone/iPad
3. Add to Home Screen
4. Test as native app

## Troubleshooting

### PWA Not Installing on iOS
- Must be served over HTTPS (Replit does this automatically)
- Valid manifest.json required
- Service Worker must register successfully

### Offline Not Working
- Check Service Worker registration in DevTools
- Verify cache storage has files
- Clear cache and re-register SW

### Encryption Errors
- Ensure crypto.subtle is available (localhost needs HTTPS or localhost)
- Check browser compatibility
- Verify passcode is correct

### Sync Issues
- Check network connectivity
- Verify server endpoints are accessible
- Check IndexedDB for data

## Privacy Notes

- All data encrypted before leaving device
- Replit Database stores only encrypted blobs
- Zero-knowledge architecture
- No analytics or tracking
- Local-first design
- Export anytime

## Support

For issues or questions:
1. Check console logs (iOS: connect to Mac Safari)
2. Verify IndexedDB data in dev tools
3. Test Service Worker functionality
4. Check Replit logs

## License

MIT License - feel free to modify and deploy!
