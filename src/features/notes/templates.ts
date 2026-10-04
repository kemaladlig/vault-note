import {
  bytesToUtf8,
  deriveTemplatesKey,
  open,
  seal,
  utf8ToBytes,
  type Bytes,
  type Sealed,
} from '@/features/vault/crypto'

/**
 * A note template. Templates are **device-local** (same decision as smart views): the sealed
 * doc lives in the local `meta` table and is never pushed to Drive, so template names and
 * bodies stay off the network entirely.
 */
export interface NoteTemplate {
  id: string
  name: string
  title: string
  body: string
  tags: string[]
  /** Optional notebook the new note lands in. */
  folderId?: string
  createdAt: number
}

export interface TemplatesDoc {
  templates: NoteTemplate[]
}

const AAD = utf8ToBytes('vaultnote:v1:templates')

export async function sealTemplates(dek: Bytes, doc: TemplatesDoc): Promise<string> {
  const key = await deriveTemplatesKey(dek)
  const sealed = await seal(key, utf8ToBytes(JSON.stringify(doc)), AAD)
  return JSON.stringify(sealed)
}

export async function openTemplates(dek: Bytes, text: string): Promise<TemplatesDoc> {
  const key = await deriveTemplatesKey(dek)
  const sealed = JSON.parse(text) as Sealed
  const doc = JSON.parse(bytesToUtf8(await open(key, sealed, AAD))) as TemplatesDoc
  return { templates: doc.templates ?? [] }
}
