import { fromBase64, randomBytes, toBase64, type Bytes } from './encoding'
import { CorruptCiphertextError, UnsupportedFormatError } from './errors'
import type { Sealed } from './types'

/** AES-256-GCM via WebCrypto — available in browsers, Capacitor webviews, and Node ≥20. */
const WEB_ALGO = 'AES-GCM' // WebCrypto name; key size is inferred from the raw key bytes.
const ENVELOPE_ALG = 'AES-256-GCM' as const // our persisted label
const IV_BYTES = 12
const TAG_BITS = 128

export async function importAesKey(rawKey: Bytes): Promise<CryptoKey> {
  if (rawKey.length !== 32) {
    throw new UnsupportedFormatError(`AES-256 anahtarı 32 bayt olmalı, ${rawKey.length} geldi`)
  }
  return crypto.subtle.importKey('raw', rawKey, WEB_ALGO, false, ['encrypt', 'decrypt'])
}

/**
 * Encrypt with a fresh random IV. `aad` binds context (e.g. noteId + version) into the auth tag
 * so ciphertexts cannot be swapped between notes or rolled back to an older version.
 */
export async function seal(key: CryptoKey, plaintext: Bytes, aad?: Bytes): Promise<Sealed> {
  const iv = randomBytes(IV_BYTES)
  const params: AesGcmParams = { name: WEB_ALGO, iv, tagLength: TAG_BITS }
  if (aad) params.additionalData = aad
  const ct = await crypto.subtle.encrypt(params, key, plaintext)
  return { v: 1, alg: ENVELOPE_ALG, iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) }
}

export async function open(key: CryptoKey, sealed: Sealed, aad?: Bytes): Promise<Bytes> {
  if (sealed.v !== 1 || sealed.alg !== ENVELOPE_ALG) {
    throw new UnsupportedFormatError(`sealed v${sealed.v}/${sealed.alg}`)
  }
  const iv = fromBase64(sealed.iv)
  if (iv.length !== IV_BYTES) throw new CorruptCiphertextError()
  const params: AesGcmParams = { name: WEB_ALGO, iv, tagLength: TAG_BITS }
  if (aad) params.additionalData = aad
  try {
    const pt = await crypto.subtle.decrypt(params, key, fromBase64(sealed.ct))
    return new Uint8Array(pt)
  } catch {
    // GCM auth failure covers both tampering and a wrong key.
    throw new CorruptCiphertextError()
  }
}

/**
 * Derive a distinct AES key from the Vault Key via HKDF-SHA256, bound to a context string.
 * Each context (note id, manifest, ...) yields an independent key, so a leaked key for one
 * purpose cannot decrypt another.
 */
async function deriveContextKey(dek: Bytes, context: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', dek, 'HKDF', false, ['deriveKey'])
  const info = new TextEncoder().encode(context)
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info },
    baseKey,
    { name: WEB_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function deriveNoteKey(dek: Bytes, noteId: string): Promise<CryptoKey> {
  return deriveContextKey(dek, `vaultnote:note:${noteId}`)
}

/** Key for the encrypted sync manifest (note index). */
export function deriveManifestKey(dek: Bytes): Promise<CryptoKey> {
  return deriveContextKey(dek, 'vaultnote:manifest')
}
