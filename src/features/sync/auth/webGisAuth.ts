/**
 * Google Identity Services token flow (web / Capacitor webview) for `drive.appdata`.
 * Used wherever the GIS script can run its own popup.
 */

import { GOOGLE_CLIENT_ID, isAuthConfigured } from './config'

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata'
const GIS_SRC = 'https://accounts.google.com/gsi/client'

export { isAuthConfigured }

interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  error?: string
}

interface TokenClient {
  callback: (response: TokenResponse) => void
  requestAccessToken: (options?: { prompt?: string }) => void
}

interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: unknown) => void
  }) => TokenClient
  revoke: (token: string, done?: () => void) => void
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } }
  }
}

let accessToken: string | undefined
let expiresAt = 0
let gisLoaded: Promise<void> | undefined
/** In-flight silent restore, so concurrent polls share one attempt. */
let silent: Promise<boolean> | undefined
/** Last failed silent attempt; backs off background polls when consent/config blocks them. */
let lastSilentFail = 0
const SILENT_COOLDOWN_MS = 30_000
/** A stuck Google popup (blank page, blocked window) must never hang the UI forever. */
const POPUP_TIMEOUT_MS = 60_000
/** Last interactive failure in plain language, so the UI can say what actually happened. */
let lastFailure: string | undefined

/**
 * Set after the first successful consent. Silent restores are gated on it: without prior
 * consent every cold start would flash (and often trip the popup blocker on) a Google
 * window the user never asked for.
 */
const CONSENT_KEY = 'vaultnote.driveConnected'

function hasConsented(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

function markConsented(): void {
  try {
    localStorage.setItem(CONSENT_KEY, '1')
  } catch {
    /* private mode — silent restore just retries next time */
  }
}

function clearConsent(): void {
  try {
    localStorage.removeItem(CONSENT_KEY)
  } catch {
    /* nothing persisted */
  }
}

/** Maps GIS failure shapes to something a user can act on. */
function describeFailure(error: unknown): string {
  const raw =
    typeof error === 'string'
      ? error
      : typeof (error as { message?: unknown } | null)?.message === 'string'
        ? String((error as { message: string }).message)
        : ''
  const text = raw.toLowerCase()
  if (text.includes('popup') && (text.includes('block') || text.includes('blocker'))) {
    return 'Tarayıcı Google penceresini engelledi. Adres çubuğundaki ikondan açılır pencerelere izin verip tekrar dene.'
  }
  if (text.includes('popup') && text.includes('clos')) {
    return 'Google penceresi kapatıldı. Bağlanmak için pencereyi açık bırakıp hesabını seç.'
  }
  if (text.includes('access_denied') || text.includes('denied') || text.includes('consent')) {
    return 'Google izni verilmedi. Drive senkronu için izni onaylaman gerekir.'
  }
  return 'Erişim tokenı alınamadı.'
}

function loadGis(): Promise<void> {
  gisLoaded ??= new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Identity Services yüklenemedi'))
    document.head.appendChild(script)
  })
  return gisLoaded
}

function applyToken(response: TokenResponse): boolean {
  if (response.error || !response.access_token) return false
  accessToken = response.access_token
  const ttl = Number(response.expires_in ?? 3600)
  expiresAt = Date.now() + Math.max(ttl - 60, 0) * 1000
  markConsented()
  return true
}

/** Request a token. `prompt` omitted = let Google decide (may show UI); `'none'` = silent. */
async function requestToken(prompt?: string): Promise<boolean> {
  if (!GOOGLE_CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID ayarlı değil.')
  await loadGis()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google Identity Services kullanılamıyor')

  return new Promise<boolean>((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (!settled) {
        settled = true
        window.clearTimeout(timer)
        resolve(ok)
      }
    }
    // A Google popup stuck on a blank page never settles — time out so the UI can
    // tell the user to close it and retry instead of spinning forever.
    const timer = window.setTimeout(() => {
      lastFailure =
        'Google penceresi yanıt vermedi (boş ekranda kaldıysa kapatıp tekrar dene).'
      done(false)
    }, POPUP_TIMEOUT_MS)
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID as string,
      scope: SCOPES,
      callback: (response) => {
        const ok = applyToken(response)
        if (!ok) lastFailure = describeFailure(response.error)
        done(ok)
      },
      // Config errors (origin_mismatch) surface here instead of hanging the popup.
      error_callback: (error) => {
        lastFailure = describeFailure(error)
        done(false)
      },
    })
    client.callback = (response) => {
      const ok = applyToken(response)
      if (!ok) lastFailure = describeFailure(response.error)
      done(ok)
    }
    try {
      client.requestAccessToken(prompt === undefined ? undefined : { prompt })
    } catch (error) {
      lastFailure = describeFailure(error)
      done(false)
    }
  })
}

/** Interactive sign-in. Resolves once an access token is in memory. */
export async function signIn(): Promise<void> {
  lastFailure = undefined
  if (!(await requestToken())) throw new Error(lastFailure ?? 'Erişim tokenı alınamadı')
}

/**
 * Token for background work: silent restore only, never a popup. Throws when there is
 * no live session so auto-sync no-ops quietly instead of tripping the popup blocker.
 */
export async function getAccessTokenSilent(): Promise<string> {
  if (hasSession()) return accessToken as string
  if (await restoreSession()) return accessToken as string
  throw new Error('Oturum yok')
}

/**
 * Silent session restore: reuses the browser's existing Google session with no UI. Resolves
 * `false` when consent or interaction is needed, so background sync can no-op quietly.
 */
export function restoreSession(): Promise<boolean> {
  if (hasSession()) return Promise.resolve(true)
  if (!GOOGLE_CLIENT_ID) return Promise.resolve(false)
  // Never connected on this browser: don't flash a Google window the user never asked
  // for (and don't trip its popup blocker) on every cold start and focus event.
  if (!hasConsented()) return Promise.resolve(false)
  // Back off after a failure (consent needed, misconfigured origin, popup blocked)
  // so the 5s auto-sync poll doesn't hammer Google with token requests.
  if (Date.now() - lastSilentFail < SILENT_COOLDOWN_MS) return Promise.resolve(false)
  silent ??= requestToken('none')
    .then((ok) => {
      if (!ok) lastSilentFail = Date.now()
      return ok
    })
    .catch(() => {
      lastSilentFail = Date.now()
      return false
    })
    .finally(() => {
      silent = undefined
    })
  return silent
}

export function hasSession(): boolean {
  return Boolean(accessToken) && Date.now() < expiresAt
}

/** Returns a valid token: silent restore when possible, otherwise an interactive prompt. */
export async function getAccessToken(): Promise<string> {
  if (!hasSession() && !(await restoreSession())) await signIn()
  return accessToken as string
}

export function signOut(): void {
  const token = accessToken
  accessToken = undefined
  expiresAt = 0
  clearConsent()
  if (token) window.google?.accounts?.oauth2?.revoke(token)
}
