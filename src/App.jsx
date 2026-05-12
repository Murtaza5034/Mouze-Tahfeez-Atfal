import React, { useEffect, useMemo, useState, useRef } from "react";
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
  ArrowRight,
  CheckCircle,
  UserCheck,
  UserX,
  RotateCw,
  Mic,
  Square,
  Download,
  CreditCard,
  Search,
  Settings,
  Sun,
  Moon,
  Palette,
  LifeBuoy,
  Info,
  FileArchive,
  Loader2,
  Lock,
  CalendarX,
  AlertCircle
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import fcmService from "./fcmService";
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

const fixArabicScript = (text) => {
  if (!text) return "";
  // Normalize Gaf (Persian/Urdu script)
  // Some systems render Gaf as double kaaf or k-k-a
  return text
    .replace(/كك/g, "گ")      // Double Kaaf -> Gaf
    .replace(/مرككا/g, "مرگا") // Murga (K-K-A) -> Murga (G-A)
    .replace(/بهائي/g, "بھائی") // Bhai phonetic
    .replace(/سي/g, "سی")      // Common character fixing
    .replace(/في/g, "فی");     // Common character fixing
};

const NotificationStatus = ({ role }) => {
  const [permission, setPermission] = useState(typeof window !== 'undefined' ? Notification.permission : 'default');
  const [isInitializing, setIsInitializing] = useState(false);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert("This browser does not support notifications.");
      return;
    }
    
    setIsInitializing(true);
    try {
      const result = await fcmService.initialize(role);
      setPermission(Notification.permission);
      if (result) {
        alert("Notifications enabled successfully!");
      } else {
        if (Notification.permission === 'denied') {
          alert("Notifications are blocked in your browser settings. Please click the lock icon in your address bar to allow them.");
        } else {
          alert("Failed to initialize notification service. Please try again.");
        }
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred. Check console for details.");
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="notification-status-card card-appear">
      <div className="n-status-head">
        <Bell size={20} />
        <h4>Push Notifications</h4>
      </div>
      <div className="n-status-body">
        {permission === "granted" ? (
          <p className="status-text success"><CheckCircle size={14} /> Notifications are Active</p>
        ) : permission === "denied" ? (
          <p className="status-text error"><X size={14} /> Notifications are Blocked</p>
        ) : (
          <p className="status-text warning"><Info size={14} /> Not Configured Yet</p>
        )}
        
        {permission === "granted" && (
          <button 
            className="action-button mini" 
            style={{ background: 'var(--soft-brown)', color: 'white' }}
            onClick={async () => {
              const authRes = await supabase.auth.getUser();
              const user = authRes?.data?.user;
              if (!user) return alert("Please login first to test notifications.");
              
              const { data, error } = await supabase.functions.invoke('fcm-notification', {
                body: {
                  title: "Test Alert",
                  body: "Your device is correctly linked to Mauze Tahfeez notifications!",
                  targetUser: user?.id
                }
              });
              
              if (error) {
                console.error("Diagnostic Error:", error);
                // Try to extract JSON error if possible
                let msg = error.message;
                try {
                  const body = await error.context?.json();
                  if (body?.details) msg += "\n\nDetails: " + body.details;
                  else if (body?.error) msg += "\n\nError: " + body.error;
                } catch(e) {}
                alert("Test failed: " + msg);
              } else {
                if (data?.message === 'No tokens found') {
                  alert("Server reached, but NO TOKEN FOUND. Please refresh and try again to save your token.");
                } else {
                  alert("Test alert sent! Check your phone.");
                }
              }
            }}
          >
            Send Test Alert
          </button>
        )}
        
        {permission !== "granted" && (
          <button 
            className="action-button mini" 
            onClick={requestPermission}
            disabled={isInitializing}
          >
            {isInitializing ? "Configuring..." : "Enable Push Alerts"}
          </button>
        )}
      </div>
    </div>
  );
};
function SidebarHeader({ photoUrl, name, arabicName, tag }) {
  const isArabic = (text) => /[\u0600-\u06FF]/.test(text);
  const nameIsArabic = isArabic(name);
  const finalPhoto = (photoUrl && photoUrl !== "" && photoUrl !== "null" && photoUrl !== "undefined") ? photoUrl : "/logo.png";

  return (
    <div className="sidebar-profile-centered">
      <div className="avatar-vessel-centered">
        <img
          src={finalPhoto}
          alt="Profile"
          className="sidebar-avatar-img"
          onError={(e) => { e.target.src = "/logo.png"; }}
          loading="eager"
        />
        <div className="avatar-ring"></div>
      </div>
      <div className="profile-info-centered">
        <p className="profile-tag-premium">{tag}</p>
        <h2 className="profile-name-premium">
          {name}
        </h2>
        {arabicName && (
          <h3 className="profile-arabic-premium arabic-kanz" style={{ fontFamily: "'Kanz al Marjaan', serif" }}>
            {fixArabicScript(arabicName)}
          </h3>
        )}
      </div>
    </div>
  );
}

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
  Settings: Settings,
  Support: LifeBuoy,
  About: Info,
  "User Issues": LifeBuoy,
  "Leave Management": CalendarX,
  "Global Settings": Settings,
  "Messages": MessageCircle,
};

const emptyParentData = {
  studentProfile: null,
  hifzDetails: null,
  announcements: [],
  schedule: [],
  attendance: null,
  weeklyResult: null,
  reportSettings: null,
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

// Celebration component removed as requested.



const broadcastNotification = async (title, body, targetRole = "all", targetUser = null, redirectPage = "Home") => {
  const dbPayload = {
    title,
    body,
    target_role: targetRole,
    target_user: targetUser,
    redirect_page: redirectPage
  };
  
  // Store in database first
  await supabase.from("system_notifications").insert([dbPayload]);

  // Send FCM notification via Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('fcm-notification', {
      body: {
        title,
        body,
        targetRole: targetRole === "user" ? null : targetRole,
        targetUser: targetRole === "user" ? targetUser : null,
        data: {
          redirectPage,
          timestamp: new Date().toISOString()
        }
      }
    });

    if (error) {
      console.error('FCM notification error:', error);
    } else {
      console.log('FCM notification sent successfully:', data);
    }
  } catch (err) {
    console.error('FCM notification error:', err);
  }
};

function NotificationEnabler({ permission, onRequest }) {
  if (permission === "granted" || permission === "denied") return null;
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginLeft: "auto", marginRight: "12px" }}>
      <button onClick={onRequest} className="notification-enabler-btn">
        Enable Alerts
      </button>
    </div>
  );
}

function AnnouncementDetailsModal({ announcement, onClose }) {
  if (!announcement) return null;
  return (
    <div className="notifications-panel-overlay" onClick={onClose}>
      <div className="notifications-panel announce-details-modal" onClick={e => e.stopPropagation()}>
        <button className="panel-close-btn" onClick={onClose}><X size={20} /></button>
        <div className="details-header">
          <img
            src={announcement.image_url || "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=800&q=80"}
            alt="Announcement"
            className="details-hero-img"
          />
          <div className="details-badge">{announcement.target_role === 'all' ? 'System Broadcast' : 'Targeted Update'}</div>
        </div>
        <div className="details-body">
          <h2>{announcement.title}</h2>
          <p className="details-date">{new Date(announcement.created_at).toLocaleDateString()} at {new Date(announcement.created_at).toLocaleTimeString()}</p>
          <div className="details-content">
            {announcement.body}
          </div>
        </div>
      </div>
    </div>
  );
}

function ELearningModal({ isOpen, onClose }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  
  if (!isOpen) return null;
  
  const handleIframeLoad = () => {
    setIframeLoaded(true);
    // Store credentials in localStorage for auto-login
    const credentials = {
      email: localStorage.getItem('elearning-email') || '',
      password: localStorage.getItem('elearning-password') || '',
      rememberMe: localStorage.getItem('elearning-remember-me') === 'true'
    };
    
    // Send credentials to iframe for auto-login if remember me is enabled
    if (credentials.rememberMe && credentials.email && credentials.password) {
      setTimeout(() => {
        const iframe = document.querySelector('.elearning-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'AUTO_LOGIN',
            credentials: credentials
          }, 'https://elearningquran.com');
        }
      }, 2000);
    }
  };
  
  return (
    <div className="notifications-panel-overlay" onClick={onClose}>
      <div className="notifications-panel elearning-modal" onClick={e => e.stopPropagation()}>
        <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
          <h3 style={{ margin: 0, color: 'var(--deep-brown)' }}>E-Learning Quran Portal</h3>
          <button className="panel-close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="elearning-iframe-container">
          {!iframeLoaded && (
            <div className="iframe-loading">
              <div className="loading-spinner"></div>
              <p>Loading E-Learning Portal...</p>
            </div>
          )}
          <iframe 
            src="https://elearningquran.com" 
            title="E-Learning Quran"
            className="elearning-iframe"
            allow="clipboard-write; camera; microphone"
            onLoad={handleIframeLoad}
            style={{ display: iframeLoaded ? 'block' : 'none' }}
          />
        </div>
        <div className="elearning-footer">
          <p>This portal stays connected to your app sessions. Your login credentials are remembered for quick access.</p>
          <a href="https://elearningquran.com" target="_blank" rel="noreferrer">
            Open in browser <ArrowRight size={14} style={{ marginLeft: '4px' }} />
          </a>
        </div>
      </div>
    </div>
  );
}

function PremiumHifzCard({ onOpenPortal }) {
  const [trackCount, setTrackCount] = useState(() => {
    return parseInt(localStorage.getItem('mauze-hifz-track-count') || '0');
  });
  const [lastTrackDate, setLastTrackDate] = useState(() => {
    return localStorage.getItem('mauze-hifz-last-date') || '';
  });

  const handleTrackClick = () => {
    const today = new Date().toISOString().split('T')[0];
    if (lastTrackDate !== today) {
      const newCount = trackCount + 1;
      setTrackCount(newCount);
      setLastTrackDate(today);
      localStorage.setItem('mauze-hifz-track-count', newCount.toString());
      localStorage.setItem('mauze-hifz-last-date', today);
    }
    onOpenPortal();
  };

  const isMarkedToday = lastTrackDate === new Date().toISOString().split('T')[0];

  return (
    <div className="premium-hifz-card card-appear">
      <div className="card-content">
        <div className="card-header-flex">
          <div className="header-text">
            <h2>
              <Sparkles size={24} className="sparkle-icon" />
              Child Hifz Entry of the Day
            </h2>
            <p>
              Maintaining a consistent daily record is the cornerstone of your child's Hifz journey. 
              Your active participation ensures their progress is tracked and celebrated.
            </p>
          </div>
          <div className="track-status-box">
            <span className="track-number">{trackCount}</span>
            <span className="track-label">Total Days</span>
          </div>
        </div>
        
        <div className="card-actions">
          <button className="golden-gradient-btn" onClick={handleTrackClick}>
            <BookOpen size={20} />
            Launch eLearning Quran
            <ArrowRight size={18} />
          </button>
          {isMarkedToday && (
            <span className="status-note">
              <CheckCircle size={16} /> Today's entry marked
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


function NotificationBell({ notifications }) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.length;

  return (
    <div className="notif-bell-container">
      <button className="notif-bell-btn" onClick={() => setIsOpen(!isOpen)} aria-label="Notifications">
        <Bell size={22} />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <React.Fragment>
          <div className="notifications-panel-overlay" onClick={() => setIsOpen(false)} />
          <div className="notifications-panel fade-in" onClick={e => e.stopPropagation()}>
            <div className="panel-header">
              <h3>System Notifications</h3>
              <button className="panel-close-btn" onClick={() => setIsOpen(false)}><X size={18} /></button>
            </div>
            <div className="panel-list">
              {notifications.map((n, i) => (
                <div key={n.id || i} className="notification-item">
                  <div className="notif-item-header">
                    <span className={`mini-pill ${n.target_role === 'all' ? 'gold' : 'brown'}`} style={{ fontSize: '9px' }}>
                      {n.target_role?.toUpperCase()}
                    </span>
                    <h4>{n.title}</h4>
                  </div>
                  <p>{n.body}</p>
                  <span className="time">{new Date(n.created_at).toLocaleString()}</span>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="empty-panel">
                  <Bell size={32} style={{ opacity: 0.2 }} />
                  <p>No notifications yet</p>
                </div>
              )}
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

// Quran Ikhtebar Component with Al-Muhaffiz Library
function QuickSearch({ pages, onSelect }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);

  const clean = (str) => str.toLowerCase().replace(/\s+/g, '');
  
  const filtered = pages.filter(p => {
    const label = typeof p === 'string' ? p : p.label;
    return clean(label).includes(clean(query));
  });

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && filtered.length > 0) {
      const first = filtered[0];
      const value = typeof first === 'string' ? first : first.value;
      onSelect(value);
      setIsOpen(false);
      setQuery("");
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="quick-search-wrapper" ref={searchRef}>
      <div className="search-input-group">
        <Search size={18} className="search-icon" />
        <input 
          type="text" 
          placeholder="Search all app pages..." 
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {isOpen && query.trim() !== "" && (
        <div className="search-results-dropdown card-appear">
          {filtered.length > 0 ? (
            filtered.map((p, idx) => {
              const label = typeof p === 'string' ? p : p.label;
              const value = typeof p === 'string' ? p : p.value;
              return (
                <button 
                  key={idx} 
                  onClick={() => { onSelect(value); setIsOpen(false); setQuery(""); }}
                  className="search-result-item"
                >
                  <ArrowRight size={14} style={{ marginRight: '8px', opacity: 0.5 }} />
                  {label}
                </button>
              );
            })
          ) : (
            <div className="search-no-results">
               <X size={14} style={{ marginRight: '8px', opacity: 0.5 }} />
               No matching pages found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// WaveSurfer Player Component for Quran Ikhtebar
function WaveSurferPlayer({ url }) {
  const containerRef = useRef(null);
  const waveSurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !window.WaveSurfer) return;

    waveSurferRef.current = window.WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#d4af37',
      progressColor: '#3d2b1f',
      cursorColor: '#3d2b1f',
      barWidth: 2,
      barRadius: 3,
      responsive: true,
      height: 40,
    });

    waveSurferRef.current.load(url);

    waveSurferRef.current.on('play', () => setIsPlaying(true));
    waveSurferRef.current.on('pause', () => setIsPlaying(false));

    return () => {
      if (waveSurferRef.current) waveSurferRef.current.destroy();
    };
  }, [url]);

  return (
    <div className="wavesurfer-player" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fcfaf5', padding: '10px', borderRadius: '12px', marginTop: '10px', border: '1px solid #eee' }}>
      <button 
        onClick={() => waveSurferRef.current?.playPause()}
        style={{ background: 'var(--primary-gold)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  );
}

function QuranIkhtebar({ studentProfile, hifzDetails }) {
  const marhalaLibrary = {
    "Marhala Ula": {
      range: "Juz 30",
      easy: [{ text: "Surah Al-Naba (Ayat 1-5)", page: 582 }, { text: "Surah Al-Ala (Ayat 1-4)", page: 591 }, { text: "Surah Al-Ghashiyah (Ayat 1-8)", page: 592 }],
      medium: [{ text: "Surah Al-Inshiqaq (Ayat 10-15)", page: 589 }, { text: "Surah Al-Mutaffifin (Ayat 20-25)", page: 588 }, { text: "Surah Al-Infitar (Ayat 1-5)", page: 587 }],
      hard: [{ text: "Surah Abasa (Ayat 20-30)", page: 585 }, { text: "Surah Al-Nazi'at (Ayat 15-25)", page: 583 }, { text: "Surah Al-Burooj (Ayat 12-22)", page: 590 }]
    },
    "Marhala Saniyah": {
      range: "Juz 28-30",
      easy: [{ text: "Surah Al-Mulk (Ayat 1-5)", page: 562 }, { text: "Surah Al-Qalam (Ayat 1-7)", page: 564 }, { text: "Surah Al-Haqqah (Ayat 1-8)", page: 566 }],
      medium: [{ text: "Surah Al-Jinn (Ayat 10-15)", page: 572 }, { text: "Surah Al-Muzzammil (Ayat 1-5)", page: 574 }, { text: "Surah Al-Qiyamah (Ayat 20-25)", page: 577 }],
      hard: [{ text: "Surah Al-Mujadila (Ayat 1-5)", page: 542 }, { text: "Surah Al-Hashr (Ayat 21-24)", page: 548 }, { text: "Surah Al-Tahrim (Ayat 6-8)", page: 560 }]
    },
    "Marhala Salesah": {
      range: "Juz 26-30",
      easy: [{ text: "Surah Al-Ahqaf (Ayat 1-5)", page: 502 }, { text: "Surah Muhammad (Ayat 1-4)", page: 507 }, { text: "Surah Al-Fath (Ayat 1-3)", page: 511 }],
      medium: [{ text: "Surah Al-Hujurat (Ayat 10-13)", page: 516 }, { text: "Surah Qaf (Ayat 1-5)", page: 518 }, { text: "Surah Al-Dhariyat (Ayat 15-20)", page: 520 }],
      hard: [{ text: "Surah Al-Najm (Ayat 1-10)", page: 526 }, { text: "Surah Al-Qamar (Ayat 1-8)", page: 528 }, { text: "Surah Ar-Rahman (Ayat 1-13)", page: 531 }]
    },
    "Marhala Rabeah": {
      range: "Juz 1-5 + 26-30",
      easy: [{ text: "Surah Al-Baqarah (Ayat 1-5)", page: 2 }, { text: "Surah Al-Imran (Ayat 1-9)", page: 50 }, { text: "Surah An-Nisa (Ayat 1-3)", page: 77 }],
      medium: [{ text: "Surah Al-Baqarah (Ayat 255)", page: 42 }, { text: "Surah Al-Imran (Ayat 102-105)", page: 63 }, { text: "Surah An-Nisa (Ayat 58-59)", page: 87 }],
      hard: [{ text: "Surah Al-Baqarah (Ayat 284-286)", page: 49 }, { text: "Surah Al-Imran (Ayat 190-194)", page: 75 }, { text: "Surah An-Nisa (Ayat 100-105)", page: 94 }]
    },
    "Marhala Khamesah": {
      range: "Juz 1-10 + 26-30",
      easy: [{ text: "Surah Al-Ma'idah (Ayat 1-3)", page: 106 }, { text: "Surah Al-An'am (Ayat 1-5)", page: 128 }, { text: "Surah Al-A'raf (Ayat 1-10)", page: 151 }],
      medium: [{ text: "Surah Al-Ma'idah (Ayat 116-120)", page: 127 }, { text: "Surah Al-An'am (Ayat 151-153)", page: 149 }, { text: "Surah Al-Anfal (Ayat 1-4)", page: 177 }],
      hard: [{ text: "Surah At-Tawbah (Ayat 128-129)", page: 207 }, { text: "Surah Al-An'am (Ayat 59-65)", page: 134 }, { text: "Surah Al-A'raf (Ayat 172-174)", page: 173 }]
    },
    "Marhala Sadesah": {
      range: "Juz 1-15 + 26-30",
      easy: [{ text: "Surah Yunus (Ayat 1-5)", page: 208 }, { text: "Surah Hud (Ayat 1-4)", page: 221 }, { text: "Surah Yusuf (Ayat 1-6)", page: 235 }],
      medium: [{ text: "Surah Ibrahim (Ayat 35-41)", page: 260 }, { text: "Surah Ar-Ra'd (Ayat 28-31)", page: 253 }, { text: "Surah Al-Hijr (Ayat 1-9)", page: 262 }],
      hard: [{ text: "Surah An-Nahl (Ayat 125-128)", page: 281 }, { text: "Surah Al-Isra (Ayat 1-5)", page: 282 }, { text: "Surah Al-Kahf (Ayat 1-10)", page: 293 }]
    },
    "Marhala Sabeah": {
      range: "Juz 1-20 + 26-30",
      easy: [{ text: "Surah Maryam (Ayat 1-5)", page: 305 }, { text: "Surah Taha (Ayat 1-8)", page: 312 }, { text: "Surah Al-Anbiya (Ayat 1-4)", page: 322 }],
      medium: [{ text: "Surah Al-Hajj (Ayat 1-5)", page: 332 }, { text: "Surah Al-Mu'minun (Ayat 1-11)", page: 342 }, { text: "Surah An-Nur (Ayat 35)", page: 354 }],
      hard: [{ text: "Surah Al-Furqan (Ayat 63-77)", page: 365 }, { text: "Surah Ash-Shu'ara (Ayat 1-9)", page: 367 }, { text: "Surah Al-Naml (Ayat 1-6)", page: 377 }]
    },
    "Marhala Saminah": {
      range: "Juz 1-25 + 26-30",
      easy: [{ text: "Surah Al-Qasas (Ayat 1-6)", page: 385 }, { text: "Surah Al-Ankabut (Ayat 1-5)", page: 396 }, { text: "Surah Ar-Rum (Ayat 1-5)", page: 404 }],
      medium: [{ text: "Surah Luqman (Ayat 12-19)", page: 412 }, { text: "Surah As-Sajdah (Ayat 1-5)", page: 415 }, { text: "Surah Al-Ahzab (Ayat 21-25)", page: 420 }],
      hard: [{ text: "Surah Saba (Ayat 1-5)", page: 428 }, { text: "Surah Fatir (Ayat 1-7)", page: 434 }, { text: "Surah Yasin (Ayat 1-12)", page: 440 }]
    }
  };

  const [selectedMarhalaName, setSelectedMarhalaName] = useState("Marhala Ula");
  const [difficulty, setDifficulty] = useState("medium");
  const [testMode, setTestMode] = useState("teacher");
  const [recording, setRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [surahInfo, setSurahInfo] = useState(null);
  const [versesData, setVersesData] = useState([]);
  const [revealedWords, setRevealedWords] = useState([]);
  const [audioGuidanceUrl, setAudioGuidanceUrl] = useState(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [mistakes, setMistakes] = useState([]);
  const [history, setHistory] = useState([]);
  const [student_id, setStudentId] = useState(studentProfile?.student_id || studentProfile?.id || null);

  useEffect(() => {
    const sid = studentProfile?.student_id || studentProfile?.id || studentProfile?.uuid || studentProfile?.studentId;
    if (sid) {
      console.log("Ikhtebar: Detected student ID:", sid);
      setStudentId(sid);
    } else {
      console.warn("Ikhtebar: Could not detect student ID in profile:", studentProfile);
    }
  }, [studentProfile]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, [student_id]);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log("Ikhtebar: Fetching history for user_id:", user.id);

      const { data, error } = await supabase
        .from("quran_ikhtebar")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Ikhtebar: Fetch error:", error);
      }

      if (data) {
        console.log(`Ikhtebar: Successfully retrieved ${data.length} records.`);
        setHistory(data);
      }
    } catch (e) {
      console.error("Ikhtebar: Unexpected error in fetchHistory:", e);
    }
  };

  const generateQuestion = async () => {
    setLoadingQuestion(true);
    setRevealedWords([]);
    setAudioGuidanceUrl(null);
    setVersesData([]);
    setSurahInfo(null);

    const pool = marhalaLibrary[selectedMarhalaName][difficulty];
    const q = pool[Math.floor(Math.random() * pool.length)];
    setCurrentQuestion(q);
    setMistakes([]);

    try {
      // Step 1: Fetch Verses with full metadata
      const textRes = await fetch(`https://api.quran.com/api/v4/verses/by_page/${q.page}?words=true&word_fields=text_uthmani,text_tajweed&fields=text_uthmani`);
      const textData = await textRes.json();
      const verses = textData.verses; // All verses on the page

      // Target the verse
      const targetVerse = verses?.[0];
      if (!targetVerse) {
        throw new Error("No verses found on page " + q.page);
      }
      setVersesData([targetVerse]);

      // Step 2: Fetch Audio for that SPECIFIC verse (Hussary ID 12)
      if (testMode === "self") {
        const audioRes = await fetch(`https://api.quran.com/api/v4/recitations/12/by_verse/${targetVerse.verse_key}`);
        const audioData = await audioRes.json();
        if (audioData.audio_files?.length > 0) {
          const url = audioData.audio_files[0].url;
          setAudioGuidanceUrl(url);
          new Audio(url).play().catch(() => { });
        }
      }

      // Step 3: Get Surah Info
      const surahRes = await fetch(`https://api.quran.com/api/v4/chapters/${targetVerse.verse_key.split(":")[0]}`);
      const surahData = await surahRes.json();
      setSurahInfo(surahData.chapter);

      // Step 4: Prepare words for animation (Only one verse)
      const allWords = targetVerse.words;

      let i = 0;
      const interval = setInterval(() => {
        if (i < allWords.length) {
          setRevealedWords(prev => [...prev, allWords[i]]);
          i++;
        } else {
          clearInterval(interval);
        }
      }, 80);

    } catch (err) {
      console.error("Error fetching Quran data:", err);
    }
    setLoadingQuestion(false);
  };

  const logWordMistake = (word, type) => {
    setMistakes(prev => {
      const exists = prev.find(m => m.wordId === word.id && m.type === type);
      if (exists) return prev;
      return [...prev, {
        type,
        wordId: word.id,
        wordText: word.text_uthmani || word.text || "General",
        time: new Date().toLocaleTimeString()
      }];
    });
    playBeep();
    if (testMode === "self") pauseAndRestartOnMistake();
  };

  const calculateStars = (mistakeCount) => {
    if (mistakeCount === 0) return 5;
    if (mistakeCount === 1) return 4;
    if (mistakeCount <= 3) return 3;
    if (mistakeCount <= 5) return 2;
    return 1;
  };

  const playBeep = () => {
    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    audio.play();
  };

  const logMistake = (type) => {
    setMistakes(prev => [...prev, { type, time: new Date().toLocaleTimeString() }]);
    playBeep();
    if (testMode === "self") {
      pauseAndRestartOnMistake();
    }
  };

  const pauseAndRestartOnMistake = () => {
    mediaRecorderRef.current?.pause();
    setTimeout(() => {
      alert("Mistake detected! Please correct your recitation and press OK to continue.");
      mediaRecorderRef.current?.resume();
    }, 500);
  };

  // Silence Detection for Self Mode
  const startSilenceDetection = (stream) => {
    if (testMode !== "self") return;

    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    source.connect(analyserRef.current);

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkSilence = () => {
      if (!recording) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;

      if (average < 5) { // Threshold for silence
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            logWordMistake({ id: 'pause', text_uthmani: 'Pause' }, "Silence/Pause");
            silenceTimerRef.current = null;
          }, 3000); // 3 seconds pause = beep
        }
      } else {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }
      requestAnimationFrame(checkSilence);
    };
    checkSilence();
  };

  // Silence Detection for Self Mode
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const fileName = `${student_id}/${Date.now()}.webm`;

        const { error: uploadError } = await supabase.storage.from("ikhtebar_recordings").upload(fileName, blob);
        if (uploadError) return;

        const { data: publicUrlData } = supabase.storage.from("ikhtebar_recordings").getPublicUrl(fileName);

        // Calculate score/stars
        const starCount = calculateStars(mistakes.length);

        const { data: { user } } = await supabase.auth.getUser();

        const entry = {
          student_id,
          user_id: user?.id,
          marhala: selectedMarhalaName,
          difficulty,
          mode: testMode,
          question_text: currentQuestion?.text,
          page_number: currentQuestion?.page,
          audio_url: publicUrlData.publicUrl,
          mistakes: mistakes,
          score: starCount,
          verses_json: versesData, // Save verses for highlighting in history
          created_at: new Date().toISOString()
        };

        console.log("Ikhtebar: Attempting to save record for student:", student_id);
        const { data: savedData, error: dbError } = await supabase.from("quran_ikhtebar").insert([entry]).select();

        if (!dbError) {
          console.log("Ikhtebar: Record saved successfully:", savedData);
          await fetchHistory();
        } else {
          console.error("Ikhtebar: Database save error details:", dbError);
          alert("Error saving record: " + dbError.message);
        }
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      startSilenceDetection(stream);
    } catch (err) {
      alert("Microphone access denied: " + err.message);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const downloadFile = (url, name) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
  };

  return (
    <div className="ikhtebar-container fade-in">
      <div className="ikhtebar-header-card premium-card">
        <div className="header-icon-box">
          <BookOpen size={32} />
        </div>
        <div className="header-text">
          <h2 className="arabic-kanz" style={{ fontSize: '1.8rem' }}>Al-Muhaffiz Quran Ikhtebar</h2>
          <p>Professional Ikhtebar Portal for Tahfeez Students</p>
        </div>
      </div>

      <div className="ikhtebar-live-section">
        <section className="ikhtebar-setup-card premium-card">
          <h3 className="section-title"><Sparkles size={18} /> Ikhtebar Control Panel</h3>

          <div className="setup-grid">
            <div className="setup-form">
              <label className="form-group">
                <span>Select Marhala</span>
                <select
                  value={selectedMarhalaName}
                  onChange={(e) => setSelectedMarhalaName(e.target.value)}
                  className="premium-select"
                >
                  {Object.keys(marhalaLibrary).map(name => (
                    <option key={name} value={name}>{name} ({marhalaLibrary[name].range})</option>
                  ))}
                </select>
              </label>

              <label className="form-group">
                <span>Ikhtebar Mode</span>
                <select
                  value={testMode}
                  onChange={(e) => setTestMode(e.target.value)}
                  className="premium-select"
                >
                  <option value="teacher">With Teacher (Manual Feedback)</option>
                  <option value="self">Self Ikhtebar (Auto-Beep/Voice Monitor)</option>
                </select>
              </label>

              <label className="form-group">
                <span>Ikhtebar Difficulty</span>
                <div className="difficulty-toggle">
                  {["easy", "medium", "hard"].map(level => (
                    <button
                      key={level}
                      className={`diff-btn ${difficulty === level ? 'active' : ''} ${level}`}
                      onClick={() => setDifficulty(level)}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </label>

              <button
                className={`generate-btn action-button ${loadingQuestion ? 'loading' : ''}`}
                onClick={generateQuestion}
                disabled={loadingQuestion}
                style={{ background: 'var(--deep-brown)', color: 'white', marginTop: '10px' }}
              >
                {loadingQuestion ? <RotateCw className="spin" size={18} /> : <Sparkles size={18} />}
                {loadingQuestion ? " Fetching Quran Data..." : " Generate Lively Question"}
              </button>
            </div>

            {currentQuestion && (
              <div className="question-display-lively mushaf-page card-appear">
                {surahInfo && (
                  <div className="mushaf-header">
                    <div className="s-name arabic-kanz">{surahInfo.name_arabic}</div>
                    {surahInfo.bismillah_pre && <div className="bismillah arabic-kanz">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>}
                  </div>
                )}

                <div className="q-label-badge" style={{ marginBottom: '15px' }}>
                  {testMode === "self" ? "✨ Sheikh Hussary Guidance (Auto-Playing...)" : "📖 Teacher Prompt (Start Reciting):"}
                </div>

                <div className="mushaf-inner quran-uthmani" style={{ minHeight: '150px' }}>
                  {revealedWords.map((w, idx) => (
                    w && (
                      <span
                        key={idx}
                        className={`q-word ${w.char_type_name || ''} ${mistakes.find(m => m && m.wordId === w.id) ? 'has-mistake' : ''}`}
                        onClick={() => recording && logWordMistake(w, "Word")}
                        title={w.char_type_name?.replace('tajweed-', '').toUpperCase()}
                        dangerouslySetInnerHTML={{ __html: w.text_tajweed || w.text_uthmani }}
                      />
                    )
                  ))}
                  {revealedWords.length === 0 && !loadingQuestion && currentQuestion && (
                    <div className="prompt-ayat-placeholder">
                      {currentQuestion.text}
                    </div>
                  )}
                  {testMode === "teacher" && !loadingQuestion && revealedWords.length > 0 && (
                    <div className="continue-prompt-container">
                      <span className="continue-prompt">Continue recitation with full Ahkam...</span>
                    </div>
                  )}
                </div>

                <div className="q-meta-info" style={{ marginTop: '20px' }}>
                  <span className="q-page-pill">Page {currentQuestion.page}</span>
                  <span className={`q-diff-pill ${difficulty}`}>{difficulty} ({difficulty === 'easy' ? '7 Lines' : '15 Lines'})</span>
                </div>

                <div className="recording-controls-lively">
                  {!recording ? (
                    <button className="rec-btn-lively start" onClick={startRecording}><Mic size={24} /> Start Recitation</button>
                  ) : (
                    <button className="rec-btn-lively stop" onClick={stopRecording}><Square size={24} /> Finish & Save</button>
                  )}
                </div>

                {recording && (
                  <div className="live-mistake-panel fade-in">
                    <p className="live-label">🔴 MARK MISTAKES LIVE:</p>
                    <div className="mistake-btns-grid">
                      <button className="mistake-btn word" onClick={() => logWordMistake({ id: Date.now(), text_uthmani: 'Word' }, "Word")}>
                        Word Mistake
                      </button>
                      <button className="mistake-btn ahkam" onClick={() => logWordMistake({ id: Date.now(), text_uthmani: 'Ahkam' }, "Ahkam")}>
                        Ahkam/Makharij
                      </button>
                      <button className="mistake-btn beep" onClick={() => playBeep()}>
                        Manual Beep
                      </button>
                    </div>
                    <p className="helper-text">You can also tap words in the Mushaf above to mark specific Word mistakes.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="ikhtebar-history-section">
        <h3 className="section-title"><Clock size={18} /> Ikhtebar History & Quran References</h3>
        <div className="history-grid">
          {history.length === 0 ? (
            <div className="empty-history">No history found. Generate a question and start reciting!</div>
          ) : (
            history.map((entry, i) => (
              <div key={i} className="history-card-premium card-appear" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="history-card-top">
                  <span className="q-page-reference">Page {entry.page_number || "--"}</span>
                  <span className="timestamp">{new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
                <div className="history-card-main">
                  <div className="h-marhala-row">
                    <h4 className="arabic-kanz">{entry.marhala}</h4>
                    <div className="star-rating">
                      {[...Array(5)].map((_, idx) => (
                        <Sparkles key={idx} size={14} color={idx < (entry.score || 0) ? "var(--primary-gold)" : "#ccc"} fill={idx < (entry.score || 0) ? "var(--primary-gold)" : "transparent"} />
                      ))}
                    </div>
                    <span className={`mode-badge ${entry.mode}`}>{entry.mode}</span>
                  </div>

                  <div className="h-page-view quran-uthmani mushaf-card-view">
                    <div className="mistake-badge-counter">
                      {entry.mistakes?.length || 0} Mistakes Detected
                    </div>
                    {entry.verses_json?.map((v, vIdx) => (
                      <div key={vIdx} className="h-verse">
                        {v?.words?.map((w, wIdx) => {
                          if (!w) return null;
                          const mistake = entry.mistakes?.find(m => m && m.wordId === w.id);
                          return (
                            <span
                              key={wIdx}
                              className={`h-word ${mistake ? (mistake.type === 'Word' ? 'has-mistake' : 'has-mistake ahkam') : ''}`}
                              dangerouslySetInnerHTML={{ __html: w.text_tajweed || w.text_uthmani }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  <div className="history-mistake-feedback">
                    <strong>Feedback:</strong>
                    {entry.mistakes && entry.mistakes.length > 0 ? (
                      <div className="mistake-tag-row">
                        {entry.mistakes.map((m, idx) => (
                          <span key={idx} className={`mistake-dot ${m.type === 'Word' ? 'blue' : 'yellow'}`}>
                            {m.wordText || m.type}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="perfect-score">Excellent! Perfect Recitation ⭐</p>
                    )}
                  </div>
                </div>
                <div className="history-card-footer">
                  {entry.audio_url && (
                    <div className="history-audio-box">
                      <WaveSurferPlayer url={entry.audio_url} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5px' }}>
                        <button className="btn-text-only" onClick={() => downloadFile(entry.audio_url, `ikhtebar_p${entry.page_number}.webm`)}>
                          <Download size={14} /> Download Recording
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


function AnnouncementsPage({ notifications, setActivePage, setSelectedAnnouncement }) {
  const images = [
    "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1577563908411-50cb98976ffe?auto=format&fit=crop&w=400&q=80"
  ];

  return (
    <div className="announcements-page fade-in">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h2 className="premium-title">System Announcements</h2>
          <p className="subtitle">Important updates and notifications from the administration</p>
        </div>
      </div>
      <div className="announcements-grid">
        {notifications.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <Bell size={48} style={{ opacity: 0.2 }} />
            <p>No new announcements</p>
          </div>
        ) : (
          notifications.map((n, i) => (
            <div key={n.id} className="announce-card">
              <img src={images[i % images.length]} alt="Announcement" className="announce-img" />
              <div className="announce-content">
                <div className="announce-badge">{n.target_role === 'all' ? 'Broadcast' : 'Targeted'}</div>
                <h4>{n.title}</h4>
                <p>{n.body}</p>
                <div className="announce-footer">
                  <span className="announce-time">{new Date(n.created_at).toLocaleDateString()}</span>
                  <button className="announce-btn" onClick={() => {
                    setSelectedAnnouncement(n);
                  }}>
                    Open Details <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
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

async function findParentProfiles(userId, email = null) {
  let query = supabase
    .from("child_profiles")
    .select("*");

  if (userId && email) {
    query = query.or(`parent_user_id.eq.${userId},parent_email.ilike.${email.trim()}`);
  } else if (userId) {
    query = query.eq("parent_user_id", userId);
  } else if (email) {
    query = query.ilike("parent_email", email.trim());
  } else {
    return [];
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
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
    const parentProfiles = await findParentProfiles(user.id, user.email);

    if (parentProfiles.length > 0) {
      return {
        ok: true,
        role: "parents",
        assignedRoles: assignedRoles.length > 0 ? assignedRoles : ["parents"],
        parentProfile: parentProfiles[0],
        allParentProfiles: parentProfiles,
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

function buildStudents(childProfiles = [], weeklyResults = [], teacherProfiles = []) {
  // Calculate dynamic ranks per week
  const resultsByWeek = {};
  weeklyResults.forEach(r => {
    if (!r.week_date) return;
    if (!resultsByWeek[r.week_date]) resultsByWeek[r.week_date] = [];
    resultsByWeek[r.week_date].push(r);
  });

  const rankMap = new Map(); // key: student_id + week_date
  Object.keys(resultsByWeek).forEach(week => {
    const weekResults = resultsByWeek[week];
    const sorted = [...weekResults].sort((a, b) => (Number(b.total_score) || 0) - (Number(a.total_score) || 0));

    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && (Number(sorted[i].total_score) || 0) < (Number(sorted[i - 1].total_score) || 0)) {
        currentRank = i + 1;
      }
      const resId = String(sorted[i].student_id || "").trim().toLowerCase();
      rankMap.set(`${resId}-${week}`, currentRank);
    }
  });

  const latestResultMap = new Map();
  // Sort by date descending to get the latest result first
  const sortedByDate = [...weeklyResults].sort((a, b) => new Date(b.week_date) - new Date(a.week_date));

  const getEffectiveScore = (r) => {
    if (r.total_score !== undefined && r.total_score !== null && r.total_score !== "") return Number(r.total_score);
    return (Number(r.murajazah) || 0) + (Number(r.juz_hali) || 0) + (Number(r.takhteet) || 0) + (Number(r.jadeed) || 0);
  };

  sortedByDate.forEach((result) => {
    const resId = String(result.student_id || "").trim().toLowerCase();
    if (resId && !latestResultMap.has(resId)) {
      // For now, we'll use the weekly rank if it exists, but we'll recalculate global rank below
      const weeklyRank = rankMap.get(`${resId}-${result.week_date}`);
      latestResultMap.set(resId, { ...result, weeklyRank, effectiveScore: getEffectiveScore(result) });
    }
  });

  // Calculate Global Rank among all students' latest results
  const latestResultsArray = Array.from(latestResultMap.values());
  latestResultsArray.sort((a, b) => b.effectiveScore - a.effectiveScore);

  let currentGlobalRank = 1;
  for (let i = 0; i < latestResultsArray.length; i++) {
    if (i > 0 && latestResultsArray[i].effectiveScore < latestResultsArray[i - 1].effectiveScore) {
      currentGlobalRank = i + 1;
    }
    const resId = String(latestResultsArray[i].student_id || "").trim().toLowerCase();
    const resultInMap = latestResultMap.get(resId);
    if (resultInMap) {
      resultInMap.computedRank = currentGlobalRank;
    }
  }

  return childProfiles.map((profile) => {
    const sId = profile.student_id || profile.its || profile.id;
    const numericId = !isNaN(sId) ? Number(sId) : sId;
    
    const normalizeId = (id) => String(id || "").trim().toLowerCase();
    const pId = normalizeId(profile.id);
    const psId = normalizeId(profile.student_id);
    const pIts = normalizeId(profile.its);

    const latestResult = 
      (pId && latestResultMap.get(pId)) || 
      (psId && latestResultMap.get(psId)) || 
      (pIts && latestResultMap.get(pIts)) ||
      (Array.from(latestResultMap.values()).find(r => 
        profile.full_name && r.full_name && normalizeText(r.full_name) === normalizeText(profile.full_name)
      )) || null;

    const teacherInProfiles = teacherProfiles.find(t =>
      (profile.teacher_id && (t.id === profile.teacher_id || t.user_id === profile.teacher_id))
    );

    return {
      ...profile,
      id: profile.id,
      student_id: numericId,
      name: profile.full_name,
      arabic_name: fixArabicScript(profile.arabic_name),
      its: profile.its || "...",
      latestResult,
      teacherName: profile.teacher_name || teacherInProfiles?.full_name || "Unassigned teacher",
      groupName: profile.group_name || "Ungrouped",
      muhaffiz_id: profile.teacher_id || null,
      user_id: profile.parent_user_id || null,
      parent_email: profile.parent_email || null,
      photoUrl: profile.photo_url || "",
      hifz: {
        juz: profile.juz || "N-A",
        surat: profile.surat || "Pending",
      },
      hifzStatus: profile.surat ? `Memorizing ${profile.surat}` : "Status pending",
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
          <option key={name} value={i + 1} className="arabic-kanz" style={{ fontSize: '1.1rem' }}>{name}</option>
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
            size={20}
            className={`attendance-star ${isFilled ? 'filled' : 'empty'}`}
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
      <div>
        <h4 className="attendance-rating-text kids-font">
          {count || 0} out of {total} Presence
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
      <h4 className="attendance-rating-text arabic-kanz" dir="rtl" style={{ fontSize: '1.6rem', fontFamily: "'Kanz al Marjaan', serif", marginTop: '8px', color: 'var(--deep-brown)', letterSpacing: 'normal' }}>
        جديد صفحات
      </h4>
      <p className="attendance-sub-label" style={{ textAlign: 'center', fontSize: '11px' }}>
        New pages memorized this week
      </p>
    </div>
  );
}

function TahfeezReportCard({ student, weeklyResult, settings }) {
  const arabicStyle = { fontFamily: "'Kanz al Marjaan', serif" };
  const fatemi = getFatemiInfo(weeklyResult?.week_date);

  const hMain = settings?.main_heading || "Rawdat Tahfeez al Atfal";
  const hSub = settings?.sub_heading || "TAHFEEZ REPORT 1447H";
  const hWusool = settings?.wusool_heading || "وصول الى الاْن";
  const hNext = settings?.next_week_heading || "Next Week Target";
  const hIstifadah = settings?.istifadah_heading || "Target Till Istifadah";

  return (
    <div className="progress-overview">
      <div className="result-card-premium card-appear">
        <div className="result-card-header" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="school-logo" style={{ marginBottom: '12px' }}><img src="/logo.png" alt="Logo" /></div>
          <div className="school-info" style={{ textAlign: 'center' }}>
            <h2 className="kids-font" style={{ fontSize: '2.5rem', color: 'var(--deep-brown)', margin: 0, textTransform: 'uppercase' }}>{hMain}</h2>
            <h4 className="kids-font" style={{ fontSize: '1.4rem', color: 'var(--primary-gold)', margin: '4px 0 0' }}>{hSub}</h4>
            <div className="report-student-name" style={{ fontSize: '1.1rem', color: 'var(--soft-brown)', marginTop: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {student?.name}
            </div>
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
            <div className="score-circle">
              {(weeklyResult?.total_score ?? 
                (toNumber(weeklyResult?.murajazah) + 
                 toNumber(weeklyResult?.juz_hali) + 
                 toNumber(weeklyResult?.takhteet) + 
                 toNumber(weeklyResult?.jadeed))) || "0"}
            </div>
            <span className="max-score"> / 100</span>
          </div>

          <div className="score-details-box">
            {[
              { label: "مراجعة", val: weeklyResult?.murajazah, max: 30 },
              { label: "جزء حالي", val: weeklyResult?.juz_hali, max: 30 },
              { label: "تخطيط", val: weeklyResult?.takhteet, max: 20 },
              { label: "جديد", val: weeklyResult?.jadeed, max: 20 }
            ].map((item) => (
              <div key={item.label} className="score-row" dir="rtl">
                <span className="arabic-label arabic-kanz" style={arabicStyle}>{item.label} :</span>
                <span className="score-val" dir="ltr">{item.val || "0"} / {item.max}</span>
              </div>
            ))}
          </div>

          <div className="trophy-container">
            <Trophy size={100} className="trophy-icon trophyPulse" />
            <span className="rank-text-overlay rankPop rankCelebration" key={weeklyResult?.computedRank || weeklyResult?.rank}>
              {weeklyResult?.computedRank || weeklyResult?.rank || "-"}
            </span>
          </div>
        </div>

        <div className="result-footer-grid">
          <div className="target-box highlight-wusool">
            <h5 className="arabic-kanz" dir="rtl" style={{ ...arabicStyle, fontSize: '1.4rem', color: 'var(--deep-brown)', letterSpacing: 'normal' }}>{hWusool}</h5>
            <p dir="rtl"><span className="arabic-kanz" style={arabicStyle}>الجزء :</span> {weeklyResult?.wusool_juz || "-"}</p>
            <p dir="rtl"><span className="arabic-kanz" style={arabicStyle}>صــ :</span> {weeklyResult?.wusool_page || "-"}</p>
          </div>
          <div className="target-box highlight-matrookah">
            <div className="note-item-row">
              <span className="note-val">{weeklyResult?.matrookah || "-"}</span>
              <span className="note-label arabic-kanz" style={arabicStyle}>متروكة :</span>
            </div>
            <div className="note-item-row">
              <span className="note-val">{weeklyResult?.daeefah || "-"}</span>
              <span className="note-label arabic-kanz" style={arabicStyle}>ضعيفة :</span>
            </div>
          </div>
          <div className="target-box">
            <h5 className="kids-font">{hNext}</h5>
            <p dir="rtl"><span className="arabic-kanz" style={arabicStyle}>الجزء :</span> {weeklyResult?.next_week_juz || "-"}</p>
            <p dir="rtl"><span className="arabic-kanz" style={arabicStyle}>صــ :</span> {weeklyResult?.next_week_page || "-"}</p>
          </div>
          <div className="target-box highlight">
            <h5 className="kids-font">{hIstifadah}</h5>
            <p dir="rtl"><span className="arabic-kanz" style={arabicStyle}>الجزء :</span> {weeklyResult?.istifadah_juz || "-"}</p>
            <p dir="rtl"><span className="arabic-kanz" style={arabicStyle}>صــ :</span> {weeklyResult?.istifadah_page || "-"}</p>
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

// --- Premium Chat Components ---

function SettingsPage({ 
  isDarkMode, 
  setIsDarkMode, 
  appTheme, 
  setAppTheme, 
  user, 
  studentProfile,
  onShowAction 
}) {
  const [activeTab, setActiveTab] = useState("Dark mode");
  const tabs = ["Dark mode", "App themes", "Notifications", "Security", "Support", "About"];
  const [passForm, setPassForm] = useState({ newPassword: "", confirmPassword: "" });

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
      onShowAction("error", "Passwords do not match.");
      return;
    }
    if (passForm.newPassword.length < 6) {
      onShowAction("error", "Password must be at least 6 characters.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: passForm.newPassword
    });

    if (error) {
      onShowAction("error", "Failed to update password: " + error.message);
    } else {
      onShowAction("success", "Password updated successfully!");
      setPassForm({ newPassword: "", confirmPassword: "" });
    }
  };

  const themes = [
    { id: "default", name: "Classic Premium", desc: "The original elegant look", color: "#5d4037" },
    { id: "childish", name: "Playful Learning", desc: "Colorful and fun for kids", color: "#ff8a65" },
    { id: "men", name: "Executive Dark", desc: "Professional and sleek", color: "#263238" },
    { id: "women", name: "Royal Grace", desc: "Sophisticated and soft tones", color: "#8e24aa" },
  ];

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const page = formData.get("page_issue");
    const desc = formData.get("description");

    const userName = studentProfile?.guardian_name || 
                     user?.user_metadata?.full_name || 
                     user?.email?.split('@')[0] || 
                     "User";

    const { error } = await supabase.from("portal_issues").insert([{
      user_id: user.id,
      user_name: userName,
      page_issue: page,
      description: desc,
      status: 'open'
    }]);

    if (error) {
      onShowAction("error", "Failed to send ticket: " + error.message);
    } else {
      onShowAction("success", "Support ticket sent to Admin!");
      e.target.reset();
    }
  };

  return (
    <div className="settings-page fade-in">
      <div className="section-title-block">
        <h2 className="page-title">Portal Settings</h2>
        <p className="page-eyebrow">Personalize your experience</p>
      </div>

        {tabs.map(tab => (
          <button 
            key={tab} 
            className={`settings-tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "Dark mode" && <Moon size={16} />}
            {tab === "App themes" && <Palette size={16} />}
            {tab === "Notifications" && <Bell size={16} />}
            {tab === "Security" && <Lock size={16} />}
            {tab === "Support" && <LifeBuoy size={16} />}
            {tab === "About" && <Info size={16} />}
            {tab}
          </button>
        ))}

      <div className="settings-content premium-card card-appear">
        {activeTab === "Dark mode" && (
          <div className="settings-tab-pane">
            <h3>Appearance</h3>
            <p>Switch between light and dark visual modes.</p>
            <div className="setting-control-row">
              <div className="control-label">
                {isDarkMode ? <Moon className="gold-icon" /> : <Sun className="gold-icon" />}
                <span>Dark Mode Status</span>
              </div>
              <button 
                className={`toggle-switch ${isDarkMode ? 'on' : 'off'}`}
                onClick={() => setIsDarkMode(!isDarkMode)}
              >
                <div className="toggle-thumb" />
              </button>
            </div>
          </div>
        )}

        {activeTab === "Notifications" && (
          <div className="settings-tab-pane">
            <h3>Notifications</h3>
            <p>Control how you receive alerts about your child's progress.</p>
            <NotificationStatus role="parents" />
            <div className="hint-text" style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <Info size={14} /> If you are still not receiving alerts after enabling, check your browser permissions for this site by clicking the lock icon in the address bar.
            </div>
          </div>
        )}

        {activeTab === "Security" && (
          <div className="settings-tab-pane">
            <h3>Security & Password</h3>
            <p>Update your portal access credentials.</p>
            <form className="stack-form" onSubmit={handleUpdatePassword}>
              <label>
                <span>New Password</span>
                <input 
                  type="password" 
                  className="premium-input" 
                  value={passForm.newPassword}
                  onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                  placeholder="Min 6 characters"
                  required
                />
              </label>
              <label>
                <span>Confirm New Password</span>
                <input 
                  type="password" 
                  className="premium-input" 
                  value={passForm.confirmPassword}
                  onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                  placeholder="Re-type password"
                  required
                />
              </label>
              <button type="submit" className="action-button">
                Update Password
              </button>
            </form>
          </div>
        )}

        {activeTab === "App themes" && (
          <div className="settings-tab-pane">
            <h3>Premium Themes</h3>
            <p>Choose a visual style that matches your preference.</p>
            <div className="themes-grid">
              {themes.map(t => (
                <div 
                  key={t.id} 
                  className={`theme-card ${appTheme === t.id ? 'selected' : ''}`}
                  onClick={() => setAppTheme(t.id)}
                >
                  <div className="theme-preview" style={{ backgroundColor: t.color }}>
                    {appTheme === t.id && <CheckCircle size={24} color="white" />}
                  </div>
                  <div className="theme-info">
                    <h4>{t.name}</h4>
                    <p>{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Support" && (
          <div className="settings-tab-pane">
            <h3>Technical Support</h3>
            <p>Encountering an issue? Let our team know.</p>
            <form className="stack-form" onSubmit={handleSupportSubmit}>
              <label>
                <span>Which page has the issue?</span>
                <select name="page_issue" className="premium-select" required>
                  <option value="Home">Home Dashboard</option>
                  <option value="Schedule">Daily Schedule</option>
                  <option value="Progress">Progress Report</option>
                  <option value="Announcements">Announcements</option>
                  <option value="Teachers">Teacher Contacts</option>
                  <option value="Quran Ikhtebar">Quran Ikhtebar</option>
                  <option value="Hub Raqam">Hub Raqam (Fees)</option>
                  <option value="Other">Other / General Issue</option>
                </select>
              </label>
              <label>
                <span>Describe your issue</span>
                <textarea 
                  name="description" 
                  className="premium-input" 
                  placeholder="Tell us what happened..." 
                  rows="4" 
                  required
                ></textarea>
              </label>
              <button type="submit" className="action-button">
                <Send size={18} /> Send Support Ticket
              </button>
            </form>
          </div>
        )}

        {activeTab === "About" && (
          <div className="settings-tab-pane about-pane">
            <div className="about-header">
              <img src="/logo.png" alt="Mauze Tahfeez" className="about-logo" />
              <h3>Mauze Tahfeez Atfal</h3>
              <p>v2.4.0 Premium Portal</p>
            </div>
            <div className="about-details">
              <p>Mauze Tahfeez is a comprehensive Quran memorization tracking platform designed for the students and parents of Al-Madrasa tus Saifiya tul Burhaniyah.</p>
              <div className="program-details">
                <h4>Program Features:</h4>
                <ul>
                  <li>Real-time Progress Monitoring</li>
                  <li>Direct Teacher-Parent Communication</li>
                  <li>Automated Weekly Performance Reports</li>
                  <li>Interactive Quran Ikhtebar System</li>
                </ul>
              </div>
              <div className="registration-promo">
                <p>Join our specialized memorization programs today.</p>
                <a 
                  href="https://mahahalzahra.org" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="register-btn"
                >
                  Register Now at Mahad al Zahra <ArrowRight size={16} />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SupportTicketsAdmin({ tickets = [], onRefresh }) {
  const [filter, setFilter] = useState("all");

  const filteredTickets = (tickets || []).filter(t => filter === "all" || t.status === filter);

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from("portal_issues").update({ status }).eq("id", id);
    if (!error) onRefresh();
  };

  return (
    <div className="admin-section fade-in">
      <div className="section-header">
        <h2 className="premium-title">User Issues & Support</h2>
        <div className="filter-group premium-segmented-control">
          {["all", "open", "resolved"].map(s => (
            <button 
              key={s} 
              className={`filter-btn ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="tickets-list premium-grid" style={{ marginTop: '24px' }}>
        {filteredTickets.map(t => (
          <div key={t.id} className={`ticket-card premium-glass-card ${t.status || 'open'}`}>
            <div className="ticket-header">
              <div className="user-info">
                <div className="user-avatar-mini">{t.user_name?.charAt(0) || 'U'}</div>
                <span className="user-name-tag">{t.user_name || 'Anonymous'}</span>
              </div>
              <span className={`status-pill ${t.status || 'open'}`}>
                {t.status === 'resolved' ? <CheckCircle size={12} /> : <Info size={12} />}
                {t.status || 'open'}
              </span>
            </div>
            
            <div className="ticket-content">
              <div className="issue-context">
                <span className="context-label">Page:</span>
                <span className="context-value">{t.page_issue}</span>
              </div>
              <p className="issue-description">{t.description}</p>
              <span className="ticket-date">{new Date(t.created_at).toLocaleDateString()} at {new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>

            <div className="ticket-actions">
              {t.status === 'open' ? (
                <button className="premium-action-button success" onClick={() => updateStatus(t.id, 'resolved')}>
                  <CheckCircle size={16} /> Mark as Resolved
                </button>
              ) : (
                <button className="premium-action-button secondary" onClick={() => updateStatus(t.id, 'open')}>
                  <RotateCw size={16} /> Reopen Issue
                </button>
              )}
            </div>
          </div>
        ))}
        
        {filteredTickets.length === 0 && (
          <div className="empty-state-card card-appear">
            <LifeBuoy size={64} className="floating-icon" />
            <h3>No Support Tickets</h3>
            <p>Everything is running smoothly! No {filter !== 'all' ? filter : ''} issues found.</p>
            <button className="action-button secondary" onClick={onRefresh}>
              <RotateCw size={18} /> Refresh Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChildLeaveApply({ studentProfile, showAction }) {
  const [leaveType, setLeaveType] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("checking");
  const [timeLeft, setTimeLeft] = useState("");
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    checkTime();
    fetchHistory();
    const timer = setInterval(checkTime, 60000);
    return () => clearInterval(timer);
  }, [studentProfile]);

  const checkTime = () => {
    const now = new Date();
    const hours = now.getHours();
    if (hours >= 0 && hours < 16) {
      setStatus("open");
      const closingTime = new Date();
      closingTime.setHours(16, 0, 0, 0);
      const diff = closingTime - now;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m remaining for today`);
    } else {
      setStatus("closed");
      setTimeLeft("Window opens again at 12:00 AM");
    }
  };

  const fetchHistory = async () => {
    if (!studentProfile) return;
    setLoadingHistory(true);
    console.log("Parent: Fetching history for student:", studentProfile.student_id);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    // Fetch by student_id (string conversion for safety)
    const { data, error } = await supabase
      .from('student_leaves')
      .select('*')
      .eq('student_id', String(studentProfile.student_id))
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Parent History Error:", error);
      // Fallback: try by parent_id if student_id check fails
      const { data: fallbackData } = await supabase
        .from('student_leaves')
        .select('*')
        .eq('parent_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (fallbackData) setHistory(fallbackData);
    } else {
      setHistory(data || []);
    }
    setLoadingHistory(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return showAction("error", "File size must be under 2MB");
      const reader = new FileReader();
      reader.onloadend = () => setAttachment(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "closed") return;
    if (!leaveType) return showAction("error", "Please select a leave type.");
    
    if (leaveType === "ILLNESS" && !attachment) return showAction("error", "Medical document is required for illness.");
    if (["EMERGENCY", "Miqaat", "other"].includes(leaveType) && !reason.trim()) return showAction("error", "Please provide details.");

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: dbErr } = await supabase.from('student_leaves').insert({
        student_id: studentProfile?.student_id,
        parent_id: user?.id,
        leave_type: leaveType,
        reason: reason,
        attachment_url: attachment,
        leave_date: new Date().toISOString().split('T')[0]
      });
      if (dbErr) throw dbErr;

      await supabase.functions.invoke('fcm-notification', {
        body: {
          title: `Leave: ${leaveType}`,
          body: `${studentProfile?.name} applied for leave (${leaveType}).`,
          targetRole: 'admin'
        }
      });

      showAction("success", "Leave applied successfully!");
      setLeaveType("");
      setReason("");
      setAttachment(null);
      fetchHistory();
    } catch (err) {
      showAction("error", "Failed to submit leave.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showTextBox = ["EMERGENCY", "Miqaat", "other"].includes(leaveType);
  const showUpload = leaveType === "ILLNESS";

  return (
    <div className="leave-apply-container card-appear">
      <div className="premium-card leave-card" style={{ position: 'relative', overflow: 'hidden', marginBottom: '30px' }}>
        <div className="leave-header-strip" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className={`status-indicator-ring ${status}`}>
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, color: 'var(--deep-brown)' }}>Apply Student Leave</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: status === 'open' ? '#2e7d32' : '#d32f2f', fontWeight: 'bold' }}>
                {timeLeft}
              </p>
            </div>
          </div>
          <span className={`status-pill ${status}`}>
            {status === 'open' ? 'Window Active' : 'Window Closed'}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--deep-brown)' }}>Select Leave Type</label>
            <select
              className="premium-select"
              value={leaveType}
              onChange={(e) => {
                setLeaveType(e.target.value);
                setReason("");
                setAttachment(null);
              }}
              disabled={status === 'closed' || isSubmitting}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #ddd', fontSize: '1rem' }}
              required
            >
              <option value="">-- Choose Category --</option>
              <option value="ILLNESS">ILLNESS (Document Required)</option>
              <option value="EVENT">EVENT</option>
              <option value="EMERGENCY">EMERGENCY (Details Required)</option>
              <option value="Miqaat">Miqaat (Details Required)</option>
              <option value="other">Other (Details Required)</option>
            </select>
          </div>

          {showUpload && (
            <div className="form-group card-appear" style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '12px', border: '1px dashed var(--primary-gold)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 'bold', color: '#d32f2f' }}>
                <FileArchive size={16} /> Upload Medical Document (Required)
              </label>
              <input 
                type="file" 
                accept="image/*,.pdf" 
                onChange={handleFileChange}
                disabled={isSubmitting}
                style={{ width: '100%' }}
                required
              />
              {attachment && <p style={{ fontSize: '0.75rem', color: '#2e7d32', marginTop: '5px' }}>✓ Document attached successfully</p>}
            </div>
          )}

          {showTextBox && (
            <div className="form-group card-appear" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--deep-brown)' }}>Provide Details (Required)</label>
              <textarea
                className="premium-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`Please explain the ${leaveType.toLowerCase()}...`}
                disabled={isSubmitting}
                style={{ width: '100%', minHeight: '100px', padding: '15px', borderRadius: '12px', border: '1px solid #ddd' }}
                required
              />
            </div>
          )}

          <button
            type="submit"
            className={`leave-submit-btn ${status}`}
            disabled={status === 'closed' || isSubmitting}
            style={{ 
              width: '100%', 
              padding: '16px', 
              borderRadius: '12px', 
              border: 'none', 
              background: status === 'open' ? 'var(--primary-gold)' : '#ccc', 
              color: 'white', 
              fontWeight: 'bold', 
              fontSize: '1rem', 
              cursor: status === 'open' ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            {status === 'open' ? 'Submit Leave Application' : 'Submission Closed'}
          </button>
        </form>

        {status === 'closed' && (
          <div className="lock-watermark" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.03, pointerEvents: 'none' }}>
            <Lock size={200} />
          </div>
        )}
      </div>

      <div className="leave-history-section card-appear" style={{ animationDelay: '0.2s' }}>
        <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Clock size={20} style={{ color: 'var(--primary-gold)' }} />
          <h3 style={{ margin: 0, color: 'var(--deep-brown)' }}>My Leave History</h3>
        </div>

        <div className="history-stack" style={{ display: 'grid', gap: '12px' }}>
          {loadingHistory ? (
            <div className="empty-state"><Loader2 className="animate-spin" /> Loading history...</div>
          ) : history.map(item => (
            <div key={item.id} className="history-card premium-card" style={{ padding: '15px', borderLeft: `4px solid ${item.status === 'Approved' ? '#4caf50' : item.status === 'Rejected' ? '#f44336' : '#ff9800'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary-gold)', textTransform: 'uppercase' }}>{item.leave_type}</span>
                  <h4 style={{ margin: '4px 0', fontSize: '1rem' }}>{item.leave_date}</h4>
                </div>
                <span className={`status-pill ${item.status.toLowerCase()}`} style={{ fontSize: '0.7rem', padding: '4px 10px' }}>{item.status}</span>
              </div>
              {item.reason && <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '8px', margin: '8px 0 0' }}>{item.reason}</p>}
            </div>
          ))}
          {history.length === 0 && !loadingHistory && (
            <div className="empty-state" style={{ padding: '40px' }}>
              <CalendarX size={32} opacity={0.2} />
              <p>No previous leave records found.</p>
            </div>
          )}
        </div>
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
  onRoleChange,
  teacherProfiles = [],
  setSelectedStudentId,
  onLogout,
  loadPortalData,
  portalRole,
  setSelectedAnnouncement,
  isDarkMode,
  setIsDarkMode,
  appTheme,
  setAppTheme,
  showAction,
  schoolData,
}) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { studentProfile, allProfiles = [], hifzDetails, announcements, schedule, attendance, weeklyResult, reportSettings } = parentData;

  const handleDownloadReport = async () => {
    if (!studentProfile) return;
    
    setIsGeneratingPDF(true);
    if (showAction) showAction("success", "Preparing your child's progress report...");

    // Wait for render
    let element = null;
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 400));
      element = document.getElementById("parent-capture-content");
      if (element) break;
    }

    if (element) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        if (imgData.length < 5000) throw new Error("Capture failed");

        const pdfWidth = 210;
        const imgProps = new jsPDF().getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        const finalPdfHeight = Math.max(297, pdfHeight);

        const pdf = new jsPDF({
          orientation: "p",
          unit: "mm",
          format: [pdfWidth, finalPdfHeight]
        });

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${(studentProfile.name || "Student").replace(/[^a-z0-9]/gi, '_')}_Report.pdf`);
        if (showAction) showAction("success", "Report downloaded successfully!");
      } catch (err) {
        console.error("PDF Error:", err);
        if (showAction) showAction("error", "Failed to generate PDF.");
      }
    } else {
      if (showAction) showAction("error", "Capture element not found.");
    }
    
    setIsGeneratingPDF(false);
  };
  parentData;

  const pageNames = ["Home", "Schedule", "Progress", "Announcements", "Teachers", "Quran Ikhtebar", "Settings"];
  const assignedRoles = getAssignedRoles(user);

  const navigationMap = {
    "Home": "Home",
    "Schedule": "Schedule",
    "Announcements": "Announcements",
    "Teachers": "Teachers",
    "Progress": "Child Summary",
    "Profile": "Profile",
    "Quran Ikhtebar": "Quran Ikhtebar",
    "Settings": "Settings",
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
        name: studentProfile?.name || allProfiles[0]?.name || "Loading Student...",
        its: studentProfile?.its || allProfiles[0]?.its || "...",
        hifzJuz: hifzDetails?.juz || "...",
        hifzSurat: hifzDetails?.surat || "...",
        muhaffizName: hifzDetails?.muhaffiz_name || "Unassigned",
      },
    },
    Home: {
      eyebrow: "Parents Home",
      title: `Welcome back, ${studentProfile?.guardian_name || "Guardian"}`,
      description:
        "Access your child's daily learning schedule, important announcements, and school actions here.",
      highlights: [
        `Attendance: ${attendance?.status || "Present"}`,
        `Lesson: ${studentProfile?.latestResult?.surat || studentProfile?.surat || hifzDetails?.surat || "Update pending"}`,
        `Wusool: Juz ${studentProfile?.latestResult?.wusool_juz || "--"} · Page ${studentProfile?.latestResult?.wusool_page || "--"}`,
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
        <SidebarHeader
          photoUrl={studentProfile?.photoUrl || studentProfile?.photo_url || studentProfile?.avatar_url || "/logo.png"}
          name={studentProfile?.name || "Student"}
          arabicName={studentProfile?.arabic_name}
          tag={`ITS: ${studentProfile?.its || "..."}`}
        />
        <button className="drawer-close" onClick={() => setMenuOpen(false)}><X size={20} /></button>


        {allProfiles.length > 1 && (
          <div className="drawer-nav" style={{ paddingBottom: 0 }}>
            <p className="drawer-section-label">Switch Child</p>
            <div className="child-switch-list">
              {allProfiles.map(p => (
                <button
                  key={p.student_id}
                  className={`drawer-link ${String(p.student_id) === String(studentProfile?.student_id) ? "active" : ""}`}
                  onClick={() => { setSelectedStudentId(p.student_id); setMenuOpen(false); }}
                >
                  <User size={16} /> {p.full_name}
                </button>
              ))}
            </div>
          </div>
        )}
        <nav className="drawer-nav">
          <p className="drawer-section-label">More Pages</p>
          <button className={`drawer-link ${activePage === "Announcements" ? "active" : ""}`} onClick={() => { setActivePage("Announcements"); setMenuOpen(false); }}>
            <Bell size={18} /> Announcements
          </button>
          <button className={`drawer-link ${activePage === "Profile" ? "active" : ""}`} onClick={() => { setActivePage("Profile"); setMenuOpen(false); }}>
            <User size={18} /> My Profile
          </button>
          <button className={`drawer-link ${activePage === "Quran Ikhtebar" ? "active" : ""}`} onClick={() => { setActivePage("Quran Ikhtebar"); setMenuOpen(false); }}>
            <BookOpen size={18} /> Quran Ikhtebar
          </button>
          <button className={`drawer-link ${activePage === "Hub Raqam" ? "active" : ""}`} onClick={() => { setActivePage("Hub Raqam"); setMenuOpen(false); }}>
            <CreditCard size={18} /> Hub Raqam
          </button>
          <button className={`drawer-link ${activePage === "Apply Leave" ? "active" : ""}`} onClick={() => { setActivePage("Apply Leave"); setMenuOpen(false); }}>
            <CalendarX size={18} /> Apply Leave
          </button>
          <button className={`drawer-link ${activePage === "Settings" ? "active" : ""}`} onClick={() => { setActivePage("Settings"); setMenuOpen(false); }}>
            <Settings size={18} /> Settings
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
        </div>

        {allProfiles.length > 1 && (
          <div className="topbar-student-switcher">
            <select
              className="student-select-minimal"
              value={studentProfile?.student_id}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              {allProfiles.map(p => (
                <option key={p.student_id} value={p.student_id}>{p.full_name.split(' ')[0]}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      <main className="parent-main">
        {activePage === "Home" && (
           <QuickSearch 
             pages={[
               { label: "Home Dashboard", value: "Home" },
               { label: "Daily Schedule", value: "Schedule" },
               { label: "Progress Report", value: "Progress" },
               { label: "Announcements", value: "Announcements" },
               { label: "Teacher Profiles", value: "Teachers" },
               { label: "Quran Ikhtebar", value: "Quran Ikhtebar" },
               { label: "Hub Raqam (Fees)", value: "Hub Raqam" },
               { label: "My Profile", value: "Profile" },
               { label: "App Settings", value: "Settings" }
             ]} 
             onSelect={setActivePage} 
           />
        )}
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
                <h3 style={{ margin: 0 }}>
                  {currentPage.childInfo.name}
                </h3>
                {studentProfile?.arabic_name && (
                  <div className="arabic-kanz" style={{ fontSize: '1.4rem', color: 'var(--primary-gold)', fontFamily: "'Kanz al Marjaan', serif", marginTop: '4px' }}>
                    {fixArabicScript(studentProfile.arabic_name)}
                  </div>
                )}
                <p style={{ marginTop: '8px' }}>
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

        {activePage === "Apply Leave" && (
          <ChildLeaveApply studentProfile={studentProfile} showAction={showAction} />
        )}

        {activePage === "Child Summary" ? (
          <div className="card-appear">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button 
                className="action-button premium" 
                onClick={handleDownloadReport}
                disabled={isGeneratingPDF}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
              >
                {isGeneratingPDF ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                {isGeneratingPDF ? "Generating PDF..." : "Download Report"}
              </button>
            </div>

            {(() => {
              const settings = Array.isArray(reportSettings) ? reportSettings[0] : reportSettings;
              const isLive = settings?.reports_live !== false;
              const liveAt = settings?.live_at ? new Date(settings.live_at) : null;
              const now = new Date();
              const isScheduled = liveAt && liveAt > now;

              if (!isLive || isScheduled) {
                return (
                  <div className="empty-state card-appear" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--white-alpha)', borderRadius: '24px', border: '2px dashed var(--primary-gold)' }}>
                    <Clock size={48} style={{ color: 'var(--primary-gold)', marginBottom: '20px', opacity: 0.6 }} className="pulse" />
                    <h3 className="kids-font" style={{ fontSize: '1.8rem', color: 'var(--deep-brown)' }}>Report is being prepared!</h3>
                    <p style={{ color: 'var(--soft-brown)', maxWidth: '400px', margin: '10px auto' }}>
                      {isScheduled 
                        ? `This week's progress card will be live on ${liveAt.toLocaleDateString()} at ${liveAt.toLocaleTimeString()}.`
                        : "The administration is currently finalizing the results. Please check back shortly."}
                    </p>
                    <div className="loading-spinner-mini" style={{ marginTop: '20px' }}></div>
                  </div>
                );
              }

              return (
                <TahfeezReportCard
                  student={{
                    name: studentProfile?.name,
                    groupName: studentProfile?.groupName || studentProfile?.class_level,
                  }}
                  weeklyResult={weeklyResult || studentProfile?.latestResult}
                  settings={settings}
                />
              );
            })()}

            {/* Hidden capture zone for Parent Portal */}
            <div 
              id="parent-capture-zone"
              style={{ 
                position: 'fixed', 
                left: '-10000px', 
                top: '0', 
                width: '850px', 
                zIndex: -1000, 
                background: 'white',
                overflow: 'hidden',
                height: isGeneratingPDF ? 'auto' : '1px',
                visibility: isGeneratingPDF ? 'visible' : 'hidden'
              }}
            >
              {isGeneratingPDF && (
                <div id="parent-capture-content" style={{ padding: '40px', background: 'white' }}>
                  <TahfeezReportCard
                    student={{
                      name: studentProfile?.name,
                      groupName: studentProfile?.groupName || studentProfile?.class_level,
                    }}
                    weeklyResult={weeklyResult || studentProfile?.latestResult}
                    settings={Array.isArray(reportSettings) ? reportSettings[0] : reportSettings}
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activePage === "Announcements" ? (
          <AnnouncementsPage
            notifications={parentData.announcements}
            setActivePage={setActivePage}
            setSelectedAnnouncement={setSelectedAnnouncement}
          />
        ) : null}

        {activePage === "Teachers" ? (
          <div className="card-appear">
            <div className="section-title-block">
              <p className="page-eyebrow">Our Professional Staff</p>
              <h2 className="page-title">Teacher Contacts</h2>
            </div>
            <div className="teacher-info-stack">
              {teacherProfiles
                .filter(t => {
                  const assignedName = normalizeText(studentProfile?.teacherName || "");
                  return assignedName && normalizeText(t.full_name) === assignedName;
                })
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
                .filter(t => {
                  const assignedName = normalizeText(studentProfile?.teacherName || "");
                  return !assignedName || normalizeText(t.full_name) !== assignedName;
                })
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

        {activePage === "Hub Raqam" ? (
          <div className="hub-raqam-container card-appear">
            <div className="hub-raqam-header">
              <h1 className="kids-font animate-bounce-subtle">Mauze Tahfeez - Hub Raqam</h1>
            </div>

            <div className="hub-raqam-content">
              <div className="payment-guideline-card card-appear">
                <div className="guideline-header">
                  <BookOpen size={22} className="gold-icon" />
                  <h3>Fee Payment Guidelines</h3>
                </div>
                <div className="guideline-steps">
                  <div className="step-item">
                    <div className="step-number">1</div>
                    <p>Go to the official Mahad al Zahra payment portal.</p>
                  </div>
                  <div className="step-item">
                    <div className="step-number">2</div>
                    <p>Enter your child's ITS number to fetch details.</p>
                  </div>
                  <div className="step-item">
                    <div className="step-number">3</div>
                    <p>Complete the payment and keep the receipt for your records.</p>
                  </div>
                </div>
              </div>

              <div className="guideline-media card-appear">
                <div className="media-title">
                  <Sparkles size={18} className="gold-icon" />
                  <h4>Visual Step-by-Step Walkthrough</h4>
                </div>
                <div className="demo-photo-grid">
                  <div className="demo-photo-item">
                    <img src="/payment-guide-1.jpg" alt="Login Step" className="guide-screenshot" />
                    <p className="guide-caption">Step 1: Open Sidebar & Select Payments</p>
                  </div>
                  <div className="demo-photo-item">
                    <img src="/payment-guide-2.jpg" alt="Payment Step" className="guide-screenshot" />
                    <p className="guide-caption">Step 2: Read Instructions & Pay Online</p>
                  </div>
                </div>
              </div>

              <div className="pay-now-section">
                <a
                  href="https://www.its52.com/Login.aspx?OneLogin=MAZSTUDENT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pay-now-btn-premium"
                >
                  <CreditCard size={20} />
                  <span>Pay Now</span>
                </a>
                <p className="payment-secure-note">
                  <ShieldCheck size={14} /> Official Payment Link Secure
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {activePage === "Quran Ikhtebar" ? (
          <QuranIkhtebar
            studentProfile={studentProfile}
            hifzDetails={hifzDetails}
          />
        ) : null}

        {activePage === "Settings" ? (
          <SettingsPage 
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            appTheme={appTheme}
            setAppTheme={setAppTheme}
            user={user}
            studentProfile={studentProfile}
            onShowAction={showAction}
          />
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



function AdminLeaveManagement({ onShowAction, students }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Pending");

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    console.log("Admin: Fetching all leaves...");
    const { data, error } = await supabase
      .from('student_leaves')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Admin Leave Fetch Error:", error);
      onShowAction("error", "Database Error: " + error.message);
    } else {
      console.log("Admin: Leaves fetched:", data?.length);
      setLeaves(data || []);
    }
    setLoading(false);
  };

  const updateStatus = async (id, newStatus) => {
    const leaveToUpdate = leaves.find(l => l.id === id);
    const student = students.find(s => String(s.student_id) === String(leaveToUpdate?.student_id));
    
    const { error } = await supabase
      .from('student_leaves')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      onShowAction("error", "Failed to update status");
    } else {
      onShowAction("success", `Leave ${newStatus.toLowerCase()}!`);
      
      // Notify Parent
      if (leaveToUpdate?.parent_id) {
        supabase.functions.invoke('fcm-notification', {
          body: {
            title: `Leave ${newStatus}`,
            body: `The leave request for ${student?.name || 'your child'} has been ${newStatus.toLowerCase()}.`,
            targetRole: 'user',
            targetUser: leaveToUpdate.parent_id // Matched to Edge Function's expected key
          }
        });
      }
      
      fetchLeaves();
    }
  };

  const filteredLeaves = leaves.filter(l => l.status === filter);

  return (
    <div className="admin-leave-portal card-appear">
      <div className="portal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ color: 'var(--deep-brown)', margin: 0 }}>Student Leave Management</h2>
        <div className="filter-group" style={{ display: 'flex', gap: '10px' }}>
          {["Pending", "Approved", "Rejected"].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`filter-btn ${filter === s ? 'active' : ''}`}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: '1px solid #ddd',
                background: filter === s ? 'var(--primary-gold)' : 'white',
                color: filter === s ? 'white' : '#666',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.2s'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="leave-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {loading ? (
          <div className="loading-state" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>
            <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary-gold)' }} />
            <p>Loading requests...</p>
          </div>
        ) : filteredLeaves.map(leave => {
          const student = students.find(s => String(s.student_id) === String(leave.student_id));
          return (
            <div key={leave.id} className="premium-card leave-admin-card" style={{ padding: '20px', borderLeft: `4px solid ${leave.status === 'Approved' ? '#4caf50' : leave.status === 'Rejected' ? '#f44336' : '#ff9800'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{student?.name || "Unknown Student"}</h4>
                  <p style={{ margin: '4px 0', fontSize: '0.8rem', opacity: 0.6 }}>Applied: {new Date(leave.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`status-badge ${leave.status.toLowerCase()}`} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', background: leave.status === 'Approved' ? '#e8f5e9' : leave.status === 'Rejected' ? '#ffebee' : '#fff3e0', color: leave.status === 'Approved' ? '#2e7d32' : leave.status === 'Rejected' ? '#c62828' : '#e65100' }}>
                  {leave.status}
                </span>
              </div>
              
              <div style={{ marginTop: '16px', padding: '12px', background: '#f9f9f9', borderRadius: '12px', fontSize: '0.9rem', border: '1px solid #eee' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--deep-brown)', marginBottom: '4px' }}>Category: {leave.leave_type || "General"}</div>
                <p style={{ margin: 0, color: '#555', lineHeight: '1.4' }}>{leave.reason || "No details provided."}</p>
              </div>

              <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#666' }}>
                <strong>Leave Date:</strong> {leave.leave_date}
              </div>

              {leave.attachment_url && (
                <button 
                  onClick={() => window.open(leave.attachment_url, '_blank')}
                  className="view-doc-btn"
                  style={{ marginTop: '12px', width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--primary-gold)', color: 'var(--primary-gold)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
                >
                  <FileArchive size={16} /> View Medical Document
                </button>
              )}

              {leave.status === "Pending" && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button 
                    onClick={() => updateStatus(leave.id, "Approved")}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#4caf50', color: 'white', fontWeight: 'bold', cursor: 'pointer', transition: 'filter 0.2s' }}
                    onMouseOver={e => e.target.style.filter = 'brightness(1.1)'}
                    onMouseOut={e => e.target.style.filter = 'none'}
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => updateStatus(leave.id, "Rejected")}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#f44336', color: 'white', fontWeight: 'bold', cursor: 'pointer', transition: 'filter 0.2s' }}
                    onMouseOver={e => e.target.style.filter = 'brightness(1.1)'}
                    onMouseOut={e => e.target.style.filter = 'none'}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filteredLeaves.length === 0 && !loading && (
          <div className="empty-state" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', opacity: 0.3 }}>
            <Calendar size={64} />
            <h3 style={{ marginTop: '15px' }}>No {filter.toLowerCase()} requests</h3>
            <p>All student leave applications are up to date.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPortal({
  activePage,
  actionMessage,
  adminData,
  adminForms,
  menuOpen,
  portalAccess,
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
  onClearHistory,
  notifications,
  onUnassignChild,
  loadPortalData,
  portalRole,
  setSelectedAnnouncement,
  reportSettings = [],
  onShowAction,
}) {
  const { announcements, customGroups, schedule, students, teacherAttendance, portalAccessList, teacherProfiles, supportTickets = [] } = adminData;
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [isGeneratingReports, setIsGeneratingReports] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [studentToRender, setStudentToRender] = useState(null);

  const handleDownloadAllReports = async () => {
    if (students.length === 0) {
      if (onShowAction) onShowAction("error", "No students available to download reports.");
      return;
    }

    setIsGeneratingReports(true);
    setGenerationProgress(0);
    const zip = new JSZip();

    if (onShowAction) onShowAction("success", `Preparing ${students.length} reports... Please wait.`);

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      setStudentToRender(student);
      setGenerationProgress(i + 1);
      
      // Wait for React to render the component and assets (fonts/images) are loaded
      let element = null;
      const maxAttempts = 20;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 300)); 
        element = document.getElementById("actual-report-content");
        if (element) break;
      }

      if (element) {
        try {
          // Extra small delay to ensure images inside the element are settled
          await new Promise(resolve => setTimeout(resolve, 500)); 
          
          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
          });
          
          const imgData = canvas.toDataURL("image/png");
          if (imgData.length < 5000) {
            throw new Error("Captured image is blank or too small.");
          }

          const pdfWidth = 210; // A4 Width in mm
          
          // Create a temporary instance to calculate dimensions
          const pdf = new jsPDF({
            orientation: "p",
            unit: "mm",
            format: "a4"
          });
          
          const imgProps = pdf.getImageProperties(imgData);
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          const finalPdfHeight = Math.max(297, pdfHeight);
          
          // If height is custom, we need a new instance with that height
          let finalPdf = pdf;
          if (finalPdfHeight > 297) {
            finalPdf = new jsPDF({
              orientation: "p",
              unit: "mm",
              format: [pdfWidth, finalPdfHeight]
            });
          }
          
          finalPdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
          const pdfBlob = finalPdf.output("blob");
          const safeName = (student.name || `Student_${i+1}`).replace(/[^a-z0-9]/gi, '_');
          zip.file(`${i+1}_${safeName}_Report.pdf`, pdfBlob);
        } catch (err) {
          console.error(`Error generating PDF for ${student.name}:`, err);
          if (onShowAction) onShowAction("error", `Skipped ${student.name}: ${err.message}`);
        }
      } else {
        console.error(`Could not find capture element for ${student.name}`);
        if (onShowAction) onShowAction("error", `Technical Error: Could not render ${student.name}`);
      }
    }

    try {
      const content = await zip.generateAsync({ type: "blob" });
      if (content.size < 500) {
        throw new Error("Generated ZIP is empty. Please try again.");
      }
      saveAs(content, `Student_Reports_Bulk_${new Date().toISOString().split('T')[0]}.zip`);
      if (onShowAction) onShowAction("success", "All reports downloaded successfully!");
    } catch (err) {
      console.error("Error generating ZIP:", err);
      if (onShowAction) onShowAction("error", err.message || "Failed to generate ZIP file.");
    } finally {
      setIsGeneratingReports(false);
      setStudentToRender(null);
      setGenerationProgress(0);
    }
  };

  const sidebarLinks = ["Student Registry", "Staff Profiles", "Assignments", "Portal Access", "Faculty", "Notifications", "User Issues", "Leave Management", "Global Settings"];
  const navPages = ["Overview", "Announcements", "Schedule"];

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
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)}></div>}
      <aside className={`admin-sidebar ${!menuOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {(() => {
            const adminName = portalAccess?.full_name || user?.user_metadata?.full_name || "";
            const adminProfile = (adminData.teacherProfiles || []).find(t => normalizeText(t.full_name) === normalizeText(adminName));
            const photo = adminProfile?.photo_url || portalAccess?.photo_url || user?.user_metadata?.avatar_url || "/logo.png";

            return (
              <SidebarHeader
                photoUrl={photo}
                name={portalAccess?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Admin"}
                arabicName={portalAccess?.arabic_name || user?.user_metadata?.arabic_name}
                tag="Management Portal"
              />
            );
          })()}
          <button className="sidebar-close-btn" onClick={() => setMenuOpen(false)}><X size={20} /></button>


        </div>
        <nav className="sidebar-nav">
          <p className="sidebar-category">Main Dashboard</p>
          {navPages.map(page => {
            const Icon = NAV_ICONS[page] || Layers3;
            return (
              <button key={page} className={`sidebar-link ${activePage === page ? 'active' : ''}`} onClick={() => { setActivePage(page); setMenuOpen(false); }}>
                <Icon size={18} /> {page}
              </button>
            )
          })}

          <p className="sidebar-category management-cat">Management</p>
          {sidebarLinks.map(page => {
            const Icon = NAV_ICONS[page] || Users;
            return (
              <button key={page} className={`sidebar-link ${activePage === page ? 'active' : ''}`} onClick={() => { setActivePage(page); setMenuOpen(false); }}>
                <Icon size={18} /> {page === "Notifications" ? "Send Push Alert" : page}
              </button>
            )
          })}

          <div className="sidebar-system-status">
            <p className="sidebar-category">System Status</p>
            <div className="status-item">
              <Users size={14} /> Students: {students.length}
            </div>
            <div className="status-item">
              <ShieldCheck size={14} /> Portal Users: {portalAccessList.length}
            </div>
            <button className="refresh-mini-btn" onClick={() => loadPortalData(portalRole, user)}>
              <RotateCw size={14} /> Refresh Data
            </button>
          </div>

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
          <div className="admin-header-left">
            <button className="topbar-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <h2 className="page-title">{activePage}</h2>
          </div>
        </header>

        <section className="admin-content-pad">
          {activePage === "Overview" && (
             <QuickSearch 
               pages={[
                 { label: "Main Overview", value: "Overview" },
                 { label: "Student Registry", value: "Student Registry" },
                 { label: "Staff Profiles", value: "Staff Profiles" },
                 { label: "Student Assignments", value: "Assignments" },
                 { label: "Portal Access", value: "Portal Access" },
                 { label: "Faculty Attendance", value: "Faculty" },
                 { label: "Notifications Hub", value: "Notifications" },
                 { label: "Announcements", value: "Announcements" },
                 { label: "Master Schedule", value: "Schedule" },
                 { label: "Support Tickets", value: "User Issues" }
               ]} 
               onSelect={setActivePage} 
             />
          )}
          {actionMessage && (
            <div className={`status-banner ${actionMessage.type}`}>{actionMessage.text}</div>
          )}

          {activePage === "Student Registry" && (
            <div className="admin-section fade-in">
              <div className="section-header">
                <h2 className="premium-title">Student Registry</h2>
                <p className="subtitle">Add and manage students in the system</p>
              </div>

              <div className="assignment-form-complex card-appear">
                <form className="stack-form" onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const full_name = formData.get("full_name");

                  if (!full_name) return;

                  const itsVal = formData.get("its");
                  const numericIts = itsVal && !isNaN(itsVal) ? Number(itsVal) : itsVal;

                  const { data, error } = await supabase.from("child_profiles").insert([{
                    full_name,
                    arabic_name: formData.get("arabic_name"),
                    parent_email: formData.get("parent_email"),
                    juz: formData.get("juz"),
                    surat: formData.get("surat"),
                    photo_url: formData.get("photo_url"),
                    group_name: formData.get("group_name"),
                    its: numericIts,
                    is_active: true
                  }]).select().single();

                  if (error) {
                    alert("Error adding student: " + error.message);
                  } else {
                    alert("Student added successfully!");
                    e.target.reset();
                    // Better than reload: refresh the data in memory
                    loadPortalData(portalRole, user);
                  }
                }}>
                  <div className="form-row">
                    <label>
                      <span>Full Name (English)</span>
                      <input name="full_name" type="text" placeholder="Enter name..." required className="premium-input" />
                    </label>
                    <label>
                      <span>Arabic Name (اسم الطالب)</span>
                      <input name="arabic_name" type="text" placeholder="Arabic Name" className="premium-input arabic-kanz" style={{ fontSize: '1.2rem' }} />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      <span>Parent Auth Email</span>
                      <input name="parent_email" type="email" placeholder="parent@example.com" className="premium-input" />
                    </label>
                    <label>
                      <span>Photo URL</span>
                      <input name="photo_url" type="text" placeholder="https://..." className="premium-input" />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      <span>Juz</span>
                      <input name="juz" type="text" placeholder="e.g. 30" className="premium-input" />
                    </label>
                    <label>
                      <span>Surat / Ayat</span>
                      <input name="surat" type="text" placeholder="e.g. Al-Naba" className="premium-input" />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      <span>ITS Number</span>
                      <input name="its" type="text" placeholder="ITS" className="premium-input" />
                    </label>
                    <label>
                      <span>Group / Class</span>
                      <input name="group_name" type="text" placeholder="e.g. Group A" className="premium-input" />
                    </label>
                  </div>
                  <button type="submit" className="action-button">Add Student to Database</button>
                </form>
              </div>

              <div className="assigned-list card-appear" style={{ marginTop: '30px' }}>
                <h3 className="premium-subtitle">Current Students ({students.length})</h3>
                <div className="assigned-grid">
                  {students.map(s => (
                    <div key={s.student_id} className="assigned-child-card">
                      <div className="child-info-header">
                        <StudentAvatar student={s} size="small" />
                        <div>
                          <h4>{s.name}</h4>
                          <p>{s.groupName || 'No Group'}</p>
                        </div>
                      </div>
                      <button
                        className="btn-text-only red"
                        onClick={() => onDeleteRecord("child_profiles", "student_id")(s.student_id)}
                        style={{ marginTop: '10px' }}
                      >
                        Remove Student
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activePage === "Overview" && (
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
          )}

          {activePage === "Overview" ? (
            <div className="overview-container fade-in">
              <div className="overview-selection-header card-appear">
                <div className="selection-box">
                  <div className="selection-label">
                    <Users size={22} className="gold-icon" />
                    <span>Quick Student Access</span>
                  </div>
                  <div className="selection-dropdown-row">
                    <div className="custom-dropdown-wrapper">
                      <label htmlFor="student-dropdown">Choose Student (Grouped by Muhaffiz)</label>
                      <select
                        id="student-dropdown"
                        className="premium-select"
                        value={selectedStudentId || ""}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                      >
                        <option value="">-- Select Student --</option>
                        {teacherSummaries.map(teacher => (
                          <optgroup label={`Muhaffiz: ${teacher.teacherName}`} key={teacher.teacherName}>
                            {students
                              .filter(s => (s.teacherName || "Unassigned teacher") === teacher.teacherName)
                              .map(s => (
                                <option key={s.student_id} value={s.student_id}>{s.name}</option>
                              ))
                            }
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <button 
                      className="assign-report-btn" 
                      onClick={handleDownloadAllReports}
                      disabled={isGeneratingReports}
                      style={{ gap: '10px' }}
                    >
                      {isGeneratingReports ? (
                        <Loader2 size={18} className="spin" />
                      ) : (
                        <FileArchive size={18} />
                      )}
                      {isGeneratingReports ? `Generating (${generationProgress}/${students.length})...` : "Download Reports"}
                    </button>
                  </div>
                </div>
              </div>

              {selectedStudent ? (
                <div className="report-vessel card-appear">
                  <div className="vessel-connection">
                    <div className="connection-line"></div>
                    <div className="connection-dot"></div>
                  </div>
                  <div className="report-card-inner">
                    <div className="student-profile-hero">
                      <StudentAvatar student={selectedStudent} />
                      <div>
                        <h3>{selectedStudent.name}</h3>
                        <p>{selectedStudent.groupName} · {selectedStudent.teacherName}</p>
                        <div className="pill-row">
                          <span className="mini-pill">ITS: {selectedStudent.its || "N-A"}</span>
                          <span className="mini-pill">Juz: {selectedStudent.hifz?.juz || "N-A"}</span>
                          <span className="mini-pill">Surah: {selectedStudent.hifz?.surat || "Pending"}</span>
                          {selectedStudent.arabic_name && (
                            <span className="mini-pill arabic-kanz" style={{ fontSize: '1rem', color: 'var(--primary-gold)' }}>{fixArabicScript(selectedStudent.arabic_name)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <TahfeezReportCard
                      student={selectedStudent}
                      weeklyResult={selectedStudent.latestResult}
                      settings={Array.isArray(reportSettings) ? reportSettings[0] : reportSettings}
                    />
                  </div>
                </div>
              ) : (
                <div className="empty-overview card-appear">
                  <div className="vessel-connection">
                    <div className="connection-line"></div>
                  </div>
                  <BookOpen size={64} className="empty-icon" />
                  <h3>No Student Selected</h3>
                  <p>Please select a student from the dropdown above to view their detailed performance report.</p>
                </div>
              )}
            </div>
          ) : null}

          {activePage === "Notifications" ? (
            <div className="management-grid two-columns">
              <section className="form-card card-appear">
                <div className="card-headline headline-with-action">
                  <div className="headline-left">
                    <Send size={18} />
                    <h3>System Notifications</h3>
                  </div>
                  <div className="headline-right">
                    <button 
                      type="button"
                      className="btn-text-only" 
                      style={{ color: 'var(--primary-gold)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={async () => {
                        const result = await fcmService.initialize("admin");
                        if (result) alert("Notifications active for this device!");
                        else alert("Failed to activate. Check browser permissions.");
                      }}
                    >
                      <Bell size={14} /> Enable Device Alerts
                    </button>
                  </div>
                </div>
                <form className="stack-form" onSubmit={onSendCustomNotification}>
                  <div className="form-grid">
                    <label>
                      <span>Target Audience</span>
                      <select
                        name="target_audience"
                        value={adminForms.customNotification.target_audience}
                        onChange={onAdminFormChange("customNotification")}
                        className="premium-select"
                      >
                        <option value="all">Broadcast to Everyone</option>
                        <option value="parents">Parents Portal Only</option>
                        <option value="teacher">Teachers Portal Only</option>
                        <option value="user">Direct to Specific Email</option>
                      </select>
                    </label>
                    {adminForms.customNotification.target_audience === "user" && (
                      <label>
                        <span>Recipient Email</span>
                        <input
                          type="email"
                          name="target_uuid"
                          value={adminForms.customNotification.target_uuid || ""}
                          onChange={onAdminFormChange("customNotification")}
                          placeholder="user@example.com"
                          required
                        />
                      </label>
                    )}
                  </div>
                  <label>
                    <span>Alert Title</span>
                    <input
                      type="text"
                      name="title"
                      value={adminForms.customNotification.title}
                      onChange={onAdminFormChange("customNotification")}
                      placeholder="e.g. Urgent Update"
                      required
                    />
                  </label>
                  <label>
                    <span>Message Content</span>
                    <textarea
                      name="body"
                      value={adminForms.customNotification.body}
                      onChange={onAdminFormChange("customNotification")}
                      placeholder="Write your message here..."
                      required
                      rows={4}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      <span>Destination Page</span>
                      <select
                        name="redirect_page"
                        value={adminForms.customNotification.redirect_page}
                        onChange={onAdminFormChange("customNotification")}
                        className="premium-select"
                      >
                        <option value="Home">Home Screen</option>
                        <option value="Announcements">Announcements</option>
                        <option value="Attendance">Attendance Page</option>
                        <option value="Progress">Progress Reports</option>
                      </select>
                    </label>
                  </div>
                  <button type="submit" className="action-button">
                    <Send size={18} /> Dispatch Notification
                  </button>
                </form>

              </section>
              <section className="data-card">
                <div className="card-headline headline-with-action">
                  <div className="headline-left">
                    <Clock size={18} />
                    <h3>Sent Alert History</h3>
                  </div>
                  <button
                    className="clear-history-btn"
                    onClick={() => onClearHistory("system_notifications")()}
                  >
                    Clear History
                  </button>
                </div>
                <div className="record-stack">
                  {notifications.map((item, index) => (
                    <article key={item.id || index} className="record-card flex-row-card">
                      <div className="card-primary-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`mini-pill ${item.target_role === 'all' ? 'gold' : 'brown'}`} style={{ fontSize: '10px' }}>
                            {item.target_role.toUpperCase()}
                          </span>
                          <strong>{item.title}</strong>
                        </div>
                        <span>{item.body.substring(0, 60)}{item.body.length > 60 ? '...' : ''}</span>
                        <span className="record-date">{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                      <button
                        className="delete-icon-btn"
                        onClick={() => onDeleteRecord("system_notifications", "id")(item.id)}
                        aria-label="Delete notification"
                      >
                        <Trash size={16} />
                      </button>
                    </article>
                  ))}
                  {notifications.length === 0 && (
                    <div className="empty-state">No notification history found.</div>
                  )}
                </div>
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

                    <label>
                      <span>Target Portal</span>
                      <select
                        name="target_role"
                        value={adminForms.announcement.target_role || "all"}
                        onChange={onAdminFormChange("announcement")}
                      >
                        <option value="all">Everyone</option>
                        <option value="parents">Parents Only</option>
                        <option value="teacher">Teachers Only</option>
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
                <div className="card-headline headline-with-action">
                  <div className="headline-left">
                    <BookOpen size={18} />
                    <h3>Latest Announcements</h3>
                  </div>
                  <button
                    className="clear-history-btn"
                    onClick={() => onClearHistory("events")()}
                  >
                    Clear All
                  </button>
                </div>
                <div className="record-stack">
                  {announcements.map((item) => (
                    <article key={item.id || `${item.title}-${item.event_date}`} className="record-card flex-row-card">
                      <div className="card-primary-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`mini-pill ${item.target_role === 'all' ? 'gold' : 'brown'}`} style={{ fontSize: '10px' }}>
                            {(item.target_role || 'ALL').toUpperCase()}
                          </span>
                          <strong>{item.title}</strong>
                        </div>
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

          {activePage === "Announcements" ? (
            <AnnouncementsPage
              notifications={announcements}
              setActivePage={setActivePage}
              setSelectedAnnouncement={setSelectedAnnouncement}
            />
          ) : null}

          {activePage === "User Issues" ? (
            <SupportTicketsAdmin 
              tickets={supportTickets} 
              onRefresh={() => loadPortalData(portalRole, user)} 
            />
          ) : null}




          {activePage === "Assignments" ? (
            <div className="management-grid">
              <section className="data-card card-appear">
                <div className="card-headline">
                  <Users size={18} />
                  <h3>Student Assignment Hub</h3>
                </div>

                <div className="assignment-form-complex">
                  <form className="stack-form" onSubmit={(e) => {
                    e.preventDefault();
                    const data = {
                      student_id: e.target.student_id.value,
                      teacher_id: e.target.teacher_id.value,
                      parent_id: e.target.parent_id.value,
                      full_name: e.target.full_name?.value,
                      arabic_name: e.target.arabic_name?.value,
                      juz: e.target.juz?.value,
                      surat: e.target.surat?.value,
                      photo_url: e.target.photo_url?.value,
                      group_name: e.target.group_name?.value,
                      its: e.target.its?.value,
                    };
                    if (data.student_id) onAssignChild(data);
                  }}>
                    <div className="form-grid">
                      <label>
                        <span>Select Student</span>
                        <select
                          name="student_id"
                          className="premium-select"
                          required
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const s = students.find(x => String(x.student_id) === String(val));
                            if (s) {
                              const form = e.target.form;
                              if (form.full_name) form.full_name.value = s.name || '';
                              if (form.arabic_name) form.arabic_name.value = s.arabic_name || '';
                              if (form.group_name) form.group_name.value = s.groupName === 'Ungrouped' ? '' : (s.groupName || '');
                              if (form.juz) form.juz.value = s.juz || '';
                              if (form.surat) form.surat.value = s.surat || '';
                              if (form.photo_url) form.photo_url.value = s.photoUrl || '';
                              if (form.its) form.its.value = s.its === '...' ? '' : (s.its || '');
                              if (form.teacher_id) form.teacher_id.value = s.muhaffiz_id || '';
                              if (form.parent_id) form.parent_id.value = s.user_id || '';
                            }
                          }}
                        >
                          <option value="">-- Choose Student --</option>
                          {students && students.length > 0 ? (
                            students.map(s => (
                              <option key={s.student_id} value={s.student_id}>
                                {s.name || 'Unnamed Student'} {s.arabic_name ? `(${s.arabic_name})` : ''}
                              </option>
                            ))
                          ) : (
                            <option value="" disabled>No students found in Registry</option>
                          )}
                        </select>
                      </label>

                      <label>
                        <span>Full Name (English)</span>
                        <input name="full_name" type="text" placeholder="Update name..." className="premium-input" />
                      </label>

                      <label>
                        <span>Arabic Name (اسم الطالب)</span>
                        <input name="arabic_name" type="text" placeholder="Arabic Name" className="premium-input arabic-kanz" style={{ fontSize: '1.2rem' }} />
                      </label>

                      <label>
                        <span>Group / Class</span>
                        <input name="group_name" type="text" placeholder="e.g. Group A" className="premium-input" />
                      </label>

                      <label>
                        <span>Juz</span>
                        <input name="juz" type="text" placeholder="e.g. 30" className="premium-input" />
                      </label>

                      <label>
                        <span>Surat / Ayat</span>
                        <input name="surat" type="text" placeholder="e.g. Al-Naba" className="premium-input" />
                      </label>

                      <label>
                        <span>Photo URL</span>
                        <input name="photo_url" type="text" placeholder="https://..." className="premium-input" />
                      </label>

                      <label>
                        <span>ITS Number</span>
                        <input name="its" type="text" placeholder="ITS" className="premium-input" />
                      </label>

                      <label>
                        <span>Muhaffiz (Teacher)</span>
                        <select name="teacher_id" className="premium-select">
                          <option value="">-- No Teacher (Unlinked) --</option>
                          {portalAccessList.length > 0 || teacherProfiles.length > 0 ? (
                            <React.Fragment>
                              {/* Show users from portal access who are teachers/muhaffiz */}
                              {portalAccessList
                                .filter(a =>
                                  normalizeText(a.portal_role).includes('teacher') ||
                                  normalizeText(a.portal_role).includes('muhaffiz')
                                )
                                .map(p => (
                                  <option key={`portal-${p.id}`} value={p.user_id || p.email}>
                                    {p.full_name || p.email}
                                  </option>
                                ))
                              }
                              {/* Also show from teacher_profiles table if not in portalAccessList */}
                              {teacherProfiles
                                .filter(tp => !portalAccessList.some(pa => pa.user_id === tp.user_id || normalizeText(pa.full_name) === normalizeText(tp.full_name)))
                                .map(tp => (
                                  <option key={`profile-${tp.id}`} value={tp.user_id}>
                                    {tp.full_name} (Profile)
                                  </option>
                                ))
                              }
                            </React.Fragment>
                          ) : (
                            <option value="" disabled>No staff found</option>
                          )}
                        </select>
                      </label>

                      <label>
                        <span>Parent / Guardian</span>
                        <select name="parent_id" className="premium-select">
                          <option value="">-- No Parent (Unlinked) --</option>
                          {portalAccessList && portalAccessList.length > 0 ? (
                            portalAccessList
                              .filter(p => {
                                const r = (p.portal_role || "").toLowerCase();
                                return r.includes("parent") || r === "" || r === "parents";
                              })
                              .map(p => (
                                <option key={`parent-${p.id}`} value={p.user_id || p.email}>
                                  {p.full_name || p.email} ({p.portal_role || 'No Role'})
                                </option>
                              ))
                          ) : (
                            <option value="" disabled>No portal users found</option>
                          )}
                        </select>
                      </label>
                    </div>
                    <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--brown-dark)', opacity: 0.6 }}>
                      Total portal users in system: {portalAccessList?.length || 0}
                    </div>

                    <div className="form-actions-row" style={{ gridColumn: '1 / -1' }}>
                      <button type="submit" className="action-button">Save Assignments & Updates</button>
                      <button
                        type="button"
                        className="action-button secondary"
                        onClick={() => {
                          const student_id = document.querySelector('select[name="student_id"]').value;
                          if (student_id) onUnassignChild(student_id);
                          else alert("Please select a student first.");
                        }}
                      >
                        Clear All Links
                      </button>
                    </div>
                    <p className="hint-text" style={{ marginTop: '12px', fontSize: '0.8rem', opacity: 0.7 }}>
                      Tip: If names are missing, make sure you have granted them <strong>Portal Access</strong> first.
                    </p>
                  </form>
                </div>
              </section>

              <section className="data-card card-appear" style={{ marginTop: '20px' }}>
                <div className="card-headline">
                  <Layers3 size={18} />
                  <h3>Assigned Student List</h3>
                </div>

                <div className="assigned-children-grid">
                  {students
                    .filter(s => s.muhaffiz_id || s.user_id)
                    .map(student => {
                      const parent = portalAccessList.find(a => a.user_id === student.user_id);
                      return (
                        <article key={student.student_id} className="assigned-child-card card-appear">
                          <div className="child-card-main">
                            <StudentAvatar student={student} size="small" />
                            <div className="child-card-info">
                              <strong>{student.name}</strong>

                              <div className="assignment-details">
                                <div className="detail-item">
                                  <span className="detail-label">Teacher:</span>
                                  <span className="detail-value">{student.teacherName || "None"}</span>
                                </div>
                                <div className="detail-item">
                                  <span className="detail-label">Parent:</span>
                                  <span className="detail-value">{parent?.full_name || "Unlinked"}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="child-card-actions">
                            <button
                              className="unassign-btn"
                              onClick={() => onUnassignChild(student.student_id)}
                              title="Unlink student"
                            >
                              <UserX size={16} /> Unlink
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  {students.filter(s => s.muhaffiz_id || s.user_id).length === 0 && (
                    <div className="empty-state">No linked students found.</div>
                  )}
                </div>
              </section>

              <section className="data-card card-appear" style={{ marginTop: '20px', opacity: 0.8 }}>
                <div className="card-headline">
                  <UserX size={18} />
                  <h3>Unassigned Students</h3>
                </div>
                <div className="assigned-children-grid">
                  {students
                    .filter(s => !s.muhaffiz_id && !s.user_id)
                    .map(student => (
                      <article key={student.student_id} className="assigned-child-card unassigned-card">
                        <div className="child-card-main">
                          <StudentAvatar student={student} size="small" />
                          <div className="child-card-info">
                            <strong>{student.name}</strong>
                            <p>Ready for assignment</p>
                          </div>
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
                    <select
                      name="full_name"
                      value={adminForms.teacherProfile.full_name}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        const existingProfile = teacherProfiles.find(p => normalizeText(p.full_name) === normalizeText(selectedName));

                        setAdminForms(curr => ({
                          ...curr,
                          teacherProfile: {
                            ...curr.teacherProfile,
                            full_name: selectedName,
                            phone_number: existingProfile?.phone_number || "",
                            whatsapp_number: existingProfile?.whatsapp_number || "",
                            photo_url: existingProfile?.photo_url || "",
                            salary_per_minute: existingProfile?.salary_per_minute || "2.3",
                            show_salary_card: existingProfile?.show_salary_card ?? true
                          }
                        }));
                      }}
                      required
                      className="premium-select"
                    >
                      <option value="">-- Select Teacher --</option>
                      {portalAccessList
                        .filter(a =>
                          normalizeText(a.portal_role).includes("teacher") ||
                          normalizeText(a.portal_role).includes("muhaffiz")
                        )
                        .map(a => (
                          <option key={a.id} value={a.full_name}>{a.full_name}</option>
                        ))
                      }
                    </select>
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

          {activePage === "Faculty" ? (
            <div className="management-grid">
              <section className="data-card card-appear">
                <div className="card-headline headline-with-action">
                  <div className="headline-left">
                    <Users size={18} />
                    <h3>Faculty Attendance Management</h3>
                  </div>
                </div>

                <div className="record-stack">
                  {teacherProfiles
                    .filter(profile => profile.show_salary_card === true)
                    .map(profile => {
                      const today = new Date().toISOString().split('T')[0];
                      const latestAttendance = teacherAttendance.find(a =>
                        normalizeText(a.teacher_name) === normalizeText(profile.full_name) &&
                        a.attendance_date === today
                      );

                      return (
                        <div key={profile.id} className="faculty-vessel card-appear">
                          <div className="vessel-connection">
                            <div className="connection-line"></div>
                            <div className="connection-dot"></div>
                          </div>
                          <article className="premium-faculty-card card-appear">
                            <div className="p-faculty-header">
                              <div className="p-faculty-profile">
                                <div className="p-faculty-avatar-container">
                                  {profile.photo_url ? (
                                    <img src={profile.photo_url} alt={profile.full_name} className="p-faculty-img" />
                                  ) : (
                                    <div className="p-faculty-avatar-fallback">
                                      {profile.full_name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div className="p-faculty-meta">
                                  <div className="name-row">
                                    <h3 className="p-faculty-name">{profile.full_name}</h3>
                                    <CheckCircle size={18} className="verified-badge" />
                                  </div>
                                  <span className="p-faculty-email">{profile.email || "No Email linked"}</span>
                                </div>
                              </div>
                              <div className={`p-status-badge ${latestAttendance?.status === 'Present' ? 'present' : latestAttendance?.status === 'Absent' ? 'absent' : 'pending'}`}>
                                {latestAttendance?.status || "Not Marked"}
                              </div>
                            </div>

                            <div className="p-faculty-body">
                              <div className="p-attendance-controls">
                                <div className="p-minutes-manual card-appear">
                                  <div className="vessel-label">Daily Minutes</div>
                                  <input
                                    type="number"
                                    id={`mins-${profile.id}`}
                                    defaultValue="90"
                                    className="p-minutes-input"
                                    placeholder="Mins"
                                  />
                                </div>

                                <div className="p-action-row">
                                  <button className={`p-mark-btn p-present ${latestAttendance?.status === 'Present' ? 'active' : ''}`} onClick={() => {
                                    const mins = document.getElementById(`mins-${profile.id}`).value || 90;
                                    onRecordTeacherAttendance(null, {
                                      teacher_name: profile.full_name,
                                      attendance_date: today,
                                      minutes_present: Number(mins),
                                      status: 'Present',
                                      note: 'Daily Attendance'
                                    });
                                  }}>
                                    <div className="btn-icon-vessel"><UserCheck size={22} /></div>
                                    <div className="btn-text-vessel">
                                      <strong>Present</strong>
                                      <span>Mark with Custom Mins</span>
                                    </div>
                                  </button>

                                  <button className={`p-mark-btn p-absent ${latestAttendance?.status === 'Absent' ? 'active' : ''}`} onClick={() => onRecordTeacherAttendance(null, {
                                    teacher_name: profile.full_name,
                                    attendance_date: today,
                                    minutes_present: 0,
                                    status: 'Absent',
                                    note: 'Daily Attendance'
                                  })}>
                                    <div className="btn-icon-vessel"><UserX size={22} /></div>
                                    <div className="btn-text-vessel">
                                      <strong>Absent</strong>
                                      <span>Mark for Today</span>
                                    </div>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {latestAttendance && (
                              <div className="p-attendance-footer">
                                <Clock size={14} />
                                <span>Last updated today at {new Date(latestAttendance.created_at).toLocaleTimeString()}</span>
                              </div>
                            )}
                          </article>
                        </div>
                      );
                    })}

                  {teacherProfiles.filter(profile => profile.show_salary_card === true).length === 0 && (
                    <div className="empty-state">
                      <Users size={48} opacity={0.2} />
                      <p>No teachers found with 'Show Salary Card' enabled.</p>
                    </div>
                  )}
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
                      <span>Account Password</span>
                      <input
                        type="password"
                        name="password"
                        value={adminForms.portalAccess.password || ""}
                        onChange={onAdminFormChange("portalAccess")}
                        placeholder="Min 6 characters"
                        required
                      />
                    </label>
                  </div>
                  <div className="form-grid">
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

              <section className="data-card card-appear" style={{ gridColumn: '1 / -1', marginTop: '30px' }}>
                <div className="card-headline">
                  <ShieldCheck size={18} />
                  <h3>System Portal Audit ({portalAccessList?.length || 0})</h3>
                </div>
                <div className="portal-access-responsive-container">
                  <div className="portal-audit-grid header-row hide-mobile">
                    <div className="audit-col">Name</div>
                    <div className="audit-col">Email</div>
                    <div className="audit-col">Role</div>
                    <div className="audit-col">UUID (user_id)</div>
                    <div className="audit-col">Action</div>
                  </div>
                  <div className="portal-audit-list">
                    {portalAccessList && portalAccessList.map((access) => (
                      <div key={access.id} className="portal-audit-item card-appear">
                        <div className="audit-col name-col">
                          <span className="mobile-label">Name:</span>
                          <strong>{access.full_name}</strong>
                        </div>
                        <div className="audit-col">
                          <span className="mobile-label">Email:</span>
                          {access.email}
                        </div>
                        <div className="audit-col">
                          <span className="mobile-label">Role:</span>
                          <span className={`badge ${access.portal_role}`}>{access.portal_role}</span>
                        </div>
                        <div className="audit-col uuid-col">
                          <span className="mobile-label">UUID:</span>
                          <code>{access.user_id || 'NOT LINKED'}</code>
                        </div>
                        <div className="audit-col action-col">
                          <button className="btn-text-only red" onClick={() => onDeleteRecord("user_portal_access", "id")(access.id)}>Remove Access</button>
                        </div>
                      </div>
                    ))}
                    {(!portalAccessList || portalAccessList.length === 0) && (
                      <div className="empty-state">
                        No access records found in the database. Try "Grant Access" above.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {/* Rendering zone for report generation - kept off-screen but 'visible' for capture */}
          <div 
            id="bulk-capture-hidden-zone"
            style={{ 
              position: 'fixed', 
              left: '-10000px', 
              top: '0', 
              width: '850px', 
              zIndex: -1000, 
              background: 'white',
              overflow: 'hidden',
              height: isGeneratingReports ? 'auto' : '1px',
              visibility: isGeneratingReports ? 'visible' : 'hidden'
            }}
          >
            {isGeneratingReports && studentToRender && (
              <div id="actual-report-content" style={{ padding: '40px', background: 'white' }}>
                <TahfeezReportCard
                  student={studentToRender}
                  weeklyResult={studentToRender.latestResult}
                  settings={Array.isArray(reportSettings) ? reportSettings[0] : reportSettings}
                />
              </div>
            )}
          </div>

          {activePage === "Leave Management" && (
            <AdminLeaveManagement students={students} onShowAction={onShowAction} />
          )}
          {activePage === "Global Settings" ? (
            <div className="management-grid two-columns">
              <section className="form-card card-appear">
                <div className="card-headline">
                  <Settings size={18} />
                  <h3>Report Card Visibility</h3>
                </div>
                <form className="stack-form" onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const updates = {
                    reports_live: formData.get("reports_live") === "true",
                    live_at: formData.get("live_at") ? new Date(formData.get("live_at")).toISOString() : null,
                    main_heading: formData.get("main_heading"),
                    sub_heading: formData.get("sub_heading"),
                  };
                  
                  const settingsId = reportSettings[0]?.id || 1;
                  supabase.from("report_settings")
                    .upsert({ id: settingsId, ...updates })
                    .then(({ error }) => {
                      if (error) onShowAction("error", "Failed to update settings: " + error.message);
                      else {
                        onShowAction("success", "System settings updated successfully!");
                        
                        // Notify all parents if results made live
                        if (updates.reports_live) {
                          supabase.functions.invoke('fcm-notification', {
                            body: {
                              title: "Results are LIVE!",
                              body: "The latest Tahfeez progress reports are now visible in your portal.",
                              targetRole: 'parents'
                            }
                          });
                        }
                        
                        loadPortalData(portalRole, user);
                      }
                    });
                }}>
                  <div className="form-grid">
                    <label>
                      <span>Parent Access Mode</span>
                      <select name="reports_live" defaultValue={String(reportSettings[0]?.reports_live ?? true)} className="premium-select">
                        <option value="true">Live (Visible to Parents)</option>
                        <option value="false">Hidden (Maintenance Mode)</option>
                      </select>
                    </label>
                    <label>
                      <span>Schedule Live Time</span>
                      <input 
                        type="datetime-local" 
                        name="live_at" 
                        defaultValue={reportSettings[0]?.live_at ? new Date(new Date(reportSettings[0].live_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                        className="premium-input"
                      />
                    </label>
                  </div>
                  <p className="hint-text" style={{ marginBottom: '20px' }}>
                    If hidden or scheduled in the future, parents will see a "Coming Soon" message instead of the report.
                  </p>
                  
                  <div className="card-headline" style={{ marginTop: '20px', padding: '0', border: 'none' }}>
                    <Palette size={16} />
                    <h4 style={{ margin: 0, fontSize: '1rem' }}>Report Branding</h4>
                  </div>
                  <label>
                    <span>Main Heading</span>
                    <input name="main_heading" type="text" defaultValue={reportSettings[0]?.main_heading || "Rawdat Tahfeez al Atfal"} className="premium-input" />
                  </label>
                  <label>
                    <span>Sub Heading</span>
                    <input name="sub_heading" type="text" defaultValue={reportSettings[0]?.sub_heading || "TAHFEEZ REPORT 1447H"} className="premium-input" />
                  </label>

                  <button type="submit" className="action-button premium" style={{ marginTop: '20px' }}>
                    Save Global Settings
                  </button>
                </form>
              </section>

              <section className="data-card card-appear">
                <div className="card-headline">
                  <Info size={18} />
                  <h3>Current Status</h3>
                </div>
                <div className="status-indicator-box" style={{ padding: '20px', textAlign: 'center', background: 'var(--brown-light)', borderRadius: '16px' }}>
                   <div className={`status-dot-large ${reportSettings[0]?.reports_live !== false ? 'online' : 'offline'}`} />
                   <h4 style={{ margin: '15px 0 5px' }}>Reports are currently {reportSettings[0]?.reports_live !== false ? 'LIVE' : 'HIDDEN'}</h4>
                   {reportSettings[0]?.live_at && (
                     <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                       Scheduled for: {new Date(reportSettings[0].live_at).toLocaleString()}
                     </p>
                   )}
                </div>
                <div style={{ marginTop: '20px' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    Control exactly when parents can see the weekly progress cards. You can fill results throughout the week and only set them to "Live" once all markings are complete.
                  </p>
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
  notifications,
  loadPortalData,
  portalRole,
  setSelectedAnnouncement,
  reportSettings = [],
  schoolData,
  teacherProfiles = [],
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
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)}></div>}
      <aside className={`admin-sidebar ${!menuOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <SidebarHeader
            photoUrl={teacherProfiles.find(p => normalizeText(p.full_name) === normalizeText(teacherIdentity))?.photo_url || portalAccess?.photo_url || user?.user_metadata?.avatar_url || user?.user_metadata?.photo_url}
            name={portalAccess?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Teacher"}
            arabicName={portalAccess?.arabic_name}
            tag="Teacher Portal"
          />
          <button className="sidebar-close-btn" onClick={() => setMenuOpen(false)}><X size={20} /></button>


        </div>
        <nav className="sidebar-nav">
          <p className="sidebar-category management-cat">Workplace</p>
          {[
            { id: "Announcements", label: "Announcements", icon: Bell },
            { id: "My Group", label: "Students", icon: Users },
            { id: "Fill Result", label: "Mark Progress", icon: Sparkles },
            { id: "Overview", label: "Performance", icon: Layers3 },
          ].map(page => (
            <button key={page.id} className={`sidebar-link ${activePage === page.id ? 'active' : ''}`} onClick={() => { setActivePage(page.id); setMenuOpen(false); }}>
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
        <header className="topbar admin-topbar-dynamic">
          <div className="admin-header-left">
            <button className="topbar-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <h2 className="page-title">{activePage}</h2>
          </div>
          {portalAccess.show_salary_card && monthlySalary && (
            <div className="salary-pill">
              Estimated: <strong>{monthlySalary.amount?.toFixed(0) || "0"}rs</strong>
            </div>
          )}
        </header>

        <section className="admin-content-pad">
          {activePage === "My Group" && (
             <QuickSearch 
               pages={[
                 { label: "Student List", value: "My Group" },
                 { label: "Mark Progress (Result)", value: "Fill Result" },
                 { label: "Performance Overview", value: "Overview" },
                 { label: "Announcements", value: "Announcements" },
                 { label: "My Profile", value: "Profile" }
               ]} 
               onSelect={setActivePage} 
             />
          )}
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

              <PremiumHifzCard onOpenPortal={() => setIsELearningOpen(true)} />

              <div className="student-card-grid">
                {filteredStudents.map((student) => (
                  <article key={student.student_id} className="student-card">
                    <div className="student-card-head">
                      <StudentAvatar student={student} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: 0 }}>{student.name}</h3>
                        {student.arabic_name && (
                          <span className="arabic-kanz" style={{ fontSize: '1.1rem', color: 'var(--primary-gold)', marginTop: '2px' }}>{student.arabic_name}</span>
                        )}
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{student.groupName}</p>
                      </div>
                    </div>
                    <div className="pill-row">
                      <span className="mini-pill">Juz: {student.hifz?.juz || "N-A"}</span>
                      <span className="mini-pill">Surah: {student.hifz?.surat || "Pending"}</span>
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
                        disabled={!!teacherForms.result.id}
                        required
                      >
                        <option value="">Select child</option>
                        {filteredStudents.map((student) => {
                          const hasResultToday = (schoolData.weeklyResults || []).some(r => 
                            String(r.student_id) === String(student.student_id) && 
                            String(r.week_date) === String(teacherForms.result.week_date)
                          );
                          return (
                            <option key={student.student_id} value={student.student_id}>
                              {student.name} {hasResultToday ? "🔒 (Locked)" : ""} · {student.groupName}
                            </option>
                          );
                        })}
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

                  <button 
                    type="submit" 
                    className={`action-button ${teacherForms.result.id ? 'locked' : ''}`}
                    disabled={!!teacherForms.result.id}
                  >
                    {teacherForms.result.id ? 'Report Locked' : 'Save Result'}
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
                      settings={Array.isArray(reportSettings) ? reportSettings[0] : reportSettings}
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
                        Latest Result: {student.latestResult?.computedRank || "pending"}
                      </div>
                    </article>
                  ))}
                  {filteredStudents.length === 0 && (
                    <div className="empty-state">No students found in your group.</div>
                  )}
                </div>
              </div>

              {portalAccess?.show_salary_card && (
                <div className="data-card">
                  <div className="card-headline">
                    <Clock size={18} />
                    <h3>Your Attendance & Salary</h3>
                  </div>
                  <div className="record-stack">
                    {teacherData.attendances
                      .filter(attendance => normalizeText(attendance.teacher_name) === normalizeText(teacherIdentity))
                      .sort((a, b) => new Date(b.attendance_date) - new Date(a.attendance_date))
                      .slice(0, 10)
                      .map((attendance, index) => {
                        const teacherProfile = (teacherProfiles || []).find(p =>
                          normalizeText(p.full_name) === normalizeText(teacherIdentity)
                        );
                        const rate = toNumber(teacherProfile?.salary_per_minute || portalAccess.salary_per_minute || 2.3);
                        const dailySalary = toNumber(attendance.minutes_present) * rate;

                        return (
                          <article key={`${attendance.attendance_date}-${index}`} className="record-card">
                            <div className="card-primary-info">
                              <strong>{new Date(attendance.attendance_date).toLocaleDateString()}</strong>
                              <span className={`status-badge ${attendance.status?.toLowerCase()}`}>
                                {attendance.status || "Not Marked"}
                              </span>
                            </div>
                            <div className="attendance-details">
                              <div className="attendance-info">
                                <span>Minutes: {attendance.minutes_present}</span>
                                <span className="salary-amount">Rs. {dailySalary.toFixed(2)}</span>
                              </div>
                              {attendance.note && (
                                <span className="attendance-note">{attendance.note}</span>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    {teacherData.attendances.filter(a => normalizeText(a.teacher_name) === normalizeText(teacherIdentity)).length === 0 && (
                      <div className="empty-state">No attendance records found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {activePage === "Announcements" ? (
            <AnnouncementsPage
              notifications={notifications}
              setActivePage={setActivePage}
              setSelectedAnnouncement={setSelectedAnnouncement}
            />
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

    return "parents"; // Start with a safe default, will be overridden by auth
  });
  const [activePage, setActivePage] = useState(DEFAULT_PAGE_BY_ROLE.parents);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isELearningOpen, setIsELearningOpen] = useState(false);

  useEffect(() => {
    // Cleanup old service workers (like OneSignal) to prevent conflicts with FCM
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          if (!registration.active?.scriptURL.includes('firebase-messaging-sw.js')) {
            console.log('Unregistering old service worker:', registration.active?.scriptURL);
            registration.unregister();
          }
        }
      });
    }
  }, []);

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
  const [reportSettings, setReportSettings] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("mauze-dark-mode") === "true";
  });
  const [appTheme, setAppTheme] = useState(() => {
    return localStorage.getItem("mauze-app-theme") || "default";
  });

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDarkMode);
    localStorage.setItem("mauze-dark-mode", isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    document.body.setAttribute("data-theme", appTheme);
    localStorage.setItem("mauze-app-theme", appTheme);
  }, [appTheme]);

  const [supportTickets, setSupportTickets] = useState([]);
  const [adminForms, setAdminForms] = useState({
    announcement: {
      title: "",
      type: "Update",
      target_role: "all",
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
    assignments: [],
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
    // Handle credential storage from eLearning site
    const handleMessage = (event) => {
      if (event.origin === 'https://elearningquran.com' && event.data.type === 'STORE_CREDENTIALS') {
        const { email, password, rememberMe } = event.data.credentials;
        localStorage.setItem('elearning-email', email);
        localStorage.setItem('elearning-password', password);
        localStorage.setItem('elearning-remember-me', rememberMe.toString());
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

      // Prevent portal flicker by showing loading screen during role resolution
      setLoading(true);

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

            
            // Initialize FCM service
            try {
              await fcmService.initialize(access.role);
            } catch (error) {
              console.error('FCM initialization failed:', error);
            }
            
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

  useEffect(() => {
    if (user && portalRole === "parents" && selectedStudentId) {
      loadPortalData(portalRole, user);
    }
  }, [selectedStudentId]);

  async function loadPortalData(role, currentUser, parentProfileOverride = null) {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      if (role === "parents") {
        const rawProfiles = parentProfileOverride ? [parentProfileOverride] : (await findParentProfiles(currentUser.id, currentUser.email));

        let nextParentState = {
          studentProfile: null,
          allProfiles: [],
          hifzDetails: null,
          announcements: [],
          schedule: [],
          attendance: null,
          weeklyResult: null,
          teacherProfiles: [],
          reportSettings: null,
        };

        if (rawProfiles.length > 0) {
          // AUTO-LINK: If any profile only has email but no ID, link it now
          const profilesToLink = rawProfiles.filter(p => !p.parent_user_id && p.parent_email && normalizeText(p.parent_email) === normalizeText(currentUser.email));
          if (profilesToLink.length > 0) {
            console.log("Auto-linking parent user_id to student profiles:", profilesToLink.length);
            await Promise.all(profilesToLink.map(p =>
              supabase.from("child_profiles").update({ parent_user_id: currentUser.id }).eq("student_id", p.student_id)
            ));
            // Update local objects to reflect the link immediately
            profilesToLink.forEach(p => p.parent_user_id = currentUser.id);
          }

          // Fetch necessary data for all potential students
          const studentIds = rawProfiles.map(p => p.student_id);
          const studentQueryIds = rawProfiles.flatMap(p => [p.student_id, p.id].filter(Boolean));

          const [
            attendanceResponse,
            scheduleResponse,
            resultsResponse,
            announcementResponse,
            teacherProfilesResponse,
            reportSettingsResponse,
          ] = await Promise.all([
            supabase
              .from("attendance")
              .select("*")
              .in("student_id", studentIds)
              .order("attendance_date", { ascending: false }),
            supabase.from("schedule").select("*").in("student_id", studentIds),
            supabase
              .from("weekly_results")
              .select("*")
              .order("week_date", { ascending: false })
              .limit(5000),
            supabase.from("events").select("*").order("event_date", { ascending: false }),
            supabase.from("teacher_profiles").select("*").order("full_name", { ascending: true }),
            supabase.from("report_settings").select("*"),
          ]);

          // Handle potential missing tables (404) or other fetch errors gracefully
          if (attendanceResponse.error && attendanceResponse.error.code !== 'PGRST116' && attendanceResponse.error.status !== 404) {
            console.error("Attendance fetch error:", attendanceResponse.error);
          }
          if (reportSettingsResponse.data) setReportSettings(reportSettingsResponse.data);
          if (scheduleResponse.error) throw scheduleResponse.error;
          if (resultsResponse.error) throw resultsResponse.error;
          if (announcementResponse.error) throw announcementResponse.error;
          if (teacherProfilesResponse.error) throw teacherProfilesResponse.error;

          const attendanceData = attendanceResponse.data || [];

          const processedStudents = buildStudents(
            rawProfiles,
            resultsResponse.data || [],
            teacherProfilesResponse.data || []
          );

          // If multiple students, and none selected, use first
          const activeStudent = processedStudents.find(p => String(p.student_id) === String(selectedStudentId)) || processedStudents[0];
          
          // Bulletproof search for activeResult using the already matched latestResult from buildStudents
          const activeResult = activeStudent.latestResult;
          const activeAttendance = (attendanceResponse.data || []).find(a => String(a.student_id) === String(activeStudent.student_id));
          const activeSchedule = (scheduleResponse.data || []).filter(s => String(s.student_id) === String(activeStudent.student_id));

          nextParentState = {
            studentProfile: activeStudent,
            allProfiles: processedStudents,
            hifzDetails: {
              juz: activeStudent.juz || "--",
              surat: activeStudent.surat || "Pending",
              muhaffiz_name: activeStudent.teacherName || "Pending",
            },
            announcements: announcementResponse.data || [],
            schedule: activeSchedule,
            attendance: activeAttendance || null,
            weeklyResult: activeResult || null,
            teacherProfiles: teacherProfilesResponse.data || [],
            reportSettings: reportSettingsResponse.data || [],
          };

          if (!selectedStudentId) setSelectedStudentId(activeStudent.student_id);
        }

        setParentData(nextParentState);
        setTeacherProfiles(nextParentState.teacherProfiles || []);
      } else {
        const [
          profilesResponse,
          resultsResponse,
          eventsResponse,
          scheduleResponse,
          portalAccessResponse,
          groupsResponse,
          attendanceResponse,
          teacherProfilesResponse,
          reportSettingsResponse,
          supportTicketsResponse,
        ] = await Promise.all([
          supabase.from("child_profiles").select("*").order("full_name", { ascending: true }),
          supabase.from("weekly_results").select("*").order("week_date", { ascending: false }),
          supabase.from("events").select("*").order("event_date", { ascending: false }),
          supabase.from("schedule").select("*").order("task_time", { ascending: true }),
          supabase.from("user_portal_access").select("*").order("created_at", { ascending: false }),
          supabase.from("custom_groups").select("*").order("group_name", { ascending: true }),
          supabase.from("teacher_attendance").select("*").order("attendance_date", { ascending: false }),
          supabase.from("teacher_profiles").select("*").order("full_name", { ascending: true }),
          supabase.from("report_settings").select("*"),
          supabase.from("portal_issues").select("*").order("created_at", { ascending: false }),
        ]);

        if (supportTicketsResponse.data) setSupportTickets(supportTicketsResponse.data);

        if (reportSettingsResponse.data) setReportSettings(reportSettingsResponse.data);

        const dbErrors = [
          profilesResponse.error,
          resultsResponse.error,
          eventsResponse.error,
          scheduleResponse.error,
          portalAccessResponse.error,
          groupsResponse.error,
          attendanceResponse.error,
          teacherProfilesResponse.error
        ].filter(Boolean);

        if (dbErrors.length > 0) {
          console.error("Database errors detected:", dbErrors);
          throw new Error(dbErrors.map(e => e.message).join(" | "));
        }

        const enrichedProfiles = (teacherProfilesResponse.data || []).map(profile => {
          const access = (portalAccessResponse.data || []).find(a => normalizeText(a.full_name) === normalizeText(profile.full_name));
          return {
            ...profile,
            salary_per_minute: profile.salary_per_minute || access?.salary_per_minute || 2.3,
            show_salary_card: profile.show_salary_card ?? access?.show_salary_card ?? true
          };
        });
        setTeacherProfiles(enrichedProfiles);

        const students = buildStudents(
          profilesResponse.data || [],
          resultsResponse.data || [],
          enrichedProfiles
        );

        setTeacherAttendance(attendanceResponse.data || []);
        setCustomGroups(groupsResponse.data || []);


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
        text: `Data Error: ${error?.message || "Some data could not be loaded. Please check your table permissions and try again."}`,
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
      // Robust filtering: check by muhaffiz_id (UUID) first, then fallback to name matching
      const idMatch = user?.id && student.muhaffiz_id === user.id;
      const nameMatch = normalizeText(student.teacherName) === normalizeText(teacherIdentity);

      return idMatch || nameMatch;
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
    localStorage.clear();
    showAction(null, null);

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Logout error:", err);
    }
    window.location.reload();
  };

  const handleCreatePortalAccess = async (event) => {
    event.preventDefault();

    const payload = adminForms.portalAccess;
    const targetEmail = payload.email.trim().toLowerCase();

    // 1. Create Auth User (if they don't exist)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: targetEmail,
      password: payload.password,
      options: {
        data: {
          full_name: payload.full_name,
          portal_role: payload.portal_role
        }
      }
    });

    let userId = authData?.user?.id;

    if (authError) {
      if (!authError.message.toLowerCase().includes("already registered")) {
        showAction("error", `Auth Error: ${authError.message}`);
        return;
      }
      // If already registered, we should still try to grant access
      // The RPC below will handle the heavy lifting
    }

    // 2. Grant Portal Access via RPC (Most reliable way)
    const { data: rpcData, error: rpcError } = await supabase.rpc("grant_portal_access", {
      target_email: targetEmail,
      target_role: payload.portal_role,
      target_name: payload.full_name,
      target_student_id: payload.student_id || null,
    });

    if (rpcError) {
      console.warn("RPC Grant Error (Expected if RPC missing):", rpcError);
    }

    // 3. Robust Fallback: Manually upsert to user_portal_access
    // If userId is missing (existing user), the RPC might have returned the record or we can fetch it
    const { data: accessRecord, error: upsertError } = await supabase
      .from("user_portal_access")
      .upsert({
        email: targetEmail,
        user_id: userId || undefined,
        full_name: payload.full_name,
        portal_role: payload.portal_role,
        is_active: true
      }, { onConflict: 'email' })
      .select()
      .maybeSingle();

    if (upsertError) {
      console.error("Portal access upsert failed:", upsertError);
      showAction("error", `Portal access failed: ${upsertError.message}`);
      return;
    }

    const finalUserId = userId || accessRecord?.user_id;

    // 4. Link child to parent if role is parents and student_id is provided
    if (payload.portal_role === "parents" && payload.student_id && finalUserId) {
      await supabase
        .from("profiles")
        .update({ user_id: finalUserId })
        .eq("student_id", payload.student_id);
    }

    // Refresh school data locally
    const { data: freshList, error: refreshError } = await supabase
      .from("user_portal_access")
      .select("*")
      .order("created_at", { ascending: false });

    if (refreshError) {
      console.error("Error refreshing portal list:", refreshError);
    }

    if (freshList) {
      setSchoolData((current) => ({
        ...current,
        portalAccessList: freshList,
      }));
    }

    setAdminForms((current) => ({
      ...current,
      portalAccess: { email: "", full_name: "", portal_role: "parents", password: "", student_id: "" },
    }));

    showAction("success", "Portal access granted successfully!");
    broadcastNotification("Access Granted", `Welcome ${payload.full_name}!`, payload.portal_role, targetEmail);
  };

  const [notificationsList, setNotificationsList] = useState([]);
  const [activeStatusAlert, setActiveStatusAlert] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const latestNotifIdRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    let notificationChannel;
    let isActive = true;
    
    const setupNotifications = async () => {
      try {
        // 1. Initial Fetch of History
        const { data } = await supabase
          .from("system_notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);

        if (!isActive) return;

        if (data) {
          const myNotifs = data.filter(notif =>
            notif.target_role === "all" ||
            notif.target_role === portalRole ||
            notif.target_user === user.id ||
            notif.target_user === user.email
          );
          setNotificationsList(myNotifs);
          if (myNotifs.length > 0) latestNotifIdRef.current = myNotifs[0].id;
        }

        // 2. Real-time Subscription for Instant Alerts
        // Clean up any existing channel with the same name first
        await supabase.removeChannel(supabase.channel('realtime-notifications'));
        
        if (!isActive) return;

        notificationChannel = supabase
          .channel('realtime-notifications')
          .on(
            'postgres_changes',
            { event: 'INSERT', table: 'system_notifications', schema: 'public' },
            (payload) => {
              const newNotif = payload.new;
              const isTargeted =
                newNotif.target_role === "all" ||
                newNotif.target_role === portalRole ||
                newNotif.target_user === user.id ||
                newNotif.target_user === user.email;

              if (isTargeted) {
                setNotificationsList(prev => [newNotif, ...prev]);
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', table: 'weekly_results', schema: 'public' },
            (payload) => {
              console.log("Real-time result update:", payload.eventType, payload.new?.student_id);
              
              if (payload.eventType === 'INSERT' && portalRole === "parents") {
                showAction("success", "A new progress report has been submitted!");
              }
              
              loadPortalData(portalRole, user);
            }
          );
        
        notificationChannel.subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn("Realtime subscription blocked or failed. This is often caused by ad-blockers.");
          }
        });
      } catch (err) {
        console.error("Notification setup error:", err);
      }
    };
    
    setupNotifications();

    return () => {
      isActive = false;
      if (notificationChannel) {
        supabase.removeChannel(notificationChannel);
      }
    };
  }, [user, portalRole]);

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        showAction("success", "Notifications Enabled!");
      }
    }
  };

  const handleTeacherGroupFilterChange = (group) => {
    setTeacherGroupFilter(group);
  };

  const handleAdminTeacherFilterChange = (filter) => {
    setAdminTeacherFilter(filter);
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
      const numericId = studentId && !isNaN(studentId) ? Number(studentId) : studentId;

      if (numericId && weekDate) {
        const existing = schoolData.weeklyResults.find(r =>
          String(r.student_id) === String(numericId) && r.week_date === weekDate
        );

        if (existing) {
          setTeacherForms(curr => ({
            ...curr,
            result: { ...curr.result, ...existing, student_id: numericId, week_date: weekDate }
          }));
        } else {
          const { data, error } = await supabase
            .from("weekly_results")
            .upsert({
              student_id: numericId,
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
              result: { ...curr.result, ...data, student_id: numericId, week_date: weekDate }
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

    // Trigger Supabase notification via shared function
    await broadcastNotification(
      notifTitle,
      payload.body,
      payload.target_audience === "user" ? "user" : payload.target_audience,
      payload.target_audience === "user" ? payload.target_uuid : null,
      payload.redirect_page
    );

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
      announcement: { title: "", type: "Update", target_role: "all", event_date: getToday() },
    }));
    showAction("success", "Announcement created successfully.");
    broadcastNotification("New Update!", payload.title, payload.target_role || "all", null, "Announcements");
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
    broadcastNotification("Schedule Updated", `New task added: ${payload.task_name}`, "parents", null, "Schedule");
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

    // Check admin attendance limit (3 times per day)
    const today = new Date().toISOString().split('T')[0];
    const todayAttendanceCount = teacherAttendance.filter(a =>
      a.attendance_date === today
    ).length;

    if (todayAttendanceCount >= 3) {
      showAction("error", "Daily attendance limit reached (3 records per day).");
      return;
    }

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

  const handleAssignChild = async (data) => {
    const { student_id, teacher_id, parent_id, full_name, arabic_name, group_name, juz, surat, photo_url, its } = data;
    if (!student_id) {
      showAction("error", "Please select a student first.");
      return;
    }

    console.log("Linking accounts for student:", student_id, { teacher_id, parent_id });

    // Fix: Use schoolData instead of undefined adminData
    const teacherRecord =
      schoolData.portalAccessList.find(a => String(a.user_id) === String(teacher_id) || String(a.email) === String(teacher_id)) ||
      schoolData.teacherProfiles.find(p => String(p.user_id) === String(teacher_id));

    const parentRecord = schoolData.portalAccessList.find(a => String(a.user_id) === String(parent_id) || String(a.email) === String(parent_id));

    // Update child_profiles table directly
    const updatePayload = {
      teacher_name: teacherRecord?.full_name || null,
      teacher_id: teacherRecord?.user_id || teacher_id || null,
      parent_user_id: parentRecord?.user_id || (parent_id?.includes('@') ? null : parent_id) || null,
      parent_email: parentRecord?.email || (parent_id?.includes('@') ? parent_id : null) || null
    };

    if (full_name && full_name.trim()) updatePayload.full_name = full_name.trim();
    if (arabic_name && arabic_name.trim()) updatePayload.arabic_name = arabic_name.trim();
    if (group_name && group_name.trim()) updatePayload.group_name = group_name.trim();
    if (juz && juz.trim()) updatePayload.juz = juz.trim();
    if (surat && surat.trim()) updatePayload.surat = surat.trim();
    if (photo_url && photo_url.trim()) updatePayload.photo_url = photo_url.trim();
    if (its && its.trim()) updatePayload.its = its.trim();

    const { error: profileError } = await supabase
      .from("child_profiles")
      .update(updatePayload)
      .eq("student_id", student_id);

    if (profileError) {
      console.error("Link update error:", profileError);
      showAction("error", `Connection Failed: ${profileError.message}`);
      return;
    }

    // Secondary Check: If we have an ID for parent but it wasn't set, force it
    if (parentRecord?.user_id && !updatePayload.parent_user_id) {
      await supabase.from("child_profiles").update({ parent_user_id: parentRecord.user_id }).eq("student_id", student_id);
    }

    // Refresh school data locally
    setSchoolData((current) => ({
      ...current,
      students: current.students.map((s) =>
        String(s.student_id) === String(student_id)
          ? {
            ...s,
            teacherName: teacherRecord?.full_name || "Unassigned teacher",
            groupName: group_name || "Ungrouped",
            muhaffiz_id: teacherRecord?.user_id || teacher_id || null,
            user_id: parentRecord?.user_id || null,
            parent_email: parentRecord?.email || null
          }
          : s
      ),
    }));

    showAction("success", `Assignment updated successfully.`);
  };

  const handleUnassignChild = async (studentId) => {
    if (!window.confirm("Are you sure you want to remove this child from their assigned muhaffiz?")) return;

    const { error: profileError } = await supabase
      .from("child_profiles")
      .update({
        teacher_name: null,
        group_name: null,
        teacher_id: null,
        parent_user_id: null,
        parent_email: null
      })
      .eq("student_id", studentId);

    if (profileError) {
      showAction("error", `Unassign Failed: ${profileError?.message || 'Unknown error'}`);
      return;
    }

    // Refresh school data locally
    setSchoolData((current) => ({
      ...current,
      students: current.students.map((s) =>
        String(s.student_id) === String(studentId)
          ? { ...s, teacherName: "Unassigned teacher", groupName: "Ungrouped", muhaffiz_id: null, user_id: null }
          : s
      ),
    }));

    showAction("success", "Student unassigned and unlinked from all accounts.");
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

  const handleClearHistory = (table) => async () => {
    const tableLabel = table === "events" ? "Announcements" : "Notifications";
    if (!window.confirm(`Are you sure you want to clear all ${tableLabel}? This action is irreversible.`)) return;

    // Use a filter that is guaranteed to match all rows without causing type mismatch errors
    const { error } = await supabase
      .from(table)
      .delete()
      .not("id", "is", null);

    if (error) {
      showAction("error", `Clear failed: ${error.message}`);
      return;
    }

    await loadPortalData(portalRole, user, parentData.studentProfile);
    showAction("success", `${tableLabel} history cleared.`);
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
    setAdminForms(curr => ({ ...curr, teacherProfile: { full_name: "", photo_url: "", phone_number: "", whatsapp_number: "" } }));
    showAction("success", "Teacher profile updated.");
  };

  const handleTeacherResultSubmit = async (event) => {
    event.preventDefault();

    const totalScore = RESULT_NUMERIC_FIELDS.reduce(
      (sum, field) => sum + toNumber(teacherForms.result[field]),
      0
    );

    const sId = teacherForms.result.student_id;
    const numericId = sId && !isNaN(sId) ? Number(sId) : sId;

    const payload = {
      ...teacherForms.result,
      student_id: numericId,
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
        // Values are preserved so they stay "locked" on the preview card
      },
    }));
    showAction("success", "Tahfeez report saved successfully.");
    const targetStudent = schoolData.students.find(s => String(s.student_id) === String(numericId));
    const parentId = targetStudent?.user_id || targetStudent?.parent_email;

    broadcastNotification(
      "Tahfeez Report Submitted", 
      `A new progress report has been saved for ${targetStudent?.name || "the student"}.`, 
      "parents", 
      parentId, 
      "Progress"
    );
  };



  if (loading) {
    return <LoadingScreen message="Connecting to Mauze Tahfeez..." />;
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }



  const enablerUI = (
    <React.Fragment>
      <AnnouncementDetailsModal
        announcement={selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
      />
      <ELearningModal
        isOpen={isELearningOpen}
        onClose={() => setIsELearningOpen(false)}
      />
    </React.Fragment>
  );

  return (
    <React.Fragment>
      {enablerUI}
      <div className="app-portal-wrapper">
        {portalRole === "parents" ? (
          <ParentPortal
            activePage={activePage}
            appTheme={appTheme}
            isDarkMode={isDarkMode}
            loadPortalData={loadPortalData}
            loading={loading}
            menuOpen={menuOpen}
            onLogout={handleLogout}
            onRoleChange={storeRole}
            parentData={parentData}
            portalRole={portalRole}
            setActivePage={setActivePage}
            setAppTheme={setAppTheme}
            setIsDarkMode={setIsDarkMode}
            setMenuOpen={setMenuOpen}
            setSelectedAnnouncement={setSelectedAnnouncement}
            setSelectedStudentId={setSelectedStudentId}
            showAction={showAction}
            teacherProfiles={teacherProfiles}
            user={user}
            schoolData={schoolData}
          />
        ) : portalRole === "admin" ? (
          <AdminPortal
            activePage={activePage}
            adminData={{
              ...schoolData,
              customGroups,
              teacherAttendance,
              supportTickets,
            }}
            adminForms={adminForms}
            adminTeacherFilter={adminTeacherFilter}
            loadPortalData={loadPortalData}
            menuOpen={menuOpen}
            notifications={notificationsList}
            onAdminFormChange={handleAdminFormChange}
            onAdminTeacherFilterChange={handleAdminTeacherFilterChange}
            onAssignChild={handleAssignChild}
            onClearHistory={handleClearHistory}
            onCreateAnnouncement={handleCreateAnnouncement}
            onCreateGroup={handleCreateGroup}
            onCreatePortalAccess={handleCreatePortalAccess}
            onCreateSchedule={handleCreateSchedule}
            onDeleteRecord={handleDeleteRecord}
            onLogout={handleLogout}
            onRecordTeacherAttendance={handleRecordTeacherAttendance}
            onRoleChange={storeRole}
            onSendCustomNotification={handleSendCustomNotification}
            onShowAction={showAction}
            onUnassignChild={handleUnassignChild}
            onUpdateTeacherProfile={handleUpdateTeacherProfile}
            portalAccess={portalAccess}
            portalRole={portalRole}
            reportSettings={reportSettings}
            selectedStudentId={selectedStudentId}
            setActivePage={setActivePage}
            setAdminForms={setAdminForms}
            setMenuOpen={setMenuOpen}
            setSelectedAnnouncement={setSelectedAnnouncement}
            setSelectedStudentId={setSelectedStudentId}
            teacherProfiles={teacherProfiles}
            user={user}
          />
        ) : (
          <TeacherPortal
            actionMessage={actionMessage}
            activePage={activePage}
            loadPortalData={loadPortalData}
            menuOpen={menuOpen}
            monthlySalary={monthlySalary}
            notifications={notificationsList}
            onLogout={handleLogout}
            onRoleChange={storeRole}
            onTeacherFormChange={handleTeacherFormChange}
            onTeacherGroupFilterChange={handleTeacherGroupFilterChange}
            onTeacherResultSubmit={handleTeacherResultSubmit}
            portalAccess={portalAccess}
            portalRole={portalRole}
            reportSettings={reportSettings}
            setActivePage={setActivePage}
            setMenuOpen={setMenuOpen}
            setSelectedAnnouncement={setSelectedAnnouncement}
            teacherData={teacherData}
            teacherForms={teacherForms}
            teacherProfiles={teacherProfiles}
            schoolData={schoolData}
          />
        )}

      </div>
    </React.Fragment>
  );
}

