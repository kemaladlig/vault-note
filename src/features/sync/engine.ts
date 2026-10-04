import type { Bytes } from '@/features/vault/crypto'
import { db, type NoteRow } from '@/shared/db'
import { now } from '@/shared/time'

import type { DriveClient } from './drive/types'
import {
  emptyManifest,
  openManifest,
  sealManifest,
  type Manifest,
  type ManifestEntry,
} from './manifest'

export const MANIFEST_NAME = 'vaultnote.manifest.json'
export const noteFileName = (id: string) => `note-${id}.json`

export interface SyncDeps {
  drive: DriveClient
  dek: Bytes
  /** `modifiedTime` of the manifest we last synced against; lets an idle poll skip work. */
  manifestModifiedTime?: string
}

export interface SyncResult {
  pulled: number
  pushed: number
  /** Ids where the remote won over an unsynced local edit (LWW overwrote a dirty row). */
  conflicts: string[]
  /** Current manifest `modifiedTime` to cache for the next poll. */
  manifestModifiedTime?: string
}

/** Last-write-wins: timestamps decide, version breaks ties. */
function remoteWins(remote: ManifestEntry, local: NoteRow): boolean {
  return (
    remote.updatedAt > local.updatedAt ||
    (remote.updatedAt === local.updatedAt && remote.version > local.version)
  )
}

function manifestMatches(entry: ManifestEntry, row: NoteRow): boolean {
  return (
    entry.updatedAt === row.updatedAt && entry.version === row.version && entry.deleted === row.deleted
  )
}

async function readRemoteManifest(deps: SyncDeps, fileId: string | undefined): Promise<Manifest> {
  if (!fileId) return emptyManifest()
  return openManifest(deps.dek, await deps.drive.download(fileId))
}

/**
 * Two-way, offline-first sync against `appDataFolder`.
 *
 * 0. Fast path: if the remote manifest is unchanged and nothing is pending locally, do nothing.
 * 1. Pull remote notes newer than (or missing from) the local store.
 * 2. Push local rows the remote does not already reflect (newer or dirty).
 * 3. Rewrite the encrypted manifest, but only when something actually changed.
 *
 * Content is already encrypted with per-note keys, so this stage never touches plaintext.
 */
export async function syncNotes(deps: SyncDeps): Promise<SyncResult> {
  const { drive } = deps

  const localRows = await db.notes.toArray()
  const hasLocalChanges = localRows.some((row) => row.dirty)

  const files = await drive.list()
  const manifestFile = files.find((f) => f.name === MANIFEST_NAME)

  // 0. Fast path — remote untouched since our last sync and no local edits pending.
  if (manifestFile && deps.manifestModifiedTime === manifestFile.modifiedTime && !hasLocalChanges) {
    return { pulled: 0, pushed: 0, conflicts: [], manifestModifiedTime: manifestFile.modifiedTime }
  }

  const remote = await readRemoteManifest(deps, manifestFile?.id)
  const remoteNotes: Record<string, ManifestEntry> = { ...remote.notes }

  let pulled = 0
  let pushed = 0
  const conflicts: string[] = []

  // 1. Pull.
  const localById = new Map(localRows.map((row) => [row.id, row]))
  for (const [id, entry] of Object.entries(remoteNotes)) {
    const local = localById.get(id)
    if (local && !remoteWins(entry, local)) continue

    // Remote overwrites an unsynced local edit: record it so the UI can warn (LWW).
    if (local?.dirty) conflicts.push(id)

    if (entry.deleted) {
      // Remote tombstone: mirror it locally without downloading a body.
      if (local) {
        await db.notes.update(id, { deleted: 1, dirty: 0, updatedAt: entry.updatedAt })
        pulled++
      }
      continue
    }
    const row = JSON.parse(await drive.download(entry.fileId)) as NoteRow
    await db.notes.put({ ...row, deleted: 0, dirty: 0 })
    pulled++
  }

  // 2. Push (re-read: pulls above may have rewritten rows).
  for (const row of await db.notes.toArray()) {
    const entry = remoteNotes[row.id]
    if (entry && remoteWins(entry, row)) {
      // Remote won the conflict; accept it and stop retrying.
      if (row.dirty) await db.notes.update(row.id, { dirty: 0 })
      continue
    }
    if (!row.dirty && entry && manifestMatches(entry, row)) continue

    const content = JSON.stringify(row)
    let fileId = entry?.fileId
    if (fileId) {
      await drive.update(fileId, content)
    } else {
      fileId = (await drive.create(noteFileName(row.id), content)).id
    }
    remoteNotes[row.id] = {
      version: row.version,
      updatedAt: row.updatedAt,
      fileId,
      deleted: row.deleted,
    }
    if (row.dirty) await db.notes.update(row.id, { dirty: 0 })
    pushed++
  }

  // 3. Manifest — only when something changed, so idle polls never write.
  let manifestModifiedTime = manifestFile?.modifiedTime
  if (pulled > 0 || pushed > 0) {
    const manifest: Manifest = { updatedAt: now(), notes: remoteNotes }
    const sealed = await sealManifest(deps.dek, manifest)
    const saved = manifestFile
      ? await drive.update(manifestFile.id, sealed)
      : await drive.create(MANIFEST_NAME, sealed)
    manifestModifiedTime = saved.modifiedTime
  }

  return { pulled, pushed, conflicts, manifestModifiedTime }
}
