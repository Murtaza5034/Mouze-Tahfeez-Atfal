import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify("1.2.7"),
    __APP_VERSION_CODE__: JSON.stringify(30),
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
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
        maximumFileSizeToCacheInBytes: 5242880,
        globPatterns: ['**/*.{js,css,html,json,png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,otf}'],
        globIgnores: ['**/login background.jpg', '**/kanz-al-marjaan-webfont.svg'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/medypnbcsjytbxiwenob\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 10,
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico)(?:\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 * 30 },
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
    sourcemap: false,
    minify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor';
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase';
          }
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
            return 'pdf';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@supabase/supabase-js',
      'lucide-react',
    ],
  },
  server: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    allowedHosts: true,
  },
}))
