import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify("1.2.2"),
    __APP_VERSION_CODE__: JSON.stringify(25),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: [
        'logo.png',
        'favicon.ico',
        'fonts/al-kanz.ttf',
        'Kanz al Marjaan/kanz-al-marjaan-webfont.woff2',
        'Kanz al Marjaan/kanz-al-marjaan-webfont.woff',
        'Kanz al Marjaan/kanz-al-marjaan-webfont.ttf',
        'Child-Hood.otf',
        'Qilka-Bold.otf',
      ],
      manifest: {
        name: 'Mauze Tahfeez Management',
        short_name: 'MauzeTahfeez',
        description: 'Premium Management Portal for Mauze Tahfeez',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
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
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  },
}))
