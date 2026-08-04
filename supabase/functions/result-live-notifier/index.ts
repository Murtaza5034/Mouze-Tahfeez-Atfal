import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleAuth } from "npm:google-auth-library@9.6.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function getNotificationUrl(redirectPage?: string) {
  const siteUrl = getSiteUrl();
  try { return new URL(redirectPage ? `/?redirectPage=${encodeURIComponent(redirectPage)}` : '/', `${siteUrl}/`).toString(); }
  catch { return `${siteUrl}/`; }
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

async function sendFCMv1(
  token: string,
  title: string,
  body: string,
  accessToken: string,
  projectId: string,
  notificationUrl: string,
  tag: string,
  notificationId: string,
  redirectPage: string,
): Promise<FcmSendResult> {
  const messageData = { title, body, url: notificationUrl, redirectPage, notification_id: notificationId };
  const message = {
    message: {
      token,
      notification: { title, body },
      data: messageData,
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          title, body,
          icon: '/LOGO ATFAAL.png', badge: '/LOGO ATFAAL.png',
          tag, renotify: true, requireInteraction: true,
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

// Parallel batch send for a list of (token, child-specific) payloads.
// Each child gets its own unique tag so multiple notifications coexist.
async function sendBatch(
  jobs: Array<{ token: string; title: string; body: string; tag: string; notificationId: string; redirectPage: string }>,
  accessToken: string,
  projectId: string,
) {
  const results: FcmSendResult[] = [];
  const staleTokens: string[] = [];
  const batchSize = 50;
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    const promises = batch.map(async (job) => {
      const notificationUrl = getNotificationUrl(job.redirectPage);
      const result = await sendFCMv1(
        job.token, job.title, job.body,
        accessToken, projectId, notificationUrl,
        job.tag, job.notificationId, job.redirectPage,
      );
      if (result.status === 'stale') staleTokens.push(job.token);
      return result;
    });
    results.push(...await Promise.all(promises));
  }
  return { results, staleTokens };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const manual = body?.manual === true;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsErr } = await supabase
      .from('report_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (settingsErr) throw settingsErr;
    if (!settings) {
      return new Response(JSON.stringify({ success: true, message: 'NO_SETTINGS', skipped: 'NO_SETTINGS' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const skipped = (reason: string, extra: Record<string, unknown> = {}) =>
      new Response(JSON.stringify({ success: true, message: `SKIPPED: ${reason}`, skipped: reason, ...extra }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

    // Master toggle
    if (settings.result_live_notify_enabled !== true) {
      return skipped('NOTIFY_DISABLED');
    }

    // Must be in Live mode
    if (settings.reports_live === false) {
      return skipped('NOT_LIVE');
    }

    const now = Date.now();
    const liveAt = settings.live_at ? new Date(settings.live_at).getTime() : null;
    const lastNotifiedAt = settings.result_live_last_notified_at ? new Date(settings.result_live_last_notified_at).getTime() : null;

    if (manual) {
      // Manual "Send Notify": only when results are actually visible right now
      if (liveAt && liveAt > now) {
        return skipped('NOT_YET_LIVE', { liveAt: settings.live_at });
      }
    } else {
      // Scheduled auto-fire: only for a scheduled live time that has arrived,
      // and never twice for the same schedule.
      if (!liveAt) {
        return skipped('NO_SCHEDULE');
      }
      if (liveAt > now) {
        return skipped('NOT_YET', { liveAt: settings.live_at });
      }
      if (lastNotifiedAt && lastNotifiedAt >= liveAt) {
        return skipped('ALREADY_NOTIFIED', { lastNotifiedAt: settings.result_live_last_notified_at });
      }
    }

    // ------------------------------------------------------------
    // Build per-child parent notifications
    // ------------------------------------------------------------
    const { data: children, error: childrenErr } = await supabase
      .from('child_profiles')
      .select('student_id, full_name, parent_user_id, parent_email');
    if (childrenErr) throw childrenErr;

    // Resolve parent emails to user_ids for children not linked by user_id
    const childrenNeedingEmailLookup = (children || []).filter(c => !c.parent_user_id && c.parent_email);
    const emailToUserId = new Map<string, string>();
    if (childrenNeedingEmailLookup.length > 0) {
      const { data: accessRows } = await supabase
        .from('user_portal_access')
        .select('user_id, email')
        .ilike('email', '%@%');
      (accessRows || []).forEach((row) => {
        if (row?.email && row?.user_id) emailToUserId.set(String(row.email).trim().toLowerCase(), String(row.user_id));
      });
    }

    const childJobs: Array<{
      userId: string
      name: string
      studentId: string
      title: string
      body: string
      tag: string
      notificationId: string
      redirectPage: string
    }> = [];

    (children || []).forEach((child) => {
      const name = String(child.full_name || 'Student').trim();
      const userId = child.parent_user_id || (child.parent_email ? emailToUserId.get(String(child.parent_email).trim().toLowerCase()) : null);
      if (!userId) return; // no linked parent account — cannot target
      const childKey = String(child.student_id || 'student') + '-' + now;
      childJobs.push({
        userId: String(userId),
        name,
        studentId: String(child.student_id || ''),
        title: `${name}'s Result is Live!`,
        body: `His/Her Tahfeez result is now live in the parent portal. Check the Progress page to view the latest report.`,
        tag: `result-live-${childKey}`,
        notificationId: `result-live-${childKey}`,
        redirectPage: 'Progress',
      });
    });

    // ------------------------------------------------------------
    // FCM setup
    // ------------------------------------------------------------
    const serviceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing.');
    }
    const { token: accessToken, projectId } = await getAccessToken(serviceAccount);

    // ------------------------------------------------------------
    // Parents: fetch tokens per user, send per-child notifications
    // ------------------------------------------------------------
    const parentUserIds = [...new Set(childJobs.map(j => j.userId))];
    const parentTokensByUser = new Map<string, string[]>();
    for (let i = 0; i < parentUserIds.length; i += 50) {
      const batch = parentUserIds.slice(i, i + 50);
      const { data: userTokens } = await supabase
        .from('user_fcm_tokens')
        .select('user_id, fcm_token')
        .in('user_id', batch);
      (userTokens || []).forEach((row) => {
        const list = parentTokensByUser.get(row.user_id) || [];
        list.push(row.fcm_token);
        parentTokensByUser.set(row.user_id, list);
      });
    }

    const parentFcmJobs: Array<{ token: string; title: string; body: string; tag: string; notificationId: string; redirectPage: string }> = [];
    childJobs.forEach((job) => {
      const tokens = parentTokensByUser.get(job.userId) || [];
      tokens.forEach((token) => parentFcmJobs.push({ token, title: job.title, body: job.body, tag: job.tag, notificationId: job.notificationId, redirectPage: job.redirectPage }));
    });

    // Inbox: one notification per child (target_user = parent's user id)
    const parentInboxRows = childJobs.map((job) => ({
      title: job.title,
      body: job.body,
      target_role: 'parents',
      target_user: job.userId,
      redirect_page: 'Progress',
    }));

    // ------------------------------------------------------------
    // Teachers: per-child notifications to the specific teacher
    // assigned to that child (not a broadcast to all teachers).
    // Scenario 4 — Teacher and Parent both get notified at once.
    // ------------------------------------------------------------
    const { data: teacherProfiles } = await supabase
      .from('teacher_profiles')
      .select('id, user_id, full_name');

    // Map teacher id/user_id (as text) → teacher auth user_id + name
    const teacherUserByKey = new Map<string, { userId: string; name: string }>();
    (teacherProfiles || []).forEach((t) => {
      const meta = { userId: String(t.user_id), name: String(t.full_name || 'Teacher') };
      if (t.id) teacherUserByKey.set(String(t.id).trim().toLowerCase(), meta);
      if (t.user_id) teacherUserByKey.set(String(t.user_id).trim().toLowerCase(), meta);
    });

    // Resolve each child's teacher (teacher_id or original_teacher_id)
    const { data: childTeacherMeta } = await supabase
      .from('child_profiles')
      .select('student_id, teacher_id, original_teacher_id, badal_teacher_id');
    const childTeacherMap = new Map<string, string>(); // student_id → teacher user_id
    (childTeacherMeta || []).forEach((c) => {
      const keys = [c.teacher_id, c.original_teacher_id, c.badal_teacher_id]
        .filter(Boolean)
        .map((k) => String(k).trim().toLowerCase());
      for (const key of keys) {
        const meta = teacherUserByKey.get(key);
        if (meta) { childTeacherMap.set(String(c.student_id).trim().toLowerCase(), meta.userId); break; }
      }
    });

    const teacherJobs: Array<{
      userId: string
      studentName: string
      title: string
      body: string
      tag: string
      notificationId: string
      redirectPage: string
    }> = [];
    const involvedTeacherIds = new Set<string>();

    childJobs.forEach((job) => {
      const teacherUserId = childTeacherMap.get(String(job.studentId).trim().toLowerCase());
      if (!teacherUserId) return;
      involvedTeacherIds.add(teacherUserId);
      teacherJobs.push({
        userId: teacherUserId,
        studentName: job.name,
        title: `📢 ${job.name}'s Result is Live!`,
        body: `The result of your student ${job.name} is now live in the teacher portal. Check the My Group page to review the latest report.`,
        tag: `result-live-teacher-${job.studentId}-${now}`,
        notificationId: `result-live-teacher-${job.studentId}-${now}`,
        redirectPage: 'My Group',
      });
    });

    // Fetch FCM tokens for the involved teachers only
    const involvedTeacherIdsArr = [...involvedTeacherIds];
    const teacherTokensByUser = new Map<string, string[]>();
    for (let i = 0; i < involvedTeacherIdsArr.length; i += 50) {
      const batch = involvedTeacherIdsArr.slice(i, i + 50);
      const { data: tTokens } = await supabase
        .from('user_fcm_tokens')
        .select('user_id, fcm_token')
        .in('user_id', batch);
      (tTokens || []).forEach((row) => {
        const list = teacherTokensByUser.get(row.user_id) || [];
        list.push(row.fcm_token);
        teacherTokensByUser.set(row.user_id, list);
      });
    }

    const teacherFcmJobs: Array<{ token: string; title: string; body: string; tag: string; notificationId: string; redirectPage: string }> = [];
    teacherJobs.forEach((j) => {
      const tokens = teacherTokensByUser.get(j.userId) || [];
      tokens.forEach((token) => teacherFcmJobs.push({ token, title: j.title, body: j.body, tag: j.tag, notificationId: j.notificationId, redirectPage: j.redirectPage }));
    });

    // Inbox: one notification per involved teacher per child
    const teacherInboxRows = teacherJobs.map((j) => ({
      title: j.title,
      body: j.body,
      target_role: 'teacher',
      target_user: j.userId,
      redirect_page: 'My Group',
    }));

    // ------------------------------------------------------------
    // Send everything
    // ------------------------------------------------------------
    const allJobs = [...parentFcmJobs, ...teacherFcmJobs];
    let deliveredCount = 0;
    let failureCount = 0;
    const staleTokens: string[] = [];

    if (allJobs.length > 0) {
      const { results, staleTokens: stale } = await sendBatch(allJobs, accessToken, projectId);
      deliveredCount = results.filter(r => r.status === 'delivered').length;
      failureCount = results.filter(r => r.status === 'failed').length;
      staleTokens.push(...stale);
    }

    // Inbox inserts (best-effort)
    const inboxRows = [...parentInboxRows, ...teacherInboxRows];
    let inboxError = null;
    if (inboxRows.length > 0) {
      const { error } = await supabase.from('system_notifications').insert(inboxRows);
      if (error) inboxError = error.message;
    }

    // Clean up stale tokens
    await pruneInvalidTokens(supabase, staleTokens);

    // Mark as notified (dedup for scheduled auto-fire)
    const { error: updateErr } = await supabase
      .from('report_settings')
      .update({ result_live_last_notified_at: new Date().toISOString() })
      .eq('id', 1);
    if (updateErr) console.warn('Failed to update result_live_last_notified_at:', updateErr.message);

    return new Response(
      JSON.stringify({
        success: true,
        message: deliveredCount > 0 ? 'Result-live notifications sent' : 'Result-live notifications processed (no active tokens)',
        summary: {
          children: childJobs.length,
          parents: parentUserIds.length,
          teachers: involvedTeacherIds.size,
          teacherNotifications: teacherJobs.length,
          delivered: deliveredCount,
          failures: failureCount,
          inboxError,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, details: 'Check Edge Function logs' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
