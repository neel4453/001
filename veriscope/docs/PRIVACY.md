# Privacy policy — VeriScope (plain language, complete)

VeriScope has no servers, no accounts, no analytics, no ads. This is the entire data story.

## Where your data lives

| Data | Where | Notes |
|---|---|---|
| Settings | `chrome.storage.local` | Namespaced by app name; auto-migrated across renames |
| Saved investigations & evidence | `chrome.storage.local` | Your browser profile only; never synced by us |
| Context-menu → panel handoff | `chrome.storage.session` | Cleared when the browser session ends; one-shot read |
| Documents / images you analyze | RAM of the extension page | Parsed locally (pdf.js, fflate, exifr); never uploaded |
| Speech transcripts | RAM (+ whatever you export) | See STT caveat below |

You can delete any item (History → Delete), or everything (History → Delete all), and export
everything (JSON/Markdown) at any time.

## Every network request the extension can make — exhaustively

**Strict offline mode: none.** Enforced in one auditable place (`src/core/net.ts`, proven by
tests). This includes no requests to: us (we have no endpoint), update servers, or third parties.

**Online evidence mode** (only after you keep it enabled; each call is metadata or search,
made when you press *Verify*):

| Purpose | Endpoint (HTTPS) | What leaves your machine | Key/account |
|---|---|---|---|
| Scholarly metadata | `api.openalex.org/works?search=<query>[&mailto=…]` | the search query text (claim + entities); optional polite email you configure | none |
| DOI/paper metadata & retraction links | `api.crossref.org/works…` | query or DOI you pasted | none |
| Wikipedia search | `en.wikipedia.org/w/api.php…` | query text | none |
| PubMed abstracts | `eutils.ncbi.nlm.nih.gov/entrez/eutils…` | query text | none |
| Europe PMC | `ebi.ac.uk/europepmc/webservices…` | query text | none |
| Wayback availability | `archive.org/wayback/available?url=<page-url>` | the URL of the page you are checking | none |
| GDELT news index | `api.gdeltproject.org/api/v2/doc/doc?query=…` | query text | none |
| REST Countries | `restcountries.com/v3.1/name/<country>` | a country name | none |
| Semantic Scholar (optional) | `api.semanticscholar.org/graph/v1/paper/search?…` | query text | none |

**Only when YOU click a link:** the “Manual searches” list, DuckDuckGo fallback, and every
source's homepage/search page open in normal browser tabs — that is your browser visiting
those sites like any link you follow; the extension performs and claims nothing there.

**Optional Ollama:** `http://localhost:11434` on your own machine (your text stays local,
but it is a network call to a local process — disabled under strict offline).
**Optional local engine:** `http://127.0.0.1:8756` (localhost, token-gated).

## Things to actually understand (no fine-print games)

1. **Online queries contain your claim text.** Do not paste confidential claims into online
   mode; use strict offline mode (local analysis + sources *you* supply) for that.
2. **Browser speech recognition is not offline.** Chrome's Web Speech API is implemented via
   Google's service. VeriScope keeps microphone transcription **off until you opt in**, labels
   it clearly, and offers transcript import (fully local) instead.
3. **The `activeTab` page scan** reads the visible text of the current tab *at your request*
   into the extension for local analysis. Nothing is sent anywhere automatically; content is
   read as plain text only (scripts/frames are skipped and never executed).
4. **Wayback lookups send the page URL** (not its content) so archived snapshots can be compared.
5. **Search-engine links reveal your query to that engine** when you open them — that's a browser
   visit you initiated.
6. **No telemetry.** Not “minimized” — there is no code path that reports anything to us, and we
   ship no analytics libraries.

## Sharing & selling

There is no data flow that could sell your data: we collect none, store none off-device, and
the source is available for audit (MIT). If you publish investigations or exports yourself,
that's on your side of the screen.

## Children / sensitive use

VeriScope provides no diagnoses, no legal conclusions, and must not be used as sole basis for
high-stakes decisions; health & legal modes always require primary sources + human review.
