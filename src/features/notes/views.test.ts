import { describe, expect, it } from 'vitest'

import { createVault } from '@/features/vault/crypto'

import { openViews, sealViews, type SavedView } from './views'

/** Fast KDF params so the suite runs in milliseconds instead of seconds. */
const FAST = { memoryKiB: 1024, iterations: 1, parallelism: 1 }

const VIEW: SavedView = {
  id: 'v1',
  name: 'Şifreler',
  query: 'şifre',
  tag: 'gizli',
  view: 'all',
  createdAt: 1,
}

describe('views (sealed smart views)', () => {
  it('round-trips a views doc through seal/open', async () => {
    const { dek } = await createVault('correct horse battery staple', FAST)
    const sealed = await sealViews(dek, { views: [VIEW] })
    // Name, query and tag must not appear in plaintext at rest.
    expect(sealed).not.toContain('Şifreler')
    expect(sealed).not.toContain('şifre')
    expect(sealed).not.toContain('gizli')
    expect((await openViews(dek, sealed)).views).toEqual([VIEW])
  })

  it('rejects a tampered ciphertext', async () => {
    const { dek } = await createVault('correct horse battery staple', FAST)
    const sealed = JSON.parse(await sealViews(dek, { views: [VIEW] })) as { ct: string }
    sealed.ct = `${sealed.ct.slice(0, -4)}AAAA`
    await expect(openViews(dek, JSON.stringify(sealed))).rejects.toThrow()
  })
})
