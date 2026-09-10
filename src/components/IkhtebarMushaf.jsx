import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  BookOpen,
  Mic,
  Play,
  Pause,
  StopCircle,
  AlertCircle,
  CheckCircle,
  X,
  RotateCcw,
  Settings,
  Clock,
  ArrowRight,
  ArrowLeft,
  Target,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Maximize,
  Minimize,
  ChevronLeft,
  ChevronRight,
  BookMarked,
  Feather,
  Search,
  History,
  Award,
  Check,
  Sparkles,
  Filter,
  Trash2,
  Layers,
  Calendar,
  Bookmark,
  Edit3,
  Eye,
  EyeOff,
  Highlighter,
} from "lucide-react";
import {
  HifzDuaModal,
  TilawatNishaniModal,
  TilawatMistakePopover,
  TilawatMistakesDrawer,
  NISHANI_COLORS,
  MISTAKE_TYPES,
  snapToNearestLine,
  fetchQuranPageWords,
  detectWordOrAyahAt,
  detectMultiWordPhrase,
} from "./TilawatQuranEnhancements";
import {
  getJuzStartPage,
  getJuzFromPage,
  getSurahByPage,
  getAyahPage,
  JUZ_PAGE_MAP,
  QURAN_PAGE_STARTS,
  ALL_SURAHS,
} from "../quranPageMap.js";
import "./IkhtebarMushaf.css";

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */

const MARHALA_JUZ_MAP = {
  "Marhala Ula": [30],
  "Marhala Saniyah": [28, 29, 30],
  "Marhala Salesah": [26, 27, 28, 29, 30],
  "Marhala Rabeah": [1, 2, 3, 4, 5, 26, 27, 28, 29, 30],
  "Marhala Khamesah": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 26, 27, 28, 29, 30],
  "Marhala Sadesah": [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 26, 27, 28, 29, 30,
  ],
  "Marhala Sabeah": [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    26, 27, 28, 29, 30,
  ],
  "Marhala Saminah": Array.from({ length: 30 }, (_, i) => i + 1),
};

const TOTAL_PAGES = 604;
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/15iZ4bl15gOcfnOhWc3oSKhf7k3qsE8avPc3Z7Eeh5sI/gviz/tq?tqx=out:csv";
const REFRESH_INTERVAL = 60000;

const MARHALA_NUM_AR = {
  "Marhala Ula": "١",
  "Marhala Saniyah": "٢",
  "Marhala Salesah": "٣",
  "Marhala Rabeah": "٤",
  "Marhala Khamesah": "٥",
  "Marhala Sadesah": "٦",
  "Marhala Sabeah": "٧",
  "Marhala Saminah": "٨",
};

export const JUZ_NAMES_AR = [
  "الجزء الأول (الم)",
  "الجزء الثاني (سيقول)",
  "الجزء الثالث (تلك الرسل)",
  "الجزء الرابع (لن تنالوا)",
  "الجزء الخامس (والمحصنات)",
  "الجزء السادس (لا يحب الله)",
  "الجزء السابع (وإذا سمعوا)",
  "الجزء الثامن (ولو أننا)",
  "الجزء التاسع (قال الملأ)",
  "الجزء العاشر (واعلموا)",
  "الجزء الحادي عشر (يعتذرون)",
  "الجزء الثاني عشر (وما من دابة)",
  "الجزء الثالث عشر (وما أبرئ)",
  "الجزء الرابع عشر (ربما)",
  "الجزء الخامس عشر (سبحان)",
  "الجزء السادس عشر (قال ألم)",
  "الجزء السابع عشر (اقترب)",
  "الجزء الثامن عشر (قد أفلح)",
  "الجزء التاسع عشر (وقال الذين)",
  "الجزء العشرون (أمن خلق)",
  "الجزء الحادي والعشرون (اتل ما أوحي)",
  "الجزء الثاني والعشرون (ومن يقنت)",
  "الجزء الثالث والعشرون (وما لي)",
  "الجزء الرابع والعشرون (فمن أظلم)",
  "الجزء الخامس والعشرون (إليه يرد)",
  "الجزء السادس والعشرون (حم)",
  "الجزء السابع والعشرون (قال فما خطبكم)",
  "الجزء الثامن والعشرون (قد سمع)",
  "الجزء التاسع والعشرون (تبارك)",
  "الجزء الثلاثون (عم)",
];

export function toEasternArabicNumerals(num) {
  if (num === null || num === undefined) return "";
  const easternDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(num).replace(/[0-9]/g, (w) => easternDigits[+w]);
}

const HISTORY_STORAGE_KEY = "mauze_ikhtebar_history_v1";

export function loadIkhtebarHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Failed to load Ikhtebar history:", err);
    return [];
  }
}

export function saveIkhtebarHistoryEntry(entry) {
  try {
    const existing = loadIkhtebarHistory();
    const updated = [entry, ...existing.slice(0, 99)];
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn("Failed to save Ikhtebar history entry:", err);
    return [];
  }
}

export function deleteIkhtebarHistoryEntry(id) {
  try {
    const existing = loadIkhtebarHistory();
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn("Failed to delete Ikhtebar history entry:", err);
    return [];
  }
}

export function clearAllIkhtebarHistory() {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    return [];
  } catch (err) {
    console.warn("Failed to clear Ikhtebar history:", err);
    return [];
  }
}

export function formatDuration(totalSeconds) {
  const m = Math.floor((totalSeconds || 0) / 60);
  const s = (totalSeconds || 0) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

function getPageUrls(pageNum) {
  const p = Math.max(1, Math.min(TOTAL_PAGES, Number(pageNum) || 1));
  const pad = String(p).padStart(3, "0");
  return [
    `https://cdn.jsdelivr.net/gh/QuranHub/quran-pages-images@main/easyquran.com/hafs-tajweed/${p}.jpg`,
    `https://raw.githubusercontent.com/QuranHub/quran-pages-images/main/easyquran.com/hafs-tajweed/${p}.jpg`,
    `https://android.quran.com/data/width_1260/page${pad}.png`,
  ];
}

function normalizeArabic(text) {
  if (!text) return "";
  return text
    // Remove all harakat (fatha, damma, kasra, sukun, shadda, tanween) + dagger alif
    .replace(/[\u064B-\u065F\u0670]/g, "")
    // Remove all Quranic annotation signs, waqf signs, sajda, rub, hizb, ayah marks
    .replace(/[\u0610-\u061A\u06D6-\u06ED\u08D4-\u08E1\uFD3E\uFD3F]/g, "")
    // Strip Quranic small zero (۟ \u06DF), rounded zero (۠ \u06E0), empty center stop (ۡ \u06E1), etc.
    .replace(/[\u06DF-\u06E8]/g, "")
    // Normalize Alif variations (including Alif Wasla ٱ \u0671, Alif with hamza above/below/madda)
    .replace(/[أإآٱ]/g, "ا")
    // Normalize Alif Maqsura (ى) to Ya (ي)
    .replace(/[ىي]/g, "ي")
    // Normalize Ta Marbuta (ة) to Ha (ه)
    .replace(/[ةه]/g, "ه")
    // Normalize Hamza variants (ؤ, ئ)
    .replace(/[ؤئ]/g, "ء")
    // Remove punctuation, brackets, numbers, slashes, dots, commas, tatweel, and non-Arabic characters
    .replace(/[،؛؟.,;:!?"'()[\]{}۞۝0-9\u0660-\u0669/\\_—–ـ\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordsMatch(spoken, expected) {
  const s = normalizeArabic(spoken);
  const e = normalizeArabic(expected);
  if (!s || !e) return false;
  return s === e || s.includes(e) || e.includes(s);
}

function splitAyahIntoWords(ayahText) {
  if (!ayahText) return [];
  const cleaned = ayahText
    .replace(/۞|۝/g, "")
    // Treat slashes, backslashes, dots, commas, dashes, colons, semicolons, question marks, and Arabic punctuation as word delimiters
    .replace(/[/\\.,،؛؟:!?"'()[\]{}—–_ـ\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.split(/\s+/).filter((w) => w.length > 0);
}

export function formatArabicPromptText(text) {
  if (!text) return "";
  return text
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s*,\s*/g, "، ")
    .replace(/\s*\.\s*/g, " . ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function extractSurahInfo(field) {
  if (!field) return { surahNum: 0, surahName: "" };
  const numMatch = field.match(/^(\d+)/);
  const surahNum = numMatch ? parseInt(numMatch[1]) : 0;
  const name = field.replace(/^\d+\s*/, "").trim();
  return { surahNum, surahName: name };
}

function parseIkhtebarCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { entries: [], byJuz: {} };
  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 7) continue;
    const clean = (v) => v?.replace(/^"|"$/g, "").trim() || "";
    const juz = parseInt(clean(cols[2])) || 0;
    const page = parseInt(clean(cols[3])) || 0;
    const { surahNum, surahName } = extractSurahInfo(clean(cols[4]));
    const ayahNum = parseInt(clean(cols[5])) || 1;
    const questionText = clean(cols[6]);
    const alertText = clean(cols[7]);
    const promptText = clean(cols[8]);
    const marks = clean(cols[9]);
    if (!juz || !page || !questionText) continue;
    const words = splitAyahIntoWords(questionText);
    entries.push({
      row: i, juz, page, surahNum, surahName, ayahNum,
      questionText, fullAyah: questionText, alertText, promptText, marks, words,
    });
  }
  const byJuz = {};
  entries.forEach((e) => {
    if (!byJuz[e.juz]) byJuz[e.juz] = [];
    byJuz[e.juz].push(e);
  });
  return { entries, byJuz };
}

/* ═══════════════════════════════════════════════════════════════════
   TILAWAT SEARCH MODAL — Premium Search & Quick Navigation
   ═══════════════════════════════════════════════════════════════════ */

export function TilawatSearchModal({ isOpen, onClose, onSelectPage, currentPage }) {
  const [activeTab, setActiveTab] = useState("surah"); // "surah" | "juz" | "page"
  const [searchQuery, setSearchQuery] = useState("");
  const [targetPageInput, setTargetPageInput] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setTargetPageInput(String(currentPage || 1));
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, currentPage]);

  const filteredSurahs = useMemo(() => {
    if (!searchQuery.trim()) return ALL_SURAHS;
    const qNorm = normalizeArabic(searchQuery);
    const qLower = searchQuery.toLowerCase().trim();
    const qNum = parseInt(searchQuery, 10);
    return ALL_SURAHS.filter((s) => {
      if (!isNaN(qNum) && (s.number === qNum || s.page === qNum)) return true;
      const nameNorm = normalizeArabic(s.nameAr);
      const enLower = (s.nameEn || "").toLowerCase();
      return nameNorm.includes(qNorm) || enLower.includes(qLower);
    });
  }, [searchQuery]);

  const juzList = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const num = i + 1;
      const startPage = getJuzStartPage(num);
      return {
        number: num,
        nameAr: JUZ_NAMES_AR[i] || `الجزء ${num}`,
        startPage,
      };
    });
  }, []);

  const filteredJuz = useMemo(() => {
    if (!searchQuery.trim()) return juzList;
    const qNorm = normalizeArabic(searchQuery);
    const qNum = parseInt(searchQuery, 10);
    return juzList.filter((j) => {
      if (!isNaN(qNum) && (j.number === qNum || j.startPage === qNum)) return true;
      return normalizeArabic(j.nameAr).includes(qNorm);
    });
  }, [searchQuery, juzList]);

  if (!isOpen) return null;

  const handlePageJump = (e) => {
    e?.preventDefault();
    const p = parseInt(targetPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= TOTAL_PAGES) {
      onSelectPage(p);
      onClose();
    }
  };

  return (
    <div className="tilawat-search-modal-backdrop" onClick={onClose}>
      <div className="tilawat-search-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="tilawat-search-header">
          <div className="header-titles">
            <div className="search-icon-badge">
              <Search size={22} />
            </div>
            <div>
              <h3 className="arabic-kanz">البحث والتنقل في المصحف الشريف</h3>
              <p>Search & Jump to any Surah, Juz, or Page</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="tilawat-search-tabs">
          <button
            type="button"
            className={`search-tab-btn ${activeTab === "surah" ? "active" : ""}`}
            onClick={() => setActiveTab("surah")}
          >
            <BookOpen size={16} />
            <span className="arabic-kanz">السور ({ALL_SURAHS.length})</span>
          </button>
          <button
            type="button"
            className={`search-tab-btn ${activeTab === "juz" ? "active" : ""}`}
            onClick={() => setActiveTab("juz")}
          >
            <BookMarked size={16} />
            <span className="arabic-kanz">الأجزاء (٣٠)</span>
          </button>
          <button
            type="button"
            className={`search-tab-btn ${activeTab === "page" ? "active" : ""}`}
            onClick={() => setActiveTab("page")}
          >
            <Layers size={16} />
            <span className="arabic-kanz">رقم الصفحة</span>
          </button>
        </div>

        {/* Search Input for Surahs & Juz */}
        {activeTab !== "page" && (
          <div className="tilawat-search-input-wrapper">
            <Search className="search-field-icon" size={18} />
            <input
              ref={inputRef}
              type="text"
              className="tilawat-search-field arabic-kanz"
              placeholder={
                activeTab === "surah"
                  ? "ابحث باسم السورة (مثلاً: الكهف، البقرة، يسن) أو رقمها..."
                  : "ابحث برقم الجزء (مثلاً: 1، 15، 30) أو اسمه (عم، تبارك)..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery("")}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Content list */}
        <div className="tilawat-search-results">
          {activeTab === "surah" && (
            <div className="surah-results-grid">
              {filteredSurahs.map((surah) => {
                const isCurrent = getSurahByPage(currentPage).number === surah.number;
                return (
                  <button
                    key={surah.number}
                    type="button"
                    className={`surah-result-card ${isCurrent ? "current-surah" : ""}`}
                    onClick={() => {
                      onSelectPage(surah.page);
                      onClose();
                    }}
                  >
                    <div className="surah-number-badge arabic-kanz">
                      {toEasternArabicNumerals(surah.number)}
                    </div>
                    <div className="surah-info-texts">
                      <div className="surah-name-ar arabic-kanz">
                        {surah.nameAr.startsWith("سورة") ? surah.nameAr : `سورة ${surah.nameAr}`}
                      </div>
                      <div className="surah-name-en">
                        {surah.nameEn} • Juz {surah.juz}
                      </div>
                    </div>
                    <div className="surah-page-chip">
                      <span className="page-word">صفحة</span>
                      <strong className="arabic-kanz">{toEasternArabicNumerals(surah.page)}</strong>
                    </div>
                  </button>
                );
              })}
              {filteredSurahs.length === 0 && (
                <div className="search-empty-state">
                  <BookOpen size={36} />
                  <p className="arabic-kanz">لم يتم العثور على سورة مطابقة للبحث</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "juz" && (
            <div className="juz-results-grid">
              {filteredJuz.map((j) => {
                const isCurrent = getJuzFromPage(currentPage) === j.number;
                return (
                  <button
                    key={j.number}
                    type="button"
                    className={`juz-result-card ${isCurrent ? "current-juz" : ""}`}
                    onClick={() => {
                      onSelectPage(j.startPage);
                      onClose();
                    }}
                  >
                    <div className="juz-badge-icon">
                      <span className="juz-num-eastern arabic-kanz">
                        {toEasternArabicNumerals(j.number)}
                      </span>
                    </div>
                    <div className="juz-info-col">
                      <span className="juz-title-text arabic-kanz">{j.nameAr}</span>
                      <span className="juz-start-page">
                        يبدأ من صفحة {toEasternArabicNumerals(j.startPage)}
                      </span>
                    </div>
                    <ChevronRight size={18} className="juz-arrow-icon" />
                  </button>
                );
              })}
              {filteredJuz.length === 0 && (
                <div className="search-empty-state">
                  <BookMarked size={36} />
                  <p className="arabic-kanz">لم يتم العثور على جزء مطابق</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "page" && (
            <div className="page-jump-container">
              <form onSubmit={handlePageJump} className="page-jump-form">
                <div className="page-jump-input-group">
                  <label htmlFor="page-input-field" className="arabic-kanz">
                    أدخل رقم الصفحة (١ - ٦٠٤):
                  </label>
                  <input
                    id="page-input-field"
                    type="number"
                    min={1}
                    max={TOTAL_PAGES}
                    value={targetPageInput}
                    onChange={(e) => setTargetPageInput(e.target.value)}
                    className="page-direct-input arabic-kanz"
                    autoFocus
                  />
                </div>
                <button type="submit" className="page-jump-submit-btn">
                  <span>انتقل إلى الصفحة</span>
                  <ArrowRight size={18} />
                </button>
              </form>
              <div className="quick-page-bookmarks">
                <span className="bookmarks-title">صفحات شائعة وسريعة:</span>
                <div className="bookmarks-chips">
                  {[
                    { label: "الفاتحة", p: 1 },
                    { label: "البقرة", p: 2 },
                    { label: "الكهف", p: 293 },
                    { label: "يسن", p: 440 },
                    { label: "الملك", p: 562 },
                    { label: "عم", p: 582 },
                  ].map((b) => (
                    <button
                      key={b.p}
                      type="button"
                      className="bookmark-chip-btn"
                      onClick={() => {
                        onSelectPage(b.p);
                        onClose();
                      }}
                    >
                      <span className="arabic-kanz">{b.label}</span>
                      <span className="chip-p">({b.p})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AUTHENTIC MUSHAF BLANK PAGE VIEW
   Replicating the physical ruled Ikhtebar workbook page
   ═══════════════════════════════════════════════════════════════════ */

export function MushafBlankPageView({
  page,
  question,
  words = [],
  revealedIndices = [],
  currentIndex = 0,
  errorIndex = -1,
  inErrorState = false,
  inCorrectionWindow = false,
  correctionTimeLeft = 0,
  isListening = false,
}) {
  const surahInfo = useMemo(() => {
    if (question?.surahName) {
      return { nameAr: question.surahName, number: question.surahNum || 1 };
    }
    return getSurahByPage(page);
  }, [question, page]);

  const juzNumber = question?.juz || getJuzFromPage(page);
  const juzTitleAr = JUZ_NAMES_AR[juzNumber - 1] || `الجزء ${toEasternArabicNumerals(juzNumber)}`;
  const ayahNumber = question?.ayahNum || question?.startAyah || 1;
  const promptAyahText = question?.promptText || (question?.fullAyah ? question.fullAyah.split(" ").slice(0, 4).join(" ") + " …" : "");

  // Organize words into ruled lines (~6 words per line)
  const WORDS_PER_LINE = 6;
  const minLines = 13;
  const neededLines = Math.ceil((words.length || 0) / WORDS_PER_LINE);
  const lineCount = Math.max(minLines, neededLines + 3);

  const lines = useMemo(() => {
    const res = [];
    for (let l = 0; l < lineCount; l++) {
      const startIdx = l * WORDS_PER_LINE;
      const endIdx = startIdx + WORDS_PER_LINE;
      const lineWords = words.slice(startIdx, endIdx).map((word, relIdx) => {
        const absIdx = startIdx + relIdx;
        return {
          word,
          absIdx,
          isRevealed: revealedIndices.includes(absIdx),
          isCurrent: absIdx === currentIndex,
          isError: absIdx === errorIndex,
        };
      });
      res.push({ lineIndex: l, words: lineWords });
    }
    return res;
  }, [words, lineCount, revealedIndices, currentIndex, errorIndex]);

  // Bismillah is not displayed for Surah At-Tawbah (Surah 9)
  const showBismillah = surahInfo.number !== 9 && (ayahNumber === 1 || !question?.promptText);

  return (
    <div className="mushaf-physical-page-wrapper">
      <div className="mushaf-physical-page">
        {/* Ornate gilded outer & inner border */}
        <div className="mushaf-outer-border">
          <div className="mushaf-inner-border">
            {/* Islamic decorative cornerpieces */}
            <div className="mushaf-corner top-right">❖</div>
            <div className="mushaf-corner top-left">❖</div>
            <div className="mushaf-corner bottom-right">❖</div>
            <div className="mushaf-corner bottom-left">❖</div>

            {/* Top ornate cartouche banner matching reference photo */}
            <div className="mushaf-header-banner">
              <div className="banner-cartouche juz-cartouche">
                <span className="cartouche-label arabic-kanz">{juzTitleAr}</span>
              </div>
              <div className="banner-cartouche surah-cartouche">
                <div className="surah-arch-frame">
                  <span className="surah-title-text arabic-kanz">
                    {surahInfo.nameAr.startsWith("سورة") ? surahInfo.nameAr : `سُورَةُ ${surahInfo.nameAr}`}
                  </span>
                </div>
              </div>
              <div className="banner-cartouche ayah-cartouche">
                <span className="cartouche-label arabic-kanz">
                  الآية {toEasternArabicNumerals(ayahNumber)}
                </span>
              </div>
            </div>

            {/* Bismillah Calligraphy Row */}
            {showBismillah && (
              <div className="mushaf-bismillah-row">
                <span className="bismillah-ornament-left">۞</span>
                <span className="bismillah-calligraphy arabic-kanz">
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </span>
                <span className="bismillah-ornament-right">۞</span>
              </div>
            )}

            {/* Prompt Ayah container at top of page */}
            <div className="mushaf-prompt-container">
              <div className="prompt-badge">
                <span className="badge-dot" />
                <span>موضع السؤال — ابدأ التلاوة من هنا:</span>
              </div>
              <div className="prompt-ayah-box arabic-kanz">
                <span className="prompt-text">
                  {formatArabicPromptText(promptAyahText || question?.questionText || "اقرأ من بداية الآية الكريمة")}
                </span>
                <span className="ayah-end-rosette"> ﴿{toEasternArabicNumerals(ayahNumber)}﴾ </span>
              </div>
            </div>

            {/* Mistake Alert Banner (sticks cleanly above the notebook lines) */}
            {(inErrorState || inCorrectionWindow) && (
              <div className={`mushaf-mistake-alert ${inCorrectionWindow ? "red-alert" : "waiting-alert"}`}>
                <div className="alert-icon-wrap">
                  <AlertCircle className="pulse-alert" size={22} />
                </div>
                <div className="alert-text-content">
                  <span className="alert-title">
                    {inCorrectionWindow ? "تنبيه: خطأ في التلاوة — يُرجى التصحيح الآن" : "تم رصد خطأ في الكلمة — توقفت التعبئة"}
                  </span>
                  <span className="alert-detail">
                    الكلمة المطلوبة: <strong className="arabic-kanz expected-word-highlight">{words[currentIndex] || "—"}</strong>
                    {inCorrectionWindow && correctionTimeLeft > 0 && (
                      <span className="correction-countdown"> (بقي للتصحيح: {toEasternArabicNumerals(correctionTimeLeft)} ثوانٍ)</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Ruled Notebook Section matching student workbook */}
            <div className="mushaf-ruled-notebook">
              {lines.map((line) => (
                <div key={line.lineIndex} className="ruled-notebook-line">
                  <div className="ruled-line-content">
                    {line.words.map((item) => {
                      const hasError = item.absIdx === errorIndex && (inErrorState || inCorrectionWindow);
                      const isSuccess = item.isRevealed;
                      const isWaiting = item.isCurrent && !item.isRevealed && !hasError;

                      return (
                        <span
                          key={item.absIdx}
                          className={`ruled-word-slot ${
                            isSuccess
                              ? "word-revealed"
                              : isWaiting
                              ? "word-waiting"
                              : hasError
                              ? "word-error"
                              : "word-blank"
                          }`}
                        >
                          {isSuccess && (
                            <span className="ink-word arabic-kanz">{item.word}</span>
                          )}
                          {hasError && (
                            <span className="error-word-pill arabic-kanz" title="خطأ - يُرجى تصحيح هذه الكلمة">
                              {item.word}
                              <span className="error-flag">خطأ</span>
                            </span>
                          )}
                          {isWaiting && (
                            <span className="active-word-placeholder">
                              <span className="pulse-dot" />
                            </span>
                          )}
                          {!isSuccess && !hasError && !isWaiting && (
                            <span className="blank-line-placeholder" />
                          )}
                        </span>
                      );
                    })}
                    {/* End of ayah ornament at completion */}
                    {line.lineIndex === Math.floor((words.length - 1) / WORDS_PER_LINE) &&
                      revealedIndices.length >= words.length &&
                      words.length > 0 && (
                        <span className="revealed-ayah-rosette arabic-kanz">
                          ۝{toEasternArabicNumerals(ayahNumber)}
                        </span>
                      )}
                  </div>
                  {/* Horizontal ruled notebook line */}
                  <div className="ruled-line-rule" />
                </div>
              ))}
            </div>

            {/* Bottom Page Medallion with Eastern Arabic page number */}
            <div className="mushaf-bottom-medallion-container">
              <div className="mushaf-bottom-medallion">
                <span className="medallion-ornament left">❖</span>
                <span className="medallion-text arabic-kanz">
                  صفحة {toEasternArabicNumerals(page)}
                </span>
                <span className="medallion-ornament right">❖</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PREMIUM HISTORY CARDS MODAL
   Attended Juz Ikhtebar Sessions & Recitation Logs
   ═══════════════════════════════════════════════════════════════════ */

export function HistoryCardsModal({ isOpen, onClose, historyList = [], onDelete, onClearAll }) {
  const [selectedJuzFilter, setSelectedJuzFilter] = useState("all");

  const filteredHistory = useMemo(() => {
    if (selectedJuzFilter === "all") return historyList;
    return historyList.filter((item) => String(item.juz) === String(selectedJuzFilter));
  }, [historyList, selectedJuzFilter]);

  const stats = useMemo(() => {
    if (!historyList.length) return { totalSessions: 0, avgAccuracy: 0, totalDuration: 0, totalMistakes: 0 };
    const totalSessions = historyList.length;
    const totalAcc = historyList.reduce((acc, i) => acc + (i.accuracy || 0), 0);
    const avgAccuracy = Math.round(totalAcc / totalSessions);
    const totalDuration = historyList.reduce((acc, i) => acc + (i.durationSeconds || 0), 0);
    const totalMistakes = historyList.reduce((acc, i) => acc + (i.mistakesCount || 0), 0);
    return {
      totalSessions,
      avgAccuracy,
      totalDuration,
      totalMistakes,
    };
  }, [historyList]);

  if (!isOpen) return null;

  return (
    <div className="history-modal-backdrop" onClick={onClose}>
      <div className="history-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="history-modal-header">
          <div className="header-title-box">
            <div className="history-icon-badge">
              <History size={24} />
            </div>
            <div>
              <h3 className="arabic-kanz">سجل اختبارات الحفظ والتلاوة</h3>
              <p>Attendance & Recitation History Logs</p>
            </div>
          </div>
          <div className="header-actions">
            {historyList.length > 0 && (
              <button
                type="button"
                className="clear-history-btn"
                onClick={() => {
                  if (window.confirm("هل أنت متأكد من مسح جميع سجلات الاختبارات؟")) {
                    onClearAll();
                  }
                }}
                title="مسح السجل بالكامل"
              >
                <Trash2 size={16} />
                <span>مسح السجل</span>
              </button>
            )}
            <button type="button" className="modal-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="history-stats-bar">
          <div className="stat-card">
            <span className="stat-label">إجمالي الاختبارات</span>
            <strong className="stat-num arabic-kanz">{toEasternArabicNumerals(stats.totalSessions)}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">متوسط الدقة</span>
            <strong className="stat-num">{stats.avgAccuracy}%</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">إجمالي وقت التلاوة</span>
            <strong className="stat-num">{formatDuration(stats.totalDuration)}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">إجمالي الأخطاء</span>
            <strong className="stat-num arabic-kanz">{toEasternArabicNumerals(stats.totalMistakes)}</strong>
          </div>
        </div>

        {/* Filter Bar */}
        {historyList.length > 0 && (
          <div className="history-filter-strip">
            <span className="filter-label">
              <Filter size={14} /> تصفية حسب الجزء:
            </span>
            <div className="filter-chips-row">
              <button
                type="button"
                className={`filter-chip ${selectedJuzFilter === "all" ? "active" : ""}`}
                onClick={() => setSelectedJuzFilter("all")}
              >
                الكل ({historyList.length})
              </button>
              {Array.from(new Set(historyList.map((h) => h.juz)))
                .filter(Boolean)
                .sort((a, b) => a - b)
                .map((juz) => (
                  <button
                    key={juz}
                    type="button"
                    className={`filter-chip ${selectedJuzFilter === String(juz) ? "active" : ""}`}
                    onClick={() => setSelectedJuzFilter(String(juz))}
                  >
                    جزء {toEasternArabicNumerals(juz)}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Cards list */}
        <div className="history-cards-container">
          {filteredHistory.length === 0 ? (
            <div className="history-empty-state">
              <Award size={48} className="empty-icon" />
              <h4 className="arabic-kanz">لا توجد سجلات اختبارات حتى الآن</h4>
              <p>عند أداء أي جلسة اختبار في التلاوة والحفظ ستظهر البطاقة التفصيلية هنا تلقائياً.</p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const gradeClass =
                (item.accuracy || 0) >= 90
                  ? "grade-excellent"
                  : (item.accuracy || 0) >= 80
                  ? "grade-vgood"
                  : (item.accuracy || 0) >= 70
                  ? "grade-good"
                  : "grade-practice";

              return (
                <div key={item.id} className={`premium-history-card ${gradeClass}`}>
                  <div className="card-top-row">
                    <div className="card-stage-info">
                      <span className="marhala-tag">{item.marhala || "اختبار حفظ"}</span>
                      <span className="juz-tag arabic-kanz">
                        الجزء {toEasternArabicNumerals(item.juz)}
                      </span>
                      <span className="surah-tag arabic-kanz">{item.surahName}</span>
                      <span className="page-ayah-tag">
                        صفحة {toEasternArabicNumerals(item.page)} • آية {toEasternArabicNumerals(item.ayahNum)}
                      </span>
                    </div>
                    <div className="card-top-right">
                      <span className={`grade-pill ${gradeClass} arabic-kanz`}>
                        {item.grade || "مكتمل"}
                      </span>
                      <button
                        type="button"
                        className="delete-card-btn"
                        onClick={() => onDelete(item.id)}
                        title="حذف هذا السجل"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Question snippet */}
                  {item.questionPrompt && (
                    <div className="card-prompt-quote arabic-kanz">
                      "{item.questionPrompt}"
                    </div>
                  )}

                  {/* Metrics grid */}
                  <div className="card-metrics-grid">
                    <div className="metric-pill">
                      <Clock size={15} className="metric-icon" />
                      <div className="metric-col">
                        <span className="metric-title">مدة التلاوة</span>
                        <strong className="metric-val">{formatDuration(item.durationSeconds)}</strong>
                      </div>
                    </div>
                    <div className="metric-pill">
                      <AlertCircle size={15} className="metric-icon error-icon" />
                      <div className="metric-col">
                        <span className="metric-title">الأخطاء</span>
                        <strong className="metric-val arabic-kanz">
                          {toEasternArabicNumerals(item.mistakesCount || 0)}
                        </strong>
                      </div>
                    </div>
                    <div className="metric-pill">
                      <CheckCircle size={15} className="metric-icon success-icon" />
                      <div className="metric-col">
                        <span className="metric-title">التصحيحات</span>
                        <strong className="metric-val arabic-kanz">
                          {toEasternArabicNumerals(item.correctionsCount || 0)}
                        </strong>
                      </div>
                    </div>
                    <div className="metric-pill">
                      <Target size={15} className="metric-icon accuracy-icon" />
                      <div className="metric-col">
                        <span className="metric-title">الدقة</span>
                        <strong className="metric-val">{item.accuracy || 0}%</strong>
                      </div>
                    </div>
                    <div className="metric-pill">
                      <BookOpen size={15} className="metric-icon" />
                      <div className="metric-col">
                        <span className="metric-title">الكلمات</span>
                        <strong className="metric-val arabic-kanz">
                          {toEasternArabicNumerals(item.wordsRecited || 0)} / {toEasternArabicNumerals(item.wordsTotal || 0)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp footer */}
                  <div className="card-footer-timestamp">
                    <Calendar size={13} />
                    <span>{item.dateStr || new Date(item.timestamp).toLocaleString("ar-SA")}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TILAWAT VIEW — Normal Quran Reading Mode
   ═══════════════════════════════════════════════════════════════════ */

function TilawatView({ onBack }) {
  // 1. Initial Page with Auto-Resume from localStorage
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const savedPage = localStorage.getItem("quran_tilawat_last_page");
      if (savedPage) {
        const p = parseInt(savedPage, 10);
        if (!isNaN(p) && p >= 1 && p <= TOTAL_PAGES) return p;
      }
    } catch {}
    return 1;
  });

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragDistance, setDragDistance] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [urlIndex, setUrlIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showJuzPicker, setShowJuzPicker] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // 2. Hifz ul Quran Dua Modal (Opens first on Tilawat entry, or via center header tab)
  const [showDuaModal, setShowDuaModal] = useState(true);

  // 3. Nishani (Bookmark) State
  const [bookmark, setBookmark] = useState(() => {
    try {
      const saved = localStorage.getItem("quran_tilawat_nishani");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showNishaniModal, setShowNishaniModal] = useState(false);

  // 4. Hifz Mistakes State
  const [mistakesMap, setMistakesMap] = useState(() => {
    try {
      const saved = localStorage.getItem("quran_tilawat_mistakes");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isMarkMode, setIsMarkMode] = useState(false);
  const [showMistakesOverlay, setShowMistakesOverlay] = useState(true);
  const [activeMistakePrompt, setActiveMistakePrompt] = useState(null);
  const [showMistakesDrawer, setShowMistakesDrawer] = useState(false);
  const [activePinDetail, setActivePinDetail] = useState(null);

  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const lastTouchX = useRef(null);

  const currentUrls = useMemo(() => getPageUrls(currentPage), [currentPage]);
  const activeImageUrl = currentUrls[urlIndex] || currentUrls[0];
  const surahInfo = useMemo(() => getSurahByPage(currentPage), [currentPage]);
  const juzNum = useMemo(() => getJuzFromPage(currentPage), [currentPage]);

  // Current page's mistakes
  const pageMistakes = useMemo(() => {
    return mistakesMap[currentPage] || [];
  }, [mistakesMap, currentPage]);

  // Auto-save last page visited
  useEffect(() => {
    try {
      localStorage.setItem("quran_tilawat_last_page", String(currentPage));
    } catch {}
  }, [currentPage]);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setUrlIndex(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setActivePinDetail(null);
  }, [currentPage]);

  const handleImageLoad = () => setImageLoaded(true);
  const handleImageError = () => {
    if (urlIndex < currentUrls.length - 1) setUrlIndex((i) => i + 1);
    else setImageError(true);
  };

  const goNext = useCallback(() => {
    if (currentPage < TOTAL_PAGES) setCurrentPage((p) => p + 1);
  }, [currentPage]);

  const goPrev = useCallback(() => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  }, [currentPage]);

  const handleZoomIn = () => setZoom((z) => Math.min(3, z + 0.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.2));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Page Words & Ayahs detection data for the current page
  const [pageWordsData, setPageWordsData] = useState(null);
  const pageContainerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    fetchQuranPageWords(currentPage).then((data) => {
      if (isMounted) setPageWordsData(data);
    });
    return () => {
      isMounted = false;
    };
  }, [currentPage]);

  // Pointer & Drag Handlers for Panning (when zoomed) OR Selecting Words/Ayahs (when in Mark Mode)
  const [markDragStart, setMarkDragStart] = useState(null);
  const [markDragPreview, setMarkDragPreview] = useState(null);

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragDistance(0);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y, rawX: e.clientX, rawY: e.clientY });
  };
  const handleMouseMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    const dist = Math.hypot(e.clientX - (dragStart.rawX || e.clientX), e.clientY - (dragStart.rawY || e.clientY));
    setDragDistance(dist);
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handlePagePointerDown = (e) => {
    if (!isMarkMode) return;
    const targetElement = pageContainerRef.current || imageRef.current || e.currentTarget;
    const rect = targetElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pctX = ((e.clientX - rect.left) / rect.width) * 100;
    const pctY = ((e.clientY - rect.top) / rect.height) * 100;

    const detected = detectWordOrAyahAt(pctX, pctY, pageWordsData);
    setMarkDragStart({
      x: pctX,
      y: pctY,
      rawX: e.clientX,
      rawY: e.clientY,
      detected,
    });
    setMarkDragPreview(null);
  };

  const handlePagePointerMove = (e) => {
    if (!isMarkMode || !markDragStart) return;
    const targetElement = pageContainerRef.current || imageRef.current || e.currentTarget;
    const rect = targetElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const currentPctX = ((e.clientX - rect.left) / rect.width) * 100;
    const dist = Math.abs(e.clientX - markDragStart.rawX);

    if (dist > 10) {
      const phrase = detectMultiWordPhrase(
        markDragStart.x,
        currentPctX,
        markDragStart.y,
        pageWordsData
      );
      setMarkDragPreview({
        x: phrase.x,
        y: phrase.y - 2.1,
        width: phrase.width,
        height: 4.3,
        phrase,
      });
    }
  };

  const handlePagePointerUp = (e) => {
    if (!isMarkMode || !markDragStart) return;
    const targetElement = pageContainerRef.current || imageRef.current || e.currentTarget;
    const rect = targetElement.getBoundingClientRect();
    const currentPctX = rect.width
      ? ((e.clientX - rect.left) / rect.width) * 100
      : markDragStart.x;
    const dist = Math.abs(e.clientX - markDragStart.rawX);

    if (dist > 14) {
      // User dragged across multiple words on the line
      const phrase = detectMultiWordPhrase(
        markDragStart.x,
        currentPctX,
        markDragStart.y,
        pageWordsData
      );
      setActiveMistakePrompt({
        x: phrase.x,
        y: phrase.y,
        width: phrase.width,
        selectedText: phrase.selectedText,
        verseKey: phrase.verseKey,
        scope: phrase.scope,
      });
    } else {
      // User tapped on word or ayah stop circle
      const detected =
        markDragStart.detected ||
        detectWordOrAyahAt(markDragStart.x, markDragStart.y, pageWordsData);
      setActiveMistakePrompt({
        x: detected.x,
        y: detected.y,
        width: detected.width,
        selectedText: detected.selectedText,
        verseKey: detected.verseKey,
        scope: detected.scope,
      });
    }
    setMarkDragStart(null);
    setMarkDragPreview(null);
  };

  const handleResizeMistake = (mistakeId, delta) => {
    setMistakesMap((prev) => {
      const list = prev[currentPage] || [];
      const updated = list.map((m) => {
        if (m.id === mistakeId) {
          const newW = Math.max(8, Math.min(78, (m.width || 14) + delta));
          return { ...m, width: newW };
        }
        return m;
      });
      const res = { ...prev, [currentPage]: updated };
      try {
        localStorage.setItem("quran_tilawat_mistakes", JSON.stringify(res));
      } catch {}
      return res;
    });
  };

  // Swipe to navigate
  const handleTouchStart = (e) => {
    if (isMarkMode) return;
    if (e.touches.length === 1) lastTouchX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (isMarkMode) return;
    if (lastTouchX.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const diff = endX - lastTouchX.current;
    lastTouchX.current = null;
    if (Math.abs(diff) > 60) {
      if (diff < 0) goNext();
      else goPrev();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, isFullscreen]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen && containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else if (isFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen((f) => !f);
  }, [isFullscreen]);

  // Bookmark Handlers
  const handleSetBookmark = (bmarkData) => {
    setBookmark(bmarkData);
    try {
      localStorage.setItem("quran_tilawat_nishani", JSON.stringify(bmarkData));
    } catch {}
  };

  const handleRemoveBookmark = () => {
    setBookmark(null);
    try {
      localStorage.removeItem("quran_tilawat_nishani");
    } catch {}
  };

  const handleJumpToBookmark = (targetPage) => {
    if (targetPage >= 1 && targetPage <= TOTAL_PAGES) {
      setCurrentPage(targetPage);
    }
  };

  // Mistakes Handlers
  const handleSaveMistake = (mistakeData) => {
    setMistakesMap((prev) => {
      const currentList = prev[currentPage] || [];
      const updated = {
        ...prev,
        [currentPage]: [...currentList, mistakeData],
      };
      try {
        localStorage.setItem("quran_tilawat_mistakes", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setActiveMistakePrompt(null);
  };

  const handleDeleteMistake = (mistakeId) => {
    setMistakesMap((prev) => {
      const currentList = prev[currentPage] || [];
      const updated = {
        ...prev,
        [currentPage]: currentList.filter((m) => m.id !== mistakeId),
      };
      try {
        localStorage.setItem("quran_tilawat_mistakes", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (activePinDetail?.id === mistakeId) {
      setActivePinDetail(null);
    }
  };

  const handleClearAllPageMistakes = () => {
    setMistakesMap((prev) => {
      const updated = { ...prev };
      delete updated[currentPage];
      try {
        localStorage.setItem("quran_tilawat_mistakes", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setActivePinDetail(null);
  };

  const pad = String(currentPage).padStart(3, "0");
  const isPageBookmarked = bookmark && bookmark.page === currentPage;

  return (
    <div
      className={`ikhtebar-mushaf-container ${isFullscreen ? "fullscreen-mode" : ""}`}
      ref={containerRef}
    >
      {/* Header — hidden in fullscreen */}
      {!isFullscreen && (
        <div className="ikhtebar-header">
          <div className="header-left">
            <button className="back-btn" onClick={onBack} title="Back">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="arabic-kanz">تلاوة القرآن</h1>
              <p className="header-subtitle">Tilawat — Read & Memorize the Quran</p>
            </div>
          </div>
          <div className="header-right">
            <button
              type="button"
              className="tilawat-search-btn"
              onClick={() => setShowSearchModal(true)}
              title="البحث في السور والأجزاء"
            >
              <Search size={18} />
              <span className="arabic-kanz search-btn-label">البحث والتنقل</span>
            </button>
            <div className="session-status">
              <span className="status-dot active" />
              <span>Page {currentPage} of {TOTAL_PAGES}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div
        className="ikhtebar-main"
        style={{ padding: isFullscreen ? 0 : undefined, gap: isFullscreen ? 0 : undefined }}
      >
        <div className={`ikhtebar-blank-page-viewer ${isFullscreen ? "fullscreen" : ""}`}>
          {/* Page header — hidden in fullscreen */}
          {!isFullscreen && (
            <div className="blank-page-header">
              <div className="page-meta">
                <span className="surah-name arabic-kanz">{surahInfo.nameAr}</span>
                <span className="page-num">صفحة {currentPage}</span>
                <span className="juz-num">الجزء {juzNum}</span>
              </div>

              {/* CENTER TAB: Hifz ul Quran Dua */}
              <div className="blank-page-header-center">
                <button
                  type="button"
                  className="hifz-dua-header-tab"
                  onClick={() => setShowDuaModal(true)}
                  title="دعاء حفظ القرآن الكريم"
                >
                  <span className="arabic-kanz hifz-dua-text">دعاء حفظ القرآن الكريم</span>
                </button>
              </div>

              <div className="zoom-controls">
                {/* Nishani / Bookmark Button */}
                <button
                  type="button"
                  className={`zoom-btn nishani-header-btn ${isPageBookmarked ? "marked" : ""}`}
                  style={
                    isPageBookmarked
                      ? {
                          borderColor: bookmark.color,
                          color: bookmark.color,
                          boxShadow: `0 0 10px ${bookmark.color}40`,
                        }
                      : {}
                  }
                  onClick={() => setShowNishaniModal(true)}
                  title={
                    isPageBookmarked
                      ? `علامة التوقف محفوظة (صفحة ${currentPage})`
                      : "وضع علامة المصحف (Nishani)"
                  }
                >
                  <Bookmark
                    size={16}
                    fill={isPageBookmarked ? bookmark.color : "none"}
                    color={isPageBookmarked ? bookmark.color : "#5d4037"}
                  />
                </button>

                {/* Select & Highlight Mode Button */}
                <button
                  type="button"
                  className={`zoom-btn mark-mode-btn ${isMarkMode ? "active-marking" : ""}`}
                  onClick={() => setIsMarkMode(!isMarkMode)}
                  title={
                    isMarkMode
                      ? "إيقاف وضع التحديد والتظليل"
                      : "تحديد وتظليل أخطاء التلاوة والحفظ (كلمة أو آية)"
                  }
                >
                  <Highlighter size={16} />
                  {pageMistakes.length > 0 && (
                    <span className="mistakes-badge-count">{pageMistakes.length}</span>
                  )}
                </button>

                {/* Mistakes Eye Toggle */}
                {pageMistakes.length > 0 && (
                  <button
                    type="button"
                    className="zoom-btn eye-toggle-btn"
                    onClick={() => setShowMistakesOverlay(!showMistakesOverlay)}
                    title={showMistakesOverlay ? "إخفاء أخطاء الصفحة" : "إظهار أخطاء الصفحة"}
                  >
                    {showMistakesOverlay ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                )}

                <button className="zoom-btn" onClick={handleZoomOut} disabled={zoom <= 0.5}>
                  <ZoomOut size={16} />
                </button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button className="zoom-btn" onClick={handleZoomIn} disabled={zoom >= 3}>
                  <ZoomIn size={16} />
                </button>
                <button className="zoom-btn reset" onClick={handleZoomReset}>
                  <RotateCcw size={16} />
                </button>
                <button className="zoom-btn" onClick={toggleFullscreen} title="Fullscreen">
                  <Maximize size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Interactive Select & Mark Mode Banner */}
          {!isFullscreen && isMarkMode && (
            <div className="tilawat-mark-mode-banner">
              <div className="banner-left">
                <Highlighter size={16} className="pulse-pencil" />
                <span className="arabic-kanz">
                  وضع التحديد والتظليل مُفعّل • انقر لتحديد كلمة أو اسحب لتحديد كلمات، أو انقر على رقم/رمز الآية ۝ لتحديد الآية كاملة
                </span>
              </div>
              <button
                type="button"
                className="banner-exit-btn"
                onClick={() => setIsMarkMode(false)}
              >
                إنهاء التحديد
              </button>
            </div>
          )}

          {/* Saved Bookmark Jump Banner (if marked on another page) */}
          {!isFullscreen && !isMarkMode && bookmark && bookmark.page !== currentPage && (
            <div
              className="tilawat-resume-banner"
              onClick={() => handleJumpToBookmark(bookmark.page)}
            >
              <div className="resume-left">
                <Bookmark
                  size={15}
                  color={bookmark.color || "#10b981"}
                  fill={bookmark.color || "#10b981"}
                />
                <span className="arabic-kanz">
                  لديك علامة توقف محفوظة في <strong>صفحة {bookmark.page}</strong> (
                  {bookmark.surahName || `الجزء ${bookmark.juz}`})
                </span>
              </div>
              <button type="button" className="resume-jump-action">
                الانتقال إليها
              </button>
            </div>
          )}

          {/* Canvas */}
          <div
            className={`blank-page-canvas ${isMarkMode ? "mark-cursor" : ""}`}
            onMouseDown={!isMarkMode ? handleMouseDown : undefined}
            onMouseMove={!isMarkMode ? handleMouseMove : undefined}
            onMouseUp={!isMarkMode ? handleMouseUp : undefined}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              cursor: isMarkMode
                ? "crosshair"
                : zoom > 1
                ? isDragging
                  ? "grabbing"
                  : "grab"
                : "default",
            }}
          >
            {!imageLoaded && !imageError && (
              <div className="blank-page-loading">
                <div className="spinner" />
                <span>Loading Page {currentPage}…</span>
              </div>
            )}
            {imageError && (
              <div className="blank-page-error">
                <BookOpen size={48} />
                <h4>Unable to load Page {currentPage}</h4>
                <p className="arabic-kanz">{surahInfo.nameAr} — صفحة {currentPage}</p>
                <button
                  className="retry-btn"
                  onClick={() => {
                    setImageError(false);
                    setImageLoaded(false);
                    setUrlIndex(0);
                  }}
                >
                  <RotateCcw size={16} /> Retry
                </button>
              </div>
            )}

            <div
              className={`blank-page-image-wrapper ${imageLoaded ? "loaded" : ""}`}
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: "top center",
              }}
            >
              {/* Tightly bound container matching EXACT rendered image bounds */}
              <div
                ref={pageContainerRef}
                className={`mushaf-rendered-page-container ${isMarkMode ? "select-mode-active" : ""}`}
                onPointerDown={handlePagePointerDown}
                onPointerMove={handlePagePointerMove}
                onPointerUp={handlePagePointerUp}
              >
                <img
                  ref={imageRef}
                  src={activeImageUrl}
                  alt={`Quran Page ${currentPage}`}
                  className="blank-page-image"
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  draggable={false}
                />

                {/* Silk Bookmark Ribbon (Nishani) hanging over the page */}
                {isPageBookmarked && (
                  <div
                    className="mushaf-hanging-ribbon"
                    style={{ "--ribbon-color": bookmark.color || "#10b981" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNishaniModal(true);
                    }}
                    title={`علامة القراءة • صفحة ${currentPage}`}
                  >
                    <div className="ribbon-tail">
                      <span className="ribbon-star">۞</span>
                      <span className="ribbon-text arabic-kanz">علامة</span>
                      <span className="ribbon-page-num arabic-kanz">{currentPage}</span>
                    </div>
                    <div className="ribbon-chevron" />
                  </div>
                )}

                {/* Live Drawing Preview when dragging with marker pen */}
                {markDragPreview && (
                  <div
                    className="mushaf-highlighter-preview"
                    style={{
                      left: `${markDragPreview.x}%`,
                      top: `${markDragPreview.y}%`,
                      width: `${markDragPreview.width}%`,
                      height: `${markDragPreview.height}%`,
                    }}
                  >
                    <div className="preview-pencil-tip">✏️</div>
                  </div>
                )}

                {/* Interactive Translucent Highlighter Markers on the Quran Page */}
                {showMistakesOverlay &&
                  pageMistakes.map((m) => {
                    const typesList =
                      Array.isArray(m.types) && m.types.length > 0
                        ? m.types
                        : [m.type || "Talqeen"];
                    const typeObjs = typesList.map(
                      (tId) =>
                        MISTAKE_TYPES.find((t) => t.id === tId) || MISTAKE_TYPES[0]
                    );
                    const primaryType = typeObjs[0];
                    const isSelected = activePinDetail?.id === m.id;
                    const w = m.width || (m.scope === "ayah" ? 75 : 14);
                    const h = m.height || 4.3;
                    const x = Math.max(10, Math.min(90 - w, m.x));
                    const y = Math.max(5, Math.min(92, m.y));
                    const bubbleAlignClass =
                      x < 28 ? "align-left" : x > 65 ? "align-right" : "align-center";

                    // Multi-tone or single pastel wash
                    const tintBackground =
                      typeObjs.length > 1
                        ? `linear-gradient(90deg, ${typeObjs
                            .map((t) => t.hlBg)
                            .join(", ")})`
                        : primaryType.hlBg;
                    const borderBottomColor = primaryType.color;

                    return (
                      <div
                        key={m.id}
                        className={`mushaf-highlighter-marker ${isSelected ? "hl-selected" : ""}`}
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          width: `${w}%`,
                          height: `${h}%`,
                          "--hl-color": tintBackground,
                          "--hl-border": borderBottomColor,
                          "--hl-glow": primaryType.hlGlow,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePinDetail(isSelected ? null : m);
                        }}
                        title={`${typeObjs.map((t) => t.labelAr).join(" • ")}${
                          m.harf ? ` (حرف: ${m.harf})` : ""
                        } (${
                          m.scope === "word"
                            ? "كلمة"
                            : m.scope === "phrase"
                            ? "كلمات"
                            : "آية كاملة"
                        })${m.selectedText ? ": " + m.selectedText : ""}${
                          m.note ? " • " + m.note : ""
                        }`}
                      >
                        {/* Translucent Tint Layer with multiply blend mode over the Quran text */}
                        <div
                          className="hl-marker-tint"
                          style={{
                            background: tintBackground,
                            borderBottomColor: borderBottomColor,
                          }}
                        />

                        {/* Animated Sweep Highlighter Stroke */}
                        <div className="hl-stroke" />

                        {/* Floating Tag Badges Row above the highlighted word */}
                        <div
                          className="hl-tag-badges-row"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePinDetail(isSelected ? null : m);
                          }}
                        >
                          {typeObjs.map((tObj) => (
                            <span
                              key={tObj.id}
                              className="hl-tag-badge"
                              style={{ backgroundColor: tObj.color }}
                            >
                              <span className="hl-tag-icon">{tObj.icon}</span>
                              <span className="hl-tag-name arabic-kanz">
                                {tObj.labelAr}
                              </span>
                            </span>
                          ))}
                          {m.harf && (
                            <span className="hl-tag-badge harf-tag-badge arabic-kanz">
                              حرف: {m.harf}
                            </span>
                          )}
                        </div>

                        {/* Detail Bubble Popover when clicked */}
                        {isSelected && (
                          <div
                            className={`hl-detail-bubble ${bubbleAlignClass}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="bubble-head-types">
                              {typeObjs.map((tObj) => (
                                <span
                                  key={tObj.id}
                                  className="bubble-type-pill arabic-kanz"
                                  style={{
                                    backgroundColor: tObj.color,
                                    color: "#ffffff",
                                  }}
                                >
                                  {tObj.icon} {tObj.labelAr}
                                </span>
                              ))}
                              <span className="bubble-scope">
                                {m.scope === "word"
                                  ? "تظليل كلمة"
                                  : m.scope === "phrase"
                                  ? "تظليل كلمات"
                                  : "تظليل آية كاملة"}
                              </span>
                            </div>

                            {/* Exact selected word or ayah text */}
                            {m.selectedText && (
                              <div className="bubble-selected-text arabic-kanz">
                                «{m.selectedText}»
                              </div>
                            )}

                            {/* Specified Letter / Harf */}
                            {m.harf && (
                              <div className="bubble-harf-row arabic-kanz">
                                <span className="bubble-harf-label">
                                  الحرف المعني:
                                </span>
                                <span className="bubble-harf-tag">
                                  {m.harf}
                                </span>
                              </div>
                            )}

                            {m.verseKey && (
                              <div className="bubble-verse-key arabic-kanz">
                                {m.verseKey}
                              </div>
                            )}

                            {m.note && (
                              <p className="bubble-note arabic-kanz">{m.note}</p>
                            )}

                            {/* Quick resize handles */}
                            <div className="bubble-resize-bar">
                              <span className="resize-lbl">عرض التظليل:</span>
                              <button
                                type="button"
                                className="resize-btn"
                                onClick={() => handleResizeMistake(m.id, -4)}
                                title="تقصير التظليل"
                              >
                                -
                              </button>
                              <span className="resize-val">{Math.round(w)}%</span>
                              <button
                                type="button"
                                className="resize-btn"
                                onClick={() => handleResizeMistake(m.id, 4)}
                                title="توسيع التظليل"
                              >
                                +
                              </button>
                            </div>

                            <div className="bubble-footer">
                              <button
                                type="button"
                                className="bubble-del-btn"
                                onClick={() => handleDeleteMistake(m.id)}
                              >
                                <Trash2 size={13} /> حذف التظليل
                              </button>
                              <button
                                type="button"
                                className="bubble-close-btn"
                                onClick={() => setActivePinDetail(null)}
                              >
                                إغلاق
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Navigation arrows */}
            <button
              className="fs-nav-btn fs-prev"
              onClick={goPrev}
              disabled={currentPage <= 1}
            >
              <ChevronLeft size={32} />
            </button>
            <button
              className="fs-nav-btn fs-next"
              onClick={goNext}
              disabled={currentPage >= TOTAL_PAGES}
            >
              <ChevronRight size={32} />
            </button>
          </div>

          {/* Bottom bar — page number input, bookmark, mistakes, & fullscreen */}
          {!isFullscreen && (
            <div className="tilawat-bottom-bar">
              <button
                className="tilawat-page-btn"
                onClick={goPrev}
                disabled={currentPage <= 1}
              >
                <ArrowLeft size={18} />
              </button>
              <div className="tilawat-page-display">
                <span className="tilawat-page-label">صفحة</span>
                <span className="tilawat-page-num arabic-kanz">{currentPage}</span>
                <span className="tilawat-page-of">/ {TOTAL_PAGES}</span>
              </div>
              <button
                className="tilawat-page-btn"
                onClick={goNext}
                disabled={currentPage >= TOTAL_PAGES}
              >
                <ArrowRight size={18} />
              </button>

              {/* Quick Nishani button */}
              <button
                type="button"
                className={`tilawat-bottom-tool-btn ${isPageBookmarked ? "marked" : ""}`}
                style={
                  isPageBookmarked
                    ? { borderColor: bookmark.color, color: bookmark.color }
                    : {}
                }
                onClick={() => setShowNishaniModal(true)}
                title="علامة المصحف (Nishani)"
              >
                <Bookmark
                  size={16}
                  fill={isPageBookmarked ? bookmark.color : "none"}
                  color={isPageBookmarked ? bookmark.color : "currentColor"}
                />
                <span className="arabic-kanz">العلامة</span>
              </button>

              {/* Quick Mistakes button */}
              <button
                type="button"
                className={`tilawat-bottom-tool-btn ${pageMistakes.length > 0 ? "has-mistakes" : ""}`}
                onClick={() => setShowMistakesDrawer(true)}
                title="أخطاء الحفظ والتلاوة"
              >
                <Edit3 size={16} />
                <span className="arabic-kanz">الأخطاء</span>
                {pageMistakes.length > 0 && (
                  <span className="bottom-mistakes-badge">{pageMistakes.length}</span>
                )}
              </button>

              <button
                className="tilawat-page-btn fullscreen-btn"
                onClick={toggleFullscreen}
                title="Fullscreen Mode"
              >
                <Maximize size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Juz quick picker (when not fullscreen) */}
        {showJuzPicker && !isFullscreen && (
          <div className="tilawat-juz-picker">
            <div className="juz-picker-header">
              <span>Jump to Juz</span>
              <button className="icon-btn" onClick={() => setShowJuzPicker(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="juz-grid">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                <button
                  key={j}
                  className={`juz-btn ${juzNum === j ? "selected" : ""}`}
                  onClick={() => {
                    setCurrentPage(getJuzStartPage(j));
                    setShowJuzPicker(false);
                  }}
                >
                  <span className="juz-num-ar arabic-kanz">الجزء</span>
                  <span className="juz-num arabic-kanz">{j}</span>
                  <span className="juz-page">Page {getJuzStartPage(j)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions when not fullscreen */}
        {!isFullscreen && (
          <div className="tilawat-quick-actions">
            <button
              className="tilawat-action-btn search-action"
              onClick={() => setShowSearchModal(true)}
            >
              <Search size={18} />
              <span>البحث في السور والأجزاء</span>
            </button>
            <button
              className="tilawat-action-btn"
              onClick={() => setShowJuzPicker(!showJuzPicker)}
            >
              <BookMarked size={18} />
              <span>قائمة الأجزاء</span>
            </button>
            <button
              className="tilawat-action-btn"
              onClick={() => setShowNishaniModal(true)}
            >
              <Bookmark size={18} />
              <span>علامة المصحف (Nishani)</span>
            </button>
            <button
              className="tilawat-action-btn"
              onClick={() => setShowMistakesDrawer(true)}
            >
              <Edit3 size={18} />
              <span>سجل الأخطاء ({pageMistakes.length})</span>
            </button>
            <button className="tilawat-action-btn" onClick={toggleFullscreen}>
              <Maximize size={18} />
              <span>ملء الشاشة</span>
            </button>
          </div>
        )}
      </div>

      {/* Fullscreen floating controls */}
      {isFullscreen && (
        <div className="fs-floating-controls">
          <button className="fs-ctrl-btn" onClick={onBack}>
            <ArrowLeft size={20} /> Back
          </button>
          <span className="fs-page-info arabic-kanz">
            {surahInfo.nameAr} — صفحة {currentPage}
          </span>
          <button
            className="fs-ctrl-btn"
            onClick={() => setShowDuaModal(true)}
            title="دعاء حفظ القرآن الكريم"
          >
            <BookOpen size={18} /> دعاء حفظ القرآن الكريم
          </button>
          <button
            className="fs-ctrl-btn"
            onClick={() => setShowNishaniModal(true)}
            title="علامة المصحف"
          >
            <Bookmark size={18} /> العلامة
          </button>
          <button className="fs-ctrl-btn" onClick={toggleFullscreen}>
            <Minimize size={20} /> Exit Full
          </button>
        </div>
      )}

      {/* 1. Hifz ul Quran Dua Modal */}
      <HifzDuaModal
        isOpen={showDuaModal}
        onClose={() => setShowDuaModal(false)}
      />

      {/* 2. Nishani / Bookmark Modal */}
      <TilawatNishaniModal
        isOpen={showNishaniModal}
        onClose={() => setShowNishaniModal(false)}
        currentPage={currentPage}
        surahName={surahInfo.nameAr}
        juzNum={juzNum}
        currentBookmark={bookmark}
        onSetBookmark={handleSetBookmark}
        onRemoveBookmark={handleRemoveBookmark}
        onJumpToBookmark={handleJumpToBookmark}
      />

      {/* 3. Mark Mistake Popover (When clicking the page in Mark Mode) */}
      <TilawatMistakePopover
        promptPos={activeMistakePrompt}
        currentPage={currentPage}
        onSave={handleSaveMistake}
        onCancel={() => setActiveMistakePrompt(null)}
      />

      {/* 4. Page Mistakes Drawer */}
      <TilawatMistakesDrawer
        isOpen={showMistakesDrawer}
        onClose={() => setShowMistakesDrawer(false)}
        currentPage={currentPage}
        mistakes={pageMistakes}
        onDeleteMistake={handleDeleteMistake}
        onClearAllPageMistakes={handleClearAllPageMistakes}
        onSelectMistake={(m) => setActivePinDetail(m)}
      />

      {/* 5. Search Modal */}
      <TilawatSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectPage={(p) => {
          setCurrentPage(p);
          setShowSearchModal(false);
        }}
        currentPage={currentPage}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SELECTION FLOW
   ═══════════════════════════════════════════════════════════════════ */

export function IkhtebarSelectionFlow({ onStart }) {
  const [step, setStep] = useState(1);
  const [selectedMarhala, setSelectedMarhala] = useState("Marhala Ula");
  const [selectedJuz, setSelectedJuz] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastPolled, setLastPolled] = useState(null);
  const [error, setError] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(0);

  const availableJuz = useMemo(
    () => MARHALA_JUZ_MAP[selectedMarhala] || [30],
    [selectedMarhala],
  );

  useEffect(() => {
    if (availableJuz.length > 0 && !availableJuz.includes(selectedJuz)) {
      setSelectedJuz(availableJuz[0]);
    }
  }, [availableJuz, selectedJuz]);

  const fetchCSV = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${CSV_URL}&_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csvText = await res.text();
      const { entries, byJuz } = parseIkhtebarCSV(csvText);
      if (entries.length > 0) {
        setCsvData(byJuz);
        setTotalQuestions(entries.length);
      } else {
        throw new Error("No valid data");
      }
      setLastPolled(new Date().toISOString());
    } catch (err) {
      setError("Could not load questions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCSV();
    const id = setInterval(fetchCSV, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchCSV]);

  const handleNext = () => {
    if (step === 1 && selectedMarhala) setStep(2);
    else if (step === 2 && selectedJuz) {
      const jq = csvData?.[selectedJuz] || [];
      onStart({
        marhala: selectedMarhala,
        juz: selectedJuz,
        question: jq.length > 0 ? jq[0] : null,
        allJuzQuestions: jq,
        csvData,
      });
    }
  };

  const marhalaOptions = Object.keys(MARHALA_JUZ_MAP);

  return (
    <div className="ikhtebar-selection-flow">
      <div className="ikhtebar-step-indicator">
        <div className={`step ${step >= 1 ? "active" : ""}`}>
          <span className="step-num">1</span>
          <span className="step-label">Marhala</span>
        </div>
        <div className="step-connector" />
        <div className={`step ${step >= 2 ? "active" : ""}`}>
          <span className="step-num">2</span>
          <span className="step-label">Juz</span>
        </div>
        <div className="step-connector" />
        <div className="step">
          <span className="step-num">3</span>
          <span className="step-label">Ikhtebar</span>
        </div>
      </div>

      <div className="ikhtebar-step-content">
        {step === 1 && (
          <div className="selection-card">
            <div className="selection-card-header">
              <div className="selection-icon-box"><BookOpen size={24} /></div>
              <div>
                <h3 className="selection-title arabic-kanz">اختر المرحلة</h3>
                <p className="selection-subtitle">Select your memorization stage</p>
              </div>
            </div>
            <div className="marhala-grid">
              {marhalaOptions.map((m) => (
                <button key={m} className={`marhala-btn ${selectedMarhala === m ? "selected" : ""}`} onClick={() => setSelectedMarhala(m)}>
                  <span className="marhala-num-ar arabic-kanz">{MARHALA_NUM_AR[m]}</span>
                  <span className="marhala-name arabic-kanz">{m}</span>
                  <span className="marhala-range">{MARHALA_JUZ_MAP[m].length === 30 ? "All 30 Juz" : `${MARHALA_JUZ_MAP[m].length} Juz`}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="selection-card">
            <div className="selection-card-header">
              <div className="selection-icon-box"><Target size={24} /></div>
              <div>
                <h3 className="selection-title arabic-kanz">اختر الجزء</h3>
                <p className="selection-subtitle">{selectedMarhala} — Select Juz</p>
              </div>
            </div>
            <div className="juz-grid">
              {availableJuz.map((j) => {
                const qc = csvData?.[j]?.length || 0;
                return (
                  <button key={j} className={`juz-btn ${selectedJuz === j ? "selected" : ""} ${qc === 0 ? "no-data" : ""}`} onClick={() => setSelectedJuz(j)}>
                    <span className="juz-num-ar arabic-kanz">الجزء</span>
                    <span className="juz-num arabic-kanz">{j}</span>
                    <span className="juz-page">Page {getJuzStartPage(j)}</span>
                    {qc > 0 && <span className="juz-q-count">{qc} q</span>}
                  </button>
                );
              })}
            </div>
            {loading && <div className="loading-overlay"><RotateCcw className="spin" size={24} /> Loading...</div>}
            {error && <div className="error-banner"><AlertCircle size={16} /> {error}</div>}
          </div>
        )}
      </div>

      <div className="ikhtebar-nav">
        {step === 2 && <button className="nav-btn secondary" onClick={() => setStep(1)} disabled={loading}><ArrowLeft size={18} /> Back</button>}
        <button className={`nav-btn primary ${loading ? "loading" : ""}`} onClick={handleNext} disabled={loading || (step === 2 && !selectedJuz)}>
          {loading ? <><RotateCcw className="spin" size={18} /> Loading...</> : step === 1 ? <>Next <ArrowRight size={18} /></> : <><Target size={18} /> Start Ikhtebar</>}
        </button>
      </div>

      <div className="ikhtebar-status-bar">
        <div className="status-item"><span className="pulse">●</span><span>Auto-refresh: 1 min</span></div>
        <div className="status-item"><Clock size={14} /><span>Last: {lastPolled ? new Date(lastPolled).toLocaleTimeString() : "Never"}</span></div>
        <div className="status-item"><span className="questions-count">{totalQuestions} questions</span></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   QURAN PAGE VIEWER — Blank page with optional image
   ═══════════════════════════════════════════════════════════════════ */

function QuranPageViewer({
  page,
  words = [],
  fullAyah = "",
  revealedIndices = [],
  currentIndex = 0,
  errorIndex = -1,
  showWaqf = true,
  ikhtebarActive = false,
  isFullscreen = false,
  onPageLoad,
  onPrevPage,
  onNextPage,
  showPageImage = false,
  question = null,
  inErrorState = false,
  inCorrectionWindow = false,
  correctionTimeLeft = 0,
  isListening = false,
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [urlIndex, setUrlIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const lastTouchX = useRef(null);

  const currentUrls = useMemo(() => getPageUrls(page), [page]);
  const activeImageUrl = currentUrls[urlIndex] || currentUrls[0];
  const surahInfo = useMemo(() => getSurahByPage(page), [page]);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setUrlIndex(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [page]);

  const handleImageLoad = () => { setImageLoaded(true); onPageLoad?.(); };
  const handleImageError = () => {
    if (urlIndex < currentUrls.length - 1) setUrlIndex((i) => i + 1);
    else setImageError(true);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(3, z + 0.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.2));
  const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleMouseDown = (e) => { if (zoom <= 1) return; setIsDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); };
  const handleMouseMove = (e) => { if (!isDragging || zoom <= 1) return; setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
  const handleMouseUp = () => setIsDragging(false);

  // Swipe to navigate pages
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      lastTouchX.current = e.touches[0].clientX;
    }
  };
  const handleTouchEnd = (e) => {
    if (lastTouchX.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const diff = endX - lastTouchX.current;
    lastTouchX.current = null;
    if (Math.abs(diff) > 60) {
      if (diff < 0) onNextPage?.();
      else onPrevPage?.();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight") onNextPage?.();
      else if (e.key === "ArrowLeft") onPrevPage?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNextPage, onPrevPage]);

  // Word positions
  const getWordPositions = useCallback(() => {
    if (!imageRef.current || !words.length) return [];
    const rect = imageRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    const usableWidth = rect.width * 0.8;
    const startY = rect.height * 0.15;
    const lineHeight = 34;
    return words.map((word, idx) => {
      const isRevealed = revealedIndices.includes(idx);
      const isCurrent = idx === currentIndex;
      const isError = idx === errorIndex;
      const wordsPerLine = 6;
      const line = Math.floor(idx / wordsPerLine);
      const posInLine = idx % wordsPerLine;
      const x = rect.width * 0.1 + ((posInLine + 0.5) / wordsPerLine) * usableWidth;
      const y = startY + line * lineHeight;
      return { word, idx, isRevealed, isCurrent, isError, x, y };
    });
  }, [words, revealedIndices, currentIndex, errorIndex]);
  const wordPositions = getWordPositions();

  return (
    <div className={`ikhtebar-blank-page-viewer ${isFullscreen ? "fullscreen" : ""}`} ref={containerRef}>
      {/* Header bar — hidden in fullscreen */}
      {!isFullscreen && (
        <div className="blank-page-header">
          <div className="page-meta">
            <span className="surah-name arabic-kanz">{surahInfo.nameAr}</span>
            <span className="page-num">صفحة {page}</span>
            <span className="juz-num">الجزء {getJuzFromPage(page)}</span>
          </div>
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={handleZoomOut} disabled={zoom <= 0.5}><ZoomOut size={16} /></button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={handleZoomIn} disabled={zoom >= 3}><ZoomIn size={16} /></button>
            <button className="zoom-btn reset" onClick={handleZoomReset}><RotateCcw size={16} /></button>
          </div>
        </div>
      )}

      {/* Main Page: Either Authentic Ruled Physical Blank Page OR Image Canvas */}
      {ikhtebarActive && !showPageImage ? (
        <MushafBlankPageView
          page={page}
          question={question}
          words={words}
          revealedIndices={revealedIndices}
          currentIndex={currentIndex}
          errorIndex={errorIndex}
          inErrorState={inErrorState}
          inCorrectionWindow={inCorrectionWindow}
          correctionTimeLeft={correctionTimeLeft}
          isListening={isListening}
        />
      ) : (
        <div
          className="blank-page-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        {!imageLoaded && !imageError && (
          <div className="blank-page-loading"><div className="spinner" /><span>Loading Page {page}…</span></div>
        )}
        {imageError && (
          <div className="blank-page-error">
            <BookOpen size={48} />
            <h4>Unable to load Page {page}</h4>
            <button className="retry-btn" onClick={() => { setImageError(false); setImageLoaded(false); setUrlIndex(0); }}><RotateCcw size={16} /> Retry</button>
          </div>
        )}

        <div
          className={`blank-page-image-wrapper ${imageLoaded ? "loaded" : ""}`}
          style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`, transformOrigin: "top center" }}
        >
          {/* Actual Quran page image */}
          <img
            ref={imageRef}
            src={activeImageUrl}
            alt={`Quran Page ${page}`}
            className={`blank-page-image ${ikhtebarActive ? "ikhtebar-active" : ""}`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            draggable={false}
          />

          {/* White overlay to HIDE the ayah text — page appears blank */}
          {imageLoaded && (
            <div className={`page-blank-overlay ${showPageImage ? "revealed" : ""}`}>
              {!showPageImage && (
                <div className="blank-page-hint">
                  <BookOpen size={32} />
                  <span>Page {page}</span>
                </div>
              )}
            </div>
          )}

          {/* Waqf markers */}
          {imageLoaded && showWaqf && (
            <div className="blank-page-overlay"><div className="waqf-markers" /></div>
          )}

          {/* Word markers — only during ikhtebar */}
          {ikhtebarActive && imageLoaded && (
            <div className="blank-page-overlay">
              {wordPositions.map((pos) => (
                <div key={pos.idx} className={`word-marker ${pos.isRevealed ? "revealed" : pos.isCurrent ? "current" : "hidden"} ${pos.isError ? "error" : ""}`} style={{ left: `${pos.x}px`, top: `${pos.y}px` }}>
                  <span className="word-text arabic-kanz">{pos.word}</span>
                  {pos.isCurrent && !pos.isRevealed && <span className="current-indicator" />}
                  {pos.isError && <span className="error-indicator" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fullscreen navigation arrows */}
        {isFullscreen && (
          <>
            <button className="fs-nav-btn fs-prev" onClick={onPrevPage}><ChevronLeft size={32} /></button>
            <button className="fs-nav-btn fs-next" onClick={onNextPage}><ChevronRight size={32} /></button>
          </>
        )}
      </div>
      )}

      {/* Ayah info bar — hidden in fullscreen */}
      {fullAyah && !isFullscreen && (
        <div className="ayah-info-bar">
          <div className="ayah-info-content">
            <span className="ayah-label">الآية — Ayah to Recite:</span>
            <span className="ayah-text arabic-kanz">{fullAyah}</span>
          </div>
        </div>
      )}

      {/* Progress — hidden in fullscreen */}
      {ikhtebarActive && !isFullscreen && (
        <div className="blank-page-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${words.length > 0 ? (revealedIndices.length / words.length) * 100 : 0}%` }} />
          </div>
          <div className="progress-stats">
            <span>{revealedIndices.length} / {words.length} words</span>
            <span className="current-word">
              {currentIndex >= 0 && currentIndex < words.length
                ? <>Next: <strong className="arabic-kanz">{words[currentIndex]}</strong></>
                : words.length > 0 ? "Complete ✓" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SPEECH ENGINE
   ═══════════════════════════════════════════════════════════════════ */

function useSpeechEngine({ words, onWordRevealed, onErrorDetected, onErrorResolved, onErrorTimeout, onComplete, language = "ar-SA" }) {
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState(0);
  const timersRef = useRef({ revealTimer: null, errorWaitTimer: null, correctionTimer: null });
  const stateRef = useRef({ currentIndex: 0, revealedIndices: [], errorIndex: -1, inErrorState: false, inCorrectionWindow: false, listening: false });

  const clearAllTimers = useCallback(() => {
    Object.values(timersRef.current).forEach((t) => t && clearTimeout(t));
    timersRef.current = { revealTimer: null, errorWaitTimer: null, correctionTimer: null };
  }, []);

  const revealNextWord = useCallback(() => {
    const { currentIndex, revealedIndices } = stateRef.current;
    if (currentIndex >= words.length) { onComplete?.(); return; }
    const newRevealed = [...revealedIndices, currentIndex];
    stateRef.current.revealedIndices = newRevealed;
    stateRef.current.currentIndex = currentIndex + 1;
    onWordRevealed?.(newRevealed, currentIndex + 1);
  }, [words, onWordRevealed, onComplete]);

  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) return;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (_) {} }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = language;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.onresult = (event) => {
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
          setConfidence(event.results[i][0].confidence);
        }
      }
      if (final) { setTranscript(final); processTranscript(final); }
    };
    rec.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") setIsListening(false); };
    rec.onend = () => { if (stateRef.current.listening) { try { rec.start(); } catch (_) {} } else setIsListening(false); };
    recognitionRef.current = rec;
    stateRef.current.listening = true;
    rec.start();
    setIsListening(true);
  }, [language]);

  const triggerError = useCallback(() => {
    const { currentIndex } = stateRef.current;
    stateRef.current.inErrorState = true;
    stateRef.current.errorIndex = currentIndex;
    onErrorDetected?.(currentIndex);
    timersRef.current.errorWaitTimer = setTimeout(() => {
      stateRef.current.inErrorState = false;
      stateRef.current.inCorrectionWindow = true;
      onErrorDetected?.(currentIndex, true);
      timersRef.current.correctionTimer = setTimeout(() => {
        stateRef.current.inCorrectionWindow = false;
        onErrorTimeout?.(currentIndex);
        stateRef.current.errorIndex = -1;
        revealNextWord();
      }, 10000);
    }, 5000);
  }, [onErrorDetected, onErrorTimeout, revealNextWord]);

  const processTranscript = useCallback((text) => {
    const { currentIndex, inErrorState, inCorrectionWindow, errorIndex } = stateRef.current;
    if (currentIndex >= words.length) return;
    const matched = wordsMatch(text, words[currentIndex]);
    if (matched) {
      if (inCorrectionWindow && currentIndex === errorIndex) {
        clearAllTimers();
        stateRef.current.inCorrectionWindow = false;
        stateRef.current.inErrorState = false;
        stateRef.current.errorIndex = -1;
        onErrorResolved?.(errorIndex);
        revealNextWord();
      } else if (!inErrorState) {
        clearAllTimers();
        revealNextWord();
      }
    } else if (!inErrorState && !inCorrectionWindow) {
      triggerError();
    }
  }, [words, triggerError, revealNextWord, clearAllTimers, onErrorResolved]);

  const start = useCallback(() => {
    stateRef.current = { currentIndex: 0, revealedIndices: [], errorIndex: -1, inErrorState: false, inCorrectionWindow: false, listening: true };
    onWordRevealed?.([], 0);
    startListening();
  }, [onWordRevealed, startListening]);

  const stop = useCallback(() => {
    stateRef.current.listening = false;
    clearAllTimers();
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (_) {} recognitionRef.current = null; }
    setIsListening(false);
  }, [clearAllTimers]);

  const pause = useCallback(() => {
    stateRef.current.listening = false;
    clearAllTimers();
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (_) {} }
    setIsListening(false);
  }, [clearAllTimers]);

  const resume = useCallback(() => { stateRef.current.listening = true; startListening(); }, [startListening]);

  useEffect(() => () => { clearAllTimers(); if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (_) {} } }, [clearAllTimers]);

  return { start, stop, pause, resume, isListening, transcript, confidence };
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN — IkhtebarMushaf
   ═══════════════════════════════════════════════════════════════════ */

export default function IkhtebarMushaf({ onComplete, onClose }) {
  const [mode, setMode] = useState(null); // null = home (mode picker), "tilawat", "ikhtebar"
  const [phase, setPhase] = useState("selection");
  const [marhala, setMarhala] = useState("");
  const [juz, setJuz] = useState(null);
  const [question, setQuestion] = useState(null);
  const [allJuzQuestions, setAllJuzQuestions] = useState([]);
  const [csvData, setCsvData] = useState(null);

  const [revealedIndices, setRevealedIndices] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorIndex, setErrorIndex] = useState(-1);
  const [inErrorState, setInErrorState] = useState(false);
  const [inCorrectionWindow, setInCorrectionWindow] = useState(false);
  const [correctionTimeLeft, setCorrectionTimeLeft] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [showWaqf, setShowWaqf] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPageImage, setShowPageImage] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // History & Session Metrics tracking
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [mistakesCount, setMistakesCount] = useState(0);
  const [correctionsCount, setCorrectionsCount] = useState(0);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState(() => loadIkhtebarHistory());

  const words = question?.words || [];

  const surahInfo = useMemo(() => {
    return question?.surahName
      ? { nameAr: question.surahName, number: question.surahNum || 1 }
      : getSurahByPage(question?.page || 1);
  }, [question]);

  // Session duration timer
  useEffect(() => {
    let timer = null;
    if (sessionActive && phase === "ikhtebar") {
      timer = setInterval(() => {
        setDurationSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [sessionActive, phase]);

  const speech = useSpeechEngine({
    words,
    onWordRevealed: (indices, nextIdx) => {
      setRevealedIndices(indices);
      setCurrentIndex(nextIdx);
    },
    onErrorDetected: (idx, isRedAlert) => {
      setErrorIndex(idx);
      setInErrorState(true);
      setMistakesCount((c) => c + 1);
      if (isRedAlert) setInCorrectionWindow(true);
    },
    onErrorResolved: () => {
      setErrorIndex(-1);
      setInErrorState(false);
      setInCorrectionWindow(false);
      setCorrectionsCount((c) => c + 1);
    },
    onErrorTimeout: () => {
      setInErrorState(false);
      setInCorrectionWindow(false);
      setErrorIndex(-1);
    },
    onComplete: () => {
      setSessionActive(false);
      setPhase("preview");
      const wordsTotal = words.length || 1;
      const wordsRecited = words.length;
      const acc = Math.max(
        0,
        Math.round(((Math.max(0, wordsRecited - mistakesCount)) / Math.max(1, wordsRecited)) * 100)
      );
      const grade =
        acc >= 90
          ? "ممتاز 🌟"
          : acc >= 80
          ? "جيد جداً ✨"
          : acc >= 70
          ? "جيد 👏"
          : "يحتاج تدريب 📖";

      const historyEntry = {
        id: `session_${Date.now()}`,
        timestamp: new Date().toISOString(),
        dateStr: new Date().toLocaleDateString("ar-SA", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        marhala: marhala || "اختبار القرآن",
        juz: question?.juz || juz || 1,
        surahName: surahInfo.nameAr,
        page: question?.page || 1,
        ayahNum: question?.ayahNum || question?.startAyah || 1,
        durationSeconds,
        wordsRecited,
        wordsTotal,
        mistakesCount,
        correctionsCount,
        accuracy: acc,
        grade,
        questionPrompt: question?.promptText || question?.questionText?.slice(0, 70) || "",
      };
      const updated = saveIkhtebarHistoryEntry(historyEntry);
      setHistoryList(updated);
      onComplete?.({ marhala, juz, question, revealedIndices });
    },
  });

  // Refresh CSV data
  const refreshCSV = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${CSV_URL}&_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csvText = await res.text();
      const { entries, byJuz } = parseIkhtebarCSV(csvText);
      if (entries.length > 0) {
        setCsvData(byJuz);
        if (juz && byJuz[juz]) {
          setAllJuzQuestions(byJuz[juz]);
          const currentQ = byJuz[juz].find(
            (q) => q.page === question?.page && q.ayahNum === question?.ayahNum,
          );
          if (currentQ) {
            setQuestion(currentQ);
          } else if (byJuz[juz].length > 0) {
            setQuestion(byJuz[juz][0]);
            setRevealedIndices([]);
            setCurrentIndex(0);
          }
        }
      }
    } catch (err) {
      console.warn("CSV refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [juz, question]);

  const handleStartIkhtebar = useCallback((data) => {
    setMarhala(data.marhala);
    setJuz(data.juz);
    setCsvData(data.csvData);
    setAllJuzQuestions(data.allJuzQuestions || []);
    if (data.question) {
      setQuestion(data.question);
    } else {
      const page = getJuzStartPage(data.juz);
      const surah = getSurahByPage(page);
      setQuestion({ page, juz: data.juz, surahName: surah.nameAr, surahNum: surah.number, startAyah: QURAN_PAGE_STARTS[page - 1]?.[1] || 1, words: [], fullAyah: "" });
    }
    setRevealedIndices([]); setCurrentIndex(0); setErrorIndex(-1);
    setInErrorState(false); setInCorrectionWindow(false); setSessionActive(false);
    setShowPageImage(false); setIsFullscreen(false);
    setPhase("preview");
  }, []);

  const handleBeginRecitation = useCallback(() => {
    setDurationSeconds(0);
    setMistakesCount(0);
    setCorrectionsCount(0);
    setPhase("ikhtebar");
    setSessionActive(true);
  }, []);

  // Navigate to next/prev question
  const goToQuestion = useCallback((direction) => {
    const currentIdx = allJuzQuestions.findIndex(
      (q) => q.page === question?.page && q.ayahNum === question?.ayahNum,
    );
    const nextIdx = currentIdx + direction;
    if (nextIdx >= 0 && nextIdx < allJuzQuestions.length) {
      speech.stop();
      setQuestion(allJuzQuestions[nextIdx]);
      setRevealedIndices([]); setCurrentIndex(0); setErrorIndex(-1);
      setInErrorState(false); setInCorrectionWindow(false);
      setDurationSeconds(0); setMistakesCount(0); setCorrectionsCount(0);
      if (phase === "ikhtebar") {
        setSessionActive(true);
        setTimeout(() => speech.start(), 100);
      }
    }
  }, [allJuzQuestions, question, speech, phase]);

  const handleNextQuestion = useCallback(() => goToQuestion(1), [goToQuestion]);
  const handlePrevQuestion = useCallback(() => goToQuestion(-1), [goToQuestion]);

  const handleEndSession = useCallback(() => {
    speech.stop();
    setSessionActive(false);
    setPhase("preview");
    if (durationSeconds > 2 || revealedIndices.length > 0) {
      const wordsTotal = words.length || 1;
      const wordsRecited = revealedIndices.length;
      const acc = wordsTotal > 0
        ? Math.max(0, Math.round(((Math.max(0, wordsRecited - mistakesCount)) / Math.max(1, wordsRecited)) * 100))
        : 100;
      const grade =
        acc >= 90
          ? "ممتاز 🌟"
          : acc >= 80
          ? "جيد جداً ✨"
          : acc >= 70
          ? "جيد 👏"
          : "يحتاج تدريب 📖";

      const historyEntry = {
        id: `session_${Date.now()}`,
        timestamp: new Date().toISOString(),
        dateStr: new Date().toLocaleDateString("ar-SA", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        marhala: marhala || "اختبار القرآن",
        juz: question?.juz || juz || 1,
        surahName: surahInfo.nameAr,
        page: question?.page || 1,
        ayahNum: question?.ayahNum || question?.startAyah || 1,
        durationSeconds,
        wordsRecited,
        wordsTotal,
        mistakesCount,
        correctionsCount,
        accuracy: acc,
        grade,
        questionPrompt: question?.promptText || question?.questionText?.slice(0, 70) || "",
      };
      const updated = saveIkhtebarHistoryEntry(historyEntry);
      setHistoryList(updated);
    }
  }, [speech, durationSeconds, revealedIndices, words, mistakesCount, correctionsCount, marhala, question, juz, surahInfo]);

  const handlePause = useCallback(() => speech.pause(), [speech]);
  const handleResume = useCallback(() => speech.resume(), [speech]);

  const handleReset = useCallback(() => {
    speech.stop();
    setRevealedIndices([]); setCurrentIndex(0); setErrorIndex(-1);
    setInErrorState(false); setInCorrectionWindow(false); setSessionActive(false);
    setIsFullscreen(false); setShowPageImage(false);
    setDurationSeconds(0); setMistakesCount(0); setCorrectionsCount(0);
    setPhase("selection"); setQuestion(null); setMarhala(""); setJuz(null); setAllJuzQuestions([]); setCsvData(null);
  }, [speech]);

  // Correction countdown
  useEffect(() => {
    if (inCorrectionWindow) {
      setCorrectionTimeLeft(10);
      const timer = setInterval(() => { setCorrectionTimeLeft((t) => { if (t <= 1) { clearInterval(timer); return 0; } return t - 1; }); }, 1000);
      return () => clearInterval(timer);
    }
  }, [inCorrectionWindow]);

  /* ═══════════════════════════════════════════════════════════════
     HOME — Mode Picker (Tilawat / Ikhtebar)
     ═══════════════════════════════════════════════════════════════ */
  if (mode === null) {
    return (
      <div className="ikhtebar-mushaf-container">
        <div className="ikhtebar-header">
          <div className="header-left">
            <BookOpen size={32} className="header-icon" />
            <div>
              <h1 className="arabic-kanz">القرآن الكريم</h1>
              <p className="header-subtitle">The Noble Quran — Choose Your Mode</p>
            </div>
          </div>
          <div className="header-right">
            <button
              type="button"
              className="icon-btn history-header-btn"
              onClick={() => setShowHistoryModal(true)}
              title="سجل جلسات الاختبار"
            >
              <History size={20} />
              {historyList.length > 0 && (
                <span className="history-badge-indicator">{historyList.length}</span>
              )}
            </button>
            {onClose && <button className="close-btn" onClick={onClose}><X size={24} /></button>}
          </div>
        </div>

        <div className="mode-picker">
          <div className="mode-picker-intro">
            <h2 className="arabic-kanz">اختر طريقة التلاوة</h2>
            <p>Choose how you'd like to engage with the Quran</p>
          </div>

          {/* Quick History Access Strip */}
          <div className="home-history-trigger-box">
            <button
              type="button"
              className="home-history-btn"
              onClick={() => setShowHistoryModal(true)}
            >
              <div className="history-btn-left">
                <History size={20} className="gold-icon" />
                <span className="arabic-kanz">سجل جلسات الاختبار والتقييمات السابقة</span>
              </div>
              <div className="history-btn-right">
                <span className="history-badge-count">
                  {toEasternArabicNumerals(historyList.length)} جلسة مسجلة
                </span>
                <ChevronRight size={18} />
              </div>
            </button>
          </div>

          <div className="mode-cards">
            {/* Tilawat Card */}
            <button className="mode-card tilawat-card" onClick={() => setMode("tilawat")}>
              <div className="mode-card-icon tilawat-icon">
                <BookMarked size={40} />
              </div>
              <div className="mode-card-content">
                <h3 className="arabic-kanz">تلاوة</h3>
                <h4>Tilawat</h4>
                <p>Read & memorize the Quran page by page. Navigate freely with full-page colorful Mushaf view, zoom, and fullscreen.</p>
                <div className="mode-card-features">
                  <span><BookOpen size={14} /> Full Mushaf Pages</span>
                  <span><ZoomIn size={14} /> Zoom & Pan</span>
                  <span><Maximize size={14} /> Fullscreen Mode</span>
                  <span><ArrowRight size={14} /> Swipe Navigation</span>
                </div>
              </div>
              <div className="mode-card-arrow"><ChevronRight size={28} /></div>
            </button>

            {/* Ikhtebar Card */}
            <button className="mode-card ikhtebar-card" onClick={() => setMode("ikhtebar")}>
              <div className="mode-card-icon ikhtebar-icon">
                <Feather size={40} />
              </div>
              <div className="mode-card-content">
                <h3 className="arabic-kanz">اختبار</h3>
                <h4>Ikhtebar</h4>
                <p>Test your memorization with real-time speech recognition. Blank pages, word-by-word reveal, and instant error alerts.</p>
                <div className="mode-card-features">
                  <span><Mic size={14} /> Speech Recognition</span>
                  <span><Target size={14} /> CSV Question Tracking</span>
                  <span><AlertCircle size={14} /> Error Alerts</span>
                  <span><CheckCircle size={14} /> Progress Tracking</span>
                </div>
              </div>
              <div className="mode-card-arrow"><ChevronRight size={28} /></div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     TILAWAT MODE
     ═══════════════════════════════════════════════════════════════ */
  if (mode === "tilawat") {
    return <TilawatView onBack={() => setMode(null)} />;
  }

  /* ═══════════════════════════════════════════════════════════════
     IKHTEBAR MODE — Selection Phase
     ═══════════════════════════════════════════════════════════════ */
  if (phase === "selection") {
    return (
      <div className="ikhtebar-mushaf-container">
        <div className="ikhtebar-header">
          <div className="header-left">
            <button className="back-btn" onClick={() => setMode(null)} title="Back to Mode Picker"><ArrowLeft size={24} /></button>
            <div>
              <h1 className="arabic-kanz">القرآن</h1>
              <p className="header-subtitle">Quran — Memorization & Tilawat</p>
            </div>
          </div>
          {onClose && <button className="close-btn" onClick={onClose}><X size={24} /></button>}
        </div>
        <IkhtebarSelectionFlow onStart={handleStartIkhtebar} />
      </div>
    );
  }

  /* ── Preview & Ikhtebar Phases ───────────────────────────────── */
  const isPreview = phase === "preview";
  const currentQIdx = allJuzQuestions.findIndex((q) => q.page === question?.page && q.ayahNum === question?.ayahNum);
  const hasNextQ = currentQIdx + 1 < allJuzQuestions.length;
  const hasPrevQ = currentQIdx > 0;

  return (
    <div className={`ikhtebar-mushaf-container active ${isFullscreen ? "fullscreen-mode" : ""}`}>
      {/* Header — hidden in fullscreen */}
      {!isFullscreen && (
        <div className="ikhtebar-header active">
          <div className="header-left">
            <button className="back-btn" onClick={handleReset} title="Back"><ArrowLeft size={24} /></button>
            <div>
              <h1 className="arabic-kanz">القرآن</h1>
              <p className="header-subtitle">
                {marhala} • Juz {question?.juz || juz} • {surahInfo.nameAr} • Page {question?.page}
              </p>
            </div>
          </div>
          <div className="header-right">
            <div className="session-status">
              <span className={`status-dot ${!isPreview && speech.isListening ? "listening" : sessionActive ? "active" : "idle"}`} />
              <span>{isPreview ? "Preview" : speech.isListening ? "Listening…" : sessionActive ? "Active" : "Paused"}</span>
            </div>
            <button
              type="button"
              className="icon-btn history-header-btn"
              onClick={() => setShowHistoryModal(true)}
              title="سجل جلسات الاختبار"
            >
              <History size={18} />
              {historyList.length > 0 && (
                <span className="history-badge-indicator">{historyList.length}</span>
              )}
            </button>
            <button className="icon-btn" onClick={refreshCSV} title="Refresh Questions" disabled={isRefreshing}>
              <RefreshCw size={18} className={isRefreshing ? "spin" : ""} />
            </button>
            {!isPreview && (
              <button className="icon-btn" onClick={() => setShowSettings(!showSettings)} title="Settings"><Settings size={20} /></button>
            )}
          </div>
        </div>
      )}

      {/* Settings */}
      {showSettings && !isPreview && !isFullscreen && (
        <div className="settings-panel">
          <h4>Settings</h4>
          <label><input type="checkbox" checked={showWaqf} onChange={(e) => setShowWaqf(e.target.checked)} /> Show Waqf Markers</label>
          <label><input type="checkbox" checked={showPageImage} onChange={(e) => setShowPageImage(e.target.checked)} /> Show Page Image</label>
          <label><input type="checkbox" checked readOnly /> Auto-reveal (5s)</label>
          <label><input type="checkbox" checked readOnly /> Red alert (5s)</label>
          <label><input type="checkbox" checked readOnly /> Correction (10s)</label>
          <div className="language-select">
            <label>Language:</label>
            <select value="ar-SA" disabled><option value="ar-SA">Arabic</option></select>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="ikhtebar-main">
        <QuranPageViewer
          page={question?.page || 1}
          words={words}
          fullAyah={question?.fullAyah || ""}
          revealedIndices={revealedIndices}
          currentIndex={currentIndex}
          errorIndex={errorIndex}
          showWaqf={showWaqf}
          ikhtebarActive={!isPreview}
          isFullscreen={isFullscreen}
          showPageImage={showPageImage}
          question={question}
          inErrorState={inErrorState}
          inCorrectionWindow={inCorrectionWindow}
          correctionTimeLeft={correctionTimeLeft}
          isListening={speech.isListening}
          onPageLoad={() => {}}
          onPrevPage={hasPrevQ ? handlePrevQuestion : undefined}
          onNextPage={hasNextQ ? handleNextQuestion : undefined}
        />

        {/* ── Preview Controls ── */}
        {isPreview && !isFullscreen && (
          <div className="ikhtebar-controls preview-controls">
            <div className="preview-info">
              <div className="preview-detail"><span className="preview-label">Surah</span><span className="preview-value arabic-kanz">{surahInfo.nameAr}</span></div>
              <div className="preview-detail"><span className="preview-label">Ayah</span><span className="preview-value">{question?.ayahNum || question?.startAyah || "—"}</span></div>
              <div className="preview-detail"><span className="preview-label">Words</span><span className="preview-value">{words.length}</span></div>
              <div className="preview-detail"><span className="preview-label">Question</span><span className="preview-value" dir="ltr">{currentQIdx + 1} <span className="slash-delim">/</span> {allJuzQuestions.length}</span></div>
            </div>
            <div className="preview-actions">
              {hasPrevQ && <button className="nav-btn secondary" onClick={handlePrevQuestion}><ArrowLeft size={18} /> Prev</button>}
              <button className="main-btn start" onClick={handleBeginRecitation}><Mic size={28} /><span>Start Ikhtebar</span></button>
              {hasNextQ && <button className="nav-btn secondary" onClick={handleNextQuestion}>Next <ArrowRight size={18} /></button>}
            </div>
          </div>
        )}

        {/* ── Ikhtebar Controls ── */}
        {!isPreview && !isFullscreen && (
          <>
            <div className="ikhtebar-controls">
              <div className="controls-left">
                <div className="timer-display">
                  {inCorrectionWindow && (
                    <div className="correction-timer"><Clock size={20} className="pulse" /><span className="timer-value">{correctionTimeLeft}s</span><span className="timer-label">Correction</span></div>
                  )}
                  {!inCorrectionWindow && sessionActive && (
                    <div className="session-timer"><Clock size={18} /><span className="timer-label">Active ({formatDuration(durationSeconds)})</span></div>
                  )}
                </div>
              </div>
              <div className="controls-center">
                {sessionActive && (
                  <div className="session-controls">
                    <button className="main-btn pause" onClick={speech.isListening ? handlePause : handleResume}>
                      {speech.isListening ? <Pause size={24} /> : <Play size={24} />}
                      <span>{speech.isListening ? "Pause" : "Resume"}</span>
                    </button>
                    <button className="main-btn stop" onClick={handleEndSession}><StopCircle size={24} /><span>Finish</span></button>
                  </div>
                )}
                {revealedIndices.length >= words.length && words.length > 0 && (
                  <div className="completion-badge"><CheckCircle size={24} className="success" /><span className="arabic-kanz">تم الحفظ — Complete</span></div>
                )}
              </div>
              <div className="controls-right">
                <div className="live-transcript">
                  <span className="transcript-label">Heard:</span>
                  <span className="transcript-text arabic-kanz">{speech.transcript || "—"}</span>
                  <span className="confidence">({Math.round(speech.confidence * 100)}%)</span>
                </div>
              </div>
            </div>

            {/* Error Banners */}
            {inErrorState && !inCorrectionWindow && (
              <div className="error-alert-banner waiting"><AlertCircle size={24} className="pulse" /><div><strong>Mistake Detected</strong><span>Waiting 5s…</span></div></div>
            )}
            {inCorrectionWindow && (
              <div className="error-alert-banner correction">
                <AlertCircle size={24} className="pulse red" />
                <div><strong>Red Alert — Correction Required</strong><span>Recite within <strong>{correctionTimeLeft}s</strong></span></div>
                <div className="expected-word arabic-kanz">Expected: {words[currentIndex] || "—"}</div>
              </div>
            )}
            {errorIndex >= 0 && !inErrorState && !inCorrectionWindow && revealedIndices.includes(errorIndex) && (
              <div className="error-alert-banner resolved"><CheckCircle size={24} className="success" /><div><strong>Corrected!</strong><span>Resumed</span></div></div>
            )}
          </>
        )}
      </div>

      {/* Fullscreen floating controls */}
      {isFullscreen && (
        <div className="fs-floating-controls">
          <button className="fs-ctrl-btn" onClick={handleReset}><ArrowLeft size={20} /> Exit</button>
          <span className="fs-page-info">{surahInfo.nameAr} — Page {question?.page}</span>
          <button className="fs-ctrl-btn" onClick={() => setIsFullscreen(false)}><Minimize size={20} /> Exit Full</button>
        </div>
      )}

      {/* History Cards Modal */}
      <HistoryCardsModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        historyList={historyList}
        onDelete={(id) => setHistoryList(deleteIkhtebarHistoryEntry(id))}
        onClearAll={() => setHistoryList(clearAllIkhtebarHistory())}
      />
    </div>
  );
}
