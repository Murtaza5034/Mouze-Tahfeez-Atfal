import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import { Smartphone, X, CheckCircle2, ExternalLink, Sparkles, Shield, Clock } from "lucide-react";

const LS_KEY = "mauze-dismissed-app-update";
const FORCE_DELAY_MS = 10 * 60 * 1000;

export default function AppUpdatePopup() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  const [isForceTime, setIsForceTime] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const forceTimerRef = useRef(null);
  const countdownRef = useRef(null);

  const getDismissedVersion = () => {
    try {
      return localStorage.getItem(LS_KEY) || "";
    } catch { return ""; }
  };

  const setDismissedVersion = (version) => {
    try { localStorage.setItem(LS_KEY, version); } catch {}
  };

  const getCurrentVersion = () => {
    try {
      if (typeof __APP_VERSION__ !== "undefined") return __APP_VERSION__;
    } catch {}
    return "1.0.0";
  };

  const getCurrentVersionCode = () => {
    try {
      if (typeof __APP_VERSION_CODE__ !== "undefined") return __APP_VERSION_CODE__;
    } catch {}
    return 0;
  };

  const checkForUpdate = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_releases")
        .select("version_name, version_code, release_notes, created_at, force_update")
        .eq("status", "live")
        .eq("console_status", "published")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // Handle missing table/missing column errors gracefully (e.g., migration not run)
        if (
          error.code === "PGRST116" ||
          error.message?.includes("does not exist") ||
          error.code === "42P01" ||
          error.code === "42703" ||
          error.status === 400 ||
          error.status === 404
        ) {
          console.warn("AppUpdatePopup: app_releases table not ready yet (migrations may need to run)");
          setDismissed(true); return;
        }
        console.warn("AppUpdatePopup: Unexpected error checking for update:", error);
        setDismissed(true); return;
      }

      if (!data || !data.version_name) {
        setDismissed(true); return;
      }

      const currentCode = getCurrentVersionCode();
      const liveCode = parseInt(data.version_code, 10) || 0;

      if (liveCode <= currentCode) {
        setDismissed(true); return;
      }

      const currentDismissed = getDismissedVersion();
      if (data.version_name === currentDismissed && !data.force_update) {
        setDismissed(true); return;
      }

      setUpdateInfo(data);

      const liveTime = data.created_at ? new Date(data.created_at).getTime() : Date.now();
      const forceTime = liveTime + FORCE_DELAY_MS;
      const now = Date.now();
      const remaining = forceTime - now;

      if (remaining <= 0) {
        setIsForceTime(true);
        setDismissed(false);
      } else {
        setIsForceTime(false);
        setDismissed(false);

        forceTimerRef.current = setTimeout(() => {
          setIsForceTime(true);
        }, remaining);

        countdownRef.current = setInterval(() => {
          const r = forceTime - Date.now();
          if (r <= 0) {
            clearInterval(countdownRef.current);
            setTimeLeft(0);
          } else {
            setTimeLeft(r);
          }
        }, 1000);
      }
    } catch (err) {
      console.warn("AppUpdatePopup: Error checking for update:", err);
      setDismissed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkForUpdate, 2000);
    return () => {
      clearTimeout(timer);
      clearTimeout(forceTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [checkForUpdate]);

  const handleDismiss = () => {
    if (updateInfo) setDismissedVersion(updateInfo.version_name);
    setDismissed(true);
  };

  const handleUpdate = () => {
    if (updateInfo) setDismissedVersion(updateInfo.version_name);
    setDismissed(true);
    window.open("https://play.google.com/store/apps/details?id=com.mauzetahfeez.myapp", "_blank");
  };

  if (dismissed || loading || !updateInfo) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const formatCountdown = (ms) => {
    if (ms <= 0) return "0:00";
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`app-update-popup-overlay ${isForceTime ? "force" : ""}`} style={{ zIndex: 99999 }}>
      <div className="app-update-popup-card" onClick={(e) => e.stopPropagation()}>
        {!isForceTime && (
          <button className="app-update-popup-close" onClick={handleDismiss} aria-label="Dismiss">
            <X size={22} />
          </button>
        )}

        <div className="app-update-popup-header">
          <div className="app-update-popup-badge" style={{ background: isForceTime ? "linear-gradient(135deg, #ef4444, #dc2626)" : undefined }}>
            {isForceTime ? "FORCED UPDATE" : "NEW RELEASE"}
          </div>
          <div className="app-update-popup-icon-row">
            <div className={`app-update-popup-icon-circle ${isForceTime ? "force" : ""}`}>
              {isForceTime ? <Shield size={36} /> : <Smartphone size={36} />}
            </div>
            <Sparkles size={22} className="app-update-popup-sparkle-left" />
            <Sparkles size={18} className="app-update-popup-sparkle-right" />
          </div>
          <h2 className="app-update-popup-title">
            {isForceTime ? "Mandatory Update Required" : "Update Available"}
          </h2>
          <p className="app-update-popup-subtitle">
            {isForceTime
              ? "You must update to the latest version to continue using the app. This screen cannot be dismissed."
              : "A new version of Mauze Tahfeez Atfal is ready."}
          </p>
        </div>

        {!isForceTime && timeLeft > 0 && (
          <div className="app-update-popup-countdown">
            <Clock size={14} />
            <span>Force update in <strong>{formatCountdown(timeLeft)}</strong></span>
            <div className="app-update-popup-countdown-bar">
              <div className="app-update-popup-countdown-fill" style={{ width: `${(timeLeft / FORCE_DELAY_MS) * 100}%` }} />
            </div>
          </div>
        )}

        <div className="app-update-popup-body">
          <div className="app-update-popup-version-row">
            <div className="app-update-popup-version-badge">
              <span className="app-update-popup-version-label">Version</span>
              <span className="app-update-popup-version-value">
                v{updateInfo.version_name}
                {updateInfo.version_code && (
                  <span className="app-update-popup-version-code">(code {updateInfo.version_code})</span>
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

        <div className="app-update-popup-footer">
          <button className="app-update-popup-btn-primary" onClick={handleUpdate}>
            <ExternalLink size={20} />
            Update Now
          </button>
          {!isForceTime && (
            <button className="app-update-popup-btn-secondary" onClick={handleDismiss}>
              Maybe Later
            </button>
          )}
        </div>

        {isForceTime && (
          <p className="app-update-popup-block-note">
            The app will be blocked until you update. Please tap "Update Now" to continue.
          </p>
        )}
      </div>
    </div>
  );
}
