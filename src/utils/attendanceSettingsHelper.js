import { supabase } from "../supabaseClient";
import { Geolocation } from "@capacitor/geolocation";

export const DEFAULT_ATTENDANCE_SETTINGS = {
  id: 1,
  start_time: "16:25",
  end_time: "16:35",
  active_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  venue_name: "Burhani Masjid",
  venue_lat: 23.51104,
  venue_lng: 74.0166317,
  radius: 15, // 15 meters default strict accuracy
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Normalizes raw settings object from database/state (handling both snake_case and PascalCase)
 */
export function normalizeAttendanceSettings(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_ATTENDANCE_SETTINGS };
  }

  const startTime =
    raw.start_time ||
    raw.StartTime ||
    raw.startTime ||
    DEFAULT_ATTENDANCE_SETTINGS.start_time;

  const endTime =
    raw.end_time ||
    raw.EndTime ||
    raw.endTime ||
    DEFAULT_ATTENDANCE_SETTINGS.end_time;

  let activeDays =
    raw.active_days ||
    raw.ActiveDays ||
    raw.activeDays ||
    DEFAULT_ATTENDANCE_SETTINGS.active_days;

  if (typeof activeDays === "string") {
    try {
      activeDays = JSON.parse(activeDays);
    } catch {
      activeDays = activeDays.split(",").map((s) => s.trim());
    }
  }
  if (!Array.isArray(activeDays) || activeDays.length === 0) {
    activeDays = [...DEFAULT_ATTENDANCE_SETTINGS.active_days];
  }

  const venueLat = Number(
    raw.venue_lat !== undefined
      ? raw.venue_lat
      : raw.VenueLat !== undefined
      ? raw.VenueLat
      : raw.latitude !== undefined
      ? raw.latitude
      : DEFAULT_ATTENDANCE_SETTINGS.venue_lat
  );

  const venueLng = Number(
    raw.venue_lng !== undefined
      ? raw.venue_lng
      : raw.VenueLng !== undefined
      ? raw.VenueLng
      : raw.longitude !== undefined
      ? raw.longitude
      : DEFAULT_ATTENDANCE_SETTINGS.venue_lng
  );

  const radius = Number(
    raw.radius !== undefined
      ? raw.radius
      : raw.Radius !== undefined
      ? raw.Radius
      : raw.geofence_radius !== undefined
      ? raw.geofence_radius
      : DEFAULT_ATTENDANCE_SETTINGS.radius
  );

  const venueName =
    raw.venue_name ||
    raw.VenueName ||
    DEFAULT_ATTENDANCE_SETTINGS.venue_name;

  return {
    id: 1,
    start_time: startTime,
    end_time: endTime,
    active_days: activeDays,
    venue_lat: isNaN(venueLat) ? DEFAULT_ATTENDANCE_SETTINGS.venue_lat : venueLat,
    venue_lng: isNaN(venueLng) ? DEFAULT_ATTENDANCE_SETTINGS.venue_lng : venueLng,
    radius: isNaN(radius) || radius <= 0 ? DEFAULT_ATTENDANCE_SETTINGS.radius : radius,
    venue_name: venueName,
    // Provide PascalCase mirrors for compatibility
    StartTime: startTime,
    EndTime: endTime,
    ActiveDays: activeDays,
    VenueLat: isNaN(venueLat) ? DEFAULT_ATTENDANCE_SETTINGS.venue_lat : venueLat,
    VenueLng: isNaN(venueLng) ? DEFAULT_ATTENDANCE_SETTINGS.venue_lng : venueLng,
    Radius: isNaN(radius) || radius <= 0 ? DEFAULT_ATTENDANCE_SETTINGS.radius : radius,
    VenueName: venueName,
  };
}

/**
 * Calculates haversine distance between two coordinates in meters
 */
export function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (
    lat1 === null ||
    lat1 === undefined ||
    lon1 === null ||
    lon1 === undefined ||
    lat2 === null ||
    lat2 === undefined ||
    lon2 === null ||
    lon2 === undefined
  ) {
    return null;
  }

  const R = 6371000; // Earth's mean radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return Math.round(d * 10) / 10; // 1 decimal place accuracy
}

/**
 * Converts "HH:mm" to total seconds from start of day
 */
function timeStringToSeconds(str) {
  if (!str) return 0;
  const parts = String(str).split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const s = parseInt(parts[2], 10) || 0;
  return h * 3600 + m * 60 + s;
}

/**
 * Checks whether current local time is within the active days and time window
 */
export function checkAttendanceWindow(settings, currentDate = new Date()) {
  const normalized = normalizeAttendanceSettings(settings);

  const currentDayIndex = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ...
  const currentDayName = DAY_NAMES[currentDayIndex];

  // Active day check
  const activeDaysSet = new Set(
    normalized.active_days.map((d) => String(d).toLowerCase().trim())
  );

  const isActiveDay =
    activeDaysSet.has(currentDayName.toLowerCase()) ||
    activeDaysSet.has(currentDayName.slice(0, 3).toLowerCase()) ||
    activeDaysSet.has(String(currentDayIndex));

  const currentSeconds =
    currentDate.getHours() * 3600 +
    currentDate.getMinutes() * 60 +
    currentDate.getSeconds();

  const startSeconds = timeStringToSeconds(normalized.start_time);
  const endSeconds = timeStringToSeconds(normalized.end_time);

  const isTimeInWindow =
    currentSeconds >= startSeconds && currentSeconds <= endSeconds;

  const isInWindow = isActiveDay && isTimeInWindow;
  const secondsRemaining = Math.max(0, endSeconds - currentSeconds);

  // Formatting helper for display
  const formatTime12h = (timeStr) => {
    const [hStr, mStr] = String(timeStr).split(":");
    let h = parseInt(hStr, 10) || 0;
    const m = mStr || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  return {
    isInWindow,
    isActiveDay,
    isTimeInWindow,
    currentDayName,
    startLabel: formatTime12h(normalized.start_time),
    endLabel: formatTime12h(normalized.end_time),
    secondsRemaining,
    minutesRemaining: Math.ceil(secondsRemaining / 60),
    activeDays: normalized.active_days,
  };
}

/**
 * Fetches user location with high accuracy.
 * Attempts native Capacitor Geolocation on mobile first, falling back to navigator.geolocation.
 */
export async function getExactUserLocation() {
  // 1. Try Capacitor Geolocation if available
  try {
    if (Geolocation && typeof Geolocation.getCurrentPosition === "function") {
      // Check/request permission
      try {
        const permStatus = await Geolocation.checkPermissions();
        if (
          permStatus.location !== "granted" &&
          permStatus.coarseLocation !== "granted"
        ) {
          const requested = await Geolocation.requestPermissions();
          if (
            requested.location !== "granted" &&
            requested.coarseLocation !== "granted"
          ) {
            throw new Error("LOCATION_PERMISSION_DENIED");
          }
        }
      } catch (pErr) {
        if (pErr.message === "LOCATION_PERMISSION_DENIED") throw pErr;
        // Proceed to try getCurrentPosition anyway as webview might delegate
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000,
      });

      if (position?.coords) {
        return {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: "capacitor",
        };
      }
    }
  } catch (capErr) {
    if (capErr?.message === "LOCATION_PERMISSION_DENIED") {
      throw capErr;
    }
    // Fall back to navigator.geolocation
  }

  // 2. Fall back to navigator.geolocation
  if (typeof window !== "undefined" && navigator?.geolocation) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: "browser",
          });
        },
        (err) => {
          if (err.code === 1) {
            reject(new Error("LOCATION_PERMISSION_DENIED"));
          } else if (err.code === 2) {
            reject(new Error("LOCATION_POSITION_UNAVAILABLE"));
          } else {
            reject(new Error("LOCATION_TIMEOUT"));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 3000,
        }
      );
    });
  }

  throw new Error("GEOLOCATION_NOT_SUPPORTED");
}

/**
 * Fetch attendance settings from database
 */
export async function fetchAttendanceSettings(isKibar = false) {
  const tableName = isKibar
    ? "kibar_teacher_attendance_settings"
    : "teacher_attendance_settings";

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!error && data) {
      return normalizeAttendanceSettings(data);
    }
  } catch (err) {
    console.warn(`[AttendanceSettings] Error fetching from ${tableName}:`, err);
  }

  // Fallback: check localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const cached = localStorage.getItem(`mauze_att_settings_${isKibar ? "kibar" : "atfal"}`);
      if (cached) {
        return normalizeAttendanceSettings(JSON.parse(cached));
      }
    } catch (_) {}
  }

  return { ...DEFAULT_ATTENDANCE_SETTINGS };
}

/**
 * Save attendance settings to database
 */
export async function saveAttendanceSettings(settings, isKibar = false) {
  const tableName = isKibar
    ? "kibar_teacher_attendance_settings"
    : "teacher_attendance_settings";

  const normalized = normalizeAttendanceSettings(settings);

  const payload = {
    id: 1,
    start_time: normalized.start_time,
    end_time: normalized.end_time,
    active_days: normalized.active_days,
    venue_name: normalized.venue_name,
    venue_lat: normalized.venue_lat,
    venue_lng: normalized.venue_lng,
    radius: normalized.radius,
    // Mirrored fields
    StartTime: normalized.start_time,
    EndTime: normalized.end_time,
    ActiveDays: normalized.active_days,
    VenueLat: normalized.venue_lat,
    VenueLng: normalized.venue_lng,
    Radius: normalized.radius,
    VenueName: normalized.venue_name,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(tableName)
    .upsert(payload, { onConflict: "id" })
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  // Cache in localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(
        `mauze_att_settings_${isKibar ? "kibar" : "atfal"}`,
        JSON.stringify(payload)
      );
    } catch (_) {}
  }

  return normalizeAttendanceSettings(data || payload);
}
