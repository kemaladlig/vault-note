# VaultNote — Agent Guide

Read this before changing anything. Architecture, layout, contracts, and the crypto
model live in [`PROJECT_MAP.md`](./PROJECT_MAP.md); this file is the working rules for
this repo and sits on top of the global engineering rules.

## What this is

Zero-server, local-first, end-to-end encrypted notes. Plaintext never leaves the
device; only ciphertext syncs to the user's Google Drive `appDataFolder`. Same codebase
ships as PWA and as a Capacitor native app.

## Commands (run these, don't guess)

- `npm run build` — typecheck + production build (must pass before "done")
- `npm test` — Vitest unit suite
- `npm run test:e2e` — Playwright smoke (needs `npx playwright install chromium` once)
- `npm run lint` — oxlint
- `npx cap sync android` — copy `dist/` + plugins into the native project

Quick fix (1–2 files): run the affected check. Feature/behavior change: build + lint +
test green. No green check, no done — report what you ran.

## Architecture rules

- **Vertical slices.** Each feature owns `src/features/<feature>/` and depends only on
  `src/shared/`, `src/components/ui/`, and `src/lib/`. Features never reach into another
  feature's internals; go through its store or a shared module.
- **Single registration point.** New features register through the existing store/hook,
  not by growing `if/else` chains in `App.tsx` / `AppShell.tsx`.
- **One source of truth for state.** Zustand stores own state; components read/derive.
  Never mirror state in two stores.
- **Design tokens only in `src/index.css`.** Never hardcode a color, radius, or duration
  in a component. Add a token, then use it.
- **Reuse primitives.** `src/components/ui/` already has modal, menu, popover, badge,
  kbd, spinner, toaster. Check there before writing a new control.
- **shadcn caveat.** Generated files may import `"cn"`; fix to `@/lib/utils`.
- Small files, one job. Comments explain why, not what. Delete dead code, don't comment
  it out. No decorative emojis in code.

## Crypto & data invariants (do not break)

- Key hierarchy: passphrase → Argon2id → **KEK** wraps a random **DEK**. Changing the
  passphrase re-wraps the DEK only — never re-encrypt notes.
- Per-note key = `HKDF-SHA256(DEK, info="vaultnote:note:<id>")`, AES-256-GCM.
- AAD binds context (`vaultnote:v2:note:<id>:<version>:<updatedAt>`; v1 without the timestamp is
  read-only, for rows sealed before it). Every seal uses a **fresh 12-byte IV**. Never reuse an IV.
- Anything that moves a note row's `updatedAt` without changing its content (trash, restore,
  mirroring a remote tombstone) **must re-seal via `restampNote`**, or the row stops opening.
- Sealed auxiliary docs: notebook tree `vaultnote:folders` (synced), smart views
  `vaultnote:views` (device-local, never synced), manifest `vaultnote:manifest`.
- Any change to a sealed document or AAD format is a **contract change**: bump/version it,
  keep open backward-compatible, and update `PROJECT_MAP.md` in the same commit.
- Locking wipes the DEK and clears decrypted notes from RAM; never persist plaintext.

## Security rules

- Plaintext, the passphrase, and the DEK never touch disk or the network. Sync only ever
  moves already-encrypted rows.
- Secrets come from env (`.env.local`, git-ignored). Never commit keys or client secrets.
- Validate/limit untrusted input at the boundary; never render raw user markup.
- Destructive ops (reset, destroy, empty trash) stay behind explicit confirmation.

## Git

- Worktree is shared: never discard, stash, or overwrite uncommitted work.
- One concern per commit; subject says why, body the consequence.
- Never push, force-push, or rewrite published history unless explicitly asked.
- Don't commit build output, caches, `dist/`, or `.env.local`.

## Sync/editing safety

- Editor writes a row only on genuine unsaved edits (`pending` ref logic in the notes
  view) so opening a note never bumps `updatedAt` and never clobbers a real edit.
- Sync is last-write-wins on `updatedAt` (version tie-break). Remote tombstones
  propagate. Preserve these semantics when touching the engine.

## Known gaps

- Real Drive sync has only run against `FakeDrive`; native OAuth deep-link and biometrics
  need a physical device.
- No CI. User-facing copy must go through `shared/i18n.ts` (`tr` default, `en`); never
  hardcode a string in a component.
