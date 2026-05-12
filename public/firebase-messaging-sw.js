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

  const notificationTitle = payload.notification.title || "New Update";
  const notificationOptions = {
    body: payload.notification.body || "Check your portal for details",
    icon: payload.notification.image || payload.notification.icon || '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    tag: 'mauze-tahfeez-notification', // Prevents duplicates
    renotify: true,
    requireInteraction: true, // Professional behavior: stays until dismissed
    actions: [
      {
        action: 'open',
        title: 'Open Portal'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received.');

  event.notification.close();

  if (event.action === 'open') {
    // Open your app
    event.waitUntil(
      clients.openWindow('/')
    );
  } else {
    // Handle default click
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
