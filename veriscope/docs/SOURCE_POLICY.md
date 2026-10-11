# Source policy — how the registry behaves, honestly

## The registry

`src/data/sources.json` (generated & schema-validated by `scripts/gen-sources.mjs`; JSON is the
maintained artifact). 236 entries across the 15 categories the spec requires (fact-checking,
UN/MUN, government, politics, country statistics, academic, news, social media, images/video,
health, environment, law, finance, cybersecurity, reference). Each entry: `id, name, url,
searchUrl (+{query} template or null), searchUrlVerified, categories[], countries[],
sourceType, retrievalMode, accessStatus, apiKeyRequired, paidServiceRequired,
automationAllowed, notes, lastChecked`.

## Statuses & what this build claims

`not-checked | website-verified | search-page-verified | public-document-access-verified |
api-integration-verified | restricted | unavailable | historical-archive`.

**Everything is `not-checked` (lastChecked: null) in this build** — with two honest exceptions:
entries whose notes/behavior we could reason about from public documentation are labeled
`restricted` (login/paywall/ToS-gated: X, Instagram, FT, TikTok…) or `historical-archive`
(CIA World Factbook, discontinued 2026 — never treated as current data). The network
environment that built this project could not reach those sites to test them, and the project
rules forbid claiming untested integrations. **Maintainers: verify URLs periodically, then
upgrade `accessStatus` and set `lastChecked` — the UI surfaces these labels verbatim.**

Search-URL templates (e.g. WordPress `?s=`, `?q=`) follow the target sites' documented/common
conventions and carry `searchUrlVerified: false`; if a template lands on a homepage, the UI
already labels it as such — no search is ever claimed from merely generating a link
(`performed: false` is in the data model).

## Retrieval philosophy (spec §18)

- Manual-first: candidate links per source, opened only by user action, never presented as
  completed searches.
- Automated retrieval only for a small set of genuinely free, key-less public APIs (the
  adapter list), with topic gating so we never hammer them; per-query caps; honest
  429/403/error passthrough; no scraping of paywalls, logins, or ToS-prohibited content;
  robots/ToS respected by design (official JSON APIs and user-navigation only).
- Duplicate syndication is *demoted*, not counted (evidence.ts clustering) — five sites
  repeating one press release remain one independent source.
- `apiKeyRequired/paidServiceRequired` are schema-enforced: the registry test fails the build
  if any entry demands payment. Free-with-key services (YouTube API, CORE, Unpaywall-style)
  stay link-only and say so in `notes`.
- Source *classification* (primary / official statistics / academic / fact-checker / news /
  reference / social) feeds confidence weighting — a reference site can never outweigh a
  primary document.

## Adding sources (registry workflow)

Edit `scripts/gen-sources.mjs` table (or the JSON directly), rerun `node scripts/gen-sources.mjs`
if via script, run tests (schema + uniqueness + policy validation), verify the live site
manually when you can, then set `accessStatus`/`lastChecked`.
