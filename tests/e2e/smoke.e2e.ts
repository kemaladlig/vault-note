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
  await expect(page.getByRole('complementary').getByRole('button', { name: /gizli-baslik/ })).toBeVisible()

  // 7. Lock again and fall back to the passphrase.
  await page.getByRole('button', { name: 'Kilitle' }).click()
  await page.getByRole('button', { name: 'Parolayla aç' }).click()
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByRole('button', { name: 'Kilidi aç' }).click()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()
  await expect(page.getByRole('complementary').getByRole('button', { name: /gizli-baslik/ })).toBeVisible()
})

test('boot splash: covers the cold boot, then hands over to the first screen', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()

  // The brand screen is inline HTML: it paints before the bundle runs, so a reload always
  // starts on it…
  await page.reload({ waitUntil: 'commit' })
  await expect(page.locator('#boot-splash')).toBeAttached()
  // …and it is gone once the first screen is on display. The default open mode is "no lock",
  // so the boot unlocks itself and hands over to the notes shell with no gate.
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()
  await expect(page.locator('#boot-splash')).toHaveCount(0)
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
  await expect(page.getByRole('complementary').getByRole('button', { name: /cihaz-notu/ })).toBeVisible()
})

test('app lock: a PIN gates quick unlock on this device', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()

  // Enable the PIN by choosing the PIN open-mode in Settings → Security.
  await page.getByRole('button', { name: 'Uygulama menüsü' }).click()
  await page.getByRole('menuitem', { name: 'Ayarlar' }).click()
  await page.getByRole('button', { name: 'PIN', exact: true }).click()
  const pinDialog = page.getByRole('dialog', { name: 'PIN ekle' })
  await pinDialog.getByLabel('Yeni PIN', { exact: true }).fill('1234')
  await pinDialog.getByLabel('Yeni PIN (tekrar)').fill('1234')
  await pinDialog.getByRole('button', { name: 'PIN ekle' }).click()
  await expect(page.getByRole('dialog', { name: 'PIN ekle' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Ayarlar' })).toHaveCount(0)

  // Lock: the PIN screen replaces quick unlock.
  await page.getByRole('button', { name: 'Kilitle' }).click()
  await expect(page.getByRole('button', { name: 'Aç', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hızlı aç' })).toHaveCount(0)

  // A wrong PIN is rejected and keeps the vault locked.
  await page.getByLabel('PIN', { exact: true }).fill('9999')
  await page.getByRole('button', { name: 'Aç', exact: true }).click()
  await expect(page.getByText('PIN hatalı.')).toBeVisible()

  // The correct PIN unlocks.
  await page.getByLabel('PIN', { exact: true }).fill('1234')
  await page.getByRole('button', { name: 'Aç', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()
})

test('open mode: "no lock" opens the boot directly, switching to PIN gates it', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  // The default open mode is "no lock" and it is pre-selected at signup.
  await expect(page.getByRole('radio', { name: 'Kilit yok' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Vault oluştur' }).click()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()

  // A reload with "no lock" skips the gate entirely.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hızlı aç' })).toHaveCount(0)

  // Switch to PIN from Settings → Security.
  await page.getByRole('button', { name: 'Uygulama menüsü' }).click()
  await page.getByRole('menuitem', { name: 'Ayarlar' }).click()
  await page.getByRole('button', { name: 'PIN', exact: true }).click()
  const setDialog = page.getByRole('dialog', { name: 'PIN ekle' })
  await setDialog.getByLabel('Yeni PIN', { exact: true }).fill('4321')
  await setDialog.getByLabel('Yeni PIN (tekrar)').fill('4321')
  await setDialog.getByRole('button', { name: 'PIN ekle' }).click()
  await expect(setDialog).toHaveCount(0)
  await page.keyboard.press('Escape')

  // The boot now asks for the PIN before the shell.
  await page.reload()
  await expect(page.getByLabel('PIN', { exact: true })).toBeVisible()
  await page.getByLabel('PIN', { exact: true }).fill('4321')
  await page.getByRole('button', { name: 'Aç', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()

  // Switch back to "no lock"; removing the PIN needs the current one.
  await page.getByRole('button', { name: 'Uygulama menüsü' }).click()
  await page.getByRole('menuitem', { name: 'Ayarlar' }).click()
  await page.getByRole('button', { name: 'Kilit yok' }).click()
  const removeDialog = page.getByRole('dialog', { name: "PIN'i kaldır" })
  await removeDialog.getByLabel('Mevcut PIN', { exact: true }).fill('4321')
  await removeDialog.getByRole('button', { name: "PIN'i kaldır" }).click()
  await expect(removeDialog).toHaveCount(0)
  await page.keyboard.press('Escape')

  // And the boot opens directly again.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()
  await expect(page.getByLabel('PIN', { exact: true })).toHaveCount(0)
})

test('polish: tags, command palette, dark theme and export', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  await page.getByRole('button', { name: 'Yeni not' }).click()
  await page.getByPlaceholder('Başlıksız').fill('Etiketli not')

  // Tag editing lives in the header popover now.
  await page.getByRole('button', { name: 'Etiketler' }).click()
  await page.getByLabel('Etiket ekle').fill('iş')
  await page.getByLabel('Etiket ekle').press('Enter')
  await expect(page.getByText('#iş').first()).toBeVisible()
  await page.waitForTimeout(900)

  // The sidebar exposes it as a filter chip.
  await expect(page.getByRole('button', { name: 'iş', exact: true })).toBeVisible()

  // Export the note as Markdown (client-side download) from the note menu.
  await page.getByRole('button', { name: 'Diğer işlemler' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Markdown olarak indir' }).click(),
  ])
  expect(download.suggestedFilename()).toContain('.md')

  // Command palette opens on Ctrl+K and switches the theme.
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: 'Komut paleti' })).toBeVisible()
  await page.getByLabel('Komut ara').fill('koyu')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveClass(/dark/)

  // Settings dialog opens from the app menu; the UI scale can be changed there.
  await page.getByRole('button', { name: 'Uygulama menüsü' }).click()
  await page.getByRole('menuitem', { name: 'Ayarlar' }).click()
  await expect(page.getByRole('dialog', { name: 'Ayarlar' })).toBeVisible()
  await page.getByRole('button', { name: 'Geniş', exact: true }).click()
  await expect(page.locator('html')).toHaveCSS('font-size', '19px')
})

test('organization: notebook, pin, trash and restore', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  await page.getByRole('button', { name: 'Yeni not' }).click()
  await page.getByPlaceholder('Başlıksız').fill('Organize not')
  await page.waitForTimeout(900)

  // Create a notebook and file the note into it.
  await page.getByRole('button', { name: 'Not defteri ekle' }).click()
  await page.getByRole('textbox', { name: 'Yeni not defteri' }).fill('İş')
  await page.getByRole('button', { name: 'Oluştur' }).click()
  await page.getByRole('button', { name: 'Diğer işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Not defterine taşı…' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'İş', exact: true }).click()

  // Pin it, then find it under the pinned scope (the last match is the editor header).
  await page.getByRole('button', { name: 'Sabitle', exact: true }).last().click()
  await page.getByRole('button', { name: /Sabitlenenler/ }).click()
  await expect(page.getByRole('complementary').getByRole('button', { name: /Organize not/ })).toBeVisible()

  // Trash it, then restore from the trash scope.
  await page.getByRole('button', { name: 'Diğer işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Sil' }).click()
  await page.getByRole('button', { name: 'Sil', exact: true }).click()
  await page.getByRole('button', { name: /Çöp/ }).click()
  await expect(page.getByRole('complementary').getByRole('button', { name: /Organize not/ })).toBeVisible()
  await page.getByRole('button', { name: 'Geri yükle' }).click()
  await expect(page.getByRole('complementary').getByRole('button', { name: /Organize not/ })).toHaveCount(0)
})

test('mobile search: reachable, shows note and match location', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  // Two notes; only one contains the needle, deep in the body.
  await page.getByRole('button', { name: 'Yeni not' }).click()
  await page.getByPlaceholder('Başlıksız').fill('Alışveriş listesi')
  const editor = page.locator('.cm-content')
  await editor.click()
  await editor.pressSequentially('kahve, zeytinyağı ve son olarak mandalina al', { delay: 4 })
  await page.waitForTimeout(1000)

  await page.getByRole('button', { name: 'Yeni not' }).click()
  await expect(page.getByPlaceholder('Başlıksız')).toHaveValue('')
  await page.getByPlaceholder('Başlıksız').fill('Başka not')
  await page.waitForTimeout(1000)

  // The mobile top bar exposes a search button that opens the palette.
  await page.getByRole('button', { name: 'Ara', exact: true }).click()
  await page.getByLabel('Komut ara').fill('mandalina')

  // The result names the note and shows a snippet containing the hit.
  const palette = page.getByRole('dialog', { name: 'Komut paleti' })
  await expect(palette.getByRole('button', { name: /Alışveriş listesi/ })).toBeVisible()
  await expect(palette.getByText(/mandalina/)).toBeVisible()

  // Selecting it opens the note and seeds the in-note search (match count visible).
  await palette.getByRole('button', { name: /Alışveriş listesi/ }).click()
  await expect(page.getByText('1 eşleşme')).toBeVisible()
})

test('tabs and split: multiple open notes, side-by-side, close', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  await page.getByRole('button', { name: 'Yeni not' }).click()
  await page.getByPlaceholder('Başlıksız').fill('Tab A')
  await page.waitForTimeout(900)

  await page.getByRole('button', { name: 'Yeni not' }).click()
  await expect(page.getByPlaceholder('Başlıksız')).toHaveValue('')
  await page.getByPlaceholder('Başlıksız').fill('Tab B')
  await page.waitForTimeout(900)

  // Both notes are open as tabs.
  const tabA = page.getByRole('tab', { name: 'Tab A' })
  const tabB = page.getByRole('tab', { name: 'Tab B' })
  await expect(tabA).toBeVisible()
  await expect(tabB).toBeVisible()

  // Switch tabs: the active editor follows the tab.
  await tabA.click()
  await expect(page.getByPlaceholder('Başlıksız')).toHaveValue('Tab A')

  // Open Tab B beside the active note (split view); two editors mount.
  const rowB = page.getByRole('listitem').filter({ hasText: 'Tab B' })
  await rowB.hover()
  await rowB.getByRole('button', { name: 'Yan tarafta aç' }).click()
  await expect(page.locator('.cm-content')).toHaveCount(2)

  // Close the split pane; back to a single editor.
  await page.getByRole('button', { name: 'Bölmeyi kapat' }).click()
  await expect(page.locator('.cm-content')).toHaveCount(1)

  // Close a tab; the other remains.
  await page.getByRole('button', { name: 'Tab B sekmesini kapat' }).click()
  await expect(tabB).toHaveCount(0)
  await expect(tabA).toBeVisible()
})

test('tabs: content width, no clipping, bulk close', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  for (const title of ['K', 'Oldukça uzun başlıklı sekme denemesi burada duruyor', 'M']) {
    await page.getByRole('button', { name: 'Yeni not' }).click()
    const input = page.getByPlaceholder('Başlıksız')
    await expect(input).toHaveValue('')
    await input.fill(title)
    await page.waitForTimeout(900)
  }
  await expect(page.getByRole('tab')).toHaveCount(3)

  // Tabs size to their content: a short title is narrower than a long one,
  // and no tab ever overflows or clips the strip (the old fixed-width bug).
  const widths = await page
    .getByRole('tab')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)))
  expect(widths[0]).toBeLessThan(widths[1])
  const fits = await page
    .getByRole('tab')
    .evaluateAll((els) => {
      const list = document.querySelector('[role="tablist"]')!.getBoundingClientRect()
      return els.every((el) => el.getBoundingClientRect().right <= list.right + 1)
    })
  expect(fits).toBe(true)

  // Close everything else, keeping the active tab.
  await page.getByRole('button', { name: 'Sekme seçenekleri' }).click()
  await page.getByRole('menuitem', { name: 'Diğerlerini kapat' }).click()
  await expect(page.getByRole('tab')).toHaveCount(1)
  await expect(page.getByRole('tab', { name: 'M' })).toBeVisible()

  // Close all tabs; the tab strip disappears.
  await page.getByRole('button', { name: 'Sekme seçenekleri' }).click()
  await page.getByRole('menuitem', { name: 'Tüm sekmeleri kapat' }).click()
  await expect(page.getByRole('tab')).toHaveCount(0)
})

test('smart views: save the current filter and re-apply it', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  // Note A, tagged; note B, untagged.
  await page.getByRole('button', { name: 'Yeni not' }).click()
  await page.getByPlaceholder('Başlıksız').fill('İş notu')
  await page.getByRole('button', { name: 'Etiketler' }).click()
  await page.getByLabel('Etiket ekle').fill('iş')
  await page.getByLabel('Etiket ekle').press('Enter')
  await page.waitForTimeout(900)

  await page.getByRole('button', { name: 'Yeni not' }).click()
  await expect(page.getByPlaceholder('Başlıksız')).toHaveValue('')
  await page.getByPlaceholder('Başlıksız').fill('Kişisel not')
  await page.waitForTimeout(900)

  // Filter by the tag, then save the filter set as a smart view.
  await page.getByRole('button', { name: 'iş', exact: true }).click()
  await page.getByRole('button', { name: 'Görünümü kaydet' }).click()
  await page.getByRole('textbox', { name: 'Görünümü kaydet' }).fill('İş notları')
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click()

  // Clear the tag filter; both notes show again.
  await page.getByRole('button', { name: 'Tümü', exact: true }).click()
  const list = page.getByRole('complementary')
  await expect(list.getByRole('button', { name: /Kişisel not/ })).toBeVisible()

  // Applying the saved view re-applies the tag filter.
  await page.getByRole('button', { name: 'İş notları', exact: true }).click()
  await expect(list.getByRole('button', { name: /İş notu / })).toBeVisible()
  await expect(list.getByRole('button', { name: /Kişisel not/ })).toHaveCount(0)
})

test('notebooks: color and drag-to-reparent', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  // Two top-level notebooks.
  for (const name of ['Proje A', 'Proje B']) {
    await page.getByRole('button', { name: 'Not defteri ekle' }).click()
    await page.getByRole('textbox', { name: 'Yeni not defteri' }).fill(name)
    await page.getByRole('button', { name: 'Oluştur', exact: true }).click()
  }

  // Give Proje A the green accent and check the folder icon picks it up.
  await page.getByRole('button', { name: 'Proje A seçenekleri' }).click()
  await page.getByRole('menuitem', { name: 'Renk' }).click()
  await page.getByRole('button', { name: 'Renk green' }).click()
  const folderA = page.getByRole('button', { name: 'Proje A', exact: true })
  await expect(folderA.locator('svg').nth(1)).toHaveCSS('color', 'rgb(24, 128, 56)')

  // Drag Proje B onto Proje A: it becomes a child, hidden until A is expanded.
  await page
    .getByRole('button', { name: 'Proje B', exact: true })
    .dragTo(page.getByRole('button', { name: 'Proje A', exact: true }))
  await expect(page.getByRole('button', { name: 'Proje B', exact: true })).toHaveCount(0)

  await folderA.locator('span[role="presentation"]').click()
  await expect(page.getByRole('button', { name: 'Proje B', exact: true })).toBeVisible()
})

test('i18n: switch language to English and persist across reload', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()

  // Switch to English from Settings (opened via the app menu).
  await page.getByRole('button', { name: 'Uygulama menüsü' }).click()
  await page.getByRole('menuitem', { name: 'Ayarlar' }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await page.keyboard.press('Escape')

  // Chrome copy is now English and the document language follows.
  await expect(page.getByRole('button', { name: 'New note' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toHaveCount(0)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  // Persisted: the language survives, and with "no lock" the reload lands directly on the
  // notes shell in English.
  await page.reload()
  await expect(page.getByRole('button', { name: 'New note' })).toBeVisible()
})

test('editor: markdown preview renders and returns to editing', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()
  await page.getByRole('button', { name: 'Yeni not' }).click()

  const editor = page.locator('.cm-content')
  await editor.click()
  // insertText bypasses CodeMirror keymaps (list continuation/autocomplete) so the
  // document is exactly what we typed — newlines included.
  await page.keyboard.insertText('# Başlık\n- bir\n- iki')

  // Preview renders the decrypted Markdown as real elements…
  await page.getByRole('button', { name: 'Önizleme' }).click()
  const preview = page.locator('.md-preview')
  await expect(preview.getByRole('heading', { name: 'Başlık' })).toBeVisible()
  await expect(preview.getByText('bir')).toBeVisible()
  await expect(preview.getByText('iki')).toBeVisible()

  // …and the toggle returns to the editable CodeMirror surface.
  await page.getByRole('button', { name: 'Düzenle' }).click()
  await expect(page.locator('.cm-content')).toBeVisible()
})

test('list: sorting by title switches to a flat, A→Z list', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  await page.getByRole('button', { name: 'Yeni not' }).click()
  await expect(page.getByRole('tab')).toHaveCount(1)
  await page.getByPlaceholder('Başlıksız').fill('Alfa')
  await expect(page.getByRole('tab', { name: 'Alfa' })).toBeVisible()

  await page.getByRole('button', { name: 'Yeni not' }).click()
  await expect(page.getByRole('tab')).toHaveCount(2)
  await page.getByPlaceholder('Başlıksız').fill('Beta')
  await expect(page.getByRole('tab', { name: 'Beta' })).toBeVisible()

  const alfaRow = page.locator('li').filter({ hasText: /Alfa/ })
  const betaRow = page.locator('li').filter({ hasText: /Beta/ })

  // Default ordering is last-updated desc, so the newer "Beta" sits above "Alfa".
  const before = await Promise.all([alfaRow.boundingBox(), betaRow.boundingBox()])
  expect(before[0]!.y).toBeGreaterThan(before[1]!.y)

  // Sorting by title (A→Z) flips them and drops the date headers.
  await page.getByRole('button', { name: 'Sırala' }).click()
  await page.getByRole('menuitem', { name: 'Başlık' }).click()
  const after = await Promise.all([alfaRow.boundingBox(), betaRow.boundingBox()])
  expect(after[0]!.y).toBeLessThan(after[1]!.y)
})

test('links: [[ suggestion, preview navigation, backlinks and broken links', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  // Target note that will be linked to.
  await page.getByRole('button', { name: 'Yeni not' }).click()
  await expect(page.getByRole('tab')).toHaveCount(1)
  await page.getByPlaceholder('Başlıksız').fill('Alfa')
  await expect(page.getByRole('tab', { name: 'Alfa' })).toBeVisible()

  // Source note that links to it.
  await page.getByRole('button', { name: 'Yeni not' }).click()
  await expect(page.getByRole('tab')).toHaveCount(2)
  await page.getByPlaceholder('Başlıksız').fill('Beta')
  await expect(page.getByRole('tab', { name: 'Beta' })).toBeVisible()

  const editor = page.locator('.cm-content')
  await editor.click()
  // `[[` pops the note suggestion list.
  await page.keyboard.insertText('[[')
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('Alfa')
  await page.keyboard.press('Escape')

  // Write the link, replacing whatever is in the doc.
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText('[[Alfa]]')
  await page.waitForTimeout(900)

  // Preview renders it as a clickable in-app link; clicking opens the target.
  await page.getByRole('button', { name: 'Önizleme' }).click()
  const link = page.locator('.md-preview a[data-note-id]')
  await expect(link).toHaveText('Alfa')
  await link.click()
  await expect(page.getByPlaceholder('Başlıksız')).toHaveValue('Alfa')

  // The target lists Beta as a backlink.
  await page.getByRole('button', { name: 'Bağlantılar' }).click()
  const panel = page.getByRole('complementary', { name: 'Bağlantılar' })
  await expect(panel.getByText('Bu nota bağlananlar · 1')).toBeVisible()
  await expect(panel.getByRole('button', { name: /Beta/ })).toBeVisible()

  // A link to a missing title is surfaced as broken, not silently dropped.
  await editor.click()
  await page.keyboard.insertText('\n[[Kayıp Not]]')
  await expect(panel.getByText('Kırık bağlantılar · 1')).toBeVisible()
})

test('templates: save a note as a template, then create a note from it', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  // Source note carrying the content a template should capture.
  await page.getByRole('button', { name: 'Yeni not' }).click()
  await expect(page.getByRole('tab')).toHaveCount(1)
  await page.getByPlaceholder('Başlıksız').fill('Şablon Kaynağı')
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.insertText('şablon gövdesi')
  await page.getByRole('button', { name: 'Etiketler' }).click()
  await page.getByLabel('Etiket ekle').fill('şablon')
  await page.getByLabel('Etiket ekle').press('Enter')
  await expect(page.getByText('#şablon').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(900)

  // Save it as a named template from the note menu.
  await page.getByRole('button', { name: 'Diğer işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Şablon olarak kaydet' }).click()
  await page.getByRole('textbox', { name: 'Şablon olarak kaydet' }).fill('Toplantı şablonu')
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click()

  // It is listed (and manageable) in Settings → Templates.
  await page.getByRole('button', { name: 'Uygulama menüsü' }).click()
  await page.getByRole('menuitem', { name: 'Ayarlar' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Ayarlar' }).getByText('Toplantı şablonu'),
  ).toBeVisible()
  await page.keyboard.press('Escape')

  // The command palette now offers "new note from template".
  await page.keyboard.press('Control+k')
  await page.getByLabel('Komut ara').fill('Şablondan')
  await page.keyboard.press('Enter')

  // Picking it creates a note pre-filled from the template.
  const picker = page.getByRole('dialog', { name: 'Şablondan yeni not' })
  await picker.getByRole('button', { name: /Toplantı şablonu/ }).click()
  await expect(page.getByPlaceholder('Başlıksız')).toHaveValue('Şablon Kaynağı')
  await expect(page.locator('.cm-content')).toContainText('şablon gövdesi')

  // The template's tags came along too.
  await page.getByRole('button', { name: 'Etiketler' }).click()
  await expect(page.getByText('#şablon').first()).toBeVisible()
})

test('import: markdown + JSON dry-run, skips duplicates, imports new notes', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  // An existing note that one of the files will duplicate by content hash.
  await page.getByRole('button', { name: 'Yeni not' }).click()
  await page.getByPlaceholder('Başlıksız').fill('Mevcut')
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.insertText('aynı gövde')
  await page.waitForTimeout(900)

  // Settings → import opens the file dialog.
  await page.getByRole('button', { name: 'Uygulama menüsü' }).click()
  await page.getByRole('menuitem', { name: 'Ayarlar' }).click()
  await page.getByRole('button', { name: /İçe aktar/ }).click()

  const dialog = page.getByRole('dialog', { name: 'İçe aktarma' })
  await expect(dialog).toBeVisible()

  await page.locator('dialog[open] input[type=file]').setInputFiles([
    { name: 'mevcut.md', mimeType: 'text/markdown', buffer: Buffer.from('# Mevcut\naynı gövde') },
    { name: 'yeni.md', mimeType: 'text/markdown', buffer: Buffer.from('# Yeni Not\n\nyepyeni gövde') },
    {
      name: 'export.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          app: 'vaultnote',
          version: 1,
          notes: [{ title: 'JSON Notu', body: 'json gövde', tags: ['j'] }],
        }),
      ),
    },
  ])

  // Dry-run: two new, one duplicate — nothing is written yet.
  await expect(dialog.getByText('3 not bulundu: 2 yeni, 1 yinelenen.')).toBeVisible()
  await expect(page.getByRole('complementary').getByRole('button', { name: /Yeni Not/ })).toHaveCount(0)

  await dialog.getByRole('button', { name: '2 notu içe aktar' }).click()
  await expect(dialog).toHaveCount(0)

  const list = page.getByRole('complementary')
  await expect(list.getByRole('button', { name: /Yeni Not/ })).toBeVisible()
  await expect(list.getByRole('button', { name: /JSON Notu/ })).toBeVisible()

  // Re-importing the same files now reports everything as duplicate.
  await page.getByRole('button', { name: 'Uygulama menüsü' }).click()
  await page.getByRole('menuitem', { name: 'Ayarlar' }).click()
  await page.getByRole('button', { name: /İçe aktar/ }).click()
  await page.locator('dialog[open] input[type=file]').setInputFiles([
    { name: 'mevcut.md', mimeType: 'text/markdown', buffer: Buffer.from('# Mevcut\naynı gövde') },
  ])
  await expect(
    page.getByRole('dialog', { name: 'İçe aktarma' }).getByText('1 not bulundu: 0 yeni, 1 yinelenen.'),
  ).toBeVisible()
})

test('history: restore an earlier version of a note', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ana parola').fill(PASS)
  await page.getByLabel('Parolayı doğrula').fill(PASS)
  await page.getByRole('button', { name: 'Vault oluştur' }).click()

  await page.getByRole('button', { name: 'Yeni not' }).click()
  await expect(page.getByRole('tab')).toHaveCount(1)
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.insertText('ilk sürüm')
  await page.waitForTimeout(900)

  // Edit again — this snapshots the previous content into the local history.
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText('ikinci sürüm')
  await page.waitForTimeout(900)

  // Open the version history and pick the newest snapshot (the pre-edit content).
  await page.getByRole('button', { name: 'Sürüm geçmişi' }).click()
  const panel = page.getByRole('complementary', { name: 'Sürüm geçmişi' })
  await panel.getByRole('button', { name: /Sürüm/ }).first().click()

  // The read-only preview shows the old body; restoring writes a new head version.
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('ilk sürüm')).toBeVisible()
  await dialog.getByRole('button', { name: 'Bu sürümü geri yükle' }).click()
  await expect(page.locator('.cm-content')).toContainText('ilk sürüm')
})

test('install: the top bar offers install when the browser allows it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Parolasız' }).click()
  await page.getByRole('checkbox', { name: 'Riski anladım' }).click()
  await page.getByRole('button', { name: 'Parolasız oluştur' }).click()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()

  // No install affordance until the browser fires beforeinstallprompt.
  await expect(page.getByRole('button', { name: 'Uygulamayı yükle' })).toHaveCount(0)

  await page.evaluate(() => {
    ;(window as unknown as { __installPrompted: boolean }).__installPrompted = false
    const event = new Event('beforeinstallprompt')
    Object.assign(event, {
      prompt: () => {
        ;(window as unknown as { __installPrompted: boolean }).__installPrompted = true
        return Promise.resolve()
      },
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    })
    window.dispatchEvent(event)
  })

  const install = page.getByRole('button', { name: 'Uygulamayı yükle' })
  await expect(install).toBeVisible()
  await install.click()

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __installPrompted: boolean }).__installPrompted))
    .toBe(true)
  // A single-use prompt is consumed, so the affordance disappears.
  await expect(page.getByRole('button', { name: 'Uygulamayı yükle' })).toHaveCount(0)
})
