# VaultNote

Zero-server, end-to-end encrypted, cross-device note app. Data lives in the user's own
Google Drive `appDataFolder`; only ciphertext leaves the device. Local-first: works fully
offline and syncs when a connection returns.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill VITE_GOOGLE_CLIENT_ID (optional for local-only use)
npm run dev
```

Without a Google client id the app still works fully offline; the Drive button stays disabled.

## Scripts

```bash
npm run dev      # Vite dev server
npm run build    # typecheck + production build
npm test         # Vitest
npm run lint     # oxlint
```

## Google Drive setup

1. Google Cloud Console → enable **Google Drive API**.
2. Create an OAuth client id (Web application) with the `drive.appdata` scope; add your
   origins (`http://localhost:5173`, plus native/PWA origins for builds).
3. Put the id in `.env.local` as `VITE_GOOGLE_CLIENT_ID`.

## Security model

- Master passphrase → Argon2id → KEK wrapping a random Vault Key (DEK).
- Notes are encrypted with per-note HKDF keys, AES-256-GCM, with AAD binding (note id + version).
- The passphrase and plaintext never touch disk or the network; the DEK lives in memory only
  and is zeroed on lock.

See [PROJECT_MAP.md](./PROJECT_MAP.md) for architecture and layout.
