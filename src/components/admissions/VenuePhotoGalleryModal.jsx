import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight, MapPin, Image as ImageIcon, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 md:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="relative w-full max-w-4xl bg-slate-900/95 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 text-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-amber-100">
                  Tahfeez Galiakot Venue Gallery
                </h3>
                <p className="text-xs text-slate-400">
                  Photo {currentIndex + 1} of {photos.length} • {currentPhoto.tag || "Venue"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Photo Display */}
          <div className="relative flex-1 bg-black/60 flex items-center justify-center min-h-[340px] md:min-h-[460px] overflow-hidden group">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentIndex}
                src={currentPhoto.url}
                alt={currentPhoto.title || "Venue photo"}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="max-h-[50vh] md:max-h-[58vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
              />
            </AnimatePresence>

            {/* Navigation Arrows */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-900/80 text-amber-300 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/40 backdrop-blur-sm transition-all shadow-xl cursor-pointer"
                  title="Previous Photo"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-900/80 text-amber-300 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/40 backdrop-blur-sm transition-all shadow-xl cursor-pointer"
                  title="Next Photo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Photo Badge overlay */}
            <div className="absolute top-4 left-4 bg-slate-950/75 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-semibold text-amber-300 flex items-center gap-1.5 backdrop-blur-md">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              {currentPhoto.tag || "Tahfeez Galiakot"}
            </div>
          </div>

          {/* Caption & Details Footer */}
          <div className="p-4 md:p-6 bg-slate-900/90 border-t border-slate-800 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h4 className="text-base font-semibold text-amber-200">
                  {currentPhoto.title || "Tahfeez Study Sanctuary"}
                </h4>
                <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">
                  {currentPhoto.description || "Air conditioned, structured learning environment designed for focused Hifz al-Quran."}
                </p>
              </div>
            </div>

            {/* Thumbnails strip */}
            {photos.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pt-2 pb-1 scrollbar-thin">
                {photos.map((p, idx) => (
                  <button
                    key={p.id || idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`relative rounded-lg overflow-hidden flex-shrink-0 w-16 h-12 md:w-20 md:h-14 border-2 transition-all cursor-pointer ${
                      currentIndex === idx
                        ? "border-amber-400 scale-105 shadow-md shadow-amber-500/20"
                        : "border-slate-700 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={p.url}
                      alt={p.title || `Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
