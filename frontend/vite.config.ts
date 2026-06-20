import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'

// Get git commit SHA and build timestamp
const getGitCommitSha = () => {
  try {
    return execSync('git rev-parse HEAD').toString().trim()
  } catch (error) {
    console.warn('Unable to get git commit SHA:', error)
    return 'unknown'
  }
}

const getGitCommitShort = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

const getBuildTimestamp = () => {
  return new Date().toISOString()
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: false,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'favicon-48x48.png',
        'favicon-96x96.png',
        'apple-touch-icon.png',
        'android-chrome-192x192.png',
        'android-chrome-512x512.png',
        'ms-icon-144x144.png',
        'robots.txt',
      ],
      manifest: {
        name: 'Bushie Tools',
        short_name: 'Bushie Tools',
        description: 'Simple tools for volunteer emergency crews — sign-in book, vehicle checks, reports, and AI-facilitated After Action Reviews',
        theme_color: '#c8102e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        orientation: 'any',
        icons: [
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Cache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Ensure dev builds with minimal assets don't warn by allowing the generated SW bundle
        globIgnores: ['**/node_modules/**/*'],
        // Don't serve the React app shell (navigateFallback) for the AAR Studio
        // sub-app or the API. The SW is scoped to '/', so without this denylist it
        // intercepts /aar navigations and returns the main index.html, leaving a
        // blank screen instead of letting the request reach the server (which
        // serves the standalone AAR Studio bundle).
        navigateFallbackDenylist: [/^\/aar/, /^\/api/],
        // Network-first strategy for API calls
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Cache-first for images
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          // Cache Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: true, // Enable PWA in development for testing
        type: 'module',
      },
    }),
  ],
  define: {
    '__APP_VERSION__': JSON.stringify({
      commitSha: getGitCommitSha(),
      commitShort: getGitCommitShort(),
      buildTime: getBuildTimestamp(),
      nodeEnv: process.env.NODE_ENV || 'production',
    }),
  },
  build: {
    // Bundle size budgets and optimizations
    chunkSizeWarningLimit: 500, // Warn for chunks > 500 KB
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react-router-dom/')) return 'vendor-react';
          if (id.includes('/node_modules/recharts/')) return 'vendor-charts';
          if (id.includes('/node_modules/framer-motion/')) return 'vendor-motion';
          if (id.includes('/node_modules/socket.io-client/')) return 'vendor-socket';
          if (id.includes('/node_modules/date-fns/')) return 'vendor-date';
          if (id.includes('/node_modules/exceljs/') || id.includes('/node_modules/jspdf/') || id.includes('/node_modules/html2canvas/') || id.includes('/node_modules/papaparse/')) return 'vendor-export';
        },
      },
    },
    // Enable source maps for production debugging (gzipped, minimal overhead)
    sourcemap: true,
    // Optimize asset size
    assetsInlineLimit: 4096, // Inline assets < 4KB as base64
    // Enable CSS code splitting
    cssCodeSplit: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types/',
        '**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        // Browser-only APIs not available in jsdom
        'src/utils/haptic.ts',           // navigator.vibrate
        'src/utils/announcer.ts',        // ARIA live region DOM manipulation
        // Offline/PWA utilities: require IndexedDB + service worker (not in jsdom)
        'src/services/offlineStorage.ts',
        'src/services/offlineQueue.ts',
        'src/services/offlineSupport.ts',
        // Pure animation helpers (Framer Motion / requestAnimationFrame wrappers)
        'src/utils/animations.ts',
      ],
      thresholds: {
        statements: 63,
        branches: 56,
        functions: 69,
        lines: 64,
      },
    },
  },
})
