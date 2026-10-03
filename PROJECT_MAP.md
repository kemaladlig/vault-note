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
| Local storage  | IndexedDB (Dexie) — encrypt-at-rest implemented                    |
| Editor         | CodeMirror 6 — basic wiring implemented                        |
| Crypto         | WebCrypto AES-256-GCM + HKDF; Argon2id via `hash-wasm`        |
| Sync           | Google Drive REST v3, `drive.appdata` — client + engine implemented |
| Tests          | Vitest (37 unit) + Playwright e2e (10 flows, real Chromium)   |

## Layout

```
src/
  App.tsx                     VaultGate → AppShell (chrome + notes surface)
  components/ui/              primitives: shadcn vendor (button, input, card, label,
                              checkbox) + hand-written modal, menu, badge, kbd,
                              spinner, toaster
  lib/utils.ts               cn() class merger
  shared/                     cross-feature infrastructure
    db.ts                     Dexie schema: meta, notes (row contracts)
    folders.ts                Folder/FoldersDoc, tree helpers, sealed-doc crypto
    ids.ts, time.ts           now() + relativeTime() + bucketOf() (tr)
    theme.ts                  persisted theme mode (system/light/dark) + init
    scale.ts                  persisted UI scale (compact/normal/comfortable) + init
    boot.ts                   dismisses the inline boot splash once the first screen is up
    toast.ts                  imperative toast store
  index.css                  design tokens (single source of truth) + Tailwind theme
  features/
    shell/                    app chrome (spans vault + notes + sync)
      store/shellStore.ts     overlay state + mobile list/editor pane + split-view note
      useBoot.ts              hands the screen from the inline boot splash to the first screen
      useShortcuts.ts         Ctrl/Cmd+K palette, Ctrl/Cmd+N new note
      ui/
        AppShell.tsx          top bar + notes surface + global overlays
        Splash.tsx            brand screen for the vault-loading phase
        TopBar.tsx            brand, global search, sync, new note, lock, app menu
        CommandPalette.tsx    search + actions: note hits with match snippet, mobile search surface
        SettingsDialog.tsx    theme, rekey, quick-unlock, sync, export, reset
    vault/
      crypto/                cryptographic core (implemented, 11 tests)
        types.ts             Sealed, KdfParams, VaultHeader, CreatedVault
        encoding.ts          Bytes type, base64/utf8 helpers, randomBytes
        errors.ts            typed errors (WrongPassphraseError, ...)
        kdf.ts               Argon2id passphrase -> KEK
        aead.ts              AES-256-GCM seal/open + per-note HKDF key
        keys.ts              key hierarchy: create/unlock/rekey/wrap
        note.ts              note payload + body encryption
        index.ts             public barrel
        crypto.test.ts
      store/
        vaultRepo.ts         header/settings persistence in Dexie meta
        vaultStore.ts        Zustand: lifecycle + quick-unlock state, DEK in RAM
        deviceKey.ts         device key: non-extractable (web) / OS secure store (native)
        quickUnlock.ts       wrap/unwrap the DEK with the device key
        biometric.ts         native biometric gate (dynamic imports, no-op on web)
        vaultRepo.test.ts
      ui/
        VaultGate.tsx        routes app by vault lifecycle
        CreateVaultForm.tsx, UnlockForm.tsx
    notes/
      model.ts               DecryptedNote, NoteContent (incl. pinned/folderId/archived), NotesView
      search.ts              selectNotes: scope (view/folder subtree) + tag + Turkish-aware text
      views.ts               SavedView (smart view) + sealed local doc (name/filters encrypted)
      export.ts              markdown/JSON export (plaintext — UI warns)
      store/
        noteRepo.ts          encrypt-at-rest CRUD over Dexie (soft-delete, restore, destroy)
        notesStore.ts        Zustand: decrypted notes in RAM, scope/view/query, org actions
        folderRepo.ts        notebook tree as one sealed doc in meta
        folderStore.ts       Zustand: folders + local dirty flag, adopt/markSynced
        viewRepo.ts          smart views as one sealed doc in meta (device-local)
        viewStore.ts         Zustand: saved views + apply-to-filters
        noteRepo.test.ts
      ui/
        NotesShell.tsx       list + tabs + editor (+ optional split pane), responsive
        SidebarNav.tsx       scope + smart views, notebook tree (drag-to-reparent, colors), tags
        TabBar.tsx           open-note tabs; fixed width; bulk close; split indicator
        NoteList.tsx         pinned section + date groups; row actions (pin/archive/restore/delete/open-beside)
        NoteEditor.tsx       title + tag popover + note menu (pin/archive/move/export/delete)
        MoveNoteDialog.tsx   notebook picker for "Not defterine taşı"
        MoveFolderDialog.tsx notebook picker for "Taşı…" (reparent fallback)
        PromptDialog.tsx     single-field dialog for notebook create/rename
        SearchBar.tsx        in-note search controls (count, next/prev)
        Highlight.tsx        Turkish-aware substring highlight (list + palette)
        CodeEditor.tsx       CodeMirror 6 wrapper: markdown, search, token theme
      search.test.ts
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
  `--shell-from`/`--shell-to` gradient) that needs no JS. `features/shell/useBoot.ts` hands over as
  soon as the vault lifecycle leaves `loading`: the app fades it out (`shared/boot.ts`), the
  unlock/setup screens drop it instantly, and a 6 s budget releases it even if boot stalls. The
  fading element sets `pointer-events: none`, and a stuck splash is a bug (e2e asserts it is gone).
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
  Drive file); smart views = `HKDF(DEK, "vaultnote:views")` (device-local, never synced). Each is
  one AES-GCM document, so folder names and saved-view names/queries stay encrypted at rest.
- **AAD binds context** (`vaultnote:v1:note:<id>:<version>`) → blocks ciphertext swapping
  between notes and version rollback.
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
- **Passwordless mode (`device`):** the header is wrapped with a random throwaway passphrase we
  discard, and the DEK is reachable only via this device's quick-unlock key. No recovery, no
  cross-device: clearing site data loses the vault, and a Drive backup cannot be opened
  elsewhere. The create form gates it behind an explicit acknowledgment; the unlock screen hides
  the passphrase fallback and offers a reset if the device key is gone.
- **Passphrase change (rekey):** Settings → "Parolayı değiştir" verifies the current passphrase,
  then `rekeyVault` re-wraps the same DEK. Hidden in passwordless mode (there is no passphrase).

## Features (user-facing)

- Vault lifecycle: create (passphrase or passwordless), unlock (passphrase, quick-unlock,
  biometric on native), lock, reset, forget device.
- Notes: create/edit (debounced encrypted save), delete with confirmation, tags, search.
  The list is grouped by date (Bugün / Dün / Bu hafta / Daha eski) with a two-line preview.
- **Tabs & split:** notes open as fixed-width tabs (persisted by opaque id, so tabs survive a
  reload); switching updates the editor, closing picks the neighbour. A tab-end menu does bulk
  close ("Diğerlerini kapat" / "Tüm sekmeleri kapat"). On desktop a second note can be opened
  beside the active one ("Yan tarafta aç" row action) for a real side-by-side split; closing the
  split pane (or its tab) returns to a single editor.
- **Smart views:** save the current filter set (query + tag + notebook + scope) under a name and
  re-apply it from the sidebar ("Akıllı görünümler"). Names and filters are stored **sealed** in
  local meta (`vaultnote:views`), device-local and never synced. Rename/delete per view.
- **Organization:** pin ("Sabitlenenler"), nested **notebooks** (folders, sealed at rest),
  archive, and a trash with restore / permanent delete / "Çöpü boşalt". The sidebar exposes
  scope views, the notebook tree (per-folder counts, rename/delete, sub-notebooks), an optional
  per-notebook **accent color** (theme-aware) and **drag-to-reparent** (drop a notebook onto
  another to nest it, or onto the section header for top level; a "Taşı…" dialog is the
  keyboard/mobile fallback). A note's notebook is changed from its header menu ("Not defterine taşı…").
- Chrome: top-bar global search (desktop field; mobile magnifier opens the palette, which also
  shows *where* each note matched via a highlighted snippet), sidebar tag filter, command palette
  (Ctrl/Cmd+K), app menu + Settings (theme, rekey, sync, export, reset), toasts, dark mode.
- Export: per-note Markdown, all notes Markdown/JSON (plaintext, warned).
- Sync: manual + background Google Drive sync (see below).

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
  remote tombstones propagate.
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
- **New device:** "Drive'dan geri yükle" pulls the bootstrap, adopts the header locally, then
  asks for the passphrase (lands in `locked`).
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
- **Export:** `features/notes/export.ts` downloads a note/all notes as Markdown or all as JSON.
  Export is **plaintext**; the UI states this before offering it.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build
- `npm test` — Vitest (crypto)
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
