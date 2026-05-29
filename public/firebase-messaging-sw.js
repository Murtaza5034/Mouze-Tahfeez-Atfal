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
  try {
    console.log('Received background message ', payload);

    const title = payload.notification?.title || payload.data?.title || "Mauze Tahfeez Update";
    const body = payload.notification?.body || payload.data?.body || "Check your portal for important updates";
    
    const image = payload.notification?.image || payload.data?.image || "";
    const notificationOptions = {
      body: body,
      icon: '/logo.png',
      badge: '/logo.png',
      vibrate: [200, 100, 200],
      data: {
        ...payload.data,
        url: payload.data?.url || payload.fcmOptions?.link || '/',
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

    if (image) {
      notificationOptions.image = image;
    }

    // Play premium notification chime at full volume
    try {
      const audioCtx = new (self.AudioContext || self.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const masterGain = audioCtx.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(audioCtx.destination);

      // Ascending rich chime: C5, E5, G5, C6
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = i === 3 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        const t = now + i * 0.08;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.7, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.6);
      });

      // Sub-bass for fullness
      const bass = audioCtx.createOscillator();
      const bassGain = audioCtx.createGain();
      bass.type = 'sine';
      bass.frequency.value = 261.63;
      bassGain.gain.setValueAtTime(0, now);
      bassGain.gain.linearRampToValueAtTime(0.25, now + 0.05);
      bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      bass.connect(bassGain);
      bassGain.connect(masterGain);
      bass.start(now);
      bass.stop(now + 0.8);
    } catch (err) {
      console.warn('Premium chime could not play:', err);
    }

    // Use self.registration.showNotification directly without returning the promise
    // to prevent "message channel closed" errors in Firebase SDK
    self.registration.showNotification(title, notificationOptions).catch(function(err) {
      console.error('Error showing notification:', err);
    });
  } catch (err) {
    console.error('Error in onBackgroundMessage:', err);
  }
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received.', event);

  event.notification.close();

  // Use redirectPage from notification data to construct app URL with query param
  const redirectPage = event.notification.data?.redirectPage || '';
  let urlToOpen = '/';
  if (redirectPage) {
    urlToOpen = '/?redirectPage=' + encodeURIComponent(redirectPage);
  } else {
    urlToOpen = event.notification.data?.url || '/';
  }

  if (event.action === 'dismiss') {
    // Just close the notification
    return;
  }

  // Handle open action or default click
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to use existing window — navigate + focus it
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client && 'navigate' in client) {
            client.navigate(urlToOpen).catch(() => {});
            return client.focus();
          }
        }
        // No existing window, open new one
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
