import React, { useState, useEffect, useMemo } from "react";
import "./AtfalLeagueAdminInfographic.css";
import { supabase } from "../supabaseClient";
import { firebaseApp } from "../firebase/config";
import { collection, onSnapshot, getFirestore } from "firebase/firestore";
import {
  Calendar,
  Sparkles,
  Trophy,
  CheckCircle2,
  Clock,
  Search,
  Users,
  Filter,
  ArrowUpDown,
  ChevronRight,
  Award,
  AlertCircle,
  Gem,
  BookOpen
} from "lucide-react";
import {
  MONTHS_CONFIG,
  calculateStudentMonthlyGems,
  getMonthlyTop3
} from "../utils/atfalLeagueUtils";

export default function AtfalLeagueAdminInfographic({
  students = [],
  isDarkMode = false,
}) {
  const [selectedMonthId, setSelectedMonthId] = useState("safar");
  const [leagueEntries, setLeagueEntries] = useState([]);
  const [childProfilesMap, setChildProfilesMap] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'filled' | 'pending' | 'top'
  const [sortBy, setSortBy] = useState("gems-desc"); // 'gems-desc' | 'gems-asc' | 'name'

  // 1. Subscribe in real-time to atfal_gem_league in Firestore
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
              student_id: String(data.student_id || d.id || "").trim(),
              student_name: data.student_name || "Student",
              photo_url: data.photo_url || data.photoUrl || data.avatar_url || null,
            });
          });
          setLeagueEntries(list);
        },
        (err) => {
          console.warn("Admin Infographic Firestore note:", err);
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

  // 2. Subscribe to child_profiles to resolve authentic profile pictures and fallback gem_league docs
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
            if (sid) {
              map[sid] = {
                photo: data.photo_url || data.photoUrl || data.avatar_url || data.photo || null,
                gem_league: data.gem_league || null,
                full_name: data.full_name || data.name || data.student_name || null,
              };
            }
          });
          setChildProfilesMap(map);
        },
        () => {
          supabase
            .from("child_profiles")
            .select("student_id, photo_url, full_name, gem_league")
            .then(({ data }) => {
              if (data) {
                const map = {};
                data.forEach((d) => {
                  const sid = String(d.student_id || "").trim();
                  if (sid) {
                    map[sid] = {
                      photo: d.photo_url || null,
                      gem_league: d.gem_league || null,
                      full_name: d.full_name || null,
                    };
                  }
                });
                setChildProfilesMap(map);
              }
            })
            .catch(() => {});
        }
      );
    } catch (_e) {}
    return () => unsub();
  }, []);

  // 3. Listen to local broadcast updates for 0ms reflection when teacher saves
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

  // 4. Determine list of effective Atfal students
  const effectiveAtfalStudents = useMemo(() => {
    // If students passed from AdminApp, use them; filter out Kibar if marked
    const source = (students && students.length > 0) ? students : leagueEntries;
    const map = new Map();

    source.forEach((st) => {
      const sid = String(st.student_id || st.id || "").trim();
      if (!sid || sid.startsWith("benchmark-")) return;

      const groupName = st.group_name || st.group || "Atfal";
      // Skip strictly Kibar students if explicitly marked
      if (typeof groupName === "string" && groupName.toLowerCase().includes("kibar")) {
        return;
      }

      const name = st.name || st.student_name || st.full_name || "Student";
      const cleanPhoto =
        st.photo_url ||
        st.photoUrl ||
        st.avatar_url ||
        childProfilesMap[sid]?.photo ||
        null;

      map.set(sid, {
        id: sid,
        name,
        group: groupName,
        its: st.its_id || st.its || "",
        teacherName: st.teacher_name || st.teacherName || "Muhaffiz",
        photo: (cleanPhoto && !cleanPhoto.includes("unsplash.com")) ? cleanPhoto : null,
      });
    });

    // Also include any students present in leagueEntries that weren't in students prop
    leagueEntries.forEach((entry) => {
      const sid = String(entry.student_id || entry.id || "").trim();
      if (!sid || map.has(sid) || sid.startsWith("benchmark-")) return;
      map.set(sid, {
        id: sid,
        name: entry.student_name || "Student",
        group: entry.group_name || entry.group || "Atfal",
        its: entry.its_id || entry.its || "",
        teacherName: entry.teacher_name || "Muhaffiz",
        photo: entry.photo_url || childProfilesMap[sid]?.photo || null,
      });
    });

    return Array.from(map.values());
  }, [students, leagueEntries, childProfilesMap]);

  // 5. Month-Wise Completion Infographic Matrix (Calculated for all 6 Islamic Months)
  const monthWiseInfographics = useMemo(() => {
    const totalStudentsCount = effectiveAtfalStudents.length || 1;

    return MONTHS_CONFIG.map((month) => {
      let filledCount = 0;
      let totalGemsInMonth = 0;
      let topScorer = null;
      let highestGems = -1;

      effectiveAtfalStudents.forEach((student) => {
        // Find league doc
        const entry =
          leagueEntries.find((e) => String(e.student_id) === String(student.id)) ||
          childProfilesMap[student.id]?.gem_league ||
          null;

        const mData = entry?.months?.[month.id] || null;
        const calc = calculateStudentMonthlyGems(mData);

        if (calc.isFilled) {
          filledCount++;
        }
        totalGemsInMonth += calc.totalGems;

        if (calc.totalGems > highestGems && calc.totalGems > 0) {
          highestGems = calc.totalGems;
          topScorer = {
            name: student.name,
            gems: calc.totalGems,
            photo: student.photo,
          };
        }
      });

      const completionPct = Math.round((filledCount / totalStudentsCount) * 100);
      const avgGems = filledCount > 0 ? Math.round(totalGemsInMonth / filledCount) : 0;

      return {
        ...month,
        filledCount,
        totalStudentsCount: effectiveAtfalStudents.length,
        completionPct,
        totalGemsInMonth,
        avgGems,
        topScorer,
        status:
          completionPct === 100
            ? "completed"
            : completionPct > 0
            ? "in-progress"
            : "pending",
      };
    });
  }, [effectiveAtfalStudents, leagueEntries, childProfilesMap]);

  // Active month metadata
  const activeMonthInfo = useMemo(() => {
    return (
      monthWiseInfographics.find((m) => m.id === selectedMonthId) ||
      monthWiseInfographics[0]
    );
  }, [monthWiseInfographics, selectedMonthId]);

  // 6. Detailed Student Roster with Month Score Breakdown (out of 480)
  const studentRosterWithScores = useMemo(() => {
    return effectiveAtfalStudents.map((student) => {
      const entry =
        leagueEntries.find((e) => String(e.student_id) === String(student.id)) ||
        childProfilesMap[student.id]?.gem_league ||
        null;

      const mData = entry?.months?.[selectedMonthId] || null;
      const calc = calculateStudentMonthlyGems(mData);

      return {
        ...student,
        gems: calc.totalGems,
        maxGems: 480,
        isFilled: calc.isFilled,
        weeks: calc.weeks,
        teacherName: entry?.teacher_name || student.teacherName || "Muhaffiz",
      };
    });
  }, [effectiveAtfalStudents, leagueEntries, childProfilesMap, selectedMonthId]);

  // Filtered & Sorted Student Roster
  const filteredStudents = useMemo(() => {
    let list = [...studentRosterWithScores];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.its.includes(q) ||
          s.group.toLowerCase().includes(q) ||
          s.teacherName.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === "filled") {
      list = list.filter((s) => s.isFilled);
    } else if (statusFilter === "pending") {
      list = list.filter((s) => !s.isFilled);
    } else if (statusFilter === "top") {
      list = list.filter((s) => s.gems >= 300);
    }

    // Sort order
    if (sortBy === "gems-desc") {
      list.sort((a, b) => b.gems - a.gems || a.name.localeCompare(b.name));
    } else if (sortBy === "gems-asc") {
      list.sort((a, b) => a.gems - b.gems || a.name.localeCompare(b.name));
    } else if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [studentRosterWithScores, searchQuery, statusFilter, sortBy]);

  // Overall statistics across all months
  const overallStats = useMemo(() => {
    const totalFilledMonths = monthWiseInfographics.reduce((acc, m) => acc + m.filledCount, 0);
    const totalPossibleSlots = (effectiveAtfalStudents.length * MONTHS_CONFIG.length) || 1;
    const overallRate = Math.round((totalFilledMonths / totalPossibleSlots) * 100);
    const totalGemsAll = monthWiseInfographics.reduce((acc, m) => acc + m.totalGemsInMonth, 0);

    const isDark =
      Boolean(isDarkMode) ||
      (typeof document !== "undefined" &&
        (document.body.classList.contains("dark") ||
          document.documentElement.classList.contains("dark")));

    return {
      overallRate,
      totalStudents: effectiveAtfalStudents.length,
      totalGemsAll,
      isDark,
    };
  }, [monthWiseInfographics, effectiveAtfalStudents, isDarkMode]);

  return (
    <div className={`atfal-admin-infographic-card card-appear ${overallStats.isDark ? "dark-theme" : ""}`}>
      {/* ----------------------------------------------------------------- */}
      {/* GRAND HERO HEADER WITH AUDIT METRICS */}
      {/* ----------------------------------------------------------------- */}
      <div className="infographic-hero-header">
        <div className="hero-left-col">
          <div className="hero-badge-icon-wrap">
            <Trophy size={26} className="hero-gold-trophy" />
          </div>
          <div>
            <div className="hero-title-row">
              <h2 className="hero-main-title">HIFZ GEM LEAGUE</h2>
              <span className="hero-year-tag">1448H ACADEMY AUDIT</span>
            </div>
            <p className="hero-subtext">
              Month-wise student completion infographic & teacher-filled marks tracking (out of 480 gems)
            </p>
          </div>
        </div>

        {/* Live Academy Overview Stats */}
        <div className="hero-stats-row">
          <div className="hero-stat-pill">
            <span className="stat-pill-label">Total Atfal</span>
            <strong className="stat-pill-val">{overallStats.totalStudents}</strong>
          </div>
          <div className="hero-stat-pill">
            <span className="stat-pill-label">Academy Completion</span>
            <strong className="stat-pill-val stat-green">{overallStats.overallRate}%</strong>
          </div>
          <div className="hero-stat-pill">
            <span className="stat-pill-label">Total Gems Awarded</span>
            <strong className="stat-pill-val stat-gold">{overallStats.totalGemsAll.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 6-MONTH INTERACTIVE INFOGRAPHIC CARDS STRIP */}
      {/* ----------------------------------------------------------------- */}
      <div className="infographic-section-title-wrap">
        <div className="section-title-left">
          <Calendar size={18} />
          <h3 className="section-title-text">MONTH-WISE COMPLETION INFOGRAPHIC</h3>
          <span className="section-sub-pill">Click a month card to inspect all student marks</span>
        </div>
        <div className="section-title-right">
          <span className="active-month-reminder">
            Active: <strong>{activeMonthInfo.nameEn}</strong>
          </span>
        </div>
      </div>

      <div className="month-cards-infographic-grid">
        {monthWiseInfographics.map((month) => {
          const isSelected = selectedMonthId === month.id;
          return (
            <div
              key={month.id}
              className={`month-infographic-card ${isSelected ? "selected-month" : ""} status-${month.status}`}
              onClick={() => setSelectedMonthId(month.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSelectedMonthId(month.id);
              }}
            >
              {/* Card Top Strip */}
              <div className="month-card-top-row">
                <div className="month-gem-icon-halo">
                  <img src={month.gemImg} alt={month.nameEn} className="month-3d-gem" />
                </div>
                <div className="month-status-pill">
                  {month.status === "completed" ? (
                    <span className="tag-completed">
                      <CheckCircle2 size={12} /> 100% Done
                    </span>
                  ) : month.status === "in-progress" ? (
                    <span className="tag-in-progress">
                      <Clock size={12} /> In Progress
                    </span>
                  ) : (
                    <span className="tag-pending">
                      <AlertCircle size={12} /> Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Month Name & Hijri */}
              <div className="month-card-name-group">
                <span className="month-card-ar">{month.nameAr}</span>
                <strong className="month-card-en">{month.nameEn}</strong>
              </div>

              {/* Completion Progress Gauge */}
              <div className="month-progress-block">
                <div className="progress-labels-row">
                  <span className="prog-label">Filled Progress</span>
                  <span className="prog-ratio">
                    <strong>{month.filledCount}</strong> / {month.totalStudentsCount} Students
                  </span>
                </div>
                <div className="month-progress-track">
                  <div
                    className="month-progress-bar"
                    style={{
                      width: `${month.completionPct}%`,
                      background:
                        month.completionPct === 100
                          ? "linear-gradient(90deg, #10b981, #34d399)"
                          : month.completionPct >= 50
                          ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                          : "linear-gradient(90deg, #3b82f6, #60a5fa)",
                    }}
                  />
                </div>
                <div className="prog-pct-sub">{month.completionPct}% Completed</div>
              </div>

              {/* Average & Top Scorer Snippet */}
              <div className="month-card-footer-stats">
                <div className="footer-stat-col">
                  <span className="footer-stat-label">Avg Gems:</span>
                  <strong className="footer-stat-val">{month.avgGems} / 480</strong>
                </div>
                {month.topScorer && (
                  <div className="footer-stat-col top-scorer-col" title={`Top Scorer: ${month.topScorer.name}`}>
                    <span className="footer-stat-label">Top:</span>
                    <strong className="footer-stat-val">{month.topScorer.name.split(" ")[0]} ({month.topScorer.gems}✦)</strong>
                  </div>
                )}
              </div>

              {/* Active Arrow Indicator */}
              {isSelected && (
                <div className="month-card-selected-indicator">
                  <span>Selected Month • View Roster Below</span>
                  <ChevronRight size={14} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* DETAILED STUDENT ROSTER FOR SELECTED MONTH */}
      {/* ----------------------------------------------------------------- */}
      <div className="month-details-roster-container">
        <div className="roster-header-banner">
          <div className="roster-header-left">
            <div className="month-lead-badge">
              <span className="lead-ar">{activeMonthInfo.nameAr}</span>
              <h3 className="lead-en">{activeMonthInfo.nameEn} — Student Marks Roster</h3>
            </div>
            <div className="roster-meta-tags">
              <span className="meta-tag filled-tag">
                <CheckCircle2 size={13} /> {activeMonthInfo.filledCount} of {activeMonthInfo.totalStudentsCount} Filled
              </span>
              <span className="meta-tag avg-tag">
                <Gem size={13} /> Class Avg: {activeMonthInfo.avgGems} / 480 Gems
              </span>
              <span className="meta-tag total-tag">
                <Award size={13} /> Total Awarded: {activeMonthInfo.totalGemsInMonth} Gems
              </span>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="roster-controls-right">
            {/* Search Input */}
            <div className="roster-search-box">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search child name, ITS, group..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="roster-search-input"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="roster-status-pills">
              <button
                type="button"
                className={`filter-pill ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                All ({studentRosterWithScores.length})
              </button>
              <button
                type="button"
                className={`filter-pill filter-filled ${statusFilter === "filled" ? "active" : ""}`}
                onClick={() => setStatusFilter("filled")}
              >
                Filled ({studentRosterWithScores.filter((s) => s.isFilled).length})
              </button>
              <button
                type="button"
                className={`filter-pill filter-pending ${statusFilter === "pending" ? "active" : ""}`}
                onClick={() => setStatusFilter("pending")}
              >
                Pending ({studentRosterWithScores.filter((s) => !s.isFilled).length})
              </button>
              <button
                type="button"
                className={`filter-pill filter-top ${statusFilter === "top" ? "active" : ""}`}
                onClick={() => setStatusFilter("top")}
              >
                300+ Gems ({studentRosterWithScores.filter((s) => s.gems >= 300).length})
              </button>
            </div>

            {/* Sort Toggle */}
            <div className="roster-sort-box">
              <button
                type="button"
                className="sort-toggle-btn"
                onClick={() => {
                  setSortBy((prev) =>
                    prev === "gems-desc" ? "gems-asc" : prev === "gems-asc" ? "name" : "gems-desc"
                  );
                }}
                title="Toggle Sort Order"
              >
                <ArrowUpDown size={14} />
                <span>
                  {sortBy === "gems-desc"
                    ? "Highest First"
                    : sortBy === "gems-asc"
                    ? "Lowest First"
                    : "Alphabetical"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Student Cards Grid */}
        <div className="students-roster-grid">
          {filteredStudents.length === 0 ? (
            <div className="roster-empty-state">
              <Sparkles size={32} className="empty-sparkle" />
              <h4>No students matching your filter</h4>
              <p>Try clearing your search or switching to "All Students".</p>
              <button
                type="button"
                className="clear-filter-btn"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredStudents.map((child, index) => {
              const rank = index + 1;
              const isTop3 = sortBy === "gems-desc" && rank <= 3 && child.gems > 0;
              const rankClass = isTop3 ? `top-rank-${rank}` : "";
              const pct = Math.round((child.gems / child.maxGems) * 100);

              return (
                <div
                  key={child.id}
                  className={`student-roster-card ${child.isFilled ? "filled-card" : "pending-card"} ${rankClass}`}
                >
                  {/* Card Header: Avatar, Name, Rank */}
                  <div className="card-header-row">
                    <div className="student-avatar-col">
                      {child.photo ? (
                        <img
                          src={child.photo}
                          alt={child.name}
                          className="roster-avatar-img"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/logo.png";
                          }}
                        />
                      ) : (
                        <div className="roster-avatar-fallback">
                          {child.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className={`rank-badge rank-${rank}`}>
                        #{rank}
                      </span>
                    </div>

                    <div className="student-info-col">
                      <div className="student-name-row">
                        <h4 className="student-name-text">{child.name}</h4>
                        {isTop3 && (
                          <span className="trophy-tag">
                            <Trophy size={13} /> {rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"}
                          </span>
                        )}
                      </div>

                      <div className="student-meta-badges">
                        <span className="group-badge">{child.group}</span>
                        {child.its && <span className="its-badge">ITS: {child.its}</span>}
                        <span className="teacher-badge">
                          Teacher: {child.teacherName}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="status-col">
                      {child.isFilled ? (
                        <span className="badge-status-filled">
                          <CheckCircle2 size={13} /> Filled
                        </span>
                      ) : (
                        <span className="badge-status-pending">
                          <AlertCircle size={13} /> Not Filled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4 Weeks Detailed Score Breakdown */}
                  <div className="card-weeks-breakdown-row">
                    {["week1", "week2", "week3", "week4"].map((wkKey, wIdx) => {
                      const w = child.weeks?.[wkKey] || { post_it: 0, activity: 0, total: 0 };
                      const isWkFilled = w.total > 0;
                      return (
                        <div key={wkKey} className={`week-mini-cell ${isWkFilled ? "week-scored" : "week-empty"}`}>
                          <div className="week-mini-header">
                            <span className="week-mini-num">W{wIdx + 1}</span>
                            <span className="week-mini-total">{w.total}/120</span>
                          </div>
                          <div className="week-mini-items">
                            <span className="item-post-it" title="Post-It Gems (out of 60)">
                              P: {w.post_it}
                            </span>
                            <span className="item-sep">•</span>
                            <span className="item-activity" title="Activity Gems (out of 60)">
                              A: {w.activity}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total Monthly Score Progress Bar (out of 480) */}
                  <div className="card-total-progress-wrap">
                    <div className="total-score-row">
                      <span className="score-label">Monthly Total:</span>
                      <div className="score-val-group">
                        <strong className="gems-hero-val">{child.gems}</strong>
                        <span className="denom-label">/ 480 GEMS</span>
                      </div>
                    </div>

                    <div className="total-progress-track">
                      <div
                        className={`total-progress-bar bar-${isTop3 ? "gold" : child.isFilled ? "emerald" : "pending"}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="progress-sub-percent">
                      <span>{pct}% of maximum score</span>
                      {child.gems >= 400 && <span className="star-distinction">✦ High Achiever</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
