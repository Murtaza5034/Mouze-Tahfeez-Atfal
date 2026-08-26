import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

try {
  // Clear legacy/cached FCM token databases from IndexedDB to prevent 403 token-unsubscribe-failed errors
  if (typeof window !== 'undefined' && window.indexedDB) {
    const cachedVer = localStorage.getItem("mauze-fcm-v4");
    if (cachedVer !== "4") {
      ['fcm_token_details_db', 'firebase-messaging-database', 'firebase-installations-database'].forEach((name) => {
        try { window.indexedDB.deleteDatabase(name); } catch (_) {}
      });
      localStorage.setItem("mauze-fcm-v4", "4");
    }
  }
} catch (e) {
  console.warn("Failed to clear legacy IndexedDB database:", e);
}

// Web FCM lives on the mawaid-b929a project. It is initialized as a NAMED app
// so it never collides with the default app used by src/firebase/ (which also
// targets mawaid-b929a for Firestore data + callable functions).
const FCM_APP_NAME = "webFcm";

const firebaseConfig = {
  apiKey: "AIzaSyAxoLoIPRZum286Y0uXM3Vq98V3403L7Uo",
  authDomain: "mawaid-b929a.firebaseapp.com",
  projectId: "mawaid-b929a",
  storageBucket: "mawaid-b929a.firebasestorage.app",
  messagingSenderId: "353078822685",
  appId: "1:353078822685:web:9b89c7c156bcb0992bc3f4",
  measurementId: "B5W2bPUAQQmqbmDf5lF-6g"
};

// Initialize Firebase as the named FCM app (getting/reuse safe)
export const firebaseApp = getApps().find(a => a.name === FCM_APP_NAME) || initializeApp(firebaseConfig, FCM_APP_NAME);

// Safely obtain Messaging instance only if the browser environment supports Web Push
let messagingPromise = null;
export const getMessagingInstance = async () => {
  if (typeof window === 'undefined') return null;
  if (!messagingPromise) {
    messagingPromise = (async () => {
      try {
        const supported = await isSupported();
        if (!supported) {
          console.warn('[FCM] Firebase Messaging is not supported in this browser environment.');
          return null;
        }
        return getMessaging(firebaseApp);
      } catch (err) {
        console.warn('[FCM] Error checking Firebase Messaging support:', err);
        return null;
      }
    })();
  }
  return messagingPromise;
};

// Get registration token with retry
export const getFCMToken = async (retries = 3) => {
  const msgInstance = await getMessagingInstance();
  if (!msgInstance) {
    console.warn('[FCM] Messaging instance unavailable (browser may not support Web Push or requires PWA mode).');
    return null;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[FCM] Requesting FCM Token (attempt ${attempt}/${retries})...`);
      
      // Explicitly obtain active service worker registration for official PWA / background push support
      if ('serviceWorker' in navigator) {
        let registration = await navigator.serviceWorker.ready.catch(() => null);
        if (!registration) {
          registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/'
          });
          await navigator.serviceWorker.ready;
        }
        console.log('[FCM] Service Worker active registration:', registration?.scope);
        
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "BNWhCt5Y0FaHfo6H4O5c3I8vtkZVbSduNgy65bZ7Il5BogYCif7s4RGmSMJzC73Y6bdCrJRwmUsXKALXJXlm2Sk";
        const currentToken = await getToken(msgInstance, { 
          vapidKey,
          serviceWorkerRegistration: registration
        });
        
        if (currentToken) {
          console.log('[FCM] Official FCM Token retrieved:', currentToken.substring(0, 20) + '...');
          return currentToken;
        } else {
          console.log('[FCM] No registration token returned. Permission might be needed.');
          return null;
        }
      } else {
        console.error('[FCM] Service workers are not supported in this browser.');
        return null;
      }
    } catch (error) {
      if (error.code === 'messaging/permission-blocked' || error.name === 'NotAllowedError') {
        console.warn('[FCM] Notification permission was blocked.');
        return null;
      } else if (error.code === 'messaging/unsupported-browser') {
        console.warn('[FCM] This browser is not supported for FCM notifications.');
        return null;
      }
      // Handle 403 Forbidden errors (token deletion failed, stale registration)
      if (error.message && (error.message.includes('403') || error.message.includes('Forbidden') || error.message.includes('token-unsubscribe-failed') || error.message.includes('caller does not have permission'))) {
        console.warn('[FCM] Stale FCM token detected, clearing IndexedDB databases...');
        try {
          if (typeof window !== 'undefined' && window.indexedDB) {
            ['fcm_token_details_db', 'firebase-messaging-database', 'firebase-installations-database'].forEach(name => {
              try { window.indexedDB.deleteDatabase(name); } catch (_) {}
            });
            localStorage.setItem("mauze-fcm-v3", "3");
          }
        } catch (e) {
          console.warn("[FCM] Failed to clear IndexedDB database:", e);
        }
        return null;
      }
      console.warn(`[FCM] Token retrieval note (attempt ${attempt}/${retries}):`, error?.message || error);
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  return null;
};

// Handle incoming messages
export const onMessageListener = async (callback) => {
  try {
    const msgInstance = await getMessagingInstance();
    if (!msgInstance) return null;

    return onMessage(msgInstance, (payload) => {
      try {
        console.log('[FCM] Foreground message received: ', payload);
        if (callback) {
          callback(payload);
        }
      } catch (callbackError) {
        console.error('[FCM] Error in onMessage callback:', callbackError);
      }
    });
  } catch (error) {
    console.error('[FCM] Error setting up onMessage listener:', error);
    return null;
  }
};

// Lazy proxy for backward compatibility if any legacy code imports `messaging`
export const messaging = null;

