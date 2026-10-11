# Installation — from source to running extension (free path)

## Requirements

- Node.js ≥ 20 (developed/tested on 22) and npm — both free.
- Google Chrome / Chromium ≥ 120 (Manifest V3 + side panel). Other Chromium browsers
  (Edge, Brave) generally load unpacked extensions too but are untested by this build.
- No domain. No hosting. No accounts. No keys.

## Build & load

```bash
cd veriscope
npm install        # all dependencies are free/open-source (see DEPENDENCIES.md)
npm run check      # typecheck + lint + 81 unit tests + build + dist audit  ← recommended
npm run build      # (included above) produces dist/ with manifest, icons, bundles
```

Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. **Load unpacked** → select the `veriscope/dist` folder (the one containing `manifest.json`).
4. Pin the VeriScope icon (puzzle piece → pin) — optional but handy.
5. First launch opens the **welcome/options tab** — it explains the promises and limits;
   pick *strict offline* there if you want zero requests from the start.

Verify it works:

- Select any factual sentence on a news article → right-click → **Verify selection with VeriScope**
  → the side panel opens with the claim, its extraction, verdict *Unverified* (until you add
  evidence), and candidate search links. That end-to-end flow with no errors = install good.
- `chrome://extensions` should show **no red “errors” button** on the card.

## Rebuilding after edits

`npm run build` again, then hit ↻ (refresh) on the extension card. The `dist/` output is the
loadable unit — you can zip `dist/` and share it; any Chromium user can unpack it the same way
(local distribution costs nothing).

## Publishing notes (truthful)

- Chrome Web Store listing requires Google's **one-time $5 developer registration** — that is a
  *store* cost, not a product cost; self-hosting via ZIP + Load unpacked is free forever.
- Firefox supports WebExtensions but with differences (e.g. side panel API) — not in scope here.
- Keep `optional_host_permissions` untouched if you fork: they are what keep persistent access
  at zero.

## Optional power-ups (each independently optional)

**Ollama (local model analysis):** install Ollama, pull a model (`ollama pull llama3.1:8b`),
enable in Settings, and click *Check local runtime*. If the health check fails with a CORS-type
error, relaunch with `OLLAMA_ORIGINS=chrome-extension://* ollama serve`. Expect several GB of
RAM; the extension works fully without any of this.

**Local engine (scanned-PDF OCR, offline transcription):** see `local-engine/README.md`
(localhost-only FastAPI, token-authenticated).

**Host permissions for automated API lookups:** when you first run an online verification,
Chrome may ask you to grant access to the API domains (they're `optional_host_permissions`).
Declining is supported: automated lookups then honestly report “blocked”, and manual search
links keep working. Many of the APIs also answer via CORS without the grant; the extension
never depends on that.
