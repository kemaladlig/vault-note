/**
 * Native OAuth (Android/iOS) using the Authorization Code + PKCE flow.
 *
 * Opens the system browser via @capacitor/browser, waits for the redirect back into the app
 * via a custom-scheme deep link (@capacitor/app `appUrlOpen`), then exchanges the code for a
 * token. No client secret is needed for public/installed clients.
 *
 * Requires an OAuth client whose redirect URI is exactly `REDIRECT_URI` below.
 */

import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'

import { GOOGLE_CLIENT_ID, isAuthConfigured } from './config'
import { challengeFor, createCodeVerifier } from './pkce'

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

/**
 * Must match a redirect URI registered on the OAuth client, and the intent-filter in
 * `android/app/src/main/AndroidManifest.xml`. Scheme + host form so Android matches reliably.
 */
export const REDIRECT_URI = 'com.vaultnote.app://oauth2redirect'

export { isAuthConfigured }

let accessToken: string | undefined
let expiresAt = 0

export function hasSession(): boolean {
  return Boolean(accessToken) && Date.now() < expiresAt
}

/**
 * No silent restore on native: PKCE issues no refresh token, so a new session needs the user.
 * Present so background sync can share one code path with the web flow.
 */
export function restoreSession(): Promise<boolean> {
  return Promise.resolve(hasSession())
}

interface TokenResponse {
  access_token: string
  expires_in: number
}

export async function signIn(): Promise<void> {
  if (!isAuthConfigured()) throw new Error('VITE_GOOGLE_CLIENT_ID ayarlı değil.')

  const verifier = createCodeVerifier()
  const challenge = await challengeFor(verifier)
  const authUrl = `${AUTH_ENDPOINT}?${new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID as string,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'consent',
  }).toString()}`

  const code = await authorize(authUrl)
  const token = await exchangeCode(code, verifier)
  accessToken = token.access_token
  expiresAt = Date.now() + Math.max(token.expires_in - 60, 0) * 1000
}

async function authorize(url: string): Promise<string> {
  let resolveCode!: (code: string) => void
  let rejectCode!: (error: unknown) => void
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve
    rejectCode = reject
  })

  const handle = await App.addListener('appUrlOpen', ({ url: callbackUrl }) => {
    if (!callbackUrl.startsWith(REDIRECT_URI)) return
    const parsed = new URL(callbackUrl)
    const error = parsed.searchParams.get('error')
    const code = parsed.searchParams.get('code')
    if (error) rejectCode(new Error(error))
    else if (code) resolveCode(code)
    else rejectCode(new Error('Yetkilendirme kodu alınamadı'))
  })

  await Browser.open({ url })
  try {
    return await codePromise
  } finally {
    await Browser.close().catch(() => {})
    await handle.remove()
  }
}

async function exchangeCode(code: string, verifier: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: GOOGLE_CLIENT_ID as string,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error(`Token değişimi başarısız (${res.status})`)
  return (await res.json()) as TokenResponse
}

export async function getAccessToken(): Promise<string> {
  if (!hasSession()) await signIn()
  return accessToken as string
}

export function signOut(): void {
  accessToken = undefined
  expiresAt = 0
}
