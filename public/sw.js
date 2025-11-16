// RememberMe Service Worker
// Handles offline caching, sync, and push notifications

const CACHE_NAME = 'rememberme-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/manifest.json',
  '/src/app.js',
  '/src/utils/encryption.js',
  '/src/utils/photoCropper.js',
  '/src/core/storage.js',
  '/src/core/auth.js',
  '/src/core/sync.js',
  '/src/core/security.js',
  '/src/components/TodayView.js',
  '/src/components/Search.js',
  '/src/components/StarredView.js',
  '/src/components/ContactDetail.js',
  '/src/components/AddContactModal.js',
  '/src/components/UserMenu.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] App shell cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Cache failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          console.log('[SW] Serving from cache:', event.request.url);
          return response;
        }

        console.log('[SW] Fetching from network:', event.request.url);
        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response for caching
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch((error) => {
        console.error('[SW] Fetch failed:', error);
        // Return offline page for navigation requests
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Background sync for data sync
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-contacts') {
    event.waitUntil(syncContacts());
  }

  if (event.tag === 'sync-meetings') {
    event.waitUntil(syncMeetings());
  }
});

// Sync contacts with server
async function syncContacts() {
  try {
    console.log('[SW] Syncing contacts...');

    // Open IndexedDB and get unsynced contacts
    const db = await openDB();
    const contacts = await getUnsyncedContacts(db);

    if (contacts.length === 0) {
      console.log('[SW] No contacts to sync');
      return;
    }

    // Send to server (will be encrypted data)
    const response = await fetch('/api/sync/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contacts })
    });

    if (response.ok) {
      console.log('[SW] Contacts synced successfully');
      // Mark contacts as synced
      await markContactsAsSynced(db, contacts);
    } else {
      console.error('[SW] Failed to sync contacts:', response.status);
      // Throw error to retry sync
      throw new Error('Sync failed');
    }
  } catch (error) {
    console.error('[SW] Sync error:', error);
    throw error; // Re-throw to trigger retry
  }
}

// Sync meetings
async function syncMeetings() {
  try {
    console.log('[SW] Syncing meetings...');

    const db = await openDB();
    const meetings = await getUnsyncedMeetings(db);

    if (meetings.length === 0) {
      console.log('[SW] No meetings to sync');
      return;
    }

    const response = await fetch('/api/sync/meetings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ meetings })
    });

    if (response.ok) {
      console.log('[SW] Meetings synced successfully');
      await markMeetingsAsSynced(db, meetings);
    } else {
      console.error('[SW] Failed to sync meetings:', response.status);
      throw new Error('Sync failed');
    }
  } catch (error) {
    console.error('[SW] Meeting sync error:', error);
    throw error;
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let data = {};
  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.body || 'You have an upcoming meeting!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    actions: data.actions || [
      {
        action: 'view',
        title: 'View Details'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    tag: data.tag || 'meeting-reminder',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'RememberMe',
      options
    )
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Open the app
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }

      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});

// Helper functions for IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RememberMeDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('contacts')) {
        db.createObjectStore('contacts', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('meetings')) {
        db.createObjectStore('meetings', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('sync')) {
        db.createObjectStore('sync', { keyPath: 'id' });
      }
    };
  });
}

async function getUnsyncedContacts(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['contacts'], 'readonly');
    const store = transaction.objectStore('contacts');
    const request = store.getAll();

    request.onsuccess = () => {
      const contacts = request.result.filter(c => !c.synced || c.synced === false);
      resolve(contacts);
    };

    request.onerror = () => reject(request.error);
  });
}

async function getUnsyncedMeetings(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['meetings'], 'readonly');
    const store = transaction.objectStore('meetings');
    const request = store.getAll();

    request.onsuccess = () => {
      const meetings = request.result.filter(m => !m.synced || m.synced === false);
      resolve(meetings);
    };

    request.onerror = () => reject(request.error);
  });
}

async function markContactsAsSynced(db, contacts) {
  const transaction = db.transaction(['contacts'], 'readwrite');
  const store = transaction.objectStore('contacts');

  contacts.forEach(contact => {
    contact.synced = true;
    contact.syncedAt = new Date().toISOString();
    store.put(contact);
  });

  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function markMeetingsAsSynced(db, meetings) {
  const transaction = db.transaction(['meetings'], 'readwrite');
  const store = transaction.objectStore('meetings');

  meetings.forEach(meeting => {
    meeting.synced = true;
    meeting.syncedAt = new Date().toISOString();
    store.put(meeting);
  });

  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

// Handle messages from the app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'SYNC_NOW') {
    // Trigger sync immediately
    if ('sync' in self.registration) {
      self.registration.sync.register('sync-contacts');
      self.registration.sync.register('sync-meetings');
    }
  }

  if (event.data.type === 'PUSH_SUBSCRIBE') {
    // Subscribe to push notifications
    subscribeToPush();
  }
});

// Subscribe to push notifications
async function subscribeToPush() {
  try {
    const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY';

    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    console.log('[SW] Push subscription successful');

    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ subscription })
    });

  } catch (error) {
    console.error('[SW] Push subscription failed:', error);
  }
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

console.log('[SW] Service Worker loaded successfully');
