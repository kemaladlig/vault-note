import { beforeEach, describe, expect, it } from 'vitest'

import { createVault } from '@/features/vault/crypto'

import { BOOTSTRAP_NAME, downloadBootstrap, uploadBootstrap } from './bootstrap'
import { FakeDrive } from './testing/fakeDrive'

const FAST = { memoryKiB: 1024, iterations: 1, parallelism: 1 }
const SETTINGS = { mode: 'passphrase' as const, deviceId: 'dev-1', createdAt: 42 }

let drive: FakeDrive

beforeEach(() => {
  drive = new FakeDrive()
})

describe('vault bootstrap', () => {
  it('round-trips header + settings through Drive', async () => {
    const { header } = await createVault('pass-1234', FAST)
    await uploadBootstrap(drive, { header, settings: SETTINGS })

    const loaded = await downloadBootstrap(drive)
    expect(loaded?.header).toEqual(header)
    expect(loaded?.settings).toEqual(SETTINGS)
  })

  it('returns undefined when no vault exists yet', async () => {
    expect(await downloadBootstrap(drive)).toBeUndefined()
  })

  it('updates in place instead of piling up files', async () => {
    const first = await createVault('pass-1234', FAST)
    const second = await createVault('pass-5678', FAST)

    await uploadBootstrap(drive, { header: first.header, settings: SETTINGS })
    await uploadBootstrap(drive, { header: second.header, settings: SETTINGS })

    const names = (await drive.list()).map((f) => f.name)
    expect(names.filter((n) => n === BOOTSTRAP_NAME)).toHaveLength(1)
    expect((await downloadBootstrap(drive))?.header).toEqual(second.header)
  })
})
