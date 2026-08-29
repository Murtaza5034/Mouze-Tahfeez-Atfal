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
  SwitchCamera,
  LayoutGrid,
  Maximize2,
  Minimize2,
  User,
  GraduationCap
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
        "turns:openrelay.metered.ca:443?transport=tcp"
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

// Enhance SDP for crystal clear, high-bitrate Opus vocal recitation
function tuneSdpForVocalClarity(sdp) {
  if (!sdp) return sdp;
  return sdp.replace(
    /(a=fmtp:\d+ .*?)\r\n/g,
    (match) => {
      if (match.includes("opus") || match.includes("111")) {
        return match.trim() + ";maxaveragebitrate=64000;stereo=0;sprop-stereo=0;useinbandfec=1;minptime=10;cng=off\r\n";
      }
      return match;
    }
  );
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

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerCamOn, setPeerCamOn] = useState(true);
  const [peerMicOn, setPeerMicOn] = useState(true);
  const [facingMode, setFacingMode] = useState("user"); // "user" | "environment"
  const [layoutMode, setLayoutMode] = useState("grid"); // "grid" (side-by-side) | "pip" (focus)
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [volumeBoost, setVolumeBoost] = useState(false);
  const [status, setStatus] = useState("initializing"); // "initializing" | "calling" | "connected" | "reconnecting" | "error"
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const trackUnsub = useCallback((unsub) => {
    if (typeof unsub === "function") signalUnsubsRef.current.push(unsub);
  }, []);

  // Check if device has multiple video cameras (e.g. mobile front & rear)
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        if (videoInputs.length > 1) {
          setHasMultipleCameras(true);
        }
      }).catch(() => {});
    }
  }, []);

  // Setup Web Audio API direct destination output & volume analyzers
  const setupAudioMonitoring = useCallback((localStream, remoteStream) => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      // Local microphone volume analysis
      if (localStream && localStream.getAudioTracks().length > 0) {
        try {
          const localSrc = ctx.createMediaStreamSource(localStream);
          const localAnalyser = ctx.createAnalyser();
          localAnalyser.fftSize = 256;
          localAnalyser.smoothingTimeConstant = 0.4;
          localSrc.connect(localAnalyser);
          localAnalyserRef.current = localAnalyser;
        } catch (_) {}
      }

      // Remote incoming sound: Direct route to hardware speaker destination via GainNode
      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        try {
          const remoteSrc = ctx.createMediaStreamSource(remoteStream);
          const gainNode = ctx.createGain();
          gainNode.gain.value = volumeBoost ? 2.0 : 1.4;
          gainNodeRef.current = gainNode;

          const remoteAnalyser = ctx.createAnalyser();
          remoteAnalyser.fftSize = 256;
          remoteAnalyser.smoothingTimeConstant = 0.4;

          remoteSrc.connect(gainNode);
          gainNode.connect(remoteAnalyser);

          // Connect directly to hardware audio output if not spectator
          if (!isSpectator) {
            gainNode.connect(ctx.destination);
          }

          remoteAnalyserRef.current = remoteAnalyser;
        } catch (e) {
          console.warn("Direct WebAudio speaker output routing note:", e);
        }
      }

      const localBuf = new Uint8Array(128);
      const remoteBuf = new Uint8Array(128);

      const checkVolume = () => {
        if (endedRef.current) return;

        if (localAnalyserRef.current) {
          localAnalyserRef.current.getByteFrequencyData(localBuf);
          let sum = 0;
          for (let i = 0; i < localBuf.length; i++) sum += localBuf[i];
          const avg = sum / localBuf.length;
          setLocalSpeaking(avg > 14);
        }

        if (remoteAnalyserRef.current) {
          remoteAnalyserRef.current.getByteFrequencyData(remoteBuf);
          let sum = 0;
          for (let i = 0; i < remoteBuf.length; i++) sum += remoteBuf[i];
          const avg = sum / remoteBuf.length;
          setRemoteSpeaking(avg > 14);
        }

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn("Audio monitoring error:", e);
    }
  }, [isSpectator, volumeBoost]);

  // Adjust volume gain node when boost is toggled
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volumeBoost ? 2.0 : 1.4;
    }
  }, [volumeBoost]);

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
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    } catch (_) {}

    try {
      const unsubs = signalUnsubsRef.current;
      signalUnsubsRef.current = [];
      for (const fn of unsubs) {
        try { fn(); } catch (_) {}
      }
    } catch (_) {}

    try {
      if (pcRef.current) {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
        pcRef.current = null;
      }
    } catch (_) {}

    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          try { t.stop(); } catch (_) {}
        });
        localStreamRef.current = null;
      }
    } catch (_) {}

    try {
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((t) => {
          try { t.stop(); } catch (_) {}
        });
      }
    } catch (_) {}

    try {
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    } catch (_) {}

    if (roomId) {
      try {
        const roomRef = doc(db, SIGNAL_PATH, roomId);
        const fieldName = role === "caller" ? "caller_in_room" : "callee_in_room";
        updateDoc(roomRef, { [fieldName]: false }).catch(() => {});
      } catch (_) {}
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
        updateDoc(roomRef, { [fieldName]: next }).catch(() => {});
      } catch (_) {}
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
          updateDoc(roomRef, { [fieldName]: next }).catch(() => {});
        } catch (_) {}
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
            pc.addTrack(videoTrack, stream || videoStream);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([videoTrack]);
          try { await localVideoRef.current.play(); } catch (_) {}
        }
        setCamOn(true);

        if (roomId) {
          try {
            const roomRef = doc(db, SIGNAL_PATH, roomId);
            const fieldName = role === "caller" ? "caller_cam_on" : "callee_cam_on";
            updateDoc(roomRef, { [fieldName]: true }).catch(() => {});
          } catch (_) {}
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
          try { await localVideoRef.current.play(); } catch (_) {}
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
      audioContextRef.current.resume().catch(() => {});
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().then(() => {
        setAudioBlocked(false);
      }).catch(() => {});
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.play().then(() => {
        setHasRemoteVideo(true);
      }).catch(() => {});
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    const elem = document.querySelector(".vc-overlay");
    if (!elem) return;

    if (!document.fullscreenElement) {
      elem.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
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
        if (localVideoRef.current && stream && stream.getVideoTracks().length > 0) {
          localVideoRef.current.srcObject = new MediaStream(stream.getVideoTracks());
          try { await localVideoRef.current.play(); } catch (_) {}
        }
      } else {
        setCamOn(false);
        setMicOn(false);
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
          } catch (_) {}
        });
      }

      // Bidirectional transceivers
      const hasAudio = stream && stream.getAudioTracks().length > 0;
      const hasVideo = stream && stream.getVideoTracks().length > 0;
      if (!hasAudio && pc.addTransceiver) {
        try { pc.addTransceiver("audio", { direction: "sendrecv" }); } catch (_) {}
      }
      if (!hasVideo && pc.addTransceiver) {
        try { pc.addTransceiver("video", { direction: "sendrecv" }); } catch (_) {}
      }

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
              remoteVideoRef.current.play().catch(() => {});
              setHasRemoteVideo(true);
            };
            remoteVideoRef.current.onplaying = () => setHasRemoteVideo(true);
            remoteVideoRef.current.play().catch(() => {});
          }
        }

        if (track.kind === "audio") {
          setHasRemoteAudio(true);
          track.onmute = () => setHasRemoteAudio(false);
          track.onunmute = () => setHasRemoteAudio(true);

          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = new MediaStream([track]);
            remoteAudioRef.current.muted = isSpectator ? true : false;
            remoteAudioRef.current.volume = 1.0;
            remoteAudioRef.current.play().then(() => {
              setAudioBlocked(false);
            }).catch((err) => {
              console.warn("[WebRTC] Remote audio autoplay prompt:", err);
              setAudioBlocked(true);
            });
          }
        }

        // Connect WebAudio pipeline & volume visualizers
        setupAudioMonitoring(localStreamRef.current, new MediaStream(pc.getReceivers().map(r => r.track).filter(t => t.kind === "audio")));
        setStatus("connected");
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
          } catch (_) {}
          setStatus("reconnecting");
        }
      };

      pc.onconnectionstatechange = checkConnectionState;
      pc.oniceconnectionstatechange = checkConnectionState;

      // 4. Signaling setup
      const roomRef = doc(db, SIGNAL_PATH, roomId);
      const candidatesCol = collection(db, SIGNAL_PATH, roomId, "candidates");
      const processedCandidateKeys = new Set();
      const pendingRemoteCandidates = [];

      pc.onicecandidate = async (ev) => {
        if (ev.candidate) {
          const candJson = ev.candidate.toJSON();
          if (!candJson || !candJson.candidate) return;

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
      });
      trackUnsub(unsubCandidates);

      if (role === "caller") {
        try {
          getDocs(candidatesCol).then((oldCands) => {
            oldCands.forEach((docSnap) => {
              deleteDoc(docSnap.ref).catch(() => {});
            });
          }).catch(() => {});

          const rawOffer = await pc.createOffer();
          const tunedOffer = new RTCSessionDescription({
            type: rawOffer.type,
            sdp: tuneSdpForVocalClarity(rawOffer.sdp)
          });
          await pc.setLocalDescription(tunedOffer);

          await setDoc(roomRef, {
            sessionId: currentSessionId,
            offer: { type: tunedOffer.type, sdp: tunedOffer.sdp },
            answer: null,
            caller: { name: myName, role: myRole },
            caller_in_room: true,
            caller_cam_on: camOn,
            caller_mic_on: micOn,
            callee_in_room: false,
            started_at: Date.now(),
            status: "calling",
          });

          const unsubRoom = onSnapshot(roomRef, async (snapshot) => {
            if (endedRef.current || !snapshot.exists()) return;
            const data = snapshot.data();
            if (!data) return;

            // Track callee's live camera and mic state
            if (data.callee_cam_on !== undefined) {
              setPeerCamOn(data.callee_cam_on);
            }
            if (data.callee_mic_on !== undefined) {
              setPeerMicOn(data.callee_mic_on);
            }

            if (data.answer && data.sessionId === currentSessionId && !pc.remoteDescription) {
              try {
                console.log("[WebRTC] Caller applying answer");
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                await flushRemoteCandidates();
                setStatus("connected");
              } catch (err) {
                console.error("[WebRTC] setRemoteDescription failed on caller:", err);
              }
            }

            if (data.callee_in_room === false && status === "connected") {
              setStatus("reconnecting");
            }
          });
          trackUnsub(unsubRoom);

          setStatus("calling");
        } catch (e) {
          setError("Failed to start call: " + (e?.message || e));
          setStatus("error");
        }
      } else {
        // Callee
        let answerCreated = false;

        const handleOffer = async (offerData) => {
          if (answerCreated || !offerData || !offerData.sdp) return;
          answerCreated = true;
          try {
            console.log("[WebRTC] Callee applying offer");
            await pc.setRemoteDescription(new RTCSessionDescription(offerData));
            await flushRemoteCandidates();

            const rawAnswer = await pc.createAnswer();
            const tunedAnswer = new RTCSessionDescription({
              type: rawAnswer.type,
              sdp: tuneSdpForVocalClarity(rawAnswer.sdp)
            });
            await pc.setLocalDescription(tunedAnswer);

            await updateDoc(roomRef, {
              answer: { type: tunedAnswer.type, sdp: tunedAnswer.sdp },
              callee: { name: myName, role: myRole },
              callee_in_room: true,
              callee_cam_on: camOn,
              callee_mic_on: micOn,
              status: "connected",
            });

            setStatus("connected");
          } catch (err) {
            console.error("[WebRTC] Error creating answer on callee:", err);
            setError("Failed to join video call: " + (err.message || err));
            setStatus("error");
          }
        };

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

          if (data.offer && !answerCreated) {
            await handleOffer(data.offer);
          }

          if (data.caller_in_room === false && status === "connected") {
            setStatus("reconnecting");
          }
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
      onClick={handleGlobalAudioUnlock}
    >
      <div className={`vc-stage ${layoutMode === "grid" ? "vc-layout-grid" : "vc-layout-pip"}`}>
        {/* Dedicated Audio Element for Remote Sound */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          muted={isSpectator}
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
            <button
              type="button"
              className={`vc-icon-btn ${volumeBoost ? "active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setVolumeBoost(!volumeBoost); }}
              title={volumeBoost ? "Volume Boost: +200% (Active)" : "Volume Boost: 140% (Click to boost)"}
            >
              <Volume2 size={16} />
              <span>{volumeBoost ? "Boost 2x" : "Speaker"}</span>
            </button>
            <button
              type="button"
              className="vc-icon-btn"
              onClick={(e) => { e.stopPropagation(); setLayoutMode(layoutMode === "grid" ? "pip" : "grid"); }}
              title={layoutMode === "grid" ? "Switch to Focus/PiP View" : "Switch to Side-by-Side Grid"}
            >
              <LayoutGrid size={16} />
              <span>{layoutMode === "grid" ? "Focus" : "Dual Grid"}</span>
            </button>
            <button
              type="button"
              className="vc-icon-btn"
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
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
