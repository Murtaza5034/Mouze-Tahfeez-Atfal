import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Check,
} from "lucide-react";
import "./PremiumDatePicker.css";

const DAY_NAMES = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Parses YYYY-MM-DD string to local Date object
 */
function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
function formatToYMD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Formats a YYYY-MM-DD string into a readable label (e.g., "Tuesday, 06 Oct 2026")
 */
function formatDisplayDate(dateStr) {
  if (!dateStr) return "Select date...";
  const d = parseLocalDate(dateStr);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

export function PremiumDatePicker({
  value,
  onChange,
  maxDate,
  minDate,
  disabled = false,
  placeholder = "Select date...",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Active view month & year in calendar navigation
  const selectedDateObj = useMemo(() => parseLocalDate(value), [value]);
  const [viewYear, setViewYear] = useState(() => selectedDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selectedDateObj.getMonth());

  // Max and Min dates
  const todayYMD = useMemo(() => formatToYMD(new Date()), []);
  const maxYMD = maxDate || todayYMD;

  // Sync view when selected value changes
  useEffect(() => {
    if (value) {
      const d = parseLocalDate(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Navigate Months
  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Jump to Today
  const handleJumpToday = (e) => {
    e.stopPropagation();
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    const ymd = formatToYMD(now);
    if (!maxYMD || ymd <= maxYMD) {
      onChange(ymd);
      setIsOpen(false);
    }
  };

  // Build 6x7 Calendar Grid starting on Saturday (Fatemi / Tahfeez standard)
  const calendarCells = useMemo(() => {
    const cells = [];
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // Day of week for 1st of month: 0=Sun, 1=Mon, ..., 6=Sat
    const firstDayDow = firstDayOfMonth.getDay();
    // In Sat-first calendar: Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
    const satOffset = (firstDayDow + 1) % 7;

    // Previous month filler days
    const prevMonthLastDate = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = satOffset - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDate - i;
      const prevDate = new Date(viewYear, viewMonth - 1, dayNum);
      const ymd = formatToYMD(prevDate);
      cells.push({
        dateObj: prevDate,
        dayNum,
        ymd,
        isCurrentMonth: false,
        isSunday: prevDate.getDay() === 0,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(viewYear, viewMonth, d);
      const ymd = formatToYMD(dateObj);
      cells.push({
        dateObj,
        dayNum: d,
        ymd,
        isCurrentMonth: true,
        isSunday: dateObj.getDay() === 0,
      });
    }

    // Next month filler days to complete grid
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(viewYear, viewMonth + 1, d);
      const ymd = formatToYMD(nextDate);
      cells.push({
        dateObj: nextDate,
        dayNum: d,
        ymd,
        isCurrentMonth: false,
        isSunday: nextDate.getDay() === 0,
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const isNextMonthDisabled = useMemo(() => {
    if (!maxYMD) return false;
    const nextMonthFirstDay = new Date(viewYear, viewMonth + 1, 1);
    const [maxY, maxM] = maxYMD.split("-").map(Number);
    const maxDateMonthFirst = new Date(maxY, maxM - 1, 1);
    return nextMonthFirstDay > maxDateMonthFirst;
  }, [viewYear, viewMonth, maxYMD]);

  return (
    <div
      ref={containerRef}
      className={`premium-datepicker-root ${isOpen ? "is-open" : ""} ${
        disabled ? "is-disabled" : ""
      } ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        className="premium-datepicker-trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="premium-datepicker-trigger-left">
          <div className="premium-datepicker-calendar-icon-bubble">
            <CalendarIcon size={16} />
          </div>
          <span
            className={`premium-datepicker-trigger-label ${
              !value ? "is-placeholder" : ""
            }`}
          >
            {value ? formatDisplayDate(value) : placeholder}
          </span>
        </div>

        <div className="premium-datepicker-trigger-right">
          {value === todayYMD && (
            <span className="premium-datepicker-today-badge">Today</span>
          )}
          <ChevronDown
            size={16}
            className={`premium-datepicker-chevron ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Popover Dropdown Calendar */}
      {isOpen && (
        <div className="premium-datepicker-popover" role="dialog" aria-label="Select Date">
          {/* Popover Header */}
          <div className="premium-datepicker-header">
            <button
              type="button"
              className="premium-datepicker-nav-btn"
              onClick={handlePrevMonth}
              title="Previous month"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="premium-datepicker-title-group">
              <span className="premium-datepicker-month-name">
                {MONTH_NAMES[viewMonth]}
              </span>
              <span className="premium-datepicker-year-name">{viewYear}</span>
            </div>

            <button
              type="button"
              className="premium-datepicker-nav-btn"
              onClick={handleNextMonth}
              disabled={isNextMonthDisabled}
              title="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Quick Jump Bar */}
          <div className="premium-datepicker-quick-bar">
            <button
              type="button"
              className="premium-datepicker-today-btn"
              onClick={handleJumpToday}
            >
              <Sparkles size={12} />
              <span>Select Today</span>
            </button>
            <span className="premium-datepicker-quick-info">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
          </div>

          {/* Weekday Names Header */}
          <div className="premium-datepicker-weekdays-row">
            {DAY_NAMES.map((name, idx) => (
              <div
                key={name}
                className={`premium-datepicker-weekday-cell ${
                  idx === 1 ? "is-sunday" : ""
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Calendar Days Matrix */}
          <div className="premium-datepicker-days-grid">
            {calendarCells.map((cell, idx) => {
              const isSelected = cell.ymd === value;
              const isToday = cell.ymd === todayYMD;
              const isFuture = maxYMD && cell.ymd > maxYMD;
              const isPastMin = minDate && cell.ymd < minDate;
              const isDayDisabled = isFuture || isPastMin;

              return (
                <button
                  key={`${cell.ymd}-${idx}`}
                  type="button"
                  disabled={isDayDisabled}
                  onClick={() => {
                    onChange(cell.ymd);
                    setIsOpen(false);
                  }}
                  className={`premium-datepicker-day-btn ${
                    !cell.isCurrentMonth ? "is-other-month" : ""
                  } ${isSelected ? "is-selected" : ""} ${
                    isToday ? "is-today" : ""
                  } ${cell.isSunday ? "is-sunday" : ""} ${
                    isDayDisabled ? "is-disabled" : ""
                  }`}
                >
                  <span className="premium-datepicker-day-number">
                    {cell.dayNum}
                  </span>
                  {isSelected && <span className="premium-datepicker-selected-dot" />}
                  {isToday && !isSelected && (
                    <span className="premium-datepicker-today-dot" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Popover Footer */}
          <div className="premium-datepicker-footer">
            <div className="premium-datepicker-footer-left">
              <span className="premium-datepicker-footer-label">Selected:</span>
              <strong className="premium-datepicker-footer-val">
                {value ? formatDisplayDate(value) : "None"}
              </strong>
            </div>

            <button
              type="button"
              className="premium-datepicker-done-btn"
              onClick={() => setIsOpen(false)}
            >
              <Check size={14} /> Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PremiumDatePicker;
