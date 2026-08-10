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

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyAxoLoIPRZum286Y0uXM3Vq98V3403L7Uo",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "353078822685",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:353078822685:android:8f83b293733213472bc3f4",
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "B5W2bPUAQQmqbmDf5lF-6g",
};

export const firebaseProjectId = projectId;

let app = null;
try {
  app = getApps()[0] || initializeApp(firebaseConfig);
} catch (err) {
  console.error("Firebase init failed:", err);
}

export const firebaseApp = app;