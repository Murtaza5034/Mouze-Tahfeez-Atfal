importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAxoLoIPRZum286Y0uXM3Vq98V3403L7Uo",
  authDomain: "mawaid-b929a.firebaseapp.com",
  projectId: "mawaid-b929a",
  storageBucket: "mawaid-b929a.appspot.com",
  messagingSenderId: "353078822685",
  appId: "1:353078822685:android:8f83b293733213472bc3f4",
  measurementId: "B5W2bPUAQQmqbmDf5lF-6g"
});

const messaging = firebase.messaging();

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

function parsePushPayload(payload) {
  const data = payload?.data || {};
  const notification = payload?.notification || {};
  return {
    title: notification?.title || data?.title || data?.title || "Mauze Tahfeez Update",
    body: notification?.body || data?.body || data?.body || "Check your portal for important updates",
    image: notification?.image || data?.image || "",
    url: data?.url || data?.link || data?.redirectPage || '/',
    data: data
  };
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
    tag: 'mauze-tahfeez-notification',
    renotify: true,
    requireInteraction: true,
    silent: false,
    dir: 'ltr',
    lang: 'en-US',
    actions: [
      {            action: 'open',
            title: 'Open Portal',
            icon: '/LOGO ATFAAL.png' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  if (info.image) options.image = info.image;
  return options;
}

function showSWNotification(title, options) {
  self.registration.showNotification(title, options).catch(function(err) {
    console.error('Error showing notification:', err);
  });
}

messaging.onBackgroundMessage(function(payload) {
  try {
    console.log('Received background message ', payload);
    const info = parsePushPayload(payload);
    showSWNotification(info.title, buildNotificationOptions(info));
  } catch (err) {
    console.error('Error in onBackgroundMessage:', err);
  }
});

self.addEventListener('push', function(event) {
  try {
    let payload;
    if (event.data) {
      try {
        const raw = event.data.json();
        payload = raw?.notification ? raw : { notification: raw, data: raw };
      } catch (_) {
        const text = event.data.text();
        try { payload = { notification: JSON.parse(text) }; } catch (_) { payload = { notification: { title: text } }; }
      }
    } else {
      payload = { notification: { title: "Mauze Tahfeez Update" } };
    }

    const info = parsePushPayload(payload);
    event.waitUntil(self.registration.showNotification(info.title, buildNotificationOptions(info)));
  } catch (err) {
    console.error('Error in push event:', err);
    event.waitUntil(self.registration.showNotification("Mauze Tahfeez Update", {
      body: "You have a new update",
      icon: '/LOGO ATFAAL.png',
      badge: '/LOGO ATFAAL.png'
    }));
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received.', event);
  event.notification.close();
  if (event.action === 'dismiss') return;

  const redirectPage = event.notification.data?.redirectPage || '';
  let urlToOpen = '/';
  if (redirectPage) {
    urlToOpen = '/?redirectPage=' + encodeURIComponent(redirectPage);
  } else {
    urlToOpen = event.notification.data?.url || '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client && 'navigate' in client) {
            client.navigate(urlToOpen).catch(function() {});
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
      .catch(function(error) {
        console.error('Error handling notification click:', error);
        return clients.openWindow(urlToOpen);
      })
  );
});
