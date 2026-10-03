import { describe, expect, it } from 'vitest'

import {
  CorruptCiphertextError,
  WrongPassphraseError,
  createVault,
  importAesKey,
  open,
  openNote,
  rekeyVault,
  seal,
  sealNote,
  unlockVault,
  utf8ToBytes,
  bytesToUtf8,
  randomBytes,
} from './index'

/** Fast KDF params so the suite runs in milliseconds instead of seconds. */
const FAST = { memoryKiB: 1024, iterations: 1, parallelism: 1 }

describe('aead (AES-256-GCM)', () => {
  it('round-trips arbitrary bytes', async () => {
    const key = await importAesKey(randomBytes(32))
    const plaintext = utf8ToBytes('merhaba dünya 🎈 — uzun bir not gövdesi')
    const sealed = await seal(key, plaintext)
    expect(bytesToUtf8(await open(key, sealed))).toBe('merhaba dünya 🎈 — uzun bir not gövdesi')
  })

  it('uses a unique IV per sealing', async () => {
    const key = await importAesKey(randomBytes(32))
    const a = await seal(key, utf8ToBytes('x'))
    const b = await seal(key, utf8ToBytes('x'))
    expect(a.iv).not.toBe(b.iv)
    expect(a.ct).not.toBe(b.ct)
  })

  it('rejects decryption with the wrong key', async () => {
    const sealed = await seal(await importAesKey(randomBytes(32)), utf8ToBytes('secret'))
    const other = await importAesKey(randomBytes(32))
    await expect(open(other, sealed)).rejects.toBeInstanceOf(CorruptCiphertextError)
  })

  it('rejects a tampered auth tag', async () => {
    const key = await importAesKey(randomBytes(32))
    const sealed = await seal(key, utf8ToBytes('secret'))
    const tampered = { ...sealed, ct: sealed.ct.slice(0, -2) + (sealed.ct.endsWith('A') ? 'B' : 'A') }
    await expect(open(key, tampered)).rejects.toBeInstanceOf(CorruptCiphertextError)
  })

  it('binds AAD — mismatched context fails', async () => {
    const key = await importAesKey(randomBytes(32))
    const sealed = await seal(key, utf8ToBytes('secret'), utf8ToBytes('ctx-a'))
    await expect(open(key, sealed, utf8ToBytes('ctx-b'))).rejects.toBeInstanceOf(
      CorruptCiphertextError,
    )
    expect(bytesToUtf8(await open(key, sealed, utf8ToBytes('ctx-a')))).toBe('secret')
  })
})

describe('vault key hierarchy', () => {
  it('unlocks with the right passphrase and returns the same DEK', async () => {
    const created = await createVault('correct horse battery staple', FAST)
    const dek = await unlockVault('correct horse battery staple', created.header)
    expect(Array.from(dek)).toEqual(Array.from(created.dek))
  })

  it('rejects a wrong passphrase', async () => {
    const created = await createVault('right-pass', FAST)
    await expect(unlockVault('wrong-pass', created.header)).rejects.toBeInstanceOf(
      WrongPassphraseError,
    )
  })

  it('rekey keeps the DEK but changes the wrapping', async () => {
    const created = await createVault('old-pass', FAST)
    const newHeader = await rekeyVault(created, 'new-pass', FAST)

    await expect(unlockVault('old-pass', newHeader)).rejects.toBeInstanceOf(WrongPassphraseError)
    const dek = await unlockVault('new-pass', newHeader)
    expect(Array.from(dek)).toEqual(Array.from(created.dek))
    expect(created.header.kdf.salt).not.toBe(newHeader.kdf.salt)
  })
})

describe('note payloads', () => {
  const noteId = 'note-123'
  const payload = { title: 'Başlık', body: 'uzun gövde metni', tags: ['a', 'b'] }

  it('round-trips a full note payload', async () => {
    const dek = randomBytes(32)
    const sealed = await sealNote(dek, noteId, 1, payload)
    expect(await openNote(dek, noteId, 1, sealed)).toEqual(payload)
  })

  it('isolates notes — a different noteId cannot decrypt', async () => {
    const dek = randomBytes(32)
    const sealed = await sealNote(dek, noteId, 1, payload)
    await expect(openNote(dek, 'note-999', 1, sealed)).rejects.toBeInstanceOf(
      CorruptCiphertextError,
    )
  })

  it('binds the version — rollback to an older revision fails', async () => {
    const dek = randomBytes(32)
    const sealed = await sealNote(dek, noteId, 2, payload)
    await expect(openNote(dek, noteId, 1, sealed)).rejects.toBeInstanceOf(CorruptCiphertextError)
  })
})
