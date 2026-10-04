/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Shared Google OAuth client id, used when a platform-specific one is not set. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** Web client id for the Google Identity Services token flow. */
  readonly VITE_GOOGLE_CLIENT_ID_WEB?: string
  /** Native client id for the PKCE + custom-redirect flow. */
  readonly VITE_GOOGLE_CLIENT_ID_NATIVE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
