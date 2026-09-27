/**
 * Mauze Tahfeez - Telegram Bot Webhook & Result Dispatch Service
 * 
 * Bot Name: Rawdat Tahfeez al Atfal (@Mh_Design_bot)
 * Helpline Number: +91 81079 25353
 * 
 * Features:
 * 1. Automatic one-way notification & helpline responder:
 *    Any incoming message sends the official Mauze Tahfeez Helpline (+91 81079 25353).
 * 2. Mobile Number Verification:
 *    Parents can share their phone number to receive their child's result card.
 * 3. Search with Different Number (Child Name & Code verification):
 *    If using a different phone number, asks for Child Name + Security Code (ITS / Student ID)
 *    and verifies before delivering the Result Summary Image Card.
 * 4. High-resolution vector SVG -> PNG result summary card generator.
 * 5. Webhook registration endpoint (?action=set_webhook).
 */

import { Resvg } from '@resvg/resvg-js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
let embeddedRoster = [];
try {
  embeddedRoster = require('./students-roster.json');
} catch (e) {
  console.warn('[TelegramWebhook] Could not load embedded students-roster.json:', e);
}

let runtimeSheetsWebhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';

// In-memory + /tmp persistence for live student attendance updates (keys: phone, its, name, studentId, chatId)
const latestAttendanceMap = new Map();
const TMP_ATTENDANCE_PATH = path.join('/tmp', 'latest_attendance.json');

function saveAttendanceRecord(key, record) {
  if (!key) return;
  latestAttendanceMap.set(key, record);
  try {
    let diskData = {};
    if (fs.existsSync(TMP_ATTENDANCE_PATH)) {
      diskData = JSON.parse(fs.readFileSync(TMP_ATTENDANCE_PATH, 'utf8') || '{}');
    }
    diskData[key] = record;
    fs.writeFileSync(TMP_ATTENDANCE_PATH, JSON.stringify(diskData));
  } catch (_) {}
}

function getStoredAttendanceRecord(key) {
  if (!key) return null;
  if (latestAttendanceMap.has(key)) {
    return latestAttendanceMap.get(key);
  }
  try {
    if (fs.existsSync(TMP_ATTENDANCE_PATH)) {
      const diskData = JSON.parse(fs.readFileSync(TMP_ATTENDANCE_PATH, 'utf8') || '{}');
      if (diskData[key]) {
        latestAttendanceMap.set(key, diskData[key]);
        return diskData[key];
      }
    }
  } catch (_) {}
  return null;
}

function findStudentAttendance(student, chatId) {
  const cId = chatId ? String(chatId) : '';
  const phone = cleanPhone(student?.phone || '');
  const its = String(student?.its || '').trim();
  const name = String(student?.name || '').trim().toLowerCase();
  const sId = String(student?.student_id || student?.id || '').trim();

  return (
    getStoredAttendanceRecord(`chatId:${cId}`) ||
    getStoredAttendanceRecord(`its:${its}`) ||
    getStoredAttendanceRecord(`phone:${phone}`) ||
    getStoredAttendanceRecord(`id:${sId}`) ||
    getStoredAttendanceRecord(`name:${name}`) ||
    student?.latestAttendance ||
    null
  );
}

function getFontFiles() {
  const candidates = [
    path.join(__dirname, 'fonts', 'arial.ttf'),
    path.join(process.cwd(), 'api', 'fonts', 'arial.ttf'),
    path.join(__dirname, 'fonts', 'al-kanz.ttf'),
    path.join(process.cwd(), 'api', 'fonts', 'al-kanz.ttf')
  ];
  return Array.from(new Set(candidates.filter(f => {
    try { return fs.existsSync(f); } catch (_) { return false; }
  })));
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8794720432:AAF3F4rbcCnApXk5Jec4D5oLTXiEnPRxb1o';
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const HELPLINE_NUMBER = '+91 81079 25353';
const HELPLINE_NAME = 'Rawdat Tahfeez al Atfal Helpline';
const ACADEMY_NAME = 'Rawdat Tahfeez al Atfal';
const PORTAL_URL = 'https://mouze-tahfeez-atfal.vercel.app';

// In-memory rate limiting & safety anti-bruteforce (per chatId)
const safetyLimits = new Map(); // chatId -> { count, firstTimestamp, blockedUntil, failCount }

function checkSafetyLimit(chatId) {
  const now = Date.now();
  let record = safetyLimits.get(chatId);
  if (!record) {
    record = { count: 1, firstTimestamp: now, blockedUntil: 0, failCount: 0 };
    safetyLimits.set(chatId, record);
    return { allowed: true };
  }

  // Active safety cooldown
  if (record.blockedUntil && now < record.blockedUntil) {
    const secLeft = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      reason: `⚠️ *Safety Cooldown Active*\n\nFor student data privacy, please wait ${secLeft}s before trying again, or call our helpline: \`${HELPLINE_NUMBER}\`.`
    };
  }

  // Sliding 60-second window
  if (now - record.firstTimestamp > 60000) {
    record.count = 1;
    record.firstTimestamp = now;
  } else {
    record.count += 1;
    if (record.count > 25) {
      record.blockedUntil = now + 60000;
      return {
        allowed: false,
        reason: `⚠️ *Safety Notice*\n\nToo many requests in a short period. Please wait 1 minute before trying again.`
      };
    }
  }

  return { allowed: true };
}

function recordSafetyFail(chatId) {
  const now = Date.now();
  let record = safetyLimits.get(chatId);
  if (!record) {
    record = { count: 1, firstTimestamp: now, blockedUntil: 0, failCount: 1 };
    safetyLimits.set(chatId, record);
  } else {
    record.failCount = (record.failCount || 0) + 1;
    if (record.failCount >= 5) {
      record.blockedUntil = now + 120000; // 2 minutes lockout on 5 bad attempts
      record.failCount = 0;
    }
  }
}

function recordSafetySuccess(chatId) {
  let record = safetyLimits.get(chatId);
  if (record) record.failCount = 0;
}

// Strict input sanitization (removes dangerous characters and bounds length)
function sanitizeInput(str, maxLen = 60) {
  if (!str) return '';
  return String(str)
    .replace(/[<>{}\\]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .substring(0, maxLen);
}

// Security code format check (4 to 16 alphanumeric characters)
function isValidSecurityCode(code) {
  if (!code) return false;
  return /^[a-zA-Z0-9]{4,16}$/.test(String(code).trim());
}

// Helper to escape XML/SVG special chars safely
function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Clean phone number to digits only (e.g. +91 81079 25353 -> 918107925353)
function cleanPhone(raw) {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits;
  else if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.substring(1);
  return digits;
}

// Ultra-premium vector SVG card for weekly result
function generateMarhalaResultSvg(data) {
  const name = String(data.name || 'Student Name').trim();
  const fromDate = String(data.fromDate || '—').trim();
  const tillDate = String(data.tillDate || '—').trim();
  const score = (data.weeklyScore !== undefined && data.weeklyScore !== '' && data.weeklyScore !== null) ? String(data.weeklyScore) : '—';
  const jadeed = String(data.totalJadeed || '—').trim();
  const marhalaRank = String(data.marhalaRank || '—').trim();
  const overallRank = String(data.overallRank || '—').trim();
  const helpline = data.helpline || HELPLINE_NUMBER;

  let dateRange = 'Current Academic Week';
  if (fromDate && tillDate && fromDate !== '—' && tillDate !== '—') {
    dateRange = `${fromDate} ➔ ${tillDate}`;
  } else if (tillDate && tillDate !== '—') {
    dateRange = tillDate;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a192f" />
      <stop offset="45%" stop-color="#0f2747" />
      <stop offset="100%" stop-color="#06101e" />
    </linearGradient>

    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fae29c" />
      <stop offset="50%" stop-color="#d4af37" />
      <stop offset="100%" stop-color="#aa7c11" />
    </linearGradient>

    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#142c4c" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0d1e35" stop-opacity="0.95" />
    </linearGradient>

    <linearGradient id="metricGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#163459" />
      <stop offset="100%" stop-color="#0e233d" />
    </linearGradient>

    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect width="1080" height="1350" fill="url(#bgGrad)" />
  <rect x="30" y="30" width="1020" height="1290" rx="28" fill="none" stroke="url(#goldGrad)" stroke-width="4" stroke-opacity="0.85" />
  <rect x="42" y="42" width="996" height="1266" rx="22" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-opacity="0.4" />

  <circle cx="50" cy="50" r="8" fill="#d4af37" />
  <circle cx="1030" cy="50" r="8" fill="#d4af37" />
  <circle cx="50" cy="1300" r="8" fill="#d4af37" />
  <circle cx="1030" cy="1300" r="8" fill="#d4af37" />

  <text x="540" y="115" font-family="Al-Kanz, Arial, sans-serif" font-size="34" fill="#fae29c" text-anchor="middle" font-weight="bold" letter-spacing="2">
    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
  </text>

  <text x="540" y="170" font-family="Arial, Al-Kanz, sans-serif" font-size="28" fill="#ffffff" text-anchor="middle" font-weight="700" letter-spacing="3">
    RAWDAT TAHFEEZ AL ATFAL
  </text>
  <text x="540" y="205" font-family="Arial, Al-Kanz, sans-serif" font-size="16" fill="#fae29c" text-anchor="middle" font-weight="600" letter-spacing="5">
    DARA SA'ADATIL ABADIYAH • GALIAKOT SHARIF
  </text>

  <line x1="240" y1="235" x2="840" y2="235" stroke="url(#goldGrad)" stroke-width="2" />
  <polygon points="540,227 548,235 540,243 532,235" fill="#fae29c" />

  <rect x="340" y="260" width="400" height="42" rx="21" fill="url(#goldGrad)" />
  <text x="540" y="287" font-family="Arial, Al-Kanz, sans-serif" font-size="16" fill="#0a192f" text-anchor="middle" font-weight="800" letter-spacing="2">
    WEEKLY MARHALA REPORT
  </text>

  <rect x="80" y="335" width="920" height="235" rx="24" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2.5" />
  
  <text x="540" y="380" font-family="Arial, Al-Kanz, sans-serif" font-size="16" fill="#93aed0" text-anchor="middle" font-weight="600" letter-spacing="3">
    STUDENT PERFORMANCE SUMMARY
  </text>

  <text x="540" y="450" font-family="Arial, Al-Kanz, sans-serif" font-size="46" fill="#fae29c" text-anchor="middle" font-weight="800" filter="url(#glow)">
    ${escapeXml(name)}
  </text>

  <rect x="270" y="490" width="540" height="44" rx="22" fill="#09182d" stroke="#335987" stroke-width="1.5" />
  <text x="540" y="518" font-family="Arial, Al-Kanz, sans-serif" font-size="17" fill="#e2edfc" text-anchor="middle" font-weight="600">
    📅 Week: ${escapeXml(dateRange)}
  </text>

  <rect x="80" y="605" width="440" height="235" rx="20" fill="url(#metricGrad)" stroke="#224773" stroke-width="2" />
  <circle cx="135" cy="660" r="26" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="2" />
  <text x="135" y="667" font-family="Arial, sans-serif" font-size="20" fill="#10b981" text-anchor="middle">★</text>
  <text x="180" y="665" font-family="Arial, sans-serif" font-size="18" fill="#93aed0" font-weight="700" letter-spacing="1">WEEKLY SCORE</text>
  <text x="300" y="745" font-family="Arial, sans-serif" font-size="64" fill="#ffffff" font-weight="900" text-anchor="middle">${escapeXml(score)}</text>
  <text x="300" y="785" font-family="Arial, sans-serif" font-size="16" fill="#10b981" font-weight="700" text-anchor="middle">✔ Complete Weekly Evaluation</text>

  <rect x="560" y="605" width="440" height="235" rx="20" fill="url(#metricGrad)" stroke="#224773" stroke-width="2" />
  <circle cx="615" cy="660" r="26" fill="#3b82f6" fill-opacity="0.2" stroke="#3b82f6" stroke-width="2" />
  <text x="615" y="667" font-family="Arial, sans-serif" font-size="19" fill="#3b82f6" text-anchor="middle">📖</text>
  <text x="660" y="665" font-family="Arial, sans-serif" font-size="18" fill="#93aed0" font-weight="700" letter-spacing="1">TOTAL JADEED</text>
  <text x="780" y="745" font-family="Arial, Al-Kanz, sans-serif" font-size="44" fill="#fae29c" font-weight="900" text-anchor="middle">${escapeXml(jadeed)}</text>
  <text x="780" y="785" font-family="Arial, sans-serif" font-size="16" fill="#93aed0" font-weight="600" text-anchor="middle">New Memorization Progress</text>

  <rect x="80" y="870" width="440" height="220" rx="20" fill="url(#metricGrad)" stroke="#224773" stroke-width="2" />
  <circle cx="135" cy="925" r="26" fill="#f59e0b" fill-opacity="0.2" stroke="#f59e0b" stroke-width="2" />
  <text x="135" y="932" font-family="Arial, sans-serif" font-size="20" fill="#f59e0b" text-anchor="middle">👑</text>
  <text x="180" y="930" font-family="Arial, sans-serif" font-size="18" fill="#93aed0" font-weight="700" letter-spacing="1">MARHALA RANK</text>
  <text x="300" y="1010" font-family="Arial, sans-serif" font-size="56" fill="#fae29c" font-weight="900" text-anchor="middle">#${escapeXml(marhalaRank)}</text>
  <text x="300" y="1048" font-family="Arial, sans-serif" font-size="15" fill="#f59e0b" font-weight="700" text-anchor="middle">🏅 Section Standing</text>

  <rect x="560" y="870" width="440" height="220" rx="20" fill="url(#metricGrad)" stroke="#224773" stroke-width="2" />
  <circle cx="615" cy="925" r="26" fill="#8b5cf6" fill-opacity="0.2" stroke="#8b5cf6" stroke-width="2" />
  <text x="615" y="932" font-family="Arial, sans-serif" font-size="20" fill="#8b5cf6" text-anchor="middle">🌟</text>
  <text x="660" y="930" font-family="Arial, sans-serif" font-size="18" fill="#93aed0" font-weight="700" letter-spacing="1">OVERALL RANK</text>
  <text x="780" y="1010" font-family="Arial, sans-serif" font-size="56" fill="#fae29c" font-weight="900" text-anchor="middle">#${escapeXml(overallRank)}</text>
  <text x="780" y="1048" font-family="Arial, sans-serif" font-size="15" fill="#a78bfa" font-weight="700" text-anchor="middle">🏆 Academy Standing</text>

  <rect x="260" y="1120" width="560" height="44" rx="22" fill="#0d2847" stroke="#10b981" stroke-width="1.8" />
  <text x="540" y="1148" font-family="Arial, sans-serif" font-size="16" fill="#34d399" text-anchor="middle" font-weight="700">
    ✔ Verified Official Record • Latest Academic Week
  </text>

  <line x1="80" y1="1195" x2="1000" y2="1195" stroke="url(#goldGrad)" stroke-width="1.5" stroke-opacity="0.5" />
  
  <rect x="160" y="1220" width="760" height="52" rx="26" fill="#132a48" stroke="url(#goldGrad)" stroke-width="2" />
  <text x="540" y="1253" font-family="Arial, sans-serif" font-size="17" fill="#fae29c" text-anchor="middle" font-weight="800" letter-spacing="1">
    📞 HELPLINE: ${escapeXml(helpline)} • RAWDAT TAHFEEZ AL ATFAL
  </text>
</svg>`;
}

// Convert SVG to PNG buffer with embedded fonts
function renderSvgToPng(svg) {
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
  const resvg = new Resvg(svg, opts);
  const pngData = resvg.render();
  return pngData.asPng();
}

// Send text message via Telegram API (with plain-text retry fallback)
async function sendTelegramMessage(chatId, text, extra = {}) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      ...extra
    };

    let res = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let resJson = await res.json();
    if (!resJson.ok) {
      console.warn('[Telegram sendMessage retry with plain text]:', resJson);
      delete payload.parse_mode;
      res = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      resJson = await res.json();
    }
    return resJson;
  } catch (err) {
    console.error('sendTelegramMessage error:', err);
    return { ok: false, error: err.message };
  }
}

// Send photo (result card PNG) via Telegram API
async function sendTelegramPhoto(chatId, pngBuffer, caption, extra = {}) {
  try {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    const blob = new Blob([pngBuffer], { type: 'image/png' });
    form.append('photo', blob, 'Weekly_Result_Summary.png');
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');

    if (extra.reply_markup) {
      form.append('reply_markup', JSON.stringify(extra.reply_markup));
    }

    let res = await fetch(`${TELEGRAM_API_BASE}/sendPhoto`, {
      method: 'POST',
      body: form
    });

    let resJson = await res.json();
    if (!resJson.ok) {
      console.warn('[sendPhoto fallback to message]:', resJson);
      return await sendTelegramMessage(chatId, caption, extra);
    }
    return resJson;
  } catch (err) {
    console.error('sendTelegramPhoto error:', err);
    return await sendTelegramMessage(chatId, caption, extra);
  }
}

// Build formatted caption for result card
function buildResultCaption(data) {
  const name = sanitizeInput(data.name || 'Student', 50);
  const fromDate = data.fromDate || '';
  const tillDate = data.tillDate || '';
  const score = data.weeklyScore || '—';
  const jadeed = data.totalJadeed || '—';
  const mRank = data.marhalaRank || '—';
  const oRank = data.overallRank || '—';
  const dateStr = (fromDate && tillDate && fromDate !== '—') ? `${fromDate} to ${tillDate}` : (tillDate || 'Latest Academic Week');

  return `*RAWDAT TAHFEEZ AL ATFAL - WEEKLY RESULT SUMMARY*\n` +
    `_Dara Sa'adatil Abadiyah, Galiakot Sharif_\n\n` +
    `Student: *${name}*\n` +
    `📅 Period: ${dateStr}\n\n` +
    `📊 *Weekly Score:* ${score} / 100\n` +
    `📖 *Total Jadeed:* ${jadeed}\n` +
    `👑 *Marhala Rank:* #${mRank}\n` +
    `🌟 *Overall Rank:* #${oRank}\n\n` +
    `📞 *Helpline Number:* ${HELPLINE_NUMBER}\n` +
    `🌐 *Online Portal:* ${PORTAL_URL}`;
}

// In-memory cache for linked subscribers (chatId -> student data)
const linkedSubscribersCache = new Map();

// Standard keyboard for new / unverified visitors
function getStandardKeyboard() {
  return {
    keyboard: [
      [
        { text: '📱 Check My Child Result', request_contact: true }
      ],
      [
        { text: '🔐 Verify & Link Child Profile' },
        { text: '📞 Helpline Number' }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

// Dedicated keyboard for verified & linked parents
function getLinkedKeyboard(childName = '') {
  return {
    keyboard: [
      [
        { text: '📊 View Weekly Result Card' },
        { text: '📋 Today Attendance' }
      ],
      [
        { text: '📝 Leave Status' },
        { text: '📅 Jadwal Schedule' }
      ],
      [
        { text: '👤 Linked Child Profile' },
        { text: '📞 Helpline Number' }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

// Send the official welcome template (Starts with Salam Jameel, uses Rawdat Tahfeez al Atfal only)
async function sendHelplineWelcome(chatId) {
  const text = `Salam Jameel\n\n` +
    `Welcome to the Rawdat Tahfeez al Atfal\n` +
    `This the only automation bot for official student weekly result updates and announcements.\n\n` +
    `📞 *Helpline Number:*\n` +
    `\`${HELPLINE_NUMBER}\`\n\n` +
    `For any assistance, admission queries, or student progress details, please call or WhatsApp our helpline.\n\n` +
    `📌 *Quick Access Options:*\n` +
    `• Tap *📱 Check My Child Result* below to link your child using your registered mobile number.\n` +
    `• If you are using a different mobile number, tap *🔐 Verify & Link Child Profile* or send:\n` +
    `  \`/verify [Profile Contact], [Child Name], [ITS]\`\n` +
    `  _(Example: \`/verify 9876543210, Taher Shabbir, 50401002\`)_\n\n` +
    `🌐 *Online Portal:* ${PORTAL_URL}`;

  return await sendTelegramMessage(chatId, text, {
    reply_markup: getStandardKeyboard()
  });
}

// Send welcome for already linked parents
async function sendLinkedWelcome(chatId, student) {
  const studentName = student?.name || 'Student';
  const text = `Salam Jameel\n\n` +
    `Welcome to Rawdat Tahfeez al Atfal Bot.\n` +
    `Your Telegram is securely linked to *${sanitizeInput(studentName)}* (ITS: \`${student?.its || 'Verified'}\`).\n\n` +
    `You receive real-time automatic updates for:\n` +
    `✔ Daily Attendance (Present/Absent/Late)\n` +
    `✔ Leave Requests & Approvals\n` +
    `✔ Jadwal / Timetable Changes\n` +
    `✔ Weekly Result Announcements\n\n` +
    `📞 *Helpline Number:* \`${HELPLINE_NUMBER}\``;

  return await sendTelegramMessage(chatId, text, {
    reply_markup: getLinkedKeyboard(studentName)
  });
}

// Send ONLY the helpline number when user asks for helpline/contact
async function sendHelplineOnly(chatId, student = null) {
  const text = `📞 *Helpline Number:*\n` +
    `\`${HELPLINE_NUMBER}\`\n\n` +
    `_(Available on Call and WhatsApp for all queries and assistance)_`;

  return await sendTelegramMessage(chatId, text, {
    reply_markup: student ? getLinkedKeyboard(student.name) : getStandardKeyboard()
  });
}

// Query Google Sheets Webhook or fallback student data
async function queryStudentFromSheets(sheetsWebhookUrl, queryParam) {
  if (sheetsWebhookUrl) {
    try {
      const res = await fetch(sheetsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search_student',
          ...queryParam
        })
      });
      const json = await res.json();
      if (json && json.success && json.student) {
        return json.student;
      }
    } catch (err) {
      console.warn('[TelegramWebhook] Sheets lookup failed:', err.message);
    }
  }

  // Resilient fallback to embedded student roster
  return lookupStudentFallback(queryParam);
}

// Fallback search in embedded roster (supports 10-digit resilient mobile matching)
function lookupStudentFallback(queryParam) {
  const targetPhone = cleanPhone(queryParam.phone || '');
  const targetName = String(queryParam.name || '').trim().toLowerCase();
  const targetCode = String(queryParam.code || queryParam.its || '').trim().toLowerCase();

  for (const s of embeddedRoster) {
    const sPhone = cleanPhone(s.phone || '');
    // 1. Phone match (check exact or last 10 digits)
    if (targetPhone) {
      const phoneMatch = sPhone === targetPhone || (sPhone.length >= 10 && targetPhone.length >= 10 && sPhone.slice(-10) === targetPhone.slice(-10));
      if (phoneMatch) return s;
    }

    // 2. Name + Code match
    if (targetName && targetCode) {
      const sName = String(s.name || '').toLowerCase();
      const sIts = String(s.its || '').toLowerCase();
      const sPhoneDigits = sPhone.slice(-10);
      if ((sName.includes(targetName) || targetName.includes(sName)) && (sIts === targetCode || sPhoneDigits === targetCode)) {
        return s;
      }
    }
  }
  return null;
}

// Query linked student for this chatId
async function getLinkedStudent(sheetsWebhookUrl, chatId) {
  const cached = linkedSubscribersCache.get(String(chatId));
  if (cached) return cached;

  if (sheetsWebhookUrl) {
    try {
      const res = await fetch(sheetsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_linked_student',
          chatId: String(chatId)
        })
      });
      const json = await res.json();
      if (json && json.success && json.linked && json.student) {
        linkedSubscribersCache.set(String(chatId), json.student);
        return json.student;
      }
    } catch (err) {
      console.warn('[TelegramWebhook] getLinkedStudent failed:', err.message);
    }
  }
  return null;
}

// Perform 3-Point Security Verification against student profile
async function verifyThreePoint(sheetsWebhookUrl, profilePhone, childName, its, chatId) {
  if (sheetsWebhookUrl) {
    try {
      const res = await fetch(sheetsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_three_point',
          profilePhone: cleanPhone(profilePhone),
          childName: sanitizeInput(childName),
          its: sanitizeInput(its),
          chatId: String(chatId)
        })
      });
      const json = await res.json();
      if (json && json.success && json.verified && json.student) {
        linkedSubscribersCache.set(String(chatId), json.student);
        return { success: true, verified: true, student: json.student };
      }
    } catch (err) {
      console.warn('[TelegramWebhook] verifyThreePoint sheets failed:', err.message);
    }
  }

  // Resilient fallback against embedded student roster
  const pPhone = cleanPhone(profilePhone);
  const cName = sanitizeInput(childName).toLowerCase();
  const cIts = sanitizeInput(its).toLowerCase();

  for (const s of embeddedRoster) {
    const sPhone = cleanPhone(s.phone || '');
    const sName = String(s.name || '').toLowerCase();
    const sIts = String(s.its || '').toLowerCase();

    const phoneMatch = sPhone === pPhone || (sPhone.length >= 10 && pPhone.length >= 10 && sPhone.slice(-10) === pPhone.slice(-10));
    const nameMatch = sName.includes(cName) || cName.includes(sName);
    const itsMatch = sIts === cIts;

    if (phoneMatch && nameMatch && itsMatch) {
      linkedSubscribersCache.set(String(chatId), s);
      return { success: true, verified: true, student: s };
    }
  }

  return { success: false, verified: false, error: 'Verification mismatch' };
}

// Unlink Telegram Chat ID
async function unlinkTelegram(sheetsWebhookUrl, chatId) {
  linkedSubscribersCache.delete(String(chatId));
  if (!sheetsWebhookUrl) return true;
  try {
    await fetch(sheetsWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'unlink_telegram',
        chatId: String(chatId)
      })
    });
  } catch (_) {}
  return true;
}

async function parseBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch (_) { return {}; }
    }
    return req.body;
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (_) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query || {};
  const headers = req.headers || {};
  if (query.sheets_url) {
    runtimeSheetsWebhookUrl = query.sheets_url;
  }
  const sheetsWebhookUrl = query.sheets_url || runtimeSheetsWebhookUrl || process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';

  // 1. GET Requests: Diagnostics & Webhook Management
  if (req.method === 'GET') {
    const action = query.action || 'info';

    // Store sheets webhook URL dynamically
    if (action === 'set_sheets_url' && query.url) {
      runtimeSheetsWebhookUrl = query.url;
      return res.status(200).json({ status: 'ok', sheets_url: runtimeSheetsWebhookUrl });
    }

    // Set Webhook to this Vercel deployment
    if (action === 'set_webhook') {
      const host = req.headers.host || 'mouze-tahfeez-atfal.vercel.app';
      const targetSheetsUrl = query.sheets_url || runtimeSheetsWebhookUrl;
      const webhookUrl = targetSheetsUrl
        ? `https://${host}/api/telegram-webhook?sheets_url=${encodeURIComponent(targetSheetsUrl)}`
        : `https://${host}/api/telegram-webhook`;
      try {
        const tgRes = await fetch(`${TELEGRAM_API_BASE}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            drop_pending_updates: false,
            allowed_updates: ['message', 'callback_query']
          })
        });
        const tgData = await tgRes.json();
        return res.status(200).json({
          status: 'ok',
          action: 'set_webhook',
          webhookUrl,
          telegramResponse: tgData
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // Get Webhook Info
    if (action === 'get_webhook_info') {
      try {
        const infoRes = await fetch(`${TELEGRAM_API_BASE}/getWebhookInfo`);
        const infoData = await infoRes.json();
        return res.status(200).json(infoData);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // Default: Info
    return res.status(200).json({
      service: 'Mauze Tahfeez Telegram Bot Webhook',
      bot: '@Mh_Design_bot',
      helpline: HELPLINE_NUMBER,
      portal: PORTAL_URL,
      time: new Date().toISOString()
    });
  }

  // 2. POST Requests
  if (req.method === 'POST') {
    const body = await parseBody(req);
    console.log('[Telegram Webhook Update]:', JSON.stringify(body));

    // ── Direct API Action: Set Webhook ──
    if (body.action === 'set_webhook' || query.action === 'set_webhook') {
      const host = headers.host || 'mouze-tahfeez-atfal.vercel.app';
      const webhookUrl = `https://${host}/api/telegram-webhook`;
      const tgRes = await fetch(`${TELEGRAM_API_BASE}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      });
      const tgData = await tgRes.json();
      return res.status(200).json({ success: true, webhookUrl, telegramResponse: tgData });
    }

    // ── Direct API Action: Dispatch single student result card from app ──
    if (body.action === 'send_result_image') {
      const { chatId, studentData } = body;
      if (!chatId || !studentData) {
        return res.status(400).json({ error: 'chatId and studentData required' });
      }

      try {
        const svg = generateMarhalaResultSvg(studentData);
        const png = renderSvgToPng(svg);
        const caption = buildResultCaption(studentData);
        const tgRes = await sendTelegramPhoto(chatId, png, caption);
        return res.status(200).json({ success: true, telegramResponse: tgRes });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ── Direct API Action: Push Live Student Update (Attendance / Leave / Jadwal / Result) ──
    if (body.action === 'notify_student_update') {
      const { type, student, details, studentId, phone, its, name } = body;
      const targetPhone = cleanPhone(phone || student?.phone || '');
      const targetIts = String(its || student?.its || studentId || '').trim();
      const targetName = String(name || student?.name || '').trim();

      let chatIds = [];
      if (body.chatId) {
        chatIds.push(String(body.chatId));
      } else if (sheetsWebhookUrl) {
        try {
          const subRes = await fetch(sheetsWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'get_student_subscribers',
              phone: targetPhone,
              its: targetIts,
              name: targetName
            })
          });
          const subData = await subRes.json();
          if (subData && subData.chatIds && Array.isArray(subData.chatIds)) {
            chatIds = subData.chatIds.map(String);
          }
        } catch (e) {
          console.warn('[Telegram Webhook] Error fetching student subscribers:', e);
        }
      }

      // Merge memory cache subscribers
      for (const [cId, stu] of linkedSubscribersCache.entries()) {
        const cPhone = cleanPhone(stu.phone || '');
        const cIts = String(stu.its || '').trim();
        const cName = String(stu.name || '').trim().toLowerCase();
        if (
          (targetIts && cIts === targetIts) ||
          (targetPhone && cPhone === targetPhone) ||
          (targetName && cName.includes(targetName.toLowerCase()))
        ) {
          if (!chatIds.includes(String(cId))) chatIds.push(String(cId));
        }
      }

      const studentDisplayName = targetName || student?.name || 'Student';
      let notificationMsg = '';

      if (type === 'attendance') {
        const rawStatus = details?.status || details?.attendanceStatus || 'Present';
        const attStatus = /absent/i.test(rawStatus)
          ? 'Absent'
          : (/leave|uzur/i.test(rawStatus) ? 'Excused (Leave)' : 'Present');
        const attDate = details?.date || new Date().toLocaleDateString('en-GB');
        const statusEmoji = attStatus === 'Absent' ? '❌' : (attStatus === 'Present' ? '✅' : '📝');

        const record = {
          status: attStatus,
          statusEmoji: statusEmoji,
          date: attDate,
          name: studentDisplayName,
          phone: targetPhone,
          its: targetIts,
          studentId: String(studentId || ''),
          updatedAt: Date.now()
        };

        if (targetPhone) saveAttendanceRecord(`phone:${targetPhone}`, record);
        if (targetIts) saveAttendanceRecord(`its:${targetIts}`, record);
        if (targetName) saveAttendanceRecord(`name:${targetName.toLowerCase()}`, record);
        if (studentId) saveAttendanceRecord(`id:${String(studentId)}`, record);
        for (const cId of chatIds) {
          saveAttendanceRecord(`chatId:${String(cId)}`, record);
        }

        notificationMsg = `📋 *Daily Attendance Update*\n` +
          `Student: *${sanitizeInput(studentDisplayName)}*\n` +
          `📅 Date: ${attDate}\n` +
          `Status: ${statusEmoji} ${attStatus}\n\n` +
          `Rawdat Tahfeez al Atfal`;
      }

      if (chatIds.length === 0) {
        return res.status(200).json({ success: true, delivered: 0, note: 'Attendance recorded; no linked subscribers found' });
      } else if (type === 'leave') {
        const lvStatus = details?.status || 'Update';
        const statusEmoji = /approved/i.test(lvStatus) ? '✅' : (/rejected/i.test(lvStatus) ? '❌' : '⏳');
        const fromDate = details?.fromDate || details?.from_date || '';
        const toDate = details?.toDate || details?.to_date || '';
        const periodStr = fromDate && toDate ? `${fromDate} ➔ ${toDate}` : (fromDate || 'Scheduled dates');
        notificationMsg = `📝 *Leave Application Update*\n\n` +
          `Student: *${sanitizeInput(studentDisplayName)}*\n` +
          `📅 Period: ${periodStr}\n` +
          `Status: ${statusEmoji} *${lvStatus}*\n` +
          (details?.comment || details?.adminComment ? `💬 Remark: ${sanitizeInput(details.comment || details.adminComment)}\n` : '') +
          `\n_Rawdat Tahfeez al Atfal_`;
      } else if (type === 'jadwal') {
        notificationMsg = `📅 *Jadwal / Timetable Update*\n\n` +
          `Student: *${sanitizeInput(studentDisplayName)}*\n` +
          `The daily timetable and hifz schedule has been updated.\n` +
          (details?.note ? `📌 Note: ${sanitizeInput(details.note)}\n\n` : '\n') +
          `🌐 Portal: ${PORTAL_URL}\n\n` +
          `_Rawdat Tahfeez al Atfal_`;
      } else if (type === 'result') {
        notificationMsg = `📊 *Weekly Result is Now Live!*\n\n` +
          `Student: *${sanitizeInput(studentDisplayName)}*\n` +
          `The latest weekly assessment results are now live.\n\n` +
          `Tap "📊 View Weekly Result Card" below or send /result to view the official performance card.\n\n` +
          `_Rawdat Tahfeez al Atfal_`;
      } else {
        notificationMsg = `🔔 *Student Update*\n\n` +
          `Student: *${sanitizeInput(studentDisplayName)}*\n` +
          `${sanitizeInput(body.message || body.text || 'New academic update published.')}\n\n` +
          `_Rawdat Tahfeez al Atfal_`;
      }

      let deliveredCount = 0;
      for (const targetChatId of chatIds) {
        try {
          await sendTelegramMessage(targetChatId, notificationMsg, {
            reply_markup: getLinkedKeyboard(studentDisplayName)
          });
          deliveredCount++;
        } catch (err) {
          console.warn('[notify_student_update delivery error]:', err);
        }
      }

      return res.status(200).json({ success: true, delivered: deliveredCount, totalTargets: chatIds.length });
    }

    // ── Telegram Update Handling (Webhook from Telegram) ──
    // Handle standard message, edited message, or callback query
    const message = body.message || body.edited_message || (body.callback_query && body.callback_query.message);
    if (!message) {
      return res.status(200).json({ ok: true, note: 'No message in update' });
    }

    const chatId = message?.chat?.id || body.callback_query?.from?.id;
    if (!chatId) {
      return res.status(200).json({ ok: true, note: 'No chatId found' });
    }

    const userFirstName = message.from?.first_name || body.callback_query?.from?.first_name || '';
    const rawText = (message.text || body.callback_query?.data || '').trim();

    // ── Security Check: Anti-flood & Rate Limiting ──
    const safetyCheck = checkSafetyLimit(chatId);
    if (!safetyCheck.allowed) {
      await sendTelegramMessage(chatId, safetyCheck.reason, {
        reply_markup: getStandardKeyboard()
      });
      return res.status(200).json({ ok: true, rate_limited: true });
    }

    // Resolve if user already has a linked student profile
    const linkedStudent = await getLinkedStudent(sheetsWebhookUrl, chatId);

    // ── Helpline Request: Send ONLY the helpline number ──
    const isHelplineQuery =
      rawText === '📞 Helpline Number' ||
      /^(helpline|help|\/helpline|\/help|number|contact|phone|call)$/i.test(rawText) ||
      rawText.toLowerCase().includes('helpline') ||
      rawText.toLowerCase().includes('helpline number') ||
      rawText.toLowerCase() === 'helpline';

    if (isHelplineQuery) {
      await sendHelplineOnly(chatId, linkedStudent);
      return res.status(200).json({ ok: true, helpline_only_sent: true });
    }

    // ── Admin: Connect Google Sheets Webhook (/setsheets <url>) ──
    if (rawText.toLowerCase().startsWith('/setsheets') || rawText.toLowerCase().startsWith('/sheets')) {
      const newUrl = rawText.replace(/^\/?(setsheets|sheets)\s*/i, '').trim();
      if (newUrl.startsWith('http')) {
        runtimeSheetsWebhookUrl = newUrl;
        await sendTelegramMessage(chatId,
          `✅ *Google Sheets Webhook Connected!*\n\n` +
          `Database endpoint set to:\n\`${newUrl}\`\n\n` +
          `All student queries, attendance, and results will now sync live with your Google Sheet.`,
          { reply_markup: linkedStudent ? getLinkedKeyboard(linkedStudent.name) : getStandardKeyboard() }
        );
        return res.status(200).json({ ok: true, sheets_url_updated: true });
      }
    }

    // ── Unlink Telegram Account (/unlink) ──
    if (rawText.toLowerCase() === '/unlink') {
      await unlinkTelegram(sheetsWebhookUrl, chatId);
      await sendTelegramMessage(chatId,
        `🔓 *Account Disconnected*\n\n` +
        `Your Telegram account has been unlinked from student updates.\n` +
        `To link again or connect a different child, tap *🔐 Verify & Link Child Profile* below.`,
        { reply_markup: getStandardKeyboard() }
      );
      return res.status(200).json({ ok: true, unlinked: true });
    }

    // ── Linked Child Profile Information (/mychild, /profile) ──
    if (rawText === '👤 Linked Child Profile' || rawText.toLowerCase() === '/mychild' || rawText.toLowerCase() === '/profile') {
      if (linkedStudent) {
        await sendTelegramMessage(chatId,
          `👤 *Linked Student Profile*\n\n` +
          `• Student Name: *${sanitizeInput(linkedStudent.name)}*\n` +
          `• ITS Number: \`${sanitizeInput(linkedStudent.its || 'Verified')}\`\n` +
          `• Registered Phone: \`${linkedStudent.phone || '—'}\`\n` +
          `• Academic Section: Rawdat Tahfeez al Atfal\n\n` +
          `✔ Real-time Attendance & Leave updates are active for this account.\n` +
          `To disconnect or link another student, send \`/unlink\`.`,
          { reply_markup: getLinkedKeyboard(linkedStudent.name) }
        );
      } else {
        await sendTelegramMessage(chatId,
          `ℹ️ *No Child Linked Yet*\n\n` +
          `Tap *🔐 Verify & Link Child Profile* below or share your registered phone number to link your child.`,
          { reply_markup: getStandardKeyboard() }
        );
      }
      return res.status(200).json({ ok: true });
    }

    // ── Today Attendance Status Check ──
    if (rawText === '📋 Today Attendance' || (linkedStudent && rawText.toLowerCase().includes('attendance'))) {
      if (linkedStudent) {
        const attRec = findStudentAttendance(linkedStudent, chatId);
        const status = attRec?.status || linkedStudent?.latestAttendance?.status || 'Present';
        const date = attRec?.date || linkedStudent?.latestAttendance?.date || new Date().toLocaleDateString('en-GB');
        const statusEmoji = attRec?.statusEmoji || linkedStudent?.latestAttendance?.statusEmoji || (/absent/i.test(status) ? '❌' : (/present/i.test(status) ? '✅' : '📝'));

        await sendTelegramMessage(chatId,
          `📋 *Daily Attendance Update*\n` +
          `Student: *${sanitizeInput(linkedStudent.name)}*\n` +
          `📅 Date: ${date}\n` +
          `Status: ${statusEmoji} ${status}\n\n` +
          `Rawdat Tahfeez al Atfal`,
          { reply_markup: getLinkedKeyboard(linkedStudent.name) }
        );
      } else {
        await sendTelegramMessage(chatId,
          `ℹ️ Please link your child first using *🔐 Verify & Link Child Profile* to view daily attendance updates.`,
          { reply_markup: getStandardKeyboard() }
        );
      }
      return res.status(200).json({ ok: true });
    }

    // ── Leave Status Check ──
    if (rawText === '📝 Leave Status' || (linkedStudent && rawText.toLowerCase().includes('leave'))) {
      if (linkedStudent) {
        await sendTelegramMessage(chatId,
          `📝 *Leave Application Status*\n\n` +
          `Student: *${sanitizeInput(linkedStudent.name)}*\n` +
          `Status: Active in regular class attendance.\n\n` +
          `To submit a new leave application, please access the portal:\n` +
          `🌐 ${PORTAL_URL}\n\n` +
          `_Rawdat Tahfeez al Atfal_`,
          { reply_markup: getLinkedKeyboard(linkedStudent.name) }
        );
      } else {
        await sendTelegramMessage(chatId,
          `ℹ️ Please link your child first to track leave requests.`,
          { reply_markup: getStandardKeyboard() }
        );
      }
      return res.status(200).json({ ok: true });
    }

    // ── Jadwal / Timetable Schedule Check ──
    if (rawText === '📅 Jadwal Schedule' || (linkedStudent && rawText.toLowerCase().includes('jadwal'))) {
      if (linkedStudent) {
        await sendTelegramMessage(chatId,
          `📅 *Jadwal / Timetable Schedule*\n\n` +
          `Student: *${sanitizeInput(linkedStudent.name)}*\n` +
          `Your child's personalized hifz timetable and daily murajah plan is available online:\n\n` +
          `🌐 *Portal Link:* ${PORTAL_URL}\n\n` +
          `_Rawdat Tahfeez al Atfal_`,
          { reply_markup: getLinkedKeyboard(linkedStudent.name) }
        );
      } else {
        await sendTelegramMessage(chatId,
          `ℹ️ Please link your child first to view personalized jadwal schedules.`,
          { reply_markup: getStandardKeyboard() }
        );
      }
      return res.status(200).json({ ok: true });
    }

    // ── View Weekly Result Card (for linked student or /result) ──
    if (rawText === '📊 View Weekly Result Card' || (linkedStudent && rawText.toLowerCase() === '/result')) {
      if (linkedStudent) {
        try {
          const freshStudent = await queryStudentFromSheets(sheetsWebhookUrl, {
            name: linkedStudent.name,
            code: linkedStudent.its || linkedStudent.phone
          }) || linkedStudent;

          const svg = generateMarhalaResultSvg(freshStudent);
          const png = renderSvgToPng(svg);
          const caption = buildResultCaption(freshStudent);
          await sendTelegramPhoto(chatId, png, caption, {
            reply_markup: getLinkedKeyboard(freshStudent.name)
          });
          return res.status(200).json({ ok: true, delivered: true });
        } catch (err) {
          await sendTelegramMessage(chatId,
            `📊 *Weekly Result for ${sanitizeInput(linkedStudent.name)}*\n\n` +
            `• Score: ${linkedStudent.weeklyScore || '—'}/100\n` +
            `• Total Jadeed: ${linkedStudent.totalJadeed || '—'}\n` +
            `• Rank: #${linkedStudent.marhalaRank || '—'}\n\n` +
            `📞 *Helpline Number:* ${HELPLINE_NUMBER}`,
            { reply_markup: getLinkedKeyboard(linkedStudent.name) }
          );
          return res.status(200).json({ ok: true, text_sent: true });
        }
      }
    }

    // ── 3-Point Security Verification Flow (/verify or /link) ──
    if (
      rawText.toLowerCase().startsWith('/verify') ||
      rawText.toLowerCase().startsWith('/link') ||
      rawText === '🔐 Verify & Link Child Profile' ||
      rawText === '🔍 Search by Child Name & Code'
    ) {
      const cleaned = rawText.replace(/^\/?(verify|link)\s*/i, '').trim();
      const parts = cleaned.split(/[,:]+/).map((p) => sanitizeInput(p.trim())).filter(Boolean);

      // Prompt user with format & example if parameters not provided
      if (parts.length < 3) {
        await sendTelegramMessage(chatId,
          `🔐 *3-Point Profile Verification*\n\n` +
          `To securely connect this Telegram number to your child and receive automatic updates for:\n` +
          `• 📋 Daily Attendance (Present/Absent/Late)\n` +
          `• 📝 Leave Requests & Approvals\n` +
          `• 📅 Jadwal & Timetable Updates\n` +
          `• 📊 Weekly Result Cards\n\n` +
          `Please provide the 3 credentials from your child's profile:\n` +
          `1️⃣ *Registered Profile Contact Number*\n` +
          `2️⃣ *Child Full Name*\n` +
          `3️⃣ *Child ITS Number* (8-digit ITS)\n\n` +
          `👉 *Command Format:*\n` +
          `\`/verify [Profile Contact], [Child Name], [ITS]\`\n\n` +
          `👉 *Example:*\n` +
          `\`/verify 9876543210, Taher Shabbir, 50401002\`\n\n` +
          `📞 *Helpline Number:* \`${HELPLINE_NUMBER}\``,
          { reply_markup: getStandardKeyboard() }
        );
        return res.status(200).json({ ok: true, prompt_sent: true });
      }

      const profileContact = parts[0];
      const childName = parts[1];
      const its = parts[2];

      // Validate credentials format
      if (!isValidSecurityCode(its)) {
        recordSafetyFail(chatId);
        await sendTelegramMessage(chatId,
          `⚠️ *Invalid ITS Format*\n\n` +
          `Please enter a valid 8-digit ITS number.\n` +
          `Example: \`/verify 9876543210, Taher Shabbir, 50401002\``,
          { reply_markup: getStandardKeyboard() }
        );
        return res.status(200).json({ ok: true, invalid_format: true });
      }

      // Execute 3-Point Verification with Google Sheets
      const vResult = await verifyThreePoint(sheetsWebhookUrl, profileContact, childName, its, chatId);

      if (vResult && vResult.success && vResult.verified && vResult.student) {
        recordSafetySuccess(chatId);
        const stu = vResult.student;
        await sendTelegramMessage(chatId,
          `✅ *Verification Successful!*\n\n` +
          `Your Telegram account is now securely linked to:\n` +
          `👤 Student: *${sanitizeInput(stu.name)}*\n` +
          `🆔 ITS: \`${sanitizeInput(stu.its || its)}\`\n` +
          `📱 Profile Contact: \`+${cleanPhone(profileContact)}\`\n\n` +
          `You will now receive automatic real-time updates for:\n` +
          `✔ 📋 Daily Attendance (Present/Absent/Late)\n` +
          `✔ 📝 Leave Requests & Status Updates\n` +
          `✔ 📅 Jadwal & Timetable Changes\n` +
          `✔ 📊 Weekly Result Announcements\n\n` +
          `Tap any option below to view your child's data immediately:`,
          { reply_markup: getLinkedKeyboard(stu.name) }
        );

        // Also deliver their current weekly result card
        try {
          const svg = generateMarhalaResultSvg(stu);
          const png = renderSvgToPng(svg);
          const caption = buildResultCaption(stu);
          await sendTelegramPhoto(chatId, png, caption, {
            reply_markup: getLinkedKeyboard(stu.name)
          });
        } catch (_) {}

        return res.status(200).json({ ok: true, verified: true, student: stu.name });
      } else {
        recordSafetyFail(chatId);
        await sendTelegramMessage(chatId,
          `❌ *Verification Failed*\n\n` +
          `The 3 details provided did not match any active student profile:\n` +
          `• Contact: \`+${cleanPhone(profileContact)}\`\n` +
          `• Child Name: *${sanitizeInput(childName)}*\n` +
          `• ITS: \`${sanitizeInput(its)}\`\n\n` +
          `All 3 must match your child's registered school profile.\n\n` +
          `📞 *Helpline Number:* \`${HELPLINE_NUMBER}\`\n` +
          `_(Call or WhatsApp our helpline for assistance)_`,
          { reply_markup: getStandardKeyboard() }
        );
        return res.status(200).json({ ok: true, match_failed: true });
      }
    }

    // ── Contact Sharing (Automatic Phone Match) ──
    if (message.contact && message.contact.phone_number) {
      const sharedPhone = cleanPhone(message.contact.phone_number);

      // Search student by phone number in Google Sheets or embedded roster
      const student = await queryStudentFromSheets(sheetsWebhookUrl, { phone: sharedPhone });

      if (student && student.name) {
        recordSafetySuccess(chatId);
        linkedSubscribersCache.set(String(chatId), student);
        // Automatically bind this chatId to this student in Google Sheets
        try {
          if (sheetsWebhookUrl) {
            await verifyThreePoint(sheetsWebhookUrl, sharedPhone, student.name, student.its || student.code || 'MATCH', chatId);
          }
        } catch (_) {}

        await sendTelegramMessage(chatId,
          `✅ *Profile Matched & Connected!*\n\n` +
          `Your Telegram account is now connected to *${sanitizeInput(student.name)}* (ITS: \`${student.its || 'Verified'}\`).\n\n` +
          `You will receive instant automatic updates for:\n` +
          `✔ 📋 Daily Attendance Updates\n` +
          `✔ 📝 Leave Requests & Approvals\n` +
          `✔ 📅 Jadwal & Timetable Changes\n` +
          `✔ 📊 Weekly Result Announcements\n\n` +
          `Here is the latest weekly result card for *${sanitizeInput(student.name)}*:`,
          { reply_markup: getLinkedKeyboard(student.name) }
        );

        try {
          const svg = generateMarhalaResultSvg(student);
          const png = renderSvgToPng(svg);
          const caption = buildResultCaption(student);
          await sendTelegramPhoto(chatId, png, caption, {
            reply_markup: getLinkedKeyboard(student.name)
          });
          return res.status(200).json({ ok: true, delivered: true, student: student.name });
        } catch (err) {
          await sendTelegramMessage(chatId,
            `📊 *Weekly Result for ${sanitizeInput(student.name)}*\n\n` +
            `• Score: ${student.weeklyScore}/100\n` +
            `• Total Jadeed: ${student.totalJadeed || '—'}\n` +
            `• Rank: #${student.marhalaRank}\n\n` +
            `📞 *Helpline Number:* ${HELPLINE_NUMBER}`,
            { reply_markup: getLinkedKeyboard(student.name) }
          );
          return res.status(200).json({ ok: true, delivered: true });
        }
      } else {
        await sendTelegramMessage(chatId,
          `ℹ️ No student profile found for mobile number \`+${sharedPhone}\`.\n\n` +
          `If your child's profile has a different contact number, please link using the 3-point verification:\n\n` +
          `\`/verify [Profile Contact], [Child Name], [ITS]\`\n` +
          `_(Example: \`/verify 9930852533, Demo Student, 515253\`)_\n\n` +
          `📞 *Helpline Number:* \`${HELPLINE_NUMBER}\``,
          { reply_markup: getStandardKeyboard() }
        );
        return res.status(200).json({ ok: true, not_found: true });
      }
    }

    // ── Case: /result [Child Name], [Code] (Legacy Search) ──
    if (rawText.toLowerCase().startsWith('/result') || rawText.toLowerCase().startsWith('/find')) {
      const cleaned = rawText.replace(/^\/?(result|find)\s*/i, '').trim();
      const parts = cleaned.split(/[,:]+/).map((p) => sanitizeInput(p.trim())).filter(Boolean);

      if (parts.length < 2) {
        await sendTelegramMessage(chatId,
          `🔍 *Search Child Weekly Result*\n\n` +
          `To view your child's latest result, please provide your child's Name and Security Code (ITS or Student ID):\n\n` +
          `👉 Format: \`/result [Child Name], [Code]\`\n` +
          `👉 Example: \`/result Taher Shabbir, 50401002\`\n\n` +
          `📞 *Helpline Number:* \`${HELPLINE_NUMBER}\``,
          { reply_markup: linkedStudent ? getLinkedKeyboard(linkedStudent.name) : getStandardKeyboard() }
        );
        return res.status(200).json({ ok: true, prompt_sent: true });
      }

      const childName = parts[0];
      const securityCode = parts[1];

      if (!isValidSecurityCode(securityCode)) {
        recordSafetyFail(chatId);
        await sendTelegramMessage(chatId,
          `⚠️ *Invalid Security Code Format*\n\n` +
          `Please provide a valid code (your child's 8-digit ITS number or Student ID).\n\n` +
          `👉 Example: \`/result Taher Shabbir, 50401002\`\n\n` +
          `📞 *Helpline Number:* \`${HELPLINE_NUMBER}\``,
          { reply_markup: getStandardKeyboard() }
        );
        return res.status(200).json({ ok: true, invalid_format: true });
      }

      const student = await queryStudentFromSheets(sheetsWebhookUrl, {
        name: childName,
        code: securityCode
      });

      if (student && student.name) {
        recordSafetySuccess(chatId);
        try {
          const svg = generateMarhalaResultSvg(student);
          const png = renderSvgToPng(svg);
          const caption = buildResultCaption(student);
          await sendTelegramPhoto(chatId, png, caption, {
            reply_markup: linkedStudent ? getLinkedKeyboard(linkedStudent.name) : getStandardKeyboard()
          });
          return res.status(200).json({ ok: true, verified: true, student: student.name });
        } catch (cardErr) {
          await sendTelegramMessage(chatId,
            `✅ *Verified Result for ${sanitizeInput(student.name)}:*\n\n` +
            `• Weekly Score: *${student.weeklyScore}* / 100\n` +
            `• Total Jadeed: *${student.totalJadeed}*\n` +
            `• Marhala Rank: *#${student.marhalaRank}*\n` +
            `• Overall Rank: *#${student.overallRank}*\n\n` +
            `📞 *Helpline Number:* ${HELPLINE_NUMBER}`
          );
          return res.status(200).json({ ok: true, text_sent: true });
        }
      } else {
        recordSafetyFail(chatId);
        await sendTelegramMessage(chatId,
          `❌ *Verification Failed*\n\n` +
          `The provided child details and security code did not match any active student record.\n\n` +
          `Please check the spelling and your child's ITS or Student ID.\n\n` +
          `📞 *Helpline Number:* \`${HELPLINE_NUMBER}\`\n` +
          `_(Call or WhatsApp our helpline if you need help finding your child's code)_`,
          { reply_markup: getStandardKeyboard() }
        );
        return res.status(200).json({ ok: true, match_failed: true });
      }
    }

    // ── Fallback Greeting ──
    if (linkedStudent) {
      await sendLinkedWelcome(chatId, linkedStudent);
    } else {
      await sendHelplineWelcome(chatId);
    }
    return res.status(200).json({ ok: true, helpline_sent: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
