// Data-access layer for Mauze Tahfeez.
//
// This module used to export the Supabase client. The backend has moved to
// Firebase (project: mawaid-b929a) — Auth, Firestore, Cloud Functions and
// Storage. `supabase` is now a Firebase-backed adapter that keeps the exact
// same query surface the app already uses, so the UI code is unchanged.
//
// See docs/FIREBASE_MIGRATION.md for the full blueprint.

import firebaseCompat, { createClient as createFirebaseClient } from "./firebase/db-adapter.js";

export const supabase = firebaseCompat;

export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://medypnbcsjytbxiwenob.supabase.co";

export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "anon";

// Supabase's createClient() is used once (admin portal-account creation) with
// a throw-away client. Return a Firebase-backed shim instead.
export function createClient(url, key, options) {
  return createFirebaseClient(url, key, options);
}

export default firebaseCompat;