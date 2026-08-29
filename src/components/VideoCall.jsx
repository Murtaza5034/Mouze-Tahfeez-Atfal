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
  ChevronDown
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

  // NOTE: openrelay.metered.ca is a free, best-effort TURN service and is
  // known to be unreliable / go offline. If two peers are on different
  // networks (not the same LAN/WiFi) and this is the only TURN server
  // available, ICE can fail to connect entirely, which looks exactly like
  // "can't see or hear each other" even though the signaling/negotiation
  // code is correct. If issues persist after the fixes below, check the
  // console for the logged ICE candidate types (look for "relay" candidates)
  // and consider a paid/reliable TURN provider (Twilio, Xirsys, Cloudflare
  // Calls, metered.ca paid tier, etc).
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
// FIX: the old version matched ANY fmtp line containing the substring "111",
// which can accidentally match unrelated codec lines (e.g. a video codec's
// profile-level-id hex string) and corrupt that line, breaking negotiation
// for that media type. This version finds Opus's *actual* dynamic payload
// type from its rtpmap line first, then only touches that specific fmtp line.
function tuneSdpForVocalClarity(sdp) {
  if (!sdp) return sdp;

  const rtpmapMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/\d+/i);
  if (!rtpmapMatch) return sdp; // Opus not present in this SDP, leave it alone

  const opusPt = rtpmapMatch[1];
  const fmtpRegex = new RegExp(`(a=fmtp:${opusPt} [^\\r\\n]*)`, "g");

  return sdp.replace(fmtpRegex, (line) => {
    if (/maxaveragebitrate=/.test(line)) return line; // already tuned, don't double-append
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
  const audioGraphReadyRef = useRef(false); // guards against building the remote audio graph more than once
  const localAnalyserReadyRef = useRef(false);
  const initialNegotiationDoneRef = useRef(false); // gates onnegotiationneeded until the first offer/answer round is done

  // Refs that always mirror the latest state, so async callbacks / Firestore
  // listeners created in effects that don't re-run never read stale values.
  const statusRef = useRef("initializing");
  const camOnRef = useRef(true);
  const micOnRef = useRef(true);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerCamOn, setPeerCamOn] = useState(true);
  const [peerMicOn, setPeerMicOn] = useState(true);
  const [facingMode, setFacingMode] = useState("user"); // "user" | "environment"
  const [layoutMode, setLayoutMode] = useState("grid"); // "grid" (side-by-side) | "pip" (focus)
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioOutputMode, setAudioOutputMode] = useState("speaker"); // "speaker" | "headphones"
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState("");
  const [showAudioDeviceMenu, setShowAudioDeviceMenu] = useState(false);
  const [volumeBoost, setVolumeBoost] = useState(false);
  const [status, setStatus] = useState("initializing"); // "initializing" | "calling" | "connected" | "reconnecting" | "error"
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

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

    try {
      const ctx = ensureAudioContext();
      if (!ctx) throw new Error("Web Audio API unavailable in this browser");

      const remoteSrc = ctx.createMediaStreamSource(remoteStream);
      const gainNode = ctx.createGain();
      gainNode.gain.value = getTargetGain();
      gainNodeRef.current = gainNode;

      const remoteAnalyser = ctx.createAnalyser();
      remoteAnalyser.fftSize = 256;
      remoteAnalyser.smoothingTimeConstant = 0.4;

      remoteSrc.connect(gainNode);
      gainNode.connect(remoteAnalyser);

      // Spectators should never hear audio out loud.
      if (!isSpectator) {
        gainNode.connect(ctx.destination);
      }
      remoteAnalyserRef.current = remoteAnalyser;

      // Web Audio is now the sole playback path — mute the plain element so
      // we don't hear (or fail to hear, due to phase issues) the same track
      // twice.
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = true;
        remoteAudioRef.current.play().catch(() => { });
      }

      setAudioBlocked(ctx.state === "suspended");
      ctx.onstatechange = () => {
        setAudioBlocked(ctx.state === "suspended");
      };
    } catch (e) {
      console.warn("[Audio] Web Audio routing failed, falling back to plain <audio> playback:", e);
      // Fallback: let the element itself play the audio directly.
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = isSpectator;
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.play().then(() => {
          setAudioBlocked(false);
        }).catch(() => {
          setAudioBlocked(true);
        });
      }
    }
  }, [ensureAudioContext, getTargetGain, isSpectator]);

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
  const toggleFullscreen = () => {
    const elem = document.querySelector(".vc-overlay");
    if (!elem) return;

    if (!document.fullscreenElement) {
      elem.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
    }
  };

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
          setHasRemoteVideo(true);
          track.onmute = () => setHasRemoteVideo(false);
          track.onunmute = () => setHasRemoteVideo(true);
          track.onended = () => setHasRemoteVideo(false);

          if (remoteVideoRef.current) {
            const vidStream = new MediaStream([track]);
            remoteVideoRef.current.srcObject = vidStream;
            remoteVideoRef.current.onloadedmetadata = () => {
              remoteVideoRef.current.play().catch(() => { });
              setHasRemoteVideo(true);
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
              sessionId: currentSessionId,
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
            if (data && data.senderRole !== role && data.candidate && (!data.sessionId || data.sessionId === currentSessionId)) {
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

      const handleIncomingOffer = async (offerData) => {
        if (!offerData || !offerData.sdp) return;
        if (offerData.from === role) return; // this is our own offer echoed back
        if (pc.signalingState !== "stable") return;

        try {
          console.log(`[WebRTC] ${role} applying offer`);
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

        try {
          console.log(`[WebRTC] ${role} applying answer`);
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

  const isTeacher = myRole === "teacher";
  const showRemoteVideo = peerCamOn && hasRemoteVideo && status === "connected";

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
      <div className={`vc-stage ${layoutMode === "grid" ? "vc-layout-grid" : "vc-layout-pip"}`}>
        {/* Dedicated Audio Element for Remote Sound (muted once the Web Audio graph takes over — see connectRemoteAudio) */}
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
                {isSpectator ? "Auditing Class (Spectator)" : "Live Tahfeez Classroom"}
              </span>
              <span className="vc-role-badge">
                {isTeacher ? "👨‍🏫 Muhaffiz Classroom" : "👦 Student Session"}
              </span>
            </div>
          </div>
          <div className="vc-topbar-right">
            <span className="vc-status-pill">{statusLabel}</span>

            {/* Audio Output Selector (Speaker vs Headphones) */}
            <div className="vc-audio-output-wrapper" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`vc-icon-btn ${audioOutputMode === "headphones" ? "active" : ""}`}
                onClick={() => setShowAudioDeviceMenu(!showAudioDeviceMenu)}
                title="Choose Audio Output (Speaker / Headphones)"
              >
                {audioOutputMode === "headphones" ? <Headphones size={15} /> : <Volume2 size={15} />}
                <span>{audioOutputMode === "headphones" ? "Headphones" : "Speaker"}</span>
                <ChevronDown size={12} style={{ opacity: 0.7 }} />
              </button>

              {showAudioDeviceMenu && (
                <div className="vc-audio-device-menu">
                  <div className="vc-menu-header">Audio Output Mode</div>
                  <button
                    type="button"
                    className={`vc-menu-item ${audioOutputMode === "speaker" ? "active" : ""}`}
                    onClick={() => handleSelectAudioMode("speaker")}
                  >
                    <Volume2 size={16} />
                    <div className="vc-menu-text">
                      <span className="vc-menu-title">Loudspeaker</span>
                      <span className="vc-menu-desc">Room audio & boosted clarity</span>
                    </div>
                    {audioOutputMode === "speaker" && <span className="vc-check">✓</span>}
                  </button>
                  <button
                    type="button"
                    className={`vc-menu-item ${audioOutputMode === "headphones" ? "active" : ""}`}
                    onClick={() => handleSelectAudioMode("headphones")}
                  >
                    <Headphones size={16} />
                    <div className="vc-menu-text">
                      <span className="vc-menu-title">Headphones / Earphones</span>
                      <span className="vc-menu-desc">Standard gain, zero acoustic echo</span>
                    </div>
                    {audioOutputMode === "headphones" && <span className="vc-check">✓</span>}
                  </button>

                  {/* Volume Boost Option for Speaker Mode */}
                  {audioOutputMode === "speaker" && (
                    <button
                      type="button"
                      className={`vc-menu-item ${volumeBoost ? "active" : ""}`}
                      onClick={() => setVolumeBoost(!volumeBoost)}
                    >
                      <Volume2 size={16} />
                      <div className="vc-menu-text">
                        <span className="vc-menu-title">2x Volume Boost</span>
                        <span className="vc-menu-desc">{volumeBoost ? "Active (+200% loud)" : "Normal (+140% loud)"}</span>
                      </div>
                      {volumeBoost && <span className="vc-check">✓</span>}
                    </button>
                  )}

                  {/* Specific Hardware Audio Devices (if available) */}
                  {audioOutputs.length > 1 && (
                    <>
                      <div className="vc-menu-divider" />
                      <div className="vc-menu-header">Hardware Devices</div>
                      {audioOutputs.map((device, idx) => (
                        <button
                          key={device.deviceId || idx}
                          type="button"
                          className={`vc-menu-item ${selectedAudioDeviceId === device.deviceId ? "active" : ""}`}
                          onClick={() => handleSelectSpecificDevice(device.deviceId)}
                        >
                          <Volume2 size={14} />
                          <div className="vc-menu-text">
                            <span className="vc-menu-title">{device.label || `Output Device ${idx + 1}`}</span>
                          </div>
                          {selectedAudioDeviceId === device.deviceId && <span className="vc-check">✓</span>}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Layout Mode Button */}
            <button
              type="button"
              className="vc-icon-btn"
              onClick={(e) => { e.stopPropagation(); setLayoutMode(layoutMode === "grid" ? "pip" : "grid"); }}
              title={layoutMode === "grid" ? "Switch to Focus/PiP View" : "Switch to Side-by-Side Grid"}
            >
              <LayoutGrid size={15} />
              <span>{layoutMode === "grid" ? "Focus" : "Dual Grid"}</span>
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              className="vc-icon-btn"
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>

        {/* Main Video Viewport (Dual Grid or Focus PiP) */}
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

          {/* Local Video Container (Side-by-Side in Grid, Floating in PiP) */}
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

        {/* Audio Unblock Banner if Browser Blocked Sound */}
        {audioBlocked && (
          <div className="vc-audio-blocked-banner" onClick={handleGlobalAudioUnlock}>
            <VolumeX size={18} />
            <span>Tap here to enable speaker audio</span>
          </div>
        )}

        {/* Bottom Control Bar */}
        <div className="vc-controls" onClick={(e) => e.stopPropagation()}>
          {!isSpectator && (
            <>
              {/* Mic Toggle */}
              <button
                type="button"
                className={`vc-btn ${micOn ? "vc-btn-active" : "vc-btn-off"}`}
                onClick={toggleMic}
                title={micOn ? "Mute Microphone" : "Unmute Microphone"}
              >
                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                <span>{micOn ? "Mute" : "Unmute"}</span>
              </button>

              {/* Camera Toggle */}
              <button
                type="button"
                className={`vc-btn ${camOn ? "vc-btn-active" : "vc-btn-off"}`}
                onClick={toggleCam}
                title={camOn ? "Turn Camera Off" : "Turn Camera On"}
              >
                {camOn ? <Video size={20} /> : <VideoOff size={20} />}
                <span>{camOn ? "Stop Cam" : "Start Cam"}</span>
              </button>

              {/* Switch Camera (Front/Rear/Mushaf) */}
              {hasMultipleCameras && camOn && (
                <button
                  type="button"
                  className="vc-btn"
                  onClick={switchCamera}
                  title="Flip Camera (Front / Mushaf)"
                >
                  <SwitchCamera size={20} />
                  <span>Flip Cam</span>
                </button>
              )}
            </>
          )}

          {/* End Call Button */}
          <button
            type="button"
            className="vc-btn vc-btn-end"
            onClick={handleEnd}
            title={isSpectator ? "Leave Classroom" : "End Call"}
          >
            <Phone size={22} style={{ transform: "rotate(135deg)" }} />
            <span>{isSpectator ? "Leave" : "End Call"}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}