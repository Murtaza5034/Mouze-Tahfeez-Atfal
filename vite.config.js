import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify("1.5.57"),
    __APP_VERSION_CODE__: JSON.stringify(101),
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

          // 1. Start bot daemon process if requested
          if (subPath === '/start' && req.method === 'POST') {
            try {
              const check = await fetch('http://127.0.0.1:2785/api/status', { signal: AbortSignal.timeout(1000) }).catch(() => null);
              if (check && check.ok) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, message: 'Bot process is already running on port 2785' }));
                return;
              }
              const { spawn } = await import('child_process');
              const botProc = spawn('node', ['scripts/mauze-whatsapp-bot.js'], {
                detached: true,
                stdio: 'ignore',
                shell: true
              });
              botProc.unref();
              await new Promise(r => setTimeout(r, 2000));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Bot process launched on port 2785' }));
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
          if (subPath === '/status') targetPath = '/api/status';
          else if (subPath === '/toggle') targetPath = '/api/toggle-bot';
          else if (subPath === '/request-pairing-code') targetPath = '/api/request-pairing-code';
          else if (subPath === '/test-message') targetPath = '/api/test-message';
          else if (subPath === '/qr') targetPath = '/qr';
          else if (subPath === '/dispatches') targetPath = '/api/dispatches';
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
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              online: false,
              botRunning: false,
              baileysStatus: 'DAEMON_OFFLINE',
              botEnabled: false,
              reason: 'WhatsApp Bot daemon is stopped or port 2785 is inactive. Click "Start Bot" to launch it.',
              port: 2785,
              helpline: '+91 81079 25353',
              error: connErr.message
            }));
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

