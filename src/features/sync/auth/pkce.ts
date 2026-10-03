import { randomBytes, toBase64 } from '@/features/vault/crypto'

/** RFC 7636 PKCE helpers for the native OAuth flow. */

export function base64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function createCodeVerifier(): string {
  return base64Url(randomBytes(32))
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}
