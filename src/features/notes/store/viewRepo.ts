import type { Bytes } from '@/features/vault/crypto'
import { db } from '@/shared/db'

import { openViews, sealViews, type SavedView } from '../views'

const DOC = 'views'

/** The smart-views list is one sealed doc in the meta table, so view names never sit in clear. */
export async function loadViews(dek: Bytes): Promise<SavedView[]> {
  const row = await db.meta.get(DOC)
  if (!row) return []
  const opened = await openViews(dek, row.value as string)
  return opened.views
}

export async function saveViews(dek: Bytes, views: SavedView[]): Promise<void> {
  const sealed = await sealViews(dek, { views })
  await db.meta.put({ key: DOC, value: sealed })
}
