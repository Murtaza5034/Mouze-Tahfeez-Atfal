import React, { useMemo, useState, useEffect } from "react";

/**
 * AmazonBottomNav - Premium Amazon-style bottom navigation bar
 * Locked to bottom edge with zero footer gap, featuring a smooth
 * sliding active pill with backdrop blur, 3D icon elevation,
 * and responsive micro-animations.
 * Automatically remains anchored and hidden when the soft keyboard is open.
 */
export default function AmazonBottomNav({
  items = [],
  activeId,
  onSelect,
  isHidden = false,
}) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const checkKeyboard = () => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable);

      if (window.visualViewport) {
        // If window innerHeight is significantly larger than visualViewport height (keyboard visible)
        const heightDiff = window.innerHeight - window.visualViewport.height;
        if (heightDiff > 120 || (isInput && heightDiff > 60)) {
          setIsKeyboardOpen(true);
          return;
        }
      }

      if (isInput && window.innerWidth <= 1024) {
        setIsKeyboardOpen(true);
        return;
      }

      setIsKeyboardOpen(false);
    };

    const handleFocusIn = (e) => {
      const tag = e.target?.tagName;
      if (
        (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) &&
        window.innerWidth <= 1024
      ) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      setTimeout(checkKeyboard, 120);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", checkKeyboard);
      window.visualViewport.addEventListener("scroll", checkKeyboard);
    }
    window.addEventListener("resize", checkKeyboard);
    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", checkKeyboard);
        window.visualViewport.removeEventListener("scroll", checkKeyboard);
      }
      window.removeEventListener("resize", checkKeyboard);
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  const activeIndex = useMemo(() => {
    return items.findIndex((item) => !item.isAction && item.id === activeId);
  }, [items, activeId]);

  const hasActive = activeIndex >= 0;
  const tabWidthPct = items.length > 0 ? 100 / items.length : 16.66;

  if (isHidden || isKeyboardOpen) {
    return null;
  }

  return (
    <nav
      className={`amazon-bottom-nav ${isKeyboardOpen || isHidden ? "keyboard-hidden nav-hidden" : ""}`}
      aria-label="Portal Bottom Navigation"
    >
      <div className="amazon-nav-tabs-wrapper">
        {/* Subtle Top Indicator Bar */}
        {hasActive && (
          <div
            className="amazon-nav-slider"
            style={{
              width: `${tabWidthPct}%`,
              transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
            }}
          >
            <div className="amazon-nav-slider-bar" />
          </div>
        )}

        {/* Tab Buttons - Pure Individual Transparent Icons */}
        {items.map((item, idx) => {
          const isActive = !item.isAction && item.id === activeId;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`amazon-nav-tab ${isActive ? "active" : ""} ${item.isAction ? "action-tab" : ""}`}
              onClick={() => {
                if (typeof item.onClick === "function") {
                  item.onClick();
                } else if (onSelect) {
                  onSelect(item.id);
                }
              }}
              aria-selected={isActive}
              role="tab"
              title={item.label}
              data-nav-idx={idx}
            >
              <div className="amazon-nav-tab-icon">
                {Icon && <Icon size={22} strokeWidth={isActive ? 2.3 : 1.8} />}
              </div>
              <span className="amazon-nav-tab-label">{item.label}</span>
            </button>
          );
        })}
      </div>
      {/* Safe Area inset spacer for modern mobile devices */}
      <div className="amazon-nav-safe-area" />
    </nav>
  );
}

