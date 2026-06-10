import React, { useState, useEffect, useCallback } from "react";
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
  ExternalLink,
  Trash2,
  FileArchive,
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
  deploying: { label: "Deploying...", icon: Loader2, color: "#d4af37" },
  live: { label: "Live ✓", icon: CheckCircle2, color: "#22c55e" },
  failed: { label: "Failed ✗", icon: XCircle, color: "#ef4444" },
};

export default function AppUpdateManager({ onBroadcastNotification }) {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);

  // Form state
  const [selectedTrack, setSelectedTrack] = useState("internal");
  const [selectedFile, setSelectedFile] = useState(null);
  const [versionName, setVersionName] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [deployError, setDeployError] = useState("");
  const [deployMessage, setDeployMessage] = useState("");

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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setDeployError("");

    // Auto-extract version info from filename if possible
    // Typical naming: app-release-v1.0.1-3.aab or app-release-1.0.1.aab
    const nameMatch = file.name.match(/v?(\d+\.\d+\.\d+)/i);
    if (nameMatch && !versionName) {
      setVersionName(nameMatch[1]);
    }
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
      `Are you sure you want to deploy "${selectedFile.name}" (v${versionName}, code ${versionCode}) to the "${PLAY_TRACKS.find(t => t.id === selectedTrack)?.label}" track?\n\nThis will release the app to users immediately.`
    );

    if (!confirmed) return;

    setDeploying(true);

    try {
      const formData = new FormData();
      formData.append("aab", selectedFile);
      formData.append("track", selectedTrack);
      formData.append("versionName", versionName.trim());
      formData.append("versionCode", parseInt(versionCode, 10).toString());
      formData.append("releaseNotes", releaseNotes.trim());

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in to deploy.");
      }

      // Use native fetch for FormData — supabase.functions.invoke doesn't
      // set the correct Content-Type (multipart/form-data with boundary).
      const functionUrl = `${supabaseUrl}/functions/v1/deploy-android-app`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Deploy failed (${response.status})`);
      }

      setDeployMessage(data.message || "App deployed successfully!");

      // Send push notification to all users about the new app version
      const trackLabel = PLAY_TRACKS.find(t => t.id === selectedTrack)?.label || selectedTrack;
      const notesPreview = releaseNotes.trim()
        ? `\n\nWhat's new:\n${releaseNotes.trim()}`
        : "";

      if (typeof onBroadcastNotification === "function") {
        try {
          await onBroadcastNotification(
            `📱 New App Update — v${versionName.trim()}`,
            `A new version (${versionName.trim()}) has been deployed to the ${trackLabel} track. Please update your app from the Google Play Store to get the latest features and improvements.${notesPreview}`,
            "all",
            null,
            "Home",
            false
          );
        } catch (notifErr) {
          console.warn("Failed to send update notification:", notifErr);
        }
      }

      // Reset form
      setSelectedFile(null);
      setVersionName("");
      setVersionCode("");
      setReleaseNotes("");

      // Refresh history
      await loadReleases();
    } catch (err) {
      console.error("Deploy error:", err);
      setDeployError(err.message || "Deployment failed. Check console for details.");
    } finally {
      setDeploying(false);
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

  const latestRelease = releases[0];

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

      {/* Deploy Form */}
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
            <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr", display: "grid", gap: "16px" }}>
              <label className="form-group">
                <span>Version Name</span>
                <input
                  type="text"
                  className="premium-input"
                  placeholder="e.g. 1.0.2"
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
                  placeholder="e.g. 4"
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
                onClick={() => document.getElementById("aab-file-input")?.click()}
              >
                <input
                  id="aab-file-input"
                  type="file"
                  accept=".aab"
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />
                {selectedFile ? (
                  <div className="file-selected-info">
                    <FileArchive size={32} style={{ color: "var(--primary-gold)" }} />
                    <div>
                      <strong>{selectedFile.name}</strong>
                      <br />
                      <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <button
                      type="button"
                      className="clear-file-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="file-drop-placeholder">
                    <Upload size={32} style={{ opacity: 0.4, color: "var(--primary-gold)" }} />
                    <p>Click to select an AAB file</p>
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
                  Deploying to {PLAY_TRACKS.find(t => t.id === selectedTrack)?.label}...
                </>
              ) : (
                <>
                  <Rocket size={22} />
                  Deploy to {PLAY_TRACKS.find(t => t.id === selectedTrack)?.label}
                </>
              )}
            </button>
          </form>
        </section>

        {/* Release History */}
        <section className="data-card card-appear">
          <div className="card-headline">
            <History size={20} />
            <h3>Release History</h3>
          </div>

          {loading ? (
            <div className="loading-container" style={{ padding: "40px", textAlign: "center" }}>
              <Loader2 size={32} className="spin" style={{ color: "var(--primary-gold)" }} />
              <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>Loading release history...</p>
            </div>
          ) : releases.length === 0 ? (
            <div className="empty-history" style={{ padding: "40px", textAlign: "center" }}>
              <Package size={48} style={{ opacity: 0.15, color: "var(--primary-gold)", marginBottom: "12px" }} />
              <p style={{ color: "var(--text-muted)" }}>No releases yet. Deploy your first AAB above!</p>
            </div>
          ) : (
            <div className="release-list" style={{ maxHeight: "500px", overflowY: "auto" }}>
              {releases.map((release, idx) => {
                const StatusIcon = STATUS_CONFIG[release.status]?.icon || Clock;
                const statusColor = STATUS_CONFIG[release.status]?.color || "#8a786a";

                return (
                  <div
                    key={release.id}
                    className="release-item"
                    style={{
                      padding: "16px",
                      borderRadius: "14px",
                      background: idx === 0 ? "var(--light-gold)" : "var(--off-white)",
                      border: `1px solid ${idx === 0 ? "var(--primary-gold)" : "var(--glass-border)"}`,
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
                          <span style={{
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
                          }}>
                            {PLAY_TRACKS.find(t => t.id === release.track)?.label || release.track}
                          </span>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "0.75rem",
                            color: statusColor,
                            fontWeight: 600,
                          }}>
                            <StatusIcon size={14} />
                            {STATUS_CONFIG[release.status]?.label || release.status}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                          <span>Code: {release.version_code}</span>
                          {release.bundle_version_code && (
                            <span>Bundle: {release.bundle_version_code}</span>
                          )}
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={12} />
                            {formatDate(release.created_at)}
                          </span>
                        </div>
                        {release.release_notes && (
                          <p style={{
                            margin: "8px 0 0",
                            fontSize: "0.85rem",
                            color: "var(--soft-brown)",
                            lineHeight: 1.4,
                            fontStyle: "italic",
                          }}>
                            {release.release_notes}
                          </p>
                        )}
                        {release.error_message && (
                          <p style={{
                            margin: "6px 0 0",
                            fontSize: "0.8rem",
                            color: "#ef4444",
                          }}>
                            Error: {release.error_message}
                          </p>
                        )}
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
          <p>To enable automatic deployment, you need to set up the following in Supabase:</p>
          <ol style={{ paddingLeft: "20px", marginTop: "8px" }}>
            <li>
              <strong>Google Play Service Account:</strong> Create a service account in Google Cloud Console,
              grant it access to your Google Play Console, and download the JSON key.
            </li>
            <li>
              <strong>Add Secrets to Supabase:</strong>
              <code style={{ display: "block", background: "#f5f0e8", padding: "8px 12px", borderRadius: "8px", margin: "4px 0", fontSize: "0.8rem" }}>
                supabase secrets set GOOGLE_PLAY_SERVICE_ACCOUNT_KEY='{"{"}"your-json-key"{"}"}'
                <br />
                supabase secrets set GOOGLE_PLAY_PACKAGE_NAME='com.mauzetahfeez.myapp'
              </code>
            </li>
            <li>
              <strong>Deploy the Edge Function:</strong>
              <code style={{ display: "block", background: "#f5f0e8", padding: "8px 12px", borderRadius: "8px", margin: "4px 0", fontSize: "0.8rem" }}>
                supabase functions deploy deploy-android-app --no-verify-jwt
              </code>
            </li>
            <li>
              <strong>Run the migration:</strong> Execute the SQL migration file at<br />
              <code>supabase/migrations/20260608000000_create_app_releases.sql</code> in the Supabase SQL Editor.
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
