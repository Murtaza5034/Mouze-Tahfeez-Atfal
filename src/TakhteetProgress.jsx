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

const calcPages = (juz, page) => {
  if (!juz || juz === 0) return 0;
  const safeJuz = Math.min(Math.max(juz, 1), 30);
  return (30 - safeJuz) * 20 + (parseInt(page || "0", 10));
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

const TakhteetProgress = ({ weeklyResult }) => {
  const [percent, setPercent] = useState(0);

  // Parse all three field sets
  const target = parseField(weeklyResult?.istifadah_juz, weeklyResult?.istifadah_page, weeklyResult?.istifadah_surah);
  const wusool = parseField(weeklyResult?.wusool_juz, weeklyResult?.wusool_page, weeklyResult?.wusool_surah);
  const nextWeek = parseField(weeklyResult?.next_week_juz, weeklyResult?.next_week_page, weeklyResult?.next_week_surah);

  // Calculate pages
  const targetPages = calcPages(target.juzNum, weeklyResult?.istifadah_page);
  const wusoolPages = calcPages(wusool.juzNum, weeklyResult?.wusool_page);
  const nextWeekPages = calcPages(nextWeek.juzNum, weeklyResult?.next_week_page);

  // Progress percentage
  let progressPercent = 0;
  if (targetPages > 0) {
    progressPercent = Math.min(100, Math.max(0, (wusoolPages / targetPages) * 100));
  } else if (wusoolPages > 0) {
    progressPercent = 100;
  }

  // Next Week Target % of total target
  let nextWeekPercent = 0;
  if (targetPages > 0 && nextWeekPages > 0) {
    nextWeekPercent = Math.min(100, Math.max(0, (nextWeekPages / targetPages) * 100));
  }

  // Animate progress on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setPercent(progressPercent);
    }, 300);
    return () => clearTimeout(timer);
  }, [progressPercent]);

  const remainingPages = Math.max(0, targetPages - wusoolPages);
  const isComplete = targetPages > 0 && remainingPages === 0;

  // Don't render if no data at all
  const hasTarget = target.isNumeric || (target.displaySurah && target.displaySurah !== "\u2014");
  const hasWusool = wusool.isNumeric || (wusool.displaySurah && wusool.displaySurah !== "\u2014");

  if (!hasTarget && !hasWusool && targetPages === 0 && wusoolPages === 0) {
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
                <span className="stat-value">{toArabicDigits(targetPages)}</span>
              </div>
              <div className="progress-stat-divider">/</div>
              <div className="progress-stat">
                <span className="stat-label">Done</span>
                <span className="stat-value">{toArabicDigits(wusoolPages)}</span>
              </div>
            </div>
            <p className="progress-remaining">
              {              remainingPages > 0 ? (
                <><strong>{toArabicDigits(remainingPages)}</strong> pages remaining</>
              ) : targetPages > 0 ? (
                <span className="success-text celebration-text">🎉 Mubarak Mohanna! Target achieved 🎉</span>
              ) : wusoolPages > 0 ? (
                <><strong>{toArabicDigits(wusoolPages)}</strong> pages covered</>
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
                <span className="metric-pages">{toArabicDigits(targetPages)} total pages</span>
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
                <span className="metric-pages">{toArabicDigits(wusoolPages)} pages done</span>
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
                {targetPages > 0 && nextWeekPages > 0 ? (
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
