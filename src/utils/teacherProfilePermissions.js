import { doc, getDoc, setDoc, onSnapshot, getFirestore } from "firebase/firestore";
import { firebaseApp } from "../firebase/config.js";

const STORAGE_KEY = "mt_teacher_profile_permissions_cache";
const FIRESTORE_COLLECTION = "system_settings";
const FIRESTORE_DOC_ID = "teacher_profile_permissions";

/**
 * Standard list of fields that can be locked or unlocked for editing by the teacher.
 */
export const PROFILE_FIELDS_CONFIG = [
  {
    key: "full_name",
    label: "Full Name",
    description: "Legal / official name displayed on records and report cards",
    category: "Identity",
    icon: "User",
    defaultAllowed: false, // Protected by default
  },
  {
    key: "photo_url",
    label: "Profile Photo",
    description: "Teacher's display picture and avatar across portals",
    category: "Identity",
    icon: "Camera",
    defaultAllowed: true,
  },
  {
    key: "phone_number",
    label: "Phone Number",
    description: "Direct calling phone contact number",
    category: "Contact",
    icon: "Phone",
    defaultAllowed: true,
  },
  {
    key: "whatsapp_number",
    label: "WhatsApp Number",
    description: "Number used for WhatsApp notifications and chats",
    category: "Contact",
    icon: "MessageCircle",
    defaultAllowed: true,
  },
  {
    key: "email",
    label: "Email Address",
    description: "Official email address used for login and notices",
    category: "Contact",
    icon: "Mail",
    defaultAllowed: false, // Protected login credential
  },
  {
    key: "bio",
    label: "Bio / About Me",
    description: "Personal statement, teaching philosophy, and background",
    category: "Academic",
    icon: "BookOpen",
    defaultAllowed: true,
  },
  {
    key: "qualification",
    label: "Qualifications & Sanad",
    description: "Hifz sanad, tajweed certifications, and academic degrees",
    category: "Academic",
    icon: "Award",
    defaultAllowed: true,
  },
  {
    key: "address",
    label: "Residential Address",
    description: "City, area, or full residential address",
    category: "Personal",
    icon: "MapPin",
    defaultAllowed: true,
  },
  {
    key: "emergency_contact",
    label: "Emergency Contact",
    description: "Emergency contact person's name, relationship & phone",
    category: "Personal",
    icon: "ShieldAlert",
    defaultAllowed: true,
  },
];

export const DEFAULT_GLOBAL_PERMISSIONS = PROFILE_FIELDS_CONFIG.reduce(
  (acc, field) => {
    acc[field.key] = field.defaultAllowed;
    return acc;
  },
  {}
);

/**
 * Load cached permissions from localStorage synchronously
 */
export function getCachedPermissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        global: { ...DEFAULT_GLOBAL_PERMISSIONS, ...(parsed.global || {}) },
        perTeacher: parsed.perTeacher || {},
      };
    }
  } catch (err) {
    console.warn("Failed reading cached teacher permissions:", err);
  }
  return {
    global: { ...DEFAULT_GLOBAL_PERMISSIONS },
    perTeacher: {},
  };
}

/**
 * Persist permissions into local cache
 */
function setCachedPermissions(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

/**
 * Normalize teacher identifier for per-teacher overrides
 */
export function normalizeTeacherKey(idOrName) {
  if (!idOrName) return "";
  return String(idOrName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_");
}

/**
 * Resolve effective permissions for a given teacher.
 * Combines global default with any per-teacher overrides.
 */
export function resolveTeacherPermissions(permissionsState, teacherIdOrName) {
  const global = {
    ...DEFAULT_GLOBAL_PERMISSIONS,
    ...(permissionsState?.global || {}),
  };
  const key = normalizeTeacherKey(teacherIdOrName);
  const overrides = permissionsState?.perTeacher?.[key] || {};
  return {
    ...global,
    ...overrides,
  };
}

/**
 * Real-time subscription to permissions document in Firestore
 */
export function subscribeProfilePermissions(onUpdate) {
  try {
    const db = getFirestore(firebaseApp);
    const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const merged = {
            global: { ...DEFAULT_GLOBAL_PERMISSIONS, ...(data.global || {}) },
            perTeacher: data.perTeacher || {},
            updatedAt: data.updatedAt || null,
            updatedBy: data.updatedBy || null,
          };
          setCachedPermissions(merged);
          if (typeof onUpdate === "function") onUpdate(merged);
        } else {
          // Document does not exist yet; provide cached/default
          const initial = getCachedPermissions();
          if (typeof onUpdate === "function") onUpdate(initial);
        }
      },
      (error) => {
        console.warn("Real-time teacher permissions subscription warning:", error);
        // Fallback to local cache on network warning
        const fallback = getCachedPermissions();
        if (typeof onUpdate === "function") onUpdate(fallback);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn("Failed initializing permissions listener:", err);
    if (typeof onUpdate === "function") onUpdate(getCachedPermissions());
    return () => {};
  }
}

/**
 * Save updated permissions to Firestore and update cache
 */
export async function saveProfilePermissions({
  global,
  perTeacher,
  updatedBy = "Admin",
}) {
  const payload = {
    global: { ...DEFAULT_GLOBAL_PERMISSIONS, ...(global || {}) },
    perTeacher: perTeacher || {},
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  setCachedPermissions(payload);

  try {
    const db = getFirestore(firebaseApp);
    const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);
    await setDoc(docRef, payload, { merge: true });
    return { success: true };
  } catch (err) {
    console.warn("Direct Firestore save failed, cached locally:", err);
    return { success: true, offline: true };
  }
}
