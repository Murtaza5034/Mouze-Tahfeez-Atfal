import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./config.js";
import { from, getSectionScope } from "./db.js";
import authApi from "./auth.js";
import storageApi from "./storage.js";
import {
  channel,
  removeChannel,
  removeAllChannels,
} from "./realtime.js";

// ---------------------------------------------------------------------------
// Supabase-compatible adapter backed by Firebase.
//
// This object keeps the exact shape the app already uses everywhere:
//   supabase.from(table).select().eq(...)...
//   supabase.rpc(...)
//   supabase.auth.getUser() / signInWithPassword(...) / ...
//   supabase.functions.invoke('name', { body })
//   supabase.storage.from(bucket).upload / getPublicUrl
//   supabase.channel(name).on(...).subscribe() / removeChannel(...)
// ---------------------------------------------------------------------------

const functions = getFunctions(firebaseApp, undefined);

const callableCache = new Map();
function callFunction(name, data) {
  if (!callableCache.has(name)) {
    callableCache.set(name, httpsCallable(functions, name));
  }
  const fn = callableCache.get(name);
  return fn(data)
    .then((res) => ({ data: res.data ?? null, error: null }))
    .catch((err) => {
      let message = err?.message || String(err);
      // firebase-functions wraps HttpsError details into `message`; surface
      // the server-provided message when available.
      const detailMsg =
        err && err.details && typeof err.details === "object" && err.details.message;
      if (detailMsg) message = detailMsg;
      return { data: null, error: { message, code: err?.code || "functions" } };
    });
}

// Edge function name -> Cloud Function name
const FUNCTION_NAMES = {
  "fcm-notification": "sendFcm",
  "whatsapp-notification": "sendWhatsapp",
  "send-email": "sendEmail",
  "get-global-rank": "getGlobalRank",
  "result-live-notifier": "sendResultLiveNotifier",
  "process-scheduled-notifications": "processScheduledNotifications",
  "jadwal-reminder": "sendJadwalReminder",
  "deploy-android-app": "deployAndroidApp",
  "reset-user-password": "resetUserPassword",
  "get-user-by-email": "getUserByEmail",
};

// ---------------------------------------------------------------------------
// RPCs that can run fully client-side against Firestore.
// ---------------------------------------------------------------------------

async function rpcGetAllChildProfiles() {
  const { data, error } = await from("child_profiles").select("*").limit(100000);
  if (error) return { data: [], error };
  return { data: data || [], error: null };
}

async function rpcGetMyChildProfiles({ p_user_id, p_email } = {}) {
  const uId = String(p_user_id || "").trim().toLowerCase();
  const em = String(p_email || "").trim().toLowerCase();

  // Native filtered queries so Firestore rules only hand this parent their own
  // children. The child_profiles rules gate reads on parent_user_id, so that
  // is the provable query path.
  const results = [];
  let lastError = null;

  if (uId) {
    // 1. Direct student lookup by user ID
    const { data: dId, error: eId } = await from("child_profiles")
      .select("*")
      .eq("id", uId);
    if (!eId && dId) results.push(...dId);

    // 2. Parent user ID query
    const { data, error } = await from("child_profiles")
      .select("*")
      .eq("parent_user_id", uId)
      .limit(100000);
    if (error) lastError = error;
    else results.push(...(data || []));
  } else if (em) {
    // Email-only match (no user id linked): the parent_user_id rule blocks a
    // plain email query, so emulate the Supabase server-side filter by
    // fetching the parent's own user_portal_access first, then matching by id.
    const { data: pa, error: paErr } = await from("user_portal_access")
      .select("*")
      .eq("email", em)
      .limit(10);
    if (paErr) lastError = paErr;
    else {
      const uidFromEmail = (pa && pa[0] && pa[0].user_id) || null;
      if (uidFromEmail) {
        const { data, error } = await from("child_profiles")
          .select("*")
          .eq("parent_user_id", uidFromEmail)
          .limit(100000);
        if (error) lastError = error;
        else results.push(...(data || []));
      }
    }
  }

  const seen = new Set();
  const rows = results.filter((p) => {
    const sid = String(p.student_id || "");
    if (seen.has(sid)) return false;
    seen.add(sid);
    return true;
  });
  return { data: rows, error: lastError };
}

async function rpcGetUserIdByEmail({ target_email } = {}) {
  const email = String(target_email || "").trim().toLowerCase();
  if (!email) return { data: null, error: null };
  const { data, error } = await from("user_portal_access").select("*").limit(100000);
  if (!error && Array.isArray(data)) {
    const hit = data.find((r) => String(r.email || "").trim().toLowerCase() === email);
    if (hit && hit.user_id) return { data: hit.user_id, error: null };
  }
  // Also check the `users` collection (Firebase auth users).
  const { data: users, error: uErr } = await from("users").select("*").limit(100000);
  if (!uErr && Array.isArray(users)) {
    const hit = users.find((r) => String(r.email || "").trim().toLowerCase() === email);
    if (hit && hit.id) return { data: hit.id, error: null };
  }
  return { data: null, error: null };
}

// Kibar equivalent: get all kibar child profiles
async function rpcGetAllKibarChildProfiles() {
  const { data, error } = await from("kibar_child_profiles").select("*").limit(100000);
  if (error) return { data: [], error };
  return { data: data || [], error: null };
}

// Kibar equivalent: get my kibar child profiles
async function rpcGetMyKibarChildProfiles({ p_user_id, p_email } = {}) {
  const uId = String(p_user_id || "").trim().toLowerCase();
  const em = String(p_email || "").trim().toLowerCase();

  // Native filtered queries so Firestore rules only hand this parent their own
  // children. The kibar_child_profiles rules gate reads on parent_user_id, so that
  // is the provable query path.
  const results = [];
  let lastError = null;

  if (uId) {
    // 1. Direct student lookup by user ID
    const { data: dId, error: eId } = await from("kibar_child_profiles")
      .select("*")
      .eq("id", uId);
    if (!eId && dId) results.push(...dId);

    // 2. Parent user ID query
    const { data, error } = await from("kibar_child_profiles")
      .select("*")
      .eq("parent_user_id", uId)
      .limit(100000);
    if (error) lastError = error;
    else results.push(...(data || []));
  } else if (em) {
    // Email-only match (no user id linked): the parent_user_id rule blocks a
    // plain email query, so emulate the Supabase server-side filter by
    // fetching the parent's own kibar_user_portal_access first, then matching by id.
    const { data: pa, error: paErr } = await from("kibar_user_portal_access")
      .select("*")
      .eq("email", em)
      .limit(10);
    if (paErr) lastError = paErr;
    else {
      const uidFromEmail = (pa && pa[0] && pa[0].user_id) || null;
      if (uidFromEmail) {
        const { data, error } = await from("kibar_child_profiles")
          .select("*")
          .eq("parent_user_id", uidFromEmail)
          .limit(100000);
        if (error) lastError = error;
        else results.push(...(data || []));
      }
    }
  }

  const seen = new Set();
  const rows = results.filter((p) => {
    const sid = String(p.student_id || "");
    if (seen.has(sid)) return false;
    seen.add(sid);
    return true;
  });
  return { data: rows, error: lastError };
}

// Kibar Student Profiles - for admin/teacher access to all student profiles
async function rpcGetAllKibarStudentProfiles() {
  const { data, error } = await from("kibar_student_profiles").select("*").limit(100000);
  if (error) return { data: [], error };
  return { data: data || [], error: null };
}

// Kibar Teacher Profiles - for admin access to all kibar teacher profiles
async function rpcGetAllKibarTeacherProfiles() {
  const { data, error } = await from("kibar_teacher_profiles").select("*").limit(100000);
  if (error) return { data: [], error };
  return { data: data || [], error: null };
}

const RPC_LOCAL = {
  get_all_child_profiles: () => rpcGetAllChildProfiles(),
  get_my_child_profiles: (args) => rpcGetMyChildProfiles(args || {}),
  get_all_kibar_child_profiles: () => rpcGetAllKibarChildProfiles(),
  get_my_kibar_child_profiles: (args) => rpcGetMyKibarChildProfiles(args || {}),
  get_all_kibar_student_profiles: () => rpcGetAllKibarStudentProfiles(),
  get_all_kibar_teacher_profiles: () => rpcGetAllKibarTeacherProfiles(),
  get_user_id_by_email: (args) => rpcGetUserIdByEmail(args || {}),
  trigger_clear_all_marks: (args) =>
    callFunction("clearAllMarks", args || {}),
  reset_user_password: (args) =>
    callFunction("resetUserPassword", args || {}),
};

async function rpc(name, args = {}) {
  const local = RPC_LOCAL[name];
  if (local) {
    try {
      return await local(args);
    } catch (e) {
      return { data: null, error: { message: e.message || String(e) } };
    }
  }
  return callFunction(name, args);
}

// ---------------------------------------------------------------------------
// `functions.invoke(name, { body })` -> httpsCallable
// ---------------------------------------------------------------------------

// Local rank calculation engine for getGlobalRank / get-global-rank to eliminate
// remote 503 errors and eliminate redundant network load.
async function computeGlobalRankLocally(body = {}) {
  try {
    const section = body.section || getSectionScope();
    const table = section === "kibar" ? "kibar_weekly_results" : "weekly_results";

    let q = from(table).select("*");
    if (body.week_date) {
      q = q.eq("week_date", body.week_date);
    }
    const { data: results, error } = await q.limit(10000);
    if (error && (!results || results.length === 0)) {
      return { data: { rank: null, ranks: {} }, error: null };
    }

    const map = new Map();
    (results || []).forEach((r) => {
      const sid = String(r.student_id || "").trim();
      if (sid) map.set(sid, { ...r });
    });

    if (body.student_id && body.preview) {
      const targetSid = String(body.student_id).trim();
      const existing = map.get(targetSid) || { student_id: targetSid };
      map.set(targetSid, {
        ...existing,
        ...body.preview,
        student_id: targetSid,
      });
    }

    const withScores = Array.from(map.values()).map((r) => {
      const eff =
        (Number(r.murajazah) || 0) +
        (Number(r.juz_hali) || 0) +
        (Number(r.takhteet) || 0) +
        (Number(r.jadeed) || 0);
      const j = Number(r.jadeed) || 0;
      const jp =
        Number(String(r.total_jadeed_pages ?? "").replace(/[^0-9.]/g, "")) || 0;
      const att = Number(r.attendance_count) || 0;
      return {
        student_id: String(r.student_id || "").trim(),
        _effScore:
          r.total_score !== undefined &&
          r.total_score !== null &&
          r.total_score !== ""
            ? Number(r.total_score)
            : eff,
        _jadeed: j,
        _jadeedPages: jp,
        _attendance: att,
      };
    });

    withScores.sort((a, b) => {
      const scoreDiff = b._effScore - a._effScore;
      if (scoreDiff !== 0) return scoreDiff;
      const jadeedDiff = b._jadeed - a._jadeed;
      if (jadeedDiff !== 0) return jadeedDiff;
      const jpDiff = b._jadeedPages - a._jadeedPages;
      if (jpDiff !== 0) return jpDiff;
      return b._attendance - a._attendance;
    });

    const ranks = {};
    let prevRank = 1;
    withScores.forEach((s, idx) => {
      let currentRank = idx + 1;
      if (idx > 0) {
        const prev = withScores[idx - 1];
        if (
          prev._effScore === s._effScore &&
          prev._jadeed === s._jadeed &&
          prev._jadeedPages === s._jadeedPages &&
          prev._attendance === s._attendance
        ) {
          currentRank = prevRank;
        }
      }
      prevRank = currentRank;
      ranks[s.student_id] = currentRank;
      ranks[s.student_id.toLowerCase()] = currentRank;
    });

    const targetSid = body.student_id ? String(body.student_id).trim() : null;
    const rank = targetSid
      ? ranks[targetSid] || ranks[targetSid.toLowerCase()] || null
      : null;

    return { data: { ranks, rank }, error: null };
  } catch (_e) {
    return { data: { rank: null, ranks: {} }, error: null };
  }
}

async function invokeFunction(name, options = {}) {
  const callableName = FUNCTION_NAMES[name] || name;
  const body = options.body || {};
  if (body.section === undefined) {
    body.section = getSectionScope();
  }

  // Fast local resolution for getGlobalRank / get-global-rank
  if (callableName === "getGlobalRank" || name === "get-global-rank") {
    return computeGlobalRankLocally(body);
  }

  return callFunction(callableName, body);
}

// ---------------------------------------------------------------------------
// Temp auth client used by admin portal-account creation.
// `createClient(url, key, { persistSession:false })` in the app creates a
// throw-away client. Firebase has a single Auth instance, so signUp must go
// through a provisioning Cloud Function (never hijacks the admin's session).
// ---------------------------------------------------------------------------

function createClient(url, key, options = {}) {
  return {
    auth: {
      signUp: async ({ email, password, options: signUpOptions }) => {
        try {
          const res = await callFunction("provisionUser", {
            email,
            password,
            data: signUpOptions && signUpOptions.data,
          });
          const user = (res.data && res.data.user) || null;
          return { data: { user }, error: null };
        } catch (err) {
          return {
            data: { user: null, session: null },
            error: { message: err.message || String(err) },
          };
        }
      },
      getUser: authApi.getUser,
      signInWithPassword: authApi.signInWithPassword,
      signOut: authApi.signOut,
      updateUser: authApi.updateUser,
      onAuthStateChange: authApi.onAuthStateChange,
      getSession: authApi.getSession,
      refreshSession: authApi.refreshSession,
    },
  };
}

// ---------------------------------------------------------------------------

const supabase = {
  from,
  rpc,
  auth: authApi,
  storage: storageApi,
  channel,
  removeChannel,
  removeAllChannels,
  getChannels() {
    return [];
  },
  functions: {
    invoke: invokeFunction,
  },
};

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://medypnbcsjytbxiwenob.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "anon";

export { supabase, supabaseUrl, supabaseAnonKey, createClient };
export default supabase;