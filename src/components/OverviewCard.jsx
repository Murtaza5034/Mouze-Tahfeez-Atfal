import React from 'react';
import { 
  Users, 
  FileText, 
  TrendingUp, 
  TrendingDown,
  Eye, 
  Clock, 
  GraduationCap, 
  Calendar, 
  MessageCircle, 
  ClipboardCheck, 
  Trophy, 
  BookOpen,
  DollarSign,
  UserCheck,
  CalendarCheck,
  Award,
  Activity,
  CheckCircle2,
  ShieldCheck,
  Briefcase
} from 'lucide-react';

/**
 * RehalIcon - Custom SVG depicting open Quran resting on a folding wooden Rehal (X-stand)
 * Matches Card 1 in the reference image.
 */
export const RehalIcon = ({ size = 26, color = "currentColor", strokeWidth = 2, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth={strokeWidth} 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={`rehal-icon-svg ${className}`}
  >
    {/* Open Quran Top Surface */}
    <path d="M12 6.5L4 10.5L12 14.5L20 10.5L12 6.5Z" />
    <path d="M12 6.5V14.5" />
    {/* Book Thickness / Bottom Rim */}
    <path d="M4 10.5V12L12 16L20 12V10.5" />
    {/* Rehal X-Stand Crossbars & Feet */}
    <path d="M6.5 16L4.5 19" />
    <path d="M17.5 16L19.5 19" />
    <path d="M4.5 19H19.5" />
    <path d="M4 19V20" />
    <path d="M20 19V20" />
  </svg>
);

/**
 * SegmentedGoldBar - 5-slot debossed track with 3D metallic gold pills filling proportionally
 */
export const SegmentedGoldBar = ({ filledCount = 0 }) => {
  const safeCount = Math.min(5, Math.max(0, Number(filledCount) || 0));
  return (
    <div className="ig-segmented-bar" role="progressbar" aria-valuenow={safeCount * 20} aria-valuemin={0} aria-valuemax={100}>
      {[0, 1, 2, 3, 4].map((index) => (
        <div 
          key={index} 
          className={`ig-bar-segment ${index < safeCount ? 'filled' : 'empty'}`} 
        />
      ))}
    </div>
  );
};

const ICON_MAP = {
  Users, 
  FileText, 
  TrendingUp, 
  TrendingDown,
  Eye, 
  Clock, 
  GraduationCap, 
  Calendar, 
  MessageCircle, 
  ClipboardCheck, 
  Trophy, 
  BookOpen,
  DollarSign,
  UserCheck,
  CalendarCheck,
  Award,
  Activity,
  CheckCircle2,
  ShieldCheck,
  Briefcase
};

/**
 * Resolves standard icon names, forwardRef components, or label fallbacks to a verified icon
 */
const renderIcon = (iconProp, label) => {
  const lbl = label ? String(label).toLowerCase() : '';

  // 1. Quran / Student specific iconography
  if (lbl.includes('student') || lbl.includes('registry')) {
    return <RehalIcon size={26} />;
  }

  // 2. If already an instantiated React JSX element
  if (React.isValidElement(iconProp)) {
    return React.cloneElement(iconProp, {
      size: iconProp.props?.size || 24,
      strokeWidth: iconProp.props?.strokeWidth || 2,
      className: `ig-icon-svg ${iconProp.props?.className || ''}`,
    });
  }

  // 3. String name or displayName matching from predefined map
  const iconKey = typeof iconProp === 'string' 
    ? iconProp 
    : (iconProp?.displayName || iconProp?.name || '');
  if (iconKey && ICON_MAP[iconKey]) {
    const Component = ICON_MAP[iconKey];
    return <Component size={24} strokeWidth={2} className="ig-icon-svg" />;
  }

  // 4. If a Lucide icon component (function or forwardRef object with $$typeof / render)
  if (typeof iconProp === 'function' || (typeof iconProp === 'object' && iconProp !== null)) {
    try {
      const Component = iconProp;
      return <Component size={24} strokeWidth={2} className="ig-icon-svg" />;
    } catch (err) {
      console.warn("Lucide component render fallback:", err);
    }
  }

  // 5. Label-based robust contextual fallbacks
  if (lbl.includes('teacher') || lbl.includes('staff') || lbl.includes('muhaffiz') || lbl.includes('muhaffezah') || lbl.includes('faculty')) {
    return <GraduationCap size={24} strokeWidth={2} className="ig-icon-svg" />;
  }
  if (lbl.includes('schedule') || lbl.includes('timing') || lbl.includes('jadwal')) {
    return <Calendar size={24} strokeWidth={2} className="ig-icon-svg" />;
  }
  if (lbl.includes('view') || lbl.includes('parent') || lbl.includes('report')) {
    return <Eye size={24} strokeWidth={2} className="ig-icon-svg" />;
  }
  if (lbl.includes('leave') || lbl.includes('message') || lbl.includes('request')) {
    return <MessageCircle size={24} strokeWidth={2} className="ig-icon-svg" />;
  }
  if (lbl.includes('attendance') || lbl.includes('present') || lbl.includes('absent')) {
    return <ClipboardCheck size={24} strokeWidth={2} className="ig-icon-svg" />;
  }
  if (lbl.includes('score') || lbl.includes('rank') || lbl.includes('league') || lbl.includes('trophy')) {
    return <Trophy size={24} strokeWidth={2} className="ig-icon-svg" />;
  }
  if (lbl.includes('clock') || lbl.includes('minute') || lbl.includes('time') || lbl.includes('hour')) {
    return <Clock size={24} strokeWidth={2} className="ig-icon-svg" />;
  }
  if (lbl.includes('hifz') || lbl.includes('quran') || lbl.includes('juz') || lbl.includes('surat')) {
    return <BookOpen size={24} strokeWidth={2} className="ig-icon-svg" />;
  }
  if (lbl.includes('result') || lbl.includes('marks')) {
    return <FileText size={24} strokeWidth={2} className="ig-icon-svg" />;
  }
  if (lbl.includes('trend') || lbl.includes('avg')) {
    return <TrendingUp size={24} strokeWidth={2} className="ig-icon-svg" />;
  }
  if (lbl.includes('salary') || lbl.includes('fee') || lbl.includes('hub')) {
    return <DollarSign size={24} strokeWidth={2} className="ig-icon-svg" />;
  }

  // 6. Universal Fallback: never leave the icon squircle empty!
  return <Award size={24} strokeWidth={2} className="ig-icon-svg" />;
};

/**
 * OverviewCard - Pixel-perfect claymorphic card matching reference image
 */
export const OverviewCard = ({
  icon,
  label,
  value,
  sub,
  pct,
  showTrendBadge = false,
  trendPct = null,
  trendDirection = null,
  onClick,
  style = {},
  className = "",
  title
}) => {
  // Parse fraction if value contains '/'
  const isFraction = typeof value === 'string' && value.includes('/');
  let numStr = value;
  let denStr = "";
  if (isFraction) {
    const parts = String(value).split('/');
    numStr = parts[0];
    denStr = parts[1];
  }

  const valStr = String(value ?? '');
  const valLen = valStr.length;
  const isLongVal = valLen > 10;
  const isMedVal = valLen > 5 && valLen <= 10;
  const valSizeClass = isLongVal ? 'ig-val-long' : isMedVal ? 'ig-val-med' : '';

  // Calculate filled segments (0 to 5)
  let filledCount = 0;
  const isStudentCard = String(label).toLowerCase().includes('student');
  
  if (isStudentCard) {
    // Card 1 in the reference image has an empty groove (0 segments)
    filledCount = 0;
  } else if (pct !== undefined && pct !== null) {
    filledCount = Math.min(5, Math.max(0, Math.round(Number(pct) / 20)));
  } else if (isFraction) {
    const n = parseFloat(numStr) || 0;
    const d = parseFloat(denStr) || 1;
    const ratio = Math.min(1, Math.max(0, n / d));
    filledCount = Math.round(ratio * 5);
  }

  // Calculate trend badge percentage and direction
  let calculatedTrendPct = trendPct;
  let calculatedDirection = trendDirection;
  if (showTrendBadge && calculatedTrendPct === null) {
    if (pct !== undefined && pct !== null) {
      calculatedTrendPct = Math.round(Number(pct));
    } else if (isFraction) {
      const n = parseFloat(numStr) || 0;
      const d = parseFloat(denStr) || 1;
      calculatedTrendPct = Math.round((n / d) * 100);
    }
  }

  if (showTrendBadge && calculatedTrendPct !== null && !calculatedDirection) {
    calculatedDirection = calculatedTrendPct >= 50 ? 'up' : 'down';
  }

  const isClickable = typeof onClick === 'function';

  return (
    <div
      className={`infographic-card clay-overview-card ${className}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      } : undefined}
      style={{ cursor: isClickable ? 'pointer' : 'default', ...style }}
      title={title}
    >
      {/* Engraved Watermarks */}
      <svg className="ig-watermark-tr" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <circle cx="95" cy="5" r="75" stroke="rgba(180, 165, 140, 0.18)" strokeWidth="1.2" />
        <circle cx="95" cy="5" r="55" stroke="rgba(180, 165, 140, 0.12)" strokeWidth="1.2" />
        <path d="M95 5L35 65" stroke="rgba(180, 165, 140, 0.14)" strokeWidth="1.2" />
      </svg>
      
      <svg className="ig-watermark-br" viewBox="0 0 60 60" fill="none" aria-hidden="true">
        <path d="M30 10L50 30L30 50L10 30Z" stroke="rgba(180, 165, 140, 0.18)" strokeWidth="1.2" />
      </svg>

      {/* Top Row: Squircle Raised Button + Inset Trend Pill */}
      <div className="ig-top-row">
        <div className="ig-icon-wrap">
          {renderIcon(icon, label)}
        </div>

        {showTrendBadge && (
          <div className={`ig-trend ${calculatedDirection === 'up' ? 'trend-up' : 'trend-down'}`}>
            <span className="ig-trend-arrow">
              {calculatedDirection === 'up' ? (
                <TrendingUp size={13} strokeWidth={2.5} />
              ) : (
                <TrendingDown size={13} strokeWidth={2.5} />
              )}
            </span>
            {calculatedTrendPct !== null && <span className="ig-trend-val">{calculatedTrendPct}%</span>}
          </div>
        )}
      </div>

      {/* Metric Value */}
      <div className={`ig-value ${valSizeClass}`}>
        {isFraction ? (
          <>
            <span className="ig-count-anim">{numStr}</span>
            <span className="ig-frac-den">/{denStr}</span>
          </>
        ) : (
          <span className="ig-count-anim">{value}</span>
        )}
      </div>

      {/* Metric Label & Subtitle */}
      <span className="ig-label">{label}</span>
      <span className="ig-sub">{sub}</span>

      {/* 5-Segmented Gold Progress Bar */}
      <SegmentedGoldBar filledCount={filledCount} />
    </div>
  );
};

export default OverviewCard;
