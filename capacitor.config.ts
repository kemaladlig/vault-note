import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.vaultnote.app',
  appName: 'VaultNote',
  webDir: 'dist',
  server: {
    // WebCrypto (crypto.subtle) needs a secure context inside the native webview.
    androidScheme: 'https',
    iosScheme: 'https',
  },
}

export default config
