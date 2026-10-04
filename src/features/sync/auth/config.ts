import { Capacitor } from '@capacitor/core'

/**
 * Google OAuth client id, selected per platform: the web client (GIS token flow) and the native
 * client (PKCE + custom redirect) are separate OAuth registrations. Both fall back to the shared
 * `VITE_GOOGLE_CLIENT_ID` for setups that configure only one.
 */
const shared = import.meta.env.VITE_GOOGLE_CLIENT_ID
export const GOOGLE_CLIENT_ID = Capacitor.isNativePlatform()
  ? (import.meta.env.VITE_GOOGLE_CLIENT_ID_NATIVE ?? shared)
  : (import.meta.env.VITE_GOOGLE_CLIENT_ID_WEB ?? shared)

export function isAuthConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID)
}
