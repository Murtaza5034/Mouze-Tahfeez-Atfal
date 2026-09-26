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
  Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { Resvg } from '@resvg/resvg-js';

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
export let baileysStatus = 'INITIALIZING'; // 'INITIALIZING' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED'
export let latestQrDataUrl = '';
export let latestQrRaw = '';
export let latestPairingCode = '';
export let connectedUser = null;
export const DISPATCH_LOG = [];
const AUTH_DIR = path.resolve('baileys_auth_info');

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
      <stop offset="0%" stop-color="#142c4f" stop-opacity="0.85" />
      <stop offset="100%" stop-color="#0b1b33" stop-opacity="0.95" />
    </linearGradient>

    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d4af37" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>

    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.55" />
    </filter>

    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1350" fill="url(#bgGrad)" />

  <!-- Outer Border Frame -->
  <rect x="30" y="30" width="1020" height="1290" rx="28" fill="none" stroke="url(#goldGrad)" stroke-width="4" opacity="0.8" />
  <rect x="42" y="42" width="996" height="1266" rx="22" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-dasharray="8 8" opacity="0.4" />

  <!-- Corner Islamic Geometric Accents -->
  <path d="M42,100 L100,42 M42,120 L120,42" stroke="url(#goldGrad)" stroke-width="2" opacity="0.6" />
  <path d="M1038,100 L980,42 M1038,120 L960,42" stroke="url(#goldGrad)" stroke-width="2" opacity="0.6" />
  <path d="M42,1250 L100,1308 M42,1230 L120,1308" stroke="url(#goldGrad)" stroke-width="2" opacity="0.6" />
  <path d="M1038,1250 L980,1308 M1038,1230 L960,1308" stroke="url(#goldGrad)" stroke-width="2" opacity="0.6" />

  <!-- Bismillah Calligraphy Header -->
  <text x="540" y="105" font-family="'Amiri', 'Traditional Arabic', 'Scheherazade New', serif" font-size="34" fill="#fae29c" text-anchor="middle" font-weight="bold" letter-spacing="1">
    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
  </text>

  <!-- Institution Header -->
  <text x="540" y="152" font-family="'Cinzel', 'Cinzel Decorative', Georgia, serif" font-size="28" fill="#ffffff" text-anchor="middle" font-weight="700" letter-spacing="4">
    MAUZE TAHFEEZ
  </text>
  <text x="540" y="184" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle" letter-spacing="2">
    DARA SA'ADATIL ABADIYAH • GALIAKOT SHARIF
  </text>

  <!-- Title Badge -->
  <rect x="330" y="210" width="420" height="42" rx="21" fill="#1e3a5f" stroke="url(#goldGrad)" stroke-width="1.5" />
  <text x="540" y="237" font-family="'Segoe UI', Roboto, sans-serif" font-size="17" fill="#fae29c" text-anchor="middle" font-weight="700" letter-spacing="2">
    WEEKLY MARHALA REPORT
  </text>

  <!-- Student Name Hero Card -->
  <g filter="url(#shadow)">
    <rect x="80" y="280" width="920" height="150" rx="24" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2.5" />
  </g>
  <text x="540" y="325" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle" letter-spacing="3" text-transform="uppercase">
    STUDENT PERFORMANCE SUMMARY
  </text>
  <text x="540" y="380" font-family="'Cinzel', Georgia, serif" font-size="38" fill="#ffffff" text-anchor="middle" font-weight="800" filter="url(#glow)">
    ${escapeXml(name)}
  </text>
  <text x="540" y="412" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#fae29c" text-anchor="middle" font-weight="600">
    📅 ${escapeXml(dateRange)}
  </text>

  <!-- Primary Metric: Weekly Score Card -->
  <g filter="url(#shadow)">
    <rect x="80" y="460" width="445" height="230" rx="22" fill="url(#cardGrad)" stroke="#38bdf8" stroke-width="1.5" />
  </g>
  <rect x="110" y="485" width="130" height="30" rx="15" fill="#0369a1" />
  <text x="175" y="505" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" fill="#e0f2fe" text-anchor="middle" font-weight="700">
    TOTAL SCORE
  </text>
  <text x="302" y="585" font-family="'Cinzel', Georgia, serif" font-size="68" fill="url(#scoreGrad)" text-anchor="middle" font-weight="800">
    ${escapeXml(score)}
  </text>
  <text x="302" y="625" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">
    Score out of 100
  </text>
  <rect x="130" y="645" width="345" height="8" rx="4" fill="#0f2b48" />
  <rect x="130" y="645" width="280" height="8" rx="4" fill="url(#goldGrad)" />

  <!-- Total Jadeed Card -->
  <g filter="url(#shadow)">
    <rect x="555" y="460" width="445" height="230" rx="22" fill="url(#cardGrad)" stroke="#10b981" stroke-width="1.5" />
  </g>
  <rect x="585" y="485" width="150" height="30" rx="15" fill="#065f46" />
  <text x="660" y="505" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" fill="#d1fae5" text-anchor="middle" font-weight="700">
    TOTAL JADEED
  </text>
  <text x="777" y="585" font-family="'Amiri', 'Traditional Arabic', serif" font-size="52" fill="#34d399" text-anchor="middle" font-weight="bold">
    ${escapeXml(jadeed)}
  </text>
  <text x="777" y="625" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">
    Weekly Progress Achieved
  </text>
  <rect x="605" y="645" width="345" height="8" rx="4" fill="#0f2b48" />
  <rect x="605" y="645" width="290" height="8" rx="4" fill="#10b981" />

  <!-- Ranking Row -->
  <g filter="url(#shadow)">
    <!-- Marhala Rank -->
    <rect x="80" y="720" width="445" height="190" rx="22" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="1.5" />
  </g>
  <text x="302" y="765" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#fae29c" text-anchor="middle" font-weight="700" letter-spacing="1">
    👑 MARHALA RANK
  </text>
  <text x="302" y="845" font-family="'Cinzel', Georgia, serif" font-size="62" fill="#ffffff" text-anchor="middle" font-weight="800">
    #${escapeXml(marhalaRank)}
  </text>
  <text x="302" y="885" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">
    Within Current Class Marhala
  </text>

  <!-- Overall Rank -->
  <g filter="url(#shadow)">
    <rect x="555" y="720" width="445" height="190" rx="22" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="1.5" />
  </g>
  <text x="777" y="765" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#fae29c" text-anchor="middle" font-weight="700" letter-spacing="1">
    🌟 OVERALL RANK
  </text>
  <text x="777" y="845" font-family="'Cinzel', Georgia, serif" font-size="62" fill="#ffffff" text-anchor="middle" font-weight="800">
    #${escapeXml(overallRank)}
  </text>
  <text x="777" y="885" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">
    Across All Mauze Tahfeez Atfal
  </text>

  <!-- Official Quote / Encouragement -->
  <g filter="url(#shadow)">
    <rect x="80" y="940" width="920" height="150" rx="22" fill="url(#cardGrad)" stroke="rgba(212, 175, 55, 0.3)" stroke-width="1.5" />
  </g>
  <text x="540" y="990" font-family="'Amiri', 'Traditional Arabic', serif" font-size="28" fill="#fae29c" text-anchor="middle" font-weight="bold">
    خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ
  </text>
  <text x="540" y="1025" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" fill="#e2e8f0" text-anchor="middle" font-style="italic">
    "The best among you are those who learn the Qur'an and teach it."
  </text>
  <text x="540" y="1055" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">
    Consistent daily revision &amp; parental encouragement ensures steadfast Hifz excellence.
  </text>

  <!-- Official Verification Footer Banner -->
  <rect x="80" y="1120" width="920" height="44" rx="22" fill="#0f2b48" stroke="#10b981" stroke-width="1" />
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
 * Converts SVG markup to crisp PNG buffer via Resvg.
 */
export function svgToPngBuffer(svgString) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: 1080 }
  });
  return resvg.render().asPng();
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
 * Connects to Meta WhatsApp Multi-Device servers via Baileys socket.
 */
export async function initBaileysSocket() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version = [2, 3000, 1015901307];
  try {
    const v = await fetchLatestBaileysVersion();
    version = v.version;
  } catch (_) {}

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: false
  });

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
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      baileysStatus = 'DISCONNECTED';
      console.log(`[WHATSAPP BOT] Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(initBaileysSocket, 4000);
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
      console.log(`🚀 Ready to dispatch real result images to parents!`);
      console.log(`======================================================\n`);
    }
  });

  return sock;
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

// ---------------------------------------------------------------------------
// Standalone HTTP Server & Bot Engine
// ---------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith('mauze-whatsapp-bot.js')) {
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
        baileysStatus,
        qrDataUrl: latestQrDataUrl,
        openwa: status,
        dispatchesCount: DISPATCH_LOG.length,
        timestamp: new Date().toISOString()
      }));
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
    console.log(`📱 Mauze Tahfeez WhatsApp Bot Engine Online`);
    console.log(`📞 Helpline Number : ${BOT_CONFIG.HELPLINE_NUMBER}`);
    console.log(`⚡ Session ID      : ${BOT_CONFIG.OPENWA_SESSION_ID}`);
    console.log(`🚀 Gateway Port    : ${BOT_CONFIG.PORT}`);
    console.log(`🌐 Live Dashboard  : http://localhost:${BOT_CONFIG.PORT}`);
    console.log(`======================================================\n`);
  });
}
