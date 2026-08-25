// ---------------------------------------------------------------------------
// Mauze Tahfeez - Firebase Cloud Messaging Service Worker
// Handles background push notifications when the app/site is closed or in background
// ---------------------------------------------------------------------------

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyAxoLoIPRZum286Y0uXM3Vq98V3403L7Uo",
    authDomain: "mawaid-b929a.firebaseapp.com",
    projectId: "mawaid-b929a",
    storageBucket: "mawaid-b929a.firebasestorage.app",
    messagingSenderId: "353078822685",
    appId: "1:353078822685:web:9b89c7c156bcb0992bc3f4",
    measurementId: "B5W2bPUAQQmqbmDf5lF-6g"
  });
}

const messaging = firebase.messaging();

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

const CANONICAL_PROD_URL = "https://mouze-tahfeez-atfal.vercel.app";

// Extract clean path and query parameters, rewriting any outdated Vercel domain
function sanitizeUrl(rawUrl) {
  if (!rawUrl) return '/';
  try {
    const origin = (self.location && self.location.origin && self.location.origin !== 'null')
      ? self.location.origin
      : CANONICAL_PROD_URL;

    // If it's a relative path
    if (rawUrl.startsWith('/')) {
      return new URL(rawUrl, origin).href;
    }

    // If it's an absolute URL
    const parsed = new URL(rawUrl);
    // Rebase onto the active origin so it never opens an outdated deploy preview or legacy domain
    return new URL(parsed.pathname + parsed.search + parsed.hash, origin).href;
  } catch (_) {
    return '/';
  }
}

function buildDeepLinkUrl(data) {
  const redirectPage = data?.redirectPage || data?.redirect_page || '';
  const leaveId = data?.leaveId || data?.leave_id || '';
  const studentId = data?.studentId || data?.student_id || '';

  const params = [];
  if (redirectPage) params.push('redirectPage=' + encodeURIComponent(redirectPage));
  if (leaveId) params.push('leaveId=' + encodeURIComponent(leaveId));
  if (studentId) params.push('studentId=' + encodeURIComponent(studentId));

  if (params.length > 0) {
    return sanitizeUrl('/?' + params.join('&'));
  }

  if (data?.url || data?.link) {
    return sanitizeUrl(data.url || data.link);
  }

  return sanitizeUrl('/');
}

function parsePushPayload(payload) {
  const data = payload?.data || {};
  const notification = payload?.notification || {};
  return {
    title: notification?.title || data?.title || "Mauze Tahfeez Notification",
    body: notification?.body || data?.body || "Check your portal for important updates",
    image: notification?.image || data?.image || "",
    url: buildDeepLinkUrl(data),
    data: data
  };
}

function makeNotifTag(info) {
  return info.data?.notification_id || info.data?.id || `mauze-${info.title}-${Date.now()}`;
}

function buildNotificationOptions(info) {
  const options = {
    body: info.body,
    icon: '/LOGO ATFAAL.png',
    badge: '/LOGO ATFAAL.png',
    vibrate: [200, 100, 200],
    data: {
      ...info.data,
      url: info.url,
      timestamp: new Date().toISOString()
    },
    tag: makeNotifTag(info),
    renotify: true,
    requireInteraction: true,
    silent: false,
    dir: 'ltr',
    lang: 'en-US',
    actions: [
      {
        action: 'open',
        title: 'Open Portal',
        icon: '/LOGO ATFAAL.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  if (info.image) options.image = info.image;
  return options;
}

// Background handler for Firebase SDK messages
messaging.onBackgroundMessage(function(payload) {
  try {
    console.log('[SW] FCM background message received:', payload);
    const info = parsePushPayload(payload);
    return self.registration.showNotification(info.title, buildNotificationOptions(info));
  } catch (err) {
    console.error('[SW] Error in onBackgroundMessage:', err);
  }
});

// Fallback raw push event listener to ensure background notifications always display
self.addEventListener('push', function(event) {
  try {
    if (!event.data) return;

    let payload;
    try {
      const raw = event.data.json();
      payload = raw?.notification || raw?.data ? raw : { notification: raw, data: raw };
    } catch (_) {
      const text = event.data.text();
      try {
        const parsed = JSON.parse(text);
        payload = parsed?.notification || parsed?.data ? parsed : { notification: parsed, data: parsed };
      } catch (_) {
        payload = { notification: { title: "Mauze Tahfeez Notification", body: text } };
      }
    }

    const info = parsePushPayload(payload);
    event.waitUntil(
      self.registration.showNotification(info.title, buildNotificationOptions(info))
    );
  } catch (err) {
    console.error('[SW] Error handling raw push event:', err);
  }
});

// Notification click event handler
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification click received:', event);
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = buildDeepLinkUrl(event.notification.data);
  console.log('[SW] Opening target URL:', targetUrl);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        const origin = (self.location && self.location.origin && self.location.origin !== 'null')
          ? self.location.origin
          : CANONICAL_PROD_URL;

        for (const client of clientList) {
          if (client.url && client.url.startsWith(origin) && 'focus' in client) {
            if ('navigate' in client) {
              client.navigate(targetUrl).catch(function() {});
            }
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
      .catch(function(error) {
        console.error('[SW] Error handling notification click:', error);
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
