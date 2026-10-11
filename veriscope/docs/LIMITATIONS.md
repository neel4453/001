# Limitations — read me before trusting (or distrusting) anything

VeriScope is honest by construction; here is exactly what it cannot do, so nobody is misled
by the interface.

## Verification reality

1. **“No evidence found” ≠ false.** Unverified verdicts mean retrieval+assessment didn't
   settle it. The product never converts absence into a claim of falsehood.
2. **It cannot read what won't be read.** Paywalls, login walls (X, Instagram, TikTok),
   PDFs served to scrapers, frames inside cross-origin iframes, and protected pages
   (Web Store, `chrome://`) are off-limits by design — the tool says so and hands you the
   manual path.
3. **Verdicts are evidence-relative, time-relative, and wording-relative.** The evidence
   matrix reflects what was retrievable *now*; sources get stale; quotes can be paraphrased
   into non-equivalence; heuristics (lexical/numeric) catch *candidates*, not all of reality.
   Numbers in tables, PDFs with weird spacing, or claims in languages other than English
   degrade extraction quality (sentence splitter/regex are English-first).
4. **Automated relation suggestions are provisional.** Strong numeric matches still require
   you to confirm; the UI labels every auto-suggestion accordingly, and verdicts built only
   on suggestions are explicitly caveated.
5. **Confidence is an explainable weighting, not probability.** Documented factors, no
   calibration claims. An LLM's self-reported certainty (local Ollama path) is never trusted
   as a score and never auto-sets verdicts.
6. **Independence clustering is conservative-but-imperfect**: near-verbatim syndication is
   detected; heavily rewritten press-release laundering can slip through. Registrable-domain
   approximation treats unusual public suffixes imperfectly (documented in code).

## Feature-specific ceilings

7. **Live speech:** microphone capture ≠ system/tab audio (documented browser split);
   Chrome's SpeechRecognition routes audio to Google — VeriScope makes that opt-in and
   provides offline transcript import; real-time verification cannot keep up with fast debate
   (queues run while transcription continues; late results marked as such).
8. **Image/video:** no bundled AI deepfake detector (they are fallible and heavy); EXIF/XMP
   presence is a *signal*, absence proves nothing; reverse-image search is user-clicked;
   C2PA validation is a heuristic pointer here — full manifests need `c2pa-tools` (free).
9. **Documents:** scanned PDFs need the optional local OCR (Tesseract) — OCR misreads
   numbers/names; every OCR finding carries that warning; DOCX field codes/complex numbering
   can mis-extract (flagged as extraction-error candidates); “no findings” ≠ “no problems”.
10. **UN/treaty/legal depth:** resolutions & treaties are searched via catalog links +
    Wikipedia/OpenAlex-style metadata; the extension cannot verify ODS/treaty-body content
    without you opening it. It will never present a legal conclusion; ambiguous-clause flags
    are wording heuristics for human review.
11. **Fact-check discovery:** existing fact-checks are found via Google's Fact Check
    Explorer and member sites' own searches (user-clicked); there is no free machine-readable
    IFCN index API the extension is allowed to hammer, so this is link-level, not result-level.

## Build-environment constraints (full transparency for this delivery)

12. Automated checks completed here: TypeScript strict, ESLint, 81 unit tests, production
    build, static dist audit (manifest, paths, no remote code, offline fetch spy). NOT
    performed here: loading into a real Chrome (no browser binary in the sandbox), live
    fetching of registry websites (network restricted), Ollama/engine smoke tests. The
    acceptance checklist in `ACCEPTANCE_TESTS.md` is exactly for closing that gap on your
    machine — expect first-run to be the first true browser test.
13. Registry `accessStatus` labels: honestly `not-checked` for every entry (see SOURCE_POLICY).
    Search URL templates follow common conventions; if one lands on a homepage, say so in an
    issue (or fix the entry) — the UI already discloses the uncertainty to users.

## If you need certainty you won't find here

For high-stakes decisions (health, law, elections, finance), VeriScope is the *front door* to
primary sources — read the linked documents, re-run with fresh data, and consult professionals.
A tool that would promise more is the one you shouldn't trust.
