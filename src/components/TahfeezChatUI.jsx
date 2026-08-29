import React, { useState, useEffect, useRef } from 'react';
import { Search, Users, Phone, BarChart2, Edit2, Book } from 'lucide-react';
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
    <div className="tahfeez-chat-container fade-in" style={{
      display: "flex",
      height: "calc(100vh - 80px)",
      background: "var(--bg-color)",
      overflow: "hidden",
      borderTop: "1px solid var(--border-color)",
    }}>
      {/* Left Sidebar */}
      <div className="tahfeez-chat-sidebar" style={{
        width: "350px",
        borderRight: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        background: "var(--sidebar-bg)",
      }}>
        {/* Search Bar */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            background: "var(--bg-color)",
            borderRadius: "20px",
            padding: "8px 16px",
          }}>
            <Search size={16} color="var(--text-muted)" style={{ marginRight: "8px" }} />
            <input
              type="text"
              placeholder="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                color: "var(--text-color)",
                width: "100%",
                fontSize: "0.9rem"
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 16px",
                  cursor: "pointer",
                  background: isSelected ? "var(--bg-color)" : "transparent",
                  borderBottom: "1px solid var(--border-color)",
                  transition: "background 0.2s"
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: student.isGroup ? "var(--primary-color)" : "var(--primary-gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: "1.2rem",
                  marginRight: "12px",
                  position: "relative",
                  flexShrink: 0
                }}>
                  {student.isGroup ? <Users size={24} /> : displayName[0].toUpperCase()}
                  {/* Status Dot */}
                  <div style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: isClassLive ? "#2ecc71" : "#e74c3c",
                    border: "2px solid var(--sidebar-bg)",
                  }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "1rem", fontWeight: "600", color: "var(--text-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {student.isGroup ? "Combined Group Class" : (waitingForMe ? "Waiting in Call..." : (student.its ? `ITS: ${student.its}` : "salam"))}
                  </div>
                </div>
                
                {isClassLive && !student.isGroup && waitingForMe && (
                  <div className="pulse-indicator" style={{ marginLeft: "8px" }}>
                    <div className="pulse-dot" style={{ backgroundColor: "#2ecc71" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Main Area */}
      <div className="tahfeez-chat-main" style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-color)"
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
              justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: activeChat.isGroup ? "var(--primary-color)" : "var(--primary-gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: "bold",
                  marginRight: "16px"
                }}>
                  {activeChat.isGroup ? <Users size={20} /> : (activeChat.name || activeChat.full_name || activeChat.teacherName || "S")[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: "600", color: "var(--text-color)", fontSize: "1.1rem" }}>
                    {activeChat.name || activeChat.full_name || activeChat.teacherName}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {activeChat.isGroup ? "Group Session" : `${activeChat.its || 'Live Session'} - Online`}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "20px", color: "var(--text-muted)" }}>
                {role === "teacher" && (
                  <>
                    <BarChart2 size={20} style={{ cursor: "pointer" }} />
                    <Edit2 size={20} style={{ cursor: "pointer" }} />
                    <Book size={20} style={{ cursor: "pointer" }} />
                  </>
                )}
                <div 
                  onClick={() => onCallAction(activeChat)}
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "var(--primary-color)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
                  }}
                >
                  <Phone size={18} />
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
              gap: "16px"
            }}>
              <div style={{ textAlign: "center", margin: "10px 0" }}>
                <span style={{
                  background: "var(--border-color)",
                  color: "var(--text-muted)",
                  padding: "4px 12px",
                  borderRadius: "12px",
                  fontSize: "0.8rem"
                }}>
                  {new Date().toLocaleDateString('en-GB')}
                </span>
              </div>

              {messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "20px" }}>
                  <p>Send a message to start the conversation.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === currentUserId || msg.senderRole === role;
                  
                  if (msg.isSystemMessage) {
                    return (
                      <div key={msg.id} style={{ textAlign: "center", margin: "10px 0" }}>
                        <span style={{
                          background: "var(--border-color)",
                          color: "var(--text-color)",
                          padding: "6px 14px",
                          borderRadius: "16px",
                          fontSize: "0.85rem",
                          opacity: 0.8
                        }}>
                          {msg.text}
                        </span>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={msg.id} style={{ 
                      alignSelf: isMine ? "flex-end" : "flex-start", 
                      background: isMine ? "var(--primary-color)" : "var(--sidebar-bg)", 
                      color: isMine ? "#fff" : "var(--text-color)", 
                      border: isMine ? "none" : "1px solid var(--border-color)",
                      padding: "10px 16px", 
                      borderRadius: isMine ? "12px 12px 0 12px" : "12px 12px 12px 0", 
                      maxWidth: "70%" 
                    }}>
                      <div style={{ wordBreak: "break-word" }}>{msg.text}</div>
                      <div style={{ 
                        fontSize: "0.7rem", 
                        color: isMine ? "rgba(255,255,255,0.7)" : "var(--text-muted)", 
                        textAlign: "right", 
                        marginTop: "4px" 
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
              borderTop: "1px solid var(--border-color)"
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                background: "var(--bg-color)",
                borderRadius: "24px",
                padding: "10px 20px",
                border: "1px solid var(--border-color)"
              }}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    color: "var(--text-color)",
                    width: "100%",
                    fontSize: "0.95rem"
                  }}
                />
                <button type="submit" style={{
                  background: "transparent",
                  border: "none",
                  cursor: newMessage.trim() ? "pointer" : "default",
                  color: newMessage.trim() ? "var(--primary-color)" : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center"
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexDirection: "column" }}>
            <Users size={64} style={{ opacity: 0.2, marginBottom: "16px" }} />
            <h3>Online Tahfeez</h3>
            <p>Select a {role === "teacher" ? "student or group" : "chat"} from the left to start a session.</p>
          </div>
        )}
      </div>
    </div>
  );
}
