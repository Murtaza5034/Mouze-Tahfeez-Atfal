/**
 * Monthly Marhala-wise Results — APPEND-ONLY aggregation module.
 *
 * Mirrors the weekly Marhala ranking flow (see ./marhalaRanking.js) but
 * aggregates each student's weekly_results per calendar month:
 *   - Avg Score / Murajazah / Juz Hali / Takhteet / Jadeed marks (averages)
 *   - Jadeed pages (TOTAL satar/safah across the month's weeks)
 *   - Attendance (TOTAL present out of weeks x 6)
 *   - Rank WITHIN (month, marhala) + rank movement vs previous month
 *   - Jadeed trend: this month TOTAL vs last month TOTAL
 *     (CONDITION A: +1 or more -> 'up' glowing green,
 *      CONDITION B: less/same -> 'down' red, none -> 'neutral')
 *
 * Read-only: never writes to Mark Progress or any collection.
 */

import {
  getStudentMarhala,
  sortMarhalaKeys,
  effectiveScore,
  parseJadeed,
  getStudentIdCandidates,
} from "./marhalaRanking";

const normName = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function monthKeyOf(weekDate) {
  const d = new Date(weekDate);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabelOf(monthKey) {
  const parts = String(monthKey || "").split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  if (Number.isNaN(d.getTime())) return monthKey;
  return d.toLocaleString("default", { month: "long", year: "numeric" });
}

const round1 = (n) => Math.round(Number(n) * 10) / 10;

function rankBasis(m) {
  return {
    score: m.avgScore,
    jadeed: m.avgJadeedMarks,
    jadeedPages: m.totalJadeed,
    attendance: m.attendanceTotal,
  };
}

function compareBasis(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (b.jadeed !== a.jadeed) return b.jadeed - a.jadeed;
  if (b.jadeedPages !== a.jadeedPages) return b.jadeedPages - a.jadeedPages;
  return b.attendance - a.attendance;
}

/**
 * Main entry: (students, weeklyResults incl. archive) ->
 * { months: { [monthKey]: { label, groups, orderedMarhalas } },
 *   orderedMonths (latest first),
 *   monthKeysAsc (oldest first, for trend lookup) }
 * Row = { pkey, name, arabic_name, groupName, marhala, monthKey,
 *   weeksCount, avgScore, avgMurajazah, avgJuzHali, avgTakhteet, avgJadeedMarks,
 *   totalJadeed, jadeedUnit, prevJadeed, jadeedTrend,
 *   attendanceTotal, attendanceMax, wusool:{juz,surah,page}, weekDates,
 *   marhalaRank, marhalaRankChange }
 */
export function calculateMonthlyMarhalaResults(students = [], weeklyResults = []) {
  // Index profiles by every id form + name (same matching as buildStudents).
  const byId = new Map();
  const byName = new Map();
  (students || []).forEach((s) => {
    if (!s) return;
    const pkey = String(s.student_id ?? s.id ?? "").trim().toLowerCase();
    if (pkey) s.__mpkey = pkey;
    getStudentIdCandidates(s).forEach((k) => {
      if (!byId.has(k)) byId.set(k, s);
    });
    [s.name, s.full_name].forEach((n) => {
      const t = normName(n);
      if (t && !byName.has(t)) byName.set(t, s);
    });
  });

  // Aggregate per (student, month).
  const buckets = new Map();
  (weeklyResults || []).forEach((r) => {
    if (!r?.week_date) return;
    const month = monthKeyOf(r.week_date);
    if (!month) return;
    const cands = getStudentIdCandidates({ student_id: r.student_id, id: r.student_id });
    let profile = null;
    for (const k of cands) {
      if (byId.has(k)) { profile = byId.get(k); break; }
    }
    if (!profile) {
      const t = normName(r.student_name || r.name || r.full_name);
      if (t && byName.has(t)) profile = byName.get(t);
    }
    const pkey = profile
      ? profile.__mpkey || String(profile.student_id ?? profile.id ?? "").trim().toLowerCase()
      : `orphan:${String(r.student_id || "").trim().toLowerCase() || normName(r.student_name || r.name || r.full_name)}`;
    const bkey = `${pkey}|${month}`;
    if (!buckets.has(bkey)) {
      buckets.set(bkey, {
        pkey,
        profile,
        orphanName: profile ? "" : r.student_name || r.name || r.full_name || "Student",
        orphanGroup: profile ? "" : r.group_name || r.groupName || "",
        month,
        weeks: [],
      });
    }
    buckets.get(bkey).weeks.push(r);
  });

  // Build month rows with aggregates.
  const monthRows = {}; // monthKey -> row[]
  buckets.forEach((b) => {
    const weeks = b.weeks
      .slice()
      .sort((x, y) => new Date(x.week_date) - new Date(y.week_date));
    const n = weeks.length;
    const avg = (f) => (n ? round1(weeks.reduce((s, r) => s + (Number(f(r)) || 0), 0) / n) : 0);
    const avgScore = n
      ? round1(weeks.reduce((s, r) => s + effectiveScore(r), 0) / n)
      : 0;
    // Jadeed TOTAL (sum) + unit of the latest week in the month.
    const latest = weeks[n - 1];
    const unitOf = (r) => parseJadeed(r).unit;
    const monthUnit = unitOf(latest);
    const totalJadeed = round1(
      weeks.reduce((s, r) => s + (Number(String(r?.total_jadeed_pages ?? "").replace(/[^0-9.]/g, "")) || 0), 0)
    );
    const attTotal = weeks.reduce((s, r) => s + (Number(r?.attendance_count) || 0), 0);
    const displayName = b.profile
      ? b.profile.name || b.profile.full_name || "Student"
      : b.orphanName;
    const marhala = getStudentMarhala(b.profile || {}, latest);
    const row = {
      pkey: b.pkey,
      name: displayName,
      arabic_name: b.profile?.arabic_name || "",
      groupName: b.profile?.groupName || b.profile?.group_name || b.orphanGroup || "",
      marhala,
      monthKey: b.month,
      weeksCount: n,
      avgScore,
      avgMurajazah: avg((r) => r.murajazah),
      avgJuzHali: avg((r) => r.juz_hali),
      avgTakhteet: avg((r) => r.takhteet),
      avgJadeedMarks: avg((r) => r.jadeed),
      totalJadeed,
      jadeedUnit: monthUnit,
      prevJadeed: null,
      jadeedTrend: "neutral",
      attendanceTotal: attTotal,
      attendanceMax: n * 6,
      wusool: {
        juz: latest?.wusool_juz || "",
        surah: latest?.wusool_surah || "",
        page: latest?.wusool_page || "",
      },
      weekDates: weeks.map((r) => r.week_date),
      marhalaRank: null,
      marhalaRankChange: null,
    };
    if (!monthRows[b.month]) monthRows[b.month] = [];
    monthRows[b.month].push(row);
  });

  // Rank WITHIN each (month, marhala).
  const months = {};
  Object.keys(monthRows).forEach((month) => {
    const groups = {};
    monthRows[month].forEach((row) => {
      if (!groups[row.marhala]) groups[row.marhala] = [];
      groups[row.marhala].push({ ...row, _basis: rankBasis(row) });
    });
    const rankedGroups = {};
    Object.keys(groups).forEach((marhala) => {
      const members = groups[marhala].sort((a, b) => compareBasis(a._basis, b._basis));
      let prevRank = 1;
      rankedGroups[marhala] = members.map((m, idx) => {
        let currentRank = idx + 1;
        if (idx > 0) {
          const p = members[idx - 1]._basis;
          const c = m._basis;
          if (p.score === c.score && p.jadeed === c.jadeed && p.jadeedPages === c.jadeedPages && p.attendance === c.attendance) {
            currentRank = prevRank;
          }
        }
        prevRank = currentRank;
        const out = { ...m, marhalaRank: currentRank };
        delete out._basis;
        return out;
      });
    });
    months[month] = {
      label: monthLabelOf(month),
      groups: rankedGroups,
      orderedMarhalas: sortMarhalaKeys(Object.keys(rankedGroups)),
    };
  });

  // Trends + rank movement vs nearest previous month with data (same marhala).
  const monthKeysAsc = Object.keys(months).sort();
  const seenByStudent = {}; // pkey -> [{month, row}]
  monthKeysAsc.forEach((month) => {
    Object.values(months[month].groups).forEach((g) => {
      g.forEach((row) => {
        if (!seenByStudent[row.pkey]) seenByStudent[row.pkey] = [];
        seenByStudent[row.pkey].push({ month, row });
      });
    });
  });
  Object.values(seenByStudent).forEach((hist) => {
    hist.forEach((entry, i) => {
      if (i === 0) return;
      const prevEntry = hist[i - 1];
      const curr = entry.row;
      // Jadeed TOTAL trend (same CONDITION A/B as weekly).
      curr.prevJadeed = { value: prevEntry.row.totalJadeed, unit: prevEntry.row.jadeedUnit };
      curr.jadeedTrend = curr.totalJadeed - prevEntry.row.totalJadeed >= 1 ? "up" : "down";
      // Rank movement within the same Marhala.
      if (prevEntry.row.marhala === curr.marhala) {
        if (curr.marhalaRank < prevEntry.row.marhalaRank) curr.marhalaRankChange = "up";
        else if (curr.marhalaRank > prevEntry.row.marhalaRank) curr.marhalaRankChange = "down";
        else curr.marhalaRankChange = "same";
      }
    });
  });

  const orderedMonths = Object.keys(months).sort().reverse(); // latest first
  return { months, orderedMonths, monthKeysAsc };
}
