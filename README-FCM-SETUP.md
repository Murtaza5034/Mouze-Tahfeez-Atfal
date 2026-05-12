# FCM Integration Setup Guide

This guide explains how to set up Firebase Cloud Messaging (FCM) with Supabase Edge Functions for push notifications in your Mauze Tahfeez application.

## 🚀 Overview

The FCM integration consists of:
- Firebase Cloud Messaging for push notifications
- Supabase Edge Function as the notification gateway
- Frontend service for managing FCM tokens and receiving messages
- Admin notification system that sends notifications to users

## 📋 Prerequisites

1. **Firebase Project**
   - Create a new Firebase project at https://console.firebase.google.com
   - Enable Cloud Messaging API
   - Get your Firebase configuration keys

2. **Supabase Project**
   - Ensure your Supabase project is set up
   - Have Edge Functions enabled

## 🔧 Setup Instructions

### 1. Firebase Configuration

1. Go to Firebase Console → Project Settings → General
2. Copy your Firebase configuration:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID",
     measurementId: "YOUR_MEASUREMENT_ID"
   };
   ```

3. Go to Project Settings → Cloud Messaging
4. Generate a new Web Push certificate (VAPID key)
5. Copy the Server Key (FCM_SERVER_KEY)

### 2. Environment Variables

Create a `.env` file in your project root:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Supabase Edge Function Environment

In your Supabase dashboard, set these environment variables:

1. Go to Settings → Edge Functions
2. Add the following secrets:
   ```
   FCM_SERVER_KEY=your_fcm_server_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

### 4. Database Migration

Run the migration to create the FCM tokens table:

```sql
-- This file is located at: supabase/migrations/20240508000000_create_fcm_tokens.sql
-- Apply it via Supabase dashboard or CLI
```

### 5. Update Firebase Configuration Files

1. Update `src/firebaseConfig.js` with your Firebase config
2. Update `public/firebase-messaging-sw.js` with your Firebase config

## 🎯 How It Works

### 1. User Registration
- When a user logs in, the app requests notification permission
- FCM generates a unique token for the user's device
- The token is stored in the `user_fcm_tokens` table

### 2. Sending Notifications
- Admin creates a notification via the admin panel
- The `broadcastNotification` function calls the Supabase Edge Function
- Edge Function retrieves target user tokens from the database
- Edge Function sends notifications via FCM API

### 3. Receiving Notifications
- Service worker handles background messages
- App handles foreground messages
- Notifications are displayed with proper styling and actions

## 🧪 Testing

### 1. Test FCM Token Generation
```javascript
// In browser console
import fcmService from './src/fcmService.js';
await fcmService.initialize('parents');
console.log('FCM Token:', fcmService.getToken());
```

### 2. Test Edge Function
```bash
curl -X POST https://your-project.supabase.co/functions/v1/fcm-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test message",
    "targetRole": "all"
  }'
```

### 3. Test Admin Notification
1. Log in as admin
2. Create an announcement or schedule
3. Check browser notifications on user devices

## 🔍 Troubleshooting

### Common Issues

1. **Permission Denied**
   - Ensure user has granted notification permission
   - Check browser settings for notifications

2. **FCM Token Not Generated**
   - Verify Firebase configuration
   - Check VAPID key is correctly set
   - Ensure service worker is registered

3. **Edge Function Not Working**
   - Verify environment variables in Supabase dashboard
   - Check Edge Function logs
   - Ensure FCM server key is valid

4. **Notifications Not Received**
   - Check browser is in foreground/background
   - Verify service worker is active
   - Check FCM quota limits

### Debug Logs

Enable debug logging in browser:
```javascript
// In browser console
localStorage.setItem('debug', 'true');
```

## 📱 Browser Support

FCM supports:
- Chrome 50+
- Firefox 44+
- Safari 11.1+
- Edge 79+

## 🚀 Deployment

1. Deploy Edge Functions:
   ```bash
   supabase functions deploy fcm-notification
   ```

2. Update environment variables in production
3. Test notifications in production environment

## 📚 Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Web Push API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

## 🤝 Support

For issues with the FCM integration:
1. Check browser console for errors
2. Review Supabase Edge Function logs
3. Verify Firebase configuration
4. Test with different browsers and devices
