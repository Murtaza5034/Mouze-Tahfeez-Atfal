import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Search,
  X,
  Zap,
  Check,
  Globe,
  Footprints,
} from "lucide-react";
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  normalizeAttendanceSettings,
  fetchAttendanceSettings,
  saveAttendanceSettings,
  checkAttendanceWindow,
  getExactUserLocation,
} from "../utils/attendanceSettingsHelper";
import { loadGoogleMapsApi } from "../utils/googleMapsLoader";
import {
  AdminTeacherRankingModal,
  AdminTeacherRankingTriggerButton,
} from "./AdminTeacherRankingCard";
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

// Original Google Map Types
const GOOGLE_MAP_TYPES = {
  roadmap: {
    name: "Google Streets",
    icon: "🗺️",
    id: "roadmap",
  },
  satellite: {
    name: "Google Satellite",
    icon: "🛰️",
    id: "satellite",
  },
  hybrid: {
    name: "Google Hybrid",
    icon: "🌐",
    id: "hybrid",
  },
  terrain: {
    name: "Google Terrain",
    icon: "⛰️",
    id: "terrain",
  },
};

// Radius presets with human step equivalents (1 step ≈ 0.8 - 1.0 meter)
const RADIUS_STEP_PRESETS = [
  { meters: 1, label: "1 Step", sub: "~1m", title: "Ultra-strict (1 step away)" },
  { meters: 3, label: "3 Steps", sub: "~3m", title: "Very strict (~3 steps)" },
  { meters: 5, label: "5 Meters", sub: "~6 steps", title: "Masjid Gate (~5m)" },
  { meters: 10, label: "10 Meters", sub: "~12 steps", title: "Entrance Hall (~10m)" },
  { meters: 15, label: "15 Meters", sub: "~18 steps", title: "Courtyard Default (~15m)" },
  { meters: 25, label: "25 Meters", sub: "~30 steps", title: "Campus Boundary (~25m)" },
  { meters: 50, label: "50 Meters", sub: "~60 steps", title: "Outer Perimeter (~50m)" },
];

export default function AdminTeacherAttendanceSettings({
  isKibarAdmin = false,
  teacherProfiles = [],
  portalAccessList = [],
  teacherAttendance = [],
  onShowAction,
  onRefresh,
}) {
  const [showRankingModal, setShowRankingModal] = useState(false);

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
  const [autoMarkEnabled, setAutoMarkEnabled] = useState(
    DEFAULT_ATTENDANCE_SETTINGS.auto_mark_enabled ?? true
  );

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [saveErrorMsg, setSaveErrorMsg] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);

  // Map state
  const [activeMapLayerKey, setActiveMapLayerKey] = useState("roadmap");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Map refs
  const mapContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const googleMapRef = useRef(null);
  const googleMarkerRef = useRef(null);
  const googleCircleRef = useRef(null);
  const googleInfoWindowRef = useRef(null);
  const googleAutocompleteRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const searchContainerRef = useRef(null);

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
      setAutoMarkEnabled(
        data.auto_mark_enabled !== undefined ? Boolean(data.auto_mark_enabled) : true
      );
    } catch (err) {
      console.warn("Error loading attendance settings:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings(selectedSection);
  }, [selectedSection, loadSettings]);

  // -------------------------------------------------------------------------
  // Initialize Original Google Maps API
  // -------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function initGoogleMap() {
      if (!mapContainerRef.current) return;

      const lat = Number(venueLat) || DEFAULT_ATTENDANCE_SETTINGS.venue_lat;
      const lng = Number(venueLng) || DEFAULT_ATTENDANCE_SETTINGS.venue_lng;
      const rad = Number(radius) || DEFAULT_ATTENDANCE_SETTINGS.radius;

      try {
        const googleMaps = await loadGoogleMapsApi();
        if (!isMounted || !mapContainerRef.current) return;

        if (!googleMapRef.current) {
          // Create Original Google Maps Instance
          const map = new googleMaps.Map(mapContainerRef.current, {
            center: { lat, lng },
            zoom: 19,
            mapTypeId: activeMapLayerKey || "roadmap",
            mapTypeControl: false,
            streetViewControl: true,
            fullscreenControl: true,
            zoomControl: true,
            gestureHandling: "greedy",
            styles: [
              {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "on" }],
              },
            ],
          });

          // Custom Gold Mosque Pin Icon SVG
          const mosquePinSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54">
              <defs>
                <filter id="shadow" x="-30%" y="-20%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000000" flood-opacity="0.4"/>
                </filter>
                <linearGradient id="goldPin" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#fae392"/>
                  <stop offset="45%" stop-color="#d4af37"/>
                  <stop offset="100%" stop-color="#997a15"/>
                </linearGradient>
              </defs>
              <path d="M23 2 C11.5 2 2 11.5 2 23 C2 35 23 52 23 52 C23 52 44 35 44 23 C44 11.5 34.5 2 23 2 Z" fill="url(#goldPin)" stroke="#ffffff" stroke-width="2.5" filter="url(#shadow)"/>
              <circle cx="23" cy="22" r="14.5" fill="#ffffff"/>
              <text x="23" y="27" font-size="16" text-anchor="middle" dominant-baseline="middle">🕌</text>
            </svg>
          `)}`;

          const marker = new googleMaps.Marker({
            position: { lat, lng },
            map,
            draggable: true,
            title: venueName || "Venue Location",
            animation: googleMaps.Animation.DROP,
            icon: {
              url: mosquePinSvg,
              scaledSize: new googleMaps.Size(42, 50),
              anchor: new googleMaps.Point(21, 50),
            },
          });

          const circle = new googleMaps.Circle({
            map,
            center: { lat, lng },
            radius: rad,
            fillColor: "#d4af37",
            fillOpacity: 0.22,
            strokeColor: "#b8941f",
            strokeOpacity: 0.85,
            strokeWeight: 2.5,
            clickable: false,
          });

          const infoWindow = new googleMaps.InfoWindow({
            content: `<div style="font-family:inherit;padding:4px 6px;color:#2c2518;">
              <strong style="font-size:13px;color:#856404;">🕌 ${venueName || "Attendance Venue"}</strong><br/>
              <span style="font-size:11px;color:#666;">Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</span><br/>
              <span style="font-size:11px;color:#2e7d32;font-weight:bold;">Radius: ${rad}m</span>
            </div>`,
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });

          // Marker dragging
          marker.addListener("drag", (e) => {
            const curLat = e.latLng.lat();
            const curLng = e.latLng.lng();
            circle.setCenter({ lat: curLat, lng: curLng });
          });

          marker.addListener("dragend", (e) => {
            const curLat = e.latLng.lat();
            const curLng = e.latLng.lng();
            const rLat = Math.round(curLat * 1e7) / 1e7;
            const rLng = Math.round(curLng * 1e7) / 1e7;
            setVenueLat(rLat);
            setVenueLng(rLng);
            circle.setCenter({ lat: curLat, lng: curLng });
            infoWindow.setContent(
              `<div style="font-family:inherit;padding:4px 6px;color:#2c2518;">
                <strong style="font-size:13px;color:#856404;">🕌 ${venueName || "Attendance Venue"}</strong><br/>
                <span style="font-size:11px;color:#666;">Lat: ${rLat.toFixed(6)}, Lng: ${rLng.toFixed(6)}</span><br/>
                <span style="font-size:11px;color:#2e7d32;font-weight:bold;">Radius: ${radius}m</span>
              </div>`
            );
          });

          // Map click
          map.addListener("click", (e) => {
            const clickLat = e.latLng.lat();
            const clickLng = e.latLng.lng();
            const rLat = Math.round(clickLat * 1e7) / 1e7;
            const rLng = Math.round(clickLng * 1e7) / 1e7;
            setVenueLat(rLat);
            setVenueLng(rLng);
            marker.setPosition({ lat: clickLat, lng: clickLng });
            circle.setCenter({ lat: clickLat, lng: clickLng });
            infoWindow.setContent(
              `<div style="font-family:inherit;padding:4px 6px;color:#2c2518;">
                <strong style="font-size:13px;color:#856404;">🕌 ${venueName || "Attendance Venue"}</strong><br/>
                <span style="font-size:11px;color:#666;">Lat: ${rLat.toFixed(6)}, Lng: ${rLng.toFixed(6)}</span><br/>
                <span style="font-size:11px;color:#2e7d32;font-weight:bold;">Radius: ${radius}m</span>
              </div>`
            );
          });

          googleMapRef.current = map;
          googleMarkerRef.current = marker;
          googleCircleRef.current = circle;
          googleInfoWindowRef.current = infoWindow;

          // Setup Google Places Autocomplete if available
          if (searchInputRef.current && googleMaps.places) {
            try {
              const autocomplete = new googleMaps.places.Autocomplete(searchInputRef.current, {
                fields: ["geometry", "name", "formatted_address"],
              });
              autocomplete.bindTo("bounds", map);

              autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                if (place.geometry && place.geometry.location) {
                  const pLat = place.geometry.location.lat();
                  const pLng = place.geometry.location.lng();
                  const rLat = Math.round(pLat * 1e7) / 1e7;
                  const rLng = Math.round(pLng * 1e7) / 1e7;

                  setVenueLat(rLat);
                  setVenueLng(rLng);
                  if (place.name) {
                    setVenueName(place.name);
                  }
                  setSearchQuery(place.formatted_address || place.name || "");

                  map.setCenter({ lat: pLat, lng: pLng });
                  map.setZoom(19);
                  marker.setPosition({ lat: pLat, lng: pLng });
                  circle.setCenter({ lat: pLat, lng: pLng });

                  if (onShowAction) {
                    onShowAction(
                      "success",
                      `Google Map centered to: ${place.name || place.formatted_address}`
                    );
                  }
                }
              });
              googleAutocompleteRef.current = autocomplete;
            } catch (autoErr) {
              console.warn("Places autocomplete setup warning:", autoErr);
            }
          }
        } else {
          // Update existing Google Map
          const map = googleMapRef.current;
          const marker = googleMarkerRef.current;
          const circle = googleCircleRef.current;

          if (map && marker && circle) {
            const newPos = { lat, lng };
            marker.setPosition(newPos);
            circle.setCenter(newPos);
            circle.setRadius(rad);
          }
        }
      } catch (err) {
        console.warn("Google Maps API initialization notice:", err);
      } finally {
        if (isMounted) setIsMapLoading(false);
      }
    }

    initGoogleMap();

    return () => {
      isMounted = false;
    };
  }, [venueLat, venueLng, radius, venueName, activeMapLayerKey, onShowAction]);

  // Switch Map Layer (Google Streets, Satellite, Hybrid, Terrain)
  const handleSwitchMapLayer = (layerKey) => {
    setActiveMapLayerKey(layerKey);
    if (googleMapRef.current) {
      googleMapRef.current.setMapTypeId(layerKey);
    }
  };

  // Update map when lat/lng/radius change via inputs
  const handleLatChange = (val) => {
    const num = parseFloat(val);
    setVenueLat(val);
    if (!isNaN(num) && googleMapRef.current && googleMarkerRef.current && googleCircleRef.current) {
      const currentLng = Number(venueLng) || DEFAULT_ATTENDANCE_SETTINGS.venue_lng;
      const pos = { lat: num, lng: currentLng };
      googleMarkerRef.current.setPosition(pos);
      googleCircleRef.current.setCenter(pos);
      googleMapRef.current.panTo(pos);
    }
  };

  const handleLngChange = (val) => {
    const num = parseFloat(val);
    setVenueLng(val);
    if (!isNaN(num) && googleMapRef.current && googleMarkerRef.current && googleCircleRef.current) {
      const currentLat = Number(venueLat) || DEFAULT_ATTENDANCE_SETTINGS.venue_lat;
      const pos = { lat: currentLat, lng: num };
      googleMarkerRef.current.setPosition(pos);
      googleCircleRef.current.setCenter(pos);
      googleMapRef.current.panTo(pos);
    }
  };

  const handleRadiusChange = (val) => {
    const num = parseInt(val, 10);
    setRadius(val);
    if (!isNaN(num) && googleCircleRef.current) {
      googleCircleRef.current.setRadius(num);
    }
  };

  // -------------------------------------------------------------------------
  // Location Search via Google Geocoder / Places
  // -------------------------------------------------------------------------
  const executeSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      if (typeof window !== "undefined" && window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: query.trim() }, (results, status) => {
          setIsSearching(false);
          if (status === "OK" && results && results.length > 0) {
            const mapped = results.slice(0, 6).map((r) => ({
              place_id: r.place_id,
              name: r.formatted_address.split(",")[0],
              display_name: r.formatted_address,
              lat: r.geometry.location.lat(),
              lon: r.geometry.location.lng(),
            }));
            setSearchResults(mapped);
            setShowSearchResults(true);
          } else {
            setSearchResults([]);
            setShowSearchResults(false);
          }
        });
      } else {
        // Fallback geocoding if Google API is still bootstrapping
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query.trim()
          )}&limit=6&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data || []);
          setShowSearchResults(true);
        }
        setIsSearching(false);
      }
    } catch (err) {
      console.warn("Location search error:", err);
      setIsSearching(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val || val.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(val);
    }, 400);
  };

  const handleSelectSearchResult = (item) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    if (isNaN(lat) || isNaN(lon)) return;

    const roundLat = Math.round(lat * 1e7) / 1e7;
    const roundLng = Math.round(lon * 1e7) / 1e7;

    setVenueLat(roundLat);
    setVenueLng(roundLng);

    const placeTitle = item.name || item.display_name.split(",")[0];
    if (placeTitle && placeTitle.trim()) {
      setVenueName(placeTitle.trim());
    }

    if (googleMapRef.current && googleMarkerRef.current && googleCircleRef.current) {
      const pos = { lat: roundLat, lng: roundLng };
      googleMarkerRef.current.setPosition(pos);
      googleCircleRef.current.setCenter(pos);
      googleMapRef.current.setCenter(pos);
      googleMapRef.current.setZoom(19);
    }

    setShowSearchResults(false);
    setSearchQuery(item.display_name);

    if (onShowAction) {
      onShowAction("success", `Google Map centered to ${placeTitle}`);
    }
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target)
      ) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    setSearchQuery("");

    if (googleMapRef.current && googleMarkerRef.current && googleCircleRef.current) {
      const pos = { lat: defLat, lng: defLng };
      googleMarkerRef.current.setPosition(pos);
      googleCircleRef.current.setCenter(pos);
      googleCircleRef.current.setRadius(defRad);
      googleMapRef.current.setCenter(pos);
      googleMapRef.current.setZoom(19);
    }

    if (onShowAction) {
      onShowAction("success", "Reset venue to Burhani Masjid, Galiakot coordinates on Google Maps!");
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

      if (googleMapRef.current && googleMarkerRef.current && googleCircleRef.current) {
        const pos = { lat: roundLat, lng: roundLng };
        googleMarkerRef.current.setPosition(pos);
        googleCircleRef.current.setCenter(pos);
        googleMapRef.current.setCenter(pos);
        googleMapRef.current.setZoom(19);
      }

      if (onShowAction) {
        onShowAction(
          "success",
          `Google Map updated to your GPS location: ${roundLat}, ${roundLng} (±${Math.round(
            loc.accuracy || 0
          )}m)`
        );
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
      auto_mark_enabled: Boolean(autoMarkEnabled),
      // PascalCase fields for backwards compatibility
      StartTime: startTime,
      EndTime: endTime,
      ActiveDays: activeDays,
      VenueLat: numLat,
      VenueLng: numLng,
      Radius: numRadius,
      VenueName: venueName || DEFAULT_ATTENDANCE_SETTINGS.venue_name,
      AutoMarkEnabled: Boolean(autoMarkEnabled),
    };

    try {
      await saveAttendanceSettings(payload, selectedSection === "kibar");
      setSaveSuccessMsg(
        `Saved attendance settings for ${
          selectedSection === "kibar" ? "Kibar" : "Atfal"
        } successfully!`
      );
      if (onShowAction) {
        onShowAction(
          "success",
          `Teacher Attendance Settings updated for ${
            selectedSection === "kibar" ? "Tahfeez al Kibar" : "Rawdat al Atfal"
          }!`
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

  // Steps calculation for current radius
  const stepCount = useMemo(() => {
    const r = parseInt(radius, 10);
    if (isNaN(r) || r <= 0) return 18;
    return Math.max(1, Math.round(r / 0.8));
  }, [radius]);

  return (
    <div className="att-settings-container card-appear">
      {/* Page Header */}
      <div className="att-settings-header">
        <div className="att-settings-title-row">
          <div className="att-settings-title-group">
            <div className="att-settings-icon-badge">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h2 className="att-settings-title">Teacher Attendance Settings</h2>
              <p className="att-settings-subtitle">
                Configure timing rules, original Google Maps venue coordinates, proximity steps & smart auto-marking
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <AdminTeacherRankingTriggerButton
              onClick={() => setShowRankingModal(true)}
              label="Weekly Faculty Ranking & Punctuality"
            />

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
      </div>

      {/* Main Grid: Left = Time, Active Days & Auto-Mark, Right = Original Google Map & Location */}
      <div className="att-settings-grid">
        {/* =========================================================
            CARD 1: TIME CONFIGURATION, ACTIVE DAYS & AUTO-MARK
           ========================================================= */}
        <div className="att-left-column">
          <section className="att-card">
            <div className="att-card-header">
              <div className="att-card-header-left">
                <div className="att-card-header-icon">
                  <Clock size={18} />
                </div>
                <h3 className="att-card-title">Timing & Active Schedule</h3>
              </div>
              <span className="att-badge-gold">
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
                <div className="att-label-with-presets">
                  <label className="att-field-label">
                    <Calendar size={14} /> Active Days of Week
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

                <div className="att-settings-days-grid">
                  {ALL_DAYS.map((day) => {
                    const isSelected = activeDays.includes(day);
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
                    {windowPreview.isActiveDay ? "Active Day" : "Inactive Day"}).
                    Card unlocks strictly during this window.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================
              CARD 1B: SMART AUTO-MARK FEATURE
             ========================================================= */}
          <section className="att-card att-card-automark">
            <div className="att-automark-header">
              <div className="att-automark-info">
                <div className="att-automark-icon-wrap">
                  <Zap size={20} />
                </div>
                <div>
                  <h4 className="att-automark-title">⚡ Smart Auto-Mark Attendance</h4>
                  <p className="att-automark-subtitle">
                    Automatically marks teacher Present when their mobile device arrives inside the venue boundary during the window
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="att-toggle-switch" title="Toggle Auto-Mark">
                <input
                  type="checkbox"
                  checked={autoMarkEnabled}
                  onChange={(e) => setAutoMarkEnabled(e.target.checked)}
                />
                <span className="att-toggle-slider" />
              </label>
            </div>

            <div className="att-automark-status-banner">
              <span className={`att-pill ${autoMarkEnabled ? "pill-active" : "pill-inactive"}`}>
                {autoMarkEnabled ? "Auto-Mark Enabled" : "Manual Tap Only"}
              </span>
              <span className="att-automark-note">
                {autoMarkEnabled
                  ? "When within geofence, attendance will trigger automatically with sound & celebration."
                  : "Teacher must manually click the glowing 'Mark Self Attendance' button."}
              </span>
            </div>
          </section>
        </div>

        {/* =========================================================
            CARD 2: ORIGINAL GOOGLE MAP & GEOFENCE LOCATION
           ========================================================= */}
        <section className="att-card att-map-card">
          <div className="att-card-header">
            <div className="att-card-header-left">
              <div className="att-card-header-icon">
                <MapPin size={18} />
              </div>
              <h3 className="att-card-title">Original Google Map Location & Geofence</h3>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${venueLat},${venueLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="att-btn-secondary"
              style={{ padding: "4px 10px", fontSize: "0.74rem" }}
            >
              <ExternalLink size={12} /> Open in Google Maps
            </a>
          </div>

          <div className="att-card-body">
            {/* Live Search Location Input with Google Places Autocomplete */}
            <div className="att-field-group" ref={searchContainerRef}>
              <label className="att-field-label">
                <Search size={14} /> Search Venue / Mosque via Google Places
              </label>
              <div className="att-search-input-wrap">
                <Search size={16} className="att-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="att-search-input"
                  placeholder="Type any mosque, city, or address (e.g. Burhani Masjid Galiakot)..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchResults(true);
                  }}
                />
                {isSearching ? (
                  <RotateCw size={15} className="att-spin att-search-clear" />
                ) : searchQuery ? (
                  <button
                    type="button"
                    className="att-search-clear-btn"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      setShowSearchResults(false);
                    }}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              {/* Autocomplete Dropdown Fallback */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="att-search-results-dropdown">
                  {searchResults.map((item, idx) => (
                    <div
                      key={item.place_id || idx}
                      className="att-search-result-item"
                      onClick={() => handleSelectSearchResult(item)}
                    >
                      <MapPin size={16} className="att-result-icon" />
                      <div className="att-result-text">
                        <div className="att-result-name">
                          {item.name || item.display_name.split(",")[0]}
                        </div>
                        <div className="att-result-address">
                          {item.display_name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Google Map Style Switcher Pills */}
            <div className="att-map-layer-selector">
              <div className="att-layer-pills-label">
                <Layers size={13} />
                <span>Google Map Style:</span>
              </div>
              <div className="att-layer-pills-group">
                {Object.entries(GOOGLE_MAP_TYPES).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    className={`att-layer-pill ${activeMapLayerKey === key ? "active" : ""}`}
                    onClick={() => handleSwitchMapLayer(key)}
                  >
                    <span>{cfg.icon}</span>
                    <span>{cfg.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Original Google Map View */}
            <div className="att-map-wrapper">
              <div ref={mapContainerRef} className="att-map-container" />
              {isMapLoading && (
                <div className="att-map-loading-overlay">
                  <RotateCw size={24} className="att-spin" style={{ color: "#d4af37" }} />
                  <span>Loading Google Maps...</span>
                </div>
              )}
              <div className="att-map-overlay-badge">
                <span>📍 Drag marker or click anywhere on Google Map</span>
              </div>
            </div>

            {/* Quick Actions Under Map */}
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
                <span>Use My GPS Location</span>
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
            <div className="att-field-group" style={{ marginTop: "10px" }}>
              <label className="att-field-label">Venue / Mosque Name</label>
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

            {/* =========================================================
                PROXIMITY SCALE & 1-STEP AWAY RADIUS OPTIONS
               ========================================================= */}
            <div className="att-field-group att-radius-section">
              <div className="att-label-with-presets">
                <label className="att-field-label">
                  <Footprints size={15} /> Proximity & Geofence Boundary
                </label>
                <span className="att-step-info-badge">
                  1 Step ≈ 0.8–1.0 Meter
                </span>
              </div>

              {/* Radius Step Pills */}
              <div className="att-step-presets-grid">
                {RADIUS_STEP_PRESETS.map((preset) => {
                  const isCurrent = Number(radius) === preset.meters;
                  return (
                    <button
                      key={preset.meters}
                      type="button"
                      className={`att-step-chip ${isCurrent ? "active" : ""}`}
                      onClick={() => handleRadiusChange(preset.meters)}
                      title={preset.title}
                    >
                      <div className="att-step-chip-top">{preset.label}</div>
                      <div className="att-step-chip-sub">{preset.sub}</div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Radius Input with Real-time Step Conversion */}
              <div className="att-radius-custom-row">
                <div className="att-input-wrap">
                  <ShieldCheck size={16} />
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    className="att-input"
                    value={radius}
                    onChange={(e) => handleRadiusChange(e.target.value)}
                    placeholder="Enter meters"
                    required
                  />
                  <span className="att-input-unit">Meters</span>
                </div>

                <div className="att-step-counter-box">
                  <Footprints size={16} className="att-footprint-icon" />
                  <span>
                    ≈ <strong>{stepCount}</strong> walking steps
                  </span>
                </div>
              </div>

              <div className="att-radius-explanation">
                <span className="att-explanation-bullet">📍</span>
                <span>
                  <strong>Strict Proximity Rule:</strong> Teachers reaching within <strong>{radius}m</strong> (~{stepCount} steps) will see the active Mark Attendance button (or be auto-marked). When 1 step outside this boundary, the card informs them they are just 1 step away!
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Save Actions */}
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
              <RotateCw size={17} className="att-spin" />
              <span>Saving Configurations...</span>
            </>
          ) : (
            <>
              <Save size={17} />
              <span>Save {selectedSection === "kibar" ? "Kibar" : "Atfal"} Settings</span>
            </>
          )}
        </button>
      </div>

      {/* Weekly Faculty Ranking Modal */}
      <AdminTeacherRankingModal
        isOpen={showRankingModal}
        onClose={() => setShowRankingModal(false)}
        teacherProfiles={teacherProfiles}
        portalAccessList={portalAccessList}
        teacherAttendance={teacherAttendance}
      />
    </div>
  );
}
