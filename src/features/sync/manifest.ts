import {
  bytesToUtf8,
  deriveManifestKey,
  open,
  seal,
  utf8ToBytes,
  type Bytes,
  type Sealed,
} from '@/features/vault/crypto'

/** One note's routing entry. Metadata only — no plaintext content. */
export interface ManifestEntry {
  version: number
  updatedAt: number
  /** Drive file id holding the encrypted NoteRow. */
  fileId: string
  deleted: 0 | 1
}

export interface Manifest {
  updatedAt: number
  notes: Record<string, ManifestEntry>
}

export function emptyManifest(): Manifest {
  return { updatedAt: 0, notes: {} }
}

const AAD = utf8ToBytes('vaultnote:v1:manifest')

/** Serialize + encrypt the manifest. The note index never leaves the device in clear. */
export async function sealManifest(dek: Bytes, manifest: Manifest): Promise<string> {
  const key = await deriveManifestKey(dek)
  const sealed = await seal(key, utf8ToBytes(JSON.stringify(manifest)), AAD)
  return JSON.stringify(sealed)
}

export async function openManifest(dek: Bytes, text: string): Promise<Manifest> {
  const key = await deriveManifestKey(dek)
  const sealed = JSON.parse(text) as Sealed
  return JSON.parse(bytesToUtf8(await open(key, sealed, AAD))) as Manifest
}
