import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { Smartphone, X, CheckCircle2, ExternalLink, Sparkles } from "lucide-react";

const LS_KEY = "mauze-dismissed-app-update";

/**
 * Premium App Update Popup
 *
 * Queries the `app_releases` table for the latest "live" release.
 * If a release has a version_name newer than what the user has dismissed
 * (stored in localStorage), it shows a full-screen modal inviting them
 * to update from Google Play.
 */
export default function AppUpdatePopup() {
  const [updateInfo, setUpdateInfo] = useState(null);  // { version_name, version_code, release_notes, created_at }
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(true);    // Start dismissed, re-evaluate after fetch

  const getDismissedVersion = () => {
    try {
      return localStorage.getItem(LS_KEY) || "";
    } catch {
      return "";
    }
  };

  const setDismissedVersion = (version) => {
    try {
      localStorage.setItem(LS_KEY, version);
    } catch {
      // Ignore
    }
  };

  const checkForUpdate = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_releases")
        .select("version_name, version_code, release_notes, created_at, force_update")
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // If no releases found or table doesn't exist, silently skip
        if (error.code === "PGRST116" || error.message?.includes("does not exist")) {
          setDismissed(true);
          return;
        }
        console.warn("AppUpdatePopup: Failed to fetch releases:", error);
        setDismissed(true);
        return;
      }

      if (!data || !data.version_name) {
        setDismissed(true);
        return;
      }

      const currentDismissed = getDismissedVersion();
      // Only show if this is a *different* version from what was dismissed OR if it's a forced update
      if (data.version_name !== currentDismissed || data.force_update) {
        setUpdateInfo(data);
        setDismissed(false);
      } else {
        setDismissed(true);
      }
    } catch (err) {
      console.warn("AppUpdatePopup: Error checking for update:", err);
      setDismissed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Delay check slightly to not compete with initial app load
    const timer = setTimeout(checkForUpdate, 2000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  const handleDismiss = () => {
    if (updateInfo?.force_update) return; // Prevent dismissal if mandatory
    if (updateInfo) {
      setDismissedVersion(updateInfo.version_name);
    }
    setDismissed(true);
  };

  const handleUpdate = () => {
    // Track that we've shown this version
    if (updateInfo) {
      setDismissedVersion(updateInfo.version_name);
    }
    setDismissed(true);
    // Open Play Store app page
    window.open("https://play.google.com/store/apps/details?id=com.mauzetahfeez.myapp", "_blank");
  };

  // Don't render anything if dismissed, loading, or no update
  if (dismissed || loading || !updateInfo) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="app-update-popup-overlay" onClick={handleDismiss}>
      <div className="app-update-popup-card" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        {!updateInfo.force_update && (
          <button className="app-update-popup-close" onClick={handleDismiss} aria-label="Dismiss">
            <X size={22} />
          </button>
        )}

        {/* Header section */}
        <div className="app-update-popup-header">
          <div className="app-update-popup-badge">NEW RELEASE</div>
          <div className="app-update-popup-icon-row">
            <div className="app-update-popup-icon-circle">
              <Smartphone size={36} />
            </div>
            <Sparkles size={22} className="app-update-popup-sparkle-left" />
            <Sparkles size={18} className="app-update-popup-sparkle-right" />
          </div>
          <h2 className="app-update-popup-title">
            {updateInfo.force_update ? "Mandatory Update Required" : "Update Available"}
          </h2>
          <p className="app-update-popup-subtitle">
            {updateInfo.force_update 
              ? "You must update to the latest version to continue using the app."
              : "A new version of Mauze Tahfeez Atfal is ready."}
          </p>
        </div>

        {/* Body */}
        <div className="app-update-popup-body">
          <div className="app-update-popup-version-row">
            <div className="app-update-popup-version-badge">
              <span className="app-update-popup-version-label">Version</span>
              <span className="app-update-popup-version-value">
                v{updateInfo.version_name}
                {updateInfo.version_code && (
                  <span className="app-update-popup-version-code">
                    (code {updateInfo.version_code})
                  </span>
                )}
              </span>
            </div>
            {updateInfo.created_at && (
              <span className="app-update-popup-date">
                <CheckCircle2 size={14} />
                {formatDate(updateInfo.created_at)}
              </span>
            )}
          </div>

          {updateInfo.release_notes && (
            <div className="app-update-popup-notes">
              <strong>What's New</strong>
              <p className="app-update-popup-notes-text">{updateInfo.release_notes}</p>
            </div>
          )}

          <div className="app-update-popup-features">
            <div className="app-update-popup-feature-item">
              <CheckCircle2 size={18} />
              <span>Bug fixes & performance improvements</span>
            </div>
            <div className="app-update-popup-feature-item">
              <CheckCircle2 size={18} />
              <span>Enhanced user experience</span>
            </div>
            <div className="app-update-popup-feature-item">
              <CheckCircle2 size={18} />
              <span>Latest features from the team</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="app-update-popup-footer">
          <button className="app-update-popup-btn-primary" onClick={handleUpdate}>
            <ExternalLink size={20} />
            Update Now
          </button>
          {!updateInfo.force_update && (
            <button className="app-update-popup-btn-secondary" onClick={handleDismiss}>
              Maybe Later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
