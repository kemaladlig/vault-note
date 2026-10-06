import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import { Toaster } from '@/components/ui/toaster'
import { initAccent } from '@/shared/accent'
import { initEditorPrefs } from '@/shared/editorPrefs'
import { initI18n, t } from '@/shared/i18n'
import { initScale } from '@/shared/scale'
import { initTheme } from '@/shared/theme'
import { toast } from '@/shared/toast'

import './index.css'
import App from './App.tsx'

initTheme()
initScale()
initAccent()
initEditorPrefs()
initI18n()

let updatePrompted = false

// Shell updates prompt instead of auto-reloading: an editor must never swap pages
// under a running keystroke. The visibility check is one conditional GET of sw.js
// (304 when nothing changed), fired only when the app comes back to the foreground.
const reloadOnUpdate = registerSW({
  immediate: true,
  onNeedRefresh: () => {
    if (updatePrompted) return
    updatePrompted = true
    toast(t('app.updateAvailable'), 'success', {
      label: t('app.updateAction'),
      run: () => void reloadOnUpdate(),
    })
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update()
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>,
)
