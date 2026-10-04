import type { Bytes } from '@/features/vault/crypto'
import { db } from '@/shared/db'

import { openTemplates, sealTemplates, type NoteTemplate } from '../templates'

const DOC = 'templates'

/** Templates are one sealed doc in the meta table (device-local), mirroring smart views. */
export async function loadTemplates(dek: Bytes): Promise<NoteTemplate[]> {
  const row = await db.meta.get(DOC)
  if (!row) return []
  const opened = await openTemplates(dek, row.value as string)
  return opened.templates
}

export async function saveTemplates(dek: Bytes, templates: NoteTemplate[]): Promise<void> {
  const sealed = await sealTemplates(dek, { templates })
  await db.meta.put({ key: DOC, value: sealed })
}
