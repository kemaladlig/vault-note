/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth web client id (Drive API + `drive.appdata` scope). */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
