import Dexie, { type EntityTable } from 'dexie'

import type { Sealed } from '@/features/vault/crypto'

/** Persistence shapes. Domain types live in each feature; these are the on-disk contract. */

export interface MetaRow {
  key: string
  value: unknown
}

export interface NoteRow {
  id: string
  /** Monotonic revision; bound into the ciphertext AAD so rollback fails. */
  version: number
  createdAt: number
  updatedAt: number
  /** Tombstone marker (0/1) — kept for future sync deletes. */
  deleted: 0 | 1
  /** Local change pending Drive push (0/1). */
  dirty: 0 | 1
  /** Encrypted { title, body, tags }. Plaintext never touches disk. */
  sealed: Sealed
}

export const db = new Dexie('vaultnote') as Dexie & {
  meta: EntityTable<MetaRow, 'key'>
  notes: EntityTable<NoteRow, 'id'>
}

db.version(1).stores({
  meta: 'key',
  notes: 'id, updatedAt, dirty, deleted',
})
