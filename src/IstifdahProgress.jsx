import React, { useEffect, useState } from 'react';
import './IstifdahProgress.css';

const IstifdahProgress = ({ weeklyResult }) => {
  const [percent, setPercent] = useState(0);

  const parseNum = (val) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? 0 : num;
  };

  const wusool_juz = parseNum(weeklyResult?.wusool_juz);
  const wusool_page = parseNum(weeklyResult?.wusool_page);
  const target_juz = parseNum(weeklyResult?.istifadah_juz);
  const target_page = parseNum(weeklyResult?.istifadah_page);

  // Backwards juz logic (30 - juz) * 20 + page
  const calcPages = (juz, page) => {
    if (juz === 0 && page === 0) return 0;
    // Cap juz at 30 just in case
    const safeJuz = Math.min(Math.max(juz, 1), 30);
    return (30 - safeJuz) * 20 + page;
  };

  const wusoolPages = calcPages(wusool_juz, wusool_page);
  const targetPages = calcPages(target_juz, target_page);

  const remainingPages = Math.max(0, targetPages - wusoolPages);
  
  let targetPercent = 0;
  if (targetPages > 0) {
    targetPercent = Math.min(100, Math.max(0, (wusoolPages / targetPages) * 100));
  } else if (wusoolPages > 0) {
    // If no target set but wusool is greater than 0, let's just show full or none.
    targetPercent = 100;
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setPercent(targetPercent);
    }, 300);
    return () => clearTimeout(timer);
  }, [targetPercent]);

  if (!weeklyResult || (targetPages === 0 && wusoolPages === 0)) {
    return null; // Don't show if no data at all
  }

  return (
    <div className="istifdah-progress-container card-appear">
      <div className="glass-card">
        <div className="card-header">
          <h3 className="card-title">Target Till Istifdah</h3>
          <p className="card-subtitle">Your progress towards the next milestone</p>
        </div>

        <div className="progress-body">
          <div className="liquid-container">
            <div className="liquid-circle">
              <div 
                className="liquid-wave" 
                style={{ top: `${100 - percent}%` }}
              >
                {/* SVG wave effect */}
                <svg viewBox="0 0 500 150" preserveAspectRatio="none">
                  <path d="M0,100 C150,200 350,0 500,100 L500,150 L0,150 Z" className="wave wave1"></path>
                  <path d="M0,100 C150,0 350,200 500,100 L500,150 L0,150 Z" className="wave wave2"></path>
                </svg>
                <div className="water-fill"></div>
              </div>
              <div className="percentage-text">
                <span className="count-up">{Math.round(percent)}</span>%
              </div>
            </div>
          </div>

          <div className="stats-container">
            <div className="stat-box">
              <span className="stat-label">Wusool</span>
              <span className="stat-val">Juz {wusool_juz || "-"} Page {wusool_page || "-"}</span>
              <span className="stat-sub">{wusoolPages} pages</span>
            </div>
            
            <div className="stat-divider">
              <div className="line"></div>
              <div className="icon">→</div>
            </div>

            <div className="stat-box">
              <span className="stat-label">Target</span>
              <span className="stat-val">Juz {target_juz || "-"} Page {target_page || "-"}</span>
              <span className="stat-sub">{targetPages} pages</span>
            </div>
          </div>
        </div>

        <div className="footer-message">
          {remainingPages > 0 ? (
            <p><strong>{remainingPages} pages</strong> remaining to Istifdah. Keep going!</p>
          ) : targetPages > 0 ? (
            <p className="success-text"><strong>Istifdah Target Reached!</strong> MashaAllah!</p>
          ) : (
            <p>Target not fully set.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default IstifdahProgress;
