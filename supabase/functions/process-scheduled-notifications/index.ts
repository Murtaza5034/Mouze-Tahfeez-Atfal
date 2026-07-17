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

function parseFcmError(errText: string): ParsedFcmError {
  try {
    const parsed = JSON.parse(errText);
    const error = parsed?.error || parsed;
    const details = Array.isArray(error?.details) ? error.details : [];
    const fcmDetail = details.find((detail: { errorCode?: string }) => typeof detail?.errorCode === 'string');
    return { code: error?.code, status: error?.status, message: error?.message, errorCode: fcmDetail?.errorCode, raw: errText };
  } catch { return { raw: errText }; }
}

function isStaleTokenError(responseStatus: number, parsedError: ParsedFcmError) {
  const haystack = [String(responseStatus), parsedError.code, parsedError.status, parsedError.message, parsedError.errorCode, parsedError.raw].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes('unregistered') || haystack.includes('notregistered') || haystack.includes('registration-token-not-registered') || (responseStatus === 404 && haystack.includes('requested entity was not found'));
}

async function getAccessToken(serviceAccountJson: string) {
  try {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return { token: token.token, projectId: credentials.project_id };
  } catch (error) {
    throw new Error('Failed to generate access token from Service Account: ' + error.message);
  }
}

function getSiteUrl() {
  return (Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('SITE_URL') || Deno.env.get('VERCEL_PROJECT_PRODUCTION_URL') || 'https://mouze-tahfeez-atfal-mu.vercel.app').replace(/\/+$/, '');
}

function getNotificationUrl(data?: Record<string, string>) {
  const siteUrl = getSiteUrl();
  const rawUrl = data?.url || data?.link || '/';
  try { return new URL(rawUrl, `${siteUrl}/`).toString(); } catch { return `${siteUrl}/`; }
}

async function sendFCMNotification(token: string, title: string, body: string, accessToken: string, projectId: string, notificationUrl: string) {
  const messageData = { title, body, url: notificationUrl };
  const message = {
    message: {
      token,
      notification: { title, body },
      data: messageData,
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          title, body,
          icon: '/logo.png', badge: '/logo.png',
          tag: 'mauze-tahfeez-scheduled',
          renotify: true, requireInteraction: true,
          data: messageData,
          actions: [
            { action: 'open', title: 'Open Portal' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        },
        fcm_options: { link: notificationUrl },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default', channel_id: 'mauze-tahfeez-notifications',
          icon: 'ic_notification', color: '#26A69A', visibility: 'PUBLIC',
        },
      },
      apns: { payload: { aps: { sound: 'default', 'content-available': 1 } } },
    },
  };

  try {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errText = await response.text();
      const parsedError = parseFcmError(errText);
      const stale = isStaleTokenError(response.status, parsedError);
      if (stale) return { token, success: false, status: 'stale', error: `FCM token is no longer registered (${response.status}).` };
      return { token, success: false, status: 'failed', error: `FCM API Error (${response.status}): ${errText}` };
    }

    const result = await response.json().catch(() => ({}));
    return { token, success: true, status: 'delivered', name: result?.name };
  } catch (err) {
    return { token, success: false, status: 'failed', error: err.message };
  }
}

async function pruneInvalidTokens(supabase: ReturnType<typeof createClient>, tokens: string[]) {
  const uniqueTokens = [...new Set(tokens)];
  if (uniqueTokens.length === 0) return 0;
  let deletedCount = 0;
  for (let i = 0; i < uniqueTokens.length; i += 100) {
    const batch = uniqueTokens.slice(i, i + 100);
    const { error } = await supabase.from('user_fcm_tokens').delete().in('fcm_token', batch);
    if (error) { console.warn('Failed to prune stale FCM tokens:', error); continue; }
    deletedCount += batch.length;
  }
  return deletedCount;
}

// Calculate the next occurrence time for a scheduled notification in IST.
function calculateNextSendTime(scheduleType: string, scheduleTime: string, scheduleDay: number | null): string {
  const now = new Date();
  const [hours, minutes] = scheduleTime.split(":").map(Number);

  const getISTParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return { year: get("year"), month: get("month"), day: get("day") };
  };

  const addISTDays = ({ year, month, day }: { year: number; month: number; day: number }, days: number) => {
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  };

  const getISTWeekday = ({ year, month, day }: { year: number; month: number; day: number }) => new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const makeDateFromIST = ({ year, month, day }: { year: number; month: number; day: number }) => new Date(Date.UTC(year, month - 1, day, hours - 5, minutes - 30, 0, 0));

  let candidateParts = getISTParts(now);

  if (scheduleType === "weekly") {
    const targetDay = scheduleDay ?? 0;
    while (getISTWeekday(candidateParts) !== targetDay) {
      candidateParts = addISTDays(candidateParts, 1);
    }
  } else if (scheduleType === "monthly") {
    const targetDate = Math.min(scheduleDay ?? 1, 28);
    while (candidateParts.day !== targetDate) {
      candidateParts = addISTDays(candidateParts, 1);
    }
  }

  let candidate = makeDateFromIST(candidateParts);

  if (candidate <= now) {
    if (scheduleType === "daily") {
      candidateParts = addISTDays(candidateParts, 1);
    } else if (scheduleType === "weekly") {
      candidateParts = addISTDays(candidateParts, 7);
    } else if (scheduleType === "monthly") {
      candidateParts = addISTDays({ ...candidateParts, day: 1 }, 32);
      candidateParts = { ...candidateParts, day: Math.min(scheduleDay ?? 1, 28) };
    }
    candidate = makeDateFromIST(candidateParts);
  }

  return candidate.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch due scheduled notifications
    const { data: dueNotifs, error } = await supabase
      .from("scheduled_notifications")
      .select("*")
      .eq("is_active", true)
      .lte("next_send_at", new Date().toISOString())
      .limit(20);

    if (error) throw error;

    // Dedup: skip notifications already sent within the last 2 minutes
    // (prevents double-fire with client-side scheduler)
    const now = Date.now();
    const filteredNotifs = (dueNotifs || []).filter(n => {
      if (!n.last_sent_at) return true;
      return now - new Date(n.last_sent_at).getTime() > 120000;
    });

    if (filteredNotifs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'NO_DUE_NOTIFICATIONS', processedCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // FCM setup (only if we have notifications to send)
    const serviceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing.');
    }
    const { token: accessToken, projectId } = await getAccessToken(serviceAccount);

    let processedCount = 0;
    let errors: string[] = [];
    const staleTokensAll: string[] = [];

    for (const notif of filteredNotifs) {
      try {
        const targetRole = notif.target_role || "all";
        const targetUser = notif.target_user || null;
        const redirectPage = notif.redirect_page || "Inbox";

        // 1. Insert into system_notifications (inbox)
        const inboxPayload: Record<string, unknown> = {
          title: notif.title,
          body: notif.body,
          target_role: targetRole,
          redirect_page: redirectPage,
          file_url: notif.file_url || null,
        };
        if (targetUser) inboxPayload.target_user = targetUser;

        const { error: inboxError } = await supabase.from("system_notifications").insert([inboxPayload]);
        if (inboxError) {
          console.warn(`Inbox insert error for notification ${notif.id}: ${inboxError.message}`);
        }

        // 2. Send FCM push notification
        const notificationUrl = getNotificationUrl({ redirectPage, url: "/", link: "/" });
        let tokens: string[] = [];
        let fcmUser = targetUser;

        // Resolve email to user_id if needed
        if (fcmUser && fcmUser.includes('@')) {
          const { data: userData } = await supabase
            .from('user_portal_access')
            .select('user_id')
            .ilike('email', fcmUser.trim())
            .maybeSingle();
          if (userData?.user_id) fcmUser = userData.user_id;
        }

        if (fcmUser) {
          const { data: userTokens, error: tokenError } = await supabase
            .from('user_fcm_tokens')
            .select('fcm_token')
            .eq('user_id', fcmUser);
          if (!tokenError) tokens = userTokens?.map(ut => ut.fcm_token) || [];
        } else if (targetRole && targetRole !== 'all') {
          const { data: roleTokens, error: tokenError } = await supabase
            .from('user_fcm_tokens')
            .select('fcm_token')
            .eq('user_role', targetRole);
          if (!tokenError) tokens = roleTokens?.map(rt => rt.fcm_token) || [];
        } else if (targetRole === 'all') {
          const { data: allTokens, error: tokenError } = await supabase
            .from('user_fcm_tokens')
            .select('fcm_token');
          if (!tokenError) tokens = allTokens?.map(at => at.fcm_token) || [];
        }

        // Send FCM to all tokens
        const staleTokens: string[] = [];
        if (tokens.length > 0) {
          for (const token of tokens) {
            const result = await sendFCMNotification(token, notif.title, notif.body, accessToken, projectId, notificationUrl);
            if (result.status === 'stale') staleTokens.push(token);
          }
          staleTokensAll.push(...staleTokens);
        }

        // 3. Update schedule for next run
        const nextSend = calculateNextSendTime(
          notif.schedule_type,
          notif.schedule_time?.substring(0, 5) || "09:00",
          notif.schedule_day
        );

        await supabase
          .from("scheduled_notifications")
          .update({
            last_sent_at: new Date().toISOString(),
            next_send_at: nextSend,
            updated_at: new Date().toISOString(),
          })
          .eq("id", notif.id);

        processedCount++;
      } catch (notifErr) {
        console.error(`Error processing notification ${notif.id}:`, notifErr);
        errors.push(`Notification ${notif.id}: ${notifErr.message}`);
      }
    }

    // Clean up stale tokens
    if (staleTokensAll.length > 0) {
      await pruneInvalidTokens(supabase, staleTokensAll);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} of ${filteredNotifs.length} scheduled notifications`,
        processed: processedCount,
        total: filteredNotifs.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, details: "Check Edge Function logs" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
