import React from "react";
import { X, Clock, Calendar, Award, BookOpen, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./AdmissionStyles.css";

export default function ProgramInfoModal({ isOpen, onClose, programData }) {
  if (!isOpen || !programData) return null;

  return (
    <AnimatePresence>
      <div className="adm-modal-overlay">
        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="adm-modal-card"
          style={{ maxWidth: "620px", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1.5px solid var(--adm-gold-border)", background: "var(--adm-cream-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ padding: "10px", borderRadius: "14px", background: "var(--adm-gold-subtle)", color: "var(--adm-gold-dark)", border: "1.5px solid var(--adm-gold-border)" }}>
                <BookOpen size={22} />
              </div>
              <div>
                <span className="adm-brand-tag" style={{ marginBottom: "4px", display: "inline-block" }}>
                  {programData.badge || "Programme Details"}
                </span>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: "var(--adm-espresso-main)" }}>
                  {programData.name}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="adm-btn-text"
              style={{ fontSize: "18px", padding: "6px 12px" }}
            >
              ✕
            </button>
          </div>

          {/* Body Content */}
          <div style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Motto Callout */}
            {programData.motto && (
              <div style={{ padding: "16px", borderRadius: "16px", background: "linear-gradient(135deg, #fff9ea 0%, #fff2d1 100%)", border: "1.5px solid var(--adm-gold-border)", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-gold-dark)", letterSpacing: "0.6px" }}>
                  Our Motto
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "15px", fontStyle: "italic", fontWeight: 700, color: "var(--adm-espresso-main)" }}>
                  "{programData.motto}"
                </p>
              </div>
            )}

            {/* Quick Spec Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
              {/* Age Group */}
              <div style={{ padding: "14px", borderRadius: "14px", background: "#ffffff", border: "1.5px solid var(--adm-border-soft)", display: "flex", alignItems: "flex-start", gap: "10px", boxShadow: "var(--adm-shadow-sm)" }}>
                <Award size={18} color="var(--adm-gold-dark)" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--adm-text-muted)", fontWeight: 700 }}>Eligible Age</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", fontWeight: 800, color: "var(--adm-espresso-main)" }}>
                    {programData.age_group || "All Mumineen"}
                  </p>
                </div>
              </div>

              {/* Schedule Days */}
              <div style={{ padding: "14px", borderRadius: "14px", background: "#ffffff", border: "1.5px solid var(--adm-border-soft)", display: "flex", alignItems: "flex-start", gap: "10px", boxShadow: "var(--adm-shadow-sm)" }}>
                <Calendar size={18} color="var(--adm-emerald-primary)" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--adm-text-muted)", fontWeight: 700 }}>Class Days</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", fontWeight: 800, color: "var(--adm-espresso-main)" }}>
                    {programData.days || "Mondays to Fridays"}
                  </p>
                </div>
              </div>

              {/* Timings */}
              <div style={{ padding: "14px", borderRadius: "14px", background: "#ffffff", border: "1.5px solid var(--adm-border-soft)", display: "flex", alignItems: "flex-start", gap: "10px", boxShadow: "var(--adm-shadow-sm)" }}>
                <Clock size={18} color="var(--adm-gold-dark)" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--adm-text-muted)", fontWeight: 700 }}>Timings</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", fontWeight: 800, color: "var(--adm-espresso-main)" }}>
                    {programData.timings || "Scheduled Batches"}
                  </p>
                </div>
              </div>

              {/* Hifz Goal */}
              <div style={{ padding: "14px", borderRadius: "14px", background: "#ffffff", border: "1.5px solid var(--adm-border-soft)", display: "flex", alignItems: "flex-start", gap: "10px", boxShadow: "var(--adm-shadow-sm)" }}>
                <CheckCircle2 size={18} color="var(--adm-emerald-primary)" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--adm-text-muted)", fontWeight: 700 }}>Hifz Goal</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", fontWeight: 800, color: "var(--adm-espresso-main)" }}>
                    {programData.goal || "Structured Marhala Syllabus"}
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{ background: "var(--adm-cream-soft)", padding: "18px", borderRadius: "16px", border: "1.5px solid var(--adm-gold-border)" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "var(--adm-gold-dark)" }}>
                Programme Description
              </h4>
              <p style={{ margin: 0, fontSize: "13.5px", lineHeight: "1.7", color: "var(--adm-espresso-light)" }}>
                {programData.description}
              </p>
            </div>
          </div>

          {/* Footer Action */}
          <div style={{ padding: "16px 24px", background: "#ffffff", borderTop: "1.5px solid var(--adm-gold-border)", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              className="adm-btn-primary"
              style={{ padding: "10px 24px", fontSize: "13px" }}
            >
              Close Details
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
