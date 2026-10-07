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
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Save Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>CMS Form Configurations</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Modify live form headings, introduction text, countdown timers, program URLs, and venue photos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" /> Live changes published!
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? "Publishing..." : "Save All Changes"}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2 pb-1 overflow-x-auto">
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-4 h-4" />
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
          className="space-y-6"
        >
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Page 1: Title & Introduction Text
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Form Main Title
                </label>
                <input
                  type="text"
                  value={settings.form_title}
                  onChange={(e) => handleGeneralChange("form_title", e.target.value)}
                  className="adm-input"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Organization / Subtitle
                </label>
                <input
                  type="text"
                  value={settings.organization_name}
                  onChange={(e) => handleGeneralChange("organization_name", e.target.value)}
                  className="adm-input"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  WhatsApp Helpline Number
                </label>
                <input
                  type="text"
                  value={settings.helpline_number}
                  onChange={(e) => handleGeneralChange("helpline_number", e.target.value)}
                  className="adm-input"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Page 1 Countdown Timer (Seconds)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={settings.intro_countdown_seconds}
                  onChange={(e) => handleGeneralChange("intro_countdown_seconds", parseInt(e.target.value, 10) || 0)}
                  className="adm-input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Introduction Text Block (Displayed on Page 1)
              </label>
              <textarea
                rows={7}
                value={settings.intro_text}
                onChange={(e) => handleGeneralChange("intro_text", e.target.value)}
                className="adm-input font-normal leading-relaxed text-sm"
              />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Page 3: Guidelines & Code of Conduct
              </h3>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Timer (Seconds):</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={settings.guidelines_countdown_seconds}
                  onChange={(e) => handleGeneralChange("guidelines_countdown_seconds", parseInt(e.target.value, 10) || 0)}
                  className="adm-input max-w-[80px] py-1.5 text-center"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Guidelines Lines (One per bullet point)
              </label>
              <textarea
                rows={6}
                value={settings.guidelines_text}
                onChange={(e) => handleGeneralChange("guidelines_text", e.target.value)}
                className="adm-input font-normal leading-relaxed text-sm"
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
          className="space-y-6"
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
                className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <h3 className="text-base font-bold text-white">
                      {titleMap[pKey]} Configuration
                    </h3>
                  </div>

                  <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    {prog.badge || "Programme"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400">
                      Hub Raqam Fee Text
                    </label>
                    <input
                      type="text"
                      value={prog.hub_raqam || ""}
                      onChange={(e) => handleProgramChange(pKey, "hub_raqam", e.target.value)}
                      className="adm-input"
                      placeholder="e.g. ₹2,500 / month"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400">
                      Timings Text
                    </label>
                    <input
                      type="text"
                      value={prog.timings || ""}
                      onChange={(e) => handleProgramChange(pKey, "timings", e.target.value)}
                      className="adm-input"
                      placeholder="e.g. Morning 8:30am to 10:30am"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400">
                      Venues
                    </label>
                    <input
                      type="text"
                      value={prog.venues || ""}
                      onChange={(e) => handleProgramChange(pKey, "venues", e.target.value)}
                      className="adm-input"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400">
                      Motto / Slogan
                    </label>
                    <input
                      type="text"
                      value={prog.motto || ""}
                      onChange={(e) => handleProgramChange(pKey, "motto", e.target.value)}
                      className="adm-input"
                    />
                  </div>

                  {/* Informational URL attached to the program */}
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5" />
                      Informational URL attached to Info Icon (Opened when user clicks (i))
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={prog.info_url || ""}
                        onChange={(e) => handleProgramChange(pKey, "info_url", e.target.value)}
                        className="adm-input text-sky-300"
                        placeholder="https://mauze-tahfeez.vercel.app/info/..."
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-slate-400">
                      Description & About Us
                    </label>
                    <textarea
                      rows={4}
                      value={prog.description || ""}
                      onChange={(e) => handleProgramChange(pKey, "description", e.target.value)}
                      className="adm-input text-sm leading-relaxed"
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
          className="space-y-6"
        >
          {/* Add Photo Module */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-4">
            <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              Add New Venue Photo to Modal Gallery
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Photo Title</label>
                <input
                  type="text"
                  value={newPhoto.title}
                  onChange={(e) => setNewPhoto({ ...newPhoto, title: e.target.value })}
                  placeholder="e.g. Main Tahfeez Hall - Pakhti Mubarak"
                  className="adm-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Location Tag / Badge</label>
                <input
                  type="text"
                  value={newPhoto.tag}
                  onChange={(e) => setNewPhoto({ ...newPhoto, tag: e.target.value })}
                  placeholder="e.g. Burhani Masjid or Evan e Badri"
                  className="adm-input"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-400">Image URL (Direct link or HTTPS CDN)</label>
                <input
                  type="url"
                  value={newPhoto.url}
                  onChange={(e) => setNewPhoto({ ...newPhoto, url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="adm-input"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-400">Caption Description</label>
                <input
                  type="text"
                  value={newPhoto.description}
                  onChange={(e) => setNewPhoto({ ...newPhoto, description: e.target.value })}
                  placeholder="A brief caption describing the classroom setup or facility..."
                  className="adm-input"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleAddPhoto}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs tracking-wide transition-all cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Add Photo to Gallery</span>
              </button>
            </div>
          </div>

          {/* Existing Photos Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Gallery Photos ({(settings.venue_photos || []).length})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(settings.venue_photos || []).map((photo, index) => (
                <div
                  key={photo.id || index}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden flex flex-col group hover:border-amber-500/40 transition-all shadow-md"
                >
                  <div className="relative h-44 w-full bg-slate-950 overflow-hidden">
                    <img
                      src={photo.url}
                      alt={photo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 bg-slate-950/80 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full backdrop-blur-md">
                      {photo.tag || "Venue"}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute top-3 right-3 p-2 rounded-xl bg-rose-500/80 hover:bg-rose-600 text-white shadow-lg transition-all cursor-pointer"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white line-clamp-1">
                        {photo.title}
                      </h4>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                        {photo.description}
                      </p>
                    </div>
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
