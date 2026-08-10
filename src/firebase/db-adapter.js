import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./config.js";
import { from } from "./db.js";
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

const RPC_LOCAL = {
  get_all_child_profiles: () => rpcGetAllChildProfiles(),
  get_my_child_profiles: (args) => rpcGetMyChildProfiles(args || {}),
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

async function invokeFunction(name, options = {}) {
  const callableName = FUNCTION_NAMES[name] || name;
  return callFunction(callableName, options.body || {});
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