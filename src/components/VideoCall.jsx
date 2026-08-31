import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase/db.js";
import "./VideoCall.css";
import MisriQuranViewer from "./MisriQuranViewer.jsx";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  Volume2,
  VolumeX,
  Headphones,
  SwitchCamera,
  LayoutGrid,
  Maximize2,
  Minimize2,
  User,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  BookOpen,
  PictureInPicture2,
  ShieldAlert,
  ExternalLink,
  X
} from "lucide-react";

function buildIceServers() {
  const stunUrls = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun2.l.google.com:19302",
    "stun:stun3.l.google.com:19302",
    "stun:stun4.l.google.com:19302",
    "stun:global.stun.twilio.com:3478",
    "stun:stun.cloudflare.com:3478",
    "stun:stun.services.mozilla.com"
  ];

  const servers = [
    { urls: stunUrls },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelay",
      credential: "openrelay"
    }
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUser = import.meta.env.VITE_TURN_USERNAME;
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL;
  if (turnUrl && turnUser && turnCred) {
    servers.unshift({
      urls: turnUrl.split(",").map((s) => s.trim()).filter(Boolean),
      username: turnUser,
      credential: turnCred,
    });
  }

  return {
    iceServers: servers,
    iceCandidatePoolSize: 10,
  };
}

// Enhance SDP for crystal clear, high-bitrate Opus vocal recitation.
function tuneSdpForVocalClarity(sdp) {
  if (!sdp) return sdp;

  const rtpmapMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/\d+/i);
  if (!rtpmapMatch) return sdp;

  const opusPt = rtpmapMatch[1];
  const fmtpRegex = new RegExp(`(a=fmtp:${opusPt} [^\\r\\n]*)`, "g");

  return sdp.replace(fmtpRegex, (line) => {
    if (/maxaveragebitrate=/.test(line)) return line;
    return `${line};maxaveragebitrate=64000;stereo=0;sprop-stereo=0;useinbandfec=1;minptime=10;cng=off`;
  });
}

export default function VideoCall({ call, onClose }) {
  const {
    roomId,
    role = "caller", // "caller" | "callee"
    myName = "You",
    peerName = "Peer",
    myRole = "user", // "teacher" | "parent" | "admin"
    isSpectator = false,
  } = call || {};

  const isTeacher = myRole === "teacher" || call?.isTeacher === true;
  const SIGNAL_PATH = "tahfeez_signals";

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const signalUnsubsRef = useRef([]);
  const endedRef = useRef(false);
  const sessionIdRef = useRef(Date.now().toString());
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const remoteAnalyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioGraphReadyRef = useRef(false);
  const localAnalyserReadyRef = useRef(false);
  const initialNegotiationDoneRef = useRef(false);

  const statusRef = useRef("initializing");
  const camOnRef = useRef(true);
  const micOnRef = useRef(true);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerCamOn, setPeerCamOn] = useState(true);
  const [peerMicOn, setPeerMicOn] = useState(true);
  const [facingMode, setFacingMode] = useState("user"); // "user" | "environment"
  const [layoutMode, setLayoutMode] = useState(() => window.innerWidth <= 768 ? "pip" : "grid"); // "grid" | "pip"
  const [quranOpen, setQuranOpen] = useState(false);
  const [quranPage, setQuranPage] = useState(1);
  const [isTeacherMinimized, setIsTeacherMinimized] = useState(false);
  const [showBackLockAlert, setShowBackLockAlert] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioOutputMode, setAudioOutputMode] = useState("speaker"); // "speaker" | "headphones"
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState("");
  const [showAudioDeviceMenu, setShowAudioDeviceMenu] = useState(false);
  const [volumeBoost, setVolumeBoost] = useState(false);
  const [status, setStatus] = useState("initializing");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Student Back Navigation Lock (Active for student/parent only)
  useEffect(() => {
    if (isTeacher) return;

    // Push dummy state to capture back button
    const dummyState = { tahfeezCallLocked: true, timestamp: Date.now() };
    try {
      window.history.pushState(dummyState, "", window.location.href);
    } catch (_) { }

    const handlePopState = (e) => {
      // Re-push state to block back navigation
      try {
        window.history.pushState(dummyState, "", window.location.href);
      } catch (_) { }
      setShowBackLockAlert(true);
    };

    window.addEventListener("popstate", handlePopState);

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Online Tahfeez class is in session. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isTeacher]);

  // Quran Dynamic Stretchable Split View (Resizable divider for Quran & Student screen)
  const [quranSplitRatio, setQuranSplitRatio] = useState(() => window.innerWidth <= 768 ? 56 : 58);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const isDraggingSplitRef = useRef(false);
  const quranViewportRef = useRef(null);

  // Handle start of split drag (touch or mouse)
  const handleSplitDragStart = useCallback((e) => {
    e.preventDefault();
    isDraggingSplitRef.current = true;
    setIsDraggingSplit(true);
  }, []);

  // Quick snap toggle when clicking the resizer pill
  const handleSplitQuickSnap = useCallback((e) => {
    e.stopPropagation();
    setQuranSplitRatio((prev) => {
      if (prev >= 68) return 36; // Focus student video
      if (prev <= 42) return 56; // Balanced split
      return 74; // Maximize Quran reading view
    });
  }, []);

  // Smooth global drag tracking for resizable split view (Mobile touch + Desktop mouse)
  useEffect(() => {
    const handleMove = (e) => {
      if (!isDraggingSplitRef.current || !quranViewportRef.current) return;
      
      const rect = quranViewportRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const isMobile = window.innerWidth <= 768;
      let ratio;
      if (isMobile) {
        // Vertical height ratio
        const curY = clientY - rect.top;
        ratio = (curY / rect.height) * 100;
      } else {
        // Horizontal width ratio
        const curX = clientX - rect.left;
        ratio = (curX / rect.width) * 100;
      }

      // Allow fluid resizing between 20% and 80%
      const clamped = Math.max(20, Math.min(80, ratio));
      setQuranSplitRatio(Math.round(clamped));
    };

    const handleEnd = () => {
      if (isDraggingSplitRef.current) {
        isDraggingSplitRef.current = false;
        setIsDraggingSplit(false);
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("touchcancel", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, []);

  // Teacher Picture-in-Picture & Minimize handler
  const handleTeacherPip = useCallback(async () => {
    if (!isTeacher) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (remoteVideoRef.current && document.pictureInPictureEnabled) {
        await remoteVideoRef.current.requestPictureInPicture();
      } else {
        setIsTeacherMinimized((prev) => !prev);
      }
    } catch (err) {
      console.warn("[PiP] Native Picture-in-Picture note, using in-app floating mode:", err);
      setIsTeacherMinimized((prev) => !prev);
    }
  }, [isTeacher]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      setControlsHidden(isFull);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { camOnRef.current = camOn; }, [camOn]);
  useEffect(() => { micOnRef.current = micOn; }, [micOn]);

  const trackUnsub = useCallback((unsub) => {
    if (typeof unsub === "function") signalUnsubsRef.current.push(unsub);
  }, []);

  // Enumerate hardware devices (cameras and audio outputs)
  const refreshDevices = useCallback(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        if (videoInputs.length > 1) {
          setHasMultipleCameras(true);
        }

        const outputs = devices.filter((d) => d.kind === "audiooutput");
        setAudioOutputs(outputs);
      }).catch(() => { });
    }
  }, []);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  // Compute gain factor based on output mode & volume boost
  const getTargetGain = useCallback(() => {
    if (audioOutputMode === "headphones") {
      return 1.0; // Standard clean line level for headphones (prevents ear fatigue & feedback)
    }
    return volumeBoost ? 2.0 : 1.4; // Boosted output for room loudspeaker
  }, [audioOutputMode, volumeBoost]);

  // Adjust volume gain node when mode or boost changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = getTargetGain();
    }
  }, [getTargetGain]);

  // Lazily create (and reuse) a single shared AudioContext
  const ensureAudioContext = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => { });
    }
    return audioContextRef.current;
  }, []);

  // Local microphone volume analyser (for the "speaking" indicator only —
  // never routed to a destination, so this can't cause echo/feedback).
  // Guarded so it only ever runs once per call session.
  const connectLocalAnalyser = useCallback((localStream) => {
    if (localAnalyserReadyRef.current) return;
    if (!localStream || localStream.getAudioTracks().length === 0) return;
    try {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      const localSrc = ctx.createMediaStreamSource(localStream);
      const localAnalyser = ctx.createAnalyser();
      localAnalyser.fftSize = 256;
      localAnalyser.smoothingTimeConstant = 0.4;
      localSrc.connect(localAnalyser);
      localAnalyserRef.current = localAnalyser;
      localAnalyserReadyRef.current = true;
    } catch (e) {
      console.warn("[Audio] Local analyser setup failed:", e);
    }
  }, [ensureAudioContext]);

  // FIX: previously this ran once per ontrack event (i.e. once for the video
  // track AND once for the audio track), building two overlapping
  // MediaStreamSource -> GainNode -> destination chains for the same audio
  // track, on top of the <audio> element also playing that same track
  // natively. That triple playback is what was causing garbled/absent sound
  // in some browsers. Now this runs exactly once per call (guarded), and
  // becomes the ONLY playback path — the raw <audio> element gets muted so
  // there's no double-routing, and the boost/headphone gain actually applies
  // to what you hear.
  const connectRemoteAudio = useCallback((remoteStream) => {
    if (audioGraphReadyRef.current) return;
    audioGraphReadyRef.current = true;

    // Use native <audio> element for reliable playback.
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isSpectator;
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.play().then(() => {
        setAudioBlocked(false);
      }).catch(() => {
        setAudioBlocked(true);
      });
    }

    // Only use AudioContext for the speaking indicator (AnalyserNode).
    // Do NOT route to ctx.destination to avoid double playback / Web Audio API silent bugs.
    try {
      const ctx = ensureAudioContext();
      if (!ctx) return;

      const remoteSrc = ctx.createMediaStreamSource(remoteStream);
      const remoteAnalyser = ctx.createAnalyser();
      remoteAnalyser.fftSize = 256;
      remoteAnalyser.smoothingTimeConstant = 0.4;

      remoteSrc.connect(remoteAnalyser);
      remoteAnalyserRef.current = remoteAnalyser;

      ctx.onstatechange = () => {
        if (ctx.state === "suspended") setAudioBlocked(true);
      };
    } catch (e) {
      console.warn("[Audio] Remote analyser setup failed:", e);
    }
  }, [ensureAudioContext, isSpectator]);

  // Single, continuously-running speaking-indicator loop (previously a new
  // requestAnimationFrame loop was started on every ontrack event, stacking
  // up duplicate loops).
  useEffect(() => {
    const localBuf = new Uint8Array(128);
    const remoteBuf = new Uint8Array(128);

    const tick = () => {
      if (endedRef.current) return;

      if (localAnalyserRef.current) {
        localAnalyserRef.current.getByteFrequencyData(localBuf);
        let sum = 0;
        for (let i = 0; i < localBuf.length; i++) sum += localBuf[i];
        setLocalSpeaking(sum / localBuf.length > 14);
      }

      if (remoteAnalyserRef.current) {
        remoteAnalyserRef.current.getByteFrequencyData(remoteBuf);
        let sum = 0;
        for (let i = 0; i < remoteBuf.length; i++) sum += remoteBuf[i];
        setRemoteSpeaking(sum / remoteBuf.length > 14);
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Handle switching audio output mode (Speaker vs Headphones)
  const handleSelectAudioMode = (mode) => {
    setAudioOutputMode(mode);
    setShowAudioDeviceMenu(false);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = mode === "headphones" ? 1.0 : (volumeBoost ? 2.0 : 1.4);
    }
  };

  // Handle switching to a specific hardware audio output device
  const handleSelectSpecificDevice = async (deviceId) => {
    setSelectedAudioDeviceId(deviceId);
    setShowAudioDeviceMenu(false);

    try {
      if (remoteAudioRef.current && typeof remoteAudioRef.current.setSinkId === "function") {
        await remoteAudioRef.current.setSinkId(deviceId);
      }
      if (audioContextRef.current && typeof audioContextRef.current.setSinkId === "function") {
        await audioContextRef.current.setSinkId(deviceId);
      }
    } catch (err) {
      console.warn("Failed to set audio sink ID:", err);
    }
  };

  // Cleanup helper
  const stopLocal = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    try {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => { });
        audioContextRef.current = null;
      }
    } catch (_) { }

    try {
      const unsubs = signalUnsubsRef.current;
      signalUnsubsRef.current = [];
      for (const fn of unsubs) {
        try { fn(); } catch (_) { }
      }
    } catch (_) { }

    try {
      if (pcRef.current) {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onnegotiationneeded = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
        pcRef.current = null;
      }
    } catch (_) { }

    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          try { t.stop(); } catch (_) { }
        });
        localStreamRef.current = null;
      }
    } catch (_) { }

    try {
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((t) => {
          try { t.stop(); } catch (_) { }
        });
      }
    } catch (_) { }

    try {
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    } catch (_) { }

    if (roomId) {
      try {
        const roomRef = doc(db, SIGNAL_PATH, roomId);
        const fieldName = role === "caller" ? "caller_in_room" : "callee_in_room";
        updateDoc(roomRef, { [fieldName]: false }).catch(() => { });
      } catch (_) { }
    }
  }, [roomId, role, SIGNAL_PATH]);

  // User clicks End button
  const handleEnd = useCallback(() => {
    stopLocal();
    if (onClose) onClose();
  }, [stopLocal, onClose]);

  // Escape key to end
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") handleEnd();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleEnd]);

  // Unmount safety
  useEffect(() => {
    return () => {
      stopLocal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer: runs when actively connected
  useEffect(() => {
    if (status !== "connected") return;
    const t = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  // Toggle Mic
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOn;
    stream.getAudioTracks().forEach((t) => { t.enabled = next; });
    setMicOn(next);

    // Sync state to peer via signaling
    if (roomId) {
      try {
        const roomRef = doc(db, SIGNAL_PATH, roomId);
        const fieldName = role === "caller" ? "caller_mic_on" : "callee_mic_on";
        updateDoc(roomRef, { [fieldName]: next }).catch((err) => {
          console.error("[WebRTC] Failed to sync mic state to Firestore (check security rules):", err);
        });
      } catch (_) { }
    }
  }, [micOn, roomId, role, SIGNAL_PATH]);

  // Toggle Camera
  const toggleCam = useCallback(async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    const next = !camOn;

    if (stream && stream.getVideoTracks().length > 0) {
      stream.getVideoTracks().forEach((t) => { t.enabled = next; });
      setCamOn(next);

      if (roomId) {
        try {
          const roomRef = doc(db, SIGNAL_PATH, roomId);
          const fieldName = role === "caller" ? "caller_cam_on" : "callee_cam_on";
          updateDoc(roomRef, { [fieldName]: next }).catch((err) => {
            console.error("[WebRTC] Failed to sync cam state to Firestore (check security rules):", err);
          });
        } catch (_) { }
      }
      return;
    }

    // Camera not yet acquired - request camera
    try {
      let videoStream = null;
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 }
          }
        });
      } catch (_) {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      const videoTrack = videoStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = true;
        if (stream) {
          stream.addTrack(videoTrack);
        } else {
          localStreamRef.current = videoStream;
        }

        if (pc) {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === "video") || senders.find((s) => !s.track);
          if (videoSender) {
            await videoSender.replaceTrack(videoTrack);
          } else {
            // FIX: adding a brand-new track here (no pre-existing transceiver)
            // triggers pc.onnegotiationneeded, which now actually renegotiates
            // and pushes the new offer to the peer via Firestore (see the
            // onnegotiationneeded handler set up in the main connection
            // effect below). Previously nothing listened for this event, so
            // a camera turned on after the call had already connected was
            // silently never sent to the other side.
            pc.addTrack(videoTrack, stream || videoStream);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([videoTrack]);
          try { await localVideoRef.current.play(); } catch (_) { }
        }
        setCamOn(true);

        if (roomId) {
          try {
            const roomRef = doc(db, SIGNAL_PATH, roomId);
            const fieldName = role === "caller" ? "caller_cam_on" : "callee_cam_on";
            updateDoc(roomRef, { [fieldName]: true }).catch(() => { });
          } catch (_) { }
        }
      }
    } catch (e) {
      console.warn("Unable to enable camera:", e);
    }
  }, [camOn, facingMode, roomId, role, SIGNAL_PATH]);

  // Switch camera (front/back on mobile)
  const switchCamera = useCallback(async () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);

    const stream = localStreamRef.current;
    const pc = pcRef.current;
    if (!stream) return;

    try {
      const oldVideoTrack = stream.getVideoTracks()[0];
      if (oldVideoTrack) {
        oldVideoTrack.stop();
        stream.removeTrack(oldVideoTrack);
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: nextMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }).catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: nextMode } }));

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        stream.addTrack(newVideoTrack);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([newVideoTrack]);
          try { await localVideoRef.current.play(); } catch (_) { }
        }

        if (pc) {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === "video");
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
          }
        }
        setCamOn(true);
      }
    } catch (err) {
      console.warn("Error switching camera:", err);
    }
  }, [facingMode]);

  // Global Audio Unlock Trigger on any click or touch
  const handleGlobalAudioUnlock = () => {
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().then(() => {
        setAudioBlocked(false);
      }).catch(() => { });
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => { });
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.play().then(() => {
        setHasRemoteVideo(true);
      }).catch(() => { });
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = useCallback(() => {
    const elem = document.querySelector(".vc-overlay");
    if (!elem) return;

    if (!document.fullscreenElement) {
      elem.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
    }
  }, []);

  // Main WebRTC Connection Pipeline
  useEffect(() => {
    if (!roomId || !role) return;

    let cancelled = false;
    const currentSessionId = sessionIdRef.current;

    const start = async () => {
      setStatus("initializing");
      setError("");

      // 1. Acquire Local Media (Mic + Cam) with vocal clarity constraints
      let stream = null;
      if (!isSpectator) {
        try {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: "user",
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
              },
              audio: {
                echoCancellation: true,
                noiseSuppression: false, // Don't clip soft recitation phonemes
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 48000,
              },
            });
            setCamOn(true);
            setMicOn(true);
          } catch (vidErr) {
            console.warn("Standard media acquisition note, trying fallback:", vidErr);
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              setCamOn(true);
              setMicOn(true);
            } catch (vidErr2) {
              console.warn("Combined devices not available, acquiring audio and video separately:", vidErr2);
              let audioStream = null;
              let videoStream = null;
              try {
                audioStream = await navigator.mediaDevices.getUserMedia({
                  audio: {
                    echoCancellation: true,
                    noiseSuppression: false,
                    autoGainControl: true,
                  },
                });
                setMicOn(true);
              } catch (_) {
                try {
                  audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                  setMicOn(true);
                } catch (aErr) {
                  console.warn("Microphone not available:", aErr);
                  setMicOn(false);
                }
              }

              try {
                videoStream = await navigator.mediaDevices.getUserMedia({
                  video: { facingMode: "user" }
                }).catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
                setCamOn(true);
              } catch (vErr) {
                console.warn("Camera not available:", vErr);
                setCamOn(false);
              }

              if (audioStream && videoStream) {
                stream = new MediaStream([
                  ...videoStream.getVideoTracks(),
                  ...audioStream.getAudioTracks(),
                ]);
              } else if (audioStream) {
                stream = audioStream;
              } else if (videoStream) {
                stream = videoStream;
              } else {
                try {
                  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                  const dest = audioCtx.createMediaStreamDestination();
                  stream = dest.stream;
                } catch (_) {
                  stream = new MediaStream();
                }
                setCamOn(false);
                setMicOn(false);
              }
            }
          }
        } catch (mediaErr) {
          console.warn("Media permissions fallback:", mediaErr);
          stream = new MediaStream();
          setCamOn(false);
          setMicOn(false);
        }

        if (cancelled) {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (stream) {
          stream.getAudioTracks().forEach((t) => { t.enabled = true; });
          stream.getVideoTracks().forEach((t) => { t.enabled = true; });
        }

        localStreamRef.current = stream;
        // FIX: camOnRef/micOnRef need to reflect what we actually got, right
        // now, before anything is written to Firestore below — not whatever
        // the component's closed-over state was when this effect first ran.
        camOnRef.current = !!(stream && stream.getVideoTracks().length > 0);
        micOnRef.current = !!(stream && stream.getAudioTracks().length > 0);

        connectLocalAnalyser(stream);

        if (localVideoRef.current && stream && stream.getVideoTracks().length > 0) {
          localVideoRef.current.srcObject = new MediaStream(stream.getVideoTracks());
          try { await localVideoRef.current.play(); } catch (_) { }
        }
      } else {
        setCamOn(false);
        setMicOn(false);
        camOnRef.current = false;
        micOnRef.current = false;
      }

      // 2. Create RTCPeerConnection
      const pc = new RTCPeerConnection(buildIceServers());
      pcRef.current = pc;

      // Add local tracks to peer connection
      if (stream) {
        stream.getTracks().forEach((t) => {
          try {
            pc.addTrack(t, stream);
            console.log(`[WebRTC] Added local track: ${t.kind}`);
          } catch (_) { }
        });
      }

      // Bidirectional transceivers
      const hasAudio = stream && stream.getAudioTracks().length > 0;
      const hasVideo = stream && stream.getVideoTracks().length > 0;
      if (!hasAudio && pc.addTransceiver) {
        try { pc.addTransceiver("audio", { direction: "sendrecv" }); } catch (_) { }
      }
      if (!hasVideo && pc.addTransceiver) {
        try { pc.addTransceiver("video", { direction: "sendrecv" }); } catch (_) { }
      }

      const roomRef = doc(db, SIGNAL_PATH, roomId);

      // 3. Remote Track Handler - Guarantees Immediate Display & Loud Output
      pc.ontrack = (ev) => {
        console.log(`[WebRTC] Remote track received: ${ev.track.kind}`);
        const track = ev.track;

        if (track.kind === "video") {
          // Do not set hasRemoteVideo to true here yet. Wait for onplaying.
          track.onmute = () => setHasRemoteVideo(false);
          track.onunmute = () => {
            if (remoteVideoRef.current && remoteVideoRef.current.readyState >= 2) {
              setHasRemoteVideo(true);
            }
          };
          track.onended = () => setHasRemoteVideo(false);

          if (remoteVideoRef.current) {
            const vidStream = new MediaStream([track]);
            remoteVideoRef.current.srcObject = vidStream;
            remoteVideoRef.current.onloadedmetadata = () => {
              remoteVideoRef.current.play().catch(() => { });
            };
            remoteVideoRef.current.onplaying = () => setHasRemoteVideo(true);
            remoteVideoRef.current.play().catch(() => { });
          }
        }

        if (track.kind === "audio") {
          setHasRemoteAudio(true);
          track.onmute = () => setHasRemoteAudio(false);
          track.onunmute = () => setHasRemoteAudio(true);

          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = new MediaStream([track]);
          }

          // Single, guarded call — builds the Web Audio graph exactly once
          // and mutes the raw <audio> element so audio isn't routed twice.
          connectRemoteAudio(new MediaStream([track]));
        }
        // Do NOT set status="connected" here. Wait for iceConnectionState to become "connected".
      };

      const checkConnectionState = () => {
        if (!pcRef.current) return;
        const cs = pcRef.current.connectionState;
        const ics = pcRef.current.iceConnectionState;
        console.log(`[WebRTC] Connection: ${cs}, ICE: ${ics}`);
        if (cs === "connected" || ics === "connected" || ics === "completed") {
          setStatus("connected");
          setError("");
        } else if (cs === "disconnected" || ics === "disconnected") {
          setStatus("reconnecting");
        } else if (cs === "failed" || ics === "failed") {
          try {
            if (pcRef.current && pcRef.current.restartIce) {
              pcRef.current.restartIce();
            }
          } catch (_) { }
          setStatus("reconnecting");
        }
      };

      pc.onconnectionstatechange = checkConnectionState;
      pc.oniceconnectionstatechange = checkConnectionState;

      // 4. Signaling setup
      const candidatesCol = collection(db, SIGNAL_PATH, roomId, "candidates");
      const processedCandidateKeys = new Set();
      const pendingRemoteCandidates = [];

      pc.onicecandidate = async (ev) => {
        if (ev.candidate) {
          const candJson = ev.candidate.toJSON();
          if (!candJson || !candJson.candidate) return;

          // Logs candidate type (host / srflx / relay) so you can confirm in
          // devtools whether a TURN relay candidate is actually being used —
          // useful if this only fails across different networks.
          const typeMatch = /typ (\w+)/.exec(candJson.candidate);
          console.log(`[WebRTC] Local ICE candidate (${role}):`, typeMatch ? typeMatch[1] : "unknown");

          try {
            await addDoc(candidatesCol, {
              senderRole: role,
              sessionId: sessionIdRef.current,
              candidate: candJson,
              createdAt: Date.now(),
            });
          } catch (err) {
            console.warn("[WebRTC] ICE candidate write note:", err);
          }
        }
      };

      const applyCandidate = async (cand) => {
        if (!cand || !cand.candidate) return;
        const key = `${cand.sdpMid}_${cand.sdpMLineIndex}_${cand.candidate}`;
        if (processedCandidateKeys.has(key)) return;
        processedCandidateKeys.add(key);

        const currentPc = pcRef.current;
        if (!currentPc || !currentPc.remoteDescription || !currentPc.remoteDescription.type) {
          pendingRemoteCandidates.push(cand);
          return;
        }

        try {
          await currentPc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn("[WebRTC] addIceCandidate note:", err);
        }
      };

      const flushRemoteCandidates = async () => {
        const currentPc = pcRef.current;
        if (!currentPc || !currentPc.remoteDescription || !currentPc.remoteDescription.type) return;

        while (pendingRemoteCandidates.length > 0) {
          const cand = pendingRemoteCandidates.shift();
          try {
            await currentPc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (err) {
            console.warn("[WebRTC] flush ICE note:", err);
          }
        }
      };

      const unsubCandidates = onSnapshot(candidatesCol, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            // Allow candidates from the other role.
            // We use sessionIdRef.current to allow the callee to adopt the caller's sessionId.
            if (data && data.senderRole !== role && data.candidate && (!data.sessionId || data.sessionId === sessionIdRef.current)) {
              applyCandidate(data.candidate);
            }
          }
        });
      }, (err) => {
        console.error(`[WebRTC] (${role}) candidates listener error — likely a Firestore security-rule permission issue:`, err);
        setError("Signaling error: " + (err?.message || err));
        setStatus("error");
      });
      trackUnsub(unsubCandidates);

      // --- Renegotiation support (for cameras/mics enabled AFTER the call
      // has already connected) ---
      // Guarded by initialNegotiationDoneRef so it doesn't fire for the very
      // first offer, which is created manually below for the caller / in
      // response to the caller's offer for the callee. Works symmetrically
      // for both roles: whichever side adds a track later becomes the
      // offerer for that round; the other side answers via
      // handleIncomingOffer below, matched by pc.signalingState instead of
      // one-shot booleans so repeated rounds keep working.
      pc.onnegotiationneeded = async () => {
        if (!initialNegotiationDoneRef.current || endedRef.current) return;
        if (pc.signalingState !== "stable") return;
        try {
          const rawOffer = await pc.createOffer();
          const tuned = new RTCSessionDescription({
            type: rawOffer.type,
            sdp: tuneSdpForVocalClarity(rawOffer.sdp),
          });
          await pc.setLocalDescription(tuned);
          await setDoc(roomRef, {
            offer: { type: tuned.type, sdp: tuned.sdp, from: role },
            answer: null,
          }, { merge: true });
        } catch (e) {
          console.warn("[WebRTC] Renegotiation offer failed:", e);
        }
      };

      let lastProcessedOfferSdp = "";
      let lastProcessedAnswerSdp = "";

      const handleIncomingOffer = async (offerData) => {
        if (!offerData || !offerData.sdp) return;
        if (offerData.from === role) return; // this is our own offer echoed back
        if (pc.signalingState !== "stable") return;
        if (offerData.sdp === lastProcessedOfferSdp) return; // Ignore duplicate offers from snapshots

        try {
          console.log(`[WebRTC] ${role} applying offer`);
          lastProcessedOfferSdp = offerData.sdp;
          await pc.setRemoteDescription(new RTCSessionDescription(offerData));
          await flushRemoteCandidates();

          const rawAnswer = await pc.createAnswer();
          const tunedAnswer = new RTCSessionDescription({
            type: rawAnswer.type,
            sdp: tuneSdpForVocalClarity(rawAnswer.sdp),
          });
          await pc.setLocalDescription(tunedAnswer);

          await setDoc(roomRef, {
            answer: { type: tunedAnswer.type, sdp: tunedAnswer.sdp, from: role },
            [role === "caller" ? "caller_in_room" : "callee_in_room"]: true,
            [role === "caller" ? "caller_cam_on" : "callee_cam_on"]: camOnRef.current,
            [role === "caller" ? "caller_mic_on" : "callee_mic_on"]: micOnRef.current,
            status: "connected",
          }, { merge: true });

          initialNegotiationDoneRef.current = true;
          setStatus("connected");
        } catch (err) {
          console.error(`[WebRTC] ${role} failed to answer offer:`, err);
          setError("Failed to join video call: " + (err?.message || err));
          setStatus("error");
        }
      };

      const handleIncomingAnswer = async (answerData) => {
        if (!answerData || !answerData.sdp) return;
        if (pc.signalingState !== "have-local-offer") return; // not currently expecting an answer
        if (answerData.sdp === lastProcessedAnswerSdp) return; // Ignore duplicate answers

        try {
          console.log(`[WebRTC] ${role} applying answer`);
          lastProcessedAnswerSdp = answerData.sdp;
          await pc.setRemoteDescription(new RTCSessionDescription(answerData));
          await flushRemoteCandidates();
          initialNegotiationDoneRef.current = true;
          setStatus("connected");
        } catch (err) {
          console.error(`[WebRTC] ${role} setRemoteDescription failed:`, err);
        }
      };

      if (role === "caller") {
        try {
          getDocs(candidatesCol).then((oldCands) => {
            oldCands.forEach((docSnap) => {
              deleteDoc(docSnap.ref).catch(() => { });
            });
          }).catch(() => { });

          const rawOffer = await pc.createOffer();
          const tunedOffer = new RTCSessionDescription({
            type: rawOffer.type,
            sdp: tuneSdpForVocalClarity(rawOffer.sdp)
          });
          await pc.setLocalDescription(tunedOffer);

          await setDoc(roomRef, {
            sessionId: currentSessionId,
            offer: { type: tunedOffer.type, sdp: tunedOffer.sdp, from: role },
            answer: null,
            caller: { name: myName, role: myRole },
            caller_in_room: true,
            caller_cam_on: camOnRef.current,
            caller_mic_on: micOnRef.current,
            callee_in_room: false,
            started_at: Date.now(),
            status: "calling",
          });

          const unsubRoom = onSnapshot(roomRef, async (snapshot) => {
            if (endedRef.current || !snapshot.exists()) return;
            const data = snapshot.data();
            if (!data || data.sessionId !== currentSessionId) return;

            // Track callee's live camera and mic state
            if (data.callee_cam_on !== undefined) {
              setPeerCamOn(data.callee_cam_on);
            }
            if (data.callee_mic_on !== undefined) {
              setPeerMicOn(data.callee_mic_on);
            }

            if (data.offer) await handleIncomingOffer(data.offer);   // handles renegotiation rounds initiated by the callee
            if (data.answer) await handleIncomingAnswer(data.answer);

            if (data.callee_in_room === false && statusRef.current === "connected") {
              setStatus("reconnecting");
            }
          }, (err) => {
            console.error("[WebRTC] (caller) room listener error — likely a Firestore security-rule permission issue:", err);
            setError("Signaling error: " + (err?.message || err));
            setStatus("error");
          });
          trackUnsub(unsubRoom);

          setStatus("calling");
        } catch (e) {
          setError("Failed to start call: " + (e?.message || e));
          setStatus("error");
        }
      } else {
        // Callee
        const unsubRoom = onSnapshot(roomRef, async (snapshot) => {
          if (endedRef.current || !snapshot.exists()) return;
          const data = snapshot.data();
          if (!data) return;

          if (data.sessionId && data.sessionId !== sessionIdRef.current) {
            sessionIdRef.current = data.sessionId;
          }

          // Track caller's live camera and mic state
          if (data.caller_cam_on !== undefined) {
            setPeerCamOn(data.caller_cam_on);
          }
          if (data.caller_mic_on !== undefined) {
            setPeerMicOn(data.caller_mic_on);
          }

          if (data.offer) await handleIncomingOffer(data.offer);
          if (data.answer) await handleIncomingAnswer(data.answer); // handles renegotiation rounds initiated by the caller

          if (data.caller_in_room === false && statusRef.current === "connected") {
            setStatus("reconnecting");
          }
        }, (err) => {
          console.error("[WebRTC] (callee) room listener error — likely a Firestore security-rule permission issue:", err);
          setError("Signaling error: " + (err?.message || err));
          setStatus("error");
        });
        trackUnsub(unsubRoom);

        setStatus("calling");
      }
    };

    start();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, role]);

  // Global Keyboard Shortcuts (Laptop/PC Controls for Teacher Recitation)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Don't intercept when user is actively typing in inputs or select dropdowns
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select" ||
        document.activeElement?.isContentEditable
      ) {
        return;
      }

      // 1. Spacebar -> Mute / Unmute Microphone
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        toggleMic();
        return;
      }

      // 2. 'F' or 'f' -> Fullscreen Toggle
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // 3. 'H' or 'h' -> Hide / Unhide Bottom Bar
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        setControlsHidden((prev) => !prev);
        return;
      }

      // 4. Quran Navigation & Scrolling (Arrow keys)
      if (quranOpen) {
        // ArrowLeft -> Next Page (in Mushaf RTL layout)
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setQuranPage((p) => Math.min(604, p + 1));
          return;
        }

        // ArrowRight -> Previous Page
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setQuranPage((p) => Math.max(1, p - 1));
          return;
        }

        // ArrowDown -> Scroll Quran Page Down smoothly
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const vp = document.querySelector(".mq-viewport");
          if (vp) {
            vp.scrollBy({ top: 160, behavior: "smooth" });
          }
          return;
        }

        // ArrowUp -> Scroll Quran Page Up smoothly
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const vp = document.querySelector(".mq-viewport");
          if (vp) {
            vp.scrollBy({ top: -160, behavior: "smooth" });
          }
          return;
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [toggleMic, toggleFullscreen, quranOpen]);

  if (!call) return null;

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const statusLabel = {
    initializing: "Setting up…",
    calling: "Connecting…",
    connected: `${mm}:${ss}`,
    reconnecting: `Waiting for ${peerName}…`,
    disconnected: "Reconnecting…",
    failed: "Reconnecting…",
    error: "Error",
  }[status] || status;

  const showRemoteVideo = peerCamOn && hasRemoteVideo && status === "connected";

  // If teacher minimized the call into floating in-app mini player
  if (isTeacher && isTeacherMinimized) {
    return createPortal(
      <div
        className="vc-floating-mini-player"
        onClick={() => setIsTeacherMinimized(false)}
        role="dialog"
        aria-label="Active Call Floating Widget"
        title="Click to expand full classroom screen"
      >
        <audio ref={remoteAudioRef} autoPlay playsInline muted={true} />

        {/* Video feed or mini avatar in floating card */}
        <div className="vc-mini-video-wrap">
          <video
            ref={remoteVideoRef}
            className={`vc-mini-video ${showRemoteVideo ? "visible" : "hidden"}`}
            autoPlay
            playsInline
            muted={true}
          />
          {!showRemoteVideo && (
            <div className="vc-mini-avatar">
              <span>{(peerName || "?").slice(0, 1).toUpperCase()}</span>
            </div>
          )}
          {remoteSpeaking && <span className="vc-mini-speaking-dot" />}
        </div>

        {/* Info & mini controls */}
        <div className="vc-mini-info">
          <div className="vc-mini-name">{peerName}</div>
          <div className="vc-mini-status">
            <span className="vc-dot vc-dot-active" style={{ width: 7, height: 7 }} />
            <span>{statusLabel}</span>
          </div>
        </div>

        <div className="vc-mini-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`vc-mini-btn ${micOn ? "" : "muted"}`}
            onClick={toggleMic}
            title={micOn ? "Mute" : "Unmute"}
          >
            {micOn ? <Mic size={14} /> : <MicOff size={14} />}
          </button>
          <button
            type="button"
            className="vc-mini-btn expand"
            onClick={() => setIsTeacherMinimized(false)}
            title="Expand Full Screen"
          >
            <Maximize2 size={14} />
          </button>
          <button
            type="button"
            className="vc-mini-btn end"
            onClick={handleEnd}
            title="End Call"
          >
            <Phone size={14} style={{ transform: "rotate(135deg)" }} />
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      id="g"
      className={`vc-overlay ${isFullscreen ? "vc-fullscreen" : ""}`}
      role="dialog"
      aria-label="Video call"
      onClick={() => {
        handleGlobalAudioUnlock();
        if (showAudioDeviceMenu) setShowAudioDeviceMenu(false);
      }}
    >
      {/* Student Navigation Locked Notification Toast */}
      {showBackLockAlert && (
        <div className="vc-back-lock-toast" role="alert">
          <ShieldAlert size={24} className="vc-lock-icon" />
          <div className="vc-lock-text">
            <div className="vc-lock-title">Online Tahfeez Class In Progress</div>
            <div className="vc-lock-desc">
              Navigation is disabled for students during live recitation. Please stay in class or use the End button.
            </div>
          </div>
        </div>
      )}

      <div
        className={`vc-stage ${
          quranOpen
            ? "vc-layout-quran"
            : layoutMode === "grid"
            ? "vc-layout-grid"
            : "vc-layout-pip"
        }`}
      >
        {/* Dedicated Audio Element for Remote Sound */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          muted={true}
        />

        {/* Top Header Bar */}
        <div className="vc-topbar">
          <div className="vc-topbar-left">
            <span className={`vc-dot ${status === "connected" ? "vc-dot-active" : ""}`} />
            <div className="vc-title-group">
              <span className="vc-room-label">
                {isSpectator ? "Auditing Class (Spectator)" : "Online Tahfeez"}
              </span>
              <span className="vc-role-badge">
                Mauze Tahfeez Galiakot
              </span>
            </div>
          </div>
          <div className="vc-topbar-right">
            <span className="vc-status-pill">{statusLabel}</span>

            {/* Teacher-Only Picture-in-Picture / Minimize button in header */}
            {isTeacher && (
              <button
                type="button"
                className="vc-icon-btn vc-pip-header-btn"
                onClick={handleTeacherPip}
                title="Picture-in-Picture / Minimize to background"
              >
                <PictureInPicture2 size={14} />
                <span>PiP</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Viewport */}
        {quranOpen ? (
          /* ============================================================
             PREMIUM MULTI 3-SCREEN GRID MODE (Misri Quran + Student Video + Teacher Self-Cam)
             WITH DYNAMIC MOBILE & DESKTOP STRETCHABLE RESIZABLE SPLIT VIEW
             ============================================================ */
          <div 
            ref={quranViewportRef}
            className={`vc-viewport vc-quran-viewport ${isDraggingSplit ? "vc-split-dragging" : ""}`}
            style={{
              "--quran-split-ratio": `${quranSplitRatio}%`
            }}
          >
            {/* Screen 1: Misri Quran Reader (Primary reading view - Dynamic Stretched Size) */}
            <div 
              className="vc-quran-box"
              style={{
                flex: `0 0 ${quranSplitRatio}%`,
                maxHeight: typeof window !== "undefined" && window.innerWidth <= 768 ? `${quranSplitRatio}%` : "100%",
                maxWidth: typeof window !== "undefined" && window.innerWidth > 768 ? `${quranSplitRatio}%` : "100%"
              }}
            >
              <MisriQuranViewer
                currentPage={quranPage}
                onPageChange={setQuranPage}
                compact={false}
              />
            </div>

            {/* Stretchable Split Resizer Bar / Multi-Screen Drag Divider */}
            <div
              className={`vc-split-resizer ${isDraggingSplit ? "active" : ""}`}
              onMouseDown={handleSplitDragStart}
              onTouchStart={handleSplitDragStart}
              title="Drag to stretch / adjust Quran and Student video screen size"
            >
              <div 
                className="vc-resizer-pill"
                onClick={handleSplitQuickSnap}
                title="Tap to cycle screen presets (74% / 56% / 36%)"
              >
                <div className="vc-resizer-grip" />
                <span className="vc-resizer-ratio-tooltip">
                  {quranSplitRatio}% Quran
                </span>
              </div>
            </div>

            {/* Screen 2: Student Remote Video Feed (Dynamically adapts to remaining space) */}
            <div 
              className={`vc-student-box-quran ${remoteSpeaking ? "vc-speaking" : ""}`}
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                minWidth: 0
              }}
            >
              <video
                ref={remoteVideoRef}
                className={`vc-video-elem ${showRemoteVideo ? "vc-video-visible" : "vc-video-hidden"}`}
                autoPlay
                playsInline
                muted={true}
              />
              {!showRemoteVideo && (
                <div className="vc-avatar-placeholder">
                  <div className={`vc-avatar-circle ${remoteSpeaking ? "vc-avatar-pulse-active" : ""}`}>
                    <span>{(peerName || "?").slice(0, 1).toUpperCase()}</span>
                  </div>
                  <div className="vc-peer-name">{peerName}</div>
                  {status === "connected" ? (
                    <div className="vc-audio-live-pill">
                      <span className="vc-audio-wave">
                        <span></span><span></span><span></span><span></span>
                      </span>
                      <span>{peerCamOn ? "Connecting camera…" : "Camera Off · Audio Live"}</span>
                    </div>
                  ) : (
                    <div className="vc-status-sub">{statusLabel}</div>
                  )}
                  {error && <div className="vc-error-pill">{error}</div>}
                </div>
              )}
              <div className="vc-stream-tag">
                <div className="vc-tag-user">
                  {isTeacher ? <User size={13} /> : <GraduationCap size={13} />}
                  <span>{peerName}</span>
                </div>
                {!peerMicOn && <span className="vc-muted-tag">Muted</span>}
                {remoteSpeaking && peerMicOn && <span className="vc-speaking-tag">Speaking…</span>}
              </div>
            </div>

            {/* Screen 3: Teacher Miniature Self-View (very little size floating preview) */}
            {!isSpectator && (
              <div className={`vc-teacher-mini-floating ${localSpeaking ? "vc-speaking" : ""}`}>
                <video
                  ref={localVideoRef}
                  className={`vc-video-elem vc-local-elem ${camOn ? "vc-video-visible" : "vc-video-hidden"}`}
                  autoPlay
                  playsInline
                  muted
                />
                {!camOn && (
                  <div className="vc-mini-teacher-off">
                    <div className="vc-mini-avatar-sub">
                      <span>{(myName || "Y").slice(0, 1).toUpperCase()}</span>
                    </div>
                    <span>Cam Off</span>
                  </div>
                )}
                <div className="vc-mini-teacher-badge">
                  <span>{isTeacher ? "You (Muhaffiz)" : "You"}</span>
                  {!micOn && <span className="vc-mini-muted-dot" />}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================
             STANDARD DUAL VIEWPORT (Grid or Focus PiP)
             ============================================================ */
          <div className="vc-viewport">
            {/* Remote Video Container */}
            <div className={`vc-video-box vc-remote-box ${remoteSpeaking ? "vc-speaking" : ""}`}>
              <video
                ref={remoteVideoRef}
                className={`vc-video-elem ${showRemoteVideo ? "vc-video-visible" : "vc-video-hidden"}`}
                autoPlay
                playsInline
                muted={true}
              />
              {!showRemoteVideo && (
                <div className="vc-avatar-placeholder">
                  <div className={`vc-avatar-circle ${remoteSpeaking ? "vc-avatar-pulse-active" : ""}`}>
                    <span>{(peerName || "?").slice(0, 1).toUpperCase()}</span>
                  </div>
                  <div className="vc-peer-name">{peerName}</div>
                  {status === "connected" ? (
                    <div className="vc-audio-live-pill">
                      <span className="vc-audio-wave">
                        <span></span><span></span><span></span><span></span>
                      </span>
                      <span>{peerCamOn ? "Connecting camera…" : "Camera Off · Audio Live"}</span>
                    </div>
                  ) : (
                    <div className="vc-status-sub">{statusLabel}</div>
                  )}
                  {error && <div className="vc-error-pill">{error}</div>}
                </div>
              )}
              <div className="vc-stream-tag">
                <div className="vc-tag-user">
                  {isTeacher ? <User size={13} /> : <GraduationCap size={13} />}
                  <span>{peerName}</span>
                </div>
                {!peerMicOn && <span className="vc-muted-tag">Muted</span>}
                {remoteSpeaking && peerMicOn && <span className="vc-speaking-tag">Speaking…</span>}
              </div>
            </div>

            {/* Local Video Container */}
            {!isSpectator && (
              <div className={`vc-video-box vc-local-box ${localSpeaking ? "vc-speaking" : ""}`}>
                <video
                  ref={localVideoRef}
                  className={`vc-video-elem vc-local-elem ${camOn ? "vc-video-visible" : "vc-video-hidden"}`}
                  autoPlay
                  playsInline
                  muted
                />
                {!camOn && (
                  <div className="vc-avatar-placeholder">
                    <div className={`vc-avatar-circle local ${localSpeaking ? "vc-avatar-pulse-active" : ""}`}>
                      <span>{(myName || "Y").slice(0, 1).toUpperCase()}</span>
                    </div>
                    <div className="vc-peer-name">{myName} (You)</div>
                    <div className="vc-status-sub">Camera Off</div>
                  </div>
                )}
                <div className="vc-stream-tag">
                  <div className="vc-tag-user">
                    {isTeacher ? <GraduationCap size={13} /> : <User size={13} />}
                    <span>{myName} (You)</span>
                  </div>
                  {!micOn && <span className="vc-muted-tag">Muted</span>}
                  {localSpeaking && micOn && <span className="vc-speaking-tag">Speaking…</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audio Unblock Banner if Browser Blocked Sound */}
        {audioBlocked && (
          <div className="vc-audio-blocked-banner" onClick={handleGlobalAudioUnlock}>
            <VolumeX size={18} />
            <span>Tap here to enable speaker audio</span>
          </div>
        )}

        {/* Audio Device Selection Modal Overlay (Fixes mobile positioning and clipping bugs on all devices) */}
        {showAudioDeviceMenu && (
          <div
            className="vc-audio-menu-overlay"
            onClick={(e) => {
              e.stopPropagation();
              setShowAudioDeviceMenu(false);
            }}
          >
            <div className="vc-audio-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="vc-audio-modal-header">
                <div className="vc-audio-modal-title">
                  <Volume2 size={16} />
                  <span>Audio Output Mode</span>
                </div>
                <button
                  type="button"
                  className="vc-audio-modal-close"
                  onClick={() => setShowAudioDeviceMenu(false)}
                  title="Close Menu"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="vc-audio-modal-list">
                <button
                  type="button"
                  className={`vc-menu-item ${audioOutputMode === "speaker" ? "active" : ""}`}
                  onClick={() => handleSelectAudioMode("speaker")}
                >
                  <Volume2 size={18} className="vc-menu-icon" />
                  <div className="vc-menu-text">
                    <span className="vc-menu-title">Loudspeaker</span>
                    <span className="vc-menu-desc">Loud audio for room recitation</span>
                  </div>
                  {audioOutputMode === "speaker" && <span className="vc-check">✓</span>}
                </button>

                <button
                  type="button"
                  className={`vc-menu-item ${audioOutputMode === "headphones" ? "active" : ""}`}
                  onClick={() => handleSelectAudioMode("headphones")}
                >
                  <Headphones size={18} className="vc-menu-icon" />
                  <div className="vc-menu-text">
                    <span className="vc-menu-title">Receiver / Headphones</span>
                    <span className="vc-menu-desc">Earpiece audio mode</span>
                  </div>
                  {audioOutputMode === "headphones" && <span className="vc-check">✓</span>}
                </button>

                {audioOutputs.length > 1 && (
                  <>
                    <div className="vc-menu-divider" />
                    <div className="vc-menu-header">Hardware Audio Devices</div>
                    {audioOutputs.map((device, idx) => (
                      <button
                        key={device.deviceId || idx}
                        type="button"
                        className={`vc-menu-item ${selectedAudioDeviceId === device.deviceId ? "active" : ""}`}
                        onClick={() => handleSelectSpecificDevice(device.deviceId)}
                      >
                        <Volume2 size={18} className="vc-menu-icon" />
                        <div className="vc-menu-text">
                          <span className="vc-menu-title">{device.label || `Output Device ${idx + 1}`}</span>
                        </div>
                        {selectedAudioDeviceId === device.deviceId && <span className="vc-check">✓</span>}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Control Bar (Pure Luxury Icons with Smooth Tap Animations) */}
        <div className={`vc-controls ${controlsHidden ? 'vc-controls-hidden' : ''}`} onClick={(e) => e.stopPropagation()}>
          {/* Audio Output Mode Button */}
          <button
            type="button"
            className={`vc-btn ${audioOutputMode === "headphones" ? "vc-btn-active" : ""}`}
            onClick={() => setShowAudioDeviceMenu(!showAudioDeviceMenu)}
            title="Choose Audio Output (Speaker / Headphones)"
            aria-label="Audio Output"
          >
            {audioOutputMode === "headphones" ? <Headphones size={22} /> : <Volume2 size={22} />}
          </button>

          {!isSpectator && (
            <>
              {/* Mic Toggle Button */}
              <button
                type="button"
                className={`vc-btn ${micOn ? "vc-btn-active" : "vc-btn-off"}`}
                onClick={toggleMic}
                title={micOn ? "Mute Microphone" : "Unmute Microphone"}
                aria-label={micOn ? "Mute" : "Unmute"}
              >
                {micOn ? <Mic size={22} /> : <MicOff size={22} />}
              </button>

              {/* Camera Toggle Button */}
              <button
                type="button"
                className={`vc-btn ${camOn ? "vc-btn-active" : "vc-btn-off"}`}
                onClick={toggleCam}
                title={camOn ? "Turn Camera Off" : "Turn Camera On"}
                aria-label={camOn ? "Turn Camera Off" : "Turn Camera On"}
              >
                {camOn ? <Video size={22} /> : <VideoOff size={22} />}
              </button>

              {/* Switch Camera (Front/Rear/Mushaf) */}
              {hasMultipleCameras && camOn && (
                <button
                  type="button"
                  className="vc-btn"
                  onClick={switchCamera}
                  title="Flip Camera (Front / Mushaf)"
                  aria-label="Flip Camera"
                >
                  <SwitchCamera size={22} />
                </button>
              )}
            </>
          )}

          {/* MISRI QURAN BUTTON (ONLY FOR TEACHER PORTAL) */}
          {isTeacher && (
            <button
              type="button"
              className={`vc-btn ${quranOpen ? "vc-btn-active vc-btn-quran-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setQuranOpen(!quranOpen);
              }}
              title={quranOpen ? "Close Quran View (Return to Full Video)" : "Open Misri Quran (Multi 3-Screen View)"}
              aria-label="Misri Quran"
            >
              <BookOpen size={22} />
            </button>
          )}

          {/* Teacher-Only Picture-in-Picture & Minimize Button */}
          {isTeacher && (
            <button
              type="button"
              className="vc-btn vc-btn-pip"
              onClick={(e) => {
                e.stopPropagation();
                handleTeacherPip();
              }}
              title="Picture-in-Picture / Minimize (Teacher Only)"
              aria-label="Picture-in-Picture"
            >
              <PictureInPicture2 size={22} />
            </button>
          )}

          {/* Layout Mode Button (Only active when Quran mode is closed) */}
          {!quranOpen && (
            <button
              type="button"
              className="vc-btn"
              onClick={(e) => {
                e.stopPropagation();
                setLayoutMode(layoutMode === "grid" ? "pip" : "grid");
              }}
              title={layoutMode === "grid" ? "Switch to Focus/PiP View" : "Switch to Side-by-Side Grid"}
              aria-label="Toggle Layout Mode"
            >
              <LayoutGrid size={22} />
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            type="button"
            className="vc-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            aria-label="Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={22} /> : <Maximize2 size={22} />}
          </button>

          {/* End Call Button */}
          <button
            type="button"
            className="vc-btn vc-btn-end"
            onClick={handleEnd}
            title={isSpectator ? "Leave Classroom" : "End Call"}
            aria-label="End Call"
          >
            <Phone size={24} style={{ transform: "rotate(135deg)" }} />
          </button>

          {/* Hide Controls Button */}
          <button
            type="button"
            className="vc-btn"
            onClick={(e) => {
              e.stopPropagation();
              setControlsHidden(true);
            }}
            title="Hide Controls"
            aria-label="Hide Controls"
          >
            <ChevronDown size={22} />
          </button>
        </div>

        {/* Floating Unhide Button */}
        {controlsHidden && (
          <button
            type="button"
            className="vc-unhide-btn"
            onClick={(e) => {
              e.stopPropagation();
              setControlsHidden(false);
            }}
            title="Show Controls"
            aria-label="Show Controls"
          >
            <ChevronUp size={24} />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}