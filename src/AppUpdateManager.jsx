import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, supabaseUrl } from "./supabaseClient";
import {
  Upload,
  Smartphone,
  Rocket,
  History,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Clock,
  Package,
  Hash,
  Trash2,
  FileArchive,
  RefreshCw,
  Play,
  Send,
  Globe,
} from "lucide-react";

const PLAY_TRACKS = [
  { id: "internal", label: "Internal Testing", description: "Only internal testers in your Google Play Console" },
  { id: "alpha", label: "Closed Alpha", description: "Closed alpha testers" },
  { id: "beta", label: "Open Beta", description: "Open beta testers" },
  { id: "production", label: "Production", description: "Public production release" },
];

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, color: "#8a786a" },
  uploading: { label: "Uploading", icon: Loader2, color: "#d4af37" },
  deploying: { label: "Deploying…", icon: Loader2, color: "#d4af37" },
  live: { label: "Live ✓", icon: CheckCircle2, color: "#22c55e" },
  failed: { label: "Failed ✗", icon: XCircle, color: "#ef4444" },
};

const DEPLOY_STAGES = [
  "Uploading AAB…",
  "Creating Play Store edit…",
  "Uploading bundle to Google Play…",
  "Assigning to track…",
  "Committing release…",
];

export default function AppUpdateManager({ onBroadcastNotification }) {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [deployStage, setDeployStage] = useState(-1);
  const [deletingId, setDeletingId] = useState(null);
  const [consoleUpdating, setConsoleUpdating] = useState(null);

  // Form state
  const [selectedTrack, setSelectedTrack] = useState("internal");
  const [selectedFile, setSelectedFile] = useState(null);
  const [versionName, setVersionName] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [deployError, setDeployError] = useState("");
  const [deployMessage, setDeployMessage] = useState("");
  const fileInputRef = useRef(null);

  const loadReleases = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_releases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setReleases(data || []);
    } catch (err) {
      console.error("Failed to load releases:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReleases();
  }, [loadReleases]);

  // Auto-suggest version name and code from latest release
  useEffect(() => {
    if (releases.length > 0 && !versionName && !versionCode) {
      const latest = releases.find((r) => r.status === "live") || releases[0];
      if (latest) {
        // Suggest next patch version
        const parts = (latest.version_name || "1.0.0").split(".").map(Number);
        if (parts.length === 3) {
          parts[2] += 1;
          setVersionName(parts.join("."));
        } else {
          setVersionName(latest.version_name);
        }
        // Suggest next version code
        if (latest.version_code) {
          setVersionCode(String(latest.version_code + 1));
        }
      }
    }
  }, [releases]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setDeployError("");
    setDeployMessage("");

    // Auto-extract version info from filename if possible
    const nameMatch = file.name.match(/v?(\d+\.\d+\.\d+)/i);
    if (nameMatch && !versionName) {
      setVersionName(nameMatch[1]);
    }
  };

  const handleDeleteRelease = async (releaseId) => {
    if (!window.confirm("Delete this release record?")) return;
    try {
      setDeletingId(releaseId);
      const { error } = await supabase
        .from("app_releases")
        .delete()
        .eq("id", releaseId);
      if (error) throw error;
      setReleases((prev) => prev.filter((r) => r.id !== releaseId));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetry = async (release) => {
    // Pre-fill form with the failed release data
    setSelectedFile(null);
    setVersionName(release.version_name || "");
    setVersionCode(String(release.version_code || ""));
    setSelectedTrack(release.track || "internal");
    setReleaseNotes(release.release_notes || "");
    setDeployError("");
    setDeployMessage("");

    // Delete the old failed record
    try {
      await supabase.from("app_releases").delete().eq("id", release.id);
      setReleases((prev) => prev.filter((r) => r.id !== release.id));
    } catch (_) {
      // Ignore delete errors on retry
    }

    // Scroll to form
    document.querySelector(".app-update-manager .form-card")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDeploy = async () => {
    setDeployError("");
    setDeployMessage("");

    if (!selectedFile) {
      setDeployError("Please select an AAB file first.");
      return;
    }

    if (!versionName.trim()) {
      setDeployError("Please enter a version name (e.g., 1.0.2).");
      return;
    }

    if (!versionCode || isNaN(parseInt(versionCode, 10))) {
      setDeployError("Please enter a valid version code (integer).");
      return;
    }

    const confirmed = window.confirm(
      `Deploy "${selectedFile.name}" (v${versionName.trim()}, code ${versionCode}) to "${PLAY_TRACKS.find((t) => t.id === selectedTrack)?.label}" track?\n\nThis will upload the AAB to Google Play and release it.`
    );

    if (!confirmed) return;

    setDeploying(true);
    setDeployStage(0);

    let stageTimer1, stageTimer2, stageTimer3, stageTimer4;
    const clearStageTimers = () => {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);
      clearTimeout(stageTimer4);
    };

    try {
      const formData = new FormData();
      formData.append("aab", selectedFile);
      formData.append("track", selectedTrack);
      formData.append("versionName", versionName.trim());
      formData.append("versionCode", parseInt(versionCode, 10).toString());
      formData.append("releaseNotes", releaseNotes.trim());

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in to deploy.");
      }

      // Simulate stage progression for better UX
      stageTimer1 = setTimeout(() => setDeployStage(1), 3000);
      stageTimer2 = setTimeout(() => setDeployStage(2), 8000);
      stageTimer3 = setTimeout(() => setDeployStage(3), 15000);
      stageTimer4 = setTimeout(() => setDeployStage(4), 20000);

      const functionUrl = `${supabaseUrl}/functions/v1/deploy-android-app`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      clearStageTimers();

      let data;
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Server returned an invalid response (${response.status}). Check Supabase Edge Function logs and ensure GOOGLE_PLAY_SERVICE_ACCOUNT_KEY is set correctly.`
        );
      }

      if (!response.ok) {
        throw new Error(data.error || `Deploy failed (${response.status})`);
      }

      setDeployStage(-1);
      setDeployMessage(data.message || "App deployed successfully!");

      // Reset form
      setSelectedFile(null);
      setVersionName("");
      setVersionCode("");
      setReleaseNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Refresh history
      await loadReleases();
    } catch (err) {
      clearStageTimers();
      console.error("Deploy error:", err);
      setDeployError(err.message || "Deployment failed. Check console for details.");
    } finally {
      setDeploying(false);
      setDeployStage(-1);
    }
  };

  const handleSubmitForReview = async (release) => {
    if (!window.confirm(`Submit v${release.version_name} (${release.track}) for review? This simulates sending to Google Play Console for review.`)) return;
    try {
      setConsoleUpdating(release.id);
      const { error } = await supabase
        .from("app_releases")
        .update({ console_status: "in_review" })
        .eq("id", release.id);
      if (error) throw error;
      await loadReleases();
    } catch (err) {
      alert("Failed to update console status: " + err.message);
    } finally {
      setConsoleUpdating(null);
    }
  };

  const handlePublish = async (release) => {
    if (!window.confirm(`Publish v${release.version_name} to Production (set as live)? Users will see a force update after 10 minutes.`)) return;
    try {
      setConsoleUpdating(release.id);
      const { error } = await supabase
        .from("app_releases")
        .update({ console_status: "published", status: "live" })
        .eq("id", release.id);
      if (error) throw error;
      await loadReleases();

      // Send notification only after publishing (NOT on upload)
      const trackLabel = PLAY_TRACKS.find((t) => t.id === release.track)?.label || release.track;
      const notesPreview = release.release_notes
        ? `\n\nWhat's new:\n${release.release_notes}`
        : "";

      if (typeof onBroadcastNotification === "function") {
        try {
          await onBroadcastNotification(
            `📱 New App Update — v${release.version_name}`,
            `A new version (${release.version_name}) is now available on the Google Play Store. Please update your app to continue.${notesPreview}`,
            "all",
            null,
            "Home",
            false
          );
        } catch (notifErr) {
          console.warn("Failed to send update notification:", notifErr);
        }
      }
    } catch (err) {
      alert("Failed to publish: " + err.message);
    } finally {
      setConsoleUpdating(null);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const latestRelease = releases.find((r) => r.status === "live") || releases[0];

  return (
    <div className="app-update-manager fade-in">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: "28px" }}>
        <div className="headline-with-action">
          <div className="headline-left">
            <Smartphone size={28} style={{ color: "var(--primary-gold)" }} />
            <div>
              <h2 className="premium-title" style={{ margin: 0 }}>App Release Manager</h2>
              <p className="subtitle" style={{ margin: "4px 0 0" }}>
                Deploy Android App Bundles (AAB) directly to Google Play
              </p>
            </div>
          </div>
          <button
            className="action-button"
            onClick={loadReleases}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "12px",
              background: "var(--off-white)",
              border: "1px solid var(--glass-border)",
              color: "var(--soft-brown)",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Current live version */}
      {latestRelease && latestRelease.status === "live" && (
        <div className="status-banner success" style={{ marginBottom: "24px" }}>
          <CheckCircle2 size={20} />
          <div>
            <strong>Current live release:</strong> v{latestRelease.version_name} (code {latestRelease.version_code}) on{" "}
            {PLAY_TRACKS.find((t) => t.id === latestRelease.track)?.label || latestRelease.track} track
            <span style={{ opacity: 0.7, marginLeft: "12px", fontSize: "0.85rem" }}>
              — {formatDate(latestRelease.created_at)}
            </span>
          </div>
        </div>
      )}

      {/* Deploy Form + Release History side by side */}
      <div className="management-grid two-columns" style={{ marginBottom: "32px" }}>
        <section className="form-card card-appear">
          <div className="card-headline">
            <Rocket size={20} />
            <h3>Deploy New Release</h3>
          </div>

          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleDeploy();
            }}
          >
            {/* Track Selector */}
            <label className="form-group">
              <span>
                <Hash size={16} /> Release Track
              </span>
              <div className="track-selector-grid">
                {PLAY_TRACKS.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    className={`track-btn ${selectedTrack === track.id ? "active" : ""} ${track.id}`}
                    onClick={() => {
                      setSelectedTrack(track.id);
                      setDeployError("");
                    }}
                    title={track.description}
                  >
                    <span className="track-label">{track.label}</span>
                    <span className="track-desc">{track.description}</span>
                  </button>
                ))}
              </div>
            </label>

            {/* Version Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <label className="form-group">
                <span>Version Name</span>
                <input
                  type="text"
                  className="premium-input"
                  placeholder="e.g. 1.0.9"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  required
                />
              </label>
              <label className="form-group">
                <span>Version Code</span>
                <input
                  type="number"
                  className="premium-input"
                  placeholder="e.g. 12"
                  value={versionCode}
                  onChange={(e) => setVersionCode(e.target.value)}
                  required
                  min="1"
                />
              </label>
            </div>

            {/* File Upload */}
            <div className="form-group">
              <span>
                <FileArchive size={16} /> AAB File
              </span>
              <div
                className={`file-drop-zone ${selectedFile ? "has-file" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.style.borderColor = "var(--primary-gold)";
                  e.currentTarget.style.background = "var(--light-gold)";
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "";
                  e.currentTarget.style.background = "";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.style.borderColor = "";
                  e.currentTarget.style.background = "";
                  const file = e.dataTransfer.files[0];
                  if (file && file.name.endsWith(".aab")) {
                    setSelectedFile(file);
                    setDeployError("");
                    setDeployMessage("");
                    const nameMatch = file.name.match(/v?(\d+\.\d+\.\d+)/i);
                    if (nameMatch && !versionName) setVersionName(nameMatch[1]);
                  } else if (file) {
                    setDeployError("Please select a .aab file.");
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  id="aab-file-input"
                  type="file"
                  accept=".aab"
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />
                {selectedFile ? (
                  <div className="file-selected-info">
                    <FileArchive size={32} style={{ color: "var(--primary-gold)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{selectedFile.name}</strong>
                      <br />
                      <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                        {formatFileSize(selectedFile.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="clear-file-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="file-drop-placeholder">
                    <Upload size={32} style={{ opacity: 0.4, color: "var(--primary-gold)" }} />
                    <p>Click or drag to select an AAB file</p>
                    <span style={{ fontSize: "0.78rem", opacity: 0.5 }}>
                      Android App Bundle (.aab) — max 500 MB
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Release Notes */}
            <label className="form-group">
              <span>Release Notes (optional)</span>
              <textarea
                className="premium-input"
                rows={3}
                placeholder="What's new in this release?"
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </label>

            {/* Deploy Progress */}
            {deploying && deployStage >= 0 && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.03))",
                  border: "1px solid rgba(212,175,55,0.2)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                  <Loader2 size={18} className="spin" style={{ color: "var(--primary-gold)" }} />
                  <strong style={{ color: "var(--deep-brown)", fontSize: "0.9rem" }}>
                    {DEPLOY_STAGES[deployStage] || "Processing…"}
                  </strong>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {DEPLOY_STAGES.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: "4px",
                        borderRadius: "2px",
                        background: i <= deployStage ? "var(--primary-gold)" : "rgba(212,175,55,0.15)",
                        transition: "background 0.4s ease",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {deployError && (
              <div className="status-banner error" style={{ marginTop: "12px" }}>
                <AlertCircle size={18} />
                <span>{deployError}</span>
              </div>
            )}
            {deployMessage && (
              <div className="status-banner success" style={{ marginTop: "12px" }}>
                <CheckCircle2 size={18} />
                <span>{deployMessage}</span>
              </div>
            )}

            {/* Deploy Button */}
            <button
              type="submit"
              className="action-button premium deploy-btn"
              disabled={deploying || !selectedFile}
              style={{
                width: "100%",
                marginTop: "16px",
                padding: "16px",
                fontSize: "1.1rem",
                background: deploying
                  ? "var(--soft-brown)"
                  : "linear-gradient(135deg, #d4af37, #b88a1d)",
                color: "#fff",
                border: "none",
                borderRadius: "16px",
                fontWeight: 800,
                cursor: deploying || !selectedFile ? "not-allowed" : "pointer",
                opacity: deploying || !selectedFile ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                transition: "all 0.3s",
              }}
            >
              {deploying ? (
                <>
                  <Loader2 size={22} className="spin" />
                  Deploying to {PLAY_TRACKS.find((t) => t.id === selectedTrack)?.label}…
                </>
              ) : (
                <>
                  <Rocket size={22} />
                  Deploy to {PLAY_TRACKS.find((t) => t.id === selectedTrack)?.label}
                </>
              )}
            </button>
          </form>
        </section>

        {/* Console Status Management – only for un-published releases */}
        {releases.some((r) => r.console_status !== "published" && r.status === "live") && (
          <section className="form-card card-appear" style={{ marginTop: "16px" }}>
            <div className="card-headline">
              <Globe size={20} />
              <h3>Google Play Console Flow</h3>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 16px" }}>
              Manage the review &amp; publishing lifecycle from here. Press <strong>Submit</strong> after
              uploading to send for review, then <strong>Publish</strong> when approved to push live.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {releases
                .filter((r) => r.console_status !== "published")
                .slice(0, 3)
                .map((release) => {
                  const isLive = release.status === "live";
                  const cs = release.console_status || "draft";
                  return (
                    <div
                      key={release.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 16px",
                        borderRadius: "14px",
                        background: "var(--off-white)",
                        border: "1px solid var(--glass-border)",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: "0.9rem" }}>
                          v{release.version_name}
                        </strong>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "8px" }}>
                          ({release.track})
                        </span>
                        <div style={{ fontSize: "0.78rem", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            background: cs === "in_review" ? "rgba(59,130,246,0.12)" : cs === "draft" ? "rgba(168,85,247,0.10)" : "rgba(34,197,94,0.12)",
                            color: cs === "in_review" ? "#1e40af" : cs === "draft" ? "#6b21a8" : "#166534",
                          }}>
                            {cs === "in_review" ? "In Review" : cs === "published" ? "Published" : "Draft"}
                          </span>
                          {isLive && cs !== "published" && (
                            <span style={{ color: "var(--primary-gold)", fontWeight: 700 }}>
                              ● Live (not published)
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                        {cs === "draft" && (
                          <button
                            type="button"
                            className="action-button"
                            disabled={consoleUpdating === release.id}
                            onClick={() => handleSubmitForReview(release)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "10px 16px",
                              borderRadius: "12px",
                              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                              color: "#fff",
                              border: "none",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                              cursor: "pointer",
                              opacity: consoleUpdating === release.id ? 0.6 : 1,
                            }}
                          >
                            {consoleUpdating === release.id ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                            Submit for Review
                          </button>
                        )}
                        {cs === "in_review" && (
                          <button
                            type="button"
                            className="action-button"
                            disabled={consoleUpdating === release.id}
                            onClick={() => handlePublish(release)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "10px 16px",
                              borderRadius: "12px",
                              background: "linear-gradient(135deg, #22c55e, #16a34a)",
                              color: "#fff",
                              border: "none",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                              cursor: "pointer",
                              opacity: consoleUpdating === release.id ? 0.6 : 1,
                            }}
                          >
                            {consoleUpdating === release.id ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                            Publish
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* Release History */}
        <section className="data-card card-appear">
          <div className="card-headline">
            <History size={20} />
            <h3>Release History</h3>
            <span style={{
              marginLeft: "auto",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--text-muted)",
              background: "var(--off-white)",
              padding: "4px 12px",
              borderRadius: "999px",
            }}>
              {releases.length}
            </span>
          </div>

          {loading ? (
            <div className="loading-container" style={{ padding: "40px", textAlign: "center" }}>
              <Loader2 size={32} className="spin" style={{ color: "var(--primary-gold)" }} />
              <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>Loading release history…</p>
            </div>
          ) : releases.length === 0 ? (
            <div className="empty-history" style={{ padding: "40px", textAlign: "center" }}>
              <Package size={48} style={{ opacity: 0.15, color: "var(--primary-gold)", marginBottom: "12px" }} />
              <p style={{ color: "var(--text-muted)" }}>No releases yet. Deploy your first AAB above!</p>
            </div>
          ) : (
            <div className="release-list" style={{ maxHeight: "600px", overflowY: "auto" }}>
              {releases.map((release, idx) => {
                const StatusIcon = STATUS_CONFIG[release.status]?.icon || Clock;
                const statusColor = STATUS_CONFIG[release.status]?.color || "#8a786a";
                const isFailed = release.status === "failed";
                const isLatest = idx === 0;

                return (
                  <div
                    key={release.id}
                    className="release-item"
                    style={{
                      padding: "16px",
                      borderRadius: "14px",
                      background: isLatest ? "var(--light-gold)" : "var(--off-white)",
                      border: `1px solid ${isLatest ? "var(--primary-gold)" : isFailed ? "rgba(239,68,68,0.2)" : "var(--glass-border)"}`,
                      marginBottom: "10px",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: "1rem", color: "var(--deep-brown)" }}>
                            v{release.version_name}
                          </strong>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "999px",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              background:
                                release.track === "production" ? "rgba(34,197,94,0.15)" :
                                release.track === "beta" ? "rgba(59,130,246,0.15)" :
                                release.track === "alpha" ? "rgba(234,179,8,0.15)" :
                                "rgba(168,85,247,0.15)",
                              color:
                                release.track === "production" ? "#166534" :
                                release.track === "beta" ? "#1e40af" :
                                release.track === "alpha" ? "#854d0e" :
                                "#6b21a8",
                            }}
                          >
                            {PLAY_TRACKS.find((t) => t.id === release.track)?.label || release.track}
                          </span>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.75rem",
                              color: statusColor,
                              fontWeight: 600,
                            }}
                          >
                            <StatusIcon size={14} className={release.status === "deploying" ? "spin" : ""} />
                            {STATUS_CONFIG[release.status]?.label || release.status}
                          </span>
                          {release.console_status && release.console_status !== "draft" && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: "999px",
                                background:
                                  release.console_status === "in_review" ? "rgba(59,130,246,0.10)" :
                                  release.console_status === "published" ? "rgba(34,197,94,0.10)" :
                                  "rgba(168,85,247,0.08)",
                                color:
                                  release.console_status === "in_review" ? "#3b82f6" :
                                  release.console_status === "published" ? "#22c55e" :
                                  "#8b5cf6",
                              }}
                            >
                              {release.console_status === "in_review" ? "In Review" :
                               release.console_status === "published" ? "Published" : release.console_status}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                            display: "flex",
                            gap: "16px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span>Code: {release.version_code}</span>
                          {release.bundle_version_code && (
                            <span>Bundle: {release.bundle_version_code}</span>
                          )}
                          {release.aab_file_size > 0 && (
                            <span>Size: {formatFileSize(release.aab_file_size)}</span>
                          )}
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={12} />
                            {formatDate(release.created_at)}
                          </span>
                        </div>
                        {release.aab_file_name && (
                          <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                            📦 {release.aab_file_name}
                          </p>
                        )}
                        {release.release_notes && (
                          <p
                            style={{
                              margin: "8px 0 0",
                              fontSize: "0.85rem",
                              color: "var(--soft-brown)",
                              lineHeight: 1.4,
                              fontStyle: "italic",
                            }}
                          >
                            {release.release_notes}
                          </p>
                        )}
                        {release.error_message && (
                          <p
                            style={{
                              margin: "6px 0 0",
                              fontSize: "0.8rem",
                              color: "#ef4444",
                              background: "rgba(239,68,68,0.05)",
                              padding: "8px 12px",
                              borderRadius: "8px",
                            }}
                          >
                            ❌ {release.error_message}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                        {isFailed && (
                          <button
                            type="button"
                            onClick={() => handleRetry(release)}
                            title="Retry this release"
                            style={{
                              background: "rgba(59,130,246,0.08)",
                              border: "1px solid rgba(59,130,246,0.2)",
                              color: "#3b82f6",
                              borderRadius: "10px",
                              padding: "6px 10px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              transition: "all 0.2s",
                            }}
                          >
                            <Play size={12} /> Retry
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteRelease(release.id)}
                          disabled={deletingId === release.id}
                          title="Delete release record"
                          style={{
                            background: "rgba(239,68,68,0.06)",
                            border: "1px solid rgba(239,68,68,0.12)",
                            color: "#ef4444",
                            borderRadius: "10px",
                            padding: "6px 8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s",
                            opacity: deletingId === release.id ? 0.5 : 1,
                          }}
                        >
                          {deletingId === release.id ? (
                            <Loader2 size={14} className="spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Setup Instructions */}
      <section className="form-card card-appear" style={{ marginTop: "16px" }}>
        <div className="card-headline">
          <AlertCircle size={18} />
          <h3>Prerequisites & Setup</h3>
        </div>
        <div style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "var(--soft-brown)" }}>
          <p>To enable automatic deployment, set up the following in Supabase:</p>
          <ol style={{ paddingLeft: "20px", marginTop: "8px" }}>
            <li>
              <strong>Google Play Service Account:</strong> Create a service account in Google Cloud Console,
              grant it access to your Google Play Console, and download the JSON key.
            </li>
            <li>
              <strong>Add Secrets to Supabase:</strong>
              <code
                style={{
                  display: "block",
                  background: "#f5f0e8",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  margin: "4px 0",
                  fontSize: "0.8rem",
                  whiteSpace: "pre-wrap",
                }}
              >
{`supabase secrets set GOOGLE_PLAY_SERVICE_ACCOUNT_KEY='{"your-json-key"}'
supabase secrets set GOOGLE_PLAY_PACKAGE_NAME='com.mauzetahfeez.myapp'`}
              </code>
            </li>
            <li>
              <strong>Deploy the Edge Function:</strong>
              <code
                style={{
                  display: "block",
                  background: "#f5f0e8",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  margin: "4px 0",
                  fontSize: "0.8rem",
                }}
              >
                supabase functions deploy deploy-android-app --no-verify-jwt
              </code>
            </li>
            <li>
              <strong>Run the migration:</strong> Execute the SQL migration file at
              <code>supabase/migrations/20260608000000_create_app_releases.sql</code> in the Supabase SQL Editor.
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
