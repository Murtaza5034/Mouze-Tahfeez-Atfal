import React from "react";
import "./QuranDirectAccessCard.css";
import { BookOpen, Sparkles, ArrowRight, Mic, BookMarked, Layers, CheckCircle2 } from "lucide-react";

export default function QuranDirectAccessCard({ onOpen }) {
  return (
    <div
      className="quran-direct-card card-appear"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label="Direct Access to Quran Memorization & Tilawat"
    >
      {/* Background illuminated geometric accents */}
      <div className="quran-direct-ornament-bg" aria-hidden="true" />

      <div className="quran-direct-content">
        <div className="quran-direct-left">
          <div className="quran-direct-icon-wrap">
            <BookOpen size={30} className="quran-direct-icon" />
            <span className="quran-direct-icon-sparkle">
              <Sparkles size={14} />
            </span>
          </div>

          <div className="quran-direct-texts">
            <div className="quran-direct-badge-row">
              <span className="quran-direct-pill fatemi-gold">
                <Sparkles size={12} /> الوصول المباشر • Direct Access
              </span>
              <span className="quran-direct-pill fatemi-brown">
                <Layers size={12} /> ٣٠ جزءاً • ٦٠٤ صفحة
              </span>
            </div>

            <h3 className="arabic-kanz quran-direct-title">
              القرآن الكريم — تلاوة واختبار المصحف
            </h3>

            <p className="quran-direct-desc">
              تصفح المصحف الشريف، تلاوة ملونة مع تكبير، واختبار ذكي للحفظ بالتعرف الصوتي على صفحة بيضاء مسطرة تحاكي المصحف الفعلي.
            </p>

            <div className="quran-direct-features-row">
              <span className="quran-feature-item">
                <BookMarked size={14} /> تلاوة حرة ومصحف ملون
              </span>
              <span className="quran-feature-item">
                <Mic size={14} /> اختبار الحفظ الصوتي الذكي
              </span>
              <span className="quran-feature-item">
                <CheckCircle2 size={14} /> تنبيه الأخطاء الفوري
              </span>
            </div>
          </div>
        </div>

        <div className="quran-direct-right">
          <button
            type="button"
            className="quran-direct-cta-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <BookOpen size={18} className="cta-icon" />
            <span className="arabic-kanz">تصفح القرآن الكريم</span>
            <ArrowRight size={17} className="cta-arrow" />
          </button>
        </div>
      </div>
    </div>
  );
}
