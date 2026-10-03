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
  // …and it is gone once the unlock screen is on display, so nothing can be covered by it.
  await expect(page.getByRole('button', { name: 'Hızlı aç' })).toBeVisible()
  await expect(page.locator('#boot-splash')).toHaveCount(0)

  // And it must not swallow input on its way out.
  await page.getByRole('button', { name: 'Hızlı aç' }).click()
  await expect(page.getByRole('button', { name: 'Yeni not' })).toBeVisible()
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
