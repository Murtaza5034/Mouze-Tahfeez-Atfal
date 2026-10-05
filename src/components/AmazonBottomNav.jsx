import React, { useMemo } from "react";

/**
 * AmazonBottomNav - Premium Amazon-style bottom navigation bar
 * Locked to bottom edge with zero footer gap, featuring a smooth
 * sliding active pill with backdrop blur and responsive micro-animations.
 */
export default function AmazonBottomNav({ items = [], activeId, onSelect }) {
  const activeIndex = useMemo(() => {
    return items.findIndex((item) => item.id === activeId);
  }, [items, activeId]);

  const hasActive = activeIndex >= 0;
  const tabWidthPct = items.length > 0 ? 100 / items.length : 20;

  return (
    <nav className="amazon-bottom-nav" aria-label="Portal Bottom Navigation">
      <div className="amazon-nav-tabs-wrapper">
        {/* Animated Sliding Indicator Bar & Ambient Glow */}
        {hasActive && (
          <div
            className="amazon-nav-slider"
            style={{
              width: `${tabWidthPct}%`,
              transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
            }}
          >
            <div className="amazon-nav-slider-bar" />
            <div className="amazon-nav-slider-glow" />
          </div>
        )}

        {/* Tab Buttons */}
        {items.map((item, idx) => {
          const isActive = item.id === activeId;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`amazon-nav-tab ${isActive ? "active" : ""}`}
              onClick={() => onSelect(item.id)}
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
