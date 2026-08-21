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
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.services.mozilla.com" },
    { urls: "stun:global.stun.twilio.com:3478" },
    { urls: "stun:stun.cloudflare.com:3478" },
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

  // Standard uniform signaling path so both caller and callee always meet in the same room
  const SIGNAL_PATH = "tahfeez_signals";

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
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      } catch (_) {}

      if (deleteSignaling && roomId) {
        try {
          const roomRef = doc(db, SIGNAL_PATH, roomId);
          await setDoc(roomRef, { status: "ended" }, { merge: true });
          setTimeout(async () => {
            try {
              await deleteDoc(roomRef);
            } catch (_) {}
          }, 3000);
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
  const toggleCam = useCallback(async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    
    if (stream && stream.getVideoTracks().length > 0) {
      const next = !camOn;
      stream.getVideoTracks().forEach((t) => { t.enabled = next; });
      setCamOn(next);
      return;
    }

    // Camera not yet acquired
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = videoStream.getVideoTracks()[0];
      if (videoTrack) {
        if (stream) {
          stream.addTrack(videoTrack);
        } else {
          localStreamRef.current = videoStream;
        }
        
        if (pc) {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video') || senders.find(s => !s.track);
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
        try {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              },
            });
            setCamOn(true);
          } catch (videoErr) {
            console.warn("Camera not available, falling back to audio only:", videoErr);
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
          try {
            // Ultimate audio fallback
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setCamOn(false);
          } catch (audioErr) {
            setError(
              "Cannot access microphone. Please allow microphone permissions and try again. (" +
                (audioErr?.message || audioErr) +
                ")"
            );
            setStatus("error");
            return;
          }
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

      // Add local tracks
      if (stream) {
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      }

      // Ensure transceivers are configured so video/audio can be received even if local camera is off
      if (pc.addTransceiver) {
        const hasAudio = stream && stream.getAudioTracks().length > 0;
        const hasVideo = stream && stream.getVideoTracks().length > 0;
        if (!hasAudio) {
          try { pc.addTransceiver('audio', { direction: 'sendrecv' }); } catch (_) {}
        }
        if (!hasVideo) {
          try { pc.addTransceiver('video', { direction: 'sendrecv' }); } catch (_) {}
        }
      }

      pc.ontrack = (ev) => {
        console.log("[WebRTC] Remote track received:", ev.track.kind);
        setStatus("connected");
        if (remoteVideoRef.current) {
          if (ev.streams && ev.streams[0]) {
            remoteVideoRef.current.srcObject = ev.streams[0];
          } else {
            if (!remoteVideoRef.current.srcObject) {
              remoteVideoRef.current.srcObject = new MediaStream();
            }
            remoteVideoRef.current.srcObject.addTrack(ev.track);
          }
          remoteVideoRef.current.play().catch((err) => {
            console.warn("[WebRTC] Remote play error:", err);
          });
        }
      };

      const checkConnectionState = () => {
        const cs = pc.connectionState;
        const ics = pc.iceConnectionState;
        console.log(`[WebRTC] state change: connectionState=${cs}, iceState=${ics}`);
        if (cs === "connected" || ics === "connected" || ics === "completed") {
          setStatus("connected");
        } else if (cs === "failed" || ics === "failed") {
          setStatus("failed");
          setError("Connection failed. Please check network and retry.");
        } else if (cs === "disconnected" || ics === "disconnected") {
          setStatus("disconnected");
        }
      };

      pc.onconnectionstatechange = checkConnectionState;
      pc.oniceconnectionstatechange = checkConnectionState;

      // 3. signaling setup with robust candidate buffering
      const roomRef = doc(db, SIGNAL_PATH, roomId);
      const processedCandidates = new Set();
      const pendingRemoteCandidates = [];
      let docReady = false;
      const initialLocalCandidates = [];

      pc.onicecandidate = async (ev) => {
        if (ev.candidate) {
          const candJson = ev.candidate.toJSON();
          const targetField = role === "caller" ? "caller_candidates" : "callee_candidates";
          if (!docReady) {
            initialLocalCandidates.push(candJson);
          } else {
            try {
              await setDoc(roomRef, {
                [targetField]: arrayUnion(candJson)
              }, { merge: true });
            } catch (err) {
              console.warn("[WebRTC] Error pushing candidate:", err);
            }
          }
        }
      };

      const applyCandidate = async (cand) => {
        if (!cand) return;
        const key = JSON.stringify(cand);
        if (processedCandidates.has(key)) return;
        processedCandidates.add(key);

        if (!pc.remoteDescription) {
          pendingRemoteCandidates.push(cand);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn("[WebRTC] addIceCandidate error:", err);
        }
      };

      const flushRemoteCandidates = async () => {
        while (pendingRemoteCandidates.length > 0) {
          const cand = pendingRemoteCandidates.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (err) {
            console.warn("[WebRTC] addIceCandidate flush error:", err);
          }
        }
      };

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
            caller_candidates: initialLocalCandidates,
            callee_candidates: [],
          }, { merge: true });
          docReady = true;

          const unsub = onSnapshot(roomRef, async (snapshot) => {
            if (endedRef.current) return;
            if (!snapshot.exists()) return;
            const data = snapshot.data();
            if (!data) return;

            if (data.answer && !pc.remoteDescription) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                await flushRemoteCandidates();
              } catch (err) {
                console.error("[WebRTC] setRemoteDescription failed on caller:", err);
              }
            }

            const calleeCandidates = data.callee_candidates || [];
            for (const c of calleeCandidates) {
              await applyCandidate(c);
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
        try {
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

          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await setDoc(roomRef, {
            answer: { type: answer.type, sdp: answer.sdp },
            callee: { name: myName, role: myRole },
            status: "connected",
            callee_candidates: initialLocalCandidates,
          }, { merge: true });
          docReady = true;

          // Process initial caller candidates
          const callerCandidates = data.caller_candidates || [];
          for (const c of callerCandidates) {
            await applyCandidate(c);
          }
          await flushRemoteCandidates();

          // Listen for subsequent caller candidates & session state
          const unsub = onSnapshot(roomRef, async (snapshot) => {
            if (endedRef.current) return;
            if (!snapshot.exists()) return;
            const d = snapshot.data();
            if (!d) return;

            const cands = d.caller_candidates || [];
            for (const c of cands) {
              await applyCandidate(c);
            }

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
