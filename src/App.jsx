import React, { useState, useEffect } from "react";
import { User, BookOpen, GraduationCap, Info, ChevronRight, Hash, Bookmark, Calendar, Bell, Clock, CheckCircle2, LogOut } from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import "./style.css";

export default function App() {
  // Add Google Font for Arabic
  useEffect(() => {
    const link = document.createElement('link');
    link.href = "https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // State for dynamic data
  const [studentProfile, setStudentProfile] = useState(null);
  const [hifzDetails, setHifzDetails] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [weeklyResult, setWeeklyResult] = useState(null);

  useEffect(() => {
    // Check active session on mount
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        fetchData(session.user);
      } else {
        setLoading(false);
      }
    };

    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        fetchData(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchData(currentUser) {
    if (!currentUser) return;
    setLoading(true);
    try {
      // 1. Fetch Profile for the logged-in user
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (profileData) {
        setStudentProfile(profileData);
        
        // 2. Fetch Hifz Details for this student
        const { data: hifzData } = await supabase
          .from('hifz_details')
          .select('*')
          .eq('student_id', profileData.student_id)
          .maybeSingle();
        setHifzDetails(hifzData);

        // 3. Fetch Attendance for today
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', profileData.student_id)
          .order('attendance_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        setAttendance(attendanceData);

        // 4. Fetch Schedule
        const { data: scheduleData } = await supabase
          .from('schedule')
          .select('*')
          .eq('student_id', profileData.student_id);
        setSchedule(scheduleData || []);

        // 5. Fetch Latest Weekly Result
        const { data: resultData } = await supabase
          .from('weekly_results')
          .select('*')
          .eq('student_id', profileData.student_id)
          .order('week_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        setWeeklyResult(resultData);
      }

      // 6. Fetch Announcements (global)
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });
      setAnnouncements(eventsData || []);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setStudentProfile(null);
    setHifzDetails(null);
    setAnnouncements([]);
    setSchedule([]);
    setAttendance(null);
    setWeeklyResult(null);
  };

  if (!user && !loading) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  if (loading && !user) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  const pages = {
    Profile: {
      eyebrow: "Student Profile",
      title: "Track your child with clarity",
      description:
        "See attendance, class level, guardian details, and the latest updates in one education dashboard.",
      highlights: [
        `Student ID: ${studentProfile?.student_id || '...' }`,
        `Attendance: ${attendance ? attendance.status : '...' }`,
        `Class: ${studentProfile?.class_level || '...' }`
      ],
      childInfo: {
        name: studentProfile?.name || "Loading...",
        its: studentProfile?.its || "...",
        hifzJuz: hifzDetails?.juz || "...",
        hifzSurat: hifzDetails?.surat || "...",
        muhaffizName: hifzDetails?.muhaffiz_name || "..."
      }
    },
    Home: {
      eyebrow: "Education Home",
      title: `Welcome back, ${studentProfile?.guardian_name || 'Guardian'}`,
      description:
        "Access your child's daily learning schedule, important announcements, and school actions here.",
      highlights: [
        `Attendance: ${attendance?.status || 'Present'}`,
        `Lesson: ${hifzDetails?.surat || 'Surah Al-Kahf'}`,
        `Homework: ${hifzDetails?.teacher_note ? 'Update' : 'Pending'}`
      ],
      announcements: announcements.length > 0 ? announcements : [
        { id: 1, title: "Waiting for updates...", event_date: "", type: "Update" }
      ],
      schedule: schedule.length > 0 ? schedule : [
        { task_time: "--:--", task_name: "No tasks scheduled for today", is_done: false }
      ]
    },
    "Child Summary": {
      eyebrow: "Progress Overview",
      title: "Review child performance in one place",
      description:
        "Understand memorization progress, behavior notes, and weekly teacher feedback without switching screens.",
      highlights: [
        `Teacher note: ${hifzDetails?.teacher_note || 'Waiting for feedback'}`,
      ],
    },
    Policy: {
      eyebrow: "School Policy",
      title: "Important rules and guidance",
      description:
        "Keep uniform policy, attendance rules, fee guidance, and safeguarding details available anytime.",
      highlights: ["Attendance policy", "Fee and payment rules", "Safety and pickup rules"],
    },
  };

  const sideOptions = ["Admission", "Inbox", "Setting"];
  const pageNames = Object.keys(pages);
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
          {sideOptions.map((option) => (
            <button key={option} type="button" className="sidebar-link">
              {option}
            </button>
          ))}
          <button type="button" className="sidebar-link logout-btn" onClick={handleLogout}>
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
          <span>{loading ? 'Refreshing...' : 'Guardian View'}</span>
        </div>
      </header>

      <main className="page-card">
        <p className="page-eyebrow">{currentPage.eyebrow}</p>
        <h2>{currentPage.title}</h2>
        <p className="page-description">{currentPage.description}</p>

        {activePage !== "Child Summary" && (
          <section className="hero-panel">
            <div>
              <p className="hero-label">Current page</p>
              <h3>{activePage}</h3>
            </div>
            <div className="hero-chip">Academic Session 2026</div>
          </section>
        )}

        {activePage === "Home" && (
          <div className="home-dashboard">
            <div className="dashboard-section">
              <div className="section-header">
                <Calendar size={18} />
                <h3>Today's Schedule</h3>
              </div>
              <div className="schedule-list">
                {currentPage.schedule.map((item, i) => (
                  <div key={i} className={`schedule-item ${item.is_done ? 'done' : ''}`}>
                    <div className="time-strip">
                      <Clock size={14} />
                      {item.task_time}
                    </div>
                    <div className="task-info">
                      <p>{item.task_name}</p>
                      {item.is_done ? <CheckCircle2 size={16} className="status-icon" /> : <div className="pending-circle" />}
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
                    <div className="news-meta">
                      <span className={`tag ${news.type?.toLowerCase()}`}>{news.type}</span>
                      <span className="date">{news.event_date}</span>
                    </div>
                    <h4>{news.title}</h4>
                    <ChevronRight size={16} className="chevron" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activePage === "Profile" && currentPage.childInfo && (
          <div className="child-info-card">
            <div className="card-header">
              <div className="avatar-placeholder">
                <User size={32} />
              </div>
              <div className="header-text">
                <h3>{currentPage.childInfo.name}</h3>
                <p><Hash size={12} /> ITS: {currentPage.childInfo.its}</p>
              </div>
            </div>
            
            <div className="info-grid-simple">
              <div className="info-item">
                <div className="info-icon"><BookOpen size={18} /></div>
                <div className="info-content">
                  <span className="label">HIFZ INFORMATION</span>
                  <span className="value">Juz {currentPage.childInfo.hifzJuz}</span>
                  <span className="sub-value">{currentPage.childInfo.hifzSurat}</span>
                </div>
              </div>
              
              <div className="info-item">
                <div className="info-icon"><GraduationCap size={18} /></div>
                <div className="info-content">
                  <span className="label">MUHAFFIZ NAME</span>
                  <span className="value">{currentPage.childInfo.muhaffizName}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {activePage === "Child Summary" && (
          <div className="progress-overview">
            <div className="section-title-group">
              <BookOpen size={20} />
              <h3>Weekly Result</h3>
            </div>

            <div className="result-card-premium">
              <div className="result-card-header">
                <div className="school-logo">
                  <img src="/logo.png" alt="Logo" />
                </div>
                <div className="school-info">
                  <h4>RAWDAT TAHFEEZ UL ATFAAL</h4>
                  <p>GALIAKOT ( PAKHTI )</p>
                </div>
                <div className="report-badge">
                  <span>TAHFEEZ REPORT</span>
                </div>
              </div>

              <div className="result-main">
                <div className="total-score-block">
                  <span className="score-title">WEEKLY SCORE</span>
                  <span className="jumla-label">جمله</span>
                  <div className="score-circle">
                    {weeklyResult?.total_score || '0'}
                  </div>
                  <span className="max-score">/ 100</span>
                </div>

                <div className="score-details-box">
                  <div className="score-row">
                    <span className="arabic-label">المراجعة</span>
                    <span className="score-val">{weeklyResult?.murajazah || '0'} / 30</span>
                  </div>
                  <div className="score-row">
                    <span className="arabic-label">الجزء الحالي</span>
                    <span className="score-val">{weeklyResult?.juz_hali || '0'} / 30</span>
                  </div>
                  <div className="score-row">
                    <span className="arabic-label">تخطيط</span>
                    <span className="score-val">{weeklyResult?.takhteet || '0'} / 20</span>
                  </div>
                  <div className="score-row">
                    <span className="arabic-label">الجديد</span>
                    <span className="score-val">{weeklyResult?.jadeed || '0'} / 20</span>
                  </div>
                </div>

                <div className="rank-block">
                  <div className="medal-stack">
                    <div className="medal bronze">V</div>
                    <div className="medal silver">V</div>
                    <div className="medal gold">V</div>
                  </div>
                  <span className="rank-label">RANK</span>
                  <div className="rank-value">{weeklyResult?.rank || '-'}</div>
                </div>
              </div>

              <div className="result-footer">
                <div className="target-box">
                  <h5>Next Week Target</h5>
                  <div className="target-fields">
                    <div className="field">
                      <span>الجزء:</span>
                      <strong>{weeklyResult?.next_week_juz || '-'}</strong>
                    </div>
                    <div className="field">
                      <span>ص:</span>
                      <strong>{weeklyResult?.next_week_page || '-'}</strong>
                    </div>
                  </div>
                  <div className="sub-field">
                    <span>Total Jadeed pages:</span>
                    <strong>{weeklyResult?.total_jadeed_pages || '0'}</strong>
                  </div>
                </div>

                <div className="target-box highlight">
                  <h5>Target till Istifadah Ilmiyah</h5>
                  <div className="target-fields">
                    <div className="field">
                      <span>الجزء:</span>
                      <strong>{weeklyResult?.istifadah_juz || '-'}</strong>
                    </div>
                    <div className="field">
                      <span>ص:</span>
                      <strong>{weeklyResult?.istifadah_page || '-'}</strong>
                    </div>
                  </div>
                  <div className="sub-field">
                    <span>حاضري:</span>
                    <strong>{weeklyResult?.attendance_count || '-'}</strong>
                  </div>
                </div>
              </div>

              {weeklyResult?.attendance_note && (
                <div className="attendance-ribbon">
                   {weeklyResult.attendance_note}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="info-grid">
          {currentPage.highlights.map((item) => (
            <section key={item}>
              <h3>Highlight</h3>
              <p>{item}</p>
            </section>
          ))}
        </div>
      </main>

      <nav className="navbar" aria-label="Bottom navigation">
        {pageNames.map((page) => (
          <button
            key={page}
            type="button"
            className={activePage === page ? "nav-link active" : "nav-link"}
            onClick={() => setActivePage(page)}
          >
            {page}
          </button>
        ))}
      </nav>
    </div>
  );
}
