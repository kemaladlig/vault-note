/**
 * Passphrase strength estimation for the vault passphrase.
 *
 * The length floor alone lets `"12345678"` through, which Argon2id cannot save: a short
 * numeric string is a dictionary word in disguise. This is a deliberately small, dependency-free
 * estimator (zxcvbn-class ideas: character-class pool, repeats, keyboard runs, common tokens) —
 * enough to reject the passphrases people actually pick, not a full-blown matcher.
 *
 * It is a *guide*, not a guarantee. The hard gate is `MIN_PASSPHRASE_LENGTH`; this adds a warning
 * so the user can still choose a long memorable phrase the estimator underrates.
 */

/** Hard floor, enforced everywhere a vault passphrase is accepted. */
export const MIN_PASSPHRASE_LENGTH = 8

/**
 * Estimated bits below which we warn. ~40 bits is roughly a 4-word diceware phrase; 8 digits or
 * a dictionary word sit well under it.
 */
export const WARN_ENTROPY_BITS = 40

export type Strength = 'weak' | 'fair' | 'strong'

/** Common bases a cracker tries first; any substring hit costs the whole estimate. */
const COMMON_PATTERNS: RegExp[] = [
  /password/i,
  /passwort/i,
  /parola/i,
  /qwerty/i,
  /asdf/i,
  /zxcv/i,
  /1234/,
  /12345/,
  /1111/,
  /abcd/i,
  /admin/i,
  /letmein/i,
  /vault/i,
  /note(s)?$/i,
  /^[\d]+$/,
]

/** Adjacent keys / letters in a straight run, e.g. "abc" or "9876". */
const SEQUENCE = /(?:0123|1234|2345|3456|4567|5678|6789|9876|abcd|bcde|cdef|defg|efgh|qwerty|wert)/i

/** Same character three or more times in a row. */
const REPEATED_RUN = /(.)\1{2,}/

/** The same short block repeated, e.g. "abcabcabc". */
const REPEATED_BLOCK = /(.{2,4})\1{2,}/

function poolSize(text: string): number {
  let pool = 0
  if (/[a-z]/.test(text)) pool += 26
  if (/[A-Z]/.test(text)) pool += 26
  if (/\d/.test(text)) pool += 10
  if (/[^\p{L}\p{N}\s]/u.test(text)) pool += 33
  if (/\s/.test(text)) pool += 1
  // Non-ASCII letters add roughly the size of an accented alphabet; reward them modestly.
  if (/[^\x20-\x7E]/.test(text)) pool += 50
  return pool
}

function uniqueRatio(text: string): number {
  return new Set(text).size / Math.max(text.length, 1)
}

/**
 * Estimated entropy in bits, assuming the best-case character mix, then discounted for the
 * patterns that make a guess cheap. Deliberately conservative — it underrates long Turkish or
 * non-Latin phrases on purpose rather than overrating them.
 */
export function estimateEntropyBits(passphrase: string): number {
  const text = passphrase.trim()
  if (!text) return 0

  const pool = poolSize(text)
  let bits = text.length * Math.log2(Math.max(pool, 2))

  // Long strings get a small bonus for length alone, but it must not dominate the estimate.
  if (text.length > 8) bits += (text.length - 8) * 0.5

  if (uniqueRatio(text) < 0.5) bits *= 0.6
  if (REPEATED_RUN.test(text)) bits *= 0.5
  if (REPEATED_BLOCK.test(text)) bits *= 0.7
  if (SEQUENCE.test(text)) bits *= 0.75
  if (COMMON_PATTERNS.some((pattern) => pattern.test(text))) bits *= 0.5

  return Math.max(0, Math.round(bits))
}

export function passphraseStrength(passphrase: string): Strength {
  const bits = estimateEntropyBits(passphrase)
  if (bits < WARN_ENTROPY_BITS) return 'weak'
  if (bits < 60) return 'fair'
  return 'strong'
}

/** The hard gate: too short, or long enough to still be trivially guessable. */
export function isAcceptablePassphrase(passphrase: string): boolean {
  return passphrase.length >= MIN_PASSPHRASE_LENGTH
}
