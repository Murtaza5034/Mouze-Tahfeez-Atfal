import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./StaffProfilePermissionsManager.css";
import {
  PROFILE_FIELDS_CONFIG,
  DEFAULT_GLOBAL_PERMISSIONS,
  getCachedPermissions,
  saveProfilePermissions,
  subscribeProfilePermissions,
  normalizeTeacherKey,
  resolveTeacherPermissions,
} from "../utils/teacherProfilePermissions.js";
import {
  ShieldCheck,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Users,
  UserCheck,
  Sparkles,
  Info,
  User,
  Camera,
  Phone,
  MessageCircle,
  Mail,
  BookOpen,
  Award,
  MapPin,
  ShieldAlert,
} from "lucide-react";

const ICON_MAP = {
  User: User,
  Camera: Camera,
  Phone: Phone,
  MessageCircle: MessageCircle,
  Mail: Mail,
  BookOpen: BookOpen,
  Award: Award,
  MapPin: MapPin,
  ShieldAlert: ShieldAlert,
};

export default function StaffProfilePermissionsManager({
  teachers = [],
  onShowAction,
}) {
  const [activeScope, setActiveScope] = useState("global"); // 'global' | 'specific'
  const [selectedTeacherKey, setSelectedTeacherKey] = useState("");
  const [permissionsState, setPermissionsState] = useState(getCachedPermissions);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Subscribe to real-time updates from Firestore
  useEffect(() => {
    const unsub = subscribeProfilePermissions((latest) => {
      setPermissionsState(latest);
    });
    return () => unsub();
  }, []);

  // Compute effective permissions for the current scope
  const currentPermissions = useMemo(() => {
    if (activeScope === "global") {
      return {
        ...DEFAULT_GLOBAL_PERMISSIONS,
        ...(permissionsState.global || {}),
      };
    }
    // Specific teacher scope
    if (!selectedTeacherKey) {
      return {
        ...DEFAULT_GLOBAL_PERMISSIONS,
        ...(permissionsState.global || {}),
      };
    }
    return resolveTeacherPermissions(permissionsState, selectedTeacherKey);
  }, [activeScope, selectedTeacherKey, permissionsState]);

  // Group fields by category
  const categorizedFields = useMemo(() => {
    const map = {};
    PROFILE_FIELDS_CONFIG.forEach((field) => {
      const cat = field.category || "General";
      if (!map[cat]) map[cat] = [];
      map[cat].push(field);
    });
    return map;
  }, []);

  // Handle single field toggle
  const handleToggle = useCallback(
    (fieldKey) => {
      const currentVal = !!currentPermissions[fieldKey];
      const nextVal = !currentVal;

      setPermissionsState((prev) => {
        if (activeScope === "global") {
          return {
            ...prev,
            global: {
              ...prev.global,
              [fieldKey]: nextVal,
            },
          };
        } else {
          if (!selectedTeacherKey) return prev;
          const currentTeacherOverrides =
            prev.perTeacher?.[selectedTeacherKey] || {};
          return {
            ...prev,
            perTeacher: {
              ...prev.perTeacher,
              [selectedTeacherKey]: {
                ...currentTeacherOverrides,
                [fieldKey]: nextVal,
              },
            },
          };
        }
      });
    },
    [activeScope, selectedTeacherKey, currentPermissions]
  );

  // Preset Handlers
  const handleApplyPreset = useCallback(
    (presetType) => {
      let targetConfig = {};
      if (presetType === "standard") {
        // Safe standard: Name and email locked, contact & bio unlocked
        PROFILE_FIELDS_CONFIG.forEach((f) => {
          targetConfig[f.key] = f.defaultAllowed;
        });
      } else if (presetType === "allowAll") {
        PROFILE_FIELDS_CONFIG.forEach((f) => {
          targetConfig[f.key] = true;
        });
      } else if (presetType === "lockAll") {
        PROFILE_FIELDS_CONFIG.forEach((f) => {
          targetConfig[f.key] = false;
        });
      }

      setPermissionsState((prev) => {
        if (activeScope === "global") {
          return {
            ...prev,
            global: targetConfig,
          };
        } else {
          if (!selectedTeacherKey) return prev;
          return {
            ...prev,
            perTeacher: {
              ...prev.perTeacher,
              [selectedTeacherKey]: targetConfig,
            },
          };
        }
      });

      if (onShowAction) {
        onShowAction("info", `Applied ${presetType} preset to active policy.`);
      }
    },
    [activeScope, selectedTeacherKey, onShowAction]
  );

  // Reset override for specific teacher
  const handleResetSpecificOverride = useCallback(() => {
    if (!selectedTeacherKey) return;
    setPermissionsState((prev) => {
      const copy = { ...(prev.perTeacher || {}) };
      delete copy[selectedTeacherKey];
      return {
        ...prev,
        perTeacher: copy,
      };
    });
    if (onShowAction) {
      onShowAction(
        "success",
        "Teacher specific overrides removed. Now using Global Policy."
      );
    }
  }, [selectedTeacherKey, onShowAction]);

  // Save changes to Firestore
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProfilePermissions({
        global: permissionsState.global,
        perTeacher: permissionsState.perTeacher,
        updatedBy: "Admin",
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
      if (onShowAction) {
        onShowAction(
          "success",
          "Teacher profile field permissions saved and updated in real-time!"
        );
      }
    } catch (err) {
      if (onShowAction) {
        onShowAction("error", "Failed saving permissions: " + err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Unique list of teachers for dropdown
  const teacherOptions = useMemo(() => {
    const list = [];
    const seen = new Set();
    (teachers || []).forEach((t) => {
      const name = t.full_name || t.name;
      const key = normalizeTeacherKey(t.user_id || t.id || name);
      if (name && !seen.has(key)) {
        seen.add(key);
        list.push({
          key,
          id: t.user_id || t.id,
          name,
          role: t.teacher_role || t.portal_role || "Muhaffiz",
        });
      }
    });
    return list;
  }, [teachers]);

  return (
    <div className="staff-perm-container">
      {/* Header */}
      <div className="staff-perm-header">
        <div className="staff-perm-title-group">
          <div className="staff-perm-icon-bubble">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3>Teacher Profile Field Permissions</h3>
            <p>
              Control which profile fields teachers are allowed to edit vs.
              what remains locked by administration.
            </p>
          </div>
        </div>

        {/* Scope Tabs */}
        <div className="staff-perm-scope-tabs">
          <button
            type="button"
            className={`staff-perm-tab-btn ${activeScope === "global" ? "active" : ""}`}
            onClick={() => setActiveScope("global")}
          >
            <Sparkles size={14} /> Global Policy (All Teachers)
          </button>
          <button
            type="button"
            className={`staff-perm-tab-btn ${activeScope === "specific" ? "active" : ""}`}
            onClick={() => setActiveScope("specific")}
          >
            <UserCheck size={14} /> Per-Teacher Custom Overrides
          </button>
        </div>
      </div>

      {/* Teacher Dropdown for Specific Scope */}
      {activeScope === "specific" && (
        <div className="staff-perm-teacher-select-row">
          <label htmlFor="staff-perm-teacher-select">
            <Users size={16} /> Select Teacher:
          </label>
          <select
            id="staff-perm-teacher-select"
            className="staff-perm-teacher-select"
            value={selectedTeacherKey}
            onChange={(e) => setSelectedTeacherKey(e.target.value)}
          >
            <option value="">-- Choose Staff Member to Configure --</option>
            {teacherOptions.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name} ({t.role})
              </option>
            ))}
          </select>
          {selectedTeacherKey && permissionsState.perTeacher?.[selectedTeacherKey] && (
            <button
              type="button"
              className="staff-perm-preset-btn"
              onClick={handleResetSpecificOverride}
              title="Remove custom overrides and restore Global Policy for this teacher"
            >
              <RotateCcw size={13} style={{ display: "inline", marginRight: 4 }} />
              Reset to Global Policy
            </button>
          )}
        </div>
      )}

      {/* Presets & Save Toolbar */}
      <div className="staff-perm-toolbar">
        <div className="staff-perm-presets">
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--soft-brown, #6b5b52)" }}>
            Quick Presets:
          </span>
          <button
            type="button"
            className="staff-perm-preset-btn"
            onClick={() => handleApplyPreset("standard")}
          >
            Standard Safe Policy
          </button>
          <button
            type="button"
            className="staff-perm-preset-btn"
            onClick={() => handleApplyPreset("allowAll")}
          >
            <Unlock size={12} style={{ display: "inline", marginRight: 4 }} />
            Allow All Fields
          </button>
          <button
            type="button"
            className="staff-perm-preset-btn"
            onClick={() => handleApplyPreset("lockAll")}
          >
            <Lock size={12} style={{ display: "inline", marginRight: 4 }} />
            Lock All Fields
          </button>
        </div>

        <button
          type="button"
          className={`staff-perm-save-btn ${justSaved ? "saved" : ""}`}
          onClick={handleSave}
          disabled={isSaving}
        >
          {justSaved ? (
            <>
              <CheckCircle2 size={16} /> Permissions Saved!
            </>
          ) : isSaving ? (
            <>
              <span className="upload-spinner" /> Saving Policy...
            </>
          ) : (
            <>
              <Save size={16} /> Save Permissions
            </>
          )}
        </button>
      </div>

      {/* Matrix Categorized */}
      <div className="staff-perm-matrix">
        {Object.entries(categorizedFields).map(([category, fields]) => (
          <div key={category} className="staff-perm-category-block">
            <div className="staff-perm-category-header">
              <span>{category} Details</span>
              <span className="staff-perm-category-badge">
                {fields.filter((f) => currentPermissions[f.key]).length} of{" "}
                {fields.length} Editable
              </span>
            </div>

            <div className="staff-perm-fields-grid">
              {fields.map((field) => {
                const isAllowed = !!currentPermissions[field.key];
                const IconComponent = ICON_MAP[field.icon] || Info;

                return (
                  <div
                    key={field.key}
                    className={`staff-perm-field-card ${isAllowed ? "allowed" : "locked"}`}
                  >
                    <div className="staff-perm-field-left">
                      <div className="staff-perm-field-icon-wrap">
                        <IconComponent size={18} />
                      </div>
                      <div className="staff-perm-field-text">
                        <h4 className="staff-perm-field-name">{field.label}</h4>
                        <p className="staff-perm-field-desc">
                          {field.description}
                        </p>
                      </div>
                    </div>

                    <div className="staff-perm-switch-wrap">
                      <span
                        className={`staff-perm-status-label ${isAllowed ? "allowed" : "locked"}`}
                      >
                        {isAllowed ? (
                          <>
                            <Unlock size={11} /> Editable
                          </>
                        ) : (
                          <>
                            <Lock size={11} /> Locked
                          </>
                        )}
                      </span>

                      <button
                        type="button"
                        className={`staff-perm-switch ${isAllowed ? "checked" : ""}`}
                        onClick={() => handleToggle(field.key)}
                        aria-label={`Toggle editable permission for ${field.label}`}
                        title={
                          isAllowed
                            ? "Currently editable by teacher. Click to lock."
                            : "Currently locked for teacher. Click to unlock."
                        }
                      >
                        <span className="staff-perm-switch-thumb">
                          {isAllowed ? <Unlock size={12} /> : <Lock size={12} />}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sensitive Admin Protected notice */}
      <div className="staff-perm-admin-notice">
        <Info size={16} />
        <span>
          <strong>Admin-Exclusive Fields:</strong> Teacher Designation, Salary
          per Minute, and Show Salary Card are strictly managed by
          administrators and can never be altered by teachers.
        </span>
      </div>
    </div>
  );
}
