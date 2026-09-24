import { supabase } from './supabaseClient.js';
import { isCapacitor, isNativeAndroid, getDeviceInfo, isIOS, isStandalone } from './utils/deviceUtils.js';

export { isCapacitor, isNativeAndroid, getDeviceInfo, isIOS, isStandalone };



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

// Listen for notification-click and foreground messages from the Service Worker
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event?.data?.type === 'mauze:notification-click') {
      const data = event.data.data || {};
      stashNotificationTap(data);
    } else if (event?.data?.type === 'mauze:fcm-foreground-message') {
      const payload = event.data.payload;
      if (payload && typeof fcmService !== 'undefined') {
        fcmService.showNotification(payload);
      }
    }
  });
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
    this._dedupWindow = 20000;
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
    return d?.notification_id || d?.id || d?.tag || `${n?.title || ''}_${n?.body || ''}`;
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

    // Seed token from cache if available so we never block on cold start
    const cachedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('mauze_current_fcm_token') : null;
    if (cachedToken && !this.token) {
      this.token = cachedToken;
    }

    let resolveToken = null;
    let tokenTimer = null;
    const tokenReady = new Promise((resolve) => {
      resolveToken = resolve;
    });

    const settleToken = (value) => {
      if (tokenTimer) { clearTimeout(tokenTimer); tokenTimer = null; }
      if (resolveToken) { resolveToken(value); resolveToken = null; }
    };

    // Remove any previous listener before attaching to prevent duplicates
    try {
      await PushNotifications.removeAllListeners();
    } catch (_) {}

    await PushNotifications.addListener('registration', async (data) => {
      if (data?.value) {
        console.log('[FCM Native] Received Token:', data.value.substring(0, 20) + '...');
        this.token = data.value;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('mauze_current_fcm_token', data.value);
          }
        } catch (_) {}
        settleToken(this.token);
        try {
          await this.storeToken(data.value, userRole);
        } catch (err) {
          console.warn('[FCM Native] Failed to store token on registration event:', err);
        }
      }
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('[FCM Native] Push registration error:', err);
      settleToken(this.token || null);
    });

    // Request permission (Android 13+ POST_NOTIFICATIONS)
    try {
      const checkResult = await PushNotifications.checkPermissions();
      console.log('[FCM Native] Check permissions:', checkResult);
      if (checkResult?.receive !== 'granted') {
        const permResult = await PushNotifications.requestPermissions();
        console.log('[FCM Native] Request permissions result:', permResult);
        if (permResult?.receive === 'denied') {
          console.warn('[FCM Native] Push notification permission denied by user');
        }
      }
    } catch (permErr) {
      console.warn('[FCM Native] Push permission check/request issue:', permErr);
    }

    // Ensure the premium notification channel exists (Android 8+)
    try {
      await PushNotifications.createChannel({
        id: "mauze-tahfeez-notifications",
        name: "Mauze Tahfeez Notifications",
        description: "Leave, attendance, result, and schedule notifications",
        importance: 5, // IMPORTANCE_HIGH
        visibility: 1, // VISIBILITY_PUBLIC
        sound: "default",
        vibration: true,
        lights: true,
      });
      console.log('[FCM Native] Notification channel verified');
    } catch (channelErr) {
      console.warn('[FCM Native] Could not create notification channel:', channelErr);
    }

    // Register with FCM
    try {
      await PushNotifications.register();
      console.log('[FCM Native] PushNotifications.register() dispatched');
    } catch (regErr) {
      console.warn('[FCM Native] PushNotifications.register() error:', regErr);
    }

    // If we already have a cached token, resolve quickly (2s timeout), otherwise wait up to 10s
    tokenTimer = setTimeout(() => {
      console.log('[FCM Native] Token wait resolved with current token state');
      settleToken(this.token || null);
    }, this.token ? 2000 : 10000);

    const freshToken = await tokenReady;
    if (freshToken) {
      this.token = freshToken;
    }

    this.isNative = true;
    this.isSupported = true;
    this.initialized = true;

    // Store token in database if available
    if (this.token) {
      this.storeToken(this.token, userRole).catch((err) => {
        console.warn('[FCM Native] Background storeToken note:', err);
      });
    }

    // Listen for incoming notifications in FOREGROUND
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[FCM Native] Foreground notification received:', notification);
      this.playPremiumChime();

      // Dispatch event to show in-app banner toast
      try {
        window.dispatchEvent(
          new CustomEvent('mauze:notification-foreground', {
            detail: {
              title: notification?.title || notification?.data?.title || 'Mauze Tahfeez',
              body: notification?.body || notification?.data?.body || '',
              data: notification?.data || {},
            }
          })
        );
      } catch (_) {}

      // Refresh inbox in real-time
      try {
        window.dispatchEvent(new CustomEvent('mauze:inbox-refresh'));
      } catch (_) {}
    });

    // Start periodic token refresh
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
  async initialize(userRole, options = {}) {
    const devInfo = getDeviceInfo();

    if (this.initialized && this.token) {
      console.log('[FCM] Service already initialized, ensuring token is stored');
      await this.storeToken(this.token, userRole);
      return { success: true, token: this.token };
    }

    if (this.initializingPromise) {
      console.log('[FCM] Initialization already in progress, waiting...');
      return this.initializingPromise;
    }

    this.initializingPromise = (async () => {
      try {
        console.log('[FCM] Initializing FCM service for role:', userRole);

        // --- Native Capacitor path ---
        if (isNativeAndroid()) {
          console.log('[FCM] Running in native Android Capacitor — using native PushNotifications');
          const res = await this._initNative(userRole);
          return typeof res === 'object' ? res : { success: !!res, token: this.token };
        }

        // --- iOS in standard browser tab (non-PWA) ---
        // On iOS, Apple requires Web Push to be installed to Home Screen (PWA mode)
        if (devInfo.isIOS && !devInfo.isStandalone) {
          console.warn('[FCM] iOS browser tab detected. Apple Web Push requires adding app to Home Screen.');
          return {
            success: false,
            reason: 'ios_not_standalone',
            isIOS: true,
            isChrome: devInfo.isChromeIOS,
            isSafari: devInfo.isSafariIOS
          };
        }

        // --- Web / PWA path ---
        if (!('Notification' in window)) {
          console.warn('[FCM] This browser does not support notifications');
          return { success: false, reason: 'unsupported_browser' };
        }

        if (!('serviceWorker' in navigator)) {
          console.warn('[FCM] Service workers are not supported in this browser');
          return { success: false, reason: 'no_service_worker' };
        }

        // Check current permission status
        const currentPermission = Notification.permission;
        console.log('[FCM] Current notification permission:', currentPermission);

        let permission = currentPermission;
        if (permission === 'default') {
          console.log('[FCM] Requesting notification permission...');
          try {
            permission = await Notification.requestPermission();
          } catch (permErr) {
            console.warn('[FCM] Notification.requestPermission error:', permErr);
          }
          console.log('[FCM] Notification permission status:', permission);
        }

        if (permission !== 'granted') {
          console.warn('[FCM] Notification permission denied or not granted.');
          return { success: false, reason: 'permission_denied' };
        }

        // Dynamically import web FCM only when needed
        const { getFCMToken } = await import('./firebaseConfig.js');

        // Get FCM token
        console.log('[FCM] Retrieving FCM token...');
        const token = await getFCMToken();
        if (!token) {
          console.warn('[FCM] Failed to get FCM token.');
          return { success: false, reason: 'token_fetch_failed' };
        }

        console.log('[FCM] Token retrieved successfully:', token.substring(0, 20) + '...');
        this.token = token;
        this.isSupported = true;

        // Store token in database (with retries)
        console.log('[FCM] Storing FCM token in database...');
        const stored = await this.storeToken(token, userRole);
        if (!stored) {
          console.warn('[FCM] Token store failed on first attempt, retrying...');
          await new Promise(r => setTimeout(r, 1000));
          const storedRetry = await this.storeToken(token, userRole);
          if (!storedRetry) {
            console.warn('[FCM] Token storage failed after retry.');
          } else {
            console.log('[FCM] Token stored on retry');
          }
        }

        // Set up message listener
        this.setupMessageListener();

        this.initialized = true;
        console.log('[FCM] Service initialized successfully for role:', userRole);

        // Start periodic token refresh
        this.startTokenRefresh(userRole);

        return { success: true, token };

      } catch (error) {
        console.error('[FCM] Error initializing FCM service:', error);
        return { success: false, reason: error?.name || error?.code || 'error', error };
      } finally {
        this.initializingPromise = null;
      }
    })();

    return this.initializingPromise;
  }

  // Store FCM token in database
  async storeToken(token, userRole) {
    if (!token) return false;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mauze_current_fcm_token', token);
      }
    } catch (_) {}

    try {
      let user = null;
      // Retry fetching user up to 4 times (e.g. while auth session restores on app startup)
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          user = data.user;
          break;
        }
        await new Promise((r) => setTimeout(r, 600));
      }

      if (!user) {
        console.warn('[FCM] No authenticated user detected yet; token cached locally for post-login sync');
        return false;
      }

      const normEmail = user.email ? String(user.email).trim().toLowerCase() : '';
      console.log('[FCM] Storing token for user:', user.id, 'with role:', userRole);

      // Prune previous token for this device/browser if changed
      try {
        const previousToken = typeof localStorage !== 'undefined' ? localStorage.getItem('mauze_previous_fcm_token') : null;
        if (previousToken && previousToken !== token) {
          await supabase
            .from('user_fcm_tokens')
            .delete()
            .eq('fcm_token', previousToken);
          console.log('[FCM] Pruned old stale token from database');
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('mauze_previous_fcm_token', token);
        }
      } catch (pruneErr) {
        console.warn('[FCM] Note on pruning previous token:', pruneErr);
      }

      const devInfo = getDeviceInfo();
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: isNativeAndroid() ? 'Android Native App' : (devInfo.isIOS ? (devInfo.isStandalone ? 'iOS PWA' : 'iOS Web') : (navigator.platform || 'web')),
        deviceType: this.isNative ? 'native' : (devInfo.isStandalone ? 'pwa' : 'web'),
        isNative: this.isNative,
        isIOS: devInfo.isIOS,
        isStandalone: devInfo.isStandalone,
        timestamp: new Date().toISOString()
      };

      // 1. Primary write: client-side Firestore upsert
      const { error } = await supabase
        .from('user_fcm_tokens')
        .upsert({
          user_id: user.id,
          email: normEmail,
          user_role: userRole || 'parents',
          fcm_token: token,
          device_info: deviceInfo,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,fcm_token'
        });

      // 2. Secondary backup: Vercel serverless Admin SDK store-token
      try {
        const endpoints = [
          "https://mouze-tahfeez-atfal.vercel.app/api/send-fcm",
        ];
        if (typeof window !== "undefined" && window.location?.origin && !window.location.origin.includes("localhost") && !window.location.origin.startsWith("capacitor://")) {
          endpoints.unshift(`${window.location.origin}/api/send-fcm`);
        }
        for (const ep of endpoints) {
          try {
            await fetch(ep, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "store-token",
                token,
                userId: user.id,
                email: normEmail,
                role: userRole || 'parents',
                deviceInfo
              })
            });
            break;
          } catch (_) {}
        }
      } catch (_) {}

      if (error) {
        console.warn('[FCM] Primary token upsert note:', error.message);
        return false;
      } else {
        console.log('[FCM] Token stored successfully for user:', user.id);
        return true;
      }
    } catch (error) {
      console.error('[FCM] Error in storeToken:', error);
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
        icon: '/LOGO ATFAAL-192.png',
        badge: '/LOGO ATFAAL-192.png',
        vibrate: [200, 100, 200],
        data: {
          ...data,
          url: data?.url || payload.fcmOptions?.link || '/',
          timestamp: new Date().toISOString()
        },
        tag: notifId,
        renotify: false,
        requireInteraction: true,
        silent: false,
        dir: 'ltr',
        lang: 'en-US',
        actions: [
          {
            action: 'open',
            title: 'Open Portal',
            icon: '/LOGO ATFAAL-192.png'
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
      const redirectPage = data?.redirectPage || data?.redirect_page || '';
      const leaveId = data?.leaveId || data?.leave_id || '';
      const studentId = data?.studentId || data?.student_id || '';
      const params = [];
      if (redirectPage) params.push('redirectPage=' + encodeURIComponent(redirectPage));
      if (leaveId) params.push('leaveId=' + encodeURIComponent(leaveId));
      if (studentId) params.push('studentId=' + encodeURIComponent(studentId));
      const url = params.length ? '/?' + params.join('&') : '/';
      console.log('[FCM] Navigating to:', url);

      // Stash tap data for in-app state transition
      stashNotificationTap({
        ...data,
        redirectPage: redirectPage || 'Inbox',
        leaveId,
        studentId,
        url
      });

      if (window.focus && !window.document.hidden) {
        // Push state without jarring full reload if on same domain
        window.history.pushState({}, '', url);
      } else {
        const fullUrl = new URL(url, window.location.origin).href;
        window.location.href = fullUrl;
      }
    } catch (error) {
      console.error('[FCM] Error handling notification click:', error);
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

// Auto-sync token on auth state changes (e.g. login, session refresh)
if (typeof window !== "undefined") {
  try {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        const cachedToken =
          fcmService.getToken() ||
          (typeof localStorage !== "undefined"
            ? localStorage.getItem("mauze_current_fcm_token")
            : null);
        if (cachedToken && session?.user) {
          const cachedRole =
            (typeof localStorage !== "undefined"
              ? localStorage.getItem("portal_role") ||
                localStorage.getItem("mauze_user_role")
              : null) || "parents";
          console.log("[FCM] Auth state change:", event, "— syncing token to database");
          await fcmService.storeToken(cachedToken, cachedRole);
        }
      }
    });
  } catch (authListenerErr) {
    console.warn("[FCM] Note on auth state listener:", authListenerErr);
  }
}

export default fcmService;
