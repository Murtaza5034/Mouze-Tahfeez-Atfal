/**
 * Marhala-wise Ranking & Result Tracking — APPEND-ONLY utility module.
 *
 * IMPORTANT: This file does NOT modify the core "Mark Progress" system or the
 * existing "Tahfeez Report Card" structure. It only READS students +
 * weekly_results and derives Marhala ranks + Jadeed week-over-week trends.
 *
 * Marhala source (priority order):
 *   1. student.marhala / student.group_name / student.groupName (explicit)
 *   2. latestResult.marhala (if teachers ever store it per-result)
 *   3. Derived from Wusool Juz via MARHALA_JUZ_BUCKETS (fallback)
 *   4. "General" bucket when nothing is available
 *
 * Backend: Firebase Firestore (via the `supabase` adapter). `marhala` is a
 * plain TEXT field on the `child_profiles` doc (doc id = student_id) and,
 * optionally, a per-week snapshot on `weekly_results` docs. Firestore is
 * schemaless so no migration is needed — see marhalaRankingBackend.js
 * (setStudentMarhala / fetchMarhalaData) for the read/write helpers.
 */

// Canonical Marhala order (matches MARHALA_LIBRARY in App.jsx + schedule dropdown)
export const MARHALA_ORDER = [
  "Marhala Ula",
  "Marhala Saniyah",
  "Marhala Salesah",
  "Marhala Rabeah",
  "Marhala Khamesah",
  "Marhala Sadesah",
  "Marhala Sabeah",
  "Marhala Saminah",
];

// Fallback Juz -> Marhala mapping used ONLY when no explicit marhala exists.
// Buckets mirror the MARHALA_LIBRARY ranges (Juz 30 -> Ula, expanding outward).
export const MARHALA_JUZ_BUCKETS = [
  { marhala: "Marhala Ula", juz: [30] },
  { marhala: "Marhala Saniyah", juz: [28, 29, 30] },
  { marhala: "Marhala Salesah", juz: [26, 27, 28, 29, 30] },
  { marhala: "Marhala Rabeah", juz: [1, 2, 3, 4, 5, 26, 27, 28, 29, 30] },
  { marhala: "Marhala Khamesah", juz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 26, 27, 28, 29, 30] },
  { marhala: "Marhala Sadesah", juz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 26, 27, 28, 29, 30] },
  { marhala: "Marhala Sabeah", juz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 26, 27, 28, 29, 30] },
  { marhala: "Marhala Saminah", juz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
];

const norm = (v) => String(v ?? "").trim();

export function deriveMarhalaFromJuz(juz) {
  const n = Number(String(juz ?? "").trim());
  if (!n || Number.isNaN(n)) return "";
  // Pick the SMALLEST bucket containing this Juz (most specific Marhala)
  for (const b of MARHALA_JUZ_BUCKETS) {
    if (b.juz.includes(n)) return b.marhala;
  }
  return "";
}

/**
 * Resolve the Marhala for a student.
 * Explicit assignment always wins; Juz-derivation is a graceful fallback.
 */
export function getStudentMarhala(student, weeklyResult) {
  const explicit =
    norm(student?.marhala) ||
    norm(weeklyResult?.marhala) ||
    "";
  if (explicit) {
    const hit = MARHALA_ORDER.find((m) => m.toLowerCase() === explicit.toLowerCase());
    return hit || explicit;
  }
  // NOTE: group_name is a teacher-group, NOT a Marhala — do not conflate.
  // Only derive from Juz as a last resort so the page still works pre-migration.
  const juz = weeklyResult?.wusool_juz ?? student?.hifz?.juz ?? student?.juz ?? "";
  const derived = deriveMarhalaFromJuz(juz);
  return derived || "General";
}

export function sortMarhalaKeys(keys) {
  return [...keys].sort((a, b) => {
    const ia = MARHALA_ORDER.indexOf(a);
    const ib = MARHALA_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return String(a).localeCompare(String(b));
  });
}

// ---- Score helpers (mirror calculateEffectiveScore — read-only copy) ----
export function effectiveScore(r) {
  if (!r) return 0;
  if (r.total_score !== undefined && r.total_score !== null && r.total_score !== "") return Number(r.total_score);
  return (Number(r.murajazah) || 0) + (Number(r.juz_hali) || 0) + (Number(r.takhteet) || 0) + (Number(r.jadeed) || 0);
}

export function jadeedPagesNum(r) {
  return Number(String(r?.total_jadeed_pages ?? "").replace(/[^0-9.]/g, "")) || 0;
}

// ---- Jadeed (satar / safah) helpers ----
export function parseJadeed(result) {
  const value = jadeedPagesNum(result);
  const unitRaw = norm(result?.total_jadeed_unit);
  // Units: "سطر..." = Satar (lines), "صفه..." = Safah (pages)
  const unit = unitRaw.startsWith("سطر") || /satar/i.test(unitRaw) ? "satar" : "safah";
  return { value, unit, unitRaw: unitRaw || "صفه" };
}

/**
 * Week-over-week Jadeed trend.
 * CONDITION A: current did >= 1 extra satar/safah vs previous -> 'up' (glowing GREEN)
 * CONDITION B: less or same -> 'down' (standard RED)
 * No previous week data -> 'neutral'
 */
export function getJadeedTrend(currentResult, previousResult) {
  if (!currentResult || !previousResult) return "neutral";
  const curr = parseJadeed(currentResult);
  const prev = parseJadeed(previousResult);
  const diff = curr.value - prev.value;
  if (diff >= 1) return "up";
  return "down";
}

/** All id forms a student may appear under in weekly_results
 * (mirrors the allIds logic in buildStudents — result rows often use a
 * different id form than child_profiles.student_id). */
export function getStudentIdCandidates(student) {
  const keys = new Set();
  const push = (v) => {
    const s = String(v ?? "").trim().toLowerCase();
    if (s && s !== "n-a" && s !== "...") keys.add(s);
  };
  if (student && typeof student === "object") {
    push(student.student_id);
    push(student.id);
    push(student.its);
    push(student.its_number);
    push(student.user_id);
    (student.allIds || []).forEach(push);
  } else {
    push(student);
  }
  return [...keys];
}

function getStudentNameKeys(student) {
  const names = new Set();
  if (student && typeof student === "object") {
    [student.name, student.full_name, student.student_name].forEach((n) => {
      const t = String(n || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (t) names.add(t);
    });
  }
  return [...names];
}

export function getPreviousWeeklyResult(studentOrId, weeklyResults, currentWeekDate) {
  if (!studentOrId || !Array.isArray(weeklyResults)) return null;
  const isObj = typeof studentOrId === "object";
  const candidates = new Set(getStudentIdCandidates(studentOrId));
  let rows = weeklyResults.filter((r) => {
    if (!r?.week_date) return false;
    return candidates.has(String(r?.student_id ?? "").trim().toLowerCase());
  });
  if (rows.length === 0 && isObj) {
    // Same fallback buildStudents uses: match by normalized name.
    const nameKeys = getStudentNameKeys(studentOrId);
    if (nameKeys.length > 0) {
      rows = weeklyResults.filter((r) => {
        if (!r?.week_date) return false;
        const rn = String(r?.student_name || r?.name || r?.full_name || "").trim().toLowerCase().replace(/\s+/g, " ");
        return rn && nameKeys.has(rn);
      });
    }
  }
  rows.sort((a, b) => new Date(b.week_date) - new Date(a.week_date));
  if (rows.length === 0) return null;
  if (!currentWeekDate) return rows[0] || null;
  const curr = String(currentWeekDate);
  const idx = rows.findIndex((r) => String(r.week_date) === curr);
  if (idx === -1) return rows[0] || null; // current not in history -> latest is previous
  return rows[idx + 1] || null;
}

// ---- Core: Marhala-wise ranking ----
function rankBasis(r) {
  return {
    score: effectiveScore(r),
    jadeed: Number(r?.jadeed) || 0,
    jadeedPages: jadeedPagesNum(r),
    attendance: Number(r?.attendance_count) || 0,
  };
}

function compareBasis(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (b.jadeed !== a.jadeed) return b.jadeed - a.jadeed;
  if (b.jadeedPages !== a.jadeedPages) return b.jadeedPages - a.jadeedPages;
  return b.attendance - a.attendance;
}

/**
 * Group students by Marhala and rank WITHIN each Marhala by Juz results.
 * Returns: { groups: { [marhala]: RankedStudent[] }, marhalaRankById: Map, orderedMarhalas: string[] }
 * RankedStudent = { ...student, marhala, marhalaRank, marhalaRankChange, jadeedTrend, jadeed: {value, unit}, prevResult }
 */
export function calculateMarhalaRanks(students = [], weeklyResults = []) {
  const groups = {};
  (students || []).forEach((s) => {
    if (!s) return;
    const marhala = getStudentMarhala(s, s.latestResult);
    if (!groups[marhala]) groups[marhala] = [];
    groups[marhala].push(s);
  });

  const marhalaRankById = new Map();
  const rankedGroups = {};
  const jadeedTrendById = new Map();

  Object.keys(groups).forEach((marhala) => {
    const members = groups[marhala]
      .map((s) => ({ ...s, marhala, _basis: rankBasis(s.latestResult) }))
      .sort((a, b) => compareBasis(a._basis, b._basis));

    let prevRank = 1;
    const ranked = members.map((s, idx) => {
      let currentRank = idx + 1;
      if (idx > 0) {
        const p = members[idx - 1]._basis;
        const c = s._basis;
        if (p.score === c.score && p.jadeed === c.jadeed && p.jadeedPages === c.jadeedPages && p.attendance === c.attendance) {
          currentRank = prevRank;
        }
      }
      prevRank = currentRank;

      // Rank movement: compare against the student's previous-week MARHALA rank
      // when history exists, else fall back to the global previousWeekRank signal.
      let marhalaRankChange = null;
      const prevResult = getPreviousWeeklyResult(s, weeklyResults, s.latestResult?.week_date);
      if (prevResult) {
        const prevBasis = rankBasis(prevResult);
        // Count members whose CURRENT basis beats this student's PREVIOUS basis
        // (approximation of last week's marhala standing with the same cohort).
        let prevRankCalc = 1;
        members.forEach((m) => {
          if (compareBasis(m._basis, prevBasis) < 0) prevRankCalc += 1;
        });
        if (currentRank < prevRankCalc) marhalaRankChange = "up";
        else if (currentRank > prevRankCalc) marhalaRankChange = "down";
        else marhalaRankChange = "same";
      } else if (s.previousWeekRank && s.latestResult?.computedRank) {
        const cr = s.latestResult.computedRank;
        const pr = s.previousWeekRank;
        marhalaRankChange = cr < pr ? "up" : cr > pr ? "down" : "same";
      }

      const jadeedTrend = getJadeedTrend(s.latestResult, prevResult);
      const jadeed = parseJadeed(s.latestResult);

      const rankedStudent = {
        ...s,
        marhala,
        marhalaRank: s.latestResult ? currentRank : null,
        marhalaRankChange,
        jadeedTrend,
        jadeed,
        prevResult,
        prevJadeed: prevResult ? parseJadeed(prevResult) : null,
      };
      delete rankedStudent._basis;

      const key = String(s.student_id ?? s.id ?? "").trim().toLowerCase();
      if (key) marhalaRankById.set(key, { rank: rankedStudent.marhalaRank, marhala, change: marhalaRankChange });
      if (key) jadeedTrendById.set(key, rankedStudent.jadeedTrend || "neutral");
      return rankedStudent;
    });

    rankedGroups[marhala] = ranked;
  });

  return { groups: rankedGroups, marhalaRankById, jadeedTrendById, orderedMarhalas: sortMarhalaKeys(Object.keys(rankedGroups)) };
}

/** Lookup helper for the Tahfeez Report Card injection (Task 4). */
export function getMarhalaRankForStudent(student, students = [], weeklyResults = [], cache) {
  if (!student) return null;
  const key = String(student.student_id ?? student.id ?? "").trim().toLowerCase();
  if (!key) return null;
  // Fast path: already enriched
  if (student.marhalaRank) return { rank: student.marhalaRank, marhala: student.marhala || getStudentMarhala(student, student.latestResult), change: student.marhalaRankChange || null };
  const map = cache?.marhalaRankById || calculateMarhalaRanks(students, weeklyResults).marhalaRankById;
  return map.get(key) || null;
}

/**
 * Jadeed week-over-week trend for one student ('up' | 'down' | 'neutral').
 * Same CONDITION A/B flow as the Marhala page Jadeed box — for the
 * Tahfeez Report Card Jadeed (Jumla Satar / Jumla Safah) card arrow.
 * Prefers the memoized cache; falls back to a direct prev-week lookup.
 */
export function getJadeedTrendForStudent(student, students = [], weeklyResults = [], cache, currentOverride = null) {
  const current = currentOverride || student?.latestResult || null;
  if (!student && !current) return "neutral";
  const key = String(student?.student_id ?? student?.id ?? current?.student_id ?? "").trim().toLowerCase();
  // Fast path: memoized trend (computed with the same id-candidate matching).
  // Skip it when an override (e.g. unsaved teacher preview) is displayed.
  if (!currentOverride && key && cache?.jadeedTrendById?.has(key)) {
    const cached = cache.jadeedTrendById.get(key);
    // A cached "neutral" may only mean the cached list lacked latestResult —
    // retry directly when this student object actually has one.
    if (cached !== "neutral" || !current) return cached;
  }
  if (!key) return "neutral";
  const prev = getPreviousWeeklyResult(student || current, weeklyResults, current?.week_date);
  return getJadeedTrend(current, prev);
}

/**
 * EXACT full-cohort Marhala rank for a single student, computed from the
 * complete weekly_results table (live + archive) WITHOUT needing other
 * students' profiles.
 *
 * Why this exists: the parent portal only loads its own children's profiles,
 * so ranking the family subset gives a WRONG rank (e.g. 2nd of 2 siblings
 * instead of 3rd in the Marhala). The full results table alone is enough:
 * identity/score/marhala-flags all live on the result rows (Marhala falls
 * back to Wusool-Juz derivation exactly like the admin table when no
 * explicit marhala exists). The real profile is swapped in for SELF so its
 * explicit marhala + displayed result match the admin table precisely.
 *
 * Returns { rank, marhala, change } (same shape as the rank map) or null.
 */
export function getExactMarhalaRankForStudent(student, fullWeeklyResults = [], currentOverride = null) {
  if (!student) return null;
  const rows = (Array.isArray(fullWeeklyResults) ? fullWeeklyResults : []).filter((r) => r?.week_date);
  if (rows.length === 0) return null;
  const selfKeys = new Set(getStudentIdCandidates(student));
  if (selfKeys.size === 0) return null;
  const selfNames = new Set(
    [student?.name, student?.full_name]
      .map((n) => String(n || "").trim().toLowerCase().replace(/\s+/g, " "))
      .filter(Boolean)
  );
  // Latest row per student_id (newest week wins).
  const sorted = rows.slice().sort((a, b) => new Date(b.week_date) - new Date(a.week_date));
  const latestBySid = new Map();
  sorted.forEach((r) => {
    const sid = String(r.student_id ?? "").trim().toLowerCase();
    if (sid && !latestBySid.has(sid)) latestBySid.set(sid, r);
  });
  if (latestBySid.size === 0) return null;
  const rowName = (r) =>
    String(r?.student_name || r?.name || r?.full_name || "").trim().toLowerCase().replace(/\s+/g, " ");
  const synths = [];
  latestBySid.forEach((latest, sid) => {
    synths.push({
      student_id: sid,
      id: sid,
      name: latest.student_name || latest.name || latest.full_name || sid,
      full_name: latest.full_name || latest.student_name || latest.name || sid,
      marhala: latest.marhala || "",
      latestResult: latest,
      allIds: [sid],
    });
  });
  const selfCurrent = currentOverride || student.latestResult || null;
  let selfIdx = synths.findIndex((s) => selfKeys.has(String(s.student_id)));
  if (selfIdx === -1 && selfNames.size > 0) {
    selfIdx = synths.findIndex((s) => selfNames.has(rowName(s.latestResult)));
  }
  if (selfIdx === -1 || !selfCurrent) return null;
  const selfSid = synths[selfIdx].student_id;
  synths[selfIdx] = {
    ...student,
    student_id: selfSid,
    id: selfSid,
    allIds: [...selfKeys],
    latestResult: selfCurrent,
    marhalaRank: undefined,
    marhalaRankChange: undefined,
  };
  const { marhalaRankById } = calculateMarhalaRanks(synths, rows);
  for (const k of selfKeys) {
    if (marhalaRankById.has(k)) return marhalaRankById.get(k);
  }
  return marhalaRankById.get(selfSid) || null;
}
/** Dashboard summary for the Overview infographic card (Task 2). */
export function getMarhalaOverview(students = [], weeklyResults = []) {
  const { groups, orderedMarhalas } = calculateMarhalaRanks(students, weeklyResults);
  const totalRanked = Object.values(groups).reduce((n, g) => n + g.filter((s) => s.latestResult).length, 0);
  const toppers = {};
  orderedMarhalas.forEach((m) => {
    const top = (groups[m] || []).find((s) => s.latestResult);
    if (top) toppers[m] = top.name || top.full_name || "—";
  });
  return { marhalaCount: orderedMarhalas.length, totalRanked, toppers, orderedMarhalas, groups };
}
