import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { GoogleAuth } from "google-auth-library";

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
    "https://mouze-tahfeez-atfal.vercel.app"
  ).replace(/\/+$/, "");
}

function notificationUrl(dataMap?: Record<string, string>, fallback = "/"): string {
  const base = siteUrl();
  const raw = dataMap?.url || dataMap?.link;
  if (raw) {
    try {
      if (raw.startsWith("/")) {
        return new URL(raw, `${base}/`).toString();
      }
      const parsed = new URL(raw);
      // Rebase onto base site url
      return new URL(parsed.pathname + parsed.search + parsed.hash, `${base}/`).toString();
    } catch {
      // fall through
    }
  }
  
  // Generate deep link from redirectPage
  const page = dataMap?.redirectPage || dataMap?.redirect_page;
  const leaveId = dataMap?.leaveId || dataMap?.leave_id;
  const studentId = dataMap?.studentId || dataMap?.student_id;

  if (page) {
    let path = `/?redirectPage=${encodeURIComponent(page)}`;
    if (page.includes(":")) {
      const parts = page.split(":");
      path = `/?redirectPage=${encodeURIComponent(parts[0])}`;
      if (parts[1] && !studentId) {
        path += `&studentId=${encodeURIComponent(parts[1])}`;
      }
    }
    if (leaveId) {
      path += `&leaveId=${encodeURIComponent(leaveId)}`;
    }
    if (studentId) {
      path += `&studentId=${encodeURIComponent(studentId)}`;
    }
    try {
      return new URL(path, `${base}/`).toString();
    } catch {
      // fall through
    }
  }
  
  return `${base}/`;
}

async function tokensForUser(userId?: string, section: "atfal" | "kibar" = "atfal"): Promise<string[]> {
  if (!userId) return [];
  const out: string[] = [];
  const col = "user_fcm_tokens";
  const snap = await db.collection(col).where("user_id", "==", String(userId)).limit(200).get();
  snap.docs.forEach((d) => {
    const t = d.data().fcm_token;
    if (t) out.push(String(t));
  });
  return [...new Set(out)];
}

// Map a plain atfal target role onto the kibar section roles. "all" expands to
// every kibar role so a kibar broadcast never leaks into the atfal institute.
function kibarRolesFor(role?: string): string[] {
  if (!role || role === "all" || role === "user") return ["kibar-admin", "kibar-teacher", "kibar-student"];
  if (role === "parents") return ["kibar-student"];
  if (role === "teacher") return ["kibar-teacher"];
  if (role === "admin") return ["kibar-admin"];
  if (role.startsWith("kibar-")) return [role];
  return [];
}

async function tokensForRole(role?: string, section: "atfal" | "kibar" = "atfal"): Promise<string[]> {
  const out: string[] = [];
  const col = "user_fcm_tokens";
  const all = await allDocs(col);
  for (const { data } of all) {
    const r = String(data.user_role || "");
    const t = data.fcm_token;
    if (!t) continue;
    const isKibarToken = r.startsWith("kibar-");
    if (section === "kibar" ? !isKibarToken : isKibarToken) continue;
    if (!role || role === "all" || role === "user") {
      out.push(String(t));
      continue;
    }
    if (section === "kibar") {
      if (kibarRolesFor(role).includes(r)) out.push(String(t));
    } else if (r === role) {
      out.push(String(t));
    }
  }
  return [...new Set(out)];
}

async function tokensForTarget(targetUser?: string, targetRole?: string, section: "atfal" | "kibar" = "atfal"): Promise<string[]> {
  if (targetUser) return tokensForUser(targetUser, section);
  return tokensForRole(targetRole, section);
}

async function dupeInLast30s(title: string, body: string, section: "atfal" | "kibar" = "atfal"): Promise<boolean> {
  const since = new Date(Date.now() - 30_000).toISOString();
  const col = section === "kibar" ? "kibar_system_notifications" : "system_notifications";
  try {
    const snap = await db
      .collection(col)
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

async function writeInbox(doc: Row, section: "atfal" | "kibar" = "atfal") {
  const col = section === "kibar" ? "kibar_system_notifications" : "system_notifications";
  try {
    await db.collection(col).add({
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
  tag = "mauze-tahfeez-notification",
  section: "atfal" | "kibar" = "atfal"
): Promise<{ total: number; delivered: number; stale: number; failed: number }> {
  const uniq = [...new Set(tokens.filter(Boolean))];
  if (!uniq.length) return { total: 0, delivered: 0, stale: 0, failed: 0 };
  const data: Record<string, string> = { ...dataMap, title, body, url: notificationUrl(dataMap) };
  let delivered = 0;
  let stale = 0;
  let failed = 0;

  const col = "user_fcm_tokens";

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
          color: "#C5A059",
          visibility: "public",
          // NOTE: no click_action here. Capacitor's PushNotifications plugin
          // resolves taps from the launcher intent + the FCM data payload, and
          // an unmatched click_action (no manifest intent-filter) can make the
          // notification tap silently fail to open the app on some devices.
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
          db.collection(col)
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
    section?: string;
  };

  // Kibar portal ranks are computed from the kibar_* collections so the two
  // institutes never mix leaderboards.
  const section = input.section === "kibar" ? "kibar" : "atfal";
  const resultsCol = section === "kibar" ? "kibar_weekly_results" : "weekly_results";

  const rows = await allDocs(resultsCol);
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
    section?: string;
  };
  const title = String(input.title || "");
  const body = String(input.body || "");
  if (!title || !body) throw new HttpsError("invalid-argument", "Missing title or body in request");

  const section: "atfal" | "kibar" = input.section === "kibar" ? "kibar" : "atfal";

  let targetUser = input.targetUser;
  if (targetUser && targetUser.includes("@")) {
    const email = normalizeEmail(targetUser);
    const col = section === "kibar" ? "kibar_user_portal_access" : "user_portal_access";
    const snap = await db.collection(col).where("email", "==", email).limit(1).get();
    if (!snap.empty) targetUser = String(snap.docs[0].data().user_id || "");
  }

  const tokens = await tokensForTarget(targetUser, input.targetRole || "all", section);
  await writeInbox({
    title,
    body,
    target_role: input.targetRole || null,
    target_user: targetUser || null,
    redirect_page: input.data?.redirectPage || notificationUrl(input.data) || "/",
  }, section);

  const isDupe = await dupeInLast30s(title, body, section);
  if (isDupe) return { success: true, message: "DUPLICATE_SKIPPED" };
  if (!tokens.length) return { success: true, message: "NO_TOKENS_FOUND" };

  const res = await sendFcmInner(tokens, title, body, input.data || {}, "mauze-tahfeez-notification", section);
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
// Firestore trigger: Leave chat (WhatsApp-style chatbar) notifications
//
// Sends a push notification whenever a NEW message is appended to a
// student_leaves `messages` array. This runs server-side, so delivery no
// longer depends on the sender's device being alive right after sending —
// it works in both directions:
//   - admin message  -> push to the parent   (opens "Apply Leave")
//   - parent message -> push to all admins   (opens "Leave Management")
// Edits keep the original `timestamp`, so editing never re-notifies.
// ---------------------------------------------------------------------------
async function isPeerOnlineInChat(leaveId: string, peerRole: "parent" | "admin"): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const snap = await db.collection("_presence")
      .where("leaveId", "==", leaveId)
      .get();
    
    for (const d of snap.docs) {
      const data = d.data();
      const roleMatches = data.role === peerRole || data.userRole === peerRole;
      if (roleMatches && data._expiresAt && data._expiresAt > now) {
        return true;
      }
    }
  } catch (err) {
    console.warn("isPeerOnlineInChat check failed", (err as Error).message);
  }
  return false;
}

export const notifyLeaveChatMessages = onDocumentUpdated(
  "student_leaves/{leaveId}",
  async (event) => {
    const before = (event.data?.before?.data?.() || {}) as Row;
    const after = (event.data?.after?.data?.() || {}) as Row;

    const newMessages: Row[] = Array.isArray(after.messages) ? after.messages : [];
    const oldMessages: Row[] = Array.isArray(before.messages) ? before.messages : [];
    // Only a strictly longer array means a NEW message was appended (edits
    // replace in place and keep the array length, so they never re-notify).
    if (newMessages.length <= oldMessages.length || !newMessages.length) return;

    const last = newMessages[newMessages.length - 1];
    if (!last || typeof last !== "object" || !last.text) return;

    const role = String(last.role || "").toLowerCase();
    const body = String(last.text).slice(0, 180);
    const tag = `leave-chat-${event.params.leaveId}-${String(last.timestamp || "")}`;

    if (role === "admin") {
      const parentId = after.parent_id || before.parent_id;
      if (!parentId) return;

      const parentOnline = await isPeerOnlineInChat(event.params.leaveId, "parent");
      if (parentOnline) {
        console.log(`Parent is online in chat ${event.params.leaveId}, skipping push/inbox notifications`);
        return;
      }

      const tokens = await tokensForUser(String(parentId));
      if (!tokens.length) return;
      await sendFcmInner(
        tokens,
        "📝 Leave Clarification",
        body,
        {
          url: "/",
          redirectPage: "Apply Leave",
          leaveId: event.params.leaveId,
          studentId: String(after.student_id || ""),
        },
        tag
      );
      // Keep the portal Inbox in sync (previously written client-side).
      await writeInbox({
        title: "📝 Leave Clarification",
        body,
        target_role: "user",
        target_user: String(parentId),
        redirect_page: "Apply Leave",
      });
    } else if (role === "parent") {
      const adminOnline = await isPeerOnlineInChat(event.params.leaveId, "admin");
      if (adminOnline) {
        console.log(`Admin is online in chat ${event.params.leaveId}, skipping push/inbox notifications`);
        return;
      }

      const tokens = await tokensForRole("admin");
      if (!tokens.length) return;
      await sendFcmInner(
        tokens,
        "💬 Leave Reply",
        body,
        { url: "/", redirectPage: "Leave Management", leaveId: event.params.leaveId },
        tag
      );
      // Keep the portal Inbox in sync (previously written client-side).
      await writeInbox({
        title: "💬 Leave Reply",
        body,
        target_role: "admin",
        target_user: null,
        redirect_page: "Leave Management",
      });
    }
  }
);

export const notifyKibarLeaveChatMessages = onDocumentUpdated(
  "kibar_student_leaves/{leaveId}",
  async (event) => {
    const before = (event.data?.before?.data?.() || {}) as Row;
    const after = (event.data?.after?.data?.() || {}) as Row;

    const newMessages: Row[] = Array.isArray(after.messages) ? after.messages : [];
    const oldMessages: Row[] = Array.isArray(before.messages) ? before.messages : [];
    if (newMessages.length <= oldMessages.length || !newMessages.length) return;

    const last = newMessages[newMessages.length - 1];
    if (!last || typeof last !== "object" || !last.text) return;

    const role = String(last.role || "").toLowerCase();
    const body = String(last.text).slice(0, 180);
    const tag = `kibar-leave-chat-${event.params.leaveId}-${String(last.timestamp || "")}`;

    if (role === "admin" || role === "kibar-admin" || role === "teacher" || role === "kibar-teacher") {
      const studentId = after.student_id || after.parent_id || before.student_id || before.parent_id;
      if (!studentId) return;

      const tokens = await tokensForUser(String(studentId), "kibar");
      if (!tokens.length) return;
      await sendFcmInner(
        tokens,
        "📝 Leave Clarification",
        body,
        {
          url: "/",
          redirectPage: "Apply Leave",
          leaveId: event.params.leaveId,
          studentId: String(after.student_id || ""),
        },
        tag,
        "kibar"
      );
      await writeInbox({
        title: "📝 Leave Clarification",
        body,
        target_role: "kibar-student",
        target_user: String(studentId),
        redirect_page: "Apply Leave",
      }, "kibar");
    } else if (role === "parent" || role === "student" || role === "kibar-student") {
      const tokens = await tokensForRole("kibar-admin", "kibar");
      if (!tokens.length) return;
      await sendFcmInner(
        tokens,
        "💬 Leave Reply",
        body,
        { url: "/", redirectPage: "Leave Management", leaveId: event.params.leaveId },
        tag,
        "kibar"
      );
      await writeInbox({
        title: "💬 Leave Reply",
        body,
        target_role: "kibar-admin",
        target_user: null,
        redirect_page: "Leave Management",
      }, "kibar");
    }
  }
);

// ---------------------------------------------------------------------------
// sendWhatsapp
// ---------------------------------------------------------------------------

export const sendWhatsapp = onCall(async (request) => {
  const input = (request.data || {}) as { phone?: string; message?: string; studentName?: string; section?: string };
  const phone = String(input.phone || "").replace(/\D/g, "");
  const message = String(input.message || "").trim();
  if (!phone) throw new HttpsError("invalid-argument", "Missing or invalid phone number");
  if (!message) throw new HttpsError("invalid-argument", "Missing WhatsApp message body");

  const section = input.section === "kibar" ? "kibar" : "atfal";
  const col = section === "kibar" ? "kibar_whatsapp_config" : "whatsapp_config";
  let snap = await db.collection(col).doc("1").get();
  if (!snap.exists && section === "kibar") {
    snap = await db.collection("whatsapp_config").doc("1").get();
  }
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
    section?: string;
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

  const section = input.section === "kibar" ? "kibar" : "atfal";
  const col = section === "kibar" ? "kibar_email_settings" : "email_settings";
  let settingsSnap = await db.collection(col).doc("1").get();
  if (!settingsSnap.exists && section === "kibar") {
    settingsSnap = await db.collection("email_settings").doc("1").get();
  }
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
  const fullName = String(input.data?.full_name || "").trim() || null;
  const portalRole = String(input.data?.portal_role || "parents").trim().toLowerCase();
  const section = String(input.data?.section || (portalRole.startsWith("kibar-") ? "kibar" : "atfal")).trim().toLowerCase();
  try {
    const rec = await auth.createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: true,
    });
    // Keep `users/{uid}` in sync so Firestore rules (role()) can resolve this
    // account's portal_role for admin/teacher/parent data reads.
    const now = new Date().toISOString();
    const isTeacherRole = portalRole === "teacher" || portalRole === "kibar-teacher";
    const userDoc = {
      email,
      full_name: fullName || email.split("@")[0],
      portal_role: portalRole,
      is_active: true,
      created_at: now,
      updated_at: now,
      salary_per_minute: isTeacherRole ? 2.3 : 0,
      show_salary_card: isTeacherRole,
      id: rec.uid,
      section,
    };
    await db.collection("users").doc(rec.uid).set(userDoc, { merge: true });

    if (section === "kibar" || portalRole.startsWith("kibar-")) {
      const kibarAccessDoc = {
        id: rec.uid,
        user_id: rec.uid,
        email,
        full_name: fullName || email.split("@")[0],
        portal_role: portalRole,
        is_active: true,
        created_at: now,
        section: "kibar",
      };
      await db.collection("kibar_user_portal_access").doc(rec.uid).set(kibarAccessDoc, { merge: true });
    } else {
      const atfalAccessDoc = {
        id: rec.uid,
        user_id: rec.uid,
        email,
        full_name: fullName || email.split("@")[0],
        portal_role: portalRole,
        is_active: true,
        created_at: now,
        section: "atfal",
      };
      await db.collection("user_portal_access").doc(rec.uid).set(atfalAccessDoc, { merge: true });
    }

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
  const input = (request.data || {}) as {
    target_email?: string;
    target_user_id?: string;
    new_password?: string;
  };
  const password = String(input.new_password || "");
  if (password.length < 6)
    throw new HttpsError("invalid-argument", "new_password required (min 6 characters)");
  try {
    // Resolve the account by email OR Firebase user id - teacher_profiles rows
    // often lack an email field, so the admin portal passes target_user_id.
    const email = normalizeEmail(input.target_email);
    let rec: admin.auth.UserRecord | null = null;
    if (email) {
      rec = await auth.getUserByEmail(email);
    } else if (input.target_user_id) {
      rec = await auth.getUser(String(input.target_user_id));
    }
    if (!rec) {
      throw new HttpsError("not-found", "No Firebase Auth account found for this staff member.");
    }
    await auth.updateUser(rec.uid, { password });
    return {
      success: true,
      message: `Password reset successfully for ${email || rec.email || rec.uid}`,
    };
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;
    const raw = String(err?.message || err?.code || "");
    if (raw.includes("user-not-found") || raw.includes("no user record")) {
      throw new HttpsError("not-found", "No Firebase Auth account found for this staff member.");
    }
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

export const clearAllMarks = onCall(async (request) => {
  const input = (request?.data || {}) as { section?: string };
  const section = input.section === "kibar" ? "kibar" : "atfal";
  const resultsCol = section === "kibar" ? "kibar_weekly_results" : "weekly_results";
  const rows = await allDocs(resultsCol);
  const touched = rows.filter(({ data }) => CLEAR_FIELDS.some((f) => data[f] !== null && data[f] !== undefined));
  let updated = 0;
  for (const { id } of touched) {
    const patch: Row = {};
    CLEAR_FIELDS.forEach((f) => (patch[f] = null));
    patch.teacher_edit_count = 0;
    patch.teacher_locked = false;
    patch.teacher_locked_at = null;
    try {
      await db.collection(resultsCol).doc(id).update(patch);
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
  const sections: Array<"atfal" | "kibar"> = ["atfal", "kibar"];
  for (const section of sections) {
    const col = section === "kibar" ? "kibar_scheduled_notifications" : "scheduled_notifications";
    const rows = await allDocs(col);
    const due = rows.filter(
      ({ data }) => data.is_active === true && data.fire_at && String(data.fire_at) <= nowIso && !data.processed_at
    );
    for (const item of due) {
      const data = item.data;
      const tokens = await tokensForTarget(data.target_user, data.target_role || "all", section);
      if (tokens.length) {
        await sendFcmInner(tokens, String(data.title || "Notification"), String(data.body || ""), {
          url: data.redirect_page || "/",
        }, "scheduled");
      }
      await db.collection(col).doc(item.id).update({ processed_at: nowIso, last_sent_at: nowIso });
    }
  }
});

async function runResultLiveNotifierInner(section: "atfal" | "kibar" = "atfal", manual = false) {
  const settingsCol = section === "kibar" ? "kibar_report_settings" : "report_settings";
  const resultsCol = section === "kibar" ? "kibar_weekly_results" : "weekly_results";
  const childCol = section === "kibar" ? "kibar_child_profiles" : "child_profiles";
  const teacherCol = section === "kibar" ? "kibar_teacher_profiles" : "teacher_profiles";

  // 1. Fetch settings and check rules
  const settingsRows = await allDocs(settingsCol);
  const settings = settingsRows[0]?.data || {};

  if (!settings.result_live_notify_enabled) {
    return { skipped: "NOTIFY_DISABLED" };
  }
  if (!settings.reports_live) {
    return { skipped: "NOT_LIVE" };
  }

  // 2. Determine pending results
  const rows = await allDocs(resultsCol);
  let pending: Array<{ id: string; data: Row }> = [];

  if (manual) {
    // For manual notifications, target the most recent week's results
    const weekDates = rows.map(r => r.data.week_date).filter(Boolean);
    if (!weekDates.length) return { skipped: "NO_RESULTS" };
    const latestWeekDate = weekDates.reduce((max, d) => (d > max ? d : max), weekDates[0]);
    pending = rows.filter(
      ({ data }) =>
        (data.week_date === latestWeekDate || !data._result_notified) &&
        (data.total_score !== undefined || data.murajazah !== undefined || data.jadeed !== undefined)
    );
  } else {
    // For scheduled notifications, target pending/unnotified results
    pending = rows.filter(
      ({ data }) => !data._result_notified && (data.total_score !== undefined || data.murajazah !== undefined || data.jadeed !== undefined)
    );
  }

  if (!pending.length) return { skipped: "NO_PENDING" };

  // 3. Load students and teachers mapping
  const children = await allDocs(childCol);
  const childMap = new Map<string, Row>();
  children.forEach((c) => childMap.set(String(c.data.student_id || "").trim().toLowerCase(), c.data));
  const teachers = await allDocs(teacherCol);
  const teacherUserMap = new Map<string, string>();
  teachers.forEach((t) => {
    const key = String(t.data.student_id || t.data.id || "").trim().toLowerCase();
    if (key && t.data.user_id) teacherUserMap.set(key, String(t.data.user_id));
  });

  let childrenCount = 0;
  const parentsCount = new Set<string>();
  let deliveredCount = 0;

  // 4. Send notifications
  for (const { id, data } of pending) {
    const sid = String(data.student_id || "").trim().toLowerCase();
    const child = childMap.get(sid);
    const name = String(child?.full_name || "Your child");
    
    let notifiedChild = false;
    if (child?.parent_user_id) {
      const tokens = await tokensForUser(String(child.parent_user_id), section);
      if (tokens.length) {
        await sendFcmInner(
          tokens,
          `${name}'s Result is Live!`,
          "The latest tahfz result is now available in the Progress page.",
          { url: "/", redirectPage: "Progress" },
          section === "kibar" ? `kibar-result-live-${sid}` : `result-live-${sid}`,
          section
        );
        parentsCount.add(String(child.parent_user_id));
        deliveredCount += tokens.length;
        notifiedChild = true;
      }
    }
    
    const teacherUid = teacherUserMap.get(sid);
    if (teacherUid) {
      const tokens = await tokensForUser(teacherUid, section);
      if (tokens.length) {
        await sendFcmInner(
          tokens,
          "Result Saved",
          `Result saved for ${name}`,
          { url: "/", redirectPage: "Progress" },
          section === "kibar" ? `kibar-result-saved-${sid}` : `result-saved-${sid}`,
          section
        );
        deliveredCount += tokens.length;
      }
    }
    if (notifiedChild) {
      childrenCount++;
    }
    await db.collection(resultsCol).doc(id).update({ _result_notified: true }).catch((err) => console.warn(`${section} _result_notified write failed`, (err as Error).message));
  }

  return {
    success: true,
    summary: {
      delivered: deliveredCount,
      children: childrenCount,
      parents: parentsCount.size,
    }
  };
}

export const sendResultLiveNotifier = onCall(async (request) => {
  const input = request.data || {};
  const section: "atfal" | "kibar" = input.section === "kibar" ? "kibar" : "atfal";
  const manual = Boolean(input.manual);
  return await runResultLiveNotifierInner(section, manual);
});

export const scheduledSendResultLiveNotifier = onSchedule("every 2 minutes", async () => {
  await runResultLiveNotifierInner("atfal");
});

export const sendKibarResultLiveNotifier = onSchedule("every 2 minutes", async () => {
  await runResultLiveNotifierInner("kibar");
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
  const sections: Array<"atfal" | "kibar"> = ["atfal", "kibar"];
  for (const section of sections) {
    const settingsCol = section === "kibar" ? "kibar_report_settings" : "report_settings";
    const resultsCol = section === "kibar" ? "kibar_weekly_results" : "weekly_results";
    const snap = await db.collection(settingsCol).doc("1").get();
    const settings = snap.exists ? snap.data() : {};
    if (settings?.auto_clear_enabled !== true) continue;
    const day = String(settings.auto_clear_day || "Friday");
    const time = String(settings.auto_clear_time || "11:30");
    const now = new Date();
    const dayMap: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    if (now.getDay() !== (dayMap[day] ?? 5)) continue;
    const [h, m] = time.split(":").map((x) => parseInt(x, 10));
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const targetMins = (h || 0) * 60 + (m || 0);
    if (nowMins < targetMins || nowMins > targetMins + 45) continue;

    const rows = await allDocs(resultsCol);
    for (const { id, data } of rows) {
      if (!CLEAR_FIELDS.some((f) => data[f] !== null && data[f] !== undefined)) continue;
      const patch: Row = {};
      CLEAR_FIELDS.forEach((f) => (patch[f] = null));
      patch.teacher_edit_count = 0;
      patch.teacher_locked = false;
      patch.teacher_locked_at = null;
      try {
        await db.collection(resultsCol).doc(id).update(patch);
      } catch (_e) {
        console.warn(`autoClearProgress update failed for ${resultsCol}`, (_e as Error).message);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// deployAndroidApp (Upload AAB and deploy to Google Play)
// ---------------------------------------------------------------------------

const PLAY_API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const PLAY_UPLOAD_BASE = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';
const PLAY_TRACKS = ['internal', 'alpha', 'beta', 'production'] as const;
type PlayTrack = typeof PLAY_TRACKS[number];

function parseServiceAccountKey(rawKey: string): Record<string, any> {
  let cleaned = rawKey.trim();
  if (
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith('`') && cleaned.endsWith('`'))
  ) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }
  let sanitized = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escaped) {
      sanitized += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      sanitized += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      sanitized += char;
      continue;
    }
    if (inString && (char === '\n' || char === '\r')) {
      if (char === '\n') {
        sanitized += '\\n';
      }
      continue;
    }
    sanitized += char;
  }
  try {
    return JSON.parse(sanitized);
  } catch (err) {
    try {
      const unescaped = sanitized.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      return JSON.parse(unescaped);
    } catch {
      throw new Error(`GOOGLE_PLAY_SERVICE_ACCOUNT_KEY is not valid JSON. Parse error: ${(err as Error).message}`);
    }
  }
}

async function getPlayAccessToken(serviceAccountJson: string): Promise<{ token: string; clientEmail: string }> {
  const credentials = parseServiceAccountKey(serviceAccountJson);
  const clientEmail = String(credentials.client_email || "unknown");
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token?.token) {
    throw new Error("Failed to generate Google Play access token. Check your service account key.");
  }
  return { token: token.token, clientEmail };
}

async function deleteEdit(accessToken: string, packageName: string, editId: string) {
  try {
    await fetch(`${PLAY_API_BASE}/applications/${packageName}/edits/${editId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Best-effort cleanup
  }
}

async function deployToPlayStore(
  accessToken: string,
  clientEmail: string,
  packageName: string,
  track: PlayTrack,
  aabBytes: Buffer,
  versionName: string,
  versionCode: number,
  releaseNotes: string
) {
  console.log('Creating edit...');
  const editRes = await fetch(`${PLAY_API_BASE}/applications/${packageName}/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!editRes.ok) {
    const err = await editRes.text();
    throw new Error(`Failed to create edit: ${editRes.status} — ${err}. (Package Name: "${packageName}", Service Account Email: "${clientEmail}".)`);
  }

  const edit = await editRes.json() as any;
  const editId: string = edit.id;
  console.log(`Edit created: ${editId}`);

  try {
    console.log(`Uploading AAB bundle (${(aabBytes.length / (1024 * 1024)).toFixed(1)} MB)...`);
    const uploadUrl = `${PLAY_UPLOAD_BASE}/applications/${packageName}/edits/${editId}/bundles?uploadType=media`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: aabBytes as any,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Failed to upload AAB: ${uploadRes.status} — ${err}`);
    }

    const bundle = await uploadRes.json() as any;
    const bundleVersionCode: number = bundle.versionCode;
    console.log(`AAB uploaded. Version code: ${bundleVersionCode}`);

    console.log(`Assigning to track: ${track}...`);
    const trackUrl = `${PLAY_API_BASE}/applications/${packageName}/edits/${editId}/tracks/${track}`;
    const trackPayload = {
      track,
      releases: [
        {
          name: versionName,
          versionCodes: [bundleVersionCode],
          releaseNotes: releaseNotes
            ? [{ language: 'en-US', text: releaseNotes }]
            : [],
          status: 'completed',
        },
      ],
    };

    const trackRes = await fetch(trackUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(trackPayload),
    });

    if (!trackRes.ok) {
      const err = await trackRes.text();
      throw new Error(`Failed to assign to track: ${trackRes.status} — ${err}`);
    }

    console.log(`Assigned to track "${track}" successfully.`);

    console.log('Committing edit...');
    const commitUrl = `${PLAY_API_BASE}/applications/${packageName}/edits/${editId}:commit`;
    const commitRes = await fetch(commitUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!commitRes.ok) {
      const err = await commitRes.text();
      throw new Error(`Failed to commit edit: ${commitRes.status} — ${err}`);
    }

    const commitResult = await commitRes.json();
    console.log('Edit committed successfully.');

    return {
      editId,
      bundleVersionCode,
      commitResult,
    };
  } catch (deployError) {
    console.log(`Cleaning up edit ${editId}...`);
    await deleteEdit(accessToken, packageName, editId);
    throw deployError;
  }
}

export const deployAndroidApp = onCall({ timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Unauthorized — please log in again.");
  }

  const { aabUrl, aabFileName, aabFileSize, track, versionName, versionCode, releaseNotes } = request.data || {};

  if (!aabUrl) throw new HttpsError("invalid-argument", "AAB URL is required");
  if (!track || !PLAY_TRACKS.includes(track as PlayTrack)) {
    throw new HttpsError("invalid-argument", `Track must be one of: ${PLAY_TRACKS.join(', ')}`);
  }
  if (!versionName) throw new HttpsError("invalid-argument", "Version name is required");
  if (!versionCode) throw new HttpsError("invalid-argument", "Version code is required");

  // Create pending release record
  const releaseRef = await db.collection("app_releases").add({
    version_name: versionName,
    version_code: versionCode,
    track,
    release_notes: releaseNotes || "",
    aab_file_name: aabFileName || "release.aab",
    aab_file_size: aabFileSize || 0,
    status: "deploying",
    console_status: "in_review",
    created_at: new Date().toISOString(),
    created_by: request.auth.uid,
  });

  const releaseId = releaseRef.id;

  try {
    const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_KEY environment variable is not set. Google Play upload is disabled.");
    }
    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.mauzetahfeez.myapp";

    // 1. Get Google Play access token
    const { token: accessToken, clientEmail } = await getPlayAccessToken(serviceAccountJson);

    // 2. Download AAB file from storage url
    const fileRes = await fetch(aabUrl);
    if (!fileRes.ok) {
      throw new Error(`Failed to download AAB file from storage: ${fileRes.status}`);
    }
    const aabBytes = Buffer.from(await fileRes.arrayBuffer());

    // 3. Deploy to Play Store
    const { editId, bundleVersionCode } = await deployToPlayStore(
      accessToken,
      clientEmail,
      packageName,
      track as PlayTrack,
      aabBytes,
      versionName,
      versionCode,
      releaseNotes || ""
    );

    // 4. Update status to live
    await db.collection("app_releases").doc(releaseId).update({
      status: "live",
      edit_id: editId,
      bundle_version_code: bundleVersionCode,
    });

    return {
      success: true,
      message: `App v${versionName} deployed to ${track} track successfully!`,
      release: {
        id: releaseId,
        versionName,
        versionCode,
        track,
        editId,
        bundleVersionCode,
      },
    };
  } catch (err) {
    console.error("Deploy error:", err);
    await db.collection("app_releases").doc(releaseId).update({
      status: "failed",
      error_message: (err as Error).message,
    });
    throw new HttpsError("internal", (err as Error).message);
  }
});