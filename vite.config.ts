import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
          return 'vendor'
        },
      },
    },
  },
})
