import React, { useEffect, useState } from 'react';
import './TakhteetProgress.css';

// Surah names in Arabic (0-indexed: index 0 = Al-Fatihah, index 113 = An-Nas)
const SURAH_NAMES_AR = [
  "الفاتحة","البقرة","آل عمران","النساء","المائدة",
  "الأنعام","الأعراف","الأنفال","التوبة","يونس",
  "هود","يوسف","الرعد","إبراهيم","الحجر",
  "النحل","الإسراء","الكهف","مريم","طه",
  "الأنبياء","الحج","المؤمنون","النور","الفرقان",
  "الشعراء","النمل","القصص","العنكبوت","الروم",
  "لقمان","السجدة","الأحزاب","سبأ","فاطر",
  "يس","الصافات","ص","الزمر","غافر",
  "فصلت","الشورى","الزخرف","الدخان","الجاثية",
  "الأحقاف","محمد","الفتح","الحجرات","ق",
  "الذاريات","الطور","النجم","القمر","الرحمن",
  "الواقعة","الحديد","المجادلة","الحشر","الممتحنة",
  "الصف","الجمعة","المنافقون","التغابن","الطلاق",
  "التحريم","الملك","القلم","الحاقة","المعارج",
  "نوح","الجن","المزمل","المدثر","القيامة",
  "الإنسان","المرسلات","النبأ","النازعات","عبس",
  "التكوير","الانفطار","المطففين","الانشقاق","البروج",
  "الطارق","الأعلى","الغاشية","الفجر","البلد",
  "الشمس","الليل","الضحى","الشرح","التين",
  "العلق","القدر","البينة","الزلزلة","العاديات",
  "القارعة","التكاثر","العصر","الهمزة","الفيل",
  "قريش","الماعون","الكوثر","الكافرون","النصر",
  "المسد","الإخلاص","الفلق","الناس"
];

// Each juz (1-30) maps to the index of the surah where it starts in SURAH_NAMES_AR
const JUZ_START_SURAH_INDEX = [
  0,   // Juz 1 → Al-Fatihah (index 0)
  1,   // Juz 2 → Al-Baqarah (index 1)
  1,   // Juz 3 → Al-Baqarah (index 1)
  2,   // Juz 4 → Aal-e-Imran (index 2)
  3,   // Juz 5 → An-Nisa (index 3)
  3,   // Juz 6 → An-Nisa (index 3)
  4,   // Juz 7 → Al-Ma'idah (index 4)
  5,   // Juz 8 → Al-An'am (index 5)
  6,   // Juz 9 → Al-A'raf (index 6)
  7,   // Juz 10 → Al-Anfal (index 7)
  8,   // Juz 11 → At-Tawbah (index 8)
  10,  // Juz 12 → Hud (index 10)
  11,  // Juz 13 → Yusuf (index 11)
  14,  // Juz 14 → Al-Hijr (index 14)
  16,  // Juz 15 → Al-Isra (index 16)
  17,  // Juz 16 → Al-Kahf (index 17)
  20,  // Juz 17 → Al-Anbiya (index 20)
  22,  // Juz 18 → Al-Mu'minun (index 22)
  24,  // Juz 19 → Al-Furqan (index 24)
  26,  // Juz 20 → An-Naml (index 26)
  28,  // Juz 21 → Al-Ankabut (index 28)
  32,  // Juz 22 → Al-Ahzab (index 32)
  35,  // Juz 23 → Ya-Sin (index 35)
  38,  // Juz 24 → Az-Zumar (index 38)
  40,  // Juz 25 → Fussilat (index 40)
  45,  // Juz 26 → Al-Ahqaf (index 45)
  50,  // Juz 27 → Adh-Dhariyat (index 50)
  57,  // Juz 28 → Al-Mujadilah (index 57)
  66,  // Juz 29 → Al-Mulk (index 66)
  77,  // Juz 30 → An-Naba (index 77)
];

/** Get the Arabic surah name for a given juz number (1-30) */
const getSurahForJuz = (juzNum) => {
  const idx = JUZ_START_SURAH_INDEX[juzNum - 1];
  return idx !== undefined ? SURAH_NAMES_AR[idx] : "";
};

/** Convert Western digits to Arabic-Indic digits (0-9 → ٠-٩) */
const toArabicDigits = (str) => {
  if (str == null) return str;
  return String(str).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)]);
};

/** Check if a value is a numeric juz number (not a surah name) */
const isNumericVal = (v) => v && !isNaN(parseInt(v, 10)) && String(parseInt(v, 10)) === String(v).trim();

/**
 * Parses a raw juz field and page field into display info.
 * Returns: { displayJuz, displaySurah, safa, juzNum, isNumeric }
 */
const parseField = (rawJuz, rawPage, rawSurah) => {
  const numeric = isNumericVal(rawJuz);
  const juzNum = numeric ? parseInt(rawJuz, 10) : null;
  // Use stored surah if available (for Juz 26-30 where multiple surahs per juz)
  const surahValue = rawSurah || (numeric ? getSurahForJuz(juzNum) : null);
  return {
    isNumeric: numeric,
    juzNum,
    displayJuz: numeric ? toArabicDigits(String(juzNum)) : "\u2014",
    displaySurah: surahValue || rawJuz || "\u2014",
    safa: rawPage ? toArabicDigits(rawPage) : "\u2014",
  };
};

const HEADINGS = {
  wusool: { label: "Wusool", labelAr: "وصول" },
  nextWeek: { label: "Next Week", labelAr: "الأسبوع القادم" },
  target: { label: "Target Till", labelAr: "الهدف حتى" },
};

const TakhteetProgress = ({ weeklyResult, currentJuz }) => {
  const [percent, setPercent] = useState(0);

  // Determine student juz level
  const currentJuzNum = currentJuz ? parseInt(currentJuz, 10) : 0;
  const isHighJuz = currentJuzNum >= 26;

  // Also check weeklyResult fields as fallback (profile juz might not be set)
  const resultJuzValues = [
    weeklyResult?.wusool_juz,
    weeklyResult?.next_week_juz,
    weeklyResult?.istifadah_juz,
  ].filter(v => isNumericVal(v)).map(v => parseInt(v, 10));
  const maxResultJuz = resultJuzValues.length > 0 ? Math.max(...resultJuzValues) : 0;

  // Best juz number for display badge

  // Parse all three fields
  const wusool = parseField(weeklyResult?.wusool_juz, weeklyResult?.wusool_page, weeklyResult?.wusool_surah);
  const nextWeek = parseField(weeklyResult?.next_week_juz, weeklyResult?.next_week_page, weeklyResult?.next_week_surah);
  const target = parseField(weeklyResult?.istifadah_juz, weeklyResult?.istifadah_page, weeklyResult?.istifadah_surah);

  const fields = [
    { ...wusool, key: "wusool", heading: HEADINGS.wusool },
    { ...nextWeek, key: "nextWeek", heading: HEADINGS.nextWeek },
    { ...target, key: "target", heading: HEADINGS.target },
  ];

  // Backwards juz logic (30 - juz) * 20 + page
  const calcPages = (juz, page) => {
    if (juz === 0 && page === 0) return 0;
    const safeJuz = Math.min(Math.max(juz, 1), 30);
    return (30 - safeJuz) * 20 + page;
  };

  const wusoolPages = calcPages(wusool.juzNum || 0, parseInt(weeklyResult?.wusool_page || "0", 10));
  const targetPages = calcPages(target.juzNum || 0, parseInt(weeklyResult?.istifadah_page || "0", 10));

  const remainingPages = Math.max(0, targetPages - wusoolPages);

  let targetPercent = 0;
  if (targetPages > 0) {
    targetPercent = Math.min(100, Math.max(0, (wusoolPages / targetPages) * 100));
  } else if (wusoolPages > 0) {
    targetPercent = 100;
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setPercent(targetPercent);
    }, 300);
    return () => clearTimeout(timer);
  }, [targetPercent]);

  // Don't render if no data
  const hasAnyData = fields.some(f => f.isNumeric || (f.displaySurah && f.displaySurah !== "\u2014"));
  if (!hasAnyData && targetPages === 0 && wusoolPages === 0) {
    return null;
  }

  return (
    <div className="takhteet-progress-container card-appear">
      <div className="glass-card">
        <div className="card-header">
          <h3 className="card-title">
            Juz | Surah | Safa
          </h3>
          <p className="card-subtitle">
            Detailed progress tracking with juz, surah, and page indicators
          </p>
        </div>

        <div className="progress-body">
          <div className="liquid-container">
            <div className="liquid-circle">
              <div
                className="liquid-wave"
                style={{ top: `${100 - percent}%` }}
              >
                <svg viewBox="0 0 500 150" preserveAspectRatio="none">
                  <path d="M0,100 C150,200 350,0 500,100 L500,150 L0,150 Z" className="wave wave1"></path>
                  <path d="M0,100 C150,0 350,200 500,100 L500,150 L0,150 Z" className="wave wave2"></path>
                </svg>
                <div className="water-fill"></div>
              </div>
              <div className="percentage-text">
                <span className="count-up">{toArabicDigits(Math.round(percent))}</span>%
              </div>
            </div>
          </div>

          {/* Three Heading Cards — dynamic columns based on juz level */}
          <div className={`headings-grid ${isHighJuz ? "high-juz" : ""}`}>
            {fields.map((f) => (
              <div key={f.key} className="heading-card">
                <div className="heading-card-header">
                  <span className="heading-label">{f.heading.label}</span>
                  <span className="heading-label-arabic arabic-text">{f.heading.labelAr}</span>
                </div>

                {/* 3-Column Layout: Juz | Surah | Safa */}
                  <div className="jss-row">
                    <div className="jss-cell juz-cell">
                      <span className="jss-cell-label">Juz</span>
                      <span className="jss-cell-value">{f.displayJuz}</span>
                    </div>
                    <div className="jss-cell surah-cell">
                      <span className="jss-cell-label">سورة</span>
                      <span className="jss-cell-value arabic-text">{f.displaySurah}</span>
                    </div>
                    <div className="jss-cell safa-cell">
                      <span className="jss-cell-label">Safa</span>
                      <span className="jss-cell-value">{f.safa}</span>
                    </div>
                  </div>
              </div>
            ))}
          </div>
        </div>

        <div className="footer-message">
          {remainingPages > 0 ? (
            <p><strong>{toArabicDigits(remainingPages)} pages</strong> remaining to Takhteet. Keep going!</p>
          ) : targetPages > 0 ? (
            <p className="success-text"><strong>Takhteet Target Reached!</strong> MashaAllah!</p>
          ) : wusoolPages > 0 ? (
            <p><strong>{toArabicDigits(wusoolPages)} pages</strong> covered</p>
          ) : (
            <p>Target not fully set.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TakhteetProgress;
