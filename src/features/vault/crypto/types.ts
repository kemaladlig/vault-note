import type { Bytes } from './encoding'

/** Domain types for the vault's cryptographic envelope. Stored values are always
 * strings (base64) so they survive JSON round-trips to disk and Google Drive. */

/** AES-256-GCM sealed blob. `ct` includes the 16-byte GCM auth tag appended by WebCrypto. */
export interface Sealed {
  readonly v: 1
  readonly alg: 'AES-256-GCM'
  /** 12-byte initialization vector, base64. Unique per encryption. */
  readonly iv: string
  /** Ciphertext ‖ auth tag, base64. */
  readonly ct: string
}

/** Public key-derivation parameters. NOT secret — stored next to the wrapped key so any
 * device can re-derive the KEK from the passphrase. */
export interface KdfParams {
  readonly algo: 'argon2id'
  /** 16-byte random salt, base64. */
  readonly salt: string
  readonly memoryKiB: number
  readonly iterations: number
  readonly parallelism: number
  readonly hashLength: number
}

/** Everything a device needs to unlock the vault with the right passphrase. */
export interface VaultHeader {
  readonly v: 1
  readonly kdf: KdfParams
  /** Vault Key (DEK) wrapped by the KEK. */
  readonly wrappedKey: Sealed
  /** Sealed known-plaintext for fast passphrase verification / corruption detection. */
  readonly keyCheck: Sealed
}

/** The two access modes agreed in the design. */
export type VaultMode = 'passphrase' | 'device'

/** Result of creating a vault. `dek` stays in memory only; never persisted as-is. */
export interface CreatedVault {
  readonly header: VaultHeader
  readonly dek: Bytes
}
