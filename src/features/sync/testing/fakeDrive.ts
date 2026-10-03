import type { DriveClient, DriveFileMeta } from '../drive/types'

interface StoredFile {
  name: string
  content: string
  modifiedTime: string
}

/** In-memory Drive for tests. Deterministic ids and timestamps. */
export class FakeDrive implements DriveClient {
  private files = new Map<string, StoredFile>()
  private seq = 0
  private clock = 0

  private stamp(): string {
    this.clock += 1000
    return new Date(this.clock).toISOString()
  }

  async list(): Promise<DriveFileMeta[]> {
    return [...this.files.entries()].map(([id, f]) => ({
      id,
      name: f.name,
      modifiedTime: f.modifiedTime,
    }))
  }

  async download(fileId: string): Promise<string> {
    const file = this.files.get(fileId)
    if (!file) throw new Error(`Dosya yok: ${fileId}`)
    return file.content
  }

  async create(name: string, content: string): Promise<DriveFileMeta> {
    const id = `f${++this.seq}`
    const modifiedTime = this.stamp()
    this.files.set(id, { name, content, modifiedTime })
    return { id, name, modifiedTime }
  }

  async update(fileId: string, content: string): Promise<DriveFileMeta> {
    const file = this.files.get(fileId)
    if (!file) throw new Error(`Dosya yok: ${fileId}`)
    file.content = content
    file.modifiedTime = this.stamp()
    return { id: fileId, name: file.name, modifiedTime: file.modifiedTime }
  }

  async remove(fileId: string): Promise<void> {
    this.files.delete(fileId)
  }

  /** Test helper: raw stored content by file name. */
  raw(name: string): string | undefined {
    for (const file of this.files.values()) if (file.name === name) return file.content
    return undefined
  }

  count(): number {
    return this.files.size
  }
}
