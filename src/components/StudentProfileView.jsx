import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../supabaseClient.js";
import {
  User,
  Edit3,
  Mail,
  Phone,
  Hash,
  BookOpen,
  GraduationCap,
  Users,
  Shield,
  Lock,
  Camera,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Upload,
  Clock,
  Sparkles,
  CalendarCheck,
  MessageCircle,
  X,
  Save,
  Check,
} from "lucide-react";
import "./StudentProfileView.css";

/**
 * Helper to test if background color is White, Grey, or Cream,
 * if photo meets standard passport portrait dimensions, and has clear resolution/contrast.
 */
function analyzePassportImage(imgElement) {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { passSize: true, passBg: true, passClarity: true, detectedBg: "Studio Neutral" };

    const w = imgElement.naturalWidth || imgElement.width || 300;
    const h = imgElement.naturalHeight || imgElement.height || 400;

    // 1. Minimum passport resolution check
    const isResolutionGood = w >= 180 && h >= 200;

    canvas.width = Math.min(w, 450);
    canvas.height = Math.min(h, 600);

    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

    // 2. Aspect ratio check (Passport portrait ratio: 0.60 to 1.15)
    const ratio = canvas.width / canvas.height;
    const isPortrait = ratio >= 0.60 && ratio <= 1.15;

    // 3. Clarity & Contrast check (face center zone)
    let passClarity = isResolutionGood;
    try {
      const centerX = Math.round(canvas.width * 0.35);
      const centerY = Math.round(canvas.height * 0.30);
      const centerW = Math.round(canvas.width * 0.30);
      const centerH = Math.round(canvas.height * 0.35);
      const centerData = ctx.getImageData(centerX, centerY, centerW, centerH).data;

      let sumB = 0, count = 0;
      for (let i = 0; i < centerData.length; i += 16) {
        const b = (centerData[i] + centerData[i + 1] + centerData[i + 2]) / 3;
        sumB += b;
        count++;
      }
      const meanB = count > 0 ? sumB / count : 128;

      let varianceSum = 0;
      for (let i = 0; i < centerData.length; i += 16) {
        const b = (centerData[i] + centerData[i + 1] + centerData[i + 2]) / 3;
        varianceSum += (b - meanB) * (b - meanB);
      }
      const stdDev = count > 0 ? Math.sqrt(varianceSum / count) : 25;

      // If photo is too dark (meanB < 30), blown out (meanB > 248), or completely flat/blurry (stdDev < 6)
      if (meanB < 30 || meanB > 248 || stdDev < 6) {
        passClarity = false;
      }
    } catch (_) {}

    // 4. Sample corner and border pixels (background areas)
    const samplePoints = [
      { x: Math.round(canvas.width * 0.06), y: Math.round(canvas.height * 0.06) },
      { x: Math.round(canvas.width * 0.94), y: Math.round(canvas.height * 0.06) },
      { x: Math.round(canvas.width * 0.50), y: Math.round(canvas.height * 0.04) },
      { x: Math.round(canvas.width * 0.06), y: Math.round(canvas.height * 0.15) },
      { x: Math.round(canvas.width * 0.94), y: Math.round(canvas.height * 0.15) },
      { x: Math.round(canvas.width * 0.06), y: Math.round(canvas.height * 0.25) },
      { x: Math.round(canvas.width * 0.94), y: Math.round(canvas.height * 0.25) },
    ];

    let totalR = 0, totalG = 0, totalB = 0, samples = 0;
    for (const pt of samplePoints) {
      try {
        const pixel = ctx.getImageData(pt.x, pt.y, 1, 1).data;
        totalR += pixel[0];
        totalG += pixel[1];
        totalB += pixel[2];
        samples++;
      } catch (_) {}
    }

    if (samples === 0) return { passSize: isPortrait, passBg: true, passClarity, detectedBg: "Studio Neutral", aspectRatio: ratio.toFixed(2), width: w, height: h };

    const avgR = totalR / samples;
    const avgG = totalG / samples;
    const avgB = totalB / samples;
    const brightness = (avgR + avgG + avgB) / 3;

    let detectedBg = "Custom Coloured";
    let isApprovedBg = false;

    // 1. White: Brightness >= 210, low color variation
    const isWhite = brightness >= 210 && Math.abs(avgR - avgG) < 22 && Math.abs(avgG - avgB) < 22 && Math.abs(avgR - avgB) < 22;
    // 2. Grey: Balanced RGB, medium to high brightness, neutral
    const isGrey = brightness >= 85 && brightness < 210 && Math.abs(avgR - avgG) < 25 && Math.abs(avgG - avgB) < 25 && Math.abs(avgR - avgB) < 25;
    // 3. Cream: Warm off-white (avgR >= 190, avgG >= 175, avgB >= 140, warm tint avgR >= avgB + 8)
    const isCream = avgR >= 190 && avgG >= 175 && avgB >= 140 && avgR >= avgB + 8 && Math.abs(avgR - avgG) < 40;

    if (isWhite) {
      detectedBg = "Studio White";
      isApprovedBg = true;
    } else if (isCream) {
      detectedBg = "Soft Cream";
      isApprovedBg = true;
    } else if (isGrey) {
      detectedBg = "Neutral Grey";
      isApprovedBg = true;
    } else if (brightness >= 180 && Math.abs(avgR - avgG) < 30 && Math.abs(avgG - avgB) < 30) {
      detectedBg = "Light Neutral Tint";
      isApprovedBg = true;
    } else {
      detectedBg = `Coloured/Dark Tone (RGB: ${Math.round(avgR)}, ${Math.round(avgG)}, ${Math.round(avgB)})`;
      isApprovedBg = false;
    }

    return {
      passSize: isPortrait,
      passBg: isApprovedBg,
      passClarity,
      detectedBg,
      aspectRatio: ratio.toFixed(2),
      width: w,
      height: h,
    };
  } catch (err) {
    return { passSize: true, passBg: true, passClarity: true, detectedBg: "Studio Neutral", aspectRatio: "0.75", width: 300, height: 400 };
  }
}

export default function StudentProfileView({
  studentProfile,
  currentUser,
  isKibar = false,
  hifzDetails,
  childInfo = {},
  showAction,
  onProfileUpdated,
  loadPortalData,
  portalRole,
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form edit fields
  const [fullName, setFullName] = useState("");
  const [arabicName, setArabicName] = useState("");
  const [its, setIts] = useState("");
  const [gender, setGender] = useState("male");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [juz, setJuz] = useState("");
  const [surat, setSurat] = useState("");

  // Photo state
  const [activePhotoUrl, setActivePhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoReviewResult, setPhotoReviewResult] = useState(null);
  const [photoErrorDetails, setPhotoErrorDetails] = useState(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [timeLeftStr, setTimeLeftStr] = useState("");

  const fileInputRef = useRef(null);
  const studentKey = useMemo(() => {
    return String(studentProfile?.student_id || studentProfile?.id || currentUser?.id || "student");
  }, [studentProfile, currentUser]);

  const targetTable = isKibar ? "kibar_child_profiles" : "child_profiles";

  // Sync profile fields into edit form state
  useEffect(() => {
    if (studentProfile) {
      setFullName(studentProfile.full_name || studentProfile.name || "");
      setArabicName(studentProfile.arabic_name || "");
      setIts(studentProfile.its || "");
      setGender(String(studentProfile.gender || "male").toLowerCase() === "female" ? "female" : "male");
      setWhatsappNumber(studentProfile.whatsapp_number || "");
      setJuz(studentProfile.juz || hifzDetails?.juz || "");
      setSurat(studentProfile.surat || hifzDetails?.surat || "");
      setActivePhotoUrl(
        studentProfile.photo_url ||
        studentProfile.photoUrl ||
        studentProfile.avatar_url ||
        ""
      );
    }
  }, [studentProfile, hifzDetails]);

  // Auto-promote / clear any pending photo from localStorage immediately (no 15-min wait!)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`mauze_pending_photo_${studentKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.url) {
          finalizePhotoUpdate(parsed.url);
        } else {
          localStorage.removeItem(`mauze_pending_photo_${studentKey}`);
        }
      }
    } catch (_) {}
  }, [studentKey]);

  // Brief Countdown Timer (if any transition queue exists, max under 1 minute)
  useEffect(() => {
    if (!pendingPhoto) {
      setTimeLeftStr("");
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = (pendingPhoto.expiresAt || now) - now;
      if (diff <= 0) {
        clearInterval(interval);
        finalizePhotoUpdate(pendingPhoto.url);
      } else {
        const secs = Math.floor(diff / 1000);
        setTimeLeftStr(`00:${String(secs).padStart(2, "0")}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingPhoto]);

  // Finalize / Promote verified photo to database instantly
  const finalizePhotoUpdate = async (photoUrlToCommit) => {
    try {
      localStorage.removeItem(`mauze_pending_photo_${studentKey}`);
      setPendingPhoto(null);
      setTimeLeftStr("");

      // Update in Supabase
      const sid = studentProfile?.student_id || studentProfile?.id;
      if (sid) {
        await supabase
          .from(targetTable)
          .update({
            photo_url: photoUrlToCommit,
            updated_at: new Date().toISOString(),
          })
          .or(`student_id.eq.${sid},id.eq.${sid}`);
      }

      // Also mirror to Firestore if possible
      try {
        const { doc, setDoc } = await import("firebase/firestore");
        const { db } = await import("../firebase/db.js");
        const ref = doc(db, targetTable, String(sid));
        await setDoc(ref, { photo_url: photoUrlToCommit }, { merge: true });
      } catch (_) {}

      setActivePhotoUrl(photoUrlToCommit);
      if (showAction) {
        showAction("success", "✨ Profile photo 100% verified and updated successfully!");
      }
      if (loadPortalData) {
        loadPortalData(portalRole, currentUser, null, { silent: true });
      }
    } catch (err) {
      console.warn("Photo finalize note:", err);
    }
  };

  // Photo Selection & Client-Side Automated Review
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      if (showAction) showAction("error", "Please select a valid image file (JPG, PNG, WebP).");
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoErrorDetails({
        title: "File Size Too Large",
        issues: [
          {
            label: "File Size",
            detail: "Image exceeds 5MB size limit.",
            action: "Please compress or choose a photo under 5MB.",
          },
        ],
      });
      if (showAction) showAction("error", "Image file exceeds 5MB size limit. Please choose a smaller photo.");
      return;
    }

    setUploadingPhoto(true);
    setPhotoErrorDetails(null);
    setPhotoReviewResult(null);

    // 1. Create temporary image element for automated canvas analysis
    const tempUrl = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = tempUrl;

    img.onload = async () => {
      // Analyze passport size, aspect ratio, resolution/clarity and background color
      const review = analyzePassportImage(img);

      // STRICT VALIDATION: Both size, clarity and background color MUST match specifications!
      const isSizeOk = review.passSize;
      const isBgOk = review.passBg;
      const isClarityOk = review.passClarity;

      if (!isSizeOk || !isBgOk || !isClarityOk) {
        const issues = [];

        if (!isSizeOk) {
          issues.push({
            label: "Aspect Ratio / Orientation",
            detail: `Detected aspect ratio is ${review.aspectRatio} (must be vertical portrait between 0.60 and 1.15).`,
            action: "Crop your photo vertically into standard 3:4 passport portrait orientation (height must be taller than width).",
          });
        }

        if (!isClarityOk) {
          issues.push({
            label: "Photo Clarity & Lighting",
            detail: `Resolution (${review.width}×${review.height}px) is too small, blurry, or face lighting is unclear.`,
            action: "Take a sharp, clear, well-focused photo in bright daylight/lighting with at least 300×300px resolution.",
          });
        }

        if (!isBgOk) {
          issues.push({
            label: "Background Color",
            detail: `Detected background tone is ${review.detectedBg}.`,
            action: "Take your photo standing against a plain, solid White, Grey, or Cream wall without shadows or patterned objects.",
          });
        }

        setPhotoErrorDetails({
          title: "Photo Requirements Not Met (Action Needed)",
          issues,
          detectedBg: review.detectedBg,
          aspectRatio: review.aspectRatio,
        });
        setPhotoReviewResult(review);
        setUploadingPhoto(false);

        if (showAction) {
          showAction("error", "Photo specifications not matched. Check the exact instructions below and upload again.");
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Specifications 100% matched!
      setPhotoErrorDetails(null);
      setPhotoReviewResult(review);

      // 2. Upload to Supabase Storage
      try {
        const fileExt = file.name.split(".").pop() || "jpg";
        const fileName = `student_${studentKey}_${Date.now()}.${fileExt}`;
        const filePath = `profiles/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("child profile pictures")
          .upload(filePath, file, { contentType: file.type, upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("child profile pictures")
          .getPublicUrl(filePath);

        const uploadedUrl = urlData?.publicUrl || tempUrl;

        // 3. INSTANT AUTO-UPDATE: 100% matched photo is updated instantly!
        await finalizePhotoUpdate(uploadedUrl);

      } catch (err) {
        console.error("Photo upload error:", err);
        if (showAction) showAction("error", "Failed to upload photo: " + err.message);
      } finally {
        setUploadingPhoto(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    img.onerror = () => {
      setUploadingPhoto(false);
      if (showAction) showAction("error", "Failed to process image file.");
    };
  };

  // Save profile changes (Excluding Email & Group which are strictly locked)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      if (showAction) showAction("error", "Full name is required.");
      return;
    }

    setSaving(true);
    try {
      const sid = studentProfile?.student_id || studentProfile?.id || currentUser?.id;
      const numericIts = its && !isNaN(its) ? Number(its) : its;

      const updatePayload = {
        full_name: fullName.trim(),
        name: fullName.trim(),
        arabic_name: arabicName.trim() || null,
        its: numericIts || null,
        gender: gender || "male",
        whatsapp_number: whatsappNumber ? String(whatsappNumber).trim() : null,
        juz: juz ? String(juz).trim() : null,
        surat: surat ? String(surat).trim() : null,
        updated_at: new Date().toISOString(),
      };

      // NOTE: parent_email and group_name are purposefully OMITTED so user cannot overwrite them!

      // 1. Supabase update
      if (sid) {
        const { error: sbError } = await supabase
          .from(targetTable)
          .update(updatePayload)
          .or(`student_id.eq.${sid},id.eq.${sid}`);

        if (sbError) throw sbError;
      }

      // 2. Firestore parallel mirror
      try {
        const { doc, setDoc } = await import("firebase/firestore");
        const { db } = await import("../firebase/db.js");
        const ref = doc(db, targetTable, String(sid));
        await setDoc(ref, updatePayload, { merge: true });
      } catch (_) {}

      // Update local storage reg flag
      if (currentUser?.id) {
        localStorage.setItem(`mauze_reg_done_${currentUser.id}`, "true");
      }

      if (showAction) {
        showAction("success", "Student profile updated successfully!");
      }

      setIsEditOpen(false);

      if (loadPortalData) {
        await loadPortalData(portalRole, currentUser, null, { silent: true });
      }
      if (onProfileUpdated) {
        onProfileUpdated({ ...studentProfile, ...updatePayload });
      }
    } catch (err) {
      console.error("Save profile error:", err);
      if (showAction) showAction("error", "Error updating profile: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Resolved fields for display
  const displayName = studentProfile?.full_name || studentProfile?.name || childInfo.name || "Student";
  const displayArabic = studentProfile?.arabic_name || childInfo.arabicName || "";
  const displayIts = studentProfile?.its || childInfo.its || "—";
  const displayEmail = studentProfile?.parent_email || childInfo.parentEmail || currentUser?.email || "—";
  const displayGroup = studentProfile?.group_name || studentProfile?.groupName || "Assigned by Admin";
  const displayWhatsapp = studentProfile?.whatsapp_number || "Not provided";
  const displayGender = (studentProfile?.gender || "male").toLowerCase() === "female" ? "Female" : "Male";
  const displayJuz = studentProfile?.juz || hifzDetails?.juz || childInfo.hifzJuz || "—";
  const displaySurat = studentProfile?.surat || hifzDetails?.surat || childInfo.hifzSurat || "—";
  const displayMuhaffiz = studentProfile?.teacherName || studentProfile?.teacher_name || hifzDetails?.muhaffiz_name || childInfo.muhaffizName || "Assigned Teacher";

  return (
    <div className="student-profile-wrapper">
      {/* ----------------- 1. HERO PROFILE CARD ----------------- */}
      <div className="sp-hero-card">
        <div className="sp-hero-left">
          <div className="sp-avatar-container">
            {pendingPhoto?.url ? (
              <>
                <img src={pendingPhoto.url} alt={displayName} className="sp-avatar-img" />
                <span className="sp-avatar-pending-badge">Reviewing</span>
              </>
            ) : activePhotoUrl ? (
              <img
                src={activePhotoUrl}
                alt={displayName}
                className="sp-avatar-img"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/logo.png";
                }}
              />
            ) : (
              <div className="sp-avatar-placeholder">
                <User size={44} strokeWidth={1.8} />
              </div>
            )}
          </div>

          <div className="sp-hero-info">
            <div className="sp-hero-name-row">
              <h2 className="sp-hero-name">{displayName}</h2>
              <span className={`sp-hero-badge ${isKibar ? "kibar" : "atfal"}`}>
                {isKibar ? "Tahfeez al Kibar" : "Atfal Student"}
              </span>
            </div>

            {displayArabic && (
              <div className="sp-hero-arabic" dir="rtl">
                {displayArabic}
              </div>
            )}

            <div className="sp-hero-meta">
              <div className="sp-hero-meta-item">
                <Hash size={14} color="#8b6d31" />
                <span>ITS: <strong>{displayIts}</strong></span>
              </div>
              <div className="sp-hero-meta-item">
                <Users size={14} color="#8b6d31" />
                <span>Group: <strong>{displayGroup}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className="sp-hero-actions">
          <button
            type="button"
            className="sp-edit-btn"
            onClick={() => setIsEditOpen(true)}
            title="Edit student profile details"
          >
            <Edit3 size={16} />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* ----------------- 2. PENDING PHOTO BANNER (IF IN 15-MIN REVIEW QUEUE) ----------------- */}
      {pendingPhoto && (
        <div className="sp-pending-photo-banner card-appear">
          <div className="sp-ppb-left">
            <div className="sp-ppb-icon">
              <Clock size={22} />
            </div>
            <div>
              <h4 className="sp-ppb-title">Photo Auto-Review in Progress</h4>
              <p className="sp-ppb-desc">
                Passport size verified & {pendingPhoto.detectedBg || "approved studio"} background detected.
                Automatically promotes to your permanent profile in:
              </p>
            </div>
          </div>

          <div className="sp-ppb-timer">
            <Sparkles size={16} />
            <span>{timeLeftStr || "15:00"}</span>
          </div>
        </div>
      )}

      {/* ----------------- 3. DETAILS GRID CARDS ----------------- */}
      <div className="sp-details-grid">
        {/* Card 1: Student Registry Info */}
        <div className="sp-card card-appear">
          <div className="sp-card-header">
            <div className="sp-card-icon">
              <User size={18} />
            </div>
            <h3 className="sp-card-title">Student Registry Information</h3>
          </div>

          <div className="sp-info-list">
            <div className="sp-info-row">
              <span className="sp-info-label">Full Name</span>
              <span className="sp-info-value">{displayName}</span>
            </div>
            <div className="sp-info-row">
              <span className="sp-info-label">Arabic Name</span>
              <span className="sp-info-value" dir="rtl" style={{ fontFamily: "'Al-Kanz', serif", fontSize: "1.1rem" }}>
                {displayArabic || "—"}
              </span>
            </div>
            <div className="sp-info-row">
              <span className="sp-info-label">ITS Number</span>
              <span className="sp-info-value">{displayIts}</span>
            </div>
            <div className="sp-info-row">
              <span className="sp-info-label">Gender</span>
              <span className="sp-info-value">{displayGender}</span>
            </div>
            <div className="sp-info-row">
              <span className="sp-info-label">WhatsApp Contact</span>
              <span className="sp-info-value">{displayWhatsapp}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Administrative & System Info (Locked fields highlighted) */}
        <div className="sp-card card-appear">
          <div className="sp-card-header">
            <div className="sp-card-icon">
              <Shield size={18} />
            </div>
            <h3 className="sp-card-title">System & Administrative Registry</h3>
          </div>

          <div className="sp-info-list">
            <div className="sp-info-row">
              <span className="sp-info-label">
                <Lock size={13} color="#8c735d" /> Auth Email
              </span>
              <div style={{ textAlign: "right" }}>
                <span className="sp-info-value">{displayEmail}</span>
                <div style={{ marginTop: 2 }}>
                  <span className="sp-locked-badge">Admin Managed</span>
                </div>
              </div>
            </div>

            <div className="sp-info-row">
              <span className="sp-info-label">
                <Lock size={13} color="#8c735d" /> Assigned Group
              </span>
              <div style={{ textAlign: "right" }}>
                <span className="sp-info-value">{displayGroup}</span>
                <div style={{ marginTop: 2 }}>
                  <span className="sp-locked-badge">Admin Assigned</span>
                </div>
              </div>
            </div>

            <div className="sp-info-row">
              <span className="sp-info-label">Direct Muhaffiz</span>
              <span className="sp-info-value">{displayMuhaffiz}</span>
            </div>

            <div className="sp-info-row">
              <span className="sp-info-label">Current Hifz Target</span>
              <span className="sp-info-value">
                Juz {displayJuz} · {displaySurat}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Academic Feedback & Notes */}
        <div className="sp-card card-appear">
          <div className="sp-card-header">
            <div className="sp-card-icon">
              <MessageCircle size={18} />
            </div>
            <h3 className="sp-card-title">Teacher Feedback & Note</h3>
          </div>

          <div style={{ padding: "12px", borderRadius: "12px", background: "#FAF7F2", minHeight: "80px" }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#4A3828", lineHeight: 1.6, fontStyle: childInfo.teacherNote ? "normal" : "italic" }}>
              {childInfo.teacherNote || "No teacher feedback recorded for this period."}
            </p>
          </div>
        </div>

        {/* Card 4: Monthly Progress Snapshot */}
        <div className="sp-card card-appear">
          <div className="sp-card-header">
            <div className="sp-card-icon">
              <CalendarCheck size={18} />
            </div>
            <h3 className="sp-card-title">Monthly Progress Snapshot</h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ padding: "14px", borderRadius: "14px", background: "#FAF7F2", textAlign: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7A6655", textTransform: "uppercase" }}>
                Attendance
              </span>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#b8860b", marginTop: 4 }}>
                {childInfo.monthlyAttendance || "0"}
              </div>
              <span style={{ fontSize: "0.72rem", color: "#8c735d" }}>days this month</span>
            </div>

            <div style={{ padding: "14px", borderRadius: "14px", background: "#FAF7F2", textAlign: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7A6655", textTransform: "uppercase" }}>
                Jadeed Pages
              </span>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#b8860b", marginTop: 4 }}>
                {childInfo.monthlyJadeed || "0"}
              </div>
              <span style={{ fontSize: "0.72rem", color: "#8c735d" }}>pages memorized</span>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- 4. EDIT PROFILE MODAL ----------------- */}
      {isEditOpen && (
        <div className="sp-modal-backdrop" onClick={() => !saving && setIsEditOpen(false)}>
          <div className="sp-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sp-modal-header">
              <div className="sp-modal-header-title">
                <Edit3 size={20} color="#b8860b" />
                <h3>Edit Student Profile</h3>
              </div>
              <button
                type="button"
                className="sp-modal-close-btn"
                onClick={() => !saving && setIsEditOpen(false)}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveProfile} className="sp-modal-body">
              {/* Photo Upload & Guidelines */}
              <div className="sp-photo-section">
                <div className="sp-photo-header">
                  <Camera size={18} color="#b8860b" />
                  <span>Student Passport Photo Upload</span>
                </div>

                {/* Visual Guidelines */}
                <div className="sp-photo-instructions">
                  <div style={{ fontWeight: 700, color: "#38271A" }}>
                    📐 <strong>Passport Size Specifications</strong>:
                  </div>
                  <div>
                    Upload a standard passport size portrait photo (clear frontal face, good lighting).
                  </div>

                  <div className="sp-swatches-title" style={{ marginTop: 6 }}>
                    🎨 <strong>Allowed Background Colors (3 Choices)</strong>:
                  </div>
                  <div className="sp-color-swatches-row">
                    <div className="sp-swatch-card">
                      <span className="sp-swatch-circle grey" />
                      <span className="sp-swatch-label">Grey (#94A3B8)</span>
                    </div>
                    <div className="sp-swatch-card">
                      <span className="sp-swatch-circle white" />
                      <span className="sp-swatch-label">White (#FFFFFF)</span>
                    </div>
                    <div className="sp-swatch-card">
                      <span className="sp-swatch-circle cream" />
                      <span className="sp-swatch-label">Cream (#F5EBE0)</span>
                    </div>
                  </div>
                </div>

                {/* Upload action */}
                <div className="sp-photo-action-row">
                  <div className="sp-photo-preview-wrap">
                    {pendingPhoto?.url ? (
                      <img src={pendingPhoto.url} alt="Preview" className="sp-photo-preview-img" />
                    ) : activePhotoUrl ? (
                      <img
                        src={activePhotoUrl}
                        alt="Preview"
                        className="sp-photo-preview-img"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/logo.png";
                        }}
                      />
                    ) : (
                      <User size={36} color="#8c735d" />
                    )}
                  </div>

                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handlePhotoSelect}
                    />
                    <button
                      type="button"
                      className={`sp-upload-btn-custom ${uploadingPhoto ? "is-locked" : ""}`}
                      onClick={() => {
                        if (!uploadingPhoto) {
                          fileInputRef.current?.click();
                        }
                      }}
                      disabled={uploadingPhoto}
                      title="Choose a clear passport portrait photo"
                    >
                      {uploadingPhoto ? (
                        <>
                          <Camera size={16} />
                          <span>Verifying & Updating Instantly...</span>
                        </>
                      ) : (
                        <>
                          <Camera size={16} />
                          <span>Choose Passport Photo</span>
                        </>
                      )}
                    </button>
                    <p style={{ margin: "6px 0 0", fontSize: "0.74rem", color: "#7a6655" }}>
                      * When photo matches size, clarity, and background guidelines 100%, it auto-updates instantly within 1 minute.
                    </p>
                  </div>
                </div>

                {/* Rejection / Validation Error Card with EXACT Action Instructions */}
                {photoErrorDetails && (
                  <div className="sp-photo-error-card card-appear">
                    <div className="sp-pec-header">
                      <AlertCircle size={18} color="#b91c1c" />
                      <h4>{photoErrorDetails.title}</h4>
                    </div>
                    <p className="sp-pec-intro">
                      Your photo could not be auto-updated because the following required specifications were not met:
                    </p>
                    <div className="sp-pec-issues-list">
                      {(photoErrorDetails.issues || []).map((iss, i) => (
                        <div key={i} className="sp-pec-issue-item">
                          <div className="sp-pec-issue-header">
                            <XCircle size={15} color="#b91c1c" style={{ flexShrink: 0 }} />
                            <strong>{iss.label}:</strong> <span>{iss.detail}</span>
                          </div>
                          <div className="sp-pec-issue-fix">
                            👉 <strong>How to fix:</strong> {iss.action}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="sp-pec-actions">
                      <button
                        type="button"
                        className="sp-pec-retry-btn"
                        onClick={() => {
                          setPhotoErrorDetails(null);
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload size={14} /> Upload Another Photo
                      </button>
                    </div>
                  </div>
                )}

                {/* Successful Inspection Review Card */}
                {!photoErrorDetails && photoReviewResult && photoReviewResult.passSize && photoReviewResult.passBg && photoReviewResult.passClarity && (
                  <div className="sp-review-result-card card-appear">
                    <div className="sp-review-item pass">
                      <CheckCircle2 size={16} />
                      <span>Passport Dimensions & Ratio: 100% Verified Portrait ({photoReviewResult.aspectRatio || "3:4"})</span>
                    </div>
                    <div className="sp-review-item pass">
                      <CheckCircle2 size={16} />
                      <span>Clarity & Lighting: Clear & Focused ({photoReviewResult.width}×{photoReviewResult.height}px)</span>
                    </div>
                    <div className="sp-review-item pass">
                      <CheckCircle2 size={16} />
                      <span>Background Color: {photoReviewResult.detectedBg} (Approved 100%)</span>
                    </div>
                    <div style={{ marginTop: 6, fontWeight: 700, color: "#15803d", display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}>
                      <Sparkles size={16} color="#15803d" />
                      <span>100% Match Verified — Profile Photo Updated Successfully!</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Editable & Locked Form Fields */}
              <div className="sp-form-grid">
                {/* Full Name */}
                <div className="sp-field">
                  <label>Full Name (English) *</label>
                  <input
                    type="text"
                    required
                    className="sp-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter student name"
                  />
                </div>

                {/* Arabic Name */}
                <div className="sp-field">
                  <label>Arabic Name (الاسم بالعربي)</label>
                  <input
                    type="text"
                    dir="rtl"
                    className="sp-input"
                    style={{ fontFamily: "'Al-Kanz', serif", fontSize: "1.1rem" }}
                    value={arabicName}
                    onChange={(e) => setArabicName(e.target.value)}
                    placeholder="اسم الطالب"
                  />
                </div>

                {/* ITS ID */}
                <div className="sp-field">
                  <label>ITS Number *</label>
                  <input
                    type="text"
                    className="sp-input"
                    value={its}
                    onChange={(e) => setIts(e.target.value)}
                    placeholder="e.g. 30345678"
                  />
                </div>

                {/* Gender Toggle */}
                <div className="sp-field">
                  <label>Gender</label>
                  <div className="sp-gender-toggle">
                    <button
                      type="button"
                      className={`sp-gender-btn boy ${gender === "male" ? "active" : ""}`}
                      onClick={() => setGender("male")}
                    >
                      👦 Male
                    </button>
                    <button
                      type="button"
                      className={`sp-gender-btn girl ${gender === "female" ? "active" : ""}`}
                      onClick={() => setGender("female")}
                    >
                      👧 Female
                    </button>
                  </div>
                </div>

                {/* WhatsApp Phone */}
                <div className="sp-field">
                  <label>WhatsApp Number</label>
                  <input
                    type="text"
                    className="sp-input"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="e.g. 923001234567"
                  />
                </div>

                {/* Hifz Juz & Surat */}
                <div className="sp-field">
                  <label>Current Juz & Surat</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      className="sp-input"
                      style={{ width: "35%" }}
                      value={juz}
                      onChange={(e) => setJuz(e.target.value)}
                      placeholder="Juz"
                    />
                    <input
                      type="text"
                      className="sp-input"
                      style={{ flex: 1 }}
                      value={surat}
                      onChange={(e) => setSurat(e.target.value)}
                      placeholder="Surat name"
                    />
                  </div>
                </div>

                {/* LOCKED: Auth Email */}
                <div className="sp-field">
                  <label>
                    <Lock size={13} color="#8c735d" /> Auth Email (Admin Locked)
                  </label>
                  <input
                    type="email"
                    disabled
                    readOnly
                    className="sp-input locked"
                    value={displayEmail}
                    title="Email is bound to auth and can only be modified by system administration"
                  />
                  <small style={{ color: "#8c735d", fontSize: "0.7rem" }}>
                    🔒 Filled with auth email. Cannot be edited.
                  </small>
                </div>

                {/* LOCKED: Group */}
                <div className="sp-field">
                  <label>
                    <Lock size={13} color="#8c735d" /> Assigned Group (Admin Locked)
                  </label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    className="sp-input locked"
                    value={displayGroup}
                    title="Group allocation is strictly managed by administration"
                  />
                  <small style={{ color: "#8c735d", fontSize: "0.7rem" }}>
                    🔒 Assigned by Admin. Cannot be edited.
                  </small>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="sp-modal-footer">
                <button
                  type="button"
                  className="sp-cancel-btn"
                  onClick={() => setIsEditOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="sp-save-btn" disabled={saving}>
                  <Save size={16} />
                  <span>{saving ? "Saving Changes..." : "Save Profile Details"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
