// Fatemi Calendar & Miqaat API
// Hijri conversion uses Mumineen.org API (lightweight, single date-only endpoint).
// Miqaat data is fetched from Supabase miqaat_calendar table (no external miqaat API).

import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

const API_BASE = 'https://mumineen.org/api/v1';
const FETCH_TIMEOUT_MS = 8000;

// Arabic month names matching existing codebase style
const ARABIC_MONTHS = [
  "محرم الحرام", "صفر المظفر", "ربيع الأول", "ربيع الآخر",
  "جمادى الأولى", "جمادى الآخرة", "رجب الأصب", "شعبان الكريم",
  "رمضان المعظم", "شوال المكرم", "ذي القعدة الحرام", "ذي الحجة الحرام"
];

const ENGLISH_MONTHS = [
  "Muharram al-Haraam", "Safar al-Muzaffar", "Rabi al-Awwal", "Rabi al-Aakhar",
  "Jumada al-Ula", "Jumada al-Ukhra", "Rajab al-Asab", "Shabaan al-Kareem",
  "Ramadan al-Moazzam", "Shawwal al-Mukarram", "Zil Qaadah al-Haraam", "Zil Hajjah al-Haraam"
];

// ---- In-memory caches ----
const hijriCache = new Map();
const miqaatCache = new Map(); // key: "MM-DD", value: array of events

// Local fallback miqaats keyed by "MM-DD" (month-day).
// Used when Supabase query fails or returns no data.
const ANNUAL_MIQAAT_FALLBACK = {
  "01-01": ["Raas el Sanah al-Hijriah", "Moulaya Abdullah AQ (Khambat)"],
  "01-02": ["Syedi Shaikh Pir Jamaluddin (Jamnagar)", "Vaaz 1 (Ashara Mubaraka)"],
  "01-03": ["Vaaz 2 (Ashara Mubaraka)"],
  "01-04": ["Vaaz 3 (Ashara Mubaraka)"],
  "01-05": ["Vaaz 4 (Ashara Mubaraka)"],
  "01-06": ["Syedi Mohammed Bin Qazikhan", "Vaaz 5 (Ashara Mubaraka)"],
  "01-07": ["Syedna Ismail Badruddin RA [38th Dai] (Jamnagar)", "Vaaz 6 (Ashara Mubaraka)"],
  "01-08": ["Vaaz 7 (Ashara Mubaraka)"],
  "01-09": ["Vaaz 8 (Ashara Mubaraka)"],
  "01-10": ["Ashura", "Syedna Zoeb Bin Musa AQ [1st Dai] (Haus)", "Moulaya Ahmed AQ (Khambat)"],
  "01-14": ["Moulaya Luqmanji bin Mulla Ali bhai AQ (Wankaner)"],
  "01-15": ["Mawlai Nuruddin Saheb"],
  "01-16": ["Syedna Hatim bin Syedna Ibrahim RA [3rd Dai] (Hutaib)"],
  "01-17": ["Shahadat Imam Ali Zainulabedin SA", "Seven Shahid Sahebo", "Syedna Ibrahim Vajihuddin RA [39th Dai] (Ujjain)"],
  "01-18": ["Syedi Ghani Feer bin Dawoodji Shaheed AQ (Kalavad)"],
  "01-23": ["Syedi Hasanfeer al-Shaheed AQ (Denmaal)", "Noor Bibi Umme Syedna Yusuf Najmuddin", "Fatema Bibi Ukhte Syedna Yusuf Najmuddin"],
  "01-24": ["Syedi Dada Sulemanji (Bundi/Kota)"],
  "01-27": ["Syedi Fakhruddin al-Shaheed AQ (Taherabad)"],
  "01-28": ["Syedi Moosanji bin Taj Shaheed AQ (Baroda)"],
  "01-29": ["Mawlai Hasan Bin Mawlai Adam (Ahmedabad)"],
  "02-20": ["Arba'een / Chehlum"],
  "03-09": ["Eid-e-Zahra"],
  "03-17": ["Wilaadat Imam Jafar us Sadiq SA"],
  "04-08": ["Wafaat Imam Hasan al-Askari SA"],
  "05-10": ["Wilaadat Imam Hasan al-Mujtaba SA"],
  "06-20": ["Wilaadat Imam Zainulabedin SA"],
  "07-13": ["Wilaadat Maulana Ali SA"],
  "07-25": ["Wafaat Imam Musa al-Kadhim SA", "Wilaadat Imam Ali bin Abi Talib SA"],
  "08-03": ["Wilaadat Imam Husain SA"],
  "08-04": ["Wilaadat Abul Fazlil Abbas SA"],
  "08-15": ["Wilaadat Sahib al-Zaman al-Mehdi SA"],
  "09-19": ["Dharbat Moula Ali SA"],
  "09-21": ["Shahadat Moula Ali SA"],
  "10-01": ["Eid-ul-Fitr"],
  "10-25": ["Wafaat Imam Jafar us Sadiq SA"],
  "11-25": ["Yawme Dahwul Ardh"],
  "12-10": ["Eid-ul-Adha"],
  "12-18": ["Eid-ul-Ghadeer"],
  "12-24": ["Yawme Mubahila"],
};

function getLocalFallbackMiqaats(md) {
  const names = ANNUAL_MIQAAT_FALLBACK[md];
  if (!names) return [];
  const eventTypeHints = {
    'Ashura': 'Yawme Ashura',
    'Eid-ul-Fitr': 'Eid',
    'Eid-ul-Adha': 'Eid',
    'Eid-ul-Ghadeer': 'Eid',
    'Eid-e-Zahra': 'Eid',
    'Wilaadat': 'Wilaadat',
    'Wafaat': 'Wafaat',
    'Shahadat': 'Wafaat',
    'Dharbat': 'Event',
    'Yawme Dahwul Ardh': 'Event',
    'Yawme Mubahila': 'Event',
    'Raas el Sanah': 'Event',
    'Arba': 'Event',
    'Chehlum': 'Event',
  };
  return names.map(name => {
    let type = 'Event';
    for (const [hint, t] of Object.entries(eventTypeHints)) {
      if (name.includes(hint) || name.startsWith(hint)) {
        type = t;
        break;
      }
    }
    if (type === 'Event' && (name.includes('AQ') || name.includes('RA') || name.includes('SA') || name.toLowerCase().includes('urus'))) {
      type = 'Urus';
    }
    return { name, type: { name: type }, hijri_date: md };
  });
}

/** Fetch with timeout helper */
async function fetchWithTimeout(url, ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Hijri helpers using browser Intl (fallback only) ----

function getHijriParts(gregorianDate) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-tbla-nu-latn', {
      day: 'numeric', month: 'numeric', year: 'numeric'
    }).formatToParts(new Date(gregorianDate));
    const d = parseInt(parts.find(p => p.type === 'day').value);
    const m = parseInt(parts.find(p => p.type === 'month').value);
    const y = parseInt(parts.find(p => p.type === 'year').value);
    return { day: d, month: m, year: y };
  } catch { return null; }
}

// Fallback: use browser's built-in Islamic calendar (Intl.DateTimeFormat)
export function getFallbackFatemiDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-tbla-nu-latn', {
      day: 'numeric', month: 'numeric', year: 'numeric'
    }).formatToParts(date);
    let d = parseInt(parts.find(p => p.type === 'day').value);
    let m = parseInt(parts.find(p => p.type === 'month').value);
    let y = parseInt(parts.find(p => p.type === 'year').value);
    if (m === 12 && d === 30) {
      return `1 ${ARABIC_MONTHS[0]} ${y + 1}`;
    }
    if (m === 1) d++;
    return `${d} ${ARABIC_MONTHS[m - 1] || ''} ${y}`;
  } catch { return ''; }
}

// Format a Hijri date like "1448-01-22" into Arabic-style "22 محرم الحرام 1448"
export function formatHijriArabic(hijriDateStr) {
  if (!hijriDateStr) return null;
  const parts = hijriDateStr.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const d = parseInt(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const monthName = ARABIC_MONTHS[m - 1] || '';
  return `${d} ${monthName} ${y}`;
}

// Format a Hijri date into English style
export function formatHijriEnglish(hijriDateStr) {
  if (!hijriDateStr) return null;
  const parts = hijriDateStr.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const d = parseInt(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const monthName = ENGLISH_MONTHS[m - 1] || '';
  const suffix = d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th';
  return `${d}${suffix} ${monthName}, ${y}H`;
}

/**
 * Convert a Gregorian date string (YYYY-MM-DD) to the official Fatemi Hijri date.
 * Uses Mumineen.org API for accuracy; falls back to browser Intl if API fails.
 */
export async function convertToHijri(gregorianDate) {
  if (hijriCache.has(gregorianDate)) {
    return hijriCache.get(gregorianDate);
  }

  // Try Mumineen API first (lightweight, single date lookup)
  try {
    const response = await fetchWithTimeout(`${API_BASE}/convert/to-hijri/${gregorianDate}`);
    if (response.ok) {
      const json = await response.json();
      const result = json.data || json;
      if (result.date) {
        result.date_arabic = formatHijriArabic(result.date);
        result.date_english = result.date_formatted_long || formatHijriEnglish(result.date);
        const dateParts = result.date.split('-');
        if (dateParts.length === 3) {
          result._monthDay = `${dateParts[1]}-${dateParts[2]}`;
        }
      }
      hijriCache.set(gregorianDate, result);
      console.log(`✅ Hijri: ${gregorianDate} → ${result.date} (${result.date_arabic})`);
      return result;
    }
  } catch (_) {
    // Fall through to Intl fallback
  }

  // Fallback: use browser Intl
  const hp = getHijriParts(gregorianDate);
  if (!hp) {
    return { date: null, date_arabic: '', date_english: '', _fallback: true, _monthDay: '' };
  }
  const mm = String(hp.month).padStart(2, '0');
  const dd = String(hp.day).padStart(2, '0');
  const dateStr = `${hp.year}-${mm}-${dd}`;
  const dateArabic = formatHijriArabic(dateStr) || `${hp.day} ${ARABIC_MONTHS[hp.month - 1] || ''} ${hp.year}`;
  const dateEnglish = formatHijriEnglish(dateStr) || '';
  const fallback = {
    date: dateStr,
    date_arabic: dateArabic,
    date_english: dateEnglish,
    _fallback: true,
    _monthDay: `${mm}-${dd}`,
  };
  hijriCache.set(gregorianDate, fallback);
  return fallback;
}

/**
 * Fetch miqaats from Supabase for a specific hijri month-day ("MM-DD").
 * Falls back to local annual data if Supabase is unavailable.
 * Results cached in-memory.
 */
export async function fetchMiqaatsForDate(hijriMD) {
  if (!hijriMD) return [];
  if (miqaatCache.has(hijriMD)) {
    return miqaatCache.get(hijriMD);
  }

  let events = [];

  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from('miqaat_calendar')
      .select('name, type')
      .eq('hijri_date', hijriMD);
    if (error) throw error;
    events = (data || []).map(row => ({
      name: row.name,
      type: { name: row.type },
      hijri_date: hijriMD,
    }));
    console.log(`📅 Miqaats: ${hijriMD} → ${events.length} events from Supabase`);
  } catch (err) {
    console.warn(`📅 Miqaats Supabase query failed for ${hijriMD}:`, err.message);
  }

  // Fallback to local annual data if Supabase returned nothing
  if (events.length === 0) {
    const localEvents = getLocalFallbackMiqaats(hijriMD);
    if (localEvents.length > 0) {
      console.log(`📅 Miqaats: ${hijriMD} → ${localEvents.length} events from local fallback`);
      events = localEvents;
    }
  }

  miqaatCache.set(hijriMD, events);
  return events;
}

/**
 * Get the miqaat type label and a display-friendly summary string.
 */
export function summarizeMiqaats(miqaatEvents) {
  if (!miqaatEvents || miqaatEvents.length === 0) return null;

  const types = new Map();
  for (const evt of miqaatEvents) {
    const typeName = evt.type?.name || 'Event';
    if (!types.has(typeName)) types.set(typeName, []);
    types.get(typeName).push(evt.name);
  }

  const parts = [];
  for (const [type, names] of types) {
    parts.push(`${type}: ${names.join(', ')}`);
  }
  return {
    typeNames: Array.from(types.keys()),
    summary: parts.join(' | '),
    hasUrus: types.has('Urus'),
    hasMilad: types.has('Milad'),
    hasRozu: types.has('Rozu') || types.has('Ayyam ul Biz'),
    hasAshara: types.has('Ashara Mubaraka'),
    events: miqaatEvents,
  };
}

/**
 * Fetch Fatemi dates and miqaats for a list of Gregorian dates.
 * Returns an object keyed by gregorian date string.
 * Each value: { gregorian, hijri, miqaats: [...] }
 */
export async function fetchFatemiDataForDates(gregorianDates) {
  const results = {};

  // 1. Convert all dates to Hijri (Mumineen API with Intl fallback)
  const hijriResults = await Promise.all(
    gregorianDates.map(async (gDate) => {
      const hijri = await convertToHijri(gDate);
      return { gregorian: gDate, hijri };
    })
  );

  console.log(`📅 Fatemi: Hijri results:`, hijriResults.map(r => `${r.gregorian} → ${r.hijri?.date || 'FAIL'} (${r.hijri?._monthDay || 'no-md'})`));

  // 2. Collect unique MM-DD values and batch-fetch from Supabase
  const uniqueMDs = [...new Set(hijriResults.map(r => r.hijri?._monthDay).filter(Boolean))];
  console.log(`📅 Fatemi: Unique MDs to fetch:`, uniqueMDs, `(from ${hijriResults.length} dates)`);

  if (uniqueMDs.length > 0) {
    await Promise.all(uniqueMDs.map(md => fetchMiqaatsForDate(md)));
  }

  // 3. Build results
  for (const { gregorian, hijri } of hijriResults) {
    let miqaats = [];
    const md = hijri?._monthDay;
    if (md && miqaatCache.has(md)) {
      miqaats = miqaatCache.get(md);
    }
    results[gregorian] = { gregorian, hijri, miqaats };
  }

  const totalMiqaats = Object.values(results).reduce((s, d) => s + d.miqaats.length, 0);
  const miqaatDays = Object.entries(results).filter(([, v]) => v.miqaats.length > 0).map(([k, v]) => `${k}:${v.miqaats.length}`);
  console.log(`📅 Fatemi: Built ${Object.keys(results).length} dates, ${totalMiqaats} total miqaats. Days with miqaats:`, miqaatDays.length ? miqaatDays : 'NONE');
  return results;
}

/**
 * React hook to fetch all Fatemi calendar data for a week range.
 * Returns { loading, error, fatemiData }
 */
export function useFatemiCalendar(weekStart, weekEnd) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fatemiData, setFatemiData] = useState({});
  const lastKeyRef = useRef('');

  useEffect(() => {
    if (!weekStart || !weekEnd) {
      console.log('📅 Hook: skipped (no weekStart/weekEnd)');
      return;
    }

    const key = `${weekStart}_${weekEnd}`;
    if (key === lastKeyRef.current && Object.keys(fatemiData).length > 0) {
      console.log('📅 Hook: already loaded, skip');
      return;
    }
    lastKeyRef.current = key;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      // Generate all dates in the range
      const dates = [];
      const start = new Date(weekStart + 'T00:00:00Z');
      const end = new Date(weekEnd + 'T00:00:00Z');
      const current = new Date(start);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setUTCDate(current.getUTCDate() + 1);
      }

      console.log(`📅 Hook: fetching ${dates.length} dates from ${weekStart} to ${weekEnd}`);

      try {
        const data = await fetchFatemiDataForDates(dates);
        if (!cancelled) {
          console.log(`📅 Hook: data loaded for ${Object.keys(data).length} days`);
          setFatemiData(data);
        }
      } catch (err) {
        console.error('📅 Hook fetch failed:', err);
        if (!cancelled) {
          setError(err.message || 'Failed to fetch calendar data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, weekEnd]);

  return { loading, error, fatemiData };
}
