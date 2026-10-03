import type { DriveClient, DriveFileMeta } from './types'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FIELDS = 'id,name,modifiedTime'
const APP_DATA = 'appDataFolder'

/**
 * Google Drive REST v3 client scoped to `appDataFolder` (spaces=appDataFolder). Only files
 * this app created are visible; the token comes from the auth layer on every call so it can
 * refresh transparently.
 */
export function createGoogleDriveClient(getToken: () => Promise<string>): DriveClient {
  async function authHeader(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${await getToken()}` }
  }

  async function parse<T>(res: Response, action: string): Promise<T> {
    if (!res.ok) throw new Error(`Drive ${action} başarısız (${res.status})`)
    return (await res.json()) as T
  }

  return {
    async list(): Promise<DriveFileMeta[]> {
      const fields = encodeURIComponent(`files(${FIELDS})`)
      const url = `${API}/files?spaces=${APP_DATA}&pageSize=1000&fields=${fields}`
      const data = await parse<{ files?: DriveFileMeta[] }>(
        await fetch(url, { headers: await authHeader() }),
        'listeleme',
      )
      return data.files ?? []
    },

    async download(fileId: string): Promise<string> {
      const res = await fetch(`${API}/files/${fileId}?alt=media`, {
        headers: await authHeader(),
      })
      if (!res.ok) throw new Error(`Drive indirme başarısız (${res.status})`)
      return res.text()
    },

    async create(name: string, content: string): Promise<DriveFileMeta> {
      const metadata = { name, parents: [APP_DATA] }
      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
      form.append('file', new Blob([content], { type: 'application/json' }))
      const url = `${UPLOAD}/files?uploadType=multipart&fields=${encodeURIComponent(FIELDS)}`
      return parse<DriveFileMeta>(
        await fetch(url, { method: 'POST', headers: await authHeader(), body: form }),
        'oluşturma',
      )
    },

    async update(fileId: string, content: string): Promise<DriveFileMeta> {
      const url = `${UPLOAD}/files/${fileId}?uploadType=media&fields=${encodeURIComponent(FIELDS)}`
      return parse<DriveFileMeta>(
        await fetch(url, {
          method: 'PATCH',
          headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
          body: content,
        }),
        'güncelleme',
      )
    },

    async remove(fileId: string): Promise<void> {
      const res = await fetch(`${API}/files/${fileId}`, {
        method: 'DELETE',
        headers: await authHeader(),
      })
      if (!res.ok && res.status !== 404) throw new Error(`Drive silme başarısız (${res.status})`)
    },
  }
}
