# VaultNote — Roadmap

Phased plan for the features still missing. Out of scope by request: file/image
attachments and CI. Each phase lists scope, the modules it touches, and the bar for
"done" (all phases must end `npm run build` + `npm test` green, plus `test:e2e` where a
flow changed).

Order matters: Phase 2 (i18n) comes before the feature phases so new UI ships localized
from birth instead of being retrofitted. Phase 7 is the only one that should be
questioned before starting.

---

## Phase 1 — Foundation: PWA + real Drive verification (S)

Two independent hardening tasks. Do the risky one first.

**1A · PWA + offline shell** — DONE (manifest, Workbox SW, icons, theme-color)
- `public/manifest.webmanifest` (name, icons from `vaultnote-icon.svg/png`, theme/background
  from the `--shell-from`/`--shell-to` tokens, `display: standalone`), link it + `theme-color`
  in `index.html`.
- Service worker via `vite-plugin-pwa` (Vite 8 compatible) for app-shell + asset caching.
  Must not cache `appDataFolder` API calls (network-only for Drive).
- Update `PROJECT_MAP.md` and README (the PWA claim is currently aspirational).

**1B · Live Drive smoke**
- Run the full engine against a real Google account, web and native: sign-in, first push,
  second-device restore via `vaultnote.vault.json`, note + notebook LWW, tombstones,
  `drive.appdata` cleanup. Native: PKCE deep link + biometric gate on a physical device.
- Fix whatever breaks in `engine.ts` / `googleDrive.ts` / `nativePkceAuth.ts`; keep
  `FakeDrive` behavior in sync. Lock the sync semantics from AGENTS.md.

**Done:** installable PWA that opens offline; one real two-device round trip (create on A →
appears on B, edit both → later timestamp wins, delete propagates).

---

## Phase 2 — i18n foundation (L, mechanical) — DONE

Must precede the feature phases.

- Add `src/shared/i18n.ts`: locale store (`tr`/`en`), persisted in `localStorage` next to
  theme/scale; a `t(key, params?)` and a `useT()` hook/selector. Flat key namespace by
  feature (`notes.editor.save`, `settings.security.title`, …).
- Move every hardcoded Turkish string out of `src/features/**/ui` and `SettingsDialog`
  into `locales/tr.ts` + `locales/en.ts`. This touches most UI files once.
- Add a language switch under Settings → Görünüm/Language; keep `tr` the default.
- `time.ts` relative-time and dates (`Intl`) must follow the active locale.
- Update `index.html` boot strings only where needed (none should be visible copy).

**Done:** `en` and `tr` complete, no user-facing literal left in components, switching
language updates the app live without reload.

---

## Phase 3 — Editor experience (S/M) — DONE

Independent, high visible value.

- **3A · Markdown preview.** A preview/edit toggle in `NoteEditor` renders the live body with
  `marked`, then **sanitizes** with `DOMPurify` before it touches the DOM (AGENTS.md: never
  render raw user markup); external links get `target=_blank rel=noopener`. `marked` and
  `DOMPurify` are code-split and load only when preview opens, so they stay out of the main
  bundle. Preview is a per-session mode (not persisted per note): it follows the note you are
  viewing, and searching is disabled while previewing.
- **3B · Sort options.** Sort control in the list header (a `Menu`): `updatedAt` / `createdAt` /
  `title`, asc/desc. State lives in `notesStore` and persists to `localStorage`
  (`vaultnote.sort`); `sort.ts` owns `sortNotes` + `groupFieldFor`. Pinned stays on top; date
  fields keep the Bugün/Dün/… grouping, `title` drops to a flat A→Z list. The chosen order
  also drives the idle (no-query) list in the command palette.

**Done:** preview toggle renders sanitized markdown and returns to editing; sort persists and
applies to the note list and the palette's idle list.

---

## Phase 4 — Links + backlinks (M) — DONE

- `links.ts` defines `[[Note title]]` / `[[title|alias]]`, parses a body into links, and
  resolves them (title match — Turkish-folded — first, then raw id) against the decrypted
  notes in RAM. No new persisted doc; the index is derived (`buildLinkIndex`). `backlinksFor`
  finds the notes linking to a target, and unresolved links are returned as broken.
- Editor: `[[` completion inside `CodeEditor` (a custom source fed through CodeMirror's
  language-data channel, so it rides basicSetup's autocompletion). In the preview, wiki links
  become real anchors with a `vaultnote:` scheme that DOMPurify is told to allow; a click opens
  the target in-app, broken links are styled and non-navigating. A collapsible panel in
  `NoteEditor` lists backlinks + broken outgoing links.
- Rename: title links that no longer resolve are surfaced as broken instead of silently
  dropped (id links keep working). No background link rewriting for MVP.

**Done:** `links.test.ts` green (11 cases); typing `[[` suggests notes, clicking opens the
target, and the target shows its backlinks — covered by the `links:` e2e flow.

---

## Phase 5 — Templates + import (M) — DONE

- **5A · Templates.** Mirror the smart-views pattern: one sealed doc
  `vaultnote:templates` (`viewRepo.ts` → `templateRepo.ts`), a store, and CRUD UI. "New
  note" gets a "from template" path that pre-fills title/body/tags/notebook. Device-local
  by default (like views), unless you want them synced — decide explicitly.
- **5B · Import.** `import.ts` accepts Markdown files (optional frontmatter for
  title/tags) and the app's own JSON export. Parse → `NoteContent`, create via the notes
  store, optional target notebook, dedupe by content hash, and show a dry-run summary
  (N new / M duplicates) before committing. Unit-test the parser.

**Done:** create-from-template works; importing a folder of `.md` and a JSON export
produces the right notes with a preview step.

Implemented:

- Templates are **device-local** (like smart views): sealed doc `vaultnote:templates`
  (`templates.ts` + `templateRepo.ts` + `templateStore.ts`). "Şablon olarak kaydet" in the
  note menu captures title/body/tags/notebook; the command palette offers "Şablondan yeni
  not" which opens `TemplatePickerDialog`; Settings → Şablonlar renames/deletes. Cleared from
  RAM on lock, same as views/folders.
- `import.ts` parses Markdown (optional frontmatter, leading `# H1`, standalone `#tag` line)
  and the app's JSON export, and `planImport` splits candidates into fresh vs. duplicate by a
  deterministic content hash (cyrb53 over title+body+sorted tags) against non-deleted notes.
  `ImportDialog` runs the file → parse → dry-run → confirm flow with an optional target
  notebook; `notesStore.importNotes` bulk-inserts in one revision.
- `import.test.ts` (10 cases). e2e: `templates:` and `import:` flows.

---

## Phase 6 — Version history / undo (L, schema change) — DONE

- Dexie **v2** migration: add a `revisions` table (`[noteId+version]` index) storing the
  prior sealed `NoteRow` snapshot before each `updateNote`. Retain last N (settings:
  10/25/50/unlimited), purge on rotation.
- Device-local first (like views) — do **not** sync revisions in v1; revisit only if asked.
- UI: history panel in `NoteEditor` (list versions with timestamp), read-only view and
  "restore" that writes a new version from the old content.

**Done:** editing creates history entries; restoring an old version creates a new head
version and syncs normally; migration is reversible (forward-only per AGENTS.md, with a
documented rollback).

Implemented:

- Dexie **v2** adds `revisions` (`[noteId+version], noteId`). `updateNote` snapshots the prior
  row only when title/body/tags actually change (pin/move/archive churn is ignored), then prunes
  to the retention limit. `destroyNote`/`emptyTrash` clear the note's history; `listRevisions`
  decrypts snapshots newest-first via the existing note key/AAD (no new crypto contract).
- `shared/revisions.ts` holds the 10/25/50/unlimited limit in `localStorage`; changing it in
  Settings → Sürüm geçmişi prunes every note immediately (`pruneAllRevisions`).
- `NoteHistory.tsx` panel in `NoteEditor`: list by version + time, read-only preview modal, and
  **restore** that re-applies title/body/tags as a new head version (current notebook/pin/archive
  preserved). Device-local, never synced. Rollback documented in PROJECT_MAP.md.
- `noteRepo.test.ts` (+4 cases → 66 unit); `history:` e2e flow (17 e2e total).

---

## Phase 7 — Multiple vaults (XL, question before starting)

Only if actually needed; this reshapes the data model.

- Key `vaultStore` / `vaultRepo` / `notesStore` by `vaultId`; Dexie **v3** adds a `vaultId`
  index to `notes`/`meta` (or one DB per vault). A vault switcher in the UI; per-vault sync
  config; create/unlock/adopt flows become vault-scoped; auto-sync runs per active vault.
- Big blast radius (crypto session, quick-unlock binding, sync state, trash). Treat as its
  own project and confirm the requirement first.

**Done:** switch between two vaults without restart; lock state, sync, and RAM notes are
isolated per vault.

---

## Suggested order / checkpoints

1. Phase 1 (PWA + live Drive) — de-risks the core promise.
2. Phase 2 (i18n) — everything after ships localized.
3. Phases 3–5 — visible product value, low risk.
4. Phase 6 — history; needs a migration.
5. Phase 7 — only on confirmed need.
