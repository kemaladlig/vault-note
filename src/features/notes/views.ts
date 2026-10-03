import {
  bytesToUtf8,
  deriveViewsKey,
  open,
  seal,
  utf8ToBytes,
  type Bytes,
  type Sealed,
} from '@/features/vault/crypto'

import type { NotesView } from './model'

/**
 * A saved filter combination ("akıllı görünüm"). The name and the filters can be sensitive
 * (a search for "şifreler", a #finans tag), so the whole doc is stored sealed at rest.
 */
export interface SavedView {
  id: string
  name: string
  query: string
  tag?: string
  folderId?: string
  view: NotesView
  createdAt: number
}

export interface ViewsDoc {
  views: SavedView[]
}

const AAD = utf8ToBytes('vaultnote:v1:views')

export async function sealViews(dek: Bytes, doc: ViewsDoc): Promise<string> {
  const key = await deriveViewsKey(dek)
  const sealed = await seal(key, utf8ToBytes(JSON.stringify(doc)), AAD)
  return JSON.stringify(sealed)
}

export async function openViews(dek: Bytes, text: string): Promise<ViewsDoc> {
  const key = await deriveViewsKey(dek)
  const sealed = JSON.parse(text) as Sealed
  const doc = JSON.parse(bytesToUtf8(await open(key, sealed, AAD))) as ViewsDoc
  return { views: doc.views ?? [] }
}
