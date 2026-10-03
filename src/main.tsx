import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Toaster } from '@/components/ui/toaster'
import { initScale } from '@/shared/scale'
import { initTheme } from '@/shared/theme'

import './index.css'
import App from './App.tsx'

initTheme()
initScale()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>,
)
