import { initializeApp, getApps } from "firebase/app";

// Target Firebase project (replaces the Supabase backend): mawaid-b929a
//
// All values are read from VITE_FIREBASE_* env vars (see .env / .env.example),
// with hardcoded fallbacks mirroring src/firebaseConfig.js and
// public/firebase-messaging-sw.js. This keeps deployed builds working even
// when the build server has no VITE_FIREBASE_* vars set — a missing apiKey
// would otherwise crash Firebase Auth with auth/invalid-api-key on startup.
// authDomain and storageBucket are derived from the project id so that only
// the project id needs to change to re-target a different Firebase project.

const projectId =
  import.meta.env.VITE_FIREBASE_PROJECT_ID || "mawaid-b929a";

// Normalize a legacy `PROJECT_ID.appspot.com` storage bucket to the current
// `PROJECT_ID.firebasestorage.app` domain. Firebase Storage buckets are only
// reachable via the .firebasestorage.app host now — the old .appspot.com name
// 404s and fails the CORS preflight (which is exactly what broke photo uploads
// when a stale VITE_FIREBASE_STORAGE_BUCKET was set in a build environment).
// This guard runs at build time so a stale env var can never poison the bundle
// again, regardless of where the build happens (local shell, Vercel, CI).
const normalizeStorageBucket = (bucket) =>
  String(bucket || "").replace(/\.appspot\.com$/i, ".firebasestorage.app");

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyAxoLoIPRZum286Y0uXM3Vq98V3403L7Uo",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: normalizeStorageBucket(
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`
  ),
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "353078822685",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:353078822685:web:9b89c7c156bcb0992bc3f4",
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "B5W2bPUAQQmqbmDf5lF-6g",
};

// ---------------------------------------------------------------------------
// Misconfiguration guard: fail loud in the console instead of a cryptic
// `Firebase: Error (auth/invalid-api-key)` thrown deep inside getAuth().
// Also catches placeholder values copied from .env.example (e.g.
// "your_firebase_api_key"), which are truthy and would otherwise win over
// the hardcoded fallbacks below.
// ---------------------------------------------------------------------------
const PLACEHOLDER_KEYS = [
  "your_firebase_api_key",
  "your_app_id",
  "your_messaging_sender_id",
  "your_project_id",
];

function checkFirebaseConfig(config) {
  const problems = [];
  const isPlaceholder = (value, keys) =>
    !value || keys.some((p) => String(value).includes(p));

  if (isPlaceholder(config.apiKey, PLACEHOLDER_KEYS)) {
    problems.push("VITE_FIREBASE_API_KEY (missing or placeholder)");
  }
  if (!config.messagingSenderId) problems.push("VITE_FIREBASE_MESSAGING_SENDER_ID (missing)");
  if (!config.appId) problems.push("VITE_FIREBASE_APP_ID (missing)");
  if (isPlaceholder(config.projectId, ["your_project_id"])) {
    problems.push("VITE_FIREBASE_PROJECT_ID (missing or placeholder)");
  }
  if (isPlaceholder(config.authDomain, ["your_project_id", "your_auth_domain"])) {
    problems.push("VITE_FIREBASE_AUTH_DOMAIN (missing or placeholder)");
  }
  if (problems.length === 0) return;

  console.error(
    "%c[Firebase Config] MISCONFIGURED BUILD" +
    " - " + problems.join(", ") + ".\n" +
    "Firebase Auth / FCM may fail to initialize (e.g. auth/invalid-api-key).\n" +
    "Fix: set the VITE_FIREBASE_* vars at build time (.env, Vercel/CI env vars)\n" +
    "or correct the fallbacks in src/firebase/config.js.",
    "background:#d93025;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px"
  );
}

checkFirebaseConfig(firebaseConfig);

export const firebaseProjectId = projectId;

let app = null;
try {
  app = getApps()[0] || initializeApp(firebaseConfig);
} catch (err) {
  console.error("Firebase init failed:", err);
}

export const firebaseApp = app;