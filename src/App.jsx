import React, { useState } from "react";
import { User, BookOpen, GraduationCap, Info, ChevronRight, Hash, Bookmark } from "lucide-react";
import "./style.css";

export default function App() {
  const [activePage, setActivePage] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);

  const pages = {
    Profile: {
      eyebrow: "Student Profile",
      title: "Track your child with clarity",
      description:
        "See attendance, class level, guardian details, and the latest updates in one education dashboard.",
      highlights: ["Student ID: MT-204", "Attendance: 96%", "Class: Hifz Level 3"],
      childInfo: {
        name: "Abbas Murtaza",
        its: "20345678",
        hifzJuz: "12",
        hifzSurat: "Surah Yusuf",
        muhaffizName: "Mulla Huzaifa Bhai"
      }
    },
    Home: {
      eyebrow: "Education Home",
      title: "A warm and simple school app",
      description:
        "Keep daily learning, announcements, and important school actions easy to access for families.",
      highlights: ["Today's lesson plan", "Upcoming parent meeting", "2 homework reminders"],
    },
    "Child Summary": {
      eyebrow: "Progress Overview",
      title: "Review child performance in one place",
      description:
        "Understand memorization progress, behavior notes, and weekly teacher feedback without switching screens.",
      highlights: ["Memorized this week: 8 pages", "Teacher note: Excellent focus", "Revision score: 88%"],
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
            <p className="sidebar-tag">More Options</p>
            <h2>Mauze Tahfeez</h2>
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
          <p className="brand-tag">Education App</p>
          <h1 className="brand-title">Mauze Tahfeez</h1>
        </div>

        <div className="top-status">
          <span>Guardian View</span>
        </div>
      </header>

      <main className="page-card">
        <p className="page-eyebrow">{currentPage.eyebrow}</p>
        <h2>{currentPage.title}</h2>
        <p className="page-description">{currentPage.description}</p>

        <section className="hero-panel">
          <div>
            <p className="hero-label">Current page</p>
            <h3>{activePage}</h3>
          </div>
          <div className="hero-chip">Academic Session 2026</div>
        </section>

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
