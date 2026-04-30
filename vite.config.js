import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
        // Tell PWA to ignore OneSignal workers
        navigateFallbackDenylist: [/^\/OneSignalSDK/],
      },
      includeAssets: ['logo.png', 'favicon.ico'],
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
})
