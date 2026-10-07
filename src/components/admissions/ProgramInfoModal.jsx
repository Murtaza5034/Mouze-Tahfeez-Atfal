import React from "react";
import { X, Clock, MapPin, Calendar, DollarSign, Award, ExternalLink, Sparkles, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProgramInfoModal({ isOpen, onClose, programData }) {
  if (!isOpen || !programData) return null;

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
          className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 text-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/60">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  {programData.badge || "Programme Details"}
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  {programData.name}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 md:p-8 overflow-y-auto space-y-6">
            {/* Motto Callout */}
            {programData.motto && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-xs font-semibold uppercase text-amber-400 tracking-wider">
                  Our Motto
                </p>
                <p className="text-base md:text-lg font-medium italic text-amber-100 mt-1">
                  "{programData.motto}"
                </p>
              </div>
            )}

            {/* Quick Spec Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Age Group */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                <Award className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Eligible Age</p>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">
                    {programData.age_group || "All Mumineen"}
                  </p>
                </div>
              </div>

              {/* Schedule Days */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                <Calendar className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Class Days</p>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">
                    {programData.days || "Mondays to Fridays"}
                  </p>
                </div>
              </div>

              {/* Timings */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                <Clock className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Timings</p>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">
                    {programData.timings || "Scheduled Batches"}
                  </p>
                </div>
              </div>

              {/* Hub Raqam */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Hub Raqam (Monthly)</p>
                  <p className="text-sm font-bold text-amber-200 mt-0.5">
                    {programData.hub_raqam || "Standard Hub"}
                  </p>
                </div>
              </div>
            </div>

            {/* Venues */}
            {programData.venues && (
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3">
                <MapPin className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Venues</p>
                  <p className="text-sm text-slate-200 mt-0.5 leading-relaxed">
                    {programData.venues}
                  </p>
                </div>
              </div>
            )}

            {/* About the Programme */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                About This Programme
              </h4>
              <div className="text-sm text-slate-300 leading-relaxed space-y-3 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 whitespace-pre-line">
                {programData.description}
              </div>
            </div>

            {/* External Link configured by Admin */}
            {programData.info_url && (
              <div className="pt-2">
                <a
                  href={programData.info_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                >
                  <span>Explore Full Syllabus & Details Online</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
