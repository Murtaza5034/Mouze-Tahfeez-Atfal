/**
 * Unified Hifz Gem League Calculation and Ranking Engine
 * Used consistently across Admin, Teacher, and Parents (Atfal) Portals.
 *
 * Scoring Rules:
 * - 4 weeks per month (Week 1 to Week 4).
 * - Each week has 2 activities (e.g., Post-It and Activity), each scored out of 60 gems.
 * - Weekly total = Post-It + Activity = max 120 gems.
 * - Monthly total = 4 weeks * 120 gems = max 480 gems.
 */

export const MONTHS_CONFIG = [
  {
    id: "safar",
    nameEn: "Safar al-Muzaffar",
    nameAr: "شهر صفر المظفر",
    hijri: "صفر المظفر",
    pageRange: "16 - 29",
    color: "#10b981",
    theme: "emerald",
    gemImg: "/assets/gems/gem-week1-emerald.png"
  },
  {
    id: "rabi1",
    nameEn: "Rabi al-Awwal",
    nameAr: "شهر ربيع الاول",
    hijri: "ربيع الأول",
    pageRange: "1 - 30",
    color: "#06b6d4",
    theme: "diamond",
    gemImg: "/assets/gems/gem-week4-diamond.png"
  },
  {
    id: "rabi2",
    nameEn: "Rabi al-Aakhar",
    nameAr: "شهر ربيع الآخر",
    hijri: "ربيع الآخر",
    pageRange: "1 - 29",
    color: "#8b5cf6",
    theme: "amethyst",
    gemImg: "/assets/gems/gem-week3-sapphire.png"
  },
  {
    id: "jumada1",
    nameEn: "Jumada al-Ula",
    nameAr: "شهر جمادى الاولى",
    hijri: "جمادى الأولى",
    pageRange: "1 - 30",
    color: "#3b82f6",
    theme: "sapphire",
    gemImg: "/assets/gems/gem-week3-sapphire.png"
  },
  {
    id: "jumada2",
    nameEn: "Jumada al-Ukhra",
    nameAr: "شهر جمادى الاخرى",
    hijri: "جمادى الآخرة",
    pageRange: "16 - 29",
    color: "#ec4899",
    theme: "pink",
    gemImg: "/assets/gems/gem-week2-ruby.png"
  },
  {
    id: "rajab",
    nameEn: "Rajab al-Asab",
    nameAr: "شهر رجب الاصب",
    hijri: "رجب الأصب",
    pageRange: "1 - 15",
    color: "#f59e0b",
    theme: "amber",
    gemImg: "/assets/gems/gem-week2-ruby.png"
  },
];

/**
 * Calculates a student's marks for a given month out of 480 gems.
 *
 * @param {Object} monthData - Data object under doc.months[monthId]
 * @returns {Object} Calculated breakdown and total out of 480
 */
export function calculateStudentMonthlyGems(monthData) {
  if (!monthData) {
    return {
      totalGems: 0,
      maxGems: 480,
      isFilled: false,
      weeks: {
        week1: { post_it: 0, activity: 0, total: 0, max: 120, isCompleted: false },
        week2: { post_it: 0, activity: 0, total: 0, max: 120, isCompleted: false },
        week3: { post_it: 0, activity: 0, total: 0, max: 120, isCompleted: false },
        week4: { post_it: 0, activity: 0, total: 0, max: 120, isCompleted: false },
      }
    };
  }

  const weeksRaw = monthData.weeks || {};
  let totalWeeksSum = 0;
  let anyFieldFilled = false;

  const weekKeys = ["week1", "week2", "week3", "week4"];
  const weeks = {};

  weekKeys.forEach((key) => {
    const w = weeksRaw[key] || {};
    const post_it = Math.max(0, Math.min(60, Number(w.post_it) || 0));
    const activity = Math.max(0, Math.min(60, Number(w.activity) || 0));
    const total = post_it + activity;

    if (w.post_it !== undefined && w.post_it !== null && String(w.post_it).trim() !== "") {
      anyFieldFilled = true;
    }
    if (w.activity !== undefined && w.activity !== null && String(w.activity).trim() !== "") {
      anyFieldFilled = true;
    }
    if (total > 0) anyFieldFilled = true;

    totalWeeksSum += total;
    weeks[key] = {
      post_it,
      activity,
      total,
      max: 120,
      isCompleted: total > 0,
    };
  });

  const storedMonthlyTotal = Number(monthData.monthly_total) || 0;
  if (storedMonthlyTotal > 0) anyFieldFilled = true;

  const totalGems = Math.min(480, Math.max(storedMonthlyTotal, totalWeeksSum));

  return {
    totalGems,
    maxGems: 480,
    isFilled: anyFieldFilled || totalGems > 0,
    weeks,
  };
}

/**
 * Extracts and unifies all student candidates for a specific month.
 * Strictly uses real students - NO mock or benchmark contenders.
 *
 * @param {Array} leagueEntries - Array of entries from atfal_gem_league & child_profiles
 * @param {string} monthId - e.g. "safar", "rabi1", etc.
 * @param {Object} studentPhotosMap - Map of student_id/name -> authentic photo url
 * @returns {Array} All real student candidates with monthly score out of 480
 */
export function getLeagueCandidates(leagueEntries = [], monthId = "safar", studentPhotosMap = {}) {
  const candidateMap = new Map();

  leagueEntries.forEach((entry) => {
    if (!entry) return;
    const sId = String(entry.student_id || entry.id || "").trim();
    if (!sId) return;

    // Reject any fake benchmark IDs
    if (sId.startsWith("benchmark-")) return;

    const monthData = entry.months?.[monthId] || entry.gem_league?.months?.[monthId] || null;
    const calc = calculateStudentMonthlyGems(monthData);

    const fullName = entry.student_name || entry.full_name || entry.name || "Student";
    const cleanName = fullName.replace(/\s+(bhai|ben|kakaji)\b/gi, "").trim().toLowerCase();

    // Resolve genuine photo
    const rawPhoto =
      (entry.photo_url && !entry.photo_url.includes("unsplash.com") ? entry.photo_url : null) ||
      (entry.photoUrl && !entry.photoUrl.includes("unsplash.com") ? entry.photoUrl : null) ||
      (entry.avatar_url && !entry.avatar_url.includes("unsplash.com") ? entry.avatar_url : null) ||
      (entry.photo && !entry.photo.includes("unsplash.com") ? entry.photo : null);

    const resolvedPhoto =
      rawPhoto ||
      studentPhotosMap[sId] ||
      studentPhotosMap[fullName.trim().toLowerCase()] ||
      studentPhotosMap[cleanName] ||
      null;

    const candidate = {
      id: sId,
      name: fullName,
      group: entry.group_name || entry.group || "Atfal",
      its: entry.its_id || entry.its || "",
      teacherName: entry.teacher_name || entry.teacherName || "Teacher",
      gems: calc.totalGems,
      maxGems: 480,
      isFilled: calc.isFilled,
      weeks: calc.weeks,
      photo: resolvedPhoto,
    };

    if (candidateMap.has(sId)) {
      const existing = candidateMap.get(sId);
      // Keep higher score if duplicate doc exists
      if (candidate.gems > existing.gems || (!existing.isFilled && candidate.isFilled)) {
        candidateMap.set(sId, candidate);
      }
    } else {
      candidateMap.set(sId, candidate);
    }
  });

  return Array.from(candidateMap.values());
}

/**
 * Returns the Top 3 highest gem earners for a given month.
 * Guarantees identical ranking and names across Admin, Teacher, and Parents portals.
 *
 * @param {Array} leagueEntries
 * @param {string} monthId
 * @param {Object} studentPhotosMap
 * @returns {Array} Top 3 ranked real students [Rank 1, Rank 2, Rank 3]
 */
export function getMonthlyTop3(leagueEntries = [], monthId = "safar", studentPhotosMap = {}) {
  const candidates = getLeagueCandidates(leagueEntries, monthId, studentPhotosMap);

  // Sort descending by gems (out of 480), then alphabetically by name
  candidates.sort((a, b) => {
    if (b.gems !== a.gems) return b.gems - a.gems;
    return a.name.localeCompare(b.name);
  });

  const scoredOnly = candidates.filter((c) => c.gems > 0);
  const topList = (scoredOnly.length >= 3 ? scoredOnly : candidates).slice(0, 3);

  return topList.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

/**
 * Converts top 3 array into podium display order:
 * [Rank 2 (Left), Rank 1 (Center), Rank 3 (Right)]
 */
export function getPodiumOrder(top3List = []) {
  const r1 = top3List.find((p) => p.rank === 1);
  const r2 = top3List.find((p) => p.rank === 2);
  const r3 = top3List.find((p) => p.rank === 3);
  return [r2, r1, r3].filter(Boolean);
}
