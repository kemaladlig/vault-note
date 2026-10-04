import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable PWA + offline app shell. The workbox precache covers only the built
    // same-origin assets; Drive/OAuth traffic is explicitly network-only (never cached).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'VaultNote',
        short_name: 'VaultNote',
        description: 'Sıfır sunucu, uçtan uca şifreli, cihazlar arası not uygulaması.',
        lang: 'tr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f2f4f9',
        theme_color: '#1a1c21',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // The 1024px master is a regeneration source, not a runtime asset; keep it out of the
        // install payload.
        globIgnores: ['**/vaultnote-icon.png'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          // Ciphertext may be cached by the app, never by the SW: API/auth stay live.
          { urlPattern: /^https:\/\/[^/]*googleapis\.com\/.*/i, handler: 'NetworkOnly' },
          { urlPattern: /^https:\/\/accounts\.google\.com\/.*/i, handler: 'NetworkOnly' },
        ],
      },
      // Keep the service worker out of the dev loop; it is a production concern only.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // The editor-core chunk is intentionally large but lazily loaded on first note open.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split the heavy editor + runtime so no single chunk trips the 500 kB warning
        // and the editor code can be cached independently.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Native-only plugins: keep them in their own lazy chunks so the web bundle
          // never loads them (they are behind dynamic imports + isNativePlatform()).
          if (id.includes('@aparajita/')) return
          if (id.includes('@lezer') || id.includes('lang-markdown')) return 'editor-lang'
          if (id.includes('@codemirror') || id.includes('/codemirror/')) return 'editor-core'
          // Preview-only deps: leave them for Rollup's default chunking so they ride the
          // lazy MarkdownPreview chunk instead of the eagerly-loaded vendor bundle.
          if (id.includes('/marked/') || id.includes('/dompurify/')) return
          return 'vendor'
        },
      },
    },
  },
})
