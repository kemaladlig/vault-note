const SPLASH_ID = 'boot-splash'

/**
 * Fade out and remove the inline boot splash from index.html. Called when the first real
 * screen is on display, so the brand screen is never replaced by a half-built shell.
 * `instant` skips the fade — used when what follows looks nothing like the app chrome.
 * No-op when the splash is already gone.
 */
export function dismissBootSplash(options?: { instant?: boolean }): void {
  const splash = document.getElementById(SPLASH_ID)
  if (!splash) return
  if (options?.instant) {
    splash.remove()
    return
  }
  splash.classList.add('is-hiding')
  splash.addEventListener('transitionend', () => splash.remove(), { once: true })
  // Reduced motion collapses the transition, so transitionend may never fire — clean up anyway.
  window.setTimeout(() => splash.remove(), 400)
}
