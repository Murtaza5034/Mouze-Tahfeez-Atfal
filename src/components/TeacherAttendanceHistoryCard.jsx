import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { ChevronLeft, ChevronRight, CalendarCheck, Clock } from "lucide-react";
import "./AsbaaqAttendanceHistoryCard.css";

/**
 * Extracts and formats time string (e.g. "@ 4:26 PM")
 */
function extractAttendanceTime(record, teacherId, dateKey) {
  if (!record) {
    // Check localStorage cache
    if (typeof window !== "undefined" && window.localStorage && dateKey && teacherId) {
      try {
        const cachedTime = localStorage.getItem(`mauze_att_time_${teacherId}_${dateKey}`);
        if (cachedTime) {
          const clean = cachedTime.trim();
          return clean.startsWith("@") ? clean : `@ ${clean}`;
        }
      } catch (_) {}
    }
    return "";
  }

  // 1. Direct time property
  const directTime = record.attendance_time || record.time || record.mark_time;
  if (directTime) {
    const clean = String(directTime).trim();
    if (clean) return clean.startsWith("@") ? clean : `@ ${clean}`;
  }

  // 2. Updated_at / Timestamp
  const ts = record.updated_at || record.timestamp || record.created_at;
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `@ ${h}:${m} ${ampm}`;
    }
  }

  // 3. Fallback localStorage
  if (typeof window !== "undefined" && window.localStorage && dateKey && teacherId) {
    try {
      const cachedTime = localStorage.getItem(`mauze_att_time_${teacherId}_${dateKey}`);
      if (cachedTime) {
        const clean = cachedTime.trim();
        return clean.startsWith("@") ? clean : `@ ${clean}`;
      }
    } catch (_) {}
  }

  return "";
}

export default function TeacherAttendanceHistoryCard({
  teacherIdentity,
  user,
  portalAccess,
  teacherProfiles = [],
  isKibarTeacher = false,
}) {
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = prev week, etc.
  const [weekRecords, setWeekRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // Current date
  const now = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [now]);

  // Determine teacher unique ID
  const teacherId = useMemo(() => {
    const raw =
      user?.id ||
      portalAccess?.user_id ||
      portalAccess?.id ||
      teacherIdentity ||
      "";
    return String(raw).trim();
  }, [user, portalAccess, teacherIdentity]);

  const tableName = isKibarTeacher
    ? "kibar_teacher_attendance"
    : "teacher_attendance";

  // Calculate Saturday-to-Friday week cycle (matching Asbaaq style)
  const { weekDays, weekRangeStr } = useMemo(() => {
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
      const yearStr = String(d.getFullYear()).slice(-2);

      days.push({
        dateObj: d,
        dateKey,
        dayName: DAY_NAMES[i],
        dayIndex: i,
        line1: `${dayNum}-${monthStr}-`,
        line2: `${yearStr}`,
        isSunday: i === 1,
      });
    }

    const fri = days[6].dateObj;
    const rangeLabel = `${days[0].dateObj.getDate()} ${days[0].dateObj.toLocaleDateString("en-US", { month: "short" })} - ${fri.getDate()} ${fri.toLocaleDateString("en-US", { month: "short" })}`;

    return { weekDays: days, weekRangeStr: rangeLabel };
  }, [now, weekOffset]);

  // Fetch weekly attendance records
  const fetchWeekHistory = useCallback(async () => {
    if (!teacherId || weekDays.length === 0) return;
    setLoading(true);
    try {
      const startDate = weekDays[0].dateKey;
      const endDate = weekDays[6].dateKey;

      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("teacher_id", teacherId)
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate);

      if (!error && Array.isArray(data)) {
        setWeekRecords(data);
      }
    } catch (e) {
      console.warn("Error fetching teacher weekly attendance history:", e);
    } finally {
      setLoading(false);
    }
  }, [teacherId, tableName, weekDays]);

  useEffect(() => {
    fetchWeekHistory();
  }, [fetchWeekHistory]);

  // Real-time listener for attendance updates
  useEffect(() => {
    if (!teacherId) return;
    const channel = supabase
      .channel(`teacher-history-grid-${teacherId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: tableName },
        () => {
          fetchWeekHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherId, tableName, fetchWeekHistory]);

  // Map records by dateKey
  const recordsMap = useMemo(() => {
    const map = {};
    weekRecords.forEach((rec) => {
      if (rec?.attendance_date) {
        map[rec.attendance_date] = rec;
      }
    });

    // Check localStorage fallback for dates in current week
    if (typeof window !== "undefined" && window.localStorage && teacherId) {
      weekDays.forEach((day) => {
        if (!map[day.dateKey]) {
          try {
            const cached = localStorage.getItem(
              `mauze_teacher_self_att_${teacherId}_${day.dateKey}`
            );
            if (cached) {
              map[day.dateKey] = JSON.parse(cached);
            }
          } catch (_) {}
        }
      });
    }

    return map;
  }, [weekRecords, weekDays, teacherId]);

  // Compute Weekly Summary for Slot 8
  const { presentCount, lateCount, totalWorkingDays, attendancePct } = useMemo(() => {
    let presents = 0;
    let lates = 0;
    let working = 0;

    weekDays.forEach((day) => {
      if (!day.isSunday) {
        working++;
        const rec = recordsMap[day.dateKey];
        const status = String(rec?.status || "").toLowerCase().trim();
        if (status === "present") {
          presents++;
        } else if (status === "late") {
          lates++;
          presents++; // Late counts as present for percentage
        }
      }
    });

    const pct = working > 0 ? Math.round((presents / working) * 100) : 0;
    return {
      presentCount: presents,
      lateCount: lates,
      totalWorkingDays: working,
      attendancePct: pct,
    };
  }, [weekDays, recordsMap]);

  return (
    <div className="asbaaq-history-card-container card-appear">
      {/* Deep Navy Header with Gold Typography */}
      <div className="asbaaq-history-header">
        {/* Subtle Ornamental Filigree Watermark on Right */}
        <svg
          className="asbaaq-header-watermark"
          viewBox="0 0 220 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M130,40 Q150,10 180,25 Q210,40 190,65 Q170,80 150,60 Q130,40 160,30 Q190,20 200,50"
            stroke="#265a8e"
            strokeWidth="1.8"
            fill="none"
            opacity="0.5"
          />
          <path
            d="M150,20 Q170,5 195,15 Q205,30 185,45 Q165,55 155,35"
            stroke="#265a8e"
            strokeWidth="1.4"
            fill="none"
            opacity="0.4"
          />
        </svg>

        {/* Left Side: Attendance Icon + Single Line Title */}
        <div className="asbaaq-header-left">
          <div className="asbaaq-att-icon-wrap" title="Teacher Attendance History">
            <CalendarCheck size={18} className="asbaaq-att-icon" />
          </div>
          <h3 className="asbaaq-header-title-single">
            Teacher Attendance History
          </h3>
        </div>

        {/* Header Right: Premium Week Selection Tab */}
        <div className="asbaaq-header-nav-tab">
          <button
            type="button"
            className="asbaaq-nav-btn prev"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            title="Previous Week"
            aria-label="Previous Week"
          >
            <ChevronLeft size={14} />
          </button>

          <button
            type="button"
            className="asbaaq-week-tab-label"
            onClick={() => setWeekOffset(0)}
            title={weekOffset === 0 ? "Current Week" : "Click to reset to This Week"}
          >
            {weekOffset === 0
              ? "THIS WEEK"
              : weekOffset === 1
              ? "NEXT WEEK"
              : weekOffset === -1
              ? "LAST WEEK"
              : weekRangeStr}
          </button>

          <button
            type="button"
            className="asbaaq-nav-btn next"
            disabled={weekOffset >= 2}
            onClick={() => setWeekOffset((prev) => Math.min(2, prev + 1))}
            title="Next Week Selection"
            aria-label="Next Week Selection"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Grid of 4 Columns x 2 Rows */}
      <div className="asbaaq-grid-body">
        <div className="asbaaq-days-grid">
          {/* Days 1 to 7: Saturday to Friday */}
          {weekDays.map((day) => {
            const rec = recordsMap[day.dateKey];
            const isToday = day.dateKey === todayKey;

            let statusType = "empty"; // 'present' | 'late' | 'holiday' | 'absent' | 'empty'
            let statusLabel = "—";
            let timeText = "";
            let methodText = "Not Marked";

            if (rec) {
              const s = String(rec.status || "").trim().toLowerCase();
              timeText = extractAttendanceTime(rec, teacherId, day.dateKey);

              if (s === "present") {
                statusType = "present";
                statusLabel = "PRESENT";
                methodText = "On Time";
              } else if (s === "late") {
                statusType = "late";
                statusLabel = "LATE";
                methodText = "Late";
              } else if (s === "absent") {
                statusType = "absent";
                statusLabel = "ABSENT";
                methodText = "Absent";
              } else if (s === "holiday") {
                statusType = "holiday";
                statusLabel = "HOLIDAY";
                timeText = "@ Holiday";
                methodText = "Holiday";
              } else {
                statusType = "present";
                statusLabel = s.toUpperCase();
                methodText = "Marked";
              }
            } else {
              // Sunday by default is holiday
              if (day.isSunday) {
                statusType = "holiday";
                statusLabel = "HOLIDAY";
                timeText = "@ Holiday";
                methodText = "Weekly Off";
              } else {
                statusType = "empty";
                statusLabel = "—";
                timeText = "";
                methodText = "Not Marked";
              }
            }

            return (
              <div key={day.dateKey} className="asbaaq-day-col">
                {/* Top Date Box */}
                <div
                  className={`asbaaq-date-box ${isToday ? "is-today" : ""}`}
                  title={`${day.dayName}, ${day.line1}${day.line2}`}
                >
                  <span className="asbaaq-day-indicator">{day.dayName}</span>
                  <span className="asbaaq-date-line-1">{day.line1}</span>
                  <span className="asbaaq-date-line-2">{day.line2}</span>
                </div>

                {/* Bottom Status Box */}
                <div className={`asbaaq-status-box asbaaq-status-${statusType}`}>
                  {statusType === "empty" ? (
                    <>
                      <span className="asbaaq-dash-text">—</span>
                      <span className="asbaaq-method-text asbaaq-not-marked">
                        Not Marked
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="asbaaq-status-text">{statusLabel}</span>
                      {timeText && (
                        <span className="asbaaq-time-text" title={`Marked at ${timeText}`}>
                          {timeText}
                        </span>
                      )}
                      <span className="asbaaq-method-text">{methodText}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Slot 8: Weekly Attendance Summary Box */}
          <div className="asbaaq-day-col asbaaq-summary-col">
            <div className="asbaaq-summary-box">
              <span className="asbaaq-summary-header-label">WEEK SUMMARY</span>
              <div
                className="asbaaq-summary-circle"
                style={{
                  borderColor:
                    attendancePct === 100
                      ? "#27ae60"
                      : attendancePct >= 80
                      ? "#f5c042"
                      : attendancePct >= 50
                      ? "#e67e22"
                      : "#dc2626",
                }}
              >
                <span className="asbaaq-summary-pct">{attendancePct}%</span>
              </div>
              <span className="asbaaq-summary-sub">
                {presentCount}/{totalWorkingDays} Days Marked
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
