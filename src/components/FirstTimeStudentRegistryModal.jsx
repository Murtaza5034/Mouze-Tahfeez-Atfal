import React, { useState, useRef } from "react";
import { supabase } from "../supabaseClient.js";
import {
  GraduationCap,
  Sparkles,
  User,
  UserCheck,
  Mail,
  Phone,
  Camera,
  BookOpen,
  Layers,
  LogOut,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Hash,
} from "lucide-react";
import "./FirstTimeStudentRegistryModal.css";

export default function FirstTimeStudentRegistryModal({
  user,
  portalRole = "parents",
  onCompleted,
  onLogout,
  showAction,
}) {
  const isKibar = portalRole === "kibar-student";
  const userEmail = user?.email || "";

  // Form State
  const [fullName, setFullName] = useState(
    user?.user_metadata?.full_name || user?.user_metadata?.name || ""
  );
  const [arabicName, setArabicName] = useState("");
  const [its, setIts] = useState(
    user?.user_metadata?.its || user?.user_metadata?.its_number || ""
  );
  const [gender, setGender] = useState("male");
  const [parentEmail, setParentEmail] = useState(userEmail);
  const [whatsappNumber, setWhatsappNumber] = useState(
    user?.user_metadata?.phone || user?.user_metadata?.whatsapp_number || ""
  );
  const [photoUrl, setPhotoUrl] = useState(
    user?.user_metadata?.avatar_url || user?.user_metadata?.photo_url || ""
  );
  const [juz, setJuz] = useState("");
  const [surat, setSurat] = useState("");
  const [groupName, setGroupName] = useState("Ungrouped");

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef(null);

  // Photo Upload
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      if (showAction) showAction("error", "Please select a valid image file.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `student_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { data, error } = await supabase.storage
        .from("child profile pictures")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = await supabase.storage
        .from("child profile pictures")
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        setPhotoUrl(urlData.publicUrl);
        if (showAction) showAction("success", "Photo uploaded successfully!");
      }
    } catch (err) {
      console.error("Photo upload error:", err);
      if (showAction) showAction("error", "Failed to upload photo: " + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!fullName.trim()) {
      if (showAction) showAction("error", "Please enter the student's full name.");
      return;
    }

    if (!its || String(its).trim() === "") {
      if (showAction) showAction("error", "Please enter the ITS number.");
      return;
    }

    setSaving(true);
    try {
      const numericIts = !isNaN(its) ? Number(its) : its;
      const studentId = `std_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const targetTable = isKibar ? "kibar_child_profiles" : "child_profiles";

      const payload = {
        student_id: studentId,
        id: isKibar ? user?.id || studentId : studentId,
        full_name: fullName.trim(),
        name: fullName.trim(),
        arabic_name: arabicName.trim() || null,
        parent_email: (parentEmail || userEmail).trim().toLowerCase(),
        parent_user_id: user?.id || null,
        whatsapp_number: whatsappNumber ? String(whatsappNumber).trim() : null,
        photo_url: photoUrl.trim() || null,
        its: numericIts,
        gender: gender || "male",
        juz: juz.trim() || null,
        surat: surat.trim() || null,
        group_name: groupName.trim() || "Ungrouped",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isKibar) {
        payload.user_id = user?.id || null;
        payload.section = "kibar";
        payload.is_kibar = true;
      }

      // Insert child profile
      const { data: inserted, error: insertError } = await supabase
        .from(targetTable)
        .insert([payload])
        .select()
        .single();

      if (insertError) throw insertError;

      // Also record in kibar_student_profiles if kibar
      if (isKibar) {
        try {
          await supabase.from("kibar_student_profiles").insert([payload]);
        } catch (_) {}
      }

      // Mark registration completed in database and local cache
      try {
        if (user?.id) {
          localStorage.setItem('mauze_reg_done_' + user.id, 'true');
          localStorage.setItem('mauze_first_login_done_' + user.id, 'true');
        }
        if (userEmail) {
          localStorage.setItem('mauze_reg_done_' + userEmail.toLowerCase(), 'true');
          localStorage.setItem('mauze_first_login_done_' + userEmail.toLowerCase(), 'true');
        }
      } catch (_) {}

      // Mark registration completed on user portal access
      if (user?.id) {
        try {
          const regPayload = {
            user_id: user.id,
            portal_role: portalRole,
            is_active: true,
            has_completed_registration: true,
            email: userEmail,
            full_name: fullName.trim(),
            updated_at: new Date().toISOString(),
          };
          await supabase.from("user_portal_access").upsert(regPayload, { onConflict: "user_id" });
          await supabase.from(isKibar ? "kibar_portal_access" : "portal_access").upsert(regPayload, { onConflict: "user_id" });
        } catch (_) {}
      }

      if (showAction) {
        showAction("success", "✨ Student Registered Successfully! Welcome to Mauze Tahfeez.");
      }

      const finalProfile = inserted || payload;
      if (onCompleted) {
        onCompleted(finalProfile);
      }
    } catch (err) {
      console.error("First-time registration error:", err);
      if (showAction) {
        showAction("error", "Registration failed: " + (err.message || "Unknown error"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="first-time-registry-overlay">
      <div className="first-time-registry-card">
        {/* Banner Header */}
        <div className="first-time-registry-banner">
          <div className="first-time-banner-badge">
            <Sparkles size={14} /> Initial Setup • First-Time Registration
          </div>
          <h2>
            <GraduationCap size={28} style={{ color: "#d4af37" }} />
            {isKibar ? "Student Profile Registration" : "Student Registry (تسجيل الطالب)"}
          </h2>
          <p>
            {isKibar
              ? "Welcome to Kibar Tahfeez Portal. Please complete your student profile details to access your portal."
              : "Welcome to Mauze Tahfeez! Please fill in the registration details of your child to activate your parent portal."}
          </p>

          {userEmail && (
            <div className="first-time-user-pill">
              <Mail size={13} style={{ color: "#d4af37" }} />
              <span>Logged in as: <strong>{userEmail}</strong></span>
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="first-time-registry-body">
          <div className="first-time-form-grid">
            {/* Full Name English */}
            <div className="first-time-form-group">
              <label className="first-time-form-label">
                <User size={15} style={{ color: "#d4af37" }} />
                <span>Full Name (English)</span>
                <span className="required-star">*</span>
              </label>
              <input
                type="text"
                className="first-time-input"
                placeholder="e.g. Taher Husain"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            {/* Arabic Name */}
            <div className="first-time-form-group">
              <label className="first-time-form-label">
                <Sparkles size={15} style={{ color: "#d4af37" }} />
                <span>Arabic Name (اسم الطالب)</span>
              </label>
              <input
                type="text"
                className="first-time-input arabic-input"
                placeholder="طاهر حسين"
                value={arabicName}
                onChange={(e) => setArabicName(e.target.value)}
              />
            </div>

            {/* ITS Number */}
            <div className="first-time-form-group">
              <label className="first-time-form-label">
                <Hash size={15} style={{ color: "#d4af37" }} />
                <span>ITS Number</span>
                <span className="required-star">*</span>
              </label>
              <input
                type="text"
                className="first-time-input"
                placeholder="e.g. 30405060"
                value={its}
                onChange={(e) => setIts(e.target.value)}
                required
              />
            </div>

            {/* Gender Toggle */}
            <div className="first-time-form-group">
              <label className="first-time-form-label">
                <UserCheck size={15} style={{ color: "#d4af37" }} />
                <span>Gender</span>
                <span className="required-star">*</span>
              </label>
              <div className="first-time-gender-selector">
                <button
                  type="button"
                  className={`first-time-gender-btn male ${gender === "male" ? "active" : ""}`}
                  onClick={() => setGender("male")}
                >
                  👦 Boy (طالب)
                </button>
                <button
                  type="button"
                  className={`first-time-gender-btn female ${gender === "female" ? "active" : ""}`}
                  onClick={() => setGender("female")}
                >
                  👧 Girl (طالبة)
                </button>
              </div>
            </div>

            {/* Parent Email */}
            <div className="first-time-form-group">
              <label className="first-time-form-label">
                <Mail size={15} style={{ color: "#d4af37" }} />
                <span>Parent Auth Email</span>
                <span className="required-star">*</span>
              </label>
              <input
                type="email"
                className="first-time-input"
                placeholder="parent@example.com"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                required
              />
            </div>

            {/* WhatsApp Number */}
            <div className="first-time-form-group">
              <label className="first-time-form-label">
                <Phone size={15} style={{ color: "#d4af37" }} />
                <span>WhatsApp Contact</span>
              </label>
              <input
                type="tel"
                className="first-time-input"
                placeholder="e.g. 923001234567"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
              />
            </div>

            {/* Photo Box */}
            <div className="first-time-form-group full-width">
              <label className="first-time-form-label">
                <Camera size={15} style={{ color: "#d4af37" }} />
                <span>Student Photo (Optional)</span>
              </label>
              <div className="first-time-photo-box">
                {photoUrl ? (
                  <img src={photoUrl} alt="Preview" className="first-time-photo-preview" />
                ) : (
                  <div className="first-time-photo-placeholder">
                    <User size={26} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                      type="url"
                      className="first-time-input"
                      placeholder="Photo URL or upload below..."
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "12px",
                        border: "1px solid rgba(212, 175, 55, 0.4)",
                        background: "rgba(212, 175, 55, 0.15)",
                        color: "#b8860b",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Camera size={15} />
                      {uploadingPhoto ? "Uploading…" : "Upload Photo"}
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handlePhotoSelect}
                  />
                </div>
              </div>
            </div>

            {/* Current Juz & Surat */}
            <div className="first-time-form-group">
              <label className="first-time-form-label">
                <BookOpen size={15} style={{ color: "#d4af37" }} />
                <span>Current Juz (Optional)</span>
              </label>
              <input
                type="text"
                className="first-time-input"
                placeholder="e.g. 30"
                value={juz}
                onChange={(e) => setJuz(e.target.value)}
              />
            </div>

            <div className="first-time-form-group">
              <label className="first-time-form-label">
                <BookOpen size={15} style={{ color: "#d4af37" }} />
                <span>Current Surat (Optional)</span>
              </label>
              <input
                type="text"
                className="first-time-input"
                placeholder="e.g. Al-Naba"
                value={surat}
                onChange={(e) => setSurat(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="first-time-registry-footer" style={{ marginTop: "24px", marginInline: "-28px", marginBottom: "-24px" }}>
            {onLogout && (
              <button
                type="button"
                className="first-time-logout-btn"
                onClick={onLogout}
                disabled={saving}
              >
                <LogOut size={16} /> Sign in with different account
              </button>
            )}

            <button
              type="submit"
              className="first-time-submit-btn"
              disabled={saving || uploadingPhoto}
            >
              <CheckCircle2 size={18} />
              {saving ? "Saving Registration…" : "Save & Enter Portal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
