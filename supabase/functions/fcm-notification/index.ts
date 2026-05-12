<<<<<<< HEAD
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '600',
}

serve(async (req: Request) => {
  // 1. Instant Handshake
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    console.log('FCM Notification Edge Function called');
    
    const projectID = Deno.env.get('FIREBASE_PROJECT_ID') || '';
    const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '';
    
    if (!projectID || !serviceAccountStr) {
      console.error('Missing Firebase configuration');
      return new Response(JSON.stringify({ error: "MISSING_SECRETS", hint: "Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT in Supabase Secrets." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const payload = await req.json().catch(() => ({}));
    console.log('Received payload:', JSON.stringify(payload));
    
    const { 
      title = "Mauze Tahfeez Alert", 
      body = "You have a new update in your portal.", 
      targetRole = 'all', 
      targetUser = null, 
      data = {} 
    } = payload;

    const serviceAccount = JSON.parse(serviceAccountStr);
    const clientEmail = serviceAccount.client_email;
    const privateKey = serviceAccount.private_key;

    if (!clientEmail || !privateKey) {
      throw new Error("INVALID_SERVICE_ACCOUNT: Missing client_email or private_key in JSON.");
    }

    // 2. Fetch target tokens (Manual Fetch to avoid library bugs)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    console.log('Fetching tokens for:', { targetUser, targetRole });
    
    let tokenUrl = `${supabaseUrl}/rest/v1/user_fcm_tokens?select=fcm_token`;
    if (targetUser) {
      tokenUrl += `&user_id=eq.${targetUser}`;
    } else if (targetRole && targetRole !== 'all') {
      tokenUrl += `&user_role=eq.${targetRole}`;
    }

    console.log('Token URL:', tokenUrl);

    const tokenRes = await fetch(tokenUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!tokenRes.ok) {
      console.error('Token fetch failed:', tokenRes.status, tokenRes.statusText);
      throw new Error(`TOKEN_FETCH_FAILED: ${tokenRes.status} ${tokenRes.statusText}`);
    }

    const tokens = await tokenRes.json();
    console.log('Found tokens:', tokens.length);
    
    if (!Array.isArray(tokens)) {
      throw new Error(`DATABASE_RESPONSE_ERROR: Expected array, got ${typeof tokens}`);
    }

    if (!tokens || tokens.length === 0) {
      console.log('No tokens found for the specified criteria');
      return new Response(JSON.stringify({ success: true, message: "NO_TOKENS_FOUND", criteria: { targetUser, targetRole } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Auth with Google
    const jwt = await create({ alg: "RS256", typ: "JWT" }, {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(3600),
      iat: getNumericDate(0),
    }, privateKey);

    const googleAuthRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    });

    const tokenData = await googleAuthRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error("GOOGLE_AUTH_FAILED: " + JSON.stringify(tokenData));

    // Send notifications
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectID}/messages:send`;
    console.log('Sending notifications to', tokens.length, 'devices');
    
    const results = await Promise.all(tokens.map(async (t) => {
      try {
        const messagePayload = {
          message: {
            token: t.fcm_token,
            notification: { title, body },
            data: data || {},
            android: { priority: "high" },
            webpush: {
              headers: { Urgency: "high" },
              fcm_options: {
                link: data.redirectPage ? `https://mouze-tahfeez-atfal-mu.vercel.app/${data.redirectPage}` : "https://mouze-tahfeez-atfal-mu.vercel.app"
              },
              notification: { 
                requireInteraction: true, 
                icon: "https://mouze-tahfeez-atfal-mu.vercel.app/logo.png",
                badge: "https://mouze-tahfeez-atfal-mu.vercel.app/logo.png"
              }
            }
          }
        };

        const res = await fetch(fcmUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(messagePayload),
        });

        const result = await res.json();
        console.log('FCM response for token:', t.fcm_token.substring(0, 10) + '...', result);
        
        if (!res.ok) {
          console.error('FCM send failed:', result);
        }
        
        return { token: t.fcm_token.substring(0, 10) + '...', success: res.ok, result };
      } catch (err) {
        console.error('Error sending notification:', err);
        return { token: t.fcm_token.substring(0, 10) + '...', error: err.message };
      }
    }));

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    console.log(`Notification sending complete: ${successCount} success, ${failureCount} failures`);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      summary: {
        total: results.length,
        success: successCount,
        failures: failureCount
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
})

async function getGoogleAccessToken(serviceAccount: any) {
  const jwt = await create({ alg: "RS256", typ: "JWT" }, {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: getNumericDate(3600),
    iat: getNumericDate(0),
  }, serviceAccount.private_key)

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })

  const data = await response.json()
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data))
  return data.access_token
}

async function sendV1Notification(token: string, title: string, body: string, data: any, accessToken: string, projectID: string) {
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectID}/messages:send`
  
  const message = {
    message: {
      token: token,
      notification: {
        title: title,
        body: body
      },
      data: data || {},
      android: {
        priority: "high",
      },
      webpush: {
        headers: {
          Urgency: "high"
        },
        fcm_options: {
          link: "https://mouze-tahfeez-atfal-mu.vercel.app"
        },
        notification: {
          requireInteraction: true,
          icon: "https://mouze-tahfeez-atfal-mu.vercel.app/logo.png",
          badge: "https://mouze-tahfeez-atfal-mu.vercel.app/logo.png"
        }
      }
    }
  }

  try {
    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })
    return response.json()
  } catch (err: any) {
    return { error: err.message }
  }
=======
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FCMMessage {
  notification: {
    title: string
    body: string
  }
  data?: Record<string, string>
  token?: string
  topic?: string
}

interface NotificationPayload {
  title: string
  body: string
  targetRole?: string
  targetUser?: string
  data?: Record<string, string>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title, body, targetRole, targetUser, data }: NotificationPayload = await req.json()

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get FCM tokens for target users
    let tokens: string[] = []

    if (targetUser) {
      // Send to specific user
      const { data: userTokens, error } = await supabase
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_id', targetUser)
      
      if (error) throw error
      tokens = userTokens?.map(ut => ut.fcm_token) || []
    } else if (targetRole && targetRole !== 'all') {
      // Send to all users with specific role
      const { data: roleTokens, error } = await supabase
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_role', targetRole)
      
      if (error) throw error
      tokens = roleTokens?.map(rt => rt.fcm_token) || []
    } else {
      // Send to all users
      const { data: allTokens, error } = await supabase
        .from('user_fcm_tokens')
        .select('fcm_token')
      
      if (error) throw error
      tokens = allTokens?.map(at => at.fcm_token) || []
    }

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No target tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send FCM notifications
    const fcmResults = await sendFCMNotifications(tokens, title, body, data)

    // Store notification in database
    await supabase.from('system_notifications').insert({
      title,
      body,
      target_role: targetRole || 'all',
      target_user: targetUser || null,
      fcm_sent: true,
      fcm_results: fcmResults
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notification sent successfully',
        results: fcmResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in FCM notification function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function sendFCMNotifications(tokens: string[], title: string, body: string, data?: Record<string, string>) {
  const fcmServerKey = Deno.env.get('FCM_SERVER_KEY')
  if (!fcmServerKey) {
    throw new Error('FCM_SERVER_KEY environment variable not set')
  }

  const results = []

  // Process tokens in batches (FCM supports up to 500 tokens per request)
  const batchSize = 500
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize)
    
    const message: FCMMessage = {
      notification: {
        title,
        body
      },
      data: data || {}
    }

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${fcmServerKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...message,
        registration_ids: batch
      })
    })

    const result = await response.json()
    results.push({
      batch: Math.floor(i / batchSize) + 1,
      tokensCount: batch.length,
      success: result.success,
      failure: result.failure,
      results: result.results
    })
  }

  return results
>>>>>>> 4e498234202aaef9ed99f8957424ad6b7291c210
}
