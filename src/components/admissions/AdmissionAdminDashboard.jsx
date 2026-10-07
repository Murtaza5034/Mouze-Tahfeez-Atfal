import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  RotateCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Mail,
  Phone,
  Calendar,
  Award,
  MapPin,
  History,
  Settings,
  Layers,
  Bot,
  Send,
  Check,
  Building,
  GraduationCap,
  Copy,
  ExternalLink,
  UserCheck,
  UserX,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchAdmissionApplications,
  updateAdmissionStatus,
  exitAdmissionUser,
  resumeAdmissionUser
} from "../../services/admissionService";
import AdmissionCmsSettings from "./AdmissionCmsSettings";
import "./AdmissionStyles.css";

export default function AdmissionAdminDashboard({
  defaultRole = "super_admin",
  currentUser = "Admin",
  onBackToMain = () => {}
}) {
  const [activeRole, setActiveRole] = useState(
    defaultRole === "kibar_admin" ? "kibar" : defaultRole === "atfal_admin" ? "atfal" : "super"
  );

  const [activeTab, setActiveTab] = useState(
    defaultRole === "kibar_admin" ? "kibar" : defaultRole === "atfal_admin" ? "atfal" : "all"
  );

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // WhatsApp Bot Simulator
  const [showBotModal, setShowBotModal] = useState(false);
  const [botTestPhone, setBotTestPhone] = useState("");
  const [botTestReply, setBotTestReply] = useState("Yes");
  const [botSimOutput, setBotSimOutput] = useState(null);
  const [botSimLoading, setBotSimLoading] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdmissionApplications();
      if (res.success && Array.isArray(res.data)) {
        setApplications(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Applications according to active role, subtab, statusFilter and search
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // Exit list tab
      if (activeTab === "exit_list") {
        if (app.status !== "exited") return false;
        if (activeRole === "kibar") return app.program === "Al-Kibar (Adults)" || app.program?.toLowerCase().includes("kibar");
        if (activeRole === "atfal") return app.program?.toLowerCase().includes("atfal") || app.program?.toLowerCase().includes("sigar");
        return true;
      }

      // Hide exited unless on exit list
      if (app.status === "exited") return false;

      // Role & Tab filtering
      if (activeRole === "kibar") {
        if (app.program !== "Al-Kibar (Adults)" && !app.program?.toLowerCase().includes("kibar")) return false;
      } else if (activeRole === "atfal") {
        if (activeTab === "general_sigar" || activeTab === "sigar") {
          if (app.program !== "Al-Sigar (4 to 6 yrs old)" && !app.program?.toLowerCase().includes("sigar")) return false;
        } else if (activeTab === "atfal") {
          if (app.program !== "Al-Atfal (7 to 15 yrs old)" && !app.program?.toLowerCase().includes("atfal")) return false;
        } else if (activeTab === "all") {
          if (app.program === "Al-Kibar (Adults)" || app.program?.toLowerCase().includes("kibar")) return false;
        }
      } else {
        if (activeTab === "kibar" && app.program !== "Al-Kibar (Adults)" && !app.program?.toLowerCase().includes("kibar")) return false;
        if (activeTab === "atfal" && app.program !== "Al-Atfal (7 to 15 yrs old)" && !app.program?.toLowerCase().includes("atfal")) return false;
        if (activeTab === "sigar" && app.program !== "Al-Sigar (4 to 6 yrs old)" && !app.program?.toLowerCase().includes("sigar")) return false;
      }

      // Status filter
      if (statusFilter !== "all" && app.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          app.full_name?.toLowerCase().includes(q) ||
          app.its_number?.includes(q) ||
          app.whatsapp_number?.includes(q) ||
          app.email?.toLowerCase().includes(q) ||
          app.application_id?.toLowerCase().includes(q) ||
          app.jamaat?.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [applications, activeRole, activeTab, statusFilter, searchQuery]);

  // Overall & Scoped metrics
  const stats = useMemo(() => {
    let scoped = applications;
    if (activeRole === "kibar") {
      scoped = scoped.filter((a) => a.program === "Al-Kibar (Adults)" || a.program?.toLowerCase().includes("kibar"));
    } else if (activeRole === "atfal") {
      scoped = scoped.filter(
        (a) => a.program?.toLowerCase().includes("atfal") || a.program?.toLowerCase().includes("sigar")
      );
    }

    return {
      total: scoped.filter((a) => a.status !== "exited").length,
      pending: scoped.filter((a) => a.status === "pending").length,
      approved: scoped.filter((a) => a.status === "approved").length,
      waiting: scoped.filter((a) => a.status === "waiting").length,
      rejected: scoped.filter((a) => a.status === "rejected").length,
      exited: scoped.filter((a) => a.status === "exited").length
    };
  }, [applications, activeRole]);

  // Instant status change with immediate optimistic state update
  const handleStatusChange = async (appId, newStatus) => {
    setActionLoadingId(appId);
    const timestamp = new Date().toISOString();

    // 1. Optimistic Local State Update (Instant UI shift)
    setApplications((prev) =>
      prev.map((item) => {
        if (item.application_id === appId) {
          const prevStatus = item.status;
          let newEnrolled = item.enrolled_count || 0;
          if (newStatus === "approved" && prevStatus !== "approved") {
            newEnrolled += 1;
          }
          const newLog = {
            id: `log_${Date.now()}`,
            action: newStatus,
            from_status: prevStatus,
            to_status: newStatus,
            timestamp,
            actor: currentUser,
            note: `Status updated to ${newStatus}`
          };
          const existingLogs = Array.isArray(item.timeline_audit_log) ? item.timeline_audit_log : [];
          return {
            ...item,
            status: newStatus,
            enrolled_count: newEnrolled,
            timeline_audit_log: [newLog, ...existingLogs],
            updated_at: timestamp,
            last_action_by: currentUser
          };
        }
        return item;
      })
    );

    showToast(`Status updated to "${newStatus.toUpperCase()}". Syncing & WhatsApp message triggered...`);

    // 2. Background API Sync
    try {
      const res = await updateAdmissionStatus({
        applicationId: appId,
        newStatus,
        adminUser: currentUser
      });

      if (res.success && res.data) {
        setApplications((prev) =>
          prev.map((item) => (item.application_id === appId ? { ...item, ...res.data } : item))
        );
      }
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Exit applicant handler
  const handleExitUser = async (appId) => {
    const reason = prompt("Enter reason for course exit (optional):", "Student completed phase / requested exit");
    if (reason === null) return;

    setActionLoadingId(appId);
    const timestamp = new Date().toISOString();

    // Optimistic Local State Update
    setApplications((prev) =>
      prev.map((item) => {
        if (item.application_id === appId) {
          const newLog = {
            id: `log_${Date.now()}`,
            action: "exited",
            from_status: item.status,
            to_status: "exited",
            timestamp,
            actor: currentUser,
            note: reason || "Exited from active cohort"
          };
          const existingLogs = Array.isArray(item.timeline_audit_log) ? item.timeline_audit_log : [];
          return {
            ...item,
            status: "exited",
            exit_count: (item.exit_count || 0) + 1,
            timeline_audit_log: [newLog, ...existingLogs],
            updated_at: timestamp,
            last_action_by: currentUser
          };
        }
        return item;
      })
    );

    showToast(`Applicant shifted to Exit List.`);

    try {
      const res = await exitAdmissionUser({
        applicationId: appId,
        adminUser: currentUser,
        exitReason: reason || "Exited from active cohort"
      });

      if (res.success && res.data) {
        setApplications((prev) =>
          prev.map((item) => (item.application_id === appId ? { ...item, ...res.data } : item))
        );
      }
    } catch (err) {
      console.error("Error exiting user:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Resume applicant handler
  const handleResumeUser = async (appId) => {
    if (!confirm("Resume this user to active approved status? This sends them an approval confirmation message.")) {
      return;
    }

    setActionLoadingId(appId);
    const timestamp = new Date().toISOString();

    // Optimistic Local State Update
    setApplications((prev) =>
      prev.map((item) => {
        if (item.application_id === appId) {
          const newLog = {
            id: `log_${Date.now()}`,
            action: "approved",
            from_status: "exited",
            to_status: "approved",
            timestamp,
            actor: currentUser,
            note: "Resumed from exit list to active approved status"
          };
          const existingLogs = Array.isArray(item.timeline_audit_log) ? item.timeline_audit_log : [];
          return {
            ...item,
            status: "approved",
            resume_count: (item.resume_count || 0) + 1,
            timeline_audit_log: [newLog, ...existingLogs],
            updated_at: timestamp,
            last_action_by: currentUser
          };
        }
        return item;
      })
    );

    showToast(`Applicant resumed to Approved status.`);

    try {
      const res = await resumeAdmissionUser({
        applicationId: appId,
        adminUser: currentUser,
        resumeNote: "Resumed from exit list to active approved status"
      });

      if (res.success && res.data) {
        setApplications((prev) =>
          prev.map((item) => (item.application_id === appId ? { ...item, ...res.data } : item))
        );
      }
    } catch (err) {
      console.error("Error resuming user:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyRefId = (e, refId) => {
    e.stopPropagation();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(refId);
      setCopiedId(refId);
      setTimeout(() => setCopiedId(null), 2000);
      showToast(`Copied Ref ID: ${refId}`);
    }
  };

  const handleOpenWhatsAppDirect = (e, phone, name, program) => {
    e.stopPropagation();
    if (!phone) return;
    let clean = String(phone).replace(/[^\d]/g, "");
    if (clean.length === 10) clean = "91" + clean;
    const msg = encodeURIComponent(`Salaam ${name || "Mumin"},\nRegarding your application for ${program || "Tahfeez Galiakot"}:`);
    window.open(`https://wa.me/${clean}?text=${msg}`, "_blank");
  };

  const handleSimulateBotReply = async () => {
    if (!botTestPhone) {
      alert("Please enter a phone number.");
      return;
    }
    setBotSimLoading(true);
    setBotSimOutput(null);
    try {
      const res = await fetch("/api/whatsapp-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: botTestPhone,
          message: botTestReply
        })
      });
      const data = await res.json();
      setBotSimOutput(data);
      loadData();
    } catch (err) {
      setBotSimOutput({ error: err.message });
    } finally {
      setBotSimLoading(false);
    }
  };

  // Helper to switch KPI tab
  const handleKpiCardClick = (targetStatus) => {
    if (targetStatus === "exit_list") {
      setActiveTab("exit_list");
      setStatusFilter("all");
    } else {
      if (activeTab === "exit_list") {
        setActiveTab(activeRole === "kibar" ? "kibar" : activeRole === "atfal" ? "atfal" : "all");
      }
      setStatusFilter(targetStatus);
    }
  };

  return (
    <div className="admission-root-container" style={{ padding: "16px 20px 80px 20px", background: "transparent" }}>
      <div className="admission-bg-pattern" />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            style={{
              position: "fixed",
              top: "24px",
              right: "24px",
              zIndex: 9999,
              background: "var(--adm-espresso-main)",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "14px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              border: "1.5px solid var(--adm-gold-primary)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "13px",
              fontWeight: 700
            }}
          >
            <Sparkles size={16} color="var(--adm-gold-light)" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Box */}
      <header className="adm-admin-header-box" style={{ marginBottom: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <img
              src="/mauze-tahfeez-logo.png"
              alt="Mauze Tahfeez"
              className="adm-logo-img"
              onError={(e) => {
                e.currentTarget.src = "/logo.png";
              }}
            />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "20px", fontWeight: 900, color: "var(--adm-espresso-main)", margin: 0 }}>
                  Admissions Management System
                </h1>
                <span className="adm-brand-tag">
                  {activeRole === "kibar" ? "Kibar Admin" : activeRole === "atfal" ? "Atfal Admin" : "Super Admin"}
                </span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--adm-text-muted)" }}>
                Mauze Tahfeez Galiakot • Multi-Tier Role-Based Admissions, Exit Management & Automated WhatsApp Bot
              </p>
            </div>
          </div>

          {/* Role Switching & Tools */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* RBAC Selector */}
            <div style={{ background: "var(--adm-cream-soft)", padding: "4px", borderRadius: "14px", border: "1.5px solid var(--adm-gold-border)", display: "flex", gap: "4px" }}>
              <button
                type="button"
                onClick={() => { setActiveRole("super"); setActiveTab("all"); setStatusFilter("all"); }}
                className={`adm-tab-pill ${activeRole === "super" ? "active" : ""}`}
                style={{ padding: "6px 14px", fontSize: "12px" }}
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => { setActiveRole("kibar"); setActiveTab("kibar"); setStatusFilter("all"); }}
                className={`adm-tab-pill ${activeRole === "kibar" ? "active" : ""}`}
                style={{ padding: "6px 14px", fontSize: "12px" }}
              >
                Kibar Admin
              </button>
              <button
                type="button"
                onClick={() => { setActiveRole("atfal"); setActiveTab("atfal"); setStatusFilter("all"); }}
                className={`adm-tab-pill ${activeRole === "atfal" ? "active" : ""}`}
                style={{ padding: "6px 14px", fontSize: "12px" }}
              >
                Atfal Admin
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowBotModal(true)}
              className="adm-btn-secondary"
              style={{ color: "var(--adm-emerald-primary)", borderColor: "var(--adm-emerald-border)" }}
            >
              <Bot size={15} /> Bot Simulator
            </button>

            <button
              type="button"
              onClick={() => { setRefreshing(true); loadData(); }}
              className="adm-btn-secondary"
              title="Refresh Records"
            >
              <RotateCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>

            <button
              type="button"
              onClick={onBackToMain}
              className="adm-btn-secondary"
            >
              Overview
            </button>
          </div>
        </div>
      </header>

      {/* Interactive KPI Stats Overview Grid */}
      <div className="adm-kpi-grid">
        {/* Total Submissions Card */}
        <div
          onClick={() => handleKpiCardClick("all")}
          className={`adm-kpi-card ${statusFilter === "all" && activeTab !== "exit_list" ? "active active-total" : ""}`}
          title="Click to view all submissions"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-text-muted)" }}>Total Submissions</span>
            {statusFilter === "all" && activeTab !== "exit_list" && <span className="adm-active-indicator" />}
          </div>
          <span className="adm-kpi-num">{stats.total}</span>
        </div>

        {/* Pending Card */}
        <div
          onClick={() => handleKpiCardClick("pending")}
          className={`adm-kpi-card ${statusFilter === "pending" && activeTab !== "exit_list" ? "active active-pending" : ""}`}
          style={{ background: "linear-gradient(135deg, #fffdf8 0%, #fff7e4 100%)", borderColor: "var(--adm-gold-border)" }}
          title="Click to filter Pending applicants"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-gold-dark)" }}>Pending</span>
            {statusFilter === "pending" && activeTab !== "exit_list" && <span className="adm-active-indicator" style={{ background: "var(--adm-gold-dark)" }} />}
          </div>
          <span className="adm-kpi-num" style={{ color: "var(--adm-gold-dark)" }}>{stats.pending}</span>
        </div>

        {/* Approved Card */}
        <div
          onClick={() => handleKpiCardClick("approved")}
          className={`adm-kpi-card ${statusFilter === "approved" && activeTab !== "exit_list" ? "active active-approved" : ""}`}
          style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", borderColor: "var(--adm-emerald-border)" }}
          title="Click to filter Approved applicants"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-emerald-primary)" }}>Approved</span>
            {statusFilter === "approved" && activeTab !== "exit_list" && <span className="adm-active-indicator" style={{ background: "var(--adm-emerald-primary)" }} />}
          </div>
          <span className="adm-kpi-num" style={{ color: "var(--adm-emerald-primary)" }}>{stats.approved}</span>
        </div>

        {/* Waiting Card */}
        <div
          onClick={() => handleKpiCardClick("waiting")}
          className={`adm-kpi-card ${statusFilter === "waiting" && activeTab !== "exit_list" ? "active active-waiting" : ""}`}
          style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", borderColor: "var(--adm-amber-border)" }}
          title="Click to filter Waiting list"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-amber-primary)" }}>Waiting</span>
            {statusFilter === "waiting" && activeTab !== "exit_list" && <span className="adm-active-indicator" style={{ background: "var(--adm-amber-primary)" }} />}
          </div>
          <span className="adm-kpi-num" style={{ color: "var(--adm-amber-primary)" }}>{stats.waiting}</span>
        </div>

        {/* Rejected Card */}
        <div
          onClick={() => handleKpiCardClick("rejected")}
          className={`adm-kpi-card ${statusFilter === "rejected" && activeTab !== "exit_list" ? "active active-rejected" : ""}`}
          style={{ background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)", borderColor: "var(--adm-rose-border)" }}
          title="Click to filter Rejected applications"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-rose-primary)" }}>Rejected</span>
            {statusFilter === "rejected" && activeTab !== "exit_list" && <span className="adm-active-indicator" style={{ background: "var(--adm-rose-primary)" }} />}
          </div>
          <span className="adm-kpi-num" style={{ color: "var(--adm-rose-primary)" }}>{stats.rejected}</span>
        </div>

        {/* Exit List Card */}
        <div
          onClick={() => handleKpiCardClick("exit_list")}
          className={`adm-kpi-card ${activeTab === "exit_list" ? "active active-exited" : ""}`}
          style={{ background: "linear-gradient(135deg, #fdfbf7 0%, #f5eee6 100%)", borderColor: "var(--adm-border-soft)" }}
          title="Click to view Exit List / Former students"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-espresso-muted)" }}>Exit List</span>
            {activeTab === "exit_list" && <span className="adm-active-indicator" style={{ background: "var(--adm-espresso-main)" }} />}
          </div>
          <span className="adm-kpi-num" style={{ color: "var(--adm-espresso-muted)" }}>{stats.exited}</span>
        </div>
      </div>

      {/* Tabs Ribbon */}
      <div className="adm-tab-ribbon" style={{ marginBottom: "16px" }}>
        <div className="adm-tabs-row">
          {activeRole === "super" && (
            <>
              <button
                type="button"
                onClick={() => { setActiveTab("all"); setStatusFilter("all"); }}
                className={`adm-tab-pill ${activeTab === "all" ? "active" : ""}`}
              >
                All Responses ({applications.filter(a => a.status !== 'exited').length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("kibar"); setStatusFilter("all"); }}
                className={`adm-tab-pill ${activeTab === "kibar" ? "active" : ""}`}
              >
                Al-Kibar ({applications.filter(a => (a.program === "Al-Kibar (Adults)" || a.program?.toLowerCase().includes("kibar")) && a.status !== 'exited').length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("atfal"); setStatusFilter("all"); }}
                className={`adm-tab-pill ${activeTab === "atfal" ? "active" : ""}`}
              >
                Al-Atfal ({applications.filter(a => a.program === "Al-Atfal (7 to 15 yrs old)" && a.status !== 'exited').length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("sigar"); setStatusFilter("all"); }}
                className={`adm-tab-pill ${activeTab === "sigar" ? "active" : ""}`}
              >
                Al-Sigar ({applications.filter(a => a.program === "Al-Sigar (4 to 6 yrs old)" && a.status !== 'exited').length})
              </button>
            </>
          )}

          {activeRole === "kibar" && (
            <button
              type="button"
              onClick={() => { setActiveTab("kibar"); setStatusFilter("all"); }}
              className={`adm-tab-pill ${activeTab === "kibar" ? "active" : ""}`}
            >
              Kibar Responses ({applications.filter(a => (a.program === "Al-Kibar (Adults)" || a.program?.toLowerCase().includes("kibar")) && a.status !== 'exited').length})
            </button>
          )}

          {activeRole === "atfal" && (
            <>
              <button
                type="button"
                onClick={() => { setActiveTab("all"); setStatusFilter("all"); }}
                className={`adm-tab-pill ${activeTab === "all" ? "active" : ""}`}
              >
                All Responses ({applications.filter(a => (a.program?.includes("Atfal") || a.program?.includes("Sigar")) && a.status !== 'exited').length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("atfal"); setStatusFilter("all"); }}
                className={`adm-tab-pill ${activeTab === "atfal" ? "active" : ""}`}
              >
                Atfal Program ({applications.filter(a => a.program === "Al-Atfal (7 to 15 yrs old)" && a.status !== 'exited').length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("general_sigar"); setStatusFilter("all"); }}
                className={`adm-tab-pill ${activeTab === "general_sigar" ? "active-emerald" : ""}`}
              >
                <Layers size={14} /> General Tab (Al-Sigar) ({applications.filter(a => a.program === "Al-Sigar (4 to 6 yrs old)" && a.status !== 'exited').length})
              </button>
            </>
          )}

          {/* Exit List Tab */}
          <button
            type="button"
            onClick={() => { setActiveTab("exit_list"); setStatusFilter("all"); }}
            className={`adm-tab-pill ${activeTab === "exit_list" ? "active-rose" : ""}`}
          >
            <LogOut size={14} /> Exit Bar / List ({stats.exited})
          </button>

          {/* CMS Settings Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("cms_settings")}
            className={`adm-tab-pill ${activeTab === "cms_settings" ? "active" : ""}`}
          >
            <Settings size={14} /> CMS Form Settings
          </button>
        </div>

        {/* Filters & Search */}
        {activeTab !== "cms_settings" && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {activeTab !== "exit_list" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="adm-input-custom adm-input-noicon"
                style={{ maxWidth: "150px", padding: "8px 12px", fontSize: "12px", color: "var(--adm-gold-dark)", fontWeight: 700 }}
              >
                <option value="all">All Status ({stats.total})</option>
                <option value="pending">Pending ({stats.pending})</option>
                <option value="approved">Approved ({stats.approved})</option>
                <option value="waiting">Waiting ({stats.waiting})</option>
                <option value="rejected">Rejected ({stats.rejected})</option>
              </select>
            )}

            <div className="adm-input-icon-wrap" style={{ maxWidth: "240px" }}>
              <Search size={14} className="adm-input-icon" style={{ left: "12px" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, ITS, ref..."
                className="adm-input-custom"
                style={{ padding: "8px 12px 8px 34px", fontSize: "12.5px" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* CMS Settings Tab View */}
      {activeTab === "cms_settings" && (
        <AdmissionCmsSettings onSaved={() => loadData()} />
      )}

      {/* Applications List with Animated Dynamic Card Shifting */}
      {activeTab !== "cms_settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--adm-text-muted)" }}>
              <RotateCw size={32} className="animate-spin" style={{ margin: "0 auto 12px auto", color: "var(--adm-gold-primary)" }} />
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Loading admission records from database...</p>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "54px 20px", background: "#ffffff", borderRadius: "24px", border: "1.5px solid var(--adm-gold-border)", boxShadow: "var(--adm-shadow-sm)" }}>
              <Users size={36} style={{ margin: "0 auto 12px auto", color: "var(--adm-gold-primary)" }} />
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--adm-espresso-main)" }}>No Submissions Found</h3>
              <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "var(--adm-text-muted)" }}>
                {activeTab === "exit_list" ? "The Exit List is currently empty." : statusFilter !== "all" ? `No applications found with status "${statusFilter}". Click another status above.` : "No applications match the active filters."}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredApplications.map((app) => {
                const isExpanded = expandedCardId === app.application_id;
                const logs = Array.isArray(app.timeline_audit_log) ? app.timeline_audit_log : [];
                const isItemLoading = actionLoadingId === app.application_id;

                return (
                  <motion.div
                    layout
                    key={app.application_id}
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    style={{
                      background: "#ffffff",
                      border: isExpanded ? "2px solid var(--adm-gold-primary)" : "1.5px solid var(--adm-gold-border)",
                      borderRadius: "20px",
                      overflow: "hidden",
                      boxShadow: isExpanded ? "var(--adm-shadow-md)" : "var(--adm-shadow-sm)",
                      transition: "border-color 0.2s, box-shadow 0.2s"
                    }}
                  >
                    {/* Summary Header Card */}
                    <div
                      onClick={() => setExpandedCardId(isExpanded ? null : app.application_id)}
                      style={{
                        padding: "16px 20px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "14px",
                        cursor: "pointer",
                        flexWrap: "wrap",
                        background: isExpanded ? "var(--adm-cream-soft)" : "#ffffff"
                      }}
                    >
                      {/* Left: Avatar & Identity */}
                      <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: "1 1 300px" }}>
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "14px",
                            background: "var(--adm-gold-gradient)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 900,
                            color: "#ffffff",
                            fontSize: "18px",
                            boxShadow: "var(--adm-shadow-gold)",
                            fontFamily: "'Amiri', serif",
                            flexShrink: 0
                          }}
                        >
                          {app.full_name?.charAt(0) || "ط"}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <h3 style={{ margin: 0, fontSize: "16.5px", fontWeight: 800, color: "var(--adm-espresso-main)" }}>
                              {app.full_name}
                            </h3>
                            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--adm-espresso-main)", background: "var(--adm-cream-soft)", border: "1px solid var(--adm-border-soft)", padding: "2px 8px", borderRadius: "6px" }}>
                              ITS: {app.its_number}
                            </span>
                            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--adm-gold-dark)", background: "var(--adm-gold-subtle)", border: "1px solid var(--adm-gold-border)", padding: "2px 8px", borderRadius: "6px" }}>
                              {app.program}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "10px", fontSize: "12px", color: "var(--adm-text-muted)", marginTop: "4px", flexWrap: "wrap", alignItems: "center" }}>
                            <span>{app.gender} • Age {app.age || "N/A"}</span>
                            <span>• Jamaat: <strong style={{ color: "var(--adm-espresso-main)" }}>{app.jamaat}</strong></span>
                            <span>• Phone: <strong style={{ color: "var(--adm-gold-dark)", fontFamily: "monospace" }}>{app.whatsapp_number}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Action Buttons & Status Pill */}
                      <div
                        style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Quick Shift Status Buttons directly on card */}
                        {app.status === "pending" && (
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(app.application_id, "approved")}
                              disabled={isItemLoading}
                              className="adm-btn-quick-action"
                              style={{ background: "var(--adm-emerald-bg)", color: "var(--adm-emerald-primary)", borderColor: "var(--adm-emerald-border)" }}
                              title="Quick Approve"
                            >
                              <CheckCircle2 size={13} /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(app.application_id, "waiting")}
                              disabled={isItemLoading}
                              className="adm-btn-quick-action"
                              style={{ background: "var(--adm-amber-bg)", color: "var(--adm-amber-primary)", borderColor: "var(--adm-amber-border)" }}
                              title="Move to Waiting List"
                            >
                              <Clock size={13} /> Waiting
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(app.application_id, "rejected")}
                              disabled={isItemLoading}
                              className="adm-btn-quick-action"
                              style={{ background: "var(--adm-rose-bg)", color: "var(--adm-rose-primary)", borderColor: "var(--adm-rose-border)" }}
                              title="Reject Application"
                            >
                              <XCircle size={13} /> Reject
                            </button>
                          </div>
                        )}

                        {app.status === "waiting" && (
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(app.application_id, "approved")}
                              disabled={isItemLoading}
                              className="adm-btn-quick-action"
                              style={{ background: "var(--adm-emerald-bg)", color: "var(--adm-emerald-primary)", borderColor: "var(--adm-emerald-border)" }}
                              title="Approve from Waiting List"
                            >
                              <CheckCircle2 size={13} /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(app.application_id, "rejected")}
                              disabled={isItemLoading}
                              className="adm-btn-quick-action"
                              style={{ background: "var(--adm-rose-bg)", color: "var(--adm-rose-primary)", borderColor: "var(--adm-rose-border)" }}
                              title="Reject Application"
                            >
                              <XCircle size={13} /> Reject
                            </button>
                          </div>
                        )}

                        {app.status === "approved" && (
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(app.application_id, "waiting")}
                              disabled={isItemLoading}
                              className="adm-btn-quick-action"
                              style={{ background: "var(--adm-amber-bg)", color: "var(--adm-amber-primary)", borderColor: "var(--adm-amber-border)" }}
                              title="Shift to Waiting List"
                            >
                              <Clock size={13} /> Move to Waiting
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExitUser(app.application_id)}
                              disabled={isItemLoading}
                              className="adm-btn-quick-action"
                              style={{ background: "var(--adm-rose-bg)", color: "var(--adm-rose-primary)", borderColor: "var(--adm-rose-border)" }}
                              title="Move to Exit List"
                            >
                              <LogOut size={13} /> Exit
                            </button>
                          </div>
                        )}

                        {app.status === "rejected" && (
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(app.application_id, "approved")}
                              disabled={isItemLoading}
                              className="adm-btn-quick-action"
                              style={{ background: "var(--adm-emerald-bg)", color: "var(--adm-emerald-primary)", borderColor: "var(--adm-emerald-border)" }}
                              title="Reconsider & Approve"
                            >
                              <CheckCircle2 size={13} /> Reconsider
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(app.application_id, "waiting")}
                              disabled={isItemLoading}
                              className="adm-btn-quick-action"
                              style={{ background: "var(--adm-amber-bg)", color: "var(--adm-amber-primary)", borderColor: "var(--adm-amber-border)" }}
                              title="Move to Waiting"
                            >
                              <Clock size={13} /> Waiting
                            </button>
                          </div>
                        )}

                        {app.status === "exited" && (
                          <button
                            type="button"
                            onClick={() => handleResumeUser(app.application_id)}
                            disabled={isItemLoading}
                            className="adm-btn-quick-action"
                            style={{ background: "var(--adm-emerald-bg)", color: "var(--adm-emerald-primary)", borderColor: "var(--adm-emerald-border)" }}
                            title="Resume to active Approved"
                          >
                            <RotateCw size={13} /> Resume
                          </button>
                        )}

                        {/* Direct WhatsApp Chat Action */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenWhatsAppDirect(e, app.whatsapp_number, app.full_name, app.program)}
                          className="adm-btn-quick-action"
                          style={{ background: "var(--adm-emerald-bg)", color: "var(--adm-emerald-primary)", borderColor: "var(--adm-emerald-border)" }}
                          title="Open WhatsApp Chat"
                        >
                          <MessageCircle size={13} />
                        </button>

                        <span className={`status-pill status-${app.status}`}>
                          {app.status}
                        </span>

                        <div style={{ marginLeft: "4px", color: isExpanded ? "var(--adm-gold-primary)" : "var(--adm-text-muted)" }}>
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Drawer View with Full Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          style={{ borderTop: "1.5px solid var(--adm-gold-border)", padding: "20px 22px", background: "var(--adm-ivory-warm)", display: "flex", flexDirection: "column", gap: "18px" }}
                        >
                          {/* Detailed Grid */}
                          <div className="adm-form-grid" style={{ background: "#ffffff", padding: "18px", borderRadius: "16px", border: "1.5px solid var(--adm-gold-border)", boxShadow: "var(--adm-shadow-sm)", marginBottom: 0 }}>
                            <div>
                              <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Email Address</span>
                              <p style={{ margin: "3px 0 0 0", fontSize: "13.5px", color: "var(--adm-espresso-main)", fontWeight: 700 }}>
                                <a href={`mailto:${app.email}`} style={{ color: "inherit", textDecoration: "none" }}>{app.email || "N/A"}</a>
                              </p>
                            </div>
                            <div>
                              <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>WhatsApp Phone</span>
                              <p style={{ margin: "3px 0 0 0", fontSize: "13.5px", color: "var(--adm-gold-dark)", fontFamily: "monospace", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px" }}>
                                <span>{app.whatsapp_number}</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenWhatsAppDirect(e, app.whatsapp_number, app.full_name, app.program)}
                                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: "var(--adm-emerald-primary)" }}
                                  title="Chat on WhatsApp"
                                >
                                  <ExternalLink size={13} />
                                </button>
                              </p>
                            </div>
                            <div>
                              <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Program Chosen</span>
                              <p style={{ margin: "3px 0 0 0", fontSize: "13.5px", color: "var(--adm-espresso-main)", fontWeight: 700 }}>{app.program}</p>
                            </div>
                            <div>
                              <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Application Ref ID</span>
                              <p style={{ margin: "3px 0 0 0", fontSize: "13.5px", color: "var(--adm-emerald-primary)", fontFamily: "monospace", fontWeight: 900, display: "flex", alignItems: "center", gap: "6px" }}>
                                <span>{app.application_id}</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyRefId(e, app.application_id)}
                                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedId === app.application_id ? "var(--adm-emerald-primary)" : "var(--adm-text-muted)" }}
                                  title="Copy Ref ID"
                                >
                                  {copiedId === app.application_id ? <Check size={13} /> : <Copy size={13} />}
                                </button>
                              </p>
                            </div>

                            {app.last_achieved_sanad && (
                              <div>
                                <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Last Achieved Sanad</span>
                                <p style={{ margin: "3px 0 0 0", fontSize: "13.5px", color: "var(--adm-emerald-primary)", fontWeight: 800 }}>{app.last_achieved_sanad}</p>
                              </div>
                            )}

                            {app.venue_and_time && (
                              <div className="adm-col-full">
                                <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Selected Venue & Time</span>
                                <p style={{ margin: "3px 0 0 0", fontSize: "13.5px", color: "var(--adm-espresso-main)", fontWeight: 700 }}>{app.venue_and_time}</p>
                              </div>
                            )}

                            {app.dob && (
                              <div>
                                <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Date of Birth</span>
                                <p style={{ margin: "3px 0 0 0", fontSize: "13.5px", color: "var(--adm-espresso-main)", fontWeight: 700 }}>{app.dob}</p>
                              </div>
                            )}

                            {app.hifz_till && (
                              <div>
                                <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Hifz Till</span>
                                <p style={{ margin: "3px 0 0 0", fontSize: "13.5px", color: "var(--adm-espresso-main)", fontWeight: 700 }}>{app.hifz_till}</p>
                              </div>
                            )}
                          </div>

                          {/* Numeric Counters */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", background: "#ffffff", padding: "14px", borderRadius: "16px", textAlign: "center", border: "1.5px solid var(--adm-gold-border)", boxShadow: "var(--adm-shadow-sm)" }}>
                            <div>
                              <span style={{ fontSize: "10.5px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-emerald-primary)" }}>Times Enrolled</span>
                              <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: 900, color: "var(--adm-espresso-main)" }}>{app.enrolled_count || (app.status === "approved" ? 1 : 0)}</p>
                            </div>
                            <div>
                              <span style={{ fontSize: "10.5px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-rose-primary)" }}>Times Exited</span>
                              <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: 900, color: "var(--adm-espresso-main)" }}>{app.exit_count || 0}</p>
                            </div>
                            <div>
                              <span style={{ fontSize: "10.5px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-gold-dark)" }}>Times Resumed</span>
                              <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: 900, color: "var(--adm-espresso-main)" }}>{app.resume_count || 0}</p>
                            </div>
                          </div>

                          {/* Status Actions Command Bar */}
                          <div style={{ background: "linear-gradient(135deg, #fffdf8 0%, #fff7e6 100%)", border: "1.5px solid var(--adm-gold-border)", borderRadius: "18px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "var(--adm-shadow-sm)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-gold-dark)", display: "flex", alignItems: "center", gap: "6px" }}>
                                <Sparkles size={15} /> Status Actions & Automated WhatsApp Dispatch
                              </span>
                              <span style={{ fontSize: "11px", color: "var(--adm-text-muted)" }}>
                                Current: <strong style={{ textTransform: "uppercase", color: "var(--adm-espresso-main)" }}>{app.status}</strong>
                              </span>
                            </div>

                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                              {/* Approved Button */}
                              <button
                                type="button"
                                onClick={() => handleStatusChange(app.application_id, "approved")}
                                disabled={isItemLoading || app.status === "approved"}
                                className={`adm-btn-primary adm-btn-emerald ${app.status === "approved" ? "opacity-50" : ""}`}
                                style={{ padding: "9px 20px", fontSize: "13px" }}
                              >
                                <CheckCircle2 size={16} /> Approved
                              </button>

                              {/* Waiting Button */}
                              <button
                                type="button"
                                onClick={() => handleStatusChange(app.application_id, "waiting")}
                                disabled={isItemLoading || app.status === "waiting"}
                                className="adm-btn-secondary"
                                style={{ padding: "9px 20px", fontSize: "13px", color: "var(--adm-amber-primary)", borderColor: "var(--adm-amber-border)", background: app.status === "waiting" ? "var(--adm-amber-bg)" : "" }}
                              >
                                <Clock size={16} /> Waiting
                              </button>

                              {/* Reject Button */}
                              <button
                                type="button"
                                onClick={() => handleStatusChange(app.application_id, "rejected")}
                                disabled={isItemLoading || app.status === "rejected"}
                                className="adm-btn-secondary"
                                style={{ padding: "9px 20px", fontSize: "13px", color: "var(--adm-rose-primary)", borderColor: "var(--adm-rose-border)", background: app.status === "rejected" ? "var(--adm-rose-bg)" : "" }}
                              >
                                <XCircle size={16} /> Reject
                              </button>

                              {/* Exit Button (for Approved students) */}
                              {app.status === "approved" && (
                                <button
                                  type="button"
                                  onClick={() => handleExitUser(app.application_id)}
                                  disabled={isItemLoading}
                                  className="adm-btn-secondary"
                                  style={{ marginLeft: "auto", color: "var(--adm-rose-primary)", borderColor: "var(--adm-rose-border)" }}
                                >
                                  <LogOut size={16} /> Move to Exit List
                                </button>
                              )}

                              {/* Resume Button (for Exited students) */}
                              {app.status === "exited" && (
                                <button
                                  type="button"
                                  onClick={() => handleResumeUser(app.application_id)}
                                  disabled={isItemLoading}
                                  className="adm-btn-primary adm-btn-emerald"
                                  style={{ marginLeft: "auto", padding: "9px 22px", fontSize: "13px" }}
                                >
                                  <RotateCw size={16} /> Resume to Active Approved
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Historical Audit Timeline */}
                          <div>
                            <h4 style={{ margin: "0 0 10px 0", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-espresso-main)", display: "flex", alignItems: "center", gap: "6px" }}>
                              <History size={15} color="var(--adm-gold-dark)" /> Audit Timeline Log ({logs.length})
                            </h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {logs.length === 0 ? (
                                <p style={{ fontSize: "12px", color: "var(--adm-text-muted)", margin: 0 }}>No audit logs recorded yet.</p>
                              ) : (
                                logs.map((l, lIdx) => (
                                  <div
                                    key={l.id || lIdx}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      padding: "10px 14px",
                                      borderRadius: "12px",
                                      background: "#ffffff",
                                      border: "1px solid var(--adm-gold-border)",
                                      fontSize: "12px",
                                      boxShadow: "var(--adm-shadow-sm)",
                                      flexWrap: "wrap",
                                      gap: "8px"
                                    }}
                                  >
                                    <div>
                                      <span className={`status-pill status-${l.action || "pending"}`} style={{ marginRight: "8px" }}>
                                        {l.action}
                                      </span>
                                      <span style={{ color: "var(--adm-espresso-main)", fontWeight: 600 }}>{l.note || "Status updated"}</span>
                                    </div>
                                    <span style={{ fontSize: "11px", color: "var(--adm-text-muted)", fontFamily: "monospace" }}>
                                      {l.timestamp ? new Date(l.timestamp).toLocaleString() : ""}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* WhatsApp Webhook Simulator Modal */}
      {showBotModal && (
        <div className="adm-modal-overlay">
          <div className="adm-modal-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ margin: 0, fontSize: "19px", fontWeight: 900, color: "var(--adm-espresso-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Bot size={20} color="var(--adm-gold-dark)" /> WhatsApp Two-Way Webhook Simulator
              </h3>
              <button
                type="button"
                onClick={() => setShowBotModal(false)}
                className="adm-btn-text"
                style={{ padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="adm-label">Phone Number to Simulate</label>
                <input
                  type="text"
                  value={botTestPhone}
                  onChange={(e) => setBotTestPhone(e.target.value)}
                  placeholder="e.g. 919930852533"
                  className="adm-input-custom adm-input-noicon"
                  style={{ marginTop: "6px" }}
                />
              </div>
              <div>
                <label className="adm-label">User Reply Text</label>
                <div className="adm-btn-group-3" style={{ margin: "8px 0" }}>
                  {["Yes", "No", "Want to talk"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setBotTestReply(r)}
                      className={`adm-choice-btn ${botTestReply === r ? "active" : ""}`}
                    >
                      "{r}"
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={botTestReply}
                  onChange={(e) => setBotTestReply(e.target.value)}
                  className="adm-input-custom adm-input-noicon"
                />
              </div>
              <button
                type="button"
                onClick={handleSimulateBotReply}
                disabled={botSimLoading}
                className="adm-btn-primary adm-btn-emerald"
                style={{ width: "100%", marginTop: "12px" }}
              >
                {botSimLoading ? "Processing..." : "Trigger Simulated Webhook"}
              </button>

              {botSimOutput && (
                <div style={{ marginTop: "14px", background: "var(--adm-cream-soft)", padding: "14px", borderRadius: "12px", border: "1.5px solid var(--adm-gold-border)", fontSize: "12px", fontFamily: "monospace", color: "var(--adm-espresso-main)" }}>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(botSimOutput, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
