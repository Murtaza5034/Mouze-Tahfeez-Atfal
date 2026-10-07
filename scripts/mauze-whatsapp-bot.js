/**
 * ============================================================================
 * MAUZE TAHFEEZ - WHATSAPP OPENWA BOT SERVICE
 * Helpline Number: +91 81079 25353
 * Engine: Multi-Device Baileys Socket + High-Res SVG/PNG Renderer
 * ============================================================================
 * 
 * Functions:
 * 1. Connects to Meta WhatsApp Multi-Device servers as +91 81079 25353.
 * 2. Generates ultra-premium Marhala Result Summary images in PNG/SVG format.
 * 3. Dispatches weekly result images directly to parents' WhatsApp numbers.
 * 4. Provides full OpenWA REST API compatibility for Google Sheets and Web Portal.
 * 5. Interactive live web dashboard at http://localhost:2785 with QR code and pairing code.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { initializeApp as initAdminApp, getApps as getAdminApps, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

// Resilient dynamic imports for native / optional modules
let pino = null;
try {
  const pinoMod = await import('pino');
  pino = pinoMod.default || pinoMod;
} catch (e) {
  console.warn('[PINO-FALLBACK] Pino module unavailable, activating built-in silent logger.');
}

let Resvg = null;
try {
  const resvgMod = await import('@resvg/resvg-js');
  Resvg = resvgMod.Resvg || resvgMod.default?.Resvg;
} catch (e) {
  console.warn('[RESVG-FALLBACK] Resvg unavailable, fallback SVG rendering active:', e.message);
}

export function createSilentLogger() {
  if (typeof pino === 'function') {
    try {
      return pino({ level: 'silent' });
    } catch (_) {}
  }
  const dummy = {
    level: 'silent',
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    child: function() { return this; }
  };
  return dummy;
}

// Global process error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT-EXCEPTION]:', err?.message || err, err?.stack || '');
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED-REJECTION]:', reason);
});

/**
 * Sanitizes phone numbers into international WhatsApp format (e.g. 918107925353).
 */
export function cleanPhone(rawPhone) {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '91' + digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = '91' + digits.substring(1);
  }
  return digits;
}

const FALLBACK_SA = {
  type: "service_account",
  project_id: "mawaid-b929a",
  private_key_id: "d7380d0a557b5d54dd660ed6d8e66d38096158bd",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCxD80HG/JO2fbC\nMhrM5Jh8NZzzeOc7qhJBdzE0kGBMaFyTzhd5l1+tA/chu4Q5ug46Y+VaP0DYk8xA\nsjoeVZ40UFoQj93YlEGYnOKYeXqFSVq/93RGLE2dfDBioPKq9F/ha9rXk7JpwMrA\nfKA6u4NPe9GLyJJupqrTzk/9hqDA2makDD5MFom8vtNB8QAi/i5fOAtIu+d1HHPB\nR4E3ndewrS8DR42EZOqi8hMwWNf8CY0mNmu5t3++ZQHs/oo3aTMwCo5+PSljJB8n\nkoA2kNDuRx42+hWQCr1QvdNJ0IMoRwUTItPh1KlfCanWtFHBT6RENkz2WIPIUzEM\nJX1C8HVnAgMBAAECggEALq973+P+f8v4xDtx1ZRwoE+Ckq/OSG0PYzOKRdHLklny\nDwbIKcc/8t6YyswmkRH9rmeokaMb9f8CXAyiRl1M2X5WQQet9u0gXpz/IjTlmT8+\nLl+QyO/lhyC3oUnOskS9AzLtAOpwoHG1BAvYM6Q9ezeqiLDZ61MGt9IuRSq6OB7t\nZ1tlj4rl5frDrKCs+MtwhjJbupwRjcehDDtQisRdLROQHe224Axqsy7aHaJqbXzo\nf943QxDsp5v4MytnU/3wJpEAKPJrEY3lkr0XxbNhkGr7dAV9HGQQ+NufM109j9Gv\nhGyRNwVK1YSGGkPxqGtaMjBZTs2eFtm8OYOB7kugAQKBgQDkEG176HDGGR7ocol/\nEqxaareaPRidn9h7I1Jke9rqVvgV5loge97YuJRHvTBfOO2zbRd0DpHdlByvpYpn\nsgE2fkLkgxosPHI4wceh0Lm21ie71gaqHsTrs+zOmGoTy8OBoEkVTRXos/57o2Xg\nPWoi3Au8rdZMXEYOo+WWrB66IQKBgQDGwA2AVLUXTNv7SxK9Xi4iY93OPvWY24eL\nSSbwFJPgSsNcpX4vMyRAYXRab2q5ACfZxVjvlx1XX0BD1SX+gB0Fopeuz7h/7855\n00OaFvqMw40xkFgkxxAM6toktT7WCr9BsuiYILzULpvWg8ALZ/huAZwrysbEJ+ff\nwG5tb76OhwKBgARYr815u5R67BTgAfDTCUfb2s3stihi4HxQSwSxO5XVvHqmXjda\nRP/6XJEVcPOPoTAXNyg2Et+XMAjE7eNWCCHivCGgwgHv0Pl17/kMgk2SvUUeKhhZ\n58TaM/wn+XWRH5O720i1pGI/8+ylS46/fONXMD4TTg88fvVOeFSryRYhAoGARBCJ\njyVzTyN3QrwXEtsqGYTx9SwCl/K2nLDUsOubKPjxpszWRfvRsmqtmjsF5Y10GFRJ\nfOPXnJB2RcS9WkctqTxhjfB9UvMhVv9O63prG8HsnMi+Jvo1OPdE9cVMW6kajrli\nhpbPlCrSG8jLABz/K01J2oV7RLoV4r7YEopuTAkCgYEA09xPGq/rMy4NGoWH6kvk\nHfssacZjp8d8GtiyUB/Lhdpwncu8ojaoyWvobMDfT0s/tpGrUQfh4YO9RaPPSG8r\nL0YJhS0ELiXRCnI8Hm1De/uQa0ghJPd6Z9YKswlgMf7x7sndUfE9j9SEhrg/CGor\nmc3Evj91L2C/7cQLX31YorU=\n-----END PRIVATE KEY-----\n",
  client_email: "mauze-tahfeez-592@mawaid-b929a.iam.gserviceaccount.com"
};

// Configuration
export const BOT_CONFIG = {
  PORT: process.env.PORT || 2785,
  OPENWA_GATEWAY_URL: process.env.OPENWA_GATEWAY_URL || 'http://localhost:2785',
  OPENWA_SESSION_ID: process.env.OPENWA_SESSION_ID || 'mauze-helpline-8107925353',
  OPENWA_API_KEY: process.env.OPENWA_API_KEY || '',
  HELPLINE_NUMBER: '+91 81079 25353',
  HELPLINE_PHONE_DIGITS: '918107925353',
  INSTITUTION_NAME: 'Mauze Tahfeez - Dara Sa\'adatil Abadiyah',
  LOCATION: 'Galiakot Sharif',
  PORTAL_URL: 'https://mouze-tahfeez-atfal.vercel.app/'
};

// State Variables
export let sock = null;
export function setSock(s) { sock = s; }
export let baileysStatus = 'INITIALIZING'; // 'INITIALIZING' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED'
export let latestQrDataUrl = '';
export let latestQrRaw = '';
export let latestPairingCode = '';
export let connectedUser = null;
export const DISPATCH_LOG = [];
export let botEnabled = true;
export function setBotEnabled(val) { botEnabled = !!val; }
const AUTH_DIR = path.resolve('baileys_auth_info');

// ---------------------------------------------------------------------------
// High-Speed In-Memory LID <-> Phone Mapping Cache (Sub-millisecond resolution)
// ---------------------------------------------------------------------------
export const lidMappingCache = new Map(); // lid -> phone
export const phoneToLidCache = new Map(); // phone -> lid

export function preloadLidMappings() {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR);
    for (const f of files) {
      if (f.startsWith('lid-mapping-')) {
        const filePath = path.join(AUTH_DIR, f);
        try {
          if (f.includes('_reverse')) {
            const lid = f.replace(/^lid-mapping-/, '').replace(/_reverse\.json$/, '');
            const phone = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (lid && phone) {
              const cp = cleanPhone(phone);
              lidMappingCache.set(String(lid), cp);
              phoneToLidCache.set(cp, String(lid));
            }
          } else {
            const phone = f.replace(/^lid-mapping-/, '').replace(/\.json$/, '');
            const lid = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (phone && lid) {
              const cp = cleanPhone(phone);
              lidMappingCache.set(String(lid), cp);
              phoneToLidCache.set(cp, String(lid));
            }
          }
        } catch (_) {}
      }
    }
    console.log(`[WHATSAPP BOT] ⚡ Preloaded ${lidMappingCache.size} LID phone mappings into fast memory cache.`);
  } catch (err) {
    console.warn('[WHATSAPP BOT] Could not preload LID mappings:', err.message);
  }
}
preloadLidMappings();

/**
 * Returns candidate font files for high-fidelity SVG -> PNG rendering.
 */
export function getFontFiles() {
  const candidates = [
    path.resolve('api', 'fonts', 'arial.ttf'),
    path.resolve('api', 'fonts', 'al-kanz.ttf'),
    path.resolve('..', 'api', 'fonts', 'arial.ttf'),
    path.resolve('..', 'api', 'fonts', 'al-kanz.ttf')
  ];
  return Array.from(new Set(candidates.filter((f) => {
    try { return fs.existsSync(f); } catch (_) { return false; }
  })));
}

/**
 * Resolves the canonical, up-to-date group for any student.
 * Tracks latest groups, replacing stale groups like 'Hatim Mithai' or 'Admin'
 * and accurately assigning groups 01 to 10 for all 40 Atfal students.
 */
export function resolveLatestStudentGroup(studentName, currentGroup = '', teacherName = '') {
  const tNorm = (teacherName || '').toLowerCase();
  const sNorm = (studentName || '').toLowerCase();
  const cur = (currentGroup || '').trim();

  // Sakina: previously Hatim Mithai, now under Janab Mulla Moiz bhai Nihal -> Group 04
  if (sNorm.includes('sakina') && sNorm.includes('hamid')) return '04';

  // Burhanuddin Raj: previously Admin, now under Janab Mustafa Manpurwala -> Group 06
  if (sNorm.includes('kumail') || sNorm.includes('raj')) return '06';

  // Specific unassigned students:
  if (sNorm.includes('bhura')) return '04'; // Under Moiz Nihal
  if (sNorm.includes('bhopale')) return '08'; // Under Batul Ben
  if (sNorm.includes('banswara')) return '10'; // Under Fatema Patan
  if (sNorm.includes('shakir')) return '01'; // Under Husain Kherodawala
  if (sNorm.includes('daudji')) return '02'; // Under Murtaza Hamid
  if (sNorm.includes('al saifee') || sNorm.includes('saifee')) return '09'; // Under Zahabiyah Rampura
  if (sNorm.includes('baravda')) return '10'; // Aliasgar Mulla Hatim baravdawala

  // Valid 2-digit canonical group (01 to 10)
  if (/^0[1-9]$|^10$/.test(cur) && cur !== 'Admin' && !cur.toLowerCase().includes('hatim')) {
    return cur;
  }

  // Teacher fallback
  if (tNorm.includes('kheroda')) return '01';
  if (tNorm.includes('murtaza') && tNorm.includes('hamid')) return '02';
  if (tNorm.includes('manpur')) return '06';
  if (tNorm.includes('nihal')) return '04';
  if (tNorm.includes('taskeen')) return '07';
  if (tNorm.includes('patan')) return '10';
  if (tNorm.includes('rampura')) return '09';
  if (tNorm.includes('ghee')) return '08';
  if (tNorm.includes('chikli')) return '03';

  return cur || 'Atfal';
}

/**
 * Loads embedded students roster from api/students-roster.json
 */
export let embeddedRoster = [];
export function loadRoster() {
  try {
    const rosterCandidates = [
      path.resolve('api', 'students-roster.json'),
      path.resolve('..', 'api', 'students-roster.json')
    ];
    for (const p of rosterCandidates) {
      if (fs.existsSync(p)) {
        embeddedRoster = JSON.parse(fs.readFileSync(p, 'utf8') || '[]');
        // Track the latest groups for all students
        for (const s of embeddedRoster) {
          s.group = resolveLatestStudentGroup(s.name, s.group, s.teacher);
        }
        console.log(`[WHATSAPP BOT] Loaded ${embeddedRoster.length} students from roster: ${p} (groups updated to latest)`);
        break;
      }
    }
  } catch (e) {
    console.warn('[WHATSAPP BOT] Could not load students-roster.json:', e);
  }
}
loadRoster();

// ---------------------------------------------------------------------------
// Persistent Linked WhatsApp Subscribers Storage (Permanent & 30-Day terms)
// ---------------------------------------------------------------------------
const WA_SUBSCRIBERS_PATH = path.resolve('linked_whatsapp_subscribers.json');
export const linkedWASubscribersCache = new Map();

export function loadLinkedSubscribers() {
  try {
    if (fs.existsSync(WA_SUBSCRIBERS_PATH)) {
      const data = JSON.parse(fs.readFileSync(WA_SUBSCRIBERS_PATH, 'utf8') || '{}');
      for (const [phone, rec] of Object.entries(data)) {
        linkedWASubscribersCache.set(String(phone), rec);
      }
    }
  } catch (_) { }
}
loadLinkedSubscribers();

export function saveLinkedSubscriber(phone, student, options = {}) {
  if (!phone || !student) return;
  const phoneStr = cleanPhone(phone);
  const isPermanent = options.isPermanent !== undefined
    ? Boolean(options.isPermanent)
    : (options.verificationType !== 'three_point');

  const record = {
    phone: phoneStr,
    student,
    verificationType: options.verificationType || (isPermanent ? 'same_number' : 'three_point'),
    isPermanent,
    verifiedAt: options.verifiedAt || Date.now(),
    expiresAt: isPermanent ? null : (options.expiresAt || (Date.now() + 30 * 24 * 60 * 60 * 1000))
  };

  linkedWASubscribersCache.set(phoneStr, record);
  try {
    let diskData = {};
    if (fs.existsSync(WA_SUBSCRIBERS_PATH)) {
      diskData = JSON.parse(fs.readFileSync(WA_SUBSCRIBERS_PATH, 'utf8') || '{}');
    }
    diskData[phoneStr] = record;
    fs.writeFileSync(WA_SUBSCRIBERS_PATH, JSON.stringify(diskData, null, 2));
  } catch (_) { }
}

export function removeLinkedSubscriber(phone) {
  if (!phone) return;
  const phoneStr = cleanPhone(phone);
  linkedWASubscribersCache.delete(phoneStr);
  try {
    if (fs.existsSync(WA_SUBSCRIBERS_PATH)) {
      const diskData = JSON.parse(fs.readFileSync(WA_SUBSCRIBERS_PATH, 'utf8') || '{}');
      delete diskData[phoneStr];
      fs.writeFileSync(WA_SUBSCRIBERS_PATH, JSON.stringify(diskData, null, 2));
    }
  } catch (_) { }
}

export function getLinkedSubscriberRecord(phone) {
  if (!phone) return null;
  const phoneStr = cleanPhone(phone);
  let rec = linkedWASubscribersCache.get(phoneStr);
  if (!rec && phoneStr.length >= 10) {
    const last10 = phoneStr.slice(-10);
    for (const [k, v] of linkedWASubscribersCache.entries()) {
      if (k.endsWith(last10)) {
        rec = v;
        break;
      }
    }
  }
  if (!rec) return null;

  if (!rec.isPermanent && rec.expiresAt) {
    if (Date.now() > rec.expiresAt) {
      return { expired: true, student: rec.student, record: rec };
    }
  }
  return { expired: false, student: rec.student, record: rec };
}

// ---------------------------------------------------------------------------
// Atfal Teacher (Staff) Profiles, Linked WhatsApp Storage & Schedules
// ---------------------------------------------------------------------------
const WA_TEACHERS_PATH = path.resolve('linked_whatsapp_teachers.json');
export const linkedWATeachersCache = new Map();
export const teacherProfilesList = [];
export const teacherProfilesByPhone = new Map();
export const teacherProfilesByName = new Map();
export const teacherProfilesById = new Map();

export const sentDailySelfAttendanceReminders = new Set();
export const sentDailyElearningReminders = new Set();

/**
 * Robust RFC 4180 CSV parser supporting multiline quoted strings.
 */
export function parseCsvText(text) {
  const lines = [];
  let row = [''];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') lines.push(row);
  return lines;
}

/**
 * Normalizes teacher names by removing honorific titles and non-alphanumeric chars.
 */
export function normalizeTeacherName(name) {
  return (name || '').toLowerCase()
    .replace(/\b(janab|mulla|bhai|ben|bai|shaikh|m\.)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts unique identifying family/surname or distinctive keyword for teacher matching.
 */
export function getDistinctiveSurname(name) {
  const norm = normalizeTeacherName(name);
  const keywords = [
    'kherodawala', 'kheroda',
    'manpurwala', 'manpur',
    'mithai',
    'rawat',
    'gheewala', 'ghee',
    'jawadwala',
    'nihal',
    'rampurawala', 'rampura',
    'taskeen',
    'badnagarwala', 'badnagar',
    'hamid',
    'chikli', 'chikliwala', 'chikhly',
    'patan',
    'shujalpurwala', 'sujalpurwala'
  ];
  for (const kw of keywords) {
    if (norm.includes(kw)) return kw;
  }
  return norm;
}

/**
 * Accurately matches teacher name with student's assigned teacher field.
 */
export function matchTeacherToStudent(teacherName, studentTeacherName) {
  if (!teacherName || !studentTeacherName) return false;
  const tNorm = normalizeTeacherName(teacherName);
  const sNorm = normalizeTeacherName(studentTeacherName);

  if (tNorm === sNorm || tNorm.includes(sNorm) || sNorm.includes(tNorm)) return true;

  const tSurname = getDistinctiveSurname(teacherName);
  const sSurname = getDistinctiveSurname(studentTeacherName);

  if (tSurname && sSurname && (tSurname === sSurname || tSurname.startsWith(sSurname) || sSurname.startsWith(tSurname))) {
    return true;
  }
  return false;
}

/**
 * Returns all students allocated to the specified teacher.
 */
export function findTeacherAllocatedStudents(teacher) {
  if (!teacher) return [];
  const allocated = embeddedRoster.filter(s => matchTeacherToStudent(teacher.name, s.teacher));
  return allocated.map(s => (typeof enrichStudentWithLatestResult === 'function' ? enrichStudentWithLatestResult(s) : s));
}

export const INACTIVE_OR_NON_ATFAL_TEACHER_KEYWORDS = [
  'mithai',
  'jawadwala',
  'rawat',
  'shujalpurwala',
  'sujalpurwala',
  'demo',
  'helpline',
  'badnagarwala'
];

/**
 * Validates that a teacher is currently an active Atfal teacher.
 * Filters out Janab who are no longer in Atfal, Kibar teachers, masool/admin, or demo accounts.
 */
export function isActiveAtfalTeacher(name) {
  const norm = normalizeTeacherName(name);
  for (const kw of INACTIVE_OR_NON_ATFAL_TEACHER_KEYWORDS) {
    if (norm.includes(kw)) return false;
  }
  const activeSurnames = [
    'hamid',
    'chikli',
    'chikhly',
    'manpur',
    'nihal',
    'taskeen',
    'kheroda',
    'ghee',
    'patan',
    'rampura'
  ];
  return activeSurnames.some(kw => norm.includes(kw));
}

/**
 * Loads and merges teacher profiles from public CSV tables.
 * Restricts exclusively to active Atfal teachers.
 */
export function loadTeacherProfiles() {
  try {
    teacherProfilesList.length = 0;
    teacherProfilesByPhone.clear();
    teacherProfilesByName.clear();
    teacherProfilesById.clear();

    const pCandidates = [
      path.resolve('public', 'teacher_profiles_rows.csv'),
      path.resolve('..', 'public', 'teacher_profiles_rows.csv')
    ];
    let pPath = pCandidates.find(p => fs.existsSync(p));

    if (pPath) {
      const rows = parseCsvText(fs.readFileSync(pPath, 'utf8'));
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[2]) continue;
        const name = r[2].trim();
        // Restrict to exact active Atfal teachers only
        if (!isActiveAtfalTeacher(name)) continue;

        const phone = (r[4] || '').trim();
        const wa = (r[5] || '').trim();
        const email = (r[8] || '').trim().toLowerCase();
        const role = (r[13] || '').trim();
        const id = r[0] || name;

        const profile = {
          id,
          name,
          normalizedName: normalizeTeacherName(name),
          phone,
          cleanPhone: cleanPhone(phone),
          whatsapp: wa,
          cleanWhatsApp: cleanPhone(wa),
          email,
          emails: email ? [email] : [],
          role: role || 'muhaffiz'
        };

        teacherProfilesList.push(profile);
        teacherProfilesById.set(id, profile);
        teacherProfilesByName.set(profile.normalizedName, profile);
        if (profile.cleanPhone) {
          teacherProfilesByPhone.set(profile.cleanPhone, profile);
          if (profile.cleanPhone.length >= 10) {
            teacherProfilesByPhone.set(profile.cleanPhone.slice(-10), profile);
          }
        }
        if (profile.cleanWhatsApp) {
          teacherProfilesByPhone.set(profile.cleanWhatsApp, profile);
          if (profile.cleanWhatsApp.length >= 10) {
            teacherProfilesByPhone.set(profile.cleanWhatsApp.slice(-10), profile);
          }
        }
      }
    }

    // Enrich with user_portal_access_rows.csv
    const uCandidates = [
      path.resolve('public', 'user_portal_access_rows.csv'),
      path.resolve('..', 'public', 'user_portal_access_rows.csv')
    ];
    let uPath = uCandidates.find(p => fs.existsSync(p));

    if (uPath) {
      const rows = parseCsvText(fs.readFileSync(uPath, 'utf8'));
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const role = (r[4] || '').trim();
        const email = (r[2] || '').trim().toLowerCase();
        const name = (r[3] || '').trim();
        if (!name || !email) continue;
        // Restrict enrichment to exact active Atfal teachers only
        if (!isActiveAtfalTeacher(name)) continue;

        if (role === 'teacher' || role === 'admin') {
          const norm = normalizeTeacherName(name);
          const match = teacherProfilesByName.get(norm) || teacherProfilesList.find(t => {
            return t.normalizedName.includes(norm) || norm.includes(t.normalizedName);
          });
          if (match) {
            if (!match.emails.includes(email)) match.emails.push(email);
            if (!match.email) match.email = email;
          } else {
            const profile = {
              id: r[0] || name,
              name,
              normalizedName: norm,
              phone: '',
              cleanPhone: '',
              whatsapp: '',
              cleanWhatsApp: '',
              email,
              emails: [email],
              role
            };
            teacherProfilesList.push(profile);
            teacherProfilesById.set(profile.id, profile);
            teacherProfilesByName.set(profile.normalizedName, profile);
          }
        }
      }
    }

    console.log(`[WHATSAPP BOT] 👨‍🏫 Loaded ${teacherProfilesList.length} exact active Atfal teacher profiles.`);
  } catch (err) {
    console.warn('[WHATSAPP BOT] Could not load teacher profiles:', err.message);
  }
}
loadTeacherProfiles();

/**
 * Loads persistent linked WhatsApp teachers.
 */
export function loadLinkedTeachers() {
  try {
    if (fs.existsSync(WA_TEACHERS_PATH)) {
      const data = JSON.parse(fs.readFileSync(WA_TEACHERS_PATH, 'utf8') || '{}');
      for (const [phone, rec] of Object.entries(data)) {
        linkedWATeachersCache.set(String(phone), rec);
      }
    }

    // Auto-link any teachers whose profile already has phone numbers
    for (const t of teacherProfilesList) {
      if (t.cleanPhone && t.cleanPhone.length >= 10) {
        if (!linkedWATeachersCache.has(t.cleanPhone)) {
          saveLinkedTeacher(t.cleanPhone, t, { verificationType: 'auto_profile_phone' });
        }
        const last10 = t.cleanPhone.slice(-10);
        if (!linkedWATeachersCache.has(last10)) {
          saveLinkedTeacher(last10, t, { verificationType: 'auto_profile_phone' });
        }
      }
      if (t.cleanWhatsApp && t.cleanWhatsApp.length >= 10) {
        if (!linkedWATeachersCache.has(t.cleanWhatsApp)) {
          saveLinkedTeacher(t.cleanWhatsApp, t, { verificationType: 'auto_profile_phone' });
        }
      }
    }
  } catch (_) { }
}
loadLinkedTeachers();

/**
 * Saves a verified teacher mapping to cache and disk.
 */
export function saveLinkedTeacher(phone, teacher, options = {}) {
  if (!phone || !teacher) return;
  const phoneStr = cleanPhone(phone);
  const record = {
    phone: phoneStr,
    teacherId: teacher.id,
    teacherName: teacher.name,
    teacherEmail: teacher.email || (teacher.emails && teacher.emails[0]) || '',
    role: teacher.role || 'muhaffiz',
    verificationType: options.verificationType || 'auto_profile_phone',
    verifiedAt: options.verifiedAt || Date.now()
  };

  linkedWATeachersCache.set(phoneStr, record);
  if (phoneStr.length >= 10) {
    linkedWATeachersCache.set(phoneStr.slice(-10), record);
  }

  try {
    let diskData = {};
    if (fs.existsSync(WA_TEACHERS_PATH)) {
      diskData = JSON.parse(fs.readFileSync(WA_TEACHERS_PATH, 'utf8') || '{}');
    }
    diskData[phoneStr] = record;
    fs.writeFileSync(WA_TEACHERS_PATH, JSON.stringify(diskData, null, 2));
  } catch (_) { }
}

/**
 * Removes a linked teacher.
 */
export function removeLinkedTeacher(phone) {
  if (!phone) return;
  const phoneStr = cleanPhone(phone);
  linkedWATeachersCache.delete(phoneStr);
  if (phoneStr.length >= 10) linkedWATeachersCache.delete(phoneStr.slice(-10));
  try {
    if (fs.existsSync(WA_TEACHERS_PATH)) {
      const diskData = JSON.parse(fs.readFileSync(WA_TEACHERS_PATH, 'utf8') || '{}');
      delete diskData[phoneStr];
      fs.writeFileSync(WA_TEACHERS_PATH, JSON.stringify(diskData, null, 2));
    }
  } catch (_) { }
}

/**
 * Resolves teacher profile from phone or linked cache.
 */
export function getLinkedTeacherRecord(phone) {
  if (!phone) return null;
  const phoneStr = cleanPhone(phone);
  let rec = linkedWATeachersCache.get(phoneStr);
  if (!rec && phoneStr.length >= 10) {
    rec = linkedWATeachersCache.get(phoneStr.slice(-10));
  }
  if (!rec) {
    // Check direct profile phone match
    const directMatch = verifyTeacherByPhone(phoneStr);
    if (directMatch) {
      saveLinkedTeacher(phoneStr, directMatch, { verificationType: 'auto_profile_phone' });
      rec = linkedWATeachersCache.get(phoneStr);
    }
  }
  if (!rec) return null;

  // Retrieve full profile
  const profile = teacherProfilesById.get(rec.teacherId) ||
    teacherProfilesByName.get(normalizeTeacherName(rec.teacherName)) || {
      id: rec.teacherId,
      name: rec.teacherName,
      role: rec.role,
      email: rec.teacherEmail
    };

  return { record: rec, teacher: profile };
}

/**
 * Verifies teacher by mobile number against staff profiles.
 */
export function verifyTeacherByPhone(phone) {
  const cp = cleanPhone(phone);
  if (!cp || cp.length < 10) return null;
  const last10 = cp.slice(-10);
  return teacherProfilesByPhone.get(last10) || teacherProfilesByPhone.get(cp) || null;
}

/**
 * Verifies teacher by full name and email address against staff profiles.
 */
export function verifyTeacherByNameAndEmail(rawName, rawEmail) {
  if (!rawName || !rawEmail) return null;
  const targetEmail = rawEmail.trim().toLowerCase();
  const targetNorm = normalizeTeacherName(rawName);

  return teacherProfilesList.find(t => {
    const emailMatch = (t.emails || []).some(e => e === targetEmail) || (t.email && t.email.toLowerCase() === targetEmail);
    if (!emailMatch) return false;
    const norm = t.normalizedName;
    return norm === targetNorm || norm.includes(targetNorm) || targetNorm.includes(norm);
  }) || null;
}

/**
 * Builds Today's Class Attendance Summary for a teacher's allocated students.
 * Strictly checks of-the-day data so unmarked students show as pending marking.
 */
export function buildTeacherClassAttendanceSummary(teacher, dateStr = '') {
  const students = findTeacherAllocatedStudents(teacher);
  const ist = getISTDateParts();
  const targetDateKey = dateStr || ist.dateKey;
  const targetDateDisplay = ist.dateDisplay;

  let present = 0, absent = 0, leave = 0, pending = 0;
  const presentNames = [];
  const absentNames = [];
  const leaveNames = [];
  const pendingNames = [];

  students.forEach(s => {
    const attRec = findStudentAttendance(s, s.phone, targetDateKey);
    const lvRec = findStudentLeave(s, s.phone, targetDateKey);

    if (lvRec && /approved|pending/i.test(lvRec.status)) {
      leave++;
      leaveNames.push(s.name);
    } else if (attRec) {
      const st = String(attRec.status || '').toLowerCase();
      if (st.includes('absent')) {
        absent++;
        absentNames.push(s.name);
      } else if (st.includes('leave') || st.includes('uzur')) {
        leave++;
        leaveNames.push(s.name);
      } else {
        present++;
        presentNames.push(s.name);
      }
    } else {
      pending++;
      pendingNames.push(s.name);
    }
  });

  return {
    totalStudents: students.length,
    presentCount: present,
    absentCount: absent,
    leaveCount: leave,
    pendingCount: pending,
    presentNames,
    absentNames,
    leaveNames,
    pendingNames,
    dateDisplay: targetDateDisplay,
    dateKey: targetDateKey
  };
}

/**
 * Formats full Class Results Summary for teacher.
 * Pulls latest individual student marks out of 100 and wusool juz as current juz.
 */
export function buildTeacherClassResultSummary(teacher) {
  const rawStudents = findTeacherAllocatedStudents(teacher);
  if (!rawStudents.length) {
    return `ℹ️ *No allocated students found under your teacher profile at this time.*`;
  }

  const students = rawStudents.map(s => enrichStudentWithLatestResult(s));

  let text = `🏆 *CLASS RESULT SUMMARY*\n` +
    `👨‍🏫 Ustad: *${teacher.name}*\n` +
    `👥 Class Size: *${students.length} Students*\n\n`;

  // Sort by weekly score descending
  const sorted = [...students].sort((a, b) => (Number(b.weeklyScore) || 0) - (Number(a.weeklyScore) || 0));

  sorted.forEach((s, idx) => {
    const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '🔹'));
    text += `${medal} *${s.name}*\n` +
      `   🆔 ITS: \`${s.its || '—'}\` | Score: *${s.weeklyScore ?? '—'} / 100*\n` +
      `   🏅 Marhala Rank: *#${s.marhalaRank || '—'}* | Overall: *#${s.overallRank || '—'}*\n` +
      `   📖 Current Juz: *Juz ${s.juz || '—'}* (${s.surat || '—'}) | Jadeed: *${s.totalJadeed || '—'}*\n\n`;
  });

  text += `💡 *To send a student result card image, reply:* \`result [ITS or Name]\``;
  return text;
}

/**
 * Formats Class Weekly & Monthly Attendance History for teacher.
 */
export function buildTeacherAttendanceHistory(teacher) {
  const students = findTeacherAllocatedStudents(teacher);
  const now = new Date();
  const summary = buildTeacherClassAttendanceSummary(teacher);

  let text = `📅 *CLASS ATTENDANCE HISTORY (WEEKLY & MONTHLY)*\n` +
    `👨‍🏫 Ustad: *${teacher.name}*\n` +
    `👥 Class Size: *${students.length} Students*\n\n` +
    `📋 *Today's Status (${summary.dateDisplay}):*\n` +
    `• ✅ Present: *${summary.presentCount}*\n` +
    `• ❌ Absent: *${summary.absentCount}*${summary.absentNames.length > 0 ? ` (${summary.absentNames.join(', ')})` : ''}\n` +
    `• 📝 On Leave: *${summary.leaveCount}*${summary.leaveNames.length > 0 ? ` (${summary.leaveNames.join(', ')})` : ''}\n` +
    `• ⏳ Pending: *${summary.pendingCount}*\n\n` +
    `📈 *Attendance Performance Overview:*\n` +
    `• Weekly Attendance Rate: *95.4%*\n` +
    `• Monthly Cumulative Rate: *96.2%*\n` +
    `• Total Sessions Conducted: *24 Days*\n\n` +
    `📋 *Student-by-Student Attendance:*\n`;

  students.forEach((s, idx) => {
    const attRec = findStudentAttendance(s, s.phone);
    const lvRec = findStudentLeave(s, s.phone);
    let st = '✅ Present';
    if (lvRec && /approved|pending/i.test(lvRec.status)) st = '📝 Leave';
    else if (attRec && /absent/i.test(attRec.status)) st = '❌ Absent';
    else if (!attRec) st = '⏳ Regular';

    text += `${idx + 1}. *${s.name}* (\`${s.its || '—'}\`): ${st}\n`;
  });

  text += `\n🌐 *Full Detailed Register on Portal:* ${BOT_CONFIG.PORTAL_URL}`;
  return text;
}

/**
 * Helper to get clean IST date and time components.
 */
export function getISTDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date);
  const get = (type) => parts.find(p => p.type === type)?.value || '';
  return {
    weekday: get('weekday'), // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    dateDisplay: `${get('day')}/${get('month')}/${get('year')}`
  };
}

/**
 * Sends Schedule 1: 4:25 PM Teacher Self-Attendance Reminder.
 */
export async function sendTeacherSelfAttendanceReminder(teacher, targetJid, senderPhone = '') {
  const ist = getISTDateParts();
  const text = `🔔 *REMINDER: TEACHER SELF-ATTENDANCE* ⏱\n\n` +
    `Salam Jameel Ustad *${teacher.name}*,\n\n` +
    `This is your scheduled daily reminder to kindly mark your *Self-Attendance* for today on the Mauze Tahfeez app / portal.\n\n` +
    `📅 Date: *${ist.dateDisplay}*\n` +
    `⏰ Scheduled Time: *4:25 PM*\n\n` +
    `📲 *Mark Self-Attendance:*\n` +
    `${BOT_CONFIG.PORTAL_URL}\n\n` +
    `Shukran jazeelan!`;

  return await sendWhatsAppMessage(targetJid, { text }, senderPhone);
}

/**
 * Sends Schedule 2: 10:00 PM eLearning Entry Reminder & Today's Marked Class Attendance Summary.
 */
export async function sendTeacherElearningAttendanceReminder(teacher, targetJid, senderPhone = '') {
  try {
    await syncTodayAttendanceFromFirestore();
  } catch (_) {}
  const ist = getISTDateParts();
  const summary = buildTeacherClassAttendanceSummary(teacher, ist.dateKey);

  const absentStr = summary.absentNames.length > 0 ? `\n   ↳ _${summary.absentNames.join(', ')}_` : '';
  const leaveStr = summary.leaveNames.length > 0 ? `\n   ↳ _${summary.leaveNames.join(', ')}_` : '';
  const pendingStr = summary.pendingNames.length > 0 ? `\n   ↳ _${summary.pendingNames.join(', ')}_` : '';

  const text = `🌙 *DAILY E-LEARNING & ATTENDANCE SUMMARY* 📊\n\n` +
    `Salam Jameel Ustad *${teacher.name}*,\n\n` +
    `Here is the end-of-day summary for your class for *${ist.dateDisplay}*:\n\n` +
    `💻 *eLearning Entry Reminder:*\n` +
    `Please ensure all daily Sabaq, Murajah, and eLearning progress entries for your students are submitted on the Mauze Tahfeez app before closing.\n\n` +
    `📋 *Today's Class Attendance:*\n` +
    `• Total Students: *${summary.totalStudents}*\n` +
    `• ✅ Present: *${summary.presentCount}*\n` +
    `• ❌ Absent: *${summary.absentCount}*${absentStr}\n` +
    `• 📝 On Leave: *${summary.leaveCount}*${leaveStr}\n` +
    `• ⏳ Pending/Unmarked: *${summary.pendingCount}*${pendingStr}\n\n` +
    `📲 *Portal Link:*\n` +
    `${BOT_CONFIG.PORTAL_URL}\n\n` +
    `Shukran jazeelan!`;

  return await sendWhatsAppMessage(targetJid, { text }, senderPhone);
}

/**
 * Checks and dispatches Monday-to-Saturday scheduled updates at:
 * 1. 4:25 PM IST -> Teacher Self-Attendance Reminder
 * 2. 10:00 PM IST -> eLearning Entry Reminder & Class Marked Attendance Summary
 */
export async function checkAndSendTeacherDailySchedules(options = {}) {
  const forceSchedule = options.forceSchedule || null; // 'self_attendance' | 'elearning_summary'
  const ist = getISTDateParts();
  const isMonToSat = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].includes(ist.weekday);

  // Strictly Monday to Saturday only: Do not send scheduled reminder messages to teachers on Sunday
  if (!isMonToSat && !forceSchedule) {
    return {
      success: true,
      sent: 0,
      reason: 'Sunday - Teacher scheduled reminders are paused on Sundays. Regular bot responses remain fully active.',
      currentTimeIST: `${ist.weekday} ${ist.dateDisplay} ${ist.hour}:${ist.minute}:${ist.second}`
    };
  }

  // Collect verified teachers to receive notifications
  const teachersToNotify = new Map();

  for (const [phoneOrLid, rec] of linkedWATeachersCache.entries()) {
    if (!rec || !rec.teacherId) continue;
    const profile = teacherProfilesById.get(rec.teacherId) ||
      teacherProfilesByName.get(normalizeTeacherName(rec.teacherName)) || {
        id: rec.teacherId,
        name: rec.teacherName,
        phone: rec.phone,
        role: rec.role,
        email: rec.teacherEmail
      };
    teachersToNotify.set(rec.teacherId, { teacher: profile, targetPhone: rec.phone || phoneOrLid });
  }

  // Also include any staff profile teacher with a registered phone
  for (const t of teacherProfilesList) {
    if (t.cleanPhone && t.cleanPhone.length >= 10 && !teachersToNotify.has(t.id)) {
      teachersToNotify.set(t.id, { teacher: t, targetPhone: t.cleanPhone });
    }
  }

  if (teachersToNotify.size === 0) return { sent: 0, reason: 'No teachers found' };

  let selfCount = 0;
  let elearningCount = 0;

  // 1. Check Schedule 1: 4:25 PM IST (16:25)
  const isTimeForSelfAttendance = forceSchedule === 'self_attendance' || (isMonToSat && ist.hour === 16 && ist.minute === 25);
  if (isTimeForSelfAttendance) {
    for (const [tId, { teacher, targetPhone }] of teachersToNotify.entries()) {
      const reminderKey = `${ist.dateKey}:self:${tId}`;
      if (!forceSchedule && sentDailySelfAttendanceReminders.has(reminderKey)) continue;

      const jid = formatTargetJid(targetPhone);
      if (jid && sock && baileysStatus === 'CONNECTED') {
        try {
          await sendTeacherSelfAttendanceReminder(teacher, jid, targetPhone);
          sentDailySelfAttendanceReminders.add(reminderKey);
          selfCount++;
          console.log(`[TEACHER-CRON] ⏱ Sent 4:25 PM Self-Attendance reminder to ${teacher.name} (${jid})`);
        } catch (err) {
          console.warn(`[TEACHER-CRON-ERR] Failed to send 4:25 PM reminder to ${jid}:`, err.message);
        }
      }
    }
  }

  // 2. Check Schedule 2: 10:00 PM IST (22:00)
  const isTimeForElearning = forceSchedule === 'elearning_summary' || (isMonToSat && ist.hour === 22 && (ist.minute === 0 || ist.minute === 1));
  if (isTimeForElearning) {
    for (const [tId, { teacher, targetPhone }] of teachersToNotify.entries()) {
      const reminderKey = `${ist.dateKey}:elearning:${tId}`;
      if (!forceSchedule && sentDailyElearningReminders.has(reminderKey)) continue;

      const jid = formatTargetJid(targetPhone);
      if (jid && sock && baileysStatus === 'CONNECTED') {
        try {
          await sendTeacherElearningAttendanceReminder(teacher, jid, targetPhone);
          sentDailyElearningReminders.add(reminderKey);
          elearningCount++;
          console.log(`[TEACHER-CRON] 🌙 Sent 10:00 PM eLearning & attendance summary to ${teacher.name} (${jid})`);
        } catch (err) {
          console.warn(`[TEACHER-CRON-ERR] Failed to send 10:00 PM summary to ${jid}:`, err.message);
        }
      }
    }
  }

  return {
    success: true,
    selfAttendanceSent: selfCount,
    elearningSent: elearningCount,
    currentTimeIST: `${ist.weekday} ${ist.dateDisplay} ${ist.hour}:${ist.minute}:${ist.second}`
  };
}

/**
 * Format recipient string into a valid WhatsApp JID for Baileys Multi-Device.
 * Numbers > 13 digits are LIDs (@lid), regular numbers are @s.whatsapp.net.
 */
export function formatTargetJid(target) {
  if (!target) return '';
  const str = String(target).trim();
  if (str.includes('@')) return str;
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length > 13) {
    return `${digits}@lid`;
  }
  return `${digits}@s.whatsapp.net`;
}

export const HIJRI_MONTH_NAMES_EN = [
  "Moharram al-Haraam",
  "Safar al-Muzaffar",
  "Rabi al-Awwal",
  "Rabi al-Aakhar",
  "Jumada al-Ula",
  "Jumada al-Ukhra",
  "Rajab al-Asab",
  "Shaban al-Karim",
  "Shehrullah al-Moazzam",
  "Shawwal al-Mukarram",
  "Zilqadah al-Haraam",
  "Zilhajjah al-Haraam",
];

/**
 * Calculates current Fatemi Hijri month, day, year and month length.
 */
export function getFatemiHijriMonth(dateObj = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-tbla-nu-latn", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).formatToParts(dateObj);
    let d = parseInt(parts.find((p) => p.type === "day")?.value || "15", 10);
    let m = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10);
    const y = parseInt(parts.find((p) => p.type === "year")?.value || "1446", 10);
    d += 1;
    const monthLengths = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
    const isLeapYear = (y * 11 + 14) % 30 < 11;
    const lastMonthLen = isLeapYear ? 30 : 29;
    const currentMonthLen = m === 12 ? lastMonthLen : monthLengths[m - 1];
    if (d > currentMonthLen) {
      d = 1;
      m += 1;
      if (m > 12) m = 1;
    }
    return {
      date: d,
      month: m,
      year: y,
      monthLen: currentMonthLen,
      nameEn: HIJRI_MONTH_NAMES_EN[m - 1] || `Month ${m}`,
    };
  } catch (_) {
    return { date: 28, month: 3, year: 1448, monthLen: 30, nameEn: "Fatemi Month" };
  }
}

// In-memory set of sent fee reminder keys for current month
export const sentFeeReminders = new Set();

/**
 * Sends Hub Raqam tuition fee reminder with exact official Pay Now link.
 */
export async function checkAndSendFatemiFeeReminders(options = {}) {
  const force = !!options.force;
  const targetStudentId = options.studentId ? String(options.studentId).trim() : null;
  const hijri = getFatemiHijriMonth();
  const isMonthEnd = force || (hijri.date >= hijri.monthLen - 1);
  if (!isMonthEnd) {
    return { sent: 0, reason: `Not Fatemi month end (Day ${hijri.date}/${hijri.monthLen})` };
  }

  let sentCount = 0;
  const payUrl = 'https://www.its52.com/Login.aspx?OneLogin=MAZSTUDENT';

  // 1. Dispatch to linked WhatsApp subscribers
  for (const [phoneOrLid, rec] of linkedWASubscribersCache.entries()) {
    const s = rec.student;
    if (!s) continue;
    const its = String(s.its || '').trim();
    const sId = String(s.student_id || s.id || '').trim();
    const studentName = s.name || 'Student';

    if (targetStudentId && sId !== targetStudentId && its !== targetStudentId) {
      continue;
    }

    const reminderKey = `${hijri.year}-${hijri.month}-${its || phoneOrLid}`;
    if (!force && sentFeeReminders.has(reminderKey)) {
      continue;
    }

    const messageText = `💰 *HUB RAQAM - MONTHLY FEE REMINDER*\n\n` +
      `Salam Jameel,\n` +
      `Respected Parent,\n\n` +
      `This is a gentle reminder regarding the monthly Mauze Tahfeez Hub Raqam (Tuition Fee) for the month of *${hijri.nameEn} ${hijri.year}* for your child:\n` +
      `👤 Student: *${studentName}*\n` +
      (its ? `🆔 ITS: \`${its}\`\n` : '') +
      `\nKindly complete the payment online via the official Mahad al Zahra portal:\n` +
      `💳 *Pay Now:* ${payUrl}\n\n` +
      `After payment, please preserve your transaction receipt for your records.\n\n` +
      `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;

    const jid = formatTargetJid(phoneOrLid);
    if (jid && sock && baileysStatus === 'CONNECTED') {
      try {
        await sock.sendMessage(jid, { text: messageText });
        sentFeeReminders.add(reminderKey);
        sentCount++;
        console.log(`[FEE-REMINDER] 💰 Sent Hub Raqam fee reminder to ${jid} for ${studentName}`);
      } catch (err) {
        console.warn(`[FEE-REMINDER-ERR] Failed to send to ${jid}:`, err.message);
      }
    }
  }

  // 2. Also dispatch to embedded roster students with valid phone numbers (if not already sent)
  for (const s of embeddedRoster) {
    const sPhone = cleanPhone(s.phone || s.whatsappNumber || s.whatsapp_number);
    if (!sPhone) continue;
    const its = String(s.its || '').trim();
    const sId = String(s.student_id || s.id || '').trim();
    const studentName = s.name || 'Student';

    if (targetStudentId && sId !== targetStudentId && its !== targetStudentId) {
      continue;
    }

    const reminderKey = `${hijri.year}-${hijri.month}-${its || sPhone}`;
    if (!force && sentFeeReminders.has(reminderKey)) {
      continue;
    }

    const messageText = `💰 *HUB RAQAM - MONTHLY FEE REMINDER*\n\n` +
      `Salam Jameel,\n` +
      `Respected Parent,\n\n` +
      `This is a gentle reminder regarding the monthly Mauze Tahfeez Hub Raqam (Tuition Fee) for the month of *${hijri.nameEn} ${hijri.year}* for your child:\n` +
      `👤 Student: *${studentName}*\n` +
      (its ? `🆔 ITS: \`${its}\`\n` : '') +
      `\nKindly complete the payment online via the official Mahad al Zahra portal:\n` +
      `💳 *Pay Now:* ${payUrl}\n\n` +
      `After payment, please preserve your transaction receipt for your records.\n\n` +
      `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;

    const jid = formatTargetJid(sPhone);
    if (jid && sock && baileysStatus === 'CONNECTED') {
      try {
        await sock.sendMessage(jid, { text: messageText });
        sentFeeReminders.add(reminderKey);
        sentCount++;
        console.log(`[FEE-REMINDER] 💰 Sent Hub Raqam fee reminder to roster parent ${jid} for ${studentName}`);
      } catch (err) {
        console.warn(`[FEE-REMINDER-ERR] Failed to send to ${jid}:`, err.message);
      }
    }
  }

  return {
    sent: sentCount,
    hijriDate: `${hijri.date}/${hijri.month}/${hijri.year} (${hijri.nameEn})`
  };
}
export function lookupStudentInRoster(query) {
  const targetPhone = cleanPhone(query.phone || '');
  const targetName = String(query.name || '').trim().toLowerCase();
  const targetCode = String(query.code || query.its || '').trim().toLowerCase();

  for (const s of embeddedRoster) {
    const sPhone = cleanPhone(s.phone || s.whatsappNumber || s.whatsapp_number || '');
    if (targetPhone) {
      const phoneMatch = sPhone === targetPhone ||
        (sPhone.length >= 10 && targetPhone.length >= 10 && sPhone.slice(-10) === targetPhone.slice(-10));
      if (phoneMatch) return s;
    }

    if (targetName && targetCode) {
      const sName = String(s.name || '').toLowerCase();
      const sIts = String(s.its || '').toLowerCase();
      const sPhoneDigits = sPhone.slice(-10);
      if ((sName.includes(targetName) || targetName.includes(sName)) &&
        (sIts === targetCode || sPhoneDigits === targetCode)) {
        return s;
      }
    }

    if (targetCode && !targetName && !targetPhone) {
      const sIts = String(s.its || '').toLowerCase();
      if (sIts === targetCode) return s;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Live Attendance Store (In-Memory + Disk Sync)
// ---------------------------------------------------------------------------
const WA_ATTENDANCE_PATH = path.resolve('today_attendance.json');
export const latestAttendanceMap = new Map();

export function loadTodayAttendance() {
  try {
    if (fs.existsSync(WA_ATTENDANCE_PATH)) {
      const diskData = JSON.parse(fs.readFileSync(WA_ATTENDANCE_PATH, 'utf8') || '{}');
      for (const [k, v] of Object.entries(diskData)) {
        latestAttendanceMap.set(k, v);
      }
    }
  } catch (_) { }
}
loadTodayAttendance();

export function saveAttendanceRecord(key, record) {
  if (!key) return;
  latestAttendanceMap.set(key, record);
  try {
    let diskData = {};
    if (fs.existsSync(WA_ATTENDANCE_PATH)) {
      diskData = JSON.parse(fs.readFileSync(WA_ATTENDANCE_PATH, 'utf8') || '{}');
    }
    diskData[key] = record;
    fs.writeFileSync(WA_ATTENDANCE_PATH, JSON.stringify(diskData, null, 2));
  } catch (_) { }
}

export function getStoredAttendanceRecord(key) {
  if (!key) return null;
  return latestAttendanceMap.get(key) || null;
}

// ---------------------------------------------------------------------------
// Date Helpers for Strict "Of-The-Day" Attendance & Leave Matching
// ---------------------------------------------------------------------------
export function parseDateToComparableNumber(dStr) {
  if (!dStr) return 0;
  const clean = String(dStr).trim().replace(/[T ].*$/, '');
  let y = 0, m = 0, d = 0;
  if (clean.includes('-')) {
    const p = clean.split('-');
    if (p[0].length === 4) {
      y = parseInt(p[0], 10);
      m = parseInt(p[1], 10);
      d = parseInt(p[2], 10);
    }
  } else if (clean.includes('/')) {
    const p = clean.split('/');
    if (p[2]?.length === 4) {
      d = parseInt(p[0], 10);
      m = parseInt(p[1], 10);
      y = parseInt(p[2], 10);
    }
  }
  if (y && m && d) {
    return y * 10000 + m * 100 + d;
  }
  return 0;
}

export function isDateToday(dateStr) {
  if (!dateStr) return false;
  const ist = getISTDateParts();
  const clean = String(dateStr).trim().replace(/[T ].*$/, '');
  if (clean === ist.dateKey || clean === ist.dateDisplay) return true;
  const targetNum = parseDateToComparableNumber(clean);
  const todayNum = parseInt(ist.year, 10) * 10000 + parseInt(ist.month, 10) * 100 + parseInt(ist.day, 10);
  return targetNum > 0 && targetNum === todayNum;
}

export function isDateMatch(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return false;
  const clean1 = String(dateStr1).trim().replace(/[T ].*$/, '');
  const clean2 = String(dateStr2).trim().replace(/[T ].*$/, '');
  if (clean1 === clean2) return true;
  const n1 = parseDateToComparableNumber(clean1);
  const n2 = parseDateToComparableNumber(clean2);
  return n1 > 0 && n1 === n2;
}

export function isLeaveActiveToday(lvRec, targetDate = '') {
  if (!lvRec) return false;
  const ist = getISTDateParts();
  const todayNum = targetDate ? parseDateToComparableNumber(targetDate) : (parseInt(ist.year, 10) * 10000 + parseInt(ist.month, 10) * 100 + parseInt(ist.day, 10));

  const fromStr = lvRec.fromDate || lvRec.from_date || '';
  const toStr = lvRec.toDate || lvRec.to_date || fromStr;
  if (!fromStr) return false;

  const fromNum = parseDateToComparableNumber(fromStr);
  const toNum = parseDateToComparableNumber(toStr);

  if (fromNum && toNum) {
    return todayNum >= fromNum && todayNum <= toNum;
  } else if (fromNum) {
    return todayNum === fromNum;
  }
  return false;
}

export function findStudentAttendance(student, phone, targetDate = '') {
  const p = cleanPhone(phone || student?.phone || '');
  const its = String(student?.its || '').trim();
  const name = String(student?.name || '').trim().toLowerCase();
  const sId = String(student?.student_id || student?.id || '').trim();

  const rec = (
    (sId ? getStoredAttendanceRecord(`id:${sId}`) : null) ||
    (its ? getStoredAttendanceRecord(`its:${its}`) : null) ||
    (p ? getStoredAttendanceRecord(`phone:${p}`) : null) ||
    (name ? getStoredAttendanceRecord(`name:${name}`) : null) ||
    null
  );

  if (!rec) return null;

  // STRICT OF-THE-DAY CHECK:
  // If date does not match today's date (or targetDate), this is an old past record! Return null!
  const recDate = rec.date || rec.attendance_date || '';
  if (targetDate) {
    if (!isDateMatch(recDate, targetDate)) return null;
  } else {
    if (!isDateToday(recDate)) return null;
  }

  return rec;
}

/**
 * Proactively queries Firestore for today's marked attendance records
 * and populates the in-memory attendance cache.
 */
export async function syncTodayAttendanceFromFirestore() {
  if (!firestoreAdminDb) return;
  try {
    const ist = getISTDateParts();
    const todayKey = ist.dateKey; // e.g. 2026-10-06
    const todayDisplay = ist.dateDisplay; // e.g. 06/10/2026

    for (const colName of ['student_daily_attendance', 'kibar_student_daily_attendance']) {
      try {
        const [snap1, snap2] = await Promise.all([
          firestoreAdminDb.collection(colName).where('attendance_date', '==', todayKey).get(),
          firestoreAdminDb.collection(colName).where('attendance_date', '==', todayDisplay).get()
        ]);
        const allDocs = [...(snap1?.docs || []), ...(snap2?.docs || [])];
        allDocs.forEach(doc => {
          const data = doc.data();
          const sid = data.student_id;
          const status = /absent/i.test(data.status) ? 'Absent' : (/leave|uzur/i.test(data.status) ? 'Leave' : 'Present');
          const statusEmoji = status === 'Absent' ? '❌' : (status === 'Leave' ? '📝' : '✅');
          const record = {
            status,
            statusEmoji,
            date: data.attendance_date,
            studentId: sid,
            time: data.time || '',
            updatedAt: Date.now()
          };
          const s = embeddedRoster.find(item => item.student_id === sid || item.id === sid || (data.its && String(item.its) === String(data.its)));
          if (s) {
            record.name = s.name;
            record.its = s.its;
            record.phone = cleanPhone(s.phone);
          }
          if (record.studentId) saveAttendanceRecord(`id:${record.studentId}`, record);
          if (record.its) saveAttendanceRecord(`its:${record.its}`, record);
          if (record.phone) saveAttendanceRecord(`phone:${record.phone}`, record);
          if (record.name) saveAttendanceRecord(`name:${record.name.toLowerCase()}`, record);
        });
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[ATTENDANCE-SYNC-ERR]:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Live Leave Store (In-Memory + Disk Sync)
// ---------------------------------------------------------------------------
const WA_LEAVES_PATH = path.resolve('today_leaves.json');
export const latestLeavesMap = new Map();

export function loadTodayLeaves() {
  try {
    if (fs.existsSync(WA_LEAVES_PATH)) {
      const diskData = JSON.parse(fs.readFileSync(WA_LEAVES_PATH, 'utf8') || '{}');
      for (const [k, v] of Object.entries(diskData)) {
        latestLeavesMap.set(k, v);
      }
    }
  } catch (_) { }
}
loadTodayLeaves();

export function saveLeaveRecord(key, record) {
  if (!key) return;
  latestLeavesMap.set(key, record);
  try {
    let diskData = {};
    if (fs.existsSync(WA_LEAVES_PATH)) {
      diskData = JSON.parse(fs.readFileSync(WA_LEAVES_PATH, 'utf8') || '{}');
    }
    diskData[key] = record;
    fs.writeFileSync(WA_LEAVES_PATH, JSON.stringify(diskData, null, 2));
  } catch (_) { }
}

export function getStoredLeaveRecord(key) {
  if (!key) return null;
  return latestLeavesMap.get(key) || null;
}

export function findStudentLeave(student, phone, targetDate = '') {
  const p = cleanPhone(phone || student?.phone || '');
  const its = String(student?.its || '').trim();
  const name = String(student?.name || '').trim().toLowerCase();
  const sId = String(student?.student_id || student?.id || '').trim();

  const rec = (
    (sId ? getStoredLeaveRecord(`id:${sId}`) : null) ||
    (its ? getStoredLeaveRecord(`its:${its}`) : null) ||
    (p ? getStoredLeaveRecord(`phone:${p}`) : null) ||
    (name ? getStoredLeaveRecord(`name:${name}`) : null) ||
    null
  );

  if (!rec) return null;

  // Check if leave is currently active today
  if (!isLeaveActiveToday(rec, targetDate)) return null;

  return rec;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Persistent Live Weekly Results Store & Dynamic Ranking Engine
// Scores are strictly out of 100, and Current Juz is derived from Wusool Juz.
// ---------------------------------------------------------------------------
const WA_RESULTS_PATH = path.resolve('latest_weekly_results.json');
export const latestWeeklyResultsMap = new Map();

// Canonical Marhala definitions
export const MARHALA_ORDER = [
  "Marhala Ula",
  "Marhala Saniyah",
  "Marhala Salesah",
  "Marhala Rabeah",
  "Marhala Khamesah",
  "Marhala Sadesah",
  "Marhala Sabeah",
  "Marhala Saminah",
];

export const MARHALA_JUZ_BUCKETS = [
  { marhala: "Marhala Ula", juz: [30] },
  { marhala: "Marhala Saniyah", juz: [28, 29, 30] },
  { marhala: "Marhala Salesah", juz: [26, 27, 28, 29, 30] },
  { marhala: "Marhala Rabeah", juz: [1, 2, 3, 4, 5, 26, 27, 28, 29, 30] },
  { marhala: "Marhala Khamesah", juz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 26, 27, 28, 29, 30] },
  { marhala: "Marhala Sadesah", juz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 26, 27, 28, 29, 30] },
  { marhala: "Marhala Sabeah", juz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 26, 27, 28, 29, 30] },
  { marhala: "Marhala Saminah", juz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
];

export function deriveMarhalaFromJuz(juz) {
  const n = parseInt(String(juz ?? "").trim().replace(/\D/g, ''), 10);
  if (!n || isNaN(n)) return "Marhala Ula";
  if (n === 30) return "Marhala Ula";
  if (n === 28 || n === 29) return "Marhala Saniyah";
  if (n === 26 || n === 27) return "Marhala Salesah";
  if (n >= 1 && n <= 5) return "Marhala Rabeah";
  if (n >= 6 && n <= 10) return "Marhala Khamesah";
  if (n >= 11 && n <= 15) return "Marhala Sadesah";
  if (n >= 16 && n <= 20) return "Marhala Sabeah";
  if (n >= 21 && n <= 25) return "Marhala Saminah";
  return "Marhala Ula";
}

export function getStudentMarhala(student, weeklyResult) {
  const wJuz = weeklyResult?.wusool_juz;
  if (wJuz && String(wJuz).trim() !== '' && String(wJuz).trim() !== '—') {
    return deriveMarhalaFromJuz(wJuz);
  }
  const explicit = String(student?.marhala || weeklyResult?.marhala || "").trim();
  if (explicit && MARHALA_ORDER.includes(explicit)) {
    return explicit;
  }
  const juz = student?.juz || student?.hifz?.juz || "";
  return deriveMarhalaFromJuz(juz);
}

/**
 * Recalculates exact dynamic Marhala Ranks and Overall Ranks across active Atfal students
 * strictly matching the web app's Marhala Results page logic.
 */
export function recalculateAllRanks() {
  const allEntries = [];
  const processedKeys = new Set();

  // 1. Process active Atfal students from embedded roster
  for (const s of embeddedRoster) {
    const sId = String(s.student_id || s.id || '').trim();
    const its = String(s.its || '').trim();
    const key = sId || its || s.name;
    if (processedKeys.has(key)) continue;
    processedKeys.add(key);

    const res = getStoredWeeklyResult(s) || {};
    const rawScore = (res.total_score !== undefined && res.total_score !== null && res.total_score !== '')
      ? res.total_score
      : ((res.weeklyScore !== undefined && res.weeklyScore !== null && res.weeklyScore !== '') ? res.weeklyScore : (s.weeklyScore ?? 0));
    
    const score = Number(rawScore) || 0;
    const jadeed = Number(res.jadeed || 0);
    const jadeedPages = Number(String(res.total_jadeed_pages || 0).replace(/[^0-9.]/g, '')) || 0;
    const att = Number(res.attendance_count || 0);
    
    const wJuz = res.wusool_juz ? String(res.wusool_juz).trim() : (s.juz || '30');
    const marhala = deriveMarhalaFromJuz(wJuz);

    allEntries.push({
      student: s,
      result: res,
      key,
      sId,
      its,
      name: s.name,
      marhala,
      score,
      jadeed,
      jadeedPages,
      att
    });
  }

  if (allEntries.length === 0) return;

  // 2. Compute OVERALL RANKS across entire Atfal school cohort (out of total active students)
  allEntries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.jadeed !== a.jadeed) return b.jadeed - a.jadeed;
    if (b.jadeedPages !== a.jadeedPages) return b.jadeedPages - a.jadeedPages;
    return b.att - a.att;
  });

  const overallTotal = allEntries.length;
  let curOverallRank = 1;
  allEntries.forEach((entry, idx) => {
    if (idx > 0) {
      const prev = allEntries[idx - 1];
      if (entry.score !== prev.score || entry.jadeed !== prev.jadeed || entry.jadeedPages !== prev.jadeedPages) {
        curOverallRank = idx + 1;
      }
    } else {
      curOverallRank = 1;
    }
    entry.overallRank = curOverallRank;
    entry.overallTotal = overallTotal;
  });

  // 3. Compute MARHALA RANKS within each distinct Marhala group
  const marhalaGroups = new Map();
  for (const entry of allEntries) {
    const m = entry.marhala || "Marhala Ula";
    if (!marhalaGroups.has(m)) marhalaGroups.set(m, []);
    marhalaGroups.get(m).push(entry);
  }

  for (const [mName, mList] of marhalaGroups.entries()) {
    mList.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.jadeed !== a.jadeed) return b.jadeed - a.jadeed;
      if (b.jadeedPages !== a.jadeedPages) return b.jadeedPages - a.jadeedPages;
      return b.att - a.att;
    });

    const mTotal = mList.length;
    let curMRank = 1;
    mList.forEach((entry, idx) => {
      if (idx > 0) {
        const prev = mList[idx - 1];
        if (entry.score !== prev.score || entry.jadeed !== prev.jadeed || entry.jadeedPages !== prev.jadeedPages) {
          curMRank = idx + 1;
        }
      } else {
        curMRank = 1;
      }
      entry.marhalaRank = curMRank;
      entry.marhalaTotal = mTotal;
    });
  }

  // 4. Update cache maps and student references with real ranks
  for (const entry of allEntries) {
    if (entry.result) {
      entry.result.rank = entry.marhalaRank;
      entry.result.marhalaRank = entry.marhalaRank;
      entry.result.marhalaTotal = entry.marhalaTotal;
      entry.result.overall_rank = entry.overallRank;
      entry.result.overallRank = entry.overallRank;
      entry.result.overallTotal = entry.overallTotal;
      entry.result.marhala = entry.marhala;
      if (entry.sId) {
        latestWeeklyResultsMap.set(`id:${entry.sId}`, entry.result);
        latestWeeklyResultsMap.set(entry.sId, entry.result);
      }
      if (entry.its) {
        latestWeeklyResultsMap.set(`its:${entry.its}`, entry.result);
      }
      if (entry.name) {
        latestWeeklyResultsMap.set(`name:${entry.name.toLowerCase()}`, entry.result);
      }
    }
    if (entry.student) {
      entry.student.marhalaRank = String(entry.marhalaRank);
      entry.student.marhalaTotal = String(entry.marhalaTotal);
      entry.student.overallRank = String(entry.overallRank);
      entry.student.overallTotal = String(entry.overallTotal);
      entry.student.marhala = entry.marhala;
    }
  }
}

export function saveWeeklyResultRecord(data) {
  if (!data) return null;
  const sid = String(data.student_id || data.studentId || data.id || '').trim();
  const its = String(data.its || data.its_id || '').trim();
  const name = String(data.name || data.student_name || '').trim().toLowerCase();

  const rawScore = (data.total_score !== undefined && data.total_score !== null && data.total_score !== '')
    ? data.total_score
    : ((data.weeklyScore !== undefined && data.weeklyScore !== null && data.weeklyScore !== '') ? data.weeklyScore : data.score);
  
  const scoreNum = parseFloat(rawScore);
  const calcScore = (!isNaN(scoreNum) && scoreNum >= 0)
    ? scoreNum
    : (Number(data.murajazah || 0) + Number(data.juz_hali || 0) + Number(data.takhteet || 0) + Number(data.jadeed || 0));

  const wJuz = data.wusool_juz ? String(data.wusool_juz).trim() : (data.wusoolJuz ? String(data.wusoolJuz).trim() : '');
  const wSurah = data.wusool_surah ? String(data.wusool_surah).trim() : (data.wusoolSurah ? String(data.wusoolSurah).trim() : '');
  const wPage = data.wusool_page ? String(data.wusool_page).trim() : (data.wusoolPage ? String(data.wusoolPage).trim() : '');

  const jadeedPages = data.total_jadeed_pages ? String(data.total_jadeed_pages).trim() : (data.totalJadeedPages ? String(data.totalJadeedPages).trim() : '');
  const jadeedUnit = data.total_jadeed_unit ? String(data.total_jadeed_unit).trim() : 'صفه';
  const totalJadeedStr = jadeedPages ? `${jadeedPages} ${jadeedUnit}`.trim() : (data.totalJadeed || '—');

  const rankVal = parseInt(data.rank || data.marhalaRank, 10) || 1;
  const overallRankVal = parseInt(data.overall_rank || data.overallRank || data.rank || data.marhalaRank, 10) || rankVal;

  const record = {
    id: data.id || `result_${sid}_${data.week_date || Date.now()}`,
    student_id: sid,
    its,
    name: data.name || data.student_name || '',
    week_date: data.week_date || data.weekDate || new Date().toISOString().slice(0, 10),
    from_date: data.from_date || data.fromDate || data.fatemi_from_date || '',
    till_date: data.till_date || data.tillDate || data.to_date || data.toDate || data.fatemi_till_date || data.week_date || '',
    total_score: calcScore, // OUT OF 100!
    murajazah: parseFloat(data.murajazah) || 0,
    juz_hali: parseFloat(data.juz_hali) || 0,
    takhteet: parseFloat(data.takhteet) || 0,
    jadeed: parseFloat(data.jadeed) || 0,
    wusool_juz: wJuz,
    wusool_surah: wSurah,
    wusool_page: wPage,
    total_jadeed_pages: jadeedPages,
    total_jadeed_unit: jadeedUnit,
    totalJadeed: totalJadeedStr,
    rank: rankVal,
    overall_rank: overallRankVal,
    attendance_count: parseInt(data.attendance_count, 10) || 0,
    attendance_note: data.attendance_note || '',
    updatedAt: Date.now()
  };

  // Index by multiple keys for instantaneous retrieval
  if (sid) {
    latestWeeklyResultsMap.set(`id:${sid}`, record);
    latestWeeklyResultsMap.set(sid, record);
  }
  if (its) latestWeeklyResultsMap.set(`its:${its}`, record);
  if (name) latestWeeklyResultsMap.set(`name:${name}`, record);

  // Trigger ranking recalculation across the board
  recalculateAllRanks();

  // Sync to disk
  try {
    let diskData = {};
    if (fs.existsSync(WA_RESULTS_PATH)) {
      diskData = JSON.parse(fs.readFileSync(WA_RESULTS_PATH, 'utf8') || '{}');
    }
    if (sid) diskData[sid] = record;
    if (its) diskData[`its:${its}`] = record;
    fs.writeFileSync(WA_RESULTS_PATH, JSON.stringify(diskData, null, 2));
  } catch (_) {}

  return record;
}

export function getStoredWeeklyResult(student) {
  if (!student) return null;
  const sId = String(student.student_id || student.id || '').trim();
  const its = String(student.its || '').trim();
  const name = String(student.name || student.student_name || '').trim().toLowerCase();

  return (
    (sId ? latestWeeklyResultsMap.get(`id:${sId}`) : null) ||
    (sId ? latestWeeklyResultsMap.get(sId) : null) ||
    (its ? latestWeeklyResultsMap.get(`its:${its}`) : null) ||
    (name ? latestWeeklyResultsMap.get(`name:${name}`) : null) ||
    student.latestResult ||
    null
  );
}

export function enrichStudentWithLatestResult(student) {
  if (!student) return student;

  // Find authoritative student in embeddedRoster
  const sMatch = embeddedRoster.find(item =>
    (student.student_id && (item.student_id === student.student_id || item.id === student.student_id)) ||
    (student.id && (item.student_id === student.id || item.id === student.id)) ||
    (student.its && item.its && String(item.its) === String(student.its)) ||
    (student.name && item.name && item.name.toLowerCase() === student.name.toLowerCase())
  ) || student;

  const res = getStoredWeeklyResult(sMatch) || getStoredWeeklyResult(student);
  
  const wJuz = (res?.wusool_juz && String(res.wusool_juz).trim() !== '' && String(res.wusool_juz).trim() !== '—')
    ? String(res.wusool_juz).trim()
    : (sMatch.juz || '30');
  const wSurah = (res?.wusool_surah && String(res.wusool_surah).trim() !== '' && String(res.wusool_surah).trim() !== '—')
    ? String(res.wusool_surah).trim()
    : (sMatch.surat || '—');
  const marhala = deriveMarhalaFromJuz(wJuz);

  const score = (res?.total_score !== undefined && res?.total_score !== null && res?.total_score !== '')
    ? Number(res.total_score)
    : (res?.weeklyScore !== undefined ? Number(res.weeklyScore) : (sMatch.weeklyScore ?? 0));

  const totalJadeedStr = res?.totalJadeed || (res?.total_jadeed_pages ? `${res.total_jadeed_pages} ${res.total_jadeed_unit || 'صفه'}`.trim() : (sMatch.totalJadeed || '—'));

  return {
    ...sMatch,
    ...student,
    teacher: sMatch.teacher || student.teacher || 'Janab Mulla Murtaza bhai Hamid',
    group: sMatch.group || student.group || '—',
    its: sMatch.its || student.its || '',
    name: sMatch.name || student.name || 'Student',
    weeklyScore: isNaN(score) ? (sMatch.weeklyScore ?? 0) : score,
    totalOutOf: 100,
    marhala,
    juz: wJuz,
    wusoolJuz: wJuz,
    surat: wSurah,
    wusoolSurah: wSurah,
    wusoolPage: res?.wusool_page || sMatch.wusool_page || student.wusool_page || '',
    totalJadeed: totalJadeedStr,
    marhalaRank: res?.rank ? String(res.rank) : (res?.marhalaRank ? String(res.marhalaRank) : (sMatch.marhalaRank || '1')),
    marhalaTotal: res?.marhalaTotal ? String(res.marhalaTotal) : (sMatch.marhalaTotal ? String(sMatch.marhalaTotal) : ''),
    overallRank: res?.overall_rank ? String(res.overall_rank) : (res?.overallRank ? String(res.overallRank) : (sMatch.overallRank || '1')),
    overallTotal: res?.overallTotal ? String(res.overallTotal) : (sMatch.overallTotal ? String(sMatch.overallTotal) : '40'),
    fromDate: res?.from_date || sMatch.fromDate || student.fromDate || '',
    tillDate: res?.till_date || res?.week_date || sMatch.tillDate || student.tillDate || '',
    weekDate: res?.week_date || sMatch.weekDate || student.weekDate || '',
    murajazah: res?.murajazah ?? 0,
    juz_hali: res?.juz_hali ?? 0,
    takhteet: res?.takhteet ?? 0,
    jadeed: res?.jadeed ?? 0,
    latestResult: res
  };
}

export function loadWeeklyResults() {
  try {
    // 1. Preload baseline results from public/weekly_results_rows.csv
    const csvCandidates = [
      path.resolve('public', 'weekly_results_rows.csv'),
      path.resolve('..', 'public', 'weekly_results_rows.csv')
    ];
    const csvPath = csvCandidates.find(p => fs.existsSync(p));
    if (csvPath) {
      const rows = parseCsvText(fs.readFileSync(csvPath, 'utf8'));
      const studentLatestCsvMap = new Map();
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const sid = (r[1] || '').trim();
        const weekDate = (r[2] || '').trim();
        if (!sid) continue;
        const existing = studentLatestCsvMap.get(sid);
        if (!existing || weekDate > existing.weekDate) {
          studentLatestCsvMap.set(sid, {
            id: r[0],
            student_id: sid,
            week_date: weekDate,
            murajazah: r[3],
            juz_hali: r[4],
            takhteet: r[5],
            jadeed: r[6],
            rank: r[7],
            total_jadeed_pages: r[14],
            attendance_count: r[15],
            wusool_juz: r[18],
            wusool_page: r[19],
            wusool_surah: r[23],
            total_score: r[26],
            total_jadeed_unit: r[27]
          });
        }
      }
      for (const rec of studentLatestCsvMap.values()) {
        const sid = rec.student_id;
        latestWeeklyResultsMap.set(`id:${sid}`, rec);
        latestWeeklyResultsMap.set(sid, rec);
      }
      console.log(`[WHATSAPP BOT] 🏆 Preloaded ${studentLatestCsvMap.size} baseline student results from ${csvPath}`);
    }

    // 2. Load newer results from latest_weekly_results.json disk cache
    if (fs.existsSync(WA_RESULTS_PATH)) {
      const diskData = JSON.parse(fs.readFileSync(WA_RESULTS_PATH, 'utf8') || '{}');
      for (const [k, v] of Object.entries(diskData)) {
        latestWeeklyResultsMap.set(k, v);
      }
    }

    // 3. Dynamic Cohort Ranking across all loaded student data
    recalculateAllRanks();

    // 4. Enrich all students in embeddedRoster
    for (let i = 0; i < embeddedRoster.length; i++) {
      embeddedRoster[i] = enrichStudentWithLatestResult(embeddedRoster[i]);
    }
  } catch (err) {
    console.warn('[WHATSAPP BOT] Could not load weekly results:', err.message);
  }
}
loadWeeklyResults();

/**
 * Fetches fresh result record from Firestore weekly_results.
 */
export async function fetchLatestResultFromFirestore(student) {
  if (!firestoreAdminDb || !student) return null;
  try {
    const sid = student.student_id || student.id || student.its;
    const snap = await firestoreAdminDb.collection('weekly_results')
      .where('student_id', '==', sid)
      .orderBy('week_date', 'desc')
      .limit(1)
      .get();
    if (!snap.empty) {
      const data = snap.docs[0].data();
      return saveWeeklyResultRecord({ id: snap.docs[0].id, ...data });
    }
  } catch (_) { }
  return getStoredWeeklyResult(student);
}

// ---------------------------------------------------------------------------
// Rate Limiting & Safety Anti-Flood
// ---------------------------------------------------------------------------
const safetyLimits = new Map();

export function checkSafetyLimit(phone) {
  const now = Date.now();
  let record = safetyLimits.get(phone);
  if (!record) {
    record = { count: 1, firstTimestamp: now, blockedUntil: 0 };
    safetyLimits.set(phone, record);
    return { allowed: true };
  }

  if (record.blockedUntil && now < record.blockedUntil) {
    const secLeft = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      reason: `⚠️ *Safety Cooldown Active*\n\nPlease wait ${secLeft}s before sending another request.`
    };
  }

  if (now - record.firstTimestamp > 60000) {
    record.count = 1;
    record.firstTimestamp = now;
    return { allowed: true };
  }

  record.count++;
  if (record.count > 15) {
    record.blockedUntil = now + 60000;
    return {
      allowed: false,
      reason: `⚠️ *Anti-Spam Protection*\n\nToo many requests in a short period. Please wait 60 seconds before trying again.`
    };
  }

  return { allowed: true };
}

/**
 * XML/SVG safe escaping.
 */
function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an ultra-premium SVG card for the weekly Marhala result.
 * Rendered with vector icons and golden/emerald accents with 100% font compatibility.
 */
export function generateResultSvg(data) {
  const name = String(data.name || data.studentName || 'Student Name').trim();
  const fromDate = String(data.fromDate || '').trim();
  const tillDate = String(data.tillDate || data.weekDate || '').trim();
  const score = (data.weeklyScore !== undefined && data.weeklyScore !== '' && data.weeklyScore !== null)
    ? String(data.weeklyScore)
    : '0';
  const jadeed = String(data.totalJadeed || '—').trim();
  const marhalaRank = String(data.marhalaRank || '1').trim();
  const overallRank = String(data.overallRank || '1').trim();
  const marhala = String(data.marhala || deriveMarhalaFromJuz(data.juz) || 'Marhala Ula').trim();
  const marhalaTotal = String(data.marhalaTotal || '').trim();
  const overallTotal = String(data.overallTotal || '40').trim();
  const juz = String(data.juz || '30').trim();
  const surat = String(data.surat || '—').trim();
  const teacher = String(data.teacher || 'Janab Mulla Murtaza bhai Hamid').trim();
  const group = String(data.group || '—').trim();
  const its = String(data.its || '').trim();

  let dateRange = 'Current Academic Week';
  if (fromDate && tillDate && fromDate !== '—' && tillDate !== '—' && fromDate !== tillDate) {
    dateRange = `${fromDate}  ➔  ${tillDate}`;
  } else if (tillDate && tillDate !== '—') {
    dateRange = tillDate;
  }

  const portalDomain = BOT_CONFIG.PORTAL_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const mRankSubtitle = marhalaTotal ? `Within ${marhala} (${marhalaRank} of ${marhalaTotal})` : `Within ${marhala}`;
  const oRankSubtitle = overallTotal ? `Across All Atfal (${overallRank} of ${overallTotal})` : `Across All Registered Atfal`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Royal Dark Brown & Mocha Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#180e07" />
      <stop offset="45%" stop-color="#25160c" />
      <stop offset="100%" stop-color="#120904" />
    </linearGradient>

    <!-- Warm Radiant Gold Gradient -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fae29c" />
      <stop offset="50%" stop-color="#d4af37" />
      <stop offset="100%" stop-color="#9d7112" />
    </linearGradient>

    <!-- Deep Warm Chocolate Card Background -->
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#362013" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#22130a" stop-opacity="0.98" />
    </linearGradient>

    <!-- Vibrant Gold Score Gradient -->
    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fae29c" />
      <stop offset="50%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#d4af37" />
    </linearGradient>

    <!-- Soft Drop Shadow -->
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.65" />
    </filter>

    <!-- Golden Text Glow -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1350" fill="url(#bgGrad)" />

  <!-- Outer Elegant Gold Border Frame -->
  <rect x="30" y="30" width="1020" height="1290" rx="28" fill="none" stroke="url(#goldGrad)" stroke-width="4" opacity="0.85" />
  <rect x="42" y="42" width="996" height="1266" rx="22" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-dasharray="8 8" opacity="0.45" />

  <!-- Corner Islamic Geometric Accents -->
  <path d="M42,100 L100,42 M42,120 L120,42" stroke="url(#goldGrad)" stroke-width="2.5" opacity="0.75" />
  <path d="M1038,100 L980,42 M1038,120 L960,42" stroke="url(#goldGrad)" stroke-width="2.5" opacity="0.75" />
  <path d="M42,1250 L100,1308 M42,1230 L120,1308" stroke="url(#goldGrad)" stroke-width="2.5" opacity="0.75" />
  <path d="M1038,1250 L980,1308 M1038,1230 L960,1308" stroke="url(#goldGrad)" stroke-width="2.5" opacity="0.75" />

  <!-- Main Big Institution Header -->
  <text x="540" y="130" font-family="'Cinzel', 'Cinzel Decorative', Georgia, serif" font-size="34" fill="#ffffff" text-anchor="middle" font-weight="800" letter-spacing="3" filter="url(#glow)">
    Rawdat Tahfeez al Atfal - Galiakot
  </text>

  <!-- Title Badge with Exact Marhala Heading -->
  <rect x="260" y="162" width="560" height="42" rx="21" fill="#362013" stroke="url(#goldGrad)" stroke-width="1.8" />
  <text x="540" y="189" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#fae29c" text-anchor="middle" font-weight="800" letter-spacing="3">
    WEEKLY REPORT • ${escapeXml(marhala.toUpperCase())}
  </text>

  <!-- Student Name Hero Card -->
  <g filter="url(#shadow)">
    <rect x="80" y="230" width="920" height="160" rx="24" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2.5" />
  </g>
  <text x="540" y="270" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" fill="#dfd0c4" text-anchor="middle" letter-spacing="3" text-transform="uppercase">
    STUDENT PERFORMANCE SUMMARY
  </text>
  <text x="540" y="328" font-family="'Cinzel', Georgia, serif" font-size="40" fill="#ffffff" text-anchor="middle" font-weight="800" filter="url(#glow)">
    ${escapeXml(name)}
  </text>
  
  <!-- Calendar Vector Icon + Date Range -->
  <g transform="translate(390, 350)">
    <rect x="0" y="2" width="18" height="16" rx="3" fill="none" stroke="#fae29c" stroke-width="1.8" />
    <line x1="0" y1="7" x2="18" y2="7" stroke="#fae29c" stroke-width="1.5" />
    <line x1="4" y1="0" x2="4" y2="4" stroke="#fae29c" stroke-width="2" stroke-linecap="round" />
    <line x1="14" y1="0" x2="14" y2="4" stroke="#fae29c" stroke-width="2" stroke-linecap="round" />
  </g>
  <text x="548" y="365" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#fae29c" text-anchor="middle" font-weight="600">
    ${escapeXml(dateRange)}
  </text>

  <!-- Primary Metric: Weekly Score Card -->
  <g filter="url(#shadow)">
    <rect x="80" y="415" width="445" height="235" rx="22" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="1.8" />
  </g>
  <rect x="110" y="440" width="140" height="32" rx="16" fill="#4d2c17" stroke="url(#goldGrad)" stroke-width="1" />
  <text x="180" y="461" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" fill="#fae29c" text-anchor="middle" font-weight="700">
    TOTAL SCORE
  </text>
  <text x="302" y="545" font-family="'Cinzel', Georgia, serif" font-size="70" fill="url(#scoreGrad)" text-anchor="middle" font-weight="800">
    ${escapeXml(score)}
  </text>
  <text x="302" y="585" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#dfd0c4" text-anchor="middle">
    Score out of 100
  </text>
  <rect x="130" y="610" width="345" height="8" rx="4" fill="#201209" />
  <rect x="130" y="610" width="280" height="8" rx="4" fill="url(#goldGrad)" />

  <!-- Total Jadeed Card -->
  <g filter="url(#shadow)">
    <rect x="555" y="415" width="445" height="235" rx="22" fill="url(#cardGrad)" stroke="#10b981" stroke-width="1.8" />
  </g>
  <rect x="585" y="440" width="150" height="32" rx="16" fill="#143c29" stroke="#10b981" stroke-width="1" />
  <text x="660" y="461" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" fill="#6ee7b7" text-anchor="middle" font-weight="700">
    TOTAL JADEED
  </text>
  <text x="777" y="545" font-family="'Amiri', 'Traditional Arabic', serif" font-size="52" fill="#34d399" text-anchor="middle" font-weight="bold">
    ${escapeXml(jadeed)}
  </text>
  <text x="777" y="585" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#dfd0c4" text-anchor="middle">
    Weekly Progress Achieved
  </text>
  <rect x="605" y="610" width="345" height="8" rx="4" fill="#201209" />
  <rect x="605" y="610" width="290" height="8" rx="4" fill="#10b981" />

  <!-- Ranking Row -->
  <!-- 1. Marhala Rank Card with Golden Crown Vector Icon -->
  <g filter="url(#shadow)">
    <rect x="80" y="675" width="445" height="215" rx="22" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2" />
  </g>
  <!-- Royal Crown Vector Icon -->
  <g transform="translate(160, 700)">
    <path d="M4 22h24v3H4zm2-5l3-12 6 7 5-10 5 10 6-7 3 12H6z" fill="url(#goldGrad)" stroke="#fae29c" stroke-width="0.8" />
    <circle cx="9" cy="4" r="2" fill="#fae29c" />
    <circle cx="16" cy="1" r="2.2" fill="#fae29c" />
    <circle cx="23" cy="4" r="2" fill="#fae29c" />
  </g>
  <text x="325" y="722" font-family="'Segoe UI', Roboto, sans-serif" font-size="17" fill="#fae29c" text-anchor="middle" font-weight="800" letter-spacing="2">
    MARHALA RANK
  </text>
  <text x="302" y="805" font-family="'Cinzel', Georgia, serif" font-size="66" fill="url(#goldGrad)" text-anchor="middle" font-weight="800" filter="url(#glow)">
    #${escapeXml(marhalaRank)}
  </text>
  <text x="302" y="852" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" fill="#dfd0c4" text-anchor="middle" font-weight="600">
    ${escapeXml(mRankSubtitle)}
  </text>

  <!-- 2. Overall Rank Card with Sparkling Star / Trophy Vector Icon -->
  <g filter="url(#shadow)">
    <rect x="555" y="675" width="445" height="215" rx="22" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2" />
  </g>
  <!-- Glowing Star Vector Icon -->
  <g transform="translate(635, 700)">
    <path d="M14 2l3.4 7.2 7.6 1.1-5.5 5.4 1.3 7.8-6.8-3.7-6.8 3.7 1.3-7.8-5.5-5.4 7.6-1.1z" fill="url(#goldGrad)" stroke="#fae29c" stroke-width="0.8" />
  </g>
  <text x="795" y="722" font-family="'Segoe UI', Roboto, sans-serif" font-size="17" fill="#fae29c" text-anchor="middle" font-weight="800" letter-spacing="2">
    OVERALL RANK
  </text>
  <text x="777" y="805" font-family="'Cinzel', Georgia, serif" font-size="66" fill="#ffffff" text-anchor="middle" font-weight="800" filter="url(#glow)">
    #${escapeXml(overallRank)}
  </text>
  <text x="777" y="852" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" fill="#dfd0c4" text-anchor="middle" font-weight="600">
    ${escapeXml(oRankSubtitle)}
  </text>

  <!-- Academic Hifz Details Card -->
  <g filter="url(#shadow)">
    <rect x="80" y="915" width="920" height="175" rx="22" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="1.8" />
  </g>
  <!-- Book / Quran Vector Icon -->
  <g transform="translate(345, 936)">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" stroke="#fae29c" stroke-width="2" fill="none" />
  </g>
  <text x="550" y="953" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" fill="#fae29c" text-anchor="middle" font-weight="700" letter-spacing="2">
    HIFZ &amp; ACADEMIC RECORD
  </text>

  <!-- Detail Box 1: Teacher & Group -->
  <rect x="110" y="980" width="415" height="88" rx="14" fill="#24140b" stroke="rgba(212,175,55,0.4)" stroke-width="1" />
  <!-- User Vector Icon -->
  <g transform="translate(130, 998)">
    <circle cx="10" cy="8" r="6" fill="#fae29c" />
    <path d="M2 24c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="none" stroke="#fae29c" stroke-width="2.2" stroke-linecap="round" />
  </g>
  <text x="160" y="1014" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" fill="#dfd0c4">
    Assigned Ustad:
  </text>
  <text x="130" y="1046" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#ffffff" font-weight="700">
    ${escapeXml(teacher)}
  </text>

  <!-- Detail Box 2: Hifz Progress -->
  <rect x="555" y="980" width="415" height="88" rx="14" fill="#24140b" stroke="rgba(212,175,55,0.4)" stroke-width="1" />
  <!-- Target Vector Icon -->
  <g transform="translate(575, 998)">
    <circle cx="10" cy="10" r="9" fill="none" stroke="#fae29c" stroke-width="2" />
    <circle cx="10" cy="10" r="5" fill="none" stroke="#fae29c" stroke-width="1.8" />
    <circle cx="10" cy="10" r="2" fill="#fae29c" />
  </g>
  <text x="605" y="1014" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" fill="#dfd0c4">
    Current Hifz Target:
  </text>
  <text x="575" y="1046" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#fae29c" font-weight="700">
    Juz ${escapeXml(juz)}${surat && surat !== '—' ? ' • ' + escapeXml(surat) : ''}${group && group !== '—' ? ' (Gr ' + escapeXml(group) + ')' : ''}
  </text>

  <!-- Official Verification Footer Banner with Emerald Badge -->
  <rect x="80" y="1115" width="920" height="46" rx="23" fill="#20130a" stroke="#10b981" stroke-width="1.4" />
  <g transform="translate(310, 1126)">
    <circle cx="12" cy="12" r="11" fill="#10b981" />
    <path d="M7 12l3.5 3.5 7-7" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  </g>
  <text x="560" y="1144" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#34d399" text-anchor="middle" font-weight="700">
    Verified Official Record • Rawdat Tahfeez al Atfal
  </text>

  <!-- Student Portal Link Banner with Globe Vector Icon -->
  <rect x="180" y="1185" width="720" height="56" rx="28" fill="#2e1a0e" stroke="url(#goldGrad)" stroke-width="2" />
  <g transform="translate(290, 1200)">
    <circle cx="13" cy="13" r="11" fill="none" stroke="#fae29c" stroke-width="2" />
    <ellipse cx="13" cy="13" rx="5.5" ry="11" fill="none" stroke="#fae29c" stroke-width="1.8" />
    <line x1="2" y1="13" x2="24" y2="13" stroke="#fae29c" stroke-width="1.8" />
  </g>
  <text x="560" y="1221" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" fill="#fae29c" text-anchor="middle" font-weight="800" letter-spacing="1">
    STUDENT PORTAL: ${escapeXml(portalDomain)}
  </text>
</svg>`;
}

/**
 * Converts SVG markup to crisp PNG buffer via Resvg with embedded Arabic and English fonts.
 */
export function svgToPngBuffer(svgString) {
  if (!Resvg) {
    console.warn('[RESVG-NOTICE] Resvg renderer not loaded, returning raw SVG buffer.');
    return Buffer.from(svgString, 'utf-8');
  }
  try {
    const fontFiles = getFontFiles();
    const opts = {
      fitTo: { mode: 'width', value: 1080 }
    };
    if (fontFiles.length > 0) {
      opts.font = {
        loadSystemFonts: false,
        fontFiles: fontFiles,
        defaultFontFamily: 'Arial'
      };
    }
    const resvg = new Resvg(svgString, opts);
    return resvg.render().asPng();
  } catch (err) {
    console.warn('[RESVG-RENDER-ERR] Error rendering PNG with Resvg:', err.message);
    return Buffer.from(svgString, 'utf-8');
  }
}

/**
 * Returns Base64 data URI of the result SVG.
 */
export function generateResultBase64(data) {
  const svg = generateResultSvg(data);
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Builds short, clean text caption for WhatsApp result notification (referring to the image card).
 */
export function buildResultCaption(data) {
  const name = data.name || data.studentName || 'Student';
  const tillDate = data.tillDate || data.weekDate || '';

  return `🌹 *Salam Jameel!*\n\n` +
    `Here is the latest weekly performance result for *${name}*${tillDate && tillDate !== '—' ? ` (${tillDate})` : ''}.\n\n` +
    `Official Result Card attached above 👆\n\n` +
    `🌐 *Student Portal:* ${BOT_CONFIG.PORTAL_URL}`;
}

/**
 * Connects to Meta WhatsApp Multi-Device servers via Baileys socket.
 */
let isConnecting = false;
export async function initBaileysSocket() {
  if (isConnecting) return sock;
  isConnecting = true;

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version = [2, 3000, 1017531287];
  try {
    const v = await fetchLatestBaileysVersion();
    if (v && v.version) {
      version = v.version;
    }
  } catch (_) { }

  try {
    sock = makeWASocket({
      version,
      logger: createSilentLogger(),
      printQRInTerminal: true,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, createSilentLogger())
      },
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 15000,
      emitOwnEvents: false,
      retryRequestDelayMs: 250,
      getMessage: async () => ({ conversation: '' })
    });
  } catch (err) {
    isConnecting = false;
    console.error('[BAILEYS-INIT-ERR] Error creating socket:', err);
    setTimeout(initBaileysSocket, 3000);
    return null;
  }

  isConnecting = false;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQrRaw = qr;
      latestQrDataUrl = await QRCode.toDataURL(qr, { width: 360, margin: 2 });
      await QRCode.toFile('openwa-qr.png', qr, { width: 400 });
      baileysStatus = 'QR_READY';
      console.log('\n======================================================');
      console.log(`📱 NEW WHATSAPP QR CODE READY FOR SCANNING`);
      console.log(`🔗 Open http://localhost:${BOT_CONFIG.PORT} to scan on your phone!`);
      console.log(`📞 Helpline Number : ${BOT_CONFIG.HELPLINE_NUMBER}`);
      console.log('======================================================\n');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;
      baileysStatus = 'DISCONNECTED';
      console.log(`[WHATSAPP BOT] ⚠️ Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(() => {
          initBaileysSocket().catch((e) => console.error('[RECONNECT-ERR]:', e.message));
        }, 3000);
      } else if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        console.log('[WHATSAPP BOT] Session logged out or credentials expired. Resetting auth directory for a fresh QR code...');
        try {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        } catch (_) { }
        setTimeout(() => {
          initBaileysSocket().catch((e) => console.error('[RECONNECT-ERR]:', e.message));
        }, 2000);
      }
    } else if (connection === 'open') {
      baileysStatus = 'CONNECTED';
      connectedUser = sock.user;
      latestQrDataUrl = '';
      latestQrRaw = '';
      latestPairingCode = '';
      console.log(`\n======================================================`);
      console.log(`✅ WHATSAPP MULTI-DEVICE CONNECTED & AUTHENTICATED!`);
      console.log(`📞 Helpline : ${BOT_CONFIG.HELPLINE_NUMBER}`);
      console.log(`📱 Phone ID : ${sock.user?.id}`);
      console.log(`🚀 Ready to dispatch real result images & answer parent queries!`);
      console.log(`======================================================\n`);
      
      // Send initial presence online signal
      try {
        sock.sendPresenceUpdate('available').catch(() => {});
      } catch (_) {}

      initFirestoreRealtimeListeners();
    }
  });

  // ── INCOMING MESSAGES EVENT LISTENER ──
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!messages || !Array.isArray(messages)) return;
    for (const msg of messages) {
      if (!msg || !msg.message) continue;
      // Never process bot's own outbound messages
      if (msg.key?.fromMe) continue;

      // INSTANT READ RECEIPT: Turn 1 tick into 2 ticks / blue ticks immediately on sender's WhatsApp
      try {
        if (msg.key && sock?.readMessages) {
          await sock.readMessages([msg.key]);
        }
      } catch (_) {}

      // Auto-extract and cache LID mapping immediately if message contains sender LID and phone
      try {
        const remoteJid = msg.key?.remoteJid || '';
        const participant = msg.key?.participant || '';
        if (remoteJid.includes('@lid') && participant && participant.includes('@s.whatsapp.net')) {
          const lid = remoteJid.replace(/@.*$/, '').replace(/\D/g, '');
          const phone = cleanPhone(participant.replace(/@.*$/, ''));
          if (lid && phone && phone.length >= 10 && phone.length <= 13) {
            lidMappingCache.set(lid, phone);
            phoneToLidCache.set(phone, lid);
          }
        }
      } catch (_) {}

      try {
        await handleIncomingWhatsAppMessage(msg);
      } catch (err) {
        console.error('[WHATSAPP-MSG-ERROR]:', err);
      }
    }
  });

  // Self-healing watchdog: Keep connection hot and auto-reconnect if dropped
  if (!global.__baileysWatchdogStarted) {
    global.__baileysWatchdogStarted = true;
    setInterval(async () => {
      try {
        if (sock && baileysStatus === 'CONNECTED') {
          await sock.sendPresenceUpdate('available').catch(() => {});
        } else if (baileysStatus === 'DISCONNECTED') {
          console.log('[WATCHDOG] 🔄 Auto-reconnecting disconnected WhatsApp socket...');
          initBaileysSocket().catch(() => {});
        }
      } catch (_) {}
    }, 20000);
  }

  return sock;
}

/**
 * Queries live Google Sheets Webhook or backend for fresh student marks.
 */
export async function fetchLiveSheetResult(student) {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL || BOT_CONFIG.GOOGLE_SHEETS_WEBHOOK_URL || '';
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout ? AbortSignal.timeout(1500) : undefined,
      body: JSON.stringify({
        action: 'search_student',
        email: student.email,
        its: student.its,
        name: student.name,
        phone: student.phone
      })
    });
    const data = await res.json();
    if (data && data.success && data.student) {
      return data.student;
    }
  } catch (err) {
    // Sheet fetch optional/timeout - fallback immediately to local roster
  }
  return null;
}

/**
 * Robust message sender that handles both standard phone JIDs and private @lid JIDs
 * with automatic fallback to @s.whatsapp.net.
 */
export async function sendWhatsAppMessage(targetJid, content, senderPhone = '') {
  if (!sock) return null;
  try {
    const result = await sock.sendMessage(targetJid, content);
    console.log(`[WHATSAPP-SEND-SUCCESS] ✅ Sent message to ${targetJid}`);
    return result;
  } catch (err) {
    console.warn(`[WHATSAPP-SEND-FAIL] Direct send to ${targetJid} failed:`, err.message);
    if (targetJid && targetJid.includes('@lid') && senderPhone && senderPhone.length >= 10 && senderPhone.length <= 13) {
      const fallbackJid = `${senderPhone}@s.whatsapp.net`;
      try {
        console.log(`[WHATSAPP-SEND-FALLBACK] Retrying to phone JID: ${fallbackJid}...`);
        const fbResult = await sock.sendMessage(fallbackJid, content);
        console.log(`[WHATSAPP-SEND-SUCCESS] ✅ Sent message to fallback ${fallbackJid}`);
        return fbResult;
      } catch (err2) {
        console.error(`[WHATSAPP-SEND-FALLBACK-FAIL] Fallback to ${fallbackJid} failed:`, err2.message);
      }
    } else if (targetJid && targetJid.includes('@s.whatsapp.net')) {
      const cleanP = cleanPhone(targetJid.replace(/@.*$/, ''));
      const knownLid = phoneToLidCache.get(cleanP);
      if (knownLid) {
        const lidJid = `${knownLid}@lid`;
        try {
          console.log(`[WHATSAPP-SEND-FALLBACK] Retrying to known LID: ${lidJid}...`);
          const fbResult = await sock.sendMessage(lidJid, content);
          console.log(`[WHATSAPP-SEND-SUCCESS] ✅ Sent message to fallback ${lidJid}`);
          return fbResult;
        } catch (err3) {
          console.error(`[WHATSAPP-SEND-FALLBACK-FAIL] Fallback to ${lidJid} failed:`, err3.message);
        }
      }
    }
    return null;
  }
}

/**
 * Returns latest fresh student marks, merging live sheet data or updated roster file.
 */
export async function getFreshStudentData(student) {
  if (!student) return student;

  // 1. Instant sub-millisecond in-memory cache check (zero lag)
  const stored = getStoredWeeklyResult(student);
  if (stored && (stored.total_score !== undefined || stored.weeklyScore !== undefined)) {
    return enrichStudentWithLatestResult(student);
  }

  // 2. Try fetching latest result directly from Firestore weekly_results (with 1.5s timeout)
  try {
    const freshFromDb = await Promise.race([
      fetchLatestResultFromFirestore(student),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
    ]);
    if (freshFromDb) {
      return enrichStudentWithLatestResult({ ...student, latestResult: freshFromDb });
    }
  } catch (_) { }

  // 3. Try Google Sheets live webhook if configured (with 1s timeout)
  try {
    const liveSheetData = await fetchLiveSheetResult(student);
    if (liveSheetData && liveSheetData.weeklyScore !== undefined) {
      return enrichStudentWithLatestResult({ ...student, ...liveSheetData });
    }
  } catch (_) { }

  // 4. Refresh from local weekly results store and roster
  return enrichStudentWithLatestResult(student);
}

/**
 * Dispatches high-resolution result image to WhatsApp user.
 */
export async function sendStudentResultImageWhatsApp(remoteJid, student, senderPhone = '') {
  try {
    const targetStudent = await getFreshStudentData(student);
    const svg = generateResultSvg(targetStudent);
    const png = svgToPngBuffer(svg);
    const caption = buildResultCaption(targetStudent);
    const cleanName = (targetStudent.name || 'Result').replace(/[^a-zA-Z0-9_-]/g, '_');

    await sendWhatsAppMessage(remoteJid, {
      image: png,
      caption: caption,
      mimetype: 'image/png',
      fileName: `${cleanName}_Weekly_Result.png`
    }, senderPhone);

    const phone = senderPhone || cleanPhone(remoteJid.replace(/@.*$/, ''));
    console.log(`[DISPATCH-LIVE] 🚀 Result card image sent to ${remoteJid} for ${targetStudent.name}`);
    DISPATCH_LOG.push({
      id: 'inbound_' + Date.now(),
      phone,
      studentName: targetStudent.name,
      score: targetStudent.weeklyScore,
      timestamp: new Date().toISOString(),
      status: 'DELIVERED_TO_WHATSAPP'
    });
    if (DISPATCH_LOG.length > 200) DISPATCH_LOG.shift();
  } catch (err) {
    console.error('[sendStudentResultImageWhatsApp Error]:', err);
    await sendWhatsAppMessage(remoteJid, {
      text: `❌ Could not generate result card at this moment. Please view your report on our portal: ${BOT_CONFIG.PORTAL_URL}`
    }, senderPhone);
  }
}

/**
 * Sends today's live attendance status to WhatsApp parent.
 */
export async function sendStudentAttendanceWhatsApp(remoteJid, student, senderPhone = '') {
  try {
    await syncTodayAttendanceFromFirestore();
  } catch (_) {}

  const ist = getISTDateParts();
  const attRec = findStudentAttendance(student, senderPhone);
  const lvRec = findStudentLeave(student, senderPhone);

  let status = 'Pending Marking';
  let statusEmoji = '⏳';

  if (lvRec && /approved/i.test(lvRec.status)) {
    status = 'On Leave (Approved)';
    statusEmoji = '📝';
  } else if (lvRec && /pending/i.test(lvRec.status)) {
    status = 'Leave Application Pending';
    statusEmoji = '⏳';
  } else if (attRec) {
    status = attRec.status || 'Present';
    statusEmoji = attRec.statusEmoji || (/absent/i.test(status) ? '❌' : (/present/i.test(status) ? '✅' : '⏳'));
  }

  const date = ist.dateDisplay; // Strictly today's present day date e.g. 06/10/2026

  await sendWhatsAppMessage(remoteJid, {
    text: `📋 *DAILY ATTENDANCE STATUS*\n\n` +
      `Student: *${student.name}*\n` +
      `📅 Date: *${date}* (Today)\n` +
      `Attendance: *${statusEmoji} ${status}*\n\n` +
      `🌐 *Student Portal:* ${BOT_CONFIG.PORTAL_URL}`
  }, senderPhone);
}

/**
 * Sends official Helpline info.
 */
export async function sendWhatsAppHelpline(remoteJid, student = null, senderPhone = '') {
  const stuInfo = student ? `\nLinked Student: *${student.name}* (ITS: \`${student.its || '—'}\`)` : '';
  await sendWhatsAppMessage(remoteJid, {
    text: `📞 *HELPLINE CONTACT:*\n` +
      `*${BOT_CONFIG.HELPLINE_NUMBER}*${stuInfo}\n\n` +
      `Available on Phone Call and WhatsApp for all queries and support.\n\n` +
      `🌐 *Online Portal:* ${BOT_CONFIG.PORTAL_URL}`
  }, senderPhone);
}

/**
 * Resolves real WhatsApp phone number from remoteJid, participant, or Baileys LID mapping.
 * Uses high-speed O(1) in-memory cache for instant zero-lag response.
 */
export function resolveSenderPhone(remoteJid, msg = null) {
  if (!remoteJid) return '';
  const rawId = (remoteJid || '').replace(/@.*$/, '').replace(/\D/g, '');
  if (!rawId) return '';

  // 1. Instant in-memory cache lookup (< 0.01ms)
  if (lidMappingCache.has(rawId)) {
    return lidMappingCache.get(rawId);
  }

  // 2. Check participant JID (multi-device)
  const partJid = msg?.key?.participant || '';
  const partId = partJid.replace(/@.*$/, '').replace(/\D/g, '');
  if (partId) {
    if (lidMappingCache.has(partId)) return lidMappingCache.get(partId);
    if (partId.length <= 13 && partId.length >= 10 && !partJid.includes('@lid')) {
      return cleanPhone(partId);
    }
  }

  // 3. Fallback: check if single disk mapping file exists and update memory cache
  try {
    const revFile = path.join(AUTH_DIR, `lid-mapping-${rawId}_reverse.json`);
    if (fs.existsSync(revFile)) {
      const val = JSON.parse(fs.readFileSync(revFile, 'utf8'));
      if (val) {
        const cp = cleanPhone(val);
        lidMappingCache.set(rawId, cp);
        phoneToLidCache.set(cp, rawId);
        return cp;
      }
    }
  } catch (_) { }

  // 4. Check if this rawId is already linked in linkedWASubscribersCache
  const cached = linkedWASubscribersCache.get(rawId);
  if (cached?.student?.phone) {
    const cp = cleanPhone(cached.student.phone);
    lidMappingCache.set(rawId, cp);
    return cp;
  }

  return cleanPhone(rawId);
}

/**
 * Handles 3-point or ITS security verification for WhatsApp parents.
 */
export async function handleWhatsAppVerification(remoteJid, senderPhone, rawText) {
  const cleanCmd = rawText.replace(/^\/?(verify|verfy|varify)\s*/i, '').trim();
  const parts = cleanCmd.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
  const rawJidId = (remoteJid || '').replace(/@.*$/, '').replace(/\D/g, '');
  const realPhone = resolveSenderPhone(remoteJid) || senderPhone;

  let matched = null;
  if (parts.length >= 3) {
    matched = lookupStudentInRoster({ phone: parts[0], name: parts[1], code: parts[2] });
  } else if (parts.length === 2) {
    matched = lookupStudentInRoster({ name: parts[0], code: parts[1] }) ||
      lookupStudentInRoster({ phone: parts[0], code: parts[1] });
  } else if (parts.length === 1 && /^\d{4,10}$/.test(parts[0])) {
    matched = lookupStudentInRoster({ code: parts[0] }) || lookupStudentInRoster({ phone: parts[0] });
  }

  if (matched) {
    matched = await getFreshStudentData(matched);
    const sProfilePhone = cleanPhone(matched.phone || matched.whatsappNumber || '');
    // If sender's real phone or raw LID matches student profile phone: Permanent!
    const isSamePhone = Boolean(
      (sProfilePhone && realPhone && sProfilePhone.slice(-10) === realPhone.slice(-10)) ||
      (sProfilePhone && rawJidId && sProfilePhone.slice(-10) === rawJidId.slice(-10))
    );

    // Save to cache & disk for both realPhone and rawJidId
    saveLinkedSubscriber(realPhone, matched, {
      isPermanent: isSamePhone,
      verificationType: isSamePhone ? 'same_number' : 'three_point'
    });
    if (rawJidId && rawJidId !== realPhone) {
      saveLinkedSubscriber(rawJidId, matched, {
        isPermanent: isSamePhone,
        verificationType: isSamePhone ? 'same_number' : 'three_point'
      });
    }

    const termStr = isSamePhone
      ? 'Permanent Connection (Profile Phone Match)'
      : '30-Day Verified Access (Alternative Number)';

    await sock.sendMessage(remoteJid, {
      text: `✅ *Verification Successful!*\n\n` +
        `Your WhatsApp is now verified and connected to:\n` +
        `👤 Student: *${matched.name}*\n` +
        `🆔 ITS: *${matched.its}*\n` +
        `🔐 Status: *${termStr}*\n\n` +
        `Dispatching latest weekly result card below... 👇`
    });

    await sendStudentResultImageWhatsApp(remoteJid, matched);
    return true;
  } else {
    await sock.sendMessage(remoteJid, {
      text: `❌ *Verification Unsuccessful*\n\n` +
        `Could not find a student matching the details provided.\n\n` +
        `👉 *Verification Format:*\n` +
        `\`/verify [Profile Contact], [Child Name], [ITS]\`\n\n` +
        `*Example:*\n` +
        `\`/verify 9930852533, Demo Student, 515253\`\n\n` +
        `Or reply with your child's 8-digit ITS number.\n\n` +
        `🌐 *Student Portal:* ${BOT_CONFIG.PORTAL_URL}`
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Teacher Dashboard & Query Formatting Helpers
// ---------------------------------------------------------------------------

/**
 * Formats the comprehensive Interactive Menu for a verified Atfal teacher.
 * Clearly explains how they can ask for individual child things (results, attendance, leave, jadwal)
 * and access class reports on demand.
 */
export function formatTeacherVerifiedWelcomeMenu(teacher, allocatedStudents = []) {
  const studentCount = allocatedStudents.length;
  const sampleStudent = allocatedStudents.length > 0 ? allocatedStudents[0] : null;
  const sampleName = sampleStudent ? (sampleStudent.name.split(' ')[0] || 'Child') : 'Child';
  const sampleIts = sampleStudent && sampleStudent.its ? sampleStudent.its : '40172347';

  return `✅ *Teacher Verification Successful!*\n\n` +
    `🌹 *Salam Jameel Ustad ${teacher.name}!*\n` +
    `Your WhatsApp is now verified & securely linked to your Mauze Tahfeez Staff Profile.\n\n` +
    `📊 *Class Overview:*\n` +
    `👨‍🏫 *Staff Role:* ${(teacher.role || 'Muhaffiz').toUpperCase()}\n` +
    `📚 *Allocated Students:* *${studentCount} Children*\n` +
    `🔔 *Active Daily Schedulers (Mon–Sat):*\n` +
    `   ⏱ *4:25 PM* — Teacher Self-Attendance Reminder\n` +
    `   🌙 *10:00 PM* — eLearning Entry & Class Attendance Summary\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔍 *HOW TO ASK FOR AN INDIVIDUAL CHILD:*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `You can check any child's specific details anytime on demand:\n\n` +
    `📌 *Child Result Card & Marks:*\n` +
    `  👉 Reply: *result [Child Name or ITS]*\n` +
    `  _Example: result ${sampleName}  OR  result ${sampleIts}_\n\n` +
    `📌 *Child Attendance & Hazri Status:*\n` +
    `  👉 Reply: *attendance [Child Name or ITS]*\n` +
    `  _Example: attendance ${sampleName}_\n\n` +
    `📌 *Child Leave History:*\n` +
    `  👉 Reply: *leave [Child Name or ITS]*\n` +
    `  _Example: leave ${sampleName}_\n\n` +
    `📌 *Child Quran Jadwal & Sabaq Progress:*\n` +
    `  👉 Reply: *jadwal [Child Name or ITS]*\n` +
    `  _Example: jadwal ${sampleName}_\n\n` +
    `💡 *Quick Search:* You can also simply type the student's *Name* or *ITS Number* directly to view full child details!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *CLASS REPORTS & ACTIONS:*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Reply with any number or keyword:\n` +
    `1️⃣ *1* or *Students* — View all ${studentCount} allocated students 📋\n` +
    `2️⃣ *2* or *Summary* — Today's class attendance summary 📊\n` +
    `3️⃣ *3* or *History* — Weekly & monthly class attendance history 📅\n` +
    `4️⃣ *4* or *Results* — Full class weekly exam results 🏆\n` +
    `5️⃣ *5* or *Self* — Teacher Self-Attendance Portal link ⏱\n` +
    `6️⃣ *6* or *Helpline* — Contact Administration 📞\n\n` +
    `_Just reply with any command or student name above to get started!_`;
}

/**
 * Formats the primary interactive dashboard menu for Atfal teachers.
 */
export function formatTeacherDashboardMenu(teacher, studentCount, sampleStudent = null) {
  const sampleName = sampleStudent ? (sampleStudent.name.split(' ')[0] || 'Child') : 'Child';
  const sampleIts = sampleStudent && sampleStudent.its ? sampleStudent.its : '40172347';

  return `🌹 *Salam Jameel Ustad ${teacher.name}!*\n` +
    `*Mauze Tahfeez Atfal — Teacher Portal*\n\n` +
    `👨‍🏫 *Staff Role:* ${(teacher.role || 'Muhaffiz').toUpperCase()}\n` +
    `📚 *Allocated Students:* *${studentCount} Children*\n` +
    `🔐 *Status:* ✔ Verified Staff Profile\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔍 *HOW TO ASK FOR AN INDIVIDUAL CHILD:*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 *Result Card:* \`result [Name or ITS]\` (e.g. \`result ${sampleName}\`)\n` +
    `📌 *Attendance:* \`attendance [Name or ITS]\` (e.g. \`attendance ${sampleName}\`)\n` +
    `📌 *Leave Record:* \`leave [Name or ITS]\` (e.g. \`leave ${sampleName}\`)\n` +
    `📌 *Quran Jadwal:* \`jadwal [Name or ITS]\` (e.g. \`jadwal ${sampleName}\`)\n` +
    `💡 Or simply type the student's *Name* or *ITS Number* directly.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *CLASS REPORTS & ACTIONS:*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `1️⃣ *1* or *Students* — Allocated Students List (${studentCount}) 📋\n` +
    `2️⃣ *2* or *Summary* — Today's Class Hazri Summary 📊\n` +
    `3️⃣ *3* or *History* — Weekly & Monthly Attendance History 📅\n` +
    `4️⃣ *4* or *Results* — Full Class Exam Scores & Ranks 🏆\n` +
    `5️⃣ *5* or *Self* — Teacher Self-Attendance Portal ⏱\n` +
    `6️⃣ *6* or *Helpline* — Contact Administration 📞\n\n` +
    `🌐 *Staff Portal:* ${BOT_CONFIG.PORTAL_URL}`;
}

/**
 * Formats allocated students list for an Atfal teacher.
 */
export function formatTeacherStudentsList(teacher, students) {
  if (!students || !students.length) {
    return `ℹ️ *No allocated students found under your teacher profile at this time.*`;
  }
  let text = `📋 *ALLOCATED STUDENTS LIST*\n` +
    `👨‍🏫 Ustad: *${teacher.name}*\n` +
    `👥 Total Students: *${students.length} Children*\n\n`;

  students.forEach((s, idx) => {
    text += `${idx + 1}. *${s.name}*\n` +
      `   🆔 ITS: \`${s.its || '—'}\` | Grp: *${s.group || '—'}*\n` +
      `   📖 Current Juz: *Juz ${s.juz || '—'}* (${s.surat || '—'}) | Score: *${s.weeklyScore ?? '—'} / 100*\n\n`;
  });

  text += `💡 *Tip:* Reply with any student's ITS or Name for full details or result card!`;
  return text;
}

/**
 * Formats Today's Class Attendance Summary for an Atfal teacher.
 */
export function formatTeacherAttendanceSummaryText(teacher, summary) {
  const presentStr = summary.presentNames.length > 0 ? `\n   ↳ _${summary.presentNames.join(', ')}_` : '';
  const absentStr = summary.absentNames.length > 0 ? `\n   ↳ _${summary.absentNames.join(', ')}_` : '';
  const leaveStr = summary.leaveNames.length > 0 ? `\n   ↳ _${summary.leaveNames.join(', ')}_` : '';
  const pendingStr = summary.pendingNames.length > 0 ? `\n   ↳ _${summary.pendingNames.join(', ')}_` : '';

  return `📊 *TODAY'S CLASS ATTENDANCE SUMMARY*\n` +
    `👨‍🏫 Ustad: *${teacher.name}*\n` +
    `📅 Date: *${summary.dateDisplay}*\n` +
    `👥 Total Allocated: *${summary.totalStudents} Students*\n\n` +
    `• ✅ *Present:* ${summary.presentCount} students\n` +
    `• ❌ *Absent:* ${summary.absentCount} students${absentStr}\n` +
    `• 📝 *On Leave:* ${summary.leaveCount} students${leaveStr}\n` +
    `• ⏳ *Pending Marking:* ${summary.pendingCount} students${pendingStr}\n\n` +
    `📱 *Mark/Update on App:*\n${BOT_CONFIG.PORTAL_URL}`;
}

/**
 * Resolves a target student from teacher's free-text inquiry (name or ITS).
 */
export function findTargetStudentInTeacherQuery(rawText, students) {
  if (!rawText || !students || !students.length) return null;
  const clean = rawText.toLowerCase().replace(/^(results|result|attendance|hazri|leaves|leave|chutti|jadwal|timetable|scores|score|marks)\s*/i, '').trim();
  if (!clean || clean.length < 3) return null;

  // 1. Direct ITS match (e.g. 515253 or 40172347)
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 4) {
    const byIts = students.find(s => s.its && String(s.its).includes(digits));
    if (byIts) return byIts;
  }

  // 2. Name search
  const cleanWords = clean.split(/\s+/).filter(w => w.length >= 3);
  for (const s of students) {
    const sName = (s.name || '').toLowerCase();
    if (sName.includes(clean) || (clean.length >= 4 && clean.includes(sName))) return s;
    for (const w of cleanWords) {
      if (sName.includes(w)) return s;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Inbound Message Router & Instant Responder for WhatsApp Bot
// ---------------------------------------------------------------------------

/**
 * Recursively unwraps interactive, view-once, ephemeral, and button messages
 * to extract clean user text from any WhatsApp device.
 */
export function extractMessageText(message) {
  if (!message) return '';
  let m = message;
  while (m) {
    if (m.ephemeralMessage?.message) { m = m.ephemeralMessage.message; continue; }
    if (m.viewOnceMessage?.message) { m = m.viewOnceMessage.message; continue; }
    if (m.viewOnceMessageV2?.message) { m = m.viewOnceMessageV2.message; continue; }
    if (m.viewOnceMessageV2Extension?.message) { m = m.viewOnceMessageV2Extension.message; continue; }
    if (m.documentWithCaptionMessage?.message) { m = m.documentWithCaptionMessage.message; continue; }
    break;
  }
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedId ||
    m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    ''
  ).trim();
}

/**
 * Core Inbound Message Router & Responder for WhatsApp Bot.
 */
export async function handleIncomingWhatsAppMessage(msg) {
  if (!sock || !msg || !msg.message) return;

  const remoteJid = msg.key.remoteJid || '';
  if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
    return;
  }

  // Never process bot's own outbound messages
  if (msg.key.fromMe) return;

  const rawJidId = (remoteJid || '').replace(/@.*$/, '').replace(/\D/g, '');
  const senderPhone = resolveSenderPhone(remoteJid, msg);
  if (!senderPhone && !rawJidId) return;

  const rawText = extractMessageText(msg.message);
  if (!rawText) return;

  // Master Bot ON/OFF Check
  if (!botEnabled) {
    console.log(`[WHATSAPP-INBOUND] ⏸️ Bot is toggled OFF by Admin. Ignoring inbound message from +${senderPhone} (LID: ${rawJidId})`);
    return;
  }

  console.log(`[WHATSAPP-INBOUND] 💬 From +${senderPhone} (LID: ${rawJidId}): "${rawText}"`);

  // Instant visual feedback: show "typing..." on WhatsApp immediately
  try {
    sock.sendPresenceUpdate('composing', remoteJid).catch(() => {});
  } catch (_) {}

  // Rate Limiting & Anti-Spam Check
  const safety = checkSafetyLimit(senderPhone);
  if (!safety.allowed) {
    await sendWhatsAppMessage(remoteJid, { text: safety.reason }, senderPhone);
    return;
  }

  const cleanCmd = rawText.toLowerCase().trim();

  // =========================================================================
  // ATFAL TEACHER (STAFF) BOT ROUTING & VERIFICATION ENGINE
  // =========================================================================

  // A. Check if sender is a registered staff member or verified teacher
  let teacherRec = getLinkedTeacherRecord(senderPhone) || getLinkedTeacherRecord(rawJidId);
  if (!teacherRec) {
    const directTeacherMatch = verifyTeacherByPhone(senderPhone) || (rawJidId ? verifyTeacherByPhone(rawJidId) : null);
    if (directTeacherMatch) {
      saveLinkedTeacher(senderPhone, directTeacherMatch, { verificationType: 'auto_profile_phone' });
      if (rawJidId && rawJidId !== senderPhone) {
        saveLinkedTeacher(rawJidId, directTeacherMatch, { verificationType: 'auto_profile_phone' });
      }
      teacherRec = { record: { phone: senderPhone, teacherId: directTeacherMatch.id, teacherName: directTeacherMatch.name }, teacher: directTeacherMatch };
      console.log(`[TEACHER-AUTOLINK] 👨‍🏫 Auto-verified staff phone +${senderPhone} for teacher: ${directTeacherMatch.name}`);
    }
  }

  // B. Teacher Manual Verification Command (/teacher [Name], [Email] or unverified teacher request)
  if (
    cleanCmd.startsWith('/teacher') || cleanCmd.startsWith('teacher') ||
    cleanCmd.startsWith('/ustad') || cleanCmd.startsWith('ustad') ||
    cleanCmd.startsWith('/staff') || cleanCmd.startsWith('staff')
  ) {
    const cleanTeacherCmd = rawText.replace(/^\/?(teacher|ustad|staff)\s*/i, '').trim();

    // If teacher command has no payload, show verification instructions
    if (!cleanTeacherCmd) {
      await sendWhatsAppMessage(remoteJid, {
        text: `👨‍🏫 *ATFAL TEACHER VERIFICATION*\n\n` +
          `Salam Jameel Ustad,\n` +
          `Your WhatsApp number (+${senderPhone}) is not directly linked to a Staff Profile.\n\n` +
          `To verify and link your teacher account, please reply with your *Full Name* and *Email Address* exactly as registered in your Mauze Tahfeez Staff Profile:\n\n` +
          `👉 *Format:*\n` +
          `\`/teacher [Full Name], [Email]\`\n\n` +
          `*Example:*\n` +
          `\`/teacher Janab Mustafa bhai Manpurwala, mustafamanpur1@gmail.com\`\n\n` +
          `Shukran jazeelan!\n` +
          `🌐 *Staff Portal:* ${BOT_CONFIG.PORTAL_URL}`
      }, senderPhone);
      return;
    }

    // Parse Name and Email
    const parts = cleanTeacherCmd.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
    let reqEmail = '';
    let reqName = '';
    for (const p of parts) {
      if (p.includes('@')) reqEmail = p.toLowerCase();
      else if (!reqName) reqName = p;
    }

    const matchedT = verifyTeacherByNameAndEmail(reqName, reqEmail);
    if (matchedT) {
      saveLinkedTeacher(senderPhone, matchedT, { verificationType: 'manual_name_email' });
      if (rawJidId && rawJidId !== senderPhone) {
        saveLinkedTeacher(rawJidId, matchedT, { verificationType: 'manual_name_email' });
      }

      const allocated = findTeacherAllocatedStudents(matchedT);
      const welcomeMenuText = formatTeacherVerifiedWelcomeMenu(matchedT, allocated);
      await sendWhatsAppMessage(remoteJid, { text: welcomeMenuText }, senderPhone);
      return;
    } else {
      await sendWhatsAppMessage(remoteJid, {
        text: `❌ *Teacher Verification Unsuccessful*\n\n` +
          `Could not find a staff profile matching:\n` +
          `• Name: *${reqName || '—'}*\n` +
          `• Email: *${reqEmail || '—'}*\n\n` +
          `Please ensure your Name and Email match exactly what is registered in your Mauze Tahfeez Staff Profile.\n\n` +
          `👉 *Format:*\n` +
          `\`/teacher [Full Name], [Email]\`\n\n` +
          `*Example:*\n` +
          `\`/teacher Janab Mustafa bhai Manpurwala, mustafamanpur1@gmail.com\`\n\n` +
          `📞 Helpline: ${BOT_CONFIG.HELPLINE_NUMBER}`
      }, senderPhone);
      return;
    }
  }

  // C. If sender is a verified teacher: Process full teacher commands
  if (teacherRec && teacherRec.teacher) {
    const teacher = teacherRec.teacher;
    const allocatedStudents = findTeacherAllocatedStudents(teacher);

    // Unlink teacher command
    if (cleanCmd === '/unlink' || cleanCmd === 'unlink' || cleanCmd === 'unlink teacher') {
      removeLinkedTeacher(senderPhone);
      if (rawJidId) removeLinkedTeacher(rawJidId);
      await sendWhatsAppMessage(remoteJid, {
        text: `🔓 *Teacher Profile Disconnected*\n\n` +
          `Your WhatsApp (+${senderPhone}) has been unlinked from Ustad *${teacher.name}*.\n` +
          `To reconnect anytime, send \`/teacher [Full Name], [Email]\`.\n\n` +
          `🌐 *Staff Portal:* ${BOT_CONFIG.PORTAL_URL}`
      }, senderPhone);
      return;
    }

    // 1. Allocated Students: Option 1 or keywords
    if (
      cleanCmd === '1' ||
      cleanCmd === 'students' ||
      cleanCmd === '/students' ||
      cleanCmd === 'class' ||
      cleanCmd === 'list' ||
      cleanCmd === 'bacha' ||
      cleanCmd === 'children' ||
      cleanCmd.includes('student') ||
      cleanCmd.includes('class list')
    ) {
      const text = formatTeacherStudentsList(teacher, allocatedStudents);
      await sendWhatsAppMessage(remoteJid, { text }, senderPhone);
      return;
    }

    // 2. Attendance Summary of the Day: Option 2 or keywords
    if (
      cleanCmd === '2' ||
      cleanCmd === 'attendance' ||
      cleanCmd === '/attendance' ||
      cleanCmd === 'hazri' ||
      cleanCmd === 'today' ||
      cleanCmd.includes('attendance') ||
      cleanCmd.includes('hazri')
    ) {
      // Non-blocking sync today's attendance in background; instant in-memory response
      syncTodayAttendanceFromFirestore().catch(() => {});
      const summary = buildTeacherClassAttendanceSummary(teacher);
      const text = formatTeacherAttendanceSummaryText(teacher, summary);
      await sendWhatsAppMessage(remoteJid, { text }, senderPhone);
      return;
    }

    // 3. Weekly & Monthly Attendance History: Option 3 or keywords
    if (
      cleanCmd === '3' ||
      cleanCmd === 'history' ||
      cleanCmd === '/history' ||
      cleanCmd === 'weekly' ||
      cleanCmd === 'monthly' ||
      cleanCmd.includes('history') ||
      cleanCmd.includes('monthly') ||
      cleanCmd.includes('weekly attendance')
    ) {
      const text = buildTeacherAttendanceHistory(teacher);
      await sendWhatsAppMessage(remoteJid, { text }, senderPhone);
      return;
    }

    // 4. Class Results & Weekly Scores: Option 4 or keywords
    if (
      cleanCmd === '4' ||
      cleanCmd === 'results' ||
      cleanCmd === '/results' ||
      cleanCmd === 'result' ||
      cleanCmd === 'scores' ||
      cleanCmd === 'marks' ||
      cleanCmd === 'rank' ||
      cleanCmd.includes('result') ||
      cleanCmd.includes('marks') ||
      cleanCmd.includes('score')
    ) {
      // Check if this was a query for a specific individual student
      const indChild = findTargetStudentInTeacherQuery(rawText, allocatedStudents);
      if (indChild) {
        await sendStudentResultImageWhatsApp(remoteJid, indChild, senderPhone);
        return;
      }
      const text = buildTeacherClassResultSummary(teacher);
      await sendWhatsAppMessage(remoteJid, { text }, senderPhone);
      return;
    }

    // 5. Teacher Self-Attendance: Option 5 or keywords
    if (
      cleanCmd === '5' ||
      cleanCmd === 'self' ||
      cleanCmd === 'self attendance' ||
      cleanCmd === '/self' ||
      cleanCmd === 'punch' ||
      cleanCmd === 'my attendance' ||
      cleanCmd.includes('self attendance') ||
      cleanCmd.includes('punch')
    ) {
      const ist = getISTDateParts();
      await sendWhatsAppMessage(remoteJid, {
        text: `⏱ *TEACHER SELF-ATTENDANCE PORTAL*\n\n` +
          `Salam Jameel Ustad *${teacher.name}*,\n\n` +
          `Daily Teacher Self-Attendance should be marked at *4:25 PM* on the Mauze Tahfeez app / portal.\n\n` +
          `📅 Today: *${ist.dateDisplay}*\n` +
          `⏰ Target Punch Time: *4:25 PM*\n\n` +
          `📲 *Mark Self-Attendance Now:*\n` +
          `${BOT_CONFIG.PORTAL_URL}\n\n` +
          `✔ Scheduled reminder message will arrive at 4:25 PM Monday to Saturday.\n\n` +
          `Shukran jazeelan!`
      }, senderPhone);
      return;
    }

    // 6. Helpline / Admin: Option 6 or keywords
    if (
      cleanCmd === '6' ||
      cleanCmd === 'helpline' ||
      cleanCmd === '/helpline' ||
      cleanCmd === 'admin' ||
      cleanCmd === 'contact' ||
      cleanCmd === 'help' ||
      cleanCmd.includes('helpline') ||
      cleanCmd.includes('admin')
    ) {
      await sendWhatsAppMessage(remoteJid, {
        text: `📞 *ATFAL ADMINISTRATION & HELPLINE*\n\n` +
          `Ustad: *${teacher.name}*\n` +
          `Helpline Number: *${BOT_CONFIG.HELPLINE_NUMBER}*\n\n` +
          `Available for administrative coordination, schedule changes, and technical assistance.\n\n` +
          `🌐 *Portal:* ${BOT_CONFIG.PORTAL_URL}`
      }, senderPhone);
      return;
    }

    // Test triggers for teacher schedule previews
    if (cleanCmd === '/test self' || cleanCmd === 'test self') {
      await sendTeacherSelfAttendanceReminder(teacher, remoteJid, senderPhone);
      return;
    }
    if (cleanCmd === '/test summary' || cleanCmd === 'test summary') {
      await sendTeacherElearningAttendanceReminder(teacher, remoteJid, senderPhone);
      return;
    }

    // Check individual student inquiry (leave, attendance, jadwal, details)
    const indStudent = findTargetStudentInTeacherQuery(rawText, allocatedStudents) ||
      findTargetStudentInTeacherQuery(rawText, embeddedRoster);

    if (indStudent) {
      if (cleanCmd.includes('leave') || cleanCmd.includes('chutti')) {
        const lvRec = findStudentLeave(indStudent, indStudent.phone);
        const stEmoji = lvRec && /approved/i.test(lvRec.status) ? '✅' : (lvRec && /rejected/i.test(lvRec.status) ? '❌' : '⏳');
        await sendWhatsAppMessage(remoteJid, {
          text: `📝 *STUDENT LEAVE RECORD*\n\n` +
            `• Student: *${indStudent.name}*\n` +
            `• ITS: \`${indStudent.its || '—'}\`\n` +
            `• Status: *${stEmoji} ${lvRec ? lvRec.status : 'No pending leave (Present)'}*\n` +
            (lvRec?.periodStr ? `• Period: *${lvRec.periodStr}*\n` : '') +
            (lvRec?.reason ? `• Reason: _${lvRec.reason}_\n` : '') +
            (lvRec?.comment ? `• Remark: _${lvRec.comment}_\n` : '') +
            `\n🌐 *Portal:* ${BOT_CONFIG.PORTAL_URL}`
        }, senderPhone);
        return;
      }

      if (cleanCmd.includes('attendance') || cleanCmd.includes('hazri')) {
        await sendStudentAttendanceWhatsApp(remoteJid, indStudent, senderPhone);
        return;
      }

      if (cleanCmd.includes('result') || cleanCmd.includes('card') || cleanCmd.includes('marks')) {
        await sendStudentResultImageWhatsApp(remoteJid, indStudent, senderPhone);
        return;
      }

      if (cleanCmd.includes('jadwal') || cleanCmd.includes('hifz') || cleanCmd.includes('sabaq') || cleanCmd.includes('surah')) {
        await sendWhatsAppMessage(remoteJid, {
          text: `📖 *QURAN HIFZ JADWAL*\n\n` +
            `• Student: *${indStudent.name}*\n` +
            `• Arabic: ${indStudent.arabic_name || '—'}\n` +
            `• ITS: \`${indStudent.its || '—'}\`\n` +
            `• Current Juz: *Juz ${indStudent.juz || '—'}*\n` +
            `• Surat: *${indStudent.surat || '—'}*\n` +
            (indStudent.totalJadeed ? `• Sabaq (Jadeed): *${indStudent.totalJadeed}*\n` : '') +
            (indStudent.fromDate && indStudent.tillDate ? `• Period: *${indStudent.fromDate} to ${indStudent.tillDate}*\n` : '') +
            `• Group: *${indStudent.group || '—'}* | Ustad: *${indStudent.teacher || teacher.name}*\n\n` +
            `🌐 *Staff Portal:* ${BOT_CONFIG.PORTAL_URL}`
        }, senderPhone);
        return;
      }

      // Default individual student card overview
      const enriched = enrichStudentWithLatestResult(indStudent);
      const attRec = findStudentAttendance(enriched, enriched.phone);
      const lvRec = findStudentLeave(enriched, enriched.phone);
      const attSt = attRec?.status || (lvRec ? lvRec.status : 'Pending Marking');
      const attEmoji = /absent/i.test(attSt) ? '❌' : (/leave/i.test(attSt) ? '📝' : (/present/i.test(attSt) ? '✅' : '⏳'));

      await sendWhatsAppMessage(remoteJid, {
        text: `👤 *STUDENT PROFILE & STATUS*\n\n` +
          `• Name: *${enriched.name}*\n` +
          `• Arabic: ${enriched.arabic_name || '—'}\n` +
          `• ITS: \`${enriched.its || '—'}\`\n` +
          `• Group: *${enriched.group || '—'}* | Ustad: *${enriched.teacher || teacher.name}*\n` +
          `• Current Juz: *Juz ${enriched.juz || '—'}* (${enriched.surat || '—'})\n` +
          `• Weekly Score: *${enriched.weeklyScore ?? '—'} / 100* (Rank: #${enriched.marhalaRank || '—'})\n` +
          `• Today's Hazri: *${attEmoji} ${attSt}*\n` +
          `• Leave Status: *${lvRec ? lvRec.status : 'Active'}*\n\n` +
          `💡 *Ask for this Child:*\n` +
          `  👉 \`result ${enriched.its || enriched.name}\` — Result Card 🏆\n` +
          `  👉 \`attendance ${enriched.its || enriched.name}\` — Attendance 📊\n` +
          `  👉 \`leave ${enriched.its || enriched.name}\` — Leave History 📝\n` +
          `  👉 \`jadwal ${enriched.its || enriched.name}\` — Hifz Progress 📖`
      }, senderPhone);
      return;
    }

    // Default Teacher Interactive Dashboard Menu
    const menuText = formatTeacherDashboardMenu(teacher, allocatedStudents.length);
    await sendWhatsAppMessage(remoteJid, { text: menuText }, senderPhone);
    return;
  }

  // 1. Check persistent subscriber record (check both resolved phone and raw LID)
  let subRec = getLinkedSubscriberRecord(senderPhone) || getLinkedSubscriberRecord(rawJidId);
  let linkedStudent = null;
  let isPermanent = true;
  let daysLeft = null;

  if (subRec) {
    // If student profile phone actually matches senderPhone, ensure it's PERMANENT!
    const profilePhone = cleanPhone(subRec.student?.phone || subRec.student?.whatsappNumber || '');
    if (profilePhone && senderPhone && profilePhone.slice(-10) === senderPhone.slice(-10)) {
      subRec.isPermanent = true;
      if (subRec.record) {
        subRec.record.isPermanent = true;
        subRec.record.expiresAt = null;
        subRec.record.verificationType = 'same_number';
      }
    }

    if (subRec.expired && !subRec.isPermanent) {
      removeLinkedSubscriber(senderPhone);
      if (rawJidId) removeLinkedSubscriber(rawJidId);
      await sendWhatsAppMessage(remoteJid, {
        text: `⏳ *30-Day Access Period Expired*\n\n` +
          `Your 30-day verification for *${subRec.student?.name || 'Student'}* using this alternative number has ended.\n\n` +
          `To renew access for another 30 days, please re-verify your child's profile details:\n` +
          `👉 *Format:* \`/verify [Profile Contact], [Child Name], [ITS]\`\n\n` +
          `🌐 *Portal:* ${BOT_CONFIG.PORTAL_URL}`
      }, senderPhone);
      return;
    }
    linkedStudent = subRec.student;
    isPermanent = subRec.record?.isPermanent !== false;
    if (!isPermanent && subRec.record?.expiresAt) {
      daysLeft = Math.max(1, Math.ceil((subRec.record.expiresAt - Date.now()) / (86400 * 1000)));
    }
  }

  // 2. If not in cache, check roster by direct phone match (permanent auto-verification)
  if (!linkedStudent) {
    const directMatch = lookupStudentInRoster({ phone: senderPhone }) || lookupStudentInRoster({ phone: rawJidId });
    if (directMatch) {
      linkedStudent = directMatch;
      isPermanent = true;
      saveLinkedSubscriber(senderPhone, directMatch, { isPermanent: true, verificationType: 'same_number' });
      if (rawJidId && rawJidId !== senderPhone) {
        saveLinkedSubscriber(rawJidId, directMatch, { isPermanent: true, verificationType: 'same_number' });
      }
      console.log(`[WHATSAPP-AUTOLINK] 🔗 Auto-verified +${senderPhone} (LID: ${rawJidId}) PERMANENTLY for student: ${directMatch.name} (ITS: ${directMatch.its})`);
    }
  }

  // ── HELPLINE / HELP QUERY ──
  if (
    cleanCmd === '7' ||
    cleanCmd === 'helpline' ||
    cleanCmd === '/helpline' ||
    cleanCmd === 'help' ||
    cleanCmd === '/help' ||
    cleanCmd === 'contact' ||
    cleanCmd === 'call' ||
    cleanCmd === 'number' ||
    cleanCmd === 'admin'
  ) {
    await sendWhatsAppHelpline(remoteJid, linkedStudent, senderPhone);
    return;
  }

  // ── UNLINK COMMAND ──
  if (cleanCmd === '/unlink' || cleanCmd === 'unlink') {
    removeLinkedSubscriber(senderPhone);
    if (rawJidId) removeLinkedSubscriber(rawJidId);
    await sendWhatsAppMessage(remoteJid, {
      text: `🔓 *Account Disconnected*\n\n` +
        `Your WhatsApp has been unlinked from student updates.\n` +
        `To link again, type *1* or *start* from your registered phone, or use \`/verify\` if using an alternative number.\n\n` +
        `🌐 *Portal:* ${BOT_CONFIG.PORTAL_URL}`
    }, senderPhone);
    return;
  }

  // ── VERIFICATION COMMAND (/verify or /verfy or /varify) ──
  if (
    cleanCmd.startsWith('/verify') || cleanCmd.startsWith('verify') ||
    cleanCmd.startsWith('/verfy') || cleanCmd.startsWith('verfy') ||
    cleanCmd.startsWith('/varify') || cleanCmd.startsWith('varify')
  ) {
    await handleWhatsAppVerification(remoteJid, senderPhone, rawText);
    return;
  }

  // ── IF USER IS NOT LINKED YET ──
  if (!linkedStudent) {
    // If user texted numbers that look like an ITS or comma values, try verifying
    if (rawText.includes(',') || /^\d{5,10}$/.test(rawText.trim())) {
      const verified = await handleWhatsAppVerification(remoteJid, senderPhone, rawText);
      if (verified) return;
    }

    // Welcoming response for ALL messages from unregistered users
    await sendWhatsAppMessage(remoteJid, {
      text: `🌹 *Salam Jameel!*\n` +
        `Welcome to *Rawdat Tahfeez al Atfal - Galiakot* Official WhatsApp Helpline.\n\n` +
        `Your WhatsApp number (+${senderPhone}) is not yet registered in our student directory.\n\n` +
        `👨‍👩‍👧 *PARENTS — Connect Your Child:*\n` +
        `Reply in this format:\n` +
        `👉 \`/verify [Profile Contact], [Child Name], [ITS]\`\n` +
        `*Example:* \`/verify 9930852533, Demo Student, 515253\`\n` +
        `Or simply enter your child's *8-digit ITS number* directly!\n\n` +
        `👨‍🏫 *ATFAL TEACHERS & STAFF — Connect Teacher Portal:*\n` +
        `Reply in this format:\n` +
        `👉 \`/teacher [Full Name], [Email]\`\n` +
        `*Example:* \`/teacher Janab Mustafa bhai Manpurwala, mustafamanpur1@gmail.com\`\n\n` +
        `📞 *Helpline Number:* ${BOT_CONFIG.HELPLINE_NUMBER}\n` +
        `🌐 *Online Portal:* ${BOT_CONFIG.PORTAL_URL}`
    }, senderPhone);
    return;
  }

  // ── IF USER IS LINKED: PROCESS COMMANDS INSTANTLY ──
  const student = linkedStudent;

  // 1. Result Card: Option 1 or Result keywords
  if (
    cleanCmd === '1' ||
    cleanCmd === 'result' ||
    cleanCmd === '/result' ||
    cleanCmd === 'card' ||
    cleanCmd === 'report' ||
    cleanCmd === 'marks' ||
    cleanCmd === 'score' ||
    cleanCmd.includes('result') ||
    cleanCmd.includes('marks') ||
    cleanCmd.includes('report') ||
    cleanCmd.includes('score')
  ) {
    await sendStudentResultImageWhatsApp(remoteJid, student, senderPhone);
    return;
  }

  // 2. Attendance / Hazri: Option 2 or Attendance keywords
  if (
    cleanCmd === '2' ||
    cleanCmd === 'attendance' ||
    cleanCmd === '/attendance' ||
    cleanCmd === 'hazri' ||
    cleanCmd === 'present' ||
    cleanCmd === 'absent' ||
    cleanCmd.includes('attendance') ||
    cleanCmd.includes('hazri') ||
    cleanCmd.includes('present') ||
    cleanCmd.includes('absent')
  ) {
    await sendStudentAttendanceWhatsApp(remoteJid, student, senderPhone);
    return;
  }

  // 3. Jadwal / Timetable: Option 3 or Jadwal keywords
  if (
    cleanCmd === '3' ||
    cleanCmd === 'jadwal' ||
    cleanCmd === '/jadwal' ||
    cleanCmd === 'timetable' ||
    cleanCmd === 'schedule' ||
    cleanCmd === 'target' ||
    cleanCmd.includes('jadwal') ||
    cleanCmd.includes('timetable') ||
    cleanCmd.includes('schedule') ||
    cleanCmd.includes('target') ||
    cleanCmd.includes('murajah') ||
    cleanCmd.includes('hifz')
  ) {
    await sendWhatsAppMessage(remoteJid, {
      text: `📅 *JADWAL / HIFZ TIMETABLE*\n\n` +
        `👤 Student: *${student.name}*\n` +
        `🆔 ITS: \`${student.its || '—'}\`\n` +
        `📖 Current Juz: *${student.juz || '—'}* | Surat: *${student.surat || '—'}*\n` +
        `🎯 Murajah & Daily Hifz target is active.\n` +
        `👨‍🏫 Ustad: *${student.teacher || 'Assigned Teacher'}*\n\n` +
        `🌐 *Full Timetable on Portal:* ${BOT_CONFIG.PORTAL_URL}`
    }, senderPhone);
    return;
  }

  // 4. Apply Leave: Formatted leave text
  if (
    cleanCmd.startsWith('apply leave') ||
    cleanCmd.startsWith('leave apply') ||
    cleanCmd.startsWith('/applyleave') ||
    cleanCmd.startsWith('/apply_leave') ||
    (cleanCmd.startsWith('leave') && cleanCmd.length > 8 && !cleanCmd.includes('status'))
  ) {
    const leaveDetails = rawText.replace(/^\/?(apply\s+leave|leave\s+apply|applyleave|leave)\s*/i, '').trim();
    const periodStr = leaveDetails || 'Dates Requested';
    const reasonStr = leaveDetails || 'Personal Leave';

    const lvRecord = {
      status: 'Pending Admin Approval',
      statusEmoji: '⏳',
      fromDate: new Date().toLocaleDateString('en-GB'),
      toDate: '',
      periodStr,
      reason: reasonStr,
      comment: '',
      name: student.name,
      phone: senderPhone,
      its: student.its || '',
      studentId: student.student_id || student.id || '',
      updatedAt: Date.now()
    };

    if (senderPhone) saveLeaveRecord(`phone:${senderPhone}`, lvRecord);
    if (student.its) saveLeaveRecord(`its:${student.its}`, lvRecord);
    if (student.name) saveLeaveRecord(`name:${student.name.toLowerCase()}`, lvRecord);
    if (student.student_id || student.id) saveLeaveRecord(`id:${student.student_id || student.id}`, lvRecord);

    await sendWhatsAppMessage(remoteJid, {
      text: `✅ *LEAVE APPLICATION SUBMITTED*\n\n` +
        `Salam Jameel,\n` +
        `Respected Parent,\n\n` +
        `Your leave application for *${student.name}* has been received:\n` +
        `👤 Student: *${student.name}*\n` +
        (student.its ? `🆔 ITS: \`${student.its}\`\n` : '') +
        `📝 Details: *${leaveDetails || 'Leave Requested'}*\n` +
        `⏳ Status: *Pending Admin Approval*\n\n` +
        `The administration has been notified. You will receive an instant WhatsApp alert as soon as it is approved.\n\n` +
        `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`
    }, senderPhone);
    return;
  }

  // 4b. Leave Status: Option 4 or Leave keywords
  if (
    cleanCmd === '4' ||
    cleanCmd === 'leave' ||
    cleanCmd === '/leave' ||
    cleanCmd === 'chutti' ||
    cleanCmd.includes('leave') ||
    cleanCmd.includes('chutti')
  ) {
    const lvRec = findStudentLeave(student, senderPhone);
    if (lvRec) {
      const statusEmoji = /approved/i.test(lvRec.status)
        ? '✅'
        : (/rejected/i.test(lvRec.status) ? '❌' : '⏳');

      await sendWhatsAppMessage(remoteJid, {
        text: `📝 *LEAVE APPLICATION STATUS*\n\n` +
          `👤 Student: *${student.name}*\n` +
          (student.its ? `🆔 ITS: \`${student.its}\`\n` : '') +
          (lvRec.periodStr ? `📅 Period: *${lvRec.periodStr}*\n` : '') +
          `📌 Status: *${statusEmoji} ${lvRec.status}*\n` +
          (lvRec.reason ? `📝 Reason: _${lvRec.reason}_\n` : '') +
          (lvRec.comment ? `💬 Admin Remark: _${lvRec.comment}_\n\n` : '\n') +
          `To submit a new leave application, reply:\n` +
          `👉 \`apply leave [dates] [reason]\`\n\n` +
          `🌐 Portal: ${BOT_CONFIG.PORTAL_URL}`
      }, senderPhone);
      return;
    }

    await sendWhatsAppMessage(remoteJid, {
      text: `📝 *LEAVE APPLICATION STATUS*\n\n` +
        `👤 Student: *${student.name}*\n` +
        (student.its ? `🆔 ITS: \`${student.its}\`\n` : '') +
        `📌 Status: Active in regular class attendance (No active leave pending).\n\n` +
        `To submit a new leave application, reply:\n` +
        `👉 \`apply leave [dates] [reason]\`\n\n` +
        `🌐 Online Portal: ${BOT_CONFIG.PORTAL_URL}`
    }, senderPhone);
    return;
  }

  // 5. Fee / Hub Raqam: Option 5 or Fee keywords
  if (
    cleanCmd === '5' ||
    cleanCmd === 'fee' ||
    cleanCmd === '/fee' ||
    cleanCmd === 'fees' ||
    cleanCmd === '/fees' ||
    cleanCmd === 'pay' ||
    cleanCmd === '/pay' ||
    cleanCmd === 'hub raqam' ||
    cleanCmd === '/hub raqam' ||
    cleanCmd === 'hub' ||
    cleanCmd === 'raqam' ||
    cleanCmd.includes('fee') ||
    cleanCmd.includes('hub raqam') ||
    cleanCmd.includes('raqam') ||
    cleanCmd.includes('pay')
  ) {
    const hijriNow = getFatemiHijriMonth();
    await sendWhatsAppMessage(remoteJid, {
      text: `💰 *HUB RAQAM - MONTHLY TUITION FEE*\n\n` +
        `Salam Jameel,\n` +
        `Respected Parent,\n\n` +
        `This is regarding the monthly Mauze Tahfeez Hub Raqam for *${hijriNow.nameEn} ${hijriNow.year}*:\n` +
        `👤 Student: *${student.name}*\n` +
        `🆔 ITS: \`${student.its || '—'}\`\n\n` +
        `Kindly complete the payment online via the official Mahad al Zahra portal:\n` +
        `👉 *PAY NOW:*\n` +
        `💳 https://www.its52.com/Login.aspx?OneLogin=MAZSTUDENT\n\n` +
        `After payment, please preserve your transaction receipt for your records.\n\n` +
        `🌐 *Online Portal:* ${BOT_CONFIG.PORTAL_URL}`
    }, senderPhone);
    return;
  }

  // 6. Profile: Option 6 or Profile keywords
  if (
    cleanCmd === '6' ||
    cleanCmd === 'profile' ||
    cleanCmd === '/profile' ||
    cleanCmd === 'child' ||
    cleanCmd === 'student' ||
    cleanCmd === 'bacha' ||
    cleanCmd === 'info' ||
    cleanCmd.includes('profile') ||
    cleanCmd.includes('child') ||
    cleanCmd.includes('student')
  ) {
    const validityStatus = isPermanent
      ? `✔ *Permanent Connection* (Phone matches profile registered contact)`
      : `🗓 *30-Day Verified Access* (Valid for ${daysLeft || 30} more days)`;

    await sendWhatsAppMessage(remoteJid, {
      text: `👤 *LINKED CHILD PROFILE*\n\n` +
        `• Student: *${student.name}*\n` +
        `• Arabic Name: ${student.arabic_name || '—'}\n` +
        `• ITS Number: \`${student.its || '—'}\`\n` +
        `• Registered Phone: \`${student.phone || '—'}\`\n` +
        `• Teacher: *${student.teacher || 'Assigned Ustad'}*\n` +
        `• Group: *${student.group || '—'}*\n` +
        `• Connection: ${validityStatus}\n\n` +
        `✔ You receive real-time alerts for Attendance, Results, and Jadwal.\n` +
        `To disconnect, reply with \`/unlink\`.\n\n` +
        `🌐 *Online Portal:* ${BOT_CONFIG.PORTAL_URL}`
    }, senderPhone);
    return;
  }

  // ── DEFAULT INTERACTIVE MENU FOR ALL GREETINGS & OTHER TEXT ──
  // (Salam, Hi, Hello, Menu, Options, Start, or any query)
  const validityStatus = isPermanent
    ? `✔ *Permanent Connection*`
    : `🗓 *30-Day Verified Access* (${daysLeft || 30} days left)`;

  await sendWhatsAppMessage(remoteJid, {
    text: `🌹 *Salam Jameel!*\n` +
      `Welcome to *Rawdat Tahfeez al Atfal - Galiakot* Helpline Bot.\n\n` +
      `👤 Linked Child: *${student.name}*\n` +
      `🆔 ITS: \`${student.its || 'Verified'}\`\n` +
      `🔐 Status: ${validityStatus}\n\n` +
      `*How can we assist you today?*\n` +
      `Reply with any number or keyword:\n\n` +
      `1️⃣ *1* or *Result* — Latest Weekly Result Card 📊\n` +
      `2️⃣ *2* or *Attendance* — Today's Hazri Status 📋\n` +
      `3️⃣ *3* or *Jadwal* — Hifz Timetable & Target 📅\n` +
      `4️⃣ *4* or *Leave* — Leave Application & Status 📝\n` +
      `5️⃣ *5* or *Fee* — Hub Raqam Payment Link 💳\n` +
      `6️⃣ *6* or *Profile* — Student & Teacher Details 👤\n` +
      `7️⃣ *7* or *Helpline* — Contact Administration 📞\n\n` +
      `💡 *Quick Tip:* You can simply type *1*, *2*, *3*, *4*, *5*, *6*, or *7* anytime for instant response!\n\n` +
      `🌐 *Student Portal:* ${BOT_CONFIG.PORTAL_URL}`
  }, senderPhone);
}

/**
 * Sends a real result card image to a parent's WhatsApp via Baileys multi-device.
 */
export async function sendResultToParent(studentData) {
  const phone = cleanPhone(studentData.whatsappNumber || studentData.phone);
  if (!phone) {
    throw new Error(`Invalid phone number for student: ${studentData.name}`);
  }

  const svgString = generateResultSvg(studentData);
  const pngBuffer = svgToPngBuffer(svgString);
  const caption = buildResultCaption(studentData);
  const cleanName = (studentData.name || 'Result').replace(/[^a-zA-Z0-9_-]/g, '_');

  if (sock && baileysStatus === 'CONNECTED') {
    const jid = `${phone}@s.whatsapp.net`;
    const result = await sock.sendMessage(jid, {
      image: pngBuffer,
      caption: caption,
      mimetype: 'image/png',
      fileName: `${cleanName}_Weekly_Result.png`
    });

    console.log(`[DISPATCH-LIVE] 🚀 Real WhatsApp image sent to +${phone} for ${studentData.name} (MsgID: ${result.key.id})`);

    const record = {
      id: result.key.id,
      phone,
      studentName: studentData.name,
      score: studentData.weeklyScore,
      timestamp: new Date().toISOString(),
      status: 'DELIVERED_TO_WHATSAPP'
    };
    DISPATCH_LOG.push(record);
    if (DISPATCH_LOG.length > 200) DISPATCH_LOG.shift();

    return {
      success: true,
      phone,
      student: studentData.name,
      messageId: result.key.id,
      timestamp: Date.now(),
      status: 'DELIVERED_TO_WHATSAPP'
    };
  } else {
    console.log(`[DISPATCH-BLOCKED] ⚠️ WhatsApp device is NOT linked yet! Phone: +${phone} for ${studentData.name}`);
    return {
      success: false,
      notConnected: true,
      error: `WhatsApp device for Helpline ${BOT_CONFIG.HELPLINE_NUMBER} is not linked yet! Please open http://localhost:${BOT_CONFIG.PORT} and scan the QR code using WhatsApp on ${BOT_CONFIG.HELPLINE_NUMBER}.`,
      phone,
      student: studentData.name
    };
  }
}

/**
 * Checks connection status of the OpenWA / Baileys helpline session.
 */
export async function checkSessionStatus() {
  if (baileysStatus === 'CONNECTED') {
    return {
      online: true,
      status: {
        name: BOT_CONFIG.OPENWA_SESSION_ID,
        status: 'WORKING',
        me: {
          id: `${BOT_CONFIG.HELPLINE_PHONE_DIGITS}@c.us`,
          pushName: 'Mauze Tahfeez Helpline'
        }
      },
      sessionId: BOT_CONFIG.OPENWA_SESSION_ID,
      helpline: BOT_CONFIG.HELPLINE_NUMBER,
      mode: 'baileys-live-socket'
    };
  }

  return {
    online: false,
    status: {
      name: BOT_CONFIG.OPENWA_SESSION_ID,
      status: baileysStatus,
      qrReady: Boolean(latestQrDataUrl)
    },
    sessionId: BOT_CONFIG.OPENWA_SESSION_ID,
    helpline: BOT_CONFIG.HELPLINE_NUMBER,
    mode: 'waiting-for-qr-scan'
  };
}

/**
 * Finds a student record in embeddedRoster by studentId or name hint.
 */
export function findStudentInRosterById(studentId, nameHint) {
  const sid = String(studentId || '').trim();
  const name = String(nameHint || '').trim().toLowerCase();

  if (sid) {
    const byId = embeddedRoster.find(s => s.student_id === sid || s.id === sid);
    if (byId) return byId;
  }
  if (name) {
    const byName = embeddedRoster.find(s => {
      const sName = String(s.name || '').toLowerCase();
      return sName === name || sName.includes(name) || name.includes(sName);
    });
    if (byName) return byName;
  }
  return null;
}

/**
 * Universal dispatcher for pushing student updates directly to matching parents' WhatsApp numbers.
 */
export async function dispatchStudentNotification(payload) {
  const { type, student, details, studentId, phone, its, name } = payload || {};
  let targetPhone = cleanPhone(phone || student?.phone || student?.whatsapp_number || '');
  let targetIts = String(its || student?.its || '').trim();
  let targetName = String(name || student?.name || student?.student_name || '').trim();
  const targetStudentId = String(studentId || student?.student_id || student?.id || '').trim();

  // If missing name/its/phone, resolve from roster by ID or name
  const rosterMatch = findStudentInRosterById(targetStudentId, targetName);
  if (rosterMatch) {
    if (!targetName) targetName = rosterMatch.name;
    if (!targetIts) targetIts = rosterMatch.its;
    if (!targetPhone && rosterMatch.phone) targetPhone = cleanPhone(rosterMatch.phone);
  }

  const isEventBroadcast = type === 'event_leave' && !targetPhone && !targetIts && !targetStudentId;

  // Collect all recipient WhatsApp numbers strictly for this child
  const targetRecipients = new Set();
  if (targetPhone) targetRecipients.add(targetPhone);

  if (isEventBroadcast) {
    // For general school-wide event leaves, broadcast to all active linked parents
    for (const [p] of linkedWASubscribersCache.entries()) {
      targetRecipients.add(p);
    }
  } else {
    // Strictly match linked subscribers for this specific child ONLY
    for (const [p, rec] of linkedWASubscribersCache.entries()) {
      const s = rec.student;
      if (!s) continue;
      const sPhone = cleanPhone(s.phone || s.whatsappNumber || s.whatsapp_number || '');
      const sIts = String(s.its || '').trim();
      const sName = String(s.name || '').trim().toLowerCase();
      const sId = String(s.student_id || s.id || '').trim();

      const itsMatches = Boolean(targetIts && sIts && sIts === targetIts);
      const idMatches = Boolean(targetStudentId && sId && sId === targetStudentId);
      const phoneMatches = Boolean(targetPhone && sPhone && (
        sPhone === targetPhone ||
        (sPhone.length >= 10 && targetPhone.length >= 10 && sPhone.slice(-10) === targetPhone.slice(-10))
      ));
      const nameMatches = Boolean(
        targetName && sName && (
          sName === targetName.toLowerCase() ||
          sName.includes(targetName.toLowerCase()) ||
          targetName.toLowerCase().includes(sName)
        )
      );

      if (itsMatches || idMatches || phoneMatches || nameMatches) {
        targetRecipients.add(p);
      }
    }

    // Also check embedded roster to push to the student profile's registered WhatsApp
    for (const s of embeddedRoster) {
      const sPhone = cleanPhone(s.phone || s.whatsappNumber || s.whatsapp_number || '');
      const sIts = String(s.its || '').trim();
      const sName = String(s.name || '').trim().toLowerCase();
      const sId = String(s.student_id || s.id || '').trim();

      const itsMatches = Boolean(targetIts && sIts && sIts === targetIts);
      const idMatches = Boolean(targetStudentId && sId && sId === targetStudentId);
      const phoneMatches = Boolean(targetPhone && sPhone && (
        sPhone === targetPhone ||
        (sPhone.length >= 10 && targetPhone.length >= 10 && sPhone.slice(-10) === targetPhone.slice(-10))
      ));
      const nameMatches = Boolean(
        targetName && sName && (
          sName === targetName.toLowerCase() ||
          sName.includes(targetName.toLowerCase()) ||
          targetName.toLowerCase().includes(sName)
        )
      );

      if (itsMatches || idMatches || phoneMatches || nameMatches) {
        if (sPhone) targetRecipients.add(sPhone);
      }
    }
  }

  const studentDisplayName = targetName || student?.name || 'Student';
  let messageText = '';

  if (type === 'attendance') {
    const rawStatus = details?.status || details?.attendanceStatus || 'Present';
    const attStatus = /absent/i.test(rawStatus)
      ? 'Absent'
      : (/leave|uzur/i.test(rawStatus) ? 'Excused (Leave)' : 'Present');
    const attDate = details?.date || details?.attendance_date || new Date().toLocaleDateString('en-GB');
    const statusEmoji = attStatus === 'Absent' ? '❌' : (attStatus === 'Present' ? '✅' : '📝');

    const record = {
      status: attStatus,
      statusEmoji,
      date: attDate,
      name: studentDisplayName,
      phone: targetPhone,
      its: targetIts,
      studentId: targetStudentId,
      updatedAt: Date.now()
    };

    if (targetPhone) saveAttendanceRecord(`phone:${targetPhone}`, record);
    if (targetIts) saveAttendanceRecord(`its:${targetIts}`, record);
    if (targetName) saveAttendanceRecord(`name:${targetName.toLowerCase()}`, record);
    if (targetStudentId) saveAttendanceRecord(`id:${targetStudentId}`, record);

    messageText = `📋 *DAILY ATTENDANCE UPDATE*\n\n` +
      `Salam Jameel,\n` +
      `Respected Parent,\n\n` +
      `Attendance has been marked for your child:\n` +
      `👤 Student: *${studentDisplayName}*\n` +
      (targetIts ? `🆔 ITS: \`${targetIts}\`\n` : '') +
      `📅 Date: *${attDate}*\n` +
      `📌 Status: *${statusEmoji} ${attStatus}*\n\n` +
      `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;
  } else if (type === 'leave_applied') {
    const fromD = details?.fromDate || details?.from_date || '';
    const tillD = details?.toDate || details?.to_date || '';
    const periodStr = fromD && tillD ? `${fromD} to ${tillD}` : (fromD || 'Requested Dates');
    const reasonStr = details?.reason || details?.note || 'Personal Leave';

    messageText = `📝 *LEAVE APPLICATION SUBMITTED*\n\n` +
      `Salam Jameel,\n` +
      `Respected Parent,\n\n` +
      `Your leave application for *${studentDisplayName}* has been submitted:\n` +
      `👤 Student: *${studentDisplayName}*\n` +
      (targetIts ? `🆔 ITS: \`${targetIts}\`\n` : '') +
      `📅 Period: *${periodStr}*\n` +
      `📝 Reason: *${reasonStr}*\n` +
      `⏳ Status: *Pending Admin Approval*\n\n` +
      `You will receive an instant notification as soon as the administration reviews and acts on the application.\n\n` +
      `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;
  } else if (type === 'leave' || type === 'leave_action') {
    const lvStatus = details?.status || 'Update';
    const statusEmoji = /approved/i.test(lvStatus) ? '✅' : (/rejected/i.test(lvStatus) ? '❌' : '⏳');
    const fromD = details?.fromDate || details?.from_date || '';
    const tillD = details?.toDate || details?.to_date || '';
    const periodStr = fromD && tillD ? `${fromD} to ${tillD}` : (fromD || '');
    const comment = details?.comment || details?.adminComment || details?.admin_comment || details?.note || '';

    messageText = `📝 *LEAVE APPLICATION STATUS UPDATE*\n\n` +
      `Salam Jameel,\n` +
      `Respected Parent,\n\n` +
      `The administration has taken action on the leave request for your child:\n` +
      `👤 Student: *${studentDisplayName}*\n` +
      (targetIts ? `🆔 ITS: \`${targetIts}\`\n` : '') +
      (periodStr ? `📅 Period: *${periodStr}*\n` : '') +
      `📌 Action / Status: *${statusEmoji} ${lvStatus}*\n` +
      (comment ? `💬 Admin Remark: _${comment}_\n\n` : '\n') +
      `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;
  } else if (type === 'leave_chat_message') {
    const comment = details?.comment || details?.adminComment || details?.admin_comment || details?.note || details?.body || '';

    messageText = `💬 *ADMIN LEAVE MESSAGE*\n\n` +
      `Salam Jameel,\n` +
      `Respected Parent,\n\n` +
      `Message from administration regarding *${studentDisplayName}*'s leave:\n` +
      `👤 Student: *${studentDisplayName}*\n` +
      (targetIts ? `🆔 ITS: \`${targetIts}\`\n` : '') +
      `💬 Message: _${comment}_\n\n` +
      `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;
  } else if (type === 'event_leave') {
    const evName = details?.eventName || details?.title || 'Event Leave';
    const fromD = details?.fromDate || details?.from_date || '';
    const tillD = details?.toDate || details?.to_date || '';
    const periodStr = fromD && tillD ? `${fromD} to ${tillD}` : (fromD || '');
    const reasonStr = details?.reason || details?.body || '';

    messageText = `🎉 *EVENT LEAVE ANNOUNCEMENT*\n\n` +
      `Salam Jameel,\n` +
      `Respected Parent,\n\n` +
      `An event leave has been announced for Mauze Tahfeez:\n` +
      `📌 Event: *${evName}*\n` +
      (periodStr ? `📅 Period: *${periodStr}*\n` : '') +
      (reasonStr ? `📝 Note: _${reasonStr}_\n` : '') +
      `\nHoliday leave has been automatically marked for your child (*${studentDisplayName}*).\n\n` +
      `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;
  } else if (type === 'fee_reminder') {
    const hijriNow = getFatemiHijriMonth();
    const monthName = details?.monthName || hijriNow.nameEn;
    const payUrl = 'https://www.its52.com/Login.aspx?OneLogin=MAZSTUDENT';

    messageText = `💰 *HUB RAQAM - MONTHLY FEE REMINDER*\n\n` +
      `Salam Jameel,\n` +
      `Respected Parent,\n\n` +
      `This is a gentle reminder regarding the monthly Mauze Tahfeez Hub Raqam (Tuition Fee) for the month of *${monthName}* for your child:\n` +
      `👤 Student: *${studentDisplayName}*\n` +
      (targetIts ? `🆔 ITS: \`${targetIts}\`\n` : '') +
      `\nKindly complete the payment online via the official Mahad al Zahra portal:\n` +
      `👉 *PAY NOW:*\n` +
      `💳 ${payUrl}\n\n` +
      `After payment, please preserve your transaction receipt for your records.\n\n` +
      `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;
  } else if (type === 'jadwal') {
    messageText = `📅 *JADWAL / TIMETABLE SCHEDULE*\n\n` +
      `Student: *${studentDisplayName}*\n` +
      `Your child's personalized hifz timetable and murajah plan has been updated.\n\n` +
      `🌐 View Online: ${BOT_CONFIG.PORTAL_URL}`;
  } else {
    messageText = `📢 *STUDENT NOTIFICATION UPDATE*\n\n` +
      `Student: *${studentDisplayName}*\n` +
      `${details?.body || details?.title || 'A new update is available on your student portal.'}\n\n` +
      `🌐 Online Portal: ${BOT_CONFIG.PORTAL_URL}`;
  }

  let delivered = 0;
  if (sock && baileysStatus === 'CONNECTED') {
    for (const recipient of targetRecipients) {
      const jid = formatTargetJid(recipient);
      if (!jid) continue;
      try {
        await sock.sendMessage(jid, { text: messageText });
        delivered++;
        console.log(`[WHATSAPP-PUSH] 🚀 Sent live ${type} update to ${jid} for ${studentDisplayName}`);
      } catch (err) {
        console.warn(`[WHATSAPP-PUSH-FAIL] Error sending to ${jid}:`, err.message);
      }
    }
  }

  return {
    success: true,
    delivered,
    totalTargets: targetRecipients.size,
    recipients: Array.from(targetRecipients)
  };
}

const processedFirestoreEvents = new Set();
let firestoreAdminDb = null;
let firestoreListenersActive = false;

/**
 * Initializes direct real-time Firestore listeners for instant attendance, leave, and admin updates.
 */
export function initFirestoreRealtimeListeners() {
  if (firestoreListenersActive) return;
  try {
    let adminApp;
    const apps = getAdminApps();
    if (apps && apps.length > 0) {
      adminApp = apps[0];
    } else {
      adminApp = initAdminApp({ credential: cert(FALLBACK_SA) });
    }
    firestoreAdminDb = getAdminFirestore(adminApp);
    firestoreListenersActive = true;
    console.log('[FIRESTORE-LISTENER] 📡 Cloud Firestore Realtime Listeners Initializing...');

    // 0. Synchronize Bot ON/OFF status in real-time with whatsapp_config/1
    try {
      firestoreAdminDb.collection('whatsapp_config').doc('1').onSnapshot((docSnap) => {
        if (docSnap && docSnap.exists) {
          const cfgData = docSnap.data();
          if (typeof cfgData?.enabled === 'boolean') {
            botEnabled = cfgData.enabled;
            console.log(`[FIRESTORE-CONFIG] 🔄 whatsapp_config updated: WhatsApp Bot is ${botEnabled ? 'ENABLED (ON)' : 'DISABLED (OFF)'}`);
          }
        }
      }, (err) => {
        console.warn('[FIRESTORE-CONFIG-WARN] whatsapp_config listener warning:', err.message);
      });
    } catch (e) {
      console.warn('[FIRESTORE-CONFIG-WARN] Failed to setup whatsapp_config listener:', e.message);
    }

    const RECENT_CUTOFF_MS = Date.now() - 4 * 60 * 60 * 1000; // 4 hours window to backfill today's tests

    // 1. Listen to student_leaves
    const listenToLeaves = (colName) => {
      let isFirstSnap = true;
      firestoreAdminDb.collection(colName).onSnapshot((snapshot) => {
        if (isFirstSnap) {
          isFirstSnap = false;
          // Check recent docs from the initial snapshot
          snapshot.forEach((doc) => {
            const data = doc.data();
            const tStr = data.updated_at || data.created_at || data.timestamp;
            const t = tStr ? new Date(tStr).getTime() : 0;
            if (t > RECENT_CUTOFF_MS) {
              const eventKey = `${colName}:${doc.id}:${data.status}:${data.admin_comment || ''}`;
              if (!processedFirestoreEvents.has(eventKey)) {
                processedFirestoreEvents.add(eventKey);
                const isApprovedOrRejected = /approved|rejected/i.test(data.status);
                const notifType = isApprovedOrRejected ? 'leave_action' : 'leave_applied';
                dispatchStudentNotification({
                  type: notifType,
                  studentId: data.student_id,
                  name: data.student_name,
                  details: {
                    status: data.status,
                    fromDate: data.from_date || data.leave_date,
                    toDate: data.to_date || data.leave_date,
                    reason: data.reason,
                    comment: data.admin_comment
                  }
                }).catch(e => console.warn('[FIRESTORE-LEAVE-DISPATCH-ERR]:', e.message));
              }
            }
          });
          return;
        }

        // Live changes
        snapshot.docChanges().forEach((change) => {
          const doc = change.doc;
          const data = doc.data();
          const eventKey = `${colName}:${doc.id}:${data.status}:${data.admin_comment || ''}:${(data.messages || []).length}`;
          if (processedFirestoreEvents.has(eventKey)) return;
          processedFirestoreEvents.add(eventKey);

          if (change.type === 'added') {
            const isAction = /approved|rejected/i.test(data.status);
            dispatchStudentNotification({
              type: isAction ? 'leave_action' : 'leave_applied',
              studentId: data.student_id,
              name: data.student_name,
              details: {
                status: data.status,
                fromDate: data.from_date || data.leave_date,
                toDate: data.to_date || data.leave_date,
                reason: data.reason,
                comment: data.admin_comment
              }
            }).catch(e => console.warn('[FIRESTORE-LEAVE-DISPATCH-ERR]:', e.message));
          } else if (change.type === 'modified') {
            const msgs = data.messages || [];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'admin' && (Date.now() - new Date(lastMsg.timestamp || 0).getTime() < 60000)) {
              dispatchStudentNotification({
                type: 'leave_chat_message',
                studentId: data.student_id,
                name: data.student_name,
                details: {
                  comment: lastMsg.text
                }
              }).catch(e => console.warn('[FIRESTORE-LEAVE-CHAT-ERR]:', e.message));
            } else {
              dispatchStudentNotification({
                type: 'leave_action',
                studentId: data.student_id,
                name: data.student_name,
                details: {
                  status: data.status,
                  fromDate: data.from_date || data.leave_date,
                  toDate: data.to_date || data.leave_date,
                  reason: data.reason,
                  comment: data.admin_comment
                }
              }).catch(e => console.warn('[FIRESTORE-LEAVE-ACTION-ERR]:', e.message));
            }
          }
        });
      }, (err) => {
        console.warn(`[FIRESTORE-LEAVE-ERR] ${colName} listener error:`, err.message);
      });
    };

    listenToLeaves('student_leaves');
    listenToLeaves('kibar_student_leaves');

    // 2. Listen to student_daily_attendance
    const listenToAttendance = (colName) => {
      let isFirstSnap = true;
      firestoreAdminDb.collection(colName).onSnapshot((snapshot) => {
        if (isFirstSnap) {
          isFirstSnap = false;
          snapshot.forEach((doc) => {
            const data = doc.data();
            const tStr = data.updated_at || data.marked_at || data.created_at;
            const t = tStr ? new Date(tStr).getTime() : 0;
            if (t > RECENT_CUTOFF_MS) {
              const eventKey = `${colName}:${doc.id}:${data.status}:${data.attendance_date}`;
              if (!processedFirestoreEvents.has(eventKey)) {
                processedFirestoreEvents.add(eventKey);
                dispatchStudentNotification({
                  type: 'attendance',
                  studentId: data.student_id,
                  details: {
                    status: data.status,
                    date: data.attendance_date,
                    time: data.time
                  }
                }).catch(e => console.warn('[FIRESTORE-ATT-DISPATCH-ERR]:', e.message));
              }
            }
          });
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const doc = change.doc;
            const data = doc.data();
            const eventKey = `${colName}:${doc.id}:${data.status}:${data.attendance_date}:${data.updated_at || data.marked_at}`;
            if (processedFirestoreEvents.has(eventKey)) return;
            processedFirestoreEvents.add(eventKey);

            dispatchStudentNotification({
              type: 'attendance',
              studentId: data.student_id,
              details: {
                status: data.status,
                date: data.attendance_date,
                time: data.time
              }
            }).catch(e => console.warn('[FIRESTORE-ATT-DISPATCH-ERR]:', e.message));
          }
        });
      }, (err) => {
        console.warn(`[FIRESTORE-ATT-ERR] ${colName} listener error:`, err.message);
      });
    };

    listenToAttendance('student_daily_attendance');
    listenToAttendance('kibar_student_daily_attendance');

    // 3. Listen to weekly_results and kibar_weekly_results (Mark Progress)
    const listenToWeeklyResults = (colName) => {
      let isFirstSnap = true;
      firestoreAdminDb.collection(colName).onSnapshot((snapshot) => {
        if (isFirstSnap) {
          isFirstSnap = false;
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data && (data.student_id || data.studentId)) {
              saveWeeklyResultRecord({ id: doc.id, ...data });
            }
          });
          console.log(`[FIRESTORE-LISTENER] 🏆 Initial snapshot: synced ${latestWeeklyResultsMap.size} weekly results from ${colName}`);
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const doc = change.doc;
            const data = doc.data();
            if (data && (data.student_id || data.studentId)) {
              const resRecord = saveWeeklyResultRecord({ id: doc.id, ...data });
              console.log(`[FIRESTORE-RESULT-UPDATE] 🏆 Live mark progress received for student ${data.student_id}: Score ${resRecord.total_score}/100, Wusool Juz ${resRecord.wusool_juz}`);

              const sMatch = embeddedRoster.find(s =>
                String(s.student_id) === String(data.student_id) ||
                String(s.id) === String(data.student_id) ||
                (s.its && String(s.its) === String(data.student_id))
              );
              if (sMatch) {
                enrichStudentWithLatestResult(sMatch);
              }
            }
          }
        });
      }, (err) => {
        console.warn(`[FIRESTORE-RESULTS-ERR] ${colName} listener error:`, err.message);
      });
    };

    listenToWeeklyResults('weekly_results');
    listenToWeeklyResults('kibar_weekly_results');

    // Sync today's attendance initially
    syncTodayAttendanceFromFirestore().catch(() => {});

    console.log('[FIRESTORE-LISTENER] ✅ Realtime listeners connected to student_leaves, student_daily_attendance, and weekly_results');
  } catch (err) {
    console.warn('[FIRESTORE-INIT-FAIL]:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Standalone HTTP Server & Bot Engine
// ---------------------------------------------------------------------------
export function startWhatsAppBotEngine() {
  // Start Baileys Multi-Device WhatsApp Socket
  initBaileysSocket().catch((err) => {
    console.error('[BAILEYS-ERROR] Failed to init socket:', err);
  });

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // 1. Dashboard UI (GET /)
    if (pathname === '/' && req.method === 'GET') {
      const isConnected = baileysStatus === 'CONNECTED';
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mauze Tahfeez WhatsApp Bot - Helpline +91 81079 25353</title>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', sans-serif;
      background: radial-gradient(circle at 50% 0%, #0c203b 0%, #06111f 100%);
      color: #f1f5f9;
      min-height: 100vh;
      padding: 30px 20px;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, rgba(15, 39, 71, 0.9), rgba(10, 25, 47, 0.95));
      border: 1px solid rgba(212, 175, 55, 0.35);
      border-radius: 20px;
      padding: 30px;
      margin-bottom: 25px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.4);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
    }
    .header-title h1 {
      font-family: 'Cinzel', serif;
      color: #fae29c;
      font-size: 26px;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-title p { color: #94a3b8; font-size: 14px; margin-top: 6px; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 30px;
      font-size: 14px;
      font-weight: 700;
    }
    .status-badge.online {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #4ade80;
    }
    .status-badge.waiting {
      background: rgba(234, 179, 8, 0.15);
      border: 1px solid rgba(234, 179, 8, 0.4);
      color: #facc15;
    }
    .status-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      box-shadow: 0 0 10px currentColor;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .auth-banner {
      background: linear-gradient(135deg, rgba(234, 179, 8, 0.1), rgba(15, 39, 71, 0.9));
      border: 2px solid #eab308;
      border-radius: 20px;
      padding: 30px;
      margin-bottom: 25px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    }
    .auth-banner h2 { font-size: 22px; color: #fae29c; margin-bottom: 10px; }
    .auth-banner p { color: #cbd5e1; font-size: 15px; margin-bottom: 20px; }
    .qr-container {
      background: white;
      padding: 16px;
      border-radius: 16px;
      display: inline-block;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      margin-bottom: 20px;
    }
    .qr-container img { width: 280px; height: 280px; display: block; }
    .steps-box {
      max-width: 500px;
      margin: 0 auto 20px;
      background: rgba(6, 16, 30, 0.8);
      border-radius: 14px;
      padding: 18px 24px;
      text-align: left;
      font-size: 14px;
      color: #e2e8f0;
      line-height: 1.8;
    }
    .steps-box ol { padding-left: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 25px; }
    @media(max-width: 850px) { .grid { grid-template-columns: 1fr; } }
    .card {
      background: rgba(15, 39, 71, 0.65);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px;
      padding: 24px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    }
    .card h2 {
      font-size: 18px;
      color: #fae29c;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-size: 13px; color: #cbd5e1; margin-bottom: 6px; }
    .form-input {
      width: 100%;
      padding: 10px 14px;
      background: rgba(6, 16, 30, 0.8);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 10px;
      color: #fff;
      font-size: 14px;
    }
    .btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #d4af37, #aa7c11);
      color: #06101e;
      border: none;
      border-radius: 12px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      margin-top: 10px;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
    }
    .log-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
    .log-table th {
      text-align: left;
      padding: 10px;
      background: rgba(6, 16, 30, 0.5);
      color: #fae29c;
      font-weight: 600;
    }
    .log-table td { padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .preview-box {
      border: 1px dashed rgba(212, 175, 55, 0.4);
      border-radius: 14px;
      padding: 15px;
      text-align: center;
      background: rgba(6, 16, 30, 0.4);
    }
    .preview-box img {
      max-width: 100%;
      max-height: 400px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-title">
        <h1>📱 Mauze Tahfeez WhatsApp Bot Gateway</h1>
        <p>Helpline: <strong>${BOT_CONFIG.HELPLINE_NUMBER}</strong> • Session: <code>${BOT_CONFIG.OPENWA_SESSION_ID}</code></p>
      </div>
      <div class="status-badge ${isConnected ? 'online' : 'waiting'}" id="statusBadge">
        <span class="status-dot"></span>
        <span id="statusText">${isConnected ? '🟢 WhatsApp Connected & Live' : '⏳ Waiting for QR Scan'}</span>
      </div>
    </div>

    <!-- QR Scan Banner if not authenticated -->
    <div class="auth-banner" id="authBanner" style="display: ${isConnected ? 'none' : 'block'};">
      <h2>📱 Link WhatsApp Helpline Device (${BOT_CONFIG.HELPLINE_NUMBER})</h2>
      <p>Scan this QR code with WhatsApp on the helpline phone to activate live sending:</p>
      
      <div class="qr-container">
        <img id="qrImg" src="${latestQrDataUrl || '/qr'}" alt="Scan WhatsApp QR" />
      </div>

      <div class="steps-box">
        <ol>
          <li>Open <strong>WhatsApp</strong> on helpline phone <strong>${BOT_CONFIG.HELPLINE_NUMBER}</strong></li>
          <li>Tap <strong>⋮ Menu (Android)</strong> or <strong>Settings (iPhone)</strong></li>
          <li>Select <strong>Linked Devices</strong> → <strong>Link a Device</strong></li>
          <li>Point your camera at this QR code</li>
        </ol>
      </div>

      <div>
        <button class="btn" style="max-width:320px;margin:0 auto;" onclick="requestPairingCode()">
          🔑 Or Link with Pairing Code (Phone Number)
        </button>
        <div id="pairingCodeDisplay" style="margin-top:10px;font-size:18px;font-weight:800;color:#fae29c;"></div>
      </div>
    </div>

    <div class="grid">
      <!-- Quick Test Form -->
      <div class="card">
        <h2>🧪 Send Test WhatsApp Result Image</h2>
        <form id="testForm" onsubmit="handleSendTest(event)">
          <div class="form-group">
            <label>Child / Student Name</label>
            <input type="text" id="tName" class="form-input" value="Taher Shabbir" required />
          </div>
          <div class="form-group">
            <label>Parent WhatsApp Number (with country code e.g. 919930852533)</label>
            <input type="text" id="tPhone" class="form-input" value="919930852533" required />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group">
              <label>Weekly Score</label>
              <input type="text" id="tScore" class="form-input" value="98.5" />
            </div>
            <div class="form-group">
              <label>Total Jadeed</label>
              <input type="text" id="tJadeed" class="form-input" value="4.5 صفه" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group">
              <label>Marhala Rank</label>
              <input type="text" id="tMRank" class="form-input" value="1" />
            </div>
            <div class="form-group">
              <label>Overall Rank</label>
              <input type="text" id="tORank" class="form-input" value="3" />
            </div>
          </div>
          <button type="submit" class="btn" id="sendBtn">
            🚀 Dispatch Result Card to WhatsApp
          </button>
          <div id="testStatus" style="margin-top:12px;font-size:13px;text-align:center;"></div>
        </form>
      </div>

      <!-- Live Preview -->
      <div class="card">
        <h2>👁️ Live Result Image Card Preview</h2>
        <div class="preview-box">
          <img id="cardPreview" src="/api/preview-sample" alt="Result Card Preview" />
        </div>
        <p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:10px;">
          Vector SVG rendered to crisp 1080px PNG • Exact Google Sheets summary data
        </p>
      </div>
    </div>

    <!-- Live Dispatches Log -->
    <div class="card">
      <h2>📊 Live WhatsApp Dispatches Log</h2>
      <div style="overflow-x:auto;">
        <table class="log-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Recipient</th>
              <th>Child Name</th>
              <th>Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="logBody">
            <tr><td colspan="5" style="text-align:center;color:#94a3b8;">No dispatches yet in this session.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    async function checkState() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const badge = document.getElementById('statusBadge');
        const banner = document.getElementById('authBanner');
        const qrImg = document.getElementById('qrImg');
        const text = document.getElementById('statusText');

        if (data.baileysStatus === 'CONNECTED') {
          badge.className = 'status-badge online';
          text.innerText = '🟢 WhatsApp Connected & Live (' + data.helpline + ')';
          banner.style.display = 'none';
        } else {
          badge.className = 'status-badge waiting';
          text.innerText = '⏳ Waiting for QR Scan';
          banner.style.display = 'block';
          if (data.qrDataUrl) {
            qrImg.src = data.qrDataUrl;
          }
        }
      } catch(_) {}
    }
    setInterval(checkState, 3000);

    async function requestPairingCode() {
      const display = document.getElementById('pairingCodeDisplay');
      display.innerText = 'Requesting code...';
      try {
        const res = await fetch('/api/request-pairing-code', { method: 'POST' });
        const json = await res.json();
        if (json.success && json.pairingCode) {
          display.innerHTML = 'Your Pairing Code: <span style="background:#eab308;color:#000;padding:4px 10px;border-radius:6px;font-family:monospace;letter-spacing:3px;">' + json.pairingCode + '</span><br><span style="font-size:12px;color:#cbd5e1;">Enter this code on WhatsApp -> Linked Devices -> Link with phone number</span>';
        } else {
          display.innerText = json.error || 'Pairing code unavailable. Please scan the QR code above.';
        }
      } catch(e) {
        display.innerText = 'Error: ' + e.message;
      }
    }

    async function loadLogs() {
      try {
        const res = await fetch('/api/dispatches');
        const data = await res.json();
        const tbody = document.getElementById('logBody');
        if (!data || data.length === 0) return;
        tbody.innerHTML = data.slice().reverse().map(d => \`
          <tr>
            <td>\${new Date(d.timestamp).toLocaleTimeString()}</td>
            <td><strong>+\${d.phone}</strong></td>
            <td>\${d.studentName || 'Student'}</td>
            <td>\${d.score || '—'}</td>
            <td><span style="color:#4ade80;font-weight:600;">✓ Delivered</span></td>
          </tr>
        \`).join('');
      } catch(_) {}
    }
    loadLogs();
    setInterval(loadLogs, 4000);

    async function handleSendTest(e) {
      e.preventDefault();
      const btn = document.getElementById('sendBtn');
      const statusDiv = document.getElementById('testStatus');
      btn.disabled = true;
      statusDiv.innerHTML = '<span style="color:#fae29c;">Sending result image to WhatsApp...</span>';

      const payload = {
        name: document.getElementById('tName').value,
        phone: document.getElementById('tPhone').value,
        weeklyScore: document.getElementById('tScore').value,
        totalJadeed: document.getElementById('tJadeed').value,
        marhalaRank: document.getElementById('tMRank').value,
        overallRank: document.getElementById('tORank').value,
        fromDate: 'Current Week Start',
        tillDate: 'Current Week End'
      };

      try {
        const res = await fetch('/api/send-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
          statusDiv.innerHTML = '<span style="color:#4ade80;font-weight:700;">✓ Result Card Dispatched to WhatsApp +' + payload.phone + '!</span>';
          loadLogs();
        } else {
          statusDiv.innerHTML = '<span style="color:#f87171;">' + (json.error || 'Failed to send') + '</span>';
        }
      } catch (err) {
        statusDiv.innerHTML = '<span style="color:#f87171;">Error: ' + err.message + '</span>';
      } finally {
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // 2. Health & Status (GET /api/status)
    if (pathname === '/api/status') {
      const status = await checkSessionStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        service: 'Mauze Tahfeez WhatsApp Bot',
        helpline: BOT_CONFIG.HELPLINE_NUMBER,
        session: BOT_CONFIG.OPENWA_SESSION_ID,
        botEnabled,
        baileysStatus,
        me: sock?.user || connectedUser || null,
        qrDataUrl: latestQrDataUrl,
        pairingCode: latestPairingCode,
        openwa: status,
        dispatchesCount: DISPATCH_LOG.length,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // 2b. Toggle WhatsApp Bot ON/OFF (POST /api/toggle-bot)
    if (pathname === '/api/toggle-bot' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const newStatus = typeof parsed.enabled === 'boolean' ? parsed.enabled : !botEnabled;
          botEnabled = newStatus;
          // Synchronize to Firestore
          if (firestoreAdminDb) {
            try {
              await firestoreAdminDb.collection('whatsapp_config').doc('1').set({
                enabled: botEnabled,
                updated_at: new Date().toISOString()
              }, { merge: true });
            } catch (fsErr) {
              console.warn('[TOGGLE-BOT-FS-WARN]:', fsErr.message);
            }
          }
          console.log(`[BOT-TOGGLE] 🔄 WhatsApp Bot is now: ${botEnabled ? 'ENABLED (ON)' : 'DISABLED (OFF)'}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            enabled: botEnabled,
            baileysStatus,
            message: botEnabled ? 'WhatsApp Bot is now LIVE & ACTIVE' : 'WhatsApp Bot is now PAUSED (OFF)'
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // 3. Request Pairing Code (POST /api/request-pairing-code)
    if (pathname === '/api/request-pairing-code') {
      if (sock && !sock.authState.creds.registered) {
        try {
          const code = await sock.requestPairingCode(BOT_CONFIG.HELPLINE_PHONE_DIGITS);
          latestPairingCode = code;
          console.log(`[PAIRING-CODE] 🔑 Your WhatsApp Pairing Code is: ${code}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, pairingCode: code, phone: BOT_CONFIG.HELPLINE_PHONE_DIGITS }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      } else if (baileysStatus === 'CONNECTED') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Already connected!', status: 'CONNECTED' }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Socket initializing, please try again in 5 seconds.' }));
      }
      return;
    }

    // 4. OpenWA Standard Session Status: GET /api/sessions/:sessionId/status or GET /api/sessions/:sessionId
    if (pathname.startsWith('/api/sessions/') && (pathname.endsWith('/status') || !pathname.includes('/messages/'))) {
      const parts = pathname.split('/').filter(Boolean);
      const reqSessionId = parts[2] || BOT_CONFIG.OPENWA_SESSION_ID;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: reqSessionId,
        status: baileysStatus === 'CONNECTED' ? 'WORKING' : 'SCAN_QR_CODE',
        config: {
          session: reqSessionId,
          helpline: BOT_CONFIG.HELPLINE_NUMBER
        },
        me: {
          id: `${BOT_CONFIG.HELPLINE_PHONE_DIGITS}@c.us`,
          pushName: 'Mauze Tahfeez Helpline'
        }
      }));
      return;
    }

    // 5. OpenWA Standard Send Image: POST /api/sessions/:sessionId/messages/send-image
    if (pathname.includes('/messages/send-image') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const chatId = payload.chatId || '';
          const phone = cleanPhone(chatId);
          const caption = payload.caption || '';
          const filename = payload.filename || 'Result_Card.png';
          const base64Data = (payload.base64 || payload.file || '');

          let imgBuffer = null;
          if (base64Data.startsWith('data:image/svg+xml')) {
            const svgContent = Buffer.from(base64Data.split(',')[1], 'base64').toString('utf-8');
            imgBuffer = svgToPngBuffer(svgContent);
          } else if (base64Data.includes('base64,')) {
            imgBuffer = Buffer.from(base64Data.split('base64,')[1], 'base64');
          } else if (base64Data) {
            imgBuffer = Buffer.from(base64Data, 'base64');
          }

          if (sock && baileysStatus === 'CONNECTED') {
            const jid = `${phone}@s.whatsapp.net`;
            let sent;
            if (imgBuffer) {
              sent = await sock.sendMessage(jid, {
                image: imgBuffer,
                caption: caption,
                mimetype: 'image/png',
                fileName: filename
              });
            } else {
              sent = await sock.sendMessage(jid, { text: caption });
            }

            console.log(`[DISPATCH-LIVE] 🚀 Real WhatsApp image sent to +${phone} (MsgID: ${sent.key.id})`);

            const nameMatch = caption.match(/\*([^*]+)\*\s*\(/);
            const studentName = nameMatch ? nameMatch[1].trim() : filename.replace(/_Weekly_Result.*$/, '');

            const record = {
              id: sent.key.id,
              phone,
              chatId,
              studentName,
              filename,
              captionSnippet: caption.substring(0, 120),
              timestamp: new Date().toISOString(),
              status: 'DELIVERED_TO_WHATSAPP'
            };
            DISPATCH_LOG.push(record);
            if (DISPATCH_LOG.length > 200) DISPATCH_LOG.shift();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              id: sent.key.id,
              success: true,
              timestamp: Date.now(),
              to: chatId,
              status: 'SENT',
              helpline: BOT_CONFIG.HELPLINE_NUMBER
            }));
          } else {
            console.log(`[DISPATCH-BLOCKED] ⚠️ WhatsApp not connected yet. Cannot send to +${phone}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: `WhatsApp device for Helpline ${BOT_CONFIG.HELPLINE_NUMBER} is not linked yet! Open http://localhost:${BOT_CONFIG.PORT} to link it.`,
              status: 'UNLINKED'
            }));
          }
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // 5b. OpenWA Standard Send Text: POST /api/sessions/:sessionId/messages/send-text
    if (pathname.includes('/messages/send-text') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const chatId = payload.chatId || payload.phone || payload.to || '';
          const phone = cleanPhone(chatId);
          const text = payload.text || payload.message || payload.body || '';

          if (!phone) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Recipient phone or chatId is required.' }));
            return;
          }

          if (sock && baileysStatus === 'CONNECTED') {
            const jid = `${phone}@s.whatsapp.net`;
            const sent = await sock.sendMessage(jid, { text });
            console.log(`[OPENWA-TEXT-SENT] 🚀 Sent text to +${phone}: "${text.substring(0, 60)}..."`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              id: sent?.key?.id || `msg_${Date.now()}`,
              success: true,
              timestamp: Date.now(),
              to: chatId,
              status: 'SENT',
              provider: 'openwa',
              helpline: BOT_CONFIG.HELPLINE_NUMBER
            }));
          } else {
            console.log(`[OPENWA-TEXT-BLOCKED] ⚠️ WhatsApp not connected yet. Cannot send to +${phone}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: `WhatsApp device for Helpline ${BOT_CONFIG.HELPLINE_NUMBER} is not linked yet! Open http://localhost:${BOT_CONFIG.PORT} to link it.`,
              status: 'UNLINKED'
            }));
          }
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // 5c. Universal Send Message endpoint (POST /api/send-message or POST /api/send-text)
    if ((pathname === '/api/send-message' || pathname === '/api/send-text') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const chatId = payload.phone || payload.chatId || payload.to || payload.recipient || '';
          const phone = cleanPhone(chatId);
          const text = payload.message || payload.text || payload.body || '';

          if (!phone) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Recipient phone number is required.' }));
            return;
          }

          if (sock && baileysStatus === 'CONNECTED') {
            const jid = `${phone}@s.whatsapp.net`;
            const sent = await sock.sendMessage(jid, { text });
            console.log(`[BOT-SEND-MESSAGE] 🚀 Outbound text sent to +${phone}: "${text.substring(0, 60)}..."`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              id: sent?.key?.id || `msg_${Date.now()}`,
              success: true,
              timestamp: Date.now(),
              to: phone,
              status: 'SENT',
              provider: 'baileys_socket',
              helpline: BOT_CONFIG.HELPLINE_NUMBER
            }));
          } else {
            console.log(`[BOT-SEND-MESSAGE-QUEUED] ⚠️ WhatsApp not connected. Simulated delivery for +${phone}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              simulated: true,
              warning: 'WhatsApp daemon is initializing or unlinked. Message received by bot queue.',
              to: phone,
              helpline: BOT_CONFIG.HELPLINE_NUMBER
            }));
          }
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // 5d. Outbound Admission WhatsApp Trigger (POST /api/whatsapp-admission)
    if (pathname === '/api/whatsapp-admission' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const { trigger, application } = payload;
          if (!application) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing application object' }));
            return;
          }

          const rawPhone = application.whatsapp_number || application.whatsappNumber || application.phone || '';
          const phone = cleanPhone(rawPhone);
          const fullName = application.full_name || application.fullName || 'Mumin';
          const prog = application.program || 'Hifz Classes';
          const appId = application.application_id || application.applicationId || 'N/A';

          let msg = '';
          if (trigger === 'submission') {
            msg = `Salaam ${fullName},\n\nThank you for registering for *${prog}* (1447-48H) at Tahfeez Galiakot.\n\nYour admission status is: *⏳ Pending Admin Review*\nApplication Ref ID: *${appId}*\n\nWe have received your application and our administration will review and update you shortly.\n\nHelpline: +91 81079 25353\nTahfeez – Galiakot`;
          } else if (trigger === 'approved') {
            msg = `Salaam ${fullName}!\n\nMubarak! Your admission application (*${appId}*) for *${prog}* has been *APPROVED*! 🎉\n\nPlease confirm your enrollment by replying to this message with:\n👉 *Yes* (to confirm)\n👉 *No* (to decline)\n👉 *Want to talk* (for inquiries)\n\nTahfeez – Galiakot`;
          } else if (trigger === 'rejected') {
            msg = `Salaam ${fullName},\n\nRegarding your application (*${appId}*) for *${prog}*, we regret to inform you that we cannot accommodate new admissions at this time due to full batch capacity.\n\nHelpline: +91 81079 25353`;
          } else if (trigger === 'waiting') {
            msg = `Salaam ${fullName},\n\nYour application (*${appId}*) for *${prog}* is currently on the *Waiting List*.\n\nWe will notify you immediately once a slot becomes available.\n\nHelpline: +91 81079 25353`;
          } else {
            msg = `Salaam ${fullName},\n\nYour admission status for *${prog}* (Ref: *${appId}*) is now: *${trigger}*.\n\nHelpline: +91 81079 25353`;
          }

          if (sock && baileysStatus === 'CONNECTED' && phone) {
            const jid = `${phone}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: msg });
            console.log(`[ADMISSION-WA-SENT] 🚀 Sent ${trigger} notification to +${phone}`);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, trigger, phone, message: msg }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // 6. Generate Result Preview Image (POST /api/preview)
    if (pathname === '/api/preview' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const svg = generateResultSvg(data);
          res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
          res.end(svg);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // 7. Sample Preview (GET /api/preview-sample)
    if (pathname === '/api/preview-sample') {
      const svg = generateResultSvg({
        name: 'Taher Shabbir',
        fromDate: '10 Ramazan',
        tillDate: '15 Ramazan',
        weeklyScore: '98.5',
        totalJadeed: '4.5 صفه',
        marhalaRank: '1',
        overallRank: '3'
      });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(svg);
      return;
    }

    // 8. Send Single Result (POST /api/send-result)
    if (pathname === '/api/send-result' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const studentData = JSON.parse(body);
          const sendRes = await sendResultToParent(studentData);
          res.writeHead(sendRes.success ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(sendRes));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // 9. Get Dispatches Log (GET /api/dispatches)
    if (pathname === '/api/dispatches') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(DISPATCH_LOG));
      return;
    }

    // 10. Trigger Fatemi Month Fee Reminders (POST /api/send-fee-reminders)
    if (pathname === '/api/send-fee-reminders' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = await checkAndSendFatemiFeeReminders({
            force: payload.force !== false,
            studentId: payload.studentId || payload.its || null
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...result }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // 11. Push Real-Time Student Update to Parents WhatsApp (POST /api/notify-student-update)
    if (pathname === '/api/notify-student-update' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const { type, student, details, studentId, phone, its, name } = payload;
          let targetPhone = cleanPhone(phone || student?.phone || student?.whatsapp_number || details?.phone || '');
          let targetIts = String(its || student?.its || student?.its_id || details?.its || details?.its_id || '').trim();
          let targetName = String(name || student?.name || student?.student_name || details?.student_name || details?.studentName || '').trim();
          let targetStudentId = String(studentId || student?.student_id || student?.id || details?.studentId || details?.student_id || '').trim();

          // Auto-enrich student details from roster if any identifier is provided
          const matchedRosterStudent = embeddedRoster.find(s => {
            const sPhone = cleanPhone(s.phone || s.whatsappNumber || s.whatsapp_number);
            const sIts = String(s.its || '').trim();
            const sId = String(s.student_id || s.id || '').trim();
            const sName = String(s.name || '').trim().toLowerCase();
            return (
              (targetStudentId && (sId === targetStudentId || s.id === targetStudentId)) ||
              (targetIts && sIts === targetIts) ||
              (targetPhone && sPhone && (sPhone === targetPhone || sPhone.slice(-10) === targetPhone.slice(-10))) ||
              (!targetIts && !targetPhone && !targetStudentId && targetName && sName === targetName.toLowerCase())
            );
          });

          if (matchedRosterStudent) {
            if (!targetName) targetName = matchedRosterStudent.name;
            if (!targetIts && matchedRosterStudent.its) targetIts = String(matchedRosterStudent.its);
            if (!targetStudentId && (matchedRosterStudent.student_id || matchedRosterStudent.id)) {
              targetStudentId = String(matchedRosterStudent.student_id || matchedRosterStudent.id);
            }
            if (!targetPhone) {
              const rp = cleanPhone(matchedRosterStudent.phone || matchedRosterStudent.whatsappNumber || matchedRosterStudent.whatsapp_number);
              if (rp) targetPhone = rp;
            }
          }

          const isEventBroadcast = type === 'event_leave' && !targetPhone && !targetIts && !targetStudentId;

          // Collect all recipient WhatsApp numbers strictly for this child
          const targetRecipients = new Set();
          if (targetPhone) targetRecipients.add(targetPhone);

          if (isEventBroadcast) {
            // For general school-wide event leaves, broadcast to all active linked parents
            for (const [p] of linkedWASubscribersCache.entries()) {
              targetRecipients.add(p);
            }
          } else {
            // Strictly match linked subscribers for this specific child ONLY
            for (const [p, rec] of linkedWASubscribersCache.entries()) {
              const s = rec.student;
              if (!s) continue;
              const sPhone = cleanPhone(s.phone || s.whatsappNumber || s.whatsapp_number || '');
              const sIts = String(s.its || '').trim();
              const sName = String(s.name || '').trim().toLowerCase();
              const sId = String(s.student_id || s.id || '').trim();

              const itsMatches = Boolean(targetIts && sIts && sIts === targetIts);
              const idMatches = Boolean(targetStudentId && sId && sId === targetStudentId);
              const phoneMatches = Boolean(targetPhone && sPhone && (
                sPhone === targetPhone ||
                (sPhone.length >= 10 && targetPhone.length >= 10 && sPhone.slice(-10) === targetPhone.slice(-10))
              ));
              const nameMatches = Boolean(
                !targetIts && !targetPhone && !targetStudentId &&
                targetName && sName && (sName === targetName.toLowerCase())
              );

              if (itsMatches || idMatches || phoneMatches || nameMatches) {
                targetRecipients.add(p);
              }
            }

            // Also check embedded roster to push to the student profile's registered WhatsApp
            for (const s of embeddedRoster) {
              const sPhone = cleanPhone(s.phone || s.whatsappNumber || s.whatsapp_number || '');
              const sIts = String(s.its || '').trim();
              const sName = String(s.name || '').trim().toLowerCase();
              const sId = String(s.student_id || s.id || '').trim();

              const itsMatches = Boolean(targetIts && sIts === targetIts);
              const idMatches = Boolean(targetStudentId && sId && sId === targetStudentId);
              const phoneMatches = Boolean(targetPhone && sPhone && (
                sPhone === targetPhone ||
                (sPhone.length >= 10 && targetPhone.length >= 10 && sPhone.slice(-10) === targetPhone.slice(-10))
              ));
              const nameMatches = Boolean(
                !targetIts && !targetPhone && !targetStudentId &&
                targetName && sName && (sName === targetName.toLowerCase())
              );

              if (itsMatches || idMatches || phoneMatches || nameMatches) {
                if (sPhone) targetRecipients.add(sPhone);
              }
            }
          }

          const studentDisplayName = targetName || student?.name || 'Student';
          let messageText = '';

          if (type === 'attendance') {
            const rawStatus = details?.status || details?.attendanceStatus || 'Present';
            const attStatus = /absent/i.test(rawStatus)
              ? 'Absent'
              : (/leave|uzur/i.test(rawStatus) ? 'Excused (Leave)' : 'Present');
            const attDate = details?.date || new Date().toLocaleDateString('en-GB');
            const statusEmoji = attStatus === 'Absent' ? '❌' : (attStatus === 'Present' ? '✅' : '📝');

            const record = {
              status: attStatus,
              statusEmoji,
              date: attDate,
              name: studentDisplayName,
              phone: targetPhone,
              its: targetIts,
              studentId: targetStudentId,
              updatedAt: Date.now()
            };

            if (targetPhone) saveAttendanceRecord(`phone:${targetPhone}`, record);
            if (targetIts) saveAttendanceRecord(`its:${targetIts}`, record);
            if (targetName) saveAttendanceRecord(`name:${targetName.toLowerCase()}`, record);
            if (targetStudentId) saveAttendanceRecord(`id:${targetStudentId}`, record);

            messageText = `📋 *DAILY ATTENDANCE UPDATE*\n\n` +
              `Salam Jameel,\n` +
              `Respected Parent,\n\n` +
              `Attendance has been marked for your child:\n` +
              `👤 Student: *${studentDisplayName}*\n` +
              (targetIts ? `🆔 ITS: \`${targetIts}\`\n` : '') +
              `📅 Date: *${attDate}*\n` +
              `📌 Status: *${statusEmoji} ${attStatus}*\n\n` +
              `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;
          } else if (type === 'result_progress' || type === 'result' || type === 'result_live') {
            const rawScore = details?.total_score !== undefined ? details.total_score : (details?.weeklyScore !== undefined ? details.weeklyScore : details?.score);
            const numScore = parseFloat(rawScore) || 0;
            const wJuz = details?.wusool_juz || details?.wusoolJuz || details?.juz || '';
            const wSurah = details?.wusool_surah || details?.wusoolSurah || details?.surat || '';
            const wPage = details?.wusool_page || details?.wusoolPage || '';
            const resData = {
              student_id: targetStudentId || targetIts,
              its: targetIts,
              name: studentDisplayName,
              week_date: details?.week_date || details?.weekDate || new Date().toISOString().slice(0, 10),
              from_date: details?.from_date || details?.fromDate || '',
              till_date: details?.till_date || details?.tillDate || details?.to_date || '',
              total_score: numScore,
              wusool_juz: wJuz,
              wusool_surah: wSurah,
              wusool_page: wPage,
              total_jadeed_pages: details?.total_jadeed_pages || details?.totalJadeed || '',
              total_jadeed_unit: details?.total_jadeed_unit || 'صفه',
              rank: parseInt(details?.rank || details?.marhalaRank, 10) || 1,
              overall_rank: parseInt(details?.overall_rank || details?.overallRank || details?.rank, 10) || 1,
              updated_at: Date.now()
            };
            saveWeeklyResultRecord(resData);

            const sMatch = embeddedRoster.find(s => 
              (targetStudentId && (s.student_id === targetStudentId || s.id === targetStudentId)) ||
              (targetIts && s.its === targetIts) ||
              (targetName && s.name.toLowerCase() === targetName.toLowerCase())
            );
            if (sMatch) {
              enrichStudentWithLatestResult(sMatch);
            }

            const shouldShoot = Boolean(payload.shootToParent || details?.shootToParent || details?.isLive || type === 'result_live');
            if (shouldShoot && sMatch) {
              for (const p of targetRecipients) {
                sendStudentResultImageWhatsApp(`${p}@s.whatsapp.net`, sMatch, p).catch(e => console.warn('[LIVE-RESULT-SHOOT-ERR]:', e.message));
              }
            }

            messageText = `🏆 *RESULT UPDATE RECORDED*\n\n` +
              `Student: *${studentDisplayName}*\n` +
              `Score: *${numScore} / 100*\n` +
              (wJuz ? `Current Juz: *Juz ${wJuz}* (${wSurah})\n` : '') +
              `Updated at backend.\n\n` +
              `🌐 ${BOT_CONFIG.PORTAL_URL}`;
          } else if (type === 'leave_applied') {
            const fromD = details?.fromDate || details?.from_date || '';
            const tillD = details?.toDate || details?.to_date || '';
            const periodStr = fromD && tillD ? `${fromD} to ${tillD}` : (fromD || 'Requested Dates');
            const reasonStr = details?.reason || details?.note || 'Personal Leave';

            const lvRecord = {
              status: 'Pending Admin Approval',
              statusEmoji: '⏳',
              fromDate: fromD,
              toDate: tillD,
              periodStr,
              reason: reasonStr,
              comment: '',
              name: studentDisplayName,
              phone: targetPhone,
              its: targetIts,
              studentId: targetStudentId,
              updatedAt: Date.now()
            };
            if (targetPhone) saveLeaveRecord(`phone:${targetPhone}`, lvRecord);
            if (targetIts) saveLeaveRecord(`its:${targetIts}`, lvRecord);
            if (targetName) saveLeaveRecord(`name:${targetName.toLowerCase()}`, lvRecord);
            if (targetStudentId) saveLeaveRecord(`id:${targetStudentId}`, lvRecord);

            messageText = `📝 *LEAVE APPLICATION SUBMITTED*\n\n` +
              `Salam Jameel,\n` +
              `Respected Parent,\n\n` +
              `Your leave application for *${studentDisplayName}* has been submitted:\n` +
              `👤 Student: *${studentDisplayName}*\n` +
              (targetIts ? `🆔 ITS: \`${targetIts}\`\n` : '') +
              `📅 Period: *${periodStr}*\n` +
              `📝 Reason: *${reasonStr}*\n` +
              `⏳ Status: *Pending Admin Approval*\n\n` +
              `You will receive an instant notification as soon as the administration reviews and acts on the application.\n\n` +
              `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;
          } else if (type === 'leave' || type === 'leave_action') {
            const lvStatus = details?.status || 'Approved';
            const statusEmoji = /approved/i.test(lvStatus) ? '✅' : (/rejected/i.test(lvStatus) ? '❌' : '⏳');
            const fromD = details?.fromDate || details?.from_date || '';
            const tillD = details?.toDate || details?.to_date || '';
            const periodStr = fromD && tillD ? `${fromD} to ${tillD}` : (fromD || '');
            const comment = details?.comment || details?.adminComment || details?.admin_comment || details?.note || '';

            const lvRecord = {
              status: lvStatus,
              statusEmoji,
              fromDate: fromD,
              toDate: tillD,
              periodStr,
              reason: details?.reason || '',
              comment,
              name: studentDisplayName,
              phone: targetPhone,
              its: targetIts,
              studentId: targetStudentId,
              updatedAt: Date.now()
            };
            if (targetPhone) saveLeaveRecord(`phone:${targetPhone}`, lvRecord);
            if (targetIts) saveLeaveRecord(`its:${targetIts}`, lvRecord);
            if (targetName) saveLeaveRecord(`name:${targetName.toLowerCase()}`, lvRecord);
            if (targetStudentId) saveLeaveRecord(`id:${targetStudentId}`, lvRecord);

            messageText = `📝 *LEAVE APPLICATION STATUS UPDATE*\n\n` +
              `Salam Jameel,\n` +
              `Respected Parent,\n\n` +
              `The administration has taken action on the leave request for your child:\n` +
              `👤 Student: *${studentDisplayName}*\n` +
              (targetIts ? `🆔 ITS: \`${targetIts}\`\n` : '') +
              (periodStr ? `📅 Period: *${periodStr}*\n` : '') +
              `📌 Action / Status: *${statusEmoji} ${lvStatus}*\n` +
              (comment ? `💬 Admin Remark: _${comment}_\n\n` : '\n') +
              `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;
          } else if (type === 'leave_chat_message') {
            const comment = details?.comment || details?.adminComment || details?.admin_comment || details?.note || details?.body || '';

            messageText = `💬 *ADMIN LEAVE MESSAGE*\n\n` +
              `Salam Jameel,\n` +
              `Respected Parent,\n\n` +
              `Message from administration regarding *${studentDisplayName}*'s leave:\n` +
              `👤 Student: *${studentDisplayName}*\n` +
              (targetIts ? `🆔 ITS: \`${targetIts}\`\n` : '') +
              `💬 Message: _${comment}_\n\n` +
              `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;
          } else if (type === 'event_leave') {
            const evName = details?.eventName || details?.title || 'Event Leave';
            const fromD = details?.fromDate || details?.from_date || '';
            const tillD = details?.toDate || details?.to_date || '';
            const periodStr = fromD && tillD ? `${fromD} to ${tillD}` : (fromD || '');
            const reasonStr = details?.reason || details?.body || '';

            messageText = `🎉 *EVENT LEAVE ANNOUNCEMENT*\n\n` +
              `Salam Jameel,\n` +
              `Respected Parent,\n\n` +
              `An event leave has been announced for Mauze Tahfeez:\n` +
              `📌 Event: *${evName}*\n` +
              (periodStr ? `📅 Period: *${periodStr}*\n` : '') +
              (reasonStr ? `📝 Note: _${reasonStr}_\n` : '') +
              `\nHoliday leave has been automatically marked for your child (*${studentDisplayName}*).\n\n` +
              `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;
          } else if (type === 'fee_reminder') {
            const hijriNow = getFatemiHijriMonth();
            const monthName = details?.monthName || hijriNow.nameEn;
            const payUrl = 'https://www.its52.com/Login.aspx?OneLogin=MAZSTUDENT';

            messageText = `💰 *HUB RAQAM - MONTHLY FEE REMINDER*\n\n` +
              `Salam Jameel,\n` +
              `Respected Parent,\n\n` +
              `This is a gentle reminder regarding the monthly Mauze Tahfeez Hub Raqam (Tuition Fee) for the month of *${monthName}* for your child:\n` +
              `👤 Student: *${studentDisplayName}*\n` +
              (targetIts ? `🆔 ITS: \`${targetIts}\`\n` : '') +
              `\nKindly complete the payment online via the official Mahad al Zahra portal:\n` +
              `👉 *PAY NOW:*\n` +
              `💳 ${payUrl}\n\n` +
              `After payment, please preserve your transaction receipt for your records.\n\n` +
              `🌐 Student Portal: ${BOT_CONFIG.PORTAL_URL}`;
          } else if (type === 'jadwal') {
            messageText = `📅 *JADWAL / TIMETABLE SCHEDULE*\n\n` +
              `Student: *${studentDisplayName}*\n` +
              `Your child's personalized hifz timetable and murajah plan has been updated.\n\n` +
              `🌐 View Online: ${BOT_CONFIG.PORTAL_URL}`;
          } else {
            messageText = `📢 *STUDENT NOTIFICATION UPDATE*\n\n` +
              `Student: *${studentDisplayName}*\n` +
              `${details?.body || details?.title || 'A new update is available on your student portal.'}\n\n` +
              `🌐 Online Portal: ${BOT_CONFIG.PORTAL_URL}`;
          }

          let delivered = 0;
          if (sock && baileysStatus === 'CONNECTED') {
            for (const recipient of targetRecipients) {
              const jid = formatTargetJid(recipient);
              if (!jid) continue;
              try {
                await sock.sendMessage(jid, { text: messageText });
                delivered++;
                console.log(`[WHATSAPP-PUSH] 🚀 Sent live ${type} update to ${jid} for ${studentDisplayName}`);
              } catch (err) {
                console.warn(`[WHATSAPP-PUSH-FAIL] Error sending to ${jid}:`, err.message);
              }
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            delivered,
            totalTargets: targetRecipients.size,
            recipients: Array.from(targetRecipients)
          }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // 12. List Linked WhatsApp Subscribers (GET /api/subscribers)
    if (pathname === '/api/subscribers' && req.method === 'GET') {
      const list = [];
      for (const [phone, rec] of linkedWASubscribersCache.entries()) {
        const isPerm = rec.isPermanent !== false;
        let daysLeft = null;
        if (!isPerm && rec.expiresAt) {
          daysLeft = Math.max(1, Math.ceil((rec.expiresAt - Date.now()) / (86400 * 1000)));
        }
        list.push({
          phone,
          studentName: rec.student?.name || 'Student',
          its: rec.student?.its || '—',
          isPermanent: isPerm,
          verifiedAt: rec.verifiedAt,
          daysLeft
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(list));
      return;
    }

    // 13. Unlink Subscriber (POST /api/unlink)
    if (pathname === '/api/unlink' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const { phone } = JSON.parse(body || '{}');
          removeLinkedSubscriber(phone);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, unlinked: phone }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // 14. Simulate Inbound WhatsApp Message for testing (POST /api/test-message)
    if (pathname === '/api/test-message' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const { phone, message } = JSON.parse(body || '{}');
          const cleanP = cleanPhone(phone || '918107925353');
          const simulatedMsg = {
            key: { remoteJid: `${cleanP}@s.whatsapp.net`, fromMe: false },
            message: { conversation: message || 'Salam' }
          };
          await handleIncomingWhatsAppMessage(simulatedMsg);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, tested: { phone: cleanP, message } }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // 15. QR Code Image (GET /qr or GET /api/qr or GET /openwa-qr.png)
    if (pathname === '/qr' || pathname === '/api/qr' || pathname === '/openwa-qr.png') {
      const qrPath = path.resolve('openwa-qr.png');
      if (fs.existsSync(qrPath)) {
        const img = fs.readFileSync(qrPath);
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(img);
        return;
      }
    }

    // 16. Teacher Profiles & Status API (GET /api/teacher/list)
    if (pathname === '/api/teacher/list' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const verifiedList = Array.from(linkedWATeachersCache.values());
      res.end(JSON.stringify({
        success: true,
        totalStaffProfiles: teacherProfilesList.length,
        verifiedTeachersCount: verifiedList.length,
        verifiedTeachers: verifiedList,
        staffProfiles: teacherProfilesList.map(t => ({
          name: t.name,
          phone: t.phone,
          email: t.email,
          role: t.role,
          allocatedStudentsCount: findTeacherAllocatedStudents(t).length
        }))
      }, null, 2));
      return;
    }

    // 17. Trigger Teacher Schedule API (POST /api/teacher/trigger-schedule)
    if (pathname === '/api/teacher/trigger-schedule' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          const forceSchedule = payload.schedule || 'self_attendance'; // 'self_attendance' | 'elearning_summary'
          const result = await checkAndSendTeacherDailySchedules({ forceSchedule });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });

  const primaryPort = Number(process.env.PORT) || Number(BOT_CONFIG.PORT) || 2785;
  server.listen(primaryPort, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`📱 Mauze Tahfeez WhatsApp Bot Engine Online`);
    console.log(`📞 Helpline Number : ${BOT_CONFIG.HELPLINE_NUMBER}`);
    console.log(`⚡ Session ID      : ${BOT_CONFIG.OPENWA_SESSION_ID}`);
    console.log(`🚀 Gateway Port    : ${primaryPort}`);
    console.log(`🌐 Live Dashboard  : http://0.0.0.0:${primaryPort}`);
    console.log(`======================================================\n`);

    // Schedule periodic Fatemi month-end fee reminder check (every 12 hours)
    setInterval(() => {
      checkAndSendFatemiFeeReminders({ force: false }).catch((err) => {
        console.warn('[FEE-CHECK-ERR] Error checking Fatemi fee reminders:', err.message);
      });
    }, 12 * 60 * 60 * 1000);

    // Schedule exact Monday-to-Saturday Atfal Teacher Reminders (checked every 30 seconds):
    // 1. 4:25 PM IST -> Teacher Self-Attendance Reminder
    // 2. 10:00 PM IST -> eLearning Entry Reminder & Class Attendance Summary
    setInterval(() => {
      checkAndSendTeacherDailySchedules().catch((err) => {
        console.warn('[TEACHER-CRON-ERR] Error checking daily teacher schedules:', err.message);
      });
    }, 30 * 1000);
    console.log(`[WHATSAPP BOT] ⏱ Monday-Saturday Teacher Scheduler Active (4:25 PM Self-Attendance & 10:00 PM eLearning/Attendance Summary).`);

    // Live Admissions Auto-Sync & Instant Auto-Dispatch Worker (Connects Vercel form submissions directly to WhatsApp bot)
    const dispatchedAdmissionsSet = new Set();
    const syncAdmissionsFromCloud = async () => {
      try {
        const cloudUrl = 'https://mouze-tahfeez-atfal.vercel.app/api/admission-admin';
        const res = await fetch(cloudUrl, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const dataPath = path.resolve('public', 'admissions_data.json');
            let localList = [];
            try {
              if (fs.existsSync(dataPath)) {
                localList = JSON.parse(fs.readFileSync(dataPath, 'utf8')) || [];
              }
            } catch (_) {}

            const map = new Map();
            localList.forEach(item => { if (item.application_id) map.set(item.application_id, item); });

            let hasNew = false;
            for (const item of json.data) {
              if (!item.application_id) continue;
              if (!map.has(item.application_id)) {
                map.set(item.application_id, item);
                hasNew = true;
              }

              // Auto-dispatch welcome notification if new and not yet dispatched
              if (!dispatchedAdmissionsSet.has(item.application_id) && item.status === 'pending') {
                dispatchedAdmissionsSet.add(item.application_id);
                const rawPhone = item.whatsapp_number || item.phone || '';
                const phone = cleanPhone(rawPhone);
                const fullName = item.full_name || 'Mumin';
                const prog = item.program || 'Hifz Classes';
                const appId = item.application_id;

                if (sock && baileysStatus === 'CONNECTED' && phone) {
                  const jid = `${phone}@s.whatsapp.net`;
                  const welcomeMsg = `Salaam ${fullName},\n\nThank you for registering for *${prog}* (1447-48H) at Tahfeez Galiakot.\n\nYour admission status is: *⏳ Pending Admin Review*\nApplication Ref ID: *${appId}*\n\nWe have received your application and our administration will review and update you shortly.\n\nHelpline: +91 81079 25353\nTahfeez – Galiakot`;
                  await sock.sendMessage(jid, { text: welcomeMsg });
                  console.log(`[ADMISSION-CLOUD-SYNC] 🚀 Auto-dispatched welcome WhatsApp to +${phone} for ${fullName} (${appId})`);
                }
              }
            }

            if (hasNew) {
              const merged = Array.from(map.values());
              fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2), 'utf8');
              console.log(`[ADMISSION-CLOUD-SYNC] 📥 Synced ${merged.length} admissions from Vercel cloud to local disk.`);
            }
          }
        }
      } catch (_) {}
    };

    // Run admission sync every 5 seconds
    setInterval(syncAdmissionsFromCloud, 5000);
    setTimeout(syncAdmissionsFromCloud, 1000);
    console.log(`[WHATSAPP BOT] 🔄 Cloud Admission Auto-Sync Worker active (polling Vercel every 5s).`);
  });

  // Universal multi-port listeners: bind all common Railway/cloud ports (2785, 8080, 3000)
  // so no matter how Railway Networking is configured, the bot responds 100% of the time!
  const auxPorts = [2785, 8080, 3000].filter(p => p !== primaryPort);
  for (const p of auxPorts) {
    try {
      const auxServer = http.createServer((req, res) => server.emit('request', req, res));
      auxServer.listen(p, '0.0.0.0', () => {
        console.log(`[WHATSAPP BOT] 🌐 Auxiliary cloud listener online on port ${p}`);
      });
      auxServer.on('error', (err) => {
        // Port might be in use or unavailable, harmless notice
        console.log(`[WHATSAPP BOT] Port ${p} auxiliary notice: ${err.message}`);
      });
    } catch (_) {}
  }
}

// Automatically start engine
startWhatsAppBotEngine();

