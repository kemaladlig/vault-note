/** Minimal Drive surface the sync engine needs. Lets tests swap in an in-memory fake. */
export interface DriveFileMeta {
  id: string
  name: string
  modifiedTime: string
}

export interface DriveClient {
  /** List files in the app's private `appDataFolder`. */
  list(): Promise<DriveFileMeta[]>
  download(fileId: string): Promise<string>
  create(name: string, content: string): Promise<DriveFileMeta>
  update(fileId: string, content: string): Promise<DriveFileMeta>
  remove(fileId: string): Promise<void>
}
