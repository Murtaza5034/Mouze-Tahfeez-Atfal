import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Clock,
  MapPin,
  Calendar,
  Save,
  RotateCw,
  Navigation,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  normalizeAttendanceSettings,
  fetchAttendanceSettings,
  saveAttendanceSettings,
  checkAttendanceWindow,
  getExactUserLocation,
} from "../utils/attendanceSettingsHelper";
import "./AdminTeacherAttendanceSettings.css";

const ALL_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function AdminTeacherAttendanceSettings({
  isKibarAdmin = false,
  onShowAction,
  onRefresh,
}) {
  // Section toggle: atfal vs kibar
  const [selectedSection, setSelectedSection] = useState(() =>
    isKibarAdmin ? "kibar" : "atfal"
  );

  // Settings State
  const [startTime, setStartTime] = useState(DEFAULT_ATTENDANCE_SETTINGS.start_time);
  const [endTime, setEndTime] = useState(DEFAULT_ATTENDANCE_SETTINGS.end_time);
  const [activeDays, setActiveDays] = useState(DEFAULT_ATTENDANCE_SETTINGS.active_days);
  const [venueName, setVenueName] = useState(DEFAULT_ATTENDANCE_SETTINGS.venue_name);
  const [venueLat, setVenueLat] = useState(DEFAULT_ATTENDANCE_SETTINGS.venue_lat);
  const [venueLng, setVenueLng] = useState(DEFAULT_ATTENDANCE_SETTINGS.venue_lng);
  const [radius, setRadius] = useState(DEFAULT_ATTENDANCE_SETTINGS.radius);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [saveErrorMsg, setSaveErrorMsg] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Load settings on section change
  const loadSettings = useCallback(async (sectionKey) => {
    setIsLoading(true);
    setSaveSuccessMsg("");
    setSaveErrorMsg("");
    try {
      const data = await fetchAttendanceSettings(sectionKey === "kibar");
      setStartTime(data.start_time);
      setEndTime(data.end_time);
      setActiveDays(data.active_days);
      setVenueName(data.venue_name);
      setVenueLat(data.venue_lat);
      setVenueLng(data.venue_lng);
      setRadius(data.radius);
    } catch (err) {
      console.warn("Error loading attendance settings:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings(selectedSection);
  }, [selectedSection, loadSettings]);

  // Leaflet custom marker icon
  const createMosquePinIcon = useCallback(() => {
    return L.divIcon({
      className: "att-leaflet-custom-marker",
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: #ffffff;
          border: 3px solid #d4af37;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            transform: rotate(45deg);
            color: #b8941f;
            font-size: 14px;
            font-weight: 800;
          ">🕌</div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  }, []);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const lat = Number(venueLat) || DEFAULT_ATTENDANCE_SETTINGS.venue_lat;
    const lng = Number(venueLng) || DEFAULT_ATTENDANCE_SETTINGS.venue_lng;
    const rad = Number(radius) || DEFAULT_ATTENDANCE_SETTINGS.radius;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 18,
        scrollWheelZoom: true,
      });

      // OpenStreetMap Tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Marker
      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: createMosquePinIcon(),
      }).addTo(map);

      marker.bindPopup(`<b>${venueName || "Venue"}</b><br>Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);

      // Geofence Circle
      const circle = L.circle([lat, lng], {
        color: "#d4af37",
        fillColor: "#d4af37",
        fillOpacity: 0.2,
        weight: 2,
        radius: rad,
      }).addTo(map);

      // Drag event
      marker.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        setVenueLat(Math.round(pos.lat * 1e7) / 1e7);
        setVenueLng(Math.round(pos.lng * 1e7) / 1e7);
        circle.setLatLng(pos);
        marker.setPopupContent(`<b>${venueName || "Venue"}</b><br>Lat: ${pos.lat.toFixed(6)}, Lng: ${pos.lng.toFixed(6)}`);
      });

      // Map click event
      map.on("click", (e) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        setVenueLat(Math.round(clickLat * 1e7) / 1e7);
        setVenueLng(Math.round(clickLng * 1e7) / 1e7);
        marker.setLatLng([clickLat, clickLng]);
        circle.setLatLng([clickLat, clickLng]);
        marker.setPopupContent(`<b>${venueName || "Venue"}</b><br>Lat: ${clickLat.toFixed(6)}, Lng: ${clickLng.toFixed(6)}`);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
    } else {
      // Update existing map
      const map = mapInstanceRef.current;
      const marker = markerRef.current;
      const circle = circleRef.current;

      if (marker && circle) {
        const newPos = [lat, lng];
        marker.setLatLng(newPos);
        circle.setLatLng(newPos);
        circle.setRadius(rad);
        marker.setPopupContent(`<b>${venueName || "Venue"}</b><br>Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
      }
    }

    return () => {
      // Do not destroy map on every render to prevent flickering
    };
  }, [venueLat, venueLng, radius, venueName, createMosquePinIcon]);

  // Clean up map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map when lat/lng/radius change via inputs
  const handleLatChange = (val) => {
    const num = parseFloat(val);
    setVenueLat(val);
    if (!isNaN(num) && mapInstanceRef.current && markerRef.current && circleRef.current) {
      const currentLng = Number(venueLng) || DEFAULT_ATTENDANCE_SETTINGS.venue_lng;
      markerRef.current.setLatLng([num, currentLng]);
      circleRef.current.setLatLng([num, currentLng]);
      mapInstanceRef.current.panTo([num, currentLng]);
    }
  };

  const handleLngChange = (val) => {
    const num = parseFloat(val);
    setVenueLng(val);
    if (!isNaN(num) && mapInstanceRef.current && markerRef.current && circleRef.current) {
      const currentLat = Number(venueLat) || DEFAULT_ATTENDANCE_SETTINGS.venue_lat;
      markerRef.current.setLatLng([currentLat, num]);
      circleRef.current.setLatLng([currentLat, num]);
      mapInstanceRef.current.panTo([currentLat, num]);
    }
  };

  const handleRadiusChange = (val) => {
    const num = parseInt(val, 10);
    setRadius(val);
    if (!isNaN(num) && circleRef.current) {
      circleRef.current.setRadius(num);
    }
  };

  // Day toggle
  const toggleDay = (day) => {
    setActiveDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  // Presets
  const setPresetMonSat = () => {
    setActiveDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  };
  const setPresetAllDays = () => {
    setActiveDays([...ALL_DAYS]);
  };
  const setPresetMonFri = () => {
    setActiveDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  };

  // Reset to Burhani Masjid, Galiakot
  const handleResetToBurhaniMasjid = () => {
    const defLat = DEFAULT_ATTENDANCE_SETTINGS.venue_lat;
    const defLng = DEFAULT_ATTENDANCE_SETTINGS.venue_lng;
    const defRad = DEFAULT_ATTENDANCE_SETTINGS.radius;
    const defName = DEFAULT_ATTENDANCE_SETTINGS.venue_name;

    setVenueLat(defLat);
    setVenueLng(defLng);
    setRadius(defRad);
    setVenueName(defName);

    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      markerRef.current.setLatLng([defLat, defLng]);
      circleRef.current.setLatLng([defLat, defLng]);
      circleRef.current.setRadius(defRad);
      mapInstanceRef.current.setView([defLat, defLng], 18);
    }

    if (onShowAction) {
      onShowAction("success", "Reset venue to Burhani Masjid, Galiakot coordinates!");
    }
  };

  // Detect Current Location
  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const loc = await getExactUserLocation();
      const roundLat = Math.round(loc.lat * 1e7) / 1e7;
      const roundLng = Math.round(loc.lng * 1e7) / 1e7;

      setVenueLat(roundLat);
      setVenueLng(roundLng);

      if (mapInstanceRef.current && markerRef.current && circleRef.current) {
        markerRef.current.setLatLng([roundLat, roundLng]);
        circleRef.current.setLatLng([roundLat, roundLng]);
        mapInstanceRef.current.setView([roundLat, roundLng], 18);
      }

      if (onShowAction) {
        onShowAction("success", `Detected location: ${roundLat}, ${roundLng} (±${Math.round(loc.accuracy || 0)}m)`);
      }
    } catch (err) {
      const msg =
        err.message === "LOCATION_PERMISSION_DENIED"
          ? "Location permission was denied. Please allow GPS access in your browser."
          : "Unable to detect exact location. Please ensure device GPS is turned on.";
      if (onShowAction) onShowAction("error", msg);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Save Settings
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccessMsg("");
    setSaveErrorMsg("");

    const numLat = parseFloat(venueLat);
    const numLng = parseFloat(venueLng);
    const numRadius = parseInt(radius, 10);

    if (isNaN(numLat) || isNaN(numLng)) {
      setIsSaving(false);
      setSaveErrorMsg("Please enter valid Latitude and Longitude coordinates.");
      if (onShowAction) onShowAction("error", "Invalid coordinates.");
      return;
    }

    if (isNaN(numRadius) || numRadius <= 0) {
      setIsSaving(false);
      setSaveErrorMsg("Please enter a valid Geofence Radius in meters (e.g. 15).");
      if (onShowAction) onShowAction("error", "Invalid radius.");
      return;
    }

    const payload = {
      start_time: startTime,
      end_time: endTime,
      active_days: activeDays,
      venue_name: venueName || DEFAULT_ATTENDANCE_SETTINGS.venue_name,
      venue_lat: numLat,
      venue_lng: numLng,
      radius: numRadius,
      // PascalCase fields
      StartTime: startTime,
      EndTime: endTime,
      ActiveDays: activeDays,
      VenueLat: numLat,
      VenueLng: numLng,
      Radius: numRadius,
      VenueName: venueName || DEFAULT_ATTENDANCE_SETTINGS.venue_name,
    };

    try {
      await saveAttendanceSettings(payload, selectedSection === "kibar");
      setSaveSuccessMsg(
        `Saved attendance settings for ${selectedSection === "kibar" ? "Kibar" : "Atfal"} successfully!`
      );
      if (onShowAction) {
        onShowAction(
          "success",
          `Teacher Attendance Settings updated for ${selectedSection === "kibar" ? "Tahfeez al Kibar" : "Rawdat al Atfal"}!`
        );
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Save error:", err);
      setSaveErrorMsg(err.message || "Failed to save settings. Please try again.");
      if (onShowAction) {
        onShowAction("error", "Failed to save settings: " + (err.message || "Network error"));
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Real-time window preview calculation
  const windowPreview = useMemo(() => {
    return checkAttendanceWindow(
      {
        start_time: startTime,
        end_time: endTime,
        active_days: activeDays,
      },
      new Date()
    );
  }, [startTime, endTime, activeDays]);

  return (
    <div className="att-settings-container card-appear">
      {/* Page Header */}
      <div className="att-settings-header">
        <div className="att-settings-title-row">
          <div className="att-settings-title-group">
            <div className="att-settings-icon-badge">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="att-settings-title">Teacher Attendance Settings</h2>
              <p className="att-settings-subtitle">
                Configure timing rules, active days, and strict venue geofencing for self-attendance
              </p>
            </div>
          </div>

          {/* Section Switcher (Atfal vs Kibar) */}
          <div className="att-section-toggle-wrap">
            <button
              type="button"
              className={`att-section-toggle-btn ${selectedSection === "atfal" ? "active" : ""}`}
              onClick={() => setSelectedSection("atfal")}
            >
              <span>🕌</span>
              <span>Atfal Settings</span>
            </button>
            <button
              type="button"
              className={`att-section-toggle-btn ${selectedSection === "kibar" ? "active" : ""}`}
              onClick={() => setSelectedSection("kibar")}
            >
              <span>🏛️</span>
              <span>Kibar Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Time & Days, Right = Venue & Map */}
      <div className="att-settings-grid">
        {/* =========================================================
            CARD 1: TIME CONFIGURATION & ACTIVE DAYS
           ========================================================= */}
        <section className="att-card">
          <div className="att-card-header">
            <div className="att-card-header-left">
              <div className="att-card-header-icon">
                <Clock size={18} />
              </div>
              <h3 className="att-card-title">Time & Active Days Configuration</h3>
            </div>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "6px",
                background: "rgba(212, 175, 55, 0.15)",
                color: "#b8941f",
              }}
            >
              {selectedSection.toUpperCase()}
            </span>
          </div>

          <div className="att-card-body">
            {/* Time Pickers */}
            <div className="att-time-row">
              <div className="att-field-group">
                <label className="att-field-label">
                  <Clock size={14} /> Start Time
                </label>
                <div className="att-input-wrap">
                  <Clock size={16} />
                  <input
                    type="time"
                    className="att-input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <span className="att-field-helper">Default: 16:25 (4:25 PM)</span>
              </div>

              <div className="att-field-group">
                <label className="att-field-label">
                  <Clock size={14} /> End Time
                </label>
                <div className="att-input-wrap">
                  <Clock size={16} />
                  <input
                    type="time"
                    className="att-input"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
                <span className="att-field-helper">Default: 16:35 (4:35 PM)</span>
              </div>
            </div>

            {/* Day-of-week Selector */}
            <div className="att-field-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="att-field-label">
                  <Calendar size={14} /> Active Days of the Week
                </label>
                <div className="att-quick-presets-row">
                  <button type="button" className="att-preset-btn" onClick={setPresetMonSat}>
                    Mon - Sat
                  </button>
                  <button type="button" className="att-preset-btn" onClick={setPresetAllDays}>
                    All Days
                  </button>
                  <button type="button" className="att-preset-btn" onClick={setPresetMonFri}>
                    Mon - Fri
                  </button>
                </div>
              </div>

              <div className="att-days-grid" style={{ marginTop: "6px" }}>
                {ALL_DAYS.map((day) => {
                  const isSelected = activeDays.includes(day);
                  const isSunday = day === "Sunday";
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`att-day-chip ${isSelected ? "active" : ""}`}
                      onClick={() => toggleDay(day)}
                    >
                      <span>{day.slice(0, 3)}</span>
                      {isSelected ? <CheckCircle2 size={13} /> : null}
                    </button>
                  );
                })}
              </div>
              <span className="att-field-helper">
                Selected: {activeDays.join(", ")}
              </span>
            </div>

            {/* Window summary preview box */}
            <div className="att-window-summary-box">
              <div className="att-window-summary-icon">
                <Sparkles size={20} />
              </div>
              <div>
                <div className="att-window-summary-title">
                  Attendance Window: {windowPreview.startLabel} – {windowPreview.endLabel}
                </div>
                <div className="att-window-summary-desc">
                  Active on {activeDays.length} days/week. Today is{" "}
                  <strong>{windowPreview.currentDayName}</strong> (
                  {windowPreview.isActiveDay ? "Active Day" : "Inactive Day"}). Card unhides strictly within this window.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            CARD 2: VENUE GEOFENCING CONFIGURATION & MAP
           ========================================================= */}
        <section className="att-card">
          <div className="att-card-header">
            <div className="att-card-header-left">
              <div className="att-card-header-icon">
                <MapPin size={18} />
              </div>
              <h3 className="att-card-title">Add / Update Venue Location</h3>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${venueLat},${venueLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="att-btn-secondary"
              style={{ padding: "4px 10px", fontSize: "0.72rem" }}
            >
              <ExternalLink size={12} /> Google Maps
            </a>
          </div>

          <div className="att-card-body">
            {/* Interactive Leaflet Map */}
            <div className="att-field-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="att-field-label">
                  <Navigation size={14} /> Interactive Pin Map
                </label>
                <span className="att-field-helper">
                  Click or drag pin to position venue
                </span>
              </div>
              <div ref={mapContainerRef} className="att-map-container" />
            </div>

            {/* Action buttons under map */}
            <div className="att-map-actions-row">
              <button
                type="button"
                className="att-btn-secondary"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
              >
                {isDetectingLocation ? (
                  <RotateCw size={13} className="att-spin" />
                ) : (
                  <Navigation size={13} />
                )}
                <span>Use Current Location</span>
              </button>

              <button
                type="button"
                className="att-btn-secondary"
                onClick={handleResetToBurhaniMasjid}
              >
                <RotateCw size={13} />
                <span>Reset to Burhani Masjid</span>
              </button>
            </div>

            {/* Venue Name & Coordinates Input Fields */}
            <div className="att-field-group">
              <label className="att-field-label">Venue Name</label>
              <input
                type="text"
                className="att-input att-input-plain"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="e.g. Burhani Masjid"
              />
            </div>

            <div className="att-time-row">
              <div className="att-field-group">
                <label className="att-field-label">Latitude</label>
                <input
                  type="number"
                  step="any"
                  className="att-input att-input-plain"
                  value={venueLat}
                  onChange={(e) => handleLatChange(e.target.value)}
                  placeholder="23.51104"
                  required
                />
              </div>

              <div className="att-field-group">
                <label className="att-field-label">Longitude</label>
                <input
                  type="number"
                  step="any"
                  className="att-input att-input-plain"
                  value={venueLng}
                  onChange={(e) => handleLngChange(e.target.value)}
                  placeholder="74.0166317"
                  required
                />
              </div>
            </div>

            {/* Geofence Radius Input & Presets */}
            <div className="att-field-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="att-field-label">
                  <ShieldCheck size={14} /> Geofence Radius (Meters)
                </label>
                <div className="att-radius-presets">
                  {[15, 25, 50, 100].map((rVal) => (
                    <button
                      key={rVal}
                      type="button"
                      className={`att-radius-chip ${Number(radius) === rVal ? "active" : ""}`}
                      onClick={() => handleRadiusChange(rVal)}
                    >
                      {rVal}m {rVal === 15 ? "(Strict)" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <div className="att-input-wrap">
                <ShieldCheck size={16} />
                <input
                  type="number"
                  min="5"
                  max="1000"
                  className="att-input"
                  value={radius}
                  onChange={(e) => handleRadiusChange(e.target.value)}
                  required
                />
              </div>
              <span className="att-field-helper">
                Strict accuracy radius: Default is 15 meters. Teacher must be within {radius || 15}m to see & mark attendance.
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Save Row */}
      <div className="att-footer-actions">
        {saveSuccessMsg && (
          <div className="att-save-status-msg">
            <CheckCircle2 size={16} />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
        {saveErrorMsg && (
          <div className="att-save-error-msg">
            <AlertTriangle size={16} />
            <span>{saveErrorMsg}</span>
          </div>
        )}

        <button
          type="button"
          className="att-btn-save"
          onClick={handleSave}
          disabled={isSaving || isLoading}
        >
          {isSaving ? (
            <>
              <RotateCw size={16} className="att-spin" />
              <span>Saving Configurations...</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>Save {selectedSection === "kibar" ? "Kibar" : "Atfal"} Settings</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
