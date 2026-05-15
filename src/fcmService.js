import { getFCMToken, onMessageListener } from './firebaseConfig.js';
import { supabase } from './supabaseClient.js';

class FCMService {
  constructor() {
    this.isSupported = false;
    this.token = null;
    this.initialized = false;
  }

  // Initialize FCM service
  async initialize(userRole) {
    if (this.initialized && this.token) {
      console.log('FCM service already initialized');
      return true;
    }
    
    try {
      console.log('Initializing FCM service for role:', userRole);
      
      // Check if FCM is supported
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

      // Store token in database
      console.log('Storing FCM token in database...');
      await this.storeToken(token, userRole);

      // Set up message listener
      this.setupMessageListener();

      this.initialized = true;
      console.log('FCM service initialized successfully for role:', userRole);
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
    }
  }

  // Store FCM token in database
  async storeToken(token, userRole) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found - cannot store FCM token');
        return false;
      }

      console.log('Storing token for user:', user.id, 'with role:', userRole);

      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timestamp: new Date().toISOString()
      };

      // Upsert token (update if exists, insert if new)
      const { error, data } = await supabase
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

  // Set up message listener for foreground messages
  setupMessageListener() {
    onMessageListener((payload) => {
      console.log('Processing foreground message in fcmService');
      this.showNotification(payload);
    });
  }

  // Show notification
  showNotification(payload) {
    try {
      console.log('Showing notification:', payload);
      const { notification, data } = payload;
      
      // Create notification options with official styling
      const options = {
        body: notification?.body || 'New notification from Mauze Tahfeez',
        icon: '/logo.png',
        badge: '/logo.png',
        image: notification?.image || null,
        vibrate: [200, 100, 200],
        data: {
          ...data,
          url: data?.url || '/',
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

      // Create and show notification
      if ('serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype) {
        // Use service worker if available
        navigator.serviceWorker.ready.then((registration) => {
          console.log('Using service worker to show notification');
          registration.showNotification(notification?.title || 'Mauze Tahfeez Update', options);
        }).catch((error) => {
          console.error('Service worker notification failed:', error);
          // Fallback to browser notification
          this.showBrowserNotification(notification?.title || 'Mauze Tahfeez Update', options, data);
        });
      } else {
        // Fallback to browser notification
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

  // Handle notification click
  handleNotificationClick(data) {
    try {
      const url = data?.url || data?.redirectPage || '/';
      console.log('Navigating to:', url);
      
      // Try to focus existing window first, then open new one
      if (window.focus && !window.document.hidden) {
        // Window is already focused, navigate within it
        window.location.href = url;
      } else {
        // Open new window or focus existing one
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
      // Fallback to simple navigation
      window.location.href = data?.url || data?.redirectPage || '/';
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

      this.token = null;
      this.initialized = false;
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
