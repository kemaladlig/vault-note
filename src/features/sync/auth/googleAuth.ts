/**
 * Google Identity Services token flow for the `drive.appdata` scope.
 *
 * Web (and the Capacitor webview) use the GIS token client. Native builds that cannot show
 * the popup should swap this module for a @capacitor/browser + deep-link implementation
 * behind the same `getAccessToken` signature.
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata'
const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** Set `VITE_GOOGLE_CLIENT_ID` in `.env.local` (never committed). */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export function isAuthConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID)
}

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

/** Interactive sign-in. Resolves once an access token is in memory. */
export async function signIn(): Promise<void> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID ayarlı değil.')
  }
  await loadGis()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google Identity Services kullanılamıyor')

  const client = oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: () => {},
  })

  await new Promise<void>((resolve, reject) => {
    client.callback = (response) => {
      if (response.error || !response.access_token) {
        reject(new Error(response.error ?? 'Erişim tokenı alınamadı'))
        return
      }
      accessToken = response.access_token
      const ttl = Number(response.expires_in ?? 3600)
      expiresAt = Date.now() + Math.max(ttl - 60, 0) * 1000
      resolve()
    }
    client.requestAccessToken()
  })
}

export function hasSession(): boolean {
  return Boolean(accessToken) && Date.now() < expiresAt
}

/** Returns a valid token, refreshing interactively if it expired. */
export async function getAccessToken(): Promise<string> {
  if (!hasSession()) await signIn()
  return accessToken as string
}

export function signOut(): void {
  const token = accessToken
  accessToken = undefined
  expiresAt = 0
  if (token) window.google?.accounts?.oauth2?.revoke(token)
}
