import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import "./AtfalTeacherLeagueEntry.css";
import { supabase } from "../supabaseClient";
import { doc, setDoc, getDoc, onSnapshot, getFirestore } from "firebase/firestore";
import { firebaseApp } from "../firebase/config";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Save,
  Check,
  RotateCcw,
  Sparkles,
  BookOpen,
  X,
  Award,
  Calendar,
  User,
  Users
} from "lucide-react";

// ---------------------------------------------------------------------------
// ISLAMIC MONTHS CONFIGURATION (Matching the 4-page PDF reference)
// ---------------------------------------------------------------------------
const MONTHS_CONFIG = [
  {
    id: "safar",
    nameEn: "Safar al-Muzaffar",
    nameAr: "شهر صفر المظفر: 16 - 29",
    pageRange: "16 - 29",
    color: "#10b981",
  },
  {
    id: "rabi1",
    nameEn: "Rabi al-Awwal",
    nameAr: "شهر ربيع الاول: 1 - 15 & 16 - 30",
    pageRange: "1 - 15 & 16 - 30",
    color: "#06b6d4",
  },
  {
    id: "rabi2",
    nameEn: "Rabi al-Aakhar",
    nameAr: "شهر ربيع الآخر: 1 - 15 & 16 - 29",
    pageRange: "1 - 15 & 16 - 29",
    color: "#8b5cf6",
  },
  {
    id: "jumada1",
    nameEn: "Jumada al-Ula",
    nameAr: "شهر جمادى الاولى: 1 - 15 & 16 - 30",
    pageRange: "1 - 15 & 16 - 30",
    color: "#3b82f6",
  },
  {
    id: "jumada2",
    nameEn: "Jumada al-Ukhra",
    nameAr: "شهر جمادى الاخرى: 16 - 29",
    pageRange: "16 - 29",
    color: "#ec4899",
  },
  {
    id: "rajab",
    nameEn: "Rajab al-Asab",
    nameAr: "شهر رجب الاصب: 1 - 15",
    pageRange: "1 - 15",
    color: "#f59e0b",
  },
];

// ---------------------------------------------------------------------------
// GEM ICONS & GRAPHICS FOR EACH WEEK (Exact colors from the PDF)
// ---------------------------------------------------------------------------
const EmeraldGemSvg = () => (
  <svg className="league-gem-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="emGradCore" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#d1fae5" />
        <stop offset="30%" stopColor="#34d399" />
        <stop offset="70%" stopColor="#059669" />
        <stop offset="100%" stopColor="#064e3b" />
      </linearGradient>
    </defs>
    <polygon points="50,6 88,26 88,74 50,94 12,74 12,26" fill="url(#emGradCore)" stroke="#a7f3d0" strokeWidth="2.5" />
    <polygon points="50,6 72,30 28,30" fill="#ecfdf5" fillOpacity="0.85" />
    <polygon points="50,6 88,26 72,30" fill="#6ee7b7" fillOpacity="0.75" />
    <polygon points="50,6 12,26 28,30" fill="#a7f3d0" fillOpacity="0.8" />
    <polygon points="72,30 88,26 88,74 70,70" fill="#047857" fillOpacity="0.7" />
    <polygon points="28,30 12,26 12,74 30,70" fill="#10b981" fillOpacity="0.65" />
    <polygon points="28,30 72,30 70,70 30,70" fill="#10b981" fillOpacity="0.9" />
    <polygon points="30,70 70,70 50,94" fill="#065f46" fillOpacity="0.9" />
    <circle cx="44" cy="42" r="4" fill="#ffffff" filter="drop-shadow(0 0 4px #6ee7b7)" />
  </svg>
);

const RubyGemSvg = () => (
  <svg className="league-gem-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="rubyGradCore" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffe4e6" />
        <stop offset="35%" stopColor="#f43f5e" />
        <stop offset="70%" stopColor="#e11d48" />
        <stop offset="100%" stopColor="#881337" />
      </linearGradient>
    </defs>
    <polygon points="50,8 86,28 86,72 50,92 14,72 14,28" fill="url(#rubyGradCore)" stroke="#fecdd3" strokeWidth="2.5" />
    <polygon points="50,8 72,30 28,30" fill="#fff1f2" fillOpacity="0.9" />
    <polygon points="50,8 86,28 72,30" fill="#fb7185" fillOpacity="0.75" />
    <polygon points="50,8 14,28 28,30" fill="#fda4af" fillOpacity="0.8" />
    <polygon points="28,30 72,30 68,68 32,68" fill="#f43f5e" fillOpacity="0.9" />
    <polygon points="32,68 68,68 50,92" fill="#9f1239" fillOpacity="0.95" />
    <polygon points="72,30 86,28 86,72 68,68" fill="#be123c" fillOpacity="0.8" />
    <polygon points="28,30 14,28 14,72 32,68" fill="#e11d48" fillOpacity="0.75" />
    <circle cx="45" cy="40" r="4" fill="#ffffff" filter="drop-shadow(0 0 4px #fda4af)" />
  </svg>
);

const AmethystGemSvg = () => (
  <svg className="league-gem-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="amethystGradCore" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f5d0fe" />
        <stop offset="35%" stopColor="#d946ef" />
        <stop offset="70%" stopColor="#a21caf" />
        <stop offset="100%" stopColor="#4a044e" />
      </linearGradient>
    </defs>
    <polygon points="50,8 86,28 86,72 50,92 14,72 14,28" fill="url(#amethystGradCore)" stroke="#f5d0fe" strokeWidth="2.5" />
    <polygon points="50,8 72,30 28,30" fill="#fdf4ff" fillOpacity="0.9" />
    <polygon points="50,8 86,28 72,30" fill="#e879f9" fillOpacity="0.75" />
    <polygon points="50,8 14,28 28,30" fill="#f0abfc" fillOpacity="0.8" />
    <polygon points="28,30 72,30 68,68 32,68" fill="#c026d3" fillOpacity="0.9" />
    <polygon points="32,68 68,68 50,92" fill="#701a75" fillOpacity="0.95" />
    <polygon points="72,30 86,28 86,72 68,68" fill="#86198f" fillOpacity="0.8" />
    <polygon points="28,30 14,28 14,72 32,68" fill="#a21caf" fillOpacity="0.75" />
    <circle cx="45" cy="40" r="4" fill="#ffffff" filter="drop-shadow(0 0 4px #f0abfc)" />
  </svg>
);

const CyanSapphireGemSvg = () => (
  <svg className="league-gem-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cyanGradCore" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#cffafe" />
        <stop offset="35%" stopColor="#22d3ee" />
        <stop offset="70%" stopColor="#0891b2" />
        <stop offset="100%" stopColor="#164e63" />
      </linearGradient>
    </defs>
    <polygon points="50,8 86,28 86,72 50,92 14,72 14,28" fill="url(#cyanGradCore)" stroke="#a5f3fc" strokeWidth="2.5" />
    <polygon points="50,8 72,30 28,30" fill="#ecfeff" fillOpacity="0.9" />
    <polygon points="50,8 86,28 72,30" fill="#67e8f9" fillOpacity="0.75" />
    <polygon points="50,8 14,28 28,30" fill="#a5f3fc" fillOpacity="0.8" />
    <polygon points="28,30 72,30 68,68 32,68" fill="#06b6d4" fillOpacity="0.9" />
    <polygon points="32,68 68,68 50,92" fill="#0e7490" fillOpacity="0.95" />
    <polygon points="72,30 86,28 86,72 68,68" fill="#155e75" fillOpacity="0.8" />
    <polygon points="28,30 14,28 14,72 32,68" fill="#0891b2" fillOpacity="0.75" />
    <circle cx="45" cy="40" r="4" fill="#ffffff" filter="drop-shadow(0 0 4px #67e8f9)" />
  </svg>
);

const LavenderGemSvg = () => (
  <svg className="league-gem-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="lavGradCore" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#e0e7ff" />
        <stop offset="35%" stopColor="#a5b4fc" />
        <stop offset="70%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#312e81" />
      </linearGradient>
    </defs>
    <polygon points="50,8 86,28 86,72 50,92 14,72 14,28" fill="url(#lavGradCore)" stroke="#c7d2fe" strokeWidth="2.5" />
    <polygon points="50,8 72,30 28,30" fill="#eef2ff" fillOpacity="0.9" />
    <polygon points="50,8 86,28 72,30" fill="#c7d2fe" fillOpacity="0.75" />
    <polygon points="50,8 14,28 28,30" fill="#e0e7ff" fillOpacity="0.8" />
    <polygon points="28,30 72,30 68,68 32,68" fill="#818cf8" fillOpacity="0.9" />
    <polygon points="32,68 68,68 50,92" fill="#4338ca" fillOpacity="0.95" />
    <polygon points="72,30 86,28 86,72 68,68" fill="#4f46e5" fillOpacity="0.8" />
    <polygon points="28,30 14,28 14,72 32,68" fill="#6366f1" fillOpacity="0.75" />
    <circle cx="45" cy="40" r="4" fill="#ffffff" filter="drop-shadow(0 0 4px #c7d2fe)" />
  </svg>
);

const RoyalBlueGemSvg = () => (
  <svg className="league-gem-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="blueGradCore" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#dbeafe" />
        <stop offset="35%" stopColor="#3b82f6" />
        <stop offset="70%" stopColor="#1d4ed8" />
        <stop offset="100%" stopColor="#1e3a8a" />
      </linearGradient>
    </defs>
    <polygon points="50,8 86,28 86,72 50,92 14,72 14,28" fill="url(#blueGradCore)" stroke="#bfdbfe" strokeWidth="2.5" />
    <polygon points="50,8 72,30 28,30" fill="#eff6ff" fillOpacity="0.9" />
    <polygon points="50,8 86,28 72,30" fill="#93c5fd" fillOpacity="0.75" />
    <polygon points="50,8 14,28 28,30" fill="#bfdbfe" fillOpacity="0.8" />
    <polygon points="28,30 72,30 68,68 32,68" fill="#2563eb" fillOpacity="0.9" />
    <polygon points="32,68 68,68 50,92" fill="#1e40af" fillOpacity="0.95" />
    <polygon points="72,30 86,28 86,72 68,68" fill="#1d4ed8" fillOpacity="0.8" />
    <polygon points="28,30 14,28 14,72 32,68" fill="#2563eb" fillOpacity="0.75" />
    <circle cx="45" cy="40" r="4" fill="#ffffff" filter="drop-shadow(0 0 4px #93c5fd)" />
  </svg>
);

const AmberTopazGemSvg = () => (
  <svg className="league-gem-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="amberGradCore" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef3c7" />
        <stop offset="35%" stopColor="#f59e0b" />
        <stop offset="70%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
    </defs>
    <polygon points="50,8 86,28 86,72 50,92 14,72 14,28" fill="url(#amberGradCore)" stroke="#fde68a" strokeWidth="2.5" />
    <polygon points="50,8 72,30 28,30" fill="#fffbeb" fillOpacity="0.9" />
    <polygon points="50,8 86,28 72,30" fill="#fcd34d" fillOpacity="0.75" />
    <polygon points="50,8 14,28 28,30" fill="#fde68a" fillOpacity="0.8" />
    <polygon points="28,30 72,30 68,68 32,68" fill="#f59e0b" fillOpacity="0.9" />
    <polygon points="32,68 68,68 50,92" fill="#b45309" fillOpacity="0.95" />
    <polygon points="72,30 86,28 86,72 68,68" fill="#92400e" fillOpacity="0.8" />
    <polygon points="28,30 14,28 14,72 32,68" fill="#d97706" fillOpacity="0.75" />
    <circle cx="45" cy="40" r="4" fill="#ffffff" filter="drop-shadow(0 0 4px #fcd34d)" />
  </svg>
);

// 3D Animated Golden Treasure Chest with Glowing Overflowing Particles
const AnimatedTreasureChest = ({ isYearly = false }) => (
  <div className={`animated-3d-chest-wrapper ${isYearly ? 'yearly-chest' : 'monthly-chest'}`}>
    {/* Background radiant aura */}
    <div className="chest-radiance-halo" />
    
    {/* Golden beam rising from the treasure inside */}
    <div className="chest-interior-light-beam" />

    {/* 3D Golden Treasure Chest PNG */}
    <div className="chest-img-container">
      <img
        src="/assets/gems/treasure-chest-3d.png"
        alt="3D Golden Treasure Chest"
        className="chest-3d-render-img"
        loading="eager"
      />
    </div>

    {/* Glowing golden elements coming out from inside the box */}
    <div className="chest-particles-emitter" aria-hidden="true">
      <span className="gold-particle gp-1">✦</span>
      <span className="gold-particle gp-2">◆</span>
      <span className="gold-particle gp-3">★</span>
      <span className="gold-particle gp-4">✦</span>
      <span className="gold-particle gp-5">●</span>
      <span className="gold-particle gp-6">◆</span>
      <span className="gold-particle gp-7">★</span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
export default function AtfalTeacherLeagueEntry({
  students = [],
  allStudents = [],
  teacherIdentity = "",
  currentUserId = "",
  isDarkMode = false,
}) {
  // 1. Student List Preparation
  const effectiveStudents = useMemo(() => {
    const list = students && students.length > 0 ? students : allStudents;
    return (list || []).filter(Boolean).map(s => ({
      id: String(s.student_id || s.id || ""),
      student_id: String(s.student_id || s.id || ""),
      name: s.name || s.full_name || s.student_name || "Student",
      photo_url: s.photo_url || s.avatar_url || s.photoUrl || null,
      its_id: s.its_id || s.its || "",
      group_name: s.group_name || s.group || "Atfal",
    }));
  }, [students, allStudents]);

  // Selected Student
  const [selectedStudentId, setSelectedStudentId] = useState(() => {
    return effectiveStudents[0]?.student_id || "";
  });

  // Ensure valid selection if students array updates
  useEffect(() => {
    if (!selectedStudentId && effectiveStudents.length > 0) {
      setSelectedStudentId(effectiveStudents[0].student_id);
    }
  }, [effectiveStudents, selectedStudentId]);

  const activeStudent = useMemo(() => {
    return effectiveStudents.find(s => s.student_id === selectedStudentId) || effectiveStudents[0] || null;
  }, [effectiveStudents, selectedStudentId]);

  // 2. Month and Week Navigation
  const [selectedMonthId, setSelectedMonthId] = useState("safar");
  const [selectedWeekFilter, setSelectedWeekFilter] = useState("all"); // "all", "1", "2", "3", "4"
  const [showKalamModal, setShowKalamModal] = useState(false);

  // 3. Current Student's Gem League Data
  const [studentLeagueDoc, setStudentLeagueDoc] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Input draft buffer: prevents digit jumping/erasing while user types
  const [rawDrafts, setRawDrafts] = useState({});
  const activeFocusKeyRef = useRef(null);
  const dirtyStudentsRef = useRef({}); // Tracks which students have unsaved local edits
  const autoSaveTimerRef = useRef(null);
  const isSavingRef = useRef(false);
  const pendingSavePayloadRef = useRef(null);
  const currentDocRef = useRef(null);
  currentDocRef.current = studentLeagueDoc;

  // Refs for sequential Enter-key input navigation
  const inputRefs = useRef({});

  // Firestore instance
  const firestoreDb = useMemo(() => {
    try {
      return getFirestore(firebaseApp);
    } catch (_e) {
      return null;
    }
  }, []);

  // Scroll to top on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  // 4. Real-time Subscription to selected student's league record
  useEffect(() => {
    if (!selectedStudentId) {
      setStudentLeagueDoc(null);
      return;
    }

    setLoadingDoc(true);
    setSaveError("");

    let unsub = () => {};

    if (firestoreDb) {
      try {
        const docRef = doc(firestoreDb, "atfal_gem_league", String(selectedStudentId));
        unsub = onSnapshot(docRef, (snap) => {
          // PROTECTION AGAINST "ERASE DIGIT AGAIN SHOW" BUG:
          // If the teacher has dirty local edits or is actively typing in a field for this student,
          // do NOT clobber their in-memory changes with remote data!
          if (dirtyStudentsRef.current[String(selectedStudentId)] || activeFocusKeyRef.current?.startsWith(String(selectedStudentId))) {
            setLoadingDoc(false);
            return;
          }

          if (snap.exists()) {
            setStudentLeagueDoc(snap.data());
            setLoadingDoc(false);
          } else {
            // Check if saved under child_profiles
            const cpRef = doc(firestoreDb, "child_profiles", String(selectedStudentId));
            getDoc(cpRef).then((cpSnap) => {
              if (dirtyStudentsRef.current[String(selectedStudentId)]) return;
              if (cpSnap.exists() && cpSnap.data()?.gem_league) {
                setStudentLeagueDoc(cpSnap.data().gem_league);
              } else {
                setStudentLeagueDoc({
                  student_id: String(selectedStudentId),
                  student_name: activeStudent?.name || "",
                  teacher_id: currentUserId,
                  teacher_name: teacherIdentity,
                  year: "1448H",
                  months: {},
                });
              }
              setLoadingDoc(false);
            }).catch(() => {
              if (!dirtyStudentsRef.current[String(selectedStudentId)]) {
                setStudentLeagueDoc({
                  student_id: String(selectedStudentId),
                  student_name: activeStudent?.name || "",
                  teacher_id: currentUserId,
                  teacher_name: teacherIdentity,
                  year: "1448H",
                  months: {},
                });
              }
              setLoadingDoc(false);
            });
          }
        }, (err) => {
          console.warn("Firestore atfal_gem_league listener note, reading child_profiles:", err);
          if (dirtyStudentsRef.current[String(selectedStudentId)]) {
            setLoadingDoc(false);
            return;
          }
          const cpRef = doc(firestoreDb, "child_profiles", String(selectedStudentId));
          getDoc(cpRef).then((cpSnap) => {
            if (cpSnap.exists() && cpSnap.data()?.gem_league && !dirtyStudentsRef.current[String(selectedStudentId)]) {
              setStudentLeagueDoc(cpSnap.data().gem_league);
            }
            setLoadingDoc(false);
          }).catch(() => setLoadingDoc(false));
        });
      } catch (err) {
        console.warn("Error setting up listener:", err);
        setLoadingDoc(false);
      }
    } else {
      // Fallback via supabase adapter
      supabase
        .from("atfal_gem_league")
        .select("*")
        .eq("student_id", String(selectedStudentId))
        .single()
        .then(({ data, error }) => {
          if (!dirtyStudentsRef.current[String(selectedStudentId)]) {
            if (!error && data) {
              setStudentLeagueDoc(data);
            } else {
              setStudentLeagueDoc({
                student_id: String(selectedStudentId),
                student_name: activeStudent?.name || "",
                teacher_id: currentUserId,
                teacher_name: teacherIdentity,
                year: "1448H",
                months: {},
              });
            }
          }
          setLoadingDoc(false);
        })
        .catch(() => setLoadingDoc(false));
    }

    return () => unsub();
  }, [selectedStudentId, firestoreDb, activeStudent, currentUserId, teacherIdentity]);

  // Current active month's weeks
  const activeMonthData = useMemo(() => {
    const months = studentLeagueDoc?.months || {};
    return months[selectedMonthId] || {
      weeks: {
        week1: { post_it: 0, activity: 0 },
        week2: { post_it: 0, activity: 0 },
        week3: { post_it: 0, activity: 0 },
        week4: { post_it: 0, activity: 0 },
      },
    };
  }, [studentLeagueDoc, selectedMonthId]);

  // 5. Robust multi-place save function with concurrency queuing
  const performSave = useCallback(async (targetDoc, targetStudentId) => {
    if (!targetStudentId || !targetDoc) return;

    // Concurrency lock: If a save is already in-flight over network, queue this payload
    if (isSavingRef.current) {
      pendingSavePayloadRef.current = { targetDoc, targetStudentId };
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError("");

    const sIdStr = String(targetStudentId);
    const matchedStudent = effectiveStudents.find(s => s.student_id === sIdStr) || activeStudent;

    const payload = {
      ...targetDoc,
      student_id: sIdStr,
      student_name: matchedStudent?.name || targetDoc.student_name || "Student",
      photo_url: matchedStudent?.photo_url || matchedStudent?.photoUrl || matchedStudent?.photo || targetDoc?.photo_url || null,
      teacher_id: currentUserId || targetDoc.teacher_id || "",
      teacher_name: teacherIdentity || targetDoc.teacher_name || "Teacher",
      year: "1448H",
      updated_at: new Date().toISOString(),
    };

    try {
      if (firestoreDb) {
        // Parallel writes to both atfal_gem_league and child_profiles
        const docRef = doc(firestoreDb, "atfal_gem_league", sIdStr);
        const cpRef = doc(firestoreDb, "child_profiles", sIdStr);

        const [p1, p2] = await Promise.allSettled([
          setDoc(docRef, payload, { merge: true }),
          setDoc(cpRef, { gem_league: payload }, { merge: true }),
        ]);

        if (p1.status === "rejected" && p2.status === "rejected") {
          throw p1.reason || p2.reason || new Error("Save to Firestore failed");
        }

        // Asynchronous mirror to Supabase for multi-database sync
        supabase.from("atfal_gem_league").upsert(payload, { onConflict: "student_id" }).catch(() => {});
        supabase.from("child_profiles").update({ gem_league: payload }).eq("student_id", sIdStr).catch(() => {});
      } else {
        await supabase
          .from("atfal_gem_league")
          .upsert(payload, { onConflict: "student_id" });
        try {
          await supabase
            .from("child_profiles")
            .update({ gem_league: payload })
            .eq("student_id", sIdStr);
        } catch (_cpErr) {}
      }

      // Mark this student as clean
      dirtyStudentsRef.current[sIdStr] = false;

      // Broadcast instant window event so AtfalGemLeagueCard & Parent Views update in 0ms!
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("atfal-gem-league-updated", {
          detail: { studentId: sIdStr, payload }
        }));
      }

      setIsSaving(false);
      setSaveSuccess(true);
      setSaveError("");
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.warn("Save note, attempting child_profiles fallback write:", err);
      try {
        if (firestoreDb) {
          const cpRef = doc(firestoreDb, "child_profiles", sIdStr);
          await setDoc(cpRef, { gem_league: payload }, { merge: true });
          dirtyStudentsRef.current[sIdStr] = false;
          setIsSaving(false);
          setSaveSuccess(true);
          setSaveError("");
          setTimeout(() => setSaveSuccess(false), 2500);
          return;
        }
      } catch (_fbErr) {
        console.error("Fallback write failed:", _fbErr);
      }
      setIsSaving(false);
      setSaveError(err.message || "Connection issue while saving marks.");
    } finally {
      isSavingRef.current = false;
      // If another save was queued while we were saving, process it now
      if (pendingSavePayloadRef.current) {
        const next = pendingSavePayloadRef.current;
        pendingSavePayloadRef.current = null;
        performSave(next.targetDoc, next.targetStudentId);
      }
    }
  }, [firestoreDb, effectiveStudents, activeStudent, currentUserId, teacherIdentity]);

  // Schedule debounced auto-save (650ms after user pauses typing)
  const scheduleAutoSave = useCallback((docToSave, studentId) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      performSave(docToSave, studentId);
    }, 650);
  }, [performSave]);

  // Immediate save flush (used on steppers, manual save, and student switching)
  const flushSaveImmediate = useCallback((docToSave, studentId) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const targetDoc = docToSave || currentDocRef.current;
    const targetSid = studentId || selectedStudentId;
    if (targetDoc && targetSid) {
      performSave(targetDoc, targetSid);
    }
  }, [performSave, selectedStudentId]);

  // Flush on unmount if pending
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        if (currentDocRef.current && selectedStudentId) {
          performSave(currentDocRef.current, selectedStudentId);
        }
      }
    };
  }, [performSave, selectedStudentId]);

  // 6. Handling marks input changes (0 to 60) with instant UI calculation
  const handleScoreChange = useCallback((weekKey, field, rawValue, immediateFlush = false) => {
    const draftKey = `${selectedStudentId}_${selectedMonthId}_${weekKey}_${field}`;

    // Update raw string draft so typing is smooth and never resets
    setRawDrafts(prev => ({
      ...prev,
      [draftKey]: rawValue
    }));

    // Parse clean numeric score
    const trimmed = String(rawValue).trim();
    let num = 0;
    if (trimmed !== "") {
      const parsed = parseInt(trimmed, 10);
      if (!isNaN(parsed)) {
        num = Math.max(0, Math.min(60, parsed));
      }
    }

    // Mark as dirty
    dirtyStudentsRef.current[String(selectedStudentId)] = true;

    setStudentLeagueDoc((prev) => {
      const copy = { ...(prev || {}) };
      const months = { ...(copy.months || {}) };
      const currentMonth = { ...(months[selectedMonthId] || {}) };
      const weeks = { ...(currentMonth.weeks || {}) };
      const targetWeek = { ...(weeks[weekKey] || { post_it: 0, activity: 0 }) };

      targetWeek[field] = num;
      weeks[weekKey] = targetWeek;

      // Recalculate monthly total for this month
      let mTotal = 0;
      ["week1", "week2", "week3", "week4"].forEach((wk) => {
        const w = weeks[wk] || { post_it: 0, activity: 0 };
        mTotal += (Number(w.post_it) || 0) + (Number(w.activity) || 0);
      });

      currentMonth.weeks = weeks;
      currentMonth.monthly_total = mTotal;
      months[selectedMonthId] = currentMonth;

      // Recalculate yearly total across all months
      let yTotal = 0;
      MONTHS_CONFIG.forEach((m) => {
        const mData = months[m.id];
        if (mData && mData.weeks) {
          ["week1", "week2", "week3", "week4"].forEach((wk) => {
            const w = mData.weeks[wk] || { post_it: 0, activity: 0 };
            yTotal += (Number(w.post_it) || 0) + (Number(w.activity) || 0);
          });
        }
      });

      copy.months = months;
      copy.total_yearly_gems = yTotal;
      copy.updated_at = new Date().toISOString();

      // Trigger debounced or immediate save
      if (immediateFlush) {
        flushSaveImmediate(copy, selectedStudentId);
      } else {
        scheduleAutoSave(copy, selectedStudentId);
      }

      return copy;
    });

    setSaveSuccess(false);
  }, [selectedStudentId, selectedMonthId, scheduleAutoSave, flushSaveImmediate]);

  // Safe input blur normalization
  const handleScoreBlur = useCallback((weekKey, field) => {
    activeFocusKeyRef.current = null;
    const draftKey = `${selectedStudentId}_${selectedMonthId}_${weekKey}_${field}`;
    const rawVal = rawDrafts[draftKey];
    if (rawVal !== undefined) {
      const trimmed = String(rawVal).trim();
      if (trimmed === "") {
        setRawDrafts(prev => {
          const cp = { ...prev };
          delete cp[draftKey];
          return cp;
        });
      } else {
        const parsed = parseInt(trimmed, 10);
        const clamped = isNaN(parsed) ? 0 : Math.max(0, Math.min(60, parsed));
        setRawDrafts(prev => ({ ...prev, [draftKey]: String(clamped) }));
      }
    }
  }, [selectedStudentId, selectedMonthId, rawDrafts]);

  // Manual save trigger (Save Marks button)
  const saveMarks = async (_auto = false) => {
    flushSaveImmediate(currentDocRef.current, selectedStudentId);
  };

  // Calculate totals
  const monthlyGemsTotal = useMemo(() => {
    const weeks = activeMonthData?.weeks || {};
    let sum = 0;
    ["week1", "week2", "week3", "week4"].forEach((wk) => {
      const w = weeks[wk] || { post_it: 0, activity: 0 };
      sum += (Number(w.post_it) || 0) + (Number(w.activity) || 0);
    });
    return sum;
  }, [activeMonthData]);

  const yearlyGemsTotal = useMemo(() => {
    const months = studentLeagueDoc?.months || {};
    let sum = 0;
    MONTHS_CONFIG.forEach((m) => {
      const mData = months[m.id];
      if (mData && mData.weeks) {
        ["week1", "week2", "week3", "week4"].forEach((wk) => {
          const w = mData.weeks[wk] || { post_it: 0, activity: 0 };
          sum += (Number(w.post_it) || 0) + (Number(w.activity) || 0);
        });
      }
    });
    return sum;
  }, [studentLeagueDoc]);

  // Navigation between students (Previous / Next) with instant flush
  const handlePrevStudent = () => {
    if (dirtyStudentsRef.current[String(selectedStudentId)]) {
      flushSaveImmediate(currentDocRef.current, selectedStudentId);
    }
    const idx = effectiveStudents.findIndex(s => s.student_id === selectedStudentId);
    if (idx > 0) {
      setSelectedStudentId(effectiveStudents[idx - 1].student_id);
    } else if (effectiveStudents.length > 0) {
      setSelectedStudentId(effectiveStudents[effectiveStudents.length - 1].student_id);
    }
  };

  const handleNextStudent = () => {
    if (dirtyStudentsRef.current[String(selectedStudentId)]) {
      flushSaveImmediate(currentDocRef.current, selectedStudentId);
    }
    const idx = effectiveStudents.findIndex(s => s.student_id === selectedStudentId);
    if (idx < effectiveStudents.length - 1) {
      setSelectedStudentId(effectiveStudents[idx + 1].student_id);
    } else if (effectiveStudents.length > 0) {
      setSelectedStudentId(effectiveStudents[0].student_id);
    }
  };

  // Week metadata configuration with 3D gem PNG assets
  const WEEKS_META = [
    {
      key: "week1",
      number: 1,
      titleAr: "الأسبوع - ١",
      titleEn: "Week 1",
      gemImg: "/assets/gems/gem-week1-emerald.png",
      gemName: "Emerald",
      gemTheme: "emerald",
    },
    {
      key: "week2",
      number: 2,
      titleAr: "الأسبوع - ٢",
      titleEn: "Week 2",
      gemImg: "/assets/gems/gem-week2-ruby.png",
      gemName: "Heart Ruby",
      gemTheme: "ruby",
    },
    {
      key: "week3",
      number: 3,
      titleAr: "الأسبوع - ٣",
      titleEn: "Week 3",
      gemImg: "/assets/gems/gem-week3-sapphire.png",
      gemName: "Royal Sapphire",
      gemTheme: "sapphire",
    },
    {
      key: "week4",
      number: 4,
      titleAr: "الأسبوع - ٤",
      titleEn: "Week 4",
      gemImg: "/assets/gems/gem-week4-diamond.png",
      gemName: "Brilliant Diamond",
      gemTheme: "diamond",
    },
  ];

  const currentMonthConfig = MONTHS_CONFIG.find(m => m.id === selectedMonthId) || MONTHS_CONFIG[0];

  return (
    <div className={`atfal-league-entry-root ${isDarkMode ? "dark-theme" : ""}`}>
      {/* ----------------------------------------------------------------- */}
      {/* TOP CONTROLS & SELECTION BAR */}
      {/* ----------------------------------------------------------------- */}
      <div className="league-controls-bar">
        {/* Month Dropdown Selector */}
        <div className="league-control-item">
          <label className="league-control-label">
            <Calendar size={15} /> Select Islamic Month (Safar — Rajab):
          </label>
          <div className="league-select-wrap">
            <select
              value={selectedMonthId}
              onChange={(e) => {
                const nextMonth = e.target.value;
                if (dirtyStudentsRef.current[String(selectedStudentId)]) {
                  flushSaveImmediate(currentDocRef.current, selectedStudentId);
                }
                setSelectedMonthId(nextMonth);
              }}
              className="league-select-input"
            >
              {MONTHS_CONFIG.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nameAr} — ({m.nameEn})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Week View Mode Filter */}
        <div className="league-control-item">
          <label className="league-control-label">
            <Sparkles size={15} /> Week View:
          </label>
          <div className="league-week-pills">
            <button
              type="button"
              className={`league-week-pill ${selectedWeekFilter === "all" ? "active" : ""}`}
              onClick={() => setSelectedWeekFilter("all")}
            >
              All 4 Weeks (PDF Sheet)
            </button>
            <button
              type="button"
              className={`league-week-pill ${selectedWeekFilter === "1" ? "active" : ""}`}
              onClick={() => setSelectedWeekFilter("1")}
            >
              <img src="/assets/gems/gem-week1-emerald.png" alt="W1" className="pill-gem-mini" />
              الأسبوع ١
            </button>
            <button
              type="button"
              className={`league-week-pill ${selectedWeekFilter === "2" ? "active" : ""}`}
              onClick={() => setSelectedWeekFilter("2")}
            >
              <img src="/assets/gems/gem-week2-ruby.png" alt="W2" className="pill-gem-mini" />
              الأسبوع ٢
            </button>
            <button
              type="button"
              className={`league-week-pill ${selectedWeekFilter === "3" ? "active" : ""}`}
              onClick={() => setSelectedWeekFilter("3")}
            >
              <img src="/assets/gems/gem-week3-sapphire.png" alt="W3" className="pill-gem-mini" />
              الأسبوع ٣
            </button>
            <button
              type="button"
              className={`league-week-pill ${selectedWeekFilter === "4" ? "active" : ""}`}
              onClick={() => setSelectedWeekFilter("4")}
            >
              <img src="/assets/gems/gem-week4-diamond.png" alt="W4" className="pill-gem-mini" />
              الأسبوع ٤
            </button>
          </div>
        </div>

        {/* Student Selector with Quick Switcher */}
        <div className="league-control-item student-control-item">
          <label className="league-control-label">
            <Users size={15} /> Select Atfal Student:
          </label>
          <div className="league-student-switcher">
            <button
              type="button"
              className="student-nav-btn prev-btn"
              onClick={handlePrevStudent}
              title="Previous Student"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="student-select-field">
              <select
                value={selectedStudentId}
                onChange={(e) => {
                  const nextSid = e.target.value;
                  if (dirtyStudentsRef.current[String(selectedStudentId)]) {
                    flushSaveImmediate(currentDocRef.current, selectedStudentId);
                  }
                  setSelectedStudentId(nextSid);
                }}
                className="league-student-select"
              >
                {effectiveStudents.map((s, idx) => (
                  <option key={s.student_id} value={s.student_id}>
                    {idx + 1}. {s.name} {s.its_id ? `(${s.its_id})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="student-nav-btn next-btn"
              onClick={handleNextStudent}
              title="Next Student"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Action / Feedback Banner */}
      <div className="league-status-banner-wrap">
        <div className="league-student-info-strip">
          <div className="student-badge-avatar">
            {activeStudent?.photo_url ? (
              <img src={activeStudent.photo_url} alt={activeStudent.name} />
            ) : (
              <User size={24} />
            )}
          </div>
          <div className="student-badge-text">
            <h3 className="student-badge-name">{activeStudent?.name || "Select Student"}</h3>
            <span className="student-badge-sub">
              {activeStudent?.group_name ? `Group: ${activeStudent.group_name}` : "Atfal Student"}
              {activeStudent?.its_id && ` • ITS: ${activeStudent.its_id}`}
            </span>
          </div>
        </div>

        <div className="league-actions-right">
          {/* Live Auto-Save Indicator */}
          <div className="league-auto-save-pill">
            {isSaving ? (
              <span className="auto-save-tag saving">
                <span className="save-pulse-dot" /> Saving...
              </span>
            ) : saveSuccess ? (
              <span className="auto-save-tag saved">
                <Check size={14} /> Saved!
              </span>
            ) : dirtyStudentsRef.current[String(selectedStudentId)] ? (
              <span className="auto-save-tag unsaved">
                <span className="save-pending-dot" /> Auto-saving...
              </span>
            ) : (
              <span className="auto-save-tag idle">
                <Check size={14} /> Auto-saved
              </span>
            )}
          </div>

          <button
            type="button"
            className="kalam-toggle-btn"
            onClick={() => setShowKalamModal(true)}
            title="Read Kalam Mubarak from Page 1 of PDF"
          >
            <BookOpen size={16} />
            <span>Kalam Mubarak</span>
          </button>

          <button
            type="button"
            className={`league-save-btn ${saveSuccess ? "saved" : ""}`}
            onClick={() => saveMarks(false)}
            disabled={isSaving}
          >
            {isSaving ? (
              <>Saving...</>
            ) : saveSuccess ? (
              <>
                <Check size={18} /> Saved!
              </>
            ) : (
              <>
                <Save size={18} /> Save Marks
              </>
            )}
          </button>
        </div>
      </div>

      {saveError && <div className="league-error-toast">{saveError}</div>}

      {/* ----------------------------------------------------------------- */}
      {/* AUTHENTIC PDF REPLICA PARCHMENT SHEET */}
      {/* ----------------------------------------------------------------- */}
      <div className="parchment-sheet-container">
        <div className="parchment-sheet">
          {/* Ornate Corner Accents */}
          <div className="parchment-corner c-top-left" />
          <div className="parchment-corner c-top-right" />
          <div className="parchment-corner c-bottom-left" />
          <div className="parchment-corner c-bottom-right" />

          {/* Grand Header from PDF */}
          <header className="parchment-header">
            <h1 className="hifz-league-title">HIFZ LEAGUE 1448H</h1>
            <h2 className="atfal-tahfeez-subtitle">روضة تحفيظ الأطفال - گلياکوٹ</h2>
            <div className="parchment-ornamental-line">
              <span className="ornament-gem">✦</span>
            </div>

            {/* Selected Month Banner Badge */}
            <div className="parchment-month-banner">
              <div className="month-banner-ribbon">
                <span className="banner-ar-text">{currentMonthConfig.nameAr}</span>
              </div>
            </div>
          </header>

          {/* 4 WEEK ENTRY CARDS GRID */}
          <div className="parchment-weeks-grid">
            {WEEKS_META.filter(w => selectedWeekFilter === "all" || selectedWeekFilter === String(w.number)).map((week) => {
              const weekData = activeMonthData.weeks?.[week.key] || { post_it: 0, activity: 0 };
              const postItScore = Number(weekData.post_it) || 0;
              const activityScore = Number(weekData.activity) || 0;
              const weekTotal = postItScore + activityScore;

              const postItDraftKey = `${selectedStudentId}_${selectedMonthId}_${week.key}_post_it`;
              const postItRaw = rawDrafts[postItDraftKey];
              const postItDisplayVal = postItRaw !== undefined ? postItRaw : (postItScore === 0 ? "" : String(postItScore));

              const actDraftKey = `${selectedStudentId}_${selectedMonthId}_${week.key}_activity`;
              const actRaw = rawDrafts[actDraftKey];
              const actDisplayVal = actRaw !== undefined ? actRaw : (activityScore === 0 ? "" : String(activityScore));

              return (
                <div key={week.key} className="parchment-week-card">
                  {/* Week Header */}
                  <div className="week-card-header">
                    <div className="week-card-header-left">
                      <img src={week.gemImg} alt={week.gemName} className="header-mini-3d-gem" />
                      <span className="week-ar-tag">{week.titleAr}</span>
                      <span className="week-en-tag">({week.gemName})</span>
                    </div>
                    <span className="week-total-pill">Total: {weekTotal} / 120</span>
                  </div>

                  {/* Two Main Columns: POST-IT GEMS and ACTIVITY GEMS */}
                  <div className="week-columns-wrap">
                    {/* LEFT COLUMN: POST-IT GEMS */}
                    <div className="week-col post-it-col">
                      <span className="gem-category-label">POST-IT GEMS</span>
                      <div className="gem-graphic-box">
                        <img src={week.gemImg} alt={week.gemName} className="teacher-3d-gem-img" />
                      </div>

                      {/* Marks Input Box (out of 60) */}
                      <div className="gem-input-box-wrap">
                        <div className="gem-input-row">
                          <input
                            ref={(el) => { inputRefs.current[`${week.key}_post_it`] = el; }}
                            type="number"
                            min="0"
                            max="60"
                            value={postItDisplayVal}
                            onFocus={() => { activeFocusKeyRef.current = postItDraftKey; }}
                            onBlur={() => handleScoreBlur(week.key, "post_it")}
                            onChange={(e) => handleScoreChange(week.key, "post_it", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                inputRefs.current[`${week.key}_activity`]?.focus();
                              }
                            }}
                            placeholder="0"
                            className="gem-score-input"
                          />
                          <span className="gem-max-label">/ 60</span>
                        </div>

                        {/* Quick Presets / Steppers */}
                        <div className="gem-stepper-btns">
                          <button
                            type="button"
                            onClick={() => handleScoreChange(week.key, "post_it", Math.max(0, postItScore - 5), true)}
                            title="-5 Gems"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            onClick={() => handleScoreChange(week.key, "post_it", Math.min(60, postItScore + 5), true)}
                            title="+5 Gems"
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            className="btn-full-gems"
                            onClick={() => handleScoreChange(week.key, "post_it", 60, true)}
                            title="Full 60 Gems"
                          >
                            60
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: ACTIVITY GEMS */}
                    <div className="week-col activity-col">
                      <span className="gem-category-label">ACTIVITY GEMS</span>
                      <div className="gem-graphic-box">
                        <img src={week.gemImg} alt={week.gemName} className="teacher-3d-gem-img" />
                      </div>
                      <span className="activity-breakdown-sub">
                        ATTENDANCE | JADEED | MURAJAH | TILAWAT
                      </span>

                      {/* Marks Input Box (out of 60) */}
                      <div className="gem-input-box-wrap">
                        <div className="gem-input-row">
                          <input
                            ref={(el) => { inputRefs.current[`${week.key}_activity`] = el; }}
                            type="number"
                            min="0"
                            max="60"
                            value={actDisplayVal}
                            onFocus={() => { activeFocusKeyRef.current = actDraftKey; }}
                            onBlur={() => handleScoreBlur(week.key, "activity")}
                            onChange={(e) => handleScoreChange(week.key, "activity", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const nextWeekNum = week.number + 1;
                                if (nextWeekNum <= 4) {
                                  inputRefs.current[`week${nextWeekNum}_post_it`]?.focus();
                                }
                              }
                            }}
                            placeholder="0"
                            className="gem-score-input"
                          />
                          <span className="gem-max-label">/ 60</span>
                        </div>

                        {/* Quick Presets / Steppers */}
                        <div className="gem-stepper-btns">
                          <button
                            type="button"
                            onClick={() => handleScoreChange(week.key, "activity", Math.max(0, activityScore - 5), true)}
                            title="-5 Gems"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            onClick={() => handleScoreChange(week.key, "activity", Math.min(60, activityScore + 5), true)}
                            title="+5 Gems"
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            className="btn-full-gems"
                            onClick={() => handleScoreChange(week.key, "activity", 60, true)}
                            title="Full 60 Gems"
                          >
                            60
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* BOTTOM SUMMARY: MONTHLY GEMS & YEARLY GEMS TREASURE CHESTS */}
          <div className="parchment-summary-strip">
            {/* Monthly Gems Treasure Chest */}
            <div className="summary-chest-card monthly-chest-card">
              <div className="chest-graphic-wrap">
                <AnimatedTreasureChest isYearly={false} />
              </div>
              <div className="chest-text-content">
                <span className="chest-badge-title">MONTHLY GEMS</span>
                <span className="chest-score-display">{monthlyGemsTotal}</span>
                <span className="chest-subtext">Total gems collected in {currentMonthConfig.nameEn}</span>
              </div>
            </div>

            {/* Yearly Gems Grand Chest */}
            <div className="summary-chest-card yearly-chest-card">
              <div className="chest-graphic-wrap">
                <AnimatedTreasureChest isYearly={true} />
              </div>
              <div className="chest-text-content">
                <span className="chest-badge-title">YEARLY GEMS</span>
                <span className="chest-score-display">{yearlyGemsTotal}</span>
                <span className="chest-subtext">Cumulative gems across all 6 months (1448H)</span>
              </div>
            </div>
          </div>

          {/* OFFICIAL STAMP / SEAL (From bottom right of PDF) */}
          <footer className="parchment-footer-seal">
            <div className="official-arabic-seal">
              <span className="seal-ar-line1">روضة تحفيظ الأطفال</span>
              <span className="seal-ar-line2">گلياکوٹ</span>
            </div>
          </footer>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* KALAM MUBARAK MODAL (From Page 1 of the PDF) */}
      {/* ----------------------------------------------------------------- */}
      {showKalamModal && (
        <div className="kalam-modal-overlay" onClick={() => setShowKalamModal(false)}>
          <div className="kalam-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="kalam-close-btn" onClick={() => setShowKalamModal(false)}>
              <X size={20} />
            </button>
            <div className="kalam-header">
              <h3 className="kalam-title">HIFZ LEAGUE 1448H</h3>
              <h4 className="kalam-sub">روضة تحفيظ الأطفال - گلياکوٹ</h4>
              <div className="kalam-divider">✦</div>
            </div>
            <div className="kalam-body-ar" dir="rtl">
              <p className="kalam-intro">
                الداعي الأجل سيدنا عالي قدر مفضل سيف الدين آقا فرماوے چھے:
              </p>
              <blockquote className="kalam-quote-box">
                امير المؤمنين فرماوے چھے، <span className="highlight-phrase">حِرْفَةُ الْمَرْءِ كَنْزُهُ</span>، انسان نو هنر اهنو خزانة چھے_ اهنا سي دولة كَمَاوتا رهے چھے، تو كوئي بهي هنر نے هلكو نه سمجهوو جوئئے، كيم كہ انسان اهنا هنر سي رَمْزِي كَماوے چھے انے اهنا گهر نے پالے چھے، انے يه معنٰى سي بهي هرايك هنر ايك خزانة چھے_
              </blockquote>
              <p className="kalam-reference">- المجلس الاول ١٤٤٨ هـ -</p>
              <div className="kalam-divider-small">❖</div>
              <blockquote className="kalam-quote-box second">
                &ldquo;الكنوز&rdquo; نا عدد ۱۱۴ چھے، قرآن في ۱۱۴ سورة چھے، تو باواجي صاحب مولي حافظ القرآن - الجامع الأنور ما قرآن في حفظ في نهضة شروع كرے چھے انے مؤمنين في قرآن في تلاوة ما، قرآن نا حفظ ما، قرآن سي بركة ليوا ما كايا كايا پلٹے چھے، انے آج تو الكنوز سي هر مؤمن نو گهر آباد تھئي گيو چھے، انے ايم اميد تھئي جائي چھے كہ هر ايك گهر ما ايك تو هوئي – پورا قرآن اهنے ياد هوئي_
              </blockquote>
              <p className="kalam-reference">- المجلس التاسع لاجل الفطرة ١٤٤٨ هـ -</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
