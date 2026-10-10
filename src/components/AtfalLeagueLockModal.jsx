import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import "./AtfalLeagueLockModal.css";
import {
  X,
  Lock,
  Unlock,
  ShieldCheck,
  Calendar,
  Users,
  Sparkles,
  Save,
  Check,
  RotateCcw,
  AlertCircle,
  ChevronRight,
  UserCheck,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import {
  DEFAULT_LEAGUE_LOCK_CONFIG,
  subscribeToLeagueLockConfig,
  saveLeagueLockConfig,
  cleanNorm,
} from "../utils/leagueLockManager";

const MONTHS_LIST = [
  { id: "safar", nameEn: "Safar al-Muzaffar", nameAr: "صفر المظفر (16 - 29)" },
  { id: "rabi1", nameEn: "Rabi al-Awwal", nameAr: "ربيع الاول (1 - 30)" },
  { id: "rabi2", nameEn: "Rabi al-Aakhar", nameAr: "ربيع الآخر (1 - 29)" },
  { id: "jumada1", nameEn: "Jumada al-Ula", nameAr: "جمادى الاولى (1 - 30)" },
  { id: "jumada2", nameEn: "Jumada al-Ukhra", nameAr: "جمادى الاخرى (16 - 29)" },
  { id: "rajab", nameEn: "Rajab al-Asab", nameAr: "رجب الاصب (1 - 15)" },
];

const WEEKS_LIST = [
  { key: "week1", num: 1, label: "Week 1 (الأسبوع ١)", gem: "Emerald" },
  { key: "week2", num: 2, label: "Week 2 (الأسبوع ٢)", gem: "Heart Ruby" },
  { key: "week3", num: 3, label: "Week 3 (الأسبوع ٣)", gem: "Sapphire" },
  { key: "week4", num: 4, label: "Week 4 (الأسبوع ٤)", gem: "Diamond" },
];

export default function AtfalLeagueLockModal({
  isOpen,
  onClose,
  teacherProfiles = [],
  portalAccessList = [],
  isDarkMode = false,
}) {
  const [config, setConfig] = useState(DEFAULT_LEAGUE_LOCK_CONFIG);
  const [activeTab, setActiveTab] = useState("global"); // 'global' | 'individual'
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // Subscribe to real-time config
  useEffect(() => {
    const unsub = subscribeToLeagueLockConfig((latest) => {
      setConfig(latest);
    });
    return () => unsub();
  }, []);

  // Body Scroll Lock & Escape listener when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow || "";
      document.body.style.position = originalPosition || "";
      document.body.style.touchAction = originalTouchAction || "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Build clean list of unique teachers
  const teachersList = useMemo(() => {
    const map = new Map();

    (teacherProfiles || []).forEach((t) => {
      const id = String(t.user_id || t.id || "").trim();
      const name = t.name || t.full_name || t.display_name || "Teacher";
      if (id && !map.has(id)) {
        map.set(id, { id, name, its: t.its || t.its_id || "" });
      }
    });

    (portalAccessList || []).forEach((p) => {
      const id = String(p.user_id || p.id || "").trim();
      const name = p.name || p.full_name || "Teacher";
      if (id && !map.has(id)) {
        map.set(id, { id, name, its: p.its || p.its_id || "" });
      }
    });

    const arr = Array.from(map.values());
    if (arr.length === 0) {
      return [
        { id: "all_teachers", name: "All Muhaffizeen / Teachers", its: "" },
      ];
    }
    return arr.sort((a, b) =>
      String(a.name || "").trim().localeCompare(String(b.name || "").trim(), undefined, { sensitivity: "base" })
    );
  }, [teacherProfiles, portalAccessList]);

  // Set default selected teacher for individual mode
  useEffect(() => {
    if (!selectedTeacherId && teachersList.length > 0) {
      setSelectedTeacherId(teachersList[0].id);
    }
  }, [teachersList, selectedTeacherId]);

  if (!isOpen) return null;

  // Toggle Global Month Lock
  const handleToggleGlobalMonth = (monthId) => {
    setConfig((prev) => {
      const currentMonth = prev.months?.[monthId] || { locked: false, weeks: {} };
      const nextLocked = !currentMonth.locked;
      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: {
            ...currentMonth,
            locked: nextLocked,
            // If locking entire month, also set all weeks to locked
            weeks: {
              week1: nextLocked ? true : (currentMonth.weeks?.week1 ?? false),
              week2: nextLocked ? true : (currentMonth.weeks?.week2 ?? false),
              week3: nextLocked ? true : (currentMonth.weeks?.week3 ?? false),
              week4: nextLocked ? true : (currentMonth.weeks?.week4 ?? false),
            },
          },
        },
      };
    });
  };

  // Toggle Global Week Lock
  const handleToggleGlobalWeek = (monthId, weekKey) => {
    setConfig((prev) => {
      const currentMonth = prev.months?.[monthId] || { locked: false, weeks: {} };
      const currentWeeks = currentMonth.weeks || {};
      const nextWeekLocked = !currentWeeks[weekKey];

      const newWeeks = {
        ...currentWeeks,
        [weekKey]: nextWeekLocked,
      };

      // If all 4 weeks are locked, month can be marked locked
      const allWeeksLocked = WEEKS_LIST.every((w) => newWeeks[w.key] === true);

      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: {
            ...currentMonth,
            locked: allWeeksLocked,
            weeks: newWeeks,
          },
        },
      };
    });
  };

  // Toggle Individual Teacher Week Lock
  const handleToggleIndividualWeek = (teacherId, monthId, weekKey) => {
    if (!teacherId) return;
    const tKey = String(teacherId).trim().toLowerCase();

    setConfig((prev) => {
      const overrides = { ...(prev.teacherOverrides || {}) };
      const teacherObj = { ...(overrides[tKey] || { months: {} }) };
      const tMonths = { ...(teacherObj.months || {}) };
      const tMonth = { ...(tMonths[monthId] || { weeks: {} }) };
      const tWeeks = { ...(tMonth.weeks || {}) };

      // Global status for reference
      const globalLocked = prev.months?.[monthId]?.weeks?.[weekKey] ?? false;
      const currentVal = typeof tWeeks[weekKey] === "boolean" ? tWeeks[weekKey] : globalLocked;
      const nextVal = !currentVal;

      tWeeks[weekKey] = nextVal;
      tMonth.weeks = tWeeks;
      tMonths[monthId] = tMonth;
      teacherObj.months = tMonths;

      const teacherMeta = teachersList.find((t) => t.id === teacherId);
      teacherObj.teacherName = teacherMeta?.name || "Teacher";
      teacherObj.id = teacherMeta?.id || teacherId;
      teacherObj.user_id = teacherMeta?.id || teacherId;
      teacherObj.its = teacherMeta?.its || "";

      overrides[tKey] = teacherObj;

      // Save under all alias keys for 100% reliable multi-platform lookup
      if (teacherMeta?.its && String(teacherMeta.its).trim()) {
        overrides[String(teacherMeta.its).trim().toLowerCase()] = teacherObj;
      }
      if (teacherMeta?.name) {
        overrides[cleanNorm(teacherMeta.name)] = teacherObj;
        overrides[String(teacherMeta.name).trim().toLowerCase()] = teacherObj;
      }

      return {
        ...prev,
        teacherOverrides: overrides,
      };
    });
  };

  // Quick Preset: Apply Default Past Locked State (Safar, Rabi 1, Rabi 2 W1-W2)
  const handleApplyDefaultPreset = () => {
    setConfig((prev) => ({
      ...prev,
      months: {
        safar: { locked: true, weeks: { week1: true, week2: true, week3: true, week4: true } },
        rabi1: { locked: true, weeks: { week1: true, week2: true, week3: true, week4: true } },
        rabi2: { locked: false, weeks: { week1: true, week2: true, week3: false, week4: false } },
        jumada1: { locked: false, weeks: { week1: false, week2: false, week3: false, week4: false } },
        jumada2: { locked: false, weeks: { week1: false, week2: false, week3: false, week4: false } },
        rajab: { locked: false, weeks: { week1: false, week2: false, week3: false, week4: false } },
      },
    }));
  };

  // Quick Preset: Unlock Everything
  const handleUnlockAll = () => {
    setConfig((prev) => {
      const allOpen = {};
      MONTHS_LIST.forEach((m) => {
        allOpen[m.id] = {
          locked: false,
          weeks: { week1: false, week2: false, week3: false, week4: false },
        };
      });
      return {
        ...prev,
        months: allOpen,
        teacherOverrides: {},
      };
    });
  };

  // Quick Preset: Lock Everything
  const handleLockAll = () => {
    setConfig((prev) => {
      const allLocked = {};
      MONTHS_LIST.forEach((m) => {
        allLocked[m.id] = {
          locked: true,
          weeks: { week1: true, week2: true, week3: true, week4: true },
        };
      });
      return {
        ...prev,
        months: allLocked,
      };
    });
  };

  // Save changes to Firestore
  const handleSave = async () => {
    setIsSaving(true);
    const success = await saveLeagueLockConfig(config);
    setIsSaving(false);
    if (success) {
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`league-lock-modal-backdrop ${isDarkMode ? "dark-theme" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="league-lock-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="league-lock-modal-header">
          <div className="modal-header-left">
            <div className="lock-modal-icon-bubble">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="lock-modal-title">Hifz League Lock & Entry Permissions</h3>
              <p className="lock-modal-sub">
                Control which Islamic months and weeks teachers are allowed to fill or edit.
              </p>
            </div>
          </div>

          <button type="button" className="lock-modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher: Global vs Individual Teacher */}
        <div className="lock-modal-tab-bar">
          <button
            type="button"
            className={`lock-modal-tab ${activeTab === "global" ? "active" : ""}`}
            onClick={() => setActiveTab("global")}
          >
            <Users size={16} />
            <span>Global Permissions (All Teachers)</span>
          </button>

          <button
            type="button"
            className={`lock-modal-tab ${activeTab === "individual" ? "active" : ""}`}
            onClick={() => setActiveTab("individual")}
          >
            <UserCheck size={16} />
            <span>Individual Teacher Overrides</span>
          </button>
        </div>

        {/* Quick Presets Bar (in Global tab) */}
        {activeTab === "global" && (
          <div className="lock-presets-bar">
            <span className="presets-label">
              <Sparkles size={14} /> Quick Presets:
            </span>
            <div className="presets-buttons">
              <button
                type="button"
                className="preset-btn default-preset"
                onClick={handleApplyDefaultPreset}
                title="Lock Safar, Rabi 1, and Rabi 2 Weeks 1-2"
              >
                <Lock size={12} /> Lock Filled Weeks (Safar + Rabi 1 + Rabi 2 W1-W2)
              </button>
              <button
                type="button"
                className="preset-btn open-all"
                onClick={handleUnlockAll}
              >
                <Unlock size={12} /> Unlock All
              </button>
              <button
                type="button"
                className="preset-btn lock-all"
                onClick={handleLockAll}
              >
                <Lock size={12} /> Lock All
              </button>
            </div>
          </div>
        )}

        {/* Individual Teacher Selector (in Individual tab) */}
        {activeTab === "individual" && (
          <div className="individual-teacher-selector-box">
            <label className="teacher-select-label">
              <Users size={15} /> Select Teacher to Override Permissions:
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="teacher-select-dropdown"
            >
              {teachersList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.its ? `(ITS: ${t.its})` : ""}
                </option>
              ))}
            </select>
            <span className="teacher-select-hint">
              💡 Any override set here takes priority for this specific teacher over the global rules.
            </span>
          </div>
        )}

        {/* Month & Week Matrix Grid */}
        <div className="lock-months-matrix">
          {MONTHS_LIST.map((month) => {
            const globalMonth = config.months?.[month.id] || { locked: false, weeks: {} };

            // Check individual teacher state if activeTab === 'individual'
            const tKey = selectedTeacherId ? String(selectedTeacherId).trim().toLowerCase() : null;
            const tOverride = (tKey && config.teacherOverrides?.[tKey]?.months?.[month.id]) || null;

            return (
              <div
                key={month.id}
                className={`month-lock-card ${
                  globalMonth.locked ? "is-month-locked" : "is-month-open"
                }`}
              >
                {/* Month Card Header */}
                <div className="month-lock-card-header">
                  <div className="month-lock-info">
                    <span className="month-ar-title">{month.nameAr}</span>
                    <span className="month-en-title">{month.nameEn}</span>
                  </div>

                  {activeTab === "global" && (
                    <button
                      type="button"
                      className={`month-toggle-btn ${globalMonth.locked ? "locked" : "unlocked"}`}
                      onClick={() => handleToggleGlobalMonth(month.id)}
                    >
                      {globalMonth.locked ? (
                        <>
                          <Lock size={14} /> Month Locked
                        </>
                      ) : (
                        <>
                          <Unlock size={14} /> Month Open
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* 4 Weeks Row */}
                <div className="weeks-lock-grid">
                  {WEEKS_LIST.map((w) => {
                    const isGlobalWeekLocked = globalMonth.locked || globalMonth.weeks?.[w.key] === true;

                    // If individual tab:
                    let isWeekLocked = isGlobalWeekLocked;
                    let isOverridden = false;

                    if (activeTab === "individual") {
                      if (tOverride?.weeks && typeof tOverride.weeks[w.key] === "boolean") {
                        isWeekLocked = tOverride.weeks[w.key];
                        isOverridden = true;
                      } else if (typeof tOverride?.locked === "boolean") {
                        isWeekLocked = tOverride.locked;
                        isOverridden = true;
                      }
                    }

                    return (
                      <button
                        key={w.key}
                        type="button"
                        onClick={() => {
                          if (activeTab === "global") {
                            handleToggleGlobalWeek(month.id, w.key);
                          } else {
                            handleToggleIndividualWeek(selectedTeacherId, month.id, w.key);
                          }
                        }}
                        className={`week-lock-chip ${
                          isWeekLocked ? "is-locked" : "is-open"
                        } ${isOverridden ? "is-overridden" : ""}`}
                        title={
                          isWeekLocked
                            ? `Click to unlock ${w.label}`
                            : `Click to lock ${w.label}`
                        }
                      >
                        <div className="week-lock-chip-top">
                          <span className="week-num-tag">W{w.num}</span>
                          <span className="week-lock-icon">
                            {isWeekLocked ? <Lock size={14} /> : <Unlock size={14} />}
                          </span>
                        </div>
                        <span className="week-chip-status">
                          {isWeekLocked ? "LOCKED" : "OPEN"}
                        </span>
                        {isOverridden && (
                          <span className="overridden-tag">Custom</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="league-lock-modal-footer">
          <div className="footer-status-left">
            {saveToast && (
              <span className="save-toast-msg">
                <CheckCircle2 size={16} /> Permissions saved and live across all devices!
              </span>
            )}
          </div>

          <div className="footer-btns-right">
            <button
              type="button"
              className="lock-modal-cancel-btn"
              onClick={onClose}
              disabled={isSaving}
            >
              Close
            </button>

            <button
              type="button"
              className="lock-modal-save-btn"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>Saving Changes...</>
              ) : (
                <>
                  <Save size={16} /> Save & Apply Permissions
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
