# VaultNote — Project Map

Zero-server, end-to-end encrypted, cross-device note app. Data lives in the user's own
Google Drive `appDataFolder`; only ciphertext leaves the device. Local-first.

## Stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------- |
| Runtime        | React 19 + TypeScript 6, Vite 8                               |
| Native shell   | Capacitor (Android / iOS), same code also ships as PWA        |
| Styling        | Tailwind v4 + shadcn/Base UI + Material-3-inspired tokens     |
| State          | Zustand                                                       |
| Local storage  | IndexedDB (Dexie) — encrypt-at-rest; v2 adds device-local note history |
| Editor         | CodeMirror 6 — editing + sanitized Markdown preview            |
| Markdown       | `marked` + `DOMPurify` (preview only; never raw user HTML)     |
| Crypto         | WebCrypto AES-256-GCM + HKDF; Argon2id via `hash-wasm`        |
| Sync           | Google Drive REST v3, `drive.appdata` — client + engine implemented |
| Tests          | Vitest (66 unit) + Playwright e2e (17 flows, real Chromium)   |
| PWA / offline  | `vite-plugin-pwa` (Workbox) — installable shell + offline assets |
| Localization   | hand-rolled `shared/i18n.ts` + `shared/locales.ts` (tr default, en) |

## Layout

```
src/
  App.tsx                     VaultGate → AppShell (chrome + notes surface)
  components/ui/              primitives: shadcn vendor (button, input, card, label,
                              checkbox) + hand-written modal, menu, badge, kbd,
                              spinner, toaster
  lib/utils.ts               cn() class merger
  shared/                     cross-feature infrastructure
    db.ts                     Dexie schema: meta, notes, revisions (v2) — row contracts
    folders.ts                Folder/FoldersDoc, tree helpers, sealed-doc crypto
    ids.ts, time.ts           now() + relativeTime() (locale-aware Intl) + bucketOf()
    theme.ts                  persisted theme mode (system/light/dark) + init
    i18n.ts                   persisted locale (tr/en) + t()/useT() + init
    locales.ts                message catalog (tr is the key source of truth; en must cover it)
    scale.ts                  persisted UI scale (compact/normal/comfortable) + init
    accent.ts                 persisted accent color (blue/violet/teal/amber/rose) + init
    editorPrefs.ts            persisted editor delta size + line spacing + init
    trash.ts                  trash retention preference + isTrashExpired predicate
    revisions.ts              version-history retention preference (5/10/25, default 10)
    boot.ts                   dismisses the inline boot splash once the first screen is up
    toast.ts                  imperative toast store (leaving phase drives the exit animation)
    exitMotion.ts             motionMs()/exitMotionMs() (JS timings read from CSS tokens) + useExitMotion() for portals
  index.css                  design tokens (single source of truth) + Tailwind theme
  features/
    shell/                    app chrome (spans vault + notes + sync)
      store/shellStore.ts     overlay state + nav-drawer open flag + mobile list/editor pane + split-view note + template-picker/import dialogs
      useBoot.ts              hands the screen from the inline boot splash to the first screen
      useShortcuts.ts         Ctrl/Cmd+K palette, Ctrl/Cmd+N new note
      ui/
        AppShell.tsx          top bar + notes surface + global overlays (palette, template picker, import, settings)
        Splash.tsx            brand screen for the vault-loading phase
        TopBar.tsx            brand, global search, sync, new note, lock, app menu
        CommandPalette.tsx    search + actions: note hits with match snippet, mobile search surface
        SettingsDialog.tsx    theme, rekey, app-open mode + PIN, sync, export/import, templates, reset
    vault/
      crypto/                cryptographic core (implemented, 17 tests)
        types.ts             Sealed, KdfParams, VaultHeader, CreatedVault
        encoding.ts          Bytes type, base64/utf8 helpers, randomBytes
        errors.ts            typed errors (WrongPassphraseError, ...)
        kdf.ts               Argon2id passphrase -> KEK
        aead.ts              AES-256-GCM seal/open + per-note HKDF key
        keys.ts              key hierarchy: create/unlock/rekey/wrap
        note.ts              note payload + body encryption
        strength.ts          passphrase length gate + entropy estimate (advisory)
        index.ts             public barrel
        crypto.test.ts, strength.test.ts
      store/
        vaultRepo.ts         header/settings persistence in Dexie meta
        vaultStore.ts        Zustand: lifecycle + quick-unlock state, app-open mode, DEK in RAM
        deviceKey.ts         device key: non-extractable (web) / OS secure store (native)
        quickUnlock.ts       wrap/unwrap the DEK with the device key (shared seal/open helpers)
        appLock.ts           device-local open mode (none/biometric) preference; PIN lives in pinGate
        pinGate.ts           optional PIN gate over the device blob + attempt throttling
        biometric.ts         native biometric gate (dynamic imports, no-op on web)
        vaultRepo.test.ts
      ui/
        VaultGate.tsx        routes app by vault lifecycle
        VaultFrame.tsx       shared branded stage for the auth screens
        CreateVaultForm.tsx, UnlockForm.tsx
        PinDialog.tsx        set/change/remove the device-local unlock PIN
    notes/
      model.ts               DecryptedNote, NoteContent (incl. pinned/folderId/archived), NotesView
      search.ts              selectNotes: scope (view/folder subtree) + tag + Turkish-aware text
      sort.ts                SortField/SortDir + sortNotes + groupFieldFor (date vs flat)
      links.ts               [[wiki links]]: parse, resolve (title→id), backlinks, preview transform
      views.ts               SavedView (smart view) + sealed local doc (name/filters encrypted)
      templates.ts           NoteTemplate + sealed local doc (name/title/body/tags encrypted)
      import.ts              Markdown/JSON parsing, frontmatter, content-hash dedupe, dry-run plan
      export.ts              markdown/JSON export (plaintext — UI warns)
      store/
        noteRepo.ts          encrypt-at-rest CRUD over Dexie (+ device-local revision snapshots)
        notesStore.ts        Zustand: decrypted notes in RAM, scope/view/query, sort, org actions, bulk import, revision history
        folderRepo.ts        notebook tree as one sealed doc in meta
        folderStore.ts       Zustand: folders + local dirty flag, adopt/markSynced
        viewRepo.ts          smart views as one sealed doc in meta (device-local)
        viewStore.ts         Zustand: saved views + apply-to-filters
        templateRepo.ts      templates as one sealed doc in meta (device-local)
        templateStore.ts     Zustand: CRUD for note templates
        noteRepo.test.ts
        notesStore.test.ts    pristine-empty pruning (trash, never destroy)
      ui/
        NotesShell.tsx       3-pane (nav sidebar | list | editor) + split; nav is a slide-over drawer below xl
        SidebarNav.tsx       scope + smart views, notebook tree (drag-to-reparent, colors), tags
        TabBar.tsx           open-note tabs; content-width tabs joined into the editor; bulk close; split indicator
        NoteList.tsx         pinned section + date groups (or flat when title-sorted); row actions
        NoteEditor.tsx       title + tag popover + links panel (backlinks/broken) + note menu (incl. save-as-template)
        MoveNoteDialog.tsx   notebook picker for "Not defterine taşı"
        MoveFolderDialog.tsx notebook picker for "Taşı…" (reparent fallback)
        PromptDialog.tsx     single-field dialog for notebook/template create/rename
        TemplatePickerDialog.tsx  pick a template to create a note from
        ImportDialog.tsx     file picker + dry-run summary + target notebook, then bulk import
        NoteHistory.tsx      version-history panel: list snapshots, read-only preview, restore
        SearchBar.tsx        in-note search controls (count, next/prev)
        Highlight.tsx        Turkish-aware substring highlight (list + palette)
        CodeEditor.tsx       CodeMirror 6 wrapper: markdown, search, [[ completion, token theme
        EditorToolbar.tsx    Markdown format bar + text-appearance (size/line) popover
        livePreview.ts       Obsidian-style live preview decorations + active-format detection
        MarkdownPreview.tsx  read-only preview: marked + sanitized HTML; wiki links navigate in-app
      search.test.ts
      links.test.ts
      import.test.ts
    sync/
      drive/types.ts         DriveClient interface (list/download/create/update/remove)
      drive/googleDrive.ts   real REST v3 client (appDataFolder)
      auth/config.ts         shared GOOGLE_CLIENT_ID / isAuthConfigured
      auth/googleAuth.ts     facade: picks web vs native provider at runtime
      auth/webGisAuth.ts     Google Identity Services token flow (web/webview)
      auth/nativePkceAuth.ts Authorization Code + PKCE via browser + deep link
      auth/pkce.ts           RFC 7636 verifier/challenge helpers
      manifest.ts            encrypted note index (seal/open)
      folders.ts             encrypted notebook tree: seal/open + LWW sync of one doc
      engine.ts              two-way LWW sync over Drive
      bootstrap.ts           vault.json for new-device discovery
      useAutoSync.ts         background sync hook (push on edit; pull on interval/online/focus)
      store/syncStore.ts     Zustand sync status, sync + restore actions
      ui/RestoreFromDrive.tsx  new-device entry point
      testing/fakeDrive.ts   in-memory Drive for tests
      engine.test.ts
      bootstrap.test.ts
```

## Design system

- **One source of truth:** all colors, radius, elevation and motion live as CSS variables in
  `src/index.css` and are mapped into Tailwind's theme via `@theme inline`. Components never
  hardcode a color. Add a token here, not a one-off class.
- **Palette:** Google/Material-3-flavored — single blue accent (`--primary`), quiet neutral
  surfaces (`--surface`, `--surface-variant`, `--muted`), soft elevation (`shadow-e1/e2/e3`).
  Light and dark are both defined; `.dark` on `<html>` switches them.
- **Tonal hierarchy:** chrome and the note list sit on `--surface-variant`; the note itself is a
  `--surface` "page". Secondary controls (tag popover, filter chips) use quiet `--surface`/
  `--muted` fills instead of heavy borders.
- **Scale:** the root font size defaults to `17px` (laptop-first); every size is rem-based, so
  one value lifts the whole UI. Settings → Görünüm offers **Yazı boyutu** (Sıkı 15 / Normal 17 /
  Geniş 19), persisted in `localStorage` by `shared/scale.ts`. The CodeMirror editor uses
  `1rem`/line-height 1.75 and draws its cursor in `--foreground` (its default black is invisible
  on dark).
- **Theme:** `shared/theme.ts` persists the mode (`system`/`light`/`dark`) in `localStorage`,
  applies it, and follows the OS while in `system`. Default is system.
- **Motion:** `--duration-*` / `--ease-*` tokens plus `animate-fade-in|pop-in|slide-up`.
  Only transform/opacity animate; `prefers-reduced-motion` collapses everything globally.
- **Shared primitives:** `modal` (native `<dialog>`: focus trap, Esc, named via
  `aria-labelledby`), `menu` (accessible dropdown), `popover` (controlled, anchored, outside-click/
  Esc), `badge`, `kbd`, `spinner`, `toaster`.
- **Feedback:** `shared/toast.ts` (`toast(msg, tone)`) drives the mounted `Toaster`.
- **No-flash boot:** `index.html` applies the stored theme (`vaultnote.theme`) and scale
  (`vaultnote.scale`) synchronously *before* first paint and paints the correct surface
  (`--background`), so there is no blank/gray flash. These values mirror `shared/theme.ts` /
  `shared/scale.ts` and the tokens in `index.css`; `applyTheme` also keeps `color-scheme` in sync
  for native controls.
- **Boot splash:** the same `index.html` paints a brand screen (master app icon + wordmark on the
  `--shell-from`/`--shell-to` gradient) that needs no JS. The mark scales in and the wordmark
  follows ~110 ms behind — transform/opacity only, and `prefers-reduced-motion` drops it.
  `features/shell/useBoot.ts` hands over as soon as the vault lifecycle leaves `loading`: the app
  fades it out (`shared/boot.ts`), the unlock/setup screens drop it instantly, and a 6 s budget
  releases it even if boot stalls. The fading element sets `pointer-events: none`, and a stuck
  splash is a bug (e2e asserts it is gone).
- **Native launch:** `AppTheme.NoActionBarLaunch` uses `Theme.SplashScreen`
  (`androidx.core:core-splashscreen`) with `@drawable/splash_icon` — a resized copy of
  `public/vaultnote-icon.png` — on `@color/splash_background`, which mirrors the web gradient as a
  solid (`values` / `values-night`). Regenerate the icon from the master asset when the brand mark
  changes; Capacitor's own splash PNGs are not used.
- **Shortcuts:** Ctrl/Cmd+K opens the command palette; Ctrl/Cmd+N creates a note.

## Crypto model (contract)

- **Key hierarchy:** passphrase → Argon2id → **KEK** wraps a random **Vault Key (DEK)**.
  Changing the passphrase re-wraps the DEK only; notes are never re-encrypted.
- **Notes:** per-note key = `HKDF-SHA256(DEK, info="vaultnote:note:<id>")`, AES-256-GCM.
- **Auxiliary sealed docs:** notebook tree = `HKDF(DEK, "vaultnote:folders")` (also synced as a
  Drive file); smart views = `HKDF(DEK, "vaultnote:views")` (device-local, never synced);
  templates = `HKDF(DEK, "vaultnote:templates")` (device-local, like views). Each is
  one AES-GCM document, so folder names, saved-view names/queries and template bodies stay
  encrypted at rest. **Version history** adds no key: each snapshot is a copy of the note's
  already-sealed `NoteRow` (same `HKDF(DEK, "vaultnote:note:<id>")` key and AAD), kept in the
  `revisions` table and never synced.
- **AAD binds context** (`vaultnote:v2:note:<id>:<version>:<updatedAt>`) → blocks ciphertext
  swapping between notes, version rollback, and **timestamp replay**. `updatedAt` is in the
  binding because it is the field sync trusts for last-write-wins: an attacker who could move it
  forward could make a stale row win, so re-uploading old content under a newer timestamp now
  fails the GCM tag instead of silently restoring old text.
  - **v1 (`vaultnote:v1:note:<id>:<version>`, no timestamp) is read-only.** `openNote` falls back
    to it, so notes sealed before this change keep opening with no migration pass. They gain the
    timestamp guarantee the next time they are written.
  - **Any write that moves `updatedAt` without changing content must go through `restampNote`**
    (decrypt + re-seal, one decrypt/encrypt) or the row's timestamp stops matching its ciphertext
    and the note stops opening. Three call sites, all of them required: `deleteNote`, `restoreNote`
    (trash/restore) and the tombstone branch in `sync/engine.ts` (mirroring a remote delete).
    Losing one is a silent data-loss bug, not a validation error.
  - **Breaks older app builds on other devices:** a build without v2 support cannot read a v2
    note. It lands with the PWA auto-update; a device stuck on an old cached bundle will report
    the note as undecryptable rather than lose it.
- **Note API takes a `NoteBinding`** (`{ id, version, updatedAt }`) rather than loose scalars, so
  the binding cannot be assembled with a field missing. `sealText`/`openText` were removed: dead
  code with no caller, and the body-only shortcut would have bypassed the binding.
- **Every seal uses a fresh 12-byte IV.** `Sealed = { v, alg, iv, ct }`, all base64.
- **Access modes:** `passphrase` (cross-device) and `device` (keystore-held DEK, no
  cross-device without key transfer) — `VaultMode` in types.
- **Locking** wipes the DEK and clears the decrypted note list from memory (notesStore
  subscribes to the vault status).
- **Boot idempotency:** `vaultStore.init()` is token-guarded and never downgrades an already
  `unlocked` session — a slow (StrictMode-duplicated) boot read cannot re-lock a vault the user
  just created or unlocked.
- **Quick unlock** wraps the DEK with a device key. Web keeps that key non-extractable in
  IndexedDB; native stores the raw key in the OS secure store (Keychain / EncryptedSharedPrefs)
  and gates the unlock behind a **biometric prompt** (`biometric.ts`, dynamic imports so web
  never loads the plugins). "Forget this device" deletes the sealed DEK and the device key.
  Restoring a drive vault disables it. The key is bound to the OS keystore, not to biometry —
  the prompt is an app-level gate on top of it.
- **PIN gate (app lock):** an optional device-local gate layered on quick unlock. Enabling it
  replaces the plain device blob with a copy sealed under a key derived from a 4–8 digit PIN
  (`Argon2id`, fresh salt) in `meta['vault.quickUnlockPin']`, so recovering the DEK needs both
  the device key and the PIN. It is a **convenience lock, never the encryption root** — a short
  PIN alone would be offline-brute-forceable, so it never encrypts notes directly. Wrong attempts
  throttle with exponential backoff (`meta['vault.pinAttempts']`). Never synced; dropped by
  "Forget this device" and by restoring a Drive vault.
- **App-open mode (device-local):** how the app opens on this device — `none` (open directly,
  no prompt), `pin` (the gate above), or `biometric` (native, `biometric.ts`). The non-PIN half is
  a device preference (`localStorage['vaultnote.appLock']`, `appLock.ts`); PIN presence is derived
  from `hasPinGate()`. With `none`, `vaultStore.init()` **auto-unlocks on a cold boot** (no tap);
  a manual **lock stays locked** for the session because the auto-open runs only from `init()`,
  never from `lock()`. Created vaults default to `none` with quick unlock enabled
  (`CreateVaultForm` always remembers the device); the mode is changeable in Settings, and
  switching off a PIN requires verifying it first, since that unwraps the device key.
- **Passwordless mode (`device`)** — legacy, no longer offered at creation: the header is wrapped
  with a random throwaway passphrase we discard, and the DEK is reachable only via this device's
  quick-unlock key. No recovery, no cross-device. Vault creation is passphrase-only; existing
  device vaults still unlock (the unlock screen hides the passphrase fallback and offers a reset
  if the device key is gone).
- **Passphrase change (rekey):** Settings → "Parolayı değiştir" verifies the current passphrase,
  then `rekeyVault` re-wraps the same DEK. Settings → "Yeni parola belirle (bu cihazla)"
  (`resetPassphrase`) skips the current check — allowed only while unlocked, i.e. after a
  device/PIN/biometric unlock that already proves DEK possession. Hidden in passwordless
  mode (there is no passphrase).
- **Passphrase policy (`crypto/strength.ts`):** hard gate = at least 8 characters
  (`MIN_PASSPHRASE_LENGTH`, enforced on create and rekey). A dependency-free entropy estimate
  (`estimateEntropyBits`, ~zxcvbn-class) additionally **advises** on create/rekey: character-class
  pool, length bonus, then discounts for low unique-character ratio, repeated runs/blocks,
  keyboard/alpha sequences and common tokens (`password`, `1234`, digits-only, …). The verdict
  drives an advisory hint only — a long memorable non-Latin phrase must not be blocked, so the
  estimator never gates. `passphraseHintKey` maps a verdict to its message and returns
  `undefined` for `strong`, so a good passphrase gets no commentary.

## Web deployment (contract)

`vercel.json` serves `dist/` as static files — there is no server runtime, no API and no
database, so no user data (plaintext or ciphertext) is ever handled by the host. Its `headers`
block is the app's only browser-enforced security boundary:

- **CSP** — `default-src 'self'`, `script-src` limited to self + `accounts.google.com` (the GIS
  script), `connect-src` to the Drive/OAuth hosts, `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'none'`. Any new outbound host or injected script must be added here explicitly.
- **Also set:** `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`,
  a restrictive `Permissions-Policy`.
- **Serving account is a trust boundary:** whoever can publish to the domain serves JS that runs
  inside the unlocked vault. Protect the Vercel account with 2FA; `VITE_GOOGLE_CLIENT_ID` is a
  public OAuth client id and is expected to appear in the bundle — it is not a secret.

## Features (user-facing)

- Vault lifecycle: create (passphrase; the device is remembered by default), unlock (passphrase,
  quick-unlock, PIN, biometric on native), lock, reset, forget device. Forgetting the passphrase
  on a remembered device: quick/PIN unlock, then Settings → Security → new passphrase
  (no current check — DEK is already in RAM). Drive is transport only: it carries ciphertext
  the account holder still cannot open without the passphrase. Existing **open modes**
  (no lock / PIN / biometric on native) stay; "No lock" opens the boot directly, no gate.
  Settings → Security switches the open mode at any time and can add/change/remove the
  app-lock **PIN**.
- Notes: create/edit (debounced encrypted save), delete with confirmation, tags, search.
  The editor toggles a **sanitized Markdown preview** (rendered with `marked` + `DOMPurify`,
  loaded lazily; the body never leaves the device). The list is grouped by date
  (Bugün / Dün / Bu hafta / Daha eski) with a two-line preview, and can be re-sorted from the
  list header — by last-updated or creation date (kept grouped), or by title (flat, A→Z);
  the choice is a device preference (`localStorage`, `notesStore`).
- **Links & backlinks:** `[[Note title]]` (and `[[title|alias]]`) links notes together.
  Typing `[[` suggests matching note titles in the editor; in the **preview** a resolved link
  is clickable and opens the target note in-app, while an unresolvable one is styled as broken
  rather than dropped. A header toggle opens a panel listing **backlinks** (notes linking here)
  and **broken** outgoing links. Resolution is by title then id, derived from the decrypted
  notes in RAM — nothing extra is persisted (`features/notes/links.ts`).
- **Tabs & split:** notes open as fixed-width tabs (persisted by opaque id, so tabs survive a
  reload); switching updates the editor, closing picks the neighbour. A tab-end menu does bulk
  close ("Diğerlerini kapat" / "Tüm sekmeleri kapat"). On desktop a second note can be opened
  beside the active one ("Yan tarafta aç" row action) for a real side-by-side split; closing the
  split pane (or its tab) returns to a single editor.
- **Smart views:** save the current filter set (query + tag + notebook + scope) under a name and
  re-apply it from the sidebar ("Akıllı görünümler"). Names and filters are stored **sealed** in
  local meta (`vaultnote:views`), device-local and never synced. Rename/delete per view.
- **Templates:** any note can be saved as a **template** ("Şablon olarak kaydet" in the note
  menu) capturing its title, body, tags and notebook. "Yeni not" → **Şablondan yeni not**
  (command palette) opens a picker that pre-fills a fresh note from a template. Templates are
  stored **sealed** in local meta (`vaultnote:templates`), device-local and never synced, and
  are managed (rename/delete) under Settings → Şablonlar.
- **Import:** Settings → Veri → **İçe aktar…** accepts Markdown files (optional `---`
  frontmatter for `title`/`tags`; a leading `# H1` and a standalone `#tag` line are also
  recognized) and the app's own JSON export. Files are parsed, then a **dry-run** shows how many
  notes are new vs. duplicates (content-hash match against the vault) with an optional target
  notebook; nothing is written until the user confirms. Imported notes are re-sealed under fresh
  ids (`features/notes/import.ts`).
- **Version history:** every genuine content edit snapshots the note's *prior* content before
  overwriting it (metadata-only changes like pin/move/archive do not). A header toggle opens a
  **history panel** listing snapshots by version and time; selecting one shows a read-only
  preview and **Restore** re-applies its title/body/tags as a **new head version** (the current
  notebook/pin/archive are preserved). History is **device-local and never synced**; the
  retention limit (5/10/25, default 10) is a device preference under Settings → Sürüm geçmişi.
- **Organization:** pin ("Sabitlenenler"), nested **notebooks** (folders, sealed at rest),
  archive, and a trash with restore / permanent delete / "Çöpü boşalt". The sidebar exposes
  scope views, the notebook tree (per-folder counts, rename/delete, sub-notebooks), an optional
  per-notebook **accent color** (theme-aware) and **drag-to-reparent** (drop a notebook onto
  another to nest it, or onto the section header for top level; a "Taşı…" dialog is the
  keyboard/mobile fallback). A note's notebook is changed from its header menu ("Not defterine taşı…").
- **Trash auto-purge:** trashed notes are swept on unlock and after each sync once they pass the
  retention window (7/30/90 days or "Asla"), hard-deleting them locally. The window is a
  non-sensitive device preference (`localStorage`, `shared/trash.ts`) set under Settings → Veri;
  the trash timestamp is the note's `updatedAt` at delete time, so no extra sealed field is needed.
- Chrome: top-bar global search (desktop field; mobile magnifier opens the palette, which also
  shows *where* each note matched via a highlighted snippet), sidebar tag filter, command palette
  (Ctrl/Cmd+K), app menu + Settings (theme, rekey, sync, export, reset), toasts, dark mode.
- Export: per-note Markdown, all notes Markdown/JSON (plaintext, warned).
- Sync: manual + background Google Drive sync (see below).

## Version history & migrations

- **Dexie v2** adds a `revisions` table (`[noteId+version]` index) holding the prior sealed
  `NoteRow` snapshot (same `sealed`/AAD) taken before each content-changing `updateNote`.
  `noteRepo` prunes to the configured limit and drops history on `destroyNote`/`emptyTrash`.
- **Rollback:** the migration is forward-only. To revert, drop the store — delete
  `db.revisions` (or `Dexie.delete('vaultnote')` only as a last resort) and remove the
  `db.version(2)` block. All notes remain intact; only local history is lost. Re-applying v2
  recreates an empty history.
- History is **device-local**: the sync engine only reads/writes `db.notes`, so revisions never
  reach Drive. A pulled remote revision overwrites the note row directly (no snapshot), so
  history reflects *local* edits.
- `shared/revisions.ts` stores the retention limit in `localStorage` (like theme/scale/trash);
  changing it prunes every note's history immediately.

## Sync & auth

- **Files in `appDataFolder`:** `vaultnote.vault.json` (plaintext bootstrap: header + settings),
  `vaultnote.manifest.json` (encrypted index), `note-<id>.json` (encrypted `NoteRow`),
  `vaultnote.folders.json` (encrypted notebook tree).
- **Manifest** is sealed with an HKDF-derived key (`vaultnote:manifest`); note ids/titles never
  appear in clear. Note files hold the already-encrypted row, so sync never touches plaintext.
  The notebook tree is a separate sealed doc (`vaultnote:folders`); folder names never leave the
  device in clear either.
- **Engine** (`syncNotes`): fast-path when the remote manifest is unchanged and nothing is local
  dirty; otherwise pull newer/missing remote rows → push local rows the remote lacks → rewrite
  the manifest (only on change). Conflicts resolve last-write-wins (updatedAt, version tie-break);
  remote tombstones propagate. When the remote overwrites a dirty local row, its id lands in
  `SyncResult.conflicts` so the UI can warn (the local draft is lost); a pulled notebook tree
  over dirty local folders counts as one folder conflict.
- **Notebook tree:** `syncFolders` (`features/sync/folders.ts`) syncs `vaultnote.folders.json` as
  one sealed doc — last-write-wins on its `updatedAt`, skipped when the file `modifiedTime` is
  unchanged and nothing is locally dirty. It runs right after `syncNotes` in the same pass.
- **UI refresh:** after a successful sync the app re-reads the decrypted list
  (`notesStore.reload`) without a loading flash, so pulled/changed notes appear immediately —
  no page reload needed (e.g. right after adopting a vault on a new device).
- **Editing vs. sync (data safety):** the editor only writes a row when there are genuinely
  unsaved edits (`pending` ref), so opening/closing an untouched note never bumps `updatedAt`
  and never clobbers a real edit via last-write-wins. When a newer revision is pulled while a
  note is open and the user is not typing, it is applied live (`CodeEditor.setValue`, which does
  not fire `onChange`). If both devices edit the same note before syncing, the later timestamp
  wins (LWW).
- **Auth:** `googleAuth.ts` selects a provider via `Capacitor.isNativePlatform()`:
  - **Web/webview** (`webGisAuth.ts`): Google Identity Services, `drive.appdata` scope.
  - **Native** (`nativePkceAuth.ts`): Authorization Code + PKCE. Opens the system browser
    (`@capacitor/browser`), receives the redirect `com.vaultnote.app://oauth2redirect` back via
    `@capacitor/app` `appUrlOpen`, then exchanges the code (no client secret). The scheme/host
    are mirrored by an intent-filter in `android/app/src/main/AndroidManifest.xml`; register the
    same redirect URI on the OAuth client.
  - Set `VITE_GOOGLE_CLIENT_ID` in `.env.local` (see `.env.example`). The Drive button is
    disabled until it is configured.
- **New device:** "Drive'a bağla ve geri yükle" pulls the bootstrap, adopts the header locally, then
  asks for the passphrase (lands in `locked`). `syncStore.restoredAt` is set on adopt and cleared
  after the first sync attempt, so the notes empty state says "fetching" instead of inviting a
  new vault while the first pull is in flight.
- **Auto-sync:** `useAutoSync` pushes ~1.5s after any local edit (new note / save / delete /
  notebook change) and pulls every 5s plus on `online`/`focus`/`visibilitychange` — always
  `interactive: false`, so it never opens the OAuth popup and is a no-op until first sign-in.
  Idle polls are cheap: the engine caches the manifest `modifiedTime` and returns early when the
  remote is unchanged and nothing is pending locally; the manifest is rewritten only when notes
  actually changed, and the folders doc only when the tree changed.
- **Native:** Android platform is committed (`android/`); build outputs and copied web assets
  are gitignored. `npx cap sync android` copies `dist/` in and registers plugins.
- **Still open:** real end-to-end Drive sync has not been exercised against a live Google
  account (only `FakeDrive`); native OAuth deep-link + biometrics need a device.

## Search

- **Global search surfaces:** on desktop a persistent field in the top bar; on mobile a
  magnifier button (`sm:hidden`) opens the command palette, which doubles as the search
  surface (search + commands + note jump) and is full-screen-friendly. The empty-state
  palette lists recent active notes.
- **Match location:** `matchInfo(note, query)` reports whether the hit is in the **title**,
  **tags**, or **body**, and returns a ~120-char body excerpt centered on the first body hit.
  The note list and the palette render that snippet with the hit highlighted
  (`Highlight.tsx`, `--search-highlight`), so it is always clear *which note* and *where* it
  matched — no more guessing from the first two body lines.
- **Global** (`features/notes/search.ts`): `selectNotes` composes the sidebar scope with the
  filters — scope = view (`all`/`pinned`/`archive`/`trash`) + optional notebook subtree
  (a folder id expands to itself and its descendants), then exact tag (`notesStore.tagFilter`),
  then Turkish-aware title/body/tag text (`notesStore.query`). Opening a hit seeds the in-note
  search. `activeNotes` excludes archive + trash from search/jump surfaces.
- **In-note**: CodeMirror's `search()` extension highlights matches with `--search-highlight`
  (active match `--search-highlight-active`). `SearchBar.tsx` drives term + Next/Prev via the
  `CodeEditorHandle`; Mod-F opens our bar (a high-precedence keymap overrides basicSetup's).
- Match counting uses the query's own cursor, so the count matches exactly what is highlighted.
- **Live preview**: `livePreview.ts` decorates the source (never rewrites it) — inline markers
  (`**`, `*`, `` ` ``, `# `, `> `, `- `, `[[ ]]`) hide while the selection is outside them and
  render styled (bold/italic/heading/quote/bullet) otherwise. `CodeEditor.onActiveFormats`
  reports `activeFormatsAt()` on selection/doc changes; `EditorToolbar` lights the matching
  buttons with `aria-pressed`. Stored content stays plain Markdown either way.
- **Export:** `features/notes/export.ts` downloads a note/all notes as Markdown or all as JSON.
  Export is **plaintext**; the UI states this before offering it.

## Localization (i18n)

- `shared/locales.ts` holds the catalog: `tr` is the key source of truth and `en` is typed as
  `Record<MessageKey, string>`, so a missing English string is a compile error. No JSX in
  values — split a sentence around markup into separate keys (`settings.exportWarnA/Strong/B`).
- `shared/i18n.ts` persists the locale (`vaultnote.locale`, like theme/scale), exposes `t()`
  for non-React code (stores, toasts, `export.ts`) and `useT()` for components (re-renders on
  switch). `initI18n()` runs on boot in `main.tsx` and sets `<html lang>`. Locale is **not**
  persisted per vault — it is a device preference.
- Turkish stays the default; the language switch is in Settings → Görünüm. `relativeTime`
  (`shared/time.ts`) builds its `Intl.RelativeTimeFormat` per locale on demand.
- Never hardcode user-facing copy in a component; add a key to both `tr` and `en`.

## PWA & offline

- `vite-plugin-pwa` (Workbox `generateSW`) builds `dist/sw.js` + `dist/manifest.webmanifest`
  on every `npm run build`. Config lives in `vite.config.ts`; `src/main.tsx` calls
  `registerSW({ immediate: true })` (a no-op in dev — `devOptions.enabled` is false).
- Precaching covers only built same-origin assets (js/css/html/svg/png/woff). Drive and
  Google auth origins are explicit `NetworkOnly` rules, so the service worker never caches
  ciphertext or API traffic; offline data stays the app's concern, not the SW's.
- Icons are generated from the master `public/vaultnote-icon.png` (1024px, transparent corners):
  `pwa-192.png` / `pwa-512.png` (any), `pwa-maskable-512.png` (maskable, full-bleed dark),
  `apple-touch-icon.png`, and `favicon-32.png`. Regenerate them with `pwsh scripts/gen-icons.ps1`
  when the brand mark changes; the master is a regeneration source and is excluded from the
  service-worker precache (`globIgnores` in `vite.config.ts`).
- While the browser offers `beforeinstallprompt`, the top bar shows an install button (plus a
  matching app-menu entry). See `src/shared/pwaInstall.ts`.
- Browser chrome tint comes from two `<meta name="theme-color">` entries in `index.html`
  (light/dark), mirroring `--background`.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build
- `npm test` — Vitest unit suite
- `npm run test:e2e` — Playwright smoke test in Chromium (needs a prior `npx playwright install chromium`)
- `npm run lint` — oxlint
- `npx cap sync` — copy web build into native projects (after adding platforms)
- `npx cap sync android` — sync web assets + plugins into the Android project
- `npx cap open android` — open in Android Studio (needs Android SDK/Java) to run on device

## Conventions

- Design tokens live only in `src/index.css`; never hardcode colors in components.
- shadcn/ui files are generated — after `npx shadcn add`, ensure imports use
  `@/lib/utils` (the generator may emit `"cn"`).
- Feature code is a vertical slice under `src/features/<feature>/`.
