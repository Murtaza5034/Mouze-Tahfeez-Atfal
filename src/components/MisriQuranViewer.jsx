import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BookOpen,
  Layers,
  Sparkles,
  Search,
  Maximize2
} from "lucide-react";
import {
  ALL_SURAHS,
  getSurahByPage,
  getSurahStartPage,
  getJuzStartPage,
  getJuzFromPage
} from "../quranPageMap.js";

const TOTAL_PAGES = 604;

function getPageUrls(pageNum) {
  const p = Math.max(1, Math.min(TOTAL_PAGES, Number(pageNum) || 1));
  const pad = String(p).padStart(3, "0");
  return [
    `https://cdn.jsdelivr.net/gh/QuranHub/quran-pages-images@main/easyquran.com/hafs-tajweed/${p}.jpg`,
    `https://raw.githubusercontent.com/QuranHub/quran-pages-images/main/easyquran.com/hafs-tajweed/${p}.jpg`,
    `https://android.quran.com/data/width_1260/page${pad}.png`
  ];
}

export default function MisriQuranViewer({
  currentPage = 1,
  onPageChange,
  className = "",
  compact = false,
}) {
  const [page, setPage] = useState(currentPage);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [urlIndex, setUrlIndex] = useState(0);
  const [viewMode, setViewMode] = useState("mushaf"); // "mushaf" | "tajweed"
  const [tajweedVerses, setTajweedVerses] = useState([]);
  const [tajweedLoading, setTajweedLoading] = useState(false);
  const [inputPage, setInputPage] = useState(String(currentPage));

  const viewportRef = useRef(null);
  const containerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0, dist: 0, time: 0 });
  const tajweedCacheRef = useRef({});

  // Sync internal page with external prop if it changes
  useEffect(() => {
    if (currentPage && currentPage !== page) {
      setPage(currentPage);
      setInputPage(String(currentPage));
      setUrlIndex(0);
      setImageLoaded(false);
      setImageError(false);
    }
  }, [currentPage]);

  const changePage = useCallback((newPage) => {
    const valid = Math.max(1, Math.min(TOTAL_PAGES, Number(newPage) || 1));
    setPage(valid);
    setInputPage(String(valid));
    setImageLoaded(false);
    setImageError(false);
    setUrlIndex(0);
    setPan({ x: 0, y: 0 });
    
    // Smoothly scroll viewport back to the top of the page
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
      viewportRef.current.scrollLeft = 0;
    }

    if (onPageChange) onPageChange(valid);
  }, [onPageChange]);

  // Preload adjacent pages for instant flipping
  useEffect(() => {
    const toPreload = [page - 1, page + 1, page - 2, page + 2].filter(
      (p) => p >= 1 && p <= TOTAL_PAGES
    );
    toPreload.forEach((p) => {
      const urls = getPageUrls(p);
      const img = new Image();
      img.src = urls[0];
    });
  }, [page]);

  // Current Surah & Juz metadata
  const currentSurah = getSurahByPage(page);
  const currentJuz = getJuzFromPage(page);

  // Tajweed API fetcher when viewMode is "tajweed"
  useEffect(() => {
    if (viewMode !== "tajweed") return;

    if (tajweedCacheRef.current[page]) {
      setTajweedVerses(tajweedCacheRef.current[page]);
      return;
    }

    let isMounted = true;
    setTajweedLoading(true);

    fetch(`https://api.quran.com/api/v4/verses/by_page/${page}?words=true&word_fields=text_uthmani,text_tajweed`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const verses = data?.verses || [];
        tajweedCacheRef.current[page] = verses;
        setTajweedVerses(verses);
        setTajweedLoading(false);
      })
      .catch((err) => {
        console.warn("Tajweed API fetch error:", err);
        if (isMounted) setTajweedLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page, viewMode]);

  // Zoom handlers (allows zoom-out to 0.7x for viewing entire page on small mobile screens)
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100));
  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(0.65, Math.round((z - 0.15) * 100) / 100);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
  };



  // Touch Swipe & Pinch-to-Zoom handlers
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        dist: 0,
        time: Date.now(),
      };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartRef.current.dist = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchEnd = (e) => {
    if (zoom > 1.1) return; // If zoomed in, allow panning instead of page flip
    if (!touchStartRef.current.time) return;

    const touchEnd = e.changedTouches[0];
    if (!touchEnd) return;

    const diffX = touchEnd.clientX - touchStartRef.current.x;
    const diffY = touchEnd.clientY - touchStartRef.current.y;
    const duration = Date.now() - touchStartRef.current.time;

    // Fast horizontal swipe with minimum travel and low vertical deflection
    if (Math.abs(diffX) > 45 && Math.abs(diffY) < 55 && duration < 450) {
      if (diffX < 0) {
        // Swipe left -> Next Page (in Mushaf RTL layout)
        if (page < TOTAL_PAGES) changePage(page + 1);
      } else {
        // Swipe right -> Previous Page
        if (page > 1) changePage(page - 1);
      }
    }
    touchStartRef.current.time = 0;
  };

  // Mouse pan handlers when zoomed
  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handlePageInputSubmit = (e) => {
    e.preventDefault();
    const p = parseInt(inputPage, 10);
    if (!isNaN(p)) {
      changePage(p);
    } else {
      setInputPage(String(page));
    }
  };

  const currentUrls = getPageUrls(page);
  const activeImageUrl = currentUrls[urlIndex] || currentUrls[0];

  const handleImageError = () => {
    if (urlIndex < currentUrls.length - 1) {
      // Auto fallback to next mirror
      setUrlIndex(urlIndex + 1);
    } else {
      setImageError(true);
    }
  };

  return (
    <div
      className={`misri-quran-viewer ${compact ? "compact" : ""} ${className}`}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Header & Navigation Bar */}
      <div className="mq-topbar">
        <div className="mq-info-badge">
          <span className="mq-surah-name">{currentSurah.nameAr}</span>
          <span className="mq-meta-separator">•</span>
          <span className="mq-juz-name">الجزء {currentJuz}</span>
          <span className="mq-meta-separator">•</span>
          <span className="mq-page-label">صفحة {page}</span>
        </div>

        {/* Action Controls */}
        <div className="mq-topbar-controls">
          {/* View Mode Toggle */}
          <button
            type="button"
            className={`mq-tool-btn ${viewMode === "tajweed" ? "active" : ""}`}
            onClick={() => setViewMode(viewMode === "mushaf" ? "tajweed" : "mushaf")}
            title={viewMode === "mushaf" ? "Switch to Tajweed Text Mode" : "Switch to HD Misri Mushaf Pages"}
          >
            <Layers size={15} />
            <span>{viewMode === "mushaf" ? "Tajweed" : "Mushaf"}</span>
          </button>

          {/* Zoom Controls */}
          <div className="mq-zoom-group">
            <button type="button" className="mq-zoom-btn" onClick={handleZoomOut} disabled={zoom <= 0.65} title="Zoom Out (Fit Full Page)">
              <ZoomOut size={14} />
            </button>
            <button type="button" className="mq-zoom-btn reset" onClick={handleZoomReset} title="Reset Zoom to 100%">
              <span>{Math.round(zoom * 100)}%</span>
            </button>
            <button type="button" className="mq-zoom-btn" onClick={handleZoomIn} disabled={zoom >= 2.5} title="Zoom In">
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Surah / Juz / Page Selector Bar */}
      <div className="mq-selector-bar">
        {/* Surah Dropdown */}
        <div className="mq-select-wrapper surah-select">
          <select
            value={currentSurah.number}
            onChange={(e) => {
              const surahNum = Number(e.target.value);
              const startPage = getSurahStartPage(surahNum);
              changePage(startPage);
            }}
            className="mq-select"
            title="Jump to Surah"
          >
            {ALL_SURAHS.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.nameAr} ({s.nameEn})
              </option>
            ))}
          </select>
        </div>

        {/* Juz Dropdown */}
        <div className="mq-select-wrapper juz-select">
          <select
            value={currentJuz}
            onChange={(e) => {
              const juzNum = Number(e.target.value);
              const startPage = getJuzStartPage(juzNum);
              changePage(startPage);
            }}
            className="mq-select"
            title="Jump to Juz"
          >
            {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
              <option key={j} value={j}>
                الجزء {j} (Juz {j})
              </option>
            ))}
          </select>
        </div>

        {/* Page Stepper & Direct Jump */}
        <div className="mq-page-stepper">
          <button
            type="button"
            className="mq-step-btn"
            onClick={() => changePage(page - 1)}
            disabled={page <= 1}
            title="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>

          <form onSubmit={handlePageInputSubmit} className="mq-page-form">
            <input
              type="number"
              min="1"
              max={TOTAL_PAGES}
              value={inputPage}
              onChange={(e) => setInputPage(e.target.value)}
              onBlur={handlePageInputSubmit}
              className="mq-page-input"
              title="Enter page number (1-604)"
            />
            <span className="mq-total-pages">/{TOTAL_PAGES}</span>
          </form>

          <button
            type="button"
            className="mq-step-btn"
            onClick={() => changePage(page + 1)}
            disabled={page >= TOTAL_PAGES}
            title="Next Page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Quran Content Viewport (Scrollable sheet starting from the top) */}
      <div className="mq-viewport" ref={viewportRef}>
        {viewMode === "mushaf" ? (
          <div
            className={`mq-page-canvas ${isDragging ? "dragging" : ""}`}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: "top center",
              cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
            }}
          >
            {!imageLoaded && !imageError && (
              <div className="mq-loading-skeleton">
                <div className="mq-spinner" />
                <span>Loading Misri Mushaf Page {page}…</span>
              </div>
            )}

            {imageError && (
              <div className="mq-error-box">
                <BookOpen size={36} style={{ color: "#d4af37", opacity: 0.8 }} />
                <h4>Unable to load Page {page}</h4>
                <p>Please check your connection or switch to Tajweed Mode.</p>
                <button
                  type="button"
                  className="mq-retry-btn"
                  onClick={() => {
                    setImageError(false);
                    setImageLoaded(false);
                    setUrlIndex(0);
                  }}
                >
                  <RotateCcw size={14} /> Retry
                </button>
              </div>
            )}

            <div className="mq-page-card">
              <img
                src={activeImageUrl}
                alt={`Misri Quran Mushaf Page ${page}`}
                className={`mq-mushaf-image ${imageLoaded ? "loaded" : "loading"}`}
                onLoad={() => setImageLoaded(true)}
                onError={handleImageError}
                draggable={false}
              />
            </div>
          </div>
        ) : (
          /* Tajweed Color-Coded Word/Text View */
          <div className="mq-tajweed-container">
            {tajweedLoading ? (
              <div className="mq-loading-skeleton">
                <div className="mq-spinner" />
                <span>Loading Tajweed Ayahs for Page {page}…</span>
              </div>
            ) : (
              <div className="mq-tajweed-content">
                <div className="mq-surah-header">
                  <h3>{currentSurah.nameAr}</h3>
                  <div className="mq-surah-subtitle">
                    Surah {currentSurah.nameEn} • Page {page} • Juz {currentJuz}
                  </div>
                </div>

                {tajweedVerses.map((verse) => (
                  <div key={verse.id || verse.verse_key} className="mq-tajweed-verse">
                    <span className="mq-verse-key">({verse.verse_number})</span>
                    <span
                      className="mq-verse-text"
                      dangerouslySetInnerHTML={{
                        __html: verse.text_tajweed || verse.text_uthmani || "",
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Quick Navigator Pill */}
      <div className="mq-quick-nav">
        <button
          type="button"
          className="mq-quick-btn prev"
          onClick={() => changePage(page - 1)}
          disabled={page <= 1}
          title="Previous Page (Swipe Right)"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <div className="mq-quick-center">
          <span className="mq-quick-surah">{currentSurah.nameAr}</span>
          <span className="mq-quick-page">p. {page}</span>
        </div>
        <button
          type="button"
          className="mq-quick-btn next"
          onClick={() => changePage(page + 1)}
          disabled={page >= TOTAL_PAGES}
          title="Next Page (Swipe Left)"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
