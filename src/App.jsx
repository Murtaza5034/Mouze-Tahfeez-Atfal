import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Hash,
  Home,
  Layers3,
  LogOut,
  Menu,
  ShieldCheck,
  Send,
  Sparkles,
  Trophy,
  Trash,
  X,
  User,
  Users,
  Phone,
  MessageCircle,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import "./style.css";
import "./salary.css";
import "./teacher-profiles.css";
import "./admin-sidebar.css";
import "./parent-portal.css";

const ROLE_LABELS = {
  parents: "Parents",
  admin: "Admin",
  teacher: "Teacher",
};

const ASSETS = {
  LOGO: "/logo.png",
};

const UI_TEXT = {
  PER_MAX: " / ",
  OF_TOTAL: " out of ",
};

const DEFAULT_PAGE_BY_ROLE = {
  parents: "Home",
  admin: "Overview",
  teacher: "My Group",
};

const RESULT_NUMERIC_FIELDS = ["murajazah", "juz_hali", "takhteet", "jadeed"];
const STORAGE_KEYS = {
  role: "mauze-active-role",
  teacherAttendance: "mauze-teacher-attendance",
  customGroups: "mauze-custom-groups",
};

const NAV_ICONS = {
  Home: Sparkles,
  Profile: User,
  "Child Summary": CheckCircle2,
  Policy: ShieldCheck,
  Overview: Layers3,
  Schedule: Calendar,
  Announcements: Bell,
  Notifications: Send,
  Teachers: GraduationCap,
  Groups: Users,
  "Portal Access": ShieldCheck,
  "My Group": Users,
  "Fill Result": Sparkles,
};

const emptyParentData = {
  studentProfile: null,
  hifzDetails: null,
  announcements: [],
  schedule: [],
  attendance: null,
  weeklyResult: null,
};

const emptyPortalAccess = {
  portal_role: "",
  is_active: false,
  full_name: "",
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function readLocalArray(key) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : [];
  } catch {
    return [];
  }
}

function writeLocalArray(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function Celebration() {
  const pieces = Array.from({ length: 50 });
  return (
    <div className="celebration-overlay">
      {pieces.map((_, i) => (
        <div 
          key={i} 
          className="confetti" 
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: 'var(--primary-gold)',
            color: 'white',
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 2}s`
          }}
        />
      ))}
    </div>
  );
}

const sendPushNotification = async (title, body, redirectPath = null) => {
  if (!("Notification" in window)) return;
  
  const showNotification = () => {
    const notification = new Notification(title, { body, icon: "/logo.png" });
    if (redirectPath) {
      notification.onclick = () => {
        window.focus();
        if (redirectPath.startsWith("http")) {
          window.open(redirectPath, "_blank");
        } else {
          window.location.hash = redirectPath;
        }
      };
    }
  };

  if (Notification.permission === "granted") {
    showNotification();
  } else if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      showNotification();
    }
  }
};

function NotificationEnabler({ permission, onRequest }) {
  if (permission === "granted" || permission === "denied") return null;
  return (
    <button onClick={onRequest} className="notification-enabler-btn" style={{ marginLeft: "auto", marginRight: "12px" }}>
      <Bell size={14} /> Enable Alerts
    </button>
  );
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function toNumber(value) {
  return Number(value || 0);
}

const ARABIC_MONTHS = [
  "محرم الحرام", "صفر المظفر", "ربيع الأول", "ربيع الآخر", 
  "جمادى الأولى", "جمادى الآخرة", "رجب الأصب", "شعبان الكريم", 
  "رمضان المعظم", "شوال المكرم", "ذي القعدة الحرام", "ذي الحجة الحرام"
];

function getFatemiInfo(dateStr) {
  if (!dateStr) return { week: "...", month: "...", date: "...", monthName: "..." };
  
  try {
    const date = new Date(dateStr);
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-tbla-nu-latn', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    }).formatToParts(date);
    
    const d = parseInt(parts.find(p => p.type === 'day').value);
    const m = parseInt(parts.find(p => p.type === 'month').value);
    const y = parts.find(p => p.type === 'year').value;
    
    return {
      week: Math.ceil(d / 7),
      month: m,
      date: d,
      year: y,
      monthName: ARABIC_MONTHS[m - 1] || "..."
    };
  } catch (e) {
    return { week: "...", month: "...", date: "...", monthName: "..." };
  }
}

async function findPortalAccess(userId) {
  const { data, error } = await supabase
    .from("user_portal_access")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

function getAssignedRoles(user) {
  const rawRoles = [
    user?.user_metadata?.portal_roles,
    user?.app_metadata?.portal_roles,
    user?.user_metadata?.portal_role,
    user?.user_metadata?.role,
    user?.app_metadata?.portal_role,
    user?.app_metadata?.role,
  ].filter(Boolean);

  const roles = rawRoles.flatMap((value) => {
    if (Array.isArray(value)) {
      return value;
    }

    return String(value)
      .split(",")
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean);
  });

  return Array.from(
    new Set(roles.filter((role) => Object.prototype.hasOwnProperty.call(ROLE_LABELS, role)))
  );
}

function formatRoleList(roles) {
  return roles.map((role) => ROLE_LABELS[role] || role).join(", ");
}

async function findParentProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function authorizePortalAccess(user, requestedRole) {
  const tableAccess = await findPortalAccess(user.id);
  const assignedRoles = getAssignedRoles(user);
  const requestedLabel = ROLE_LABELS[requestedRole] || requestedRole;

  if (tableAccess?.is_active && tableAccess.portal_role === requestedRole) {
    return {
      ok: true,
      role: requestedRole,
      assignedRoles: [requestedRole],
      parentProfile: null,
      accessRow: tableAccess,
    };
  }

  if (tableAccess?.is_active && tableAccess.portal_role && tableAccess.portal_role !== requestedRole) {
    return {
      ok: false,
      message: `This account is assigned to the ${ROLE_LABELS[tableAccess.portal_role] || tableAccess.portal_role
        } portal in Supabase. It cannot open the ${requestedLabel} portal.`,
    };
  }

  if (assignedRoles.includes(requestedRole)) {
    return {
      ok: true,
      role: requestedRole,
      assignedRoles,
      parentProfile: null,
      accessRow: null,
    };
  }

  if (requestedRole === "parents") {
    const parentProfile = await findParentProfile(user.id);

    if (parentProfile) {
      return {
        ok: true,
        role: "parents",
        assignedRoles: assignedRoles.length > 0 ? assignedRoles : ["parents"],
        parentProfile,
        accessRow: tableAccess || null,
      };
    }
  }

  if (tableAccess && !tableAccess.is_active) {
    return {
      ok: false,
      message: "This account exists in Supabase portal access, but it is currently inactive.",
    };
  }

  if (assignedRoles.length > 0) {
    return {
      ok: false,
      message: `This account is assigned to ${formatRoleList(
        assignedRoles
      )}. It cannot open the ${requestedLabel} portal.`,
    };
  }

  return {
    ok: false,
    message: `This account is not assigned to the ${requestedLabel} portal yet. Add a role in Supabase user metadata first.`,
  };
}

async function resolveInitialPortal(user, preferredRole) {
  const tableAccess = await findPortalAccess(user.id);
  const assignedRoles = getAssignedRoles(user);

  if (tableAccess?.is_active && tableAccess.portal_role) {
    return authorizePortalAccess(user, tableAccess.portal_role);
  }

  if (preferredRole) {
    const preferredAccess = await authorizePortalAccess(user, preferredRole);
    if (preferredAccess.ok) {
      return preferredAccess;
    }
  }

  for (const role of assignedRoles) {
    const access = await authorizePortalAccess(user, role);
    if (access.ok) {
      return access;
    }
  }

  return authorizePortalAccess(user, "parents");
}

function guessTeacherIdentity(user, portalAccess = null) {
  if (portalAccess?.full_name) return portalAccess.full_name;
  
  const metadataName =
    user?.user_metadata?.teacher_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name;

  if (metadataName) return metadataName;

  return (user?.email || "")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();
}

function getStudentStatus(student) {
  if (student?.latestResult?.attendance_note) {
    return student.latestResult.attendance_note;
  }

  if (student?.hifz?.teacher_note) {
    return student.hifz.teacher_note;
  }

  if (student?.hifz?.surat) {
    return `Memorizing ${student.hifz.surat}`;
  }

  return "Status update pending";
}

function buildStudents(profiles = [], hifzRecords = [], weeklyResults = []) {
  const hifzMap = new Map(hifzRecords.map((item) => [item.student_id, item]));
  const latestResultMap = new Map();

  weeklyResults.forEach((result) => {
    if (!latestResultMap.has(result.student_id)) {
      latestResultMap.set(result.student_id, result);
    }
  });

  return profiles.map((profile) => {
    const hifz = hifzMap.get(profile.student_id) || null;
    const latestResult = latestResultMap.get(profile.student_id) || null;
    const teacherName =
      hifz?.muhaffiz_name ||
      profile.teacher_name ||
      profile.muhaffiz_name ||
      "Unassigned teacher";
    const groupName =
      profile.group_name ||
      hifz?.group_name ||
      profile.class_level ||
      teacherName ||
      "Ungrouped";

    return {
      ...profile,
      hifz,
      latestResult,
      teacherName,
      groupName,
      photoUrl:
        profile.photo_url ||
        profile.avatar_url ||
        hifz?.photo_url ||
        hifz?.avatar_url ||
        "",
      hifzStatus: getStudentStatus({ hifz, latestResult }),
    };
  });
}

function LoadingScreen({ message }) {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>{message}</p>
    </div>
  );
}

function StudentAvatar({ student, size = "regular" }) {
  if (student?.photoUrl) {
    return (
      <img
        src={student.photoUrl}
        alt={student.name || "Student"}
        className={`student-avatar ${size}`}
      />
    );
  }

  return (
    <div className={`avatar-placeholder ${size === "small" ? "small" : ""}`}>
      <User size={size === "small" ? 20 : 28} />
    </div>
  );
}

function InfoHighlights({ items }) {
  return (
    <div className="info-grid">
      {items.map((item) => (
        <section key={item}>
          <h3>Highlight</h3>
          <p>{item}</p>
        </section>
      ))}
    </div>
  );
}

function FatemiDateSelector({ value, onChange }) {
  const info = useMemo(() => getFatemiInfo(value), [value]);
  const years = [1445, 1446, 1447, 1448];
  const days = Array.from({ length: 30 }, (_, i) => i + 1);

  const handleSelectChange = (type, newVal) => {
    const d = type === 'day' ? newVal : info.date;
    const m = type === 'month' ? newVal : info.month;
    const y = type === 'year' ? newVal : info.year;

    const targetYear = parseInt(y);
    const approxDate = new Date(targetYear - 579, m - 1, d); 
    
    for (let i = -15; i <= 15; i++) {
      const testDate = new Date(approxDate);
      testDate.setDate(testDate.getDate() + i);
      const testInfo = getFatemiInfo(testDate.toISOString().split('T')[0]);
      if (parseInt(testInfo.date) === parseInt(d) && parseInt(testInfo.month) === parseInt(m) && String(testInfo.year) === String(y)) {
        onChange({ target: { name: 'week_date', value: testDate.toISOString().split('T')[0] } });
        return;
      }
    }
  };

  return (
    <div className="fatemi-selector">
      <select value={info.date} onChange={(e) => handleSelectChange('day', e.target.value)}>
        {days.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={info.month} onChange={(e) => handleSelectChange('month', e.target.value)}>
        {ARABIC_MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>{name}</option>
        ))}
      </select>
      <select value={info.year} onChange={(e) => handleSelectChange('year', e.target.value)}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

function AttendanceCard({ count, total = 6 }) {
  const stars = Array.from({ length: total }, (_, i) => i < Number(count || 0));

  return (
    <div className="attendance-card-modern card-appear">
      <div className="attendance-lighting" />
      <div className="attendance-stars-container">
        {stars.map((isFilled, i) => (
          <Sparkles 
            key={i} 
            size={32} 
            className={`attendance-star ${isFilled ? 'filled' : 'empty'}`}
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
      <div>
        <h4 className="attendance-rating-text kids-font">
          {total} days out {count || 0}
        </h4>
        <p className="attendance-sub-label" style={{ textAlign: 'center', fontSize: '11px' }}>
          Weekly student presence score
        </p>
      </div>
    </div>
  );
}

function JadeedPagesCard({ count }) {
  return (
    <div className="jadeed-pages-card card-appear">
      <div className="attendance-lighting" />
      <div className="jadeed-icon-container">
        <BookOpen size={80} className="jadeed-icon-bg" />
        <span className="jadeed-count-overlay">{count || 0}</span>
      </div>
      <h4 className="attendance-rating-text kids-font" style={{ fontSize: '1.1rem' }}>
        Total Jadeed Pages
      </h4>
      <p className="attendance-sub-label" style={{ textAlign: 'center', fontSize: '11px' }}>
        New pages memorized this week
      </p>
    </div>
  );
}

function TahfeezReportCard({ student, weeklyResult }) {
  const arabicStyle = { fontFamily: "'Amiri', serif" };
  const fatemi = getFatemiInfo(weeklyResult?.week_date);

  return (
    <div className="progress-overview">
       <div className="result-card-premium card-appear">
          <div className="result-card-header">
             <div className="school-logo"><img src="/logo.png" alt="Logo" /></div>
             <div className="school-info">
                <h4>RAWDAT TAHFEEZ UL ATFAAL</h4>
                <p>{student?.groupName || "Tahfeez Group"}</p>
             </div>
             <div className="report-badge">
                <span className="kids-font" style={{ fontSize: "20px" }}>TAHFEEZ REPORT 1447H</span>
             </div>
          </div>

          <div className="result-week-meta">
             <div className="week-meta-grid">
                <div className="meta-col">
                   <span className="meta-label kids-font">Week:</span>
                   <span className="meta-val">{fatemi.week}</span>
                </div>
                <div className="meta-col">
                   <span className="meta-label kids-font">Date:</span>
                   <span className="meta-val">{fatemi.date}</span>
                </div>
                <div className="meta-col">
                   <span className="meta-label kids-font">Month:</span>
                   <span className="meta-val arabic-kanz" style={arabicStyle}>{fatemi.monthName}</span>
                </div>
             </div>
          </div>

          <div className="result-main">
             <div className="total-score-block">
                <span className="score-title kids-font">WEEKLY SCORE</span>
                <span className="jumla-label arabic-kanz" style={arabicStyle}>جملة</span>
                <div className="score-circle">{weeklyResult?.total_score || "0"}</div>
                <span className="max-score">{UI_TEXT.PER_MAX} 100</span>
             </div>

             <div className="score-details-box">
                {[
                  { label: "مراجعة", val: weeklyResult?.murajazah, max: 30 },
                  { label: "جزء حالي", val: weeklyResult?.juz_hali, max: 30 },
                  { label: "تخطيط", val: weeklyResult?.takhteet, max: 20 },
                  { label: "جديد", val: weeklyResult?.jadeed, max: 20 }
                ].map((item) => (
                  <div key={item.label} className="score-row">
                    <span className="arabic-label arabic-kanz" style={arabicStyle}>{item.label}</span>
                    <span className="score-val">{item.val || "0"}{UI_TEXT.PER_MAX}{item.max}</span>
                  </div>
                ))}
             </div>

             <div className="trophy-container">
                <Trophy size={64} className="trophy-icon" />
                <span className="rank-text-overlay">{weeklyResult?.rank || "-"}</span>
             </div>
          </div>

          <div className="result-footer-grid">
             <div className="target-box highlight-wusool">
                <h5 className="arabic-kanz" style={{...arabicStyle, fontSize: '1.1rem'}}>وصول الى الاْن</h5>
                <p>Juz: {weeklyResult?.wusool_juz || "-"}</p>
                <p>Page: {weeklyResult?.wusool_page || "-"}</p>
             </div>
             <div className="target-box highlight-matrookah">
                <div className="note-item-row">
                   <span className="note-val">{weeklyResult?.matrookah || "-"}</span>
                   <span className="note-label arabic-kanz" style={arabicStyle}>:متروكة</span>
                </div>
                <div className="note-item-row">
                   <span className="note-val">{weeklyResult?.daeefah || "-"}</span>
                   <span className="note-label arabic-kanz" style={arabicStyle}>:ضعيفة</span>
                </div>
             </div>
             <div className="target-box">
                <h5 className="kids-font">Next Week Target</h5>
                <p>Juz: {weeklyResult?.next_week_juz || "-"}</p>
                <p>Page: {weeklyResult?.next_week_page || "-"}</p>
                <p>Total Jadeed: {weeklyResult?.total_jadeed_pages || "0"}</p>
             </div>
             <div className="target-box highlight">
                <h5 className="kids-font">Target Till Istifadah</h5>
                <p>Juz: {weeklyResult?.istifadah_juz || "-"}</p>
                <p>Page: {weeklyResult?.istifadah_page || "-"}</p>
             </div>
          </div>

          {weeklyResult?.attendance_note && (
             <div className="attendance-ribbon">{weeklyResult.attendance_note}</div>
          )}
       </div>

       <div className="report-footer-cards">
         <AttendanceCard 
           count={weeklyResult?.attendance_count} 
           total={6} 
         />
         <JadeedPagesCard 
           count={weeklyResult?.total_jadeed_pages} 
         />
       </div>
    </div>
  );
}

function ParentPortal({
  activePage,
  parentData,
  setActivePage,
  user,
  loading,
  menuOpen,
  setMenuOpen,
  onLogout,
  onRoleChange,
  teacherProfiles = [],
}) {
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (activePage === "Child Summary") {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [activePage]);

  const { studentProfile, hifzDetails, announcements, schedule, attendance, weeklyResult } =
    parentData;

  const pageNames = ["Home", "Schedule", "Progress", "Announcements", "Teachers"];
  const assignedRoles = getAssignedRoles(user);

  const navigationMap = {
    "Home": "Home",
    "Schedule": "Schedule",
    "Announcements": "Announcements",
    "Teachers": "Teachers",
    "Progress": "Child Summary",
    "Profile": "Profile"
  };

  const myTeacher = teacherProfiles.find(t => 
    normalizeText(t.full_name) === normalizeText(studentProfile?.teacher_name)
  );

  const sortedTeachers = useMemo(() => {
    if (!myTeacher) return teacherProfiles;
    return [myTeacher, ...teacherProfiles.filter(t => t.id !== myTeacher.id)];
  }, [teacherProfiles, myTeacher]);

  if (loading && !studentProfile && user) {
    return <LoadingScreen message="Fetching your child's data..." />;
  }

  const pages = {
    Profile: {
      eyebrow: "Student Profile",
      title: "Track your child with clarity",
      description:
        "See attendance, class level, guardian details, and the latest updates in one education dashboard.",
      highlights: [
        `Student ID: ${studentProfile?.student_id || "..."}`,
        `Attendance: ${attendance ? attendance.status : "..."}`,
        `Class: ${studentProfile?.class_level || "..."}`,
      ],
      childInfo: {
        name: studentProfile?.name || "Loading...",
        its: studentProfile?.its || "...",
        hifzJuz: hifzDetails?.juz || "...",
        hifzSurat: hifzDetails?.surat || "...",
        muhaffizName: hifzDetails?.muhaffiz_name || "...",
      },
    },
    Home: {
      eyebrow: "Parents Home",
      title: `Welcome back, ${studentProfile?.guardian_name || "Guardian"}`,
      description:
        "Access your child's daily learning schedule, important announcements, and school actions here.",
      highlights: [
        `Attendance: ${attendance?.status || "Present"}`,
        `Lesson: ${hifzDetails?.surat || "Surah update pending"}`,
        `Homework: ${hifzDetails?.teacher_note ? "Teacher note available" : "Pending"}`,
      ],
      announcements:
        announcements.length > 0
          ? announcements
          : [{ id: 1, title: "Waiting for updates...", event_date: "", type: "Update" }],
      schedule:
        schedule.length > 0
          ? schedule
          : [{ task_time: "--:--", task_name: "No tasks scheduled for today", is_done: false }],
    },
    "Child Summary": {
      eyebrow: "Progress Overview",
      title: "Review child performance in one place",
      description:
        "Understand memorization progress, behavior notes, and weekly teacher feedback without switching screens.",
      highlights: [`Teacher note: ${hifzDetails?.teacher_note || "No teacher feedback yet."}`],
    },
    Policy: {
      eyebrow: "School Policy",
      title: "Important rules and guidance",
      description:
        "Keep uniform policy, attendance rules, fee guidance, and safeguarding details available anytime.",
      highlights: ["Attendance policy", "Fee and payment rules", "Safety and pickup rules"],
    },
    Schedule: {
      eyebrow: "Daily Plan",
      title: "Learning Schedule",
      description: "Detailed breakdown of your child's daily school activities and tasks.",
      schedule: schedule.length > 0 ? schedule : [{ task_time: "--:--", task_name: "No tasks found" }],
      highlights: [`Next task: ${schedule[0]?.task_name || "None"}`],
    },
    Teachers: {
      eyebrow: "Our Staff",
      title: "Teacher Contacts",
      description: "Direct contact options for your child's Muhaffiz and other staff.",
      highlights: ["WhatsApp support", "Call verification"],
    },
  };

  const currentPage = pages[activePage];

  const bottomPages = [
    { key: "Home", label: "Home", icon: Home },
    { key: "Child Summary", label: "Progress", icon: GraduationCap },
    { key: "Schedule", label: "Schedule", icon: Calendar },
    { key: "Teachers", label: "Teachers", icon: Users },
  ];

  return (
    <div className="parent-shell">
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={`parent-drawer ${menuOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <img src={studentProfile?.photo_url || "/logo.png"} alt="Profile" className="drawer-avatar" />
          <div>
            <h3 className="drawer-name">{studentProfile?.name || "Student"}</h3>
            <p className="drawer-sub">ITS: {studentProfile?.its || "..."} &nbsp;|&nbsp; {studentProfile?.groupName || "..."}</p>
          </div>
          <button className="drawer-close" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        </div>
        <nav className="drawer-nav">
          <p className="drawer-section-label">More Pages</p>
          <button className={`drawer-link ${activePage === "Announcements" ? "active" : ""}`} onClick={() => { setActivePage("Announcements"); setMenuOpen(false); }}>
            <Bell size={18} /> Announcements
          </button>
          <button className={`drawer-link ${activePage === "Profile" ? "active" : ""}`} onClick={() => { setActivePage("Profile"); setMenuOpen(false); }}>
            <User size={18} /> My Profile
          </button>
        </nav>
        <div className="drawer-footer">
          {assignedRoles.filter(r => r !== 'parents').map((role) => (
            <button key={role} className="drawer-link" onClick={() => { onRoleChange(role); setMenuOpen(false); }}>
              <LogOut size={18} /> Switch to {role}
            </button>
          ))}
          <button className="drawer-link logout" onClick={onLogout}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      <header className="parent-topbar">
        <button className="topbar-menu-btn" onClick={() => setMenuOpen(true)}>
          <Menu size={22} />
        </button>
        <div className="parent-topbar-left">
          <img src="/logo.png" alt="Logo" className="topbar-logo" />
          <div>
            <span className="topbar-brand">Mauze Tahfeez</span>
            <span className="topbar-sub">Parents Portal</span>
          </div>
        </div>
      </header>

      <main className="parent-main">
        {showCelebration && <Celebration />}

        {activePage === "Schedule" ? (
          <div className="home-dashboard">
            <div className="dashboard-section">
              <div className="section-header">
                <Calendar size={18} />
                <h3>Study Schedule</h3>
              </div>
              <div className="schedule-list">
                {currentPage.schedule.map((item, index) => (
                  <div key={`${item.task_name}-${index}`} className={`schedule-item ${item.is_done ? "done" : ""}`}>
                    <div className="time-strip">
                      <Clock size={14} />
                      {item.task_time}
                    </div>
                    <div className="task-info">
                      <p>{item.task_name}</p>
                      {item.is_done ? (
                        <CheckCircle2 size={16} className="status-icon" />
                      ) : (
                        <div className="pending-circle" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activePage === "Home" ? (
          <div className="home-dashboard">
            <div className="hifz-stats-premium-strip">
              {[
                { label: "Weekly Score", val: weeklyResult?.total_score ?? "--", sub: "out of 100", icon: Trophy, color: "#c5a059" },
                { label: "Daily Status", val: attendance?.status || "Present", sub: getToday(), icon: Clock, color: "#5d4037" },
                { label: "Current Juz", val: hifzDetails?.juz || "--", sub: hifzDetails?.surat || "In progress", icon: BookOpen, color: "#8b6d31" },
                { label: "My Muhaffiz", val: hifzDetails?.muhaffiz_name?.split(' ')[0] || "Pending", sub: "Direct Teacher", icon: GraduationCap, color: "#d4af37" },
              ].map((stat, i) => (
                <div key={i} className="premium-stat-pill card-appear" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="pill-icon" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                    <stat.icon size={18} />
                  </div>
                  <div className="pill-info">
                    <span className="pill-label">{stat.label}</span>
                    <strong className="pill-value">{stat.val}</strong>
                    <span className="pill-sub">{stat.sub}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="dashboard-section">
              <div className="section-header">
                <Calendar size={18} />
                <h3>Today's Schedule</h3>
              </div>
              <div className="schedule-list">
                {pages.Schedule.schedule.map((item, index) => (
                  <div key={`${item.task_name}-${index}`} className={`schedule-item ${item.is_done ? "done" : ""}`}>
                    <div className="time-strip">
                      <Clock size={14} />
                      {item.task_time}
                    </div>
                    <div className="task-info">
                      <p>{item.task_name}</p>
                      {item.is_done ? (
                        <CheckCircle2 size={16} className="status-icon" />
                      ) : (
                        <div className="pending-circle" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-section">
              <div className="section-header">
                <Bell size={18} />
                <h3>Announcements</h3>
              </div>
              <div className="announcement-list">
                {currentPage.announcements.map((news) => (
                  <div key={news.id || news.title} className="news-card">
                    <div>
                      <div className="news-meta">
                        <span className={`tag ${String(news.type || "update").toLowerCase()}`}>
                          {news.type || "Update"}
                        </span>
                        <span className="date">{news.event_date}</span>
                      </div>
                      <h4>{news.title}</h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activePage === "Profile" && currentPage.childInfo ? (
          <div className="child-info-card">
            <div className="card-header">
              <div className="avatar-placeholder">
                <User size={32} />
              </div>
              <div className="header-text">
                <h3>{currentPage.childInfo.name}</h3>
                <p>
                  <Hash size={12} /> ITS: {currentPage.childInfo.its}
                </p>
              </div>
            </div>

            <div className="info-grid-simple">
              <div className="info-item">
                <div className="info-icon">
                  <BookOpen size={18} />
                </div>
                <div className="info-content">
                  <span className="label">HIFZ INFORMATION</span>
                  <span className="value">Juz {currentPage.childInfo.hifzJuz}</span>
                  <span className="sub-value">{currentPage.childInfo.hifzSurat}</span>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon">
                  <GraduationCap size={18} />
                </div>
                <div className="info-content">
                  <span className="label">MUHAFFIZ NAME</span>
                  <span className="value">{currentPage.childInfo.muhaffizName}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activePage === "Child Summary" ? (
          <div className="card-appear">
            <TahfeezReportCard
              student={{
                name: studentProfile?.name,
                groupName: studentProfile?.class_level,
              }}
              weeklyResult={weeklyResult}
            />
          </div>
        ) : null}

        {activePage === "Teachers" ? (
          <div className="card-appear">
            <div className="section-title-block">
               <p className="page-eyebrow">Our Professional Staff</p>
               <h2 className="page-title">Teacher Contacts</h2>
            </div>
            <div className="teacher-info-stack">
              {teacherProfiles
                .filter(t => studentProfile?.teacher_name && normalizeText(t.full_name) === normalizeText(studentProfile.teacher_name))
                .map(teacher => {
                  const waNumber = (teacher.whatsapp_number || "").split("").filter(c => "0123456789".includes(c)).join("");
                  const photo = teacher.photo_url || ASSETS.LOGO;
                  return (
                    <article key={teacher.id} className="premium-card teacher-profile-card pinned">
                      <div className="pin-badge">
                        <Sparkles size={12} /> My Child's Muhaffiz
                      </div>
                      <div className="teacher-card-inner">
                        <img src={photo} alt={teacher.full_name} className="teacher-photo-square" />
                        <div className="teacher-details">
                          <h3>{teacher.full_name}</h3>
                          <p className="teacher-specialty">Assigned Muhaffiz</p>
                          <div className="contact-actions">
                            {teacher.phone_number && (
                              <a href={`tel:${teacher.phone_number}`} className="contact-btn call">
                                <Phone size={16} /> Call
                              </a>
                            )}
                            {waNumber && (
                              <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" className="contact-btn whatsapp">
                                <MessageCircle size={16} /> WhatsApp
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}

              {teacherProfiles
                .filter(t => !studentProfile?.teacher_name || normalizeText(t.full_name) !== normalizeText(studentProfile.teacher_name))
                .map((teacher) => {
                  const waNumber = (teacher.whatsapp_number || "").split("").filter(c => "0123456789".includes(c)).join("");
                  const photo = teacher.photo_url || ASSETS.LOGO;
                  return (
                    <article key={teacher.id} className="premium-card teacher-profile-card">
                      <div className="teacher-card-inner">
                        <img src={photo} alt={teacher.full_name} className="teacher-photo-square" />
                        <div className="teacher-details">
                          <h3>{teacher.full_name}</h3>
                          <p className="teacher-specialty">Muhaffiz</p>
                          <div className="contact-actions">
                            {teacher.phone_number && (
                              <a href={`tel:${teacher.phone_number}`} className="contact-btn call">
                                <Phone size={16} /> Call
                              </a>
                            )}
                            {waNumber && (
                              <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" className="contact-btn whatsapp">
                                <MessageCircle size={16} /> WhatsApp
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
            {teacherProfiles.length === 0 && (
              <div className="empty-state premium-card">
                  <Users size={48} opacity={0.2} />
                  <p>No teacher information available at this moment.</p>
              </div>
            )}
          </div>
        ) : null}

        {currentPage?.highlights && activePage === "Profile" && <InfoHighlights items={currentPage.highlights} />}
      </main>

      <nav className="parent-bottom-nav">
        {bottomPages.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`bottom-nav-btn ${activePage === key ? "active" : ""}`}
            onClick={() => setActivePage(key)}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function AdminPortal({
  activePage,
  actionMessage,
  adminData,
  adminForms,
  menuOpen,
  onAdminFormChange,
  onCreateAnnouncement,
  onCreateGroup,
  onCreateSchedule,
  onCreatePortalAccess,
  onLogout,
  onRecordTeacherAttendance,
  selectedStudentId,
  setMenuOpen,
  setSelectedStudentId,
  setActivePage,
  onRoleChange,
  user,
  onAssignChild,
  adminTeacherFilter,
  setAdminTeacherFilter,
  onDeleteRecord,
  onUpdateTeacherProfile,
  onSendCustomNotification,
}) {
  const { announcements, customGroups, schedule, students, teacherAttendance, portalAccessList, teacherProfiles } = adminData;

  const sidebarLinks = ["Staff Profiles", "Groups", "Portal Access", "Notifications"];
  const navPages = ["Overview", "Announcements", "Schedule", "Teachers"];

  const selectedStudent =
    students.find((student) => String(student.student_id) === String(selectedStudentId)) ||
    students[0] ||
    null;

  const groupedStudents = students.reduce((accumulator, student) => {
    const key = student.groupName || "Ungrouped";
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(student);
    return accumulator;
  }, {});

  const teacherSummaries = Object.values(
    students.reduce((accumulator, student) => {
      const teacherName = student.teacherName || "Unassigned teacher";
      if (!accumulator[teacherName]) {
        accumulator[teacherName] = { teacherName, totalStudents: 0, groups: new Set() };
      }
      accumulator[teacherName].totalStudents += 1;
      accumulator[teacherName].groups.add(student.groupName || "Ungrouped");
      return accumulator;
    }, {})
  ).map((item) => ({
    teacherName: item.teacherName,
    totalStudents: item.totalStudents,
    groups: Array.from(item.groups),
  }));

  const stats = [
    { label: "Students", value: students.length, icon: Users },
    { label: "Teachers", value: teacherSummaries.length, icon: GraduationCap },
    { label: "Announcements", value: announcements.length, icon: Bell },
    { label: "Schedules", value: schedule.length, icon: Calendar },
  ];

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${!menuOpen ? 'collapsed' : ''}`}>
        <button 
          className="sidebar-toggle-btn" 
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close Sidebar" : "Open Sidebar"}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        
        <div className="sidebar-header">
           <div className="brand-header-flex">
            <img src="/logo.png" alt="Logo" className="nav-logo" />
            <div>
              <p className="brand-tag">Management Portal</p>
              <h2 className="brand-title">Admin</h2>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <p className="sidebar-category">Main Dashboard</p>
          {navPages.map(page => {
             const Icon = NAV_ICONS[page] || Layers3;
             return (
               <button key={page} className={`sidebar-link ${activePage === page ? 'active' : ''}`} onClick={() => setActivePage(page)}>
                 <Icon size={18} /> {page === "Announcements" ? "Updates" : page}
               </button>
             )
          })}
          
          <p className="sidebar-category management-cat">Management</p>
          {sidebarLinks.map(page => {
             const Icon = NAV_ICONS[page] || Users;
             return (
               <button key={page} className={`sidebar-link ${activePage === page ? 'active' : ''}`} onClick={() => setActivePage(page)}>
                 <Icon size={18} /> {page}
               </button>
             )
          })}

          <div className="sidebar-footer">
            {getAssignedRoles(user).filter(r => r !== 'admin' && r !== 'parents').map((role) => (
              <button key={role} className="sidebar-link" onClick={() => onRoleChange(role)}>
                 <LogOut size={18} /> Switch to {role}
              </button>
            ))}
            <button className="sidebar-link logout-btn" onClick={onLogout}>
              <LogOut size={18} /> Logout
            </button>
          </div>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="topbar admin-topbar-dynamic">
          <div className="brand-block">
             <h2 className="page-title">{activePage}</h2>
          </div>
        </header>

        <section className="admin-content-pad">
          {actionMessage && (
            <div className={`status-banner ${actionMessage.type}`}>{actionMessage.text}</div>
          )}

          <div className="portal-stats-strip admin-stats">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="pstat-card">
                  <span className="pstat-value">{stat.value}</span>
                  <span className="pstat-label">{stat.label}</span>
                  <span className="pstat-sub"><Icon size={12} style={{ verticalAlign: 'middle' }} /></span>
                </div>
              );
            })}
          </div>

        {activePage === "Overview" ? (
          <div className="management-grid two-columns">
            <section className="data-card">
              <div className="card-headline">
                <Sparkles size={18} />
                <h3>All Child Results</h3>
              </div>
              <div className="student-list">
                {students.map((student) => (
                  <button
                    key={student.student_id}
                    type="button"
                    className={`student-row ${selectedStudent?.student_id === student.student_id ? "selected" : ""}`}
                    onClick={() => setSelectedStudentId(student.student_id)}
                  >
                    <StudentAvatar student={student} size="small" />
                    <div>
                      <strong>{student.name}</strong>
                      <span>
                        {student.groupName} · {student.latestResult?.total_score || "No"} score
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="data-card">
              <div className="card-headline">
                <ShieldCheck size={18} />
                <h3>Individual Child Overview</h3>
              </div>
              {selectedStudent ? (
                <>
                  <div className="student-profile-hero">
                    <StudentAvatar student={selectedStudent} />
                    <div>
                      <h3>{selectedStudent.name}</h3>
                      <p>
                        {selectedStudent.groupName} · {selectedStudent.teacherName}
                      </p>
                      <div className="pill-row">
                        <span className="mini-pill">ITS: {selectedStudent.its || "N-A"}</span>
                        <span className="mini-pill">Juz: {selectedStudent.hifz?.juz || "N-A"}</span>
                        <span className="mini-pill">
                          Surah: {selectedStudent.hifz?.surat || "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <TahfeezReportCard
                    student={selectedStudent}
                    weeklyResult={selectedStudent.latestResult}
                  />
                </>
              ) : (
                <div className="empty-state">No student records found yet.</div>
              )}
            </section>
          </div>
        ) : null}

        {activePage === "Notifications" ? (
          <div className="management-grid">
            <section className="form-card">
              <div className="card-headline">
                <Send size={18} />
                <h3>Push Notification</h3>
              </div>
              <form className="stack-form" onSubmit={onSendCustomNotification}>
                <label><span>Title</span><input type="text" name="title" value={adminForms.customNotification.title} onChange={onAdminFormChange("customNotification")} required /></label>
                <label><span>Body</span><textarea name="body" value={adminForms.customNotification.body} onChange={onAdminFormChange("customNotification")} required /></label>
                <label><span>Redirect Page</span><input type="text" name="redirect_page" value={adminForms.customNotification.redirect_page} onChange={onAdminFormChange("customNotification")} /></label>
                <button type="submit" className="action-button">Send Notification</button>
              </form>
            </section>
          </div>
        ) : null}

        {activePage === "Schedule" ? (
          <div className="management-grid two-columns">
            <section className="form-card">
              <div className="card-headline">
                <Calendar size={18} />
                <h3>Create Schedule</h3>
              </div>
              <form className="stack-form" onSubmit={onCreateSchedule}>
                <div className="form-grid">
                  <label>
                    <span>Student</span>
                    <select
                      name="student_id"
                      value={adminForms.schedule.student_id}
                      onChange={onAdminFormChange("schedule")}
                      required
                    >
                      <option value="">Select child</option>
                      {students.map((student) => (
                        <option key={student.student_id} value={student.student_id}>
                          {student.name} · {student.groupName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Time</span>
                    <input
                      type="time"
                      name="task_time"
                      value={adminForms.schedule.task_time}
                      onChange={onAdminFormChange("schedule")}
                      required
                    />
                  </label>
                </div>

                <label>
                  <span>Task Name</span>
                  <input
                    type="text"
                    name="task_name"
                    value={adminForms.schedule.task_name}
                    onChange={onAdminFormChange("schedule")}
                    placeholder="Sabak, Murajaat, revision..."
                    required
                  />
                </label>

                <button type="submit" className="action-button">
                  Create Schedule
                </button>
              </form>
            </section>

            <section className="data-card">
              <div className="card-headline">
                <Clock size={18} />
                <h3>Recent Schedule Entries</h3>
              </div>
              <div className="record-stack">
                {schedule.slice(0, 12).map((item, index) => {
                  const student = students.find(
                    (entry) => String(entry.student_id) === String(item.student_id)
                  );

                  return (
                    <article key={`${item.student_id}-${item.task_time}-${index}`} className="record-card flex-row-card">
                      <div className="card-primary-info">
                        <strong>{item.task_name}</strong>
                        <span>
                          {student?.name || "Unknown child"} · {item.task_time || "--:--"}
                        </span>
                      </div>
                      <button 
                        className="delete-icon-btn" 
                        onClick={() => onDeleteRecord("schedule", "id")(item.id)}
                        aria-label="Delete schedule"
                      >
                        <Trash size={16} />
                      </button>
                    </article>
                  );
                })}
                {schedule.length === 0 ? (
                  <div className="empty-state">No schedule entries available yet.</div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {activePage === "Announcements" ? (
          <div className="management-grid two-columns">
            <section className="form-card">
              <div className="card-headline">
                <Bell size={18} />
                <h3>Create Announcement</h3>
              </div>
              <form className="stack-form" onSubmit={onCreateAnnouncement}>
                <div className="form-grid">
                  <label>
                    <span>Title</span>
                    <input
                      type="text"
                      name="title"
                      value={adminForms.announcement.title}
                      onChange={onAdminFormChange("announcement")}
                      placeholder="Weekly parent meeting"
                      required
                    />
                  </label>

                  <label>
                    <span>Type</span>
                    <select
                      name="type"
                      value={adminForms.announcement.type}
                      onChange={onAdminFormChange("announcement")}
                    >
                      <option value="Update">Update</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Event">Event</option>
                    </select>
                  </label>
                </div>

                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    name="event_date"
                    value={adminForms.announcement.event_date}
                    onChange={onAdminFormChange("announcement")}
                    required
                  />
                </label>

                <button type="submit" className="action-button">
                  Publish Announcement
                </button>
              </form>
            </section>

            <section className="data-card">
              <div className="card-headline">
                <BookOpen size={18} />
                <h3>Latest Announcements</h3>
              </div>
              <div className="record-stack">
                {announcements.map((item) => (
                  <article key={item.id || `${item.title}-${item.event_date}`} className="record-card flex-row-card">
                    <div className="card-primary-info">
                      <strong>{item.title}</strong>
                      <span>
                        {item.type || "Update"} · {item.event_date || "No date"}
                      </span>
                    </div>
                    <button 
                      className="delete-icon-btn" 
                      onClick={() => onDeleteRecord("events", "id")(item.id)}
                      aria-label="Delete announcement"
                    >
                      <Trash size={16} />
                    </button>
                  </article>
                ))}
                {announcements.length === 0 ? (
                  <div className="empty-state">No announcements available yet.</div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {activePage === "Teachers" ? (
          <div className="management-grid two-columns">
            <section className="form-card">
              <div className="card-headline">
                <Clock size={18} />
                <h3>Mark Teacher Attendance in Minutes</h3>
              </div>
              
              <div className="attendance-common-inputs">
                <label>
                  <span>Attendance Date</span>
                  <input
                    type="date"
                    name="attendance_date"
                    value={adminForms.teacherAttendance.attendance_date}
                    onChange={onAdminFormChange("teacherAttendance")}
                  />
                </label>
                <label>
                  <span>Default Minutes</span>
                  <input
                    type="number"
                    name="minutes_present"
                    value={adminForms.teacherAttendance.minutes_present}
                    onChange={onAdminFormChange("teacherAttendance")}
                    placeholder="240"
                  />
                </label>
              </div>

              <div className="teacher-attendance-grid">
                {portalAccessList
                  .filter(a => 
                    (normalizeText(a.portal_role).includes("teacher") || normalizeText(a.portal_role).includes("muhaffiz")) && 
                    (a.show_salary_card === true || String(a.show_salary_card) === 'true' || a.salary_per_minute > 0)
                  )
                  .map(teacher => {
                    const teacherGroups = customGroups.filter(g => normalizeText(g.teacher_name) === normalizeText(teacher.full_name));
                    return (
                      <div key={teacher.id} className="teacher-attend-card">
                        <div className="tcard-info">
                          <strong>{teacher.full_name}</strong>
                          <p>{teacherGroups.map(g => g.group_name).join(", ") || "No Group"}</p>
                        </div>
                        <div className="tcard-actions">
                          <button 
                            className="attend-btn present"
                            onClick={() => onRecordTeacherAttendance(null, {
                              teacher_name: teacher.full_name,
                              attendance_date: adminForms.teacherAttendance.attendance_date,
                              minutes_present: Number(adminForms.teacherAttendance.minutes_present || 240),
                              status: 'Present',
                              note: 'Quick Mark'
                            })}
                          >
                            Present
                          </button>
                          <button 
                            className="attend-btn absent"
                            onClick={() => onRecordTeacherAttendance(null, {
                              teacher_name: teacher.full_name,
                              attendance_date: adminForms.teacherAttendance.attendance_date,
                              minutes_present: 0,
                              status: 'Absent',
                              note: 'Quick Mark'
                            })}
                          >
                            Absent
                          </button>
                        </div>
                      </div>
                    );
                  })
                }
                {portalAccessList.filter(a => a.portal_role === "teacher" && a.show_salary_card === true).length === 0 && (
                  <div className="empty-state">No teachers found with 'Show Salary Card' enabled.</div>
                )}
              </div>
            </section>

            <section className="data-card">
              <div className="card-headline">
                <Users size={18} />
                <h3>Teacher Overview</h3>
              </div>
              <div className="record-stack">
                {teacherSummaries.map((teacher) => (
                  <article key={teacher.teacherName} className="record-card">
                    <strong>{teacher.teacherName}</strong>
                    <span>
                      {teacher.totalStudents} children · {teacher.groups.join(", ")}
                    </span>
                  </article>
                ))}
              </div>

              <div className="card-headline spaced">
                <ShieldCheck size={18} />
                <h3>Recent Attendance Logs</h3>
              </div>
              <div className="record-stack">
                {teacherAttendance.map((item, index) => (
                  <article key={`${item.teacher_name}-${item.attendance_date}-${index}`} className="record-card">
                    <strong>
                      {item.teacher_name} · {item.minutes_present} mins
                    </strong>
                    <span>
                      {item.status} · {item.attendance_date}
                    </span>
                  </article>
                ))}
                {teacherAttendance.length === 0 ? (
                  <div className="empty-state">No teacher attendance records yet.</div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {activePage === "Groups" ? (
          <div className="management-grid two-columns">
            <section className="form-card">
              <div className="card-headline">
                <Layers3 size={18} />
                <h3>Group Management</h3>
              </div>
              <form className="stack-form" onSubmit={onCreateGroup}>
                <div className="form-grid">
                  <label>
                    <span>Group Name</span>
                    <input
                      type="text"
                      name="group_name"
                      value={adminForms.group.group_name}
                      onChange={onAdminFormChange("group")}
                      placeholder="Senior Tahfeez"
                      required
                    />
                  </label>

                  <label>
                    <span>Teacher Name</span>
                    <input
                      type="text"
                      name="teacher_name"
                      value={adminForms.group.teacher_name}
                      onChange={onAdminFormChange("group")}
                      placeholder="Muhaffiz name"
                      required
                    />
                  </label>
                </div>

                <button type="submit" className="action-button">
                  Add Group
                </button>
              </form>

              <div className="record-stack">
                {customGroups.map((group, index) => (
                  <article key={`${group.group_name}-${index}`} className="record-card flex-row-card">
                    <div className="card-primary-info">
                      <strong>{group.group_name}</strong>
                      <span>{group.teacher_name}</span>
                    </div>
                    <button 
                      className="delete-icon-btn" 
                      onClick={() => onDeleteRecord("custom_groups", "id")(group.id)}
                      aria-label="Delete group"
                    >
                      <Trash size={16} />
                    </button>
                  </article>
                ))}
                {customGroups.length === 0 ? (
                  <div className="empty-state">No custom groups added yet.</div>
                ) : null}
              </div>
            </section>

            <section className="form-card">
              <div className="card-headline">
                <User size={18} />
                <h3>Assign Child to Muhaffiz</h3>
              </div>
              <form className="stack-form" onSubmit={onAssignChild}>
                <label>
                  <span>Select Child</span>
                  <select
                    name="student_id"
                    value={adminForms.assignChild?.student_id || ""}
                    onChange={onAdminFormChange("assignChild")}
                    required
                  >
                    <option value="">-- Choose student --</option>
                    {students.map((s) => (
                      <option key={s.student_id} value={s.student_id}>
                        {s.name} ({s.groupName})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="form-grid">
                  <label>
                    <span>Target Teacher</span>
                    <select
                      name="teacher_name"
                      value={adminForms.assignChild?.teacher_name || ""}
                      onChange={onAdminFormChange("assignChild")}
                      required
                    >
                      <option value="">-- Choose Teacher --</option>
                      {(() => {
                        const selectedGroupName = adminForms.assignChild?.group_name;
                        const teachers = portalAccessList.filter(a => normalizeText(a.portal_role) === "teacher");
                        
                        if (selectedGroupName) {
                          const groupInfo = customGroups.find(g => g.group_name === selectedGroupName);
                          if (groupInfo) {
                            return (
                              <option value={groupInfo.teacher_name}>
                                {groupInfo.teacher_name} (Group Muhaffiz)
                              </option>
                            );
                          }
                        }
                        
                        return teachers.map(a => (
                          <option key={a.id} value={a.full_name || a.email}>
                            {a.full_name || a.email}
                          </option>
                        ));
                      })()}
                    </select>
                  </label>

                  <label>
                    <span>Target Group</span>
                    <select
                      name="group_name"
                      value={adminForms.assignChild?.group_name || ""}
                      onChange={onAdminFormChange("assignChild")}
                      required
                    >
                      <option value="">-- Choose Group --</option>
                      {customGroups.map(g => (
                        <option key={g.id} value={g.group_name}>{g.group_name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <button type="submit" className="action-button">
                  Assign Child
                </button>
              </form>
            </section>

            <section className="data-card">
              <div className="card-headline">
                <Users size={18} />
                <h3>Existing Student Groups</h3>
              </div>
              <div className="group-stack">
                {Object.entries(groupedStudents).map(([groupName, members]) => (
                  <article key={groupName} className="group-card">
                    <div className="group-header">
                      <h4>{groupName}</h4>
                      <span>{members.length} children</span>
                    </div>
                    <div className="pill-row">
                      {members.slice(0, 5).map((student) => (
                        <span key={student.student_id} className="mini-pill">
                          {student.name}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activePage === "Staff Profiles" ? (
          <div className="management-grid two-columns">
            <section className="form-card">
              <div className="card-headline">
                <User size={18} />
                <h3>Update Staff Profile</h3>
              </div>
              <form className="stack-form" onSubmit={onUpdateTeacherProfile}>
                <label>
                  <span>Teacher Full Name (Must match Supabase Auth name)</span>
                  <input
                    type="text"
                    name="full_name"
                    value={adminForms.teacherProfile.full_name}
                    onChange={onAdminFormChange("teacherProfile")}
                    placeholder="Muhaffiz Ahmed"
                    required
                  />
                </label>
                <div className="form-grid">
                  <label>
                    <span>Phone Number</span>
                    <input
                      type="text"
                      name="phone_number"
                      value={adminForms.teacherProfile.phone_number}
                      onChange={onAdminFormChange("teacherProfile")}
                      placeholder="+92 300 1234567"
                    />
                  </label>
                  <label>
                    <span>WhatsApp Number</span>
                    <input
                      type="text"
                      name="whatsapp_number"
                      value={adminForms.teacherProfile.whatsapp_number}
                      onChange={onAdminFormChange("teacherProfile")}
                      placeholder="923001234567"
                    />
                  </label>
                </div>
                <label>
                  <span>Profile Photo URL</span>
                  <input
                    type="text"
                    name="photo_url"
                    value={adminForms.teacherProfile.photo_url}
                    onChange={onAdminFormChange("teacherProfile")}
                    placeholder="https://example.com/photo.jpg"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    <span>Salary per Minute</span>
                    <input
                      type="number"
                      step="0.1"
                      name="salary_per_minute"
                      value={adminForms.teacherProfile.salary_per_minute || "2.3"}
                      onChange={onAdminFormChange("teacherProfile")}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
                    <input
                      type="checkbox"
                      name="show_salary_card"
                      checked={adminForms.teacherProfile.show_salary_card}
                      onChange={(e) => {
                        const { checked } = e.target;
                        setAdminForms(curr => ({
                          ...curr,
                          teacherProfile: { ...curr.teacherProfile, show_salary_card: checked }
                        }));
                      }}
                    />
                    <span>Show Salary Card to Teacher</span>
                  </label>
                </div>
                <button type="submit" className="action-button">Save Profile</button>
              </form>
            </section>

            <section className="data-card">
              <div className="card-headline">
                <ShieldCheck size={18} />
                <h3>Existing Profiles</h3>
              </div>
              <div className="record-stack">
                {teacherProfiles.map(profile => (
                  <article key={profile.id} className="record-card flex-row-card">
                    <div className="profile-identity-row">
                      <img src={profile.photo_url || "/default-avatar.png"} alt="" className="user-dp-badge" />
                      <div>
                        <strong>{profile.full_name}</strong>
                        <p style={{ fontSize: '11px' }}>{profile.whatsapp_number}</p>
                      </div>
                    </div>
                    <button 
                      className="delete-icon-btn" 
                      onClick={() => onDeleteRecord("teacher_profiles", "id")(profile.id)}
                    >
                      <Trash size={16} />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activePage === "Portal Access" ? (
          <div className="management-grid two-columns">
            <section className="form-card">
              <div className="card-headline">
                <ShieldCheck size={18} />
                <h3>Grant Portal Access</h3>
              </div>
              <form className="stack-form" onSubmit={onCreatePortalAccess}>
                <div className="form-grid">
                  <label>
                    <span>User Email</span>
                    <input
                      type="email"
                      name="email"
                      value={adminForms.portalAccess.email}
                      onChange={onAdminFormChange("portalAccess")}
                      placeholder="user@example.com"
                      required
                    />
                  </label>
                  <label>
                    <span>Full Name</span>
                    <input
                      type="text"
                      name="full_name"
                      value={adminForms.portalAccess.full_name}
                      onChange={onAdminFormChange("portalAccess")}
                      placeholder="Enter name"
                      required
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label>
                    <span>Portal Role</span>
                    <select
                      name="portal_role"
                      value={adminForms.portalAccess.portal_role}
                      onChange={onAdminFormChange("portalAccess")}
                      required
                    >
                      <option value="parents">Parents Portal</option>
                      <option value="teacher">Teacher Portal</option>
                      <option value="admin">Admin Portal</option>
                    </select>
                  </label>
                  <label>
                    <span>Link to Student (Parents only)</span>
                    <select
                      name="student_id"
                      value={adminForms.portalAccess.student_id}
                      onChange={onAdminFormChange("portalAccess")}
                    >
                      <option value="">-- No Student Linked --</option>
                      {students.map((s) => (
                        <option key={s.student_id} value={s.student_id}>
                          {s.name} ({s.groupName})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>


                <button type="submit" className="action-button">
                  Grant Access
                </button>
                <p className="hint-text" style={{ marginTop: "12px", fontSize: "14px", color: "var(--text-secondary)" }}>
                  The user must first create an account with this email in the app before you can grant them access.
                </p>
              </form>
            </section>

            <section className="data-card">
              <div className="card-headline">
                <Users size={18} />
                <h3>Current Portal Access</h3>
              </div>
              <div className="record-stack">
                {portalAccessList && portalAccessList.map((access, index) => (
                  <article key={access.id || index} className="record-card flex-row-card">
                    <div className="card-primary-info">
                      <strong>{access.full_name || access.email}</strong>
                      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                        <span className={`badge ${access.portal_role}`}>{ROLE_LABELS[access.portal_role]}</span>
                        {access.portal_role === "teacher" && (
                          <span className="badge info">{`${access.salary_per_minute} rs-min`}</span>
                        )}
                      </div>
                      <span style={{ fontSize: "12px", opacity: 0.7 }}>{access.email}</span>
                    </div>
                    <button 
                      className="delete-icon-btn" 
                      onClick={() => onDeleteRecord("user_portal_access", "id")(access.id)}
                      aria-label="Delete access"
                    >
                      <Trash size={16} />
                    </button>
                  </article>
                ))}
                {(!portalAccessList || portalAccessList.length === 0) ? (
                  <div className="empty-state">No access records found.</div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
        </section>
      </main>
    </div>
  );
}

function TeacherPortal({
  actionMessage,
  activePage,
  menuOpen,
  onLogout,
  onTeacherFormChange,
  onTeacherGroupFilterChange,
  onTeacherResultSubmit,
  onRoleChange,
  setActivePage,
  setMenuOpen,
  teacherData,
  teacherForms,
  user,
  portalAccess,
  monthlySalary,
}) {
  const { availableGroups, filteredStudents, selectedGroup, teacherIdentity } = teacherData;
  const selectedStudent =
    filteredStudents.find(
      (student) => String(student.student_id) === String(teacherForms.result.student_id)
    ) || filteredStudents[0] || null;

  const liveResult = useMemo(() => {
    if (!selectedStudent) return null;
    const form = teacherForms.result;
    const total_score = RESULT_NUMERIC_FIELDS.reduce((sum, f) => sum + toNumber(form[f]), 0);
    
    return {
      ...selectedStudent.latestResult,
      ...form,
      total_score
    };
  }, [selectedStudent, teacherForms.result]);

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${!menuOpen ? 'collapsed' : ''}`}>
        <button 
          className="sidebar-toggle-btn" 
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close" : "Open"}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="sidebar-header">
           <div className="brand-header-flex">
            <img src={portalAccess?.photo_url || "/logo.png"} alt="Logo" className="nav-logo" />
            <div>
              <p className="brand-tag">Teacher Portal</p>
              <h2 className="brand-title">{portalAccess?.full_name || "Teacher"}</h2>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <p className="sidebar-category management-cat">Workplace</p>
          {[
            { id: "My Group", label: "Students", icon: Users },
            { id: "Fill Result", label: "Mark Progress", icon: Sparkles },
            { id: "Overview", label: "Performance", icon: Layers3 },
          ].map(page => (
            <button key={page.id} className={`sidebar-link ${activePage === page.id ? 'active' : ''}`} onClick={() => setActivePage(page.id)}>
              <page.icon size={18} /> {page.label}
            </button>
          ))}
          
          <div className="sidebar-footer">
            {getAssignedRoles(user).filter(r => r !== 'teacher' && r !== 'parents').map((role) => (
              <button key={role} className="sidebar-link" onClick={() => onRoleChange(role)}>
                 <LogOut size={18} /> Switch to {role}
              </button>
            ))}
            <button className="sidebar-link logout-btn" onClick={onLogout}>
              <LogOut size={18} /> Logout
            </button>
          </div>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="topbar">
          <div className="brand-block">
             <h2 className="page-title">{activePage}</h2>
          </div>
          {portalAccess.show_salary_card && monthlySalary && (
            <div className="salary-pill">
              Estimated: <strong>{monthlySalary.amount?.toFixed(0) || "0"}rs</strong>
            </div>
          )}
        </header>

        <section className="admin-content-pad">
          {actionMessage && (
            <div className={`status-banner ${actionMessage.type}`}>{actionMessage.text}</div>
          )}

        {activePage === "My Group" ? (
          <div className="portal-content">
            <div className="portal-stats-strip teacher-stats">
              <div className="pstat-card">
                <span className="pstat-value">{filteredStudents.length}</span>
                <span className="pstat-label">Students</span>
                <span className="pstat-sub">In my group</span>
              </div>
              <div className="pstat-card">
                <span className="pstat-value">
                  {Math.round((filteredStudents.filter(s => s.latestResult).length / Math.max(filteredStudents.length, 1)) * 100) || 0}%
                </span>
                <span className="pstat-label">Results</span>
                <span className="pstat-sub">Submitted</span>
              </div>
              <div className="pstat-card">
                <span className="pstat-value">
                  {filteredStudents.length > 0
                    ? Math.round(filteredStudents.reduce((sum, s) => sum + (Number(s.latestResult?.total_score) || 0), 0) / filteredStudents.length)
                    : "--"}
                </span>
                <span className="pstat-label">Avg Score</span>
                <span className="pstat-sub">This week</span>
              </div>
              {portalAccess?.show_salary_card && monthlySalary && (
                <div className="pstat-card">
                  <span className="pstat-value" style={{ fontSize: '0.9rem' }}>Rs. {monthlySalary.amount?.toFixed(0) || "0"}</span>
                  <span className="pstat-label">Salary</span>
                  <span className="pstat-sub">This month</span>
                </div>
              )}
            </div>
            {portalAccess?.show_salary_card && monthlySalary && (
              <section className="data-card salary-callout">
                <div className="card-headline">
                  <Sparkles size={18} />
                  <h3>Monthly Salary Update</h3>
                </div>
                <div className="salary-flex">
                  <div className="salary-item">
                    <span className="salary-label">Total Minutes</span>
                    <span className="salary-value">{monthlySalary.totalMinutes}</span>
                  </div>
                  <div className="salary-item">
                    <span className="salary-label">{"Rate - Min"}</span>
                    <span className="salary-value">₹{monthlySalary.rate}</span>
                  </div>
                  <div className="salary-item total-item">
                    <span className="salary-label">Total Amount</span>
                    <span className="salary-value highlight">₹{monthlySalary.amount?.toFixed(2) || "0.00"}</span>
                  </div>
                </div>
                <p className="hint-text">Calculated based on {monthlySalary.daysPresent} days of attendance verified by admin.</p>
              </section>
            )}

            <div className="student-card-grid">
              {filteredStudents.map((student) => (
                <article key={student.student_id} className="student-card">
                  <div className="student-card-head">
                    <StudentAvatar student={student} />
                    <div>
                      <h3>{student.name}</h3>
                      <p>{student.groupName}</p>
                    </div>
                  </div>
                  <div className="pill-row">
                    <span className="mini-pill">Juz {student.hifz?.juz || "N/A"}</span>
                    <span className="mini-pill">{student.hifz?.surat || "No surah set"}</span>
                  </div>
                  <p className="student-status-copy">{student.hifzStatus}</p>
                </article>
              ))}
              {filteredStudents.length === 0 ? (
                <div className="empty-state">No children found for this teacher filter.</div>
              ) : null}
            </div>
          </div>
        ) : null}

        {activePage === "Fill Result" ? (
          <div className="management-grid two-columns">
            <section className="form-card">
              <div className="card-headline">
                <BookOpen size={18} />
                <h3>Fill Tahfeez Report</h3>
              </div>
              <form className="stack-form" onSubmit={onTeacherResultSubmit}>
                <div className="form-grid">
                  <label>
                    <span>Child</span>
                    <select
                      name="student_id"
                      value={teacherForms.result.student_id}
                      onChange={onTeacherFormChange}
                      required
                    >
                      <option value="">Select child</option>
                      {filteredStudents.map((student) => (
                        <option key={student.student_id} value={student.student_id}>
                          {student.name} · {student.groupName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Fatemi (Misri) Calendar Date</span>
                    <FatemiDateSelector
                      value={teacherForms.result.week_date}
                      onChange={onTeacherFormChange}
                    />
                  </label>
                </div>

                <div className="form-grid four-up">
                  <label>
                    <span>Murajazah</span>
                    <input
                      type="number"
                      min="0"
                      name="murajazah"
                      value={teacherForms.result.murajazah}
                      onChange={onTeacherFormChange}
                      required
                    />
                  </label>

                  <label>
                    <span>Juz Hali</span>
                    <input
                      type="number"
                      min="0"
                      name="juz_hali"
                      value={teacherForms.result.juz_hali}
                      onChange={onTeacherFormChange}
                      required
                    />
                  </label>

                  <label>
                    <span>Takhteet</span>
                    <input
                      type="number"
                      min="0"
                      name="takhteet"
                      value={teacherForms.result.takhteet}
                      onChange={onTeacherFormChange}
                      required
                    />
                  </label>

                  <label>
                    <span>Jadeed</span>
                    <input
                      type="number"
                      min="0"
                      name="jadeed"
                      value={teacherForms.result.jadeed}
                      onChange={onTeacherFormChange}
                      required
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label>
                    <span>Rank</span>
                    <input
                      type="text"
                      name="rank"
                      value={teacherForms.result.rank}
                      onChange={onTeacherFormChange}
                      placeholder={"A-1 Excellent"}
                    />
                  </label>

                  <label>
                    <span>Total Jadeed Pages</span>
                    <input
                      type="number"
                      min="0"
                      name="total_jadeed_pages"
                      value={teacherForms.result.total_jadeed_pages}
                      onChange={onTeacherFormChange}
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label>
                    <span>Wusool Juz</span>
                    <input
                      type="text"
                      name="wusool_juz"
                      value={teacherForms.result.wusool_juz}
                      onChange={onTeacherFormChange}
                    />
                  </label>
                  <label>
                    <span>Wusool Page</span>
                    <input
                      type="text"
                      name="wusool_page"
                      value={teacherForms.result.wusool_page}
                      onChange={onTeacherFormChange}
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label>
                    <span>Matrookah (متروكة)</span>
                    <input
                      type="text"
                      name="matrookah"
                      value={teacherForms.result.matrookah}
                      onChange={onTeacherFormChange}
                      placeholder="e.g. 1, 2, 5"
                    />
                  </label>
                  <label>
                    <span>Daeefah (ضعيفة)</span>
                    <input
                      type="text"
                      name="daeefah"
                      value={teacherForms.result.daeefah}
                      onChange={onTeacherFormChange}
                      placeholder="e.g. 3, 7"
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label>
                    <span>Next Week Juz</span>
                    <input
                      type="text"
                      name="next_week_juz"
                      value={teacherForms.result.next_week_juz}
                      onChange={onTeacherFormChange}
                    />
                  </label>

                  <label>
                    <span>Next Week Page</span>
                    <input
                      type="text"
                      name="next_week_page"
                      value={teacherForms.result.next_week_page}
                      onChange={onTeacherFormChange}
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label>
                    <span>Istifadah Juz</span>
                    <input
                      type="text"
                      name="istifadah_juz"
                      value={teacherForms.result.istifadah_juz}
                      onChange={onTeacherFormChange}
                    />
                  </label>

                  <label>
                    <span>Istifadah Page</span>
                    <input
                      type="text"
                      name="istifadah_page"
                      value={teacherForms.result.istifadah_page}
                      onChange={onTeacherFormChange}
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label>
                    <span>Attendance Count</span>
                    <input
                      type="number"
                      min="0"
                      name="attendance_count"
                      value={teacherForms.result.attendance_count}
                      onChange={onTeacherFormChange}
                    />
                  </label>
                </div>

                <label>
                  <span>{"Attendance-Performance Note"}</span>
                  <textarea
                    name="attendance_note"
                    rows="3"
                    value={teacherForms.result.attendance_note}
                    onChange={onTeacherFormChange}
                    placeholder="Behaviour, attendance, or memorization note"
                  />
                </label>

                <button type="submit" className="action-button">
                  Save Result
                </button>
              </form>
            </section>

            <section className="data-card">
              <div className="card-headline">
                <Sparkles size={18} />
                <h3>Selected Child Preview</h3>
              </div>
              {selectedStudent ? (
                <>
                  <div className="student-profile-hero">
                    <StudentAvatar student={selectedStudent} />
                    <div>
                      <h3>{selectedStudent.name}</h3>
                      <p>
                        {selectedStudent.groupName} · {selectedStudent.teacherName}
                      </p>
                    </div>
                  </div>
                   <TahfeezReportCard
                    student={selectedStudent}
                    weeklyResult={liveResult}
                  />
                </>
              ) : (
                <div className="empty-state">
                  Choose a child from your group to fill a result.
                </div>
              )}
            </section>
          </div>
        ) : null}

        {activePage === "Overview" ? (
          <div className="management-grid">
            <div className="data-card">
              <div className="card-headline">
                <Sparkles size={18} />
                <h3>Your Students Performance</h3>
              </div>
              <div className="record-stack">
                {filteredStudents.map((student) => (
                  <article key={student.student_id} className="record-card">
                    <div className="card-primary-info">
                       <strong>{student.name}</strong>
                       <span>{student.hifzStatus}</span>
                    </div>
                    <div className="performance-pill">
                       Latest Result: {student.latestResult?.rank || "pending"}
                    </div>
                  </article>
                ))}
                {filteredStudents.length === 0 && (
                  <div className="empty-state">No students found in your group.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const [notificationPermission, setNotificationPermission] = useState(
    "Notification" in window ? Notification.permission : "denied"
  );
  const [user, setUser] = useState(null);
  const [portalAccess, setPortalAccess] = useState(emptyPortalAccess);
  const [portalRole, setPortalRole] = useState(() => {
    if (typeof window === "undefined") {
      return "parents";
    }

    return window.localStorage.getItem(STORAGE_KEYS.role) || "parents";
  });
  const [activePage, setActivePage] = useState(DEFAULT_PAGE_BY_ROLE.parents);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [parentData, setParentData] = useState(emptyParentData);
  const [schoolData, setSchoolData] = useState({
    students: [],
    weeklyResults: [],
    announcements: [],
    schedule: [],
    portalAccessList: [],
    teacherProfiles: [],
  });
  const [customGroups, setCustomGroups] = useState([]);
  const [teacherAttendance, setTeacherAttendance] = useState([]);
  const [teacherGroupFilter, setTeacherGroupFilter] = useState("All");
  const [adminTeacherFilter, setAdminTeacherFilter] = useState("All");
  const [teacherProfiles, setTeacherProfiles] = useState([]);
  const [adminForms, setAdminForms] = useState({
    announcement: {
      title: "",
      type: "Update",
      event_date: getToday(),
    },
    customNotification: {
      title: "",
      body: "",
      target_audience: "all",
      target_uuid: "",
      redirect_page: "Home"
    },
    schedule: {
      student_id: "",
      task_time: "08:00",
      task_name: "",
    },
    teacherAttendance: {
      teacher_name: "",
      attendance_date: getToday(),
      minutes_present: "",
      status: "Present",
      note: "",
    },
    group: {
      group_name: "",
      teacher_name: "",
    },
    portalAccess: {
      email: "",
      full_name: "",
      portal_role: "parents",
      student_id: "",
      salary_per_minute: "2.3",
      show_salary_card: false,
    },
    assignChild: {
      student_id: "",
      teacher_name: "",
      group_name: "",
    },
    teacherProfile: {
      user_id: "",
      full_name: "",
      photo_url: "",
      phone_number: "",
      whatsapp_number: "",
      salary_per_minute: "2.3",
      show_salary_card: true,
    },
  });
  const [teacherForms, setTeacherForms] = useState({
    result: {
      student_id: "",
      week_date: getToday(),
      murajazah: "",
      juz_hali: "",
      takhteet: "",
      jadeed: "",
      rank: "",
      next_week_juz: "",
      next_week_page: "",
      total_jadeed_pages: "",
      istifadah_juz: "",
      istifadah_page: "",
      wusool_juz: "",
      wusool_page: "",
      matrookah: "",
      daeefah: "",
      attendance_count: "",
      attendance_note: "",
    },
  });

  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    setActivePage(DEFAULT_PAGE_BY_ROLE[portalRole] || DEFAULT_PAGE_BY_ROLE.parents);
    setMenuOpen(false);
    setActionMessage(null);
  }, [portalRole]);

  useEffect(() => {
    let mounted = true;
    
    const failsafe = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    async function initialize() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session) {
        handleAuthChange("INITIAL_SESSION", session);
      } else {
        setLoading(false);
      }
    }

    async function handleAuthChange(event, session) {
      if (!mounted) return;
      console.log("Auth event:", event);

      if (session) {
        setUser(session.user);
        try {
          const access = await resolveInitialPortal(
            session.user,
            window.localStorage.getItem(STORAGE_KEYS.role) || "parents"
          );

          if (mounted) {
            if (!access.ok) {
              await supabase.auth.signOut();
              setActionMessage({ type: "error", text: access.message });
              setLoading(false);
              return;
            }

            storeRole(access.role);
            setPortalAccess(access.accessRow || emptyPortalAccess);
            await loadPortalData(access.role, session.user, access.parentProfile);
          }
        } catch (err) {
          console.error("Auth initialization error:", err);
          if (mounted) setLoading(false);
        }
      } else {
        if (mounted) {
          setUser(null);
          setPortalAccess(emptyPortalAccess);
          setParentData(emptyParentData);
          setLoading(false);
        }
      }
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthChange(event, session);
    });

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  async function loadPortalData(role, currentUser, parentProfileOverride = null) {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      if (role === "parents") {
        const profileData = parentProfileOverride || (await findParentProfile(currentUser.id));

        let nextParentState = {
          studentProfile: profileData,
          hifzDetails: null,
          announcements: [],
          schedule: [],
          attendance: null,
          weeklyResult: null,
        };

        if (profileData) {
          const [
            hifzResponse,
            attendanceResponse,
            scheduleResponse,
            resultResponse,
            announcementResponse,
            teacherProfilesResponse,
          ] = await Promise.all([
            supabase
              .from("hifz_details")
              .select("*")
              .eq("student_id", profileData.student_id)
              .maybeSingle(),
            supabase
              .from("attendance")
              .select("*")
              .eq("student_id", profileData.student_id)
              .order("attendance_date", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase.from("schedule").select("*").eq("student_id", profileData.student_id),
            supabase
              .from("weekly_results")
              .select("*")
              .eq("student_id", profileData.student_id)
              .order("week_date", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase.from("events").select("*").order("event_date", { ascending: false }),
            supabase.from("teacher_profiles").select("*").order("full_name", { ascending: true }),
          ]);

          nextParentState = {
            studentProfile: profileData,
            hifzDetails: hifzResponse.data || null,
            announcements: announcementResponse.data || [],
            schedule: scheduleResponse.data || [],
            attendance: attendanceResponse.data || null,
            weeklyResult: resultResponse.data || null,
            teacherProfiles: teacherProfilesResponse.data || [],
          };
        }

        setParentData(nextParentState);
        setTeacherProfiles(nextParentState.teacherProfiles || []);
      } else {
        const [
          profilesResponse,
          hifzResponse,
          resultsResponse,
          eventsResponse,
          scheduleResponse,
          portalAccessResponse,
          groupsResponse,
          attendanceResponse,
          teacherProfilesResponse,
        ] = await Promise.all([
          supabase.from("profiles").select("*").order("name", { ascending: true }),
          supabase.from("hifz_details").select("*"),
          supabase.from("weekly_results").select("*").order("week_date", { ascending: false }),
          supabase.from("events").select("*").order("event_date", { ascending: false }),
          supabase.from("schedule").select("*").order("task_time", { ascending: true }),
          supabase.from("user_portal_access").select("*").order("created_at", { ascending: false }),
          supabase.from("custom_groups").select("*").order("group_name", { ascending: true }),
          supabase.from("teacher_attendance").select("*").order("attendance_date", { ascending: false }),
          supabase.from("teacher_profiles").select("*").order("full_name", { ascending: true }),
        ]);

        const students = buildStudents(
          profilesResponse.data || [],
          hifzResponse.data || [],
          resultsResponse.data || []
        );

        setTeacherAttendance(attendanceResponse.data || []);
        setCustomGroups(groupsResponse.data || []);
        const enrichedProfiles = (teacherProfilesResponse.data || []).map(profile => {
          const access = (portalAccessResponse.data || []).find(a => normalizeText(a.full_name) === normalizeText(profile.full_name));
          return {
            ...profile,
            salary_per_minute: access?.salary_per_minute || 2.3,
            show_salary_card: access?.show_salary_card ?? true
          };
        });
        setTeacherProfiles(enrichedProfiles);

        setSchoolData({
          students,
          weeklyResults: resultsResponse.data || [],
          announcements: eventsResponse.data || [],
          schedule: scheduleResponse.data || [],
          portalAccessList: portalAccessResponse.data || [],
          teacherProfiles: enrichedProfiles,
        });

        if (students.length > 0) {
          setSelectedStudentId((current) => current || students[0].student_id);
          setAdminForms((current) => ({
            ...current,
            schedule: {
              ...current.schedule,
              student_id: current.schedule.student_id || students[0].student_id,
            },
            teacherAttendance: {
              ...current.teacherAttendance,
              teacher_name:
                current.teacherAttendance.teacher_name || students[0].teacherName || "",
            },
          }));
          setTeacherForms((current) => ({
            ...current,
            result: {
              ...current.result,
              student_id: current.result.student_id || students[0].student_id,
            },
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching portal data:", error);
      setActionMessage({
        type: "error",
        text: "Some data could not be loaded. Please check your table permissions and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  const teacherIdentity = useMemo(() => guessTeacherIdentity(user, portalAccess), [user, portalAccess]);

  const teacherData = useMemo(() => {
    const availableGroups = Array.from(
      new Set(schoolData.students.map((student) => student.groupName).filter(Boolean))
    );

    const matchedStudents = schoolData.students.filter((student) => {
      const teacherMatches = normalizeText(student.teacherName).includes(
        normalizeText(teacherIdentity)
      );
      const groupMatches = normalizeText(student.groupName).includes(normalizeText(teacherIdentity));

      return teacherMatches || groupMatches;
    });

    const filteredStudents = matchedStudents;

    return {
      availableGroups,
      teacherIdentity,
      selectedGroup: teacherGroupFilter,
      filteredStudents,
      attendances: teacherAttendance,
    };
  }, [schoolData.students, teacherGroupFilter, teacherIdentity, teacherAttendance]);

  const monthlySalary = useMemo(() => {
    if (portalRole !== "teacher") return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthAttendance = (teacherData.attendances || []).filter((a) => {
      const d = new Date(a.attendance_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalMinutes = monthAttendance.reduce((sum, a) => sum + toNumber(a.minutes_present), 0);
    const teacherProfile = (teacherProfiles || []).find(p => 
      normalizeText(p.full_name) === normalizeText(teacherIdentity)
    );
    const rate = toNumber(teacherProfile?.salary_per_minute || portalAccess.salary_per_minute || 2.3);
    const showCard = teacherProfile ? !!teacherProfile.show_salary_card : !!portalAccess.show_salary_card;

    return {
      totalMinutes,
      rate,
      amount: totalMinutes * rate,
      daysPresent: monthAttendance.length,
      showCard
    };
  }, [teacherData.attendances, portalAccess.salary_per_minute, portalAccess.show_salary_card, portalRole, teacherProfiles, teacherIdentity]);

  function storeRole(role) {
    setPortalRole(role);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.role, role);
    }
  }

  function showAction(type, text) {
    setActionMessage({ type, text });
  }

  const handleLoginSuccess = async (loggedInUser, selectedRole) => {
    try {
      const access = await authorizePortalAccess(loggedInUser, selectedRole);

      if (!access.ok) {
        await supabase.auth.signOut();
        return {
          ok: false,
          message: access.message,
        };
      }

      storeRole(access.role);
      setPortalAccess(access.accessRow || emptyPortalAccess);
      setUser(loggedInUser);
      await loadPortalData(access.role, loggedInUser, access.parentProfile);

      return { ok: true };
    } catch (error) {
      console.error("Portal authorization failed:", error);
      await supabase.auth.signOut();
      return {
        ok: false,
        message: "We could not verify this account for the selected portal.",
      };
    }
  };

  const handleLogout = async () => {
    setUser(null);
    setPortalAccess(emptyPortalAccess);
    setParentData(emptyParentData);
    setSchoolData({
      students: [],
      weeklyResults: [],
      announcements: [],
      schedule: [],
      portalAccessList: [],
    });
    showAction(null, null);

    await supabase.auth.signOut();
  };

  const handleCreatePortalAccess = async (event) => {
    event.preventDefault();

    const payload = adminForms.portalAccess;

    const { error } = await supabase.rpc("grant_portal_access", {
      target_email: payload.email,
      target_role: payload.portal_role,
      target_name: payload.full_name,
      target_student_id: payload.student_id || null,
    });

    if (error) {
      showAction("error", error.message);
      return;
    }

    const { data } = await supabase.from("user_portal_access").select("*").order("created_at", { ascending: false });
    if (data) {
      setSchoolData((current) => ({
        ...current,
        portalAccessList: data,
      }));
    }

    setAdminForms((current) => ({
      ...current,
      portalAccess: { email: "", full_name: "", portal_role: "parents" },
    }));
    showAction("success", "Portal access granted successfully.");
    sendPushNotification("Access Granted", `Welcome ${payload.full_name}!`);
  };

  useEffect(() => {
    if (!user || notificationPermission !== "granted") return;
    
    // We only want notifications that happened while we are looking at the page, 
    // or very recently. Using a ref or just simple time tracking:
    let lastChecked = new Date().toISOString();

    const checkNotifications = async () => {
      const { data, error } = await supabase
        .from("system_notifications")
        .select("*")
        .gt("created_at", lastChecked)
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        data.forEach(notif => {
          const isTargeted = 
            notif.target_role === "all" || 
            notif.target_role === portalRole ||
            notif.target_user === user.id ||
            notif.target_user === user.email;

          if (isTargeted) {
            sendPushNotification(notif.title, notif.body, notif.redirect_page);
          }
        });
        lastChecked = data[data.length - 1].created_at;
      }
    };

    const interval = setInterval(checkNotifications, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [user, portalRole, notificationPermission]);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      showAction("success", "Notifications Enabled!");
    }
  };

  const handleAdminFormChange = (formKey) => (event) => {
    const { name, value } = event.target;
    setAdminForms((current) => ({
      ...current,
      [formKey]: {
        ...current[formKey],
        [name]: value,
      },
    }));
  };

  const handleTeacherFormChange = async (event) => {
    const { name, value } = event.target;
    
    setTeacherForms((current) => ({
      ...current,
      result: {
        ...current.result,
        [name]: value,
      },
    }));

    if (name === "student_id" || name === "week_date") {
      const studentId = name === "student_id" ? value : teacherForms.result.student_id;
      const weekDate = name === "week_date" ? value : teacherForms.result.week_date;

      if (studentId && weekDate) {
        const existing = schoolData.weeklyResults.find(r => 
          String(r.student_id) === String(studentId) && r.week_date === weekDate
        );

        if (existing) {
          setTeacherForms(curr => ({
            ...curr,
            result: { ...curr.result, ...existing, student_id: studentId, week_date: weekDate }
          }));
        } else {
          const { data, error } = await supabase
            .from("weekly_results")
            .upsert({ 
              student_id: studentId, 
              week_date: weekDate,
              murajazah: 0,
              juz_hali: 0,
              takhteet: 0,
              jadeed: 0
            }, { onConflict: 'student_id,week_date' })
            .select()
            .maybeSingle();

          if (data) {
             setTeacherForms(curr => ({
              ...curr,
              result: { ...curr.result, ...data, student_id: studentId, week_date: weekDate }
            }));
            setSchoolData(prev => ({
              ...prev,
              weeklyResults: [data, ...prev.weeklyResults]
            }));
          }
        }
      }
    }
  };

  const handleSendCustomNotification = async (event) => {
    event.preventDefault();
    const payload = adminForms.customNotification;

    let notifTitle = `[${payload.target_audience.toUpperCase()}] ${payload.title}`;
    if (payload.target_audience === "user" && payload.target_uuid) {
       notifTitle = `[Direct] ${payload.title}`;
    }

    // 1. Send locally to sender
    sendPushNotification(notifTitle, payload.body, payload.redirect_page);
    
    // 2. Save to DB for cross-device pushing
    const dbPayload = {
      title: notifTitle,
      body: payload.body,
      target_role: payload.target_audience === "user" ? "user" : payload.target_audience,
      target_user: payload.target_audience === "user" ? payload.target_uuid : null,
      redirect_page: payload.redirect_page
    };
    await supabase.from("system_notifications").insert([dbPayload]);

    showAction("success", "Custom Notification Dispatched!");

    setAdminForms((current) => ({
      ...current,
      customNotification: { title: "", body: "", target_audience: "all", target_uuid: "", redirect_page: "Home" },
    }));
  };

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();

    const payload = adminForms.announcement;

    const { data, error } = await supabase.from("events").insert([payload]).select().single();

    if (error) {
      showAction("error", error.message);
      return;
    }

    setSchoolData((current) => ({
      ...current,
      announcements: [data, ...current.announcements],
    }));
    setAdminForms((current) => ({
      ...current,
      announcement: { title: "", type: "Update", event_date: getToday() },
    }));
    showAction("success", "Announcement created successfully.");
    sendPushNotification("New Update!", payload.title);
  };

  const handleCreateSchedule = async (event) => {
    event.preventDefault();

    const payload = {
      student_id: adminForms.schedule.student_id,
      task_time: adminForms.schedule.task_time,
      task_name: adminForms.schedule.task_name,
      is_done: false,
    };

    const { data, error } = await supabase.from("schedule").insert([payload]).select().single();

    if (error) {
      showAction("error", error.message);
      return;
    }

    setSchoolData((current) => ({
      ...current,
      schedule: [...current.schedule, data],
    }));
    setAdminForms((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        task_name: "",
      },
    }));
    showAction("success", "Schedule created successfully.");
    sendPushNotification("Schedule Updated", `New task added: ${payload.task_name}`);
  };

  const handleRecordTeacherAttendance = async (event, quickRecord = null) => {
    if (event && event.preventDefault) event.preventDefault();

    const record = quickRecord || {
      teacher_name: adminForms.teacherAttendance.teacher_name,
      attendance_date: adminForms.teacherAttendance.attendance_date,
      minutes_present: Number(adminForms.teacherAttendance.minutes_present || 0),
      status: adminForms.teacherAttendance.status,
      note: adminForms.teacherAttendance.note,
    };

    const { data, error } = await supabase.from("teacher_attendance").insert([record]).select().single();

    if (error) {
      showAction("error", error.message);
      return;
    }

    setTeacherAttendance((current) => [data, ...current]);
    setAdminForms((current) => ({
      ...current,
      teacherAttendance: {
        ...current.teacherAttendance,
        minutes_present: "",
        note: "",
      },
    }));
    showAction("success", "Teacher attendance saved.");
  };

  const handleCreateGroup = async (event) => {
    event.preventDefault();

    const payload = {
      group_name: adminForms.group.group_name,
      teacher_name: adminForms.group.teacher_name,
    };

    const { data, error } = await supabase.from("custom_groups").insert([payload]).select().single();

    if (error) {
      showAction("error", error.message);
      return;
    }

    setCustomGroups((current) => [data, ...current]);
    setAdminForms((current) => ({
      ...current,
      group: {
        group_name: "",
        teacher_name: "",
      },
      customNotification: {
        title: "",
        body: "",
        target_audience: "all",
        target_uuid: "",
        redirect_page: "Home"
      }
    }));
    showAction("success", "Group added successfully.");
  };

  const handleAssignChild = async (event, isQuick = false) => {
    if (event.preventDefault) event.preventDefault();
    
    let student_id, teacher_name, group_name;
    
    if (isQuick) {
      student_id = event.target.student_id;
      teacher_name = event.target.teacher_name;
      group_name = event.target.group_name;
    } else {
      ({ student_id, teacher_name, group_name } = adminForms.assignChild);
    }

    if (!student_id) return;

    // Search for teacher user_id to store as muhaffiz_id
    const teacherRecord = portalAccessList.find(a => normalizeText(a.full_name) === normalizeText(teacher_name));

    // We update multiple tables to ensure consistency across the app's lookups
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ 
        teacher_name, 
        group_name, 
        class_level: group_name,
        muhaffiz_id: teacherRecord?.user_id || null 
      })
      .eq("student_id", student_id);

    // Try to update existing record first
    const { error: hifzUpdateError } = await supabase
      .from("hifz_details")
      .update({ muhaffiz_name: teacher_name, group_name })
      .eq("student_id", student_id);

    // if update failed or didn't find record, try inserting
    if (hifzUpdateError) {
      await supabase
        .from("hifz_details")
        .insert({ 
          student_id, 
          muhaffiz_name: teacher_name, 
          group_name 
        });
    }

    const hifzError = null; // Suppress error reporting for fallback insert

    if (profileError || hifzError) {
      showAction("error", profileError?.message || hifzError?.message);
      return;
    }

    // Refresh school data locally
    setSchoolData((current) => ({
      ...current,
      students: current.students.map((s) =>
        String(s.student_id) === String(student_id)
          ? { ...s, teacherName: teacher_name, groupName: group_name }
          : s
      ),
    }));

    setAdminForms((current) => ({
      ...current,
      assignChild: { student_id: "", teacher_name: "", group_name: "" },
    }));

    showAction("success", "Child assigned to muhaffiz successfully.");
    sendPushNotification("Assignment Updated", `Student has been assigned to ${teacher_name} in group ${group_name}.`);
  };

  const handleDeleteRecord = (table, idField = "id") => async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;

    const { error } = await supabase.from(table).delete().eq(idField, id);

    if (error) {
      showAction("error", error.message);
      return;
    }

    // Refresh school data
    await loadPortalData(portalRole, user, parentData.studentProfile);
    showAction("success", "Record deleted successfully.");
  };

  const handleUpdateTeacherProfile = async (event) => {
    event.preventDefault();
    const payload = adminForms.teacherProfile;

    // Update the profile information
    const { error: profileError } = await supabase
      .from("teacher_profiles")
      .upsert({
        user_id: payload.user_id || undefined,
        full_name: payload.full_name,
        photo_url: payload.photo_url,
        phone_number: payload.phone_number,
        whatsapp_number: payload.whatsapp_number,
        is_active: true,
      });

    // Update the portal access settings (salary/visibility) separately
    const { error: accessError } = await supabase
      .from("user_portal_access")
      .update({
        salary_per_minute: Number(payload.salary_per_minute || 2.3),
        show_salary_card: !!payload.show_salary_card,
      })
      .eq("full_name", payload.full_name);

    if (profileError || accessError) {
      showAction("error", profileError?.message || accessError?.message);
      return;
    }

    await loadPortalData(portalRole, user, parentData.studentProfile);
    setAdminForms(curr => ({ ...curr, teacherProfile: { full_name: "", photo_url: "", phone_number: "", whatsapp_number: "" }}));
    showAction("success", "Teacher profile updated.");
  };

  const handleTeacherResultSubmit = async (event) => {
    event.preventDefault();

    const totalScore = RESULT_NUMERIC_FIELDS.reduce(
      (sum, field) => sum + toNumber(teacherForms.result[field]),
      0
    );

    const payload = {
      ...teacherForms.result,
      student_id: teacherForms.result.student_id,
      attendance_count: toNumber(teacherForms.result.attendance_count),
      total_jadeed_pages: toNumber(teacherForms.result.total_jadeed_pages),
      murajazah: toNumber(teacherForms.result.murajazah),
      juz_hali: toNumber(teacherForms.result.juz_hali),
      takhteet: toNumber(teacherForms.result.takhteet),
      jadeed: toNumber(teacherForms.result.jadeed),
    };

    const { data, error } = await supabase.from("weekly_results").insert([payload]).select().single();

    if (error) {
      showAction("error", error.message);
      return;
    }

    setSchoolData((current) => {
      const nextWeeklyResults = [data, ...current.weeklyResults];
      const refreshedStudents = current.students.map((student) =>
        String(student.student_id) === String(data.student_id)
          ? { ...student, latestResult: data }
          : student
      );

      return {
        ...current,
        weeklyResults: nextWeeklyResults,
        students: refreshedStudents,
      };
    });

    setTeacherForms((current) => ({
      ...current,
      result: {
        ...current.result,
        murajazah: "",
        juz_hali: "",
        takhteet: "",
        jadeed: "",
        rank: "",
        next_week_juz: "",
        next_week_page: "",
        total_jadeed_pages: "",
        istifadah_juz: "",
        istifadah_page: "",
        wusool_juz: "",
        wusool_page: "",
        matrookah: "",
        daeefah: "",
        attendance_count: "",
        attendance_note: "",
      },
    }));
    showAction("success", "Tahfeez report saved successfully.");
    sendPushNotification("Tahfeez Report Submitted", "A new progress report has been saved for the student.");
  };

  if (!user && !loading) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (loading && !user) {
    return <LoadingScreen message="Loading Mauze Tahfeez..." />;
  }

  const enablerUI = (
    <div style={{ position: "fixed", top: "12px", right: "70px", zIndex: 9999 }}>
      <NotificationEnabler permission={notificationPermission} onRequest={requestNotificationPermission} />
    </div>
  );

  if (portalRole === "parents") {
    return (
      <React.Fragment>
        {enablerUI}
        <ParentPortal
          activePage={activePage}
          parentData={parentData}
          setActivePage={setActivePage}
          user={user}
          loading={loading}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          onLogout={handleLogout}
          onRoleChange={storeRole}
          teacherProfiles={teacherProfiles}
        />
      </React.Fragment>
    );
  }

  if (portalRole === "admin") {
    return (
      <React.Fragment>
        {enablerUI}
        <AdminPortal
          activePage={activePage}
        actionMessage={actionMessage}
        adminData={{
          ...schoolData,
          customGroups,
          teacherAttendance,
        }}
        adminForms={adminForms}
        menuOpen={menuOpen}
        onAdminFormChange={handleAdminFormChange}
        onCreateAnnouncement={handleCreateAnnouncement}
        onCreateGroup={handleCreateGroup}
        onCreateSchedule={handleCreateSchedule}
        onCreatePortalAccess={handleCreatePortalAccess}
        onLogout={handleLogout}
        onRoleChange={storeRole}
        onRecordTeacherAttendance={handleRecordTeacherAttendance}
        selectedStudentId={selectedStudentId}
        setMenuOpen={setMenuOpen}
        setSelectedStudentId={setSelectedStudentId}
        setActivePage={setActivePage}
        user={user}
        onAssignChild={handleAssignChild}
        adminTeacherFilter={adminTeacherFilter}
        setAdminTeacherFilter={setAdminTeacherFilter}
        onDeleteRecord={handleDeleteRecord}
        onUpdateTeacherProfile={handleUpdateTeacherProfile}
        onSendCustomNotification={handleSendCustomNotification}
      />
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      {enablerUI}
      <TeacherPortal
        actionMessage={actionMessage}
        activePage={activePage}
        menuOpen={menuOpen}
        onLogout={handleLogout}
        onRoleChange={storeRole}
        onTeacherFormChange={handleTeacherFormChange}
        onTeacherGroupFilterChange={handleTeacherGroupFilterChange}
        onTeacherResultSubmit={handleTeacherResultSubmit}
        setActivePage={setActivePage}
        setMenuOpen={setMenuOpen}
        teacherData={teacherData}
        teacherForms={teacherForms}
        user={user}
        portalAccess={portalAccess}
        monthlySalary={monthlySalary}
      />
    </React.Fragment>
  );
}
