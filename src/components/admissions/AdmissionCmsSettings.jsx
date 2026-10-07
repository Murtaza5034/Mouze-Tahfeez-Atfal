import React, { useState, useEffect } from "react";
import {
  Save,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Plus,
  Trash2,
  Link,
  DollarSign,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  HelpCircle,
  Phone,
  FileText
} from "lucide-react";
import { motion } from "framer-motion";
import {
  getFormSettings,
  saveFormSettings,
  DEFAULT_CMS_SETTINGS
} from "../../services/admissionService";
import "./AdmissionStyles.css";

export default function AdmissionCmsSettings({ onSaved = () => {} }) {
  const [settings, setSettings] = useState(DEFAULT_CMS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("general"); // general | programs | photos

  // New photo draft state
  const [newPhoto, setNewPhoto] = useState({
    title: "",
    description: "",
    url: "",
    tag: "Burhani Masjid"
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await getFormSettings();
        if (data) setSettings(data);
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleGeneralChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const handleProgramChange = (progKey, field, value) => {
    setSettings((prev) => ({
      ...prev,
      programs_info: {
        ...prev.programs_info,
        [progKey]: {
          ...(prev.programs_info?.[progKey] || {}),
          [field]: value
        }
      }
    }));
    setSaveSuccess(false);
  };

  // Add Photo
  const handleAddPhoto = () => {
    if (!newPhoto.url || !newPhoto.title) {
      alert("Please provide at least a Photo Title and valid Image URL.");
      return;
    }

    const photoObj = {
      id: `photo_${Date.now()}`,
      title: newPhoto.title.trim(),
      description: newPhoto.description.trim(),
      url: newPhoto.url.trim(),
      tag: newPhoto.tag.trim() || "Venue"
    };

    setSettings((prev) => ({
      ...prev,
      venue_photos: [...(prev.venue_photos || []), photoObj]
    }));

    setNewPhoto({
      title: "",
      description: "",
      url: "",
      tag: "Burhani Masjid"
    });
    setSaveSuccess(false);
  };

  // Remove Photo
  const handleRemovePhoto = (photoId) => {
    setSettings((prev) => ({
      ...prev,
      venue_photos: (prev.venue_photos || []).filter((p) => p.id !== photoId)
    }));
    setSaveSuccess(false);
  };

  // Save Settings
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveFormSettings(settings);
      if (res.success) {
        setSaveSuccess(true);
        onSaved(settings);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        alert(`Error saving CMS settings: ${res.error}`);
      }
    } catch (err) {
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px", color: "var(--adm-text-muted)" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--adm-gold-primary)" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header & Save Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", padding: "20px 24px", borderRadius: "20px", background: "#ffffff", border: "1.5px solid var(--adm-gold-border)", boxShadow: "var(--adm-shadow-sm)" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "19px", fontWeight: 900, color: "var(--adm-espresso-main)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={20} color="var(--adm-gold-dark)" />
            <span>CMS Form Configurations</span>
          </h2>
          <p style={{ margin: "3px 0 0 0", fontSize: "12.5px", color: "var(--adm-text-muted)" }}>
            Modify live form headings, introduction text, countdown timers, program details, and venue photo gallery.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {saveSuccess && (
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--adm-emerald-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} /> Live changes published!
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="adm-btn-primary"
            style={{ padding: "10px 24px", fontSize: "13px" }}
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>{saving ? "Publishing..." : "Save All Changes"}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1.5px solid var(--adm-gold-border)", paddingBottom: "8px", overflowX: "auto" }}>
        {[
          { id: "general", label: "General & Guidelines", icon: FileText },
          { id: "programs", label: "Program Details & URLs", icon: BookOpen },
          { id: "photos", label: "Venue Photo Gallery", icon: ImageIcon }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`adm-tab-pill ${isActive ? "active" : ""}`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: GENERAL & GUIDELINES */}
      {activeTab === "general" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          <div style={{ padding: "24px", borderRadius: "20px", background: "#ffffff", border: "1.5px solid var(--adm-gold-border)", boxShadow: "var(--adm-shadow-sm)", display: "flex", flexDirection: "column", gap: "18px" }}>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-gold-dark)", display: "flex", alignItems: "center", gap: "8px" }}>
              <FileText size={16} />
              Page 1: Title & Introduction Text
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
              <div className="adm-field">
                <label className="adm-label">Form Main Title</label>
                <input
                  type="text"
                  value={settings.form_title}
                  onChange={(e) => handleGeneralChange("form_title", e.target.value)}
                  className="adm-input-custom adm-input-noicon"
                />
              </div>

              <div className="adm-field">
                <label className="adm-label">Organization / Subtitle</label>
                <input
                  type="text"
                  value={settings.organization_name}
                  onChange={(e) => handleGeneralChange("organization_name", e.target.value)}
                  className="adm-input-custom adm-input-noicon"
                />
              </div>

              <div className="adm-field">
                <label className="adm-label">WhatsApp Helpline Number</label>
                <input
                  type="text"
                  value={settings.helpline_number}
                  onChange={(e) => handleGeneralChange("helpline_number", e.target.value)}
                  className="adm-input-custom adm-input-noicon"
                />
              </div>

              <div className="adm-field">
                <label className="adm-label">Page 1 Countdown Timer (Seconds)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={settings.intro_countdown_seconds}
                  onChange={(e) => handleGeneralChange("intro_countdown_seconds", parseInt(e.target.value, 10) || 0)}
                  className="adm-input-custom adm-input-noicon"
                />
              </div>
            </div>

            <div className="adm-field">
              <label className="adm-label">Introduction Text Block (Displayed on Page 1)</label>
              <textarea
                rows={7}
                value={settings.intro_text}
                onChange={(e) => handleGeneralChange("intro_text", e.target.value)}
                className="adm-input-custom adm-input-noicon"
                style={{ fontSize: "13.5px", lineHeight: "1.7", fontFamily: "inherit" }}
              />
            </div>
          </div>

          <div style={{ padding: "24px", borderRadius: "20px", background: "#ffffff", border: "1.5px solid var(--adm-gold-border)", boxShadow: "var(--adm-shadow-sm)", display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-emerald-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={16} />
                Page 3: Guidelines & Code of Conduct
              </h3>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ fontSize: "12px", color: "var(--adm-text-muted)", fontWeight: 700 }}>Timer (Seconds):</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={settings.guidelines_countdown_seconds}
                  onChange={(e) => handleGeneralChange("guidelines_countdown_seconds", parseInt(e.target.value, 10) || 0)}
                  className="adm-input-custom adm-input-noicon"
                  style={{ maxWidth: "80px", padding: "6px 10px", textAlign: "center" }}
                />
              </div>
            </div>

            <div className="adm-field">
              <label className="adm-label">Guidelines Lines (One per bullet point)</label>
              <textarea
                rows={6}
                value={settings.guidelines_text}
                onChange={(e) => handleGeneralChange("guidelines_text", e.target.value)}
                className="adm-input-custom adm-input-noicon"
                style={{ fontSize: "13.5px", lineHeight: "1.7", fontFamily: "inherit" }}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 2: PROGRAM DETAILS & INFORMATIONAL URLS */}
      {activeTab === "programs" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          {["kibar", "atfal", "sigar"].map((pKey) => {
            const prog = settings.programs_info?.[pKey] || {};
            const titleMap = {
              kibar: "Al-Kibar (Adults)",
              atfal: "Al-Atfal (7 to 15 yrs old)",
              sigar: "Al-Sigar (4 to 6 yrs old)"
            };

            return (
              <div
                key={pKey}
                style={{ padding: "24px", borderRadius: "20px", background: "#ffffff", border: "1.5px solid var(--adm-gold-border)", boxShadow: "var(--adm-shadow-sm)", display: "flex", flexDirection: "column", gap: "16px" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid var(--adm-gold-border)", paddingBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--adm-gold-primary)" }} />
                    <h3 style={{ margin: 0, fontSize: "16.5px", fontWeight: 800, color: "var(--adm-espresso-main)" }}>
                      {titleMap[pKey]} Configuration
                    </h3>
                  </div>

                  <span className="adm-brand-tag">
                    {prog.badge || "Programme"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                  <div className="adm-field">
                    <label className="adm-label">Hub Raqam Fee Text</label>
                    <input
                      type="text"
                      value={prog.hub_raqam || ""}
                      onChange={(e) => handleProgramChange(pKey, "hub_raqam", e.target.value)}
                      className="adm-input-custom adm-input-noicon"
                      placeholder="e.g. ₹2,500 / month"
                    />
                  </div>

                  <div className="adm-field">
                    <label className="adm-label">Timings Text</label>
                    <input
                      type="text"
                      value={prog.timings || ""}
                      onChange={(e) => handleProgramChange(pKey, "timings", e.target.value)}
                      className="adm-input-custom adm-input-noicon"
                      placeholder="e.g. Morning 8:30am to 10:30am"
                    />
                  </div>

                  <div className="adm-field">
                    <label className="adm-label">Venues</label>
                    <input
                      type="text"
                      value={prog.venues || ""}
                      onChange={(e) => handleProgramChange(pKey, "venues", e.target.value)}
                      className="adm-input-custom adm-input-noicon"
                    />
                  </div>

                  <div className="adm-field">
                    <label className="adm-label">Motto / Slogan</label>
                    <input
                      type="text"
                      value={prog.motto || ""}
                      onChange={(e) => handleProgramChange(pKey, "motto", e.target.value)}
                      className="adm-input-custom adm-input-noicon"
                    />
                  </div>

                  {/* Informational URL */}
                  <div className="adm-field adm-col-full">
                    <label className="adm-label" style={{ color: "var(--adm-gold-dark)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Link size={14} />
                      Informational URL attached to Info Icon (Opened when user clicks (i))
                    </label>
                    <input
                      type="url"
                      value={prog.info_url || ""}
                      onChange={(e) => handleProgramChange(pKey, "info_url", e.target.value)}
                      className="adm-input-custom adm-input-noicon"
                      placeholder="https://mouze-tahfeez-atfal.vercel.app/info/..."
                    />
                  </div>

                  <div className="adm-field adm-col-full">
                    <label className="adm-label">Description & About Us</label>
                    <textarea
                      rows={4}
                      value={prog.description || ""}
                      onChange={(e) => handleProgramChange(pKey, "description", e.target.value)}
                      className="adm-input-custom adm-input-noicon"
                      style={{ fontSize: "13px", lineHeight: "1.6" }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* TAB 3: VENUE PHOTOS GALLERY MANAGER */}
      {activeTab === "photos" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          {/* Add Photo Module */}
          <div style={{ padding: "24px", borderRadius: "20px", background: "#ffffff", border: "1.5px solid var(--adm-gold-border)", boxShadow: "var(--adm-shadow-sm)", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-gold-dark)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Plus size={16} />
              Add New Venue Photo to Modal Gallery
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
              <div className="adm-field">
                <label className="adm-label">Photo Title</label>
                <input
                  type="text"
                  value={newPhoto.title}
                  onChange={(e) => setNewPhoto({ ...newPhoto, title: e.target.value })}
                  placeholder="e.g. Main Tahfeez Hall - Pakhti Mubarak"
                  className="adm-input-custom adm-input-noicon"
                />
              </div>

              <div className="adm-field">
                <label className="adm-label">Location Tag / Badge</label>
                <input
                  type="text"
                  value={newPhoto.tag}
                  onChange={(e) => setNewPhoto({ ...newPhoto, tag: e.target.value })}
                  placeholder="e.g. Burhani Masjid or Evan e Badri"
                  className="adm-input-custom adm-input-noicon"
                />
              </div>

              <div className="adm-field adm-col-full">
                <label className="adm-label">Image URL (Direct link or HTTPS CDN)</label>
                <input
                  type="url"
                  value={newPhoto.url}
                  onChange={(e) => setNewPhoto({ ...newPhoto, url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="adm-input-custom adm-input-noicon"
                />
              </div>

              <div className="adm-field adm-col-full">
                <label className="adm-label">Caption Description</label>
                <input
                  type="text"
                  value={newPhoto.description}
                  onChange={(e) => setNewPhoto({ ...newPhoto, description: e.target.value })}
                  placeholder="A brief caption describing the classroom setup or facility..."
                  className="adm-input-custom adm-input-noicon"
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "8px" }}>
              <button
                type="button"
                onClick={handleAddPhoto}
                className="adm-btn-primary"
                style={{ padding: "10px 22px", fontSize: "13px" }}
              >
                <Plus size={16} />
                <span>Add Photo to Gallery</span>
              </button>
            </div>
          </div>

          {/* Existing Photos Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h3 style={{ margin: 0, fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-text-muted)" }}>
              Active Gallery Photos ({(settings.venue_photos || []).length})
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
              {(settings.venue_photos || []).map((photo, index) => (
                <div
                  key={photo.id || index}
                  style={{ borderRadius: "18px", background: "#ffffff", border: "1.5px solid var(--adm-gold-border)", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "var(--adm-shadow-sm)" }}
                >
                  <div style={{ position: "relative", height: "180px", width: "100%", background: "var(--adm-cream-soft)", overflow: "hidden" }}>
                    <img
                      src={photo.url}
                      alt={photo.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div style={{ position: "absolute", top: "12px", left: "12px", background: "rgba(255, 255, 255, 0.9)", color: "var(--adm-gold-dark)", border: "1px solid var(--adm-gold-border)", fontSize: "10.5px", fontWeight: 800, padding: "2px 10px", borderRadius: "999px" }}>
                      {photo.tag || "Venue"}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      style={{ position: "absolute", top: "12px", right: "12px", padding: "8px", borderRadius: "10px", background: "rgba(220, 38, 38, 0.9)", color: "#ffffff", border: "none", cursor: "pointer" }}
                      title="Remove Photo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ padding: "16px" }}>
                    <h4 style={{ margin: 0, fontSize: "14.5px", fontWeight: 800, color: "var(--adm-espresso-main)" }}>
                      {photo.title}
                    </h4>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "var(--adm-text-muted)" }}>
                      {photo.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
