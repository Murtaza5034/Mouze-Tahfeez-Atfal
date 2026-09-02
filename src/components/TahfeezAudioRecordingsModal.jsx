import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Headphones,
  X,
  Play,
  Pause,
  Download,
  Calendar,
  Clock,
  User,
  Volume2,
  VolumeX,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { supabase } from "../supabaseClient.js";
import "./TahfeezAudioRecordingsModal.css";

function formatDuration(secs) {
  if (!secs || isNaN(secs)) return "0s";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  if (m > 0) return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  return `${s}s`;
}

function formatClockTime(isoStr) {
  if (!isoStr) return "--:--";
  try {
    return new Date(isoStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  } catch (_) {
    return "--:--";
  }
}

function formatDateLabel(dateStr) {
  if (!dateStr) return "Unknown Date";
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().slice(0, 10);

    if (dateStr === todayStr) return "Today";
    if (dateStr === yestStr) return "Yesterday";

    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch (_) {
    return dateStr;
  }
}

function extractStoragePath(url, bucket = "tahfeez_recordings") {
  if (!url) return "";
  try {
    if (url.includes("/o/")) {
      const raw = url.split("/o/")[1].split("?")[0];
      const decoded = decodeURIComponent(raw);
      const prefix = `${bucket}/`;
      if (decoded.startsWith(prefix)) {
        return decoded.slice(prefix.length);
      }
      return decoded;
    }
  } catch (_) {}
  return "";
}

// Single Custom Audio Item Component
function AudioItemCard({ item, isPlaying, onPlayToggle, onRequestDelete }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(item.duration_seconds || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
  };

  const handleRateChange = (rate) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const startTimeStr = formatClockTime(item.started_at);
  const endTimeStr = item.ended_at ? formatClockTime(item.ended_at) : (item.isLive ? "Ongoing..." : "--:--");
  const fileSizeText = item.file_size_kb ? `~${item.file_size_kb} KB` : "Ultra-light Opus";

  return (
    <div className="tahfeez-rec-card">
      {item.audio_url && (
        <audio
          ref={audioRef}
          src={item.audio_url}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (audioRef.current?.duration) setDuration(audioRef.current.duration);
          }}
          onEnded={() => onPlayToggle(false)}
        />
      )}

      {/* Top Details */}
      <div className="tahfeez-rec-top">
        <div className="tahfeez-rec-meta">
          <span className="tahfeez-rec-time-badge">
            <Clock size={13} style={{ color: "#d4af37" }} />
            <span>{startTimeStr} – {endTimeStr}</span>
          </span>

          <span className="tahfeez-rec-dur-badge">
            <span>{formatDuration(item.duration_seconds || duration)}</span>
          </span>

          <span className="tahfeez-rec-size-badge">
            {fileSizeText}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "0.78rem", color: "#bfa15f", display: "flex", alignItems: "center", gap: "4px" }}>
            <User size={12} />
            <span>Muhaffiz: <strong>{item.teacher_name || "Muhaffiz"}</strong></span>
          </div>

          {/* Delete Individual Recording Button */}
          <button
            type="button"
            className="tahfeez-card-delete-btn"
            onClick={() => onRequestDelete(item)}
            title="Delete this audio recording permanently"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Embedded Player */}
      {item.audio_url ? (
        <div className="tahfeez-player-box">
          <div className="tahfeez-player-main-row">
            <button
              type="button"
              className="tahfeez-play-btn"
              onClick={() => onPlayToggle(!isPlaying)}
              title={isPlaying ? "Pause Recording" : "Play Recording"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: "2px" }} />}
            </button>

            <div className="tahfeez-player-track">
              <input
                type="range"
                className="tahfeez-player-slider"
                min="0"
                max={duration || item.duration_seconds || 1}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
              />
              <div className="tahfeez-player-time-row">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration || item.duration_seconds || 0)}</span>
              </div>
            </div>
          </div>

          <div className="tahfeez-player-tools">
            {/* Speed Presets */}
            <div className="tahfeez-speed-chips">
              <span style={{ fontSize: "0.68rem", color: "#8c8275", marginRight: "2px" }}>Speed:</span>
              {[1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  className={`tahfeez-speed-chip ${playbackRate === rate ? "active" : ""}`}
                  onClick={() => handleRateChange(rate)}
                >
                  {rate}x
                </button>
              ))}
            </div>

            <div className="tahfeez-player-actions">
              <button
                type="button"
                onClick={toggleMute}
                style={{ background: "none", border: "none", color: "#bfa15f", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>

              <a
                href={item.audio_url}
                target="_blank"
                rel="noopener noreferrer"
                download={`Tahfeez_Class_${item.student_name || 'Student'}_${item.started_at ? new Date(item.started_at).toISOString().slice(0, 10) : 'Recording'}.webm`}
                className="tahfeez-download-audio-btn"
                title="Download Audio File"
              >
                <Download size={13} />
                <span>Save</span>
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px 14px", borderRadius: "10px", fontSize: "0.78rem", color: "#9c9285", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={14} style={{ color: "#d4af37" }} />
          <span>Call completed ({formatDuration(item.duration_seconds)}) · Audio stream finalized</span>
        </div>
      )}
    </div>
  );
}

export default function TahfeezAudioRecordingsModal({ student, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("all");
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState(null);

  // Delete Alert States
  const [deleteTarget, setDeleteTarget] = useState(null); // null | item | { type: "bulk", count: number }
  const [isDeleting, setIsDeleting] = useState(false);

  const studentId = student?.student_id || student?.id;
  const studentName = student?.name || student?.student_name || "Student";
  const studentArabic = student?.arabic_name || "";
  const teacherName = student?.teacher || student?.teacher_name || "Muhaffiz";
  const isGroup = student?.type === "group" || student?.isGroup;

  const fetchRecordings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("online_tahfeez_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(300);

      if (isGroup) {
        query = query.or(`group_name.eq.${studentName},type.eq.group`);
      } else if (studentId) {
        query = query.or(`student_id.eq.${studentId},student_name.eq.${studentName}`);
      } else {
        query = query.eq("student_name", studentName);
      }

      const { data, error } = await query;
      if (!error && data) {
        setLogs(data);
      }
    } catch (err) {
      console.warn("Failed to fetch recordings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, [studentId, studentName, isGroup]);

  // Group logs by date
  const { dateGroups, availableDates } = useMemo(() => {
    const groups = {};
    logs.forEach((log) => {
      const dateKey = log.started_at ? log.started_at.slice(0, 10) : "Unknown";
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });

    const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return { dateGroups: groups, availableDates: dates };
  }, [logs]);

  // Filter logs for selected date
  const displayedLogs = useMemo(() => {
    if (selectedDate === "all") {
      return logs;
    }
    return dateGroups[selectedDate] || [];
  }, [selectedDate, logs, dateGroups]);

  // Handle single deletion execution
  const executeDeleteSingle = async (item) => {
    if (!item) return;
    setIsDeleting(true);
    try {
      // 1. Delete from Firebase Storage if audio URL is present
      if (item.audio_url || item.recording_url) {
        const path = extractStoragePath(item.audio_url || item.recording_url);
        if (path) {
          await supabase.storage.from("tahfeez_recordings").remove(path).catch(() => {});
        }
      }

      // 2. Delete or update database log record
      if (item.id) {
        await supabase.from("online_tahfeez_logs").delete().eq("id", item.id);
      }

      // 3. Update local state
      setLogs((prev) => prev.filter((l) => l.id !== item.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete recording:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle bulk deletion execution
  const executeDeleteBulk = async () => {
    setIsDeleting(true);
    try {
      // 1. Collect all storage paths and remove in bulk
      const pathsToDelete = logs
        .map((l) => extractStoragePath(l.audio_url || l.recording_url))
        .filter(Boolean);

      if (pathsToDelete.length > 0) {
        await supabase.storage.from("tahfeez_recordings").remove(pathsToDelete).catch(() => {});
      }

      // 2. Delete records from database
      if (isGroup) {
        await supabase.from("online_tahfeez_logs").delete().or(`group_name.eq.${studentName},type.eq.group`);
      } else if (studentId) {
        await supabase.from("online_tahfeez_logs").delete().or(`student_id.eq.${studentId},student_name.eq.${studentName}`);
      } else {
        await supabase.from("online_tahfeez_logs").delete().eq("student_name", studentName);
      }

      // 3. Update local state
      setLogs([]);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to bulk delete recordings:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="tahfeez-audio-modal-backdrop" onClick={onClose}>
        <div className="tahfeez-audio-modal-card" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="tahfeez-audio-modal-header">
            <div className="tahfeez-audio-header-left">
              <div className="tahfeez-audio-header-icon">
                <Headphones size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 className="tahfeez-audio-header-title">
                  <span>Class Audio Recordings</span>
                </h3>
                <div className="tahfeez-audio-header-sub">
                  Ultra-light Audio Replay & Recitation Audit
                </div>
              </div>
            </div>

            <div className="tahfeez-audio-header-actions">
              <button type="button" className="tahfeez-audio-close-btn" onClick={onClose} title="Close">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Student Banner */}
          <div className="tahfeez-audio-student-banner">
            <div className="tahfeez-audio-student-info">
              <div className="tahfeez-audio-student-avatar">
                {studentName.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="tahfeez-audio-student-name">
                  {studentName} {studentArabic && <span style={{ fontFamily: "'Al-Kanz', serif", color: "#d4af37", fontSize: "0.95rem", marginLeft: "6px" }}>({studentArabic})</span>}
                </div>
                <div className="tahfeez-audio-student-teacher">
                  Muhaffiz: <strong>{teacherName}</strong> · {isGroup ? "Group Session" : "1-on-1 Class"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {logs.length > 0 && (
                <button
                  type="button"
                  className="tahfeez-bulk-delete-btn"
                  onClick={() => setDeleteTarget({ type: "bulk", count: logs.length })}
                  title="Delete all recordings for this student permanently"
                >
                  <Trash2 size={13} />
                  <span>Delete All ({logs.length})</span>
                </button>
              )}

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.7rem", color: "#8c8275", display: "block" }}>Total Sessions</span>
                <strong style={{ fontSize: "1.05rem", color: "#d4af37" }}>{logs.length}</strong>
              </div>
            </div>
          </div>

          {/* Date Filters */}
          {availableDates.length > 0 && (
            <div className="tahfeez-audio-date-bar">
              <button
                type="button"
                className={`tahfeez-date-chip ${selectedDate === "all" ? "active" : ""}`}
                onClick={() => setSelectedDate("all")}
              >
                <span>All Dates</span>
                <span className="tahfeez-date-chip-badge">{logs.length}</span>
              </button>

              {availableDates.map((dateStr) => {
                const count = (dateGroups[dateStr] || []).length;
                const label = formatDateLabel(dateStr);
                return (
                  <button
                    key={dateStr}
                    type="button"
                    className={`tahfeez-date-chip ${selectedDate === dateStr ? "active" : ""}`}
                    onClick={() => setSelectedDate(dateStr)}
                  >
                    <Calendar size={12} />
                    <span>{label}</span>
                    <span className="tahfeez-date-chip-badge">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Recordings List */}
          <div className="tahfeez-audio-modal-body">
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", color: "#d4af37", gap: "10px" }}>
                <Loader2 size={32} className="animate-spin" />
                <span style={{ fontSize: "0.85rem", color: "#cfc8be" }}>Loading audio recordings...</span>
              </div>
            ) : displayedLogs.length === 0 ? (
              <div className="tahfeez-audio-empty-state">
                <Headphones size={38} className="tahfeez-audio-empty-icon" />
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f7f5f0", marginBottom: "4px" }}>
                  No Audio Recordings Found
                </div>
                <div style={{ fontSize: "0.8rem", lineHeight: "1.5" }}>
                  Class audio is automatically captured in ultra-lightweight Opus format during live online classes and will appear here after sessions conclude.
                </div>
              </div>
            ) : (
              displayedLogs.map((item, idx) => {
                const itemId = item.id || `rec_${idx}`;
                return (
                  <AudioItemCard
                    key={itemId}
                    item={item}
                    isPlaying={currentlyPlayingId === itemId}
                    onPlayToggle={(shouldPlay) => {
                      setCurrentlyPlayingId(shouldPlay ? itemId : null);
                    }}
                    onRequestDelete={(targetItem) => {
                      setDeleteTarget(targetItem);
                    }}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ============================================================
          PERMANENT DELETE CONFIRMATION ALERT MODAL (FLUID FOR ALL SCREENS)
          ============================================================ */}
      {deleteTarget && (
        <div
          className="tahfeez-confirm-overlay"
          onClick={() => {
            if (!isDeleting) setDeleteTarget(null);
          }}
        >
          <div className="tahfeez-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="tahfeez-confirm-icon-wrap">
              <AlertTriangle size={28} />
            </div>

            <h3 className="tahfeez-confirm-title">
              {deleteTarget.type === "bulk" ? "Delete All Recordings?" : "Delete Recording Permanently?"}
            </h3>

            <p className="tahfeez-confirm-desc">
              {deleteTarget.type === "bulk"
                ? `You are about to permanently delete all ${deleteTarget.count} class audio recordings for ${studentName}. This action will delete the audio files from Firebase Storage and cannot be undone.`
                : "This class audio recording will be permanently deleted from Firebase Storage and the portal database. This action cannot be reversed."}
            </p>

            {deleteTarget.type !== "bulk" && (
              <div className="tahfeez-confirm-detail-box">
                <div><strong>Student:</strong> {studentName}</div>
                <div><strong>Class Time:</strong> {formatClockTime(deleteTarget.started_at)} – {formatClockTime(deleteTarget.ended_at)} ({formatDuration(deleteTarget.duration_seconds)})</div>
                <div><strong>Date:</strong> {deleteTarget.started_at ? new Date(deleteTarget.started_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Today"}</div>
              </div>
            )}

            <div className="tahfeez-confirm-actions">
              <button
                type="button"
                className="tahfeez-confirm-cancel-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="tahfeez-confirm-delete-btn"
                disabled={isDeleting}
                onClick={() => {
                  if (deleteTarget.type === "bulk") {
                    executeDeleteBulk();
                  } else {
                    executeDeleteSingle(deleteTarget);
                  }
                }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>{deleteTarget.type === "bulk" ? "Delete All" : "Delete"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
