import { doc, getDoc, setDoc, onSnapshot, getFirestore } from "firebase/firestore";
import { firebaseApp } from "../firebase/config";

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
  teacherOverrides: {},
  updated_at: new Date().toISOString(),
};

const LOCAL_STORAGE_KEY = "atfal_league_lock_config_v1";

/**
 * Normalizes text for robust matching (removes special chars, extra spaces)
 */
export function cleanNorm(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\d\s]/g, "")
    .replace(/\s+/g, " ");
}

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
 * Subscribes to Real-time League Lock Configuration across Firestore, Supabase, and localStorage
 */
export function subscribeToLeagueLockConfig(callback) {
  // 1. Immediately emit cached config
  const initial = getCachedLeagueLockConfig();
  callback(initial);

  let unsubFirestore = () => {};

  const handleNewConfig = (data) => {
    if (!data) return;
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
  };

  // 2. Subscribe to Firestore real-time doc
  try {
    const db = getFirestore(firebaseApp);
    const docRef = doc(db, "system_settings", "atfal_league_lock_config");

    unsubFirestore = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          handleNewConfig(snap.data());
        } else {
          setDoc(docRef, DEFAULT_LEAGUE_LOCK_CONFIG, { merge: true }).catch(() => {});
          callback(DEFAULT_LEAGUE_LOCK_CONFIG);
        }
      },
      (err) => {
        console.warn("Firestore lock config listener note:", err);
      }
    );
  } catch (err) {
    console.warn("Error subscribing to Firestore league lock config:", err);
  }

  // 3. Fallback fetch from Firestore once (in case onSnapshot is delayed on mobile)
  try {
    const db = getFirestore(firebaseApp);
    const docRef = doc(db, "system_settings", "atfal_league_lock_config");
    getDoc(docRef).then((snap) => {
      if (snap.exists()) {
        handleNewConfig(snap.data());
      }
    }).catch(() => {});
  } catch (_e) {}

  // 4. Cross-tab storage listener
  const handleStorage = (e) => {
    if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && parsed.months) callback(parsed);
      } catch (_err) {}
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    try {
      unsubFirestore();
    } catch (_e) {}
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
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
 * Employs multi-identifier resolution (Auth UID, ITS number, DB ID, Teacher Name)
 * @returns {{ isLocked: boolean, reason: string, isOverridden: boolean }}
 */
export function checkWeekLockStatus(
  lockConfig,
  monthId,
  weekKey,
  teacherIdentity = "",
  currentUserId = "",
  teacherProfile = null
) {
  const cfg = lockConfig || DEFAULT_LEAGUE_LOCK_CONFIG;
  const monthData = cfg.months?.[monthId] || { locked: false, weeks: {} };

  // Collect all possible candidate keys and identifiers for the current teacher
  const candidateKeys = new Set();

  if (currentUserId) {
    const s = String(currentUserId).trim().toLowerCase();
    candidateKeys.add(s);
  }

  if (teacherIdentity) {
    if (typeof teacherIdentity === "string") {
      const trimmed = teacherIdentity.trim();
      candidateKeys.add(trimmed.toLowerCase());
      candidateKeys.add(cleanNorm(trimmed));
      const digits = trimmed.match(/\d{5,9}/)?.[0];
      if (digits) candidateKeys.add(digits);
    } else if (typeof teacherIdentity === "object") {
      if (teacherIdentity.id) candidateKeys.add(String(teacherIdentity.id).trim().toLowerCase());
      if (teacherIdentity.user_id) candidateKeys.add(String(teacherIdentity.user_id).trim().toLowerCase());
      if (teacherIdentity.its || teacherIdentity.its_id) candidateKeys.add(String(teacherIdentity.its || teacherIdentity.its_id).trim().toLowerCase());
      if (teacherIdentity.name || teacherIdentity.full_name) {
        candidateKeys.add(cleanNorm(teacherIdentity.name || teacherIdentity.full_name));
      }
    }
  }

  if (teacherProfile && typeof teacherProfile === "object") {
    if (teacherProfile.id) candidateKeys.add(String(teacherProfile.id).trim().toLowerCase());
    if (teacherProfile.user_id) candidateKeys.add(String(teacherProfile.user_id).trim().toLowerCase());
    if (teacherProfile.its || teacherProfile.its_id) candidateKeys.add(String(teacherProfile.its || teacherProfile.its_id).trim().toLowerCase());
    if (teacherProfile.full_name || teacherProfile.name) {
      candidateKeys.add(cleanNorm(teacherProfile.full_name || teacherProfile.name));
    }
  }

  // Also check localStorage for cached teacher credentials
  if (typeof localStorage !== "undefined") {
    try {
      const localIts = localStorage.getItem("mauze_teacher_its") || localStorage.getItem("portal_its") || localStorage.getItem("mauze_user_its");
      if (localIts) candidateKeys.add(String(localIts).trim().toLowerCase());
      const localName = localStorage.getItem("mauze_teacher_name") || localStorage.getItem("teacher_name");
      if (localName) candidateKeys.add(cleanNorm(localName));
    } catch (_e) {}
  }

  const overrides = cfg.teacherOverrides || {};
  let matchedOverride = null;

  // 1. Direct candidate keys lookup in overrides dictionary
  for (const k of candidateKeys) {
    if (k && overrides[k]) {
      matchedOverride = overrides[k];
      break;
    }
  }

  // 2. Comprehensive object scan across all override records
  if (!matchedOverride) {
    for (const [ovKey, ov] of Object.entries(overrides)) {
      if (!ov) continue;
      const ovNormKey = cleanNorm(ovKey);
      const ovName = cleanNorm(ov.teacherName || ov.name || "");
      const ovIts = String(ov.its || ov.its_id || "").trim();
      const ovUserId = String(ov.user_id || ov.id || "").trim().toLowerCase();

      for (const cand of candidateKeys) {
        if (!cand) continue;
        const candNorm = cleanNorm(cand);
        if (
          cand === ovKey.toLowerCase() ||
          candNorm === ovNormKey ||
          (ovName && (candNorm === ovName || candNorm.includes(ovName) || ovName.includes(candNorm))) ||
          (ovIts && (cand === ovIts || candNorm.includes(ovIts))) ||
          (ovUserId && cand === ovUserId)
        ) {
          matchedOverride = ov;
          break;
        }
      }
      if (matchedOverride) break;
    }
  }

  if (matchedOverride && matchedOverride.months?.[monthId]) {
    const tMonth = matchedOverride.months[monthId];
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
