import React, { useState, useMemo } from "react";
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
} from "lucide-react";

export default function AdminTeacherAttendanceManager({
  teacherProfiles = [],
  portalAccessList = [],
  teacherAttendance = [],
  isKibarAdmin = false,
  onShowAction,
  onRefresh,
  onNavigateSettings,
}) {
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [status, setStatus] = useState("Present");
  const [timeStr, setTimeStr] = useState(() => {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  });
  const [minutes, setMinutes] = useState("90");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
          (r === "teacher" || r.includes("teacher")) &&
          !r.includes("kibar") &&
          !r.includes("student")
        );
      })
      .forEach((p) => {
        const id = String(p.user_id || p.id || p.email).trim();
        const name = p.full_name || p.name || p.email;
        const key = name.toLowerCase().trim();
        if (!renderedKeys.has(key)) {
          renderedKeys.add(key);
          list.push({ id, name, email: p.email });
        }
      });

    // From teacherProfiles
    (teacherProfiles || []).forEach((tp) => {
      const id = String(tp.user_id || tp.id || tp.email || tp.full_name).trim();
      const name = tp.full_name || tp.name || tp.email;
      const key = name.toLowerCase().trim();
      if (!renderedKeys.has(key)) {
        renderedKeys.add(key);
        list.push({ id, name, email: tp.email });
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [portalAccessList, teacherProfiles, isKibarAdmin]);

  // Handle Save
  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    if (!selectedTeacherId) {
      if (onShowAction) onShowAction("error", "Please select a teacher first.");
      return;
    }
    if (!selectedDate) {
      if (onShowAction) onShowAction("error", "Please select a date.");
      return;
    }

    const teacher = teacherOptions.find((t) => t.id === selectedTeacherId);
    const teacherName = teacher?.name || "Teacher";

    // Format 12-hour time string
    let formattedTime = "";
    if (timeStr) {
      const [rawH, rawM] = timeStr.split(":").map(Number);
      const ampm = rawH >= 12 ? "PM" : "AM";
      const h12 = rawH % 12 || 12;
      formattedTime = `@ ${h12}:${String(rawM).padStart(2, "0")} ${ampm}`;
    }

    const payload = {
      teacher_id: selectedTeacherId,
      teacher_name: teacherName,
      attendance_date: selectedDate,
      status: status,
      attendance_time: formattedTime,
      minutes_present: status === "Absent" ? 0 : Number(minutes) || 90,
      note: note || `Manual mark by Admin (${status})`,
      marked_by: isKibarAdmin ? "kibar_admin" : "admin",
      updated_at: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      const { error } = await supabase.from(tableName).upsert(payload);
      if (error) throw error;

      if (typeof window !== "undefined" && window.localStorage) {
        try {
          localStorage.setItem(
            `mauze_teacher_self_att_${selectedTeacherId}_${selectedDate}`,
            JSON.stringify(payload),
          );
          if (formattedTime) {
            localStorage.setItem(
              `mauze_att_time_${selectedTeacherId}_${selectedDate}`,
              formattedTime,
            );
          }
        } catch (_) {}
      }

      if (onShowAction) {
        onShowAction(
          "success",
          `Recorded ${status} attendance for ${teacherName} on ${selectedDate}!`,
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
        borderRadius: "16px",
        border: "1px solid rgba(212, 175, 55, 0.25)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
        padding: "20px 24px",
      }}
    >
      <div
        className="card-headline"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "16px",
          borderBottom: "1px solid rgba(212, 175, 55, 0.15)",
          paddingBottom: "12px",
        }}
      >
        <CalendarCheck size={22} style={{ color: "var(--primary-gold)" }} />
        <div>
          <h3 style={{ margin: 0, color: "var(--deep-brown)", fontSize: "1.08rem" }}>
            {isKibarAdmin ? "Kibar Faculty Attendance Marking" : "Atfal Faculty Attendance Marking"}
          </h3>
          <p
            style={{
              margin: "3px 0 0 0",
              fontSize: "0.8rem",
              color: "var(--text-muted)",
            }}
          >
            Manually record or update teacher attendance for any date
          </p>
        </div>
        {onNavigateSettings && (
          <button
            type="button"
            onClick={onNavigateSettings}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(212, 175, 55, 0.4)",
              background: "rgba(212, 175, 55, 0.1)",
              color: "#947414",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Configure geofence radius, venue pin, and timing window"
          >
            <MapPin size={14} />
            <span>Geofence & Timing Settings</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSaveAttendance} className="stack-form">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          {/* Teacher Selection */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--deep-brown)" }}>
              Teacher Name *
            </span>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="premium-select"
              required
              style={{ padding: "10px 12px", borderRadius: "10px" }}
            >
              <option value="">-- Select Teacher --</option>
              {teacherOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.email ? `(${t.email})` : ""}
                </option>
              ))}
            </select>
          </label>

          {/* Date Selection */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--deep-brown)" }}>
              Attendance Date *
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="premium-select"
              required
              style={{ padding: "10px 12px", borderRadius: "10px" }}
            />
          </label>

          {/* Status Selection */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--deep-brown)" }}>
              Status *
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="premium-select"
              style={{ padding: "10px 12px", borderRadius: "10px" }}
            >
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
              <option value="Leave">Leave / Uzur</option>
              <option value="Holiday">Holiday</option>
            </select>
          </label>

          {/* Time Input */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--deep-brown)" }}>
              Mark Time (HH:MM)
            </span>
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="premium-select"
              style={{ padding: "10px 12px", borderRadius: "10px" }}
            />
          </label>

          {/* Daily Minutes */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--deep-brown)" }}>
              Daily Session Minutes
            </span>
            <input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="premium-select"
              min="0"
              max="600"
              style={{ padding: "10px 12px", borderRadius: "10px" }}
            />
          </label>

          {/* Note */}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--deep-brown)" }}>
              Remarks / Note
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Approved leave or on-duty"
              className="premium-select"
              style={{ padding: "10px 12px", borderRadius: "10px" }}
            />
          </label>
        </div>

        <div style={{ marginTop: "18px", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={isSaving}
            className="action-button premium"
            style={{
              padding: "12px 28px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #1b7e42 0%, #27ae60 100%)",
              color: "#ffffff",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: isSaving ? "not-allowed" : "pointer",
              boxShadow: "0 4px 15px rgba(39, 174, 96, 0.35)",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {isSaving ? (
              <>
                <RotateCw size={17} className="spin" /> Saving...
              </>
            ) : (
              <>
                <Save size={17} /> Save Teacher Attendance
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
