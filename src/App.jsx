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
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import "./style.css";

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
    .select("portal_role, is_active, full_name")
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
}) {
  const { studentProfile, hifzDetails, announcements, schedule, attendance, weeklyResult } =
    parentData;

  const assignedRoles = getAssignedRoles(user);

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
  };

  const currentPage = pages[activePage];
  const pageNames = Object.keys(pages);

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
            <img src="/logo.png" alt="Logo" className="nav-logo" />
            <div>
              <p className="brand-tag">Education App</p>
              <h1 className="brand-title">Mauze Tahfeez</h1>
            </div>
          </div>
        </div>

        <div className="top-status">
          <span>{loading ? "Refreshing..." : "Parents View"}</span>
        </div>
      </header>

      <main className="page-card">
        <p className="page-eyebrow">{currentPage.eyebrow}</p>
        <h2>{currentPage.title}</h2>
        <p className="page-description">{currentPage.description}</p>

        {activePage !== "Child Summary" ? (
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

        <InfoHighlights items={currentPage.highlights} />
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
}) {
  const { announcements, customGroups, schedule, students, teacherAttendance, portalAccessList } = adminData;

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
    <div className="app-shell">
      <div
        className={menuOpen ? "sidebar-overlay visible" : "sidebar-overlay"}
        onClick={() => setMenuOpen(false)}
      />

      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="sidebar-header">
          <div>
            <p className="sidebar-tag">Administration</p>
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
            <img src="/logo.png" alt="Logo" className="nav-logo" />
            <div>
              <p className="brand-tag">School Administration</p>
              <h1 className="brand-title">Admin Workspace</h1>
            </div>
          </div>
        </div>

        <div className="top-status">
          <span>Admin View</span>
        </div>
      </header>

      <main className="page-card">
        <p className="page-eyebrow">Administrative Control</p>
        <h2>Manage schedules, teachers, groups, and child progress</h2>
        <p className="page-description">
          Create daily schedules, publish announcements, review every child result, and monitor
          teacher attendance from one workspace.
        </p>

        <section className="hero-panel">
          <div>
            <p className="hero-label">Current page</p>
            <h3>{activePage}</h3>
          </div>
          <div className="hero-chip">School-wide management</div>
        </section>

        {actionMessage ? (
          <div className={`status-banner ${actionMessage.type}`}>{actionMessage.text}</div>
        ) : null}

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
                    <article key={`${item.student_id}-${item.task_time}-${index}`} className="record-card">
                      <strong>{item.task_name}</strong>
                      <span>
                        {student?.name || "Unknown child"} · {item.task_time || "--:--"}
                      </span>
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
                  <article key={item.id || `${item.title}-${item.event_date}`} className="record-card">
                    <strong>{item.title}</strong>
                    <span>
                      {item.type || "Update"} · {item.event_date || "No date"}
                    </span>
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
                  <article key={`${group.group_name}-${index}`} className="record-card">
                    <strong>{group.group_name}</strong>
                    <span>{group.teacher_name}</span>
                  </article>
                ))}
                {customGroups.length === 0 ? (
                  <div className="empty-state">No custom groups added yet.</div>
                ) : null}
              </div>
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
                      <span>{access.email}</span>
                    </div>
                    <span className={`role-badge role-${access.portal_role}`}>
                      {access.portal_role}
                    </span>
                  </article>
                ))}
                {(!portalAccessList || portalAccessList.length === 0) ? (
                  <div className="empty-state">No access records found.</div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </main>

      <nav className="navbar admin-navbar" aria-label="Admin navigation">
        {[
          { id: "Overview", label: "Overview" },
          { id: "Schedule", label: "Schedule" },
          { id: "Announcements", label: "Updates" },
          { id: "Teachers", label: "Teachers" },
          { id: "Groups", label: "Groups" },
          { id: "Portal Access", label: "Access" },
        ].map((item) => {
          const Icon = NAV_ICONS[item.id] || Layers3;
          return (
            <button
              key={item.id}
              type="button"
              className={activePage === item.id ? "nav-link active" : "nav-link"}
              onClick={() => setActivePage(item.id)}
            >
              <span className="nav-icon"><Icon size={20} /></span>
              <span className="nav-text">{item.label}</span>
            </button>
          );
        })}
      </nav>
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
            <img src="/logo.png" alt="Logo" className="nav-logo" />
            <div>
              <p className="brand-tag">Teacher Access</p>
              <h1 className="brand-title">Muhaffiz Portal</h1>
            </div>
          </div>
        </div>

        <div className="top-status">
          <span>{teacherIdentity || "Teacher View"}</span>
        </div>
      </header>

      <main className="page-card">
        <p className="page-eyebrow">Teacher Operations</p>
        <h2>Manage your group cards and submit tahfeez reports</h2>
        <p className="page-description">
          Review your children by group, monitor memorization status, and fill the same tahfeez
          report values shown in the child summary page.
        </p>

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

        <div className="toolbar-row">
          <label className="filter-box">
            <span>Group Filter</span>
            <select value={selectedGroup} onChange={onTeacherGroupFilterChange}>
              <option value="All">All groups</option>
              {availableGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>
        </div>

        {activePage === "My Group" ? (
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
            {filteredStudents.map((student) => (
              <section key={student.student_id} className="data-card">
                <div className="student-profile-hero">
                  <StudentAvatar student={student} />
                  <div>
                    <h3>{student.name}</h3>
                    <p>
                      {student.groupName} · {student.hifz?.surat || "No current surah"}
                    </p>
                  </div>
                </div>
                <TahfeezReportCard student={student} weeklyResult={student.latestResult} />
              </section>
            ))}
            {filteredStudents.length === 0 ? (
              <div className="empty-state">No child overviews available yet.</div>
            ) : null}
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
              <span className="nav-icon"><Icon size={20} /></span>
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
  });
  const [customGroups, setCustomGroups] = useState([]);
  const [teacherAttendance, setTeacherAttendance] = useState([]);
  const [teacherGroupFilter, setTeacherGroupFilter] = useState("All");
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
    
    // Failsafe: Force loading off after 8 seconds no matter what
    const failsafe = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log("Auth Event:", event);

      if (session) {
        setUser(session.user);
        try {
          const access = await resolveInitialPortal(
            session.user,
            window.localStorage.getItem(STORAGE_KEYS.role) || "parents"
          );

          if (mounted) {
            if (!access.ok) {
              console.error("Access denied:", access.message);
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
        ] = await Promise.all([
          supabase.from("profiles").select("*").order("name", { ascending: true }),
          supabase.from("hifz_details").select("*"),
          supabase.from("weekly_results").select("*").order("week_date", { ascending: false }),
          supabase.from("events").select("*").order("event_date", { ascending: false }),
          supabase.from("schedule").select("*").order("task_time", { ascending: true }),
          supabase.from("user_portal_access").select("*").order("created_at", { ascending: false }),
          supabase.from("custom_groups").select("*").order("group_name", { ascending: true }),
          supabase.from("teacher_attendance").select("*").order("attendance_date", { ascending: false }),
        ]);

        const students = buildStudents(
          profilesResponse.data || [],
          hifzResponse.data || [],
          resultsResponse.data || []
        );

        setTeacherAttendance(attendanceResponse.data || []);
        setCustomGroups(groupsResponse.data || []);

        setSchoolData({
          students,
          weeklyResults: resultsResponse.data || [],
          announcements: eventsResponse.data || [],
          schedule: scheduleResponse.data || [],
          portalAccessList: portalAccessResponse.data || [],
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
    const filteredStudents =
      teacherGroupFilter === "All"
        ? baseStudents
        : baseStudents.filter((student) => student.groupName === teacherGroupFilter);

    return {
      availableGroups,
      teacherIdentity,
      selectedGroup: teacherGroupFilter,
      filteredStudents,
    };
  }, [schoolData.students, teacherGroupFilter, teacherIdentity]);

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
    await supabase.auth.signOut();
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
  };

  const handleCreatePortalAccess = async (event) => {
    event.preventDefault();

    const payload = adminForms.portalAccess;

    const { error } = await supabase.rpc("grant_portal_access", {
      target_email: payload.email,
      target_role: payload.portal_role,
      target_name: payload.full_name,
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
    />
  );
}
