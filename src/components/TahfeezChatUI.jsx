import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Users, Phone, BarChart2, Edit2, Book, MessageCircle, 
  Video, ArrowLeft, Lock, Clock, AlertCircle, CheckCircle2, 
  Sparkles, X, ShieldAlert, Wifi,
  Mic, Send, Smile, Paperclip, Camera, Play, Pause, Trash2, CheckCheck, Loader2,
  UserPlus, Plus, AlertTriangle, Check
} from 'lucide-react';
import { db } from '../firebase/db';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';
import storageApi from '../firebase/storage.js';

export default function TahfeezChatUI({
  studentsList = [],
  allPortalStudents = [],
  isKibar = false,
  currentTeacherPhoto = null,
  teacherId = null,
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

  // Online Tahfeez Temporary Student Assignments State
  const [onlineAssignments, setOnlineAssignments] = useState({});
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [addModalSearch, setAddModalSearch] = useState("");
  const [conflictAlert, setConflictAlert] = useState(null); // { show: boolean, message: string }
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Listen to Online Tahfeez Assignments in Real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tahfeez_online_assignments"), (snap) => {
      const map = {};
      snap.forEach(d => {
        const data = d.data();
        if (data && data.status === "active") {
          map[String(d.id)] = { id: d.id, ...data };
        }
      });
      setOnlineAssignments(map);
    }, (err) => console.warn("online assignments listener error:", err));
    return () => unsub();
  }, []);

  // Real-time Online Presence Tracking in Tahfeez
  const [presenceMap, setPresenceMap] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tahfeez_presence"), (snap) => {
      const map = {};
      const now = Date.now();
      snap.forEach(d => {
        const data = d.data();
        if (data) {
          // Consider online if heartbeat was within last 45 seconds and isOnline !== false
          const isFresh = (now - (data.lastSeen || 0)) < 45000;
          if (data.isOnline !== false && isFresh) {
            map[d.id] = data;
          }
        }
      });
      setPresenceMap(map);
    }, (err) => console.warn("presence listener error:", err));

    return () => unsub();
  }, []);

  // Heartbeat to report current user's presence while active in Online Tahfeez
  useEffect(() => {
    if (!currentUserId && !currentUserName) return;

    const myId = String(currentUserId || role);
    const myTeacherId = String(teacherId || currentUserId || role);
    const myDocKey = role === "teacher" 
      ? `teacher_${myId}`
      : `user_${myId}`;

    const studentIds = (studentsList || []).map(s => String(s.student_id || s.studentId || s.id || "")).filter(Boolean);

    const updatePresence = (isOnline = true) => {
      const activeStudentId = (isOnline && role === "teacher" && activeChat && !activeChat.isGroup)
        ? String(activeChat.student_id || activeChat.studentId || activeChat.id || "")
        : null;
      const activeStudentName = (isOnline && role === "teacher" && activeChat && !activeChat.isGroup)
        ? (activeChat.name || activeChat.student_name || activeChat.full_name || null)
        : null;

      const presenceData = {
        userId: myId,
        role: role === "teacher" ? "teacher" : "student",
        name: currentUserName || (role === "teacher" ? "Muhaffiz" : "Student"),
        lastSeen: Date.now(),
        isOnline: isOnline,
        ...(role === "teacher" ? {
          teacherId: myTeacherId,
          teacherName: currentUserName || "Muhaffiz",
          activeStudentId: activeStudentId,
          activeStudentName: activeStudentName
        } : {
          studentIds
        })
      };

      setDoc(doc(db, "tahfeez_presence", myDocKey), presenceData, { merge: true }).catch(() => {});

      if (role === "teacher" && myTeacherId && myTeacherId !== myId) {
        setDoc(doc(db, "tahfeez_presence", `teacher_${myTeacherId}`), presenceData, { merge: true }).catch(() => {});
      }
      
      // If student/parent, also mark individual student doc keys so teachers can find them immediately by student_id
      if (role !== "teacher" && studentIds.length > 0) {
        studentIds.forEach(sid => {
          setDoc(doc(db, "tahfeez_presence", `student_${sid}`), presenceData, { merge: true }).catch(() => {});
        });
      }
    };

    updatePresence(true);

    const interval = setInterval(() => {
      updatePresence(true);
    }, 18000);

    const handleUnload = () => {
      updatePresence(false);
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      updatePresence(false);
    };
  }, [currentUserId, currentUserName, role, studentsList, activeChat, teacherId]);

  // Helper to determine if the peer in chat is currently online
  const isPeerOnline = (chat) => {
    if (!chat) return false;
    if (chat.isGroup) return true;

    // If there is an active session in activeSessions for this room, they are live
    const chatRoomId = getRoomId(chat);
    if (activeSessions && activeSessions[chatRoomId]) {
      return true;
    }

    if (isStudentOrParent) {
      // Current user is student/parent, checking if teacher is online AND has clicked this student's chatbar
      const tId = String(chat.teacher_id || chat.teacherId || "");
      const tName = (chat.teacherName || chat.teacher_name || chat.name || "").trim().toLowerCase();
      const myStudentId = String(chat.student_id || chat.studentId || chat.id || (studentsList && studentsList[0]?.student_id) || "");

      // Check any record in presenceMap that has role === "teacher" and matches name or ID
      for (const p of Object.values(presenceMap)) {
        if (p.role === "teacher" && p.isOnline !== false) {
          const pName = (p.name || p.teacherName || "").trim().toLowerCase();
          const pTId = String(p.teacherId || p.userId || "");
          const isMatch = (tId && pTId && tId === pTId) || 
                          (tName && pName && (tName === pName || tName.includes(pName) || pName.includes(tName)));
          if (isMatch) {
            // Teacher is only online for THIS student if teacher specifically opened this student's chatbar!
            if (p.activeStudentId && String(p.activeStudentId) === myStudentId) {
              return true;
            }
          }
        }
      }
      return false;
    } else {
      // Current user is teacher, checking if student is online
      const sid = String(chat.student_id || chat.studentId || chat.id || "");
      const pUserId = String(chat.parent_user_id || chat.user_id || "");

      if (sid && presenceMap[`student_${sid}`]?.isOnline !== false) return true;
      if (pUserId && presenceMap[`user_${pUserId}`]?.isOnline !== false) return true;

      for (const p of Object.values(presenceMap)) {
        if (p.role === "student" && p.isOnline !== false) {
          if (p.studentIds && Array.isArray(p.studentIds) && p.studentIds.includes(sid)) {
            return true;
          }
          const pName = (p.name || "").trim().toLowerCase();
          const sName = (chat.name || chat.full_name || chat.student_name || "").trim().toLowerCase();
          if (sName && pName && (sName === pName || sName.includes(pName) || pName.includes(sName))) {
            return true;
          }
        }
      }
      return false;
    }
  };
  
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

  // Combined list of students including temporary online additions for teachers
  const combinedStudentsList = useMemo(() => {
    if (role !== "teacher") return studentsList;

    const myId = String(currentUserId || "").trim().toLowerCase();
    const myName = (currentUserName || "").trim().toLowerCase();

    const myAssignments = Object.values(onlineAssignments).filter(a => {
      if (!a || a.status !== "active") return false;
      const aTId = String(a.teacher_id || "").trim().toLowerCase();
      const aTName = (a.teacher_name || "").trim().toLowerCase();
      return (myId && aTId === myId) || (myName && aTName === myName);
    });

    const result = [...studentsList];
    const existingIds = new Set(studentsList.map(s => String(s.student_id || s.id || "")));

    myAssignments.forEach(a => {
      const sId = String(a.student_id || "");
      if (!sId || existingIds.has(sId)) return;

      const portalMatch = (allPortalStudents || []).find(s => String(s.student_id || s.id) === sId);
      const studentObj = {
        ...(portalMatch || {}),
        id: sId,
        student_id: sId,
        studentId: sId,
        name: a.student_name || portalMatch?.name || portalMatch?.full_name || "Student",
        full_name: a.student_name || portalMatch?.full_name || portalMatch?.name || "Student",
        student_name: a.student_name || portalMatch?.name || "Student",
        studentName: a.student_name || portalMatch?.name || "Student",
        its: a.student_its || portalMatch?.its || "",
        groupName: portalMatch?.groupName || portalMatch?.group_name || a.group_name || "",
        photoUrl: portalMatch?.photo_url || portalMatch?.photoUrl || null,
        isOnlineAdded: true,
        onlineAssignment: a
      };
      result.push(studentObj);
      existingIds.add(sId);
    });

    return result;
  }, [studentsList, onlineAssignments, role, currentUserId, currentUserName, allPortalStudents]);

  // Handle adding an online student
  const handleAddOnlineStudent = async (student) => {
    const studentId = String(student.student_id || student.id);
    const studentName = student.name || student.full_name || student.student_name || "Student";
    
    // Concurrency check: if another teacher already added this student
    const existingAssignment = onlineAssignments[studentId];
    if (existingAssignment && existingAssignment.status === "active") {
      const existingTeacherId = String(existingAssignment.teacher_id || "").trim().toLowerCase();
      const myId = String(currentUserId || "").trim().toLowerCase();
      if (existingTeacherId && existingTeacherId !== myId) {
        setConflictAlert({
          show: true,
          message: `This student is already added to ${existingAssignment.teacher_name || "another teacher"} for Online Tahfeez.`
        });
        return;
      }
    }

    try {
      setActionLoadingId(studentId);
      await setDoc(doc(db, "tahfeez_online_assignments", studentId), {
        student_id: studentId,
        student_name: studentName,
        student_its: student.its || "",
        group_name: student.groupName || student.group_name || "",
        teacher_id: String(currentUserId || ""),
        teacher_name: currentUserName || "Muhaffiz",
        teacher_photo: currentTeacherPhoto || null,
        portal: isKibar ? "kibar" : "atfal",
        assigned_at: new Date().toISOString(),
        status: "active"
      });

      setShowAddStudentModal(false);

      const chatObj = {
        ...student,
        id: studentId,
        student_id: studentId,
        studentId: studentId,
        name: studentName,
        full_name: studentName,
        isGroup: false,
        isOnlineAdded: true
      };
      if (onSelectChat) onSelectChat(chatObj);
    } catch (err) {
      console.error("Failed to add online student:", err);
      alert("Failed to add student: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle removing / releasing an online student
  const handleRemoveOnlineStudent = async (studentId) => {
    if (!studentId) return;
    try {
      setActionLoadingId(studentId);
      await deleteDoc(doc(db, "tahfeez_online_assignments", String(studentId)));
      if (activeChat && String(activeChat.student_id || activeChat.id) === String(studentId)) {
        if (onSelectChat) onSelectChat(null);
      }
    } catch (err) {
      console.error("Failed to remove online student:", err);
      alert("Failed to remove student: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered portal students for the Add Student modal
  const modalPortalStudents = useMemo(() => {
    if (!showAddStudentModal) return [];
    let list = allPortalStudents || [];
    if (addModalSearch.trim()) {
      const q = addModalSearch.toLowerCase().trim();
      list = list.filter(s => {
        const name = (s.name || s.full_name || s.student_name || "").toLowerCase();
        const its = String(s.its || "").toLowerCase();
        const grp = (s.groupName || s.group_name || "").toLowerCase();
        return name.includes(q) || its.includes(q) || grp.includes(q);
      });
    }
    return list;
  }, [allPortalStudents, showAddStudentModal, addModalSearch]);

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
        .call-btn-offline {
          background: #f1f5f9 !important;
          color: #64748b !important;
          border: 1px solid #cbd5e1 !important;
          animation: none !important;
          box-shadow: none !important;
        }
        .call-btn-offline:hover {
          background: #e2e8f0 !important;
          color: #334155 !important;
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
        <div style={{ padding: "14px 16px 10px", borderBottom: role === "teacher" ? "none" : "1px solid var(--border-color)" }}>
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

        {/* Add Student for Online Tahfeez Button (Teachers only) */}
        {role === "teacher" && (
          <div style={{ padding: "0 16px 12px", borderBottom: "1px solid var(--border-color)" }}>
            <button
              type="button"
              onClick={() => {
                setAddModalSearch("");
                setShowAddStudentModal(true);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "9px 16px",
                background: "#00a884",
                color: "#ffffff",
                border: "none",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "background 0.15s ease",
                boxShadow: "none"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#008f6f"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#00a884"; }}
              title="Add any student from this portal for Online Tahfeez"
            >
              <UserPlus size={16} color="#ffffff" strokeWidth={2.2} />
              <span>Add Student for Online Tahfeez</span>
            </button>
          </div>
        )}

        {/* Chat List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {combinedStudentsList.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              No chats available
            </div>
          ) : (
            combinedStudentsList.map((chat) => {
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
                    {(isRoomLive || isPeerOnline(chat)) && (
                      <span style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: isRoomLive ? "#22c55e" : (teacherBusyState.isBusy ? "#d97706" : "#22c55e"),
                        border: "2px solid var(--sidebar-bg)",
                        boxShadow: isRoomLive ? "0 0 6px #22c55e" : (teacherBusyState.isBusy ? "0 0 6px #d97706" : "0 0 6px #22c55e")
                      }} />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
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
                      {chat.isOnlineAdded && (
                        <span style={{
                          fontSize: "10px",
                          background: "#dcfce7",
                          color: "#166534",
                          padding: "1px 6px",
                          borderRadius: "10px",
                          fontWeight: "600",
                          marginLeft: "6px",
                          flexShrink: 0
                        }}>
                          Online Added
                        </span>
                      )}
                    </div>
                    {(() => {
                      const peerOnline = isPeerOnline(chat);
                      return (
                        <div style={{
                          fontSize: "0.82rem",
                          color: isRoomLive ? "#16a34a" : (teacherBusyState.isBusy ? "#d97706" : (peerOnline ? "#16a34a" : "var(--text-muted)")),
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontWeight: (isRoomLive || peerOnline) ? 600 : 400
                        }}>
                          {isStudentOrParent ? (
                            teacherBusyState.isBusy 
                              ? "• In session with another student"
                              : (isRoomLive 
                                  ? "• Live: Muhaffiz is waiting" 
                                  : (peerOnline ? "• Available for class" : "• Offline"))
                          ) : (
                            chat.isGroup 
                              ? "Group Session" 
                              : (isRoomLive 
                                  ? "• Student waiting" 
                                  : (peerOnline ? "• Online" : "• Offline"))
                          )}
                        </div>
                      );
                    })()}
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
                <div style={{ position: "relative", flexShrink: 0 }}>
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
                  {(isOwnRoomLive || isPeerOnline(activeChat)) && (
                    <span style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: "11px",
                      height: "11px",
                      borderRadius: "50%",
                      background: isOwnRoomLive ? "#22c55e" : (activeTeacherBusyState.isBusy ? "#d97706" : "#22c55e"),
                      border: "2px solid #f0f2f5",
                      boxShadow: isOwnRoomLive ? "0 0 5px #22c55e" : (activeTeacherBusyState.isBusy ? "0 0 5px #d97706" : "0 0 5px #22c55e")
                    }} />
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
                        {activeChat.isOnlineAdded && (
                          <span style={{
                            fontSize: "10px",
                            background: "#dcfce7",
                            color: "#166534",
                            padding: "1px 6px",
                            borderRadius: "10px",
                            fontWeight: "600",
                            marginLeft: "6px",
                            display: "inline-block"
                          }}>
                            Online Added
                          </span>
                        )}
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
                            ) : isOwnRoomLive ? (
                              <span style={{ color: "#16a34a" }}>Muhaffiz Waiting • Online</span>
                            ) : isPeerOnline(activeChat) ? (
                              <span style={{ color: "#16a34a" }}>Online • Ready for Class</span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>Offline • Not in Classroom</span>
                            )
                          ) : (
                            activeChat.isGroup ? (
                              <span>Group Session</span>
                            ) : isPeerOnline(activeChat) ? (
                              <span style={{ color: "#16a34a" }}>{isOwnRoomLive ? "Student waiting • Online" : "Online"}</span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>Offline</span>
                            )
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
                  ) : (() => {
                    const isCallReady = isOwnRoomLive || isPeerOnline(activeChat);
                    return (
                      <button 
                        type="button"
                        onClick={handleCallButtonClick}
                        className={isCallReady ? "call-btn-green-glow" : "call-btn-offline"}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "18px",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          fontWeight: "700",
                          fontSize: "12px",
                          cursor: "pointer",
                          boxShadow: isCallReady ? "0 2px 6px rgba(0, 168, 132, 0.35)" : "none",
                          whiteSpace: "nowrap",
                          transition: "all 0.2s ease"
                        }}
                        title={isCallReady ? "Join Video Call" : "Muhaffiz is currently offline"}
                      >
                        <Video size={16} />
                        <span>{isOwnRoomLive ? "Join" : "Join Call"}</span>
                      </button>
                    );
                  })()
                ) : (
                  <>
                    {activeChat.isOnlineAdded && (
                      <button 
                        type="button"
                        onClick={() => handleRemoveOnlineStudent(activeChat.student_id || activeChat.id)}
                        title="Release student from your Online Tahfeez class"
                        style={{
                          padding: "5px 9px",
                          borderRadius: "18px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontWeight: "600",
                          fontSize: "11.5px",
                          cursor: "pointer",
                          background: "#fef2f2",
                          color: "#b91c1c",
                          border: "1px solid #fecaca",
                          whiteSpace: "nowrap",
                          marginRight: "6px"
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Release</span>
                      </button>
                    )}
                    {(() => {
                      const isTeacherCallReady = isOwnRoomLive || isPeerOnline(activeChat) || !!activeChat.isGroup;
                      return (
                        <button 
                          type="button"
                          onClick={handleCallButtonClick}
                          className={isTeacherCallReady ? "call-btn-green-glow" : "call-btn-offline"}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "18px",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            fontWeight: "700",
                            fontSize: "12px",
                            cursor: "pointer",
                            boxShadow: isTeacherCallReady ? "0 2px 6px rgba(0, 168, 132, 0.35)" : "none",
                            whiteSpace: "nowrap",
                            transition: "all 0.2s ease"
                          }}
                        >
                          <Video size={16} />
                          <span>{isOwnRoomLive ? "Join" : (activeChat.isGroup ? "Start Class" : "Start Call")}</span>
                        </button>
                      );
                    })()}
                  </>
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

      {/* Conflict Alert Modal (When another teacher already added this student) */}
      {conflictAlert?.show && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1400,
          padding: "16px",
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "18px",
            padding: "24px 20px",
            maxWidth: "410px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            animation: "chatSlideIn 0.2s ease"
          }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#fef3c7",
              color: "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px"
            }}>
              <AlertTriangle size={30} />
            </div>
            <h3 style={{ margin: "0 0 10px", fontSize: "1.1rem", fontWeight: 700, color: "#111b21" }}>
              Student Already Added
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: "0.92rem", color: "#475569", lineHeight: 1.5 }}>
              {conflictAlert.message}
            </p>
            <button
              type="button"
              onClick={() => setConflictAlert(null)}
              style={{
                width: "100%",
                padding: "11px 16px",
                background: "#00a884",
                color: "#ffffff",
                border: "none",
                borderRadius: "24px",
                fontWeight: 600,
                fontSize: "0.95rem",
                cursor: "pointer",
                boxShadow: "none"
              }}
            >
              OK, Understood
            </button>
          </div>
        </div>
      )}

      {/* Add Student for Online Tahfeez - Premium Modal */}
      {showAddStudentModal && (
        <div 
          onClick={() => setShowAddStudentModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(11, 20, 26, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1300,
            padding: "16px",
            backdropFilter: "blur(4px)"
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "540px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
              animation: "chatSlideIn 0.2s ease"
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              background: "#f0f2f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <UserPlus size={19} color="#00a884" />
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#111b21" }}>
                    Add Student for Online Tahfeez
                  </h3>
                </div>
                <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "#667781" }}>
                  {isKibar ? "Tahfeez al Kibar Portal Students" : "Atfal Portal Students"} • {modalPortalStudents.length} students
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStudentModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#667781",
                  padding: "6px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#ffffff" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                background: "#f0f2f5",
                borderRadius: "24px",
                padding: "8px 14px",
                border: "1px solid rgba(0,0,0,0.06)"
              }}>
                <Search size={17} color="#667781" style={{ marginRight: "8px" }} />
                <input
                  type="text"
                  placeholder="Search student name, ITS, group..."
                  value={addModalSearch}
                  onChange={(e) => setAddModalSearch(e.target.value)}
                  autoFocus
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    color: "#111b21",
                    width: "100%",
                    fontSize: "0.9rem"
                  }}
                />
                {addModalSearch && (
                  <button
                    type="button"
                    onClick={() => setAddModalSearch("")}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "#667781", padding: 0 }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Modal Student List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", maxHeight: "55vh" }}>
              {modalPortalStudents.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#667781" }}>
                  <Users size={36} color="#94a3b8" style={{ marginBottom: "8px", opacity: 0.7 }} />
                  <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 500 }}>No students found</p>
                  <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>Try adjusting your search query</p>
                </div>
              ) : (
                modalPortalStudents.map((s) => {
                  const sId = String(s.student_id || s.id || "");
                  const sName = s.name || s.full_name || s.student_name || "Student";
                  const sIts = s.its || "";
                  const sGroup = s.groupName || s.group_name || "";
                  const sRegularTeacher = s.teacherName || s.teacher_name || s.muhaffiz_name || "";

                  const assignment = onlineAssignments[sId];
                  const hasAssignment = assignment && assignment.status === "active";
                  const myId = String(currentUserId || "").trim().toLowerCase();
                  const myName = (currentUserName || "").trim().toLowerCase();
                  const aTId = String(assignment?.teacher_id || "").trim().toLowerCase();
                  const aTName = (assignment?.teacher_name || "").trim().toLowerCase();

                  const isAddedByMe = hasAssignment && ((myId && aTId === myId) || (myName && aTName === myName));
                  const isAddedByOther = hasAssignment && !isAddedByMe;
                  const isMyRegular = studentsList.some(regular => String(regular.student_id || regular.id) === sId && !regular.isOnlineAdded);
                  const isLoading = actionLoadingId === sId;

                  return (
                    <div
                      key={sId || sName}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 16px",
                        borderBottom: "1px solid rgba(0,0,0,0.04)",
                        transition: "background 0.12s ease"
                      }}
                      className="chat-item-hover"
                    >
                      {/* Left: Avatar + Info */}
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                        <div style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          background: "#00a884",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "15px",
                          flexShrink: 0,
                          overflow: "hidden"
                        }}>
                          {s.photo_url || s.photoUrl || s.avatar_url ? (
                            <img
                              src={s.photo_url || s.photoUrl || s.avatar_url}
                              alt={sName}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          ) : (
                            (sName[0] || "S").toUpperCase()
                          )}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontWeight: 600,
                            fontSize: "0.93rem",
                            color: "#111b21",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}>
                            {sName}
                          </div>
                          <div style={{
                            fontSize: "0.78rem",
                            color: "#667781",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            flexWrap: "wrap",
                            marginTop: "2px"
                          }}>
                            {sIts && <span>ITS: {sIts}</span>}
                            {sGroup && <span>• {sGroup}</span>}
                            {sRegularTeacher && !isMyRegular && (
                              <span style={{ color: "#8696a0" }}>• Reg: {sRegularTeacher}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div style={{ marginLeft: "10px", flexShrink: 0 }}>
                        {isAddedByMe ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{
                              fontSize: "11px",
                              color: "#166534",
                              background: "#dcfce7",
                              padding: "4px 8px",
                              borderRadius: "12px",
                              fontWeight: 600
                            }}>
                              Added by You
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveOnlineStudent(sId)}
                              disabled={isLoading}
                              style={{
                                background: "#fef2f2",
                                color: "#b91c1c",
                                border: "1px solid #fecaca",
                                borderRadius: "14px",
                                padding: "4px 8px",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer"
                              }}
                            >
                              {isLoading ? "..." : "Release"}
                            </button>
                          </div>
                        ) : isAddedByOther ? (
                          <button
                            type="button"
                            onClick={() => {
                              setConflictAlert({
                                show: true,
                                message: `This student is already added to ${assignment.teacher_name || "another teacher"} for Online Tahfeez.`
                              });
                            }}
                            style={{
                              background: "#fffbeb",
                              color: "#b45309",
                              border: "1px solid #fde68a",
                              borderRadius: "14px",
                              padding: "5px 10px",
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                            title="Click to view details"
                          >
                            <Clock size={12} />
                            <span>Active with {assignment.teacher_name || "Other"}</span>
                          </button>
                        ) : isMyRegular ? (
                          <span style={{
                            fontSize: "11px",
                            color: "#0369a1",
                            background: "#e0f2fe",
                            padding: "4px 9px",
                            borderRadius: "12px",
                            fontWeight: 600
                          }}>
                            Your Student
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddOnlineStudent(s)}
                            disabled={isLoading}
                            style={{
                              background: "#00a884",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "16px",
                              padding: "6px 12px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              transition: "background 0.15s ease"
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#008f6f"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "#00a884"; }}
                          >
                            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "12px 20px",
              background: "#f0f2f5",
              borderTop: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div style={{ fontSize: "0.78rem", color: "#667781" }}>
                Added students appear in your chat bar and can join your Online Tahfeez classes.
              </div>
              <button
                type="button"
                onClick={() => setShowAddStudentModal(false)}
                style={{
                  background: "#e2e8f0",
                  color: "#334155",
                  border: "none",
                  borderRadius: "16px",
                  padding: "6px 14px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
