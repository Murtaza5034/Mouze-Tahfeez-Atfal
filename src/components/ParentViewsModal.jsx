import React, { useState, useMemo } from "react";
import {
  Eye,
  CheckCircle2,
  Clock,
  Search,
  X,
  Users,
  MessageCircle,
  Sparkles,
  Calendar,
  Layers,
} from "lucide-react";
import "./ParentViewsModal.css";

function formatViewDate(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const dateStr = d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    return `${dateStr} at ${timeStr}`;
  } catch (_) {
    return "";
  }
}

export default function ParentViewsModal({
  isOpen,
  onClose,
  students = [],
  parentViews = [],
  isKibar = false,
}) {
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'viewed' | 'pending'
  const [searchQuery, setSearchQuery] = useState("");

  // Map student_id -> view data for O(1) instant lookup
  const viewMap = useMemo(() => {
    const map = new Map();
    (parentViews || []).forEach((v) => {
      if (v && v.student_id) {
        map.set(String(v.student_id).trim().toLowerCase(), v);
      }
    });
    return map;
  }, [parentViews]);

  // Compute status for all students
  const enrichedStudents = useMemo(() => {
    return (students || []).map((student) => {
      const candidateIds = [
        student.student_id,
        student.id,
        student.user_id,
        student.its,
        student.its_number,
        ...(student.allIds || []),
      ]
        .filter(Boolean)
        .map((id) => String(id).trim().toLowerCase());

      let viewRecord = null;
      for (const id of candidateIds) {
        if (viewMap.has(id)) {
          viewRecord = viewMap.get(id);
          break;
        }
      }

      const isViewed = Boolean(viewRecord?.viewed);
      const viewTime = viewRecord?.updated_at || viewRecord?.created_at || null;
      const formattedTime = formatViewDate(viewTime);

      return {
        ...student,
        isViewed,
        viewRecord,
        viewTime,
        formattedTime,
      };
    });
  }, [students, viewMap]);

  // Counts
  const totalCount = enrichedStudents.length;
  const viewedCount = enrichedStudents.filter((s) => s.isViewed).length;
  const pendingCount = totalCount - viewedCount;
  const viewedPct = totalCount > 0 ? Math.round((viewedCount / totalCount) * 100) : 0;

  // Filtered & Searched List
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedStudents.filter((s) => {
      // Tab filter
      if (filterTab === "viewed" && !s.isViewed) return false;
      if (filterTab === "pending" && s.isViewed) return false;

      // Search filter
      if (q) {
        const name = String(s.name || s.full_name || "").toLowerCase();
        const arabic = String(s.arabic_name || "").toLowerCase();
        const its = String(s.its || s.its_number || "").toLowerCase();
        const grp = String(s.groupName || s.group_name || "").toLowerCase();
        return name.includes(q) || arabic.includes(q) || its.includes(q) || grp.includes(q);
      }

      return true;
    });
  }, [enrichedStudents, filterTab, searchQuery]);

  if (!isOpen) return null;

  const handleSendReminder = (student) => {
    const cleanNumber = String(student.whatsapp_number || "").replace(/[^0-9]/g, "");
    const studentName = student.name || student.full_name || "your child";
    const studentId = student.student_id || student.id || "";
    const portalLink = "https://mouze-tahfeez-atfal.vercel.app/";
    const appProgressLink = `https://mouze-tahfeez-atfal.vercel.app/?redirectPage=Home&studentId=${studentId}&openApp=true`;
    const playStoreLink = "https://play.google.com/store/apps/details?id=com.mauzetahfeez.myapp";

    const message = 
`Salam! 🌟

This is a gentle reminder to please review the latest weekly Tahfeez progress report card for *${studentName}*.

📱 *Direct App & Progress Report:*
${appProgressLink}

📥 *Download App from Google Play Store:*
${playStoreLink}

🌐 *Web Portal:*
${portalLink}

Shukran!`;

    const encodedText = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanNumber}?text=${encodedText}`, "_blank");
  };

  return (
    <div className="parent-views-modal-overlay" onClick={onClose}>
      <div className="parent-views-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="parent-views-modal-header">
          <div className="pvm-title-area">
            <div className="pvm-icon-box">
              <Eye size={24} />
            </div>
            <div>
              <h3>
                Parent Report Card Views
                <Sparkles size={16} style={{ color: "#d4af37" }} />
              </h3>
              <p>
                {viewedCount} of {totalCount} parents have viewed their student's progress report ({viewedPct}%)
              </p>
            </div>
          </div>
          <button className="pvm-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Stats Summary Strip */}
        <div className="pvm-summary-strip">
          <div className="pvm-summary-card">
            <div>
              <div className="pvm-stat-label">Total Students</div>
              <div className="pvm-stat-num">{totalCount}</div>
            </div>
            <Users size={22} style={{ color: "#b8860b", opacity: 0.7 }} />
          </div>

          <div className="pvm-summary-card viewed">
            <div>
              <div className="pvm-stat-label">Parent Viewed</div>
              <div className="pvm-stat-num">{viewedCount} ({viewedPct}%)</div>
            </div>
            <CheckCircle2 size={22} style={{ color: "#27ae60" }} />
          </div>

          <div className="pvm-summary-card pending">
            <div>
              <div className="pvm-stat-label">Not Viewed Yet</div>
              <div className="pvm-stat-num">{pendingCount} ({100 - viewedPct}%)</div>
            </div>
            <Clock size={22} style={{ color: "#d35400" }} />
          </div>
        </div>

        {/* Search & Tabs Controls */}
        <div className="pvm-controls-bar">
          <div className="pvm-search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              className="pvm-search-input"
              placeholder="Search by student name, Arabic name, ITS, or group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="pvm-tabs">
            <button
              className={`pvm-tab-btn ${filterTab === "all" ? "active" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              <Layers size={14} /> All ({totalCount})
            </button>
            <button
              className={`pvm-tab-btn ${filterTab === "viewed" ? "active" : ""}`}
              onClick={() => setFilterTab("viewed")}
            >
              <CheckCircle2 size={14} /> Viewed ({viewedCount})
            </button>
            <button
              className={`pvm-tab-btn ${filterTab === "pending" ? "active" : ""}`}
              onClick={() => setFilterTab("pending")}
            >
              <Clock size={14} /> Not Viewed ({pendingCount})
            </button>
          </div>
        </div>

        {/* Student Rows List */}
        <div className="pvm-student-list">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((student) => {
              const studentName = student.name || student.full_name || "Student";
              const initials = studentName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();

              return (
                <div
                  key={student.student_id || student.id}
                  className={`pvm-student-row ${student.isViewed ? "is-viewed" : "not-viewed"}`}
                >
                  <div className="pvm-student-info">
                    {student.photo_url ? (
                      <img src={student.photo_url} alt={studentName} className="pvm-avatar" />
                    ) : (
                      <div className="pvm-avatar-placeholder">{initials}</div>
                    )}
                    <div className="pvm-student-names">
                      <h4 className="pvm-student-name">{studentName}</h4>
                      {student.arabic_name && (
                        <div className="pvm-arabic-name">{student.arabic_name}</div>
                      )}
                      <div className="pvm-student-meta">
                        {student.its && (
                          <span className="pvm-meta-tag">ITS: {student.its}</span>
                        )}
                        {(student.groupName || student.group_name) && (
                          <span>{student.groupName || student.group_name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pvm-status-area">
                    {student.isViewed ? (
                      <>
                        <span className="pvm-badge viewed">
                          <CheckCircle2 size={13} /> Viewed
                        </span>
                        {student.formattedTime && (
                          <span className="pvm-time-stamp" title={student.viewTime}>
                            <Calendar size={11} /> {student.formattedTime}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="pvm-badge not-viewed">
                          <Clock size={13} /> Not Viewed Yet
                        </span>
                        {student.whatsapp_number && (
                          <button
                            type="button"
                            className="pvm-whatsapp-btn"
                            onClick={() => handleSendReminder(student)}
                            title="Send WhatsApp Reminder to Parent"
                          >
                            <MessageCircle size={12} /> Send Reminder
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="pvm-empty-state">
              <Users size={40} />
              <p>No students found matching your filter criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
