import { describe, expect, it } from 'vitest'

import {
  MIN_PASSPHRASE_LENGTH,
  estimateEntropyBits,
  isAcceptablePassphrase,
  passphraseStrength,
} from './strength'

describe('passphrase length gate', () => {
  it('rejects anything under the floor', () => {
    expect(isAcceptablePassphrase('1234567')).toBe(false)
    expect(isAcceptablePassphrase('')).toBe(false)
  })

  it('accepts a passphrase at the floor', () => {
    expect('a'.repeat(MIN_PASSPHRASE_LENGTH)).toHaveLength(8)
    expect(isAcceptablePassphrase('a'.repeat(MIN_PASSPHRASE_LENGTH))).toBe(true)
  })
})

describe('entropy estimate', () => {
  it('rates what people actually pick as weak', () => {
    // All pass the length floor, so only the estimator catches them.
    for (const bad of ['12345678', 'password', 'qwerty12', 'letmein1', '11111111']) {
      expect(isAcceptablePassphrase(bad)).toBe(true)
      expect(passphraseStrength(bad)).toBe('weak')
    }
  })

  it('rates a long mixed passphrase as strong', () => {
    expect(passphraseStrength('kedi-3Bisik!Kahve')).toBe('strong')
  })

  it('rates a multi-word phrase as fair or better', () => {
    expect(['dort kelime bir cumle yaz', 'bugun 5 ekim disarida yagmurlu']).toSatisfy(
      (list: string[]) => list.every((p) => passphraseStrength(p) !== 'weak'),
    )
  })

  it('rewards length over a wide alphabet', () => {
    const short = estimateEntropyBits('aB3!xY9?')
    const long = estimateEntropyBits('aB3!xY9?aB3!xY9?')
    expect(long).toBeGreaterThan(short)
  })

  it('discounts repeated characters', () => {
    expect(estimateEntropyBits('aaaaaaaaaaaa')).toBeLessThan(estimateEntropyBits('aqzwmxkedvpu'))
  })

  it('discounts a repeated block', () => {
    expect(estimateEntropyBits('abcabcabcabc')).toBeLessThan(estimateEntropyBits('aqzwmxkedvpu'))
  })

  it('is zero for an empty passphrase', () => {
    expect(estimateEntropyBits('')).toBe(0)
    expect(estimateEntropyBits('   ')).toBe(0)
  })
})
