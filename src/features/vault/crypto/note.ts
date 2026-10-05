import { deriveNoteKey, open, seal } from './aead'
import { bytesToUtf8, utf8ToBytes, type Bytes } from './encoding'
import { CorruptCiphertextError } from './errors'
import type { Sealed } from './types'

/**
 * The row fields a note's ciphertext is bound to.
 *
 * `updatedAt` is part of the binding because it is the field sync trusts for last-write-wins:
 * anything able to move `updatedAt` forward can make a stale row win. Sealing the timestamp into
 * the AAD turns "replay an old note with a bumped timestamp" from a silent success into a GCM
 * auth failure.
 */
export interface NoteBinding {
  readonly id: string
  readonly version: number
  /** The row's `updatedAt` at the instant it was sealed. */
  readonly updatedAt: number
}

/** Current binding: `vaultnote:v2:note:<id>:<version>:<updatedAt>`. */
function noteAad(binding: NoteBinding): Bytes {
  return utf8ToBytes(
    `vaultnote:v2:note:${binding.id}:${binding.version}:${binding.updatedAt}`,
  )
}

/**
 * The v1 binding (`vaultnote:v1:note:<id>:<version>`) — no timestamp.
 *
 * Kept for reading only. Notes sealed before the timestamp was bound are opened through it and
 * gain the guarantee the next time they are written, so no migration pass is needed.
 */
function legacyNoteAad(id: string, version: number): Bytes {
  return utf8ToBytes(`vaultnote:v1:note:${id}:${version}`)
}

export interface NotePayload {
  readonly title: string
  readonly body: string
  readonly tags: string[]
  /** Organizational metadata, sealed with the content so nothing leaks at rest. */
  readonly pinned?: boolean
  readonly folderId?: string
  readonly archived?: boolean
}

function serialize(payload: NotePayload): Bytes {
  // Only serialize the optional fields when set, so old payloads stay byte-identical.
  return utf8ToBytes(
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      tags: payload.tags,
      ...(payload.pinned !== undefined ? { pinned: payload.pinned } : {}),
      ...(payload.folderId !== undefined ? { folderId: payload.folderId } : {}),
      ...(payload.archived !== undefined ? { archived: payload.archived } : {}),
    }),
  )
}

/** Encrypt a whole note payload (title + body + tags) under the note's own derived key. */
export async function sealNote(
  dek: Bytes,
  binding: NoteBinding,
  payload: NotePayload,
): Promise<Sealed> {
  const key = await deriveNoteKey(dek, binding.id)
  return seal(key, serialize(payload), noteAad(binding))
}

export async function openNote(
  dek: Bytes,
  binding: NoteBinding,
  sealed: Sealed,
): Promise<NotePayload> {
  const key = await deriveNoteKey(dek, binding.id)
  let bytes: Bytes
  try {
    bytes = await open(key, sealed, noteAad(binding))
  } catch (err) {
    // A row sealed before the timestamp was part of the binding. Only a legacy row can fail here
    // this way with a correct key: every other cause already threw from `sealNote` as v2.
    if (!(err instanceof CorruptCiphertextError)) throw err
    bytes = await open(key, sealed, legacyNoteAad(binding.id, binding.version))
  }
  return JSON.parse(bytesToUtf8(bytes)) as NotePayload
}

/** A row as the crypto layer needs it to re-stamp a ciphertext. */
export interface SealedNoteRow {
  readonly id: string
  readonly version: number
  readonly updatedAt: number
  readonly sealed: Sealed
}

/**
 * Re-seal an existing row under a new `updatedAt`, leaving the version alone.
 *
 * Every write that moves `updatedAt` without touching the content (trash, restore, mirroring a
 * remote tombstone) must go through here, otherwise the row's timestamp stops matching its own
 * ciphertext and the note stops opening. Costs one decrypt + one encrypt.
 */
export async function restampNote(dek: Bytes, row: SealedNoteRow, updatedAt: number): Promise<Sealed> {
  const payload = await openNote(dek, row, row.sealed)
  return sealNote(dek, { id: row.id, version: row.version, updatedAt }, payload)
}
