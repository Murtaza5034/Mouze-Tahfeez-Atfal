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
  GraduationCap
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
    <div className="admission-root-container" style={{ padding: "20px", background: "transparent" }}>
      <div className="admission-bg-pattern" />

      {/* Top Header Box */}
      <header className="adm-admin-header-box">
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
                onClick={() => { setActiveRole("super"); setActiveTab("all"); }}
                className={`adm-tab-pill ${activeRole === "super" ? "active" : ""}`}
                style={{ padding: "6px 14px", fontSize: "12px" }}
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => { setActiveRole("kibar"); setActiveTab("kibar"); }}
                className={`adm-tab-pill ${activeRole === "kibar" ? "active" : ""}`}
                style={{ padding: "6px 14px", fontSize: "12px" }}
              >
                Kibar Admin
              </button>
              <button
                type="button"
                onClick={() => { setActiveRole("atfal"); setActiveTab("atfal"); }}
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

      {/* KPI Stats Overview */}
      <div className="adm-kpi-grid">
        <div className="adm-kpi-card">
          <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-text-muted)" }}>Total Submissions</span>
          <span className="adm-kpi-num">{stats.total}</span>
        </div>
        <div className="adm-kpi-card" style={{ background: "linear-gradient(135deg, #fffdf8 0%, #fff7e4 100%)", borderColor: "var(--adm-gold-border)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-gold-dark)" }}>Pending</span>
          <span className="adm-kpi-num" style={{ color: "var(--adm-gold-dark)" }}>{stats.pending}</span>
        </div>
        <div className="adm-kpi-card" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", borderColor: "var(--adm-emerald-border)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-emerald-primary)" }}>Approved</span>
          <span className="adm-kpi-num" style={{ color: "var(--adm-emerald-primary)" }}>{stats.approved}</span>
        </div>
        <div className="adm-kpi-card" style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", borderColor: "var(--adm-amber-border)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-amber-primary)" }}>Waiting</span>
          <span className="adm-kpi-num" style={{ color: "var(--adm-amber-primary)" }}>{stats.waiting}</span>
        </div>
        <div className="adm-kpi-card" style={{ background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)", borderColor: "var(--adm-rose-border)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-rose-primary)" }}>Rejected</span>
          <span className="adm-kpi-num" style={{ color: "var(--adm-rose-primary)" }}>{stats.rejected}</span>
        </div>
        <div className="adm-kpi-card" style={{ background: "linear-gradient(135deg, #fdfbf7 0%, #f5eee6 100%)", borderColor: "var(--adm-border-soft)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-espresso-muted)" }}>Exit List</span>
          <span className="adm-kpi-num" style={{ color: "var(--adm-espresso-muted)" }}>{stats.exited}</span>
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
                style={{ maxWidth: "140px", padding: "8px 12px", fontSize: "12px", color: "var(--adm-gold-dark)", fontWeight: 700 }}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="waiting">Waiting</option>
                <option value="rejected">Rejected</option>
              </select>
            )}

            <div className="adm-input-icon-wrap" style={{ maxWidth: "220px" }}>
              <Search size={14} className="adm-input-icon" style={{ left: "12px" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, ITS..."
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

      {/* Applications List */}
      {activeTab !== "cms_settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--adm-text-muted)" }}>
              <RotateCw size={32} className="animate-spin" style={{ margin: "0 auto 12px auto", color: "var(--adm-gold-primary)" }} />
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Loading admission records from Firebase...</p>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "54px 20px", background: "#ffffff", borderRadius: "24px", border: "1.5px solid var(--adm-gold-border)", boxShadow: "var(--adm-shadow-sm)" }}>
              <Users size={36} style={{ margin: "0 auto 12px auto", color: "var(--adm-gold-primary)" }} />
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--adm-espresso-main)" }}>No Submissions Found</h3>
              <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "var(--adm-text-muted)" }}>
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
                    background: "#ffffff",
                    border: isExpanded ? "2px solid var(--adm-gold-primary)" : "1.5px solid var(--adm-gold-border)",
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: isExpanded ? "var(--adm-shadow-md)" : "var(--adm-shadow-sm)",
                    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
                  }}
                >
                  {/* Summary Header */}
                  <div
                    onClick={() => setExpandedCardId(isExpanded ? null : app.application_id)}
                    style={{
                      padding: "18px 22px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "14px",
                      cursor: "pointer",
                      flexWrap: "wrap",
                      background: isExpanded ? "var(--adm-cream-soft)" : "#ffffff"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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
                          fontFamily: "'Amiri', serif"
                        }}
                      >
                        {app.full_name?.charAt(0) || "ط"}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
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
                        <div style={{ display: "flex", gap: "12px", fontSize: "12.5px", color: "var(--adm-text-muted)", marginTop: "4px", flexWrap: "wrap" }}>
                          <span>{app.gender} • Age {app.age || "N/A"}</span>
                          <span>• Jamaat: <strong style={{ color: "var(--adm-espresso-main)" }}>{app.jamaat}</strong></span>
                          <span>• Phone: <strong style={{ color: "var(--adm-gold-dark)", fontFamily: "monospace" }}>{app.whatsapp_number}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <span className={`status-pill status-${app.status}`}>
                        {app.status}
                      </span>
                      {isExpanded ? <ChevronUp size={20} color="var(--adm-gold-primary)" /> : <ChevronDown size={20} color="var(--adm-text-muted)" />}
                    </div>
                  </div>

                  {/* Expanded Card View */}
                  {isExpanded && (
                    <div style={{ borderTop: "1.5px solid var(--adm-gold-border)", padding: "24px", background: "var(--adm-ivory-warm)", display: "flex", flexDirection: "column", gap: "22px" }}>
                      {/* Detailed Grid */}
                      <div className="adm-form-grid" style={{ background: "#ffffff", padding: "20px", borderRadius: "16px", border: "1.5px solid var(--adm-gold-border)", boxShadow: "var(--adm-shadow-sm)", marginBottom: 0 }}>
                        <div>
                          <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Email Address</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", color: "var(--adm-espresso-main)", fontWeight: 700 }}>{app.email}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>WhatsApp Phone</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", color: "var(--adm-gold-dark)", fontFamily: "monospace", fontWeight: 800 }}>{app.whatsapp_number}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Program Chosen</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", color: "var(--adm-espresso-main)", fontWeight: 700 }}>{app.program}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Application Ref ID</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", color: "var(--adm-emerald-primary)", fontFamily: "monospace", fontWeight: 900 }}>{app.application_id}</p>
                        </div>

                        {app.last_achieved_sanad && (
                          <div>
                            <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Last Achieved Sanad</span>
                            <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", color: "var(--adm-emerald-primary)", fontWeight: 800 }}>{app.last_achieved_sanad}</p>
                          </div>
                        )}

                        {app.venue_and_time && (
                          <div className="adm-col-full">
                            <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Selected Venue & Time</span>
                            <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", color: "var(--adm-espresso-main)", fontWeight: 700 }}>{app.venue_and_time}</p>
                          </div>
                        )}

                        {app.dob && (
                          <div>
                            <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Date of Birth</span>
                            <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", color: "var(--adm-espresso-main)", fontWeight: 700 }}>{app.dob}</p>
                          </div>
                        )}

                        {app.hifz_till && (
                          <div>
                            <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--adm-text-muted)", fontWeight: 800 }}>Hifz Till</span>
                            <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", color: "var(--adm-espresso-main)", fontWeight: 700 }}>{app.hifz_till}</p>
                          </div>
                        )}
                      </div>

                      {/* Numeric Counters */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", background: "#ffffff", padding: "14px", borderRadius: "16px", textAlign: "center", border: "1.5px solid var(--adm-gold-border)", boxShadow: "var(--adm-shadow-sm)" }}>
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

                      {/* Action Buttons: Approved, Reject, Waiting + Exit & Resume System */}
                      <div style={{ background: "linear-gradient(135deg, #fffdf8 0%, #fff7e6 100%)", border: "1.5px solid var(--adm-gold-border)", borderRadius: "18px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: "var(--adm-shadow-sm)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-gold-dark)", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Sparkles size={15} /> Status Actions & Automated WhatsApp Notifications
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(app.application_id, "approved")}
                            disabled={actionLoadingId === app.application_id || app.status === "approved"}
                            className="adm-btn-primary adm-btn-emerald"
                            style={{ padding: "9px 20px", fontSize: "13px" }}
                          >
                            <CheckCircle2 size={16} /> Approved
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(app.application_id, "waiting")}
                            disabled={actionLoadingId === app.application_id || app.status === "waiting"}
                            className="adm-btn-secondary"
                            style={{ padding: "9px 20px", fontSize: "13px", color: "var(--adm-amber-primary)", borderColor: "var(--adm-amber-border)" }}
                          >
                            <Clock size={16} /> Waiting
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(app.application_id, "rejected")}
                            disabled={actionLoadingId === app.application_id || app.status === "rejected"}
                            className="adm-btn-secondary"
                            style={{ padding: "9px 20px", fontSize: "13px", color: "var(--adm-rose-primary)", borderColor: "var(--adm-rose-border)" }}
                          >
                            <XCircle size={16} /> Reject
                          </button>

                          {/* The Exit Button (Visible when Approved) */}
                          {app.status === "approved" && (
                            <button
                              type="button"
                              onClick={() => handleExitUser(app.application_id)}
                              className="adm-btn-secondary"
                              style={{ marginLeft: "auto", color: "var(--adm-rose-primary)", borderColor: "var(--adm-rose-border)" }}
                            >
                              <LogOut size={16} /> Move to Exit List
                            </button>
                          )}

                          {/* The Resume Button (Visible in Exit List) */}
                          {app.status === "exited" && (
                            <button
                              type="button"
                              onClick={() => handleResumeUser(app.application_id)}
                              className="adm-btn-primary adm-btn-emerald"
                              style={{ marginLeft: "auto", padding: "9px 22px", fontSize: "13px" }}
                            >
                              <RotateCw size={16} /> Resume to Active Approved
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Historical Timeline */}
                      <div>
                        <h4 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-espresso-main)", display: "flex", alignItems: "center", gap: "6px" }}>
                          <History size={15} color="var(--adm-gold-dark)" /> Audit Timeline Log ({logs.length})
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {logs.map((l, lIdx) => (
                            <div
                              key={l.id || lIdx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "12px 16px",
                                borderRadius: "12px",
                                background: "#ffffff",
                                border: "1px solid var(--adm-gold-border)",
                                fontSize: "12.5px",
                                boxShadow: "var(--adm-shadow-sm)"
                              }}
                            >
                              <div>
                                <span className={`status-pill status-${l.action || "pending"}`} style={{ marginRight: "10px" }}>
                                  {l.action}
                                </span>
                                <span style={{ color: "var(--adm-espresso-main)", fontWeight: 600 }}>{l.note || "Status updated"}</span>
                              </div>
                              <span style={{ fontSize: "11px", color: "var(--adm-text-muted)", fontFamily: "monospace" }}>
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
                  placeholder="e.g. 918107925353"
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
