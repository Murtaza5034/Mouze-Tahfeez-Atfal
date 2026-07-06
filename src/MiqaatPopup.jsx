import React from 'react';
import { X, MapPin, Globe, ExternalLink, Info, Star, Sparkles, Moon } from 'lucide-react';

// Icon/color mapping for miqaat event types
const TYPE_CONFIG = {
  'Urus': { icon: Star, color: '#d4af37', label: 'Urus' },
  'Milad': { icon: Sparkles, color: '#22c55e', label: 'Milad' },
  'Rozu': { icon: Moon, color: '#3b82f6', label: 'Rozu' },
  'Ayyam ul Biz': { icon: Moon, color: '#3b82f6', label: 'Ayyam ul Biz' },
  'Ashara Mubaraka': { icon: Info, color: '#ef4444', label: 'Ashara Mubaraka' },
};

const getTypeConfig = (typeName) => {
  if (!typeName) return { icon: Info, color: '#888', label: 'Event' };
  // Try exact match first
  if (TYPE_CONFIG[typeName]) return TYPE_CONFIG[typeName];
  // Fallback
  return { icon: Info, color: '#888', label: typeName };
};

/**
 * MiqaatPopup — Full-screen overlay modal showing detailed miqaat event info.
 *
 * Props:
 *   events    — Array of miqaat event objects from the Mumineen API
 *   dayName   — The day name (e.g., "MONDAY")
 *   fatemiDate — The Fatemi date string (e.g., "22 محرم الحرام 1448")
 *   onClose   — Callback to close the popup
 */
export default function MiqaatPopup({ events, dayName, fatemiDate, onClose }) {
  if (!events || events.length === 0) return null;

  // Close on Escape key
  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="miqaat-popup-overlay" onClick={onClose}>
      <div className="miqaat-popup-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="miqaat-popup-header">
          <div className="miqaat-popup-header-left">
            <span className="miqaat-popup-day">{dayName || ''}</span>
            {fatemiDate && <span className="miqaat-popup-fatemi">{fatemiDate}</span>}
          </div>
          <button className="miqaat-popup-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Events list */}
        <div className="miqaat-popup-body">
          {events.length === 1 ? (
            <p className="miqaat-popup-count">
              {events.length} Miqaat on this day
            </p>
          ) : (
            <p className="miqaat-popup-count">
              {events.length} Miqaats on this day
            </p>
          )}

          {events.map((evt, idx) => {
            const typeConf = getTypeConfig(evt.type?.name);
            const TypeIcon = typeConf.icon;
            const hasLocation = evt.location && evt.location.name;
            const hasLink = evt.local_link || evt.external_link;

            return (
              <div key={`${evt.hijri_date}-${idx}`} className="miqaat-popup-event">
                <div className="miqaat-popup-event-type-badge" style={{ backgroundColor: typeConf.color }}>
                  <TypeIcon size={12} />
                  <span>{typeConf.label}</span>
                </div>

                <div className="miqaat-popup-event-name">{evt.name}</div>

                {evt.gregorian_date && (
                  <div className="miqaat-popup-event-meta">
                    <Info size={12} />
                    <span>
                      {evt.gregorian_month} {evt.gregorian_day}, {evt.gregorian_date.slice(0, 4)}
                    </span>
                  </div>
                )}

                {hasLocation && (
                  <div className="miqaat-popup-event-meta">
                    <MapPin size={12} />
                    <span>
                      {evt.location.name}
                      {evt.location.state ? `, ${evt.location.state}` : ''}
                    </span>
                  </div>
                )}

                {hasLink && (
                  <div className="miqaat-popup-event-links">
                    {evt.external_link && (
                      <a
                        href={evt.external_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="miqaat-popup-link"
                      >
                        <ExternalLink size={12} /> Open Link
                      </a>
                    )}
                    {evt.local_link && (
                      <a
                        href={`https://mumineen.org${evt.local_link.startsWith('/') ? '' : '/'}${evt.local_link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="miqaat-popup-link"
                      >
                        <Globe size={12} /> Read More
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
