# Feature matrix — implemented · partial · not implemented

Statuses are deliberately conservative. “Implemented (tested)” = automated tests in this repo
cover it. “Implemented (needs browser)” = code complete, unit-tested where possible, but its
browser-API surface awaits the acceptance checklist. Nothing is marked done because it “should” work.

| # | Capability (spec §) | Status | Evidence / notes |
|---|---|---|---|
| 1 | MV3 build: manifest, icons, CSP, unpacked load | Implemented (needs browser) | `npm run build` + `check-dist.mjs` pass; real Chrome load = acceptance A1 |
| 2 | Popup + side panel + options + theme + glass/neo UI | Implemented (tested where logic) | React, light/dark/system, a11y focus/labels, reduced-motion; visual QA manual |
| 3 | Context menus (selection/page/image/link) + panel handoff | Implemented (needs browser) | wiring unit-safe; gesture/`sidePanel.open` in browser |
| 4 | Selected-text verification | Implemented | tests: claims extraction on selection-shaped input; flow in UI |
| 5 | Atomic claim extraction + classification (opinion/prediction/…) | Implemented (tested) | claims.test, dates-units.test |
| 6 | Deduplication + passage spans + context-missing | Implemented (tested) | claims.test, verify spans in UI |
| 7 | Source registry (236 sources, 15 cats, schema validation) | Implemented (tested) | registry.test (schema, uniqueness, policy) |
| 8 | Manual search links, “not performed” labeling | Implemented (tested) | searchlinks.test; UI component test |
| 9 | Automated key-free retrieval adapters (9) | Implemented (tested w/ mocked fetch) | openalex/crossref/wikipedia/pubmed/europepmc/wayback/gdelt/restcountries/semanticscholar; live responses need real network = acceptance B |
| 10 | Evidence matrix: supports/contradicts/contextualize + independence + syndication clustering | Implemented (tested) | evidence.test, verdicts.test |
| 11 | 12-verdict system + explainable confidence + caveats | Implemented (tested) | verdicts.test |
| 12 | Corrections workflow (annotate/flag/add/remove/re-run w/ change log) | Implemented (tested via export) | export.test; no silent rewrites by construction |
| 13 | History + save + delete + export-all + wipe | Implemented (tested) | storage.test |
| 14 | Strict offline mode: zero requests (single gate) | Implemented (tested) | offline.test spies fetch |
| 15 | Online/offline indicators & honest labels | Implemented | headers everywhere, mode chips |
| 16 | Page scan (activeTab, readable text, claim list, verify selection of claims) | Implemented (needs browser) | injection + restore; error path for protected pages |
| 17 | AI-answer verification (adapters + manual fallback) | Partial — inherently brittle | ChatGPT/Claude/Gemini/Perplexity/DeepSeek selectors; DOM drift expected; fallback always works; untested against live sites (network) |
| 18 | Documents: PDF/TXT/MD/HTML/DOCX/CSV/JSON local parsing | Implemented (PDF parse needs browser) | parser tests (txt/md/csv/json/docx via fflate fixture); pdf.js path needs Chrome runtime |
| 19 | Document checks (dates/numbers/dup/terminology/citations/legal ambiguity/outdated) | Implemented (tested) | documents.test incl. DOI offline format vs Crossref lookup modes |
| 20 | Scanned-PDF OCR | Partial | requires optional local engine (Tesseract); extension never uploads |
| 21 | Media: EXIF/XMP/GPS local read + C2PA hints | Implemented (needs browser) | exifr wrapper; no fake “AI detector” |
| 22 | Reverse image/video: user-clicked links, frame capture, report | Partial by design | APIs are ToS/paywall-gated; link-outs + capture + guided report shipped |
| 23 | Live speech: mic + timestamps + queue + background verdicts + report | Partial — documented ceilings | Web Speech opt-in (cloud caveat), import path tested; tab/system audio per browser rules; whisper.cpp via engine |
| 24 | MUN/politician mode (committee/country/period/doc-ref, resolution/treaty lexicon) | Implemented | context fields feed queries & entity extraction; UN doc retrieval stays manual-first |
| 25 | Academic/retraction checks (DOI, retraction flags, corrections) | Implemented (tested) | crossref/OpenAlex flags in evidence notes |
| 26 | Health rigor (stronger-evidence note, no diagnosis) | Implemented | topic gating + warnings; explicit “not medical advice” framing |
| 27 | Legal doc review (ambiguity flags ≠ unlawfulness) | Implemented (tested) | checks.test; human-review labels mandatory in UI |
| 28 | Optional Ollama local AI (refine-only, health check) | Implemented (needs your Ollama) | never sets verdicts; offline blocks it too |
| 29 | Optional local engine (OCR/transcribe) skeleton | Provided (not executed here) | FastAPI, token, loopback, honest 503s; pip install + run per README |
| 30 | Settings & privacy controls (limits, wipe, usage, per-source enable) | Implemented (tested) | storage.test + UI |
| 31 | Exports (MD report incl. change log; JSON bundle; session report) | Implemented (tested) | export.test |
| 32 | Rename-safety (brand configurable, legacy storage migration) | Implemented (tested) | config + storage migration test |
| 33 | Deepfake/AI-image classifier bundled | **Not implemented — deliberate** | unreliable alone, heavy; pointers + metadata heuristics instead (spec approves) |
| 34 | Scraping paywalled/social platforms | **Not implemented — deliberate** | ToS/CORS/login; manual-first policy (§18) |
| 35 | Cross-browser (Firefox/Safari) | Not in scope | MV3+sidePanel Chrome-centric; may partially load elsewhere |
