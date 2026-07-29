import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Sparkles,
  ChevronDown,
  X,
  CheckCircle,
  Send,
  BookOpen,
  Layers3,
  Edit3,
  Save,
  Trophy,
  UserCheck,
  BookMarked,
  GraduationCap,
  Sun,
  Moon,
  Star,
  MoreHorizontal,
  ArrowRight
} from "lucide-react";
import { supabase } from "./supabaseClient";
import "./premium-today-schedule.css";

/* ─── Marhala Options (reused from MarhalaPosts) ─── */
const MARHALA_OPTIONS = [
  "Marhala Ula",
  "Marhala Saniyah",
  "Marhala Salesah",
  "Marhala Rabeah",
  "Marhala Khamesah",
  "Marhala Sadesah",
  "Marhala Sabeah",
  "Marhala Saminah",
];

const MARHALA_ARABIC_LABELS = {
  "Marhala Ula": "المرحلة الاولى",
  "Marhala Saniyah": "المرحلة الثانية",
  "Marhala Salesah": "المرحلة الثالثة",
  "Marhala Rabeah": "المرحلة الرابعة",
  "Marhala Khamesah": "المرحلة الخامسة",
  "Marhala Sadesah": "المرحلة السادسة",
  "Marhala Sabeah": "المرحلة السابعة",
  "Marhala Saminah": "المرحلة الثامنة",
};

/* ─── Ikhtebar Types ─── */
const IKHTEBAR_OPTIONS = [
  { value: "murajah", label: "Murajah", icon: BookMarked },
  { value: "juz_hali", label: "Juz Hali", icon: Layers3 },
  { value: "takhteet", label: "Takhteet", icon: Edit3 },
  { value: "jadeed", label: "Jadeed", icon: Star },
  { value: "general", label: "General Test", icon: Trophy },
];

/* ─── Week Day names ─── */
const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday"
];

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ─── Helper ─── */
const getFormattedToday = () => {
  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];
  const day = now.getDate();
  const month = now.toLocaleString("default", { month: "long" });
  const year = now.getFullYear();
  return {
    dayName,
    date: `${month} ${day}, ${year}`,
    full: `${dayName}, ${month} ${day}, ${year}`,
    short: `${DAY_NAMES_SHORT[now.getDay()]}, ${month.slice(0, 3)} ${day}`,
    isWeekend: now.getDay() === 5 || now.getDay() === 6,
  };
};

const getTodayISO = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

/* ─── Main Component ─── */
export default function PremiumTodaySchedule({
  /* Data */
  schedule = [],
  role = "parent",          // "admin" | "parent" | "teacher"
  marhala = "",
  studentName = "",
  studentId = "",
  
  /* Callbacks */
  onToggleDone,
  onReschedule,
  onUpdateBody,
  onUpdateMarhala,
  onSendNotification,
  onCreateIkhtebar,
  onRefresh,
  
  /* Admin-specific */
  editingBody = false,
}) {
  const today = getFormattedToday();
  const [localSchedule, setLocalSchedule] = useState(schedule);
  const [selectedMarhala, setSelectedMarhala] = useState(marhala || "");
  const [selectedIkhtebar, setSelectedIkhtebar] = useState("");
  const [showIkhtebarOptions, setShowIkhtebarOptions] = useState(false);
  const [showMarhalaDropdown, setShowMarhalaDropdown] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);
  const [bodyEditId, setBodyEditId] = useState(null);
  const [bodyEditValue, setBodyEditValue] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [showReschedule, setShowReschedule] = useState(null);
  const [animIn, setAnimIn] = useState(false);
  const marhalaRef = useRef(null);
  const ikhtebarRef = useRef(null);

  useEffect(() => {
    setLocalSchedule(schedule);
  }, [schedule]);

  useEffect(() => {
    setAnimIn(true);
  }, []);

  /* Close dropdowns on outside click */
  useEffect(() => {
    const handleClick = (e) => {
      if (marhalaRef.current && !marhalaRef.current.contains(e.target))
        setShowMarhalaDropdown(false);
      if (ikhtebarRef.current && !ikhtebarRef.current.contains(e.target))
        setShowIkhtebarOptions(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isAdmin = role === "admin";

  const handleToggleDone = (index) => {
    const updated = [...localSchedule];
    updated[index] = { ...updated[index], is_done: !updated[index].is_done };
    setLocalSchedule(updated);
    if (onToggleDone) onToggleDone(index, updated[index].is_done);
  };

  const handleReschedule = (index) => {
    if (onReschedule) onReschedule(index, rescheduleDate);
    setShowReschedule(null);
    setRescheduleDate("");
  };

  const handleSaveBody = (index) => {
    if (onUpdateBody) onUpdateBody(index, bodyEditValue);
    setBodyEditId(null);
    setBodyEditValue("");
  };

  const handleMarhalaChange = (value) => {
    setSelectedMarhala(value);
    setShowMarhalaDropdown(false);
    if (onUpdateMarhala) onUpdateMarhala(value);
  };

  const handleIkhtebarSelect = (option) => {
    setSelectedIkhtebar(option.value);
    setShowIkhtebarOptions(false);
    if (onCreateIkhtebar) onCreateIkhtebar(option.value);
  };

  const totalTasks = localSchedule.length;
  const doneTasks = localSchedule.filter((t) => t.is_done).length;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className={`pts-card ${animIn ? "pts-visible" : ""} ${today.isWeekend ? "pts-weekend" : ""}`}>
      {/* ─── Glass Effect Background ─── */}
      <div className="pts-bg-glow" />
      <div className="pts-bg-pattern" />

      {/* ─── Header Section ─── */}
      <div className="pts-header">
        <div className="pts-header-left">
          <div className="pts-day-badge">
            <span className="pts-day-name">{today.dayName.slice(0, 3)}</span>
            <span className="pts-day-number">{new Date().getDate()}</span>
          </div>
          <div className="pts-header-text">
            <h2 className="pts-title">
              <Sparkles size={18} className="pts-title-icon" />
              Today's Schedule
            </h2>
            <p className="pts-subtitle">{today.full}</p>
            {studentName && (
              <p className="pts-student-name">
                <UserCheck size={14} />
                {studentName}
              </p>
            )}
          </div>
        </div>
        <div className="pts-header-right">
          <div className={`pts-status-badge ${completionPct === 100 ? "pts-all-done" : completionPct > 0 ? "pts-partial" : ""}`}>
            <CheckCircle2 size={14} />
            <span>{doneTasks}/{totalTasks}</span>
          </div>
          {onRefresh && (
            <button className="pts-icon-btn" onClick={onRefresh} title="Refresh">
              <RotateCw size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Progress Bar ─── */}
      {totalTasks > 0 && (
        <div className="pts-progress-track">
          <div
            className="pts-progress-fill"
            style={{ width: `${completionPct}%` }}
          />
          <span className="pts-progress-label">{completionPct}% Complete</span>
        </div>
      )}

      {/* ─── Marhala & Ikhtebar Row ─── */}
      <div className="pts-controls-row">
        {/* Marhala Selector */}
        <div className="pts-selector-group" ref={marhalaRef}>
          <label className="pts-selector-label">
            <GraduationCap size={14} />
            Marhala
          </label>
          <button
            className={`pts-premium-select ${selectedMarhala ? "pts-has-value" : ""}`}
            onClick={() => setShowMarhalaDropdown(!showMarhalaDropdown)}
          >
            <span>{selectedMarhala ? (MARHALA_ARABIC_LABELS[selectedMarhala] || selectedMarhala) : "All Marahil"}</span>
            <ChevronDown size={14} className={`pts-chevron ${showMarhalaDropdown ? "pts-chevron-up" : ""}`} />
          </button>
          {showMarhalaDropdown && (
            <div className="pts-dropdown pts-marhala-dropdown">
              <button className="pts-dropdown-item" onClick={() => handleMarhalaChange("")}>
                <span className="pts-dropdown-label">All Marahil</span>
              </button>
              {MARHALA_OPTIONS.map((m) => (
                <button
                  key={m}
                  className={`pts-dropdown-item ${selectedMarhala === m ? "pts-active" : ""}`}
                  onClick={() => handleMarhalaChange(m)}
                >
                  <span className="pts-dropdown-label">{MARHALA_ARABIC_LABELS[m] || m}</span>
                  <span className="pts-dropdown-sub">{m}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ikhtebar Options */}
        {isAdmin && (
          <div className="pts-selector-group" ref={ikhtebarRef}>
            <label className="pts-selector-label">
              <Trophy size={14} />
              Ikhtebar
            </label>
            <button
              className={`pts-premium-select ${selectedIkhtebar ? "pts-has-value" : ""}`}
              onClick={() => setShowIkhtebarOptions(!showIkhtebarOptions)}
            >
              <span>{selectedIkhtebar ? IKHTEBAR_OPTIONS.find(o => o.value === selectedIkhtebar)?.label : "Create Ikhtebar"}</span>
              <ChevronDown size={14} className={`pts-chevron ${showIkhtebarOptions ? "pts-chevron-up" : ""}`} />
            </button>
            {showIkhtebarOptions && (
              <div className="pts-dropdown pts-ikhtebar-dropdown">
                {IKHTEBAR_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      className={`pts-dropdown-item ${selectedIkhtebar === opt.value ? "pts-active" : ""}`}
                      onClick={() => handleIkhtebarSelect(opt)}
                    >
                      <Icon size={16} className="pts-dropdown-icon" />
                      <span className="pts-dropdown-label">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Task List ─── */}
      <div className="pts-task-list">
        {localSchedule.length === 0 ? (
          <div className="pts-empty">
            <Calendar size={40} />
            <p>No tasks scheduled for today</p>
            <span>Schedule tasks will appear here</span>
          </div>
        ) : (
          localSchedule.map((item, index) => {
            const isExpanded = expandedTask === index;
            const isEditingBody = bodyEditId === index;
            const showRescheduleFor = showReschedule === index;

            return (
              <div
                key={`${item.task_name || "task"}-${index}`}
                className={`pts-task-card ${item.is_done ? "pts-task-done" : ""} ${isExpanded ? "pts-task-expanded" : ""}`}
              >
                <div className="pts-task-main" onClick={() => setExpandedTask(isExpanded ? null : index)}>
                  {/* Status Indicator */}
                  <button
                    className={`pts-task-status ${item.is_done ? "pts-status-done" : "pts-status-pending"}`}
                    onClick={(e) => { e.stopPropagation(); handleToggleDone(index); }}
                    title={item.is_done ? "Mark as Pending" : "Mark as Done"}
                  >
                    {item.is_done ? (
                      <CheckCircle size={18} className="pts-check-icon" />
                    ) : (
                      <div className="pts-pending-ring">
                        <div className="pts-pending-dot" />
                      </div>
                    )}
                  </button>

                  {/* Task Info */}
                  <div className="pts-task-info">
                    <div className="pts-task-header-row">
                      <h4 className={`pts-task-name ${item.is_done ? "pts-name-done" : ""}`}>
                        {item.task_name || "Untitled Task"}
                      </h4>
                      {item.task_time && (
                        <span className="pts-task-time">
                          <Clock size={12} />
                          {item.task_time}
                        </span>
                      )}
                    </div>
                    {item.task_body && !isEditingBody && (
                      <p className="pts-task-body">{item.task_body}</p>
                    )}
                    {item.is_done && (
                      <span className="pts-done-label">
                        <CheckCircle2 size={12} />
                        Completed
                      </span>
                    )}
                  </div>

                  {/* Expand Indicator */}
                  <ChevronDown
                    size={16}
                    className={`pts-expand-icon ${isExpanded ? "pts-expanded" : ""}`}
                  />
                </div>

                {/* ─── Expanded Panel ─── */}
                {isExpanded && (
                  <div className="pts-task-details">
                    <div className="pts-details-divider" />
                    
                    {/* Body Edit (admin) */}
                    {isAdmin && (
                      <div className="pts-detail-row">
                        <label className="pts-detail-label">
                          <Edit3 size={13} />
                          Message Body
                        </label>
                        {isEditingBody ? (
                          <div className="pts-body-edit">
                            <textarea
                              className="pts-body-textarea"
                              value={bodyEditValue}
                              onChange={(e) => setBodyEditValue(e.target.value)}
                              placeholder="Type the schedule message for parents..."
                              rows={3}
                            />
                            <div className="pts-body-actions">
                              <button
                                className="pts-btn pts-btn-save"
                                onClick={() => handleSaveBody(index)}
                              >
                                <Save size={14} />
                                Save
                              </button>
                              <button
                                className="pts-btn pts-btn-cancel"
                                onClick={() => { setBodyEditId(null); setBodyEditValue(""); }}
                              >
                                <X size={14} />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="pts-body-display">
                            <p className="pts-body-text">
                              {item.task_body || "No message added yet. Click to write a message for parents."}
                            </p>
                            <button
                              className="pts-btn pts-btn-edit-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBodyEditId(index);
                                setBodyEditValue(item.task_body || "");
                              }}
                            >
                              <Edit3 size={13} />
                              {item.task_body ? "Edit" : "Add Message"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Body Display (parent) */}
                    {!isAdmin && item.task_body && (
                      <div className="pts-detail-row">
                        <label className="pts-detail-label">
                          <BookOpen size={13} />
                          Message
                        </label>
                        <div className="pts-parent-body-display">
                          <p>{item.task_body}</p>
                        </div>
                      </div>
                    )}

                    {/* Reschedule */}
                    <div className="pts-detail-row">
                      <label className="pts-detail-label">
                        <RotateCw size={13} />
                        Reschedule
                      </label>
                      {showRescheduleFor ? (
                        <div className="pts-reschedule-form">
                          <input
                            type="date"
                            className="pts-date-input"
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            min={getTodayISO()}
                          />
                          <button
                            className="pts-btn pts-btn-gold"
                            onClick={() => handleReschedule(index)}
                            disabled={!rescheduleDate}
                          >
                            <ArrowRight size={14} />
                            Move
                          </button>
                          <button
                            className="pts-btn pts-btn-cancel"
                            onClick={() => { setShowReschedule(null); setRescheduleDate(""); }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="pts-btn pts-btn-outline"
                          onClick={(e) => { e.stopPropagation(); setShowReschedule(index); }}
                        >
                          <RotateCw size={13} />
                          Reschedule
                        </button>
                      )}
                    </div>

                    {/* Send Notification (admin) */}
                    {isAdmin && onSendNotification && (
                      <div className="pts-detail-row pts-detail-actions">
                        <button
                          className="pts-btn pts-btn-gold pts-btn-send"
                          onClick={() => onSendNotification(item)}
                        >
                          <Send size={14} />
                          Send Notification
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ─── Footer Summary ─── */}
      {totalTasks > 0 && (
        <div className="pts-footer">
          <div className="pts-footer-stat">
            <Sun size={14} />
            <span>{doneTasks} done</span>
          </div>
          <div className="pts-footer-stat">
            <Moon size={14} />
            <span>{totalTasks - doneTasks} pending</span>
          </div>
          <div className="pts-footer-stat pts-footer-day">
            <Calendar size={14} />
            <span>{today.short}</span>
          </div>
        </div>
      )}
    </div>
  );
}
