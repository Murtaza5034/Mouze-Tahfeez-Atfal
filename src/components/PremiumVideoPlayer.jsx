import React, { useRef, useState, useEffect, useCallback } from "react";
import "./PremiumVideoPlayer.css";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  PictureInPicture,
} from "lucide-react";

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Convert various YouTube / Vimeo / Drive URLs to embeddable player URLs
function getEmbedUrl(rawUrl) {
  if (!rawUrl) return null;
  const str = String(rawUrl).trim();

  // YouTube
  if (str.includes("youtube.com/watch")) {
    const urlObj = new URL(str);
    const v = urlObj.searchParams.get("v");
    if (v) return `https://www.youtube-nocookie.com/embed/${v}?autoplay=0&rel=0`;
  }
  if (str.includes("youtu.be/")) {
    const parts = str.split("youtu.be/")[1];
    const id = parts ? parts.split("?")[0] : null;
    if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0`;
  }
  if (str.includes("youtube.com/embed/")) {
    return str;
  }

  // Vimeo
  if (str.includes("vimeo.com/")) {
    const m = str.match(/vimeo\.com\/(\d+)/);
    if (m && m[1]) return `https://player.vimeo.com/video/${m[1]}`;
  }

  // Google Drive
  if (str.includes("drive.google.com/file/d/")) {
    const m = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return `https://drive.google.com/file/d/${m[1]}/preview`;
  }

  return null;
}

export default function PremiumVideoPlayer({
  videoUrl,
  posterUrl,
  title = "Tutorial Video",
  autoPlay = false,
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hideControlsTimerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const embedUrl = getEmbedUrl(videoUrl);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleSkip = useCallback((amount) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + amount)
    );
  }, []);

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    videoRef.current.muted = next;
    if (!next && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (_) {}
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const seekTime = Math.max(0, Math.min(duration, pos * duration));
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  // Auto-hide controls when playing and mouse is inactive
  const showAndScheduleHide = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    if (isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => {
        if (!showSpeedMenu) setShowControls(false);
      }, 2500);
    }
  }, [isPlaying, showSpeedMenu]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Time & Buffer updater
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (!isDragging) setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        const lastBuffered = video.buffered.end(video.buffered.length - 1);
        setBuffered((lastBuffered / (video.duration || 1)) * 100);
      }
    };
    const onLoadedMetadata = () => {
      setDuration(video.duration || 0);
      if (autoPlay) {
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setShowControls(true);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [autoPlay, isDragging]);

  // If external iframe embed (YouTube/Vimeo/Drive)
  if (embedUrl) {
    return (
      <div className="premium-player-container" ref={containerRef}>
        <div className="premium-player-aspect">
          <iframe
            src={embedUrl}
            title={title}
            className="premium-iframe-element"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="premium-player-container"
      ref={containerRef}
      onMouseMove={showAndScheduleHide}
      onMouseEnter={showAndScheduleHide}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <div className="premium-player-aspect">
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl}
          className="premium-video-element"
          playsInline
          onClick={togglePlay}
          preload="metadata"
        />

        {/* Big Center Play Overlay Button */}
        {!isPlaying && (
          <button
            type="button"
            className="player-center-play"
            onClick={togglePlay}
            aria-label="Play Video"
          >
            <Play size={32} fill="currentColor" />
          </button>
        )}

        {/* Custom Controls Bar */}
        <div
          className={`player-controls-overlay ${
            !showControls && isPlaying ? "player-controls-hidden" : ""
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress Timeline Scrubber */}
          <div
            className="player-timeline-wrapper"
            onClick={handleSeek}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            tabIndex={0}
          >
            <div
              className="player-buffer-bar"
              style={{ width: `${Math.min(100, Math.max(0, buffered))}%` }}
            />
            <div
              className="player-progress-bar"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            >
              <div className="player-scrubber-thumb" />
            </div>
          </div>

          {/* Bottom Actions Row */}
          <div className="player-actions-row">
            <div className="player-actions-left">
              <button
                type="button"
                className="player-ctrl-btn"
                onClick={togglePlay}
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
              </button>

              <button
                type="button"
                className="player-ctrl-btn"
                onClick={() => handleSkip(-10)}
                title="Rewind 10s"
              >
                <RotateCcw size={18} />
              </button>

              <button
                type="button"
                className="player-ctrl-btn"
                onClick={() => handleSkip(10)}
                title="Forward 10s"
              >
                <RotateCw size={18} />
              </button>

              {/* Volume Slider */}
              <div className="player-volume-group">
                <button
                  type="button"
                  className="player-ctrl-btn"
                  onClick={toggleMute}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="player-volume-slider"
                  title="Volume"
                />
              </div>

              {/* Time Display */}
              <span className="player-time-text">
                {formatTime(currentTime)} <span className="duration">/ {formatTime(duration)}</span>
              </span>
            </div>

            <div className="player-actions-right">
              {/* Speed Selector */}
              <div className="player-speed-wrapper">
                <button
                  type="button"
                  className="player-speed-btn"
                  onClick={() => setShowSpeedMenu((prev) => !prev)}
                  title="Playback Speed"
                >
                  {playbackSpeed}x
                </button>
                {showSpeedMenu && (
                  <div className="player-speed-menu">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`player-speed-item ${playbackSpeed === s ? "active" : ""}`}
                        onClick={() => handleSpeedChange(s)}
                      >
                        {s === 1 ? "1.0x (Normal)" : `${s}x`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* PiP Button */}
              {document.pictureInPictureEnabled && (
                <button
                  type="button"
                  className="player-ctrl-btn"
                  onClick={togglePiP}
                  title="Picture in Picture"
                >
                  <PictureInPicture size={18} />
                </button>
              )}

              {/* Fullscreen Button */}
              <button
                type="button"
                className="player-ctrl-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen (f)" : "Fullscreen (f)"}
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
