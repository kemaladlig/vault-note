import { argon2id } from 'hash-wasm'

import { fromBase64, randomBytes, toBase64, type Bytes } from './encoding'
import type { KdfParams } from './types'

/** OWASP-ish baseline for Argon2id on mobile/web. Tuned for ~0.5–1s on a mid-range phone. */
export const DEFAULT_KDF: Omit<KdfParams, 'salt'> = {
  algo: 'argon2id',
  memoryKiB: 65536, // 64 MiB
  iterations: 3,
  parallelism: 1,
  hashLength: 32, // 256-bit KEK
}

export function newKdfParams(overrides?: Partial<Omit<KdfParams, 'salt'>>): KdfParams {
  return { ...DEFAULT_KDF, ...overrides, salt: toBase64(randomBytes(16)) }
}

/** Derive the raw 32-byte KEK from a passphrase. Pure function of (passphrase, params). */
export async function deriveKekBytes(passphrase: string, params: KdfParams): Promise<Bytes> {
  if (params.algo !== 'argon2id') {
    throw new Error(`Desteklenmeyen KDF: ${params.algo}`)
  }
  return argon2id({
    password: passphrase,
    salt: fromBase64(params.salt),
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memoryKiB,
    hashLength: params.hashLength,
    outputType: 'binary',
  }) as Promise<Bytes>
}
