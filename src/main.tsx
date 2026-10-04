import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import { Toaster } from '@/components/ui/toaster'
import { initI18n } from '@/shared/i18n'
import { initScale } from '@/shared/scale'
import { initTheme } from '@/shared/theme'

import './index.css'
import App from './App.tsx'

initTheme()
initScale()
initI18n()

// Register the app-shell service worker (no-op in dev). autoUpdate keeps the installed
// shell current; the app's own data always goes through Drive, never the cache.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>,
)
