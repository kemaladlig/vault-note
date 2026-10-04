import { beforeEach, describe, expect, it } from 'vitest'

import {
  AUTO_LOCK_OPTIONS,
  DEFAULT_AUTO_LOCK_MINUTES,
  getAutoLockMinutes,
  setAutoLockMinutes,
} from './autoLock'

/** Node has no localStorage; the module reads it lazily behind a typeof guard. */
function stubStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  })
}

describe('auto-lock preference', () => {
  beforeEach(stubStorage)

  it('defaults to the safe delay when unset', () => {
    expect(getAutoLockMinutes()).toBe(DEFAULT_AUTO_LOCK_MINUTES)
  })

  it('round-trips every offered delay', () => {
    for (const { minutes } of AUTO_LOCK_OPTIONS) {
      setAutoLockMinutes(minutes)
      expect(getAutoLockMinutes()).toBe(minutes)
    }
  })

  it('ignores an unrecognised stored value', () => {
    localStorage.setItem('vaultnote.autoLockMinutes', '3')
    expect(getAutoLockMinutes()).toBe(DEFAULT_AUTO_LOCK_MINUTES)
  })
})
