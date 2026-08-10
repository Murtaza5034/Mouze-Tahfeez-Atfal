import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const messaging = admin.messaging();

type Row = Record<string, any>;
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildIdQuery(
  collection: string,
  last: admin.firestore.DocumentSnapshot | null
): admin.firestore.Query<admin.firestore.DocumentData> {
  const base = db.collection(collection).orderBy(admin.firestore.FieldPath.documentId());
  return last ? base.startAfter(last).limit(BATCH_SIZE) : base.limit(BATCH_SIZE);
}

async function allDocs(collection: string): Promise<Array<{ id: string; data: Row }>> {
  const out: Array<{ id: string; data: Row }> = [];
  let last: admin.firestore.DocumentSnapshot | null = null;
  for (;;) {
    const q = buildIdQuery(collection, last);
    const snap = await q.get();
    if (snap.empty) break;
    snap.docs.forEach((d) => out.push({ id: d.id, data: d.data() as Row }));
    if (snap.docs.length < BATCH_SIZE) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return out;
}

function normalizeEmail(email?: string): string {
  return String(email || "").trim().toLowerCase();
}

function siteUrl(): string {
  return (
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "https://mouze-tahfeez-atfal-mu.vercel.app"
  ).replace(/\/+$/, "");
}

function notificationUrl(dataMap?: Record<string, string>, fallback = "/"): string {
  const raw = (dataMap && (dataMap.url || dataMap.link)) || fallback;
  try {
    return new URL(raw, `${siteUrl()}/`).toString();
  } catch {
    return `${siteUrl()}/`;
  }
}

async function tokensForUser(userId?: string): Promise<string[]> {
  if (!userId) return [];
  const out: string[] = [];
  const snap = await db.collection("user_fcm_tokens").where("user_id", "==", String(userId)).limit(200).get();
  snap.docs.forEach((d) => {
    const t = d.data().fcm_token;
    if (t) out.push(String(t));
  });
  return [...new Set(out)];
}

async function tokensForRole(role?: string): Promise<string[]> {
  const out: string[] = [];
  const all = await allDocs("user_fcm_tokens");
  for (const { data } of all) {
    const r = String(data.user_role || "");
    const t = data.fcm_token;
    if (!t) continue;
    if (!role || role === "all" || r === role) out.push(String(t));
  }
  return [...new Set(out)];
}

async function tokensForTarget(targetUser?: string, targetRole?: string): Promise<string[]> {
  if (targetUser) return tokensForUser(targetUser);
  return tokensForRole(targetRole);
}

async function dupeInLast30s(title: string, body: string): Promise<boolean> {
  const since = new Date(Date.now() - 30_000).toISOString();
  try {
    const snap = await db
      .collection("system_notifications")
      .where("title", "==", title)
      .where("body", "==", body)
      .where("created_at", ">=", since)
      .limit(1)
      .get();
    return !snap.empty;
  } catch {
    return false;
  }
}

async function writeInbox(doc: Row) {
  try {
    await db.collection("system_notifications").add({
      title: doc.title,
      body: doc.body,
      target_role: doc.target_role || null,
      target_user: doc.target_user || null,
      redirect_page: doc.redirect_page || "/",
      created_at: new Date().toISOString(),
      is_read: false,
    });
  } catch (e) {
    console.warn("inbox write failed", (e as Error).message);
  }
}

async function sendFcmInner(
  tokens: string[],
  title: string,
  body: string,
  dataMap: Record<string, string> = {},
  tag = "mauze-tahfeez-notification"
): Promise<{ total: number; delivered: number; stale: number; failed: number }> {
  const uniq = [...new Set(tokens.filter(Boolean))];
  if (!uniq.length) return { total: 0, delivered: 0, stale: 0, failed: 0 };
  const data: Record<string, string> = { ...dataMap, title, body, url: notificationUrl(dataMap) };
  let delivered = 0;
  let stale = 0;
  let failed = 0;

  for (let i = 0; i < uniq.length; i += 100) {
    const chunk = uniq.slice(i, i + 100);
    const messages: admin.messaging.Message[] = chunk.map((token) => ({
      token,
      notification: { title, body },
      data,
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          title,
          body,
          icon: "/logo.png",
          badge: "/logo.png",
          tag,
          renotify: true,
          requireInteraction: true,
          data: { ...data, click_action: data.url },
        },
        fcm_options: { link: data.url },
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channel_id: "mauze-tahfeez-notifications",
          icon: "ic_notification",
          color: "#26A69A",
          visibility: "public",
          click_action: "OPEN_MAUZE_TAHFEEZ",
        },
      },
      apns: { payload: { aps: { sound: "default", "content-available": 1, badge: 1 } } },
    }));
    const res = await messaging.sendEach(messages);
    res.responses.forEach((r, idx) => {
      if (r.success) {
        delivered++;
      } else {
        const code = r.error?.code || "";
        if (/not-registered|unregistered|registration-token-not-registered/i.test(code)) {
          stale++;
          db.collection("user_fcm_tokens")
            .where("fcm_token", "==", chunk[idx])
            .get()
            .then((snap) => snap.docs.forEach((d) => d.ref.delete()))
            .catch((err) => console.warn("token prune failed", (err as Error).message));
        } else {
          failed++;
        }
      }
    });
  }
  return { total: uniq.length, delivered, stale, failed };
}

// ---------------------------------------------------------------------------
// getGlobalRank
// ---------------------------------------------------------------------------

export const getGlobalRank = onCall(async (request) => {
  const input = (request.data || {}) as {
    student_id?: string;
    return_all?: boolean;
    preview?: Row;
  };

  const rows = await allDocs("weekly_results");
  const latest = new Map<string, Row>();
  for (const { data } of rows) {
    const sid = String(data.student_id || "").trim().toLowerCase();
    if (!sid || sid === "null") continue;
    const cur = String(data.week_date || "");
    const existing = latest.get(sid);
    if (!existing || (cur && String(existing.week_date || "") < cur)) latest.set(sid, data);
  }

  if (input.preview && input.student_id) {
    const sid = String(input.student_id).trim().toLowerCase();
    const p = input.preview;
    latest.set(sid, {
      ...(latest.get(sid) || {}),
      student_id: input.student_id,
      murajazah: p.murajazah ?? 0,
      juz_hali: p.juz_hali ?? 0,
      takhteet: p.takhteet ?? 0,
      jadeed: p.jadeed ?? 0,
      total_jadeed_pages: p.total_jadeed_pages ?? "",
      attendance_count: p.attendance_count ?? 0,
      total_score:
        Number(p.murajazah ?? 0) + Number(p.juz_hali ?? 0) + Number(p.takhteet ?? 0) + Number(p.jadeed ?? 0),
    });
  }

  const toNum = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const ranked = [...latest.values()]
    .map((r) => ({
      sid: String(r.student_id).trim().toLowerCase(),
      totalScore:
        r.total_score !== undefined && r.total_score !== null && r.total_score !== ""
          ? toNum(r.total_score)
          : toNum(r.murajazah) + toNum(r.juz_hali) + toNum(r.takhteet) + toNum(r.jadeed),
      jadeed: toNum(r.jadeed),
      jadeedPages: toNum(String(r.total_jadeed_pages ?? "").replace(/[^0-9.]/g, "")),
      attendance: toNum(r.attendance_count),
    }))
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.jadeed !== a.jadeed) return b.jadeed - a.jadeed;
      if (b.jadeedPages !== a.jadeedPages) return b.jadeedPages - a.jadeedPages;
      return b.attendance - a.attendance;
    });

  const ranks: Record<string, number> = {};
  let prev = 1;
  ranked.forEach((r, idx) => {
    let rank = idx + 1;
    if (idx > 0) {
      const p = ranked[idx - 1];
      if (p.totalScore === r.totalScore && p.jadeed === r.jadeed && p.jadeedPages === r.jadeedPages && p.attendance === r.attendance) {
        rank = prev;
      }
    }
    prev = rank;
    ranks[r.sid] = rank;
  });

  if (input.return_all) return { ranks, total: ranked.length };
  if (!input.student_id) throw new HttpsError("invalid-argument", "Missing required field: student_id");
  return { rank: ranks[String(input.student_id).trim().toLowerCase()] || null, total: ranked.length };
});

// ---------------------------------------------------------------------------
// sendFcm
// ---------------------------------------------------------------------------

export const sendFcm = onCall(async (request) => {
  const input = (request.data || {}) as {
    title?: string;
    body?: string;
    targetRole?: string;
    targetUser?: string;
    data?: Record<string, string>;
  };
  const title = String(input.title || "");
  const body = String(input.body || "");
  if (!title || !body) throw new HttpsError("invalid-argument", "Missing title or body in request");

  let targetUser = input.targetUser;
  if (targetUser && targetUser.includes("@")) {
    const email = normalizeEmail(targetUser);
    const snap = await db.collection("user_portal_access").where("email", "==", email).limit(1).get();
    if (!snap.empty) targetUser = String(snap.docs[0].data().user_id || "");
  }

  const tokens = await tokensForTarget(targetUser, input.targetRole || "all");
  await writeInbox({
    title,
    body,
    target_role: input.targetRole || null,
    target_user: targetUser || null,
    redirect_page: input.data?.url || "/",
  });

  const isDupe = await dupeInLast30s(title, body);
  if (isDupe) return { success: true, message: "DUPLICATE_SKIPPED" };
  if (!tokens.length) return { success: true, message: "NO_TOKENS_FOUND" };

  const res = await sendFcmInner(tokens, title, body, input.data || {});
  return {
    success: res.failed === 0,
    message:
      res.delivered > 0
        ? "Notification process complete"
        : res.stale > 0 && res.failed === 0
        ? "No active tokens; stale tokens cleaned up"
        : "Notification delivery failed",
    summary: { total: res.total, delivered: res.delivered, stale: res.stale, failures: res.failed },
  };
});

// ---------------------------------------------------------------------------
// sendWhatsapp
// ---------------------------------------------------------------------------

export const sendWhatsapp = onCall(async (request) => {
  const input = (request.data || {}) as { phone?: string; message?: string; studentName?: string };
  const phone = String(input.phone || "").replace(/\D/g, "");
  const message = String(input.message || "").trim();
  if (!phone) throw new HttpsError("invalid-argument", "Missing or invalid phone number");
  if (!message) throw new HttpsError("invalid-argument", "Missing WhatsApp message body");

  const snap = await db.collection("whatsapp_config").doc("1").get();
  const config = (snap.exists ? snap.data() : {}) || {};
  if (!config.enabled || config.provider === "none") {
    throw new HttpsError("failed-precondition", "WhatsApp notifications are disabled in the admin portal");
  }

  if (config.provider === "mock") {
    console.log("[MOCK WHATSAPP]", { phone, message, studentName: input.studentName });
    return { success: true, provider: "mock", simulated: true, phone };
  }

  if (config.provider === "meta") {
    if (!config.from_number || !config.api_token) throw new HttpsError("failed-precondition", "Meta API config incomplete");
    const resp = await fetch(`https://graph.facebook.com/v20.0/${config.from_number}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.api_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "text", text: { body: message } }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new HttpsError("unavailable", `Meta Cloud API Error (${resp.status}): ${txt.slice(0, 200)}`);
    }
    return { success: true, provider: "meta", phone };
  }

  if (config.provider === "twilio") {
    if (!config.account_sid || !config.api_token || !config.from_number) throw new HttpsError("failed-precondition", "Twilio config incomplete");
    const from = config.from_number.startsWith("whatsapp:") ? config.from_number : `whatsapp:${config.from_number}`;
    const to = `whatsapp:${phone.startsWith("+") ? phone : `+${phone}`}`;
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.account_sid}:${config.api_token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: message }).toString(),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new HttpsError("unavailable", `Twilio Error (${resp.status}): ${txt.slice(0, 200)}`);
    }
    return { success: true, provider: "twilio", phone };
  }

  if (config.provider === "custom") {
    if (!config.api_url) throw new HttpsError("failed-precondition", "Custom gateway config incomplete: API URL is missing");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.api_token) headers.Authorization = `Bearer ${config.api_token}`;
    const resp = await fetch(config.api_url, {
      method: "POST",
      headers,
      body: JSON.stringify({ to: phone, phone, number: phone, message, body: message, msg: message, token: config.api_token }),
    });
    if (!resp.ok) throw new HttpsError("unavailable", `Custom Gateway Error (${resp.status})`);
    return { success: true, provider: "custom", phone };
  }

  if (config.provider === "ultramsg") {
    if (!config.api_url || !config.api_token) throw new HttpsError("failed-precondition", "UltraMsg config incomplete");
    const resp = await fetch(config.api_url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: config.api_token, to: phone, body: message }).toString(),
    });
    if (!resp.ok) throw new HttpsError("unavailable", `UltraMsg Error (${resp.status})`);
    return { success: true, provider: "ultramsg", phone };
  }

  if (config.provider === "openwa") {
    const sessionId = config.openwa_session_id;
    const baseUrl = process.env.OPENWA_BASE_URL;
    const apiKey = process.env.OPENWA_API_KEY;
    if (!sessionId) throw new HttpsError("failed-precondition", "OpenWA session ID missing");
    if (!baseUrl) throw new HttpsError("failed-precondition", "OPENWA_BASE_URL env not set");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["X-API-Key"] = apiKey;
    const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/sessions/${sessionId}/messages/send-text`, {
      method: "POST",
      headers,
      body: JSON.stringify({ chatId: `${phone}@c.us`, text: message }),
    });
    if (!resp.ok) throw new HttpsError("unavailable", `OpenWA API Error (${resp.status})`);
    return { success: true, provider: "openwa", phone };
  }

  throw new HttpsError("invalid-argument", `Unsupported WhatsApp provider: ${config.provider}`);
});

// ---------------------------------------------------------------------------
// sendEmail
// ---------------------------------------------------------------------------

export const sendEmail = onCall(async (request) => {
  const input = (request.data || {}) as {
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
    pdfBase64?: string;
    pdfFilename?: string;
    studentName?: string;
    isOtp?: boolean;
  };
  const to = String(input.to || "").trim();
  const subject = String(input.subject || "").trim();
  const html = input.html || "";
  const text = input.text || "";
  const pdfBase64 = input.pdfBase64 || "";
  const pdfFilename = input.pdfFilename || "progress-report.pdf";
  const isOtp = input.isOtp === true;
  if (!to || !subject || (!html && !text)) {
    throw new HttpsError("invalid-argument", "to, subject and html/text are required");
  }

  const settingsSnap = await db.collection("email_settings").doc("1").get();
  const settings = (settingsSnap.exists ? settingsSnap.data() : {}) as Row;
  if (settings?.enabled === false && !isOtp) {
    throw new HttpsError("failed-precondition", "Email notifications are disabled in the admin portal");
  }
  const fromEmail = String(settings?.from_email || "onboarding@resend.dev");
  const fromName = String(settings?.from_name || "Mauze Tahfeez");

  const apiKey = process.env.RESEND_API_KEY || process.env.MAILERSEND_API_KEY;
  if (!apiKey) throw new HttpsError("failed-precondition", "No email API key configured (RESEND_API_KEY or MAILERSEND_API_KEY)");
  const useMailerSend = !!process.env.MAILERSEND_API_KEY;
  const apiUrl = useMailerSend ? "https://api.mailersend.com/v1/email" : "https://api.resend.com/emails";

  const payload: Row = useMailerSend
    ? { from: { email: fromEmail, name: fromName }, to: [{ email: to }], subject }
    : { from: `${fromName} <${fromEmail}>`, to: [to], subject };
  if (html) payload.html = html;
  else payload.text = text;
  if (pdfBase64) {
    payload.attachments = [{ filename: pdfFilename, content: pdfBase64, disposition: "attachment" }];
  }

  const resp = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const errorBody = await resp.text().catch(() => "");
    throw new HttpsError("unavailable", `Email API Error (${resp.status}): ${errorBody.slice(0, 300)}`);
  }
  const result = await resp.json().catch(() => ({}));
  try {
    await db.collection("email_logs").add({
      student_name: input.studentName || null,
      parent_email: to,
      subject,
      status: "sent",
      created_at: new Date().toISOString(),
    });
  } catch (_e) {
    console.warn("email log write failed", (_e as Error).message);
  }
  return { success: true, id: (result as any).id || null, to, subject };
});

// ---------------------------------------------------------------------------
// Auth admin callables
// ---------------------------------------------------------------------------

export const provisionUser = onCall(async (request) => {
  const input = (request.data || {}) as { email?: string; password?: string; data?: Row };
  const email = normalizeEmail(input.email);
  const password = String(input.password || "");
  if (!email || password.length < 6) throw new HttpsError("invalid-argument", "email and password (min 6 chars) are required");
  try {
    const rec = await auth.createUser({
      email,
      password,
      displayName: input.data?.full_name || null,
      emailVerified: true,
    });
    return { user: { id: rec.uid, email: rec.email } };
  } catch (err: any) {
    if (err && (err.code === "auth/email-already-exists" || /email.*already/i.test(err.message || ""))) {
      throw new HttpsError("already-exists", "User already registered");
    }
    throw new HttpsError("internal", err?.message || "Provisioning failed");
  }
});

export const getUserByEmail = onCall(async (request) => {
  const input = (request.data || {}) as { target_email?: string };
  const email = normalizeEmail(input.target_email);
  if (!email) throw new HttpsError("invalid-argument", "target_email required");
  try {
    const rec = await auth.getUserByEmail(email);
    return { id: rec.uid };
  } catch (err: any) {
    if (err && err.code === "auth/user-not-found") return { id: null };
    throw new HttpsError("unavailable", err.message || "Lookup failed");
  }
});

export const resetUserPassword = onCall(async (request) => {
  const input = (request.data || {}) as { target_email?: string; new_password?: string };
  const email = normalizeEmail(input.target_email);
  const password = String(input.new_password || "");
  if (!email || password.length < 6) throw new HttpsError("invalid-argument", "target_email and new_password required");
  try {
    const rec = await auth.getUserByEmail(email);
    await auth.updateUser(rec.uid, { password });
    return { success: true, message: `Password reset successfully for ${email}` };
  } catch (err: any) {
    throw new HttpsError("unavailable", err.message || "Password reset failed");
  }
});

// ---------------------------------------------------------------------------
// clearAllMarks
// ---------------------------------------------------------------------------

const CLEAR_FIELDS = [
  "wusool_juz",
  "wusool_page",
  "matrookah",
  "daeefah",
  "next_week_juz",
  "next_week_page",
  "istifadah_juz",
  "istifadah_page",
  "wusool_surah",
  "next_week_surah",
  "istifadah_surah",
  "murajazah",
  "juz_hali",
  "takhteet",
  "jadeed",
  "total_jadeed_pages",
  "attendance_count",
  "total_score",
];

export const clearAllMarks = onCall(async () => {
  const rows = await allDocs("weekly_results");
  const touched = rows.filter(({ data }) => CLEAR_FIELDS.some((f) => data[f] !== null && data[f] !== undefined));
  let updated = 0;
  for (const { id } of touched) {
    const patch: Row = {};
    CLEAR_FIELDS.forEach((f) => (patch[f] = null));
    patch.teacher_edit_count = 0;
    patch.teacher_locked = false;
    patch.teacher_locked_at = null;
    try {
      await db.collection("weekly_results").doc(id).update(patch);
      updated++;
    } catch (_e) {
      console.warn("clearAllMarks update failed", (_e as Error).message);
    }
  }
  return {
    success: true,
    message:
      updated === 0
        ? "No teacher marks to clear. All fields are already empty."
        : `Successfully cleared ${updated} teacher mark record(s). Teachers can now fill new progress marks.`,
    cleared: updated,
  };
});

// ---------------------------------------------------------------------------
// Scheduled: scheduled notifications
// ---------------------------------------------------------------------------

export const sendScheduleNotifications = onSchedule("every 5 minutes", async () => {
  const nowIso = new Date().toISOString();
  const rows = await allDocs("scheduled_notifications");
  const due = rows.filter(
    ({ data }) => data.is_active === true && data.fire_at && String(data.fire_at) <= nowIso && !data.processed_at
  );
  for (const item of due) {
    const data = item.data;
    const tokens = await tokensForTarget(data.target_user, data.target_role || "all");
    if (tokens.length) {
      await sendFcmInner(tokens, String(data.title || "Notification"), String(data.body || ""), {
        url: data.redirect_page || "/",
      }, "scheduled");
    }
    await db.collection("scheduled_notifications").doc(item.id).update({ processed_at: nowIso, last_sent_at: nowIso });
  }
});

// ---------------------------------------------------------------------------
// Scheduled: result live notifier
// ---------------------------------------------------------------------------

export const sendResultLiveNotifier = onSchedule("every 2 minutes", async () => {
  const rows = await allDocs("weekly_results");
  const pending = rows.filter(
    ({ data }) => !data._result_notified && (data.total_score !== undefined || data.murajazah !== undefined || data.jadeed !== undefined)
  );
  if (!pending.length) return;

  const children = await allDocs("child_profiles");
  const childMap = new Map<string, Row>();
  children.forEach((c) => childMap.set(String(c.data.student_id || "").trim().toLowerCase(), c.data));
  const teachers = await allDocs("teacher_profiles");
  const teacherUserMap = new Map<string, string>();
  teachers.forEach((t) => {
    const key = String(t.data.student_id || t.data.id || "").trim().toLowerCase();
    if (key && t.data.user_id) teacherUserMap.set(key, String(t.data.user_id));
  });

  for (const { id, data } of pending) {
    const sid = String(data.student_id || "").trim().toLowerCase();
    const child = childMap.get(sid);
    const name = String(child?.full_name || "Your child");
    if (child?.parent_user_id) {
      const tokens = await tokensForUser(String(child.parent_user_id));
      if (tokens.length) {
        await sendFcmInner(
          tokens,
          `${name}'s Result is Live!`,
          "The latest tahfz result is now available in the Progress page.",
          { url: "/", redirectPage: "Progress" },
          `result-live-${sid}`
        );
      }
    }
    const teacherUid = teacherUserMap.get(sid);
    if (teacherUid) {
      const tokens = await tokensForUser(teacherUid);
      if (tokens.length) {
        await sendFcmInner(
          tokens,
          "Result Saved",
          `Result saved for ${name}`,
          { url: "/", redirectPage: "Progress" },
          `result-saved-${sid}`
        );
      }
    }
    await db.collection("weekly_results").doc(id).update({ _result_notified: true }).catch((err) => console.warn("_result_notified write failed", (err as Error).message));
  }
});

// ---------------------------------------------------------------------------
// Scheduled: Jadwal daily reminder (IST-aware, mirrors jadwal-reminder)
// ---------------------------------------------------------------------------

const JADWAL_DAYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const SURAH_ARABIC: Record<number, string> = {
  1: "الفاتحة", 2: "البقرة", 3: "آل عمران", 4: "النساء", 5: "المائدة",
  6: "الأنعام", 7: "الأعراف", 8: "الأنفال", 9: "التوبة", 10: "يونس",
  11: "هود", 12: "يوسف", 13: "الرعد", 14: "إبراهيم", 15: "الحجر",
  16: "النحل", 17: "الإسراء", 18: "الكهف", 19: "مريم", 20: "طه",
  21: "الأنبياء", 22: "الحج", 23: "المؤمنون", 24: "النور", 25: "الفرقان",
  26: "الشعراء", 27: "النمل", 28: "القصص", 29: "العنكبوت", 30: "الروم",
  31: "لقمان", 32: "السجدة", 33: "الأحزاب", 34: "سبأ", 35: "فاطر",
  36: "يس", 37: "الصافات", 38: "ص", 39: "الزمر", 40: "غافر",
  41: "فصلت", 42: "الشورى", 43: "الزخرف", 44: "الدخان", 45: "الجاثية",
  46: "الأحقاف", 47: "محمد", 48: "الفتح", 49: "الحجرات", 50: "ق",
  51: "الذاريات", 52: "الطور", 53: "النجم", 54: "القمر", 55: "الرحمن",
  56: "الواقعة", 57: "الحديد", 58: "المجادلة", 59: "الحشر", 60: "الممتحنة",
  61: "الصف", 62: "الجمعة", 63: "المنافقون", 64: "التغابن", 65: "الطلاق",
  66: "التحريم", 67: "الملك", 68: "القلم", 69: "الحاقة", 70: "المعارج",
  71: "نوح", 72: "الجن", 73: "المزمل", 74: "المدثر", 75: "القيامة",
  76: "الإنسان", 77: "المرسلات", 78: "النبأ", 79: "النازعات", 80: "عبس",
  81: "التكوير", 82: "الإنفطار", 83: "المطففين", 84: "الإنشقاق", 85: "البروج",
  86: "الطارق", 87: "الأعلى", 88: "الغاشية", 89: "الفجر", 90: "البلد",
  91: "الشمس", 92: "الليل", 93: "الضحى", 94: "الشرح", 95: "التين",
  96: "العلق", 97: "القدر", 98: "البينة", 99: "الزلزلة", 100: "العاديات",
  101: "القارعة", 102: "التكاثر", 103: "العصر", 104: "الهمزة", 105: "الفيل",
  106: "قريش", 107: "الماعون", 108: "الكوثر", 109: "الكافرون", 110: "النصر",
  111: "المسد", 112: "الإخلاص", 113: "الفلق", 114: "الناس",
};

function toArabicNum(input: number | string): string {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  return String(input).replace(/\d/g, (d) => arabicDigits[Number(d)]);
}

function getSurahArabicName(surahNum: string): string {
  const num = parseInt(surahNum, 10);
  return SURAH_ARABIC[num] || surahNum;
}

function isZilhaj30(dateStr: string): boolean {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-tbla-nu-latn", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).formatToParts(date);
    const d = parseInt(parts.find((p) => p.type === "day")!.value, 10);
    const m = parseInt(parts.find((p) => p.type === "month")!.value, 10);
    return m === 12 && d === 30;
  } catch {
    return false;
  }
}

function formatTodayTasks(row: Row, mode: string): string {
  const parts: string[] = [];
  if (mode === "juz-wise") {
    const juzParts: string[] = [];
    for (const key of ["juz1", "juz2", "juz3", "juz4"]) {
      if (row[key] && String(row[key]).trim()) juzParts.push(String(row[key]).trim());
    }
    if (juzParts.length > 0) parts.push(`المراجعة: الأجزاء ${juzParts.join(", ")}`);
  } else if (row.murajah && String(row.murajah).trim()) {
    parts.push(`المراجعة: ${String(row.murajah).trim()}`);
  }

  if (row.jadeed && String(row.jadeed).trim()) {
    const jadeedParts = String(row.jadeed).split(":");
    if (jadeedParts.length === 2 && jadeedParts[0] && jadeedParts[1]) {
      parts.push(
        `الجدبد: ${getSurahArabicName(jadeedParts[0])} ${toArabicNum(parseInt(jadeedParts[1], 10))} آية`
      );
    } else {
      parts.push(`الجدبد: ${String(row.jadeed).trim()}`);
    }
  }

  if (row.juzhali && String(row.juzhali).trim()) {
    const juzhaliParts = String(row.juzhali).split(":");
    if (juzhaliParts.length === 2 && juzhaliParts[0] && juzhaliParts[1]) {
      parts.push(
        `الجزء الذي عليه: الصفحة ${toArabicNum(parseInt(juzhaliParts[0], 10))} إلى ${toArabicNum(
          parseInt(juzhaliParts[1], 10)
        )}`
      );
    } else {
      parts.push(`الجزء الذي عليه: الصفحة ${String(row.juzhali).trim()}`);
    }
  }

  return parts.length > 0 ? parts.join(" | ") : "";
}

export const sendJadwalReminder = onSchedule("every 1 minutes", async () => {
  const settingsSnap = await db.collection("jadwal_settings").doc("1").get().catch(() => null);
  const settings = (settingsSnap && settingsSnap.exists ? settingsSnap.data() : {}) || {};
  if (settings["jadwal_notification_enabled"] === false) return;

  const notifTimeStr = String(settings["jadwal_notification_time"] || "07:00:00");
  const [notifHour, notifMin] = notifTimeStr.split(":").map(Number);

  const now = new Date();
  const istParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  }).formatToParts(now);
  const getPart = (type: string) => istParts.find((p) => p.type === type)?.value || "";
  const dayNameMap: Record<string, string> = {
    sunday: "SUNDAY",
    monday: "MONDAY",
    tuesday: "TUESDAY",
    wednesday: "WEDNESDAY",
    thursday: "THURSDAY",
    friday: "FRIDAY",
    saturday: "SATURDAY",
  };
  const todayDayName = dayNameMap[getPart("weekday").toLowerCase()] || JADWAL_DAYS[now.getDay()];
  const todayDateStr = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
  const todayHour = Number(getPart("hour"));
  const todayMinute = Number(getPart("minute"));

  const currentMinutes = todayHour * 60 + todayMinute;
  const targetMinutes = (notifHour || 0) * 60 + (notifMin || 0);
  const diff = currentMinutes - targetMinutes;
  if (diff < 0 || diff >= 14) return;

  const lastSent = settings["last_jadwal_reminder_at"];
  if (lastSent && String(lastSent).slice(0, 10) >= todayDateStr) return;

  const isMiqaat =
    settings["jadwal_type"] === "miqaat" &&
    settings["jadwal_week_start"] &&
    settings["jadwal_week_end"];
  const miqaatWeekStart = isMiqaat ? String(settings["jadwal_week_start"]) : null;

  const jadawal = await allDocs("jadawal");
  if (!jadawal.length) return;

  const children = await allDocs("child_profiles");
  const profileMap = new Map<string, Row>();
  children.forEach((c) => profileMap.set(String(c.data.student_id || "").trim().toLowerCase(), c.data));

  let sentCount = 0;
  for (const { data } of jadawal) {
    const studentId = String(data.student_id || "").trim().toLowerCase();
    const profile = profileMap.get(studentId);
    if (!profile) continue;
    const parentUserId = profile["parent_user_id"];
    if (!parentUserId) continue;

    const scheduleData = (data.schedule_data || {}) as Record<string, Row>;
    const studentName = String(profile["full_name"] || "Student");
    let dayData: Row | undefined;
    if (isMiqaat && miqaatWeekStart) {
      let idx = 0;
      const cur = new Date(miqaatWeekStart + "T00:00:00Z");
      const todayEnd = new Date(todayDateStr + "T00:00:00Z");
      while (cur < todayEnd) {
        const ds = cur.toISOString().split("T")[0];
        if (!isZilhaj30(ds)) idx++;
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      const key = idx >= 6 ? `${todayDayName}_${idx}` : todayDayName;
      dayData = scheduleData[key] || undefined;
    }
    if (!dayData) dayData = scheduleData[todayDayName] || undefined;
    if (!dayData) continue;

    const mode = String(scheduleData["_mode"] || "juz-wise");
    const tasks = formatTodayTasks(dayData, mode);
    if (!tasks) continue;

    const title = `📖 جدول ${studentName} اليوم`;
    const tokens = await tokensForUser(String(parentUserId));
    if (!tokens.length) continue;

    const res = await sendFcmInner(
      tokens,
      title,
      tasks,
      { url: "/", redirectPage: "Jadwal", studentId: String(data.student_id) },
      `jadwal-reminder-${studentId}`
    );
    sentCount += res.delivered;
  }

  if (sentCount > 0) {
    await db
      .collection("jadwal_settings")
      .doc("1")
      .update({ last_jadwal_reminder_at: new Date().toISOString() })
      .catch((err) => console.warn("jadwal reminder stamp failed", (err as Error).message));
  }
});

// ---------------------------------------------------------------------------
// Scheduled: auto-clear progress (settings-aware)
// ---------------------------------------------------------------------------

export const autoClearProgress = onSchedule("every 30 minutes", async () => {
  const snap = await db.collection("report_settings").doc("1").get();
  const settings = snap.exists ? snap.data() : {};
  if (settings?.auto_clear_enabled !== true) return;
  const day = String(settings.auto_clear_day || "Friday");
  const time = String(settings.auto_clear_time || "11:30");
  const now = new Date();
  const dayMap: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  if (now.getDay() !== (dayMap[day] ?? 5)) return;
  const [h, m] = time.split(":").map((x) => parseInt(x, 10));
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const targetMins = (h || 0) * 60 + (m || 0);
  if (nowMins < targetMins || nowMins > targetMins + 45) return;

  const rows = await allDocs("weekly_results");
  for (const { id, data } of rows) {
    if (!CLEAR_FIELDS.some((f) => data[f] !== null && data[f] !== undefined)) continue;
    const patch: Row = {};
    CLEAR_FIELDS.forEach((f) => (patch[f] = null));
    patch.teacher_edit_count = 0;
    patch.teacher_locked = false;
    patch.teacher_locked_at = null;
    try {
      await db.collection("weekly_results").doc(id).update(patch);
    } catch (_e) {
      console.warn("autoClearProgress update failed", (_e as Error).message);
    }
  }
});

// ---------------------------------------------------------------------------
// deployAndroidApp (stub: full Play upload requires AAB file bytes)
// ---------------------------------------------------------------------------

export const deployAndroidApp = onCall(async () => {
  throw new HttpsError(
    "unimplemented",
    "Android upload requires direct AAB access. Build the release AAB and upload it via the Google Play Console."
  );
});