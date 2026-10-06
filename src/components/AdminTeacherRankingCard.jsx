import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabaseClient";
import {
  Trophy,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Sparkles,
  TrendingUp,
  Users,
  ShieldCheck,
  Calendar,
  ArrowRight,
  Flag,
} from "lucide-react";
import "./AdminTeacherRankingCard.css";

/**
 * Normalizes text for reliable matching
 */
function normalizeName(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Extracts minutes from midnight from time string (e.g. "@ 4:26 PM" or "16:26")
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const clean = String(timeStr).replace(/^@\s*/, "").trim();

  // Try 12-hour format: "4:26 PM" or "04:26 PM"
  const m12 = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = parseInt(m12[2], 10);
    const ampm = (m12[4] || "").toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }

  // Try ISO timestamp
  const dateObj = new Date(clean);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.getHours() * 60 + dateObj.getMinutes();
  }

  return null;
}

/**
 * Formats minutes from midnight to readable 12h string (e.g. 986 -> "4:26 PM")
 */
function formatMinutesTo12h(mins) {
  if (mins == null || isNaN(mins)) return "--";
  let h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Formats YYYY-MM-DD to human friendly string (e.g. "15 Sep 2026")
 */
function formatDateDisplay(dateStr) {
  if (!dateStr) return "--";
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Custom Hook: Computes Weekly OR Monthly punctuality ranking for all Atfal teachers,
 * and detects the earliest start date when teachers began marking attendance.
 */
export function useTeacherAttendanceRanking({
  teacherProfiles = [],
  portalAccessList = [],
  teacherAttendance = [],
  periodMode = "weekly", // "weekly" | "monthly"
  weekOffset = 0,
  monthOffset = 0,
}) {
  const [dbPeriodRecords, setDbPeriodRecords] = useState([]);
  const [earliestStartDates, setEarliestStartDates] = useState({});
  const [overallFacultyStartDate, setOverallFacultyStartDate] = useState(null);

  // 1. Calculate Period Range (Weekly Saturday-to-Friday OR Full Gregorian/Hijri Month)
  const { periodLabel, startDate, endDate, weekDays, isCurrentPeriod } = useMemo(() => {
    const now = new Date();

    if (periodMode === "monthly") {
      const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const y = target.getFullYear();
      const m = target.getMonth();
      const lastDay = new Date(y, m + 1, 0).getDate();

      const mmStr = String(m + 1).padStart(2, "0");
      const startKey = `${y}-${mmStr}-01`;
      const endKey = `${y}-${mmStr}-${String(lastDay).padStart(2, "0")}`;
      const label = target.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      return {
        periodLabel: label,
        startDate: startKey,
        endDate: endKey,
        weekDays: [],
        isCurrentPeriod: monthOffset === 0,
      };
    } else {
      // Weekly: Saturday to Friday cycle
      const target = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + weekOffset * 7
      );
      const dayOfWeek = target.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const daysSinceSat = (dayOfWeek + 1) % 7;
      const sat = new Date(
        target.getFullYear(),
        target.getMonth(),
        target.getDate() - daysSinceSat
      );
      sat.setHours(0, 0, 0, 0);

      const DAY_NAMES = ["SAT", "SUN", "MON", "TUE", "WED", "THU", "FRI"];
      const days = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const dateKey = `${yyyy}-${mm}-${dd}`;
        const dayNum = d.getDate();
        const monthStr = d.toLocaleDateString("en-US", { month: "short" });

        days.push({
          dateObj: d,
          dateKey,
          dayName: DAY_NAMES[i],
          dayIndex: i,
          label: `${dayNum} ${monthStr}`,
          isSunday: i === 1,
        });
      }

      const startKey = days[0].dateKey;
      const endKey = days[6].dateKey;
      const rangeLabel = `${days[0].label} – ${days[6].label}`;

      return {
        periodLabel: rangeLabel,
        startDate: startKey,
        endDate: endKey,
        weekDays: days,
        isCurrentPeriod: weekOffset === 0,
      };
    }
  }, [periodMode, weekOffset, monthOffset]);

  // 2. Fetch all historical earliest attendance start dates across all teachers
  useEffect(() => {
    let isCancelled = false;
    const fetchStartDates = async () => {
      try {
        const { data, error } = await supabase
          .from("teacher_attendance")
          .select("teacher_id, teacher_name, attendance_date")
          .order("attendance_date", { ascending: true });

        if (!error && Array.isArray(data) && !isCancelled) {
          const map = {};
          let overallEarliest = null;
          data.forEach((r) => {
            const nameKey = normalizeName(r.teacher_name);
            const idKey = String(r.teacher_id || "");
            if (r.attendance_date) {
              if (!overallEarliest || r.attendance_date < overallEarliest) {
                overallEarliest = r.attendance_date;
              }
              if (nameKey && !map[nameKey]) {
                map[nameKey] = r.attendance_date;
              }
              if (idKey && !map[idKey]) {
                map[idKey] = r.attendance_date;
              }
            }
          });
          setEarliestStartDates(map);
          setOverallFacultyStartDate(overallEarliest);
        }
      } catch (err) {
        console.warn("Could not fetch earliest start dates:", err);
      }
    };

    fetchStartDates();
    return () => {
      isCancelled = true;
    };
  }, []);

  // 3. Fetch attendance records for the active period (weekly or monthly)
  useEffect(() => {
    let isCancelled = false;
    const fetchPeriod = async () => {
      try {
        const { data, error } = await supabase
          .from("teacher_attendance")
          .select("*")
          .gte("attendance_date", startDate)
          .lte("attendance_date", endDate);

        if (!error && Array.isArray(data) && !isCancelled) {
          setDbPeriodRecords(data);
        }
      } catch (err) {
        console.warn("Could not fetch period teacher attendance:", err);
      }
    };

    fetchPeriod();
    return () => {
      isCancelled = true;
    };
  }, [startDate, endDate]);

  // Merge records from DB and passed prop
  const combinedAttendance = useMemo(() => {
    const map = new Map();
    (dbPeriodRecords || []).forEach((r) => {
      const k = `${normalizeName(r.teacher_name)}_${r.attendance_date}`;
      map.set(k, r);
    });
    (teacherAttendance || []).forEach((r) => {
      if (r.attendance_date >= startDate && r.attendance_date <= endDate) {
        const k = `${normalizeName(r.teacher_name)}_${r.attendance_date}`;
        map.set(k, { ...map.get(k), ...r });
      }
    });
    return Array.from(map.values());
  }, [dbPeriodRecords, teacherAttendance, startDate, endDate]);

  // 4. Extract all unique Atfal teachers
  const allAtfalTeachers = useMemo(() => {
    const teachersMap = new Map();
    const idToKeyMap = new Map();

    const addOrMergeTeacher = (rawId, rawName, email, photo_url) => {
      const name = (rawName || email || "").trim();
      const nameKey = normalizeName(name);
      const id = String(rawId || name || "").trim();
      if (!nameKey && !id) return;

      // Check if we already have this teacher either by id or by nameKey
      const existingKey = (id && idToKeyMap.get(id)) || (nameKey && teachersMap.has(nameKey) ? nameKey : null);

      if (existingKey && teachersMap.has(existingKey)) {
        const existing = teachersMap.get(existingKey);
        // Merge in any better info
        teachersMap.set(existingKey, {
          id: existing.id || id,
          name: existing.name || name,
          email: existing.email || email || "",
          photo_url: existing.photo_url || photo_url || null,
        });
        if (id) idToKeyMap.set(id, existingKey);
      } else {
        const primaryKey = nameKey || id;
        teachersMap.set(primaryKey, {
          id: id || primaryKey,
          name: name || "Teacher",
          email: email || "",
          photo_url: photo_url || null,
        });
        if (id) idToKeyMap.set(id, primaryKey);
        if (nameKey) idToKeyMap.set(nameKey, primaryKey);
      }
    };

    // From portalAccessList
    (portalAccessList || [])
      .filter((a) => {
        const r = (a.portal_role || "").toLowerCase();
        return (
          (r === "teacher" || r.includes("teacher") || r.includes("muhaffiz")) &&
          !r.includes("kibar") &&
          !r.includes("student")
        );
      })
      .forEach((p) => {
        addOrMergeTeacher(p.user_id || p.id, p.full_name || p.name, p.email, p.photo_url);
      });

    // From teacherProfiles
    (teacherProfiles || [])
      .filter((tp) => !tp.is_kibar)
      .forEach((tp) => {
        addOrMergeTeacher(tp.user_id || tp.id, tp.full_name || tp.name, tp.email, tp.photo_url);
      });

    // From attendance records
    (combinedAttendance || []).forEach((rec) => {
      addOrMergeTeacher(rec.teacher_id, rec.teacher_name, "", null);
    });

    return Array.from(teachersMap.values());
  }, [portalAccessList, teacherProfiles, combinedAttendance]);

  // 5. Calculate statistics & rankings
  const rankedTeachers = useMemo(() => {
    const scoredList = allAtfalTeachers.map((teacher) => {
      const teacherKey = normalizeName(teacher.name);
      const teacherRecords = combinedAttendance.filter(
        (r) =>
          normalizeName(r.teacher_name) === teacherKey ||
          String(r.teacher_id) === String(teacher.id)
      );

      let onTimeCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      const validTimesInMinutes = [];
      const dayMap = {};

      if (periodMode === "weekly" && weekDays.length > 0) {
        weekDays.forEach((w) => {
          const rec = teacherRecords.find((r) => r.attendance_date === w.dateKey);
          if (rec) {
            const st = String(rec.status || "").toLowerCase();
            if (st === "present") {
              onTimeCount++;
              dayMap[w.dateKey] = { status: "present", time: rec.attendance_time };
            } else if (st === "late") {
              lateCount++;
              dayMap[w.dateKey] = { status: "late", time: rec.attendance_time };
            } else if (st === "absent") {
              absentCount++;
              dayMap[w.dateKey] = { status: "absent" };
            } else if (st.includes("leave") || st.includes("uzur")) {
              leaveCount++;
              dayMap[w.dateKey] = { status: "leave" };
            } else {
              onTimeCount++;
              dayMap[w.dateKey] = { status: "present", time: rec.attendance_time };
            }

            const rawTime =
              rec.attendance_time ||
              (rec.created_at ? new Date(rec.created_at).toLocaleTimeString() : null);
            const tMins = parseTimeToMinutes(rawTime);
            if (tMins != null) validTimesInMinutes.push(tMins);
          } else {
            dayMap[w.dateKey] = { status: w.isSunday ? "off" : "unmarked" };
          }
        });
      } else {
        // Monthly calculation
        teacherRecords.forEach((rec) => {
          const st = String(rec.status || "").toLowerCase();
          if (st === "present") {
            onTimeCount++;
          } else if (st === "late") {
            lateCount++;
          } else if (st === "absent") {
            absentCount++;
          } else if (st.includes("leave") || st.includes("uzur")) {
            leaveCount++;
          } else {
            onTimeCount++;
          }

          const rawTime =
            rec.attendance_time ||
            (rec.created_at ? new Date(rec.created_at).toLocaleTimeString() : null);
          const tMins = parseTimeToMinutes(rawTime);
          if (tMins != null) validTimesInMinutes.push(tMins);
        });
      }

      const totalMarked = onTimeCount + lateCount;
      const onTimePct =
        totalMarked > 0 ? Math.round((onTimeCount / totalMarked) * 100) : 0;

      const avgMinutes =
        validTimesInMinutes.length > 0
          ? Math.round(
              validTimesInMinutes.reduce((a, b) => a + b, 0) /
                validTimesInMinutes.length
            )
          : null;

      const latestTime =
        validTimesInMinutes.length > 0
          ? formatMinutesTo12h(validTimesInMinutes[validTimesInMinutes.length - 1])
          : "--";

      // Earliest attendance date when this teacher started marking
      const rawFirstDate =
        earliestStartDates[teacherKey] ||
        earliestStartDates[String(teacher.id)] ||
        null;
      const firstAttendanceDate = formatDateDisplay(rawFirstDate);

      // Punctuality Scoring Formula:
      // Base: On-Time = +100pts, Late = +25pts, Absent = -40pts
      // Timing Bonus: Earlier arrival check-ins gain extra score
      const timingBonus =
        avgMinutes != null
          ? Math.max(0, Math.min(30, Math.round((16 * 60 + 35 - avgMinutes) / 2)))
          : 0;

      const score =
        onTimeCount * 100 +
        lateCount * 25 -
        absentCount * 40 +
        timingBonus;

      return {
        ...teacher,
        records: teacherRecords,
        onTimeCount,
        lateCount,
        absentCount,
        leaveCount,
        totalMarked,
        onTimePct,
        avgMinutes,
        avgTimeStr: formatMinutesTo12h(avgMinutes),
        latestTime,
        firstAttendanceDate,
        rawFirstDate,
        score,
        dayMap,
      };
    });

    // Sort descending by score -> onTimeCount -> onTimePct -> earlier check-in time -> name
    scoredList.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.onTimeCount !== a.onTimeCount) return b.onTimeCount - a.onTimeCount;
      if (b.onTimePct !== a.onTimePct) return b.onTimePct - a.onTimePct;
      if (a.avgMinutes != null && b.avgMinutes != null) {
        return a.avgMinutes - b.avgMinutes;
      }
      return a.name.localeCompare(b.name);
    });

    return scoredList.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }, [allAtfalTeachers, combinedAttendance, periodMode, weekDays, earliestStartDates]);

  // Overall Faculty Summary
  const facultySummary = useMemo(() => {
    const totalTeachers = rankedTeachers.length;
    const totalOnTime = rankedTeachers.reduce((acc, t) => acc + t.onTimeCount, 0);
    const totalLate = rankedTeachers.reduce((acc, t) => acc + t.lateCount, 0);
    const totalSessions = totalOnTime + totalLate;
    const overallOnTimeRate =
      totalSessions > 0 ? Math.round((totalOnTime / totalSessions) * 100) : 100;

    const rank1Teacher = rankedTeachers[0] || null;

    const allValidAvg = rankedTeachers
      .map((t) => t.avgMinutes)
      .filter((m) => m != null);
    const facultyAvgMinutes =
      allValidAvg.length > 0
        ? Math.round(allValidAvg.reduce((a, b) => a + b, 0) / allValidAvg.length)
        : null;

    const overallFacultyStartDateStr = overallFacultyStartDate
      ? formatDateDisplay(overallFacultyStartDate)
      : "1 Sep 2026";

    return {
      totalTeachers,
      totalOnTime,
      totalLate,
      totalSessions,
      overallOnTimeRate,
      rank1Teacher,
      facultyAvgTimeStr: formatMinutesTo12h(facultyAvgMinutes),
      overallFacultyStartDateStr,
    };
  }, [rankedTeachers, overallFacultyStartDate]);

  return {
    periodLabel,
    startDate,
    endDate,
    weekDays,
    isCurrentPeriod,
    rankedTeachers,
    facultySummary,
  };
}

/**
 * FULL MODAL: All Atfal Teachers Sorted Weekly & Monthly Ranking
 */
export function AdminTeacherRankingModal({
  isOpen,
  onClose,
  teacherProfiles = [],
  portalAccessList = [],
  teacherAttendance = [],
  initialMode = "weekly",
}) {
  const [periodMode, setPeriodMode] = useState(initialMode); // "weekly" | "monthly"
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    periodLabel,
    weekDays,
    isCurrentPeriod,
    rankedTeachers,
    facultySummary,
  } = useTeacherAttendanceRanking({
    teacherProfiles,
    portalAccessList,
    teacherAttendance,
    periodMode,
    weekOffset,
    monthOffset,
  });

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return rankedTeachers;
    const q = normalizeName(searchQuery);
    return rankedTeachers.filter(
      (t) =>
        normalizeName(t.name).includes(q) ||
        normalizeName(t.email).includes(q)
    );
  }, [rankedTeachers, searchQuery]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="teacher-rank-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="teacher-rank-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="teacher-rank-modal-header">
          <div className="teacher-rank-modal-title-group">
            <div className="teacher-rank-modal-trophy-icon">
              <Trophy size={24} />
            </div>
            <div>
              <h3 className="teacher-rank-modal-title">
                Atfal Faculty {periodMode === "monthly" ? "Monthly" : "Weekly"} Attendance &amp; Ranking
              </h3>
              <p className="teacher-rank-modal-sub">
                Comprehensive tracking from launch &bull; Ranked by punctuality &amp; arrival time
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Mode Switcher Toggle */}
            <div className="teacher-rank-mode-toggle">
              <button
                type="button"
                className={`teacher-rank-mode-btn ${periodMode === "weekly" ? "active" : ""}`}
                onClick={() => setPeriodMode("weekly")}
              >
                <span>📅 Weekly</span>
              </button>
              <button
                type="button"
                className={`teacher-rank-mode-btn ${periodMode === "monthly" ? "active" : ""}`}
                onClick={() => setPeriodMode("monthly")}
              >
                <span>🗓️ Monthly</span>
              </button>
            </div>

            <button
              type="button"
              className="teacher-rank-modal-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Period Navigation Bar */}
        <div className="teacher-rank-modal-week-bar">
          <button
            type="button"
            className="teacher-rank-week-btn"
            onClick={() => {
              if (periodMode === "monthly") {
                setMonthOffset((prev) => prev - 1);
              } else {
                setWeekOffset((prev) => prev - 1);
              }
            }}
          >
            <ChevronLeft size={14} />
            <span>Previous {periodMode === "monthly" ? "Month" : "Week"}</span>
          </button>

          <div className="teacher-rank-current-week-label">
            <Calendar size={14} style={{ color: "#d4af37" }} />
            <span>{periodLabel}</span>
            {isCurrentPeriod && (
              <span className="teacher-rank-home-badge" style={{ padding: "2px 8px" }}>
                Current {periodMode === "monthly" ? "Month" : "Week"}
              </span>
            )}
          </div>

          <button
            type="button"
            className="teacher-rank-week-btn"
            onClick={() => {
              if (periodMode === "monthly") {
                setMonthOffset((prev) => Math.min(0, prev + 1));
              } else {
                setWeekOffset((prev) => Math.min(0, prev + 1));
              }
            }}
            disabled={periodMode === "monthly" ? monthOffset >= 0 : weekOffset >= 0}
          >
            <span>Next {periodMode === "monthly" ? "Month" : "Week"}</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Quick Summary Strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "10px",
            padding: "12px 18px",
            background: "rgba(212, 175, 55, 0.05)",
            borderBottom: "1px solid rgba(212, 175, 55, 0.15)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>
              TOTAL FACULTY
            </span>
            <span style={{ fontSize: "1.2rem", fontWeight: 900, color: "#0f172a" }}>
              {facultySummary.totalTeachers} Atfal Teachers
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>
              {periodMode === "monthly" ? "MONTHLY" : "WEEKLY"} ON-TIME RATE
            </span>
            <span style={{ fontSize: "1.2rem", fontWeight: 900, color: "#10b981" }}>
              {facultySummary.overallOnTimeRate}%
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>
              RANK #1 CHAMPION
            </span>
            <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#d97706" }}>
              🏆 {facultySummary.rank1Teacher ? facultySummary.rank1Teacher.name : "--"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>
              AVG CHECK-IN TIME
            </span>
            <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0284c7" }}>
              ⏱️ {facultySummary.facultyAvgTimeStr}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>
              SYSTEM START DATE
            </span>
            <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#334155" }}>
              🏁 {facultySummary.overallFacultyStartDateStr}
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="teacher-rank-search-bar">
          <div className="teacher-rank-search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              className="teacher-rank-search-input"
              placeholder="Search teacher by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 700 }}>
            {filteredTeachers.length} of {rankedTeachers.length} Listed
          </span>
        </div>

        {/* Scrollable Teacher Roster Stack */}
        <div className="teacher-rank-modal-body">
          {filteredTeachers.map((teacher, idx) => {
            const isRank1 = teacher.rank === 1;
            const isRank2 = teacher.rank === 2;
            const isRank3 = teacher.rank === 3;

            return (
              <div
                key={`teacher-rank-row-${teacher.id || teacher.name || idx}-${teacher.rank || idx}-${idx}`}
                className={`teacher-rank-row-item ${
                  isRank1 ? "rank-1" : isRank2 ? "rank-2" : isRank3 ? "rank-3" : ""
                }`}
              >
                {/* Left: Rank + Avatar + Name + Start Date */}
                <div className="teacher-rank-left-section">
                  <div
                    className={`teacher-rank-number-pill ${
                      isRank1 ? "rank-1" : isRank2 ? "rank-2" : isRank3 ? "rank-3" : ""
                    }`}
                  >
                    {isRank1 ? "🥇" : isRank2 ? "🥈" : isRank3 ? "🥉" : `#${teacher.rank}`}
                  </div>

                  <div className="teacher-rank-avatar-wrap">
                    {teacher.photo_url ? (
                      <img
                        src={teacher.photo_url}
                        alt={teacher.name}
                        className="teacher-rank-avatar-img"
                      />
                    ) : (
                      teacher.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="teacher-rank-name-col">
                    <h4 className="teacher-rank-teacher-name">
                      <span>{teacher.name}</span>
                      {isRank1 && (
                        <span
                          style={{
                            fontSize: "0.7rem",
                            background: "#fef3c7",
                            color: "#b45309",
                            padding: "2px 6px",
                            borderRadius: "6px",
                            fontWeight: 800,
                          }}
                        >
                          👑 Top Punctual
                        </span>
                      )}
                    </h4>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", flexWrap: "wrap" }}>
                      <span className="teacher-rank-role-tag" style={{ margin: 0 }}>
                        Atfal Muhaffiz
                      </span>
                      {teacher.firstAttendanceDate && teacher.firstAttendanceDate !== "--" && (
                        <span className="teacher-rank-start-pill">
                          <Flag size={10} /> Started: {teacher.firstAttendanceDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle: Tracking Time + Mini Days (or Monthly sessions) */}
                <div className="teacher-rank-middle-section">
                  <div
                    className={`teacher-rank-time-pill ${
                      teacher.onTimePct >= 90 ? "fast" : ""
                    }`}
                  >
                    <Clock size={12} />
                    <span>
                      Avg: {teacher.avgTimeStr} {teacher.latestTime !== "--" ? `(Last ${teacher.latestTime})` : ""}
                    </span>
                  </div>

                  {periodMode === "weekly" && weekDays.length > 0 ? (
                    /* Day-by-Day Mini Indicators */
                    <div className="teacher-rank-day-dots-row">
                      {weekDays.map((w, wIdx) => {
                        const dayInfo = teacher.dayMap[w.dateKey] || { status: "unmarked" };
                        const st = dayInfo.status;
                        const dotClass =
                          st === "present"
                            ? "present"
                            : st === "late"
                            ? "late"
                            : st === "absent"
                            ? "absent"
                            : "off";

                        return (
                          <div
                            key={`teacher-dot-${teacher.id || teacher.name || idx}-${w.dateKey}-${wIdx}`}
                            className={`teacher-rank-day-dot ${dotClass}`}
                            title={`${w.dayName} (${w.label}): ${st.toUpperCase()}${dayInfo.time ? ` at ${dayInfo.time}` : ""}`}
                          >
                            {w.dayName.charAt(0)}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Monthly Session Summary Badge */
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>
                      {teacher.totalMarked} Total Sessions Marked
                    </div>
                  )}
                </div>

                {/* Right: On-Time Rate & Breakdown */}
                <div className="teacher-rank-right-section">
                  <div
                    className={`teacher-rank-rate-val ${
                      teacher.onTimePct >= 80
                        ? ""
                        : teacher.onTimePct >= 50
                        ? "warning"
                        : "danger"
                    }`}
                  >
                    {teacher.onTimePct}% On-Time
                  </div>
                  <span className="teacher-rank-rate-sub">
                    {teacher.onTimeCount} On-Time &bull; {teacher.lateCount} Late
                  </span>
                </div>
              </div>
            );
          })}

          {filteredTeachers.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "36px 20px",
                color: "#64748b",
              }}
            >
              <Users size={36} opacity={0.3} style={{ marginBottom: "8px" }} />
              <p style={{ margin: 0, fontWeight: 700 }}>
                No teachers match the search criteria.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="teacher-rank-modal-footer">
          <p className="teacher-rank-modal-footnote">
            <ShieldCheck size={14} style={{ color: "#10b981" }} />
            <span>
              Attendance tracking verified at Burhani Masjid, Galiakot (Cutoff: 4:33 PM).
            </span>
          </p>
          <button
            type="button"
            className="teacher-rank-modal-close-action-btn"
            onClick={onClose}
          >
            Close Leaderboard
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * REUSABLE TRIGGER BUTTON FOR SETTINGS / ADMIN ATTENDANCE
 */
export function AdminTeacherRankingTriggerButton({
  onClick,
  label = "Faculty Attendance Ranking",
}) {
  return (
    <button
      type="button"
      className="att-ranking-modal-trigger-btn"
      onClick={onClick}
      title="View weekly and monthly ranking, arrival times, and start dates for all teachers"
    >
      <Trophy size={16} />
      <span>{label}</span>
    </button>
  );
}

/**
 * ADMIN HOME PAGE GRAPH CARD (Overview Card) - Supports Weekly & Monthly
 */
export function AdminTeacherRankingGraphCard({
  teacherProfiles = [],
  portalAccessList = [],
  teacherAttendance = [],
}) {
  const [periodMode, setPeriodMode] = useState("weekly"); // "weekly" | "monthly"
  const [showModal, setShowModal] = useState(false);

  const { periodLabel, rankedTeachers, facultySummary } =
    useTeacherAttendanceRanking({
      teacherProfiles,
      portalAccessList,
      teacherAttendance,
      periodMode,
      weekOffset: 0,
      monthOffset: 0,
    });

  // Top 5 teachers for the visual graph
  const topTeachers = useMemo(() => {
    return rankedTeachers.slice(0, 5);
  }, [rankedTeachers]);

  return (
    <>
      <div className="admin-teacher-rank-home-card card-appear">
        {/* Header */}
        <div className="teacher-rank-home-header">
          <div className="teacher-rank-home-header-left">
            <div className="teacher-rank-header-icon">
              <Trophy size={24} />
            </div>
            <div>
              <h3 className="teacher-rank-home-title">
                Faculty {periodMode === "monthly" ? "Monthly" : "Weekly"} Attendance &amp; Punctuality
              </h3>
              <p className="teacher-rank-home-sub">
                <Clock size={13} />
                <span>
                  {periodMode === "monthly" ? "Month" : "Week"}: {periodLabel} &bull; Ranked by On-Time Tracking
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Segmented Weekly vs Monthly Toggle */}
            <div className="teacher-rank-mode-toggle">
              <button
                type="button"
                className={`teacher-rank-mode-btn ${periodMode === "weekly" ? "active" : ""}`}
                onClick={() => setPeriodMode("weekly")}
              >
                <span>📅 Weekly</span>
              </button>
              <button
                type="button"
                className={`teacher-rank-mode-btn ${periodMode === "monthly" ? "active" : ""}`}
                onClick={() => setPeriodMode("monthly")}
              >
                <span>🗓️ Monthly</span>
              </button>
            </div>

            <span className="teacher-rank-home-badge">
              <Sparkles size={13} /> Live {periodMode === "monthly" ? "Monthly" : "Weekly"}
            </span>
          </div>
        </div>

        {/* 4 Summary Metric Boxes */}
        <div className="teacher-rank-home-metrics">
          <div className="teacher-rank-metric-box">
            <span className="teacher-rank-metric-label">
              {periodMode === "monthly" ? "Month" : "Week"} On-Time Rate
            </span>
            <div className="teacher-rank-metric-val">
              <span>{facultySummary.overallOnTimeRate}%</span>
            </div>
            <span className="teacher-rank-metric-sub">
              <TrendingUp size={12} /> {facultySummary.totalOnTime} On-Time Sessions
            </span>
          </div>

          <div className="teacher-rank-metric-box">
            <span className="teacher-rank-metric-label">Rank #1 Champion</span>
            <div
              className="teacher-rank-metric-val"
              style={{ fontSize: "1.1rem", color: "#d97706" }}
            >
              <span>
                {facultySummary.rank1Teacher
                  ? facultySummary.rank1Teacher.name.split(" ")[0]
                  : "None"}
              </span>
            </div>
            <span className="teacher-rank-metric-sub" style={{ color: "#d97706" }}>
              👑 1st Rank Most Punctual
            </span>
          </div>

          <div className="teacher-rank-metric-box">
            <span className="teacher-rank-metric-label">Avg Tracking Time</span>
            <div
              className="teacher-rank-metric-val"
              style={{ fontSize: "1.15rem", color: "#0284c7" }}
            >
              <span>{facultySummary.facultyAvgTimeStr}</span>
            </div>
            <span className="teacher-rank-metric-sub" style={{ color: "#0284c7" }}>
              ⏱️ Cutoff: 4:33 PM
            </span>
          </div>

          <div className="teacher-rank-metric-box">
            <span className="teacher-rank-metric-label">System Launch Date</span>
            <div
              className="teacher-rank-metric-val"
              style={{ fontSize: "0.98rem", color: "#1e293b" }}
            >
              <span>{facultySummary.overallFacultyStartDateStr}</span>
            </div>
            <span className="teacher-rank-metric-sub" style={{ color: "#3b82f6" }}>
              <Flag size={12} /> {facultySummary.totalTeachers} Teachers Active
            </span>
          </div>
        </div>

        {/* Visual Progress Graph: Top Teachers */}
        <div className="teacher-rank-home-graph-wrap">
          <div className="teacher-rank-graph-headline">
            <span>🏆 Top Punctual Faculty Leaders ({periodMode === "monthly" ? "This Month" : "Current Week"})</span>
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
              Sorted by On-Time &amp; Arrival Time
            </span>
          </div>

          {topTeachers.map((t, idx) => {
            const barClass =
              t.rank === 1
                ? "rank-1"
                : t.rank === 2
                ? "rank-2"
                : t.rank === 3
                ? "rank-3"
                : "";

            return (
              <div key={`top-rank-graph-${t.id || t.name || idx}-${t.rank || idx}-${idx}`} className="teacher-rank-graph-row">
                <div className="teacher-rank-graph-name-col">
                  <span>
                    {t.rank === 1 ? "🥇" : t.rank === 2 ? "🥈" : t.rank === 3 ? "🥉" : `#${t.rank}`}
                  </span>
                  <span>{t.name}</span>
                </div>

                <div className="teacher-rank-graph-bar-track">
                  <div
                    className={`teacher-rank-graph-bar-fill ${barClass}`}
                    style={{ width: `${Math.max(12, t.onTimePct)}%` }}
                  />
                </div>

                <div className="teacher-rank-graph-val-col">
                  <span>{t.onTimePct}%</span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "#64748b",
                      marginLeft: "4px",
                    }}
                  >
                    ({t.avgTimeStr})
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Button to Open Full Modal */}
        <button
          type="button"
          className="teacher-rank-home-cta-btn"
          onClick={() => setShowModal(true)}
        >
          <Trophy size={18} />
          <span>
            View Complete {periodMode === "monthly" ? "Monthly" : "Weekly"} Leaderboard &bull; All {facultySummary.totalTeachers} Teachers
          </span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Full Modal */}
      <AdminTeacherRankingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        teacherProfiles={teacherProfiles}
        portalAccessList={portalAccessList}
        teacherAttendance={teacherAttendance}
        initialMode={periodMode}
      />
    </>
  );
}

export default AdminTeacherRankingGraphCard;
