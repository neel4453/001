# Security notes — design, threat model, and residual risk

## Permissions & why each is needed (minimum set)

| Permission | Why | Not used for |
|---|---|---|
| `activeTab` | Per-gesture read of the page you asked about (scan/select/frame) | persistent browsing access — there is none |
| `scripting` | One-shot injection of the read-only text extractor | modifying pages; injected code never writes state beyond snapshot/restore of nodes it removed for measurement (restored immediately) |
| `contextMenus` | “Verify selection” et al. | — |
| `storage` + `unlimitedStorage` | Your investigations, on-device | — |
| `sidePanel` | The workspace surface | — |
| `optional_host_permissions` (API origins, localhost) | Only requested when you enable online retrieval/local AI; refused = graceful manual fallback | never requested silently; zero in offline mode |

No `tabs`, no `<all_urls>`, no `webRequest`, no cookies, no history APIs.

## Content Security Policy

`script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'` — no remote code,
no inline script in any extension page; icons/worker/fonts/assets all bundled at build time.

## Threat: hostile web pages / documents (prompt & script injection)

- Text from pages/PDFs/transcripts is handled **only as inert strings**: `textContent`
  extraction, React's escaping on render (no `innerHTML` of untrusted content anywhere in
  the codebase — `grep innerHTML` returns nothing), DOM never re-inserted.
- Iframes/shadow content are skipped; extracted text cannot carry attributes/handlers.
- LLM path: passages are wrapped between data markers and the system prompt explicitly forbids
  treating them as instructions; model output is **display-only analysis** — it never sets a
  verdict relation, permission, or storage key by itself (only user clicks do).
- URL discipline: every navigation/`tabs.create` goes through `isSafeHttpUrl`
  (http/https only; `javascript:`, `data:`, `file:` rejected) — both in background and
  direct-render fallbacks; malformed citations are *findings*, not executed.

## Threat: local services

- Ollama & the companion engine are opt-in, localhost URLs (defaults `127.0.0.1`/`localhost`),
  and **all requests — even to localhost — pass the offline gate**, so a user who wants zero
  network syscalls (strict sandbox sense) has it. The engine additionally requires a bearer
  token, refuses any unconfigured origin, rate-limits, size-caps, binds loopback only, and
  returns honest 503s when a dependency is missing (no silent fallbacks that fake success).
- CORS failures from Ollama's default localhost policy are documented with the explicit
  `OLLAMA_ORIGINS` opt-in a user must type — the extension never attempts to evade it.

## Threat: malicious input to the analysis engine

- Length caps (240 k chars/sentence stream, 60 claims, 640-char snippets), bounded
  nested-loop windows for doc checks (≤150 lookahead sentences), abortable jobs (cancel
  buttons + AbortController timeouts) — long-article and regex-DoS style inputs degrade
  gracefully (spec §23), not catastrophically.
- PDFs/DOCX are parsed by library code with no eval; a corrupt file produces an error finding.
- `structuredClone` is used only on our own storage payloads.

## Threat: our own supply chain

- MIT-licensed deps only (see DEPENDENCIES.md), pinned majors, no postinstall scripts
  introduced beyond Vite's optional esbuild; `npm audit` is run at release time (results in
  release notes; free tier — not a guarantee).

## Residual risks (honest list)

- A future Chrome Web Store build *should* re-run this audit per release; automated checks
  here cover this repository state only.
- DOM selectors for AI sites break silently when providers redesign — extraction then returns
  nothing (safe direction) and the manual flow is documented.
- `similarity()` is a word-overlap heuristic; sophisticated paraphrase laundering of a press
  release can evade duplicate clustering (independence remains conservative, never generous).
- Local OCR/transcription quality depends entirely on the user's installed tooling.
- This environment could not run a live Chrome for penetration exercises; browser-level
  verification is an explicit acceptance-test list (ACCEPTANCE_TESTS.md) for installers.
