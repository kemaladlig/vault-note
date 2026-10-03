export { syncNotes, noteFileName, MANIFEST_NAME, type SyncDeps, type SyncResult } from './engine'
export { createGoogleDriveClient } from './drive/googleDrive'
export type { DriveClient, DriveFileMeta } from './drive/types'
export {
  signIn,
  signOut,
  getAccessToken,
  hasSession,
  isAuthConfigured,
  GOOGLE_CLIENT_ID,
} from './auth/googleAuth'
export {
  uploadBootstrap,
  downloadBootstrap,
  BOOTSTRAP_NAME,
  type VaultBootstrap,
  type BootstrapSettings,
} from './bootstrap'
export { sealManifest, openManifest, type Manifest, type ManifestEntry } from './manifest'
