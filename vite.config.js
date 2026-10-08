import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify("1.5.60"),
    __APP_VERSION_CODE__: JSON.stringify(103),
  },
  plugins: [
    react(),
    {
      name: 'dev-debug-dump',
      configureServer(server) {
        server.middlewares.use('/api/debug-dump', (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try {
                fs.writeFileSync('scratch/debug_portal_dump.json', body, 'utf8');
              } catch (_) {}
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
            });
            return;
          }
          res.end('ok');
        });
      }
    },
    // Patch: Add missing getRefreshReg to @vitejs/plugin-react v6's
    // bundled refresh-runtime.js (needed by React 18 Fast Refresh).
    // The plugin v6 ships a simplified runtime that omits this function.
    {
      name: 'patch-react-refresh-runtime',
      transform(code, id) {
        // Handle both raw ID and \0-prefixed variants (Vite/Rolldown internal handling)
        if (id === '/@react-refresh' || id.endsWith('/@react-refresh')) {
          return code + `
// --- patched by mauze-tahfeez ---
// getRefreshReg is called by React 18's babel transform to register
// component types for Fast Refresh. Returns (type, id) => register(type, id).
export function getRefreshReg() {
  return function (type, id) {
    register(type, id);
  };
}
`;
        }
        return code;
      }
    },
    // Dev proxy for /api/image-proxy — lets html2canvas download images without CORS
    {
      name: 'dev-image-proxy',
      configureServer(server) {
        server.middlewares.use('/api/image-proxy', async (req, res) => {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const targetUrl = urlObj.searchParams.get('url');
            if (!targetUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing url' }));
              return;
            }
            const upstream = await fetch(targetUrl);
            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Upstream HTTP ${upstream.status}` }));
              return;
            }
            const arrayBuf = await upstream.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            const contentType = upstream.headers.get('content-type') || 'image/jpeg';
            const base64 = buf.toString('base64');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ dataUrl: `data:${contentType};base64,${base64}` }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      }
    },
    // Dev proxy & controller for /api/whatsapp-bot — connects frontend to local bot on port 2785
    {
      name: 'dev-whatsapp-bot-proxy',
      configureServer(server) {
        // Auto-launch WhatsApp bot background daemon on dev server start
        const ensureBotRunning = async () => {
          try {
            const check = await fetch('http://127.0.0.1:2785/api/status', { signal: AbortSignal.timeout(1000) }).catch(() => null);
            if (!check || !check.ok) {
              const { spawn } = await import('child_process');
              const { resolve } = await import('path');
              const scriptPath = resolve('scripts', 'mauze-whatsapp-bot.js');
              const botProc = spawn('node', [scriptPath], {
                detached: true,
                stdio: 'ignore',
                shell: true,
                cwd: process.cwd()
              });
              botProc.unref();
              console.log('\x1b[32m[VITE-BOT-AUTORUN] 📱 WhatsApp Bot daemon automatically launched in background on port 2785.\x1b[0m');
            }
          } catch (_) {}
        };
        setTimeout(ensureBotRunning, 1000);

        server.middlewares.use('/api/whatsapp-bot', async (req, res) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          const urlObj = new URL(req.url, 'http://localhost');
          const subPath = urlObj.pathname;
          const isStartReq = subPath === '/start' || subPath.endsWith('/start') || subPath === '/api/whatsapp-bot/start';

          // 1. Start bot daemon process if requested
          if (isStartReq && req.method === 'POST') {
            try {
              const check = await fetch('http://127.0.0.1:2785/api/status', { signal: AbortSignal.timeout(1000) }).catch(() => null);
              if (check && check.ok) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, message: 'Bot process is already running on port 2785', online: true }));
                return;
              }
              const { spawn } = await import('child_process');
              const { resolve } = await import('path');
              const scriptPath = resolve('scripts', 'mauze-whatsapp-bot.js');
              const botProc = spawn('node', [scriptPath], {
                detached: true,
                stdio: 'ignore',
                shell: true,
                cwd: process.cwd()
              });
              botProc.unref();
              await new Promise(r => setTimeout(r, 2000));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Bot process launched on port 2785', online: true }));
              return;
            } catch (startErr) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: startErr.message }));
              return;
            }
          }

          // 2. Map subPath to upstream bot path on http://127.0.0.1:2785
          let targetPath = '/api/status';
          if (subPath === '/status' || subPath.endsWith('/status')) targetPath = '/api/status';
          else if (subPath === '/toggle' || subPath.endsWith('/toggle')) targetPath = '/api/toggle-bot';
          else if (subPath === '/request-pairing-code' || subPath.endsWith('/request-pairing-code')) targetPath = '/api/request-pairing-code';
          else if (subPath === '/test-message' || subPath.endsWith('/test-message')) targetPath = '/api/test-message';
          else if (subPath === '/qr' || subPath.endsWith('/qr')) targetPath = '/qr';
          else if (subPath === '/dispatches' || subPath.endsWith('/dispatches')) targetPath = '/api/dispatches';
          else targetPath = subPath.startsWith('/api') ? subPath : `/api${subPath}`;

          try {
            let body = undefined;
            if (req.method === 'POST') {
              const chunks = [];
              for await (const chunk of req) {
                chunks.push(chunk);
              }
              body = Buffer.concat(chunks).toString();
            }

            const upstream = await fetch(`http://127.0.0.1:2785${targetPath}`, {
              method: req.method,
              headers: {
                'Content-Type': req.headers['content-type'] || 'application/json'
              },
              body: body,
              signal: AbortSignal.timeout(6000)
            });

            const contentType = upstream.headers.get('content-type') || 'application/json';
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', contentType);

            if (contentType.includes('image/')) {
              const arrBuf = await upstream.arrayBuffer();
              res.end(Buffer.from(arrBuf));
            } else {
              const text = await upstream.text();
              res.end(text);
            }
          } catch (connErr) {
            // Auto-trigger background launch on connection failure
            ensureBotRunning();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              online: false,
              botRunning: false,
              baileysStatus: 'DAEMON_OFFLINE',
              botEnabled: false,
              reason: 'WhatsApp Bot daemon is starting up on port 2785. Please try again in 3 seconds.',
              port: 2785,
              helpline: '+91 81079 25353',
              error: connErr.message
            }));
          }
        });

        // 2. Dev server handler for /api/admission-admin
        server.middlewares.use('/api/admission-admin', async (req, res) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          const fs = await import('fs');
          const path = await import('path');
          const dataFile = path.resolve('public', 'admissions_data.json');

          const readData = () => {
            try {
              if (fs.existsSync(dataFile)) {
                return JSON.parse(fs.readFileSync(dataFile, 'utf8')) || [];
              }
            } catch (_) {}
            return [];
          };

          const writeData = (list) => {
            try {
              fs.writeFileSync(dataFile, JSON.stringify(list, null, 2), 'utf8');
            } catch (_) {}
          };

          if (req.method === 'GET') {
            const list = readData();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data: list }));
            return;
          }

          if (req.method === 'POST' || req.method === 'PATCH') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
            const list = readData();
            const appId = body.applicationId || body.application_id || body.id;
            const idx = list.findIndex(r => r.application_id === appId);
            let updated = null;
            const timestamp = new Date().toISOString();

            if (idx >= 0) {
              const current = list[idx];
              const newStatus = body.newStatus || body.status || (body.action === 'exit' ? 'exited' : body.action === 'resume' ? 'approved' : current.status);
              const prevStatus = current.status;
              let newEnrolled = current.enrolled_count || 0;
              let newExit = current.exit_count || 0;
              let newResume = current.resume_count || 0;

              if (newStatus === "approved" && prevStatus !== "approved") {
                newEnrolled += 1;
              } else if (newStatus === "exited" && prevStatus !== "exited") {
                newExit += 1;
              } else if (body.action === "resume") {
                newResume += 1;
              }

              const newLog = {
                id: `log_${Date.now()}`,
                action: newStatus,
                from_status: prevStatus,
                to_status: newStatus,
                timestamp,
                actor: body.adminUser || "Admin",
                note: body.adminNote || (body.exitReason ? `Exited: ${body.exitReason}` : body.resumeNote ? `Resumed: ${body.resumeNote}` : `Status updated from ${prevStatus} to ${newStatus}`)
              };

              const existingLogs = Array.isArray(current.timeline_audit_log) ? current.timeline_audit_log : [];

              list[idx] = {
                ...current,
                ...body,
                status: newStatus,
                enrolled_count: newEnrolled,
                exit_count: newExit,
                resume_count: newResume,
                timeline_audit_log: [newLog, ...existingLogs],
                updated_at: timestamp,
                last_action_by: body.adminUser || "Admin"
              };
              updated = list[idx];
            } else {
              updated = {
                application_id: appId,
                ...body,
                status: body.newStatus || body.status || "pending",
                created_at: timestamp,
                updated_at: timestamp
              };
              list.unshift(updated);
            }
            writeData(list);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data: updated }));
            return;
          }
        });

        // 3. Dev server handler for /api/submit-admission
        server.middlewares.use('/api/submit-admission', async (req, res) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (req.method === 'POST') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const formData = JSON.parse(Buffer.concat(chunks).toString() || '{}');
            
            const fs = await import('fs');
            const path = await import('path');
            const dataFile = path.resolve('public', 'admissions_data.json');

            let list = [];
            try {
              if (fs.existsSync(dataFile)) {
                list = JSON.parse(fs.readFileSync(dataFile, 'utf8')) || [];
              }
            } catch (_) {}

            const year = '1447';
            const randomPart = Math.floor(1000 + Math.random() * 9000);
            const timePart = Date.now().toString().slice(-4);
            const appId = formData.application_id || `MT-${year}-${randomPart}${timePart}`;
            const timestamp = new Date().toISOString();

            const record = {
              application_id: appId,
              full_name: formData.fullName?.trim() || formData.full_name?.trim() || '',
              its_number: formData.itsNumber?.trim() || formData.its_number?.trim() || '',
              gender: formData.gender || 'male',
              age: parseInt(formData.age, 10) || null,
              jamaat: formData.jamaat === 'Other' ? (formData.jamaatOther?.trim() || 'Other') : (formData.jamaat || 'Galiakot'),
              email: formData.email?.trim()?.toLowerCase() || '',
              whatsapp_number: formData.whatsappNumber?.trim() || formData.whatsapp_number?.trim() || '',
              program: formData.program || 'Al-Atfal (7 to 15 yrs old)',
              last_achieved_sanad: formData.lastAchievedSanad || formData.last_achieved_sanad || null,
              venue_and_time: formData.venueAndTime || formData.venue_and_time || null,
              dob: formData.dob || null,
              hifz_till: formData.hifzTill || formData.hifz_till || null,
              status: 'pending',
              enrolled_count: 0,
              exit_count: 0,
              resume_count: 0,
              timeline_audit_log: [
                {
                  id: `log_${Date.now()}`,
                  action: 'submitted',
                  from_status: 'none',
                  to_status: 'pending',
                  timestamp,
                  actor: 'Applicant (Online Form)',
                  note: 'Admission form successfully submitted online.'
                }
              ],
              submitted_at: timestamp,
              created_at: timestamp,
              updated_at: timestamp
            };

            const idx = list.findIndex(r => r.application_id === appId);
            if (idx >= 0) list[idx] = record;
            else list.unshift(record);

            try {
              fs.writeFileSync(dataFile, JSON.stringify(list, null, 2), 'utf8');
            } catch (_) {}

            // Trigger WhatsApp bot
            try {
              fetch('http://127.0.0.1:2785/api/whatsapp-admission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger: 'submission', application: record })
              }).catch(() => {});
            } catch (_) {}

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, applicationId: appId, data: record }));
            return;
          }
        });
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      includeAssets: [
        'logo.png',
        'favicon.ico',
        'LOGO ATFAAL.png',
        'fonts/al-kanz.ttf',
        'Kanz al Marjaan/kanz-al-marjaan-webfont.woff2',
        'Kanz al Marjaan/kanz-al-marjaan-webfont.woff',
        'Kanz al Marjaan/kanz-al-marjaan-webfont.ttf',
        'Child-Hood.otf',
        'Qilka-Bold.otf',
      ],
      workbox: {
        maximumFileSizeToCacheInBytes: 10485760,
        globPatterns: ['**/*.{js,css,html,json,png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,otf}'],
        globIgnores: ['**/login background.jpg', '**/kanz-al-marjaan-webfont.svg'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico|webp)(?:\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 60 },
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 86400 * 365 },
            }
          },
          {
            urlPattern: /\.(?:woff|woff2|ttf|otf)(?:\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 86400 * 365 },
            }
          },
        ],
      },
      manifest: {
        name: 'Mauze Tahfeez Management Portal',
        short_name: 'MauzeTahfeez',
        description: 'Premium Management Portal for Mauze Tahfeez - Quran memorization tracking & Islamic education',
        theme_color: '#c5a059',
        background_color: '#fcfaf5',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'en-US',
        categories: ['education', 'productivity'],
        prefer_related_applications: false,
        icons: [
          { src: 'LOGO ATFAAL-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'LOGO ATFAAL-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'logo.png', sizes: '192x192', type: 'image/png' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Home',
            url: '/',
            icons: [{ src: 'LOGO ATFAAL-192.png', sizes: '192x192' }]
          }
        ]
      }
    })
  ],
  base: '/',
  build: {
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('jszip') || id.includes('file-saver')) {
              return 'vendor-export';
            }
            if (id.includes('lottie-web') || id.includes('@lottiefiles/lottie-player')) {
              return 'vendor-lottie';
            }
            if (id.includes('ai') || id.includes('@ai-sdk')) {
              return 'vendor-ai';
            }
            return 'vendor';
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096,
  },
  server: {
    watch: {
      ignored: ['**/dist/**', '**/dist_*/**', '**/dist_trash*/**', '**/.git/**', '**/.agents/**', '**/build/**'],
    },
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    allowedHosts: true,
  },
}))

