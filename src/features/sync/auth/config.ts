/** Google OAuth client id, shared by the web and native auth providers. */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export function isAuthConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID)
}
