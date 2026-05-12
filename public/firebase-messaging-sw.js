importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
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

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message ', payload);

  const notificationTitle = payload.notification.title || "Mauze Tahfeez Update";
  const notificationOptions = {
    body: payload.notification.body || "Check your portal for important updates",
    icon: '/logo.png',
    badge: '/logo.png',
    image: payload.notification.image || null,
    vibrate: [200, 100, 200],
    data: {
      ...payload.data,
      url: payload.data?.url || '/',
      timestamp: new Date().toISOString()
    },
    tag: 'mauze-tahfeez-notification',
    renotify: true,
    requireInteraction: true,
    silent: false,
    dir: 'ltr',
    lang: 'en-US',
    actions: [
      {
        action: 'open',
        title: 'Open Portal',
        icon: '/logo.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received.', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  if (event.action === 'dismiss') {
    // Just close the notification
    return;
  }

  // Handle open action or default click
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing window first
        for (const client of clientList) {
          if (client.url === new URL(urlToOpen, self.location.origin).href && 'focus' in client) {
            return client.focus();
          }
        }
        // If no existing window, open new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
      .catch((error) => {
        console.error('Error handling notification click:', error);
        // Fallback to opening new window
        return clients.openWindow(urlToOpen);
      })
  );
});
