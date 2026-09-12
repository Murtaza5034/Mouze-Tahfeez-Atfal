import React, { useState, useEffect, useMemo, useRef } from "react";
import "./TeacherProfileView.css";
import { compressImageToDataUrl } from "../utils/imageUtils.js";
import { supabase } from "../supabaseClient.js";
import { doc, setDoc, getFirestore } from "firebase/firestore";
import { firebaseApp } from "../firebase/config.js";
import {
  getCachedPermissions,
  subscribeProfilePermissions,
  resolveTeacherPermissions,
  PROFILE_FIELDS_CONFIG,
} from "../utils/teacherProfilePermissions.js";
import {
  User,
  Camera,
  Phone,
  MessageCircle,
  Mail,
  BookOpen,
  Award,
  MapPin,
  ShieldAlert,
  Lock,
  Unlock,
  CheckCircle2,
  Users,
  CalendarCheck,
  Sparkles,
  TrendingUp,
  DollarSign,
  Shield,
  Edit3,
  Save,
  Check,
  ChevronRight,
  HelpCircle,
} from "lucide-react";

function resolveTeacherPhoto(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./")
  ) {
    return trimmed;
  }
  const storagePatterns = [
    "child profile pictures/",
    "child_profile_pictures/",
    "profiles/",
    "student-photos/",
    "student_photos/",
    "teacher_photos/",
    "teacher-photos/",
  ];
  if (storagePatterns.some((pattern) => trimmed.startsWith(pattern))) {
    const encodedPath = encodeURIComponent(trimmed);
    return `https://firebasestorage.googleapis.com/v0/b/mawaid-b929a.firebasestorage.app/o/${encodedPath}?alt=media`;
  }
  return trimmed;
}

export default function TeacherProfileView({
  currentUser,
  teacherIdentity,
  teacherProfiles = [],
  portalAccess,
  overviewStudents = [],
  isKibarTeacher = false,
  portalRole = "teacher",
  onShowAction,
  loadPortalData,
}) {
  const [activeTab, setActiveTab] = useState("personal"); // 'personal' | 'academic' | 'halqa' | 'account'
  const [permissionsState, setPermissionsState] = useState(getCachedPermissions);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef(null);

  // Subscribe to real-time field permissions from admin
  useEffect(() => {
    const unsub = subscribeProfilePermissions((latest) => {
      setPermissionsState(latest);
    });
    return () => unsub();
  }, []);

  // Find the canonical teacher profile record
  const matchedTeacher = useMemo(() => {
    const currentUserId = currentUser?.id;
    const currentEmail = currentUser?.email?.toLowerCase();
    const identityNorm = String(teacherIdentity || "").trim().toLowerCase();

    // 1. Try matching by user_id
    let found = teacherProfiles.find(
      (p) =>
        (p.user_id && String(p.user_id) === String(currentUserId)) ||
        (p.id && String(p.id) === String(currentUserId))
    );

    // 2. Try matching by name
    if (!found && identityNorm) {
      found = teacherProfiles.find(
        (p) =>
          p.full_name &&
          p.full_name.trim().toLowerCase() === identityNorm
      );
    }

    // 3. Try matching by email
    if (!found && currentEmail) {
      found = teacherProfiles.find(
        (p) =>
          p.email &&
          p.email.trim().toLowerCase() === currentEmail
      );
    }

    // Fallback to portalAccess or synthetic object
    return (
      found || {
        full_name:
          portalAccess?.full_name ||
          currentUser?.user_metadata?.full_name ||
          teacherIdentity ||
          "Teacher",
        email: currentUser?.email || portalAccess?.email || "",
        phone_number: portalAccess?.phone_number || "",
        whatsapp_number: portalAccess?.whatsapp_number || "",
        photo_url:
          portalAccess?.photo_url ||
          currentUser?.user_metadata?.avatar_url ||
          "/logo.png",
        teacher_role: portalAccess?.portal_role || "muhaffiz",
        user_id: currentUserId,
      }
    );
  }, [currentUser, teacherIdentity, teacherProfiles, portalAccess]);

  // Compute effective field permissions for this specific teacher
  const effectivePermissions = useMemo(() => {
    const idOrName =
      matchedTeacher?.user_id ||
      matchedTeacher?.id ||
      matchedTeacher?.full_name ||
      teacherIdentity;
    return resolveTeacherPermissions(permissionsState, idOrName);
  }, [permissionsState, matchedTeacher, teacherIdentity]);

  // Form draft state
  const [formData, setFormData] = useState({
    full_name: "",
    phone_number: "",
    whatsapp_number: "",
    email: "",
    photo_url: "",
    bio: "",
    qualification: "",
    address: "",
    emergency_contact: "",
  });

  // Populate form with matched data
  useEffect(() => {
    if (matchedTeacher) {
      const uId = String(currentUser?.id || matchedTeacher.user_id || matchedTeacher.id || "");
      const cachedPhoto =
        typeof localStorage !== "undefined" && uId
          ? localStorage.getItem(`mauze_teacher_photo_${uId}`) || ""
          : "";
      const rawPhoto =
        matchedTeacher.photo_url ||
        matchedTeacher.avatar_url ||
        matchedTeacher.photo ||
        matchedTeacher.photoUrl ||
        portalAccess?.photo_url ||
        portalAccess?.avatar_url ||
        currentUser?.user_metadata?.avatar_url ||
        currentUser?.user_metadata?.photo_url ||
        cachedPhoto ||
        "";
      const resolvedPhoto = resolveTeacherPhoto(rawPhoto) || cachedPhoto || "";

      setFormData((prev) => ({
        ...prev,
        full_name: matchedTeacher.full_name || prev.full_name || "",
        phone_number: matchedTeacher.phone_number || prev.phone_number || "",
        whatsapp_number: matchedTeacher.whatsapp_number || prev.whatsapp_number || "",
        email: matchedTeacher.email || currentUser?.email || prev.email || "",
        photo_url: resolvedPhoto || prev.photo_url || "",
        bio: matchedTeacher.bio || matchedTeacher.about || prev.bio || "",
        qualification:
          matchedTeacher.qualification ||
          matchedTeacher.qualifications ||
          prev.qualification ||
          "",
        address: matchedTeacher.address || prev.address || "",
        emergency_contact: matchedTeacher.emergency_contact || prev.emergency_contact || "",
      }));
    }
  }, [matchedTeacher, currentUser, portalAccess]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Strictly verify if field is allowed to be edited
    if (!effectivePermissions[name]) {
      if (onShowAction) {
        onShowAction(
          "error",
          "This field is locked and managed exclusively by the school administration."
        );
      }
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Photo Upload Handler
  const handlePhotoUpload = async (e) => {
    if (!effectivePermissions.photo_url) {
      if (onShowAction) {
        onShowAction("error", "Profile photo is locked by administration.");
      }
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      if (onShowAction) onShowAction("error", "Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      if (onShowAction) onShowAction("error", "Image size must be less than 5MB.");
      return;
    }

    setUploadingPhoto(true);
    try {
      // 1. Fast, high-fidelity client compression
      const compressedDataUrl = await compressImageToDataUrl(file, 380, 0.82);
      let publicUrl = compressedDataUrl;

      // 2. Try cloud storage upload
      try {
        const fileExt = (file.name.split(".").pop() || "jpg")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        const fileName = `teacher_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `teacher-photos/${fileName}`;

        const { data, error } = await supabase.storage
          .from("teacher_photos")
          .upload(filePath, file, { contentType: file.type, upsert: true });

        if (!error && data?.publicUrl) {
          publicUrl = data.publicUrl;
        }
      } catch (cloudErr) {
        console.warn("Storage upload notice, using compressed avatar:", cloudErr);
      }

      setFormData((prev) => ({ ...prev, photo_url: publicUrl }));

      // 3. Immediately persist to database and local cache so it appears everywhere
      try {
        const targetTable = isKibarTeacher
          ? "kibar_teacher_profiles"
          : "teacher_profiles";
        const targetId =
          matchedTeacher?.id ||
          matchedTeacher?.user_id ||
          currentUser?.id;

        if (targetId) {
          await supabase
            .from(targetTable)
            .update({ photo_url: publicUrl })
            .eq("id", targetId);
          if (matchedTeacher?.user_id) {
            await supabase
              .from(targetTable)
              .update({ photo_url: publicUrl })
              .eq("user_id", matchedTeacher.user_id);
          }
        }
        if (currentUser?.id) {
          localStorage.setItem(`mauze_teacher_photo_${currentUser.id}`, publicUrl);
        }
        if (typeof loadPortalData === "function") {
          loadPortalData(portalRole, currentUser, null, { silent: true });
        }
      } catch (saveErr) {
        console.warn("Immediate photo update notice:", saveErr);
      }

      if (onShowAction) {
        onShowAction("success", "Profile photo uploaded and saved successfully!");
      }
    } catch (err) {
      console.warn("Upload warning:", err);
      if (onShowAction) {
        onShowAction("error", "Failed to upload photo: " + err.message);
      }
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Save changes handler
  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    setIsSaving(true);

    try {
      const targetTable = isKibarTeacher
        ? "kibar_teacher_profiles"
        : "teacher_profiles";

      const targetId =
        matchedTeacher?.id ||
        matchedTeacher?.user_id ||
        currentUser?.id ||
        "staff_" + (formData.full_name || "teacher").replace(/[^a-zA-Z0-9]/g, "_");

      // Filter only allowed editable fields to prevent any client-side spoofing
      const updates = {};
      if (effectivePermissions.full_name && formData.full_name) {
        updates.full_name = formData.full_name.trim();
      }
      if (effectivePermissions.phone_number) {
        updates.phone_number = formData.phone_number.trim();
      }
      if (effectivePermissions.whatsapp_number) {
        updates.whatsapp_number = formData.whatsapp_number.trim();
      }
      if (effectivePermissions.photo_url && formData.photo_url) {
        updates.photo_url = formData.photo_url.trim();
      }
      if (effectivePermissions.email && formData.email) {
        updates.email = formData.email.trim();
      }

      // 1. Update core table in Supabase
      if (Object.keys(updates).length > 0) {
        await supabase
          .from(targetTable)
          .update(updates)
          .eq("id", targetId);

        if (matchedTeacher?.user_id) {
          await supabase
            .from(targetTable)
            .update(updates)
            .eq("user_id", matchedTeacher.user_id);
        }
      }

      // 2. Persist extended profile data into Firestore
      try {
        const db = getFirestore(firebaseApp);
        const docRef = doc(db, targetTable, String(targetId));
        await setDoc(
          docRef,
          {
            ...updates,
            bio: formData.bio || "",
            qualification: formData.qualification || "",
            address: formData.address || "",
            emergency_contact: formData.emergency_contact || "",
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (fErr) {
        console.warn("Firestore extended sync notice:", fErr);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);

      if (onShowAction) {
        onShowAction("success", "Your profile has been updated successfully!");
      }

      if (typeof loadPortalData === "function") {
        loadPortalData(portalRole, currentUser, null, { silent: true });
      }
    } catch (err) {
      console.error("Save error:", err);
      if (onShowAction) {
        onShowAction("error", "Could not save profile: " + err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Metrics for the ribbons
  const totalStudents = overviewStudents.length;
  const markedResultsCount = overviewStudents.filter((s) => s.latestResult).length;
  const resultCompletionRate =
    totalStudents > 0
      ? Math.round((markedResultsCount / totalStudents) * 100)
      : 0;

  const showSalary = !!matchedTeacher?.show_salary_card;
  const salaryRate = matchedTeacher?.salary_per_minute || "2.3";

  return (
    <div className="teacher-pv-wrapper">
      {/* ─── Hero Profile Header Card ─── */}
      <div className="teacher-pv-hero-card">
        <div className="teacher-pv-hero-banner" />
        <div className="teacher-pv-hero-body">
          <div className="teacher-pv-avatar-wrap">
            {formData.photo_url ? (
              <img
                src={formData.photo_url}
                alt={formData.full_name}
                className="teacher-pv-avatar"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  const uId = String(currentUser?.id || matchedTeacher?.user_id || matchedTeacher?.id || "");
                  const cached = typeof localStorage !== "undefined" && uId ? localStorage.getItem(`mauze_teacher_photo_${uId}`) : "";
                  if (cached && e.currentTarget.src !== cached) {
                    e.currentTarget.src = cached;
                  } else {
                    e.currentTarget.src = isKibarTeacher ? "/kibar-logo.png" : "/logo.png";
                  }
                }}
              />
            ) : (
              <div className="teacher-pv-avatar-placeholder">
                {(formData.full_name || "T").charAt(0).toUpperCase()}
              </div>
            )}

            {/* Photo upload action or lock badge */}
            {effectivePermissions.photo_url ? (
              <label
                className="teacher-pv-avatar-upload-btn"
                title="Change profile picture (Allowed)"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                />
                {uploadingPhoto ? (
                  <span className="upload-spinner" />
                ) : (
                  <Camera size={18} />
                )}
              </label>
            ) : (
              <div
                className="teacher-pv-avatar-locked-badge"
                title="Profile photo is locked by administration"
              >
                <Lock size={15} />
              </div>
            )}
          </div>

          <div className="teacher-pv-hero-details">
            <div className="teacher-pv-name-row">
              <h2>{formData.full_name || "Teacher"}</h2>
              {matchedTeacher?.arabic_name && (
                <span className="teacher-pv-arabic-name">
                  {matchedTeacher.arabic_name}
                </span>
              )}
            </div>

            <div className="teacher-pv-badges">
              <span className="teacher-pv-badge role">
                <Sparkles size={13} />
                {(matchedTeacher?.teacher_role || "Muhaffiz").toUpperCase()}
              </span>
              <span className="teacher-pv-badge section">
                <Shield size={13} />
                {isKibarTeacher ? "Tahfeez al Kibar" : "Mauze Tahfeez"}
              </span>
              {matchedTeacher?.user_id && (
                <span className="teacher-pv-badge its">
                  ID: {String(matchedTeacher.user_id).substring(0, 10)}
                </span>
              )}
            </div>
          </div>

          <div className="teacher-pv-hero-actions">
            <button
              type="button"
              className="teacher-pv-action-btn primary"
              onClick={() => setActiveTab("personal")}
            >
              <Edit3 size={16} /> Edit Profile
            </button>
            <button
              type="button"
              className="teacher-pv-action-btn secondary"
              onClick={() => setActiveTab("halqa")}
            >
              <Users size={16} /> My Halqa
            </button>
          </div>
        </div>
      </div>

      {/* ─── Key Stats Ribbon ─── */}
      <div className="teacher-pv-stats-ribbon">
        <div className="teacher-pv-stat-card">
          <div className="teacher-pv-stat-icon gold">
            <Users size={22} />
          </div>
          <div>
            <h4 className="teacher-pv-stat-value">{totalStudents}</h4>
            <p className="teacher-pv-stat-label">Assigned Students</p>
          </div>
        </div>

        <div className="teacher-pv-stat-card">
          <div className="teacher-pv-stat-icon emerald">
            <TrendingUp size={22} />
          </div>
          <div>
            <h4 className="teacher-pv-stat-value">{resultCompletionRate}%</h4>
            <p className="teacher-pv-stat-label">Progress Marked</p>
          </div>
        </div>

        <div className="teacher-pv-stat-card">
          <div className="teacher-pv-stat-icon blue">
            <CalendarCheck size={22} />
          </div>
          <div>
            <h4 className="teacher-pv-stat-value">Active</h4>
            <p className="teacher-pv-stat-label">Faculty Status</p>
          </div>
        </div>

        {showSalary && (
          <div className="teacher-pv-stat-card">
            <div className="teacher-pv-stat-icon purple">
              <DollarSign size={22} />
            </div>
            <div>
              <h4 className="teacher-pv-stat-value">Rs. {salaryRate}</h4>
              <p className="teacher-pv-stat-label">Per Minute Rate</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Tabs Navigation Bar ─── */}
      <div className="teacher-pv-tabs-bar">
        <button
          type="button"
          className={`teacher-pv-tab-btn ${activeTab === "personal" ? "active" : ""}`}
          onClick={() => setActiveTab("personal")}
        >
          <User size={16} /> Personal & Contact
        </button>
        <button
          type="button"
          className={`teacher-pv-tab-btn ${activeTab === "academic" ? "active" : ""}`}
          onClick={() => setActiveTab("academic")}
        >
          <BookOpen size={16} /> Academic & Sanad
        </button>
        <button
          type="button"
          className={`teacher-pv-tab-btn ${activeTab === "halqa" ? "active" : ""}`}
          onClick={() => setActiveTab("halqa")}
        >
          <Users size={16} /> My Halqa ({totalStudents})
        </button>
        <button
          type="button"
          className={`teacher-pv-tab-btn ${activeTab === "account" ? "active" : ""}`}
          onClick={() => setActiveTab("account")}
        >
          <Shield size={16} /> Account & Role
        </button>
      </div>

      {/* ─── Tab Content ─── */}
      <form onSubmit={handleSaveProfile}>
        {/* Tab 1: Personal & Contact */}
        {activeTab === "personal" && (
          <div className="teacher-pv-tab-panel">
            <div className="teacher-pv-panel-header">
              <div>
                <h3>
                  <User size={20} color="#c9a24d" /> Personal & Contact Details
                </h3>
                <p>
                  Fields marked with a lock icon are managed exclusively by the
                  administration.
                </p>
              </div>
            </div>

            <div className="teacher-pv-fields-grid">
              {/* Full Name */}
              <div className="teacher-pv-field-block">
                <div className="teacher-pv-field-header">
                  <label className="teacher-pv-field-label">
                    <User size={15} /> Full Name
                  </label>
                  <span
                    className={`teacher-pv-perm-chip ${effectivePermissions.full_name ? "editable" : "locked"}`}
                  >
                    {effectivePermissions.full_name ? (
                      <>
                        <Unlock size={11} /> Editable
                      </>
                    ) : (
                      <>
                        <Lock size={11} /> Locked by Admin
                      </>
                    )}
                  </span>
                </div>
                <div className="teacher-pv-input-wrap">
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    disabled={!effectivePermissions.full_name}
                    className={`teacher-pv-input ${!effectivePermissions.full_name ? "disabled" : ""}`}
                    placeholder="Full Legal Name"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="teacher-pv-field-block">
                <div className="teacher-pv-field-header">
                  <label className="teacher-pv-field-label">
                    <Mail size={15} /> Email Address
                  </label>
                  <span
                    className={`teacher-pv-perm-chip ${effectivePermissions.email ? "editable" : "locked"}`}
                  >
                    {effectivePermissions.email ? (
                      <>
                        <Unlock size={11} /> Editable
                      </>
                    ) : (
                      <>
                        <Lock size={11} /> Locked by Admin
                      </>
                    )}
                  </span>
                </div>
                <div className="teacher-pv-input-wrap">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={!effectivePermissions.email}
                    className={`teacher-pv-input ${!effectivePermissions.email ? "disabled" : ""}`}
                    placeholder="teacher@example.com"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="teacher-pv-field-block">
                <div className="teacher-pv-field-header">
                  <label className="teacher-pv-field-label">
                    <Phone size={15} /> Phone Number
                  </label>
                  <span
                    className={`teacher-pv-perm-chip ${effectivePermissions.phone_number ? "editable" : "locked"}`}
                  >
                    {effectivePermissions.phone_number ? (
                      <>
                        <Unlock size={11} /> Editable
                      </>
                    ) : (
                      <>
                        <Lock size={11} /> Locked by Admin
                      </>
                    )}
                  </span>
                </div>
                <div className="teacher-pv-input-wrap">
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    disabled={!effectivePermissions.phone_number}
                    className={`teacher-pv-input ${!effectivePermissions.phone_number ? "disabled" : ""}`}
                    placeholder="+92 300 1234567"
                  />
                  {formData.phone_number && (
                    <a
                      href={`tel:${formData.phone_number}`}
                      className="teacher-pv-field-action-btn"
                      title="Direct Call"
                    >
                      <Phone size={12} /> Call
                    </a>
                  )}
                </div>
              </div>

              {/* WhatsApp Number */}
              <div className="teacher-pv-field-block">
                <div className="teacher-pv-field-header">
                  <label className="teacher-pv-field-label">
                    <MessageCircle size={15} /> WhatsApp Number
                  </label>
                  <span
                    className={`teacher-pv-perm-chip ${effectivePermissions.whatsapp_number ? "editable" : "locked"}`}
                  >
                    {effectivePermissions.whatsapp_number ? (
                      <>
                        <Unlock size={11} /> Editable
                      </>
                    ) : (
                      <>
                        <Lock size={11} /> Locked by Admin
                      </>
                    )}
                  </span>
                </div>
                <div className="teacher-pv-input-wrap">
                  <input
                    type="text"
                    name="whatsapp_number"
                    value={formData.whatsapp_number}
                    onChange={handleInputChange}
                    disabled={!effectivePermissions.whatsapp_number}
                    className={`teacher-pv-input ${!effectivePermissions.whatsapp_number ? "disabled" : ""}`}
                    placeholder="923001234567"
                  />
                  {formData.whatsapp_number && (
                    <a
                      href={`https://wa.me/${formData.whatsapp_number.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="teacher-pv-field-action-btn"
                      title="Open WhatsApp Chat"
                    >
                      <MessageCircle size={12} /> Chat
                    </a>
                  )}
                </div>
              </div>

              {/* Residential Address */}
              <div className="teacher-pv-field-block full-width">
                <div className="teacher-pv-field-header">
                  <label className="teacher-pv-field-label">
                    <MapPin size={15} /> Residential Address & City
                  </label>
                  <span
                    className={`teacher-pv-perm-chip ${effectivePermissions.address ? "editable" : "locked"}`}
                  >
                    {effectivePermissions.address ? (
                      <>
                        <Unlock size={11} /> Editable
                      </>
                    ) : (
                      <>
                        <Lock size={11} /> Locked by Admin
                      </>
                    )}
                  </span>
                </div>
                <div className="teacher-pv-input-wrap">
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    disabled={!effectivePermissions.address}
                    className={`teacher-pv-input ${!effectivePermissions.address ? "disabled" : ""}`}
                    placeholder="e.g. Saddar, Karachi"
                  />
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="teacher-pv-field-block full-width">
                <div className="teacher-pv-field-header">
                  <label className="teacher-pv-field-label">
                    <ShieldAlert size={15} /> Emergency Contact Details
                  </label>
                  <span
                    className={`teacher-pv-perm-chip ${effectivePermissions.emergency_contact ? "editable" : "locked"}`}
                  >
                    {effectivePermissions.emergency_contact ? (
                      <>
                        <Unlock size={11} /> Editable
                      </>
                    ) : (
                      <>
                        <Lock size={11} /> Locked by Admin
                      </>
                    )}
                  </span>
                </div>
                <div className="teacher-pv-input-wrap">
                  <input
                    type="text"
                    name="emergency_contact"
                    value={formData.emergency_contact}
                    onChange={handleInputChange}
                    disabled={!effectivePermissions.emergency_contact}
                    className={`teacher-pv-input ${!effectivePermissions.emergency_contact ? "disabled" : ""}`}
                    placeholder="Name, Relationship & Phone number"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Academic & Sanad */}
        {activeTab === "academic" && (
          <div className="teacher-pv-tab-panel">
            <div className="teacher-pv-panel-header">
              <div>
                <h3>
                  <Award size={20} color="#c9a24d" /> Academic Credentials &
                  Statement
                </h3>
                <p>
                  Share your Hifz certification, sanad, tajweed achievements and
                  teaching philosophy.
                </p>
              </div>
            </div>

            <div className="teacher-pv-fields-grid">
              {/* Qualifications */}
              <div className="teacher-pv-field-block full-width">
                <div className="teacher-pv-field-header">
                  <label className="teacher-pv-field-label">
                    <Award size={15} /> Sanad & Qualifications
                  </label>
                  <span
                    className={`teacher-pv-perm-chip ${effectivePermissions.qualification ? "editable" : "locked"}`}
                  >
                    {effectivePermissions.qualification ? (
                      <>
                        <Unlock size={11} /> Editable
                      </>
                    ) : (
                      <>
                        <Lock size={11} /> Locked by Admin
                      </>
                    )}
                  </span>
                </div>
                <div className="teacher-pv-input-wrap">
                  <textarea
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleInputChange}
                    disabled={!effectivePermissions.qualification}
                    className={`teacher-pv-textarea ${!effectivePermissions.qualification ? "disabled" : ""}`}
                    placeholder="e.g. Hafiz al-Quran (Year), Sanad in Hafs 'an Asim, Al-Jamea tus Saifiyah graduate..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Bio / Teaching Statement */}
              <div className="teacher-pv-field-block full-width">
                <div className="teacher-pv-field-header">
                  <label className="teacher-pv-field-label">
                    <BookOpen size={15} /> Bio & Teaching Philosophy
                  </label>
                  <span
                    className={`teacher-pv-perm-chip ${effectivePermissions.bio ? "editable" : "locked"}`}
                  >
                    {effectivePermissions.bio ? (
                      <>
                        <Unlock size={11} /> Editable
                      </>
                    ) : (
                      <>
                        <Lock size={11} /> Locked by Admin
                      </>
                    )}
                  </span>
                </div>
                <div className="teacher-pv-input-wrap">
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    disabled={!effectivePermissions.bio}
                    className={`teacher-pv-textarea ${!effectivePermissions.bio ? "disabled" : ""}`}
                    placeholder="Write a brief statement about your Tahfeez guidance and journey with atfal..."
                    rows={4}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: My Halqa (Students Roster) */}
        {activeTab === "halqa" && (
          <div className="teacher-pv-tab-panel">
            <div className="teacher-pv-panel-header">
              <div>
                <h3>
                  <Users size={20} color="#c9a24d" /> Assigned Halqa Students
                </h3>
                <p>
                  Current students assigned under your direct Tahfeez supervision
                  ({overviewStudents.length} total).
                </p>
              </div>
            </div>

            <div className="teacher-pv-students-grid">
              {overviewStudents.map((student) => (
                <div
                  key={student.student_id || student.id}
                  className="teacher-pv-student-card"
                >
                  <img
                    src={student.photoUrl || student.photo_url || "/logo.png"}
                    alt={student.name || student.full_name}
                    className="teacher-pv-student-avatar"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/logo.png";
                    }}
                  />
                  <div className="teacher-pv-student-info">
                    <h5 className="teacher-pv-student-name">
                      {student.name || student.full_name}
                    </h5>
                    <div className="teacher-pv-student-meta">
                      <span>Juz: {student.hifz?.juz || "—"}</span>
                      <span>•</span>
                      <span>Surat: {student.hifz?.surat || "—"}</span>
                    </div>
                  </div>
                </div>
              ))}
              {overviewStudents.length === 0 && (
                <p style={{ color: "var(--soft-brown, #786960)", padding: "16px" }}>
                  No students currently assigned to this Halqa.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Account & Role */}
        {activeTab === "account" && (
          <div className="teacher-pv-tab-panel">
            <div className="teacher-pv-panel-header">
              <div>
                <h3>
                  <Shield size={20} color="#c9a24d" /> Account & System
                  Privileges
                </h3>
                <p>
                  System roles, login identifiers and administrative settings.
                </p>
              </div>
            </div>

            <div className="teacher-pv-fields-grid">
              <div className="teacher-pv-field-block">
                <label className="teacher-pv-field-label">Portal Role</label>
                <input
                  type="text"
                  value={portalRole.toUpperCase()}
                  disabled
                  className="teacher-pv-input disabled"
                />
              </div>

              <div className="teacher-pv-field-block">
                <label className="teacher-pv-field-label">Designation</label>
                <input
                  type="text"
                  value={(matchedTeacher?.teacher_role || "Muhaffiz").toUpperCase()}
                  disabled
                  className="teacher-pv-input disabled"
                />
              </div>

              <div className="teacher-pv-field-block">
                <label className="teacher-pv-field-label">User ID (Auth)</label>
                <input
                  type="text"
                  value={currentUser?.id || "—"}
                  disabled
                  className="teacher-pv-input disabled"
                />
              </div>

              <div className="teacher-pv-field-block">
                <label className="teacher-pv-field-label">Primary Login Email</label>
                <input
                  type="text"
                  value={currentUser?.email || "—"}
                  disabled
                  className="teacher-pv-input disabled"
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit Bar */}
        {(activeTab === "personal" || activeTab === "academic") && (
          <div className="teacher-pv-footer-bar">
            <button
              type="submit"
              disabled={isSaving}
              className={`teacher-pv-save-btn ${saveSuccess ? "success" : ""}`}
            >
              {saveSuccess ? (
                <>
                  <Check size={18} /> Changes Saved Successfully!
                </>
              ) : isSaving ? (
                <>
                  <span className="upload-spinner" /> Saving Updates...
                </>
              ) : (
                <>
                  <Save size={18} /> Save Profile Changes
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
