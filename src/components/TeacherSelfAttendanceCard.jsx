import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
  Zap,
  Footprints,
  Lock,
  MapPinOff,
  Settings,
} from "lucide-react";
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  normalizeAttendanceSettings,
  fetchAttendanceSettings,
  checkAttendanceWindow,
  calculateHaversineDistanceMeters,
  getExactUserLocation,
  requestDeviceLocationPermission,
  openDeviceLocationSettings,
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

/**
 * Play a gentle harmonic celebration chime using Web Audio API
 */
function playCelebrationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.09 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.09);
      osc.stop(ctx.currentTime + idx * 0.09 + 0.45);
    });
  } catch (_) {}

  // Trigger tactile haptic vibration if supported
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate([100, 50, 150]);
    } catch (_) {}
  }
}

export default function TeacherSelfAttendanceCard({
  teacherIdentity,
  user,
  portalAccess,
  teacherProfiles = [],
  isKibarTeacher = false,
  onShowAction,
}) {
  // Current live clock state — updates every 10 seconds
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

  // Smart Auto-Mark state
  const [autoMarkCountdown, setAutoMarkCountdown] = useState(null); // 3, 2, 1, 0, or null
  const autoMarkTriggeredRef = useRef(false);

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
  // 1. Clock interval
  // -------------------------------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000);
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
  const fetchLocation = useCallback(async (opts = {}) => {
    setLocationStatus("locating");
    setLocationError(null);
    try {
      if (opts?.requestPerm) {
        // On Android, if bridge is available, request via native bridge
        // and wait for the permission result event before proceeding
        const isAndroidBridge =
          typeof window !== "undefined" && !!window.MauzeLocationBridge;
        if (isAndroidBridge) {
          const hasPerm = window.MauzeLocationBridge.hasLocationPermission?.();
          if (!hasPerm) {
            // Trigger the system dialog
            window.MauzeLocationBridge.requestLocationPermission();
            // Wait up to 30s for the user to respond to the dialog
            await new Promise((resolve) => {
              const tid = setTimeout(resolve, 30000); // timeout fallback
              const handler = () => {
                clearTimeout(tid);
                window.removeEventListener("mauze-location-permission-result", handler);
                resolve();
              };
              window.addEventListener("mauze-location-permission-result", handler, { once: true });
            });
          }
        } else {
          await requestDeviceLocationPermission();
        }
      }
      const pos = await getExactUserLocation();
      if (pos && pos.lat != null && pos.lng != null) {
        setUserCoords(pos);
        setLocationStatus("granted");
        return pos;
      } else {
        throw new Error("LOCATION_EMPTY");
      }
    } catch (err) {
      console.warn("[TeacherSelfAttendance] GPS error:", err);
      const msg = String(err?.message || "");
      if (msg === "LOCATION_PERMISSION_DENIED" || msg.includes("denied")) {
        setLocationStatus("denied");
        setLocationError("GPS permission denied. Please allow location access to verify attendance.");
      } else if (msg === "LOCATION_SERVICES_DISABLED" || msg.includes("disabled") || msg.includes("service")) {
        setLocationStatus("disabled_device");
        setLocationError("Device Location is turned OFF. Please enable Location in your phone's notification bar.");
      } else {
        setLocationStatus("error");
        setLocationError(
          "Could not retrieve GPS coordinates. Please check your device location settings."
        );
      }
      return null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // 5. Calculate Haversine Distance & Proximity States
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

  const configuredRadius = Number(settings.radius) || DEFAULT_ATTENDANCE_SETTINGS.radius;

  // Strict Geofence rule: inside if distance <= radius
  const isInsideGeofence = useMemo(() => {
    if (distanceMeters == null) return false;
    return distanceMeters <= configuredRadius;
  }, [distanceMeters, configuredRadius]);

  // Proximity states
  // 1-step away: within 1 to 3 meters outside the boundary
  const isOneStepAway = useMemo(() => {
    if (distanceMeters == null || isInsideGeofence) return false;
    return distanceMeters > configuredRadius && distanceMeters <= configuredRadius + 3;
  }, [distanceMeters, isInsideGeofence, configuredRadius]);

  // Approaching: within 3 to 25 meters outside boundary
  const isApproaching = useMemo(() => {
    if (distanceMeters == null || isInsideGeofence || isOneStepAway) return false;
    return distanceMeters > configuredRadius + 3 && distanceMeters <= configuredRadius + 25;
  }, [distanceMeters, isInsideGeofence, isOneStepAway, configuredRadius]);

  // Steps remaining to enter boundary
  const stepsToBoundary = useMemo(() => {
    if (distanceMeters == null || isInsideGeofence) return 0;
    const diff = distanceMeters - configuredRadius;
    return Math.max(1, Math.round(diff / 0.8));
  }, [distanceMeters, isInsideGeofence, configuredRadius]);

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

  const isAlreadyMarked = Boolean(
    todayRecord &&
      (String(todayRecord.status).toLowerCase() === "present" ||
        String(todayRecord.status).toLowerCase() === "late")
  );

  const isLocationTurnedOffToday = useMemo(() => {
    if (typeof window === "undefined" || !window.localStorage) return false;
    return localStorage.getItem(`mauze_loc_disabled_${todayKey}`) === "true";
  }, [todayKey]);

  // Request location ONLY if:
  // 1. In the active time window
  // 2. Teacher has NOT already marked attendance today (saves battery & prevents unwanted tracking)
  // 3. Teacher has NOT manually turned off location for today
  // Directly prompt location permission when attendance window is live on Home page
  useEffect(() => {
    if (windowStatus.isInWindow && !isAlreadyMarked && !isLocationTurnedOffToday) {
      fetchLocation({ requestPerm: true });
    }
  }, [windowStatus.isInWindow, isAlreadyMarked, isLocationTurnedOffToday, fetchLocation]);

  // Re-fetch location after app resume / returning from Settings
  useEffect(() => {
    const handleResume = () => {
      if (windowStatus.isInWindow && !isAlreadyMarked) {
        // Small delay so Android has time to propagate location permission state
        setTimeout(() => fetchLocation({ requestPerm: false }), 800);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && windowStatus.isInWindow && !isAlreadyMarked) {
        setTimeout(() => fetchLocation({ requestPerm: false }), 800);
      }
    };

    // When Android reports GPS provider is OFF right after permission grant —
    // immediately open device location settings so teacher can toggle it on
    const handleGpsDisabled = () => {
      if (windowStatus.isInWindow && !isAlreadyMarked) {
        openDeviceLocationSettings("gps");
        setLocationStatus("disabled_device");
        setLocationError("Device Location (GPS) is turned OFF. Please enable it now to mark attendance.");
      }
    };

    window.addEventListener("mauze-app-resumed", handleResume);
    window.addEventListener("focus", handleResume);
    window.addEventListener("mauze-gps-disabled", handleGpsDisabled);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("mauze-app-resumed", handleResume);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("mauze-gps-disabled", handleGpsDisabled);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [windowStatus.isInWindow, isAlreadyMarked, fetchLocation]);

  // If already marked, automatically release active GPS coordinates to preserve mobile battery
  useEffect(() => {
    if (isAlreadyMarked && userCoords) {
      setUserCoords(null);
    }
  }, [isAlreadyMarked, userCoords]);

  // Handler: Turn Off Location Tracking & prompt device settings
  const handleTurnOffLocation = async () => {
    try {
      setUserCoords(null);
      setLocationStatus("disabled");

      if (typeof window !== "undefined" && window.localStorage) {
        try {
          localStorage.setItem(`mauze_loc_disabled_${todayKey}`, "true");
        } catch (_) {}
      }

      setShowSuccessModal(false);

      // Attempt to launch device location settings so user can toggle off hardware GPS
      try {
        await openDeviceLocationSettings();
      } catch (_) {}

      if (onShowAction) {
        onShowAction(
          "info",
          "Location tracking disabled for today. Battery saved!"
        );
      }
    } catch (_) {
      setShowSuccessModal(false);
    }
  };

  const handleModalDone = () => {
    setShowSuccessModal(false);
    // Free GPS coords once attendance is recorded and modal is acknowledged
    setUserCoords(null);
  };

  // -------------------------------------------------------------------------
  // 7. Handle Mark Attendance Action
  // -------------------------------------------------------------------------
  const handleMarkAttendance = async (opts = {}) => {
    let activeCoords = opts?.coords || userCoords;
    let activeDist = opts?.dist != null ? opts.dist : distanceMeters;

    if (!activeCoords || activeDist == null) {
      const pos = await fetchLocation({ requestPerm: true });
      if (!pos) {
        if (onShowAction) {
          onShowAction("error", "Please allow location access to verify attendance.");
        }
        return;
      }
      activeCoords = pos;
      activeDist = calculateHaversineDistanceMeters(
        pos.lat,
        pos.lng,
        settings.venue_lat,
        settings.venue_lng
      );
    }

    if (activeDist > configuredRadius) {
      if (onShowAction) {
        onShowAction(
          "error",
          `Cannot mark attendance: You are ${Math.round(activeDist)}m away. You must be strictly within ${configuredRadius}m of ${settings.venue_name}.`
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
    setAutoMarkCountdown(null);

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
      note: opts.isAuto
        ? `Auto-marked at ${settings.venue_name} via GPS (${isLate ? "Late" : "On Time"}, ${Math.round(activeDist)}m away)`
        : isLate
        ? `Self-marked via GPS at ${settings.venue_name} (Late - after 4:33 PM, ${Math.round(activeDist)}m away)`
        : `Self-marked via GPS at ${settings.venue_name} (On Time, ${Math.round(activeDist)}m away)`,
      marked_by: opts.isAuto ? "auto" : "self",
      latitude: activeCoords?.lat || null,
      longitude: activeCoords?.lng || null,
      distance_meters: Math.round(activeDist),
      venue_name: settings.venue_name,
      updated_at: markTime.toISOString(),
    };

    try {
      const { error } = await supabase
        .from(attendanceTable)
        .upsert(payload, { onConflict: "teacher_id,attendance_date" });

      if (error) {
        console.warn("Attendance upsert warning:", error);
      }

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

      // Play audio chime and haptics
      playCelebrationChime();

      setModalDetails({
        time: formattedTime,
        date: todayKey,
        venue: settings.venue_name,
        distance: distanceMeters,
        isLate,
        status: assignedStatus,
        isAuto: Boolean(opts.isAuto),
      });
      setShowSuccessModal(true);

      if (onShowAction) {
        onShowAction(
          isLate ? "info" : "success",
          opts.isAuto
            ? `⚡ Auto-marked attendance at ${formattedTime} as ${assignedStatus}!`
            : isLate
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
  // 8. Smart Auto-Mark Trigger Effect
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Only trigger if window is active, inside geofence, auto_mark_enabled is true, not already marked, not currently submitting
    if (
      windowStatus.isInWindow &&
      isInsideGeofence &&
      Boolean(settings.auto_mark_enabled) &&
      !isAlreadyMarked &&
      !isSubmitting &&
      !autoMarkTriggeredRef.current &&
      autoMarkCountdown === null
    ) {
      // Start 3-second animated countdown
      setAutoMarkCountdown(3);
    }
  }, [
    windowStatus.isInWindow,
    isInsideGeofence,
    settings.auto_mark_enabled,
    isAlreadyMarked,
    isSubmitting,
    autoMarkCountdown,
  ]);

  useEffect(() => {
    if (autoMarkCountdown === null) return;
    if (autoMarkCountdown > 0) {
      const timer = setTimeout(() => {
        setAutoMarkCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (
      autoMarkCountdown === 0 &&
      !autoMarkTriggeredRef.current &&
      !isSubmitting &&
      !isAlreadyMarked
    ) {
      autoMarkTriggeredRef.current = true;
      handleMarkAttendance({ isAuto: true });
    }
  }, [autoMarkCountdown, isSubmitting, isAlreadyMarked]);

  // -------------------------------------------------------------------------
  // 9. CONDITIONAL RENDERING: TIME WINDOW CHECK
  // -------------------------------------------------------------------------
  if (!windowStatus.isInWindow) {
    return null;
  }



  // -------------------------------------------------------------------------
  // 10. RENDER THE GEOFENCE & PROXIMITY CARD
  // -------------------------------------------------------------------------
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
            <div className={`teacher-self-att-icon-wrap ${isInsideGeofence ? "verified" : ""}`}>
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="teacher-self-att-header-title">
                Teacher Self Attendance
              </h3>
              <p className="teacher-self-att-header-sub">
                <ShieldCheck size={12} /> {settings.venue_name} • Geofenced
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
          {/* STATE 1: LOCATION PERMISSION REQUIRED / ERROR */}
          {(locationStatus === "denied" ||
            locationStatus === "error" ||
            locationStatus === "disabled_device") &&
          !isAlreadyMarked ? (
            <div className="teacher-permission-inline-card card-appear">
              <div className="teacher-permission-header">
                <h4 className="teacher-permission-header-title">
                  <AlertTriangle size={18} /> GPS Location Permission Required
                </h4>
                <span className="teacher-permission-tag">Action Needed</span>
              </div>
              <div className="teacher-permission-body">
                <p className="teacher-permission-text">
                  {locationError ||
                    `Please allow location access on your device so we can verify your presence at ${settings.venue_name} to mark self attendance.`}
                </p>
                <div className="teacher-permission-btns-row">
                  <button
                    type="button"
                    className="teacher-permission-btn"
                    onClick={async () => {
                      await requestDeviceLocationPermission();
                      fetchLocation({ requestPerm: true });
                    }}
                  >
                    <Navigation size={16} />
                    <span>Allow GPS Location</span>
                  </button>
                  <button
                    type="button"
                    className="teacher-permission-settings-btn"
                    onClick={async () => {
                      await openDeviceLocationSettings(
                        locationStatus === "disabled_device" ? "gps" : "app"
                      );
                      setTimeout(() => fetchLocation({ requestPerm: true }), 2500);
                    }}
                  >
                    <Settings size={15} />
                    <span>Open Device Settings</span>
                  </button>
                </div>
                <p className="teacher-permission-hint">
                  💡 Tap <strong>Allow GPS Location</strong> or <strong>Open Device Settings</strong> to grant permission, or swipe down your phone's notification bar and turn ON <strong>Location</strong>.
                </p>
              </div>
            </div>
          ) : locationStatus === "disabled" && !isAlreadyMarked ? (
            /* STATE 2: LOCATION MANUALLY DISABLED FOR TODAY */
            <div className="teacher-permission-inline-card card-appear">
              <div className="teacher-permission-header">
                <h4 className="teacher-permission-header-title">
                  <MapPinOff size={18} /> Location Tracking Disabled
                </h4>
              </div>
              <div className="teacher-permission-body">
                <p className="teacher-permission-text">
                  Location tracking is turned off for today. If you need to mark attendance now, tap below to re-enable GPS.
                </p>
                <button
                  type="button"
                  className="teacher-permission-btn"
                  onClick={() => {
                    if (typeof window !== "undefined" && window.localStorage) {
                      try {
                        localStorage.removeItem(`mauze_loc_disabled_${todayKey}`);
                      } catch (_) {}
                    }
                    fetchLocation({ requestPerm: true });
                  }}
                >
                  <Navigation size={16} />
                  <span>Turn On Location &amp; Mark Attendance</span>
                </button>
              </div>
            </div>
          ) : locationStatus === "locating" && !isAlreadyMarked && !userCoords ? (
            /* STATE 3: LOCATING / SHIMMER */
            <div className="teacher-loc-banner locating card-appear">
              <div className="teacher-loc-icon-col locating">
                <RotateCw size={18} className="att-spin" />
              </div>
              <div className="teacher-loc-content">
                <div className="teacher-loc-title">
                  Detecting GPS Location...
                </div>
                <div className="teacher-loc-desc">
                  Connecting to device GPS to verify proximity to {settings.venue_name}.
                </div>
              </div>
            </div>
          ) : isInsideGeofence ? (
            /* PROXIMITY STATE 1: INSIDE GEOFENCE */
            <div className="teacher-loc-banner verified">
              <div className="teacher-loc-icon-col">
                <CheckCircle2 size={18} />
              </div>
              <div className="teacher-loc-content">
                <div className="teacher-loc-title">
                  Location Verified: Inside {settings.venue_name}
                </div>
                <div className="teacher-loc-desc">
                  Distance: {distanceMeters != null ? `${distanceMeters}m` : "Within boundary"} (Radius: {configuredRadius}m).
                </div>
              </div>
              <button
                type="button"
                className="teacher-loc-refresh-btn"
                onClick={() => fetchLocation({ requestPerm: false })}
                title="Refresh GPS"
              >
                <RotateCw size={11} /> Refresh
              </button>
            </div>
          ) : isOneStepAway ? (
            /* PROXIMITY STATE 2: 1 STEP AWAY */
            <div className="teacher-loc-banner onestep">
              <div className="teacher-loc-icon-col onestep">
                <Footprints size={20} />
              </div>
              <div className="teacher-loc-content">
                <div className="teacher-loc-title onestep">
                  🚶 1 Step Away from {settings.venue_name}!
                </div>
                <div className="teacher-loc-desc onestep">
                  You are only {Math.max(1, Math.round(distanceMeters - configuredRadius))}m outside the geofence. Step forward inside to mark attendance!
                </div>
              </div>
              <button
                type="button"
                className="teacher-loc-refresh-btn"
                onClick={() => fetchLocation({ requestPerm: false })}
                title="Refresh GPS"
              >
                <RotateCw size={11} /> Refresh
              </button>
            </div>
          ) : isApproaching ? (
            /* PROXIMITY STATE 3: APPROACHING (3-25m) */
            <div className="teacher-loc-banner approaching">
              <div className="teacher-loc-icon-col approaching">
                <Navigation size={18} />
              </div>
              <div className="teacher-loc-content">
                <div className="teacher-loc-title approaching">
                  Approaching {settings.venue_name}
                </div>
                <div className="teacher-loc-desc approaching">
                  You are {Math.round(distanceMeters)}m away (~{stepsToBoundary} steps to boundary).
                </div>
              </div>
              <button
                type="button"
                className="teacher-loc-refresh-btn"
                onClick={() => fetchLocation({ requestPerm: false })}
                title="Refresh GPS"
              >
                <RotateCw size={11} /> Refresh
              </button>
            </div>
          ) : (
            /* PROXIMITY STATE 4: OUTSIDE VENUE */
            <div className="teacher-loc-banner outside">
              <div className="teacher-loc-icon-col outside">
                <MapPin size={18} />
              </div>
              <div className="teacher-loc-content">
                <div className="teacher-loc-title outside">
                  Venue: {settings.venue_name}
                </div>
                <div className="teacher-loc-desc outside">
                  Distance: {distanceMeters != null ? (distanceMeters >= 1000 ? `${(distanceMeters/1000).toFixed(1)} km` : `${Math.round(distanceMeters)}m`) : "Detecting"} away. Attendance will auto-mark once you reach within {configuredRadius}m.
                </div>
              </div>
              <button
                type="button"
                className="teacher-loc-refresh-btn"
                onClick={() => fetchLocation({ requestPerm: false })}
                title="Refresh GPS"
              >
                <RotateCw size={11} /> Refresh
              </button>
            </div>
          )}

          {/* Time Window Details & Countdown */}
          <div className="teacher-window-row">
            <div className="teacher-window-left">
              <Clock size={14} />
              <span>Window: {windowStatus.startLabel} – {windowStatus.endLabel}</span>
            </div>
            <div className="teacher-window-countdown">
              <span>Closes in {windowStatus.minutesRemaining}m</span>
            </div>
          </div>

          {/* Smart Auto-Mark Countdown Indicator (when inside venue) */}
          {isInsideGeofence && !isAlreadyMarked && autoMarkCountdown !== null && (
            <div className="teacher-automark-countdown-card card-appear">
              <div className="teacher-automark-countdown-header">
                <div className="teacher-automark-pulse-dot" />
                <span className="teacher-automark-label">
                  ⚡ Auto-marking your attendance in <strong>{autoMarkCountdown}s</strong>...
                </span>
              </div>
              <div className="teacher-automark-progress-bar">
                <div
                  className="teacher-automark-progress-fill"
                  style={{ width: `${((3 - autoMarkCountdown) / 3) * 100}%` }}
                />
              </div>
            </div>
          )}

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
                <div className="teacher-gps-saved-pill">
                  <ShieldCheck size={12} />
                  <span>GPS Inactive • Phone Battery Saved</span>
                </div>
              </div>
            </div>
          ) : isInsideGeofence ? (
            /* Button inside geofence: ACTIVE & READY */
            <button
              type="button"
              className="teacher-mark-btn"
              onClick={() => handleMarkAttendance({ isAuto: false })}
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
          ) : (locationStatus === "denied" ||
              locationStatus === "error" ||
              locationStatus === "disabled_device") ? (
            /* Button when location needs permission / GPS */
            <button
              type="button"
              className="teacher-mark-btn pulse-glow"
              onClick={async () => {
                await requestDeviceLocationPermission();
                const pos = await fetchLocation({ requestPerm: true });
                if (pos) {
                  const dist = calculateHaversineDistanceMeters(
                    pos.lat,
                    pos.lng,
                    settings.venue_lat,
                    settings.venue_lng
                  );
                  if (dist <= configuredRadius) {
                    handleMarkAttendance({ isAuto: false, coords: pos, dist });
                  } else {
                    if (onShowAction) {
                      onShowAction(
                        "info",
                        `Location acquired: You are ${Math.round(dist)}m away from ${settings.venue_name}. Reach within ${configuredRadius}m to mark attendance.`
                      );
                    }
                  }
                }
              }}
            >
              <Navigation size={18} />
              <span>Allow Location &amp; Mark Attendance</span>
              <ChevronRight size={18} />
            </button>
          ) : isOneStepAway ? (
            /* Button 1 step away: PROXIMITY LOCKED */
            <div className="teacher-btn-locked-wrap">
              <button
                type="button"
                className="teacher-mark-btn locked onestep-btn"
                onClick={async () => {
                  const pos = await fetchLocation({ requestPerm: false });
                  const dist = pos
                    ? calculateHaversineDistanceMeters(
                        pos.lat,
                        pos.lng,
                        settings.venue_lat,
                        settings.venue_lng
                      )
                    : distanceMeters;
                  if (dist != null && dist <= configuredRadius) {
                    handleMarkAttendance({ isAuto: false, coords: pos, dist });
                  } else {
                    if (onShowAction) {
                      onShowAction(
                        "info",
                        `You are just 1 step outside (${Math.max(
                          1,
                          Math.round(dist - configuredRadius)
                        )}m). Step inside to mark!`
                      );
                    }
                  }
                }}
                title="Step inside venue to unlock"
              >
                <Footprints size={18} />
                <span>1 Step Away • Step Inside Venue to Mark</span>
              </button>
            </div>
          ) : (
            /* Button outside geofence: SHOWS DISTANCE & TAPPING RE-CHECKS */
            <div className="teacher-btn-locked-wrap">
              <button
                type="button"
                className="teacher-mark-btn"
                style={{
                  background: "linear-gradient(135deg, #1e293b, #334155)",
                  color: "#f8fafc",
                  boxShadow: "0 4px 14px rgba(30, 41, 59, 0.35)",
                }}
                onClick={async () => {
                  const pos = await fetchLocation({ requestPerm: false });
                  const dist = pos
                    ? calculateHaversineDistanceMeters(
                        pos.lat,
                        pos.lng,
                        settings.venue_lat,
                        settings.venue_lng
                      )
                    : distanceMeters;
                  if (dist != null && dist <= configuredRadius) {
                    handleMarkAttendance({ isAuto: false, coords: pos, dist });
                  } else if (dist != null) {
                    if (onShowAction) {
                      onShowAction(
                        "info",
                        `You are ${
                          dist >= 1000
                            ? `${(dist / 1000).toFixed(1)} km`
                            : `${Math.round(dist)}m`
                        } away from ${settings.venue_name}. Reach within ${configuredRadius}m (~${stepsToBoundary} steps) to mark attendance!`
                      );
                    }
                  }
                }}
                title="Tap to check location and mark attendance"
              >
                <MapPin size={18} />
                <span>
                  Mark Attendance (
                  {distanceMeters != null
                    ? distanceMeters >= 1000
                      ? `${(distanceMeters / 1000).toFixed(1)} km`
                      : `${Math.round(distanceMeters)}m`
                    : "Detecting"}{" "}
                  away)
                </span>
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Success Modal using Portal directly onto document.body */}
      {showSuccessModal && modalDetails && typeof document !== "undefined" && createPortal(
        <div
          className="teacher-att-modal-overlay"
          onClick={handleModalDone}
          role="dialog"
          aria-modal="true"
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
                  <button
                    type="button"
                    className="teacher-att-modal-close-btn"
                    onClick={handleModalDone}
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
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

                  <div className="teacher-att-modal-actions-col">
                    <button
                      type="button"
                      className="teacher-att-modal-disable-loc-btn"
                      onClick={handleTurnOffLocation}
                      title="Disable GPS tracking in app and turn off device location"
                    >
                      <MapPinOff size={16} />
                      <span>Disable Location &amp; Turn Off GPS</span>
                    </button>
                    <button
                      type="button"
                      className="teacher-att-modal-done-btn"
                      onClick={handleModalDone}
                      style={{
                        background: "linear-gradient(135deg, #ea580c, #c2410c)",
                        boxShadow: "0 4px 14px rgba(234, 88, 12, 0.4)",
                      }}
                    >
                      Understood • Strive for Tomorrow
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* =======================================================
                 ON-TIME APPRECIATION POPUP (Before 4:33 PM)
                 ======================================================= */
              <>
                <div className="teacher-att-modal-header ontime">
                  <button
                    type="button"
                    className="teacher-att-modal-close-btn"
                    onClick={handleModalDone}
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                  <div className="teacher-att-modal-sparkle-halo" />
                  <div className="teacher-att-modal-check-icon ontime">
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="teacher-att-modal-title ontime">
                    Mubarakaat! Attendance Recorded On Time!
                  </h3>
                  <p className="teacher-att-modal-subtitle">
                    {modalDetails.isAuto ? "⚡ Auto-Marked via GPS • " : ""}Prompt &amp; Punctual • Verified at {modalDetails.venue}
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

                  <div className="teacher-att-modal-actions-col">
                    <button
                      type="button"
                      className="teacher-att-modal-disable-loc-btn"
                      onClick={handleTurnOffLocation}
                      title="Disable GPS tracking in app and turn off device location"
                    >
                      <MapPinOff size={16} />
                      <span>Disable Location &amp; Turn Off GPS</span>
                    </button>
                    <button
                      type="button"
                      className="teacher-att-modal-done-btn"
                      onClick={handleModalDone}
                    >
                      Alhamdulillah • Done
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
