import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/db.js";
import { resolveCollectionName } from "../firebase/db.js";
import "./VideoCall.css";
import { Mic, MicOff, Video, VideoOff, Phone } from "lucide-react";

function buildIceServers() {
  const servers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUser = import.meta.env.VITE_TURN_USERNAME;
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL;
  if (turnUrl && turnUser && turnCred) {
    servers.push({
      urls: turnUrl.split(",").map((s) => s.trim()).filter(Boolean),
      username: turnUser,
      credential: turnCred,
    });
  }
  return { iceServers: servers };
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

  const SIGNAL_PATH = resolveCollectionName("tahfeez_signals");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const signalUnsubsRef = useRef([]);
  const endedRef = useRef(false);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [status, setStatus] = useState("initializing");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);

  const trackUnsub = useCallback((unsub) => {
    if (typeof unsub === "function") signalUnsubsRef.current.push(unsub);
  }, []);

  // ----- cleanup helper -----
  const stopAll = useCallback(
    async (deleteSignaling) => {
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
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      } catch (_) {}

      if (deleteSignaling && roomId) {
        try {
          const roomRef = doc(db, SIGNAL_PATH, roomId);
          await updateDoc(roomRef, { status: "ended" });
          setTimeout(async () => {
            try {
              await deleteDoc(roomRef);
            } catch (_) {}
          }, 2000);
        } catch (_) {}
      }
    },
    [roomId, SIGNAL_PATH]
  );

  // ----- end call -----
  const handleEnd = useCallback(() => {
    stopAll(true).finally(() => {
      if (onClose) onClose();
    });
  }, [stopAll, onClose]);

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
      stopAll(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- timer -----
  useEffect(() => {
    if (status !== "connected") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
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
  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camOn;
    stream.getVideoTracks().forEach((t) => { t.enabled = next; });
    setCamOn(next);
  }, [camOn]);

  // ----- main effect: start the call -----
  useEffect(() => {
    if (!roomId || !role) return;

    let cancelled = false;

    const start = async () => {
      setStatus("initializing");
      setError("");

      // 1. acquire local media (skip if spectator)
      let stream = null;
      if (!isSpectator) {
        const isTeacher = myRole === "teacher";
        try {
          if (!isTeacher) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  width: { min: 640, ideal: 1280, max: 1920 },
                  height: { min: 480, ideal: 720, max: 1080 },
                  frameRate: { ideal: 30, max: 60 }
                },
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true
                },
              });
              setCamOn(true);
            } catch (videoErr) {
              console.warn("Camera failed or denied, falling back to audio only:", videoErr);
              stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true
                },
              });
              setCamOn(false);
            }
          } else {
            // Teacher starts with camera off/blocked by default
            stream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              },
            });
            setCamOn(false);
          }
        } catch (e) {
          setError(
            "Cannot access microphone. Please allow microphone permission and try again. (" +
              (e?.message || e) +
              ")"
          );
          setStatus("error");
          return;
        }

        if (cancelled) {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          return;
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

      // 2. create peer connection
      const pc = new RTCPeerConnection(buildIceServers());
      pcRef.current = pc;

      if (stream) {
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      }

      pc.ontrack = (ev) => {
        const [remoteStream] = ev.streams;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "connected") {
          setStatus("connected");
        } else if (s === "failed") {
          setStatus("failed");
          setError("Connection failed. Please retry — your network may be blocking peer-to-peer media.");
        } else if (s === "disconnected") {
          setStatus("disconnected");
        }
      };

      pc.onicecandidate = async (ev) => {
        if (ev.candidate && roomId) {
          try {
            const roomRef = doc(db, SIGNAL_PATH, roomId);
            const fieldName = role === "caller" ? "caller_candidates" : "callee_candidates";
            await updateDoc(roomRef, {
              [fieldName]: arrayUnion(ev.candidate.toJSON())
            });
          } catch (_) {}
        }
      };

      // 3. signaling flow
      const roomRef = doc(db, SIGNAL_PATH, roomId);

      if (role === "caller") {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);

          await setDoc(roomRef, {
            offer: { type: offer.type, sdp: offer.sdp },
            caller: { name: myName, role: myRole },
            started_at: Date.now(),
            status: "calling",
            caller_candidates: [],
            callee_candidates: [],
          });

          const processedCandidates = new Set();
          const unsub = onSnapshot(roomRef, (snapshot) => {
            if (endedRef.current) return;
            if (!snapshot.exists()) return;
            const data = snapshot.data();
            if (!data) return;

            const processCandidates = () => {
              const peerCandidatesField = "callee_candidates";
              const candidatesList = data[peerCandidatesField] || [];
              candidatesList.forEach((cand) => {
                const candStr = JSON.stringify(cand);
                if (!processedCandidates.has(candStr)) {
                  processedCandidates.add(candStr);
                  try {
                    pc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (_) {}
                }
              });
            };

            if (data.answer && !pc.remoteDescription) {
              pc.setRemoteDescription(new RTCSessionDescription(data.answer))
                .then(() => {
                  processCandidates();
                })
                .catch((err) => console.error("setRemoteDescription failed:", err));
            } else if (pc.remoteDescription) {
              processCandidates();
            }

            if (data.status === "ended") {
              stopAll(false).finally(() => {
                if (onClose) onClose();
              });
            }
          });
          trackUnsub(unsub);

          setStatus("calling");
        } catch (e) {
          setError("Failed to start the call: " + (e?.message || e));
          setStatus("error");
        }
      } else {
        // Callee / Spectator: read offer, create answer
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) {
          setError("This call is no longer available.");
          setStatus("error");
          return;
        }
        const data = roomSnap.data();
        if (!data || !data.offer) {
          setError("Invalid call offer.");
          setStatus("error");
          return;
        }
        if (data.status === "ended") {
          setError("This call has ended.");
          setStatus("error");
          return;
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await updateDoc(roomRef, {
            answer: { type: answer.type, sdp: answer.sdp },
            callee: { name: myName, role: myRole },
            status: "connected",
          });

          // Setup snapshot listener
          const processedCandidates = new Set();
          const unsub = onSnapshot(roomRef, (snapshot) => {
            if (endedRef.current) return;
            if (!snapshot.exists()) return;
            const d = snapshot.data();
            if (!d) return;

            // Handle ICE candidates
            const peerCandidatesField = "caller_candidates";
            const candidatesList = d[peerCandidatesField] || [];
            candidatesList.forEach((cand) => {
              const candStr = JSON.stringify(cand);
              if (!processedCandidates.has(candStr)) {
                processedCandidates.add(candStr);
                try {
                  pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (_) {}
              }
            });

            if (d.status === "ended") {
              stopAll(false).finally(() => {
                if (onClose) onClose();
              });
            }
          });
          trackUnsub(unsub);

          setStatus("calling");
        } catch (e) {
          setError("Failed to join the call: " + (e?.message || e));
          setStatus("error");
        }
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
    disconnected: "Reconnecting…",
    failed: "Connection failed",
    error: "Error",
  }[status] || status;

  return createPortal(
    <div id="g" className="vc-overlay" role="dialog" aria-label="Video call">
      <div className="vc-stage">
        <video
          ref={remoteVideoRef}
          className="vc-remote"
          autoPlay
          playsInline
          muted={isSpectator}
          disablePictureInPicture={myRole !== "teacher"}
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
            <span className="vc-dot" />
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
