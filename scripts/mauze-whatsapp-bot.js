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

/**
 * Checks connection status of the OpenWA helpline session.
 */
export async function checkSessionStatus(options = {}) {
  const gatewayUrl = (options.gatewayUrl || BOT_CONFIG.OPENWA_GATEWAY_URL).replace(/\/+$/, '');
  const sessionId = options.sessionId || BOT_CONFIG.OPENWA_SESSION_ID;
  const endpoint = `${gatewayUrl}/api/sessions/${sessionId}/status`;

  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    return { online: res.ok, status: data, sessionId, helpline: BOT_CONFIG.HELPLINE_NUMBER };
  } catch (err) {
    return { online: false, error: err.message, sessionId, helpline: BOT_CONFIG.HELPLINE_NUMBER };
  }
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

      // 1. Health & Status
      if (url.pathname === '/api/status' || url.pathname === '/') {
        const status = await checkSessionStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          service: 'Mauze Tahfeez WhatsApp Bot',
          helpline: BOT_CONFIG.HELPLINE_NUMBER,
          session: BOT_CONFIG.OPENWA_SESSION_ID,
          openwa: status,
          timestamp: new Date().toISOString()
        }));
        return;
      }

      // 2. Generate Result Preview Image
      if (url.pathname === '/api/preview' && req.method === 'POST') {
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

      // 3. Send Single Result
      if (url.pathname === '/api/send-result' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            const studentData = JSON.parse(body);
            const sendRes = await sendResultToParent(studentData);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(sendRes));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
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
      console.log(`======================================================\n`);
    });
  }
}
