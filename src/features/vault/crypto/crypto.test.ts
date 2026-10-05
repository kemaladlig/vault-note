import { describe, expect, it } from 'vitest'

import {
  CorruptCiphertextError,
  WrongPassphraseError,
  createVault,
  deriveNoteKey,
  importAesKey,
  open,
  openNote,
  rekeyVault,
  restampNote,
  seal,
  sealNote,
  unlockVault,
  utf8ToBytes,
  bytesToUtf8,
  randomBytes,
  type Bytes,
  type Sealed,
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
    const binding = { id: noteId, version: 1, updatedAt: 1000 }
    const sealed = await sealNote(dek, binding, payload)
    expect(await openNote(dek, binding, sealed)).toEqual(payload)
  })

  it('isolates notes — a different noteId cannot decrypt', async () => {
    const dek = randomBytes(32)
    const sealed = await sealNote(dek, { id: noteId, version: 1, updatedAt: 1 }, payload)
    await expect(
      openNote(dek, { id: 'note-999', version: 1, updatedAt: 1 }, sealed),
    ).rejects.toBeInstanceOf(CorruptCiphertextError)
  })

  it('binds the version — rollback to an older revision fails', async () => {
    const dek = randomBytes(32)
    const sealed = await sealNote(dek, { id: noteId, version: 2, updatedAt: 1 }, payload)
    await expect(openNote(dek, { id: noteId, version: 1, updatedAt: 1 }, sealed)).rejects.toBeInstanceOf(
      CorruptCiphertextError,
    )
  })

  it('binds the timestamp — a bumped updatedAt cannot open the old ciphertext', async () => {
    // The replay case: a stale row re-uploaded with a newer timestamp must not decrypt.
    const dek = randomBytes(32)
    const sealed = await sealNote(dek, { id: noteId, version: 1, updatedAt: 1000 }, payload)
    await expect(
      openNote(dek, { id: noteId, version: 1, updatedAt: 9999 }, sealed),
    ).rejects.toBeInstanceOf(CorruptCiphertextError)
  })
})

describe('note binding backward compatibility', () => {
  const noteId = 'note-legacy'
  const payload = { title: 'Eski', body: 'gövde', tags: [] }

  /** A row sealed under the v1 binding, which carried no timestamp. */
  async function legacySeal(dek: Bytes): Promise<Sealed> {
    const key = await deriveNoteKey(dek, noteId)
    return seal(key, utf8ToBytes(JSON.stringify(payload)), utf8ToBytes(`vaultnote:v1:note:${noteId}:1`))
  }

  it('still opens a v1-sealed row through the legacy binding', async () => {
    const dek = randomBytes(32)
    const sealed = await legacySeal(dek)
    const note = await openNote(dek, { id: noteId, version: 1, updatedAt: 5000 }, sealed)
    expect(note).toEqual(payload)
  })

  it('restamp moves a legacy row onto the v2 binding', async () => {
    const dek = randomBytes(32)
    const sealed = await restampNote(dek, { id: noteId, version: 1, updatedAt: 1, sealed: await legacySeal(dek) }, 2000)
    expect(await openNote(dek, { id: noteId, version: 1, updatedAt: 2000 }, sealed)).toEqual(payload)
    // And the old timestamp no longer works, so the row is now tamper-evident.
    await expect(openNote(dek, { id: noteId, version: 1, updatedAt: 1 }, sealed)).rejects.toBeInstanceOf(
      CorruptCiphertextError,
    )
  })

  it('rejects a v1 row whose version does not match', async () => {
    const dek = randomBytes(32)
    const sealed = await legacySeal(dek)
    await expect(
      openNote(dek, { id: noteId, version: 2, updatedAt: 1 }, sealed),
    ).rejects.toBeInstanceOf(CorruptCiphertextError)
  })
})
