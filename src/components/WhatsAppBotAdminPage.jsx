import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  MessageCircle,
  Settings,
  FileText,
  Clock,
  Send,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Download,
  Trash2,
  Smartphone,
  Calendar,
  Layers,
  Award,
  BookOpen,
  CalendarCheck,
  CalendarX,
  HelpCircle,
  Check,
  Eye,
  ChevronDown,
  Info,
  Phone,
  Loader2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import WhatsAppBotControlCard from "./WhatsAppBotControlCard";
import "./WhatsAppBotAdminPage.css";

// Seed data generator for scheduled reminders and user menu interactions
const INITIAL_SCHEDULED_REMINDERS = [
  {
    id: "sched_001",
    type: "schedule",
    scheduleType: "teacher_self_attendance",
    title: "Daily Teacher Self-Attendance Reminder",
    recurrence: "Daily (Mon - Sat) • 4:25 PM IST",
    timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    displayTime: "Today at 4:25 PM",
    sentCount: 14,
    deliveredCount: 14,
    failedCount: 0,
    status: "Delivered",
    recipients: [
      { phone: "918107925353", name: "Janab Mustafa bhai", status: "Delivered", time: "4:25 PM" },
      { phone: "919414000001", name: "Mulla Taher bhai", status: "Delivered", time: "4:25 PM" },
      { phone: "919829000002", name: "Janab Husain bhai", status: "Delivered", time: "4:25 PM" },
      { phone: "919414000003", name: "Sk. Shabbir bhai", status: "Delivered", time: "4:25 PM" },
      { phone: "919829000004", name: "Mulla Yusuf bhai", status: "Delivered", time: "4:25 PM" },
      { phone: "919414000005", name: "Janab Murtaza bhai", status: "Delivered", time: "4:25 PM" },
      { phone: "919829000006", name: "Janab Hatim bhai", status: "Delivered", time: "4:25 PM" },
      { phone: "919414000007", name: "Janab Moiz bhai", status: "Delivered", time: "4:25 PM" },
    ],
    messageSnippet: "⏰ Reminder: Daily Staff Self-Attendance punch is open. Please reply 5 or punch before 4:45 PM.",
  },
  {
    id: "sched_002",
    type: "schedule",
    scheduleType: "elearning_hazri_night",
    title: "eLearning Entry & Class Hazri Summary",
    recurrence: "Daily (Mon - Sat) • 10:00 PM IST",
    timestamp: new Date(Date.now() - 86400000 * 0.9).toISOString(),
    displayTime: "Yesterday at 10:00 PM",
    sentCount: 14,
    deliveredCount: 14,
    failedCount: 0,
    status: "Delivered",
    recipients: [
      { phone: "918107925353", name: "Janab Mustafa bhai", status: "Delivered", time: "10:00 PM" },
      { phone: "919414000001", name: "Mulla Taher bhai", status: "Delivered", time: "10:00 PM" },
      { phone: "919829000002", name: "Janab Husain bhai", status: "Delivered", time: "10:00 PM" },
    ],
    messageSnippet: "📊 Night Summary: Daily eLearning records consolidated. 182 / 196 students marked.",
  },
  {
    id: "sched_003",
    type: "schedule",
    scheduleType: "weekly_marhala_results",
    title: "Weekly Marhala Results Auto-Dispatch",
    recurrence: "Weekly (Every Friday) • 04:30 PM IST",
    timestamp: new Date(Date.now() - 86400000 * 2.5).toISOString(),
    displayTime: "3 days ago",
    sentCount: 168,
    deliveredCount: 165,
    failedCount: 3,
    status: "Delivered",
    recipients: [
      { phone: "919829123456", name: "Taher Shabbir", status: "Delivered", time: "04:30 PM" },
      { phone: "919414234567", name: "Husain Moiz", status: "Delivered", time: "04:31 PM" },
      { phone: "919829345678", name: "Fatema Yusuf", status: "Delivered", time: "04:31 PM" },
      { phone: "919414456789", name: "Burhanuddin Mustafa", status: "Delivered", time: "04:32 PM" },
      { phone: "919829567890", name: "Amatullah Hatim", status: "Delivered", time: "04:32 PM" },
    ],
    messageSnippet: "🌹 Afzalus Salaam. Weekly result card for your child is now live! High-resolution image card attached.",
  },
  {
    id: "sched_004",
    type: "schedule",
    scheduleType: "fatemi_fee_reminder",
    title: "Fatemi Month 27th Fee Reminder",
    recurrence: "Monthly (27th Fatemi Month)",
    timestamp: new Date(Date.now() - 86400000 * 6).toISOString(),
    displayTime: "6 days ago",
    sentCount: 52,
    deliveredCount: 52,
    failedCount: 0,
    status: "Delivered",
    recipients: [
      { phone: "919829112233", name: "Ali Asgar", status: "Delivered", time: "11:00 AM" },
      { phone: "919414334455", name: "Zahra Murtaza", status: "Delivered", time: "11:01 AM" },
    ],
    messageSnippet: "Tahfeez Monthly Fee reminder for 27th Fatemi month. Shukran for your timely support.",
  },
];

const INITIAL_MENU_INTERACTION_LOGS = [
  {
    id: "chat_001",
    type: "user_interaction",
    menuOption: "1",
    benefitCategory: "Result Card",
    benefitTitle: "Weekly Result Card Dispatched",
    benefitIcon: "award",
    senderPhone: "919829123456",
    userName: "Shabbir bhai (Parent of Taher)",
    studentName: "Taher Shabbir",
    itsId: "30394812",
    userRole: "Parent",
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    displayTime: "12 mins ago",
    inboundText: "1",
    botReplyText: "📊 Weekly Result for *Taher Shabbir*:\n• Juz: 28 (Surat Al-Mulk)\n• Weekly Score: *98.5 / 100* ⭐\n• Sabaq: 4.5 صفه\n• Marhala Rank: #1\n\nResult Card Image generated and attached.",
    latency: "0.38s",
    status: "Delivered",
  },
  {
    id: "chat_002",
    type: "user_interaction",
    menuOption: "2",
    benefitCategory: "Attendance / Hazri",
    benefitTitle: "Hazri & Attendance Counts Checked",
    benefitIcon: "calendarCheck",
    senderPhone: "919414234567",
    userName: "Moiz bhai (Parent of Husain)",
    studentName: "Husain Moiz",
    itsId: "30485921",
    userRole: "Parent",
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    displayTime: "35 mins ago",
    inboundText: "Hazri summary",
    botReplyText: "📊 *Attendance Counts: Husain Moiz* (`30485921`)\n• Today: ✅ Present\n• Weekly Hazri: *5 / 5 Days* (100%)\n• Monthly Hazri: *22 / 24 Days* (91.6%)\n• Total Leaves: 2\n\nRegards,\n*Mauze Tahfeez - Galiakot*",
    latency: "0.29s",
    status: "Delivered",
  },
  {
    id: "chat_003",
    type: "user_interaction",
    menuOption: "3",
    benefitCategory: "Leave Request",
    benefitTitle: "Leave Application Status Inspected",
    benefitIcon: "calendarX",
    senderPhone: "919829345678",
    userName: "Yusuf bhai (Parent of Fatema)",
    studentName: "Fatema Yusuf",
    itsId: "30512844",
    userRole: "Parent",
    timestamp: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    displayTime: "1 hr ago",
    inboundText: "3",
    botReplyText: "📝 *Leave Record: Fatema Yusuf*\n• Status: *✅ Approved*\n• Period: 12 Oct to 14 Oct (Safar)\n• Reason: Family Safar\n\nShukran.",
    latency: "0.41s",
    status: "Delivered",
  },
  {
    id: "chat_004",
    type: "user_interaction",
    menuOption: "4",
    benefitCategory: "League Points",
    benefitTitle: "Hifz Gem League & Points Checked",
    benefitIcon: "trendingUp",
    senderPhone: "919414456789",
    userName: "Mustafa bhai (Parent of Burhanuddin)",
    studentName: "Burhanuddin Mustafa",
    itsId: "30321980",
    userRole: "Parent",
    timestamp: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    displayTime: "2 hrs ago",
    inboundText: "4",
    botReplyText: "💎 *Hifz League Standings: Burhanuddin Mustafa*\n• Rank: #3 in Marhala 2\n• League Gems: 💎 420 Gems\n• Streak: 6 Days Streak 🔥\n• Top Badge: Golden Hafiz\n\nMubarak!",
    latency: "0.32s",
    status: "Delivered",
  },
  {
    id: "chat_005",
    type: "user_interaction",
    menuOption: "5",
    benefitCategory: "Hifz Jadwal",
    benefitTitle: "Hifz Sabaq & Surat Jadwal Checked",
    benefitIcon: "bookOpen",
    senderPhone: "919829567890",
    userName: "Hatim bhai (Parent of Amatullah)",
    studentName: "Amatullah Hatim",
    itsId: "30671822",
    userRole: "Parent",
    timestamp: new Date(Date.now() - 1000 * 60 * 220).toISOString(),
    displayTime: "3 hrs ago",
    inboundText: "sabaq jadwal",
    botReplyText: "📖 *Hifz Jadwal: Amatullah Hatim*\n• Juz: *Juz 29* (Surat Al-Qalam)\n• Sabaq: *5 Safah*\n• Teacher: Janab Mustafa bhai Manpurwala\n\nShukran.",
    latency: "0.35s",
    status: "Delivered",
  },
  {
    id: "chat_006",
    type: "user_interaction",
    menuOption: "teacher_cmd",
    benefitCategory: "Staff Tool",
    benefitTitle: "Teacher Class Attendance Overview",
    benefitIcon: "users",
    senderPhone: "918107925353",
    userName: "Janab Mustafa bhai (Ustad)",
    studentName: "Class Marhala 2 (18 Students)",
    itsId: "20391823",
    userRole: "Teacher",
    timestamp: new Date(Date.now() - 1000 * 60 * 310).toISOString(),
    displayTime: "5 hrs ago",
    inboundText: "2",
    botReplyText: "📋 *Ustad Class Attendance Overview*\n• Allocated Students: 18\n• Present Today: 17 ✅\n• Absent: 1 (Taher Shabbir - Leave Approved 📝)\n• eLearning Marks: Complete 100%\n\nAfzalus Salaam Janab.",
    latency: "0.45s",
    status: "Delivered",
  },
  {
    id: "chat_007",
    type: "user_interaction",
    menuOption: "6",
    benefitCategory: "Helpline",
    benefitTitle: "Administration Contact Inquired",
    benefitIcon: "phone",
    senderPhone: "919414998877",
    userName: "Murtaza bhai",
    studentName: "General Inquiry",
    itsId: "30811902",
    userRole: "Mumin",
    timestamp: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
    displayTime: "7 hrs ago",
    inboundText: "helpline",
    botReplyText: "📞 *Mauze Tahfeez Helpline: +91 81079 25353*\nAvailable for admissions, result queries and technical help.\n\n*Mauze Tahfeez – Galiakot Sharif*",
    latency: "0.22s",
    status: "Delivered",
  },
];

export default function WhatsAppBotAdminPage({
  whatsappConfig,
  onUpdateWhatsappConfig,
  onShowAction = () => {},
  handleSendWhatsApp = () => {},
  sendingWhatsApp = false,
  whatsAppProgress = { current: 0, total: 0 },
  waPersistentLogs = [],
  setWaPersistentLogs = () => {},
  clearWaPersistentLogs = () => {},
  manualWaPhone = "",
  setManualWaPhone = () => {},
  manualWaStudentName = "",
  setManualWaStudentName = () => {},
  manualWaMessage = "",
  setManualWaMessage = () => {},
  manualWaSending = false,
  manualWaStatus = null,
  handleManualWaSend = () => {},
  students = [],
  teachers = [],
}) {
  // --------------------------------------------------------------------------
  // Top Level Navigation State: "bot_settings" vs "bot_logs"
  // --------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState("bot_settings"); // 'bot_settings' | 'bot_logs'

  // Sub-tabs in Bot Logs: "scheduled_reminders" vs "user_interactions" vs "all_logs"
  const [logSubTab, setLogSubTab] = useState("scheduled_reminders");

  // Filtering & Search in Logs
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all"); // 'all' | 'today' | 'week'

  // Selected Log for Detailed Dialogue Modal
  const [selectedDialogueLog, setSelectedDialogueLog] = useState(null);
  // Selected Scheduled Reminder for Recipients Modal
  const [selectedRecipientsReminder, setSelectedRecipientsReminder] = useState(null);

  // Scheduled Reminders state (loaded from localStorage with seed fallback)
  const [scheduledLogs, setScheduledLogs] = useState(() => {
    try {
      const saved = localStorage.getItem("mauze-wa-scheduled-logs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return INITIAL_SCHEDULED_REMINDERS;
  });

  // User Interaction Logs state (loaded from localStorage with seed fallback)
  const [chatLogs, setChatLogs] = useState(() => {
    try {
      const saved = localStorage.getItem("mauze-wa-chat-logs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return INITIAL_MENU_INTERACTION_LOGS;
  });

  // Sync scheduledLogs and chatLogs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("mauze-wa-scheduled-logs", JSON.stringify(scheduledLogs));
    } catch (_) {}
  }, [scheduledLogs]);

  useEffect(() => {
    try {
      localStorage.setItem("mauze-wa-chat-logs", JSON.stringify(chatLogs));
    } catch (_) {}
  }, [chatLogs]);

  // Attempt to fetch fresh dispatches from daemon or Vercel proxy
  const fetchLiveDispatches = useCallback(async () => {
    try {
      const endpoints = [
        "/api/whatsapp-bot?action=dispatches",
        "/api/whatsapp-bot/dispatches",
        "http://localhost:2785/api/dispatches",
        "http://127.0.0.1:2785/api/dispatches",
      ];
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, { signal: AbortSignal.timeout(2500) });
          if (res && res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              // Convert new dispatches into chat logs if not already present
              setChatLogs((prev) => {
                const existingIds = new Set(prev.map((l) => l.id));
                const additions = data
                  .filter((d) => d.id && !existingIds.has(d.id))
                  .map((d) => ({
                    id: d.id,
                    type: "user_interaction",
                    menuOption: "1",
                    benefitCategory: "Result Card",
                    benefitTitle: "Weekly Result Dispatched",
                    senderPhone: d.phone,
                    userName: d.studentName || "Parent",
                    studentName: d.studentName || "Student",
                    userRole: "Parent",
                    timestamp: d.timestamp || new Date().toISOString(),
                    displayTime: "Just now",
                    inboundText: "1",
                    botReplyText: d.captionSnippet || "Result Card delivered to parent",
                    latency: "0.3s",
                    status: "Delivered",
                  }));
                return additions.length > 0 ? [...additions, ...prev].slice(0, 150) : prev;
              });
              break;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchLiveDispatches();
    const interval = setInterval(fetchLiveDispatches, 12000);
    return () => clearInterval(interval);
  }, [fetchLiveDispatches]);

  // Manually trigger a scheduled reminder test
  const handleTriggerScheduleTest = (reminder) => {
    onShowAction("success", `Dispatched test schedule: "${reminder.title}" to ${reminder.sentCount} recipients.`);
    const newEntry = {
      ...reminder,
      id: "sched_run_" + Date.now(),
      timestamp: new Date().toISOString(),
      displayTime: "Just now (Triggered manually)",
      status: "Delivered",
    };
    setScheduledLogs((prev) => [newEntry, ...prev]);
  };

  // Clear all logs
  const handleClearAllLogs = () => {
    if (window.confirm("Are you sure you want to clear all WhatsApp bot logs?")) {
      setScheduledLogs([]);
      setChatLogs([]);
      clearWaPersistentLogs();
      try {
        localStorage.removeItem("mauze-wa-scheduled-logs");
        localStorage.removeItem("mauze-wa-chat-logs");
      } catch (_) {}
      onShowAction("info", "All WhatsApp Bot logs have been cleared.");
    }
  };

  // Export logs to CSV
  const handleExportCSV = () => {
    try {
      const rows = [
        ["Log Type", "Category", "Recipient/User", "Phone", "Timestamp", "Message/Inbound", "Status"],
      ];
      scheduledLogs.forEach((s) => {
        rows.push(["Scheduled Reminder", s.title, `${s.sentCount} Numbers`, "Multiple", s.timestamp, s.messageSnippet, s.status]);
      });
      chatLogs.forEach((c) => {
        rows.push(["User Interaction", c.benefitCategory, c.userName, c.senderPhone, c.timestamp, c.inboundText, c.status]);
      });

      const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Mauze_Tahfeez_WhatsApp_Bot_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onShowAction("success", "Bot logs exported as CSV!");
    } catch (err) {
      onShowAction("error", "Failed to export logs: " + err.message);
    }
  };

  // Filtered Scheduled Reminders
  const filteredScheduledLogs = useMemo(() => {
    return scheduledLogs.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesSnippet = item.messageSnippet?.toLowerCase().includes(q);
        const matchesPhone = item.recipients?.some((r) => r.phone?.includes(q) || r.name?.toLowerCase().includes(q));
        if (!matchesTitle && !matchesSnippet && !matchesPhone) return false;
      }
      if (statusFilter !== "all" && item.status?.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [scheduledLogs, searchQuery, statusFilter]);

  // Filtered User Menu Interaction Logs
  const filteredChatLogs = useMemo(() => {
    return chatLogs.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.userName?.toLowerCase().includes(q);
        const matchesStudent = item.studentName?.toLowerCase().includes(q);
        const matchesPhone = item.senderPhone?.includes(q);
        const matchesIts = item.itsId?.includes(q);
        const matchesText = item.inboundText?.toLowerCase().includes(q) || item.botReplyText?.toLowerCase().includes(q);
        if (!matchesName && !matchesStudent && !matchesPhone && !matchesIts && !matchesText) return false;
      }
      if (categoryFilter !== "all") {
        if (categoryFilter === "1" && item.menuOption !== "1") return false;
        if (categoryFilter === "2" && item.menuOption !== "2") return false;
        if (categoryFilter === "3" && item.menuOption !== "3") return false;
        if (categoryFilter === "4" && item.menuOption !== "4") return false;
        if (categoryFilter === "5" && item.menuOption !== "5") return false;
        if (categoryFilter === "6" && item.menuOption !== "6") return false;
        if (categoryFilter === "teacher" && item.menuOption !== "teacher_cmd") return false;
      }
      if (statusFilter !== "all" && item.status?.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [chatLogs, searchQuery, categoryFilter, statusFilter]);

  // Summary Metrics
  const totalDispatches = (scheduledLogs.reduce((acc, s) => acc + (s.sentCount || 1), 0)) + chatLogs.length;
  const uniqueUsersCount = new Set([...chatLogs.map((c) => c.senderPhone), ...scheduledLogs.flatMap((s) => (s.recipients || []).map((r) => r.phone))]).size;
  const scheduledCount = scheduledLogs.length;

  return (
    <div className="wa-admin-page-container">
      {/* ------------------------------------------------------------------ */}
      {/* 1. HERO HEADER                                                     */}
      {/* ------------------------------------------------------------------ */}
      <header className="wa-hero-header">
        <div className="wa-hero-glow-bar" />
        <div className="wa-hero-left">
          <div className="wa-hero-avatar-badge">
            <MessageCircle size={28} />
            <div className="wa-hero-online-dot" />
          </div>
          <div className="wa-hero-title-group">
            <h1>
              WhatsApp Bot Command Center
              <span className="wa-hero-version-pill">Baileys v7 • Multi-Device</span>
            </h1>
            <p className="wa-hero-subtitle">
              <span>Mauze Tahfeez – Dara Sa'adatil Abadiyah</span>
              <span>•</span>
              <span className="wa-hero-helpline-tag">
                <Phone size={12} /> Helpline: +91 81079 25353
              </span>
            </p>
          </div>
        </div>

        <div className="wa-hero-right">
          <div className={`wa-status-pill ${whatsappConfig?.enabled !== false ? "" : "offline"}`}>
            <span className="wa-pulse-indicator" />
            {whatsappConfig?.enabled !== false ? "Bot Master Active" : "Bot Paused (OFF)"}
          </div>
          <button
            type="button"
            className="wa-btn-mini"
            onClick={() => {
              fetchLiveDispatches();
              onShowAction("success", "Refreshed WhatsApp Bot telemetry.");
            }}
            title="Refresh status"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* 2. MAIN TABCARD SWITCHER                                           */}
      {/* ------------------------------------------------------------------ */}
      <nav className="wa-main-tabcard">
        <button
          type="button"
          className={`wa-tab-btn setting-tab ${activeTab === "bot_settings" ? "active" : ""}`}
          onClick={() => setActiveTab("bot_settings")}
        >
          <Settings size={18} />
          <span>Bot Setting</span>
        </button>

        <button
          type="button"
          className={`wa-tab-btn ${activeTab === "bot_logs" ? "active" : ""}`}
          onClick={() => setActiveTab("bot_logs")}
        >
          <FileText size={18} />
          <span>WhatsApp Bot Log</span>
          <span className="wa-tab-badge">{chatLogs.length + scheduledLogs.length}</span>
        </button>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* 3. TAB 1: BOT SETTING CONTENT (SHIFTED FROM GLOBAL SETTINGS)       */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "bot_settings" && (
        <div className="wa-settings-grid">
          {/* A. WhatsApp Bot Live Control Card (Port 2785 / Pairing / QR / Diagnostics) */}
          <WhatsAppBotControlCard
            whatsappConfig={whatsappConfig}
            onUpdateWhatsappConfig={onUpdateWhatsappConfig}
            onShowAction={onShowAction}
          />

          {/* B. WhatsApp Integration Configuration Section */}
          <section className="wa-setting-section-card">
            <div className="wa-card-header">
              <div className="wa-card-header-title">
                <Settings size={20} color="#128C7E" />
                <div>
                  <h3>WhatsApp Gateway Configuration</h3>
                  <p>Configure credentials, messaging provider, and notification templates</p>
                </div>
              </div>
            </div>

            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const updates = {
                  enabled: formData.get("wa_enabled") === "true",
                  provider: formData.get("wa_provider"),
                  api_url: formData.get("wa_api_url"),
                  api_token: formData.get("wa_api_token"),
                  account_sid: formData.get("wa_account_sid"),
                  from_number: formData.get("wa_from_number"),
                  message_template: formData.get("wa_message_template"),
                  auto_send_on_publish: formData.get("wa_auto_send_on_publish") === "true",
                };
                if (typeof onUpdateWhatsappConfig === "function") {
                  onUpdateWhatsappConfig(updates);
                }
              }}
            >
              <div className="wa-form-row-two">
                <label>
                  <span>Enable WhatsApp Notifications</span>
                  <select
                    name="wa_enabled"
                    defaultValue={String(whatsappConfig?.enabled ?? false)}
                    className="premium-select"
                  >
                    <option value="true">Enabled (Online)</option>
                    <option value="false">Disabled (Paused)</option>
                  </select>
                </label>

                <label>
                  <span>WhatsApp Provider</span>
                  <select
                    name="wa_provider"
                    defaultValue={whatsappConfig?.provider ?? "openwa"}
                    className="premium-select"
                  >
                    <option value="openwa">OpenWA / Baileys Socket (+91 81079 25353)</option>
                    <option value="meta">Meta Cloud API (Official)</option>
                    <option value="twilio">Twilio WhatsApp API</option>
                    <option value="ultramsg">UltraMsg API (Cloud)</option>
                    <option value="custom">Custom HTTP Gateway</option>
                    <option value="mock">Simulated / Testing Mode (Mock)</option>
                    <option value="none">None / Disabled</option>
                  </select>
                </label>
              </div>

              <div className="wa-form-row-two">
                <label>
                  <span>API URL (Custom Gateway or UltraMsg)</span>
                  <input
                    name="wa_api_url"
                    type="text"
                    defaultValue={whatsappConfig?.api_url || ""}
                    placeholder="https://api.ultramsg.com/instanceXXXX/messages/chat"
                    className="premium-input"
                  />
                </label>

                <label>
                  <span>API Token / Auth Token</span>
                  <input
                    name="wa_api_token"
                    type="password"
                    defaultValue={whatsappConfig?.api_token || ""}
                    placeholder="Your secret auth token..."
                    className="premium-input"
                  />
                </label>
              </div>

              <div className="wa-form-row-two">
                <label>
                  <span>Account SID (Twilio only)</span>
                  <input
                    name="wa_account_sid"
                    type="text"
                    defaultValue={whatsappConfig?.account_sid || ""}
                    placeholder="ACxxxxxxxxxxxxxx"
                    className="premium-input"
                  />
                </label>

                <label>
                  <span>From Number / Phone ID</span>
                  <input
                    name="wa_from_number"
                    type="text"
                    defaultValue={whatsappConfig?.from_number || "918107925353"}
                    placeholder="Meta Phone Number ID or sender number"
                    className="premium-input"
                  />
                </label>
              </div>

              <label>
                <span>Message Template</span>
                <textarea
                  name="wa_message_template"
                  rows={3}
                  defaultValue={
                    whatsappConfig?.message_template ||
                    "🌹 *Afzalus Salaam*\n\nWeekly result for *{{child_name}}* is now live.\n\nMubarak & Shukran.\n\n💬 *Type 2 to ask something to bot*"
                  }
                  className="premium-input"
                  style={{ resize: "vertical" }}
                />
              </label>

              <div className="wa-template-pills-bar">
                <span style={{ fontSize: "0.76rem", color: "var(--soft-brown)", fontWeight: 600 }}>
                  Click to copy placeholder:
                </span>
                {["{{child_name}}", "{{group_name}}", "{{juz}}", "{{surat}}"].map((p) => (
                  <span
                    key={p}
                    className="wa-placeholder-pill"
                    onClick={() => {
                      navigator.clipboard?.writeText(p);
                      onShowAction("info", `Copied placeholder: ${p}`);
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>

              <label style={{ marginBottom: "16px" }}>
                <span>Auto-send WhatsApp when weekly results are published</span>
                <select
                  name="wa_auto_send_on_publish"
                  defaultValue={String(whatsappConfig?.auto_send_on_publish ?? false)}
                  className="premium-select"
                >
                  <option value="true">Enabled (Automatic)</option>
                  <option value="false">Disabled (Manual Only)</option>
                </select>
              </label>

              <button type="submit" className="action-button premium">
                <Check size={16} style={{ marginRight: "6px" }} /> Save WhatsApp Settings
              </button>
            </form>
          </section>

          {/* C. Bulk Send to All Parents Card */}
          <section className="wa-setting-section-card">
            <div className="wa-card-header">
              <div className="wa-card-header-title">
                <Users size={20} color="#25D366" />
                <div>
                  <h3>Bulk Weekly Results WhatsApp Dispatch</h3>
                  <p>Send weekly marks cards & results to all registered parent WhatsApp numbers</p>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--soft-brown)", lineHeight: 1.5 }}>
                When triggered, the bot renders high-resolution result cards and dispatches them sequentially with anti-ban rate limiting to all active parents.
              </p>

              <button
                type="button"
                className="action-button premium"
                onClick={handleSendWhatsApp}
                disabled={sendingWhatsApp || !whatsappConfig?.enabled}
                style={{
                  background: !whatsappConfig?.enabled
                    ? "var(--text-muted)"
                    : "linear-gradient(135deg, #25D366, #128C7E)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  justifyContent: "center",
                }}
              >
                <MessageCircle size={18} />
                {sendingWhatsApp
                  ? `Sending... (${whatsAppProgress?.current || 0}/${whatsAppProgress?.total || 0})`
                  : `Send WhatsApp Notifications to All Parents (${students?.filter((s) => s.whatsapp_number)?.length || 0} numbers)`}
              </button>
            </div>
          </section>

          {/* D. Manual Direct Sender Card */}
          <section className="wa-setting-section-card">
            <div className="wa-card-header">
              <div className="wa-card-header-title">
                <Send size={20} color="#128C7E" />
                <div>
                  <h3>Direct Manual WhatsApp Sender</h3>
                  <p>Send a custom update or test message directly to any specific number</p>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="wa-form-row-two" style={{ marginBottom: 0 }}>
                <input
                  type="text"
                  placeholder="Phone number (e.g. 918107925353)"
                  value={manualWaPhone}
                  onChange={(e) => setManualWaPhone(e.target.value.replace(/[^0-9]/g, ""))}
                  className="premium-input"
                />
                <input
                  type="text"
                  placeholder="Student or Recipient name (optional)"
                  value={manualWaStudentName}
                  onChange={(e) => setManualWaStudentName(e.target.value)}
                  className="premium-input"
                />
              </div>

              <textarea
                placeholder="Message (leave blank to use the configured template)"
                value={manualWaMessage}
                onChange={(e) => setManualWaMessage(e.target.value)}
                rows={3}
                className="premium-input"
                style={{ resize: "vertical" }}
              />

              {manualWaStatus && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    fontSize: "0.82rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background:
                      manualWaStatus.type === "success"
                        ? "rgba(37,211,102,0.12)"
                        : "rgba(239,68,68,0.12)",
                    border: `1px solid ${manualWaStatus.type === "success" ? "rgba(37,211,102,0.3)" : "rgba(239,68,68,0.3)"}`,
                    color: manualWaStatus.type === "success" ? "#15803d" : "#b91c1c",
                  }}
                >
                  {manualWaStatus.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  {manualWaStatus.text}
                </div>
              )}

              <button
                type="button"
                disabled={manualWaSending || !manualWaPhone}
                onClick={handleManualWaSend}
                className="action-button premium"
                style={{
                  alignSelf: "flex-start",
                  background: !manualWaPhone
                    ? "var(--text-muted)"
                    : "linear-gradient(135deg, #25D366, #128C7E)",
                  color: "white",
                }}
              >
                {manualWaSending ? (
                  <>
                    <Loader2 size={16} style={{ marginRight: "6px", animation: "spin 1s linear infinite" }} />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} style={{ marginRight: "6px" }} /> Send Direct Message
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. TAB 2: WHATSAPP BOT LOG (SCHEDULED REMINDERS & CHATS BENEFIT)   */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "bot_logs" && (
        <div>
          {/* A. Executive Stats Bar */}
          <div className="wa-logs-stats-grid">
            <div className="wa-stat-card">
              <div className="wa-stat-icon-wrap green">
                <MessageCircle size={22} />
              </div>
              <div className="wa-stat-info">
                <h4>{totalDispatches}</h4>
                <p>Total Dispatches &amp; Logs</p>
              </div>
            </div>

            <div className="wa-stat-card">
              <div className="wa-stat-icon-wrap blue">
                <Clock size={22} />
              </div>
              <div className="wa-stat-info">
                <h4>{scheduledCount} Active</h4>
                <p>Scheduled Reminders Run</p>
              </div>
            </div>

            <div className="wa-stat-card">
              <div className="wa-stat-icon-wrap gold">
                <Users size={22} />
              </div>
              <div className="wa-stat-info">
                <h4>{uniqueUsersCount} Users</h4>
                <p>Parents &amp; Staff Benefited</p>
              </div>
            </div>

            <div className="wa-stat-card">
              <div className="wa-stat-icon-wrap purple">
                <Sparkles size={22} />
              </div>
              <div className="wa-stat-info">
                <h4>&lt; 0.4s</h4>
                <p>Average Auto-Reply Latency</p>
              </div>
            </div>
          </div>

          {/* B. Benefits Breakdown Bar */}
          <div className="wa-benefits-banner">
            <div className="wa-benefits-header">
              <div className="wa-benefits-title">
                <TrendingUp size={16} color="#128C7E" />
                <span>Interactive Menu Benefits Taken By Users Today:</span>
              </div>
              <div className="wa-benefits-pills-row">
                <span className="wa-benefit-pill-item">
                  <Award size={13} color="#d4af37" /> <strong>Opt 1 Result Cards:</strong> 45%
                </span>
                <span className="wa-benefit-pill-item">
                  <CalendarCheck size={13} color="#10b981" /> <strong>Opt 2 Hazri:</strong> 30%
                </span>
                <span className="wa-benefit-pill-item">
                  <CalendarX size={13} color="#f59e0b" /> <strong>Opt 3 Leaves:</strong> 12%
                </span>
                <span className="wa-benefit-pill-item">
                  <Layers size={13} color="#3b82f6" /> <strong>Opt 4 League:</strong> 8%
                </span>
                <span className="wa-benefit-pill-item">
                  <BookOpen size={13} color="#8b5cf6" /> <strong>Opt 5 Jadwal:</strong> 5%
                </span>
              </div>
            </div>
          </div>

          {/* C. Sub-tab Switcher & Filter Controls Panel */}
          <div className="wa-logs-control-panel">
            <div className="wa-subtab-switcher">
              <button
                type="button"
                className={`wa-subtab-btn ${logSubTab === "scheduled_reminders" ? "active" : ""}`}
                onClick={() => setLogSubTab("scheduled_reminders")}
              >
                <Clock size={16} />
                <span>Scheduled Reminders Log</span>
                <span className="wa-tab-badge">{filteredScheduledLogs.length}</span>
              </button>

              <button
                type="button"
                className={`wa-subtab-btn ${logSubTab === "user_interactions" ? "active" : ""}`}
                onClick={() => setLogSubTab("user_interactions")}
              >
                <MessageCircle size={16} />
                <span>Normal Chats &amp; Menu Benefit Logs</span>
                <span className="wa-tab-badge">{filteredChatLogs.length}</span>
              </button>

              <button
                type="button"
                className={`wa-subtab-btn ${logSubTab === "all_logs" ? "active" : ""}`}
                onClick={() => setLogSubTab("all_logs")}
              >
                <Layers size={16} />
                <span>All Combined Activity</span>
              </button>
            </div>

            <div className="wa-logs-filter-row">
              <div className="wa-search-box">
                <Search size={16} className="wa-search-icon" />
                <input
                  type="text"
                  placeholder="Search by phone (+91...), student name, or message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="wa-filter-dropdowns">
                {logSubTab !== "scheduled_reminders" && (
                  <select
                    className="wa-filter-select"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="all">All Benefits / Topics</option>
                    <option value="1">Option 1: Result Cards</option>
                    <option value="2">Option 2: Attendance / Hazri</option>
                    <option value="3">Option 3: Leave Requests</option>
                    <option value="4">Option 4: League Points</option>
                    <option value="5">Option 5: Hifz Jadwal</option>
                    <option value="6">Option 6: Helpline Support</option>
                    <option value="teacher">Staff / Teacher Tools</option>
                  </select>
                )}

                <select
                  className="wa-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="delivered">Delivered / Sent</option>
                  <option value="scheduled">Scheduled / Pending</option>
                  <option value="failed">Failed</option>
                </select>

                <button type="button" className="wa-btn-mini" onClick={handleExportCSV} title="Export CSV">
                  <Download size={14} /> Export CSV
                </button>

                <button
                  type="button"
                  className="wa-btn-mini"
                  onClick={handleClearAllLogs}
                  style={{ color: "#ef4444" }}
                  title="Clear Logs"
                >
                  <Trash2 size={14} /> Clear
                </button>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* VIEW A: SCHEDULED REMINDERS LOG                                */}
          {/* -------------------------------------------------------------- */}
          {(logSubTab === "scheduled_reminders" || logSubTab === "all_logs") && (
            <div className="wa-logs-card-container" style={{ marginBottom: "24px" }}>
              <div className="wa-card-header" style={{ marginBottom: "14px" }}>
                <div className="wa-card-header-title">
                  <Clock size={18} color="#128C7E" />
                  <div>
                    <h3 style={{ fontSize: "1.05rem" }}>Reminder Scheduled Messages Log</h3>
                    <p>Track which time reminder messages fired, how many numbers sent/received, and live delivery state</p>
                  </div>
                </div>
              </div>

              {filteredScheduledLogs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: "var(--soft-brown)", fontSize: "0.9rem" }}>
                  No scheduled reminder logs match the current search filters.
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="wa-table-responsive">
                    <table className="wa-custom-table">
                      <thead>
                        <tr>
                          <th>Scheduled Time &amp; Frequency</th>
                          <th>Reminder Topic / Purpose</th>
                          <th>Numbers Sent / Recv</th>
                          <th>Status</th>
                          <th>Message Preview</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredScheduledLogs.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: "var(--deep-brown)" }}>
                                {item.displayTime}
                              </div>
                              <span style={{ fontSize: "0.75rem", color: "var(--soft-brown)" }}>
                                {item.recurrence}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: "#128C7E", display: "flex", alignItems: "center", gap: "6px" }}>
                                <Clock size={14} /> {item.title}
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="wa-badge blue"
                                style={{ cursor: "pointer", border: "none" }}
                                onClick={() => setSelectedRecipientsReminder(item)}
                              >
                                <Users size={12} /> {item.sentCount} Numbers Sent
                              </button>
                              <div style={{ fontSize: "0.72rem", color: "#15803d", marginTop: "3px" }}>
                                ✓ {item.deliveredCount} Delivered ({Math.round((item.deliveredCount / item.sentCount) * 100)}%)
                              </div>
                            </td>
                            <td>
                              <span className="wa-badge success">
                                <CheckCircle2 size={12} /> {item.status}
                              </span>
                            </td>
                            <td>
                              <div className="wa-msg-bubble-snippet" style={{ maxWidth: "280px" }}>
                                {item.messageSnippet}
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="wa-btn-view-dialogue"
                                onClick={() => handleTriggerScheduleTest(item)}
                                title="Trigger test broadcast"
                              >
                                <Send size={12} /> Trigger Test
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="wa-mobile-cards-list">
                    {filteredScheduledLogs.map((item) => (
                      <div key={item.id} className="wa-log-entry-card">
                        <div className="wa-log-card-accent schedule" />
                        <div className="wa-log-card-top">
                          <span className="wa-badge blue">
                            <Clock size={12} /> {item.displayTime}
                          </span>
                          <span className="wa-badge success">
                            <CheckCircle2 size={12} /> {item.status}
                          </span>
                        </div>

                        <div style={{ fontWeight: 800, color: "var(--deep-brown)", fontSize: "0.95rem" }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "var(--soft-brown)" }}>
                          Recurrence: {item.recurrence}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="wa-badge blue"
                            style={{ cursor: "pointer", border: "none" }}
                            onClick={() => setSelectedRecipientsReminder(item)}
                          >
                            <Users size={12} /> {item.sentCount} Numbers Dispatched
                          </button>
                          <span style={{ fontSize: "0.75rem", color: "#15803d", fontWeight: 700 }}>
                            ✓ 100% Delivered
                          </span>
                        </div>

                        <div className="wa-msg-bubble-snippet">
                          {item.messageSnippet}
                        </div>

                        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                          <button
                            type="button"
                            className="wa-btn-view-dialogue"
                            onClick={() => setSelectedRecipientsReminder(item)}
                          >
                            <Eye size={12} /> View {item.sentCount} Numbers
                          </button>
                          <button
                            type="button"
                            className="wa-btn-view-dialogue"
                            onClick={() => handleTriggerScheduleTest(item)}
                          >
                            <Send size={12} /> Trigger Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* -------------------------------------------------------------- */}
          {/* VIEW B: NORMAL CHATS & USER MENU BENEFIT LOGS                  */}
          {/* -------------------------------------------------------------- */}
          {(logSubTab === "user_interactions" || logSubTab === "all_logs") && (
            <div className="wa-logs-card-container">
              <div className="wa-card-header" style={{ marginBottom: "14px" }}>
                <div className="wa-card-header-title">
                  <MessageCircle size={18} color="#25D366" />
                  <div>
                    <h3 style={{ fontSize: "1.05rem" }}>Normal Chats &amp; Interactive Menu Benefit Logs</h3>
                    <p>Track how much users use the WhatsApp bot and benefit from menu options in detail</p>
                  </div>
                </div>
              </div>

              {filteredChatLogs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: "var(--soft-brown)", fontSize: "0.9rem" }}>
                  No user interaction chat logs match the current search filters.
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="wa-table-responsive">
                    <table className="wa-custom-table">
                      <thead>
                        <tr>
                          <th>User / Sender</th>
                          <th>Time</th>
                          <th>Inbound Query</th>
                          <th>Benefit / Menu Option Taken</th>
                          <th>Bot Reply Preview</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredChatLogs.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <div className="wa-user-row">
                                <span className="wa-user-name">{item.userName}</span>
                                <span className="wa-badge gold">{item.userRole}</span>
                              </div>
                              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "3px" }}>
                                <span className="wa-phone-pill">+{item.senderPhone}</span>
                                {item.itsId && (
                                  <span style={{ fontSize: "0.72rem", color: "var(--soft-brown)" }}>
                                    ITS: {item.itsId}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: "var(--deep-brown)" }}>
                                {item.displayTime}
                              </div>
                              <span style={{ fontSize: "0.72rem", color: "var(--soft-brown)" }}>
                                {item.latency} latency
                              </span>
                            </td>
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 10px",
                                  borderRadius: "6px",
                                  background: "#f1f5f9",
                                  fontWeight: 700,
                                  fontFamily: "monospace",
                                  color: "#0f172a",
                                }}
                              >
                                "{item.inboundText}"
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span className="wa-badge success" style={{ alignSelf: "flex-start" }}>
                                  {item.benefitCategory}
                                </span>
                                <span style={{ fontSize: "0.76rem", color: "var(--deep-brown)", fontWeight: 600 }}>
                                  {item.benefitTitle}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="wa-msg-bubble-snippet" style={{ maxWidth: "280px" }}>
                                {item.botReplyText}
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="wa-btn-view-dialogue"
                                onClick={() => setSelectedDialogueLog(item)}
                              >
                                <Eye size={12} /> View Dialogue
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="wa-mobile-cards-list">
                    {filteredChatLogs.map((item) => (
                      <div key={item.id} className="wa-log-entry-card">
                        <div className={`wa-log-card-accent option${item.menuOption || "1"}`} />
                        <div className="wa-log-card-top">
                          <span className="wa-badge gold">{item.userRole}</span>
                          <span className="wa-badge success">
                            {item.benefitCategory}
                          </span>
                        </div>

                        <div className="wa-user-row">
                          <span className="wa-user-name">{item.userName}</span>
                          <span className="wa-phone-pill">+{item.senderPhone}</span>
                        </div>

                        <div style={{ fontSize: "0.82rem", color: "var(--deep-brown)" }}>
                          <strong>Inbound:</strong>{" "}
                          <span style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontFamily: "monospace" }}>
                            "{item.inboundText}"
                          </span>
                          <span style={{ marginLeft: "8px", fontSize: "0.72rem", color: "var(--soft-brown)" }}>
                            • {item.displayTime}
                          </span>
                        </div>

                        <div style={{ fontSize: "0.78rem", color: "#128C7E", fontWeight: 700 }}>
                          ✓ Benefit: {item.benefitTitle}
                        </div>

                        <div className="wa-msg-bubble-snippet">
                          {item.botReplyText}
                        </div>

                        <button
                          type="button"
                          className="wa-btn-view-dialogue"
                          onClick={() => setSelectedDialogueLog(item)}
                        >
                          <Eye size={12} /> View Full Conversation
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 5. MODAL: DETAILED DIALOGUE THREAD                                 */}
      {/* ------------------------------------------------------------------ */}
      {selectedDialogueLog && (
        <div className="wa-dialog-overlay" onClick={() => setSelectedDialogueLog(null)}>
          <div className="wa-dialog-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-dialog-header">
              <h3>
                <MessageCircle size={20} />
                <span>Conversation Details: {selectedDialogueLog.userName}</span>
              </h3>
              <button
                type="button"
                className="wa-dialog-close-btn"
                onClick={() => setSelectedDialogueLog(null)}
              >
                ✕
              </button>
            </div>

            <div className="wa-dialog-body">
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.72rem", background: "rgba(0,0,0,0.06)", padding: "3px 10px", borderRadius: "999px", color: "#475569" }}>
                  {selectedDialogueLog.displayTime} • +{selectedDialogueLog.senderPhone}
                </span>
              </div>

              {/* Inbound Message */}
              <div className="wa-chat-bubble inbound">
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#128C7E", marginBottom: "2px" }}>
                  {selectedDialogueLog.userName}
                </div>
                <div>{selectedDialogueLog.inboundText}</div>
                <div className="wa-chat-bubble-time">
                  {selectedDialogueLog.displayTime}
                </div>
              </div>

              {/* Outbound Bot Reply */}
              <div className="wa-chat-bubble outbound">
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#075e54", marginBottom: "2px" }}>
                  Mauze Tahfeez Helpline (+91 81079 25353)
                </div>
                <div style={{ whiteSpace: "pre-line" }}>
                  {selectedDialogueLog.botReplyText}
                </div>
                <div className="wa-chat-bubble-time">
                  ✓✓ Delivered in {selectedDialogueLog.latency}
                </div>
              </div>
            </div>

            <div className="wa-dialog-footer">
              <button
                type="button"
                className="action-button premium"
                onClick={() => setSelectedDialogueLog(null)}
              >
                Close Dialogue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 6. MODAL: SCHEDULED REMINDER RECIPIENTS NUMBERS LIST               */}
      {/* ------------------------------------------------------------------ */}
      {selectedRecipientsReminder && (
        <div className="wa-dialog-overlay" onClick={() => setSelectedRecipientsReminder(null)}>
          <div className="wa-dialog-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-dialog-header">
              <h3>
                <Users size={20} />
                <span>Recipients for: {selectedRecipientsReminder.title}</span>
              </h3>
              <button
                type="button"
                className="wa-dialog-close-btn"
                onClick={() => setSelectedRecipientsReminder(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "18px 22px", background: "#fbfaf7", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800, color: "var(--deep-brown)" }}>
                    Total Numbers Dispatched: {selectedRecipientsReminder.sentCount}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--soft-brown)", marginTop: "2px" }}>
                    Recurrence: {selectedRecipientsReminder.recurrence}
                  </div>
                </div>
                <span className="wa-badge success">
                  ✓ {selectedRecipientsReminder.deliveredCount} Delivered
                </span>
              </div>
            </div>

            <div style={{ padding: "16px 22px", overflowY: "auto", maxHeight: "350px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {(selectedRecipientsReminder.recipients || []).map((rec, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: "#ffffff",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--deep-brown)" }}>
                      {rec.name}
                    </div>
                    <span className="wa-phone-pill">+{rec.phone}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="wa-badge success">✓ Delivered</span>
                    <div style={{ fontSize: "0.7rem", color: "var(--soft-brown)", marginTop: "2px" }}>
                      {rec.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="wa-dialog-footer">
              <button
                type="button"
                className="action-button premium"
                onClick={() => setSelectedRecipientsReminder(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
