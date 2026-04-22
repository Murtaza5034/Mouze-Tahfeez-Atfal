import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Hash,
  Layers3,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  User,
  Users,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import "./style.css";
import "./salary.css";
import "./teacher-profiles.css";
import "./admin-sidebar.css";

const ROLE_LABELS = {
  parents: "Parents",
  admin: "Admin",
  teacher: "Teacher",
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
            backgroundColor: ['#fbbf24', '#3b82f6', '#ef4444', '#10b981', '#a855f7'][Math.floor(Math.random() * 5)],
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 2}s`
          }}
        />
      ))}
    </div>
  );
}

const sendPushNotification = async (title, body) => {
  if (!("Notification" in window)) return;
  
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/logo.png" });
  } else if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification(title, { body, icon: "/logo.png" });
    }
  }
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function toNumber(value) {
  return Number(value || 0);
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

function guessTeacherIdentity(user) {
  const metadataName =
    user?.user_metadata?.teacher_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name;

  if (metadataName) {
    return metadataName;
  }

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

function TahfeezReportCard({ student, weeklyResult }) {
  return (
    <div className="progress-overview">
      <div className="section-title-group">
        <BookOpen size={20} />
        <h3>{student ? `${student.name}'s Tahfeez Report` : "Weekly Result"}</h3>
      </div>

      <div className="result-card-premium">
        <div className="result-card-header">
          <div className="school-logo">
            <img src="/logo.png" alt="Logo" />
          </div>
          <div className="school-info">
            <h4>RAWDAT TAHFEEZ UL ATFAAL</h4>
            <p>{student?.groupName || "Tahfeez Group"}</p>
          </div>
          <div className="report-badge">
            <span>TAHFEEZ REPORT</span>
          </div>
        </div>

        <div className="result-main">
          <div className="total-score-block">
            <span className="score-title">WEEKLY SCORE</span>
            <span className="jumla-label">Jumla</span>
            <div className="score-circle">{weeklyResult?.total_score || "0"}</div>
            <span className="max-score">/ 100</span>
          </div>

          <div className="score-details-box">
            <div className="score-row">
              <span className="arabic-label">Murajazah</span>
              <span className="score-val">{weeklyResult?.murajazah || "0"} / 30</span>
            </div>
            <div className="score-row">
              <span className="arabic-label">Juz Hali</span>
              <span className="score-val">{weeklyResult?.juz_hali || "0"} / 30</span>
            </div>
            <div className="score-row">
              <span className="arabic-label">Takhteet</span>
              <span className="score-val">{weeklyResult?.takhteet || "0"} / 20</span>
            </div>
            <div className="score-row">
              <span className="arabic-label">Jadeed</span>
              <span className="score-val">{weeklyResult?.jadeed || "0"} / 20</span>
            </div>
          </div>

          <div className="rank-block">
            <div className="medal-stack">
              <div className="medal bronze">3</div>
              <div className="medal silver">2</div>
              <div className="medal gold">1</div>
            </div>
            <span className="rank-label">RANK</span>
            <div className="rank-value">{weeklyResult?.rank || "-"}</div>
          </div>
        </div>

        <div className="result-footer">
          <div className="target-box">
            <h5>Next Week Target</h5>
            <div className="target-fields">
              <div className="field">
                <span>Juz:</span>
                <strong>{weeklyResult?.next_week_juz || "-"}</strong>
              </div>
              <div className="field">
                <span>Page:</span>
                <strong>{weeklyResult?.next_week_page || "-"}</strong>
              </div>
            </div>
            <div className="sub-field">
              <span>Total Jadeed Pages:</span>
              <strong>{weeklyResult?.total_jadeed_pages || "0"}</strong>
            </div>
          </div>

          <div className="target-box highlight">
            <h5>Target Till Istifadah Ilmiyah</h5>
            <div className="target-fields">
              <div className="field">
                <span>Juz:</span>
                <strong>{weeklyResult?.istifadah_juz || "-"}</strong>
              </div>
              <div className="field">
                <span>Page:</span>
                <strong>{weeklyResult?.istifadah_page || "-"}</strong>
              </div>
            </div>
            <div className="sub-field">
              <span>Attendance Count:</span>
              <strong>{weeklyResult?.attendance_count || "-"}</strong>
            </div>
          </div>
        </div>

        {weeklyResult?.attendance_note ? (
          <div className="attendance-ribbon">{weeklyResult.attendance_note}</div>
        ) : null}
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

  const pageNames = ["Home", "Schedule", "Announcements", "Teachers"];
  const assignedRoles = getAssignedRoles(user);

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
    Teachers: {
      eyebrow: "Our Staff",
      title: "Teacher Contacts",
      description: "Direct contact options for your child's Muhaffiz and other staff.",
      highlights: ["WhatsApp support", "Call verification"],
    },
  };

  const currentPage = pages[activePage];

  return (
    <div className="app-shell">
      <div
        className={menuOpen ? "sidebar-overlay visible" : "sidebar-overlay"}
        onClick={() => setMenuOpen(false)}
      />

      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="sidebar-header">
          <div>
            <p className="sidebar-tag">Logged in as</p>
            <h2>{user?.email}</h2>
          </div>
          <button
            type="button"
            className="close-menu"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            X
          </button>
        </div>

        <div className="sidebar-links">
          {assignedRoles.map((role) => (
            <button
              key={role}
              type="button"
              className="sidebar-link"
              onClick={() => onRoleChange(role)}
            >
              Go to {ROLE_LABELS[role] || role} Portal
            </button>
          ))}
          <button type="button" className="sidebar-link logout-btn" onClick={onLogout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <header className="topbar">
        <button
          type="button"
          className="menu-button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <span />
          <span />
          <span />
        </button>

        <div className="brand-block">
          <div className="brand-header-flex">
            <img src={studentProfile?.photo_url || "/logo.png"} alt="Logo" className="nav-logo profile-dp-circle" />
            <div>
              <p className="brand-tag">Welcome, Parents</p>
              <h1 className="brand-title">{studentProfile?.name || "Child's Portal"}</h1>
            </div>
          </div>
        </div>

        <div className="top-status">
          <span>{loading ? "Refreshing..." : "Parents View"}</span>
        </div>
      </header>

      <main className="page-card">
        {showCelebration && <Celebration />}
        {currentPage && (
          <>
            <p className="page-eyebrow">{currentPage.eyebrow}</p>
            <h2>{currentPage.title}</h2>
            <p className="page-description">{currentPage.description}</p>
          </>
        )}

        {activePage !== "Child Summary" && activePage !== "Teachers" ? (
          <section className="hero-panel">
            <div>
              <p className="hero-label">Current page</p>
              <h3>{activePage}</h3>
            </div>
            <div className="hero-chip">Academic Session 2026</div>
          </section>
        ) : null}

        {activePage === "Home" ? (
          <div className="home-dashboard">
            <div className="dashboard-section">
              <div className="section-header">
                <Calendar size={18} />
                <h3>Today's Schedule</h3>
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
          <TahfeezReportCard
            student={{
              name: studentProfile?.name,
              groupName: studentProfile?.class_level,
            }}
            weeklyResult={weeklyResult}
          />
        ) : null}
        {activePage === "Teachers" ? (
          <div className="management-grid">
            <p className="page-eyebrow">Our Staff</p>
            <h2>Contact your child's teachers</h2>
            <div className="teacher-info-stack">
              {sortedTeachers.map((teacher) => (
                <article key={teacher.id} className={`data-card teacher-profile-card ${teacher.id === myTeacher?.id ? 'pinned' : ''}`}>
                  {teacher.id === myTeacher?.id && <span className="pin-badge">My Child's Teacher</span>}
                  <div className="teacher-card-inner">
                    <img 
                      src={teacher.photo_url || "/default-avatar.png"} 
                      alt={teacher.full_name} 
                      className="teacher-photo-square" 
                    />
                    <div className="teacher-details">
                      <h3>{teacher.full_name}</h3>
                      <p className="teacher-specialty">Muhaffiz / Teacher</p>
                      <div className="contact-actions">
                        {teacher.phone_number && (
                          <a href={`tel:${teacher.phone_number}`} className="contact-btn call">
                             Call Now
                          </a>
                        )}
                        {teacher.whatsapp_number && (
                          <a href={`https://wa.me/${teacher.whatsapp_number.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="contact-btn whatsapp">
                             WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {sortedTeachers.length === 0 && (
                <div className="empty-state">No teacher information available yet.</div>
              )}
            </div>
          </div>
        ) : null}

        {currentPage && <InfoHighlights items={currentPage.highlights} />}
      </main>

      <nav className="navbar" aria-label="Bottom navigation">
        {pageNames.map((page) => {
          const Icon = NAV_ICONS[page] || Sparkles;
          return (
            <button
              key={page}
              type="button"
              className={activePage === page ? "nav-link active" : "nav-link"}
              onClick={() => setActivePage(page)}
            >
              <span className="nav-icon"><Icon size={20} /></span>
              <span className="nav-text">{page}</span>
            </button>
          );
        })}
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
}) {
  const { announcements, customGroups, schedule, students, teacherAttendance, portalAccessList, teacherProfiles } = adminData;

  const sidebarLinks = ["Staff Profiles", "Groups", "Portal Access"];
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
      <aside className={`admin-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
           <div className="brand-header-flex">
            <img src="/logo.png" alt="Logo" className="nav-logo profile-dp-circle" />
            <div>
              <p className="brand-tag" style={{ color: 'rgba(255,255,255,0.6)' }}>Admin View</p>
              <h2 className="brand-title" style={{ color: 'white', fontSize: '1rem', margin: 0 }}>Manager</h2>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <p className="sidebar-category" style={{ padding: '0 16px', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>Main Dashboard</p>
          {navPages.map(page => {
             const Icon = NAV_ICONS[page] || Layers3;
             return (
               <button key={page} className={`sidebar-link ${activePage === page ? 'active' : ''}`} onClick={() => { setActivePage(page); setMenuOpen(false); }}>
                 <Icon size={18} /> {page === "Announcements" ? "Updates" : page}
               </button>
             )
          })}
          
          <p className="sidebar-category" style={{ padding: '0 16px', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', marginBottom: '8px', marginTop: '24px' }}>Management</p>
          {sidebarLinks.map(page => {
             const Icon = NAV_ICONS[page] || Users;
             return (
               <button key={page} className={`sidebar-link ${activePage === page ? 'active' : ''}`} onClick={() => { setActivePage(page); setMenuOpen(false); }}>
                 <Icon size={18} /> {page}
               </button>
             )
          })}

          <div style={{ marginTop: 'auto', padding: '16px 0' }}>
            {getAssignedRoles(user).filter(r => r !== 'admin').map((role) => (
              <button key={role} className="sidebar-link" onClick={() => onRoleChange(role)}>
                 <LogOut size={18} /> Switch to {role}
              </button>
            ))}
            <button className="sidebar-link" onClick={onLogout}>
              <LogOut size={18} /> Logout
            </button>
          </div>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="topbar">
          <button
            type="button"
            className="menu-button-mobile"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: 'none', border: 'none', padding: '12px', display: 'none' }}
          >
            <Menu size={24} />
          </button>
          <div className="brand-block">
             <h2 className="page-title" style={{ margin: 0 }}>{activePage}</h2>
          </div>
          <div className="header-actions">
             <button className="role-chip" onClick={() => onRoleChange("parents")}>
               Parents View
             </button>
          </div>
        </header>

        <section className="admin-content-pad" style={{ padding: '24px' }}>
          {actionMessage && (
            <div className={`status-banner ${actionMessage.type}`}>{actionMessage.text}</div>
          )}

          <div className="portal-stats">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <article key={stat.label} className="stat-card">
                  <div className="stat-icon">
                    <Icon size={18} />
                  </div>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </article>
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
                        <span className="mini-pill">ITS: {selectedStudent.its || "N/A"}</span>
                        <span className="mini-pill">Juz: {selectedStudent.hifz?.juz || "N/A"}</span>
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
                        <Trash2 size={16} />
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
                      <Trash2 size={16} />
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
              <form className="stack-form" onSubmit={onRecordTeacherAttendance}>
                <div className="form-grid">
                  <label>
                    <span>Teacher</span>
                    <select
                      name="teacher_name"
                      value={adminForms.teacherAttendance.teacher_name}
                      onChange={onAdminFormChange("teacherAttendance")}
                      required
                    >
                      <option value="">Select teacher</option>
                      {teacherSummaries.map((teacher) => (
                        <option key={teacher.teacherName} value={teacher.teacherName}>
                          {teacher.teacherName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Date</span>
                    <input
                      type="date"
                      name="attendance_date"
                      value={adminForms.teacherAttendance.attendance_date}
                      onChange={onAdminFormChange("teacherAttendance")}
                      required
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label>
                    <span>Minutes Present</span>
                    <input
                      type="number"
                      min="0"
                      name="minutes_present"
                      value={adminForms.teacherAttendance.minutes_present}
                      onChange={onAdminFormChange("teacherAttendance")}
                      placeholder="240"
                      required
                    />
                  </label>

                  <label>
                    <span>Status</span>
                    <select
                      name="status"
                      value={adminForms.teacherAttendance.status}
                      onChange={onAdminFormChange("teacherAttendance")}
                    >
                      <option value="Present">Present</option>
                      <option value="Late">Late</option>
                      <option value="Half Day">Half Day</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </label>
                </div>

                <label>
                  <span>Note</span>
                  <textarea
                    name="note"
                    value={adminForms.teacherAttendance.note}
                    onChange={onAdminFormChange("teacherAttendance")}
                    rows="3"
                    placeholder="Optional notes about attendance or class coverage"
                  />
                </label>

                <button type="submit" className="action-button">
                  Save Attendance
                </button>
              </form>
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
                      <Trash2 size={16} />
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
                      {Array.from(new Set(portalAccessList.filter(a => a.portal_role === "teacher").map(a => a.full_name || a.email))).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
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
                      <Trash2 size={16} />
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

                <div className="form-grid">
                  <label>
                    <span>Salary per Minute (Teacher)</span>
                    <input
                      type="number"
                      step="0.1"
                      name="salary_per_minute"
                      value={adminForms.portalAccess.salary_per_minute}
                      onChange={onAdminFormChange("portalAccess")}
                    />
                  </label>
                  <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "24px" }}>
                    <input
                      type="checkbox"
                      name="show_salary_card"
                      checked={adminForms.portalAccess.show_salary_card}
                      onChange={(e) => {
                        const { checked } = e.target;
                        setAdminForms((current) => ({
                          ...current,
                          portalAccess: { ...current.portalAccess, show_salary_card: checked },
                        }));
                      }}
                    />
                    <span>Show Salary Card to Teacher</span>
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
                          <span className="badge info">{access.salary_per_minute}rs/min</span>
                        )}
                      </div>
                      <span style={{ fontSize: "12px", opacity: 0.7 }}>{access.email}</span>
                    </div>
                    <button 
                      className="delete-icon-btn" 
                      onClick={() => onDeleteRecord("user_portal_access", "id")(access.id)}
                      aria-label="Delete access"
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
                {(!portalAccessList || portalAccessList.length === 0) ? (
                  <div className="empty-state">No access records found.</div>
                ) : null}
              </div>
            </section>
          </div>
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

  return (
    <div className="app-shell">
      <div
        className={menuOpen ? "sidebar-overlay visible" : "sidebar-overlay"}
        onClick={() => setMenuOpen(false)}
      />

      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="sidebar-header">
          <div>
            <p className="sidebar-tag">Teacher Workspace</p>
            <h2>{user?.email}</h2>
          </div>
          <button
            type="button"
            className="close-menu"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            X
          </button>
        </div>

        <div className="sidebar-links">
          {getAssignedRoles(user).map((role) => (
            <button
              key={role}
              type="button"
              className="sidebar-link"
              onClick={() => onRoleChange(role)}
            >
              Go to {ROLE_LABELS[role] || role} Portal
            </button>
          ))}
          <button type="button" className="sidebar-link logout-btn" onClick={onLogout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <header className="topbar">
        <button
          type="button"
          className="menu-button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <span />
          <span />
          <span />
        </button>

        <div className="brand-block">
          <div className="brand-header-flex">
            <img src={portalAccess?.photo_url || "/logo.png"} alt="Logo" className="nav-logo profile-dp-circle" />
            <div>
              <p className="brand-tag">Teacher Access</p>
              <h1 className="brand-title">{portalAccess?.full_name || "Muhaffiz Portal"}</h1>
            </div>
          </div>
        </div>

        <div className="top-status">
          <span>{teacherIdentity || "Teacher View"}</span>
        </div>
      </header>

      <main className="page-card">
        <section className="hero-panel">
          <div>
            <p className="hero-label">Current page</p>
            <h3>{activePage}</h3>
          </div>
          <div className="hero-chip">{selectedGroup || "All groups"}</div>
        </section>

        {actionMessage ? (
          <div className={`status-banner ${actionMessage.type}`}>{actionMessage.text}</div>
        ) : null}

        {/* Group filter removed as requested - showing only assigned students */}

        {activePage === "My Group" ? (
          <div className="portal-content">
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
                    <span className="salary-label">Rate/Min</span>
                    <span className="salary-value">₹{monthlySalary.rate}</span>
                  </div>
                  <div className="salary-item total-item">
                    <span className="salary-label">Total Amount</span>
                    <span className="salary-value highlight">₹{monthlySalary.amount.toFixed(2)}</span>
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
                    <span>Week Date</span>
                    <input
                      type="date"
                      name="week_date"
                      value={teacherForms.result.week_date}
                      onChange={onTeacherFormChange}
                      required
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
                      placeholder="A / 1 / Excellent"
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
                  <span>Attendance / Performance Note</span>
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
                    weeklyResult={selectedStudent.latestResult}
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
            {actionMessage ? (
          <div className={`status-banner ${actionMessage.type}`}>{actionMessage.text}</div>
        ) : null}

        <div className="toolbar-row">
          <label className="filter-box">
            <span>Filter by Muhaffiz</span>
            <select 
              value={adminTeacherFilter} 
              onChange={(e) => setAdminTeacherFilter(e.target.value)}
            >
              <option value="All">All Teachers</option>
              {Array.from(new Set(students.map(s => s.teacherName))).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="management-grid">
          {students
            .filter(s => adminTeacherFilter === "All" || normalizeText(s.teacherName) === normalizeText(adminTeacherFilter))
            .map((student) => (
              <section 
                key={student.student_id} 
                className={`data-card student-interactive-card ${selectedStudentId === student.student_id ? 'active' : ''}`}
                onClick={() => setSelectedStudentId(student.student_id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="student-profile-hero">
                  <div className="profile-identity-row">
                    <img 
                      src={student.photoUrl || "/default-avatar.png"} 
                      alt={student.name} 
                      className="user-dp-badge"
                    />
                    <div>
                      <h3>{student.name}</h3>
                      <p>{student.groupName} · {student.hifz?.surat || "No surah"}</p>
                    </div>
                  </div>
                </div>
                {selectedStudentId === student.student_id && (
                  <div className="card-expanded-stats" style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <div className="quick-management" style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>CHANGE ASSIGNMENT</p>
                      <div className="form-grid">
                        <select 
                          className="mini-select"
                          value={student.teacherName}
                          onChange={(e) => onAssignChild({ 
                            preventDefault: () => {}, 
                            target: { student_id: student.student_id, teacher_name: e.target.value, group_name: student.groupName } 
                          }, true)}
                        >
                          <option value="">No Teacher</option>
                          {Array.from(new Set(portalAccessList.filter(a => a.portal_role === "teacher").map(a => a.full_name || a.email))).map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <TahfeezReportCard student={student} weeklyResult={student.latestResult} />
                  </div>
                )}
              </section>
            ))}
        </div>
      </div>
    ) : null}
  </main>

  <nav className="navbar admin-navbar" aria-label="Teacher navigation">
    {["My Group", "Fill Result", "Overview"].map((page) => {
      const Icon = NAV_ICONS[page] || Layers3;
      return (
        <button
          key={page}
          type="button"
          className={activePage === page ? "nav-link active" : "nav-link"}
          onClick={() => setActivePage(page)}
        >
          <span className="nav-icon">
            <Icon size={20} />
          </span>
          <span className="nav-text">{page}</span>
        </button>
      );
    })}
  </nav>
</div>
);
}

export default function App() {
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
    // No-op - removed local storage sync
  }, [teacherAttendance]);

  useEffect(() => {
    // No-op - removed local storage sync
  }, [customGroups]);

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
          ]);

          nextParentState = {
            studentProfile: profileData,
            hifzDetails: hifzResponse.data || null,
            announcements: announcementResponse.data || [],
            schedule: scheduleResponse.data || [],
            attendance: attendanceResponse.data || null,
            weeklyResult: resultResponse.data || null,
          };
        }

        setParentData(nextParentState);
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
        setTeacherProfiles(teacherProfilesResponse.data || []);

        setSchoolData({
          students,
          weeklyResults: resultsResponse.data || [],
          announcements: eventsResponse.data || [],
          schedule: scheduleResponse.data || [],
          portalAccessList: portalAccessResponse.data || [],
          teacherProfiles: teacherProfilesResponse.data || [],
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

  const teacherIdentity = useMemo(() => guessTeacherIdentity(user), [user]);

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

    const baseStudents = matchedStudents.length > 0 ? matchedStudents : schoolData.students;
    const filteredStudents = baseStudents;

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
    const rate = toNumber(portalAccess.salary_per_minute || 2.3);

    return {
      totalMinutes,
      rate,
      amount: totalMinutes * rate,
      daysPresent: monthAttendance.length,
    };
  }, [teacherData.attendances, portalAccess.salary_per_minute, portalRole]);

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
    // Clear state immediately for instant UI feedback
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

    // Call backend signOut in parallel or afterward
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
      target_salary_rate: Number(payload.salary_per_minute || 2.3),
      target_show_card: !!payload.show_salary_card,
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

  const handleTeacherFormChange = (event) => {
    const { name, value } = event.target;
    setTeacherForms((current) => ({
      ...current,
      result: {
        ...current.result,
        [name]: value,
      },
    }));
  };

  const handleTeacherGroupFilterChange = (event) => {
    setTeacherGroupFilter(event.target.value);
  };

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();

    const payload = {
      title: adminForms.announcement.title,
      type: adminForms.announcement.type,
      event_date: adminForms.announcement.event_date,
    };

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
      announcement: {
        ...current.announcement,
        title: "",
        type: "Update",
        event_date: getToday(),
      },
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

  const handleRecordTeacherAttendance = async (event) => {
    event.preventDefault();

    const record = {
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

    // We update multiple tables to ensure consistency across the app's lookups
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ teacher_name, group_name, class_level: group_name })
      .eq("student_id", student_id);

    const { error: hifzError } = await supabase
      .from("hifz_details")
      .update({ muhaffiz_name: teacher_name, group_name })
      .eq("student_id", student_id);

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

    const { error } = await supabase
      .from("teacher_profiles")
      .upsert({
        user_id: payload.user_id || undefined,
        full_name: payload.full_name,
        photo_url: payload.photo_url,
        phone_number: payload.phone_number,
        whatsapp_number: payload.whatsapp_number,
        is_active: true,
      }, { onConflict: 'full_name' });

    if (error) {
      showAction("error", error.message);
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
      total_score: totalScore,
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
        attendance_count: "",
        attendance_note: "",
      },
    }));
    showAction("success", "Tahfeez report saved successfully.");
  };

  if (!user && !loading) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (loading && !user) {
    return <LoadingScreen message="Loading Mauze Tahfeez..." />;
  }

  if (portalRole === "parents") {
    return (
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
        teacherProfiles={schoolData.teacherProfiles}
      />
    );
  }

  if (portalRole === "admin") {
    return (
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
      />
    );
  }

  return (
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
  );
}
