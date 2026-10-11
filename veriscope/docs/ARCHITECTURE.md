# VeriScope architecture

## Topology

```
┌────────────────────────────── user's Chrome profile ──────────────────────────────┐
│  popup.html ─┐                                                         ┌────────── │
│  sidepanel ─┼── chrome.runtime messaging ── background (MV3 SW) ───▶│ tabs.create│ │
│  options.html┘            │                       │                  │ scripting  │ │
│                           │                       │  executeScript   │ captureTab │ │
│                           ▼                       ▼ (read-only, text) └────────────┘ │
│                 core/ services          the web page (activeTab grant per gesture)   │
│   ┌─────────────────────────────────────────────┐                                   │
│   │ claims.ts  dates.ts units.ts evidence.ts     │   deterministic, tested, offline │
│   │ verdicts.ts registry.ts searchlinks.ts       │                                  │
│   │ documents/ media.ts speech.ts export.ts      │                                  │
│   └───────────────┬─────────────────────────────┘                                   │
│                   ▼                                                                   │
│   net.ts  ◀── THE ONLY NETWORK DOOR (asserts mode==='online' before fetch)           │
│      │                                                                                │
│      ├── public key-free APIs (OpenAlex, Crossref, Wikipedia, PubMed,                │
│      │    EuropePMC, Wayback, GDELT, REST Countries, Semantic Scholar)                │
│      ├── optional Ollama (http://localhost:11434, user enabled)                       │
│      └── optional local engine (http://127.0.0.1:8756, token)                         │
│                                                                                       │
│  storage.ts → chrome.storage.local (settings, history, saved investigations)         │
│            → chrome.storage.session (one-shot context-menu → panel handoff)          │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

## Module responsibilities & why they're split this way

1. **`core/claims.ts`** — pipeline §5: `sentences.ts` (conservative splitter) → atom
   splitter (coordinated-clause rules) → classifier (`factual | opinion | prediction |
   question | recommendation | hypothetical | satire-candidate | unknown`) → context
   extractors (`dates.ts`, `units.ts`, `entities.ts`) → topic mapping to registry
   categories → dedupe/merge with span union. Pure functions; identical online/offline;
   pinned by unit tests. Rationale: model-free extraction is inspectable, offline-capable,
   and zero-cost — matching the product's core principle.
2. **`core/evidence.ts`** — independence keys (registrable-domain approximation),
   syndication clustering (snippet Jaccard ≥ 0.8 / same-domain ≥ 0.72), provisional
   relation suggestion (numeric alignment / topical overlap + negation lexicon),
   source-quality & freshness weights. Suggestions are typed `provisional: true` — the
   type system literally cannot mark a heuristic “final”.
3. **`core/verdicts.ts`** — twelve verdicts from explicit rules over *user-assessed*
   evidence counts, independence, freshness, agreement, retrieval completeness and
   missing context; produces factor explanations + caveats. Confidence is a documented
   weighting, never a calibrated probability; `unverified` has distinct text for
   “we tried and found nothing” vs “you did not perform the manual searches”.
4. **`core/adapters/`** — per-source retrieval plugins implementing one contract:
   `runAdapter(id, query, settings) → {ok, docs[] | error}`. Failures (429/403/CORS/
   timeout) return honest errors surfaced verbatim in UI + exports. New adapters: add
   file → map entry → registry JSON `adapter` field (see ROADMAP).
5. **`core/net.ts`** — the single fetch door (GET+POST helpers + `gatedFetch` for
   multipart). `assertOnline` throws before any network call in offline mode. Tests
   spy `globalThis.fetch` and prove zero invocations.
6. **`core/storage.ts`** — namespaced persistence, legacy-prefix migration (renames),
   capped history with derived index, one-shot session handoff, quota readout.
7. **background SW** — context menus, `chrome.sidePanel` wiring, `executeScript` with
   *self-contained* reader functions (serialized; read `textContent` only), frame
   capture via `captureVisibleTab`, URL-scheme-guarded `tabs.create`. No polling,
   no alarms, wakes only on user gestures.
8. **UIs** — popup (launcher), side panel (workspace: Verify/Page/Docs/Media/Live/
   Sources/History/Settings), options (settings + first-run onboarding). Shared design
   system in `styles/base.css`; components in `ui/components/`; state hook in
   `sidepanel/useWorkbench.ts` (every mutation appends to `changeLog`).
9. **local-engine (optional)** — localhost FastAPI for OCR/transcription; token +
   explicit CORS + rate limit + size cap; 503s instead of pretending.

## Data-flow of an investigation

`capture (selection/paste/page/doc/speech)` → `verifyPassage()` → per claim: pick
sources (categories/topics/disabled) → build search links (never “performed”) →
auto-adapters (online+enabled) → evidence records (dup-marked, suggestions) →
`computeVerdict()` → UI assessment loop (user relation marks, add/remove, annotate,
flag) → persist (`putSaved` → history index) → export (MD/JSON with change log).

## Security boundaries

- Page content = untrusted data. Only `textContent` strings are read; nothing is ever
  HTML-parsed into UI or used as instructions. Local-model prompts explicitly wrap the
  passage as data and forbid instruction-taking (defense-in-depth, see SECURITY.md).
- URLs: `isSafeHttpUrl` allow-list at every open/navigation point.
- CSP `script-src 'self'`; no remote code/assets/fonts; icons generated at build time.
- `optional_host_permissions` for API origins ⇒ grant dialog on demand; offline mode
  never requests them (and code-gates even when granted).
