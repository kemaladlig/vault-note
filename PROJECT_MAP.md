# VaultNote — Project Map

Zero-server, end-to-end encrypted, cross-device note app. Data lives in the user's own
Google Drive `appDataFolder`; only ciphertext leaves the device. Local-first.

## Stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------- |
| Runtime        | React 19 + TypeScript 6, Vite 8                               |
| Native shell   | Capacitor (Android / iOS), same code also ships as PWA        |
| Styling        | Tailwind v4 (CSS-first) + shadcn/ui (`base-nova`, Base UI)    |
| State          | Zustand                                                       |
| Local storage  | IndexedDB (Dexie) — encrypt-at-rest implemented                    |
| Editor         | CodeMirror 6 — basic wiring implemented                        |
| Crypto         | WebCrypto AES-256-GCM + HKDF; Argon2id via `hash-wasm`        |
| Sync           | Google Drive REST v3, `drive.appdata` — client + engine implemented |
| Tests          | Vitest (32 unit) + Playwright e2e smoke (real Chromium)       |

## Layout

```
src/
  App.tsx                     app shell → VaultGate → NotesShell
  components/ui/              shadcn/ui primitives (generated vendor code)
  lib/utils.ts               cn() class merger
  shared/                     cross-feature infrastructure
    db.ts                     Dexie schema: meta, notes (row contracts)
    ids.ts, time.ts
  index.css                  design tokens (single source of truth) + Tailwind theme
  features/
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
        vaultStore.ts        Zustand: loading→uninitialized→locked→unlocked, DEK in RAM
        vaultRepo.test.ts
      ui/
        VaultGate.tsx        routes app by vault lifecycle
        CreateVaultForm.tsx, UnlockForm.tsx
    notes/
      model.ts               DecryptedNote, NoteContent
      search.ts              Turkish-aware global note filter
      store/
        noteRepo.ts          encrypt-at-rest CRUD over Dexie
        notesStore.ts        Zustand: decrypted notes in RAM, selected note
        noteRepo.test.ts
      ui/
        NotesShell.tsx       two-pane layout, global search, load/lock/sync actions
        NoteList.tsx         sidebar with preview
        NoteEditor.tsx       title + debounced save, in-note search wiring
        SearchBar.tsx        in-note search controls (count, next/prev)
        CodeEditor.tsx       CodeMirror 6 wrapper: markdown, search, token theme
      search.test.ts
    sync/
      drive/types.ts         DriveClient interface (list/download/create/update/remove)
      drive/googleDrive.ts   real REST v3 client (appDataFolder)
      auth/googleAuth.ts     Google Identity Services token flow
      manifest.ts            encrypted note index (seal/open)
      engine.ts              two-way LWW sync over Drive
      bootstrap.ts           vault.json for new-device discovery
      useAutoSync.ts         background sync hook (mount/interval/online/focus)
      store/syncStore.ts     Zustand sync status, sync + restore actions
      ui/RestoreFromDrive.tsx  new-device entry point
      testing/fakeDrive.ts   in-memory Drive for tests
      engine.test.ts
      bootstrap.test.ts
```


## Crypto model (contract)

- **Key hierarchy:** passphrase → Argon2id → **KEK** wraps a random **Vault Key (DEK)**.
  Changing the passphrase re-wraps the DEK only; notes are never re-encrypted.
- **Notes:** per-note key = `HKDF-SHA256(DEK, info="vaultnote:note:<id>")`, AES-256-GCM.
- **AAD binds context** (`vaultnote:v1:note:<id>:<version>`) → blocks ciphertext swapping
  between notes and version rollback.
- **Every seal uses a fresh 12-byte IV.** `Sealed = { v, alg, iv, ct }`, all base64.
- **Access modes:** `passphrase` (cross-device) and `device` (keystore-held DEK, no
  cross-device without key transfer) — `VaultMode` in types.
- **Locking** wipes the DEK and clears the decrypted note list from memory (notesStore
  subscribes to the vault status).

## Sync & auth

- **Files in `appDataFolder`:** `vaultnote.vault.json` (plaintext bootstrap: header + settings),
  `vaultnote.manifest.json` (encrypted index), `note-<id>.json` (encrypted `NoteRow`).
- **Manifest** is sealed with an HKDF-derived key (`vaultnote:manifest`); note ids/titles never
  appear in clear. Note files hold the already-encrypted row, so sync never touches plaintext.
- **Engine** (`syncNotes`): pull newer/missing remote rows → push local rows the remote lacks →
  rewrite manifest. Conflicts resolve last-write-wins (updatedAt, version tie-break); remote
  tombstones propagate.
- **Auth:** Google Identity Services, `drive.appdata` scope. Set `VITE_GOOGLE_CLIENT_ID` in
  `.env.local` (see `.env.example`). The Drive button is disabled until it is configured.
- **New device:** "Drive'dan geri yükle" pulls the bootstrap, adopts the header locally, then
  asks for the passphrase (lands in `locked`).
- **Auto-sync:** `useAutoSync` runs on unlock, every 60s, and on `online`/`focus` — always
  `interactive: false`, so it never opens the OAuth popup and is a no-op until first sign-in.
- **Still open:** native OAuth deep-link flow for Capacitor builds, and code-splitting the
  bundle (CodeMirror dominates the ~340 kB gzip).

## Search

- **Global** (`features/notes/search.ts`): filters the in-memory decrypted notes by
  title/body/tags, Turkish-aware case-insensitive. Lives in the sidebar; opening a hit seeds
  the in-note search.
- **In-note**: CodeMirror's `search()` extension highlights matches with `--search-highlight`
  (active match `--search-highlight-active`). `SearchBar.tsx` drives term + Next/Prev via the
  `CodeEditorHandle`; Mod-F opens our bar (a high-precedence keymap overrides basicSetup's).
- Match counting uses the query's own cursor, so the count matches exactly what is highlighted.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build
- `npm test` — Vitest (crypto)
- `npm run test:e2e` — Playwright smoke test in Chromium (needs a prior `npx playwright install chromium`)
- `npm run lint` — oxlint
- `npx cap sync` — copy web build into native projects (after adding platforms)

## Conventions

- Design tokens live only in `src/index.css`; never hardcode colors in components.
- shadcn/ui files are generated — after `npx shadcn add`, ensure imports use
  `@/lib/utils` (the generator may emit `"cn"`).
- Feature code is a vertical slice under `src/features/<feature>/`.
