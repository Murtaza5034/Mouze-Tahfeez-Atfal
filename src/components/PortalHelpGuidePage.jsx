import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import {
  HelpCircle,
  Video,
  PlayCircle,
  Search,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Layers,
  ChevronRight,
  Info,
} from "lucide-react";
import PremiumVideoPlayer from "./PremiumVideoPlayer.jsx";
import "./PortalHelpGuidePage.css";

export default function PortalHelpGuidePage({ portalType = "parent" }) {
  const isTeacher = portalType === "teacher";
  const portalTitle = isTeacher ? "Teacher Tutorial & Help Center" : "Parent Tutorial & Help Center";
  const portalSubtitle = isTeacher
    ? "Watch tutorial video guides to easily manage daily hifz, attendance, and weekly takhteet."
    : "Watch helpful video guides and follow step-by-step instructions for the parent portal.";

  const [tutorials, setTutorials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTutorial, setSelectedTutorial] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    const fetchTutorials = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("help_tutorials")
          .select("*")
          .order("order_index", { ascending: true })
          .order("created_at", { ascending: false });

        if (!error && data) {
          // Filter for this portal role or all
          const filtered = data.filter((t) => {
            const aud = t.target_audience;
            if (aud === "all") return true;
            if (isTeacher && (aud === "teacher" || aud === "teachers")) return true;
            if (!isTeacher && (aud === "parent" || aud === "parents")) return true;
            return false;
          });
          setTutorials(filtered);
          if (filtered.length > 0) {
            setSelectedTutorial(filtered[0]);
          }
        }
      } catch (err) {
        console.error("Error loading help tutorials:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTutorials();
  }, [portalType]);

  const categories = ["All", ...Array.from(new Set(tutorials.map((t) => t.category).filter(Boolean)))];

  const filteredList = tutorials.filter((t) => {
    const matchSearch =
      !searchQuery ||
      t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = activeCategory === "All" || t.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="portal-help-container fade-in">
      {/* Header */}
      <div className="portal-help-header">
        <h2>
          <HelpCircle size={28} style={{ color: "#d4af37" }} />
          {portalTitle}
        </h2>
        <p>{portalSubtitle}</p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text-muted)" }}>
          <div className="pulse-indicator" style={{ display: "inline-flex" }}>
            <div className="pulse-dot" />
            <span>Loading tutorial guides…</span>
          </div>
        </div>
      ) : tutorials.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "var(--card-bg)",
            borderRadius: "24px",
            border: "1.5px dashed rgba(212, 175, 55, 0.3)",
          }}
        >
          <Video size={48} style={{ color: "#d4af37", opacity: 0.5, marginBottom: "16px" }} />
          <h3 style={{ margin: "0 0 8px", color: "var(--deep-brown)" }}>No Tutorial Guides Available Yet</h3>
          <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.95rem" }}>
            New video tutorials and guides will appear here soon.
          </p>
        </div>
      ) : (
        <div className="portal-help-theatre-layout">
          {/* Main Theatre Column */}
          <div className="portal-help-main-stage">
            {selectedTutorial && (
              <>
                <PremiumVideoPlayer
                  key={selectedTutorial.id || selectedTutorial.video_url}
                  videoUrl={selectedTutorial.video_url}
                  posterUrl={selectedTutorial.thumbnail_url}
                  title={selectedTutorial.title}
                  autoPlay={false}
                />

                <div className="portal-help-details-card">
                  <div className="portal-help-meta-row">
                    <span className="portal-help-category-badge">
                      <Sparkles size={13} /> {selectedTutorial.category || "Tutorial Guide"}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {selectedTutorial.created_at
                        ? new Date(selectedTutorial.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : ""}
                    </span>
                  </div>

                  <h3 className="portal-help-active-title">{selectedTutorial.title}</h3>

                  {selectedTutorial.description ? (
                    <div className="portal-help-instructions-box">
                      <h4>
                        <BookOpen size={18} style={{ color: "#d4af37" }} />
                        Instructions & Steps
                      </h4>
                      <p className="portal-help-desc-content">{selectedTutorial.description}</p>
                    </div>
                  ) : (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontStyle: "italic" }}>
                      Watch the video above for the full step-by-step walkthrough.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Column: Playlist & Search */}
          <div className="portal-help-playlist-card">
            <div className="portal-help-playlist-header">
              <h3>
                <PlayCircle size={20} style={{ color: "#d4af37" }} />
                Video Library ({tutorials.length})
              </h3>
            </div>

            {/* Search Input */}
            <input
              type="text"
              className="portal-help-search-input"
              placeholder="Search video guides…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Category Filter Pills */}
            {categories.length > 2 && (
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  overflowX: "auto",
                  paddingBottom: "10px",
                  marginBottom: "8px",
                }}
              >
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    style={{
                      background: activeCategory === c ? "rgba(212, 175, 55, 0.2)" : "rgba(0, 0, 0, 0.04)",
                      border: activeCategory === c ? "1px solid #d4af37" : "1px solid transparent",
                      color: activeCategory === c ? "#d4af37" : "var(--text-muted)",
                      padding: "4px 10px",
                      borderRadius: "14px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => setActiveCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {/* List of Videos */}
            <div className="portal-help-playlist-items">
              {filteredList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No video guides match your search.
                </div>
              ) : (
                filteredList.map((item) => {
                  const isSelected = selectedTutorial?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`portal-help-item-row ${isSelected ? "active" : ""}`}
                      onClick={() => {
                        setSelectedTutorial(item);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <div className="portal-help-item-thumb">
                        {item.thumbnail_url ? (
                          <img src={item.thumbnail_url} alt={item.title} />
                        ) : (
                          <div className="portal-help-item-thumb-placeholder">
                            <Video size={20} />
                          </div>
                        )}
                        {isSelected && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              background: "rgba(212, 175, 55, 0.4)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                            }}
                          >
                            <PlayCircle size={22} fill="currentColor" />
                          </div>
                        )}
                      </div>

                      <div className="portal-help-item-info">
                        <span className="portal-help-item-cat">{item.category || "Guide"}</span>
                        <h4 className="portal-help-item-title" title={item.title}>{item.title}</h4>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", color: isSelected ? "#d4af37" : "var(--text-muted)" }}>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
