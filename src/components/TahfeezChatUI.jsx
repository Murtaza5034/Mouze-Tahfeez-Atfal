import React, { useState, useEffect, useRef } from 'react';
import { Search, Users, Phone, BarChart2, Edit2, Book, MessageCircle, Video, ArrowLeft } from 'lucide-react';
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
  role = "teacher", // "teacher" or "parent"
  currentUserId,
  currentUserName
}) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);
  
  const getRoomId = (chat) => {
    if (!chat) return null;
    if (chat.isGroup) return chat.room_id;
    return `session_${chat.student_id}`;
  };
  
  const activeRoomId = getRoomId(activeChat);

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

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

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
          0% { box-shadow: 0 0 0 0 rgba(var(--primary-color-rgb, 200, 150, 50), 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(var(--primary-color-rgb, 200, 150, 50), 0); }
          100% { box-shadow: 0 0 0 0 rgba(var(--primary-color-rgb, 200, 150, 50), 0); }
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
          background-color: var(--primary-color);
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
            z-index: 1100 !important; /* Covers the bottom nav (1000) */
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

        {/* Student List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {studentsList.map((student) => {
            const childSessionId = student.isGroup ? student.room_id : `session_${student.student_id}`;
            const activeSession = activeSessions[childSessionId];
            const isClassLive = !!activeSession;
            const waitingForMe = role === "teacher" 
              ? activeSession?.started_by === "parent" 
              : activeSession?.started_by === "teacher";
            
            const isSelected = activeChat?.student_id === student.student_id && activeChat?.isGroup === student.isGroup;
            const displayName = student.name || student.full_name || (role === "parent" && student.teacherName ? student.teacherName : "Unknown");

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
                      onError={(e) => e.target.style.display = 'none'}
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
                    background: isClassLive ? "#2ecc71" : "#e74c3c",
                    border: "2px solid var(--sidebar-bg)",
                  }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "1.05rem", fontWeight: isSelected ? "700" : "600", color: "var(--text-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {student.isGroup ? "Combined Group Class" : (waitingForMe ? "Waiting in Call..." : (student.subtext || (student.its ? `ITS: ${student.its}` : "salam")))}
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
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  ) : (
                    (activeChat.name || activeChat.full_name || activeChat.teacherName || "S")[0].toUpperCase()
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: "700", color: "var(--text-color)", fontSize: "1.15rem" }}>
                    {activeChat.name || activeChat.full_name || activeChat.teacherName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", color: "var(--primary-color)", fontWeight: "500", marginTop: "2px" }}>
                    {activeChat.isGroup ? "Group Session" : (activeChat.subtext || `${activeChat.its || 'Live Session'} - Online`)}
                    {/* Simulated typing animation based on input focus */}
                    <div style={{ marginLeft: "8px", display: "flex", alignItems: "center", opacity: 0.6 }}>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <div 
                  onClick={() => onCallAction(activeChat)}
                  className="call-btn-anim"
                  style={{
                    padding: "10px 24px",
                    borderRadius: "30px",
                    background: "var(--primary-gold, #D4AF37)",
                    color: "#3E2723", /* Dark Brown Text */
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 6px 15px rgba(0,0,0,0.15)",
                    transition: "transform 0.2s, box-shadow 0.2s, background 0.2s",
                    fontWeight: "700",
                    fontSize: "0.95rem",
                    gap: "8px",
                    border: "1px solid rgba(62, 39, 35, 0.1)"
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
                  <span>Join Call</span>
                </div>
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
    </div>
  );
}
