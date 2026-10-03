/** Binary ⇄ string helpers. All crypto code speaks Uint8Array; persistence speaks base64. */

/**
 * A byte array guaranteed to be backed by a plain ArrayBuffer (not SharedArrayBuffer).
 * TypeScript's WebCrypto typings require this; our views never wrap shared memory.
 */
export type Bytes = Uint8Array<ArrayBuffer>

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function utf8ToBytes(text: string): Bytes {
  return encoder.encode(text)
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes)
}

/** Encode bytes as standard base64. Chunked to avoid call-stack limits on large buffers. */
export function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function fromBase64(b64: string): Bytes {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Cryptographically strong random bytes. */
export function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length))
}
