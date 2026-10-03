import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { randomBytes, sealNote, type Bytes, type NotePayload } from '@/features/vault/crypto'
import { db, type NoteRow } from '@/shared/db'

import { MANIFEST_NAME, noteFileName, syncNotes } from './engine'
import { sealManifest, type ManifestEntry } from './manifest'
import { FakeDrive } from './testing/fakeDrive'

let dek: Bytes
let drive: FakeDrive

beforeEach(async () => {
  await db.transaction('rw', db.meta, db.notes, async () => {
    await db.meta.clear()
    await db.notes.clear()
  })
  dek = randomBytes(32)
  drive = new FakeDrive()
})

interface RowOptions {
  updatedAt: number
  version?: number
  deleted?: 0 | 1
  dirty?: 0 | 1
}

async function makeRow(id: string, payload: NotePayload, opts: RowOptions): Promise<NoteRow> {
  const version = opts.version ?? 1
  return {
    id,
    version,
    createdAt: opts.updatedAt,
    updatedAt: opts.updatedAt,
    deleted: opts.deleted ?? 0,
    dirty: opts.dirty ?? 1,
    sealed: await sealNote(dek, id, version, payload),
  }
}

/** Simulate another device having written these notes + a manifest to Drive. */
async function seedRemote(entries: NoteRow[]): Promise<void> {
  const notes: Record<string, ManifestEntry> = {}
  for (const row of entries) {
    const meta = await drive.create(noteFileName(row.id), JSON.stringify(row))
    notes[row.id] = {
      version: row.version,
      updatedAt: row.updatedAt,
      fileId: meta.id,
      deleted: row.deleted,
    }
  }
  await drive.create(MANIFEST_NAME, await sealManifest(dek, { updatedAt: 1, notes }))
}

const payload = (title: string): NotePayload => ({ title, body: '', tags: [] })

describe('syncNotes', () => {
  it('pushes local dirty notes and writes an encrypted manifest', async () => {
    const row = await makeRow('n1', payload('yerel'), { updatedAt: 1000 })
    await db.notes.put(row)

    const result = await syncNotes({ drive, dek })

    expect(result).toMatchObject({ pulled: 0, pushed: 1 })
    expect(drive.raw(noteFileName('n1'))).toBeDefined()
    expect(drive.raw(MANIFEST_NAME)).toBeDefined()
    expect((await db.notes.get('n1'))!.dirty).toBe(0)
  })

  it('is a no-op on a second run', async () => {
    await db.notes.put(await makeRow('n1', payload('x'), { updatedAt: 1000 }))
    const first = await syncNotes({ drive, dek })

    // With the cached manifest time and no local edits, the next sync fast-paths (no writes).
    const before = drive.count()
    const second = await syncNotes({ drive, dek, manifestModifiedTime: first.manifestModifiedTime })
    expect(second).toMatchObject({ pulled: 0, pushed: 0 })
    expect(drive.count()).toBe(before)
  })

  it('pulls remote notes into an empty local store', async () => {
    await seedRemote([await makeRow('r1', payload('uzak'), { updatedAt: 2000, dirty: 0 })])

    const result = await syncNotes({ drive, dek })

    expect(result).toMatchObject({ pulled: 1, pushed: 0 })
    const local = await db.notes.get('r1')
    expect(local).toBeDefined()
    expect(local!.dirty).toBe(0)
  })

  it('resolves conflicts with last-write-wins', async () => {
    await db.notes.put(await makeRow('c1', payload('eski-yerel'), { updatedAt: 500 }))
    await seedRemote([
      await makeRow('c1', payload('yeni-uzak'), { updatedAt: 2000, version: 2, dirty: 0 }),
    ])

    const result = await syncNotes({ drive, dek })

    expect(result.pushed).toBe(0)
    const local = await db.notes.get('c1')
    expect(local!.updatedAt).toBe(2000)
    expect(local!.dirty).toBe(0)
  })

  it('propagates a remote tombstone', async () => {
    await db.notes.put(await makeRow('d1', payload('silinecek'), { updatedAt: 1000, dirty: 0 }))
    await seedRemote([
      await makeRow('d1', payload('silinecek'), { updatedAt: 3000, deleted: 1, dirty: 0 }),
    ])

    await syncNotes({ drive, dek })

    expect((await db.notes.get('d1'))!.deleted).toBe(1)
  })

  it('never leaks note ids or titles into the manifest', async () => {
    await db.notes.put(await makeRow('gizli-id', payload('gizli-baslik'), { updatedAt: 1000 }))
    await syncNotes({ drive, dek })

    const manifest = drive.raw(MANIFEST_NAME)!
    expect(manifest).not.toContain('gizli-id')
    expect(manifest).not.toContain('gizli-baslik')
  })
})
