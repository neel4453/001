# Troubleshooting

| Symptom | Cause & fix |
|---|---|
| “This page does not allow script access” | Expected on `chrome://`, Web Store, some secured pages. Use **Verify selection** (paste) instead. |
| Context menu item missing | Reload the extension (↻ on its card); menus re-register on update. Older Chrome (<114 for `sidePanel.open`): click the toolbar icon popup → “Open workspace”. |
| “blocked (CORS/permission)” on automatic lookups | You declined the optional host grant, or offline mode is on. Toggle online mode; re-run; check Settings → retrieval toggles. |
| Everything says *Unverified — insufficient evidence* | That is the honest state when nothing was assessed: open the manual search links, add sources, mark supports/contradicts → the verdict updates. In offline mode this is *expected* for fresh claims. |
| Search link lands on a homepage | `searchUrl` templates are labeled “not live-verified”; use the site's own box, and optionally fix `sources.json` + `accessStatus` (SOURCE_POLICY workflow). |
| Scanned PDF yields “no text layer” | Install/enable the optional local engine (local OCR). Nothing is uploaded, ever. |
| Ollama health check fails (CORS) | Start Ollama with `OLLAMA_ORIGINS=chrome-extension://*`. Also ensure mode ≠ strict offline (offline blocks even localhost). |
| Microphone button does nothing | `allowCloudSpeech` is off by default (privacy) — enable it in Settings if acceptable, or use transcript import. Mic permission prompt → allow for the extension. |
| Transcript garbled | Web Speech is online & error-prone; verify names/numbers against recordings; treat as draft text. |
| Popup/side panel blank | Console for errors (chrome://extensions → Inspect views); rebuild (`npm run build`) after editing; check `dist/` selected (not the repo root) when loading unpacked. |
| High memory on huge PDFs | pdf.js needs RAM for large docs; use the local engine path or split the file; the app caps text to 240 k chars and chunks where possible. |
| After renaming the product, old settings missing? | The legacy-prefix migration runs once per storage area; ensure `package.json.productName` changed and rebuilt; `chrome.storage.local` still holds the old namespace (`intruth/…`) until migrated — Settings → Data shows usage. |
