import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../supabaseClient";
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  ShieldCheck,
  RotateCw,
  Sparkles,
  ChevronRight,
  X,
} from "lucide-react";
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  normalizeAttendanceSettings,
  fetchAttendanceSettings,
  checkAttendanceWindow,
  calculateHaversineDistanceMeters,
  getExactUserLocation,
} from "../utils/attendanceSettingsHelper";
import "./TeacherSelfAttendanceCard.css";

/**
 * Format a Date object or timestamp into 12-hour display string (e.g. "@ 4:26 PM")
 */
function formatTimeDisplay(dateOrString) {
  if (!dateOrString) return "";
  let d;
  if (dateOrString instanceof Date) {
    d = dateOrString;
  } else if (typeof dateOrString === "string") {
    const clean = dateOrString.trim();
    if (clean.match(/^@?\s*\d{1,2}:\d{2}/i)) {
      return clean.startsWith("@") ? clean : `@ ${clean}`;
    }
    d = new Date(clean);
  } else if (typeof dateOrString === "object" && dateOrString.seconds) {
    d = new Date(dateOrString.seconds * 1000);
  }
  if (!d || isNaN(d.getTime())) return "";
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `@ ${h}:${m} ${ampm}`;
}

export default function TeacherSelfAttendanceCard({
  teacherIdentity,
  user,
  portalAccess,
  teacherProfiles = [],
  isKibarTeacher = false,
  onShowAction,
}) {
  // Current live clock state — updates every 10 seconds to respond quickly to window boundaries
  const [now, setNow] = useState(() => new Date());

  // Settings from database
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_ATTENDANCE_SETTINGS,
  }));
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Geolocation state
  const [userCoords, setUserCoords] = useState(null); // { lat, lng, accuracy }
  const [locationStatus, setLocationStatus] = useState("locating"); // 'locating' | 'granted' | 'denied' | 'error'
  const [locationError, setLocationError] = useState(null);

  // Today's attendance record and submission state
  const [todayRecord, setTodayRecord] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalDetails, setModalDetails] = useState(null);

  // Teacher Identity
  const teacherId = useMemo(() => {
    const raw =
      user?.id ||
      portalAccess?.user_id ||
      portalAccess?.id ||
      teacherIdentity ||
      "";
    return String(raw).trim();
  }, [user, portalAccess, teacherIdentity]);

  const teacherName = useMemo(() => {
    return (
      portalAccess?.full_name ||
      user?.user_metadata?.full_name ||
      teacherIdentity ||
      user?.email?.split("@")[0] ||
      "Teacher"
    );
  }, [portalAccess, user, teacherIdentity]);

  const attendanceTable = isKibarTeacher
    ? "kibar_teacher_attendance"
    : "teacher_attendance";

  const settingsTable = isKibarTeacher
    ? "kibar_teacher_attendance_settings"
    : "teacher_attendance_settings";

  // Today's local date string YYYY-MM-DD
  const todayKey = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [now]);

  // -------------------------------------------------------------------------
  // 1. Clock interval (keeps time current so card unhides/hides dynamically)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000); // Check every 10 seconds
    return () => clearInterval(timer);
  }, []);

  // -------------------------------------------------------------------------
  // 2. Fetch Attendance Settings & Subscribe to Real-time Updates
  // -------------------------------------------------------------------------
  const loadSettingsFromDB = useCallback(async () => {
    try {
      const data = await fetchAttendanceSettings(isKibarTeacher);
      setSettings(data);
    } catch (err) {
      console.warn("Failed to load attendance settings:", err);
    } finally {
      setSettingsLoaded(true);
    }
  }, [isKibarTeacher]);

  useEffect(() => {
    loadSettingsFromDB();
  }, [loadSettingsFromDB]);

  // Real-time listener for admin setting changes
  useEffect(() => {
    const channel = supabase
      .channel(`att-settings-channel-${isKibarTeacher ? "kibar" : "atfal"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: settingsTable },
        (payload) => {
          if (payload?.new) {
            setSettings(normalizeAttendanceSettings(payload.new));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [settingsTable, isKibarTeacher]);

  // -------------------------------------------------------------------------
  // 3. Evaluate Time Window (Condition 1)
  // -------------------------------------------------------------------------
  const windowStatus = useMemo(() => {
    return checkAttendanceWindow(settings, now);
  }, [settings, now]);

  // -------------------------------------------------------------------------
  // 4. Fetch User GPS Location (Condition 2)
  // -------------------------------------------------------------------------
  const fetchLocation = useCallback(async () => {
    setLocationStatus("locating");
    setLocationError(null);
    try {
      const pos = await getExactUserLocation();
      setUserCoords(pos);
      setLocationStatus("granted");
    } catch (err) {
      console.warn("[TeacherSelfAttendance] GPS error:", err);
      if (err.message === "LOCATION_PERMISSION_DENIED") {
        setLocationStatus("denied");
        setLocationError("GPS permission denied. Please allow location access.");
      } else {
        setLocationStatus("error");
        setLocationError("Could not retrieve GPS coordinates. Please check your device location settings.");
      }
    }
  }, []);

  // Only request location if we are in the time window (saves device battery)
  useEffect(() => {
    if (windowStatus.isInWindow) {
      fetchLocation();
    }
  }, [windowStatus.isInWindow, fetchLocation]);

  // -------------------------------------------------------------------------
  // 5. Calculate Haversine Distance
  // -------------------------------------------------------------------------
  const distanceMeters = useMemo(() => {
    if (!userCoords || userCoords.lat == null || userCoords.lng == null) {
      return null;
    }
    return calculateHaversineDistanceMeters(
      userCoords.lat,
      userCoords.lng,
      settings.venue_lat,
      settings.venue_lng
    );
  }, [userCoords, settings.venue_lat, settings.venue_lng]);

  // Strict Geofence rule: must be <= admin-configured radius (e.g. 15 meters)
  const isInsideGeofence = useMemo(() => {
    if (distanceMeters == null) return false;
    return distanceMeters <= (settings.radius || DEFAULT_ATTENDANCE_SETTINGS.radius);
  }, [distanceMeters, settings.radius]);

  // -------------------------------------------------------------------------
  // 6. Fetch Today's Attendance Record for Current Teacher
  // -------------------------------------------------------------------------
  const fetchTodayAttendance = useCallback(async () => {
    if (!teacherId) return;
    try {
      const { data, error } = await supabase
        .from(attendanceTable)
        .select("*")
        .eq("teacher_id", teacherId)
        .eq("attendance_date", todayKey)
        .maybeSingle();

      if (!error && data) {
        setTodayRecord(data);
      } else {
        // Fallback: local storage
        if (typeof window !== "undefined" && window.localStorage) {
          const cached = localStorage.getItem(
            `mauze_teacher_self_att_${teacherId}_${todayKey}`
          );
          if (cached) {
            try {
              setTodayRecord(JSON.parse(cached));
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.warn("Error fetching today's attendance record:", err);
    }
  }, [teacherId, attendanceTable, todayKey]);

  useEffect(() => {
    fetchTodayAttendance();
  }, [fetchTodayAttendance]);

  // Real-time listener for teacher attendance row changes
  useEffect(() => {
    if (!teacherId) return;
    const channel = supabase
      .channel(`att-row-channel-${teacherId}-${todayKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: attendanceTable },
        (payload) => {
          const row = payload.new || payload.old;
          if (
            row &&
            String(row.teacher_id) === String(teacherId) &&
            row.attendance_date === todayKey
          ) {
            setTodayRecord(row);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherId, todayKey, attendanceTable]);

  // -------------------------------------------------------------------------
  // 7. Handle Mark Attendance Action
  // -------------------------------------------------------------------------
  const handleMarkAttendance = async () => {
    if (!isInsideGeofence) {
      if (onShowAction) {
        onShowAction(
          "error",
          `Cannot mark attendance: You must be strictly within ${settings.radius}m of ${settings.venue_name}.`
        );
      }
      return;
    }

    if (!windowStatus.isInWindow) {
      if (onShowAction) {
        onShowAction(
          "error",
          `Self attendance is only open between ${windowStatus.startLabel} and ${windowStatus.endLabel}.`
        );
      }
      return;
    }

    setIsSubmitting(true);
    const markTime = new Date();
    const formattedTime = formatTimeDisplay(markTime);

    // 4:33 PM cutoff logic: 4:33:00 PM or after is marked as Late
    const markHours = markTime.getHours();
    const markMinutes = markTime.getMinutes();
    const markSeconds = markTime.getSeconds();
    const totalCurrentSec = markHours * 3600 + markMinutes * 60 + markSeconds;
    const lateThresholdSec = 16 * 3600 + 33 * 60; // 4:33:00 PM = 59580s
    const isLate = totalCurrentSec >= lateThresholdSec;
    const assignedStatus = isLate ? "Late" : "Present";

    const payload = {
      teacher_id: teacherId,
      teacher_name: teacherName,
      attendance_date: todayKey,
      status: assignedStatus,
      attendance_time: formattedTime,
      minutes_present: isLate ? 80 : 90,
      note: isLate
        ? `Self-marked via GPS at ${settings.venue_name} (Late - after 4:33 PM, ${distanceMeters}m away)`
        : `Self-marked via GPS at ${settings.venue_name} (On Time, ${distanceMeters}m away)`,
      marked_by: "self",
      latitude: userCoords?.lat || null,
      longitude: userCoords?.lng || null,
      distance_meters: distanceMeters,
      venue_name: settings.venue_name,
      updated_at: markTime.toISOString(),
    };

    try {
      const { error } = await supabase
        .from(attendanceTable)
        .upsert(payload, { onConflict: "teacher_id,attendance_date" });

      if (error) throw error;

      // Update local state immediately
      setTodayRecord(payload);

      if (typeof window !== "undefined" && window.localStorage) {
        try {
          localStorage.setItem(
            `mauze_teacher_self_att_${teacherId}_${todayKey}`,
            JSON.stringify(payload)
          );
          localStorage.setItem(
            `mauze_att_time_${teacherId}_${todayKey}`,
            formattedTime
          );
        } catch (_) {}
      }

      setModalDetails({
        time: formattedTime,
        date: todayKey,
        venue: settings.venue_name,
        distance: distanceMeters,
        isLate,
        status: assignedStatus,
      });
      setShowSuccessModal(true);

      if (onShowAction) {
        onShowAction(
          isLate ? "info" : "success",
          isLate
            ? `Attendance recorded at ${formattedTime} as Late (after 4:33 PM).`
            : `Attendance marked successfully as Present at ${formattedTime}!`
        );
      }
    } catch (err) {
      console.error("Attendance submission error:", err);
      if (onShowAction) {
        onShowAction("error", "Failed to mark attendance: " + (err.message || "Network error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // 8. STRICT HIDE/UNHIDE VISIBILITY LOGIC
  // -------------------------------------------------------------------------

  // CONDITION 1: Time Window & Active Days Check
  // Must return null if outside the window or inactive day
  if (!windowStatus.isInWindow) {
    return null;
  }

  // UI/UX Requirement: Skeleton Loader while fetching location & validating constraints
  if (locationStatus === "locating") {
    return (
      <div className="teacher-self-att-wrapper card-appear">
        <div className="teacher-att-skeleton-card">
          <div className="teacher-att-skeleton-header">
            <div className="teacher-att-skeleton-title-row">
              <div className="teacher-att-skeleton-circle teacher-att-skeleton-shimmer" />
              <div className="teacher-att-skeleton-lines">
                <div className="teacher-att-skeleton-line-lg teacher-att-skeleton-shimmer" />
                <div className="teacher-att-skeleton-line-sm teacher-att-skeleton-shimmer" />
              </div>
            </div>
            <div className="teacher-att-skeleton-line-sm teacher-att-skeleton-shimmer" style={{ width: 60 }} />
          </div>

          <div className="teacher-att-skeleton-body teacher-att-skeleton-shimmer" />
          <div className="teacher-att-skeleton-btn teacher-att-skeleton-shimmer" />

          <div className="teacher-att-skeleton-status">
            <RotateCw size={13} className="att-spin" />
            <span>Validating device GPS & venue geofence...</span>
          </div>
        </div>
      </div>
    );
  }

  // Graceful Handling: Location permission denied or error
  if (locationStatus === "denied" || locationStatus === "error") {
    return (
      <div className="teacher-self-att-wrapper card-appear">
        <div className="teacher-permission-card">
          <div className="teacher-permission-header">
            <h3 className="teacher-permission-header-title">
              <AlertTriangle size={18} /> GPS Location Required
            </h3>
            <span style={{ fontSize: "0.72rem", color: "#f5c042", fontWeight: 700 }}>
              {windowStatus.startLabel} – {windowStatus.endLabel}
            </span>
          </div>
          <div className="teacher-permission-body">
            <p className="teacher-permission-text">
              {locationError ||
                `Please allow location access on your device so we can verify your presence at ${settings.venue_name} to mark self attendance.`}
            </p>
            <button
              type="button"
              className="teacher-permission-btn"
              onClick={fetchLocation}
            >
              <Navigation size={16} />
              <span>Allow GPS Location</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CONDITION 2 & STRICT RULE: Location Geofence Check
  // "The card must remain completely hidden unless the user is strictly inside the defined geofence radius.
  // If they are even a few meters outside the venue, the card must not be visible in the DOM."
  if (!isInsideGeofence) {
    return null;
  }

  // -------------------------------------------------------------------------
  // 9. RENDER THE PREMIUM "MARK SELF ATTENDANCE" CARD
  // -------------------------------------------------------------------------
  const isAlreadyMarked = Boolean(
    todayRecord &&
      (String(todayRecord.status).toLowerCase() === "present" ||
        String(todayRecord.status).toLowerCase() === "late")
  );

  return (
    <div className="teacher-self-att-wrapper card-appear">
      <div className="teacher-self-att-card">
        {/* Card Header */}
        <div className="teacher-self-att-header">
          {/* Subtle Mosque SVG Watermark */}
          <svg
            className="teacher-self-att-header-watermark"
            viewBox="0 0 100 100"
            fill="currentColor"
          >
            <path
              d="M50 0 L60 30 L90 30 L65 50 L75 80 L50 62 L25 80 L35 50 L10 30 L40 30 Z"
              opacity="0.25"
            />
          </svg>

          <div className="teacher-self-att-header-left">
            <div className="teacher-self-att-icon-wrap">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="teacher-self-att-header-title">
                Mark Self Attendance
              </h3>
              <p className="teacher-self-att-header-sub">
                <ShieldCheck size={12} /> {settings.venue_name} • Geofence Verified
              </p>
            </div>
          </div>

          {/* Live digital time pill */}
          <div className="teacher-self-att-time-pill" title="Live clock">
            <Clock size={12} />
            <span>
              {now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="teacher-self-att-body">
          {/* Verified Geofence Banner */}
          <div className="teacher-loc-banner verified">
            <div className="teacher-loc-icon-col">
              <CheckCircle2 size={18} />
            </div>
            <div className="teacher-loc-content">
              <div className="teacher-loc-title">
                Location Verified: Inside {settings.venue_name}
              </div>
              <div className="teacher-loc-desc">
                Distance: {distanceMeters != null ? `${distanceMeters}m` : "Within radius"} (Strict radius: {settings.radius}m).
              </div>
            </div>
            <button
              type="button"
              className="teacher-loc-refresh-btn"
              onClick={fetchLocation}
              title="Refresh GPS"
            >
              <RotateCw size={11} /> Refresh
            </button>
          </div>

          {/* Time Window Details */}
          <div className="teacher-window-row">
            <div className="teacher-window-left">
              <Clock size={14} />
              <span>Window: {windowStatus.startLabel} – {windowStatus.endLabel}</span>
            </div>
            <div className="teacher-window-countdown">
              <span>Closes in {windowStatus.minutesRemaining}m</span>
            </div>
          </div>

          {/* Action Button OR Already Marked State */}
          {isAlreadyMarked ? (
            <div
              className={`teacher-already-marked-box ${
                String(todayRecord?.status).toLowerCase() === "late"
                  ? "late"
                  : "present"
              }`}
            >
              <div
                className={`teacher-already-icon ${
                  String(todayRecord?.status).toLowerCase() === "late"
                    ? "late"
                    : "present"
                }`}
              >
                {String(todayRecord?.status).toLowerCase() === "late" ? (
                  <AlertTriangle size={24} />
                ) : (
                  <CheckCircle2 size={24} />
                )}
              </div>
              <div>
                <h4
                  className={`teacher-already-title ${
                    String(todayRecord?.status).toLowerCase() === "late"
                      ? "late"
                      : "present"
                  }`}
                >
                  {String(todayRecord?.status).toLowerCase() === "late"
                    ? "Attendance Marked (Late)"
                    : "Attendance Marked Successfully"}
                </h4>
                <p className="teacher-already-sub">
                  <span>
                    Status:{" "}
                    <strong>{todayRecord?.status || "Present"}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    {todayRecord?.attendance_time || "Recorded for today"}
                  </span>
                  {String(todayRecord?.status).toLowerCase() === "late" && (
                    <span style={{ color: "#ea580c", fontWeight: 700 }}>
                      (After 4:33 PM)
                    </span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="teacher-mark-btn"
              onClick={handleMarkAttendance}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RotateCw size={18} className="att-spin" />
                  <span>Recording Attendance...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Mark Attendance as Present</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && modalDetails && (
        <div
          className="teacher-att-modal-overlay"
          onClick={() => setShowSuccessModal(false)}
        >
          <div
            className="teacher-att-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {modalDetails.isLate ? (
              /* =======================================================
                 LATE ALERT POPUP (4:33 PM or after)
                 ======================================================= */
              <>
                <div className="teacher-att-modal-header late">
                  <div className="teacher-att-modal-check-icon late">
                    <AlertTriangle size={36} />
                  </div>
                  <h3 className="teacher-att-modal-title late">
                    You are Late!
                  </h3>
                  <p className="teacher-att-modal-subtitle">
                    Recorded at {modalDetails.time} • Punctuality Cutoff was 4:33 PM
                  </p>
                </div>

                <div className="teacher-att-modal-body">
                  <div className="teacher-att-message-box late">
                    <div className="teacher-att-message-icon late">
                      <AlertTriangle size={20} />
                    </div>
                    <p className="teacher-att-message-text">
                      You marked attendance at {modalDetails.time}. Because you arrived after the 4:33 PM cutoff, your status has been logged as <strong>Late</strong>. Please strive to reach tomorrow on time to ensure prompt class proceedings!
                    </p>
                  </div>

                  <div className="teacher-att-modal-detail-row">
                    <span className="teacher-att-modal-detail-label">Teacher</span>
                    <span className="teacher-att-modal-detail-val">{teacherName}</span>
                  </div>
                  <div className="teacher-att-modal-detail-row">
                    <span className="teacher-att-modal-detail-label">Recorded Status</span>
                    <span className="teacher-att-modal-detail-val" style={{ color: "#ea580c" }}>
                      <AlertTriangle size={14} /> Late (After 4:33 PM)
                    </span>
                  </div>
                  <div className="teacher-att-modal-detail-row">
                    <span className="teacher-att-modal-detail-label">Time Marked</span>
                    <span className="teacher-att-modal-detail-val">{modalDetails.time}</span>
                  </div>
                  <div className="teacher-att-modal-detail-row">
                    <span className="teacher-att-modal-detail-label">Venue</span>
                    <span className="teacher-att-modal-detail-val">{modalDetails.venue}</span>
                  </div>
                  <div className="teacher-att-modal-detail-row">
                    <span className="teacher-att-modal-detail-label">Verified Distance</span>
                    <span className="teacher-att-modal-detail-val">{modalDetails.distance}m</span>
                  </div>

                  <button
                    type="button"
                    className="teacher-att-modal-done-btn"
                    onClick={() => setShowSuccessModal(false)}
                    style={{
                      background: "linear-gradient(135deg, #ea580c, #c2410c)",
                      boxShadow: "0 4px 14px rgba(234, 88, 12, 0.4)",
                    }}
                  >
                    Understood • Strive for Tomorrow
                  </button>
                </div>
              </>
            ) : (
              /* =======================================================
                 ON-TIME APPRECIATION POPUP (Before 4:33 PM)
                 ======================================================= */
              <>
                <div className="teacher-att-modal-header ontime">
                  <div className="teacher-att-modal-sparkle-halo" />
                  <div className="teacher-att-modal-check-icon ontime">
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="teacher-att-modal-title ontime">
                    Mubarakaat! Attendance Recorded On Time!
                  </h3>
                  <p className="teacher-att-modal-subtitle">
                    Prompt & Punctual • Verified at {modalDetails.venue}
                  </p>
                </div>

                <div className="teacher-att-modal-body">
                  <div className="teacher-att-message-box ontime">
                    <div className="teacher-att-message-icon ontime">
                      <Sparkles size={20} />
                    </div>
                    <p className="teacher-att-message-text">
                      Mumtaz! Shukran for your exemplary punctuality and steadfast commitment to Rawdat Tahfeez. Your timely presence sets an inspiring standard for all your students!
                    </p>
                  </div>

                  <div className="teacher-att-modal-detail-row">
                    <span className="teacher-att-modal-detail-label">Teacher</span>
                    <span className="teacher-att-modal-detail-val">{teacherName}</span>
                  </div>
                  <div className="teacher-att-modal-detail-row">
                    <span className="teacher-att-modal-detail-label">Recorded Status</span>
                    <span className="teacher-att-modal-detail-val" style={{ color: "#27ae60" }}>
                      <CheckCircle2 size={14} /> Present (On Time)
                    </span>
                  </div>
                  <div className="teacher-att-modal-detail-row">
                    <span className="teacher-att-modal-detail-label">Time Marked</span>
                    <span className="teacher-att-modal-detail-val">{modalDetails.time}</span>
                  </div>
                  <div className="teacher-att-modal-detail-row">
                    <span className="teacher-att-modal-detail-label">Venue</span>
                    <span className="teacher-att-modal-detail-val">{modalDetails.venue}</span>
                  </div>
                  <div className="teacher-att-modal-detail-row">
                    <span className="teacher-att-modal-detail-label">Verified Distance</span>
                    <span className="teacher-att-modal-detail-val">{modalDetails.distance}m</span>
                  </div>

                  <button
                    type="button"
                    className="teacher-att-modal-done-btn"
                    onClick={() => setShowSuccessModal(false)}
                  >
                    Alhamdulillah • Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
