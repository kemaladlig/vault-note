import { importAesKey, open, seal } from './aead'
import { randomBytes, utf8ToBytes, type Bytes } from './encoding'
import { CorruptCiphertextError, WrongPassphraseError } from './errors'
import { deriveKekBytes, newKdfParams } from './kdf'
import type { CreatedVault, KdfParams, Sealed, VaultHeader } from './types'

/** AAD contexts — binding ciphertexts to their purpose prevents cross-slot swapping. */
const AAD_VAULT_KEY = utf8ToBytes('vaultnote:v1:vault-key')
const AAD_KEY_CHECK = utf8ToBytes('vaultnote:v1:key-check')
const KEY_CHECK_PLAINTEXT = utf8ToBytes('vaultnote-key-check-v1')

const DEK_BYTES = 32

/** Wrap the Vault Key (DEK) under the passphrase-derived KEK. */
export async function wrapVaultKey(dek: Bytes, kekBytes: Bytes): Promise<Sealed> {
  const kek = await importAesKey(kekBytes)
  return seal(kek, dek, AAD_VAULT_KEY)
}

/** Unwrap the DEK. Throws WrongPassphraseError when the KEK is wrong (GCM auth failure). */
export async function unwrapVaultKey(wrappedKey: Sealed, kekBytes: Bytes): Promise<Bytes> {
  const kek = await importAesKey(kekBytes)
  try {
    return await open(kek, wrappedKey, AAD_VAULT_KEY)
  } catch (err) {
    if (err instanceof CorruptCiphertextError) throw new WrongPassphraseError()
    throw err
  }
}

async function buildKeyCheck(kekBytes: Bytes): Promise<Sealed> {
  const kek = await importAesKey(kekBytes)
  return seal(kek, KEY_CHECK_PLAINTEXT, AAD_KEY_CHECK)
}

/** Fast passphrase verification: decrypting the key-check blob succeeds only with the right KEK. */
export async function verifyPassphrase(header: VaultHeader, kekBytes: Bytes): Promise<boolean> {
  const kek = await importAesKey(kekBytes)
  try {
    await open(kek, header.keyCheck, AAD_KEY_CHECK)
    return true
  } catch {
    return false
  }
}

/** Create a brand-new vault: fresh DEK, fresh salt, wrapped under the passphrase. */
export async function createVault(
  passphrase: string,
  kdfOverrides?: Partial<Omit<KdfParams, 'salt'>>,
): Promise<CreatedVault> {
  const kdf = newKdfParams(kdfOverrides)
  const kekBytes = await deriveKekBytes(passphrase, kdf)
  const dek = randomBytes(DEK_BYTES)
  const [wrappedKey, keyCheck] = await Promise.all([
    wrapVaultKey(dek, kekBytes),
    buildKeyCheck(kekBytes),
  ])
  return { header: { v: 1, kdf, wrappedKey, keyCheck }, dek }
}

/**
 * Unlock with a passphrase. Verifies cheaply via keyCheck first, then unwraps the DEK.
 * Returns the in-memory Vault Key; the caller owns zeroing it on lock.
 */
export async function unlockVault(passphrase: string, header: VaultHeader): Promise<Bytes> {
  const kekBytes = await deriveKekBytes(passphrase, header.kdf)
  if (!(await verifyPassphrase(header, kekBytes))) throw new WrongPassphraseError()
  return unwrapVaultKey(header.wrappedKey, kekBytes)
}

/**
 * Change the passphrase: re-derive a KEK under a new salt and re-wrap the SAME DEK.
 * Notes are never re-encrypted — that leverage is the whole point of the key hierarchy.
 */
export async function rekeyVault(
  vault: { dek: Bytes },
  newPassphrase: string,
  kdfOverrides?: Partial<Omit<KdfParams, 'salt'>>,
): Promise<VaultHeader> {
  const kdf = newKdfParams(kdfOverrides)
  const kekBytes = await deriveKekBytes(newPassphrase, kdf)
  const [wrappedKey, keyCheck] = await Promise.all([
    wrapVaultKey(vault.dek, kekBytes),
    buildKeyCheck(kekBytes),
  ])
  return { v: 1, kdf, wrappedKey, keyCheck }
}
