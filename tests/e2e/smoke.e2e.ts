import { expect, test } from '@playwright/test'

const PASS = 'correct horse battery staple'

/** End-to-end smoke test in a real browser: crypto, Dexie, editor and search all live. */
test('create vault → note → in-note search → lock/unlock, encrypted at rest', async ({ page }) => {
  await page.goto('/')

  // 1. Create the vault (Argon2id runs for real).
  await expect(page.getByRole('button', { name: 'Vault oluştur' })).toBeVisible()
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  // 2. Notes shell is up.
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()
  await page.getByRole('button', { name: 'Yeni not' }).click()

  // 3. Write a title and body in the CodeMirror editor.
  await page.getByPlaceholder('Başlıksız').fill('gizli-baslik')
  const editor = page.locator('.cm-content')
  await editor.click()
  await editor.pressSequentially('süt ve yumurta faturaları', { delay: 15 })

  // Let the debounced encrypted save run.
  await page.waitForTimeout(900)

  // 4. In-note search highlights and counts.
  await page.getByRole('button', { name: 'Notta ara' }).click()
  await page.getByLabel('Aramayı gir').fill('yumurta')
  await expect(page.getByText('1 eşleşme')).toBeVisible()

  // 5. Encrypt-at-rest: nothing plaintext in IndexedDB.
  const raw = await page.evaluate(async () => {
    const open = indexedDB.open('vaultnote')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction('notes', 'readonly').objectStore('notes').getAll()
      request.onsuccess = () => resolve(request.result as unknown[])
      request.onerror = () => reject(request.error)
    })
    return JSON.stringify(rows)
  })
  expect(raw).not.toContain('gizli-baslik')
  expect(raw).not.toContain('yumurta')
  expect(raw).toContain('"ct"')

  // 6. Lock, then quick-unlock without a passphrase (device key).
  await page.getByRole('button', { name: 'Kilitle' }).click()
  await expect(page.getByRole('button', { name: 'Hızlı aç' })).toBeVisible()
  await page.getByRole('button', { name: 'Hızlı aç' }).click()
  await expect(page.getByText('gizli-baslik')).toBeVisible()

  // 7. Lock again and fall back to the passphrase.
  await page.getByRole('button', { name: 'Kilitle' }).click()
  await page.getByRole('button', { name: 'Parolayla aç' }).click()
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByRole('button', { name: 'Kilidi aç' }).click()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()
  await expect(page.getByText('gizli-baslik')).toBeVisible()
})

test('passwordless vault: create, lock, quick-unlock only', async ({ page }) => {
  await page.goto('/')

  // Create without a passphrase (device mode).
  await page.getByRole('button', { name: 'Parolasız' }).click()
  await page.getByRole('checkbox', { name: 'Riski anladım' }).click()
  await page.getByRole('button', { name: 'Parolasız oluştur' }).click()

  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()
  await page.getByRole('button', { name: 'Yeni not' }).click()
  await page.getByPlaceholder('Başlıksız').fill('cihaz-notu')
  await page.waitForTimeout(900)

  // Lock: only quick unlock is offered, there is no passphrase to fall back to.
  await page.getByRole('button', { name: 'Kilitle' }).click()
  await expect(page.getByRole('button', { name: 'Hızlı aç' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Parolayla aç' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Hızlı aç' }).click()
  await expect(page.getByText('cihaz-notu')).toBeVisible()
})
