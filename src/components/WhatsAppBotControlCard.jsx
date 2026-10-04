import React, { useState, useEffect, useCallback } from "react";
import {
  MessageCircle,
  Power,
  RefreshCw,
  QrCode,
  Key,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Send,
  Radio,
  HelpCircle,
  Activity,
  Play,
  Server,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import "./WhatsAppBotControlCard.css";

export default function WhatsAppBotControlCard({
  whatsappConfig,
  onUpdateWhatsappConfig,
  onShowAction = () => {},
}) {
  const [botData, setBotData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [starting, setStarting] = useState(false);
  const [testText, setTestText] = useState("Salam");
  const [testingMsg, setTestingMsg] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showDetailedDiagnostics, setShowDetailedDiagnostics] = useState(false);

  // Fetch Bot Status from dev proxy or local port
  const fetchStatus = useCallback(async () => {
    try {
      // Primary: dev-proxy endpoint
      let res = await fetch("/api/whatsapp-bot/status", {
        headers: { Accept: "application/json" },
      }).catch(() => null);

      // Fallback: direct localhost:2785
      if (!res || !res.ok) {
        res = await fetch("http://localhost:2785/api/status", {
          headers: { Accept: "application/json" },
        }).catch(() => null);
      }

      if (res && res.ok) {
        const json = await res.json();
        setBotData({
          ...json,
          botRunning: json.baileysStatus !== "DAEMON_OFFLINE",
          // Sync botEnabled with config if server doesn't provide
          botEnabled: typeof json.botEnabled === "boolean" ? json.botEnabled : (whatsappConfig?.enabled ?? true),
        });
      } else {
        // Process offline
        setBotData({
          botRunning: false,
          baileysStatus: "DAEMON_OFFLINE",
          botEnabled: whatsappConfig?.enabled ?? false,
          helpline: "+91 81079 25353",
          reason: "Bot process on port 2785 is inactive",
        });
      }
    } catch (err) {
      setBotData({
        botRunning: false,
        baileysStatus: "DAEMON_OFFLINE",
        botEnabled: whatsappConfig?.enabled ?? false,
        helpline: "+91 81079 25353",
        reason: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, [whatsappConfig?.enabled]);

  useEffect(() => {
    fetchStatus();
    // Poll status every 12 seconds
    const timer = setInterval(fetchStatus, 12000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  // Master Toggle Bot ON / OFF
  const handleToggle = async () => {
    if (toggling) return;
    setToggling(true);
    const nextState = !isBotEnabled;

    try {
      // 1. Send toggle request to local bot service
      let res = await fetch("/api/whatsapp-bot/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState }),
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch("http://localhost:2785/api/toggle-bot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: nextState }),
        }).catch(() => null);
      }

      // 2. Persist to Supabase / Firestore whatsapp_config
      if (typeof onUpdateWhatsappConfig === "function") {
        await onUpdateWhatsappConfig({ enabled: nextState });
      }

      // Update local state immediately
      setBotData((prev) => ({
        ...(prev || {}),
        botEnabled: nextState,
      }));

      onShowAction(
        "success",
        nextState
          ? "WhatsApp Bot is now LIVE & ACTIVE! Inbound parent/teacher queries will be answered."
          : "WhatsApp Bot has been PAUSED (OFF). Inbound messages will be skipped."
      );
    } catch (err) {
      onShowAction("error", `Failed to toggle WhatsApp Bot: ${err.message}`);
    } finally {
      setToggling(false);
      fetchStatus();
    }
  };

  // Launch Bot Process if Stopped
  const handleStartBot = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/whatsapp-bot/start", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        onShowAction("success", "Starting WhatsApp Bot background daemon...");
        // Wait and refresh
        setTimeout(fetchStatus, 2500);
      } else {
        onShowAction("error", data.error || "Could not launch bot process.");
      }
    } catch (err) {
      onShowAction("error", `Failed to start bot: ${err.message}`);
    } finally {
      setStarting(false);
    }
  };

  // Request Pairing Code
  const handleRequestPairingCode = async () => {
    setPairingLoading(true);
    try {
      let res = await fetch("/api/whatsapp-bot/request-pairing-code", {
        method: "POST",
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch("http://localhost:2785/api/request-pairing-code", {
          method: "POST",
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.pairingCode) {
          setPairingCode(data.pairingCode);
          setShowPairingModal(true);
          onShowAction("success", `Pairing code generated: ${data.pairingCode}`);
        } else if (data.status === "CONNECTED") {
          onShowAction("success", "WhatsApp is already connected and authenticated!");
        } else {
          onShowAction("info", data.error || "Pairing code request acknowledged.");
        }
      } else {
        onShowAction("error", "Unable to request pairing code. Check if bot is running.");
      }
    } catch (err) {
      onShowAction("error", `Pairing code error: ${err.message}`);
    } finally {
      setPairingLoading(false);
    }
  };

  // Send Test Inbound Message
  const handleTestMessage = async (msgToTest = testText) => {
    if (!msgToTest) return;
    setTestingMsg(true);
    setTestResult(null);

    try {
      let res = await fetch("/api/whatsapp-bot/test-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "918107925353",
          message: msgToTest,
        }),
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch("http://localhost:2785/api/test-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: "918107925353",
            message: msgToTest,
          }),
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json();
        setTestResult({
          success: true,
          query: msgToTest,
          time: new Date().toLocaleTimeString(),
        });
        onShowAction("success", `Bot processed inbound test "${msgToTest}" successfully!`);
      } else {
        setTestResult({
          success: false,
          error: "Bot rejected test or process is offline",
        });
        onShowAction("error", "Failed to test message response.");
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message });
      onShowAction("error", `Test error: ${err.message}`);
    } finally {
      setTestingMsg(false);
    }
  };

  // Current states
  const isRunning = botData?.botRunning !== false && botData?.baileysStatus !== "DAEMON_OFFLINE";
  const isConnected = botData?.baileysStatus === "CONNECTED";
  const isWaitingQR = botData?.baileysStatus === "QR_READY";
  const isBotEnabled = Boolean(botData?.botEnabled ?? whatsappConfig?.enabled ?? true);

  // Overall status tag
  let statusTheme = "live";
  let statusText = "LIVE & RESPONDING";
  let statusBadgeIcon = <CheckCircle2 size={16} />;

  if (!isRunning) {
    statusTheme = "offline";
    statusText = "DAEMON OFFLINE (Port 2785 stopped)";
    statusBadgeIcon = <XCircle size={16} />;
  } else if (!isConnected) {
    if (isWaitingQR) {
      statusTheme = "unpaired";
      statusText = "PAIRING REQUIRED (Scan QR or enter code)";
      statusBadgeIcon = <QrCode size={16} />;
    } else {
      statusTheme = "unpaired";
      statusText = `INITIALIZING (${botData?.baileysStatus || "CONNECTING"})`;
      statusBadgeIcon = <Radio size={16} />;
    }
  } else if (!isBotEnabled) {
    statusTheme = "paused";
    statusText = "BOT PAUSED (OFF by Admin)";
    statusBadgeIcon = <AlertTriangle size={16} />;
  }

  // Diagnostic advice
  let advice = "";
  if (!isRunning) {
    advice =
      "The WhatsApp background process (Node.js script on port 2785) is not running. This is why the bot is not responding. Click 'Start Bot Service' below to launch it.";
  } else if (isWaitingQR) {
    advice =
      "The bot is running, but your WhatsApp number (+91 81079 25353) is not yet linked. Open WhatsApp on your phone -> Settings -> Linked Devices -> Scan the QR Code below or request an 8-digit Pairing Code.";
  } else if (!isBotEnabled) {
    advice =
      "WhatsApp is fully connected to +91 81079 25353, BUT the bot is currently turned OFF by the administrator toggle. Flip the Master Switch to 'ON' to resume auto-replies.";
  } else {
    advice =
      "All systems operational! The bot is active on +91 81079 25353. It will automatically answer weekly result inquiries, attendance check-ins, leave requests, and portal guides.";
  }

  return (
    <div className="wa-bot-control-card">
      <div className={`wa-bot-card-glow ${statusTheme}`} />

      {/* Header */}
      <div className="wa-bot-header">
        <div className="wa-bot-title-area">
          <div className={`wa-bot-icon-badge ${statusTheme}`}>
            <MessageCircle size={26} />
          </div>
          <div className="wa-bot-title-info">
            <h3>Mauze Tahfeez WhatsApp Assistant &amp; Bot</h3>
            <div className="wa-bot-meta-subtitle">
              <span>Helpline:</span>
              <span className="wa-bot-phone-pill">+91 81079 25353</span>
              {botData?.me?.name && (
                <span style={{ opacity: 0.75 }}>• {botData.me.name}</span>
              )}
            </div>
          </div>
        </div>

        {/* Master ON / OFF Switch */}
        <div className="wa-master-toggle-container">
          <div className="wa-toggle-label-wrap">
            <span className="wa-toggle-title">Bot Master Switch</span>
            <span
              className={`wa-toggle-status-text ${
                isBotEnabled && isRunning && isConnected ? "active" : "inactive"
              }`}
            >
              {isBotEnabled ? "● ACTIVE (Responding)" : "○ PAUSED (OFF)"}
            </span>
          </div>

          <button
            type="button"
            className={`wa-switch-button ${isBotEnabled ? "is-on" : ""}`}
            onClick={handleToggle}
            disabled={toggling}
            title={isBotEnabled ? "Turn Bot OFF" : "Turn Bot ON"}
            aria-label="Toggle WhatsApp Bot ON or OFF"
          >
            <div className="wa-switch-handle">
              <Power
                size={14}
                style={{
                  color: isBotEnabled ? "#128C7E" : "#94a3b8",
                }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      <div className={`wa-status-alert-banner ${statusTheme}`}>
        <div className="wa-banner-left">
          {statusBadgeIcon}
          <span>{statusText}</span>
        </div>
        <div className="wa-banner-actions">
          {!isRunning && (
            <button
              type="button"
              className="wa-btn wa-btn-primary"
              onClick={handleStartBot}
              disabled={starting}
            >
              <Play size={14} />
              {starting ? "Starting..." : "Start Bot Service"}
            </button>
          )}

          {isWaitingQR && (
            <button
              type="button"
              className="wa-btn wa-btn-secondary"
              onClick={handleRequestPairingCode}
              disabled={pairingLoading}
            >
              <Key size={14} />
              {pairingLoading ? "Generating..." : "Get Pairing Code"}
            </button>
          )}

          <button
            type="button"
            className="wa-btn wa-btn-secondary"
            onClick={fetchStatus}
            disabled={loading}
            title="Refresh Status"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Why is Bot not responding / not live Diagnostic Card */}
      <div className="wa-why-not-responding-box">
        <div className="wa-why-header">
          <HelpCircle size={17} style={{ color: "var(--primary-gold, #d4af37)" }} />
          <span>Status Diagnosis &amp; Health Insights:</span>
        </div>
        <div className="wa-why-explanation">{advice}</div>
      </div>

      {/* Diagnostic 4-Pill Grid */}
      <div className="wa-diagnostic-section" style={{ marginTop: "18px" }}>
        <div className="wa-diagnostic-title">
          <span>Bot Component Health</span>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "var(--soft-brown)",
              cursor: "pointer",
              fontSize: "0.8rem",
              textDecoration: "underline",
            }}
            onClick={() => setShowDetailedDiagnostics(!showDetailedDiagnostics)}
          >
            {showDetailedDiagnostics ? "Hide Details" : "View Technical Diagnostics"}
          </button>
        </div>

        <div className="wa-diagnostic-grid">
          {/* Pill 1: Daemon */}
          <div className={`wa-diag-pill ${isRunning ? "ok" : "err"}`}>
            <div className="wa-diag-pill-header">
              <span className="wa-diag-label">Process Daemon</span>
              <Server size={14} />
            </div>
            <div className="wa-diag-value">{isRunning ? "Running" : "Offline"}</div>
            <div className="wa-diag-detail">
              Port 2785 • {isRunning ? "PID Active" : "Process Inactive"}
            </div>
          </div>

          {/* Pill 2: Socket Auth */}
          <div className={`wa-diag-pill ${isConnected ? "ok" : isWaitingQR ? "warn" : "err"}`}>
            <div className="wa-diag-pill-header">
              <span className="wa-diag-label">WhatsApp Session</span>
              <Smartphone size={14} />
            </div>
            <div className="wa-diag-value">
              {isConnected ? "Connected" : isWaitingQR ? "Scan QR" : "Disconnected"}
            </div>
            <div className="wa-diag-detail">
              {isConnected
                ? "+91 81079 25353 Linked"
                : isWaitingQR
                ? "Awaiting Phone Scan"
                : "Socket not authenticated"}
            </div>
          </div>

          {/* Pill 3: Master Switch */}
          <div className={`wa-diag-pill ${isBotEnabled ? "ok" : "warn"}`}>
            <div className="wa-diag-pill-header">
              <span className="wa-diag-label">Master Switch</span>
              <Power size={14} />
            </div>
            <div className="wa-diag-value">{isBotEnabled ? "Enabled (ON)" : "Paused (OFF)"}</div>
            <div className="wa-diag-detail">
              {isBotEnabled ? "Processes parent queries" : "Inbound messages ignored"}
            </div>
          </div>

          {/* Pill 4: Cloud Listener */}
          <div className={`wa-diag-pill ${botData?.openwa ? "ok" : "warn"}`}>
            <div className="wa-diag-pill-header">
              <span className="wa-diag-label">Cloud Sync</span>
              <Activity size={14} />
            </div>
            <div className="wa-diag-value">
              {botData?.openwa ? "Real-time" : "Standard"}
            </div>
            <div className="wa-diag-detail">
              Firestore listener active • Dispatches: {botData?.dispatchesCount || 0}
            </div>
          </div>
        </div>

        {/* Extended Technical Details */}
        {showDetailedDiagnostics && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              borderRadius: "10px",
              background: "rgba(0, 0, 0, 0.03)",
              fontFamily: "monospace",
              fontSize: "0.78rem",
              color: "var(--deep-brown)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {JSON.stringify(
              {
                service: botData?.service,
                helpline: botData?.helpline,
                session: botData?.session,
                baileysStatus: botData?.baileysStatus,
                botEnabled: botData?.botEnabled,
                me: botData?.me,
                timestamp: botData?.timestamp,
              },
              null,
              2
            )}
          </div>
        )}
      </div>

      {/* QR Code / Pairing Section (Displayed when unlinked or requested) */}
      {(isWaitingQR || showPairingModal || botData?.qrDataUrl) && !isConnected && (
        <div className="wa-pairing-card">
          {botData?.qrDataUrl && (
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "6px" }}>
                Scan with WhatsApp
              </div>
              <img
                src={botData.qrDataUrl}
                alt="WhatsApp QR Code"
                className="wa-qr-img"
              />
            </div>
          )}

          <div style={{ flex: 1, minWidth: "220px" }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--deep-brown)" }}>
              Link with Phone Number (+91 81079 25353)
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--soft-brown)", margin: "6px 0 12px" }}>
              Open WhatsApp on your phone &gt; <strong>Linked Devices</strong> &gt;{" "}
              <strong>Link a Device</strong> &gt; <strong>Link with phone number instead</strong>, then enter:
            </p>

            {pairingCode ? (
              <div className="wa-pairing-code-box">{pairingCode}</div>
            ) : (
              <button
                type="button"
                className="wa-btn wa-btn-primary"
                onClick={handleRequestPairingCode}
                disabled={pairingLoading}
              >
                <Key size={14} />
                {pairingLoading ? "Generating 8-digit Code..." : "Generate 8-digit Pairing Code"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive Inbound Test Bar */}
      <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--deep-brown)" }}>
            Test Inbound Bot Response:
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Simulates a parent sending a message to verify the live reply
          </span>
        </div>

        <div className="wa-test-ping-bar">
          {["Salam", "Result", "Attendance", "Leave status", "Help"].map((preset) => (
            <button
              key={preset}
              type="button"
              className="wa-quick-preset-btn"
              onClick={() => {
                setTestText(preset);
                handleTestMessage(preset);
              }}
              disabled={testingMsg || !isRunning}
            >
              Test "{preset}"
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
          <input
            type="text"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Type any message to test (e.g. Result, Salam, Guide)..."
            className="premium-input"
            style={{ flex: 1, fontSize: "0.88rem", padding: "8px 12px" }}
            disabled={testingMsg || !isRunning}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleTestMessage();
              }
            }}
          />
          <button
            type="button"
            className="wa-btn wa-btn-primary"
            onClick={() => handleTestMessage()}
            disabled={testingMsg || !isRunning || !testText.trim()}
          >
            <Send size={14} />
            {testingMsg ? "Testing..." : "Send Test"}
          </button>
        </div>

        {testResult && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "0.8rem",
              background: testResult.success ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
              color: testResult.success ? "#166534" : "#991b1b",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            <span>
              {testResult.success
                ? `Test passed at ${testResult.time}: Bot received "${testResult.query}" and answered immediately!`
                : `Test failed: ${testResult.error}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
