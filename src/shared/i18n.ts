import { useMemo } from 'react'
import { create } from 'zustand'

import { messages, type MessageKey } from './locales'

export type { MessageKey } from './locales'

export type Locale = 'tr' | 'en'

export const LOCALES: ReadonlyArray<{ id: Locale; label: string }> = [
  { id: 'tr', label: 'Türkçe' },
  { id: 'en', label: 'English' },
]

const STORAGE_KEY = 'vaultnote.locale'
const DEFAULT: Locale = 'tr'

function readStored(): Locale {
  if (typeof localStorage === 'undefined') return DEFAULT
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'tr' || value === 'en' ? value : DEFAULT
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  )
}

/** Resolve one key for a locale, falling back to Turkish and finally to the key itself. */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const value = messages[locale][key] ?? messages[DEFAULT][key] ?? key
  return interpolate(value, params)
}

interface I18nState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: readStored(),
  setLocale: (locale) => {
    localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale
    set({ locale })
  },
}))

/** Translate outside React (stores, toasts, non-component helpers) at the current locale. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return translate(useI18nStore.getState().locale, key, params)
}

/** React translator that re-renders when the locale changes. */
export function useT(): (key: MessageKey, params?: Record<string, string | number>) => string {
  const locale = useI18nStore((s) => s.locale)
  return useMemo(() => (key: MessageKey, params?) => translate(locale, key, params), [locale])
}

/** Current locale, read once at boot to align `<html lang>`. */
export function initI18n(): void {
  document.documentElement.lang = useI18nStore.getState().locale
}
