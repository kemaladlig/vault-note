import { Capacitor } from '@capacitor/core'

import { db } from '@/shared/db'

import { fromBase64, importAesKey, toBase64 } from '../crypto'

const DEVICE_KEY = 'vault.deviceKey'
const SECURE_KEY = 'vaultnote.deviceKey'

/**
 * The device key wraps the Vault Key (DEK) so quick unlock can skip the passphrase.
 *
 * - **Web:** a non-extractable AES-GCM CryptoKey kept in IndexedDB. Its raw bytes never reach
 *   JS, so a storage dump does not yield the key material. Protects against raw dumps; not
 *   against same-origin code.
 * - **Native:** the raw key is generated extractable, stored base64 in the OS secure store
 *   (iOS Keychain / Android EncryptedSharedPreferences), and re-imported non-extractable for
 *   use. A biometric prompt gates the unlock (see `biometric.ts`); the key itself is bound to
 *   the OS keystore, not to biometry.
 */
export async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  return Capacitor.isNativePlatform() ? getOrCreateNativeKey() : getOrCreateWebKey()
}

export async function clearDeviceKey(): Promise<void> {
  await db.meta.delete(DEVICE_KEY)
  if (Capacitor.isNativePlatform()) {
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage')
    await SecureStorage.remove(SECURE_KEY).catch(() => {})
  }
}

async function getOrCreateWebKey(): Promise<CryptoKey> {
  const row = await db.meta.get(DEVICE_KEY)
  if (row?.value) return row.value as CryptoKey

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt'],
  )
  await db.meta.put({ key: DEVICE_KEY, value: key })
  return key
}

async function getOrCreateNativeKey(): Promise<CryptoKey> {
  const { SecureStorage } = await import('@aparajita/capacitor-secure-storage')

  const stored = await SecureStorage.get(SECURE_KEY)
  if (typeof stored === 'string') return importAesKey(fromBase64(stored))

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable once, to persist the raw bytes in the OS store
    ['encrypt', 'decrypt'],
  )
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key))
  await SecureStorage.set(SECURE_KEY, toBase64(raw))
  return importAesKey(raw)
}
