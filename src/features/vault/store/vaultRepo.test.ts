import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { createVault, unlockVault } from '../crypto'
import { db } from '@/shared/db'
import { destroyVault, loadHeader, loadSettings, saveVault } from './vaultRepo'

const FAST = { memoryKiB: 1024, iterations: 1, parallelism: 1 }

beforeEach(async () => {
  await db.meta.clear()
})

describe('vaultRepo', () => {
  it('persists and reloads the header + settings', async () => {
    const { header } = await createVault('pass-1234', FAST)
    await saveVault(header, 'passphrase')

    const loaded = await loadHeader()
    const settings = await loadSettings()
    expect(loaded).toEqual(header)
    expect(settings?.mode).toBe('passphrase')
    expect(settings?.deviceId).toBeTruthy()
  })

  it('reloaded header still unlocks with the passphrase (survives JSON round-trip)', async () => {
    const created = await createVault('pass-1234', FAST)
    await saveVault(created.header, 'passphrase')
    const reloaded = await loadHeader()
    const dek = await unlockVault('pass-1234', reloaded!)
    expect(Array.from(dek)).toEqual(Array.from(created.dek))
  })

  it('destroyVault wipes everything', async () => {
    const { header } = await createVault('pass-1234', FAST)
    await saveVault(header, 'passphrase')
    await destroyVault()
    expect(await loadHeader()).toBeUndefined()
    expect(await loadSettings()).toBeUndefined()
  })
})
