import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify("1.5.40"),
    __APP_VERSION_CODE__: JSON.stringify(84),
  },
  plugins: [
    react(),
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
        importScripts: ['/firebase-messaging-sw.js'],
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
