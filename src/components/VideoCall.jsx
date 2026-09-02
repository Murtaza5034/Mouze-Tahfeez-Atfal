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
import { supabase } from "../supabaseClient.js";
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

// Hook for draggable + 4-corner drag resizing (desktop) + two-finger pinch-to-resize (mobile) portrait floating PiP
function useFloatingPortraitPip(initialPosFactory, initialWidth = 140) {
  const [pos, setPos] = useState(initialPosFactory);
  const [width, setWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isPinching, setIsPinching] = useState(false);

  const stateRef = useRef({
    pos,
    width,
    startTouchX: 0,
    startTouchY: 0,
    startPosX: 0,
    startPosY: 0,
    startWidth: 0,
    pinchStartDist: 0,
    pinchStartWidth: 0,
    resizeCorner: null,
    didMove: false,
  });

  useEffect(() => {
    stateRef.current.pos = pos;
    stateRef.current.width = width;
  }, [pos, width]);

  // Keep strictly within viewport bounds on window resize / orientation change
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      const margin = 8;
      const maxAllowedW = Math.min(window.innerWidth - margin * 2, isMobile ? 380 : 650);
      const minAllowedW = isMobile ? 90 : 110;

      let curW = stateRef.current.width;
      if (curW > maxAllowedW) curW = maxAllowedW;
      if (curW < minAllowedW) curW = minAllowedW;
      if (curW !== stateRef.current.width) setWidth(curW);

      const h = Math.round(curW * 1.42);
      const cur = stateRef.current.pos;
      const maxX = Math.max(margin, window.innerWidth - curW - margin);
      const maxY = Math.max(margin, window.innerHeight - h - margin);
      const clampedX = Math.max(margin, Math.min(maxX, cur.x));
      const clampedY = Math.max(margin, Math.min(maxY, cur.y));
      if (clampedX !== cur.x || clampedY !== cur.y) {
        setPos({ x: clampedX, y: clampedY });
      }
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // 1. Touch Handlers on Main Card (1 touch = Drag, 2 touches = Pinch-to-Resize)
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      stateRef.current.startTouchX = t.clientX;
      stateRef.current.startTouchY = t.clientY;
      stateRef.current.startPosX = stateRef.current.pos.x;
      stateRef.current.startPosY = stateRef.current.pos.y;
      stateRef.current.didMove = false;
      setIsDragging(true);
    } else if (e.touches.length >= 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      stateRef.current.pinchStartDist = dist;
      stateRef.current.pinchStartWidth = stateRef.current.width;
      stateRef.current.startPosX = stateRef.current.pos.x;
      stateRef.current.startPosY = stateRef.current.pos.y;
      setIsPinching(true);
      setIsDragging(false);
      if (e.cancelable) e.preventDefault();
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    const margin = 8;
    const isMobile = window.innerWidth <= 768;
    const minW = isMobile ? 90 : 110;
    const maxW = Math.min(window.innerWidth - margin * 2, isMobile ? 380 : 650);

    if (e.touches.length >= 2) {
      if (e.cancelable) e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      if (stateRef.current.pinchStartDist > 0) {
        const ratio = dist / stateRef.current.pinchStartDist;
        const newW = Math.max(minW, Math.min(maxW, Math.round(stateRef.current.pinchStartWidth * ratio)));
        setWidth(newW);

        const newH = Math.round(newW * 1.42);
        const maxX = Math.max(margin, window.innerWidth - newW - margin);
        const maxY = Math.max(margin, window.innerHeight - newH - margin);
        setPos((prev) => ({
          x: Math.max(margin, Math.min(maxX, prev.x)),
          y: Math.max(margin, Math.min(maxY, prev.y)),
        }));
      }
    } else if (e.touches.length === 1 && !isPinching) {
      const t = e.touches[0];
      const dx = t.clientX - stateRef.current.startTouchX;
      const dy = t.clientY - stateRef.current.startTouchY;
      if (Math.hypot(dx, dy) > 5) {
        stateRef.current.didMove = true;
      }
      const curW = stateRef.current.width;
      const curH = Math.round(curW * 1.42);
      const maxX = Math.max(margin, window.innerWidth - curW - margin);
      const maxY = Math.max(margin, window.innerHeight - curH - margin);
      const newX = Math.max(margin, Math.min(maxX, stateRef.current.startPosX + dx));
      const newY = Math.max(margin, Math.min(maxY, stateRef.current.startPosY + dy));
      setPos({ x: newX, y: newY });
      if (e.cancelable) e.preventDefault();
    }
  }, [isPinching]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setIsPinching(false);
    stateRef.current.pinchStartDist = 0;
  }, []);

  // 2. Mouse Drag (Move window anywhere on screen)
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button") || e.target.closest(".vc-pip-resize-handle") || e.target.closest(".vc-mini-card-controls")) {
      return;
    }
    stateRef.current.startTouchX = e.clientX;
    stateRef.current.startTouchY = e.clientY;
    stateRef.current.startPosX = stateRef.current.pos.x;
    stateRef.current.startPosY = stateRef.current.pos.y;
    stateRef.current.didMove = false;
    setIsDragging(true);

    const handleMouseMove = (moveEv) => {
      const dx = moveEv.clientX - stateRef.current.startTouchX;
      const dy = moveEv.clientY - stateRef.current.startTouchY;
      if (Math.hypot(dx, dy) > 5) {
        stateRef.current.didMove = true;
      }
      const margin = 8;
      const curW = stateRef.current.width;
      const curH = Math.round(curW * 1.42);
      const maxX = Math.max(margin, window.innerWidth - curW - margin);
      const maxY = Math.max(margin, window.innerHeight - curH - margin);
      const newX = Math.max(margin, Math.min(maxX, stateRef.current.startPosX + dx));
      const newY = Math.max(margin, Math.min(maxY, stateRef.current.startPosY + dy));
      setPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  // 3. Corner Resize Drag Handlers (Desktop Mouse + Mobile Single-Touch corner dragging)
  const startResize = useCallback((corner, clientX, clientY) => {
    const isMobile = window.innerWidth <= 768;
    const margin = 8;
    const minW = isMobile ? 90 : 110;
    const maxW = Math.min(window.innerWidth - margin * 2, isMobile ? 380 : 650);

    stateRef.current.resizeCorner = corner;
    stateRef.current.startTouchX = clientX;
    stateRef.current.startTouchY = clientY;
    stateRef.current.startPosX = stateRef.current.pos.x;
    stateRef.current.startPosY = stateRef.current.pos.y;
    stateRef.current.startWidth = stateRef.current.width;
    stateRef.current.didMove = true;
    setIsResizing(true);

    const onMove = (curX, curY) => {
      const dx = curX - stateRef.current.startTouchX;
      const dy = curY - stateRef.current.startTouchY;
      const startW = stateRef.current.startWidth;
      const startX = stateRef.current.startPosX;
      const startY = stateRef.current.startPosY;

      let deltaW = 0;
      if (corner === "br") {
        deltaW = Math.max(dx, dy / 1.42);
      } else if (corner === "bl") {
        deltaW = Math.max(-dx, dy / 1.42);
      } else if (corner === "tr") {
        deltaW = Math.max(dx, -dy / 1.42);
      } else if (corner === "tl") {
        deltaW = Math.max(-dx, -dy / 1.42);
      }

      const newW = Math.max(minW, Math.min(maxW, Math.round(startW + deltaW)));
      const newH = Math.round(newW * 1.42);

      let newX = startX;
      let newY = startY;

      if (corner === "bl" || corner === "tl") {
        newX = startX - (newW - startW);
      }
      if (corner === "tr" || corner === "tl") {
        newY = startY - (newH - Math.round(startW * 1.42));
      }

      const maxX = Math.max(margin, window.innerWidth - newW - margin);
      const maxY = Math.max(margin, window.innerHeight - newH - margin);
      newX = Math.max(margin, Math.min(maxX, newX));
      newY = Math.max(margin, Math.min(maxY, newY));

      setWidth(newW);
      setPos({ x: newX, y: newY });
    };

    const handleMouseMove = (moveEv) => {
      onMove(moveEv.clientX, moveEv.clientY);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      stateRef.current.resizeCorner = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    const handleTouchMove = (touchEv) => {
      if (touchEv.touches.length > 0) {
        if (touchEv.cancelable) touchEv.preventDefault();
        const t = touchEv.touches[0];
        onMove(t.clientX, t.clientY);
      }
    };

    const handleTouchEnd = () => {
      setIsResizing(false);
      stateRef.current.resizeCorner = null;
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
  }, []);

  const getResizeHandleProps = useCallback((corner) => ({
    onMouseDown: (e) => {
      e.stopPropagation();
      e.preventDefault();
      startResize(corner, e.clientX, e.clientY);
    },
    onTouchStart: (e) => {
      e.stopPropagation();
      if (e.touches.length > 0) {
        if (e.cancelable) e.preventDefault();
        startResize(corner, e.touches[0].clientX, e.touches[0].clientY);
      }
    },
  }), [startResize]);

  return {
    pos,
    setPos,
    width,
    setWidth,
    height: Math.round(width * 1.42),
    isDragging,
    isResizing,
    isPinching,
    didMoveRef: stateRef,
    getResizeHandleProps,
    bind: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
      onMouseDown: handleMouseDown,
    },
  };
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
  const pipFallbackCanvasRef = useRef(null);
  const pipFallbackVideoRef = useRef(null);
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
  // Tracks whether the remote peer has ever joined this session.
  // Used to prevent the "reconnecting" status from firing on the initial
  // Firestore snapshot (which still has callee_in_room/caller_in_room = false).
  const peerJoinedRef = useRef(false);
  // Timer ref for delayed ICE restart on transient disconnects.
  const iceRestartTimerRef = useRef(null);
  const handleEndRef = useRef(null);

  // Ultra-Lightweight Class Audio Recording (Opus 16kbps)
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
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
  const [isNativePipActive, setIsNativePipActive] = useState(false);
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

  const [lockToastShake, setLockToastShake] = useState(false);
  const backLockToastTimerRef = useRef(null);

  // Trigger Student Navigation Locked Alert Toast + Vibration
  const triggerBackLockAlert = useCallback(() => {
    setShowBackLockAlert(true);
    setLockToastShake(true);
    setTimeout(() => setLockToastShake(false), 600);

    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([180, 80, 180]);
      }
    } catch (_) {}

    if (backLockToastTimerRef.current) clearTimeout(backLockToastTimerRef.current);
    backLockToastTimerRef.current = setTimeout(() => {
      setShowBackLockAlert(false);
    }, 4500);
  }, []);

  // Multi-Layered Student Back Navigation, Bottom Nav Block & Auto-End (Active for student/parent only)
  useEffect(() => {
    if (isTeacher) return;

    // 1. Inform Native Android Java Bridge
    try {
      if (typeof window !== "undefined" && window.MauzeBackLockBridge) {
        window.MauzeBackLockBridge.setCallLocked(true);
      }
    } catch (_) {}

    // 2. Block bottom mobile navigation bar: prevent overscroll gestures
    const prevOverscroll = document.body.style.overscrollBehavior;
    const prevTouchAction = document.body.style.touchAction;
    const prevDocOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "none";
    document.documentElement.style.overscrollBehavior = "none";

    // Block touch swipe-up from the bottom 60px (Android bottom nav gesture zone)
    const handleBottomNavBlock = (e) => {
      const touch = e.touches[0];
      if (touch && touch.clientY > window.innerHeight - 60) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("touchstart", handleBottomNavBlock, { passive: false, capture: true });
    document.addEventListener("touchmove", handleBottomNavBlock, { passive: false, capture: true });

    // 3. Hardware / Android Back Button via Capacitor App Plugin → AUTO-END CALL
    let capacitorBackSub = null;
    if (typeof window !== "undefined") {
      import("@capacitor/app")
        .then(({ App }) => {
          App.addListener("backButton", () => {
            // Auto-end call when student presses hardware back
            if (handleEndRef.current) handleEndRef.current();
          }).then((handle) => {
            capacitorBackSub = handle;
          }).catch(() => {});
        })
        .catch(() => {});
    }

    // 4. Custom Event listener from Native Android MainActivity bridge → AUTO-END CALL
    const handleNativeBack = () => {
      if (handleEndRef.current) handleEndRef.current();
    };
    window.addEventListener("tahfeez-back-blocked", handleNativeBack);

    // 5. Browser / Webview popstate (browser back) → AUTO-END CALL
    const trapKey = "tahfeez_lock_" + Date.now();
    try {
      for (let i = 0; i < 4; i++) {
        window.history.pushState({ tahfeezCallLocked: true, trapKey }, "", window.location.href);
      }
    } catch (_) {}

    const handlePopState = () => {
      // Student pressed browser back — end the call
      if (handleEndRef.current) handleEndRef.current();
    };
    window.addEventListener("popstate", handlePopState, { capture: true });

    // 6. App backgrounded / tab hidden → AUTO-END CALL
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (handleEndRef.current) handleEndRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 7. pagehide (iOS Safari background / PWA close)
    const handlePageHide = () => {
      if (handleEndRef.current) handleEndRef.current();
    };
    window.addEventListener("pagehide", handlePageHide);

    // 8. BeforeUnload — end call on tab/window close
    const handleBeforeUnload = () => {
      if (handleEndRef.current) handleEndRef.current();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // 9. Screen Wake Lock (Keeps mobile device screen awake during student recitation)
    let wakeLockObj = null;
    if (typeof navigator !== "undefined" && navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request("screen")
        .then((wl) => { wakeLockObj = wl; })
        .catch(() => {});
    }

    return () => {
      // Release locks on exit
      try {
        if (typeof window !== "undefined" && window.MauzeBackLockBridge) {
          window.MauzeBackLockBridge.setCallLocked(false);
        }
      } catch (_) {}

      // Restore body styles
      document.body.style.overscrollBehavior = prevOverscroll;
      document.body.style.touchAction = prevTouchAction;
      document.documentElement.style.overscrollBehavior = prevDocOverscroll;
      document.removeEventListener("touchstart", handleBottomNavBlock, { capture: true });
      document.removeEventListener("touchmove", handleBottomNavBlock, { capture: true });

      if (capacitorBackSub && capacitorBackSub.remove) {
        capacitorBackSub.remove();
      }
      window.removeEventListener("tahfeez-back-blocked", handleNativeBack);
      window.removeEventListener("popstate", handlePopState, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      if (wakeLockObj && wakeLockObj.release) {
        wakeLockObj.release().catch(() => {});
      }
      if (backLockToastTimerRef.current) {
        clearTimeout(backLockToastTimerRef.current);
      }
    };
  }, [isTeacher]);

  // Hook for draggable + multi-corner drag resizing (desktop) + 2-finger pinch resizing (mobile)
  const initialPipWidth = typeof window !== "undefined" && window.innerWidth <= 768 ? 130 : 175;

  const quranPip = useFloatingPortraitPip(
    () => ({
      x: typeof window !== "undefined" ? Math.max(10, window.innerWidth - (window.innerWidth <= 768 ? 145 : 195)) : 200,
      y: typeof window !== "undefined" && window.innerWidth <= 768 ? 68 : 80,
    }),
    initialPipWidth
  );

  const minimizedPip = useFloatingPortraitPip(
    () => ({
      x: typeof window !== "undefined" ? Math.max(10, window.innerWidth - (window.innerWidth <= 768 ? 145 : 195)) : 200,
      y: typeof window !== "undefined" ? Math.max(10, window.innerHeight - (window.innerWidth <= 768 ? 250 : 320)) : 400,
    }),
    initialPipWidth
  );

  // Maintain dynamic animated fallback video stream for native OS PiP (supports PiP even when camera is off or audio-only)
  const pipLogoImgRef = useRef(null);
  useEffect(() => {
    if (typeof Image !== "undefined" && !pipLogoImgRef.current) {
      const img = new Image();
      img.src = "/logo.png";
      pipLogoImgRef.current = img;
    }
  }, []);

  useEffect(() => {
    let animId = null;
    let canvas = pipFallbackCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 680;
      pipFallbackCanvasRef.current = canvas;
    }

    const ctx = canvas.getContext("2d");
    let angle = 0;

    const drawFrame = () => {
      if (endedRef.current) return;
      angle += 0.04;
      const w = canvas.width;
      const h = canvas.height;

      // Dark luxury background
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#16130e");
      grad.addColorStop(1, "#0a0907");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Gold / Green border
      ctx.strokeStyle = remoteSpeaking ? "#2ecc71" : "rgba(212, 175, 55, 0.7)";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);

      // Header Bar in Canvas
      ctx.fillStyle = "rgba(212, 175, 55, 0.15)";
      ctx.fillRect(10, 10, w - 20, 52);
      ctx.fillStyle = "#d4af37";
      ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Mauze Tahfeez Online", w / 2, 42);

      // Avatar circle center coordinates
      const cx = w / 2;
      const cy = h / 2 - 30;
      const baseRadius = 80;

      // Animated speaking waves
      if (remoteSpeaking) {
        const pulse = Math.sin(angle * 3) * 12;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius + 18 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(46, 204, 113, 0.25)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius + 8 + pulse * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(46, 204, 113, 0.4)";
        ctx.fill();
      }

      // Avatar Background
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#262118";
      ctx.fill();
      ctx.strokeStyle = remoteSpeaking ? "#2ecc71" : "#d4af37";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Avatar content: show Mauze Tahfeez logo when remote is teacher (!isTeacher)
      if (!isTeacher && pipLogoImgRef.current && pipLogoImgRef.current.complete && pipLogoImgRef.current.naturalWidth > 0) {
        try {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, baseRadius - 6, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(
            pipLogoImgRef.current,
            cx - baseRadius + 10,
            cy - baseRadius + 10,
            (baseRadius - 10) * 2,
            (baseRadius - 10) * 2
          );
          ctx.restore();
        } catch (_) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 72px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.textBaseline = "middle";
          ctx.fillText((peerName || "?").slice(0, 1).toUpperCase(), cx, cy);
        }
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 72px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText((peerName || "?").slice(0, 1).toUpperCase(), cx, cy);
      }

      // Student Name
      ctx.fillStyle = "#f7f5f0";
      ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(peerName || "Student", cx, cy + baseRadius + 45);

      // Live Recitation Status
      ctx.fillStyle = remoteSpeaking ? "#2ecc71" : "#d4af37";
      ctx.font = "600 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(
        remoteSpeaking ? "Reciting Live • Speaking" : (status === "connected" ? "Audio Live • In Class" : "Connecting…"),
        cx,
        cy + baseRadius + 78
      );

      animId = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    // Stream canvas to fallback video
    if (pipFallbackVideoRef.current && typeof canvas.captureStream === "function") {
      try {
        if (!pipFallbackVideoRef.current.srcObject) {
          const stream = canvas.captureStream(24);
          pipFallbackVideoRef.current.srcObject = stream;
        }
        pipFallbackVideoRef.current.play().catch(() => {});
      } catch (_) {}
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [peerName, remoteSpeaking, status]);

  // Sync remote video stream whenever view changes (e.g. minimizing or opening Quran)
  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current && remoteStreamRef.current.getVideoTracks().length > 0) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      remoteVideoRef.current.onplaying = () => setHasRemoteVideo(true);
      remoteVideoRef.current.play().then(() => setHasRemoteVideo(true)).catch(() => {});
    }
    // Ensure audio continues playing after view changes (PiP, minimize, Quran)
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [isTeacherMinimized, quranOpen, hasRemoteVideo]);

  // Native Picture-in-Picture event listeners
  useEffect(() => {
    const handleEnterPip = () => setIsNativePipActive(true);
    const handleLeavePip = () => setIsNativePipActive(false);

    const rVid = remoteVideoRef.current;
    const fVid = pipFallbackVideoRef.current;

    if (rVid) {
      rVid.addEventListener("enterpictureinpicture", handleEnterPip);
      rVid.addEventListener("leavepictureinpicture", handleLeavePip);
    }
    if (fVid) {
      fVid.addEventListener("enterpictureinpicture", handleEnterPip);
      fVid.addEventListener("leavepictureinpicture", handleLeavePip);
    }

    return () => {
      if (rVid) {
        rVid.removeEventListener("enterpictureinpicture", handleEnterPip);
        rVid.removeEventListener("leavepictureinpicture", handleLeavePip);
      }
      if (fVid) {
        fVid.removeEventListener("enterpictureinpicture", handleEnterPip);
        fVid.removeEventListener("leavepictureinpicture", handleLeavePip);
      }
    };
  }, [isTeacherMinimized, quranOpen]);

  // Request true OS-Level Picture-in-Picture (Floats over all other apps / WhatsApp / PDFs)
  const requestNativePip = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsNativePipActive(false);
        return;
      }

      const showVideo = peerCamOn && hasRemoteVideo && status === "connected";
      const targetVideo = (showVideo && remoteVideoRef.current)
        ? remoteVideoRef.current
        : pipFallbackVideoRef.current;

      if (targetVideo && typeof targetVideo.requestPictureInPicture === "function") {
        try {
          if (targetVideo.readyState === 0 && targetVideo.load) targetVideo.load();
          await targetVideo.play().catch(() => {});
          await targetVideo.requestPictureInPicture();
          setIsNativePipActive(true);
        } catch (pipErr) {
          console.warn("[PiP] Target video PiP note:", pipErr);
          // Try fallback video if primary failed
          if (pipFallbackVideoRef.current && targetVideo !== pipFallbackVideoRef.current) {
            await pipFallbackVideoRef.current.play().catch(() => {});
            await pipFallbackVideoRef.current.requestPictureInPicture();
            setIsNativePipActive(true);
          } else {
            // If native OS PiP is completely unavailable, toggle in-app floating mode
            setIsTeacherMinimized((prev) => !prev);
          }
        }
      } else {
        // Fallback to in-app floating mode
        setIsTeacherMinimized((prev) => !prev);
      }
    } catch (err) {
      console.warn("[PiP] requestNativePip error:", err);
      setIsTeacherMinimized((prev) => !prev);
    }
  }, [peerCamOn, hasRemoteVideo, status]);

  // Teacher Picture-in-Picture handler (Requests OS PiP so teacher can use other apps)
  const handleTeacherPip = useCallback(async () => {
    if (!isTeacher) return;
    await requestNativePip();
  }, [isTeacher, requestNativePip]);

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

  // Ultra-Lightweight Class Audio Recording (Opus 16kbps)
  const mixedDestRef = useRef(null);
  const recordingMimeTypeRef = useRef("audio/webm;codecs=opus");
  const localAudioSourceRef = useRef(null);
  const remoteAudioSourceRef = useRef(null);

  const startCallAudioRecording = useCallback(() => {
    if (isSpectator || recorderRef.current) return;
    if (typeof window === "undefined" || !window.MediaRecorder) return;

    try {
      const ctx = ensureAudioContext();
      if (!ctx) return;

      if (!mixedDestRef.current) {
        mixedDestRef.current = ctx.createMediaStreamDestination();
      }
      const dest = mixedDestRef.current;

      // Connect local mic
      if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0 && !localAudioSourceRef.current) {
        try {
          const lSrc = ctx.createMediaStreamSource(localStreamRef.current);
          lSrc.connect(dest);
          localAudioSourceRef.current = lSrc;
        } catch (_) {}
      }

      // Connect remote audio
      if (remoteStreamRef.current && remoteStreamRef.current.getAudioTracks().length > 0 && !remoteAudioSourceRef.current) {
        try {
          const rSrc = ctx.createMediaStreamSource(remoteStreamRef.current);
          rSrc.connect(dest);
          remoteAudioSourceRef.current = rSrc;
        } catch (_) {}
      }

      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
        else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
        else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) mimeType = "audio/ogg;codecs=opus";
        else mimeType = "";
      }
      recordingMimeTypeRef.current = mimeType || "audio/webm";

      const rec = new MediaRecorder(dest.stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 16000 // Ultra-lightweight Opus voice compression (approx 120KB per minute)
      });

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      rec.start(4000);
      recorderRef.current = rec;
      console.log("[AudioRecord] Ultra-light Opus class recording started @ 16kbps");
    } catch (err) {
      console.warn("[AudioRecord] Note:", err);
    }
  }, [ensureAudioContext, isSpectator]);

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

  // This runs exactly once per call (guarded by audioGraphReadyRef).
  // The <audio> element (muted={isSpectator}) is the playback path for all non-spectators.
  // The Web Audio API is used only for the AnalyserNode (speaking indicator) —
  // it does NOT route to audioContext.destination, so there is no double-playback.
  const connectRemoteAudio = useCallback((remoteStream) => {
    if (audioGraphReadyRef.current) return;
    audioGraphReadyRef.current = true;

    // Use native <audio> element for reliable playback.
    // Note: do NOT set .muted here — the JSX prop (muted={isSpectator}) controls it;
    // imperative .muted assignment gets overridden by React on the next re-render.
    if (remoteAudioRef.current) {
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

    // Stop and upload class audio recording
    if (recorderRef.current) {
      try {
        if (recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
        const chunks = [...recordedChunksRef.current];
        const mType = recordingMimeTypeRef.current || "audio/webm";
        const studentIdVal = call?.studentId || call?.student_id || (roomId ? roomId.replace(/^session_/, '') : null);
        const studentNameVal = call?.studentName || call?.student_name || (myRole === "teacher" ? peerName : myName);
        const teacherNameVal = call?.teacherName || call?.teacher_name || (myRole === "teacher" ? myName : peerName);
        const startedAtIso = call?.startedAt || new Date().toISOString();
        const endedAtIso = new Date().toISOString();
        const durSecs = Math.max(0, Math.round((new Date(endedAtIso).getTime() - new Date(startedAtIso).getTime()) / 1000));

        if (chunks.length > 0 && durSecs >= 3) {
          const blob = new Blob(chunks, { type: mType });
          if (blob.size > 500) {
            const ext = mType.includes("mp4") ? "mp4" : "webm";
            const dateStr = new Date().toISOString().slice(0, 10);
            const fileName = `call_${roomId || 'rec'}_${Date.now()}.${ext}`;
            const filePath = `recordings/${dateStr}/${fileName}`;

            supabase.storage.from("tahfeez_recordings").upload(filePath, blob, {
              contentType: mType,
              cacheControl: "31536000"
            }).then(async ({ data: upData, error: upErr }) => {
              if (!upErr && upData) {
                const { data: urlData } = await supabase.storage.from("tahfeez_recordings").getPublicUrl(filePath);
                const audioUrl = urlData?.publicUrl || upData.publicUrl || "";
                if (audioUrl) {
                  const fileSizeKb = Math.round(blob.size / 1024);
                  // Update existing log record
                  await supabase.from("online_tahfeez_logs").update({
                    audio_url: audioUrl,
                    recording_url: audioUrl,
                    file_size_kb: fileSizeKb
                  }).eq("id", roomId);

                  // Also ensure record exists in online_tahfeez_logs
                  await supabase.from("online_tahfeez_logs").upsert({
                    id: roomId,
                    student_id: String(studentIdVal || ''),
                    student_name: studentNameVal,
                    teacher_name: teacherNameVal,
                    started_at: startedAtIso,
                    ended_at: endedAtIso,
                    duration_seconds: durSecs,
                    audio_url: audioUrl,
                    recording_url: audioUrl,
                    file_size_kb: fileSizeKb,
                    type: call?.type || "1-on-1"
                  }, { onConflict: "id" });
                }
              }
            }).catch((e) => console.warn("[AudioRecord] Upload note:", e));
          }
        }
      } catch (recErr) {
        console.warn("[AudioRecord] Teardown note:", recErr);
      }
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (iceRestartTimerRef.current) {
      clearTimeout(iceRestartTimerRef.current);
      iceRestartTimerRef.current = null;
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
        updateDoc(roomRef, { 
          [fieldName]: false,
          ...(isSpectator ? {} : { status: "ended", ended_at: Date.now() })
        }).catch(() => { });
      } catch (_) { }
    }
  }, [roomId, role, SIGNAL_PATH, isSpectator, call, myRole, peerName, myName]);

  // User clicks End button
  const handleEnd = useCallback(() => {
    stopLocal();
    if (onClose) onClose();
  }, [stopLocal, onClose]);

  useEffect(() => {
    handleEndRef.current = handleEnd;
  }, [handleEnd]);

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
      if (window.MauzeMediaPermissionBridge) {
        try {
          if (!window.MauzeMediaPermissionBridge.hasMediaPermissions()) {
            window.MauzeMediaPermissionBridge.requestMediaPermissions();
            await new Promise((r) => setTimeout(r, 600));
          }
        } catch (_) {}
      }
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
        if (window.MauzeMediaPermissionBridge) {
          try {
            if (!window.MauzeMediaPermissionBridge.hasMediaPermissions()) {
              window.MauzeMediaPermissionBridge.requestMediaPermissions();
              await new Promise((r) => setTimeout(r, 600));
            }
          } catch (_) {}
        }
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
          // Keep remoteStreamRef updated for seamless view switches
          const oldTracks = remoteStreamRef.current.getVideoTracks();
          oldTracks.forEach((t) => remoteStreamRef.current.removeTrack(t));
          remoteStreamRef.current.addTrack(track);

          // Do not set hasRemoteVideo to true here yet. Wait for onplaying.
          track.onmute = () => setHasRemoteVideo(false);
          track.onunmute = () => {
            if (remoteVideoRef.current && remoteVideoRef.current.readyState >= 2) {
              setHasRemoteVideo(true);
            }
          };
          track.onended = () => setHasRemoteVideo(false);

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
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

          // Single, guarded call — builds the Web Audio analyser graph exactly once.
          // The <audio> element (muted={isSpectator}) is the ONLY playback path.
          // connectRemoteAudio only creates an AnalyserNode for the speaking indicator,
          // it does NOT route to audioContext.destination, so there's no double-playback.
          connectRemoteAudio(new MediaStream([track]));
          startCallAudioRecording();
        }
        // Do NOT set status="connected" here. Wait for iceConnectionState to become "connected".
      };

      const checkConnectionState = () => {
        if (!pcRef.current) return;
        const cs = pcRef.current.connectionState;
        const ics = pcRef.current.iceConnectionState;
        console.log(`[WebRTC] Connection: ${cs}, ICE: ${ics}`);

        if (cs === "connected" || ics === "connected" || ics === "completed") {
          // Clear any pending ICE restart timer — we're back!
          if (iceRestartTimerRef.current) {
            clearTimeout(iceRestartTimerRef.current);
            iceRestartTimerRef.current = null;
          }
          setStatus("connected");
          setError("");
          startCallAudioRecording();
        } else if (cs === "disconnected" || ics === "disconnected") {
          // "disconnected" is transient on mobile — give it 3 s to recover
          // before marking as reconnecting and attempting ICE restart.
          if (!iceRestartTimerRef.current) {
            iceRestartTimerRef.current = setTimeout(() => {
              iceRestartTimerRef.current = null;
              if (!pcRef.current) return;
              const curCs = pcRef.current.connectionState;
              const curIcs = pcRef.current.iceConnectionState;
              if (curCs === "disconnected" || curIcs === "disconnected" ||
                  curCs === "failed" || curIcs === "failed") {
                try { pcRef.current.restartIce(); } catch (_) {}
                setStatus("reconnecting");
              }
            }, 3000);
          }
        } else if (cs === "failed" || ics === "failed") {
          if (iceRestartTimerRef.current) {
            clearTimeout(iceRestartTimerRef.current);
            iceRestartTimerRef.current = null;
          }
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
      let pendingOfferData = null; // offer that arrived while signalingState != stable

      const processOffer = async (offerData) => {
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
          peerJoinedRef.current = true;
          setStatus("connected");
        } catch (err) {
          console.error(`[WebRTC] ${role} failed to answer offer:`, err);
          setError("Failed to join video call: " + (err?.message || err));
          setStatus("error");
        }
      };

      const handleIncomingOffer = async (offerData) => {
        if (!offerData || !offerData.sdp) return;
        if (offerData.from === role) return; // this is our own offer echoed back
        if (offerData.sdp === lastProcessedOfferSdp) return; // Ignore duplicate offers from snapshots

        if (pc.signalingState !== "stable") {
          // Queue the offer; process it once we return to stable state
          pendingOfferData = offerData;
          const pollStable = () => {
            if (endedRef.current || !pcRef.current) return;
            if (pcRef.current.signalingState === "stable") {
              const queued = pendingOfferData;
              pendingOfferData = null;
              if (queued && queued.sdp !== lastProcessedOfferSdp) {
                processOffer(queued);
              }
            } else {
              setTimeout(pollStable, 200);
            }
          };
          setTimeout(pollStable, 200);
          return;
        }

        await processOffer(offerData);
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
          peerJoinedRef.current = true;
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

            if (data.status === "ended") {
              handleEnd();
              return;
            }

            // Track callee's live camera and mic state
            if (data.callee_cam_on !== undefined) {
              setPeerCamOn(data.callee_cam_on);
            }
            if (data.callee_mic_on !== undefined) {
              setPeerMicOn(data.callee_mic_on);
            }

            if (data.offer) await handleIncomingOffer(data.offer);   // handles renegotiation rounds initiated by the callee
            if (data.answer) await handleIncomingAnswer(data.answer);

            // Only set reconnecting if peer had previously joined (peerJoinedRef ensures
            // we don't trigger reconnecting from the initial callee_in_room:false state).
            if (data.callee_in_room === true) peerJoinedRef.current = true;
            if (data.callee_in_room === false && peerJoinedRef.current && statusRef.current === "connected") {
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

          if (data.status === "ended") {
            handleEnd();
            return;
          }

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

          // Only set reconnecting if peer had previously joined.
          if (data.caller_in_room === true) peerJoinedRef.current = true;
          if (data.caller_in_room === false && peerJoinedRef.current && statusRef.current === "connected") {
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

  // Ensure video elements have srcObject attached whenever view mode changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current && remoteStreamRef.current.getVideoTracks().length > 0) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      remoteVideoRef.current.play().then(() => setHasRemoteVideo(true)).catch(() => {});
    }
    if (localVideoRef.current && localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [quranOpen, isTeacherMinimized, layoutMode, camOn, status]);

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

  // If teacher minimized the call into floating in-app mini player (Portrait + Movable + 4-Corner Resizable + Pinch-Resizable)
  if (isTeacher && isTeacherMinimized) {
    return createPortal(
      <div
        className={`vc-floating-mini-player vc-floating-portrait-card ${minimizedPip.isDragging ? "vc-pip-dragging" : ""} ${minimizedPip.isResizing ? "vc-pip-resizing" : ""} ${remoteSpeaking ? "vc-speaking" : ""}`}
        style={{
          left: `${minimizedPip.pos.x}px`,
          top: `${minimizedPip.pos.y}px`,
          width: `${minimizedPip.width}px`,
          height: `${minimizedPip.height}px`,
        }}
        {...minimizedPip.bind}
        onClick={() => {
          if (!minimizedPip.didMoveRef.current.didMove) {
            setIsTeacherMinimized(false);
          }
        }}
        role="dialog"
        aria-label="Active Call Floating Widget"
        title="Tap to expand classroom screen · Drag anywhere · Drag corners or pinch to resize"
      >
        <audio ref={remoteAudioRef} autoPlay playsInline muted={isSpectator} />

        {/* Hidden Fallback Video for Native PiP */}
        <video
          ref={pipFallbackVideoRef}
          style={{ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none", zIndex: -100 }}
          autoPlay
          playsInline
          muted
        />

        {/* Video feed or portrait avatar */}
        <video
          ref={remoteVideoRef}
          className={`vc-video-elem vc-mini-card-video ${showRemoteVideo ? "vc-video-visible" : "vc-video-hidden"}`}
          autoPlay
          playsInline
          muted={true}
        />
        {!showRemoteVideo && (
          <div className="vc-avatar-placeholder vc-mini-avatar-portrait">
            <div className={`vc-avatar-circle ${!isTeacher ? "vc-has-logo" : ""} ${remoteSpeaking ? "vc-avatar-pulse-active" : ""}`}>
              {!isTeacher ? (
                <img src="/logo.png" alt="Mauze Tahfeez" className="vc-avatar-logo" />
              ) : (
                <span>{(peerName || "?").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="vc-mini-card-peer">{peerName}</div>
          </div>
        )}

        {/* Top Info Bar: Name & Timer */}
        <div className="vc-mini-card-topbar" onClick={(e) => e.stopPropagation()}>
          <div className="vc-mini-card-info">
            <span className="vc-dot vc-dot-active" style={{ width: 6, height: 6 }} />
            <span className="vc-mini-card-name">{peerName}</span>
          </div>
          <span className="vc-mini-card-time">{statusLabel}</span>
        </div>

        {/* Action Controls */}
        <div
          className="vc-mini-card-controls"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
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
            className={`vc-mini-btn pip ${isNativePipActive ? "active" : ""}`}
            onClick={requestNativePip}
            title={isNativePipActive ? "Exit System PiP" : "Pop out System PiP (Over all apps)"}
          >
            <PictureInPicture2 size={14} />
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

        {/* 4 Corner Drag Resize Handles (Desktop Mouse & Touch Drag) */}
        <div
          className="vc-pip-resize-handle vc-pip-resize-handle-br"
          {...minimizedPip.getResizeHandleProps("br")}
          title="Drag corner to resize (Desktop / Touch)"
        />
        <div
          className="vc-pip-resize-handle vc-pip-resize-handle-bl"
          {...minimizedPip.getResizeHandleProps("bl")}
          title="Drag corner to resize (Desktop / Touch)"
        />
        <div
          className="vc-pip-resize-handle vc-pip-resize-handle-tr"
          {...minimizedPip.getResizeHandleProps("tr")}
          title="Drag corner to resize (Desktop / Touch)"
        />
        <div
          className="vc-pip-resize-handle vc-pip-resize-handle-tl"
          {...minimizedPip.getResizeHandleProps("tl")}
          title="Drag corner to resize (Desktop / Touch)"
        />
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
        <div className={`vc-back-lock-toast ${lockToastShake ? "vc-toast-shake" : ""}`} role="alert">
          <ShieldAlert size={26} className="vc-lock-icon" />
          <div className="vc-lock-text">
            <div className="vc-lock-title">Online Tahfeez Class In Progress</div>
            <div className="vc-lock-desc">
              Mobile & system navigation is locked during class. You must stay in this live session. To exit, tap the <strong>End Call</strong> button below.
            </div>
          </div>
          <button
            type="button"
            className="vc-lock-close-btn"
            onClick={() => setShowBackLockAlert(false)}
            title="Dismiss notification"
          >
            <X size={16} />
          </button>
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
          muted={isSpectator}
        />

        {/* Hidden Fallback Video for Native PiP */}
        <video
          ref={pipFallbackVideoRef}
          style={{ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none", zIndex: -100 }}
          autoPlay
          playsInline
          muted
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
                {isTeacher ? `Student: ${peerName}` : `Muhaffiz: ${peerName}`}
              </span>
            </div>
          </div>
          <div className="vc-topbar-right">
            <span className="vc-status-pill">{statusLabel}</span>

            {/* Teacher-Only Picture-in-Picture & Minimize buttons in header */}
            {isTeacher && (
              <>
                <button
                  type="button"
                  className={`vc-icon-btn vc-pip-header-btn ${isNativePipActive ? "vc-pip-active" : ""}`}
                  onClick={requestNativePip}
                  title={isNativePipActive ? "Exit System Picture-in-Picture" : "System Picture-in-Picture (Floats over all apps / WhatsApp / PDFs)"}
                >
                  <PictureInPicture2 size={14} />
                  <span>{isNativePipActive ? "PiP Active" : "PiP"}</span>
                </button>
                <button
                  type="button"
                  className="vc-icon-btn vc-pip-header-btn"
                  onClick={() => setIsTeacherMinimized(true)}
                  title="Minimize to In-App Floating Card"
                >
                  <Minimize2 size={14} />
                  <span>Minimize</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main Viewport */}
        {quranOpen ? (
          /* ============================================================
             FULL QURAN PAGE VIEW + FLOATING MOVABLE PORTRAIT PIP STUDENT SCREEN
             ============================================================ */
          <div className="vc-viewport vc-quran-viewport">
            {/* Screen 1: Full Quran Page Reader (100% full view) */}
            <div className="vc-quran-box full">
              <MisriQuranViewer
                currentPage={quranPage}
                onPageChange={setQuranPage}
                compact={false}
              />
            </div>

            {/* Screen 2: Floating Movable & 4-Corner Resizable Portrait Student PiP */}
            <div
              className={`vc-floating-student-pip ${quranPip.isDragging ? "vc-pip-dragging" : ""} ${quranPip.isResizing ? "vc-pip-resizing" : ""} ${remoteSpeaking ? "vc-speaking" : ""}`}
              style={{
                left: `${quranPip.pos.x}px`,
                top: `${quranPip.pos.y}px`,
                width: `${quranPip.width}px`,
                height: `${quranPip.height}px`,
              }}
              {...quranPip.bind}
              title="Drag anywhere · Drag corners or pinch to resize"
            >
              <video
                ref={remoteVideoRef}
                className={`vc-video-elem ${showRemoteVideo ? "vc-video-visible" : "vc-video-hidden"}`}
                autoPlay
                playsInline
                muted={true}
              />
              {!showRemoteVideo && (
                <div className="vc-avatar-placeholder vc-pip-avatar">
                  <div className={`vc-avatar-circle ${!isTeacher ? "vc-has-logo" : ""} ${remoteSpeaking ? "vc-avatar-pulse-active" : ""}`}>
                    {!isTeacher ? (
                      <img src="/logo.png" alt="Mauze Tahfeez" className="vc-avatar-logo" />
                    ) : (
                      <span>{(peerName || "?").slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="vc-pip-name">{peerName}</div>
                  <div className="vc-pip-status-sub">
                    {status === "connected" ? "Audio Live" : statusLabel}
                  </div>
                </div>
              )}

              {/* Participant Tag / Info */}
              <div className="vc-pip-tag">
                <div className="vc-tag-user">
                  {isTeacher ? <User size={11} /> : <GraduationCap size={11} />}
                  <span title={peerName}>{peerName} {isTeacher ? "(Student)" : "(Muhaffiz)"}</span>
                </div>
                {!peerMicOn && <span className="vc-muted-tag">Muted</span>}
                {remoteSpeaking && peerMicOn && <span className="vc-speaking-tag">Speaking…</span>}
              </div>

              {/* Embedded Mini Cam Preview */}
              {!isSpectator && (
                <div className={`vc-pip-teacher-thumb ${localSpeaking ? "vc-speaking" : ""}`}>
                  <video
                    ref={localVideoRef}
                    className={`vc-video-elem vc-local-elem ${camOn ? "vc-video-visible" : "vc-video-hidden"}`}
                    autoPlay
                    playsInline
                    muted
                  />
                  {!camOn && (
                    <div className="vc-pip-teacher-off">
                      {isTeacher ? (
                        <img src="/logo.png" alt="Mauze Tahfeez" />
                      ) : (
                        <span>{(myName || "Y").slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 4 Corner Drag Resize Handles (Desktop Mouse & Touch Drag) */}
              <div
                className="vc-pip-resize-handle vc-pip-resize-handle-br"
                {...quranPip.getResizeHandleProps("br")}
                title="Drag corner to resize (Desktop / Touch)"
              />
              <div
                className="vc-pip-resize-handle vc-pip-resize-handle-bl"
                {...quranPip.getResizeHandleProps("bl")}
                title="Drag corner to resize (Desktop / Touch)"
              />
              <div
                className="vc-pip-resize-handle vc-pip-resize-handle-tr"
                {...quranPip.getResizeHandleProps("tr")}
                title="Drag corner to resize (Desktop / Touch)"
              />
              <div
                className="vc-pip-resize-handle vc-pip-resize-handle-tl"
                {...quranPip.getResizeHandleProps("tl")}
                title="Drag corner to resize (Desktop / Touch)"
              />
            </div>
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
                  <div className={`vc-avatar-circle ${!isTeacher ? "vc-has-logo" : ""} ${remoteSpeaking ? "vc-avatar-pulse-active" : ""}`}>
                    {!isTeacher ? (
                      <img src="/logo.png" alt="Mauze Tahfeez" className="vc-avatar-logo" />
                    ) : (
                      <span>{(peerName || "?").slice(0, 1).toUpperCase()}</span>
                    )}
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
                  <span title={peerName}>{peerName} {isTeacher ? "(Student)" : "(Muhaffiz)"}</span>
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
                    <div className={`vc-avatar-circle local ${isTeacher ? "vc-has-logo" : ""} ${localSpeaking ? "vc-avatar-pulse-active" : ""}`}>
                      {isTeacher ? (
                        <img src="/logo.png" alt="Mauze Tahfeez" className="vc-avatar-logo" />
                      ) : (
                        <span>{(myName || "Y").slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="vc-peer-name">{myName} (You)</div>
                    <div className="vc-status-sub">Camera Off</div>
                  </div>
                )}
                <div className="vc-stream-tag">
                  <div className="vc-tag-user">
                    {isTeacher ? <GraduationCap size={13} /> : <User size={13} />}
                    <span title={myName}>{myName} (You)</span>
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

          {/* Teacher-Only System Picture-in-Picture Button */}
          {isTeacher && (
            <button
              type="button"
              className={`vc-btn vc-btn-pip ${isNativePipActive ? "vc-btn-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                requestNativePip();
              }}
              title={isNativePipActive ? "Exit System Picture-in-Picture" : "System Picture-in-Picture (Floats over all apps / WhatsApp / PDFs)"}
              aria-label="Picture-in-Picture"
            >
              <PictureInPicture2 size={22} />
            </button>
          )}

          {/* Teacher-Only In-App Minimize Button */}
          {isTeacher && (
            <button
              type="button"
              className="vc-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsTeacherMinimized(true);
              }}
              title="Minimize to In-App Floating Card"
              aria-label="Minimize Call"
            >
              <Minimize2 size={22} />
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