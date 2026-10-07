import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  Image as ImageIcon,
  Info,
  User,
  Hash,
  Mail,
  Phone,
  Calendar,
  Award,
  AlertCircle,
  BookOpen,
  Send,
  Loader2,
  Check,
  ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getFormSettings,
  submitAdmissionApplication,
  DEFAULT_CMS_SETTINGS
} from "../../services/admissionService";
import VenuePhotoGalleryModal from "./VenuePhotoGalleryModal";
import ProgramInfoModal from "./ProgramInfoModal";
import "./AdmissionStyles.css";

const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)", flag: "🇮🇳" },
  { code: "+965", label: "Kuwait (+965)", flag: "🇰🇼" },
  { code: "+971", label: "UAE (+971)", flag: "🇦🇪" },
  { code: "+966", label: "Saudi Arabia (+966)", flag: "🇸🇦" },
  { code: "+1", label: "USA / Canada (+1)", flag: "🇺🇸" },
  { code: "+44", label: "UK (+44)", flag: "🇬🇧" },
  { code: "+254", label: "Kenya (+254)", flag: "🇰🇪" },
  { code: "+255", label: "Tanzania (+255)", flag: "🇹🇿" },
  { code: "+92", label: "Pakistan (+92)", flag: "🇵🇰" },
  { code: "+61", label: "Australia (+61)", flag: "🇦🇺" }
];

const SANAD_OPTIONS = [
  "Balad Sanad",
  "Inshiqaq Sanad",
  "Marhala Ula (Juz 30 Sanad)",
  "Marhala Saniya (Juz 28 to 30 Sanad)",
  "Marhala Salesa (Juz 26 to 30 Sanad)",
  "Marhala Rabea (Juz 1 to 5 Sanad)",
  "Marhala Khamesa (Juz 1 to 10 Sanad)",
  "Marhala Sadesa (Juz 1 to 15 Sanad)",
  "Marhala Sabea (Juz 1 to 20 Sanad)",
  "None / Beginning Fresh"
];

const KIBAR_VENUE_OPTIONS = [
  "Evan e Badri, Mohammediyah, Morning 8:30am to 10:00am",
  "Burhani Masjid, Pakhti Mubarak, Morning 8:15am to 10:15am",
  "Burhani Masjid, Pakhti Mubarak, Afternoon 4:30pm to 5:30pm"
];

export default function AdmissionForm({ onGoToAdmin = () => {} }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [cmsSettings, setCmsSettings] = useState(DEFAULT_CMS_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Timers
  const [introTimer, setIntroTimer] = useState(15);
  const [guidelinesTimer, setGuidelinesTimer] = useState(10);
  const [introTimerDone, setIntroTimerDone] = useState(false);
  const [guidelinesTimerDone, setGuidelinesTimerDone] = useState(false);

  // Modals
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [selectedProgramModal, setSelectedProgramModal] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    itsNumber: "",
    gender: "",
    age: "",
    jamaat: "",
    jamaatOther: "",
    email: "",
    countryCode: "+91",
    whatsappNumber: "",
    program: "",
    lastAchievedSanad: "",
    venueAndTime: "",
    dob: "",
    hifzTill: ""
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  // Set browser title to 'Mauze Tahfeez Admission Form'
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Mauze Tahfeez Admission Form";
    }
  }, []);

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await getFormSettings();
        if (settings) {
          setCmsSettings(settings);
          if (typeof settings.intro_countdown_seconds === "number") {
            setIntroTimer(settings.intro_countdown_seconds);
          }
          if (typeof settings.guidelines_countdown_seconds === "number") {
            setGuidelinesTimer(settings.guidelines_countdown_seconds);
          }
        }
      } catch (err) {
        console.warn("Failed to load CMS settings:", err);
      } finally {
        setLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  // Strict 15s Timer for Page 1
  useEffect(() => {
    if (currentPage === 1 && !introTimerDone) {
      if (introTimer <= 0) {
        setIntroTimerDone(true);
        return;
      }
      const interval = setInterval(() => {
        setIntroTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIntroTimerDone(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentPage, introTimer, introTimerDone]);

  // Strict 10s Timer for Page 3
  useEffect(() => {
    if (currentPage === 3 && !guidelinesTimerDone) {
      if (guidelinesTimer <= 0) {
        setGuidelinesTimerDone(true);
        return;
      }
      const interval = setInterval(() => {
        setGuidelinesTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setGuidelinesTimerDone(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentPage, guidelinesTimer, guidelinesTimerDone]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validatePage2 = () => {
    const errors = {};
    if (!formData.fullName || formData.fullName.trim().length < 3) {
      errors.fullName = "Please enter applicant's full name (at least 3 characters).";
    }
    const cleanITS = formData.itsNumber?.trim();
    if (!cleanITS || !/^\d{8}$/.test(cleanITS)) {
      errors.itsNumber = "Please enter a valid 8-digit ITS number.";
    }
    if (!formData.gender) {
      errors.gender = "Please select gender.";
    }
    const ageNum = parseInt(formData.age, 10);
    if (!formData.age || isNaN(ageNum) || ageNum < 3 || ageNum > 99) {
      errors.age = "Please enter a valid age (between 3 and 99).";
    }
    if (!formData.jamaat) {
      errors.jamaat = "Please select your Jamaat.";
    } else if (formData.jamaat === "Other" && (!formData.jamaatOther || formData.jamaatOther.trim().length < 2)) {
      errors.jamaatOther = "Please specify your Jamaat.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    const cleanPhone = formData.whatsappNumber?.replace(/[^\d]/g, "");
    if (!cleanPhone || cleanPhone.length < 7 || cleanPhone.length > 15) {
      errors.whatsappNumber = "Please enter a valid WhatsApp number.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePage4 = () => {
    const errors = {};
    if (!formData.program) {
      errors.program = "Please select which Hifz program you wish to register for.";
    } else {
      if (formData.program === "Al-Kibar (Adults)") {
        if (!formData.lastAchievedSanad) {
          errors.lastAchievedSanad = "Please select your last achieved Sanad.";
        }
        if (!formData.venueAndTime) {
          errors.venueAndTime = "Please select your preferred Venue and Time batch.";
        }
      } else if (formData.program === "Al-Atfal (7 to 15 yrs old)") {
        if (!formData.lastAchievedSanad) {
          errors.lastAchievedSanad = "Please select the child's last achieved Sanad.";
        }
      } else if (formData.program === "Al-Sigar (4 to 6 yrs old)") {
        if (!formData.dob) {
          errors.dob = "Please select the child's Date of Birth.";
        }
        if (!formData.hifzTill || formData.hifzTill.trim().length < 1) {
          errors.hifzTill = "Please mention memorized surats or enter 'N/A'.";
        }
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextPage = () => {
    if (currentPage === 1) {
      if (!introTimerDone) return;
      setCurrentPage(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (currentPage === 2) {
      if (!validatePage2()) return;
      setCurrentPage(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (currentPage === 3) {
      if (!guidelinesTimerDone) return;
      setCurrentPage(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!validatePage4()) return;

    setIsSubmitting(true);
    try {
      const fullWhatsApp = `${formData.countryCode}${formData.whatsappNumber.replace(/[^\d]/g, "")}`;
      const payload = {
        ...formData,
        whatsappNumber: fullWhatsApp
      };

      const res = await submitAdmissionApplication(payload);
      if (res.success) {
        setSubmissionResult({
          applicationId: res.applicationId,
          applicantName: formData.fullName,
          program: formData.program,
          email: formData.email,
          phone: fullWhatsApp
        });
        setCurrentPage(5);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        alert(`Error submitting application: ${res.error || "Please verify details and try again."}`);
      }
    } catch (err) {
      alert("Submission error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admission-root-container">
      <div className="admission-bg-pattern" />
      <div className="admission-ambient-glow-1" />
      <div className="admission-ambient-glow-2" />

      {/* Top Header */}
      <header className="adm-header">
        <div className="adm-header-inner">
          <div className="adm-brand-box">
            <img
              src="/mauze-tahfeez-logo.png"
              alt="Mauze Tahfeez"
              className="adm-logo-img"
              onError={(e) => {
                e.currentTarget.src = "/logo.png";
              }}
            />
            <div>
              <h1 className="adm-brand-title">
                <span>Tahfeez – Galiakot</span>
                <span className="adm-brand-tag">1447-48H</span>
              </h1>
              <p className="adm-brand-sub">Online Admission & Registration Portal</p>
            </div>
          </div>

          <div className="adm-header-actions">
            <button
              type="button"
              onClick={() => setShowGalleryModal(true)}
              className="adm-btn-secondary"
            >
              <ImageIcon size={16} />
              <span>View Venue Photos</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Multi-Step Form */}
      <main className="adm-main-wrap">
        {currentPage <= 4 && (
          <div className="adm-step-header">
            <div className="adm-step-info">
              <span className="adm-step-badge">Step {currentPage} of 4</span>
              <span className="adm-step-title">
                {currentPage === 1 && "Introduction & Overview"}
                {currentPage === 2 && "Applicant Details"}
                {currentPage === 3 && "Guidelines & Code of Conduct"}
                {currentPage === 4 && "Program & Venue Selection"}
              </span>
            </div>
            <div className="adm-step-track">
              <div
                className="adm-step-fill"
                style={{ width: `${currentPage * 25}%` }}
              />
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ============================================================
              PAGE 1: INTRODUCTION WITH 15-SECOND STRICT COUNTDOWN TIMER
              ============================================================ */}
          {currentPage === 1 && (
            <motion.div
              key="page-1"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="adm-card"
            >
              <div className="adm-title-center">
                <h2 className="adm-h1">
                  {cmsSettings.form_title || "Registrations 1447-48H, Hifz Classes (Galiakot)"}
                </h2>
                <p className="adm-subtext" style={{ color: "var(--adm-gold-dark)", fontWeight: 800 }}>
                  {cmsSettings.organization_name || "Tahfeez – Galiakot"}
                </p>
              </div>

              <div className="adm-desc-box">
                {cmsSettings.intro_text}
              </div>

              <div className="adm-notice-pill">
                <span>
                  WhatsApp Helpline: <strong>{cmsSettings.helpline_number || "+918107925353"}</strong>
                </span>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  * For Galiakot Mumineen only. No accommodation provided.
                </span>
              </div>

              {/* Strict 15s Timer Action Bar */}
              <div className="adm-footer-action">
                <div className="adm-timer-display">
                  <Clock size={16} color="#f59e0b" />
                  {!introTimerDone ? (
                    <span>
                      Please read introduction. Next button unlocks in{" "}
                      <strong className="adm-timer-sec">{introTimer}s</strong>
                    </span>
                  ) : (
                    <span className="adm-timer-ready">
                      <CheckCircle2 size={16} /> Ready to proceed
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!introTimerDone}
                  className="adm-btn-primary"
                >
                  <span>{introTimerDone ? "Start Application" : `Please wait (${introTimer}s)`}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ============================================================
              PAGE 2: APPLICANT USER DETAILS
              ============================================================ */}
          {currentPage === 2 && (
            <motion.div
              key="page-2"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="adm-card"
            >
              <div style={{ marginBottom: "24px" }}>
                <h2 className="adm-h2">Applicant Details</h2>
                <p className="adm-subtext">All fields are mandatory. Please enter valid ITS and contact information.</p>
              </div>

              <div className="adm-form-grid">
                {/* Full Name */}
                <div className="adm-field adm-col-full">
                  <label className="adm-label">
                    Full Name <span className="adm-req">*</span>
                  </label>
                  <div className="adm-input-icon-wrap">
                    <User size={16} className="adm-input-icon" />
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange("fullName", e.target.value)}
                      placeholder="e.g. Mufaddal Bhai Shk Shabbir Bhai"
                      className={`adm-input-custom ${formErrors.fullName ? "adm-input-error" : ""}`}
                    />
                  </div>
                  {formErrors.fullName && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.fullName}</p>}
                </div>

                {/* ITS Number */}
                <div className="adm-field">
                  <label className="adm-label">
                    ITS Number <span className="adm-req">*</span>
                  </label>
                  <div className="adm-input-icon-wrap">
                    <Hash size={16} className="adm-input-icon" />
                    <input
                      type="text"
                      maxLength={8}
                      value={formData.itsNumber}
                      onChange={(e) => handleInputChange("itsNumber", e.target.value.replace(/\D/g, ""))}
                      placeholder="8-digit ITS"
                      className={`adm-input-custom ${formErrors.itsNumber ? "adm-input-error" : ""}`}
                    />
                  </div>
                  {formErrors.itsNumber && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.itsNumber}</p>}
                </div>

                {/* Age */}
                <div className="adm-field">
                  <label className="adm-label">
                    Age <span className="adm-req">*</span>
                  </label>
                  <div className="adm-input-icon-wrap">
                    <Calendar size={16} className="adm-input-icon" />
                    <input
                      type="number"
                      min={3}
                      max={99}
                      value={formData.age}
                      onChange={(e) => handleInputChange("age", e.target.value)}
                      placeholder="e.g. 12"
                      className={`adm-input-custom ${formErrors.age ? "adm-input-error" : ""}`}
                    />
                  </div>
                  {formErrors.age && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.age}</p>}
                </div>

                {/* Gender */}
                <div className="adm-field">
                  <label className="adm-label">
                    Gender <span className="adm-req">*</span>
                  </label>
                  <div className="adm-btn-group">
                    {["Male", "Female"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleInputChange("gender", g)}
                        className={`adm-choice-btn ${formData.gender === g ? "active" : ""}`}
                      >
                        {formData.gender === g && <Check size={14} color="#f59e0b" />}
                        <span>{g}</span>
                      </button>
                    ))}
                  </div>
                  {formErrors.gender && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.gender}</p>}
                </div>

                {/* Jamaat */}
                <div className="adm-field">
                  <label className="adm-label">
                    Jamaat <span className="adm-req">*</span>
                  </label>
                  <div className="adm-btn-group-3">
                    {["Taherabad", "Mohammediyah", "Other"].map((j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => handleInputChange("jamaat", j)}
                        className={`adm-choice-btn ${formData.jamaat === j ? "active" : ""}`}
                      >
                        <span>{j}</span>
                      </button>
                    ))}
                  </div>
                  {formData.jamaat === "Other" && (
                    <input
                      type="text"
                      value={formData.jamaatOther}
                      onChange={(e) => handleInputChange("jamaatOther", e.target.value)}
                      placeholder="Specify your Jamaat"
                      className={`adm-input-custom adm-input-noicon ${formErrors.jamaatOther ? "adm-input-error" : ""}`}
                      style={{ marginTop: "8px" }}
                    />
                  )}
                  {formErrors.jamaat && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.jamaat}</p>}
                  {formErrors.jamaatOther && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.jamaatOther}</p>}
                </div>

                {/* Email Address */}
                <div className="adm-field">
                  <label className="adm-label">
                    Email Address <span className="adm-req">*</span>
                  </label>
                  <div className="adm-input-icon-wrap">
                    <Mail size={16} className="adm-input-icon" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="user@domain.com"
                      className={`adm-input-custom ${formErrors.email ? "adm-input-error" : ""}`}
                    />
                  </div>
                  {formErrors.email && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.email}</p>}
                  <p className="adm-hint">This will be your Portal Account User ID.</p>
                </div>

                {/* WhatsApp Phone Number */}
                <div className="adm-field">
                  <label className="adm-label">
                    WhatsApp Number <span className="adm-req">*</span>
                  </label>
                  <div className="adm-phone-wrap">
                    <select
                      value={formData.countryCode}
                      onChange={(e) => handleInputChange("countryCode", e.target.value)}
                      className="adm-input-custom adm-country-select"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code} style={{ background: "#0b0f19", color: "#fff" }}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <div className="adm-input-icon-wrap" style={{ flex: 1 }}>
                      <Phone size={16} className="adm-input-icon" />
                      <input
                        type="tel"
                        value={formData.whatsappNumber}
                        onChange={(e) => handleInputChange("whatsappNumber", e.target.value.replace(/\D/g, ""))}
                        placeholder="10-digit phone"
                        className={`adm-input-custom ${formErrors.whatsappNumber ? "adm-input-error" : ""}`}
                      />
                    </div>
                  </div>
                  {formErrors.whatsappNumber && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.whatsappNumber}</p>}
                  <p className="adm-hint">Portal login password & notifications will arrive here.</p>
                </div>
              </div>

              {/* Navigation */}
              <div className="adm-footer-action">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  className="adm-btn-text"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <ArrowLeft size={16} /> Back
                </button>

                <button
                  type="button"
                  onClick={handleNextPage}
                  className="adm-btn-primary"
                >
                  <span>Continue to Guidelines</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ============================================================
              PAGE 3: GUIDELINES & 10-SECOND COUNTDOWN TIMER
              ============================================================ */}
          {currentPage === 3 && (
            <motion.div
              key="page-3"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="adm-card"
            >
              <div style={{ marginBottom: "24px" }}>
                <h2 className="adm-h2">Guidelines & Discipline Policy</h2>
                <p className="adm-subtext">Please review all Hifz programme expectations before proceeding.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
                {cmsSettings.guidelines_text.split("\n").filter(Boolean).map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "14px",
                      padding: "16px",
                      borderRadius: "14px",
                      background: "rgba(15, 23, 42, 0.75)",
                      border: "1px solid rgba(51, 65, 85, 0.7)"
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "rgba(245, 158, 11, 0.2)",
                        color: "#fbbf24",
                        fontSize: "11px",
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        border: "1px solid rgba(245, 158, 11, 0.4)"
                      }}
                    >
                      {idx + 1}
                    </div>
                    <p style={{ margin: 0, fontSize: "14px", color: "#e2e8f0", lineHeight: 1.6 }}>
                      {line.replace(/^•\s*/, "")}
                    </p>
                  </div>
                ))}
              </div>

              {/* Strict 10s Timer Action Bar */}
              <div className="adm-footer-action">
                <div className="adm-timer-display">
                  <Clock size={16} color="#10b981" />
                  {!guidelinesTimerDone ? (
                    <span>
                      Please review all guidelines. Unlocks in{" "}
                      <strong className="adm-timer-sec" style={{ color: "#34d399" }}>{guidelinesTimer}s</strong>
                    </span>
                  ) : (
                    <span className="adm-timer-ready">
                      <CheckCircle2 size={16} /> Guidelines reviewed & accepted
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={handlePrevPage}
                    className="adm-btn-text"
                  >
                    <ArrowLeft size={16} /> Back
                  </button>

                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={!guidelinesTimerDone}
                    className="adm-btn-primary adm-btn-emerald"
                  >
                    <span>{guidelinesTimerDone ? "Select Program & Venue" : `Please wait (${guidelinesTimer}s)`}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ============================================================
              PAGE 4: PROGRAM SELECTION, VENUE GALLERY & DYNAMIC FIELDS
              ============================================================ */}
          {currentPage === 4 && (
            <motion.div
              key="page-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="adm-card"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <h2 className="adm-h2">Program & Venue Selection</h2>
                  <p className="adm-subtext">Choose your Hifz program and customize batch options.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGalleryModal(true)}
                  className="adm-btn-secondary"
                >
                  <ImageIcon size={16} />
                  <span>View Photos</span>
                </button>
              </div>

              {/* 1. Programme Selection Cards */}
              <div style={{ marginBottom: "24px" }}>
                <label className="adm-label">
                  Which programme would you like to register for? <span className="adm-req">*</span>
                </label>

                <div className="adm-program-cards-grid">
                  {[
                    {
                      key: "Al-Kibar (Adults)",
                      title: "Al-Kibar (Adults)",
                      sub: "Adult Mumineen & Youth",
                      timing: "Morning & Afternoon",
                      fee: "₹2,500 / mo",
                      cmsData: cmsSettings.programs_info?.kibar
                    },
                    {
                      key: "Al-Atfal (7 to 15 yrs old)",
                      title: "Al-Atfal (7 to 15 yrs old)",
                      sub: "School-going children",
                      timing: "Afternoon 4:30 - 6:00 PM",
                      fee: "₹2,700 / mo",
                      cmsData: cmsSettings.programs_info?.atfal
                    },
                    {
                      key: "Al-Sigar (4 to 6 yrs old)",
                      title: "Al-Sigar (4 to 6 yrs old)",
                      sub: "Early childhood Hifz",
                      timing: "Evening 5:00 - 6:00 PM",
                      fee: "₹3,000 / mo",
                      cmsData: cmsSettings.programs_info?.sigar
                    }
                  ].map((prog) => {
                    const isSelected = formData.program === prog.key;
                    return (
                      <div
                        key={prog.key}
                        onClick={() => handleInputChange("program", prog.key)}
                        className={`adm-prog-card ${isSelected ? "active" : ""}`}
                      >
                        <div className="adm-prog-top">
                          <div className="adm-prog-title-box">
                            <div className={`adm-radio-circle ${isSelected ? "active" : ""}`}>
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </div>
                            <h4 className="adm-prog-name">{prog.title}</h4>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProgramModal(prog.cmsData);
                            }}
                            className="adm-info-icon-btn"
                            title="View Program Details"
                          >
                            <Info size={14} />
                          </button>
                        </div>

                        <div className="adm-prog-details">
                          <span style={{ color: "#94a3b8" }}>{prog.sub}</span>
                          <span className="adm-prog-fee">{prog.fee}</span>
                          <span style={{ color: "#64748b" }}>{prog.timing}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {formErrors.program && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.program}</p>}
              </div>

              {/* 2. Dynamic Program-Specific Custom Fields */}
              {formData.program && (
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.9)",
                    border: "1.5px solid rgba(245, 158, 11, 0.3)",
                    borderRadius: "18px",
                    padding: "24px",
                    marginBottom: "28px"
                  }}
                >
                  <h4 style={{ margin: "0 0 16px 0", fontSize: "13px", fontWeight: 800, textTransform: "uppercase", color: "#fde68a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <BookOpen size={16} /> {formData.program} Specific Details
                  </h4>

                  {/* KIBAR */}
                  {formData.program === "Al-Kibar (Adults)" && (
                    <div className="adm-form-grid" style={{ marginBottom: 0 }}>
                      <div className="adm-field adm-col-full">
                        <label className="adm-label">Last Achieved Sanad <span className="adm-req">*</span></label>
                        <select
                          value={formData.lastAchievedSanad}
                          onChange={(e) => handleInputChange("lastAchievedSanad", e.target.value)}
                          className={`adm-input-custom adm-input-noicon ${formErrors.lastAchievedSanad ? "adm-input-error" : ""}`}
                        >
                          <option value="" style={{ background: "#0b0f19" }}>-- Select Last Achieved Sanad --</option>
                          {SANAD_OPTIONS.map((s) => (
                            <option key={s} value={s} style={{ background: "#0b0f19" }}>{s}</option>
                          ))}
                        </select>
                        {formErrors.lastAchievedSanad && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.lastAchievedSanad}</p>}
                      </div>

                      <div className="adm-field adm-col-full">
                        <label className="adm-label">Select Venue and Time Batch <span className="adm-req">*</span></label>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                          {KIBAR_VENUE_OPTIONS.map((vOpt) => {
                            const isV = formData.venueAndTime === vOpt;
                            return (
                              <div
                                key={vOpt}
                                onClick={() => handleInputChange("venueAndTime", vOpt)}
                                className={`adm-choice-btn ${isV ? "active" : ""}`}
                                style={{ justifyContent: "flex-start", padding: "14px 16px" }}
                              >
                                <div className={`adm-radio-circle ${isV ? "active" : ""}`}>
                                  {isV && <Check size={12} strokeWidth={3} />}
                                </div>
                                <span>{vOpt}</span>
                              </div>
                            );
                          })}
                        </div>
                        {formErrors.venueAndTime && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.venueAndTime}</p>}
                      </div>
                    </div>
                  )}

                  {/* ATFAL */}
                  {formData.program === "Al-Atfal (7 to 15 yrs old)" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(71, 85, 105, 0.5)", fontSize: "13px", color: "#cbd5e1" }}>
                        <p style={{ margin: "0 0 4px 0", fontWeight: 700, color: "#fde68a", display: "flex", alignItems: "center", gap: "6px" }}>
                          <MapPin size={14} /> Venue: Burhani Masjid (Pakhti Mubarak)
                        </p>
                        <p style={{ margin: 0, color: "#94a3b8" }}>Timings: Afternoon 4:30 PM to 6:00 PM • Hub Raqam: ₹2700 / month</p>
                      </div>

                      <div className="adm-field">
                        <label className="adm-label">Last Achieved Sanad <span className="adm-req">*</span></label>
                        <select
                          value={formData.lastAchievedSanad}
                          onChange={(e) => handleInputChange("lastAchievedSanad", e.target.value)}
                          className={`adm-input-custom adm-input-noicon ${formErrors.lastAchievedSanad ? "adm-input-error" : ""}`}
                        >
                          <option value="" style={{ background: "#0b0f19" }}>-- Select Last Achieved Sanad --</option>
                          {SANAD_OPTIONS.map((s) => (
                            <option key={s} value={s} style={{ background: "#0b0f19" }}>{s}</option>
                          ))}
                        </select>
                        {formErrors.lastAchievedSanad && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.lastAchievedSanad}</p>}
                      </div>
                    </div>
                  )}

                  {/* SIGAR */}
                  {formData.program === "Al-Sigar (4 to 6 yrs old)" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(71, 85, 105, 0.5)", fontSize: "13px", color: "#cbd5e1" }}>
                        <p style={{ margin: "0 0 4px 0", fontWeight: 700, color: "#fde68a", display: "flex", alignItems: "center", gap: "6px" }}>
                          <MapPin size={14} /> Venue: Pakhti Mubarak
                        </p>
                        <p style={{ margin: 0, color: "#94a3b8" }}>Timings: 5:00 PM to 6:00 PM • Hub Raqam: ₹3000 / month</p>
                      </div>

                      <div className="adm-field">
                        <label className="adm-label">Child's Date of Birth <span className="adm-req">*</span></label>
                        <input
                          type="date"
                          value={formData.dob}
                          onChange={(e) => handleInputChange("dob", e.target.value)}
                          className={`adm-input-custom adm-input-noicon ${formErrors.dob ? "adm-input-error" : ""}`}
                        />
                        {formErrors.dob && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.dob}</p>}
                      </div>

                      <div className="adm-field">
                        <label className="adm-label">Hifz Till <span className="adm-req">*</span></label>
                        <input
                          type="text"
                          value={formData.hifzTill}
                          onChange={(e) => handleInputChange("hifzTill", e.target.value)}
                          placeholder="e.g. Surat al-Nas to Surat al-Fil (or N/A)"
                          className={`adm-input-custom adm-input-noicon ${formErrors.hifzTill ? "adm-input-error" : ""}`}
                        />
                        {formErrors.hifzTill && <p className="adm-err-msg"><AlertCircle size={12} /> {formErrors.hifzTill}</p>}
                        <p className="adm-hint">If the child has memorized any surat from Juz Amma, please mention till which surat, else write N/A.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation & Submit Action */}
              <div className="adm-footer-action">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  className="adm-btn-text"
                >
                  <ArrowLeft size={16} /> Back
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="adm-btn-primary"
                  style={{ padding: "16px 36px", fontSize: "16px" }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>Submit Admission Form</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ============================================================
              PAGE 5: SUBMISSION SUCCESS SCREEN
              ============================================================ */}
          {currentPage === 5 && submissionResult && (
            <motion.div
              key="page-5"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="adm-card"
              style={{ textAlign: "center", padding: "48px 32px" }}
            >
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#0b0f19",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px auto",
                  boxShadow: "0 10px 30px rgba(16, 185, 129, 0.4)"
                }}
              >
                <Check size={36} strokeWidth={3} />
              </div>

              <h2 className="adm-h1" style={{ marginBottom: "10px" }}>
                Admission Form Submitted!
              </h2>
              <p className="adm-subtext" style={{ maxWidth: "540px", margin: "0 auto 24px auto" }}>
                Shukran <strong style={{ color: "#fde68a" }}>{submissionResult.applicantName}</strong>. Your application for <strong style={{ color: "#fde68a" }}>{submissionResult.program}</strong> has been received by Tahfeez Galiakot administration.
              </p>

              {/* Reference Card */}
              <div
                style={{
                  background: "rgba(11, 15, 25, 0.8)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: "16px",
                  padding: "20px",
                  maxWidth: "440px",
                  margin: "0 auto 24px auto",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #334155", paddingBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8" }}>Application Ref ID</span>
                  <span style={{ fontSize: "14px", fontWeight: 800, color: "#fbbf24", fontFamily: "monospace" }}>
                    {submissionResult.applicationId}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: "#94a3b8" }}>Initial Status</span>
                  <span className="status-pill status-pending">Pending Admin Review</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: "#94a3b8" }}>WhatsApp Phone</span>
                  <span style={{ fontFamily: "monospace", color: "#f8fafc" }}>{submissionResult.phone}</span>
                </div>
              </div>

              {/* WhatsApp Notice */}
              <div className="adm-notice-pill" style={{ maxWidth: "440px", margin: "0 auto 28px auto", background: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.3)", color: "#6ee7b7" }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <span style={{ textAlign: "left", fontSize: "12px" }}>
                  An automated WhatsApp acknowledgement has been sent. Status updates and approval messages will arrive directly on your phone.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(1);
                    setIntroTimer(15);
                    setIntroTimerDone(false);
                    setGuidelinesTimer(10);
                    setGuidelinesTimerDone(false);
                  }}
                  className="adm-btn-secondary"
                >
                  Submit Another Form
                </button>

                <button
                  type="button"
                  onClick={onGoToAdmin}
                  className="adm-btn-primary"
                  style={{ padding: "10px 24px", fontSize: "13px" }}
                >
                  Go to Admin Portal
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Gallery Modal */}
      <VenuePhotoGalleryModal
        isOpen={showGalleryModal}
        onClose={() => setShowGalleryModal(false)}
        photos={cmsSettings.venue_photos}
      />

      {/* Program Info Modal */}
      <ProgramInfoModal
        isOpen={!!selectedProgramModal}
        onClose={() => setSelectedProgramModal(null)}
        programData={selectedProgramModal}
      />
    </div>
  );
}
