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
import { Mic, MicOff, Video, VideoOff, Phone } from "lucide-react";

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
    // Metered OpenRelay public WebRTC STUN/TURN relays for reliable NAT/CGNAT traversal on 4G/5G and WiFi
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

export default function VideoCall({ call, onClose }) {
  const {
    roomId,
    role, // "caller" | "callee"
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
  const remoteStreamRef = useRef(null);
  const signalUnsubsRef = useRef([]);
  const endedRef = useRef(false);
  const sessionIdRef = useRef(Date.now().toString());

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [status, setStatus] = useState("initializing"); // "initializing" | "calling" | "connected" | "reconnecting" | "error"
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);

  const trackUnsub = useCallback((unsub) => {
    if (typeof unsub === "function") signalUnsubsRef.current.push(unsub);
  }, []);

  // ----- cleanup helper for local device only -----
  const stopLocal = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;

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
        remoteStreamRef.current = null;
      }
    } catch (_) {}

    try {
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    } catch (_) {}

    // Mark self inactive in signaling so the other user sees reconnection status but stays in room
    if (roomId) {
      try {
        const roomRef = doc(db, SIGNAL_PATH, roomId);
        const fieldName = role === "caller" ? "caller_in_room" : "callee_in_room";
        updateDoc(roomRef, { [fieldName]: false }).catch(() => {});
      } catch (_) {}
    }
  }, [roomId, role, SIGNAL_PATH]);

  // ----- user clicks End button -----
  const handleEnd = useCallback(() => {
    stopLocal();
    if (onClose) onClose();
  }, [stopLocal, onClose]);

  // ----- esc to end -----
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") handleEnd();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleEnd]);

  // ----- unmount safety -----
  useEffect(() => {
    return () => {
      stopLocal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- timer: ONLY runs when both are actively connected -----
  useEffect(() => {
    if (status !== "connected") return;
    const t = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  // ----- toggle mic -----
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOn;
    stream.getAudioTracks().forEach((t) => { t.enabled = next; });
    setMicOn(next);
  }, [micOn]);

  // ----- toggle cam -----
  const toggleCam = useCallback(async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;

    if (stream && stream.getVideoTracks().length > 0) {
      const next = !camOn;
      stream.getVideoTracks().forEach((t) => { t.enabled = next; });
      setCamOn(next);
      return;
    }

    // Camera not yet acquired - request camera
    try {
      let videoStream = null;
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } }
        });
      } catch (_) {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      const videoTrack = videoStream.getVideoTracks()[0];
      if (videoTrack) {
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
          localVideoRef.current.srcObject = stream || videoStream;
          try { await localVideoRef.current.play(); } catch (_) {}
        }
        setCamOn(true);
      }
    } catch (e) {
      console.warn("Unable to enable camera:", e);
    }
  }, [camOn]);

  // ----- main effect: start and maintain the WebRTC call -----
  useEffect(() => {
    if (!roomId || !role) return;

    let cancelled = false;
    const currentSessionId = sessionIdRef.current;

    const start = async () => {
      setStatus("initializing");
      setError("");

      // 1. Acquire local media (cross-platform with robust fallback)
      let stream = null;
      if (!isSpectator) {
        try {
          try {
            // First attempt: Standard video + echo-cancelled audio
            stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 640 }, height: { ideal: 480 } },
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            setCamOn(true);
            setMicOn(true);
          } catch (vidErr) {
            console.warn("Attempt 1 failed, trying generic video/audio:", vidErr);
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              setCamOn(true);
              setMicOn(true);
            } catch (vidErr2) {
              console.warn("Camera not available, trying audio-only and separate video:", vidErr2);
              let audioStream = null;
              let videoStream = null;
              try {
                audioStream = await navigator.mediaDevices.getUserMedia({
                  audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
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
                videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
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
                // If neither is detected, create silent stream for viewing
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
          console.warn("Media permissions/devices fallback active:", mediaErr);
          stream = new MediaStream();
          setCamOn(false);
          setMicOn(false);
        }

        if (cancelled) {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Enable all acquired tracks
        if (stream) {
          stream.getAudioTracks().forEach((t) => { t.enabled = true; });
          stream.getVideoTracks().forEach((t) => { t.enabled = true; });
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && stream) {
          localVideoRef.current.srcObject = stream;
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
          try { pc.addTrack(t, stream); } catch (_) {}
        });
      }

      // Ensure transceivers exist in both directions so audio & video can be received
      if (pc.addTransceiver) {
        const hasAudio = stream && stream.getAudioTracks().length > 0;
        const hasVideo = stream && stream.getVideoTracks().length > 0;
        if (!hasAudio) {
          try { pc.addTransceiver("audio", { direction: "recvonly" }); } catch (_) {}
        }
        if (!hasVideo) {
          try { pc.addTransceiver("video", { direction: "recvonly" }); } catch (_) {}
        }
      }

      // 3. Remote track handler using unified MediaStream
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }

      pc.ontrack = (ev) => {
        console.log("[WebRTC] Remote track received:", ev.track.kind, ev.track.id);

        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }

        // Add track if not already in remote stream
        const currentTracks = remoteStreamRef.current.getTracks();
        if (!currentTracks.some((t) => t.id === ev.track.id)) {
          remoteStreamRef.current.addTrack(ev.track);
        }

        // Attach remoteStream to video element (plays video)
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }

        // Attach remoteStream to audio element (plays crystal-clear unmuted audio)
        if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
          remoteAudioRef.current.srcObject = remoteStreamRef.current;
        }

        if (remoteVideoRef.current) {
          remoteVideoRef.current.play().catch((err) => {
            console.warn("[WebRTC] Remote video play note:", err);
          });
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.play().catch((err) => {
            console.warn("[WebRTC] Remote audio play note:", err);
          });
        }

        setStatus("connected");
      };

      const checkConnectionState = () => {
        if (!pcRef.current) return;
        const cs = pcRef.current.connectionState;
        const ics = pcRef.current.iceConnectionState;
        console.log(`[WebRTC] Connection state: ${cs}, ICE state: ${ics}`);
        if (cs === "connected" || ics === "connected" || ics === "completed") {
          setStatus("connected");
          setError("");
        } else if (cs === "disconnected" || ics === "disconnected") {
          console.warn("[WebRTC] Temporary disconnect, waiting to reconnect...");
          setStatus("reconnecting");
        } else if (cs === "failed" || ics === "failed") {
          console.warn("[WebRTC] ICE failed, attempting restart...");
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

      // When local ICE candidate is found
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
            console.warn("[WebRTC] Error writing ICE candidate:", err);
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
          console.warn("[WebRTC] addIceCandidate error:", err);
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
            console.warn("[WebRTC] flush ICE candidate error:", err);
          }
        }
      };

      // Listen for remote candidates from subcollection
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
          // Clean up old stale candidates from prior calls
          getDocs(candidatesCol).then((oldCands) => {
            oldCands.forEach((docSnap) => {
              deleteDoc(docSnap.ref).catch(() => {});
            });
          }).catch(() => {});

          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);

          // Overwrite signaling document with fresh session state (erases any stale old answers)
          await setDoc(roomRef, {
            sessionId: currentSessionId,
            offer: { type: offer.type, sdp: offer.sdp },
            answer: null,
            caller: { name: myName, role: myRole },
            caller_in_room: true,
            callee_in_room: false,
            started_at: Date.now(),
            status: "calling",
          });

          const unsubRoom = onSnapshot(roomRef, async (snapshot) => {
            if (endedRef.current || !snapshot.exists()) return;
            const data = snapshot.data();
            if (!data) return;

            // When callee sends answer for this session
            if (data.answer && data.sessionId === currentSessionId && !pc.remoteDescription) {
              try {
                console.log("[WebRTC] Caller received answer from Callee");
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                await flushRemoteCandidates();
                setStatus("connected");
              } catch (err) {
                console.error("[WebRTC] setRemoteDescription failed on caller:", err);
              }
            }

            // Update peer in-room status
            if (data.callee_in_room === false && status === "connected") {
              setStatus("reconnecting");
            }
          });
          trackUnsub(unsubRoom);

          setStatus("calling");
        } catch (e) {
          setError("Failed to start the call: " + (e?.message || e));
          setStatus("error");
        }
      } else {
        // Callee
        let answerCreated = false;

        const handleOffer = async (offerData, offerSessionId) => {
          if (answerCreated || !offerData || !offerData.sdp) return;
          answerCreated = true;
          try {
            console.log("[WebRTC] Callee processing offer");
            await pc.setRemoteDescription(new RTCSessionDescription(offerData));
            await flushRemoteCandidates();

            const answer = await pc.createAnswer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(answer);

            await updateDoc(roomRef, {
              answer: { type: answer.type, sdp: answer.sdp },
              callee: { name: myName, role: myRole },
              callee_in_room: true,
              status: "connected",
            });

            setStatus("connected");
            console.log("[WebRTC] Callee answer sent");
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

          if (data.offer && !answerCreated) {
            await handleOffer(data.offer, data.sessionId);
          }

          // If caller leaves, show reconnecting
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

  return createPortal(
    <div id="g" className="vc-overlay" role="dialog" aria-label="Video call">
      <div className="vc-stage">
        {/* Remote video element - muted to guarantee 100% instant autoplay on all browsers */}
        <video
          ref={remoteVideoRef}
          className="vc-remote"
          autoPlay
          playsInline
          muted={true}
          disablePictureInPicture={myRole !== "teacher"}
        />

        {/* Dedicated remote audio element for crystal-clear two-way voice */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          muted={isSpectator}
        />

        {status !== "connected" && (
          <div className="vc-remote-placeholder">
            <div className="vc-avatar-pulse">
              <span>{(peerName || "?").slice(0, 1).toUpperCase()}</span>
            </div>
            <div className="vc-peer-name">{peerName}</div>
            <div className="vc-status-line">{statusLabel}</div>
            {error && <div className="vc-error">{error}</div>}
          </div>
        )}

        <div className="vc-topbar">
          <div className="vc-topbar-left">
            <span className={`vc-dot ${status === "connected" ? "vc-dot-active" : ""}`} />
            <span className="vc-room-label">
              {isSpectator ? "Auditing Class (Spectator)" : "Online Tahfeez Class"}
            </span>
          </div>
          <div className="vc-topbar-right">
            <span className="vc-status-pill">{statusLabel}</span>
          </div>
        </div>

        {!isSpectator && (
          <div className="vc-local">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              disablePictureInPicture={myRole !== "teacher"}
            />
            {!camOn && (
              <div className="vc-local-off">
                <VideoOff size={20} />
              </div>
            )}
            <div className="vc-local-name">{myName}{!micOn ? " · muted" : ""}</div>
          </div>
        )}

        <div className="vc-controls">
          {!isSpectator && (
            <>
              <button
                type="button"
                className={`vc-btn ${micOn ? "" : "vc-btn-off"}`}
                onClick={toggleMic}
                title={micOn ? "Mute mic" : "Unmute mic"}
              >
                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                <span>{micOn ? "Mute" : "Unmute"}</span>
              </button>
              <button
                type="button"
                className={`vc-btn ${camOn ? "" : "vc-btn-off"}`}
                onClick={toggleCam}
                title={camOn ? "Turn camera off" : "Turn camera on"}
              >
                {camOn ? <Video size={20} /> : <VideoOff size={20} />}
                <span>{camOn ? "Camera" : "Start Cam"}</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="vc-btn vc-btn-end"
            onClick={handleEnd}
            title={isSpectator ? "Leave Spectate" : "End call"}
          >
            <Phone size={20} style={{ transform: "rotate(135deg)" }} />
            <span>{isSpectator ? "Leave" : "End"}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
