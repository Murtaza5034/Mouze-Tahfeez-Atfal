import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight, Image as ImageIcon, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./AdmissionStyles.css";

export default function VenuePhotoGalleryModal({ isOpen, onClose, photos = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!isOpen || !photos || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex] || photos[0];

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

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
          style={{ maxWidth: "860px", padding: "0", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "92vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1.5px solid var(--adm-gold-border)", background: "var(--adm-cream-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ padding: "8px", borderRadius: "12px", background: "var(--adm-gold-subtle)", color: "var(--adm-gold-dark)", border: "1px solid var(--adm-gold-border)" }}>
                <ImageIcon size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: "var(--adm-espresso-main)" }}>
                  Tahfeez Galiakot Venue Gallery
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--adm-text-muted)" }}>
                  Photo {currentIndex + 1} of {photos.length} • {currentPhoto.tag || "Venue"}
                </p>
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

          {/* Main Photo Display */}
          <div style={{ position: "relative", flex: 1, background: "rgba(43, 23, 14, 0.95)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "360px", maxHeight: "56vh", overflow: "hidden" }}>
            <AnimatePresence mode="wait">
              <motion.img
                key={currentIndex}
                src={currentPhoto.url}
                alt={currentPhoto.title || "Venue photo"}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.28 }}
                style={{ maxHeight: "52vh", width: "auto", maxWidth: "100%", objectFit: "contain", borderRadius: "8px" }}
              />
            </AnimatePresence>

            {/* Navigation Arrows */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  style={{
                    position: "absolute",
                    left: "16px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    padding: "10px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.9)",
                    color: "var(--adm-espresso-main)",
                    border: "1.5px solid var(--adm-gold-primary)",
                    cursor: "pointer",
                    boxShadow: "var(--adm-shadow-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  title="Previous Photo"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={handleNext}
                  style={{
                    position: "absolute",
                    right: "16px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    padding: "10px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.9)",
                    color: "var(--adm-espresso-main)",
                    border: "1.5px solid var(--adm-gold-primary)",
                    cursor: "pointer",
                    boxShadow: "var(--adm-shadow-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  title="Next Photo"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
          </div>

          {/* Photo Caption / Footer */}
          <div style={{ padding: "16px 24px", background: "#ffffff", borderTop: "1.5px solid var(--adm-gold-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h4 style={{ margin: 0, fontSize: "14.5px", fontWeight: 800, color: "var(--adm-espresso-main)" }}>
                {currentPhoto.title || "Venue Preview"}
              </h4>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--adm-text-muted)" }}>
                {currentPhoto.description || "Official Tahfeez classroom environment."}
              </p>
            </div>

            {/* Thumbnail dots */}
            <div style={{ display: "flex", gap: "6px" }}>
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  style={{
                    width: "9px",
                    height: "9px",
                    borderRadius: "50%",
                    border: "none",
                    background: currentIndex === i ? "var(--adm-gold-primary)" : "var(--adm-border-soft)",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
