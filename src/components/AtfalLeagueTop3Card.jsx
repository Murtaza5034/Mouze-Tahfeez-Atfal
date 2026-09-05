import React, { useState, useEffect, useMemo, useRef } from "react";
import "./AtfalLeagueTop3Card.css";
import { supabase } from "../supabaseClient";
import { firebaseApp } from "../firebase/config";
import { collection, onSnapshot, getFirestore } from "firebase/firestore";
import {
  Download,
  Calendar,
  Sparkles,
  Trophy,
  Award,
  Check,
  User
} from "lucide-react";
import { reshapeArabic } from "../utils/arabicReshaper";

// Islamic Months Configuration (Matching Hifz League Official PDF)
const MONTHS_CONFIG = [
  { id: "safar", nameEn: "Safar al-Muzaffar", nameAr: "شهر صفر المظفر", pageRange: "16 - 29", color: "#10b981" },
  { id: "rabi1", nameEn: "Rabi al-Awwal", nameAr: "شهر ربيع الاول", pageRange: "1 - 30", color: "#06b6d4" },
  { id: "rabi2", nameEn: "Rabi al-Aakhar", nameAr: "شهر ربيع الآخر", pageRange: "1 - 29", color: "#8b5cf6" },
  { id: "jumada1", nameEn: "Jumada al-Ula", nameAr: "شهر جمادى الاولى", pageRange: "1 - 30", color: "#3b82f6" },
  { id: "jumada2", nameEn: "Jumada al-Ukhra", nameAr: "شهر جمادى الاخرى", pageRange: "16 - 29", color: "#ec4899" },
  { id: "rajab", nameEn: "Rajab al-Asab", nameAr: "شهر رجب الاصب", pageRange: "1 - 15", color: "#f59e0b" },
];

// Ornate Crown SVGs for Top 3 Podiums
const RoyalCrown = ({ rank }) => {
  if (rank === 1) {
    return (
      <svg className="league-crown-svg gold-crown" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 26H44V29C44 30.1 43.1 31 42 31H6C4.9 31 4 30.1 4 29V26Z" fill="#d97706" />
        <path d="M4 25L10 11L18 20L24 4L30 20L38 11L44 25H4Z" fill="url(#goldCrownGrad)" stroke="#b45309" strokeWidth="1.2" />
        <circle cx="24" cy="4" r="3" fill="#fde047" stroke="#b45309" strokeWidth="1" />
        <circle cx="10" cy="11" r="2.5" fill="#fde047" stroke="#b45309" strokeWidth="1" />
        <circle cx="38" cy="11" r="2.5" fill="#fde047" stroke="#b45309" strokeWidth="1" />
        <circle cx="24" cy="18" r="2.2" fill="#10b981" filter="drop-shadow(0 0 3px #34d399)" />
        <defs>
          <linearGradient id="goldCrownGrad" x1="4" y1="4" x2="44" y2="31" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="35%" stopColor="#facc15" />
            <stop offset="70%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (rank === 2) {
    return (
      <svg className="league-crown-svg silver-crown" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 26H44V29C44 30.1 43.1 31 42 31H6C4.9 31 4 30.1 4 29V26Z" fill="#64748b" />
        <path d="M4 25L10 12L18 19L24 6L30 19L38 12L44 25H4Z" fill="url(#silverCrownGrad)" stroke="#475569" strokeWidth="1.2" />
        <circle cx="24" cy="6" r="2.8" fill="#f8fafc" stroke="#475569" strokeWidth="1" />
        <circle cx="10" cy="12" r="2.2" fill="#f8fafc" stroke="#475569" strokeWidth="1" />
        <circle cx="38" cy="12" r="2.2" fill="#f8fafc" stroke="#475569" strokeWidth="1" />
        <circle cx="24" cy="18" r="2" fill="#f43f5e" filter="drop-shadow(0 0 3px #fb7185)" />
        <defs>
          <linearGradient id="silverCrownGrad" x1="4" y1="6" x2="44" y2="31" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#e2e8f0" />
            <stop offset="70%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  return (
    <svg className="league-crown-svg bronze-crown" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 26H44V29C44 30.1 43.1 31 42 31H6C4.9 31 4 30.1 4 29V26Z" fill="#78350f" />
      <path d="M4 25L10 13L18 19L24 7L30 19L38 13L44 25H4Z" fill="url(#bronzeCrownGrad)" stroke="#78350f" strokeWidth="1.2" />
      <circle cx="24" cy="7" r="2.6" fill="#fed7aa" stroke="#78350f" strokeWidth="1" />
      <circle cx="10" cy="13" r="2" fill="#fed7aa" stroke="#78350f" strokeWidth="1" />
      <circle cx="38" cy="13" r="2" fill="#fed7aa" stroke="#78350f" strokeWidth="1" />
      <circle cx="24" cy="18" r="1.8" fill="#38bdf8" filter="drop-shadow(0 0 3px #38bdf8)" />
      <defs>
        <linearGradient id="bronzeCrownGrad" x1="4" y1="7" x2="44" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffedd5" />
          <stop offset="35%" stopColor="#fb923c" />
          <stop offset="70%" stopColor="#c2410c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default function AtfalLeagueTop3Card({
  isAdmin = false,
  isTeacher = false,
  showDownload = false,
  isDarkMode = false
}) {
  const [selectedMonthId, setSelectedMonthId] = useState("safar");
  const [leagueEntries, setLeagueEntries] = useState([]);
  const [studentPhotosMap, setStudentPhotosMap] = useState({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);

  const cardCaptureRef = useRef(null);

  // 1. Subscribe to all entries in atfal_gem_league in real-time
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
              photo_url: data.photo_url || data.photoUrl || data.avatar_url || null,
            });
          });
          setLeagueEntries(list);
        },
        (err) => {
          console.warn("Top 3 League Firestore note:", err);
          supabase
            .from("atfal_gem_league")
            .select("*")
            .then(({ data }) => {
              if (data && data.length > 0) setLeagueEntries(data);
            })
            .catch(() => {});
        }
      );
    } catch (_e) {
      supabase
        .from("atfal_gem_league")
        .select("*")
        .then(({ data }) => {
          if (data && data.length > 0) setLeagueEntries(data);
        })
        .catch(() => {});
    }
    return () => unsub();
  }, []);

  // 2. Resolve authentic student photos from child_profiles
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
            const sid = String(data.student_id || d.id || "").trim();
            const name = (data.full_name || data.student_name || data.name || "").trim().toLowerCase();
            const photo = data.photo_url || data.photoUrl || data.avatar_url || data.photo || null;
            if (photo && !photo.includes("unsplash.com")) {
              if (sid) map[sid] = photo;
              if (name) map[name] = photo;
            }
          });
          setStudentPhotosMap(map);
        },
        () => {
          supabase
            .from("child_profiles")
            .select("student_id, full_name, photo_url")
            .then(({ data }) => {
              if (data) {
                const map = {};
                data.forEach((st) => {
                  const sid = String(st.student_id || "").trim();
                  const name = (st.full_name || "").trim().toLowerCase();
                  if (st.photo_url) {
                    if (sid) map[sid] = st.photo_url;
                    if (name) map[name] = st.photo_url;
                  }
                });
                setStudentPhotosMap(map);
              }
            })
            .catch(() => {});
        }
      );
    } catch (_e) {}
    return () => unsub();
  }, []);

  // 3. Instant local broadcast update listener (0ms reflection when teacher saves)
  useEffect(() => {
    const handleUpdate = (e) => {
      const { studentId, payload } = e.detail || {};
      if (!studentId || !payload) return;
      setLeagueEntries((prev) => {
        const idx = prev.findIndex((item) => String(item.student_id) === String(studentId));
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...payload };
          return next;
        }
        return [...prev, payload];
      });
    };
    window.addEventListener("atfal-gem-league-updated", handleUpdate);
    return () => window.removeEventListener("atfal-gem-league-updated", handleUpdate);
  }, []);

  // 4. Calculate Top 3 for the currently selected month
  const currentMonthConfig = useMemo(() => {
    return MONTHS_CONFIG.find((m) => m.id === selectedMonthId) || MONTHS_CONFIG[0];
  }, [selectedMonthId]);

  const top3Players = useMemo(() => {
    const studentScores = [];

    (leagueEntries || []).forEach((entry) => {
      const sId = String(entry.student_id || "");
      if (!sId) return;

      const m = entry.months?.[selectedMonthId] || {};
      const weeks = m.weeks || {};

      let sum = 0;
      ["week1", "week2", "week3", "week4"].forEach((wk) => {
        const w = weeks[wk] || { post_it: 0, activity: 0 };
        sum += (Number(w.post_it) || 0) + (Number(w.activity) || 0);
      });

      const totalMonthlyGems = Math.max(Number(m.monthly_total) || 0, sum);
      const fullName = entry.student_name || "Student";
      const cleanName = fullName.replace(/\s+(bhai|ben|kakaji)\b/gi, "").trim().toLowerCase();

      const photo =
        (entry.photo_url && !entry.photo_url.includes("unsplash.com") ? entry.photo_url : null) ||
        studentPhotosMap[sId] ||
        studentPhotosMap[fullName.trim().toLowerCase()] ||
        studentPhotosMap[cleanName] ||
        null;

      studentScores.push({
        id: sId,
        name: fullName,
        group: entry.group_name || entry.group || "Atfal",
        its: entry.its_id || entry.its || "",
        gems: totalMonthlyGems,
        photo: photo,
      });
    });

    // Sort descending by gems
    studentScores.sort((a, b) => {
      if (b.gems !== a.gems) return b.gems - a.gems;
      return a.name.localeCompare(b.name);
    });

    const realScored = studentScores.filter((s) => s.gems > 0);

    // If real students exist with gems, take top 3
    const result = (realScored.length >= 3 ? realScored : studentScores).slice(0, 3);

    // Map into Rank 1, 2, 3
    return result.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [leagueEntries, selectedMonthId, studentPhotosMap]);

  // Order for podium display: [Rank 2 (Left), Rank 1 (Center), Rank 3 (Right)]
  const podiumOrder = useMemo(() => {
    const r1 = top3Players.find((p) => p.rank === 1);
    const r2 = top3Players.find((p) => p.rank === 2);
    const r3 = top3Players.find((p) => p.rank === 3);
    return [r2, r1, r3].filter(Boolean);
  }, [top3Players]);

  // 5. Download Card in Full A4 Landscape Canvas
  const handleDownloadA4Landscape = async () => {
    if (!cardCaptureRef.current || isDownloading) return;
    setIsDownloading(true);

    try {
      const html2canvasModule = await import("html2canvas");
      const html2canvas = html2canvasModule.default || html2canvasModule;

      const targetEl = cardCaptureRef.current;

      // Ensure local/system fonts are loaded in window before capture
      try {
        await Promise.race([
          document.fonts ? document.fonts.ready : Promise.resolve(),
          new Promise((r) => setTimeout(r, 1200)),
        ]);
      } catch (_) {}

      // Capture options for full A4 landscape fit (297 : 210 ratio) with high DPI and zero white margins
      const canvas = await html2canvas(targetEl, {
        scale: 2.0,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#fcf8ef",
        width: 1188,
        height: 840,
        windowWidth: 1188,
        windowHeight: 840,
        logging: false,
        onclone: async (clonedDoc) => {
          // 1. Inject @font-face and exact A4 landscape rules into cloned document
          const fontStyle = clonedDoc.createElement('style');
          fontStyle.textContent = `
            @font-face {
              font-family: 'Kanz al Marjaan';
              src: url('/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.woff2') format('woff2'),
                   url('/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.woff') format('woff'),
                   url('/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.ttf') format('truetype');
              font-weight: normal;
              font-style: normal;
            }
            @font-face {
              font-family: 'Al-Kanz';
              src: url('/fonts/al-kanz.ttf') format('truetype');
              font-weight: normal;
              font-style: normal;
            }
            .league-top3-capture-box {
              width: 1188px !important;
              height: 840px !important;
              min-height: 840px !important;
              max-height: 840px !important;
              border-radius: 0px !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 24px 38px 18px !important;
              box-sizing: border-box !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              background: radial-gradient(circle at 50% 18%, #ffffff 0%, #fdfaf3 45%, #f6edd9 100%) !important;
              overflow: hidden !important;
            }
            .top3-parchment-header {
              margin-bottom: 10px !important;
            }
            .top3-arabic-title, .top3-ribbon-ar, .podium-ar-rank, .stamp-ar {
              font-family: 'Kanz al Marjaan', 'Al-Kanz', 'Amiri', serif !important;
              letter-spacing: 0 !important;
            }
            .top3-arabic-title {
              font-size: 1.6rem !important;
              margin: 0 0 4px !important;
            }
            .top3-league-title {
              background: none !important;
              -webkit-background-clip: initial !important;
              -webkit-text-fill-color: #78350f !important;
              color: #78350f !important;
              margin: 0 0 6px !important;
              font-size: 1.85rem !important;
              text-shadow: 0 1px 2px rgba(180, 83, 9, 0.15) !important;
            }
            .top3-month-ribbon {
              margin-bottom: 6px !important;
              padding: 4px 22px !important;
            }
            .top3-podium-container {
              display: flex !important;
              align-items: flex-end !important;
              justify-content: center !important;
              gap: 24px !important;
              margin-bottom: 6px !important;
              flex: 1 !important;
            }
            .top3-player-card {
              max-width: 320px !important;
              flex: 1 !important;
              box-sizing: border-box !important;
            }
            .top3-player-card.rank-gold {
              height: 440px !important;
              min-height: 440px !important;
              max-height: 440px !important;
            }
            .top3-player-card.rank-silver, .top3-player-card.rank-bronze {
              height: 405px !important;
              min-height: 405px !important;
              max-height: 405px !important;
            }
            .top3-card-footer {
              margin-top: 4px !important;
              padding-top: 6px !important;
            }
          `;
          clonedDoc.head.appendChild(fontStyle);

          // 2. Reshape all Arabic texts for canvas rendering so ligatures are 100% connected
          const reshapeSelectors = [
            ".top3-arabic-title",
            ".top3-ribbon-ar",
            ".podium-ar-rank",
            ".stamp-ar"
          ];
          reshapeSelectors.forEach((sel) => {
            clonedDoc.querySelectorAll(sel).forEach((el) => {
              if (el && el.textContent) {
                el.textContent = reshapeArabic(el.textContent);
              }
            });
          });

          // Wait for fonts to be ready in clone
          try {
            await Promise.race([
              clonedDoc.fonts ? clonedDoc.fonts.ready : Promise.resolve(),
              new Promise((r) => setTimeout(r, 2000)),
            ]);
          } catch (_) {}
        },
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const downloadLink = document.createElement("a");
      const cleanMonth = currentMonthConfig.nameEn.replace(/\s+/g, "_");
      downloadLink.download = `Hifz_League_Top3_${cleanMonth}_1448H.png`;
      downloadLink.href = imgData;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setIsDownloading(false);
      setDownloadDone(true);
      setTimeout(() => setDownloadDone(false), 3000);
    } catch (err) {
      console.error("A4 Landscape Download error:", err);
      setIsDownloading(false);
    }
  };

  return (
    <div className={`atfal-league-top3-root card-appear ${isDarkMode ? "dark-theme" : ""}`}>
      {/* ----------------------------------------------------------------- */}
      {/* CARD TOP TOOLBAR: MONTH TABS & OPTIONAL ADMIN A4 DOWNLOAD */}
      {/* ----------------------------------------------------------------- */}
      <div className="top3-toolbar">
        <div className="top3-title-wrap">
          <div className="top3-trophy-badge">
            <Trophy size={18} />
          </div>
          <div>
            <h3 className="top3-heading">Hifz League Monthly Top 3</h3>
            <span className="top3-subheading">
              روضة تحفيظ الأطفال - {currentMonthConfig.nameAr}
            </span>
          </div>
        </div>

        <div className="top3-actions">
          {/* Month Selector Pills */}
          <div className="top3-month-pills">
            {MONTHS_CONFIG.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`top3-month-btn ${selectedMonthId === m.id ? "active" : ""}`}
                onClick={() => setSelectedMonthId(m.id)}
              >
                <span>{m.nameAr.replace("شهر ", "")}</span>
              </button>
            ))}
          </div>

          {/* Admin A4 Landscape Download Button */}
          {showDownload && (
            <button
              type="button"
              className={`top3-download-btn ${downloadDone ? "done" : ""}`}
              onClick={handleDownloadA4Landscape}
              disabled={isDownloading}
              title="Download full A4 Landscape printable card (No white borders)"
            >
              {isDownloading ? (
                <>
                  <span className="download-spinner-mini" /> Generating A4...
                </>
              ) : downloadDone ? (
                <>
                  <Check size={16} /> A4 Downloaded!
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Download A4 Sheet</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* MAIN TOP 3 PARCHMENT CARD (TARGET FOR A4 LANDSCAPE CAPTURE) */}
      {/* ----------------------------------------------------------------- */}
      <div className="league-top3-capture-box" ref={cardCaptureRef}>
        {/* Ornate Corner Accents */}
        <div className="top3-corner c-tl" />
        <div className="top3-corner c-tr" />
        <div className="top3-corner c-bl" />
        <div className="top3-corner c-br" />

        {/* Grand Authentic Header */}
        <div className="top3-parchment-header">
          <h2 className="top3-arabic-title">روضة تحفيظ الأطفال - گلياکوٹ</h2>
          <h1 className="top3-league-title">HIFZ LEAGUE 1448H</h1>
          <div className="top3-month-ribbon">
            <span className="top3-ribbon-ar">{currentMonthConfig.nameAr}</span>
            <span className="top3-ribbon-dot">•</span>
            <span className="top3-ribbon-en">{currentMonthConfig.nameEn}</span>
          </div>
          <span className="top3-subtitle-tag">MONTHLY TOP 3 ACHIEVERS</span>
        </div>

        {/* 3 ROYAL PODIUMS */}
        <div className="top3-podium-container">
          {podiumOrder.length === 0 ? (
            <div className="top3-empty-state">
              <Sparkles size={32} style={{ color: "var(--primary-gold)", opacity: 0.5, marginBottom: 8 }} />
              <p>No gem entries recorded yet for {currentMonthConfig.nameEn}.</p>
            </div>
          ) : (
            podiumOrder.map((student) => {
              const isFirst = student.rank === 1;
              const isSecond = student.rank === 2;
              const isThird = student.rank === 3;

              const rankClass = isFirst ? "rank-gold" : isSecond ? "rank-silver" : "rank-bronze";
              const rankGem = isFirst
                ? "/assets/gems/gem-week1-emerald.png"
                : isSecond
                ? "/assets/gems/gem-week2-ruby.png"
                : "/assets/gems/gem-week3-sapphire.png";

              const gemName = isFirst ? "Emerald" : isSecond ? "Heart Ruby" : "Royal Sapphire";

              return (
                <div key={student.id || student.rank} className={`top3-player-card ${rankClass}`}>
                  {/* Ornate Crown Over Avatar */}
                  <div className="top3-crown-slot">
                    <RoyalCrown rank={student.rank} />
                  </div>

                  {/* Profile Picture Frame */}
                  <div className="top3-avatar-halo">
                    {student.photo ? (
                      <img
                        src={student.photo}
                        alt={student.name}
                        className="top3-player-photo"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/logo.png";
                        }}
                      />
                    ) : (
                      <div className="top3-photo-fallback">
                        <User size={38} />
                      </div>
                    )}
                    <span className="top3-rank-pill">#{student.rank}</span>
                  </div>

                  {/* Student Full Name & Info */}
                  <div className="top3-player-details">
                    <h3 className="top3-full-name">{student.name}</h3>
                    <div className="top3-meta-row">
                      {student.group && <span className="top3-group-tag">{student.group}</span>}
                      {student.its && <span className="top3-its-tag">ITS: {student.its}</span>}
                    </div>
                  </div>

                  {/* Gem Score Hero Display */}
                  <div className="top3-score-banner">
                    <img src={rankGem} alt={gemName} className="top3-gem-icon" />
                    <div className="top3-score-text">
                      <strong className="top3-gems-num">{student.gems}</strong>
                      <span className="top3-gems-label">GEMS</span>
                    </div>
                  </div>

                  {/* Authentic Podium Base */}
                  <div className="top3-podium-base">
                    <span className="podium-rank-text">
                      {isFirst ? "1ST PLACE" : isSecond ? "2ND PLACE" : "3RD PLACE"}
                    </span>
                    <span className="podium-ar-rank">
                      {isFirst ? "المرتبة الأولى" : isSecond ? "المرتبة الثانية" : "المرتبة الثالثة"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Authentic Official Seal at Bottom */}
        <div className="top3-card-footer">
          <div className="top3-official-stamp">
            <span className="stamp-ar">روضة تحفيظ الأطفال • گلياکوٹ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
