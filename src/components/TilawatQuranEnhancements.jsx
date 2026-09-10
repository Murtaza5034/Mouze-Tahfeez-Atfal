import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Check,
  Bookmark,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Feather,
  Info,
  ChevronRight,
  Tag,
  Highlighter,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS & CONFIG
   ═══════════════════════════════════════════════════════════════════ */

export const NISHANI_COLORS = [
  {
    id: "emerald",
    labelAr: "زمردي",
    labelEn: "Emerald",
    hex: "#10b981",
    gradient: "linear-gradient(180deg, #10b981 0%, #047857 100%)",
  },
  {
    id: "gold",
    labelAr: "ذهبي",
    labelEn: "Gold",
    hex: "#f59e0b",
    gradient: "linear-gradient(180deg, #fbbf24 0%, #b45309 100%)",
  },
  {
    id: "ruby",
    labelAr: "ياقوتي",
    labelEn: "Ruby",
    hex: "#ef4444",
    gradient: "linear-gradient(180deg, #f87171 0%, #b91c1c 100%)",
  },
  {
    id: "sapphire",
    labelAr: "أزرق ملكي",
    labelEn: "Sapphire",
    hex: "#3b82f6",
    gradient: "linear-gradient(180deg, #60a5fa 0%, #1d4ed8 100%)",
  },
  {
    id: "amethyst",
    labelAr: "أرجواني",
    labelEn: "Amethyst",
    hex: "#8b5cf6",
    gradient: "linear-gradient(180deg, #a78bfa 0%, #6d28d9 100%)",
  },
];

export const MISTAKE_TYPES = [
  {
    id: "Talqeen",
    labelAr: "تلقين",
    labelEn: "Talqeen",
    subEn: "Prompting / Forgetting",
    descAr: "نسيان الكلمة أو التلقين من الشيخ",
    color: "#ef4444",
    hlBg: "rgba(239, 68, 68, 0.17)", // Ultra-light pastel wash so Arabic text & harakat remain 100% visible
    hlBorder: "#ef4444",
    hlGlow: "rgba(239, 68, 68, 0.10)",
    initial: "ل",
    icon: "💡",
  },
  {
    id: "Tanbeeh",
    labelAr: "تنبيه",
    labelEn: "Tanbeeh",
    subEn: "Hesitation / Alert",
    descAr: "تردد أو تعثر أو تنبيه من الشيخ",
    color: "#f59e0b",
    hlBg: "rgba(245, 158, 11, 0.17)",
    hlBorder: "#f59e0b",
    hlGlow: "rgba(245, 158, 11, 0.10)",
    initial: "ت",
    icon: "⚠️",
  },
  {
    id: "Aerab",
    labelAr: "إعراب",
    labelEn: "Aerab",
    subEn: "Diacritics / Harkat",
    descAr: "خطأ في حركات التشكيل (فتح، ضم، كسر، سكون)",
    color: "#3b82f6",
    hlBg: "rgba(59, 130, 246, 0.17)",
    hlBorder: "#3b82f6",
    hlGlow: "rgba(59, 130, 246, 0.10)",
    initial: "ع",
    icon: "✍️",
  },
  {
    id: "Ahkaam",
    labelAr: "أحكام",
    labelEn: "Ahkaam",
    subEn: "Tajweed Rules",
    descAr: "حكم تجويد (غنة، مد، إخفاء، إدغام، قلقلة)",
    color: "#8b5cf6",
    hlBg: "rgba(139, 92, 246, 0.17)",
    hlBorder: "#8b5cf6",
    hlGlow: "rgba(139, 92, 246, 0.10)",
    initial: "ح",
    icon: "📜",
  },
  {
    id: "Makharij",
    labelAr: "مخارج",
    labelEn: "Makharij",
    subEn: "Articulation",
    descAr: "مخرج الحرف ونطقه الصحيح (ض، ص، ط، ظ، ع)",
    color: "#10b981",
    hlBg: "rgba(16, 185, 129, 0.17)",
    hlBorder: "#10b981",
    hlGlow: "rgba(16, 185, 129, 0.10)",
    initial: "م",
    icon: "🗣️",
  },
];

export const MADANI_15_LINES = [
  { line: 1,  y: 8.2  },
  { line: 2,  y: 14.1 },
  { line: 3,  y: 20.0 },
  { line: 4,  y: 25.9 },
  { line: 5,  y: 31.8 },
  { line: 6,  y: 37.7 },
  { line: 7,  y: 43.6 },
  { line: 8,  y: 49.5 },
  { line: 9,  y: 55.4 },
  { line: 10, y: 61.3 },
  { line: 11, y: 67.2 },
  { line: 12, y: 73.1 },
  { line: 13, y: 79.0 },
  { line: 14, y: 84.9 },
  { line: 15, y: 90.8 },
];

export function findNearestLine(yPct) {
  let closest = MADANI_15_LINES[0];
  let minDiff = Math.abs(yPct - MADANI_15_LINES[0].y);
  for (let i = 1; i < MADANI_15_LINES.length; i++) {
    const diff = Math.abs(yPct - MADANI_15_LINES[i].y);
    if (diff < minDiff) {
      minDiff = diff;
      closest = MADANI_15_LINES[i];
    }
  }
  return closest;
}

/**
 * Snap Y percentage to the nearest line center on a standard 15-line Madani Mushaf page
 */
export function snapToNearestLine(yPct) {
  return findNearestLine(yPct).y;
}

// Memory cache for page words
const pageWordsCache = {};

export async function fetchQuranPageWords(pageNum) {
  if (pageWordsCache[pageNum]) return pageWordsCache[pageNum];
  try {
    const cached = sessionStorage.getItem(`quran_page_words_${pageNum}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      pageWordsCache[pageNum] = parsed;
      return parsed;
    }
  } catch {}

  try {
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_page/${pageNum}?words=true&word_fields=text_uthmani`
    );
    if (!res.ok) throw new Error("Fetch failed");
    const data = await res.json();
    const verses = data?.verses || [];

    const lines = {};
    for (let l = 1; l <= 15; l++) lines[l] = [];

    verses.forEach((v) => {
      const fullAyahText = (v.words || [])
        .map((w) => w.text_uthmani || w.text || "")
        .join(" ");

      (v.words || []).forEach((w) => {
        const lineNum = w.line_number || 1;
        if (!lines[lineNum]) lines[lineNum] = [];
        lines[lineNum].push({
          id: w.id,
          text: w.text_uthmani || w.text || "",
          charType: w.char_type_name, // "word" | "end"
          verseKey: v.verse_key,
          verseNumber: v.verse_number,
          lineNumber: lineNum,
          position: w.position,
          fullAyahText,
        });
      });
    });

    const computedLines = {};
    for (let l = 1; l <= 15; l++) {
      computedLines[l] = computeLineWordsLayout(lines[l]);
    }

    const result = { verses, lines: computedLines };
    pageWordsCache[pageNum] = result;
    try {
      sessionStorage.setItem(`quran_page_words_${pageNum}`, JSON.stringify(result));
    } catch {}
    return result;
  } catch (err) {
    console.warn("Could not fetch page words:", err);
    return null;
  }
}

export function computeLineWordsLayout(words) {
  if (!words || words.length === 0) return [];
  const textLeft = 12.5;
  const textRight = 87.5;
  const totalWidth = textRight - textLeft;

  const weights = words.map((w) => {
    if (w.charType === "end") return 4.5;
    const base = (w.text || "").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
    return Math.max(3.5, base.length * 1.6);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let curRight = textRight;
  return words.map((w, idx) => {
    const wWidth = (weights[idx] / totalWeight) * totalWidth;
    const right = curRight;
    const left = Math.max(textLeft, curRight - wWidth);
    curRight = left;
    return {
      ...w,
      left: Math.round(left * 10) / 10,
      right: Math.round(right * 10) / 10,
      width: Math.round((right - left) * 10) / 10,
      indexInLine: idx,
    };
  });
}

/**
 * Given click/tap at xPct, yPct on the Quran page image,
 * returns the detected word or full ayah (if tapping on ayah stop mark).
 */
export function detectWordOrAyahAt(xPct, yPct, pageData) {
  const lineObj = findNearestLine(yPct);
  const lineWords = pageData?.lines?.[lineObj.line] || [];

  if (lineWords.length === 0) {
    const w = 14;
    const left = Math.max(12.5, Math.min(87.5 - w, xPct - w / 2));
    return {
      scope: "word",
      selectedText: "الكلمة المحددة",
      verseKey: `سطر ${lineObj.line}`,
      x: Math.round(left * 10) / 10,
      y: lineObj.y,
      width: w,
      line: lineObj.line,
    };
  }

  let matchedWord = lineWords[0];
  let minDistance = 999;

  for (let i = 0; i < lineWords.length; i++) {
    const w = lineWords[i];
    if (xPct >= w.left && xPct <= w.right) {
      matchedWord = w;
      minDistance = 0;
      break;
    }
    const dist = Math.abs(xPct - (w.left + w.right) / 2);
    if (dist < minDistance) {
      minDistance = dist;
      matchedWord = w;
    }
  }

  if (matchedWord.charType === "end") {
    return {
      scope: "ayah",
      selectedText: matchedWord.fullAyahText,
      verseKey: `آية ${matchedWord.verseNumber}`,
      x: 12.5,
      y: lineObj.y,
      width: 75,
      line: lineObj.line,
      isAyahEnd: true,
    };
  }

  return {
    scope: "word",
    selectedText: matchedWord.text,
    verseKey: `آية ${matchedWord.verseNumber}`,
    x: matchedWord.left,
    y: lineObj.y,
    width: Math.max(7, matchedWord.width),
    line: lineObj.line,
    wordIndex: matchedWord.indexInLine,
  };
}

/**
 * Given drag start and drag end on the same line,
 * returns the multi-word phrase selection.
 */
export function detectMultiWordPhrase(startX, endX, yPct, pageData) {
  const lineObj = findNearestLine(yPct);
  const lineWords = pageData?.lines?.[lineObj.line] || [];

  if (lineWords.length === 0) {
    const minX = Math.max(12.5, Math.min(startX, endX));
    const maxX = Math.min(87.5, Math.max(startX, endX));
    return {
      scope: "phrase",
      selectedText: "الكلمات المحددة",
      verseKey: `سطر ${lineObj.line}`,
      x: Math.round(minX * 10) / 10,
      y: lineObj.y,
      width: Math.round((maxX - minX) * 10) / 10,
      line: lineObj.line,
    };
  }

  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);

  const overlappingWords = lineWords.filter(
    (w) => w.right >= minX && w.left <= maxX && w.charType !== "end"
  );

  if (overlappingWords.length === 0) {
    return detectWordOrAyahAt((startX + endX) / 2, yPct, pageData);
  }

  if (overlappingWords.length === 1) {
    const w = overlappingWords[0];
    return {
      scope: "word",
      selectedText: w.text,
      verseKey: `آية ${w.verseNumber}`,
      x: w.left,
      y: lineObj.y,
      width: Math.max(7, w.width),
      line: lineObj.line,
    };
  }

  overlappingWords.sort((a, b) => b.right - a.right);

  const left = Math.min(...overlappingWords.map((w) => w.left));
  const right = Math.max(...overlappingWords.map((w) => w.right));
  const phraseText = overlappingWords.map((w) => w.text).join(" ");
  const verseKey = overlappingWords[0]?.verseNumber
    ? `آية ${overlappingWords[0].verseNumber}`
    : `سطر ${lineObj.line}`;

  return {
    scope: "phrase",
    selectedText: phraseText,
    verseKey,
    x: Math.round(left * 10) / 10,
    y: lineObj.y,
    width: Math.round((right - left) * 10) / 10,
    line: lineObj.line,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   1. HIFZ UL QURAN DUA MODAL
   ═══════════════════════════════════════════════════════════════════ */

export function HifzDuaModal({ isOpen, onClose }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const modalContainerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setIsFullscreen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isFullscreen, onClose]);

  if (!isOpen) return null;

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  return (
    <div
      className={`hifz-dua-modal-backdrop ${isFullscreen ? "fullscreen-backdrop" : ""}`}
      onClick={onClose}
    >
      <div
        className={`hifz-dua-modal-card ${isFullscreen ? "fullscreen-card" : ""}`}
        onClick={(e) => e.stopPropagation()}
        ref={modalContainerRef}
      >
        {/* Luxury Header */}
        <div className="hifz-dua-header">
          <div className="hifz-dua-title-group">
            <div className="hifz-dua-sparkle-box">
              <BookOpen size={20} className="gold-sparkle" />
            </div>
            <div>
              <h2 className="arabic-kanz hifz-dua-heading">دُعَاءُ حِفْظِ القُرْآنِ الكَرِيم</h2>
              <p className="hifz-dua-subheading">
                Dua for Hifz & Tilawat — Read Before Commencing Recitation
              </p>
            </div>
          </div>

          <div className="hifz-dua-actions">
            <button
              type="button"
              className="hifz-dua-btn"
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
              title="تصغير / Zoom Out"
            >
              <ZoomOut size={17} />
            </button>
            <span className="hifz-dua-zoom-val">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="hifz-dua-btn"
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
              title="تكبير / Zoom In"
            >
              <ZoomIn size={17} />
            </button>
            <button
              type="button"
              className="hifz-dua-btn"
              onClick={() => setZoom(1)}
              title="إعادة الضبط / Reset Zoom"
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              className={`hifz-dua-btn ${isFullscreen ? "active" : ""}`}
              onClick={toggleFullscreen}
              title={isFullscreen ? "تصغير الشاشة / Exit Fullscreen" : "ملء الشاشة / Fullscreen"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            <button
              type="button"
              className="hifz-dua-close-btn"
              onClick={onClose}
              title="إغلاق / Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body with Image */}
        <div className="hifz-dua-body">
          <div
            className="hifz-dua-img-scroller"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
              transition: "transform 0.18s ease-out",
            }}
          >
            <img
              src="/hifz_dua.jpg"
              alt="الدعاء لحفظ القرآن الكريم"
              className="hifz-dua-image"
              draggable={false}
            />
          </div>
        </div>

        {/* Luxury Footer */}
        <div className="hifz-dua-footer">
          <div className="hifz-dua-hint arabic-kanz">
            <Info size={16} className="hifz-dua-info-icon" />
            <span>يمكنك فتح هذا الدعاء المبارك في أي وقت بالضغط على زر (الدعاء لحفظ القرآن) بأعلى الصفحة</span>
          </div>
          <button type="button" className="hifz-dua-start-btn" onClick={onClose}>
            <Check size={18} />
            <span className="arabic-kanz">ابدأ التلاوة المباركة</span>
            <span className="hifz-dua-btn-en">Start Tilawat</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   2. NISHANI / BOOKMARK MODAL & POPOVER
   ═══════════════════════════════════════════════════════════════════ */

export function TilawatNishaniModal({
  isOpen,
  onClose,
  currentPage,
  surahName,
  juzNum,
  currentBookmark,
  onSetBookmark,
  onRemoveBookmark,
  onJumpToBookmark,
}) {
  const [selectedColor, setSelectedColor] = useState(
    currentBookmark?.color || NISHANI_COLORS[0].hex
  );

  useEffect(() => {
    if (currentBookmark?.color) {
      setSelectedColor(currentBookmark.color);
    }
  }, [currentBookmark]);

  if (!isOpen) return null;

  const isCurrentPageBookmarked = currentBookmark && currentBookmark.page === currentPage;

  const handleSave = () => {
    const colorObj = NISHANI_COLORS.find((c) => c.hex === selectedColor) || NISHANI_COLORS[0];
    onSetBookmark({
      page: currentPage,
      color: colorObj.hex,
      colorName: colorObj.labelEn,
      surahName: surahName || "",
      juz: juzNum || 1,
      timestamp: Date.now(),
    });
    onClose();
  };

  const handleRemove = () => {
    onRemoveBookmark();
    onClose();
  };

  return (
    <div className="nishani-modal-backdrop" onClick={onClose}>
      <div className="nishani-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="nishani-modal-header">
          <div className="nishani-header-title">
            <div
              className="nishani-icon-badge"
              style={{ backgroundColor: selectedColor }}
            >
              <Bookmark size={20} color="#fff" fill="#fff" />
            </div>
            <div>
              <h3 className="arabic-kanz">علامة المصحف (Nishani)</h3>
              <p className="nishani-sub">Page Bookmark & Continue Point</p>
            </div>
          </div>
          <button type="button" className="nishani-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="nishani-modal-body">
          {/* Current Page Status */}
          <div className="nishani-current-info">
            <span className="nishani-info-label arabic-kanz">الصفحة الحالية:</span>
            <span className="nishani-info-page arabic-kanz">صفحة {currentPage}</span>
            <span className="nishani-info-surah arabic-kanz">{surahName}</span>
            <span className="nishani-info-juz">الجزء {juzNum}</span>
          </div>

          {/* Color Palette Selection */}
          <div className="nishani-colors-section">
            <label className="nishani-label arabic-kanz">
              اختر لون شريط العلامة (Ribbon Color):
            </label>
            <div className="nishani-palette">
              {NISHANI_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`nishani-color-btn ${selectedColor === c.hex ? "selected" : ""}`}
                  style={{ background: c.gradient }}
                  onClick={() => setSelectedColor(c.hex)}
                  title={`${c.labelAr} — ${c.labelEn}`}
                >
                  {selectedColor === c.hex && <Check size={16} color="#fff" />}
                  <span className="color-tooltip arabic-kanz">{c.labelAr}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Ribbon Preview */}
          <div className="nishani-preview-box">
            <div
              className="nishani-ribbon-preview"
              style={{
                background:
                  NISHANI_COLORS.find((c) => c.hex === selectedColor)?.gradient ||
                  selectedColor,
              }}
            >
              <span className="nishani-ribbon-symbol">۞</span>
              <span className="arabic-kanz">علامة القراءة</span>
            </div>
            <p className="nishani-preview-text arabic-kanz">
              {isCurrentPageBookmarked
                ? "هذه الصفحة مُعلّمة حالياً كآخر موضع توقف"
                : "سيتم تثبيت شريط العلامة على رأس هذه الصفحة لحفظ موضع القراءة"}
            </p>
          </div>

          {/* If marked on another page */}
          {currentBookmark && currentBookmark.page !== currentPage && (
            <div className="nishani-other-bookmark">
              <div className="other-bmark-info">
                <Bookmark size={15} color={currentBookmark.color} fill={currentBookmark.color} />
                <span className="arabic-kanz">
                  لديك علامة محفوظة سابقة في <strong>صفحة {currentBookmark.page}</strong> ({currentBookmark.surahName || `الجزء ${currentBookmark.juz}`})
                </span>
              </div>
              <button
                type="button"
                className="other-bmark-jump-btn"
                onClick={() => {
                  onJumpToBookmark(currentBookmark.page);
                  onClose();
                }}
              >
                الانتقال إليها
              </button>
            </div>
          )}
        </div>

        <div className="nishani-modal-footer">
          {isCurrentPageBookmarked && (
            <button
              type="button"
              className="nishani-remove-btn"
              onClick={handleRemove}
            >
              <Trash2 size={16} />
              <span className="arabic-kanz">إزالة العلامة</span>
            </button>
          )}

          <button
            type="button"
            className="nishani-save-btn"
            style={{
              backgroundColor: selectedColor,
            }}
            onClick={handleSave}
          >
            <Check size={18} />
            <span className="arabic-kanz">
              {isCurrentPageBookmarked
                ? "تحديث لون العلامة"
                : `تثبيت العلامة في صفحة ${currentPage}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   3. HIFZ MISTAKE HIGHLIGHTER POPOVER (Translucent Marker Pen Flow)
   ═══════════════════════════════════════════════════════════════════ */

export function extractArabicLetters(text) {
  if (!text) return [];
  // Strip diacritics / tashkeel / quranic marks: fatha, damma, kasra, sukun, shaddah, tanween, dagger alif, etc.
  const cleaned = text.replace(
    /[\u064B-\u065F\u0670\u06D6-\u06ED\u0610-\u061A\s0-9\u0660-\u0669۝«»""'']/g,
    ""
  );
  const letters = [];
  for (const ch of cleaned) {
    if (/^[\u0621-\u064A\u0671-\u06D3]$/.test(ch) && !letters.includes(ch)) {
      letters.push(ch);
    }
  }
  return letters;
}

export function TilawatMistakePopover({
  promptPos,
  currentPage,
  onSave,
  onCancel,
}) {
  const [selectedTypes, setSelectedTypes] = useState(
    promptPos?.defaultTypes || ["Talqeen"]
  );
  const [selectedHarf, setSelectedHarf] = useState("");
  const [spanLength, setSpanLength] = useState(
    promptPos?.scope === "ayah"
      ? "line"
      : promptPos?.scope === "phrase"
      ? "phrase"
      : "word"
  );
  const [note, setNote] = useState("");

  if (!promptPos) return null;

  const lettersInWord = extractArabicLetters(promptPos?.selectedText);

  // Toggle category (multi-selection)
  const handleToggleType = (typeId) => {
    setSelectedTypes((prev) => {
      if (prev.includes(typeId)) {
        if (prev.length === 1) return prev; // keep at least one category selected
        return prev.filter((id) => id !== typeId);
      } else {
        return [...prev, typeId];
      }
    });
  };

  const selectedTypeObjs = selectedTypes.map(
    (id) => MISTAKE_TYPES.find((t) => t.id === id) || MISTAKE_TYPES[0]
  );
  const primaryTypeObj = selectedTypeObjs[0] || MISTAKE_TYPES[0];

  const getSelectedWidth = () => {
    if (spanLength === "line") return 75;
    if (spanLength === "phrase") return Math.max(24, promptPos.width || 26);
    return Math.max(8, promptPos.width || 14);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const width = getSelectedWidth();
    let left = promptPos.x;
    if (spanLength === "line") {
      left = 12.5;
    } else {
      left = Math.max(12, Math.min(88 - width, promptPos.x));
    }

    onSave({
      id: "mistake_" + Date.now(),
      page: currentPage,
      type: primaryTypeObj.id, // primary category for backward compat
      types: selectedTypes, // all selected categories!
      scope:
        spanLength === "line"
          ? "ayah"
          : spanLength === "phrase"
          ? "phrase"
          : "word",
      spanLength,
      selectedText: promptPos.selectedText,
      verseKey: promptPos.verseKey,
      harf: selectedHarf.trim(),
      note: note.trim(),
      x: Math.round(left * 10) / 10,
      y: Math.max(6, Math.min(92, promptPos.y - 2.1)),
      width: Math.round(width * 10) / 10,
      height: 4.3,
      createdAt: Date.now(),
    });
  };

  // Preview strip background: blend colors if multiple selected
  const previewBg =
    selectedTypeObjs.length > 1
      ? `linear-gradient(90deg, ${selectedTypeObjs
          .map((t) => t.hlBg)
          .join(", ")})`
      : primaryTypeObj.hlBg;

  return (
    <div className="mistake-popover-backdrop" onClick={onCancel}>
      <div
        className="mistake-popover-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mistake-popover-header">
          <div className="mistake-header-left">
            <div className="multi-type-dots">
              {selectedTypeObjs.map((t) => (
                <div
                  key={t.id}
                  className="mistake-type-dot"
                  style={{ backgroundColor: t.color }}
                />
              ))}
            </div>
            <div>
              <h4 className="arabic-kanz">تحديد خطأ أو حكم تجويد</h4>
              <span className="mistake-sub-page">
                تظليل ملون للمصحف • صفحة {currentPage}
              </span>
            </div>
          </div>
          <button type="button" className="mistake-pop-close" onClick={onCancel}>
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mistake-popover-form">
          {/* Highlighter Size / Scope Selector */}
          <div className="mistake-scope-toggle">
            <span className="scope-label arabic-kanz">النطاق المحدد:</span>
            <div className="scope-btns">
              <button
                type="button"
                className={`scope-btn ${spanLength === "word" ? "active" : ""}`}
                onClick={() => setSpanLength("word")}
              >
                <span>كلمة</span>
                <span className="scope-en">Word</span>
              </button>
              <button
                type="button"
                className={`scope-btn ${spanLength === "phrase" ? "active" : ""}`}
                onClick={() => setSpanLength("phrase")}
              >
                <span>كلمتان أو أكثر</span>
                <span className="scope-en">Phrase</span>
              </button>
              <button
                type="button"
                className={`scope-btn ${spanLength === "line" ? "active" : ""}`}
                onClick={() => setSpanLength("line")}
              >
                <span>الآية كاملة</span>
                <span className="scope-en">Ayah</span>
              </button>
            </div>
          </div>

          {/* Translucent Highlighter Preview on the EXACT Selected Arabic Word or Ayah */}
          <div className="highlighter-live-preview">
            <div
              className="preview-highlight-strip"
              style={{
                background: previewBg,
                borderBottom: `2.5px solid ${primaryTypeObj.color}`,
                boxShadow: `0 0 10px ${primaryTypeObj.hlGlow}`,
              }}
            >
              <div className="preview-top-row">
                <div className="preview-badges-wrap">
                  {selectedTypeObjs.map((t) => (
                    <span
                      key={t.id}
                      className="preview-tag-badge"
                      style={{ backgroundColor: t.color }}
                    >
                      {t.icon} {t.labelAr}
                    </span>
                  ))}
                  {selectedHarf.trim() && (
                    <span className="preview-tag-badge harf-preview-badge arabic-kanz">
                      حرف: {selectedHarf.trim()}
                    </span>
                  )}
                </div>
                {promptPos.verseKey && (
                  <span className="preview-verse-tag arabic-kanz">
                    {promptPos.verseKey}
                  </span>
                )}
              </div>
              <span className="preview-arabic-text arabic-kanz">
                {promptPos.selectedText ||
                  note.trim() ||
                  (spanLength === "line" ? "الآية كاملة" : "الكلمة المحددة")}
              </span>
            </div>
            <p className="preview-note arabic-kanz">
              {promptPos.scope === "ayah"
                ? "تم تحديد الآية كاملة عبر النقر على رمز وقف الآية ۝"
                : promptPos.scope === "phrase"
                ? "تم تحديد الكلمات المتتابعة عبر السحب والتمرير"
                : "تم تحديد هذه الكلمة مباشرة عبر النقر عليها"}
            </p>
          </div>

          {/* 5 Mistake Types with Multi-Selection Support */}
          <div className="mistake-types-section">
            <div className="types-section-header">
              <span className="section-label arabic-kanz">
                اختر التصنيف أو الحكم (يمكنك اختيار أكثر من واحد):
              </span>
              <span className="multi-select-hint">متعدد • Multiple</span>
            </div>
            <div className="mistake-types-grid">
              {MISTAKE_TYPES.map((t) => {
                const isSelected = selectedTypes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`mistake-type-btn ${isSelected ? "selected" : ""}`}
                    style={{
                      "--type-color": t.color,
                      borderColor: isSelected ? t.color : "#e8e0d2",
                      backgroundColor: isSelected ? t.hlBg : "#fff",
                    }}
                    onClick={() => handleToggleType(t.id)}
                  >
                    <div className="type-btn-header">
                      <span
                        className="type-initial-badge"
                        style={{ backgroundColor: t.color }}
                      >
                        {isSelected ? "✓" : t.initial}
                      </span>
                      <strong className="type-name arabic-kanz">{t.labelAr}</strong>
                      <span className="type-en">{t.labelEn}</span>
                    </div>
                    <p className="type-desc arabic-kanz">{t.descAr}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Letter / Harf Selector & Dedicated Text Box */}
          <div className="mistake-input-group harf-input-group">
            <div className="harf-group-head">
              <label className="arabic-kanz">
                الكلمة أو الحرف المعني بالخطأ / الحكم (Word or Harf):
              </label>
              {selectedHarf && (
                <button
                  type="button"
                  className="clear-harf-btn"
                  onClick={() => setSelectedHarf("")}
                >
                  مسح الحرف
                </button>
              )}
            </div>

            {/* Clickable Quick Letter Chips from the Selected Word */}
            {lettersInWord.length > 0 && (
              <div className="harf-quick-chips">
                <span className="harf-chips-title arabic-kanz">حروف الكلمة:</span>
                <div className="harf-chips-list">
                  {lettersInWord.map((letter, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`harf-chip-btn ${selectedHarf === letter ? "active" : ""}`}
                      onClick={() =>
                        setSelectedHarf(selectedHarf === letter ? "" : letter)
                      }
                      title={`حرف ${letter}`}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              type="text"
              className="mistake-note-input mistake-harf-input arabic-kanz"
              placeholder="اكتب الحرف أو الكلمة (مثلاً: حرف النون، الهمزة، واو المد، إخفاء...)"
              value={selectedHarf}
              onChange={(e) => setSelectedHarf(e.target.value)}
            />
          </div>

          {/* Optional Note input */}
          <div className="mistake-input-group">
            <label className="arabic-kanz">ملاحظة إضافية (اختياري):</label>
            <input
              type="text"
              className="mistake-note-input arabic-kanz"
              placeholder="مثال: فتحة بدلاً من ضمة، مد زائد..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="mistake-form-actions">
            <button
              type="button"
              className="mistake-btn-cancel"
              onClick={onCancel}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="mistake-btn-submit"
              style={{ backgroundColor: primaryTypeObj.color }}
            >
              <Check size={16} />
              <span className="arabic-kanz">تأكيد التظليل في الصفحة</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   4. PAGE MISTAKES DRAWER / DETAILS MODAL
   ═══════════════════════════════════════════════════════════════════ */

export function TilawatMistakesDrawer({
  isOpen,
  onClose,
  currentPage,
  mistakes = [],
  onDeleteMistake,
  onClearAllPageMistakes,
  onSelectMistake,
}) {
  if (!isOpen) return null;

  const counts = MISTAKE_TYPES.reduce((acc, t) => {
    acc[t.id] = mistakes.filter((m) =>
      m.types ? m.types.includes(t.id) : m.type === t.id
    ).length;
    return acc;
  }, {});

  return (
    <div className="mistakes-drawer-backdrop" onClick={onClose}>
      <div className="mistakes-drawer-card" onClick={(e) => e.stopPropagation()}>
        <div className="mistakes-drawer-header">
          <div className="drawer-title-box">
            <Highlighter size={20} className="drawer-icon" />
            <div>
              <h3 className="arabic-kanz">سجل تظليل أخطاء الصفحة — صفحة {currentPage}</h3>
              <p className="drawer-sub">
                إجمالي الكلمات والآيات المُظللة: {mistakes.length} موضع
              </p>
            </div>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Category breakdown pills */}
        <div className="mistakes-breakdown-bar">
          {MISTAKE_TYPES.map((t) => (
            <div
              key={t.id}
              className="breakdown-chip"
              style={{
                borderColor: t.color,
                backgroundColor: t.hlBg,
              }}
            >
              <span
                className="chip-badge"
                style={{ backgroundColor: t.color }}
              >
                {counts[t.id] || 0}
              </span>
              <span className="chip-label arabic-kanz">{t.labelAr}</span>
            </div>
          ))}
        </div>

        {/* List of mistakes */}
        <div className="mistakes-list-container">
          {mistakes.length === 0 ? (
            <div className="mistakes-empty-state">
              <Check size={42} className="empty-check-icon" />
              <h4 className="arabic-kanz">ما شاء الله! لا توجد أخطاء مُسجّلة في هذه الصفحة</h4>
              <p className="arabic-kanz">
                لتظليل أي خطأ، فعّل (قلم التظليل) وانقر مباشرة على الكلمة أو اسحب فوق الآية في المصحف.
              </p>
            </div>
          ) : (
            <div className="mistakes-items-list">
              {mistakes.map((m, idx) => {
                const typesList =
                  Array.isArray(m.types) && m.types.length > 0
                    ? m.types
                    : [m.type || "Talqeen"];
                const typeObjs = typesList.map(
                  (tId) =>
                    MISTAKE_TYPES.find((t) => t.id === tId) || MISTAKE_TYPES[0]
                );
                const primaryObj = typeObjs[0];

                return (
                  <div
                    key={m.id || idx}
                    className="mistake-item-row"
                    style={{ borderRightColor: primaryObj.color }}
                  >
                    <div className="mistake-item-left">
                      <div className="mistake-badges-group">
                        {typeObjs.map((tObj) => (
                          <div
                            key={tObj.id}
                            className="mistake-badge-pill"
                            style={{
                              backgroundColor: tObj.color,
                            }}
                          >
                            {tObj.icon} {tObj.labelAr}
                          </div>
                        ))}
                        {m.harf && (
                          <div className="mistake-harf-pill arabic-kanz">
                            حرف: {m.harf}
                          </div>
                        )}
                      </div>
                      <span className="mistake-scope-tag">
                        {m.scope === "word"
                          ? "كلمة"
                          : m.scope === "phrase"
                          ? "كلمات"
                          : "آية كاملة"}
                      </span>
                      {m.selectedText && (
                        <span className="mistake-item-word arabic-kanz">
                          «{m.selectedText}»
                        </span>
                      )}
                      {m.note && (
                        <p className="mistake-item-note arabic-kanz">{m.note}</p>
                      )}
                      <span className="mistake-item-time">
                        {new Date(m.createdAt || Date.now()).toLocaleTimeString(
                          [],
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </span>
                    </div>

                    <div className="mistake-item-actions">
                      <button
                        type="button"
                        className="mistake-delete-btn"
                        onClick={() => onDeleteMistake(m.id)}
                        title="حذف هذا التظليل"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mistakes-drawer-footer">
          {mistakes.length > 0 && (
            <button
              type="button"
              className="clear-all-mistakes-btn"
              onClick={onClearAllPageMistakes}
            >
              <Trash2 size={16} />
              <span className="arabic-kanz">مسح جميع تظليلات هذه الصفحة</span>
            </button>
          )}
          <button type="button" className="drawer-done-btn" onClick={onClose}>
            تم
          </button>
        </div>
      </div>
    </div>
  );
}
