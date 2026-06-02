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

interface FcmSendResult {
  token: string
  success: boolean
  status: "delivered" | "stale" | "failed"
  name?: string
  error?: string
}

interface ParsedFcmError {
  code?: number
  status?: string
  message?: string
  errorCode?: string
  raw: string
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

function parseFcmError(errText: string): ParsedFcmError {
  try {
    const parsed = JSON.parse(errText);
    const error = parsed?.error || parsed;
    const details = Array.isArray(error?.details) ? error.details : [];
    const fcmDetail = details.find((detail: { errorCode?: string }) => typeof detail?.errorCode === 'string');

    return {
      code: error?.code,
      status: error?.status,
      message: error?.message,
      errorCode: fcmDetail?.errorCode,
      raw: errText,
    };
  } catch {
    return { raw: errText };
  }
}

function isStaleTokenError(responseStatus: number, parsedError: ParsedFcmError) {
  const haystack = [
    String(responseStatus),
    parsedError.code,
    parsedError.status,
    parsedError.message,
    parsedError.errorCode,
    parsedError.raw,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    haystack.includes('unregistered') ||
    haystack.includes('notregistered') ||
    haystack.includes('registration-token-not-registered') ||
    (responseStatus === 404 && haystack.includes('requested entity was not found'))
  );
}

function getSiteUrl() {
  return (
    Deno.env.get('PUBLIC_SITE_URL') ||
    Deno.env.get('SITE_URL') ||
    Deno.env.get('VERCEL_PROJECT_PRODUCTION_URL') ||
    'https://mouze-tahfeez-atfal-mu.vercel.app'
  ).replace(/\/+$/, '');
}

function getNotificationUrl(data?: Record<string, string>) {
  const siteUrl = getSiteUrl();
  const rawUrl = data?.url || data?.link || '/';

  try {
    return new URL(rawUrl, `${siteUrl}/`).toString();
  } catch {
    return `${siteUrl}/`;
  }
}

async function pruneInvalidTokens(supabase: ReturnType<typeof createClient>, tokens: string[]) {
  const uniqueTokens = [...new Set(tokens)];
  if (uniqueTokens.length === 0) return 0;

  const batchSize = 100;
  let deletedCount = 0;

  for (let i = 0; i < uniqueTokens.length; i += batchSize) {
    const batch = uniqueTokens.slice(i, i + batchSize);
    const { error } = await supabase
      .from('user_fcm_tokens')
      .delete()
      .in('fcm_token', batch);

    if (error) {
      console.warn('Failed to prune stale FCM tokens:', error);
      continue;
    }

    deletedCount += batch.length;
  }

  return deletedCount;
}

// Send FCM using HTTP v1 API
async function sendFCMv1Notifications(tokens: string[], title: string, body: string, data?: Record<string, string>) {
  const serviceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY')
  
  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing. Please set it in Supabase secrets.')
  }

  const { token: accessToken, projectId } = await getAccessToken(serviceAccount);
  const results: FcmSendResult[] = [];
  const staleTokens: string[] = [];
  const notificationUrl = getNotificationUrl(data);
  const messageData = {
    ...(data || {}),
    title,
    body,
    url: notificationUrl,
  };

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
          data: messageData,
          webpush: {
            headers: {
              Urgency: 'high',
            },
            notification: {
              title,
              body,
              icon: '/logo.png',
              badge: '/logo.png',
              tag: 'mauze-tahfeez-notification',
              renotify: true,
              requireInteraction: true,
              data: messageData,
              actions: [
                { action: 'open', title: 'Open Portal' },
                { action: 'dismiss', title: 'Dismiss' },
              ],
            },
            fcm_options: {
              link: notificationUrl,
            },
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channel_id: 'mauze-tahfeez-notifications',
            },
          },
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
          const parsedError = parseFcmError(errText);
          const stale = isStaleTokenError(response.status, parsedError);

          if (stale) {
            staleTokens.push(token);
            return {
              token,
              success: false,
              status: 'stale',
              error: `FCM token is no longer registered (${response.status}).`,
            };
          }

          return { token, success: false, status: 'failed', error: `FCM API Error (${response.status}): ${errText}` };
        }
        
        const result = await response.json().catch(() => ({}));
        return { token, success: true, status: 'delivered', name: result?.name };
      } catch (err) {
        return { token, success: false, status: 'failed', error: err.message };
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  return { results, staleTokens };
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
    const { results: fcmResults, staleTokens } = await sendFCMv1Notifications(tokens, title, body, data)

    const staleTokensRemoved = await pruneInvalidTokens(supabase, staleTokens)

    const deliveredCount = fcmResults.filter(r => r.status === 'delivered').length;
    const staleCount = fcmResults.filter(r => r.status === 'stale').length;
    const failureCount = fcmResults.filter(r => r.status === 'failed').length;

    return new Response(
      JSON.stringify({ 
        success: failureCount === 0,
        message: deliveredCount > 0
          ? 'Notification process complete'
          : staleCount > 0 && failureCount === 0
            ? 'No active tokens were available; stale tokens were cleaned up'
            : 'Notification delivery failed',
        summary: {
          total: tokens.length,
          delivered: deliveredCount,
          stale: staleCount,
          failures: failureCount,
          staleTokensRemoved
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
