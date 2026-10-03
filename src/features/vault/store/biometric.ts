import { Capacitor } from '@capacitor/core'

/**
 * Biometric gate for native quick unlock.
 *
 * The plugins are imported dynamically so the web bundle stays small and never touches
 * native-only code. On the web there is no OS biometric prompt, so these helpers report
 * "unavailable" and the caller falls back to the plain device-key quick unlock.
 */

/** True only when running natively with biometry supported and enrolled. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
    const result = await BiometricAuth.checkBiometry()
    return result.isAvailable
  } catch {
    return false
  }
}

/**
 * Prompt for biometrics (device credential allowed as fallback). Resolves on success and throws
 * on cancel/failure, so callers must not unwrap on rejection. A no-op off-native or when
 * biometry is unavailable.
 */
export async function verifyBiometric(reason: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
  const { isAvailable } = await BiometricAuth.checkBiometry()
  if (!isAvailable) return
  await BiometricAuth.authenticate({
    reason,
    cancelTitle: 'İptal',
    allowDeviceCredential: true,
    androidTitle: 'VaultNote',
    androidSubtitle: reason,
  })
}
