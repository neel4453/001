# VeriScope

**A free, privacy-first, evidence-first fact-checking Chrome extension.**

VeriScope helps you investigate factual claims you meet online — posts, articles, AI
answers, documents, speeches, statistics — by extracting them into atomic checkable
claims, gathering and organizing evidence from public, key-free sources, comparing
supporting against contradicting evidence, explaining a verdict with visible factors,
linking every claim to its sources, and **admitting uncertainty when the evidence does
not settle it.**

> Extract the claim. Find the evidence. Compare competing evidence. Explain the verdict.
> Show the sources. Admit uncertainty.

VeriScope is deliberately **not** a green/red “TRUE/FALSE” machine. No evidence found is
reported as *Unverified*, never as “false”. Heuristics are always labeled as heuristics;
search links the extension prepared are labeled “not yet performed” until you open them.

## Hard promises (enforced by code + tests, not marketing)

- 💸 **Zero recurring cost.** No paid APIs, no keys required for core function, no server,
  no domain, no hosting. `npm run build` → `Load unpacked`.
- 🔒 **Strict offline mode makes zero network requests** — a single gated fetch path
  (`src/core/net.ts`) that unit tests prove is a no-op offline.
- 🚫 **No fabricated evidence, citations, or verdicts.** Retrieval failures surface as
  honest errors; “no result” verdicts explain themselves.
- ️ **No telemetry, no analytics, no ads, no accounts.** History is `chrome.storage.local` only.
- 📄 Documents/images are parsed **locally** (pdf.js, fflate, exifr). Never uploaded.
- 🧾 Registry honesty: every source's live URL is `not-checked` in this build (the dev
  environment had restricted network) and marked as such — see `docs/SOURCE_POLICY.md`.

## Features (working in this build)

| Area | What ships |
|---|---|
| Popup + Side panel | Compact launcher + full investigation workspace (8 sections), glass/neomorphic UI, light/dark/system themes |
| Claim engine | Sentence/atom segmentation, classification (fact vs opinion/prediction/question/satire…), entity & context extraction (dates, numbers, units, currencies, countries, UN resolutions/treaties), dedupe, missing-context detection |
| Evidence | 236-source registry (15 categories, search templates, statuses), candidate manual-search links (clearly “not performed”), automated key-free API lookups (OpenAlex, Crossref, Wikipedia, PubMed, Europe PMC, Wayback, GDELT, REST Countries, Semantic Scholar), retraction & correction flags, duplicate-syndication clustering, independence keys |
| Verdicts | All 12 verdict labels, explainable confidence factors (explicitly *not* calibrated), caveats, provisional-heuristic labeling, user assessment loop (supports / contradicts / context) |
| Pages | On-demand `activeTab` scan, AI-answer adapters (ChatGPT/Claude/Gemini/Perplexity/DeepSeek) + manual fallback, claim-to-passage highlighting |
| Documents | PDF/TXT/MD/HTML/DOCX/CSV/JSON parsed locally; conflicting-date, number-mismatch, duplicate-passage, terminology-drift, citation/DOI, missing-reference, ambiguous-legal-wording, outdated-stat findings with spans & pages; optional local OCR via companion engine |
| Media | Local EXIF/XMP/GPS/software inspection (exifr), C2PA-hint inspection + pointer to free validators, user-clicked Lens/TinEye/Bing/Wayback/WeVerify links, video frame capture (visible tab), exportable report |
| Live speech | Microphone transcription (Web Speech — opt-in, cloud caveat), transcript import (VTT/SRT/`[mm:ss]`, works offline), timestamped segments, background claim queue with running verdicts, session report export |
| Modes | 🔒 strict offline / 🌐 free online evidence — visibly labeled everywhere; optional Ollama local model (refine-only, never auto-verdicts); optional localhost Python engine (OCR/transcription) |
| Data | Save/delete/export (Markdown + JSON), change log on every edit (no silent rewrites), flag-a-verdict workflow, delete-all, history index, storage usage readout |
| Security | Read-only DOM extraction as plain text, URL scheme allow-list, prompt-injection posture (page/doc text is never treated as instructions; system prompts to local models forbid it), CSP `script-src 'self'`, no remote code |

**See `docs/FEATURE_MATRIX.md` for the honest implemented / partial / not-implemented list,
and `docs/LIMITATIONS.md` for what browser/permission reality prevents anyone from promising.**

## Quick start (2 minutes)

```bash
git clone <this repository>
cd veriscope
npm install
npm run build          # vite build + service worker + icons + manifest + dist audit
```

1. Open `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select the `veriscope/dist` folder.
3. Pin VeriScope. Right-click any selected text → *Verify selection*, or open the side
   panel (⋯ → VeriScope) and paste a claim.

Tests & checks: `npm run check` (typecheck, lint, 81 unit tests, build+audit).
Full install guide: **docs/INSTALLATION.md**.

## Layout

```
veriscope/
├── manifest.json (generated → dist/), popup/sidepanel/options HTML+React (Vite, TS)
├── src/
│   ├── background/        MV3 service worker (menus, activeTab injection, panel)
│   ├── content/           self-contained injected page readers (text only)
│   ├── core/              claims, dates, units, evidence, verdicts, adapters,
│   │                      net gate, storage, export, documents, media, speech
│   ├── data/sources.json  the 236-source registry (generated & validated)
│   ├── styles/base.css    glassmorphism + neomorphism design system
│   └── ui/                popup, side panel (8 tabs), options — React
├── tests/                 vitest suite (81 tests: extraction → verdicts → offline…)
├── local-engine/          optional FastAPI localhost OCR/speech companion
└── docs/                  ARCHITECTURE, PRIVACY, SECURITY, SOURCE_POLICY,
                           INSTALLATION, LIMITATIONS, FEATURE_MATRIX,
                           ACCEPTANCE_TESTS, TROUBLESHOOTING, ROADMAP, DEPENDENCIES
```

## Renaming & branding

The product name comes from `package.json → productName` and is injected at build time;
stored settings auto-migrate between namespaces (the project's former name “InTruth” is
handled as a legacy prefix automatically). Nothing else needs editing to rename.
*Trademark note: “VeriScope” is provisional; no availability search was performed — verify
before publishing anywhere.*

## Costs

Building, running, and sharing this extension costs nothing. Publishing to the Chrome Web
Store would require Google's one-time developer registration fee — optional; local
distribution (this repository, a ZIP of `dist/`) is free.

## License

MIT — see `LICENSE`. Third-party dependency licenses: `docs/DEPENDENCIES.md`.
