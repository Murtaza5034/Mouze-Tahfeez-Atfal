import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "../supabaseClient";
import {
  CalendarCheck,
  User,
  Clock,
  CheckCircle2,
  Calendar,
  Save,
  RotateCw,
  Search,
  Settings,
  MapPin,
  AlertTriangle,
  Zap,
  Timer,
  XCircle,
  Coffee,
  Check,
  Award,
  Sparkles,
  Info,
} from "lucide-react";
import {
  AdminTeacherRankingModal,
  AdminTeacherRankingTriggerButton,
} from "./AdminTeacherRankingCard";
import { cleanPhotoUrl } from "../utils/imageUtils";

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
 * Formats a Date object to YYYY-MM-DD
 */
function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Formats YYYY-MM-DD to friendly human string (e.g., "Wednesday, 8 Oct 2026")
 */
function formatHumanDate(dateStr) {
  if (!dateStr) return "--";
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminTeacherAttendanceManager({
  teacherProfiles = [],
  portalAccessList = [],
  teacherAttendance = [],
  isKibarAdmin = false,
  onShowAction,
  onRefresh,
  onNavigateSettings,
}) {
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()));
  const [status, setStatus] = useState("Present");
  const [timeStr, setTimeStr] = useState("16:31"); // Default on-time 4:31 PM (30-33 window)
  const [minutes, setMinutes] = useState("90");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [liveAttendanceRecords, setLiveAttendanceRecords] = useState([]);

  const tableName = isKibarAdmin
    ? "kibar_teacher_attendance"
    : "teacher_attendance";

  // Filter teachers for Atfal vs Kibar
  const teacherOptions = useMemo(() => {
    const renderedKeys = new Set();
    const list = [];

    // From portalAccessList
    (portalAccessList || [])
      .filter((a) => {
        const r = (a.portal_role || "").toLowerCase();
        if (isKibarAdmin) {
          return (
            r === "kibar-teacher" ||
            (r.includes("teacher") && !r.includes("student"))
          );
        }
        return (
          (r === "teacher" || r.includes("teacher") || r.includes("muhaffiz")) &&
          !r.includes("kibar") &&
          !r.includes("student")
        );
      })
      .forEach((p) => {
        const id = String(p.user_id || p.id || p.email).trim();
        const name = p.full_name || p.name || p.email;
        const key = normalizeName(name);
        if (name && !renderedKeys.has(key)) {
          renderedKeys.add(key);
          list.push({
            id,
            name,
            email: p.email || "",
            photo_url: p.photo_url || null,
          });
        }
      });

    // From teacherProfiles
    (teacherProfiles || [])
      .filter((tp) => (isKibarAdmin ? tp.is_kibar : !tp.is_kibar))
      .forEach((tp) => {
        const id = String(tp.user_id || tp.id || tp.email || tp.full_name).trim();
        const name = tp.full_name || tp.name || tp.email;
        const key = normalizeName(name);
        if (name && !renderedKeys.has(key)) {
          renderedKeys.add(key);
          list.push({
            id,
            name,
            email: tp.email || "",
            photo_url: tp.photo_url || null,
          });
        }
      });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [portalAccessList, teacherProfiles, isKibarAdmin]);

  // Set default selected teacher if available
  useEffect(() => {
    if (!selectedTeacherId && teacherOptions.length > 0) {
      setSelectedTeacherId(teacherOptions[0].id);
    }
  }, [teacherOptions, selectedTeacherId]);

  // Filtered teachers based on search query
  const filteredTeacherOptions = useMemo(() => {
    if (!teacherSearch.trim()) return teacherOptions;
    const q = normalizeName(teacherSearch);
    return teacherOptions.filter(
      (t) =>
        normalizeName(t.name).includes(q) ||
        normalizeName(t.email).includes(q)
    );
  }, [teacherOptions, teacherSearch]);

  const currentTeacher = useMemo(() => {
    return teacherOptions.find((t) => t.id === selectedTeacherId) || null;
  }, [teacherOptions, selectedTeacherId]);

  // Fetch live table records for the selected date & teacher
  useEffect(() => {
    let isCancelled = false;
    const fetchRecentRecords = async () => {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(100);

        if (!error && Array.isArray(data) && !isCancelled) {
          setLiveAttendanceRecords(data);
        }
      } catch (err) {
        console.warn("Error fetching recent teacher attendance:", err);
      }
    };

    fetchRecentRecords();
    return () => {
      isCancelled = true;
    };
  }, [tableName]);

  // Combine prop attendance + fetched records
  const allRecords = useMemo(() => {
    const map = new Map();
    (liveAttendanceRecords || []).forEach((r) => {
      const k = `${r.teacher_id || normalizeName(r.teacher_name)}_${r.attendance_date}`;
      map.set(k, r);
    });
    (teacherAttendance || []).forEach((r) => {
      const k = `${r.teacher_id || normalizeName(r.teacher_name)}_${r.attendance_date}`;
      map.set(k, { ...map.get(k), ...r });
    });
    return Array.from(map.values());
  }, [liveAttendanceRecords, teacherAttendance]);

  // Check if attendance already exists for currently selected teacher + date
  const existingRecord = useMemo(() => {
    if (!selectedTeacherId || !selectedDate) return null;
    const teacherNameKey = currentTeacher ? normalizeName(currentTeacher.name) : "";

    // Check memory records
    const found = allRecords.find((r) => {
      const matchId = String(r.teacher_id) === String(selectedTeacherId);
      const matchName = normalizeName(r.teacher_name) === teacherNameKey;
      return (matchId || matchName) && r.attendance_date === selectedDate;
    });

    if (found) return found;

    // Check localStorage fallback
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const cached = localStorage.getItem(
          `mauze_teacher_self_att_${selectedTeacherId}_${selectedDate}`
        );
        if (cached) return JSON.parse(cached);
      } catch (_) {}
    }

    return null;
  }, [allRecords, selectedTeacherId, selectedDate, currentTeacher]);

  // Auto-fill inputs if existing record found when changing teacher or date
  const fillFromExisting = () => {
    if (!existingRecord) return;
    setStatus(existingRecord.status || "Present");
    setMinutes(String(existingRecord.minutes_present ?? 90));
    setNote(existingRecord.note || "");

    // Parse time
    const rawTime = existingRecord.attendance_time || "";
    if (rawTime) {
      const clean = rawTime.replace(/^@\s*/, "").trim();
      const m12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (m12) {
        let h = parseInt(m12[1], 10);
        const m = m12[2];
        const ampm = (m12[3] || "").toUpperCase();
        if (ampm === "PM" && h < 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        setTimeStr(`${String(h).padStart(2, "0")}:${m}`);
      }
    }
  };

  // Quick Date Chips
  const setQuickDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    setSelectedDate(formatDateKey(d));
  };

  // Quick Punctuality Actions
  // 1. On Time (30 to 33)
  const handleMarkOnTime = (minute = 31) => {
    setStatus("Present");
    const mStr = String(minute).padStart(2, "0");
    setTimeStr(`16:${mStr}`);
    setMinutes("90");
    setNote(`Manual mark by Admin (On-Time @ 4:${mStr} PM)`);
  };

  // 2. Late (34 to 35)
  const handleMarkLate = (minute = 34) => {
    setStatus("Late");
    const mStr = String(minute).padStart(2, "0");
    setTimeStr(`16:${mStr}`);
    setMinutes("90");
    setNote(`Manual mark by Admin (Late @ 4:${mStr} PM)`);
  };

  // 3. Absent
  const handleMarkAbsent = () => {
    setStatus("Absent");
    setMinutes("0");
    setTimeStr("");
    setNote("Manual mark by Admin (Absent)");
  };

  // 4. Leave / Uzur
  const handleMarkLeave = () => {
    setStatus("Leave");
    setMinutes("0");
    setTimeStr("");
    setNote("Manual mark by Admin (Approved Leave / Uzur)");
  };

  // 5. Holiday
  const handleMarkHoliday = () => {
    setStatus("Holiday");
    setMinutes("0");
    setTimeStr("");
    setNote("Manual mark by Admin (Holiday / Off)");
  };

  // Handle Save
  const handleSaveAttendance = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTeacherId) {
      if (onShowAction) onShowAction("error", "Please select a teacher first.");
      return;
    }
    if (!selectedDate) {
      if (onShowAction) onShowAction("error", "Please select an attendance date.");
      return;
    }

    const teacher = currentTeacher || { id: selectedTeacherId, name: "Teacher" };
    const teacherName = teacher.name || "Teacher";

    // Format 12-hour time string
    let formattedTime = "";
    if (timeStr && status !== "Absent" && status !== "Holiday") {
      const [rawH, rawM] = timeStr.split(":").map(Number);
      if (!isNaN(rawH) && !isNaN(rawM)) {
        const ampm = rawH >= 12 ? "PM" : "AM";
        const h12 = rawH % 12 || 12;
        formattedTime = `@ ${h12}:${String(rawM).padStart(2, "0")} ${ampm}`;
      }
    } else if (status === "Holiday") {
      formattedTime = "@ Holiday";
    }

    const payload = {
      teacher_id: selectedTeacherId,
      teacher_name: teacherName,
      attendance_date: selectedDate,
      status: status,
      attendance_time: formattedTime,
      minutes_present:
        status === "Absent" || status === "Leave" || status === "Holiday"
          ? 0
          : Number(minutes) || 90,
      note: note || `Manual mark by Admin (${status})`,
      marked_by: isKibarAdmin ? "kibar_admin" : "admin",
      updated_at: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      // 1. Supabase Upsert
      const { error } = await supabase.from(tableName).upsert(payload);
      if (error) throw error;

      // 2. Multi-Key LocalStorage Cache for 0ms Teacher Portal Sync
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          const normName = normalizeName(teacherName);
          localStorage.setItem(
            `mauze_teacher_self_att_${selectedTeacherId}_${selectedDate}`,
            JSON.stringify(payload)
          );
          if (normName) {
            localStorage.setItem(
              `mauze_teacher_self_att_${normName}_${selectedDate}`,
              JSON.stringify(payload)
            );
          }
          if (teacher.email) {
            localStorage.setItem(
              `mauze_teacher_self_att_${teacher.email}_${selectedDate}`,
              JSON.stringify(payload)
            );
          }

          if (formattedTime) {
            localStorage.setItem(
              `mauze_att_time_${selectedTeacherId}_${selectedDate}`,
              formattedTime
            );
            if (normName) {
              localStorage.setItem(
                `mauze_att_time_${normName}_${selectedDate}`,
                formattedTime
              );
            }
          }
        } catch (_) {}
      }

      // 3. Update local state
      setLiveAttendanceRecords((prev) => {
        const filtered = prev.filter(
          (r) =>
            !(
              (String(r.teacher_id) === String(selectedTeacherId) ||
                normalizeName(r.teacher_name) === normalizeName(teacherName)) &&
              r.attendance_date === selectedDate
            )
        );
        return [payload, ...filtered];
      });

      // 4. Dispatch custom event for real-time reflection across other open tabs/cards
      try {
        window.dispatchEvent(
          new CustomEvent("teacher_attendance_updated", {
            detail: { teacherId: selectedTeacherId, payload },
          })
        );
      } catch (_) {}

      if (onShowAction) {
        onShowAction(
          "success",
          `✅ Saved ${status.toUpperCase()} attendance for ${teacherName} on ${formatHumanDate(
            selectedDate
          )}!`
        );
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Error saving manual teacher attendance:", err);
      if (onShowAction) {
        onShowAction("error", "Failed to save attendance: " + err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      className="form-card card-appear"
      style={{
        marginBottom: "24px",
        background: "var(--surface-card, #ffffff)",
        borderRadius: "18px",
        border: "1px solid rgba(212, 175, 55, 0.35)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle Gold Ambient Gradient Top Glow */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "linear-gradient(90deg, #d4af37 0%, #f3e5ab 50%, #d4af37 100%)",
        }}
      />

      {/* Card Headline & Actions */}
      <div
        className="card-headline"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "20px",
          borderBottom: "1px solid rgba(212, 175, 55, 0.15)",
          paddingBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.05) 100%)",
              border: "1px solid rgba(212, 175, 55, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#947414",
            }}
          >
            <CalendarCheck size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3
                style={{
                  margin: 0,
                  color: "var(--deep-brown, #2c1810)",
                  fontSize: "1.15rem",
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                }}
              >
                {isKibarAdmin
                  ? "Kibar Faculty Attendance Marking"
                  : "Atfal Faculty Attendance Marking"}
              </h3>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "20px",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  background: isKibarAdmin ? "#eff6ff" : "#fef3c7",
                  color: isKibarAdmin ? "#1d4ed8" : "#b45309",
                  border: isKibarAdmin
                    ? "1px solid #bfdbfe"
                    : "1px solid #fde68a",
                }}
              >
                {isKibarAdmin ? "Kibar Admin" : "Atfal Admin"}
              </span>
            </div>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "0.82rem",
                color: "var(--text-muted, #64748b)",
              }}
            >
              Manual attendance marking &amp; historical correction &bull; Updates rankings &amp; teacher history cards
            </p>
          </div>
        </div>

        {/* Right Action Trigger Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <AdminTeacherRankingTriggerButton
            onClick={() => setShowRankingModal(true)}
            label="Weekly Faculty Ranking"
          />

          {onNavigateSettings && (
            <button
              type="button"
              onClick={onNavigateSettings}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid rgba(212, 175, 55, 0.4)",
                background: "rgba(212, 175, 55, 0.08)",
                color: "#947414",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Configure geofence radius, venue pin, and timing window"
            >
              <MapPin size={14} />
              <span>Geofence Settings</span>
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                border: "1px solid rgba(0,0,0,0.1)",
                background: "var(--surface-bg, #f8fafc)",
                color: "var(--text-main, #334155)",
                cursor: "pointer",
              }}
              title="Refresh Data"
            >
              <RotateCw size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Main Attendance Marking Form */}
      <form onSubmit={handleSaveAttendance} className="stack-form">
        {/* Row 1: Teacher Selector & Date Picker */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "18px",
            marginBottom: "16px",
          }}
        >
          {/* Teacher Selection with Monogram & Search */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--deep-brown, #2c1810)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <User size={15} style={{ color: "#d4af37" }} />
                <span>Select Faculty Teacher *</span>
              </label>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted, #64748b)",
                  fontWeight: 600,
                }}
              >
                {teacherOptions.length} Teachers
              </span>
            </div>

            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="premium-select"
              required
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1.5px solid rgba(212, 175, 55, 0.4)",
                fontSize: "0.92rem",
                fontWeight: 600,
                background: "#ffffff",
                color: "#1e293b",
                cursor: "pointer",
              }}
            >
              <option value="">-- Choose Teacher --</option>
              {teacherOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.email ? `(${t.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker with Quick Preset Chips */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--deep-brown, #2c1810)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Calendar size={15} style={{ color: "#d4af37" }} />
                <span>Attendance Date *</span>
              </label>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#2563eb",
                  fontWeight: 700,
                }}
              >
                {formatHumanDate(selectedDate)}
              </span>
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="premium-select"
              required
              style={{
                padding: "11px 14px",
                borderRadius: "12px",
                border: "1.5px solid rgba(212, 175, 55, 0.4)",
                fontSize: "0.92rem",
                fontWeight: 600,
                background: "#ffffff",
                color: "#1e293b",
                cursor: "pointer",
              }}
            />

            {/* Quick Date Selection Chips */}
            <div
              style={{
                display: "flex",
                gap: "6px",
                flexWrap: "wrap",
                marginTop: "2px",
              }}
            >
              <button
                type="button"
                onClick={() => setQuickDate(0)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  border:
                    selectedDate === formatDateKey(new Date())
                      ? "1.5px solid #d4af37"
                      : "1px solid rgba(0,0,0,0.1)",
                  background:
                    selectedDate === formatDateKey(new Date())
                      ? "#fef3c7"
                      : "rgba(0,0,0,0.03)",
                  color:
                    selectedDate === formatDateKey(new Date())
                      ? "#92400e"
                      : "#475569",
                  cursor: "pointer",
                }}
              >
                📅 Today
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(1)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "rgba(0,0,0,0.03)",
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                ⏪ Yesterday
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(2)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "rgba(0,0,0,0.03)",
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                2 Days Ago
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(3)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "rgba(0,0,0,0.03)",
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                3 Days Ago
              </button>
            </div>
          </div>
        </div>

        {/* Existing Record Live Card (If attendance exists for selected date) */}
        {existingRecord && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              marginBottom: "16px",
              background:
                existingRecord.status === "Present"
                  ? "rgba(16, 185, 129, 0.08)"
                  : existingRecord.status === "Late"
                  ? "rgba(245, 158, 11, 0.08)"
                  : "rgba(239, 68, 68, 0.08)",
              border:
                existingRecord.status === "Present"
                  ? "1px solid rgba(16, 185, 129, 0.3)"
                  : existingRecord.status === "Late"
                  ? "1px solid rgba(245, 158, 11, 0.3)"
                  : "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Info
                size={18}
                style={{
                  color:
                    existingRecord.status === "Present"
                      ? "#10b981"
                      : existingRecord.status === "Late"
                      ? "#f59e0b"
                      : "#ef4444",
                }}
              />
              <div>
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    color: "#1e293b",
                  }}
                >
                  Current Record for {formatHumanDate(selectedDate)}:
                </span>{" "}
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    background:
                      existingRecord.status === "Present"
                        ? "#d1fae5"
                        : existingRecord.status === "Late"
                        ? "#fef3c7"
                        : "#fee2e2",
                    color:
                      existingRecord.status === "Present"
                        ? "#065f46"
                        : existingRecord.status === "Late"
                        ? "#92400e"
                        : "#991b1b",
                  }}
                >
                  {existingRecord.status?.toUpperCase() || "PRESENT"}
                </span>{" "}
                <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                  {existingRecord.attendance_time
                    ? `(${existingRecord.attendance_time})`
                    : ""}{" "}
                  &bull; {existingRecord.minutes_present ?? 90} mins
                  {existingRecord.note ? ` • "${existingRecord.note}"` : ""}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={fillFromExisting}
              style={{
                padding: "4px 10px",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.15)",
                background: "#ffffff",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#475569",
                cursor: "pointer",
              }}
            >
              Load Existing Settings
            </button>
          </div>
        )}

        {/* Quick Punctuality One-Click Buttons Panel */}
        <div
          style={{
            padding: "16px",
            borderRadius: "14px",
            background: "rgba(212, 175, 55, 0.04)",
            border: "1px solid rgba(212, 175, 55, 0.2)",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 800,
                color: "var(--deep-brown, #2c1810)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Zap size={16} style={{ color: "#d97706" }} />
              Quick Punctuality Presets (One-Click)
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted, #64748b)",
              }}
            >
              Sets exact arrival time &bull; Auto-syncs ranking &amp; info graph
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "12px",
            }}
          >
            {/* 1. ON TIME (30 to 33) Section */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                background: "#f0fdf4",
                border: "1.5px solid #86efac",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    color: "#166534",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <CheckCircle2 size={15} style={{ color: "#16a34a" }} />
                  ⚡ ON TIME (30 to 33 min)
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "#15803d",
                    background: "#dcfce7",
                    padding: "2px 6px",
                    borderRadius: "6px",
                  }}
                >
                  +100 pts
                </span>
              </div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {[30, 31, 32, 33].map((m) => (
                  <button
                    key={`on-time-${m}`}
                    type="button"
                    onClick={() => handleMarkOnTime(m)}
                    style={{
                      flex: "1 1 auto",
                      padding: "6px 8px",
                      borderRadius: "8px",
                      border:
                        status === "Present" && timeStr === `16:${String(m).padStart(2, "0")}`
                          ? "1.5px solid #16a34a"
                          : "1px solid #bbf7d0",
                      background:
                        status === "Present" && timeStr === `16:${String(m).padStart(2, "0")}`
                          ? "#16a34a"
                          : "#ffffff",
                      color:
                        status === "Present" && timeStr === `16:${String(m).padStart(2, "0")}`
                          ? "#ffffff"
                          : "#166534",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      textAlign: "center",
                    }}
                  >
                    4:{String(m).padStart(2, "0")} PM
                  </button>
                ))}
              </div>
            </div>

            {/* 2. LATE (34 to 35) Section */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                background: "#fffbeb",
                border: "1.5px solid #fcd34d",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    color: "#92400e",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <Timer size={15} style={{ color: "#d97706" }} />
                  ⏱️ LATE (34 to 35 min)
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "#b45309",
                    background: "#fef3c7",
                    padding: "2px 6px",
                    borderRadius: "6px",
                  }}
                >
                  +25 pts
                </span>
              </div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {[34, 35, 40].map((m) => (
                  <button
                    key={`late-${m}`}
                    type="button"
                    onClick={() => handleMarkLate(m)}
                    style={{
                      flex: "1 1 auto",
                      padding: "6px 8px",
                      borderRadius: "8px",
                      border:
                        status === "Late" && timeStr === `16:${String(m).padStart(2, "0")}`
                          ? "1.5px solid #d97706"
                          : "1px solid #fde68a",
                      background:
                        status === "Late" && timeStr === `16:${String(m).padStart(2, "0")}`
                          ? "#d97706"
                          : "#ffffff",
                      color:
                        status === "Late" && timeStr === `16:${String(m).padStart(2, "0")}`
                          ? "#ffffff"
                          : "#92400e",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      textAlign: "center",
                    }}
                  >
                    4:{String(m).padStart(2, "0")} PM
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Absent / Leave / Off Presets */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                background: "#f8fafc",
                border: "1.5px solid #cbd5e1",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  color: "#475569",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <XCircle size={15} style={{ color: "#64748b" }} />
                Other Status Presets
              </span>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleMarkAbsent}
                  style={{
                    flex: "1 1 auto",
                    padding: "6px 8px",
                    borderRadius: "8px",
                    border:
                      status === "Absent"
                        ? "1.5px solid #dc2626"
                        : "1px solid #fecaca",
                    background: status === "Absent" ? "#dc2626" : "#ffffff",
                    color: status === "Absent" ? "#ffffff" : "#dc2626",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  ❌ Absent (-40 pts)
                </button>
                <button
                  type="button"
                  onClick={handleMarkLeave}
                  style={{
                    flex: "1 1 auto",
                    padding: "6px 8px",
                    borderRadius: "8px",
                    border:
                      status === "Leave"
                        ? "1.5px solid #6366f1"
                        : "1px solid #e0e7ff",
                    background: status === "Leave" ? "#6366f1" : "#ffffff",
                    color: status === "Leave" ? "#ffffff" : "#4338ca",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  🏖️ Leave / Uzur
                </button>
                <button
                  type="button"
                  onClick={handleMarkHoliday}
                  style={{
                    flex: "1 1 auto",
                    padding: "6px 8px",
                    borderRadius: "8px",
                    border:
                      status === "Holiday"
                        ? "1.5px solid #0891b2"
                        : "1px solid #cffafe",
                    background: status === "Holiday" ? "#0891b2" : "#ffffff",
                    color: status === "Holiday" ? "#ffffff" : "#0e7490",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  🎉 Holiday
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Detailed Inputs for Fine Tuning */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          {/* Status Selection */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--deep-brown, #2c1810)",
              }}
            >
              Status *
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="premium-select"
              style={{
                padding: "11px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(212, 175, 55, 0.35)",
                fontWeight: 600,
              }}
            >
              <option value="Present">Present (On Time)</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
              <option value="Leave">Leave / Uzur</option>
              <option value="Holiday">Holiday</option>
            </select>
          </label>

          {/* Time Input */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--deep-brown, #2c1810)",
              }}
            >
              Check-in Time (24H)
            </span>
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="premium-select"
              disabled={status === "Absent" || status === "Holiday"}
              style={{
                padding: "11px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(212, 175, 55, 0.35)",
                fontWeight: 600,
              }}
            />
          </label>

          {/* Daily Minutes */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--deep-brown, #2c1810)",
              }}
            >
              Session Minutes
            </span>
            <input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="premium-select"
              min="0"
              max="600"
              disabled={status === "Absent" || status === "Leave" || status === "Holiday"}
              style={{
                padding: "11px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(212, 175, 55, 0.35)",
                fontWeight: 600,
              }}
            />
          </label>

          {/* Note / Remarks */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--deep-brown, #2c1810)",
              }}
            >
              Remarks / Note
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Manual mark by admin"
              className="premium-select"
              style={{
                padding: "11px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(212, 175, 55, 0.35)",
              }}
            />
          </label>
        </div>

        {/* Submit Save Button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            borderTop: "1px solid rgba(212, 175, 55, 0.15)",
            paddingTop: "16px",
          }}
        >
          <div
            style={{
              fontSize: "0.82rem",
              color: "var(--text-muted, #64748b)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Sparkles size={15} style={{ color: "#d4af37" }} />
            <span>
              Target: <strong>{currentTeacher?.name || "Selected Teacher"}</strong> on{" "}
              <strong>{formatHumanDate(selectedDate)}</strong>
            </span>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="action-button premium"
            style={{
              padding: "12px 32px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #1b7e42 0%, #27ae60 100%)",
              color: "#ffffff",
              fontSize: "0.98rem",
              fontWeight: 800,
              cursor: isSaving ? "not-allowed" : "pointer",
              boxShadow: "0 4px 18px rgba(39, 174, 96, 0.4)",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            {isSaving ? (
              <>
                <RotateCw size={18} className="spin" />
                <span>Recording Attendance...</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Save Teacher Attendance</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Weekly Faculty Ranking Modal */}
      <AdminTeacherRankingModal
        isOpen={showRankingModal}
        onClose={() => setShowRankingModal(false)}
        teacherProfiles={teacherProfiles}
        portalAccessList={portalAccessList}
        teacherAttendance={allRecords}
      />
    </section>
  );
}
