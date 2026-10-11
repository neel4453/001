# Roadmap — where the adapter registry should grow

Short, honest list; each item = one file in `src/core/adapters/` + registry flip + tests.

1. **Fact-check result feeds** — IFNC members' public sitemaps/RSS (poll for new fact-checks
   mentioning the claim's entities) as *read-only discovery*, then link into their evidence.
2. **UN ODS resolution fetcher** — document-symbol navigation (odss_utils-style) for
   `S/RES/181`-class references; verify access rules first; degrade to links when blocked.
3. **EUR-Lex / India Code deep links** — search APIs (both publish documented free search
   endpoints) with document-snippet extraction.
4. **World Bank / UNSD stats adapters** — indicator lookup (SDG API, `api.worldbank.org/v2`)
   for numeric country claims: fetch → compare → propose `contextualizes` evidence only with
   explicit “indicator ≠ claim wording” caveats.
5. **Citation resolution service** — detect citation-style strings in documents, resolve via
   Crossref/OpenAlex bibliography matching (already partially present), mark unmatched.
6. **Wayback diff highlighter** — fetch two snapshots' text (web.archive.org provides it)
   and diff captions/numbers for silent-edit checks.
7. **EU RepriV/exif-quality deep media pack** — wrap free CLIs (imgseek not permitted;
   `c2pa-tools`, `exiftool`) behind the local engine with clear install steps.
8. **Multilingual claim extractors** — language detection + per-language splitter rules;
   the deterministic core is designed for it (no model lock-in).
9. **Reviewer mode** — optional local sqlite (via engine) storing community verdict annotations
   keyed by claim hash — local-first, never sync without an explicit, documented endpoint.
10. **Firefox/Edge compatibility pass** — side panel polyfill layer + `browser.*` adapter;
    Web Speech differences documented per browser.

Anti-goals (per spec, kept forever): scraping login-walled platforms, paid API dependencies,
server-side verdicts, bundling multi-GB models, “AI certainty” framing.
