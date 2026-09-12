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
} from "./marhalaRanking.js";

const normName = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const HIJRI_MONTH_NAMES_EN = [
  "Muharram al-Haraam",
  "Safar al-Muzaffar",
  "Rabi al-Awwal",
  "Rabi al-Aakhar",
  "Jumada al-Ula",
  "Jumada al-Ukhra",
  "Rajab al-Asab",
  "Shabaan al-Kareem",
  "Ramadan al-Moazzam",
  "Shawwal al-Mukarram",
  "Zil Qaadah al-Haraam",
  "Zil Hajjah al-Haraam",
];

const HIJRI_MONTH_NAMES_AR = [
  "محرم الحرام",
  "صفر المظفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب الأصب",
  "شعبان الكريم",
  "رمضان المعظم",
  "شوال المكرم",
  "ذي القعدة الحرام",
  "ذي الحجة الحرام",
];

export function getFatemiHijriMonth(dateStr) {
  if (!dateStr) return null;
  try {
    const [year, month, day] = String(dateStr).split("-").map(Number);
    if (!year || !month) return null;
    const date = new Date(Date.UTC(year, month - 1, day || 15, 12, 0, 0));
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-tbla-nu-latn", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).formatToParts(date);
    let d = parseInt(parts.find((p) => p.type === "day")?.value || "15", 10);
    let m = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10);
    const y = parseInt(parts.find((p) => p.type === "year")?.value || "1446", 10);
    d += 1;
    const monthLengths = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
    const isLeapYear = (y * 11 + 14) % 30 < 11;
    const lastMonthLen = isLeapYear ? 30 : 29;
    const currentMonthLen = m === 12 ? lastMonthLen : monthLengths[m - 1];
    if (d > currentMonthLen) {
      d = 1;
      m += 1;
      if (m > 12) m = 1;
    }
    return {
      date: d,
      month: m,
      year: y,
      nameEn: HIJRI_MONTH_NAMES_EN[m - 1] || `Month ${m}`,
      nameAr: HIJRI_MONTH_NAMES_AR[m - 1] || "",
    };
  } catch (_) {
    return null;
  }
}

/**
 * Maps a week date to its 1-indexed academic week slot (1 to 4)
 * within the Fatemi Islamic month (Dates 1-7 = W1, 8-15 = W2, 16-22 = W3, 23-30 = W4).
 */
export function getFatemiWeekSlot(dateStr) {
  if (!dateStr) return 1;
  const fi = getFatemiHijriMonth(dateStr);
  if (fi && fi.date) {
    if (fi.date <= 7) return 1;
    if (fi.date <= 15) return 2;
    if (fi.date <= 22) return 3;
    return 4; // Dates 23 to 30 all belong to Week 4
  }
  const d = new Date(dateStr).getUTCDate();
  if (d <= 7) return 1;
  if (d <= 15) return 2;
  if (d <= 22) return 3;
  return 4;
}

/**
 * Groups weekly results by Fatemi Hijri Month (e.g. '1448-03' for Rabi al-Awwal 1448)
 * so that all 4 weeks (from 15 Aug / 3 Rabi al-Awwal to 11 Sep / 30 Rabi al-Awwal)
 * stay together in the same month bucket.
 */
export function monthKeyOf(weekDate) {
  if (!weekDate) return "";
  const hijri = getFatemiHijriMonth(weekDate);
  if (hijri?.year && hijri?.month) {
    return `${hijri.year}-${String(hijri.month).padStart(2, "0")}`;
  }
  const d = new Date(weekDate);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabelOf(monthKey, sampleDate) {
  const parts = String(monthKey || "").split("-");
  // If monthKey is a Hijri key like "1448-03"
  if (parts.length === 2 && Number(parts[0]) < 1700) {
    const hMonthIdx = Number(parts[1]) - 1;
    const name = HIJRI_MONTH_NAMES_EN[hMonthIdx] || `Month ${parts[1]}`;
    return `${name} (${parts[0]} H)`;
  }

  const testDate = sampleDate || (parts.length >= 2 ? `${parts[0]}-${parts[1]}-15` : "");
  const hijri = getFatemiHijriMonth(testDate);
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  const gregName = Number.isNaN(d.getTime())
    ? monthKey
    : d.toLocaleString("default", { month: "long", year: "numeric" });
  if (hijri?.nameEn) {
    return `${hijri.nameEn} (${gregName})`;
  }
  return gregName;
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
 * { months: { [monthKey]: { label, groups, orderedMarhalas, allStudentsRanked, distinctMonthWeeks } },
 *   orderedMonths (latest first),
 *   monthKeysAsc (oldest first, for trend lookup) }
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
    // Attendance calculated across the month out of 22 class days
    const rawAtt = weeks.reduce((s, r) => s + (Number(r?.attendance_count) || 0), 0);
    const attendanceTotal = Math.min(rawAtt, 22);
    const attendanceMax = 22;

    const displayName = b.profile
      ? b.profile.name || b.profile.full_name || "Student"
      : b.orphanName;
    const marhala = getStudentMarhala(b.profile || {}, latest);

    const sProfile = b.profile || {};
    const photo =
      sProfile.photoUrl ||
      sProfile.photo_url ||
      sProfile.avatar_url ||
      sProfile.photo ||
      "";
    const its = sProfile.its || "";
    const student_id = sProfile.student_id || sProfile.id || b.pkey;
    const teacherName =
      sProfile.teacherName || sProfile.teacher_name || latest?.teacher_name || "";

    // Index weekly results by exact week_date and by weekNum (preferring Friday submissions)
    const weeksByWeekNum = {};
    const weeksByDate = {};
    weeks.forEach((w) => {
      if (w.week_date) {
        const fi = getFatemiHijriMonth(w.week_date);
        const weekNum = fi && fi.date ? Math.ceil(fi.date / 7) : 1;
        const isFriday = new Date(w.week_date + "T12:00:00Z").getUTCDay() === 5;
        const entry = {
          weekIndex: weekNum,
          weekNum,
          week_date: w.week_date,
          score: round1(effectiveScore(w)),
          murajazah: Number(w.murajazah) || 0,
          juz_hali: Number(w.juz_hali) || 0,
          takhteet: Number(w.takhteet) || 0,
          jadeed: Number(w.jadeed) || 0,
          total_jadeed_pages: w.total_jadeed_pages ?? "",
          attendance_count: Number(w.attendance_count) || 0,
          attendance_max: 6,
          wusool: {
            juz: w.wusool_juz || "",
            surah: w.wusool_surah || "",
            page: w.wusool_page || "",
          },
        };
        weeksByDate[w.week_date] = entry;
        if (!weeksByWeekNum[weekNum] || isFriday) {
          weeksByWeekNum[weekNum] = entry;
        }
      }
    });

    const weeksData = weeks.map((w) => {
      const fi = getFatemiHijriMonth(w.week_date);
      const weekNum = fi && fi.date ? Math.ceil(fi.date / 7) : 1;
      return {
        weekIndex: weekNum,
        weekNum,
        week_date: w.week_date,
        score: round1(effectiveScore(w)),
        murajazah: Number(w.murajazah) || 0,
        juz_hali: Number(w.juz_hali) || 0,
        takhteet: Number(w.takhteet) || 0,
        jadeed: Number(w.jadeed) || 0,
        total_jadeed_pages: w.total_jadeed_pages ?? "",
        attendance_count: Number(w.attendance_count) || 0,
        attendance_max: 6,
        wusool: {
          juz: w.wusool_juz || "",
          surah: w.wusool_surah || "",
          page: w.wusool_page || "",
        },
      };
    });

    // Murajah and Juz Hali weekly max is 30 marks -> compute 4-week monthly average out of 100
    const rawAvgMurajazah = avg((r) => r.murajazah);
    const rawAvgJuzHali = avg((r) => r.juz_hali);
    const avgMurajazah100 = round1((rawAvgMurajazah / 30) * 100);
    const avgJuzHali100 = round1((rawAvgJuzHali / 30) * 100);

    const row = {
      pkey: b.pkey,
      student_id,
      its,
      photo,
      teacherName,
      name: displayName,
      arabic_name: b.profile?.arabic_name || "",
      groupName: b.profile?.groupName || b.profile?.group_name || b.orphanGroup || "",
      marhala,
      monthKey: b.month,
      weeksCount: n,
      weeksData,
      weeksByDate,
      weeksByWeekNum,
      avgScore,
      avgMurajazah: avgMurajazah100,
      avgMurajazahRaw: rawAvgMurajazah,
      avgMurajazah100,
      avgJuzHali: avgJuzHali100,
      avgJuzHaliRaw: rawAvgJuzHali,
      avgJuzHali100,
      avgTakhteet: avg((r) => r.takhteet),
      avgJadeedMarks: avg((r) => r.jadeed),
      totalJadeed,
      jadeedUnit: monthUnit,
      prevJadeed: null,
      jadeedTrend: "neutral",
      attendanceTotal,
      attendanceMax,
      wusool: {
        juz: latest?.wusool_juz || "",
        surah: latest?.wusool_surah || "",
        page: latest?.wusool_page || "",
      },
      weekDates: weeks.map((r) => r.week_date),
      marhalaRank: null,
      marhalaRankChange: null,
      overallRank: null,
      overallRankChange: null,
    };
    if (!monthRows[b.month]) monthRows[b.month] = [];
    monthRows[b.month].push(row);
  });

  // Rank WITHIN each (month, marhala) AND calculate Overall Full Atfal ranking.
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

    // OVERALL Full Atfal Student ranking across all Marhalas for this month
    const allMembers = monthRows[month]
      .map((row) => ({ ...row, _basis: rankBasis(row) }))
      .sort((a, b) => compareBasis(a._basis, b._basis));
    let prevAllRank = 1;
    const allStudentsRanked = allMembers.map((m, idx) => {
      let currentRank = idx + 1;
      if (idx > 0) {
        const p = allMembers[idx - 1]._basis;
        const c = m._basis;
        if (p.score === c.score && p.jadeed === c.jadeed && p.jadeedPages === c.jadeedPages && p.attendance === c.attendance) {
          currentRank = prevAllRank;
        }
      }
      prevAllRank = currentRank;
      const out = { ...m, overallRank: currentRank, rank: currentRank };
      delete out._basis;
      return out;
    });

    // Group all dates in this month by their Fatemi week number (e.g. 1, 2, 4, 5)
    const weekNumDatesMap = {};
    (monthRows[month] || []).forEach((row) => {
      (row.weekDates || []).forEach((dStr) => {
        const fi = getFatemiHijriMonth(dStr);
        const wNum = fi && fi.date ? Math.ceil(fi.date / 7) : 1;
        if (!weekNumDatesMap[wNum]) weekNumDatesMap[wNum] = new Set();
        weekNumDatesMap[wNum].add(dStr);
      });
    });

    const distinctWeekNums = Object.keys(weekNumDatesMap)
      .map(Number)
      .sort((a, b) => a - b);

    // Build exactly ONE column per distinct academic week (e.g. Week 1, Week 2, Week 4, Week 5)
    const monthWeeksInfo = distinctWeekNums.map((wNum, idx) => {
      const dates = Array.from(weekNumDatesMap[wNum]).sort();
      // Prioritize Friday (day 5 in UTC) or standard submission date
      const primaryDate = dates.find((d) => new Date(d + "T12:00:00Z").getUTCDay() === 5) || dates[0];
      const fi = getFatemiHijriMonth(primaryDate);
      let greg = "";
      try {
        const parts = primaryDate.split("-");
        const dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
        greg = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      } catch (_) {}
      const hijriText = fi && fi.date ? `${fi.date} ${fi.nameEn ? fi.nameEn.split(" ")[0] : "Rabi"}` : "";
      return {
        index: idx,
        weekNum: wNum,
        title: `Week ${idx + 1}`,
        dateStr: primaryDate,
        allDates: dates,
        greg,
        hijriText,
        fullLabel: hijriText ? `${greg} • ${hijriText}` : greg,
      };
    });

    const distinctMonthWeeks = monthWeeksInfo.map((w) => w.dateStr);

    const sampleDate = distinctMonthWeeks[0] || (monthRows[month][0]?.weekDates?.[0]) || "";

    months[month] = {
      label: monthLabelOf(month, sampleDate),
      groups: rankedGroups,
      orderedMarhalas: sortMarhalaKeys(Object.keys(rankedGroups)),
      allStudentsRanked,
      distinctMonthWeeks,
      monthWeeksInfo,
    };
  });

  // Trends + rank movement vs nearest previous month with data (same marhala + overall).
  const monthKeysAsc = Object.keys(months).sort();
  const seenByStudent = {}; // pkey -> [{month, row}]
  monthKeysAsc.forEach((month) => {
    // Collect rows
    (months[month].allStudentsRanked || []).forEach((row) => {
      if (!seenByStudent[row.pkey]) seenByStudent[row.pkey] = [];
      seenByStudent[row.pkey].push({ month, row });
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
      if (prevEntry.row.marhala === curr.marhala && prevEntry.row.marhalaRank && curr.marhalaRank) {
        if (curr.marhalaRank < prevEntry.row.marhalaRank) curr.marhalaRankChange = "up";
        else if (curr.marhalaRank > prevEntry.row.marhalaRank) curr.marhalaRankChange = "down";
        else curr.marhalaRankChange = "same";
      }
      // Overall rank movement
      if (prevEntry.row.overallRank && curr.overallRank) {
        if (curr.overallRank < prevEntry.row.overallRank) curr.overallRankChange = "up";
        else if (curr.overallRank > prevEntry.row.overallRank) curr.overallRankChange = "down";
        else curr.overallRankChange = "same";
      }
    });
  });

  // Sync overall rank changes back into groups
  monthKeysAsc.forEach((month) => {
    const overallMap = new Map();
    (months[month].allStudentsRanked || []).forEach((row) => {
      overallMap.set(row.pkey, row);
    });
    Object.keys(months[month].groups).forEach((marhala) => {
      months[month].groups[marhala] = months[month].groups[marhala].map((row) => {
        const enriched = overallMap.get(row.pkey);
        return enriched ? { ...row, ...enriched } : row;
      });
    });
  });

  const orderedMonths = Object.keys(months).sort().reverse(); // latest first
  return { months, orderedMonths, monthKeysAsc };
}
