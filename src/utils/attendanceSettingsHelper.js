import { supabase } from "../supabaseClient";
import { Geolocation } from "@capacitor/geolocation";
import { AppLauncher } from "@capacitor/app-launcher";

export const DEFAULT_ATTENDANCE_SETTINGS = {
  id: 1,
  start_time: "16:25",
  end_time: "16:35",
  active_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  venue_name: "Burhani Masjid",
  venue_lat: 23.51104,
  venue_lng: 74.0166317,
  radius: 15, // 15 meters default strict accuracy
  auto_mark_enabled: true, // Auto-mark teacher when at location during window
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

  const autoMarkEnabled =
    raw.auto_mark_enabled !== undefined
      ? Boolean(raw.auto_mark_enabled)
      : raw.AutoMarkEnabled !== undefined
      ? Boolean(raw.AutoMarkEnabled)
      : DEFAULT_ATTENDANCE_SETTINGS.auto_mark_enabled;

  return {
    id: 1,
    start_time: startTime,
    end_time: endTime,
    active_days: activeDays,
    venue_lat: isNaN(venueLat) ? DEFAULT_ATTENDANCE_SETTINGS.venue_lat : venueLat,
    venue_lng: isNaN(venueLng) ? DEFAULT_ATTENDANCE_SETTINGS.venue_lng : venueLng,
    radius: isNaN(radius) || radius <= 0 ? DEFAULT_ATTENDANCE_SETTINGS.radius : radius,
    venue_name: venueName,
    auto_mark_enabled: autoMarkEnabled,
    // Provide PascalCase mirrors for compatibility
    StartTime: startTime,
    EndTime: endTime,
    ActiveDays: activeDays,
    VenueLat: isNaN(venueLat) ? DEFAULT_ATTENDANCE_SETTINGS.venue_lat : venueLat,
    VenueLng: isNaN(venueLng) ? DEFAULT_ATTENDANCE_SETTINGS.venue_lng : venueLng,
    Radius: isNaN(radius) || radius <= 0 ? DEFAULT_ATTENDANCE_SETTINGS.radius : radius,
    VenueName: venueName,
    AutoMarkEnabled: autoMarkEnabled,
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
/**
 * Explicitly triggers device/browser location permission dialog
 */
export async function requestDeviceLocationPermission() {
  let bridgeTriggered = false;

  // 1. Android Native Bridge — fires system permission dialog and dispatches
  //    'mauze-location-permission-result' when the user responds
  if (typeof window !== "undefined" && window.MauzeLocationBridge?.requestLocationPermission) {
    try {
      window.MauzeLocationBridge.requestLocationPermission();
      bridgeTriggered = true;
      // Short pause to let Android show the native dialog before JS proceeds
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.warn("[requestDeviceLocationPermission] bridge error:", e);
    }
  }

  // 2. Capacitor Geolocation requestPermissions (correct Android format)
  try {
    if (Geolocation && typeof Geolocation.requestPermissions === "function") {
      // On Android Capacitor only accepts 'location' (not 'coarseLocation') as permission key
      const res = await Geolocation.requestPermissions();
      if (res?.location === "granted") {
        return true;
      }
    }
  } catch (capErr) {
    // Capacitor may throw if called from a non-gesture context on some devices — ignore
    console.warn("[requestDeviceLocationPermission] capacitor error:", capErr);
  }

  // 3. Browser / WebView prompt (triggers native geolocation dialog as fallback)
  if (typeof window !== "undefined" && navigator?.geolocation && !bridgeTriggered) {
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 60000,
        });
      });
      return true;
    } catch (_) {}
  }

  return bridgeTriggered;
}

/**
 * Fetches user location with high accuracy and instant multi-layer fallbacks.
 * Order: Native Bridge (cached fresh) -> Capacitor Geolocation (High Acc -> Low Acc) -> Browser Navigator -> Native Bridge fallback.
 */
export async function getExactUserLocation() {
  let capError = null;

  // 1. Check native Android bridge for fast/cached location first
  if (typeof window !== "undefined" && window.MauzeLocationBridge) {
    try {
      if (typeof window.MauzeLocationBridge.getNativeLocation === "function") {
        const raw = window.MauzeLocationBridge.getNativeLocation();
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.lat != null && parsed.lng != null) {
            const ageMs = Date.now() - (parsed.time || 0);
            if (ageMs < 90000) {
              return {
                lat: parsed.lat,
                lng: parsed.lng,
                accuracy: parsed.accuracy || 10,
                source: "native_bridge",
              };
            }
          }
        }
      }
      // Cached location stale or missing — request a fresh native GPS fix
      if (typeof window.MauzeLocationBridge.requestFreshLocation === "function") {
        const freshPos = await new Promise((resolve) => {
          const tid = setTimeout(() => {
            window.removeEventListener("mauze-native-location-result", handler);
            resolve(null);
          }, 12000); // 12s max wait for GPS fix
          const handler = (e) => {
            clearTimeout(tid);
            window.removeEventListener("mauze-native-location-result", handler);
            resolve(e?.detail || null);
          };
          window.addEventListener("mauze-native-location-result", handler, { once: true });
          window.MauzeLocationBridge.requestFreshLocation();
        });
        if (freshPos && freshPos.lat != null && freshPos.lng != null) {
          return {
            lat: freshPos.lat,
            lng: freshPos.lng,
            accuracy: freshPos.accuracy || 15,
            source: "native_bridge_fresh",
          };
        }
      }
    } catch (bridgeErr) {
      console.warn("[getExactUserLocation] native bridge read warning:", bridgeErr);
    }
  }

  // 2. Try Capacitor Geolocation if available
  try {
    if (Geolocation && typeof Geolocation.getCurrentPosition === "function") {
      // Check permission status first
      try {
        const permStatus = await Geolocation.checkPermissions();
        const isGranted = permStatus.location === "granted";
        const isDenied = permStatus.location === "denied";

        if (!isGranted) {
          if (isDenied) {
            // Permission was permanently denied — signal to open settings
            capError = new Error("LOCATION_PERMISSION_DENIED");
          } else {
            // Not yet asked or prompt-able — trigger native request via bridge
            if (typeof window !== "undefined" && window.MauzeLocationBridge?.requestLocationPermission) {
              window.MauzeLocationBridge.requestLocationPermission();
              await new Promise((r) => setTimeout(r, 500));
            }
            // Also request via Capacitor (correct format — no extra keys on Android)
            try {
              const requested = await Geolocation.requestPermissions();
              if (requested.location !== "granted") {
                capError = new Error("LOCATION_PERMISSION_DENIED");
              }
            } catch (reqErr) {
              console.warn("[getExactUserLocation] requestPermissions error:", reqErr);
            }
          }
        }
      } catch (pErr) {
        const msg = String(pErr?.message || "").toLowerCase();
        if (msg.includes("denied")) {
          capError = new Error("LOCATION_PERMISSION_DENIED");
        } else if (msg.includes("disabled") || msg.includes("service")) {
          capError = new Error("LOCATION_SERVICES_DISABLED");
        } else {
          console.warn("[getExactUserLocation] Permission check/request warning:", pErr);
        }
      }

      // If permissions not explicitly denied, attempt position retrieval
      if (!capError || capError.message !== "LOCATION_PERMISSION_DENIED") {
        try {
          // High accuracy attempt (timeout 10s — GPS satellites need time)
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000,
          });

          if (position?.coords) {
            return {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              source: "capacitor",
            };
          }
        } catch (highAccErr) {
          const errMsg = String(highAccErr?.message || "").toLowerCase();
          if (errMsg.includes("denied")) {
            throw new Error("LOCATION_PERMISSION_DENIED");
          }
          if (errMsg.includes("disabled") || errMsg.includes("service unavailable")) {
            throw new Error("LOCATION_SERVICES_DISABLED");
          }
          console.warn("[getExactUserLocation] High accuracy attempt failed, trying fallback:", highAccErr);
          try {
            // Fast fallback to network/cell location (timeout 6s)
            const positionFallback = await Geolocation.getCurrentPosition({
              enableHighAccuracy: false,
              timeout: 6000,
              maximumAge: 15000,
            });

            if (positionFallback?.coords) {
              return {
                lat: positionFallback.coords.latitude,
                lng: positionFallback.coords.longitude,
                accuracy: positionFallback.coords.accuracy,
                source: "capacitor_fallback",
              };
            }
          } catch (fallbackErr) {
            console.warn("[getExactUserLocation] Low accuracy fallback also failed:", fallbackErr);
          }
        }
      }
    }
  } catch (capErr) {
    const msg = String(capErr?.message || "").toLowerCase();
    if (msg.includes("denied")) {
      capError = new Error("LOCATION_PERMISSION_DENIED");
    } else if (msg.includes("disabled") || msg.includes("service")) {
      capError = new Error("LOCATION_SERVICES_DISABLED");
    } else {
      capError = capErr;
    }
    console.warn("[getExactUserLocation] Capacitor Geolocation error:", capErr);
  }

  // 3. Fall back to navigator.geolocation (e.g. WebView native prompt fallback)
  if (typeof window !== "undefined" && navigator?.geolocation) {
    try {
      const browserPos = await new Promise((resolve, reject) => {
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
            // Try quick low-accuracy fallback
            navigator.geolocation.getCurrentPosition(
              (posLow) => {
                resolve({
                  lat: posLow.coords.latitude,
                  lng: posLow.coords.longitude,
                  accuracy: posLow.coords.accuracy,
                  source: "browser_low",
                });
              },
              () => {
                if (err.code === 1) {
                  reject(new Error("LOCATION_PERMISSION_DENIED"));
                } else if (err.code === 2) {
                  reject(new Error("LOCATION_SERVICES_DISABLED"));
                } else {
                  reject(new Error("LOCATION_TIMEOUT"));
                }
              },
              { enableHighAccuracy: false, timeout: 6000, maximumAge: 10000 }
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 3000,
          }
        );
      });
      return browserPos;
    } catch (browserErr) {
      // 4. Final attempt: check if native bridge has location
      if (typeof window !== "undefined" && window.MauzeLocationBridge?.getNativeLocation) {
        try {
          const raw = window.MauzeLocationBridge.getNativeLocation();
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.lat != null && parsed.lng != null) {
              return {
                lat: parsed.lat,
                lng: parsed.lng,
                accuracy: parsed.accuracy || 20,
                source: "native_bridge_fallback",
              };
            }
          }
        } catch (_) {}
      }

      if (browserErr.message === "LOCATION_PERMISSION_DENIED") {
        throw browserErr;
      }
      if (capError) throw capError;
      throw browserErr;
    }
  }

  // 5. Final fallback to native bridge
  if (typeof window !== "undefined" && window.MauzeLocationBridge?.getNativeLocation) {
    try {
      const raw = window.MauzeLocationBridge.getNativeLocation();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.lat != null && parsed.lng != null) {
          return {
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: parsed.accuracy || 20,
            source: "native_bridge_fallback",
          };
        }
      }
    } catch (_) {}
  }

  if (capError) throw capError;
  throw new Error("GEOLOCATION_NOT_SUPPORTED");
}

/**
 * Attempts to launch system or app settings on Android/iOS when location is denied or disabled.
 */
export async function openDeviceLocationSettings(type = "app") {
  // 1. Android Native Bridge
  if (typeof window !== "undefined" && window.MauzeLocationBridge) {
    if (type === "app" && typeof window.MauzeLocationBridge.openAppSettings === "function") {
      try {
        window.MauzeLocationBridge.openAppSettings();
        return true;
      } catch (e) {
        console.warn("openAppSettings error via bridge:", e);
      }
    }
    if (typeof window.MauzeLocationBridge.openLocationSettings === "function") {
      try {
        window.MauzeLocationBridge.openLocationSettings();
        return true;
      } catch (e) {
        console.warn("openLocationSettings error via bridge:", e);
      }
    }
  }

  // 2. Try AppLauncher
  try {
    if (AppLauncher && typeof AppLauncher.openUrl === "function") {
      try {
        const res = await AppLauncher.openUrl({ url: "app-settings:" });
        if (res?.completed) return true;
      } catch (_) {}
    }
  } catch (err) {
    console.warn("Could not open device settings via AppLauncher:", err);
  }

  // 3. Webview / fallback
  if (typeof window !== "undefined") {
    try {
      window.open("app-settings:", "_system");
      return true;
    } catch (_) {}
  }
  return false;
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
    auto_mark_enabled: normalized.auto_mark_enabled,
    AutoMarkEnabled: normalized.auto_mark_enabled,
    updated_at: new Date().toISOString(),
  };

  let savedData = null;
  try {
    const { data, error } = await supabase
      .from(tableName)
      .upsert(payload, { onConflict: "id" })
      .select()
      .maybeSingle();

    if (error) {
      console.warn(`[AttendanceSettings] Remote upsert error on ${tableName}:`, error);
      // Try plain update fallback if upsert failed
      const { data: updateData, error: updateErr } = await supabase
        .from(tableName)
        .update(payload)
        .eq("id", 1)
        .select()
        .maybeSingle();
      if (!updateErr && updateData) {
        savedData = updateData;
      }
    } else if (data) {
      savedData = data;
    }
  } catch (err) {
    console.warn(`[AttendanceSettings] Database exception on ${tableName}:`, err);
  }

  // Cache in localStorage as guaranteed fallback
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(
        `mauze_att_settings_${isKibar ? "kibar" : "atfal"}`,
        JSON.stringify(payload)
      );
    } catch (_) {}
  }

  return normalizeAttendanceSettings(savedData || payload);
}
