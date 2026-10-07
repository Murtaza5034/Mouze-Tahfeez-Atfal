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
  Check
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

  // WhatsApp Bot Simulator
  const [showBotModal, setShowBotModal] = useState(false);
  const [botTestPhone, setBotTestPhone] = useState("");
  const [botTestReply, setBotTestReply] = useState("Yes");
  const [botSimOutput, setBotSimOutput] = useState(null);
  const [botSimLoading, setBotSimLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdmissionApplications();
      if (res.success) {
        setApplications(res.data || []);
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

  // Filtered Applications according to active role and subtab
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // Exit list tab
      if (activeTab === "exit_list") {
        if (app.status !== "exited") return false;
        if (activeRole === "kibar") return app.program === "Al-Kibar (Adults)";
        if (activeRole === "atfal") return app.program === "Al-Atfal (7 to 15 yrs old)" || app.program === "Al-Sigar (4 to 6 yrs old)";
        return true;
      }

      if (app.status === "exited") return false;

      // Role & Tab filtering
      if (activeRole === "kibar") {
        if (app.program !== "Al-Kibar (Adults)") return false;
      } else if (activeRole === "atfal") {
        if (activeTab === "general_sigar") {
          if (app.program !== "Al-Sigar (4 to 6 yrs old)") return false;
        } else {
          if (app.program !== "Al-Atfal (7 to 15 yrs old)") return false;
        }
      } else {
        if (activeTab === "kibar" && app.program !== "Al-Kibar (Adults)") return false;
        if (activeTab === "atfal" && app.program !== "Al-Atfal (7 to 15 yrs old)") return false;
        if (activeTab === "sigar" && app.program !== "Al-Sigar (4 to 6 yrs old)") return false;
      }

      if (statusFilter !== "all" && app.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          app.full_name?.toLowerCase().includes(q) ||
          app.its_number?.includes(q) ||
          app.whatsapp_number?.includes(q) ||
          app.email?.toLowerCase().includes(q) ||
          app.application_id?.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [applications, activeRole, activeTab, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    let scoped = applications;
    if (activeRole === "kibar") {
      scoped = scoped.filter((a) => a.program === "Al-Kibar (Adults)");
    } else if (activeRole === "atfal") {
      scoped = scoped.filter(
        (a) => a.program === "Al-Atfal (7 to 15 yrs old)" || a.program === "Al-Sigar (4 to 6 yrs old)"
      );
    }

    return {
      total: scoped.length,
      pending: scoped.filter((a) => a.status === "pending").length,
      approved: scoped.filter((a) => a.status === "approved").length,
      waiting: scoped.filter((a) => a.status === "waiting").length,
      rejected: scoped.filter((a) => a.status === "rejected").length,
      exited: scoped.filter((a) => a.status === "exited").length
    };
  }, [applications, activeRole]);

  const handleStatusChange = async (appId, newStatus) => {
    setActionLoadingId(appId);
    try {
      const res = await updateAdmissionStatus({
        applicationId: appId,
        newStatus,
        adminUser: currentUser
      });

      if (res.success) {
        setApplications((prev) =>
          prev.map((item) => (item.application_id === appId ? res.data : item))
        );
      } else {
        alert(`Failed to update status: ${res.error}`);
      }
    } catch (err) {
      alert("Error updating status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExitUser = async (appId) => {
    const reason = prompt("Enter reason for course exit (optional):", "Student completed phase / requested exit");
    if (reason === null) return;

    setActionLoadingId(appId);
    try {
      const res = await exitAdmissionUser({
        applicationId: appId,
        adminUser: currentUser,
        exitReason: reason || "Exited from active cohort"
      });

      if (res.success) {
        setApplications((prev) =>
          prev.map((item) => (item.application_id === appId ? res.data : item))
        );
      } else {
        alert(`Failed to exit user: ${res.error}`);
      }
    } catch (err) {
      alert("Error processing exit.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResumeUser = async (appId) => {
    if (!confirm("Resume this user to active approved status? This sends them an approval confirmation message.")) {
      return;
    }

    setActionLoadingId(appId);
    try {
      const res = await resumeAdmissionUser({
        applicationId: appId,
        adminUser: currentUser,
        resumeNote: "Resumed from exit list to active approved status"
      });

      if (res.success) {
        setApplications((prev) =>
          prev.map((item) => (item.application_id === appId ? res.data : item))
        );
      } else {
        alert(`Failed to resume user: ${res.error}`);
      }
    } catch (err) {
      alert("Error processing resume.");
    } finally {
      setActionLoadingId(null);
    }
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

  return (
    <div className="admission-root-container" style={{ padding: "20px" }}>
      <div className="admission-bg-pattern" />

      {/* Top Header */}
      <header className="adm-admin-header-box">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div className="adm-logo-badge">ط</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h1 style={{ fontSize: "20px", fontWeight: 900, color: "#fff", margin: 0 }}>
                  Admissions Management System
                </h1>
                <span className="adm-brand-tag">
                  {activeRole === "kibar" ? "Kibar Admin" : activeRole === "atfal" ? "Atfal Admin" : "Super Admin"}
                </span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                Tahfeez Galiakot 1447-48H • Multi-Tier Role-Based Routing & Automated WhatsApp Bot
              </p>
            </div>
          </div>

          {/* Role Switching & Tools */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* RBAC Selector */}
            <div style={{ background: "rgba(11, 15, 25, 0.9)", padding: "4px", borderRadius: "14px", border: "1px solid #334155", display: "flex", gap: "4px" }}>
              <button
                type="button"
                onClick={() => { setActiveRole("super"); setActiveTab("all"); }}
                className={`adm-tab-pill ${activeRole === "super" ? "active" : ""}`}
                style={{ padding: "6px 12px", fontSize: "12px" }}
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => { setActiveRole("kibar"); setActiveTab("kibar"); }}
                className={`adm-tab-pill ${activeRole === "kibar" ? "active" : ""}`}
                style={{ padding: "6px 12px", fontSize: "12px" }}
              >
                Kibar Admin
              </button>
              <button
                type="button"
                onClick={() => { setActiveRole("atfal"); setActiveTab("atfal"); }}
                className={`adm-tab-pill ${activeRole === "atfal" ? "active" : ""}`}
                style={{ padding: "6px 12px", fontSize: "12px" }}
              >
                Atfal Admin
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowBotModal(true)}
              className="adm-btn-secondary"
              style={{ color: "#34d399", borderColor: "rgba(16, 185, 129, 0.4)" }}
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
              Main Portal
            </button>
          </div>
        </div>
      </header>

      {/* KPI Stats Overview */}
      <div className="adm-kpi-grid">
        <div className="adm-kpi-card">
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8" }}>Total Submissions</span>
          <span className="adm-kpi-num" style={{ color: "#ffffff" }}>{stats.total}</span>
        </div>
        <div className="adm-kpi-card" style={{ background: "rgba(245, 158, 11, 0.1)", borderColor: "rgba(245, 158, 11, 0.3)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#fbbf24" }}>Pending</span>
          <span className="adm-kpi-num" style={{ color: "#fbbf24" }}>{stats.pending}</span>
        </div>
        <div className="adm-kpi-card" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.3)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#34d399" }}>Approved</span>
          <span className="adm-kpi-num" style={{ color: "#34d399" }}>{stats.approved}</span>
        </div>
        <div className="adm-kpi-card" style={{ background: "rgba(234, 179, 8, 0.1)", borderColor: "rgba(234, 179, 8, 0.3)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#facc15" }}>Waiting</span>
          <span className="adm-kpi-num" style={{ color: "#facc15" }}>{stats.waiting}</span>
        </div>
        <div className="adm-kpi-card" style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#f87171" }}>Rejected</span>
          <span className="adm-kpi-num" style={{ color: "#f87171" }}>{stats.rejected}</span>
        </div>
        <div className="adm-kpi-card" style={{ background: "rgba(148, 163, 184, 0.1)", borderColor: "rgba(148, 163, 184, 0.3)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#cbd5e1" }}>Exit List</span>
          <span className="adm-kpi-num" style={{ color: "#cbd5e1" }}>{stats.exited}</span>
        </div>
      </div>

      {/* Tabs Ribbon */}
      <div className="adm-tab-ribbon">
        <div className="adm-tabs-row">
          {activeRole === "super" && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`adm-tab-pill ${activeTab === "all" ? "active" : ""}`}
              >
                All Responses ({applications.filter(a => a.status !== 'exited').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("kibar")}
                className={`adm-tab-pill ${activeTab === "kibar" ? "active" : ""}`}
              >
                Al-Kibar ({applications.filter(a => a.program === "Al-Kibar (Adults)" && a.status !== 'exited').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("atfal")}
                className={`adm-tab-pill ${activeTab === "atfal" ? "active" : ""}`}
              >
                Al-Atfal ({applications.filter(a => a.program === "Al-Atfal (7 to 15 yrs old)" && a.status !== 'exited').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("sigar")}
                className={`adm-tab-pill ${activeTab === "sigar" ? "active" : ""}`}
              >
                Al-Sigar ({applications.filter(a => a.program === "Al-Sigar (4 to 6 yrs old)" && a.status !== 'exited').length})
              </button>
            </>
          )}

          {activeRole === "kibar" && (
            <button
              type="button"
              onClick={() => setActiveTab("kibar")}
              className={`adm-tab-pill ${activeTab === "kibar" ? "active" : ""}`}
            >
              Kibar Responses ({applications.filter(a => a.program === "Al-Kibar (Adults)" && a.status !== 'exited').length})
            </button>
          )}

          {activeRole === "atfal" && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("atfal")}
                className={`adm-tab-pill ${activeTab === "atfal" ? "active" : ""}`}
              >
                Atfal Program ({applications.filter(a => a.program === "Al-Atfal (7 to 15 yrs old)" && a.status !== 'exited').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("general_sigar")}
                className={`adm-tab-pill ${activeTab === "general_sigar" ? "active-emerald" : ""}`}
              >
                <Layers size={14} /> General Tab (Al-Sigar) ({applications.filter(a => a.program === "Al-Sigar (4 to 6 yrs old)" && a.status !== 'exited').length})
              </button>
            </>
          )}

          {/* Exit List Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("exit_list")}
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
                style={{ maxWidth: "140px", padding: "8px 12px", fontSize: "12px", color: "#fbbf24" }}
              >
                <option value="all" style={{ background: "#0b0f19" }}>All Status</option>
                <option value="pending" style={{ background: "#0b0f19" }}>Pending</option>
                <option value="approved" style={{ background: "#0b0f19" }}>Approved</option>
                <option value="waiting" style={{ background: "#0b0f19" }}>Waiting</option>
                <option value="rejected" style={{ background: "#0b0f19" }}>Rejected</option>
              </select>
            )}

            <div className="adm-input-icon-wrap" style={{ maxWidth: "200px" }}>
              <Search size={14} className="adm-input-icon" style={{ left: "10px" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, ITS..."
                className="adm-input-custom"
                style={{ padding: "8px 12px 8px 32px", fontSize: "12px" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* CMS Settings Tab View */}
      {activeTab === "cms_settings" && (
        <AdmissionCmsSettings onSaved={() => loadData()} />
      )}

      {/* Applications List */}
      {activeTab !== "cms_settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
              <RotateCw size={28} className="animate-spin" style={{ margin: "0 auto 10px auto", color: "#f59e0b" }} />
              <p style={{ margin: 0, fontSize: "13px" }}>Loading admission records from Firebase...</p>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", background: "rgba(18, 24, 40, 0.6)", borderRadius: "20px", border: "1px solid #334155" }}>
              <Users size={32} style={{ margin: "0 auto 10px auto", color: "#64748b" }} />
              <h3 style={{ margin: 0, fontSize: "16px", color: "#e2e8f0" }}>No Submissions Found</h3>
              <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                {activeTab === "exit_list" ? "The Exit List is currently empty." : "No applications match the active filters."}
              </p>
            </div>
          ) : (
            filteredApplications.map((app) => {
              const isExpanded = expandedCardId === app.application_id;
              const logs = Array.isArray(app.timeline_audit_log) ? app.timeline_audit_log : [];

              return (
                <div
                  key={app.application_id}
                  style={{
                    background: isExpanded ? "rgba(18, 24, 40, 0.95)" : "rgba(18, 24, 40, 0.75)",
                    border: isExpanded ? "1.5px solid rgba(245, 158, 11, 0.45)" : "1px solid rgba(51, 65, 85, 0.7)",
                    borderRadius: "18px",
                    overflow: "hidden",
                    transition: "all 0.2s ease"
                  }}
                >
                  {/* Summary Header */}
                  <div
                    onClick={() => setExpandedCardId(isExpanded ? null : app.application_id)}
                    style={{
                      padding: "16px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      cursor: "pointer",
                      flexWrap: "wrap"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "12px",
                          background: "linear-gradient(135deg, #1e293b, #0f172a)",
                          border: "1px solid #475569",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          color: "#f59e0b",
                          fontSize: "16px"
                        }}
                      >
                        {app.full_name?.charAt(0) || "M"}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#fff" }}>
                            {app.full_name}
                          </h3>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#cbd5e1", background: "rgba(51, 65, 85, 0.6)", padding: "2px 8px", borderRadius: "6px" }}>
                            ITS: {app.its_number}
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#fde68a", background: "rgba(245, 158, 11, 0.15)", padding: "2px 8px", borderRadius: "6px" }}>
                            {app.program}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "10px", fontSize: "12px", color: "#94a3b8", marginTop: "4px", flexWrap: "wrap" }}>
                          <span>{app.gender} • Age {app.age || "N/A"}</span>
                          <span>• Jamaat: <strong style={{ color: "#e2e8f0" }}>{app.jamaat}</strong></span>
                          <span>• Phone: <strong style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{app.whatsapp_number}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span className={`status-pill status-${app.status}`}>
                        {app.status}
                      </span>
                      {isExpanded ? <ChevronUp size={20} color="#f59e0b" /> : <ChevronDown size={20} color="#94a3b8" />}
                    </div>
                  </div>

                  {/* Expanded Card View */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid #334155", padding: "24px", background: "rgba(11, 15, 25, 0.7)", display: "flex", flexDirection: "column", gap: "20px" }}>
                      {/* Detailed Grid */}
                      <div className="adm-form-grid" style={{ background: "rgba(18, 24, 40, 0.8)", padding: "18px", borderRadius: "14px", border: "1px solid #334155", marginBottom: 0 }}>
                        <div>
                          <span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 800 }}>Email Address</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#f8fafc", fontWeight: 600 }}>{app.email}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 800 }}>WhatsApp Phone</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#fbbf24", fontFamily: "monospace", fontWeight: 700 }}>{app.whatsapp_number}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 800 }}>Program Chosen</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#f8fafc", fontWeight: 600 }}>{app.program}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 800 }}>Ref ID</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#34d399", fontFamily: "monospace", fontWeight: 800 }}>{app.application_id}</p>
                        </div>

                        {app.last_achieved_sanad && (
                          <div>
                            <span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 800 }}>Last Achieved Sanad</span>
                            <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#34d399", fontWeight: 700 }}>{app.last_achieved_sanad}</p>
                          </div>
                        )}

                        {app.venue_and_time && (
                          <div className="adm-col-full">
                            <span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 800 }}>Selected Venue & Time</span>
                            <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#f8fafc", fontWeight: 600 }}>{app.venue_and_time}</p>
                          </div>
                        )}

                        {app.dob && (
                          <div>
                            <span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 800 }}>Date of Birth</span>
                            <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#f8fafc", fontWeight: 600 }}>{app.dob}</p>
                          </div>
                        )}

                        {app.hifz_till && (
                          <div>
                            <span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 800 }}>Hifz Till</span>
                            <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#f8fafc", fontWeight: 600 }}>{app.hifz_till}</p>
                          </div>
                        )}
                      </div>

                      {/* Numeric Counters */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", background: "rgba(18, 24, 40, 0.6)", padding: "12px", borderRadius: "14px", textAlign: "center", border: "1px solid #334155" }}>
                        <div>
                          <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#34d399" }}>Times Enrolled</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: 900, color: "#fff" }}>{app.enrolled_count || (app.status === "approved" ? 1 : 0)}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#f87171" }}>Times Exited</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: 900, color: "#fff" }}>{app.exit_count || 0}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#38bdf8" }}>Times Resumed</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: 900, color: "#fff" }}>{app.resume_count || 0}</p>
                        </div>
                      </div>

                      {/* Action Buttons: Approved, Reject, Waiting + Exit & Resume System */}
                      <div style={{ background: "rgba(18, 24, 40, 0.9)", border: "1.5px solid rgba(245, 158, 11, 0.3)", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#fbbf24" }}>
                            Status Actions & Automated WhatsApp Notifications
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(app.application_id, "approved")}
                            disabled={actionLoadingId === app.application_id || app.status === "approved"}
                            className="adm-btn-primary adm-btn-emerald"
                            style={{ padding: "8px 18px", fontSize: "12px" }}
                          >
                            <CheckCircle2 size={15} /> Approved
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(app.application_id, "waiting")}
                            disabled={actionLoadingId === app.application_id || app.status === "waiting"}
                            className="adm-btn-secondary"
                            style={{ padding: "8px 18px", fontSize: "12px", color: "#facc15", borderColor: "rgba(234, 179, 8, 0.4)" }}
                          >
                            <Clock size={15} /> Waiting
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(app.application_id, "rejected")}
                            disabled={actionLoadingId === app.application_id || app.status === "rejected"}
                            className="adm-btn-secondary"
                            style={{ padding: "8px 18px", fontSize: "12px", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.4)" }}
                          >
                            <XCircle size={15} /> Reject
                          </button>

                          {/* The Exit Button (Visible when Approved) */}
                          {app.status === "approved" && (
                            <button
                              type="button"
                              onClick={() => handleExitUser(app.application_id)}
                              className="adm-btn-secondary"
                              style={{ marginLeft: "auto", color: "#fca5a5", borderColor: "rgba(239, 68, 68, 0.4)" }}
                            >
                              <LogOut size={15} /> Move to Exit List
                            </button>
                          )}

                          {/* The Resume Button (Visible in Exit List) */}
                          {app.status === "exited" && (
                            <button
                              type="button"
                              onClick={() => handleResumeUser(app.application_id)}
                              className="adm-btn-primary adm-btn-emerald"
                              style={{ marginLeft: "auto", padding: "8px 20px", fontSize: "12px" }}
                            >
                              <RotateCw size={15} /> Resume to Active Approved
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Historical Timeline */}
                      <div>
                        <h4 style={{ margin: "0 0 10px 0", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
                          <History size={14} color="#f59e0b" /> Audit Timeline Log ({logs.length})
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {logs.map((l, lIdx) => (
                            <div
                              key={l.id || lIdx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "10px 14px",
                                borderRadius: "10px",
                                background: "rgba(18, 24, 40, 0.6)",
                                border: "1px solid #334155",
                                fontSize: "12px"
                              }}
                            >
                              <div>
                                <span className={`status-pill status-${l.action || "pending"}`} style={{ marginRight: "8px" }}>
                                  {l.action}
                                </span>
                                <span style={{ color: "#cbd5e1" }}>{l.note || "Status updated"}</span>
                              </div>
                              <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                                {l.timestamp ? new Date(l.timestamp).toLocaleString() : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Simulator Modal */}
      {showBotModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }} onClick={() => setShowBotModal(false)} />
          <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "500px", background: "#0f172a", border: "1px solid rgba(245, 158, 11, 0.4)", borderRadius: "20px", padding: "28px", color: "#fff" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 800, color: "#fde68a" }}>
              WhatsApp Two-Way Webhook Simulator
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label className="adm-label">Phone Number to Simulate</label>
                <input
                  type="text"
                  value={botTestPhone}
                  onChange={(e) => setBotTestPhone(e.target.value)}
                  placeholder="e.g. 918107925353"
                  className="adm-input-custom adm-input-noicon"
                />
              </div>
              <div>
                <label className="adm-label">User Reply Text</label>
                <div className="adm-btn-group-3" style={{ marginBottom: "8px" }}>
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
                style={{ width: "100%", marginTop: "10px" }}
              >
                {botSimLoading ? "Processing..." : "Trigger Simulated Webhook"}
              </button>

              {botSimOutput && (
                <div style={{ marginTop: "12px", background: "#020617", padding: "12px", borderRadius: "10px", border: "1px solid #334155", fontSize: "11px", fontFamily: "monospace" }}>
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
