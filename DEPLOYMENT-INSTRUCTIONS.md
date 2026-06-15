# FCM Deployment Instructions

## 🚀 Next Steps to Complete FCM Integration

### 1. Deploy Edge Function to Supabase

```bash
# From your project root
npx supabase functions deploy fcm-notification
```

### 2. Set Environment Variables in Supabase Dashboard

Go to your Supabase dashboard → Settings → Edge Functions and add these secrets:

**FCM_SERVER_KEY:**
```
Get from: Firebase Console → Project Settings → Cloud Messaging → Server Key
```

**SUPABASE_SERVICE_ROLE_KEY:**
```
Get from: Supabase Dashboard → Settings → API → service_role (found in .env.example)
```

### 3. Run Database Migration

Apply the migration to create the FCM tokens table:

```sql
-- Run this in Supabase SQL Editor
-- File: supabase/migrations/20240508000000_create_fcm_tokens.sql
```

### 4. Test the Integration

#### Test FCM Token Generation:
1. Open your app in browser
2. Login as any user
3. Check browser console for "FCM Token:" message
4. Verify token appears in `user_fcm_tokens` table

#### Test Notification Sending:
1. Login as admin
2. Create an announcement or schedule
3. Check browser notifications on user devices
4. Verify notification appears in database

## 🔧 Firebase Configuration Already Applied

✅ Firebase config updated in:
- `src/firebaseConfig.js`
- `public/firebase-messaging-sw.js`
- `.env.example` (copy to `.env` for local development)

## 📱 Browser Testing

FCM supports:
- Chrome 50+ ✅
- Firefox 44+ ✅
- Safari 11.1+ ✅
- Edge 79+ ✅

## 🐛 Troubleshooting

If notifications don't work:

1. **Check browser permissions** - Ensure notifications are allowed
2. **Verify Firebase config** - Check API keys are correct
3. **Check Edge Function logs** - Supabase dashboard → Edge Functions → Logs
4. **Test token generation** - Browser console should show FCM token
5. **Verify database** - Check `user_fcm_tokens` table has entries

## 📊 Monitoring

Monitor your FCM usage:
- Firebase Console → Cloud Messaging → Usage
- Supabase Dashboard → Edge Functions → Logs
- Browser Console for debugging messages

## 🔄 Automatic Deployment

Once deployed, the system will:
- Automatically register FCM tokens on user login
- Send notifications via Edge Functions
- Handle foreground/background messages
- Store notification history in database

Your FCM integration is ready for deployment! 🎉
