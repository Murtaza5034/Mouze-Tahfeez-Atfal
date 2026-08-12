import { supabase } from './supabaseClient.js';

// Detect if running inside a Capacitor native app
function isCapacitor() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform);
}

function isNativeAndroid() {
  return isCapacitor() && window.Capacitor.getPlatform() === 'android';
}

// ---------------------------------------------------------------------------
// Notification-tap handling (exact-page deep linking)
//
// Taps are STASHED (localStorage + a window event) instead of doing a full
// page reload, so the portal can navigate to the exact page the notification
// belongs to without losing state. Cold-start taps (app was killed) are
// recovered from the native MauzeNotifBridge in MainActivity, which reads the
// notification extras preserved by SplashActivity.
// ---------------------------------------------------------------------------
const NOTIF_TAP_KEY = "mauze_notif_tap";

function stashNotificationTap(data) {
  if (!data || typeof data !== "object") return;
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      clean[k] = v;
    }
  }
  try {
    localStorage.setItem(NOTIF_TAP_KEY, JSON.stringify(clean));
  } catch (_) {}
  try {
    window.dispatchEvent(new CustomEvent("mauze:notification-tap", { detail: clean }));
  } catch (_) {}
}

// Register the native tap listener as early as possible (at module load, before
// login / FCM init) so taps that arrive while the app is backgrounded are
// never lost. The portal consumes the stashed payload once it is ready.
if (isNativeAndroid()) {
  (async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action?.notification?.data || {};
        if (Object.keys(data).length) stashNotificationTap(data);
      });
    } catch (_) {}
  })();
}

class FCMService {
  constructor() {
    this.isSupported = false;
    this.token = null;
    this.initialized = false;
    this.initializingPromise = null;
    this.refreshInterval = null;
    this.isNative = false;
    this._shownIds = new Set();
    this._dedupWindow = 30000;
  }

  _isDuplicate(id) {
    if (!id) return false;
    if (this._shownIds.has(id)) return true;
    this._shownIds.add(id);
    setTimeout(() => this._shownIds.delete(id), this._dedupWindow);
    return false;
  }

  _makeNotificationId(payload) {
    const n = payload?.notification || {};
    const d = payload?.data || {};
    return d?.notification_id || d?.id || `${n?.title || ''}_${n?.body || ''}_${d?.timestamp || Date.now()}`;
  }

  // Refresh token periodically (every 2 hours) to keep it valid
  startTokenRefresh(userRole) {
    this.stopTokenRefresh();
    this.refreshInterval = setInterval(async () => {
      console.log('FCM: Periodic token refresh...');
      try {
        const oldToken = this.token;
        const freshToken = await this._getToken();
        if (freshToken && freshToken !== oldToken) {
          await this.storeToken(freshToken, userRole);
          console.log('FCM: Token refreshed');
        }
      } catch (err) {
        console.warn('FCM: Token refresh failed:', err);
      }
    }, 2 * 60 * 60 * 1000);
  }

  stopTokenRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Play premium notification chime using Web Audio API
  playPremiumChime() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;

      // Create gain node for volume control (full volume = 1.0)
      const masterGain = audioCtx.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(audioCtx.destination);

      // Note frequencies for a rich ascending chime (C5, E5, G5, C6)
      const notes = [523.25, 659.25, 783.99, 1046.50];

      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = i === 3 ? 'sine' : 'triangle'; // C6 sine for shimmer
        osc.frequency.value = freq;

        // Envelope: quick attack, medium decay, sustain, release
        const startTime = now + i * 0.08;
        const attack = 0.02;
        const release = 0.6;

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.7, startTime + attack);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + release);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + release);
      });

      // Add a soft sub-bass for fullness
      const bassOsc = audioCtx.createOscillator();
      const bassGain = audioCtx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.value = 261.63; // Middle C
      bassGain.gain.setValueAtTime(0, now);
      bassGain.gain.linearRampToValueAtTime(0.25, now + 0.05);
      bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      bassOsc.connect(bassGain);
      bassGain.connect(masterGain);
      bassOsc.start(now);
      bassOsc.stop(now + 0.8);
    } catch (err) {
      console.warn('Premium notification chime could not play:', err);
    }
  }

  // --- Native (Capacitor) FCM helpers ---

  async _initNative(userRole) {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Attach the token listener BEFORE register() so the native token event
    // is never missed. Previously the listener was added after register(),
    // which could miss the event and leave native push unregistered.
    let resolveToken = null;
    let rejectToken = null;
    let tokenTimer = null;
    const tokenReady = new Promise((resolve, reject) => {
      resolveToken = resolve;
      rejectToken = reject;
    });

    const settleToken = (value) => {
      if (tokenTimer) { clearTimeout(tokenTimer); tokenTimer = null; }
      if (resolveToken) { resolveToken(value); resolveToken = null; rejectToken = null; }
    };

    await PushNotifications.addListener('registration', (data) => {
      if (data?.value) {
        console.log('Capacitor FCM Token:', data.value.substring(0, 20) + '...');
        this.token = data.value;
        settleToken(this.token);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Capacitor Push registration error:', err);
      if (tokenTimer) { clearTimeout(tokenTimer); tokenTimer = null; }
      if (rejectToken) { rejectToken(new Error('Push registration failed')); rejectToken = null; resolveToken = null; }
    });

    // Request permission (Android 13+)
    try {
      const permResult = await PushNotifications.requestPermissions();
      console.log('Capacitor PushNotifications permission:', permResult);
      if (permResult?.receive === 'denied') {
        console.error('Push notification permission not granted');
        return false;
      }
    } catch (permErr) {
      // On some devices requestPermissions may already be granted; continue.
      console.warn('Push permission request issue (continuing):', permErr);
    }

    // Register for push
    await PushNotifications.register();
    console.log('Capacitor PushNotifications registered');

    // Wait up to 15s for the first native token
    tokenTimer = setTimeout(() => {
      if (rejectToken) {
        const err = new Error('Push registration timed out');
        rejectToken(err);
        rejectToken = null;
        resolveToken = null;
      }
    }, 15000);

    this.token = await tokenReady;

    this.isNative = true;

    // Store token in database
    const stored = await this.storeToken(this.token, userRole);
    if (!stored) {
      await new Promise(r => setTimeout(r, 1000));
      await this.storeToken(this.token, userRole);
    }

    // Listen for incoming notifications (foreground)
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Capacitor foreground notification:', notification);
      this.playPremiumChime();
      // Background/terminated notifications are displayed by the OS automatically
    });

    // Ensure the premium notification channel exists (Android 8+). The Firebase
    // SDK auto-creates it from the payload channel_id, but creating it here
    // explicitly gives it HIGH importance + sound + vibration for a premium feel.
    try {
      await PushNotifications.createChannel({
        id: "mauze-tahfeez-notifications",
        name: "Mauze Tahfeez",
        description: "Leave chat & portal notifications",
        importance: 5, // IMPORTANCE_HIGH
        visibility: 1, // VISIBILITY_PUBLIC
        sound: "",
        vibration: true,
        lights: true
      });
    } catch (channelErr) {
      console.warn('Could not create premium notification channel:', channelErr);
    }

    // Notification taps are handled by the module-level listener (registered at
    // import time) which stashes the payload for the portal to deep-link to the
    // exact page. Cold-start taps are recovered from the native MauzeNotifBridge.

    this.isNative = true;
    this.isSupported = true;
    this.initialized = true;

    // Start periodic token refresh (re-register native push)
    this.startTokenRefresh(userRole);

    return true;
  }

  async _getToken() {
    if (this.isNative) {
      // Re-register for a fresh token; persistent listener in _initNative will update this.token
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const oldToken = this.token;
        await PushNotifications.register();
        // Wait up to 10s for token to change
        const deadline = Date.now() + 10000;
        while (this.token === oldToken && Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 200));
        }
        return this.token;
      } catch {
        return this.token || null;
      }
    }
    // Web fallback
    const { getFCMToken } = await import('./firebaseConfig.js');
    return getFCMToken();
  }

  // --- Initialize FCM service ---
  async initialize(userRole) {
    if (this.initialized && this.token) {
      console.log('FCM service already initialized');
      return true;
    }

    if (this.initializingPromise) {
      console.log('FCM service initialization already in progress, waiting...');
      return this.initializingPromise;
    }

    this.initializingPromise = (async () => {
      try {
        console.log('Initializing FCM service for role:', userRole);

        // --- Native Capacitor path ---
        if (isNativeAndroid()) {
          console.log('Running in native Android Capacitor — using native PushNotifications');
          return await this._initNative(userRole);
        }

        // --- Web / PWA path ---
        if (!('Notification' in window)) {
          console.error('This browser does not support notifications');
          return false;
        }

        if (!('serviceWorker' in navigator)) {
          console.error('Service workers are not supported in this browser');
          return false;
        }

        // Check current permission status
        const currentPermission = Notification.permission;
        console.log('Current notification permission:', currentPermission);

        // Request notification permission if not granted
        let permission = currentPermission;
        if (permission === 'default') {
          console.log('Requesting notification permission...');
          permission = await Notification.requestPermission();
          console.log('Notification permission status:', permission);
        }

        if (permission !== 'granted') {
          console.error('Notification permission denied. Please enable notifications in your browser settings.');
          return false;
        }

        // Dynamically import web FCM only when needed
        const { getFCMToken } = await import('./firebaseConfig.js');

        // Get FCM token
        console.log('Retrieving FCM token...');
        const token = await getFCMToken();
        if (!token) {
          console.error('Failed to get FCM token. Please refresh the page and try again.');
          return false;
        }

        console.log('FCM token retrieved successfully:', token.substring(0, 20) + '...');
        this.token = token;
        this.isSupported = true;

        // Store token in database (with retries)
        console.log('Storing FCM token in database...');
        const stored = await this.storeToken(token, userRole);
        if (!stored) {
          console.warn('FCM token stored failed on first attempt, retrying...');
          await new Promise(r => setTimeout(r, 1000));
          const storedRetry = await this.storeToken(token, userRole);
          if (!storedRetry) {
            console.warn('FCM token storage failed after retry. Token is cached in memory but may not be reachable from server.');
          } else {
            console.log('FCM token stored on retry');
          }
        }

        // Set up message listener
        this.setupMessageListener();

        this.initialized = true;
        console.log('FCM service initialized successfully for role:', userRole);

        // Start periodic token refresh
        this.startTokenRefresh(userRole);

        return true;

      } catch (error) {
        console.error('Error initializing FCM service:', error);
        if (error.name === 'AbortError') {
          console.error('FCM registration was aborted. This might be due to a service worker conflict or insecure context.');
        } else if (error.code === 'messaging/permission-blocked') {
          console.error('Notification permission was blocked by the user.');
        } else if (error.code === 'messaging/unsupported-browser') {
          console.error('This browser is not supported for FCM.');
        }
        return false;
      } finally {
        this.initializingPromise = null;
      }
    })();

    return this.initializingPromise;
  }

  // Store FCM token in database
  async storeToken(token, userRole) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Expected when FCM initializes before login (e.g. the "Enable Device
        // Alerts" button) - not an error, just nothing to attach the token to.
        console.warn('FCM: no authenticated user yet - skipping token storage');
        return false;
      }

      console.log('Storing token for user:', user.id, 'with role:', userRole);

      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform || (isCapacitor() ? window.Capacitor.getPlatform() : 'unknown'),
        language: navigator.language,
        deviceType: this.isNative ? 'native' : 'web',
        timestamp: new Date().toISOString()
      };

      // Upsert token (update if exists, insert if new)
      const { error } = await supabase
        .from('user_fcm_tokens')
        .upsert({
          user_id: user.id,
          user_role: userRole,
          fcm_token: token,
          device_info: deviceInfo
        }, {
          onConflict: 'user_id,fcm_token'
        });

      if (error) {
        console.error('Error storing FCM token:', error);
        return false;
      } else {
        console.log('FCM token stored successfully for user:', user.id);
        return true;
      }
    } catch (error) {
      console.error('Error in storeToken:', error);
      return false;
    }
  }

  // Set up message listener for foreground messages (web only)
  setupMessageListener() {
    if (this.isNative) return; // Native handles this via PushNotifications.addListener

    import('./firebaseConfig.js').then(({ onMessageListener }) => {
      onMessageListener((payload) => {
        console.log('Processing foreground message in fcmService');
        this.showNotification(payload);
      });
    });
  }

  // Show notification (web only - native handles display automatically)
  showNotification(payload) {
    if (this.isNative) return;

    try {
      const notifId = this._makeNotificationId(payload);
      if (this._isDuplicate(notifId)) {
        console.log('Skipping duplicate notification:', notifId);
        return;
      }
      console.log('Showing notification:', payload);
      this.playPremiumChime();
      const { notification, data } = payload;
      const image = notification?.image || data?.image || "";

      // Create notification options with official styling
      const options = {
        body: notification?.body || 'New notification from Mauze Tahfeez',
        icon: '/LOGO ATFAAL.png',
        badge: '/LOGO ATFAAL.png',
        vibrate: [200, 100, 200],
        data: {
          ...data,
          url: data?.url || payload.fcmOptions?.link || '/',
          timestamp: new Date().toISOString()
        },
        tag: notifId,
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

      if (image) {
        options.image = image;
      }

      // Create and show notification
      if ('serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then((registration) => {
          console.log('Using service worker to show notification');
          registration.showNotification(notification?.title || 'Mauze Tahfeez Update', options);
        }).catch((error) => {
          console.error('Service worker notification failed:', error);
          this.showBrowserNotification(notification?.title || 'Mauze Tahfeez Update', options, data);
        });
      } else {
        console.log('Using browser notification');
        this.showBrowserNotification(notification?.title || 'Mauze Tahfeez Update', options, data);
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  // Show browser notification with click handling
  showBrowserNotification(title, options, data) {
    const notification = new Notification(title, options);

    notification.onclick = (event) => {
      event.preventDefault();
      notification.close();
      this.handleNotificationClick(data);
    };

    return notification;
  }

  // Handle notification click (web foreground notifications)
  handleNotificationClick(data) {
    try {
      const redirectPage = data?.redirectPage || '';
      const leaveId = data?.leaveId || '';
      const studentId = data?.studentId || data?.student_id || '';
      const params = [];
      if (redirectPage) params.push('redirectPage=' + encodeURIComponent(redirectPage));
      if (leaveId) params.push('leaveId=' + encodeURIComponent(leaveId));
      if (studentId) params.push('studentId=' + encodeURIComponent(studentId));
      const url = params.length ? '/?' + params.join('&') : '/';
      console.log('Navigating to:', url);

      if (window.focus && !window.document.hidden) {
        window.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
      window.location.href = '/';
    }
  }

  // Remove token (for logout)
  async removeToken() {
    if (!this.token) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('user_fcm_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('fcm_token', this.token);

      // Unregister on native
      if (this.isNative) {
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          await PushNotifications.removeAllListeners();
          await PushNotifications.unregister();
        } catch (err) {
          console.warn('Capacitor unregister failed:', err);
        }
      }

      this.token = null;
      this.initialized = false;
      this.stopTokenRefresh();
      console.log('FCM token removed successfully');
    } catch (error) {
      console.error('Error removing FCM token:', error);
    }
  }

  // Get current token
  getToken() {
    return this.token;
  }

  // Check if FCM is supported
  isFCMSupported() {
    return this.isSupported;
  }

  // Check if service is initialized
  isInitialized() {
    return this.initialized;
  }
}

// Create singleton instance
const fcmService = new FCMService();

export default fcmService;
