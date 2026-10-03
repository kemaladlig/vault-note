import { db } from '@/shared/db'

const DEVICE_KEY = 'vault.deviceKey'

/**
 * A non-extractable AES-GCM key that never leaves the browser's crypto engine. It can wrap
 * and unwrap the Vault Key (quick unlock) but its raw bytes cannot be read by JS, so a DB
 * scrape does not yield the key material. This protects against raw storage dumps; it does
 * NOT protect against code running in the same origin.
 */
export async function getOrCreateDeviceKey(): Promise<CryptoKey> {
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
