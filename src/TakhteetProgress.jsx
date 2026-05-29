import React, { useEffect, useState } from 'react';
import './TakhteetProgress.css';

// Surah names in Arabic
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

const JUZ_START_SURAH_INDEX = [
  0,1,1,2,3,3,4,5,6,7,8,10,11,14,16,17,20,22,24,26,28,32,35,38,40,45,50,57,66,77
];

const getSurahForJuz = (juzNum) => {
  const idx = JUZ_START_SURAH_INDEX[juzNum - 1];
  return idx !== undefined ? SURAH_NAMES_AR[idx] : "";
};

const toArabicDigits = (str) => {
  if (str == null) return str;
  return String(str).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)]);
};

const isNumericVal = (v) => v && !isNaN(parseInt(v, 10)) && String(parseInt(v, 10)) === String(v).trim();

const parseField = (rawJuz, rawPage, rawSurah) => {
  const numeric = isNumericVal(rawJuz);
  const juzNum = numeric ? parseInt(rawJuz, 10) : null;
  const surahValue = rawSurah || (numeric ? getSurahForJuz(juzNum) : null);
  return {
    isNumeric: numeric,
    juzNum,
    displayJuz: numeric ? toArabicDigits(String(juzNum)) : "\u2014",
    displaySurah: surahValue || rawJuz || "\u2014",
    safa: rawPage ? toArabicDigits(rawPage) : "\u2014",
  };
};

// Calculate pages covered from target (istifadah) to current (wusool).
// Both istifadah_page and wusool_page are absolute Quran page numbers (1-604).
// pagesCovered = wusool_page - istifadah_page + 1 (inclusive).
// For Juz 26-30, page range is from ~502 to ~604.
const calcPagesCovered = (targetPage, currentPage) => {
  const t = parseInt(targetPage, 10);
  const c = parseInt(currentPage, 10);
  if (isNaN(t) || isNaN(c)) return 0;
  if (c < t) return 0; // Haven't reached target yet
  return c - t + 1;
};

const calcPagesRemaining = (targetPage, currentPage) => {
  const t = parseInt(targetPage, 10);
  const c = parseInt(currentPage, 10);
  if (isNaN(t) || isNaN(c)) return 0;
  if (c >= t) return 0; // Target achieved
  return t - c;
};

const AnimatedProgressRing = ({ percent, size = 140, strokeWidth = 10, isComplete = false }) => {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedPercent / 100) * circumference;

  useEffect(() => {
    const safePercent = isNaN(percent) ? 0 : percent;
    const timer = setTimeout(() => {
      setAnimatedPercent(Math.min(100, Math.max(0, safePercent)));
    }, 400);
    return () => clearTimeout(timer);
  }, [percent]);

  return (
    <div className={`progress-ring-container ${isComplete ? 'ring-complete' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="progress-ring-svg">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(212, 175, 55, 0.12)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#goldGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="progress-ring-fill"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {/* Glow circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(212, 175, 55, 0.3)"
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="progress-ring-glow"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          filter="url(#glow)"
        />
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d4af37" />
            <stop offset="50%" stopColor="#f6dc88" />
            <stop offset="100%" stopColor="#b88a1d" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      </svg>
      <div className="progress-ring-text">
        <span className="progress-ring-value">{toArabicDigits(Math.round(animatedPercent))}</span>
        <span className="progress-ring-unit">%</span>
      </div>
    </div>
  );
};

const MetricCard = ({ label, labelAr, icon, children, accent = "gold" }) => (
  <div className={`takhteet-metric-card metric-${accent}`}>
    <div className="metric-header">
      {icon && <span className="metric-icon">{icon}</span>}
      <span className="metric-label">{label}</span>
      <span className="metric-label-arabic">{labelAr}</span>
    </div>
    <div className="metric-body">
      {children}
    </div>
  </div>
);

const JssDisplay = ({ juz, surah, safa, compact = false }) => (
  <div className={`jss-display ${compact ? 'compact' : ''}`}>
    <div className="jss-item">
      <span className="jss-label">Juz</span>
      <span className="jss-value">{juz}</span>
    </div>
    <div className="jss-divider" />
    <div className="jss-item">
      <span className="jss-label">سورة</span>
      <span className="jss-value arabic-text">{surah}</span>
    </div>
    <div className="jss-divider" />
    <div className="jss-item">
      <span className="jss-label">Safa</span>
      <span className="jss-value">{safa}</span>
    </div>
  </div>
);

const TakhteetProgress = ({ weeklyResult, currentJuz }) => {
  const [percent, setPercent] = useState(0);

  // Parse all three field sets
  const target = parseField(weeklyResult?.istifadah_juz, weeklyResult?.istifadah_page, weeklyResult?.istifadah_surah);
  const wusool = parseField(weeklyResult?.wusool_juz, weeklyResult?.wusool_page, weeklyResult?.wusool_surah);
  const nextWeek = parseField(weeklyResult?.next_week_juz, weeklyResult?.next_week_page, weeklyResult?.next_week_surah);

  // Calculate pages covered from Target Till (istifadah) to Wusool (currently on).
  // pagesCovered = wusool_page - istifadah_page + 1 (inclusive range).
  // Example: target till page 542, current page 545 => 545-542+1 = 4 pages done.
  const istifadahPage = weeklyResult?.istifadah_page;
  const wusoolPage = weeklyResult?.wusool_page;
  const nextWeekPage = weeklyResult?.next_week_page;

  const pagesCovered = calcPagesCovered(istifadahPage, wusoolPage);
  const pagesRemaining = calcPagesRemaining(istifadahPage, wusoolPage);
  const nextWeekPages = parseInt(nextWeekPage, 10) || 0;

  // Determine if child is in Juz 1-25 range (page range 1-503).
  // For these children, percentage is proportional: (wusool - istifadah) / (next_week - istifadah) * 100.
  // For Juz 26-30, keep binary 0/100% behavior.
  const currentJuzNum = currentJuz ? parseInt(String(currentJuz).trim(), 10) : NaN;
  const isJuz1to25 = !isNaN(currentJuzNum) && currentJuzNum >= 1 && currentJuzNum <= 25;

  // Compute progress percentage — proportional for Juz 1-25, binary for Juz 26-30
  const calcProgressPercent = () => {
    if (isJuz1to25) {
      const start = parseInt(istifadahPage, 10);
      const curr = parseInt(wusoolPage, 10);
      const targetEnd = parseInt(nextWeekPage, 10);
      if (!isNaN(start) && !isNaN(curr) && !isNaN(targetEnd) && targetEnd > start) {
        const done = Math.max(0, curr - start);
        const planned = targetEnd - start;
        return Math.min(100, Math.max(0, Math.round((done / planned) * 100)));
      }
    }
    // Binary for Juz 26-30 or when target data is incomplete
    return pagesCovered > 0 ? 100 : 0;
  };

  const computedPercent = calcProgressPercent();

  // Target is achieved when computed progress reaches 100%
  const isComplete = computedPercent >= 100;

  // Next Week Target percentage — reuse the main computed percent for Juz 1-25
  let nextWeekPercent = 0;
  if (isJuz1to25) {
    nextWeekPercent = computedPercent;
  } else {
    const tPage = parseInt(istifadahPage, 10);
    const nPage = parseInt(nextWeekPage, 10);
    if (!isNaN(tPage) && !isNaN(nPage) && tPage > 0 && nPage > 0) {
      const nwPages = calcPagesCovered(String(tPage), String(nPage));
      if (nwPages > 0) {
        nextWeekPercent = computedPercent;
      }
    }
  }

  // Animate progress on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setPercent(computedPercent);
    }, 300);
    return () => clearTimeout(timer);
  }, [computedPercent]);

  // Don't render if no data at all
  const hasTarget = target.isNumeric || (target.displaySurah && target.displaySurah !== "\u2014");
  const hasWusool = wusool.isNumeric || (wusool.displaySurah && wusool.displaySurah !== "\u2014");

  if (!hasTarget && !hasWusool) {
    return null;
  }

  return (
    <div className={`takhteet-progress-container card-appear ${isComplete ? 'target-complete' : ''}`}>
      <div className="takhteet-glass-card">
        {/* Card Header */}
        <div className="takhteet-card-header">
          <div className="takhteet-title-row">
            <h3 className="takhteet-card-title">
              <span className="title-icon">📊</span>
              Takhteet Progress Card
            </h3>
            <span className="takhteet-badge">
              Juz | Surah | Safa
            </span>
          </div>
          <p className="takhteet-card-subtitle">
            Track your child's memorization journey — how much target was set, where they are now, and what's coming next.
          </p>
        </div>

        {/* Main Progress Section */}
        <div className="takhteet-main-section">
          {/* Circular Progress */}
          <div className="takhteet-progress-ring-wrap">
            <AnimatedProgressRing percent={percent} size={130} strokeWidth={8} isComplete={isComplete} />
            <div className="progress-stats-row">
              <div className="progress-stat">
                <span className="stat-label">Target</span>
                <span className="stat-value">{toArabicDigits(istifadahPage || pagesCovered)}</span>
              </div>
              <div className="progress-stat-divider">/</div>
              <div className="progress-stat">
                <span className="stat-label">Done</span>
                <span className="stat-value">{toArabicDigits(pagesCovered)}</span>
              </div>
            </div>
            <p className="progress-remaining">
              {pagesRemaining > 0 ? (
                <><strong>{toArabicDigits(pagesRemaining)}</strong> pages remaining</>
              ) : pagesCovered > 0 ? (
                <span className="success-text celebration-text">🎉 Mubarak Mohanna! Target achieved 🎉</span>
              ) : null}
            </p>
          </div>

          {/* 3 Metric Cards */}
          <div className="takhteet-metrics-grid">
            {/* Metric 1: Target Given */}
            <MetricCard
              label="Target Given"
              labelAr="الهدف المعطى"
              icon="🎯"
              accent="gold"
            >
              <JssDisplay
                juz={target.displayJuz}
                surah={target.displaySurah}
                safa={target.safa}
              />
              <div className="metric-footer">
                <span className="metric-pages">Target till page {toArabicDigits(istifadahPage || '--')}</span>
              </div>
            </MetricCard>

            {/* Metric 2: Currently On (Wusool) */}
            <MetricCard
              label="Currently On"
              labelAr="الوصول الحالي"
              icon="📍"
              accent="emerald"
            >
              <JssDisplay
                juz={wusool.displayJuz}
                surah={wusool.displaySurah}
                safa={wusool.safa}
              />
              <div className="metric-footer">
                <span className="metric-pages">{toArabicDigits(pagesCovered)} pages done</span>
              </div>
            </MetricCard>

            {/* Metric 3: Next Week Target % */}
            <MetricCard
              label="Next Week Target"
              labelAr="هدف الأسبوع القادم"
              icon="📈"
              accent="sapphire"
            >
              <JssDisplay
                juz={nextWeek.displayJuz}
                surah={nextWeek.displaySurah}
                safa={nextWeek.safa}
                compact
              />
              <div className="metric-footer">
                {pagesCovered > 0 && nextWeekPages > 0 ? (
                  <span className="metric-percent">
                    <strong>{toArabicDigits(Math.round(nextWeekPercent))}%</strong> of total target
                  </span>
                ) : nextWeekPages > 0 ? (
                  <span className="metric-pages">{toArabicDigits(nextWeekPages)} pages planned</span>
                ) : (
                  <span className="metric-pages muted">No target set</span>
                )}
              </div>
            </MetricCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TakhteetProgress;
