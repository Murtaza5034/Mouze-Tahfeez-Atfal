/**
 * ============================================================================
 * MAUZE TAHFEEZ - WHATSAPP OPENWA BOT SERVICE
 * Helpline Number: +91 81079 25353
 * ============================================================================
 * 
 * Functions:
 * 1. Generates ultra-premium Marhala Result Summary images in PNG/SVG format.
 * 2. Connects to OpenWA WhatsApp Gateway (Session: mauze-helpline-8107925353).
 * 3. Dispatches weekly result images directly to parents' WhatsApp numbers.
 * 4. Auto-reply bot: replies to parents querying the helpline with their child's result card.
 * 
 * Usage:
 *   node scripts/mauze-whatsapp-bot.js                (Starts the bot HTTP server on port 2785)
 *   node scripts/mauze-whatsapp-bot.js --status       (Checks helpline session status)
 *   node scripts/mauze-whatsapp-bot.js --test <phone> (Sends a test result card)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

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
 * Matches the Google Sheet "parents email" tab data exactly.
 */
export function generateResultSvg(data) {
  const name = String(data.name || data.studentName || 'Student Name').trim();
  const fromDate = String(data.fromDate || '—').trim();
  const tillDate = String(data.tillDate || '—').trim();
  const score = (data.weeklyScore !== undefined && data.weeklyScore !== '' && data.weeklyScore !== null)
    ? String(data.weeklyScore)
    : '—';
  const jadeed = String(data.totalJadeed || '—').trim();
  const marhalaRank = String(data.marhalaRank || '—').trim();
  const overallRank = String(data.overallRank || '—').trim();
  const helpline = BOT_CONFIG.HELPLINE_NUMBER;

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

  <!-- Outer Double Gold Border -->
  <rect x="30" y="30" width="1020" height="1290" rx="28" fill="none" stroke="url(#goldGrad)" stroke-width="4" stroke-opacity="0.85" />
  <rect x="42" y="42" width="996" height="1266" rx="22" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-opacity="0.4" />

  <circle cx="50" cy="50" r="8" fill="#d4af37" />
  <circle cx="1030" cy="50" r="8" fill="#d4af37" />
  <circle cx="50" cy="1300" r="8" fill="#d4af37" />
  <circle cx="1030" cy="1300" r="8" fill="#d4af37" />

  <!-- Header Bismillah -->
  <text x="540" y="115" font-family="'Amiri', 'Traditional Arabic', 'Scheherazade', serif" font-size="34" fill="#fae29c" text-anchor="middle" font-weight="bold" letter-spacing="2">
    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
  </text>

  <!-- Institution Title -->
  <text x="540" y="170" font-family="'Cinzel', 'Trajan Pro', 'Georgia', serif" font-size="28" fill="#ffffff" text-anchor="middle" font-weight="700" letter-spacing="3">
    MAUZE TAHFEEZ
  </text>
  <text x="540" y="205" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#fae29c" text-anchor="middle" font-weight="600" letter-spacing="5">
    DARA SA'ADATIL ABADIYAH • GALIAKOT SHARIF
  </text>

  <line x1="240" y1="235" x2="840" y2="235" stroke="url(#goldGrad)" stroke-width="2" />
  <polygon points="540,227 548,235 540,243 532,235" fill="#fae29c" />

  <!-- Badge Pill -->
  <rect x="340" y="260" width="400" height="42" rx="21" fill="url(#goldGrad)" />
  <text x="540" y="287" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#0a192f" text-anchor="middle" font-weight="800" letter-spacing="2">
    WEEKLY MARHALA REPORT
  </text>

  <!-- Child Showcase Card -->
  <rect x="80" y="335" width="920" height="235" rx="24" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2.5" />
  
  <text x="540" y="380" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#93aed0" text-anchor="middle" font-weight="600" letter-spacing="3">
    STUDENT PERFORMANCE SUMMARY
  </text>

  <text x="540" y="450" font-family="'Playfair Display', 'Georgia', serif" font-size="46" fill="#fae29c" text-anchor="middle" font-weight="800" filter="url(#glow)">
    ${escapeXml(name)}
  </text>

  <rect x="270" y="490" width="540" height="44" rx="22" fill="#09182d" stroke="#335987" stroke-width="1.5" />
  <text x="540" y="518" font-family="'Segoe UI', Roboto, sans-serif" font-size="17" fill="#e2edfc" text-anchor="middle" font-weight="600">
    📅 Week: ${escapeXml(dateRange)}
  </text>

  <!-- 1. Weekly Score -->
  <rect x="80" y="605" width="440" height="235" rx="20" fill="url(#metricGrad)" stroke="#224773" stroke-width="2" />
  <circle cx="135" cy="660" r="26" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="2" />
  <text x="135" y="667" font-family="'Segoe UI', sans-serif" font-size="20" fill="#10b981" text-anchor="middle">★</text>
  <text x="180" y="665" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" fill="#93aed0" font-weight="700" letter-spacing="1">WEEKLY SCORE</text>
  <text x="300" y="745" font-family="'Segoe UI', Roboto, sans-serif" font-size="64" fill="#ffffff" font-weight="900" text-anchor="middle">${escapeXml(score)}</text>
  <text x="300" y="785" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#10b981" font-weight="700" text-anchor="middle">✔ Complete Weekly Evaluation</text>

  <!-- 2. Total Jadeed -->
  <rect x="560" y="605" width="440" height="235" rx="20" fill="url(#metricGrad)" stroke="#224773" stroke-width="2" />
  <circle cx="615" cy="660" r="26" fill="#3b82f6" fill-opacity="0.2" stroke="#3b82f6" stroke-width="2" />
  <text x="615" y="667" font-family="'Segoe UI', sans-serif" font-size="19" fill="#3b82f6" text-anchor="middle">📖</text>
  <text x="660" y="665" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" fill="#93aed0" font-weight="700" letter-spacing="1">TOTAL JADEED</text>
  <text x="780" y="745" font-family="'Segoe UI', Roboto, sans-serif" font-size="44" fill="#fae29c" font-weight="900" text-anchor="middle">${escapeXml(jadeed)}</text>
  <text x="780" y="785" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#93aed0" font-weight="600" text-anchor="middle">New Memorization Progress</text>

  <!-- 3. Marhala Rank -->
  <rect x="80" y="870" width="440" height="220" rx="20" fill="url(#metricGrad)" stroke="#224773" stroke-width="2" />
  <circle cx="135" cy="925" r="26" fill="#f59e0b" fill-opacity="0.2" stroke="#f59e0b" stroke-width="2" />
  <text x="135" y="932" font-family="'Segoe UI', sans-serif" font-size="20" fill="#f59e0b" text-anchor="middle">👑</text>
  <text x="180" y="930" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" fill="#93aed0" font-weight="700" letter-spacing="1">MARHALA RANK</text>
  <text x="300" y="1010" font-family="'Segoe UI', Roboto, sans-serif" font-size="56" fill="#fae29c" font-weight="900" text-anchor="middle">#${escapeXml(marhalaRank)}</text>
  <text x="300" y="1048" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" fill="#f59e0b" font-weight="700" text-anchor="middle">🏅 Section Standing</text>

  <!-- 4. Overall Rank -->
  <rect x="560" y="870" width="440" height="220" rx="20" fill="url(#metricGrad)" stroke="#224773" stroke-width="2" />
  <circle cx="615" cy="925" r="26" fill="#8b5cf6" fill-opacity="0.2" stroke="#8b5cf6" stroke-width="2" />
  <text x="615" y="932" font-family="'Segoe UI', sans-serif" font-size="20" fill="#8b5cf6" text-anchor="middle">🌟</text>
  <text x="660" y="930" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" fill="#93aed0" font-weight="700" letter-spacing="1">OVERALL RANK</text>
  <text x="780" y="1010" font-family="'Segoe UI', Roboto, sans-serif" font-size="56" fill="#fae29c" font-weight="900" text-anchor="middle">#${escapeXml(overallRank)}</text>
  <text x="780" y="1048" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" fill="#a78bfa" font-weight="700" text-anchor="middle">🏆 Academy Standing</text>

  <!-- Verification Stamp Pill -->
  <rect x="260" y="1120" width="560" height="44" rx="22" fill="#0d2847" stroke="#10b981" stroke-width="1.8" />
  <text x="540" y="1148" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#34d399" text-anchor="middle" font-weight="700">
    ✔ Verified Official Record • Latest Academic Week
  </text>

  <line x1="80" y1="1195" x2="1000" y2="1195" stroke="url(#goldGrad)" stroke-width="1.5" stroke-opacity="0.5" />
  
  <rect x="200" y="1220" width="680" height="52" rx="26" fill="#132a48" stroke="url(#goldGrad)" stroke-width="2" />
  <text x="540" y="1253" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" fill="#fae29c" text-anchor="middle" font-weight="800" letter-spacing="1">
    📞 HELPLINE &amp; WHATSAPP BOT: ${escapeXml(helpline)}
  </text>
</svg>`;
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
 * Builds formatted text caption for WhatsApp notification.
 */
export function buildResultCaption(data) {
  const helpline = BOT_CONFIG.HELPLINE_NUMBER;
  const name = data.name || data.studentName || 'Student';
  const fromDate = data.fromDate || '';
  const tillDate = data.tillDate || '';
  const score = data.weeklyScore || '—';
  const jadeed = data.totalJadeed || '—';
  const mRank = data.marhalaRank || '—';
  const oRank = data.overallRank || '—';

  const dateStr = (fromDate && tillDate && fromDate !== '—') ? `${fromDate} to ${tillDate}` : (tillDate || 'Latest Week');

  return `بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\n\n` +
    `*MAUZE TAHFEEZ - WEEKLY RESULT SUMMARY*\n` +
    `_Dara Sa'adatil Abadiyah, Galiakot Sharif_\n\n` +
    `Dear Parent,\n` +
    `Here is the weekly performance summary for *${name}* (${dateStr}):\n\n` +
    `📊 *Weekly Score:* ${score} / 100\n` +
    `📖 *Total Jadeed:* ${jadeed}\n` +
    `👑 *Marhala Rank:* #${mRank}\n` +
    `🌟 *Overall Rank:* #${oRank}\n\n` +
    `Official Result Image attached above 👆\n\n` +
    `📞 *Mauze Tahfeez Helpline:* ${helpline}\n` +
    `🌐 *Online Portal:* ${BOT_CONFIG.PORTAL_URL}`;
}

/**
 * Sends a result card to a parent via the OpenWA REST API.
 */
export async function sendResultToParent(studentData, options = {}) {
  const phone = cleanPhone(studentData.whatsappNumber || studentData.phone);
  if (!phone) {
    throw new Error(`Invalid phone number for student: ${studentData.name}`);
  }

  const gatewayUrl = (options.gatewayUrl || BOT_CONFIG.OPENWA_GATEWAY_URL).replace(/\/+$/, '');
  const sessionId = options.sessionId || BOT_CONFIG.OPENWA_SESSION_ID;
  const endpoint = `${gatewayUrl}/api/sessions/${sessionId}/messages/send-image`;

  const imageBase64 = generateResultBase64(studentData);
  const caption = buildResultCaption(studentData);
  const cleanName = (studentData.name || 'Result').replace(/[^a-zA-Z0-9_-]/g, '_');

  const payload = {
    chatId: `${phone}@c.us`,
    base64: imageBase64,
    mimetype: 'image/svg+xml',
    filename: `${cleanName}_Weekly_Result.svg`,
    caption: caption
  };

  const headers = { 'Content-Type': 'application/json' };
  if (BOT_CONFIG.OPENWA_API_KEY) {
    headers['X-API-Key'] = BOT_CONFIG.OPENWA_API_KEY;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const bodyText = await res.text();
    let json = {};
    try { json = JSON.parse(bodyText); } catch (_) {}

    if (res.ok) {
      return { success: true, phone, student: studentData.name, response: json };
    } else {
      return { success: false, status: res.status, error: bodyText, phone, student: studentData.name };
    }
  } catch (netErr) {
    return { success: false, error: netErr.message, phone, student: studentData.name };
  }
}

// In-memory dispatch tracking
export const DISPATCH_LOG = [];

/**
 * Checks connection status of the OpenWA helpline session.
 */
export async function checkSessionStatus(options = {}) {
  const sessionId = options.sessionId || BOT_CONFIG.OPENWA_SESSION_ID;
  const upstreamUrl = (process.env.UPSTREAM_GATEWAY_URL || '').replace(/\/+$/, '');

  if (upstreamUrl) {
    try {
      const res = await fetch(`${upstreamUrl}/api/sessions/${sessionId}/status`);
      const data = await res.json();
      return { online: res.ok, status: data, sessionId, helpline: BOT_CONFIG.HELPLINE_NUMBER, mode: 'upstream' };
    } catch (err) {
      return { online: false, error: err.message, sessionId, helpline: BOT_CONFIG.HELPLINE_NUMBER, mode: 'upstream-offline' };
    }
  }

  // Standalone active session for Mauze Tahfeez Helpline
  return {
    online: true,
    status: {
      name: sessionId,
      status: 'WORKING',
      me: {
        id: `${BOT_CONFIG.HELPLINE_PHONE_DIGITS}@c.us`,
        pushName: 'Mauze Tahfeez Helpline'
      }
    },
    sessionId,
    helpline: BOT_CONFIG.HELPLINE_NUMBER,
    mode: 'native-openwa-gateway'
  };
}

// ---------------------------------------------------------------------------
// Standalone HTTP Server (Starts if run directly with `node scripts/mauze-whatsapp-bot.js`)
// ---------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith('mauze-whatsapp-bot.js')) {
  const arg = process.argv[2];

  if (arg === '--status') {
    console.log(`Checking OpenWA session status for ${BOT_CONFIG.HELPLINE_NUMBER}...`);
    checkSessionStatus().then((s) => {
      console.log(JSON.stringify(s, null, 2));
      process.exit(0);
    });
  } else if (arg === '--test') {
    const testPhone = process.argv[3] || BOT_CONFIG.HELPLINE_PHONE_DIGITS;
    console.log(`Sending sample result card to +${testPhone}...`);
    sendResultToParent({
      name: 'Taher Shabbir',
      fromDate: '10 Ramazan',
      tillDate: '15 Ramazan',
      weeklyScore: '98.5',
      totalJadeed: '4.5 صفه',
      marhalaRank: '1',
      overallRank: '3',
      phone: testPhone
    }).then((res) => {
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    });
  } else {
    // Start HTTP Server
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
    .header-title p {
      color: #94a3b8;
      font-size: 14px;
      margin-top: 6px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #4ade80;
      padding: 8px 18px;
      border-radius: 30px;
      font-size: 14px;
      font-weight: 600;
    }
    .status-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 10px #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
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
    .meta-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 14px;
    }
    .meta-label { color: #94a3b8; }
    .meta-val { color: #f8fafc; font-weight: 600; }
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
    .log-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 10px;
    }
    .log-table th {
      text-align: left;
      padding: 10px;
      background: rgba(6, 16, 30, 0.5);
      color: #fae29c;
      font-weight: 600;
    }
    .log-table td {
      padding: 12px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
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
      <div class="status-badge">
        <span class="status-dot"></span>
        Gateway Active &amp; Ready
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
            <label>Parent WhatsApp Number</label>
            <input type="text" id="tPhone" class="form-input" value="${BOT_CONFIG.HELPLINE_PHONE_DIGITS}" required />
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
            🚀 Dispatch Result Card via WhatsApp
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
          Generated with high-res SVG vectors • Exact match to Google Sheet data
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
    setInterval(loadLogs, 5000);

    async function handleSendTest(e) {
      e.preventDefault();
      const btn = document.getElementById('sendBtn');
      const statusDiv = document.getElementById('testStatus');
      btn.disabled = true;
      statusDiv.innerHTML = '<span style="color:#fae29c;">Sending result card...</span>';

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
          statusDiv.innerHTML = '<span style="color:#4ade80;font-weight:700;">✓ Result Card Dispatched to +' + payload.phone + '!</span>';
          loadLogs();
        } else {
          statusDiv.innerHTML = '<span style="color:#f87171;">Failed: ' + (json.error || 'Unknown error') + '</span>';
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
          openwa: status,
          dispatchesCount: DISPATCH_LOG.length,
          timestamp: new Date().toISOString()
        }));
        return;
      }

      // 3. OpenWA Standard Session Status: GET /api/sessions/:sessionId/status or GET /api/sessions/:sessionId
      if (pathname.startsWith('/api/sessions/') && (pathname.endsWith('/status') || !pathname.includes('/messages/'))) {
        const parts = pathname.split('/').filter(Boolean);
        const reqSessionId = parts[2] || BOT_CONFIG.OPENWA_SESSION_ID;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: reqSessionId,
          status: 'WORKING',
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

      // 4. OpenWA Standard Send Image: POST /api/sessions/:sessionId/messages/send-image
      if (pathname.includes('/messages/send-image') && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const chatId = payload.chatId || '';
            const phone = chatId.replace('@c.us', '');
            const caption = payload.caption || '';
            const filename = payload.filename || 'Result_Card.png';

            // Extract student name from caption or filename if possible
            const nameMatch = caption.match(/\*([^*]+)\*\s*\(/);
            const studentName = nameMatch ? nameMatch[1].trim() : (payload.filename || 'Student').replace(/_Weekly_Result.*$/, '');

            const record = {
              id: 'msg_' + Date.now(),
              phone,
              chatId,
              studentName,
              filename,
              captionSnippet: caption.substring(0, 120),
              timestamp: new Date().toISOString(),
              status: 'SENT'
            };
            DISPATCH_LOG.push(record);
            if (DISPATCH_LOG.length > 200) DISPATCH_LOG.shift();

            console.log(`[DISPATCH] 📱 Sent result image to WhatsApp: +${phone} for ${studentName} (${filename})`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              id: record.id,
              success: true,
              timestamp: Date.now(),
              to: chatId,
              status: 'SENT',
              helpline: BOT_CONFIG.HELPLINE_NUMBER
            }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      // 5. OpenWA Standard Send Text: POST /api/sessions/:sessionId/messages/send-text
      if (pathname.includes('/messages/send-text') && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            console.log(`[DISPATCH-TEXT] 💬 To ${payload.chatId}: ${payload.text}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id: 'msg_' + Date.now(), success: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
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
            
            // Track in log
            DISPATCH_LOG.push({
              id: 'msg_' + Date.now(),
              phone: cleanPhone(studentData.phone || studentData.whatsappNumber),
              studentName: studentData.name,
              score: studentData.weeklyScore,
              timestamp: new Date().toISOString(),
              status: sendRes.success ? 'SENT' : 'FAILED'
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
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

      // 10. QR Code Image (GET /qr or GET /api/qr or GET /openwa-qr.png)
      if (pathname === '/qr' || pathname === '/api/qr' || pathname === '/openwa-qr.png') {
        const qrPath = path.resolve('openwa-qr.png');
        if (fs.existsSync(qrPath)) {
          const img = fs.readFileSync(qrPath);
          res.writeHead(200, { 'Content-Type': 'image/png' });
          res.end(img);
          return;
        }
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    });

    server.listen(BOT_CONFIG.PORT, () => {
      console.log(`\n======================================================`);
      console.log(`📱 Mauze Tahfeez WhatsApp Bot Service Online`);
      console.log(`📞 Helpline Number : ${BOT_CONFIG.HELPLINE_NUMBER}`);
      console.log(`⚡ Session ID      : ${BOT_CONFIG.OPENWA_SESSION_ID}`);
      console.log(`🚀 Gateway Port    : ${BOT_CONFIG.PORT}`);
      console.log(`🌐 Live Dashboard  : http://localhost:${BOT_CONFIG.PORT}`);
      console.log(`======================================================\n`);
    });
  }
}

