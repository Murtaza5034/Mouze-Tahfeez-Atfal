import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Users, Phone, BarChart2, Edit2, Book, MessageCircle, 
  Video, ArrowLeft, Lock, Clock, AlertCircle, CheckCircle2, 
  Sparkles, X, ShieldAlert, Wifi 
} from 'lucide-react';
import { db } from '../firebase/db';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';

export default function TahfeezChatUI({
  studentsList = [],
  activeChat = null,
  onSelectChat,
  searchQuery,
  onSearchChange,
  onCallAction,
  activeSessions = {},
  role = "teacher", // "teacher", "parent", or "student"
  currentUserId,
  currentUserName
}) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [busyModalData, setBusyModalData] = useState(null); // { teacherName, busySession } or null
  const messagesEndRef = useRef(null);
  
  const isStudentOrParent = role === "parent" || role === "student" || role === "kibar-student";

  const getRoomId = (chat) => {
    if (!chat) return null;
    if (chat.isGroup) return chat.room_id;
    return `session_${chat.student_id}`;
  };
  
  const activeRoomId = getRoomId(activeChat);

  // Helper to check if teacher is busy in 1-on-1 session with another student
  const checkTeacherBusy = (chat) => {
    if (!chat || !isStudentOrParent) return { isBusy: false, busySession: null };
    
    // Group classes allow multiple participants
    if (chat.isGroup) return { isBusy: false, busySession: null };

    const currentStudentId = String(chat.student_id || "");
    const chatRoomId = `session_${currentStudentId}`;
    
    const teacherId = String(chat.teacher_id || chat.teacherId || "");
    const teacherName = (chat.teacherName || chat.teacher_name || chat.name || "").trim().toLowerCase();

    const sessionsList = Object.values(activeSessions || {});
    const busySession = sessionsList.find(s => {
      if (!s) return false;
      
      // Must be a 1-on-1 session
      const isOneOnOne = s.type === "1-on-1" || (!s.type && String(s.id).startsWith("session_"));
      if (!isOneOnOne) return false;

      const sStudentId = String(s.student_id || "");
      
      // If the session belongs to THIS student, the teacher is waiting for THIS student!
      if (sStudentId && sStudentId === currentStudentId) return false;
      if (s.id === chatRoomId) return false;

      const sTeacherId = String(s.teacher_id || "");
      const sTeacherName = (s.teacher_name || "").trim().toLowerCase();

      // Check if session is with the same teacher (by ID or Name)
      const idMatch = teacherId && sTeacherId && (teacherId === sTeacherId);
      const nameMatch = teacherName && sTeacherName && (
        teacherName === sTeacherName ||
        teacherName.includes(sTeacherName) ||
        sTeacherName.includes(teacherName)
      );

      return idMatch || nameMatch;
    });

    return {
      isBusy: !!busySession,
      busySession
    };
  };

  const activeTeacherBusyState = useMemo(() => {
    return checkTeacherBusy(activeChat);
  }, [activeChat, activeSessions, isStudentOrParent]);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      return;
    }
    
    const messagesRef = collection(db, "tahfeez_messages", activeRoomId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    
    return () => unsubscribe();
  }, [activeRoomId]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || !activeRoomId) return;
    
    const msgText = newMessage.trim();
    setNewMessage("");
    
    try {
      await addDoc(collection(db, "tahfeez_messages", activeRoomId, "messages"), {
        text: msgText,
        senderId: currentUserId || role,
        senderName: currentUserName || (role === "teacher" ? "Muhaffiz" : "Student"),
        senderRole: role,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleCallButtonClick = () => {
    if (!activeChat) return;

    if (isStudentOrParent && !activeChat.isGroup) {
      const { isBusy, busySession } = activeTeacherBusyState;
      if (isBusy) {
        setBusyModalData({
          teacherName: activeChat.teacherName || activeChat.teacher_name || activeChat.name || "Muhaffiz",
          busySession
        });
        return;
      }
    }

    if (onCallAction) {
      onCallAction(activeChat);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const isOwnRoomLive = activeRoomId ? !!activeSessions[activeRoomId] : false;

  return (
    <div className={`tahfeez-chat-container fade-in ${activeChat ? 'mobile-chat-active' : ''}`} style={{
      display: "flex",
      height: "calc(100vh - 80px)",
      background: "var(--bg-color)",
      overflow: "hidden",
      borderTop: "1px solid var(--border-color)",
    }}>
      <style>{`
        .chat-bubble-anim {
          animation: chatSlideIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        @keyframes chatSlideIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .chat-item-hover:hover {
          background: rgba(150, 150, 150, 0.1) !important;
        }
        .call-btn-anim {
          animation: callBtnPulse 2s infinite;
        }
        @keyframes callBtnPulse {
          0% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(212, 175, 55, 0); }
          100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
        }
        @keyframes greenGlowPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7), 0 0 16px rgba(34, 197, 94, 0.5);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(34, 197, 94, 0), 0 0 28px rgba(34, 197, 94, 0.85);
            transform: scale(1.03);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0), 0 0 16px rgba(34, 197, 94, 0.5);
            transform: scale(1);
          }
        }
        @keyframes greenBeaconPing {
          0% { transform: scale(0.95); opacity: 0.9; }
          50% { transform: scale(1.4); opacity: 0.15; }
          100% { transform: scale(0.95); opacity: 0.9; }
        }
        .call-btn-green-glow {
          animation: greenGlowPulse 2.2s infinite ease-in-out;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.4) !important;
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.6) !important;
        }
        .call-btn-busy {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(217, 119, 6, 0.22) 100%) !important;
          color: #d97706 !important;
          border: 1px solid rgba(245, 158, 11, 0.45) !important;
          box-shadow: 0 2px 10px rgba(245, 158, 11, 0.15) !important;
          cursor: pointer !important;
          opacity: 0.95;
        }
        .call-btn-busy:hover {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.24) 0%, rgba(217, 119, 6, 0.32) 100%) !important;
          transform: scale(1.02);
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        .typing-dot {
          display: inline-block;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: var(--primary-color, #d4af37);
          margin: 0 2px;
          animation: typingBounce 1.4s infinite ease-in-out both;
        }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
        
        @media (max-width: 768px) {
          body {
            overflow: hidden !important;
          }
          .tahfeez-chat-container {
            position: fixed !important;
            top: 70px !important;
            bottom: 95px !important;
            left: 0 !important;
            right: 0 !important;
            height: auto !important;
            width: 100% !important;
            z-index: 990 !important;
            border-top: none !important;
          }
          .tahfeez-chat-container.mobile-chat-active {
            bottom: 0 !important;
            z-index: 1100 !important;
          }
          .mobile-hide-sidebar { display: none !important; }
          .mobile-hide-main { display: none !important; }
          .tahfeez-chat-sidebar { width: 100% !important; border-right: none !important; height: 100%; }
          .tahfeez-chat-main { width: 100% !important; height: 100%; }
          .mobile-back-btn { display: flex !important; }
        }
        .mobile-back-btn { display: none; }
      `}</style>
      
      {/* Left Sidebar */}
      <div className={`tahfeez-chat-sidebar ${activeChat ? 'mobile-hide-sidebar' : ''}`} style={{
        width: "350px",
        borderRight: "1px solid rgba(150, 150, 150, 0.2)",
        display: "flex",
        flexDirection: "column",
        background: "var(--sidebar-bg)",
        boxShadow: "inset -1px 0 0 rgba(0,0,0,0.05), 4px 0 15px rgba(0,0,0,0.03)",
        position: "relative",
        zIndex: 10
      }}>
        {/* Search Bar */}
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            background: "var(--bg-color)",
            borderRadius: "12px",
            padding: "10px 16px",
            border: "1px solid var(--border-color)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)"
          }}>
            <Search size={18} color="var(--text-muted)" style={{ marginRight: "10px" }} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                color: "var(--text-color)",
                width: "100%",
                fontSize: "0.95rem"
              }}
            />
          </div>
        </div>

        {/* Student / Teacher List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {studentsList.map((student) => {
            const childSessionId = student.isGroup ? student.room_id : `session_${student.student_id}`;
            const activeSession = activeSessions[childSessionId];
            const isClassLive = !!activeSession;
            const waitingForMe = role === "teacher" 
              ? activeSession?.started_by === "parent" 
              : activeSession?.started_by === "teacher";
            
            const isSelected = activeChat?.student_id === student.student_id && activeChat?.isGroup === student.isGroup;
            const displayName = student.name || student.full_name || (isStudentOrParent && student.teacherName ? student.teacherName : "Unknown");
            
            const studentTeacherBusy = checkTeacherBusy(student);

            // Determine status dot and subtext
            let statusDotColor = "#94a3b8";
            let statusSubtext = student.subtext || (student.its ? `ITS: ${student.its}` : "");

            if (isStudentOrParent && !student.isGroup) {
              if (isClassLive) {
                statusDotColor = "#22c55e";
                statusSubtext = "● Muhaffiz is Waiting • Join";
              } else if (studentTeacherBusy.isBusy) {
                statusDotColor = "#f59e0b";
                statusSubtext = "● In session with another student";
              } else {
                statusDotColor = "#22c55e";
                statusSubtext = "● Muhaffiz Available • Ready";
              }
            } else if (isClassLive) {
              statusDotColor = "#22c55e";
              if (waitingForMe) statusSubtext = "Waiting in Call...";
            }

            return (
              <div
                key={student.isGroup ? student.room_id : student.student_id}
                onClick={() => onSelectChat(student)}
                className="chat-item-hover"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 16px",
                  cursor: "pointer",
                  background: isSelected ? "rgba(150, 150, 150, 0.15)" : "transparent",
                  borderBottom: "1px solid var(--border-color)",
                  borderLeft: isSelected ? "4px solid var(--primary-color)" : "4px solid transparent",
                  transition: "all 0.2s ease"
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: student.isGroup ? "var(--primary-color)" : "var(--primary-gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: "1.2rem",
                  marginRight: "14px",
                  position: "relative",
                  flexShrink: 0,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
                }}>
                  {student.isGroup ? (
                    <Users size={24} />
                  ) : student.photoUrl || student.photo_url || student.avatar_url || student.photo ? (
                    <img 
                      src={student.photoUrl || student.photo_url || student.avatar_url || student.photo} 
                      alt={displayName} 
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    displayName[0].toUpperCase()
                  )}
                  {/* Status Dot */}
                  <div style={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: statusDotColor,
                    border: "2px solid var(--sidebar-bg)",
                    boxShadow: statusDotColor === "#22c55e" ? "0 0 6px rgba(34, 197, 94, 0.8)" : "none"
                  }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "1.05rem", fontWeight: isSelected ? "700" : "600", color: "var(--text-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {displayName}
                  </div>
                  <div style={{ 
                    fontSize: "0.82rem", 
                    color: isStudentOrParent && studentTeacherBusy.isBusy ? "#d97706" : (isStudentOrParent && !student.isGroup ? "#16a34a" : "var(--text-muted)"), 
                    fontWeight: isStudentOrParent ? "600" : "400",
                    marginTop: "4px", 
                    whiteSpace: "nowrap", 
                    overflow: "hidden", 
                    textOverflow: "ellipsis" 
                  }}>
                    {statusSubtext}
                  </div>
                </div>
                
                {isClassLive && !student.isGroup && waitingForMe && (
                  <div className="pulse-indicator" style={{ marginLeft: "10px" }}>
                    <div className="pulse-dot" style={{ backgroundColor: "#2ecc71", width: "10px", height: "10px" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Main Area */}
      <div className={`tahfeez-chat-main ${!activeChat ? 'mobile-hide-main' : ''}`} style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-color)",
        position: "relative"
      }}>
        {activeChat ? (
          <>
            {/* Header */}
            <div style={{
              padding: "16px 24px",
              background: "var(--sidebar-bg)",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
              zIndex: 5
            }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div 
                  className="mobile-back-btn chat-item-hover pulse" 
                  onClick={() => onSelectChat(null)}
                  style={{ 
                    marginRight: "12px", 
                    width: "40px",
                    height: "40px",
                    cursor: "pointer", 
                    borderRadius: "50%", 
                    alignItems: "center", 
                    justifyContent: "center",
                    background: "rgba(212, 175, 55, 0.15)",
                    border: "1px solid rgba(212, 175, 55, 0.3)",
                    flexShrink: 0,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                  }}
                >
                  <ArrowLeft size={22} color="var(--primary-gold, #D4AF37)" />
                </div>
                <div style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: activeChat.isGroup ? "var(--primary-color)" : "var(--primary-gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: "bold",
                  marginRight: "16px",
                  flexShrink: 0,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
                }}>
                  {activeChat.isGroup ? (
                    <Users size={20} />
                  ) : activeChat.photoUrl || activeChat.photo_url || activeChat.avatar_url || activeChat.photo ? (
                    <img 
                      src={activeChat.photoUrl || activeChat.photo_url || activeChat.avatar_url || activeChat.photo} 
                      alt={activeChat.name || "Student"} 
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    (activeChat.name || activeChat.full_name || activeChat.teacherName || "S")[0].toUpperCase()
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: "700", color: "var(--text-color)", fontSize: "1.15rem" }}>
                    {activeChat.name || activeChat.full_name || activeChat.teacherName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", fontWeight: "600", marginTop: "2px" }}>
                    {isStudentOrParent ? (
                      activeTeacherBusyState.isBusy ? (
                        <span style={{ color: "#d97706", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706", animation: "pulse 1.8s infinite" }} />
                          In Session with another student • Please wait
                        </span>
                      ) : (
                        <span style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", animation: "pulse 1.8s infinite" }} />
                          {isOwnRoomLive ? "Muhaffiz is Waiting in Room" : "Muhaffiz Available • Ready for Class"}
                        </span>
                      )
                    ) : (
                      <span style={{ color: "var(--primary-color)" }}>
                        {activeChat.isGroup ? "Group Session" : (activeChat.subtext || `${activeChat.its || 'Live Session'} - Online`)}
                      </span>
                    )}
                    {/* Simulated typing animation */}
                    <div style={{ marginLeft: "8px", display: "flex", alignItems: "center", opacity: 0.6 }}>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Call Action Button */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {isStudentOrParent ? (
                  activeTeacherBusyState.isBusy ? (
                    /* Blocked / In Session Button */
                    <button 
                      type="button"
                      onClick={handleCallButtonClick}
                      className="call-btn-busy"
                      style={{
                        padding: "10px 22px",
                        borderRadius: "30px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "700",
                        fontSize: "0.9rem",
                        gap: "8px",
                        transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                        position: "relative"
                      }}
                      title="Your Muhaffiz is currently in session with another student. Click for status."
                    >
                      <Clock size={16} color="#d97706" />
                      <span>Teacher in Session</span>
                      <span style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#d97706",
                        marginLeft: "2px",
                        boxShadow: "0 0 6px #d97706"
                      }} />
                    </button>
                  ) : (
                    /* Available Button with Brilliant Green Glow Lights Effect */
                    <button 
                      type="button"
                      onClick={handleCallButtonClick}
                      className="call-btn-green-glow"
                      style={{
                        padding: "10px 24px",
                        borderRadius: "30px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontWeight: "700",
                        fontSize: "0.92rem",
                        gap: "8px",
                        transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                        position: "relative"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "scale(1.04) translateY(-1px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "scale(1) translateY(0)";
                      }}
                    >
                      <span style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <span style={{
                          position: "absolute",
                          width: "14px",
                          height: "14px",
                          borderRadius: "50%",
                          background: "#86efac",
                          animation: "greenBeaconPing 1.6s cubic-bezier(0, 0, 0.2, 1) infinite"
                        }} />
                        <span style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#ffffff",
                          position: "relative"
                        }} />
                      </span>
                      <Video size={18} />
                      <span>{isOwnRoomLive ? "Muhaffiz Waiting • Join" : "Join Video Call"}</span>
                    </button>
                  )
                ) : (
                  /* Teacher Role */
                  <button 
                    type="button"
                    onClick={handleCallButtonClick}
                    className={isOwnRoomLive ? "call-btn-green-glow" : "call-btn-anim"}
                    style={{
                      padding: "10px 24px",
                      borderRadius: "30px",
                      background: isOwnRoomLive ? undefined : "var(--primary-gold, #D4AF37)",
                      color: isOwnRoomLive ? "#ffffff" : "#3E2723",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "0 6px 15px rgba(0,0,0,0.15)",
                      fontWeight: "700",
                      fontSize: "0.95rem",
                      gap: "8px",
                      border: "1px solid rgba(62, 39, 35, 0.1)",
                      transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "scale(1.05) translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.2)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "scale(1) translateY(0)";
                      e.currentTarget.style.boxShadow = "0 6px 15px rgba(0,0,0,0.15)";
                    }}
                  >
                    <Video size={18} />
                    <span>{isOwnRoomLive ? "Student Waiting • Join" : (activeChat.isGroup ? "Start Group Class" : "Start 1-on-1 Call")}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Chat Body */}
            <div style={{
              flex: 1,
              padding: "24px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              background: "var(--bg-color)"
            }}>
              <div style={{ textAlign: "center", margin: "10px 0" }}>
                <span style={{
                  background: "var(--border-color)",
                  color: "var(--text-muted)",
                  padding: "6px 16px",
                  borderRadius: "20px",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                }}>
                  {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

              {messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "40px" }}>
                  <MessageCircle size={48} style={{ opacity: 0.2, marginBottom: "16px" }} />
                  <p style={{ fontSize: "1.1rem" }}>Send a message to start the conversation.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === currentUserId || msg.senderRole === role;
                  
                  if (msg.isSystemMessage) {
                    return (
                      <div key={msg.id} className="chat-bubble-anim" style={{ textAlign: "center", margin: "12px 0" }}>
                        <span style={{
                          background: "var(--sidebar-bg)",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-color)",
                          padding: "8px 18px",
                          borderRadius: "20px",
                          fontSize: "0.9rem",
                          fontWeight: "500",
                          boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
                        }}>
                          {msg.text}
                        </span>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={msg.id} className="chat-bubble-anim" style={{ 
                      alignSelf: isMine ? "flex-end" : "flex-start", 
                      background: isMine ? "var(--primary-gold, #D4AF37)" : "var(--sidebar-bg)", 
                      color: isMine ? "#1A1A1A" : "var(--text-color)", 
                      border: isMine ? "1px solid rgba(0,0,0,0.1)" : "1px solid var(--border-color)",
                      padding: "12px 18px", 
                      borderRadius: isMine ? "16px 16px 0 16px" : "16px 16px 16px 0", 
                      maxWidth: "75%",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      position: "relative"
                    }}>
                      <div style={{ wordBreak: "break-word", fontSize: "1rem", lineHeight: "1.4", fontWeight: isMine ? "500" : "400" }}>{msg.text}</div>
                      <div style={{ 
                        fontSize: "0.75rem", 
                        color: isMine ? "rgba(0,0,0,0.6)" : "var(--text-muted)", 
                        textAlign: "right", 
                        marginTop: "6px",
                        fontWeight: "600"
                      }}>
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} style={{
              padding: "16px 24px",
              background: "var(--sidebar-bg)",
              borderTop: "1px solid var(--border-color)",
              boxShadow: "0 -2px 10px rgba(0,0,0,0.02)"
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                background: "var(--bg-color)",
                borderRadius: "30px",
                padding: "8px 12px 8px 24px",
                border: "1px solid var(--border-color)",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.03)"
              }}>
                <input
                  type="text"
                  placeholder="Type your message here..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    color: "var(--text-color)",
                    width: "100%",
                    fontSize: "1rem"
                  }}
                />
                <button type="submit" style={{
                  background: "var(--primary-gold, #D4AF37)",
                  color: "#3E2723",
                  border: "none",
                  cursor: newMessage.trim() ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  marginLeft: "12px",
                  opacity: newMessage.trim() ? 1 : 0.5,
                  transform: newMessage.trim() ? "scale(1.05)" : "scale(1)",
                  boxShadow: newMessage.trim() ? "0 4px 12px rgba(212, 175, 55, 0.4)" : "none"
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "-2px" }}>
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="fade-in" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexDirection: "column", background: "var(--sidebar-bg)" }}>
            <div style={{
              width: "100px", height: "100px", borderRadius: "50%", background: "var(--bg-color)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)"
            }}>
              <MessageCircle size={48} style={{ color: "var(--primary-color)", opacity: 0.8 }} />
            </div>
            <h3 style={{ fontSize: "1.5rem", color: "var(--text-color)", marginBottom: "8px" }}>Live Classroom</h3>
            <p style={{ fontSize: "1.1rem", opacity: 0.8 }}>Select a {role === "teacher" ? "student or group" : "chat"} from the left to start a session.</p>
          </div>
        )}
      </div>

      {/* Professional Teacher Busy / In-Session Alert Modal */}
      {busyModalData && (
        <div 
          className="tahfeez-busy-modal-overlay fade-in"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
          onClick={() => setBusyModalData(null)}
        >
          <div 
            className="tahfeez-busy-modal-card card-appear"
            style={{
              background: "linear-gradient(145deg, #ffffff, #fdfbf7)",
              borderRadius: "24px",
              padding: "32px 26px 28px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(212, 175, 55, 0.35)",
              position: "relative",
              textAlign: "center"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              type="button"
              onClick={() => setBusyModalData(null)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "rgba(0,0,0,0.05)",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--deep-brown, #3E2723)",
                transition: "all 0.2s"
              }}
            >
              <X size={18} />
            </button>

            {/* Amber Status Glow Ring */}
            <div style={{
              width: "76px",
              height: "76px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.28))",
              border: "2px solid rgba(245, 158, 11, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
              boxShadow: "0 10px 24px rgba(245, 158, 11, 0.25)"
            }}>
              <Clock size={36} color="#d97706" />
            </div>

            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.35)",
              color: "#b45309",
              padding: "5px 14px",
              borderRadius: "20px",
              fontSize: "0.78rem",
              fontWeight: 800,
              marginBottom: "14px",
              textTransform: "uppercase",
              letterSpacing: "0.06em"
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706", animation: "pulse 1.5s infinite" }} />
              1-on-1 Class In Progress
            </div>

            <h3 style={{
              margin: "0 0 10px 0",
              fontSize: "1.35rem",
              fontWeight: 800,
              color: "var(--deep-brown, #2C1810)",
              letterSpacing: "-0.01em"
            }}>
              Muhaffiz is on Another Session
            </h3>

            <p style={{
              margin: "0 0 18px 0",
              fontSize: "0.95rem",
              color: "var(--soft-brown, #5D4037)",
              lineHeight: 1.55
            }}>
              Your Muhaffiz <strong style={{ color: "var(--deep-brown, #2C1810)" }}>{busyModalData.teacherName || "Muhaffiz"}</strong> is currently taking a 1-on-1 recitation session with another student and will join you soon.
            </p>

            <div style={{
              background: "linear-gradient(135deg, rgba(34, 197, 94, 0.09), rgba(16, 185, 129, 0.05))",
              border: "1px dashed rgba(34, 197, 94, 0.5)",
              borderRadius: "14px",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              textAlign: "left",
              marginBottom: "22px"
            }}>
              <div style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "rgba(34, 197, 94, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <Sparkles size={20} color="#16a34a" />
              </div>
              <div style={{ fontSize: "0.85rem", color: "#166534", lineHeight: 1.45, fontWeight: 600 }}>
                The <strong>Join Video Call</strong> button will automatically illuminate in <strong>glowing green</strong> the moment your Muhaffiz is free!
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBusyModalData(null)}
              style={{
                width: "100%",
                padding: "13px 20px",
                borderRadius: "30px",
                background: "linear-gradient(135deg, var(--primary-gold, #D4AF37), #B8860B)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.95rem",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 6px 18px rgba(212, 175, 55, 0.35)",
                transition: "transform 0.15s, box-shadow 0.15s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.02)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              Understood, I'll Wait
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
