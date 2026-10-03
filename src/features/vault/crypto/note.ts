import { deriveNoteKey, open, seal } from './aead'
import { bytesToUtf8, utf8ToBytes, type Bytes } from './encoding'
import type { Sealed } from './types'

/** Bind ciphertext to its note and revision — blocks copy/paste between notes and rollback. */
function noteAad(noteId: string, version: number): Bytes {
  return utf8ToBytes(`vaultnote:v1:note:${noteId}:${version}`)
}

export interface NotePayload {
  readonly title: string
  readonly body: string
  readonly tags: string[]
}

/** Encrypt a whole note payload (title + body + tags) under the note's own derived key. */
export async function sealNote(
  dek: Bytes,
  noteId: string,
  version: number,
  payload: NotePayload,
): Promise<Sealed> {
  const key = await deriveNoteKey(dek, noteId)
  const json = JSON.stringify({ title: payload.title, body: payload.body, tags: payload.tags })
  return seal(key, utf8ToBytes(json), noteAad(noteId, version))
}

export async function openNote(
  dek: Bytes,
  noteId: string,
  version: number,
  sealed: Sealed,
): Promise<NotePayload> {
  const key = await deriveNoteKey(dek, noteId)
  const bytes = await open(key, sealed, noteAad(noteId, version))
  return JSON.parse(bytesToUtf8(bytes)) as NotePayload
}

/** Convenience for callers that only keep the body hot (editor path). */
export async function sealText(
  dek: Bytes,
  noteId: string,
  version: number,
  text: string,
): Promise<Sealed> {
  const key = await deriveNoteKey(dek, noteId)
  return seal(key, utf8ToBytes(text), noteAad(noteId, version))
}

export async function openText(
  dek: Bytes,
  noteId: string,
  version: number,
  sealed: Sealed,
): Promise<string> {
  const key = await deriveNoteKey(dek, noteId)
  return bytesToUtf8(await open(key, sealed, noteAad(noteId, version)))
}
