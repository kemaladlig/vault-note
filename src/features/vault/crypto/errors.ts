/** Typed errors so the UI can react to intent, not parse messages (AGENTS §6). */

export class WrongPassphraseError extends Error {
  constructor() {
    super('Yanlış ana parola veya bozuk vault başlığı.')
    this.name = 'WrongPassphraseError'
  }
}

export class CorruptCiphertextError extends Error {
  constructor() {
    super('Şifreli veri bozuk ya da kurcalanmış.')
    this.name = 'CorruptCiphertextError'
  }
}

export class UnsupportedFormatError extends Error {
  constructor(detail: string) {
    super(`Desteklenmeyen format: ${detail}`)
    this.name = 'UnsupportedFormatError'
  }
}
