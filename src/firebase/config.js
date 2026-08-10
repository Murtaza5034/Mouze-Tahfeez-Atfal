import { initializeApp, getApps } from "firebase/app";

// Target Firebase project (replaces the Supabase backend): mawaid-b929a
//
// All values are read from VITE_FIREBASE_* env vars (see .env / .env.example).
// authDomain and storageBucket are derived from the project id so that only
// the project id needs to change to re-target a different Firebase project.

const projectId =
  import.meta.env.VITE_FIREBASE_PROJECT_ID || "mawaid-b929a";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

export const firebaseProjectId = projectId;

let app = null;
try {
  app = getApps()[0] || initializeApp(firebaseConfig);
} catch (err) {
  console.error("Firebase init failed:", err);
}

export const firebaseApp = app;