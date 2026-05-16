import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleAuth } from "npm:google-auth-library@9.6.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  title: string
  body: string
  targetRole?: string
  targetUser?: string
  data?: Record<string, string>
}

// Generate OAuth2 token using Service Account
async function getAccessToken(serviceAccountJson: string) {
  try {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return { token: token.token, projectId: credentials.project_id };
  } catch (error) {
    throw new Error('Failed to generate access token from Service Account: ' + error.message);
  }
}

// Send FCM using HTTP v1 API
async function sendFCMv1Notifications(tokens: string[], title: string, body: string, data?: Record<string, string>) {
  const serviceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY')
  
  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing. Please set it in Supabase secrets.')
  }

  const { token: accessToken, projectId } = await getAccessToken(serviceAccount);
  const results = [];

  // V1 API requires sending one request per token
  // We'll run them in parallel batches of 50 to avoid overwhelming the network
  const batchSize = 50;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    
    const promises = batch.map(async (token) => {
      const message = {
        message: {
          token,
          notification: {
            title,
            body,
          },
          data: {
            ...(data || {}),
            title,
            body
          },
          android: { priority: 'high' },
          apns: {
            payload: {
              aps: { sound: 'default', 'content-available': 1 }
            }
          }
        }
      };

      try {
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });

        if (!response.ok) {
          const errText = await response.text();
          return { token, success: false, error: `FCM API Error (${response.status}): ${errText}` };
        }
        
        const result = await response.json();
        return { token, success: true, name: result.name };
      } catch (err) {
        return { token, success: false, error: err.message };
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  return results;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: NotificationPayload = await req.json().catch(() => ({}));
    const { title, body, targetRole, data } = payload
    let { targetUser } = payload

    if (!title || !body) {
      throw new Error("Missing title or body in request");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (targetUser && targetUser.includes('@')) {
      const { data: userData } = await supabase
        .from('user_portal_access')
        .select('user_id')
        .ilike('email', targetUser.trim())
        .maybeSingle();
      
      if (userData?.user_id) targetUser = userData.user_id;
    }

    let tokens: string[] = []

    if (targetUser) {
      const { data: userTokens, error } = await supabase
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_id', targetUser)
      if (error) throw error
      tokens = userTokens?.map(ut => ut.fcm_token) || []
    } else if (targetRole && targetRole !== 'all') {
      const { data: roleTokens, error } = await supabase
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_role', targetRole)
      if (error) throw error
      tokens = roleTokens?.map(rt => rt.fcm_token) || []
    } else {
      const { data: allTokens, error } = await supabase
        .from('user_fcm_tokens')
        .select('fcm_token')
      if (error) throw error
      tokens = allTokens?.map(at => at.fcm_token) || []
    }

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'NO_TOKENS_FOUND', 
          details: `No active devices found for ${targetUser || targetRole || 'all users'}.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Send via FCM HTTP v1
    const fcmResults = await sendFCMv1Notifications(tokens, title, body, data)

    // Store history
    try {
      await supabase.from('system_notifications').insert({
        title,
        body,
        target_role: targetRole || 'all',
        target_user: targetUser || null,
        is_read: false
      })
    } catch (dbErr) {}

    const successCount = fcmResults.filter(r => r.success).length;
    const failureCount = fcmResults.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({ 
        success: successCount > 0, 
        message: successCount > 0 ? 'Notification process complete' : 'Notification delivery failed',
        summary: {
          total: tokens.length,
          success: successCount,
          failures: failureCount
        },
        results: fcmResults,
        debug: {
          tokenCount: tokens.length,
          targetUser,
          targetRole
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message, details: "Check Edge Function logs" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
