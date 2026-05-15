// @ts-nocheck
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Resolve targetUser if it's an email
    if (targetUser && targetUser.includes('@')) {
      console.log('Resolving email to user_id:', targetUser);
      const { data: userData } = await supabase
        .from('user_portal_access')
        .select('user_id')
        .ilike('email', targetUser.trim())
        .maybeSingle();
      
      if (userData?.user_id) {
        console.log('Resolved email to UUID:', userData.user_id);
        targetUser = userData.user_id;
      }
    }

    console.log('Fetching tokens for:', { targetUser, targetRole })

    // 2. Get FCM tokens for target users
    let tokens: string[] = []

    if (targetUser) {
      // Send to specific user - match by user_id (UUID)
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

    console.log('Found tokens:', tokens.length)

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'NO_TOKENS_FOUND', 
          details: `No active devices found for ${targetUser || targetRole || 'all users'}.`,
          criteria: { targetUser, targetRole } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 3. Send FCM notifications using legacy API (FCM_SERVER_KEY)
    const fcmResults = await sendFCMNotifications(tokens, title, body, data)

    // 4. Store notification in database for history
    try {
      await supabase.from('system_notifications').insert({
        title,
        body,
        target_role: targetRole || 'all',
        target_user: targetUser || null,
        is_read: false
      })
    } catch (dbErr) {
      console.error('Error storing notification history:', dbErr.message);
    }

    const successCount = fcmResults.reduce((acc, curr) => acc + (curr.success || 0), 0)
    const failureCount = fcmResults.reduce((acc, curr) => acc + (curr.failure || 0), 0)

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
    console.error('Error in FCM notification function:', error)
    return new Response(
      JSON.stringify({ error: error.message, details: "Check Edge Function logs in Supabase dashboard" }),
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
  const batchSize = 500
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize)
    
    const message = {
      notification: {
        title,
        body,
        icon: '/logo.png',
        badge: '/logo.png'
      },
      data: {
        ...(data || {}),
        title,
        body
      },
      registration_ids: batch,
      priority: 'high'
    }

    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${fcmServerKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      })

      const result = await response.json()
      results.push({
        batch: Math.floor(i / batchSize) + 1,
        tokensCount: batch.length,
        success: result.success,
        failure: result.failure,
        results: result.results
      })
    } catch (fetchErr) {
      console.error('FCM fetch error:', fetchErr.message);
      results.push({ batch: Math.floor(i / batchSize) + 1, error: fetchErr.message });
    }
  }

  return results
}
