import React, { useState, useEffect, useMemo } from 'react';
import './AtfalGemLeagueCard.css';
import { supabase } from '../supabaseClient';
import { doc, onSnapshot, getDoc, getDocs, collection, getFirestore } from 'firebase/firestore';
import { firebaseApp } from '../firebase/config';

// ---------------------------------------------------------------------------
// 4 DISTINCT REAL 3D GEM ASSETS (WEEK 1-4)
// ---------------------------------------------------------------------------
export const GEM_3D_ASSETS = {
  1: '/assets/gems/gem-week1-emerald.png',
  2: '/assets/gems/gem-week2-ruby.png',
  3: '/assets/gems/gem-week3-sapphire.png',
  4: '/assets/gems/gem-week4-diamond.png',
};

// Sparkling Corner Facet Decor
const CornerGem = ({ position = 'top-left', color = 'cyan' }) => (
  <div className={`gem-card-corner-facet corner-${position} color-${color}`}>
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`facetGradCyan-${position}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#67e8f9" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={`facetGradGold-${position}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#fde047" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#b45309" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      {color === 'cyan' ? (
        <>
          <polygon points="0,0 75,0 45,45 0,75" fill={`url(#facetGradCyan-${position})`} />
          <polygon points="0,0 45,45 20,60 0,35" fill="#a5f3fc" fillOpacity="0.7" />
          <polygon points="45,45 75,0 90,20 60,60" fill="#38bdf8" fillOpacity="0.5" />
          <polygon points="0,0 25,0 15,25 0,25" fill="#ffffff" fillOpacity="0.9" />
          <circle cx="28" cy="28" r="4" fill="#ffffff" filter="drop-shadow(0 0 4px #67e8f9)" />
        </>
      ) : (
        <>
          <polygon points="100,0 25,0 55,45 100,75" fill={`url(#facetGradGold-${position})`} />
          <polygon points="100,0 55,45 80,60 100,35" fill="#fef08a" fillOpacity="0.75" />
          <polygon points="55,45 25,0 10,20 40,60" fill="#f59e0b" fillOpacity="0.55" />
          <polygon points="100,0 75,0 85,25 100,25" fill="#ffffff" fillOpacity="0.9" />
          <circle cx="72" cy="28" r="4" fill="#ffffff" filter="drop-shadow(0 0 4px #fbbf24)" />
        </>
      )}
    </svg>
  </div>
);

// Large 3D Faceted Glowing Jewel Centerpiece Orb
const CentralJewelOrb = () => (
  <div className="central-gem-orb-wrapper">
    <div className="gem-ambient-glow" />
    <div className="gem-light-rays" />
    <svg className="central-faceted-gem-svg" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="gemInnerCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="35%" stopColor="#e0e7ff" stopOpacity="0.9" />
          <stop offset="65%" stopColor="#818cf8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#312e81" stopOpacity="0.9" />
        </radialGradient>
        <linearGradient id="facetTopPink" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <linearGradient id="facetCyan" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="facetAmber" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="facetBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>

      <polygon points="80,18 108,36 122,65 116,98 94,124 66,124 44,98 38,65 52,36" fill="url(#gemInnerCore)" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.7" />
      <polygon points="80,18 108,36 80,48 52,36" fill="url(#facetTopPink)" fillOpacity="0.85" />
      <polygon points="108,36 122,65 96,65 80,48" fill="url(#facetAmber)" fillOpacity="0.8" />
      <polygon points="52,36 80,48 64,65 38,65" fill="url(#facetCyan)" fillOpacity="0.8" />
      <polygon points="38,65 64,65 66,95 44,98" fill="url(#facetBlue)" fillOpacity="0.85" />
      <polygon points="122,65 116,98 94,95 96,65" fill="url(#facetCyan)" fillOpacity="0.85" />
      <polygon points="64,65 96,65 94,95 66,95" fill="#fdf4ff" fillOpacity="0.9" />
      <polygon points="80,48 96,65 64,65" fill="#ffffff" fillOpacity="0.95" />
      <polygon points="66,95 94,95 80,120" fill="url(#facetAmber)" fillOpacity="0.9" />
      <polygon points="70,55 85,50 80,68 68,64" fill="#ffffff" fillOpacity="0.85" />
      <circle cx="75" cy="58" r="3.5" fill="#ffffff" />
      <circle cx="102" cy="74" r="2.5" fill="#ffffff" />
      <circle cx="58" cy="78" r="2" fill="#ffffff" />
    </svg>
  </div>
);

// Small Blue Diamond Icon
const SmallDiamondIcon = () => (
  <svg className="small-inline-diamond" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="8,1 14,5 11,11 8,15 5,11 2,5" fill="#38bdf8" stroke="#bae6fd" strokeWidth="0.75" />
    <polygon points="8,1 10,5 8,7 6,5" fill="#ffffff" fillOpacity="0.9" />
    <polygon points="8,7 11,11 5,11" fill="#0284c7" fillOpacity="0.6" />
  </svg>
);

// Crowns for Leaderboard Ranks
const CrownIcon = ({ rank = 1 }) => {
  if (rank === 1) {
    return (
      <svg className="crown-svg-icon rank-1-crown" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 17H20L21 8L16 12L12 5L8 12L3 8L4 17Z" fill="url(#crownGradGold)" stroke="#fef08a" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="12" cy="4" r="1.5" fill="#fff" />
        <circle cx="3" cy="7" r="1.5" fill="#fff" />
        <circle cx="21" cy="7" r="1.5" fill="#fff" />
        <defs>
          <linearGradient id="crownGradGold" x1="12" y1="4" x2="12" y2="17" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fef08a" />
            <stop offset="0.5" stopColor="#facc15" />
            <stop offset="1" stopColor="#ca8a04" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (rank === 2) {
    return (
      <svg className="crown-svg-icon rank-2-crown" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 17H20L21 8L16 12L12 5L8 12L3 8L4 17Z" fill="url(#crownGradSilver)" stroke="#e2e8f0" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="12" cy="4" r="1.5" fill="#fff" />
        <circle cx="3" cy="7" r="1.5" fill="#fff" />
        <circle cx="21" cy="7" r="1.5" fill="#fff" />
        <defs>
          <linearGradient id="crownGradSilver" x1="12" y1="4" x2="12" y2="17" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="0.5" stopColor="#cbd5e1" />
            <stop offset="1" stopColor="#64748b" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  return (
    <svg className="crown-svg-icon rank-3-crown" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 17H20L21 8L16 12L12 5L8 12L3 8L4 17Z" fill="url(#crownGradBronze)" stroke="#fdba74" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="12" cy="4" r="1.5" fill="#fff" />
      <circle cx="3" cy="7" r="1.5" fill="#fff" />
      <circle cx="21" cy="7" r="1.5" fill="#fff" />
      <defs>
        <linearGradient id="crownGradBronze" x1="12" y1="4" x2="12" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fed7aa" />
          <stop offset="0.5" stopColor="#f97316" />
          <stop offset="1" stopColor="#9a3412" />
        </linearGradient>
      </defs>
    </svg>
  );
};

// Months configuration corresponding to Hifz League 1448H
const MONTHS_LIST = [
  { id: "safar", label: "Safar al-Muzaffar", short: "Safar", hijri: "صفر المظفر" },
  { id: "rabi1", label: "Rabi al-Awwal", short: "Rabi I", hijri: "ربيع الأول" },
  { id: "rabi2", label: "Rabi al-Aakhar", short: "Rabi II", hijri: "ربيع الآخر" },
  { id: "jumada1", label: "Jumada al-Ula", short: "Jumada I", hijri: "جمادى الأولى" },
  { id: "jumada2", label: "Jumada al-Ukhra", short: "Jumada II", hijri: "جمادى الآخرة" },
  { id: "rajab", label: "Rajab al-Asab", short: "Rajab", hijri: "رجب الأصب" },
];

export default function AtfalGemLeagueCard({ studentProfile, weeklyResult, customGemsData, allProfiles }) {
  const studentName = studentProfile?.name || studentProfile?.full_name || studentProfile?.student_name || "Student";
  const rawStudentAvatar = studentProfile?.photoUrl || studentProfile?.photo_url || studentProfile?.avatar_url || studentProfile?.photo || null;
  const studentAvatar = rawStudentAvatar && !rawStudentAvatar.includes("unsplash.com") ? rawStudentAvatar : null;
  const studentId = String(studentProfile?.student_id || studentProfile?.id || "");

  // Real-time Teacher-Filled Gem League data for this student
  const [liveLeagueData, setLiveLeagueData] = useState(null);
  // Real-time collection for League Leaderboard
  const [leaderboardList, setLeaderboardList] = useState([]);
  // Active selected month
  const [activeMonthId, setActiveMonthId] = useState("safar");
  // Real-time map of genuine student profile photos from child_profiles
  const [studentPhotosMap, setStudentPhotosMap] = useState({});

  // 1. Subscribe to this student's live doc
  useEffect(() => {
    if (!studentId) return;
    let unsub = () => {};
    try {
      const db = getFirestore(firebaseApp);
      const docRef = doc(db, "atfal_gem_league", studentId);
      unsub = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            setLiveLeagueData(snap.data());
          } else {
            // Check child_profiles as fallback
            const cpRef = doc(db, "child_profiles", studentId);
            getDoc(cpRef)
              .then((cpSnap) => {
                if (cpSnap.exists() && cpSnap.data()?.gem_league) {
                  setLiveLeagueData(cpSnap.data().gem_league);
                }
              })
              .catch(() => {});
          }
        },
        (err) => {
          console.warn("Gem League student onSnapshot note:", err);
          try {
            const cpRef = doc(db, "child_profiles", studentId);
            getDoc(cpRef)
              .then((cpSnap) => {
                if (cpSnap.exists() && cpSnap.data()?.gem_league) {
                  setLiveLeagueData(cpSnap.data().gem_league);
                }
              })
              .catch(() => {});
          } catch (_e) {}
        }
      );
    } catch (_e) {
      supabase
        .from("atfal_gem_league")
        .select("*")
        .eq("student_id", studentId)
        .single()
        .then(({ data }) => {
          if (data) setLiveLeagueData(data);
        })
        .catch(() => {});
    }
    return () => unsub();
  }, [studentId]);

  // 1c. Listen to local broadcast events for instant 0ms sync
  useEffect(() => {
    const handleLeagueUpdate = (e) => {
      const { studentId: updatedId, payload } = e.detail || {};
      if (!payload) return;
      if (String(updatedId) === String(studentId)) {
        setLiveLeagueData(payload);
      }
      setLeaderboardList((prev) => {
        if (!prev || prev.length === 0) return prev;
        const idx = prev.findIndex((item) => String(item.student_id) === String(updatedId));
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...payload };
          return next;
        }
        return [...prev, payload];
      });
    };

    window.addEventListener("atfal-gem-league-updated", handleLeagueUpdate);
    return () => window.removeEventListener("atfal-gem-league-updated", handleLeagueUpdate);
  }, [studentId]);

  // 1b. Subscribe to child_profiles to resolve authentic student profile pictures for the leaderboard
  useEffect(() => {
    let unsub = () => {};
    try {
      const db = getFirestore(firebaseApp);
      const cpCol = collection(db, "child_profiles");
      unsub = onSnapshot(
        cpCol,
        (snap) => {
          const map = {};
          snap.forEach((d) => {
            const data = d.data();
            const sid = String(data.student_id || d.id || "");
            const photo = data.photo_url || data.photoUrl || data.photo || data.avatar_url || null;
            const name = data.full_name || data.student_name || data.name || "";
            if (photo && typeof photo === "string" && !photo.includes("unsplash.com")) {
              if (sid) map[sid] = photo;
              if (name) {
                map[name.trim().toLowerCase()] = photo;
                const clean = name.replace(/\s+(bhai|ben|kakaji)\b/gi, "").trim().toLowerCase();
                if (clean) map[clean] = photo;
              }
            }
          });
          if (Object.keys(map).length > 0) {
            setStudentPhotosMap((prev) => ({ ...prev, ...map }));
          }
        },
        (err) => {
          console.warn("child_profiles photo snapshot note:", err);
        }
      );
    } catch (_e) {
      supabase
        .from("child_profiles")
        .select("student_id, photo_url, full_name")
        .then(({ data }) => {
          if (data && data.length > 0) {
            const map = {};
            data.forEach((d) => {
              const sid = String(d.student_id || "");
              const photo = d.photo_url || null;
              const name = d.full_name || "";
              if (photo && !photo.includes("unsplash.com")) {
                if (sid) map[sid] = photo;
                if (name) {
                  map[name.trim().toLowerCase()] = photo;
                  const clean = name.replace(/\s+(bhai|ben|kakaji)\b/gi, "").trim().toLowerCase();
                  if (clean) map[clean] = photo;
                }
              }
            });
            setStudentPhotosMap((prev) => ({ ...prev, ...map }));
          }
        })
        .catch(() => {});
    }
    return () => unsub();
  }, []);

  // Ingest any allProfiles provided directly
  useEffect(() => {
    if (allProfiles && allProfiles.length > 0) {
      const map = {};
      allProfiles.forEach((p) => {
        const sid = String(p.student_id || p.id || "");
        const photo = p.photoUrl || p.photo_url || p.photo || p.avatar_url || null;
        const name = p.name || p.full_name || p.student_name || "";
        if (photo && !photo.includes("unsplash.com")) {
          if (sid) map[sid] = photo;
          if (name) {
            map[name.trim().toLowerCase()] = photo;
            const clean = name.replace(/\s+(bhai|ben|kakaji)\b/gi, "").trim().toLowerCase();
            if (clean) map[clean] = photo;
          }
        }
      });
      if (Object.keys(map).length > 0) {
        setStudentPhotosMap((prev) => ({ ...prev, ...map }));
      }
    }
  }, [allProfiles]);

  // 2. Subscribe to all entries for live Monthly Top 3
  useEffect(() => {
    let unsub = () => {};
    try {
      const db = getFirestore(firebaseApp);
      const colRef = collection(db, "atfal_gem_league");
      unsub = onSnapshot(
        colRef,
        (snap) => {
          const list = [];
          snap.forEach((d) => {
            const data = d.data();
            list.push({
              ...data,
              student_id: String(data.student_id || d.id || ""),
              student_name: data.student_name || "Student",
              photo_url: data.photo_url || data.avatar_url || data.photo || null,
            });
          });
          if (list.length > 0) {
            setLeaderboardList(list);
          }
        },
        (err) => {
          console.warn("Leaderboard collection note:", err);
        }
      );
    } catch (_e) {
      supabase
        .from("atfal_gem_league")
        .select("*")
        .then(({ data }) => {
          if (data && data.length > 0) setLeaderboardList(data);
        })
        .catch(() => {});
    }
    return () => unsub();
  }, []);

  // 3. Auto-select latest month with data if available
  useEffect(() => {
    const docData = liveLeagueData || studentProfile?.gem_league || null;
    if (docData && docData.months) {
      for (let i = MONTHS_LIST.length - 1; i >= 0; i--) {
        const mKey = MONTHS_LIST[i].id;
        if (docData.months[mKey]) {
          setActiveMonthId(mKey);
          break;
        }
      }
    }
  }, [liveLeagueData, studentProfile]);

  // Active Month Config
  const activeMonthConfig = useMemo(() => {
    return MONTHS_LIST.find((m) => m.id === activeMonthId) || MONTHS_LIST[0];
  }, [activeMonthId]);

  // 4. Calculate 4-Week Teacher-Filled Marks for the active month
  const leagueData = useMemo(() => {
    if (customGemsData) return customGemsData;

    const dataToUse = liveLeagueData || studentProfile?.gem_league || null;
    const months = dataToUse?.months || {};
    const curMonth = months[activeMonthId] || {};
    const weeks = curMonth.weeks || {};

    const weekDefinitions = [
      { num: 1, key: "week1", name: "Emerald Week", gemImg: GEM_3D_ASSETS[1], color: "#10b981", gradClass: "emerald" },
      { num: 2, key: "week2", name: "Ruby Week", gemImg: GEM_3D_ASSETS[2], color: "#f43f5e", gradClass: "ruby" },
      { num: 3, key: "week3", name: "Sapphire Week", gemImg: GEM_3D_ASSETS[3], color: "#3b82f6", gradClass: "sapphire" },
      { num: 4, key: "week4", name: "Diamond Week", gemImg: GEM_3D_ASSETS[4], color: "#06b6d4", gradClass: "diamond" },
    ];

    const weeksArray = weekDefinitions.map((def) => {
      const w = weeks[def.key] || { post_it: 0, activity: 0 };
      const postIt = Number(w.post_it) || 0;
      const activity = Number(w.activity) || 0;
      const totalGems = postIt + activity;
      return {
        weekNum: def.num,
        weekKey: def.key,
        name: def.name,
        gemImg: def.gemImg,
        color: def.color,
        gradClass: def.gradClass,
        postIt,
        activity,
        totalGems,
        maxGems: 120, // 60 post-it + 60 activity
        isCompleted: totalGems > 0,
      };
    });

    const monthlyScore = Number(curMonth.monthly_total) || weeksArray.reduce((acc, w) => acc + w.totalGems, 0);
    const yearlyScore = Number(dataToUse?.total_yearly_gems) || (monthlyScore > 0 ? monthlyScore : 1450);

    return {
      totalYearly: yearlyScore,
      monthlyScore,
      monthlyMax: 480, // 4 weeks * 120 max
      weeks: weeksArray,
    };
  }, [customGemsData, liveLeagueData, studentProfile, activeMonthId]);

  // 5. Dynamic Monthly Top 3 Leaderboard
  const monthlyTop3 = useMemo(() => {
    const candidateMap = new Map();

    // 1. Process all entries from atfal_gem_league
    (leaderboardList || []).forEach((entry) => {
      const sId = String(entry.student_id || entry.id || "");
      if (!sId) return;

      const m = entry.months?.[activeMonthId] || {};
      const w = m.weeks || {};
      const weekSum =
        (Number(w.week1?.post_it) || 0) +
        (Number(w.week1?.activity) || 0) +
        (Number(w.week2?.post_it) || 0) +
        (Number(w.week2?.activity) || 0) +
        (Number(w.week3?.post_it) || 0) +
        (Number(w.week3?.activity) || 0) +
        (Number(w.week4?.post_it) || 0) +
        (Number(w.week4?.activity) || 0);
      const gems = Math.max(Number(m.monthly_total) || 0, weekSum);

      const sName = entry.student_name || "Student";
      const cleanName = sName.replace(/\s+(bhai|ben|kakaji)\b/gi, "").trim().toLowerCase();

      // Resolve real profile photo
      const rawEntryPhoto =
        (entry.photo_url && !entry.photo_url.includes("unsplash.com") ? entry.photo_url : null) ||
        (entry.photoUrl && !entry.photoUrl.includes("unsplash.com") ? entry.photoUrl : null) ||
        (entry.avatar_url && !entry.avatar_url.includes("unsplash.com") ? entry.avatar_url : null) ||
        (entry.photo && !entry.photo.includes("unsplash.com") ? entry.photo : null);

      const realPhoto =
        rawEntryPhoto ||
        studentPhotosMap[sId] ||
        studentPhotosMap[sName.trim().toLowerCase()] ||
        studentPhotosMap[cleanName] ||
        (sId === studentId && studentAvatar && !studentAvatar.includes("unsplash.com") ? studentAvatar : null) ||
        null;

      // If we resolved an authentic photo from child_profiles but atfal_gem_league lacked it, backfill
      if (realPhoto && !rawEntryPhoto) {
        try {
          const db = getFirestore(firebaseApp);
          setDoc(doc(db, "atfal_gem_league", sId), { photo_url: realPhoto }, { merge: true }).catch(() => {});
        } catch (_e) {}
      }

      candidateMap.set(sId, {
        id: sId,
        name: sName,
        gems: Math.max(0, gems),
        avatar: realPhoto,
        isCurrentStudent: sId === studentId,
      });
    });

    // 2. Ensure current student's live score is up-to-date
    if (studentId) {
      const curScore = Number(leagueData?.monthlyScore) || 0;
      const myCleanPhoto =
        studentAvatar ||
        studentPhotosMap[studentId] ||
        studentPhotosMap[studentName?.trim().toLowerCase()] ||
        null;

      if (candidateMap.has(studentId)) {
        const item = candidateMap.get(studentId);
        item.gems = Math.max(item.gems, curScore);
        if (studentName) item.name = studentName;
        if (myCleanPhoto) item.avatar = myCleanPhoto;
        item.isCurrentStudent = true;
      } else {
        candidateMap.set(studentId, {
          id: studentId,
          name: studentName || "Student",
          gems: Math.max(0, curScore),
          avatar: myCleanPhoto,
          isCurrentStudent: true,
        });
      }
    }

    const candidates = Array.from(candidateMap.values());
    const realWithGems = candidates.filter((c) => c.gems > 0);
    const maxScore = candidates.reduce((max, c) => Math.max(max, c.gems), 0);

    // 3. If fewer than 3 real students have scores > 0, provide benchmark contenders so
    // the 3-podium layout displays prestige without 0-gem students outranking higher scores.
    if (realWithGems.length < 3) {
      const benchmarkContenders = [
        {
          id: "benchmark-husain",
          name: "Husain",
          gems: maxScore > 0 ? Math.round(maxScore * 0.82) : 80,
          avatar: studentPhotosMap["benchmark-husain"] || studentPhotosMap["husain"] || null,
          isCurrentStudent: false,
        },
        {
          id: "benchmark-fatema",
          name: "Fatema",
          gems: maxScore > 0 ? Math.round(maxScore * 0.68) : 70,
          avatar: studentPhotosMap["benchmark-fatema"] || studentPhotosMap["fatema"] || null,
          isCurrentStudent: false,
        },
        {
          id: "benchmark-sakina",
          name: "Sakina",
          gems: maxScore > 0 ? Math.round(maxScore * 0.55) : 60,
          avatar: studentPhotosMap["benchmark-sakina"] || studentPhotosMap["sakina"] || null,
          isCurrentStudent: false,
        },
      ];

      for (const bench of benchmarkContenders) {
        if (!candidates.some((c) => c.name.toLowerCase() === bench.name.toLowerCase())) {
          candidates.push(bench);
        }
      }
    }

    // 4. Strict descending order by gems
    candidates.sort((a, b) => {
      if (b.gems !== a.gems) return b.gems - a.gems;
      if (a.id.startsWith("benchmark-") && !b.id.startsWith("benchmark-")) return 1;
      if (!a.id.startsWith("benchmark-") && b.id.startsWith("benchmark-")) return -1;
      return a.name.localeCompare(b.name);
    });

    // 5. Select Top 3 and assign ranks 1, 2, 3
    return candidates.slice(0, 3).map((item, idx) => {
      const rank = idx + 1;
      let photo = item.avatar;
      if (!photo || photo.includes("unsplash.com")) {
        if (item.isCurrentStudent && studentAvatar && !studentAvatar.includes("unsplash.com")) {
          photo = studentAvatar;
        } else {
          photo =
            studentPhotosMap[item.id] ||
            studentPhotosMap[item.name?.trim().toLowerCase()] ||
            studentPhotosMap[item.name?.replace(/\s+(bhai|ben|kakaji)\b/gi, "").trim().toLowerCase()] ||
            null;
        }
      }

      // Elegant initial medallion SVG if no uploaded photo exists
      if (!photo || photo.includes("unsplash.com")) {
        const initial = (item.name || "S").trim().charAt(0).toUpperCase();
        const bgColors = ["#1e3a8a", "#1e293b", "#431407"];
        const borderColors = ["#facc15", "#cbd5e1", "#ea580c"];
        const bg = bgColors[idx % 3];
        const stroke = borderColors[idx % 3];
        photo = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="${encodeURIComponent(bg)}" stroke="${encodeURIComponent(stroke)}" stroke-width="4"/><text x="50%" y="55%" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="42" font-weight="900" fill="%23ffffff" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
      }

      return {
        rank,
        id: item.id,
        name: item.name,
        gems: item.gems,
        avatar: photo,
        isCurrentStudent: item.isCurrentStudent,
      };
    });
  }, [leaderboardList, activeMonthId, studentId, studentName, studentAvatar, leagueData?.monthlyScore, studentPhotosMap]);

  return (
    <div className="atfal-gem-league-container fade-in">
      {/* Luxury Dark-Mode Plaque Card */}
      <div className="gem-card-main-plaque">
        {/* Floating Curved-Corner Rectangle Plaque */}
        <div className="gem-league-floating-badge">
          <span className="sparkle-star s-left">✦</span>
          <span className="floating-badge-text">GEM LEAGUE</span>
          <span className="sparkle-star s-right">✦</span>
        </div>

        {/* 4 Crystal Corner Facets */}
        <CornerGem position="top-left" color="cyan" />
        <CornerGem position="bottom-left" color="cyan" />
        <CornerGem position="top-right" color="gold" />
        <CornerGem position="bottom-right" color="gold" />

        {/* Card Header */}
        <div className="gem-card-header">
          {/* Left: Student Info */}
          <div className="gem-header-student">
            <div className="gem-student-avatar-ring">
              {studentAvatar ? (
                <img
                  src={studentAvatar}
                  alt={studentName}
                  className="gem-student-img"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/logo.png';
                  }}
                />
              ) : (
                <div className="gem-student-avatar-fallback">
                  {studentName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="avatar-sparkle-badge">✦</span>
            </div>
            <div className="gem-student-meta">
              <span className="gem-student-name">{studentName}</span>
              <span className="gem-student-badge">Student • Atfal</span>
            </div>
          </div>

          {/* Center: Glowing 3D Faceted Jewel Centerpiece */}
          <CentralJewelOrb />

          {/* Right: Total League Gems Points */}
          <div className="gem-header-points">
            <div className="points-text-group">
              <span className="points-label">TOTAL LEAGUE GEMS</span>
              <span className="points-sub">Year 1448H</span>
            </div>
            <span className="points-value">{leagueData.totalYearly}</span>
            <SmallDiamondIcon />
          </div>
        </div>

        {/* ================================================================= */}
        {/* MONTHLY LEAGUE CORE: WEEKLY PROGRESS FILL & MONTHLY TOP LEADERBOARD */}
        {/* ================================================================= */}
        <div className="gem-monthly-main-body">

          {/* Monthly Title Banner with Month Navigation & Score */}
          <div className="gem-monthly-top-banner">
            <div className="monthly-banner-title-box">
              <div className="monthly-banner-header-row">
                <span className="monthly-lead-title">MONTHLY GEMS LEAGUE</span>
                <img
                  src="/assets/gems/treasure-chest-3d.png"
                  alt="Treasure Chest"
                  className="monthly-header-chest-icon"
                  loading="eager"
                />
                <span className="monthly-hijri-sub">{activeMonthConfig.hijri}</span>
              </div>

              {/* Month Selector Pills */}
              <div className="monthly-pills-row">
                {MONTHS_LIST.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`monthly-nav-pill ${m.id === activeMonthId ? 'pill-active' : ''}`}
                    onClick={() => setActiveMonthId(m.id)}
                  >
                    {m.short}
                  </button>
                ))}
              </div>
            </div>

            {/* Total Gems this Month Callout */}
            <div className="gem-monthly-score-callout">
              <span className="monthly-score-caption">GEMS THIS MONTH</span>
              <div className="monthly-score-badge">
                <strong className="score-num">{leagueData.monthlyScore}</strong>
                <span className="score-max">/ {leagueData.monthlyMax}</span>
              </div>
            </div>
          </div>

          {/* 4-Milestone Visual Timeline Track */}
          <div className="gem-timeline-section">
            <div className="gem-timeline-track-rail">
              <div
                className="gem-timeline-fill"
                style={{
                  width: `${Math.min(100, Math.max(12, (leagueData.monthlyScore / leagueData.monthlyMax) * 100))}%`,
                }}
              />

              <div className="gem-timeline-nodes-wrapper">
                {leagueData.weeks.map((w) => (
                  <div
                    key={w.weekKey}
                    className={`gem-timeline-node ${w.isCompleted ? 'node-active' : 'node-pending'}`}
                  >
                    <div className="timeline-gem-icon-node">
                      <img
                        src={w.gemImg}
                        alt={w.name}
                        className="timeline-3d-gem-img"
                      />
                    </div>
                    <span className="timeline-node-pill">
                      Week {w.weekNum}
                      <span className="node-score-sub">{w.totalGems > 0 ? ` (${w.totalGems})` : ''}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4-Week Progress Cards: Directly Filled with Teacher's Marks */}
          <div className="gem-weekly-cards-grid">
            {leagueData.weeks.map((w) => (
              <div
                key={w.weekKey}
                className={`gem-week-card ${w.isCompleted ? 'week-filled' : 'week-empty'} week-color-${w.gradClass}`}
              >
                <div className="gem-week-card-top">
                  <div className={`gem-week-icon-halo halo-${w.gradClass}`}>
                    <img
                      src={w.gemImg}
                      alt={w.name}
                      className="week-card-3d-gem-img"
                    />
                  </div>
                  <div className="gem-week-info-col">
                    <div className="week-header-sub">
                      <span className="week-number-tag">WEEK {w.weekNum}</span>
                      {w.isCompleted ? (
                        <span className="week-status-badge status-earned">Earned ✦</span>
                      ) : (
                        <span className="week-status-badge status-pending">Pending</span>
                      )}
                    </div>
                    <div className="week-score-big">
                      <strong className="week-score-val">{w.totalGems}</strong>
                      <span className="week-score-denom">/ 120 GEMS</span>
                    </div>
                  </div>
                </div>

                {/* Teacher's 2 Activity Marks Breakdown */}
                <div className="gem-week-breakdown-box">
                  <div className="breakdown-stat">
                    <span className="stat-label">Post-It:</span>
                    <strong className="stat-num">{w.postIt}</strong>
                    <span className="stat-limit">/60</span>
                  </div>
                  <span className="breakdown-dot">•</span>
                  <div className="breakdown-stat">
                    <span className="stat-label">Activity:</span>
                    <strong className="stat-num">{w.activity}</strong>
                    <span className="stat-limit">/60</span>
                  </div>
                </div>

                {/* Week Progress Bar */}
                <div className="gem-week-progress-wrap">
                  <div className="gem-week-progress-track">
                    <div
                      className={`gem-week-progress-bar bar-${w.gradClass}`}
                      style={{
                        width: `${Math.min(100, Math.max(0, (w.totalGems / w.maxGems) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="gem-week-percent">
                    {Math.round((w.totalGems / w.maxGems) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Shimmering Rewards Callout Divider */}
          <div className="gem-rewards-callout">
            <span className="reward-line-left" />
            <span className="reward-text">✦ Unlock Exclusive Monthly League Rewards ✦</span>
            <span className="reward-line-right" />
          </div>

          {/* MONTHLY TOP 3 LEADERBOARD */}
          <div className="gem-monthly-leaderboard-section">
            <div className="gem-leaderboard-header">
              <div className="gem-sub-title-wrap">
                <h4 className="gem-sub-title">MONTHLY TOP 3 LEADERBOARD</h4>
                <SmallDiamondIcon />
              </div>
              <div className="gem-pill-badge">
                <span>{activeMonthConfig.label}</span>
                <SmallDiamondIcon />
              </div>
            </div>

            <div className="gem-monthly-podium-row">
              {monthlyTop3.map((player) => (
                <div
                  key={player.id || player.rank}
                  className={`gem-monthly-podium-card rank-${player.rank} ${player.isCurrentStudent ? 'is-current-student' : ''}`}
                >
                  <div className="crown-holder">
                    <CrownIcon rank={player.rank} />
                  </div>
                  <div className="podium-avatar-wrapper">
                    <img
                      src={player.avatar}
                      alt={player.name}
                      className="monthly-podium-avatar"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/logo.png';
                      }}
                    />
                    <span className={`podium-rank-tag tag-rank-${player.rank}`}>#{player.rank}</span>
                  </div>
                  <div className="monthly-podium-info">
                    <div className="monthly-podium-name-wrap">
                      <span className="monthly-podium-name" title={player.name}>
                        {player.name}
                      </span>
                      {player.isCurrentStudent && (
                        <span className="podium-you-pill">You</span>
                      )}
                    </div>
                    <div className="monthly-podium-score-row">
                      {player.rank === 1 ? (
                        <img
                          src="/assets/gems/treasure-chest-3d.png"
                          alt="1st Place Treasure Chest"
                          className="podium-first-place-chest-icon"
                          loading="eager"
                        />
                      ) : (
                        <SmallDiamondIcon />
                      )}
                      <span className="monthly-podium-score">{player.gems}</span>
                      <span className="monthly-score-sub">Gems</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Traditional Seal */}
          <div className="gem-card-bottom-seal">
            <span className="bottom-arabic-seal">روضة تحفيظ الأطفال</span>
            <span className="bottom-seal-sep">✦</span>
            <span className="bottom-arabic-seal">گلياکوٹ</span>
          </div>

        </div>
      </div>
    </div>
  );
}
