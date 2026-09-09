/**
 * Marhala-wise Ranking — Firebase (Firestore) backend helpers (Task 1).
 * APPEND-ONLY module. Does NOT touch the Mark Progress write path.
 *
 * Backend reality: `supabase` in this app is a Firebase-backed adapter
 * (see src/supabaseClient.js + src/firebase/db.js). Every "table" is a
 * Firestore collection with the same name/fields:
 *   child_profiles        -> doc id = student_id   (+ field `marhala`)
 *   weekly_results        -> doc id = `${student_id}_${week_date}` (+ optional `marhala` snapshot)
 *   weekly_results_archive-> doc id = `${student_id}_${week_date}`
 *
 * Firestore is schemaless: adding the `marhala` TEXT field needs NO
 * migration — writing it once on a doc creates it. Reads treat a missing
 * field as "" and fall back to Juz-derivation (see ./marhalaRanking.js).
 */

import { supabase } from "../supabaseClient";
import { MARHALA_ORDER } from "./marhalaRanking";

/** Which collections to read depending on portal section (atfal | kibar). */
function collectionsFor(section) {
  const kibar = section === "kibar";
  return {
    profiles: kibar ? "kibar_child_profiles" : "child_profiles",
    results: kibar ? "kibar_weekly_results" : "weekly_results",
    archive: kibar ? "kibar_weekly_results_archive" : "weekly_results_archive",
  };
}

/**
 * Fetch everything the ranking needs in 3 parallel Firestore reads.
 * Returns { profiles, weeklyResults } where weeklyResults = live + archive
 * (deduped by `${student_id}_${week_date}`, live wins).
 */
export async function fetchMarhalaData({ section = "atfal", limit = 10000 } = {}) {
  const c = collectionsFor(section);
  const [profRes, liveRes, archRes] = await Promise.all([
    supabase.from(c.profiles).select("*").order("full_name", { ascending: true }),
    supabase.from(c.results).select("*").order("week_date", { ascending: false }).limit(limit),
    supabase.from(c.archive).select("*").order("week_date", { ascending: false }).limit(5000).then(
      (r) => r,
      () => ({ data: [] })
    ),
  ]);
  if (profRes?.error) throw new Error(profRes.error.message || "Failed to load profiles");
  if (liveRes?.error) throw new Error(liveRes.error.message || "Failed to load weekly results");

  const seen = new Set();
  const weeklyResults = [];
  for (const r of [...(liveRes.data || []), ...(archRes?.data || [])]) {
    const key = `${String(r.student_id || "").trim().toLowerCase()}_${r.week_date || ""}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    weeklyResults.push(r);
  }
  return { profiles: profRes.data || [], weeklyResults };
}

/** All results for one student, newest first (live + archive merged). */
export async function fetchStudentHistory(studentId, { section = "atfal" } = {}) {
  const c = collectionsFor(section);
  const sid = String(studentId || "").trim();
  const [liveRes, archRes] = await Promise.all([
    supabase.from(c.results).select("*").eq("student_id", sid).order("week_date", { ascending: false }),
    supabase.from(c.archive).select("*").eq("student_id", sid).order("week_date", { ascending: false }).then(
      (r) => r,
      () => ({ data: [] })
    ),
  ]);
  const merged = {};
  for (const r of [...(liveRes?.data || []), ...(archRes?.data || [])]) {
    if (r?.week_date && !merged[r.week_date]) merged[r.week_date] = r;
  }
  return Object.values(merged).sort((a, b) => new Date(b.week_date) - new Date(a.week_date));
}

/**
 * Assign a Marhala to a student — writes the `marhala` field on the
 * child_profiles doc (doc id = student_id). Creates the field on first write.
 */
export async function setStudentMarhala(studentId, marhala, { section = "atfal" } = {}) {
  const c = collectionsFor(section);
  const value = MARHALA_ORDER.includes(marhala) ? marhala : String(marhala || "").trim();
  const { error } = await supabase.from(c.profiles).update({ marhala: value }).eq("student_id", String(studentId));
  if (error) throw new Error(error.message || "Failed to save Marhala");
  return value;
}

/**
 * Snapshot the student's Marhala onto a weekly_results doc
 * (doc id = `${student_id}_${week_date}`). Optional per-week record;
 * the ranker prefers the profile value when this is absent.
 */
export async function snapshotMarhalaToResult(studentId, weekDate, marhala, { section = "atfal" } = {}) {
  const c = collectionsFor(section);
  const { error } = await supabase
    .from(c.results)
    .update({ marhala: String(marhala || "").trim() })
    .eq("student_id", String(studentId));
  if (error) throw new Error(error.message || "Failed to snapshot Marhala");
  void weekDate;
  return true;
}
