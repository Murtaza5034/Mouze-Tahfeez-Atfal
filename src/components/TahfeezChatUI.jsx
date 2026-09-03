import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Users, Phone, BarChart2, Edit2, Book, MessageCircle, 
  Video, ArrowLeft, Lock, Clock, AlertCircle, CheckCircle2, 
  Sparkles, X, ShieldAlert, Wifi,
  Mic, Send, Smile, Paperclip, Camera, Play, Pause, Trash2, CheckCheck, Loader2
} from 'lucide-react';
import { db } from '../firebase/db';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import storageApi from '../firebase/storage.js';

export default function TahfeezChatUI({
  studentsList = [],
  activeChat = null,
  onSelectChat,
  searchQuery,
  onSearchChange,
  onCallAction,
  onSendMessage,
  activeSessions = {},
  role = "teacher", // "teacher", "parent", or "student"
  currentUserId,
  currentUserName
}) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [busyModalData, setBusyModalData] = useState(null); // { teacherName, busySession } or null
  const messagesEndRef = useRef(null);
  
  // Audio Voice Note Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Audio Playback State
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const activeAudioInstanceRef = useRef(null);

  // Quick Emoji Picker Toggle
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

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

  // Clean up audio playback when room changes
  useEffect(() => {
    return () => {
      if (activeAudioInstanceRef.current) {
        activeAudioInstanceRef.current.pause();
        activeAudioInstanceRef.current = null;
      }
      setPlayingAudioId(null);
      setAudioCurrentTime(0);
      if (isRecording) {
        cancelVoiceRecording();
      }
    };
  }, [activeRoomId]);

  // Listen to peer typing status in this chat room
  useEffect(() => {
    if (!activeRoomId) {
      setPeerIsTyping(false);
      return;
    }

    const typingDocRef = doc(db, "tahfeez_typing", activeRoomId);
    const unsubscribe = onSnapshot(typingDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPeerIsTyping(false);
        return;
      }
      const data = snapshot.data() || {};
      const myId = String(currentUserId || role);
      const now = Date.now();
      
      const someoneElseTyping = Object.entries(data).some(([userId, info]) => {
        if (userId === myId) return false;
        return info && info.isTyping === true && (now - (info.updatedAt || 0) < 4000);
      });

      setPeerIsTyping(someoneElseTyping);
    }, () => {});

    return () => unsubscribe();
  }, [activeRoomId, currentUserId, role]);

  const handleTypingChange = (e) => {
    const val = e.target.value;
    setNewMessage(val);

    if (!activeRoomId) return;

    const myId = String(currentUserId || role);
    const typingDocRef = doc(db, "tahfeez_typing", activeRoomId);

    setDoc(typingDocRef, {
      [myId]: {
        isTyping: val.trim().length > 0,
        userName: currentUserName || (role === "teacher" ? "Muhaffiz" : "Student"),
        updatedAt: Date.now()
      }
    }, { merge: true }).catch(() => {});

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setDoc(typingDocRef, {
        [myId]: {
          isTyping: false,
          userName: currentUserName || (role === "teacher" ? "Muhaffiz" : "Student"),
          updatedAt: Date.now()
        }
      }, { merge: true }).catch(() => {});
    }, 2500);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || !activeRoomId) return;
    
    const msgText = newMessage.trim();
    setNewMessage("");
    setShowEmojiPicker(false);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    const myId = String(currentUserId || role);
    const typingDocRef = doc(db, "tahfeez_typing", activeRoomId);
    setDoc(typingDocRef, {
      [myId]: {
        isTyping: false,
        updatedAt: Date.now()
      }
    }, { merge: true }).catch(() => {});
    
    try {
      await addDoc(collection(db, "tahfeez_messages", activeRoomId, "messages"), {
        text: msgText,
        senderId: currentUserId || role,
        senderName: currentUserName || (role === "teacher" ? "Muhaffiz" : "Student"),
        senderRole: role,
        timestamp: serverTimestamp(),
      });

      if (onSendMessage) {
        onSendMessage(msgText, activeChat);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Voice Note Recording Logic
  const startVoiceRecording = async () => {
    try {
      setShowEmojiPicker(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = "audio/webm;codecs=opus";
      if (typeof MediaRecorder !== "undefined") {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
          else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
          else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) mimeType = "audio/ogg;codecs=opus";
          else mimeType = "";
        }
      }
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = rec;
      audioChunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      rec.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Microphone permission is required to record voice notes. Please allow microphone access in your browser settings.");
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current) {
      try {
        const stream = mediaRecorderRef.current.stream;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const sendVoiceRecording = async () => {
    if (!mediaRecorderRef.current || !activeRoomId) return;
    const dur = recordingDuration;
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setRecordingDuration(0);
    setIsUploadingAudio(true);

    const rec = mediaRecorderRef.current;
    rec.onstop = async () => {
      try {
        const stream = rec.stream;
        if (stream) stream.getTracks().forEach((t) => t.stop());

        const mime = rec.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mime });
        const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
        const fileName = `voice_notes/${activeRoomId}/${Date.now()}.${ext}`;

        let publicUrl = null;
        try {
          const { data } = await storageApi.from("notification_files").upload(fileName, blob, { contentType: mime });
          if (data?.publicUrl) {
            publicUrl = data.publicUrl;
          } else {
            const res = await storageApi.from("notification_files").getPublicUrl(fileName);
            publicUrl = res?.data?.publicUrl;
          }
        } catch (uploadErr) {
          console.warn("Storage upload error, falling back to data URL:", uploadErr);
        }

        if (!publicUrl) {
          publicUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }

        await addDoc(collection(db, "tahfeez_messages", activeRoomId, "messages"), {
          text: "",
          audioUrl: publicUrl,
          audioDuration: dur || 1,
          isAudio: true,
          senderId: currentUserId || role,
          senderName: currentUserName || (role === "teacher" ? "Muhaffiz" : "Student"),
          senderRole: role,
          timestamp: serverTimestamp(),
        });

        if (onSendMessage) {
          onSendMessage(`🎤 Voice Note (${dur || 1}s)`, activeChat);
        }
      } catch (err) {
        console.error("Failed to send voice note:", err);
      } finally {
        setIsUploadingAudio(false);
        audioChunksRef.current = [];
      }
    };

    try {
      rec.stop();
    } catch (e) {
      setIsUploadingAudio(false);
    }
  };

  // Audio Playback Handler
  const handleTogglePlayAudio = (msgId, audioUrl) => {
    if (playingAudioId === msgId) {
      activeAudioInstanceRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }

    if (activeAudioInstanceRef.current) {
      activeAudioInstanceRef.current.pause();
      activeAudioInstanceRef.current = null;
    }

    const audio = new Audio(audioUrl);
    activeAudioInstanceRef.current = audio;
    setPlayingAudioId(msgId);
    setAudioCurrentTime(0);

    audio.ontimeupdate = () => {
      setAudioCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setPlayingAudioId(null);
      setAudioCurrentTime(0);
    };

    audio.onerror = () => {
      setPlayingAudioId(null);
      setAudioCurrentTime(0);
    };

    audio.play().catch((err) => {
      console.warn("Audio play error:", err);
      setPlayingAudioId(null);
    });
  };

  // Image and File Attachment Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoomId) return;

    try {
      setIsUploadingAudio(true);
      const isImg = file.type.startsWith("image/");
      const ext = file.name.split('.').pop() || "jpg";
      const fileName = `chat_attachments/${activeRoomId}/${Date.now()}.${ext}`;

      let fileUrl = null;
      try {
        const { data } = await storageApi.from("notification_files").upload(fileName, file, { contentType: file.type });
        fileUrl = data?.publicUrl;
        if (!fileUrl) {
          const res = await storageApi.from("notification_files").getPublicUrl(fileName);
          fileUrl = res?.data?.publicUrl;
        }
      } catch (err) {
        console.warn("Storage upload failed, using dataURL:", err);
      }

      if (!fileUrl && isImg) {
        fileUrl = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      }

      if (fileUrl) {
        await addDoc(collection(db, "tahfeez_messages", activeRoomId, "messages"), {
          text: isImg ? "" : file.name,
          imageUrl: isImg ? fileUrl : null,
          fileUrl: !isImg ? fileUrl : null,
          fileName: file.name,
          senderId: currentUserId || role,
          senderName: currentUserName || (role === "teacher" ? "Muhaffiz" : "Student"),
          senderRole: role,
          timestamp: serverTimestamp(),
        });

        if (onSendMessage) {
          onSendMessage(isImg ? "📷 Photo" : `📎 ${file.name}`, activeChat);
        }
      }
    } catch (err) {
      console.error("Failed to upload attachment:", err);
    } finally {
      setIsUploadingAudio(false);
      if (e.target) e.target.value = "";
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

  const formatDur = (secs) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatMessageDate = (timestamp) => {
    if (!timestamp) return "Today";
    try {
      const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return "Today";
      const yest = new Date();
      yest.setDate(today.getDate() - 1);
      if (d.toDateString() === yest.toDateString()) return "Yesterday";
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch (_) {
      return "Today";
    }
  };

  const isOwnRoomLive = activeRoomId ? !!activeSessions[activeRoomId] : false;
  const popularEmojis = ["😊", "😂", "❤️", "👍", "🙏", "🤲", "🌸", "👏", "🎉", "🕌", "📖", "💡", "☕", "👋", "💯", "👌", "🔥"];

  return (
    <div className={`tahfeez-chat-container fade-in ${activeChat ? 'mobile-chat-active' : ''}`} style={{
      display: "flex",
      height: "calc(100vh - 80px)",
      background: "var(--bg-color)",
      overflow: "hidden",
      borderTop: "1px solid var(--border-color)",
    }}>
      <style>{`
        /* WhatsApp-styled Chat System & Dynamic Mobile Adaptation */
        .chat-bubble-anim {
          animation: chatSlideIn 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        @keyframes chatSlideIn {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .chat-item-hover:hover {
          background: rgba(150, 150, 150, 0.1) !important;
        }
        @keyframes greenGlowPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6), 0 0 12px rgba(34, 197, 94, 0.4);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(34, 197, 94, 0), 0 0 20px rgba(34, 197, 94, 0.7);
            transform: scale(1.02);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0), 0 0 12px rgba(34, 197, 94, 0.4);
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
          background: #00a884 !important;
          color: #ffffff !important;
          border: none !important;
        }
        .call-btn-busy {
          background: #fef3c7 !important;
          color: #d97706 !important;
          border: 1px solid rgba(217, 119, 6, 0.35) !important;
        }

        /* WhatsApp Authentic Theme & Layout */
        .wa-chat-body {
          flex: 1;
          padding: 12px 14px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
          background-color: #efeae2;
          background-image: radial-gradient(#dcd5cc 1px, transparent 1px);
          background-size: 20px 20px;
        }
        
        /* Message Bubbles */
        .wa-bubble-received {
          align-self: flex-start;
          background: #ffffff;
          color: #111b21;
          border-radius: 8px 8px 8px 0px;
          box-shadow: 0 1px 0.5px rgba(11,20,26,.13);
          padding: 6px 9px 6px 10px;
          max-width: 82%;
          position: relative;
          word-break: break-word;
          font-size: 14.5px;
          line-height: 1.4;
        }
        .wa-bubble-sent {
          align-self: flex-end;
          background: #d9fdd3;
          color: #111b21;
          border-radius: 8px 8px 0px 8px;
          box-shadow: 0 1px 0.5px rgba(11,20,26,.13);
          padding: 6px 9px 6px 10px;
          max-width: 82%;
          position: relative;
          word-break: break-word;
          font-size: 14.5px;
          line-height: 1.4;
        }
        .wa-msg-meta {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 3px;
          font-size: 11px;
          color: #667781;
          margin-top: 3px;
          float: right;
          margin-left: 12px;
          line-height: 1;
          user-select: none;
        }

        /* WhatsApp Centered Date & System Badges */
        .wa-date-pill {
          background: rgba(255, 255, 255, 0.95);
          color: #54656f;
          padding: 5px 12px;
          border-radius: 7.5px;
          font-size: 11.5px;
          font-weight: 500;
          box-shadow: 0 1px 0.5px rgba(11,20,26,.13);
          display: inline-block;
          letter-spacing: 0.02em;
        }
        .wa-system-pill {
          background: rgba(255, 255, 255, 0.95);
          color: #54656f;
          padding: 5px 14px;
          border-radius: 7.5px;
          font-size: 12px;
          font-weight: 500;
          box-shadow: 0 1px 0.5px rgba(11,20,26,.13);
          display: inline-block;
          max-width: 90%;
          line-height: 1.35;
        }

        /* WhatsApp Input Bottom Bar - Flat, Normal, Dynamic Fit for All Screens */
        .wa-bottom-bar-container {
          padding: 6px 6px 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          background: #efeae2;
          box-sizing: border-box;
          width: 100%;
          max-width: 100%;
          flex-shrink: 0;
        }
        .wa-input-pill {
          flex: 1;
          min-width: 0;
          background: #ffffff;
          border-radius: 24px;
          min-height: 42px;
          padding: 2px 6px 2px 8px;
          display: flex;
          align-items: center;
          gap: 4px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          box-shadow: none !important;
          box-sizing: border-box;
          position: relative;
        }
        .wa-icon-btn {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          filter: none !important;
          color: #8696a0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          min-width: 28px;
          padding: 0;
          cursor: pointer;
          border-radius: 50%;
          flex-shrink: 0;
          transition: color 0.15s;
        }
        .wa-icon-btn:hover, .wa-icon-btn:active {
          color: #54656f;
        }
        .wa-input-field {
          flex: 1;
          min-width: 0;
          width: 0;
          border: none;
          outline: none;
          background: transparent;
          font-size: 15px;
          color: #111b21;
          padding: 8px 4px;
          max-height: 100px;
          resize: none;
          box-sizing: border-box;
          font-family: inherit;
        }
        .wa-input-field::placeholder {
          color: #8696a0;
        }
        .wa-circle-btn {
          width: 42px;
          height: 42px;
          min-width: 42px;
          min-height: 42px;
          max-width: 42px;
          max-height: 42px;
          border-radius: 50%;
          background: #00a884;
          color: #ffffff;
          border: none !important;
          box-shadow: none !important;
          filter: none !important;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: transform 0.12s, background 0.15s;
        }
        .wa-circle-btn:active {
          transform: scale(0.95);
          background: #008f6f;
        }

        /* Voice Recording Bar Elements */
        .wa-recording-pill {
          flex: 1;
          min-width: 0;
          background: #ffffff;
          border-radius: 24px;
          min-height: 42px;
          padding: 4px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid rgba(0, 0, 0, 0.1);
          box-shadow: none !important;
          box-sizing: border-box;
        }
        @keyframes pulseRedDot {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }
        .wa-pulse-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ea4335;
          display: inline-block;
          animation: pulseRedDot 1.2s infinite ease-in-out;
        }

        /* Quick Emoji Shelf */
        .wa-emoji-shelf {
          background: #ffffff;
          border-radius: 16px;
          padding: 8px 12px;
          display: flex;
          gap: 10px;
          overflow-x: auto;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          margin-bottom: 6px;
          animation: chatSlideIn 0.2s ease;
        }
        .wa-emoji-btn {
          background: transparent;
          border: none;
          font-size: 20px;
          cursor: pointer;
          transition: transform 0.1s;
          padding: 2px;
        }
        .wa-emoji-btn:active {
          transform: scale(1.2);
        }

        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        .typing-dot {
          display: inline-block;
          width: 4.5px;
          height: 4.5px;
          border-radius: 50%;
          background-color: #16a34a;
          margin: 0 1.5px;
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
        }
      `}</style>
      
      {/* Left Sidebar (Chats List) */}
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
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            background: "var(--bg-color)",
            borderRadius: "24px",
            padding: "8px 16px",
            border: "1px solid var(--border-color)"
          }}>
            <Search size={18} color="var(--text-muted)" style={{ marginRight: "10px" }} />
            <input
              type="text"
              placeholder={role === "teacher" ? "Search student..." : "Search classes..."}
              value={searchQuery || ""}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
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

        {/* Chat List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {studentsList.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              No chats available
            </div>
          ) : (
            studentsList.map((chat) => {
              const isSelected = activeChat && (
                (chat.isGroup && activeChat.isGroup && chat.room_id === activeChat.room_id) ||
                (!chat.isGroup && !activeChat.isGroup && chat.student_id === activeChat.student_id)
              );
              const roomId = getRoomId(chat);
              const isRoomLive = roomId ? !!activeSessions[roomId] : false;
              const teacherBusyState = checkTeacherBusy(chat);

              return (
                <div
                  key={chat.isGroup ? chat.room_id : (chat.student_id || chat.id)}
                  onClick={() => onSelectChat(chat)}
                  className="chat-item-hover"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border-color)",
                    background: isSelected ? "rgba(0, 168, 132, 0.08)" : "transparent",
                    transition: "background 0.15s ease"
                  }}
                >
                  <div style={{ position: "relative", marginRight: "14px" }}>
                    <div style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      background: chat.isGroup ? "#00a884" : "#dfe5e7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: chat.isGroup ? "#fff" : "#54656f",
                      fontWeight: "bold",
                      fontSize: "16px",
                      overflow: "hidden"
                    }}>
                      {chat.isGroup ? (
                        <Users size={20} />
                      ) : chat.photoUrl || chat.photo_url || chat.avatar_url || chat.photo ? (
                        <img 
                          src={chat.photoUrl || chat.photo_url || chat.avatar_url || chat.photo} 
                          alt={chat.name || "User"} 
                          referrerPolicy="no-referrer"
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        (chat.name || chat.full_name || chat.teacherName || "S")[0].toUpperCase()
                      )}
                    </div>
                    {isRoomLive && (
                      <span style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: "#22c55e",
                        border: "2px solid var(--sidebar-bg)",
                        boxShadow: "0 0 6px #22c55e"
                      }} />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3px" }}>
                      <span style={{
                        fontWeight: isSelected ? "700" : "600",
                        color: "var(--text-color)",
                        fontSize: "0.95rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}>
                        {chat.name || chat.full_name || chat.teacherName}
                      </span>
                    </div>
                    <div style={{
                      fontSize: "0.82rem",
                      color: isRoomLive ? "#16a34a" : (teacherBusyState.isBusy ? "#d97706" : "var(--text-muted)"),
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontWeight: isRoomLive ? 600 : 400
                    }}>
                      {isStudentOrParent ? (
                        teacherBusyState.isBusy 
                          ? "• In session with another student"
                          : (isRoomLive ? "• Live: Muhaffiz is waiting" : "• Available for class")
                      ) : (
                        chat.isGroup ? "Group Session" : (isRoomLive ? "• Student waiting" : (chat.subtext || "Online Tahfeez"))
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main WhatsApp Chat Window */}
      <div className={`tahfeez-chat-main ${!activeChat ? 'mobile-hide-main' : ''}`} style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "#efeae2",
        position: "relative",
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
        boxSizing: "border-box"
      }}>
        {activeChat ? (
          <>
            {/* WhatsApp Top Header Bar */}
            <div className="wa-header" style={{
              padding: "6px 10px",
              background: "#f0f2f5",
              borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              zIndex: 5,
              minHeight: "56px",
              boxSizing: "border-box",
              gap: "6px"
            }}>
              {/* Left: Back Arrow + Avatar + Contact Info */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: 1 }}>
                {/* Clean WhatsApp-Style Back Button */}
                <div 
                  onClick={() => onSelectChat(null)}
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    width: "28px",
                    height: "28px",
                    cursor: "pointer", 
                    borderRadius: "50%",
                    color: "#54656f",
                    flexShrink: 0
                  }}
                  title="Back"
                >
                  <ArrowLeft size={21} />
                </div>

                {/* Profile Picture */}
                <div style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  background: activeChat.isGroup ? "#00a884" : "#dfe5e7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: activeChat.isGroup ? "#fff" : "#54656f",
                  fontWeight: "bold",
                  fontSize: "15px",
                  flexShrink: 0,
                  overflow: "hidden",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                }}>
                  {activeChat.isGroup ? (
                    <Users size={19} />
                  ) : activeChat.photoUrl || activeChat.photo_url || activeChat.avatar_url || activeChat.photo ? (
                    <img 
                      src={activeChat.photoUrl || activeChat.photo_url || activeChat.avatar_url || activeChat.photo} 
                      alt={activeChat.name || "User"} 
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    (activeChat.name || activeChat.full_name || activeChat.teacherName || "S")[0].toUpperCase()
                  )}
                </div>

                {/* Name and Status - Dynamically Scaled & Wrapped so Any Length Fully Appears! */}
                {(() => {
                  const displayName = (activeChat.name || activeChat.full_name || activeChat.teacherName || "").trim();
                  const len = displayName.length;
                  const nameFontSize = len > 26 ? "12px" : len > 18 ? "13px" : "14.5px";

                  return (
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, justifyContent: "center" }}>
                      <div 
                        title={displayName}
                        style={{ 
                          fontWeight: "600", 
                          color: "#111b21", 
                          fontSize: nameFontSize,
                          lineHeight: "1.2",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          whiteSpace: "normal",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "visible"
                        }}
                      >
                        {displayName}
                      </div>
                      
                      <div style={{ 
                        fontSize: "11px", 
                        lineHeight: "1.2", 
                        marginTop: "2px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: peerIsTyping ? "#16a34a" : "#667781"
                      }}>
                        {peerIsTyping ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontWeight: 600 }}>
                            typing
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                          </span>
                        ) : (
                          isStudentOrParent ? (
                            activeTeacherBusyState.isBusy ? (
                              <span style={{ color: "#d97706" }}>Teacher in Session • Please wait</span>
                            ) : (
                              <span style={{ color: "#16a34a" }}>
                                {isOwnRoomLive ? "Muhaffiz Waiting • Online" : "Online • Ready for Class"}
                              </span>
                            )
                          ) : (
                            <span>{activeChat.isGroup ? "Group Session" : "Online"}</span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right: WhatsApp-Styled Call Button (Fits All Screen Sizes!) */}
              <div style={{ display: "flex", alignItems: "center", flexShrink: 0, marginLeft: "4px" }}>
                {isStudentOrParent ? (
                  activeTeacherBusyState.isBusy ? (
                    <button 
                      type="button"
                      onClick={handleCallButtonClick}
                      className="call-btn-busy"
                      style={{
                        padding: "6px 9px",
                        borderRadius: "18px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: "700",
                        fontSize: "12px",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                      title="Teacher currently in session. Tap for details."
                    >
                      <Clock size={14} color="#d97706" />
                      <span>Busy</span>
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={handleCallButtonClick}
                      className="call-btn-green-glow"
                      style={{
                        padding: "6px 10px",
                        borderRadius: "18px",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        fontWeight: "700",
                        fontSize: "12px",
                        cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(0, 168, 132, 0.35)",
                        whiteSpace: "nowrap"
                      }}
                    >
                      <Video size={16} />
                      <span>{isOwnRoomLive ? "Join" : "Join Call"}</span>
                    </button>
                  )
                ) : (
                  <button 
                    type="button"
                    onClick={handleCallButtonClick}
                    className="call-btn-green-glow"
                    style={{
                      padding: "6px 10px",
                      borderRadius: "18px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      fontWeight: "700",
                      fontSize: "12px",
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(0, 168, 132, 0.35)",
                      whiteSpace: "nowrap"
                    }}
                  >
                    <Video size={16} />
                    <span>{isOwnRoomLive ? "Join" : (activeChat.isGroup ? "Start Class" : "Start Call")}</span>
                  </button>
                )}
              </div>
            </div>

            {/* WhatsApp Chat Body */}
            <div className="wa-chat-body">
              {/* WhatsApp Centered Date Badge */}
              <div style={{ textAlign: "center", margin: "6px 0 10px" }}>
                <span className="wa-date-pill">Today</span>
              </div>

              {messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#667781", marginTop: "40px" }}>
                  <MessageCircle size={44} style={{ opacity: 0.25, marginBottom: "12px" }} />
                  <p style={{ fontSize: "0.95rem" }}>Send a message to start the conversation.</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMine = msg.senderId === currentUserId || msg.senderRole === role;
                  
                  // Optional Date Separator when date changes
                  const prevMsg = messages[idx - 1];
                  const showDateSep = idx > 0 && prevMsg && formatMessageDate(msg.timestamp) !== formatMessageDate(prevMsg.timestamp);

                  if (msg.isSystemMessage) {
                    return (
                      <React.Fragment key={msg.id || idx}>
                        {showDateSep && (
                          <div style={{ textAlign: "center", margin: "8px 0" }}>
                            <span className="wa-date-pill">{formatMessageDate(msg.timestamp)}</span>
                          </div>
                        )}
                        <div className="chat-bubble-anim" style={{ textAlign: "center", margin: "4px 0" }}>
                          <span className="wa-system-pill">
                            {msg.text}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  }
                  
                  return (
                    <React.Fragment key={msg.id || idx}>
                      {showDateSep && (
                        <div style={{ textAlign: "center", margin: "8px 0" }}>
                          <span className="wa-date-pill">{formatMessageDate(msg.timestamp)}</span>
                        </div>
                      )}
                      <div 
                        className={`chat-bubble-anim ${isMine ? 'wa-bubble-sent' : 'wa-bubble-received'}`}
                      >
                        {/* If Voice Note Recording */}
                        {msg.isAudio || msg.audioUrl ? (
                          <div style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "10px", 
                            padding: "4px 2px", 
                            minWidth: "220px", 
                            maxWidth: "100%" 
                          }}>
                            {/* Play / Pause Circular Button */}
                            <button
                              type="button"
                              onClick={() => handleTogglePlayAudio(msg.id, msg.audioUrl)}
                              style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "50%",
                                background: isMine ? "#00a884" : "#54656f",
                                color: "#ffffff",
                                border: "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                flexShrink: 0,
                                boxShadow: "0 1px 3px rgba(0,0,0,0.15)"
                              }}
                              title={playingAudioId === msg.id ? "Pause" : "Play"}
                            >
                              {playingAudioId === msg.id ? (
                                <Pause size={18} fill="#ffffff" />
                              ) : (
                                <Play size={18} fill="#ffffff" style={{ marginLeft: "2px" }} />
                              )}
                            </button>
                            
                            {/* Waveform Scrubber Simulation */}
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "2.5px", height: "22px" }}>
                                {[8, 14, 20, 12, 18, 24, 16, 10, 22, 18, 14, 8, 16, 20, 12, 18, 10, 14, 22, 16].map((h, bIdx) => {
                                  const isPlayed = playingAudioId === msg.id && (audioCurrentTime / (msg.audioDuration || 1)) > (bIdx / 20);
                                  return (
                                    <div
                                      key={bIdx}
                                      style={{
                                        width: "3px",
                                        height: `${h}px`,
                                        borderRadius: "2px",
                                        background: isPlayed ? "#00a884" : (isMine ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.24)"),
                                        transition: "background 0.1s"
                                      }}
                                    />
                                  );
                                })}
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#667781" }}>
                                <span>
                                  {playingAudioId === msg.id
                                    ? formatDur(audioCurrentTime)
                                    : `${msg.audioDuration ? `${msg.audioDuration} sec` : "Voice Note"}`}
                                </span>
                              </div>
                            </div>

                            {/* Small WhatsApp Mic Indicator Badge */}
                            <div style={{ 
                              width: "26px", 
                              height: "26px", 
                              borderRadius: "50%", 
                              background: isMine ? "rgba(0,168,132,0.18)" : "rgba(0,0,0,0.06)", 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "center", 
                              flexShrink: 0 
                            }}>
                              <Mic size={15} color={isMine ? "#00a884" : "#667781"} />
                            </div>
                          </div>
                        ) : msg.imageUrl ? (
                          /* Image Attachment Preview */
                          <div style={{ marginBottom: "4px", borderRadius: "6px", overflow: "hidden" }}>
                            <img 
                              src={msg.imageUrl} 
                              alt="attachment" 
                              style={{ maxWidth: "100%", maxHeight: "240px", borderRadius: "6px", display: "block", objectFit: "cover", cursor: "pointer" }} 
                              onClick={() => window.open(msg.imageUrl, '_blank')}
                            />
                            {msg.text && <div style={{ marginTop: "4px" }}>{msg.text}</div>}
                          </div>
                        ) : (
                          /* Regular Text Message */
                          <div style={{ wordBreak: "break-word", fontSize: "14.5px", lineHeight: "1.4" }}>
                            {msg.text}
                          </div>
                        )}

                        {/* Timestamp & WhatsApp Double Checkmarks */}
                        <div className="wa-msg-meta">
                          <span>{formatTime(msg.timestamp)}</span>
                          {isMine && (
                            <CheckCheck size={16} color="#53bdeb" strokeWidth={2.4} style={{ marginLeft: "2px" }} />
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Popular Emoji Bar */}
            {showEmojiPicker && (
              <div style={{ padding: "0 10px" }}>
                <div className="wa-emoji-shelf">
                  {popularEmojis.map((em, eIdx) => (
                    <button
                      key={eIdx}
                      type="button"
                      className="wa-emoji-btn"
                      onClick={() => {
                        setNewMessage((prev) => prev + em);
                        handleTypingChange({ target: { value: newMessage + em } });
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hidden Attachment Inputs */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              onChange={handleFileUpload} 
            />
            <input 
              type="file" 
              ref={cameraInputRef} 
              accept="image/*" 
              capture="environment" 
              style={{ display: "none" }} 
              onChange={handleFileUpload} 
            />

            {/* Uploading Status Banner */}
            {isUploadingAudio && (
              <div style={{
                padding: "6px 14px",
                background: "#ffffff",
                borderTop: "1px solid rgba(0,0,0,0.06)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12.5px",
                color: "#00a884",
                fontWeight: 600
              }}>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                <span>Sending voice note / attachment...</span>
              </div>
            )}

            {/* WhatsApp Bottom Chat Bar */}
            <form onSubmit={handleSendMessage} className="wa-bottom-bar-container">
              {isRecording ? (
                /* WhatsApp Voice Note Recording State */
                <div className="wa-recording-pill">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="wa-pulse-dot" />
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "#111b21", fontFamily: "monospace" }}>
                      {formatDur(recordingDuration)}
                    </span>
                  </div>

                  {/* Cancel / Discard Recording */}
                  <button
                    type="button"
                    onClick={cancelVoiceRecording}
                    className="wa-icon-btn"
                    title="Cancel recording"
                    style={{ color: "#ea4335" }}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ) : (
                /* Regular Message Input Pill */
                <div className="wa-input-pill">
                  {/* Emoji Button */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    className="wa-icon-btn"
                    title="Emoji"
                  >
                    <Smile size={21} color={showEmojiPicker ? "#00a884" : "#8696a0"} strokeWidth={1.8} />
                  </button>

                  {/* Message Input */}
                  <input
                    type="text"
                    placeholder="Message"
                    value={newMessage}
                    onChange={handleTypingChange}
                    className="wa-input-field"
                  />

                  {/* Paperclip / Attachment */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="wa-icon-btn"
                    title="Attach"
                  >
                    <Paperclip size={19} color="#8696a0" strokeWidth={1.8} style={{ transform: "rotate(45deg)" }} />
                  </button>

                  {/* Camera */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="wa-icon-btn"
                    title="Camera"
                  >
                    <Camera size={19} color="#8696a0" strokeWidth={1.8} />
                  </button>
                </div>
              )}

              {/* Right Floating Circular Action Button (WhatsApp Style!) */}
              {isRecording ? (
                /* Send Recording Button */
                <button
                  type="button"
                  onClick={sendVoiceRecording}
                  className="wa-circle-btn"
                  title="Send voice note"
                >
                  <Send size={19} color="#ffffff" style={{ marginLeft: "2px" }} />
                </button>
              ) : newMessage.trim().length > 0 ? (
                /* Send Message Button */
                <button
                  type="submit"
                  className="wa-circle-btn"
                  title="Send message"
                >
                  <Send size={19} color="#ffffff" style={{ marginLeft: "2px" }} />
                </button>
              ) : (
                /* Voice Note Mic Button */
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="wa-circle-btn"
                  title="Record voice note"
                >
                  <Mic size={20} color="#ffffff" strokeWidth={2} />
                </button>
              )}
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

      {/* Teacher Busy Modal Overlay */}
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
