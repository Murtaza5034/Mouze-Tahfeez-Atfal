import { doc, getDoc, setDoc, onSnapshot, getFirestore } from "firebase/firestore";
import { firebaseApp } from "../firebase/config";
import { supabase } from "../supabaseClient";

export const DEFAULT_LEAGUE_LOCK_CONFIG = {
  // Global Month and Week Lock Matrix
  // Default according to user spec:
  // - Safar: all 4 weeks locked
  // - Rabi al-Awwal (rabi1): all 4 weeks locked
  // - Rabi al-Akhar (rabi2): week 1 & week 2 locked, week 3 & week 4 open
  // - Later months (jumada1, jumada2, rajab): week 1-4 open
  months: {
    safar: {
      locked: true,
      weeks: { week1: true, week2: true, week3: true, week4: true },
    },
    rabi1: {
      locked: true,
      weeks: { week1: true, week2: true, week3: true, week4: true },
    },
    rabi2: {
      locked: false,
      weeks: { week1: true, week2: true, week3: false, week4: false },
    },
    jumada1: {
      locked: false,
      weeks: { week1: false, week2: false, week3: false, week4: false },
    },
    jumada2: {
      locked: false,
      weeks: { week1: false, week2: false, week3: false, week4: false },
    },
    rajab: {
      locked: false,
      weeks: { week1: false, week2: false, week3: false, week4: false },
    },
  },
  // Individual teacher overrides:
  // teacherOverrides[teacherKey]: {
  //   teacherName: "Murtaza",
  //   months: {
  //     rabi2: { locked: false, weeks: { week1: false, week2: false } }
  //   }
  // }
  teacherOverrides: {},
  updated_at: new Date().toISOString(),
};

const LOCAL_STORAGE_KEY = "atfal_league_lock_config_v1";

/**
 * Gets cached lock config synchronously from localStorage with fallback
 */
export function getCachedLeagueLockConfig() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.months) {
        return parsed;
      }
    }
  } catch (_e) {}
  return DEFAULT_LEAGUE_LOCK_CONFIG;
}

/**
 * Subscribes to Real-time League Lock Configuration
 */
export function subscribeToLeagueLockConfig(callback) {
  // 1. Immediately emit cached config
  const initial = getCachedLeagueLockConfig();
  callback(initial);

  let unsub = () => {};

  try {
    const db = getFirestore(firebaseApp);
    const docRef = doc(db, "system_settings", "atfal_league_lock_config");

    unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const merged = {
            ...DEFAULT_LEAGUE_LOCK_CONFIG,
            ...data,
            months: {
              ...DEFAULT_LEAGUE_LOCK_CONFIG.months,
              ...(data.months || {}),
            },
            teacherOverrides: data.teacherOverrides || {},
          };
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
          } catch (_e) {}
          callback(merged);
        } else {
          // Initialize doc if missing
          setDoc(docRef, DEFAULT_LEAGUE_LOCK_CONFIG, { merge: true }).catch(() => {});
          callback(DEFAULT_LEAGUE_LOCK_CONFIG);
        }
      },
      (err) => {
        console.warn("Firestore lock config listener fallback:", err);
      }
    );
  } catch (err) {
    console.warn("Error subscribing to league lock config:", err);
  }

  return () => {
    try {
      unsub();
    } catch (_e) {}
  };
}

/**
 * Saves League Lock Configuration to Firestore & local cache
 */
export async function saveLeagueLockConfig(config) {
  const payload = {
    ...config,
    updated_at: new Date().toISOString(),
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (_e) {}

  try {
    const db = getFirestore(firebaseApp);
    const docRef = doc(db, "system_settings", "atfal_league_lock_config");
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.error("Failed to save league lock config to Firestore:", err);
    return false;
  }
}

/**
 * Normalizes teacher identifier string for override matching
 */
export function normalizeTeacherKey(teacherIdentity, currentUserId) {
  if (currentUserId && String(currentUserId).trim()) {
    return String(currentUserId).trim().toLowerCase();
  }
  if (teacherIdentity && String(teacherIdentity).trim()) {
    return String(teacherIdentity).trim().toLowerCase();
  }
  return "default";
}

/**
 * Checks if a specific month and week is locked for a teacher
 * @returns {{ isLocked: boolean, reason: string, isOverridden: boolean }}
 */
export function checkWeekLockStatus(
  lockConfig,
  monthId,
  weekKey,
  teacherIdentity = "",
  currentUserId = ""
) {
  const cfg = lockConfig || DEFAULT_LEAGUE_LOCK_CONFIG;
  const monthData = cfg.months?.[monthId] || { locked: false, weeks: {} };

  // Check individual teacher override first
  const tKeyId = currentUserId ? String(currentUserId).trim().toLowerCase() : null;
  const tKeyName = teacherIdentity ? String(teacherIdentity).trim().toLowerCase() : null;

  const overrides = cfg.teacherOverrides || {};
  const teacherOverride =
    (tKeyId && overrides[tKeyId]) ||
    (tKeyName && overrides[tKeyName]) ||
    null;

  if (teacherOverride && teacherOverride.months?.[monthId]) {
    const tMonth = teacherOverride.months[monthId];
    // Specific week override for this teacher
    if (tMonth.weeks && typeof tMonth.weeks[weekKey] === "boolean") {
      const isLocked = tMonth.weeks[weekKey];
      return {
        isLocked,
        reason: isLocked
          ? "Locked specifically for your teacher account by Admin"
          : "Unlocked specifically for your teacher account by Admin",
        isOverridden: true,
      };
    }
    // Entire month override for this teacher
    if (typeof tMonth.locked === "boolean") {
      const isLocked = tMonth.locked;
      return {
        isLocked,
        reason: isLocked
          ? "Month locked specifically for your teacher account by Admin"
          : "Month unlocked specifically for your teacher account by Admin",
        isOverridden: true,
      };
    }
  }

  // Global Lock Rules
  if (monthData.locked === true) {
    return {
      isLocked: true,
      reason: "This entire Islamic month is locked by Admin",
      isOverridden: false,
    };
  }

  if (monthData.weeks?.[weekKey] === true) {
    return {
      isLocked: true,
      reason: "This week is locked by Admin",
      isOverridden: false,
    };
  }

  return {
    isLocked: false,
    reason: "Open for entry",
    isOverridden: false,
  };
}
