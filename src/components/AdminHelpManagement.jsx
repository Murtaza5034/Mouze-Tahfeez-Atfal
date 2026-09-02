import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient.js";
import {
  HelpCircle,
  Plus,
  Video,
  Upload,
  Link as LinkIcon,
  Trash2,
  Edit,
  Eye,
  X,
  CheckCircle,
  FileText,
  Users,
  GraduationCap,
  Heart,
  Layers,
  Sparkles,
} from "lucide-react";
import PremiumVideoPlayer from "./PremiumVideoPlayer.jsx";
import "./AdminHelpManagement.css";

const CATEGORIES = [
  "General Guide",
  "Takhteet Progress",
  "Attendance Tracking",
  "Hifz Submission",
  "Jadwal & Schedule",
  "Online Tahfeez",
  "Results & Reports",
];

// In-memory cache for fast instant rendering without flashing
let cachedTutorials = null;

export default function AdminHelpManagement({ showAction }) {
  const [tutorials, setTutorials] = useState(() => cachedTutorials || []);
  const [loading, setLoading] = useState(() => !cachedTutorials || cachedTutorials.length === 0);
  const [filterAudience, setFilterAudience] = useState("all"); // "all" | "teachers" | "parents"
  const [filterCategory, setFilterCategory] = useState("All");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formAudience, setFormAudience] = useState("all"); // "all" | "teachers" | "parents"
  const [formCategory, setFormCategory] = useState("General Guide");
  const [formSourceType, setFormSourceType] = useState("upload"); // "upload" | "url"
  const [formVideoUrl, setFormVideoUrl] = useState("");
  const [formThumbnailUrl, setFormThumbnailUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formOrderIndex, setFormOrderIndex] = useState(0);

  // Upload Progress
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef(null);

  // Fetch tutorials
  const fetchTutorials = async (silent = false) => {
    if (!silent && (!cachedTutorials || cachedTutorials.length === 0)) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from("help_tutorials")
        .select("*")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Error loading tutorials:", error);
      } else {
        const rows = data || [];
        cachedTutorials = rows;
        setTutorials(rows);
      }
    } catch (err) {
      console.error("Fetch tutorials exception:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTutorials(cachedTutorials && cachedTutorials.length > 0);
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormAudience("all");
    setFormCategory("General Guide");
    setFormSourceType("upload");
    setFormVideoUrl("");
    setFormThumbnailUrl("");
    setFormDescription("");
    setFormOrderIndex(tutorials.length);
    setUploadFile(null);
    setUploadProgress(0);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormTitle(item.title || "");
    setFormAudience(item.target_audience || "all");
    setFormCategory(item.category || "General Guide");
    setFormSourceType(item.video_type === "url" ? "url" : "upload");
    setFormVideoUrl(item.video_url || "");
    setFormThumbnailUrl(item.thumbnail_url || "");
    setFormDescription(item.description || "");
    setFormOrderIndex(item.order_index || 0);
    setUploadFile(null);
    setUploadProgress(0);
    setIsModalOpen(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      if (showAction) showAction("error", "Please select a valid video file (.mp4, .webm, .mov, etc.)");
      return;
    }

    setUploadFile(file);
    if (!formTitle) {
      // Auto-populate title from filename
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setFormTitle(cleanName);
    }
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!formTitle.trim()) {
      if (showAction) showAction("error", "Please enter a tutorial title.");
      return;
    }

    let finalVideoUrl = formVideoUrl.trim();

    // If uploading a new file
    if (formSourceType === "upload" && uploadFile) {
      setUploading(true);
      setUploadProgress(0);
      try {
        const fileExt = uploadFile.name.split(".").pop();
        const fileName = `help_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
        const filePath = `videos/${fileName}`;

        const { data: uploadRes, error: uploadErr } = await supabase.storage
          .from("help_videos")
          .upload(filePath, uploadFile, {
            contentType: uploadFile.type,
            upsert: true,
            onProgress: (pct) => setUploadProgress(pct),
          });

        if (uploadErr) {
          throw new Error("Failed to upload video: " + uploadErr.message);
        }

        if (uploadRes?.publicUrl) {
          finalVideoUrl = uploadRes.publicUrl;
        } else {
          const { data: urlRes } = await supabase.storage
            .from("help_videos")
            .getPublicUrl(filePath);
          finalVideoUrl = urlRes?.publicUrl || "";
        }
        setUploadProgress(100);
      } catch (err) {
        console.error("Upload error:", err);
        if (showAction) showAction("error", err.message || "Video upload failed");
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    if (!finalVideoUrl) {
      if (showAction) showAction("error", "Please upload a video file or provide a valid video link.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        target_audience: formAudience,
        category: formCategory,
        video_url: finalVideoUrl,
        video_type: formSourceType === "url" ? "url" : "file",
        thumbnail_url: formThumbnailUrl.trim() || null,
        description: formDescription.trim(),
        order_index: Number(formOrderIndex) || 0,
        updated_at: new Date().toISOString(),
      };

      if (editingItem && editingItem.id) {
        const { error } = await supabase
          .from("help_tutorials")
          .update(payload)
          .eq("id", editingItem.id);

        if (error) throw error;
        if (showAction) showAction("success", "Tutorial updated successfully!");
      } else {
        payload.id = `tut_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        payload.created_at = new Date().toISOString();

        const { error } = await supabase
          .from("help_tutorials")
          .insert(payload);

        if (error) throw error;
        if (showAction) showAction("success", "Tutorial published successfully!");
      }

      setIsModalOpen(false);
      setUploadFile(null);
      setUploadProgress(0);
      await fetchTutorials();
    } catch (err) {
      console.error("Save error:", err);
      if (showAction) showAction("error", "Failed to save tutorial: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const { error } = await supabase
        .from("help_tutorials")
        .delete()
        .eq("id", id);

      if (error) throw error;
      if (showAction) showAction("success", "Tutorial deleted.");
      setTutorials((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
      if (showAction) showAction("error", "Failed to delete: " + err.message);
    }
  };

  const isTeacherAudience = (aud) => aud === "teachers" || aud === "teacher" || aud === "all";
  const isParentAudience = (aud) => aud === "parents" || aud === "parent" || aud === "all";

  const filteredTutorials = tutorials.filter((t) => {
    const matchAudience =
      filterAudience === "all"
        ? true
        : filterAudience === "teachers"
        ? isTeacherAudience(t.target_audience)
        : isParentAudience(t.target_audience);
    const matchCategory = filterCategory === "All" || t.category === filterCategory;
    return matchAudience && matchCategory;
  });

  return (
    <div className="admin-help-wrapper fade-in">
      {/* Header */}
      <div className="admin-help-header">
        <div className="admin-help-title-group">
          <h2>
            <HelpCircle size={28} style={{ color: "#d4af37" }} />
            Help & Video Guide Management
          </h2>
          <p>
            Upload in-app video tutorials and step-by-step guides for Teachers and Parents.
          </p>
        </div>
        <button className="admin-help-add-btn" onClick={openCreateModal}>
          <Plus size={18} /> Upload New Tutorial
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="admin-help-filter-bar">
        <div className="admin-help-tabs">
          <button
            className={`admin-help-tab-btn ${filterAudience === "all" ? "active" : ""}`}
            onClick={() => setFilterAudience("all")}
          >
            <Layers size={16} /> All ({tutorials.length})
          </button>
          <button
            className={`admin-help-tab-btn ${filterAudience === "teachers" ? "active" : ""}`}
            onClick={() => setFilterAudience("teachers")}
          >
            <GraduationCap size={16} /> Teachers Only ({tutorials.filter((t) => t.target_audience === "teachers").length})
          </button>
          <button
            className={`admin-help-tab-btn ${filterAudience === "parents" ? "active" : ""}`}
            onClick={() => setFilterAudience("parents")}
          >
            <Heart size={16} /> Parents Only ({tutorials.filter((t) => t.target_audience === "parents").length})
          </button>
        </div>

        {/* Category Filter */}
        <select
          className="help-form-select"
          style={{ width: "auto", minWidth: "180px", padding: "8px 14px", fontSize: "0.88rem" }}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="All">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Tutorials Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>
          <div className="pulse-indicator" style={{ display: "inline-flex" }}>
            <div className="pulse-dot" />
            <span>Loading tutorial guides…</span>
          </div>
        </div>
      ) : filteredTutorials.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "var(--card-bg)",
            borderRadius: "20px",
            border: "1.5px dashed rgba(212, 175, 55, 0.3)",
          }}
        >
          <Video size={48} style={{ color: "#d4af37", opacity: 0.5, marginBottom: "16px" }} />
          <h3 style={{ margin: "0 0 8px", color: "var(--deep-brown)" }}>No Tutorials Found</h3>
          <p style={{ color: "var(--text-muted)", margin: "0 0 20px", fontSize: "0.9rem" }}>
            {filterAudience === "all"
              ? "Start by publishing your first in-app video tutorial."
              : `No tutorials currently targeted for ${filterAudience}.`}
          </p>
          <button className="admin-help-add-btn" style={{ margin: "0 auto" }} onClick={openCreateModal}>
            <Plus size={16} /> Upload First Video
          </button>
        </div>
      ) : (
        <div className="admin-help-grid">
          {filteredTutorials.map((item) => (
            <div key={item.id} className="admin-help-card">
              {/* Media Preview Box */}
              <div className="admin-help-card-media">
                {item.thumbnail_url ? (
                  <img src={item.thumbnail_url} alt={item.title} className="admin-help-card-thumb" />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, #1f1b16, #0d0c0b)",
                    }}
                  >
                    <Video size={36} style={{ color: "#d4af37", opacity: 0.7 }} />
                  </div>
                )}

                <div
                  className="admin-help-card-play-overlay"
                  onClick={() => setPreviewVideo(item)}
                  title="Preview Video"
                >
                  <div className="admin-help-play-circle">
                    <Eye size={22} />
                  </div>
                </div>

                <span
                  className={`admin-help-audience-pill audience-${item.target_audience || "all"}`}
                >
                  {item.target_audience === "teachers"
                    ? "Teachers"
                    : item.target_audience === "parents"
                    ? "Parents"
                    : "All Portals"}
                </span>
              </div>

              {/* Card Body */}
              <div className="admin-help-card-body">
                <span className="admin-help-card-tag">{item.category || "Guide"}</span>
                <h4 className="admin-help-card-title">{item.title}</h4>
                <p className="admin-help-card-desc">{item.description || "No description provided."}</p>

                {/* Actions */}
                <div className="admin-help-card-actions">
                  <button
                    type="button"
                    className="admin-help-action-btn"
                    onClick={() => setPreviewVideo(item)}
                  >
                    <Eye size={15} /> Play
                  </button>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="admin-help-action-btn"
                      onClick={() => openEditModal(item)}
                      title="Edit"
                    >
                      <Edit size={15} /> Edit
                    </button>
                    <button
                      type="button"
                      className="admin-help-action-btn delete"
                      onClick={() => handleDelete(item.id, item.title)}
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Preview Modal */}
      {previewVideo && (
        <div className="help-modal-overlay" onClick={() => setPreviewVideo(null)}>
          <div
            className="help-modal-card"
            style={{ maxWidth: "840px", padding: "24px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="help-modal-header">
              <h3>{previewVideo.title}</h3>
              <button
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                onClick={() => setPreviewVideo(null)}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <PremiumVideoPlayer
                videoUrl={previewVideo.video_url}
                posterUrl={previewVideo.thumbnail_url}
                title={previewVideo.title}
                autoPlay={true}
              />
            </div>

            {previewVideo.description && (
              <div
                style={{
                  background: "var(--input-bg, #faf8f5)",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  border: "1px solid rgba(212, 175, 55, 0.2)",
                  fontSize: "0.92rem",
                  lineHeight: "1.7",
                  whiteSpace: "pre-wrap",
                  color: "var(--text-main)",
                }}
              >
                <h5 style={{ margin: "0 0 8px", color: "var(--deep-brown)", fontWeight: 700 }}>Instructions & Steps:</h5>
                {previewVideo.description}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="help-modal-overlay" onClick={() => !uploading && !saving && setIsModalOpen(false)}>
          <div className="help-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <h3>{editingItem ? "Edit Tutorial Guide" : "Upload New Help Tutorial"}</h3>
              <button
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                onClick={() => !uploading && !saving && setIsModalOpen(false)}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              {/* Target Audience */}
              <div className="help-form-group">
                <label className="help-form-label">Target Audience</label>
                <div className="help-radio-group">
                  <div
                    className={`help-radio-card ${formAudience === "teachers" ? "active" : ""}`}
                    onClick={() => setFormAudience("teachers")}
                  >
                    <GraduationCap size={20} style={{ color: "#3b82f6", marginBottom: "4px" }} />
                    <div>Teachers Only</div>
                  </div>
                  <div
                    className={`help-radio-card ${formAudience === "parents" ? "active" : ""}`}
                    onClick={() => setFormAudience("parents")}
                  >
                    <Heart size={20} style={{ color: "#10b981", marginBottom: "4px" }} />
                    <div>Parents Only</div>
                  </div>
                  <div
                    className={`help-radio-card ${formAudience === "all" ? "active" : ""}`}
                    onClick={() => setFormAudience("all")}
                  >
                    <Users size={20} style={{ color: "#d4af37", marginBottom: "4px" }} />
                    <div>All Portals</div>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="help-form-group">
                <label className="help-form-label">Tutorial Title</label>
                <input
                  type="text"
                  className="help-form-input"
                  placeholder="e.g. How to Submit Takhteet & Daily Murajah"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>

              {/* Category */}
              <div className="help-form-group">
                <label className="help-form-label">Category / Feature</label>
                <select
                  className="help-form-select"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Video Source Type */}
              <div className="help-form-group">
                <label className="help-form-label">Video Source</label>
                <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                  <button
                    type="button"
                    className={`admin-help-tab-btn ${formSourceType === "upload" ? "active" : ""}`}
                    style={{ flex: 1, justifyContent: "center", border: "1px solid rgba(212, 175, 55, 0.3)" }}
                    onClick={() => setFormSourceType("upload")}
                  >
                    <Upload size={16} /> Direct File Upload
                  </button>
                  <button
                    type="button"
                    className={`admin-help-tab-btn ${formSourceType === "url" ? "active" : ""}`}
                    style={{ flex: 1, justifyContent: "center", border: "1px solid rgba(212, 175, 55, 0.3)" }}
                    onClick={() => setFormSourceType("url")}
                  >
                    <LinkIcon size={16} /> Video Link / Embed URL
                  </button>
                </div>

                {formSourceType === "upload" ? (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="video/*"
                      style={{ display: "none" }}
                      onChange={handleFileSelect}
                    />
                    <div
                      className="help-upload-box"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={32} style={{ color: "#d4af37", marginBottom: "8px" }} />
                      <div style={{ fontWeight: 600, color: "var(--deep-brown)" }}>
                        {uploadFile ? uploadFile.name : "Click to select a video file (.mp4, .webm, .mov)"}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        {uploadFile ? `${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB selected` : "Supports video files up to 100MB"}
                      </div>
                    </div>

                    {uploading && (
                      <div className="help-upload-progress">
                        <div
                          className="help-upload-progress-fill"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="url"
                      className="help-form-input"
                      placeholder="https://www.youtube.com/watch?v=... or direct .mp4 URL"
                      value={formVideoUrl}
                      onChange={(e) => setFormVideoUrl(e.target.value)}
                      required={formSourceType === "url"}
                    />
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                      Supports YouTube, Vimeo, Google Drive preview, or direct video URLs.
                    </span>
                  </div>
                )}
              </div>

              {/* Description / Instructions */}
              <div className="help-form-group">
                <label className="help-form-label">Description & Step-by-Step Guide</label>
                <textarea
                  className="help-form-textarea"
                  placeholder="Explain what this tutorial covers and list step-by-step instructions:&#10;&#10;1. Open the Attendance page.&#10;2. Select your child.&#10;3. Tap mark attendance..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              {/* Thumbnail URL (Optional) */}
              <div className="help-form-group">
                <label className="help-form-label">Cover / Thumbnail Image URL (Optional)</label>
                <input
                  type="url"
                  className="help-form-input"
                  placeholder="https://... (leave blank for automatic video preview)"
                  value={formThumbnailUrl}
                  onChange={(e) => setFormThumbnailUrl(e.target.value)}
                />
              </div>

              {/* Submit / Cancel Actions */}
              <div className="help-modal-actions">
                <button
                  type="button"
                  className="admin-help-action-btn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={uploading || saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-help-add-btn"
                  disabled={uploading || saving}
                >
                  {uploading
                    ? `Uploading (${uploadProgress}%)…`
                    : saving
                    ? "Saving…"
                    : editingItem
                    ? "Update Tutorial"
                    : "Publish Tutorial"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
