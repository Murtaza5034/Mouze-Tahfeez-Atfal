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
  const haystack = [String(responseStatus), parsedError.code, parsedError.status, parsedError.message, parsedError.errorCode, parsedError.raw]
    .filter(Boolean).join(' ').toLowerCase();
  return haystack.includes('unregistered') || haystack.includes('notregistered') || haystack.includes('registration-token-not-registered') || (responseStatus === 404 && haystack.includes('requested entity was not found'));
}

async function sendFCMNotification(token: string, title: string, body: string, accessToken: string, projectId: string, teacherUserId: string): Promise<FcmSendResult> {
  const message = {
    message: {
      token,
      notification: { title, body },
      data: {
        title,
        body,
        url: '/',
        redirectPage: 'Attendance History',
        teacherUserId,
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          title,
          body,
          icon: '/logo.png',
          badge: '/logo.png',
          tag: 'attendance-reminder',
          renotify: true,
          requireInteraction: true,
          data: { url: '/', redirectPage: 'Attendance History', teacherUserId },
          actions: [
            { action: 'open', title: 'View Attendance' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        },
        fcm_options: { link: '/' },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channel_id: 'mauze-tahfeez-notifications',
          icon: 'ic_notification',
          color: '#26A69A',
          visibility: 'PUBLIC',
        },
      },
      apns: {
        payload: { aps: { sound: 'default', 'content-available': 1 } },
      },
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
      if (stale) {
        return { token, success: false, status: 'stale', error: `FCM token is no longer registered (${response.status}).` };
      }
      return { token, success: false, status: 'failed', error: `FCM API Error (${response.status}): ${errText}` };
    }

    const result = await response.json().catch(() => ({}));
    return { token, success: true, status: 'delivered', name: result?.name };
  } catch (err) {
    return { token, success: false, status: 'failed', error: err.message };
  }
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

    // ── Use IST for everything (reminder is scheduled in Indian Standard Time) ──
    const now = new Date();
    const istParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
      weekday: 'long',
    }).formatToParts(now);

    const getPart = (type: string) => istParts.find(p => p.type === type)!.value;
    const todayDateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    const todayHour = Number(getPart('hour'));
    const todayMinute = Number(getPart('minute'));
    const weekdayName = getPart('weekday').toLowerCase();

    const DAY_MAP: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const dayOfWeek = DAY_MAP[weekdayName] ?? now.getDay();

    console.log(`attendance-reminder: Running for ${weekdayName} (${todayDateStr}) at ${todayHour}:${todayMinute} IST`);

    // Only Mon-Sat (skip Sunday)
    if (dayOfWeek === 0) {
      console.log('attendance-reminder: Sunday — skipping');
      return new Response(
        JSON.stringify({ success: true, message: 'SUNDAY_SKIPPED', sentCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Only fire within 14 minutes AFTER 10:00 PM IST (once per day)
    const currentMinutes = todayHour * 60 + todayMinute;
    const targetMinutes = 22 * 60; // 10:00 PM
    const diff = currentMinutes - targetMinutes;

    if (diff < 0 || diff >= 14) {
      console.log(`attendance-reminder: Skipping — current ${todayHour}:${todayMinute} is ${diff < 0 ? 'before' : 'more than 14 min after'} 22:00 IST (diff ${diff} min)`);
      return new Response(
        JSON.stringify({ success: true, message: 'NOT_YET_TIME', sentCount: 0, info: `Target 22:00 IST, current ${todayHour}:${todayMinute}, diff ${diff}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ── Dedup: only send once per IST day ──
    const { data: stateRow } = await supabase
      .from('attendance_reminder_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const lastSent = stateRow?.last_sent_at;
    if (lastSent) {
      const lastSentDate = new Date(lastSent);
      const todayStart = new Date(todayDateStr + 'T00:00:00+05:30');
      if (lastSentDate >= todayStart) {
        console.log(`attendance-reminder: Already sent today (last sent: ${lastSent})`);
        return new Response(
          JSON.stringify({ success: true, message: 'ALREADY_SENT_TODAY', sentCount: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // ── Fetch today's attendance records ──
    const { data: attData, error: attErr } = await supabase
      .from('student_daily_attendance')
      .select('student_id, status')
      .eq('attendance_date', todayDateStr);

    if (attErr) {
      throw new Error(`Failed to fetch attendance: ${attErr.message}`);
    }

    const attMap = new Map<string, string>();
    (attData || []).forEach(rec => {
      attMap.set(String(rec.student_id).trim().toLowerCase(), rec.status);
    });

    // ── Fetch child profiles to map students → teachers ──
    const { data: childProfiles, error: childErr } = await supabase
      .from('child_profiles')
      .select('student_id, teacher_id, original_teacher_id');

    if (childErr) {
      throw new Error(`Failed to fetch child profiles: ${childErr.message}`);
    }

    // teacherKey (id or user_id) → set of student ids
    const teacherStudentsMap = new Map<string, Set<string>>();
    for (const cp of childProfiles || []) {
      const tid = String(cp.teacher_id || cp.original_teacher_id || '').trim().toLowerCase();
      if (!tid) continue;
      if (!teacherStudentsMap.has(tid)) teacherStudentsMap.set(tid, new Set());
      teacherStudentsMap.get(tid)!.add(String(cp.student_id).trim().toLowerCase());
    }

    // ── Fetch active teachers ──
    const { data: teachers, error: teachersErr } = await supabase
      .from('teacher_profiles')
      .select('id, user_id, full_name, is_active');

    if (teachersErr) {
      throw new Error(`Failed to fetch teachers: ${teachersErr.message}`);
    }

    const activeTeachers = (teachers || []).filter(t => t.is_active !== false && t.user_id);

    // ── FCM setup ──
    const serviceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing.');
    }
    const { token: accessToken, projectId } = await getAccessToken(serviceAccount);

    let sentCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const details: Array<{ teacherId: string; status: string; message?: string }> = [];

    for (const teacher of activeTeachers) {
      // Gather this teacher's students by matching teacher_id against id OR user_id
      const students = new Set<string>();
      const teacherKeys = [
        String(teacher.user_id || '').trim().toLowerCase(),
        String(teacher.id || '').trim().toLowerCase(),
      ];
      for (const key of teacherKeys) {
        const list = teacherStudentsMap.get(key);
        if (list) list.forEach(s => students.add(s));
      }

      if (students.size === 0) {
        skippedCount++;
        continue;
      }

      let marked = 0;
      students.forEach(sid => { if (attMap.has(sid)) marked++; });
      const total = students.size;
      const missing = total - marked;

      let title: string, body: string;
      if (marked === total) {
        title = "✅ Daily Attendance — All Marked";
        body = `Assalamu Alaykum ${teacher.full_name},\n\nOutstanding! ✅ All ${total} of your students have been marked present for today's attendance. Your diligence is truly appreciated.\n\nJazakallah Khair,\nAdministration`;
      } else if (marked > 0) {
        title = "⚠️ Daily Attendance — Some Pending";
        body = `Assalamu Alaykum ${teacher.full_name},\n\nYou have marked ${marked} out of ${total} students today. ${missing} student${missing > 1 ? 's' : ''} ${missing > 1 ? 'are' : 'is'} still pending. Kindly complete the attendance at your earliest convenience.\n\nJazakallah Khair,\nAdministration`;
      } else {
        title = "❌ Daily Attendance — Not Marked";
        body = `Assalamu Alaykum ${teacher.full_name},\n\nWe noticed that attendance for ${total} student${total > 1 ? 's' : ''} in your class has not been marked today. Please log in and mark the attendance as soon as possible.\n\nJazakallah Khair,\nAdministration`;
      }

      // Get teacher's FCM tokens
      const { data: tokens, error: tokenError } = await supabase
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_id', teacher.user_id);

      if (tokenError) {
        details.push({ teacherId: teacher.user_id, status: 'error', message: `Token lookup failed: ${tokenError.message}` });
        errorCount++;
        continue;
      }

      if (!tokens || tokens.length === 0) {
        skippedCount++;
        continue;
      }

      // Send to all teacher devices
      const staleTokens: string[] = [];
      for (const { fcm_token } of tokens) {
        const result = await sendFCMNotification(fcm_token, title, body, accessToken, projectId, teacher.user_id);
        if (result.status === 'stale') {
          staleTokens.push(fcm_token);
        }
        if (result.success) {
          sentCount++;
        } else if (result.status !== 'stale') {
          errorCount++;
        }
      }

      // Clean stale tokens
      if (staleTokens.length > 0) {
        await supabase
          .from('user_fcm_tokens')
          .delete()
          .in('fcm_token', staleTokens);
      }

      // Save inbox notification so it appears in the app's Attendance History too
      try {
        await supabase.from('system_notifications').insert([{
          title,
          body,
          target_role: 'user',
          target_user: teacher.user_id,
          redirect_page: 'Attendance History',
        }]);
      } catch (inboxErr) {
        console.warn(`attendance-reminder: Inbox insert failed for ${teacher.user_id}:`, inboxErr);
      }

      details.push({ teacherId: teacher.user_id, status: 'sent', message: `Sent to ${tokens.length} device(s)` });
    }

    // Mark as sent today (only if we actually sent something)
    if (sentCount > 0) {
      await supabase
        .from('attendance_reminder_state')
        .upsert({ id: 1, last_sent_at: new Date().toISOString() });
    }

    console.log(`attendance-reminder: Complete — sent ${sentCount}, skipped ${skippedCount}, errors ${errorCount}`);

    return new Response(
      JSON.stringify({ success: true, message: 'COMPLETE', sentCount, skippedCount, errorCount, details }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('attendance-reminder error:', error);
    return new Response(
      JSON.stringify({ error: error.message, details: 'Check Edge Function logs' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
