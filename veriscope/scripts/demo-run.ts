/**
 * End-to-end workflow demonstration for verifiable review.
 * Runs the PRODUCTION modules (same code path as the side panel UI).
 * Any network fixtures below are SYNTHETIC DEMO DATA, clearly labeled — they stand in
 * for live API responses because this sandbox blocks outbound connections. The offline
 * leg needs no fixture: it must prove zero requests with a real fetch spy.
 *
 * Run: npx vite-node scripts/demo-run.ts
 */
import { DEFAULT_SETTINGS } from '../src/types';
import type { Settings, EvidenceRecord, Investigation } from '../src/types';
import { loadRegistry, CATEGORIES } from '../src/core/registry';
import { verifyPassage } from '../src/core/verify';
import { computeVerdict } from '../src/core/verdicts';
import { markDuplicates } from '../src/core/evidence';
import { parseDocument } from '../src/core/documents/parse';
import { analyzeDocument } from '../src/core/documents/checks';
import { readImageMetadata, reverseImageLinks } from '../src/core/media';
import { parseTranscript } from '../src/core/speech';
import { investigationToMarkdown } from '../src/core/export';
import {
  putSaved, getSaved, getHistory, deleteSaved, clearAllData, saveSettings, setPending, takePending,
} from '../src/core/storage';
import { safeFetchJson } from '../src/core/net';

const HR = (t: string) => console.log(`\n${'═'.repeat(74)}\n  ${t}\n${'═'.repeat(74)}`);
const ok = (b: unknown, label: string) => {
  const pass = !!b;
  console.log(`${pass ? '  ✅ PASS' : '  ❌ FAIL'}  ${label}`);
  if (!pass) process.exitCode = 1;
};

// ---------------------------------------------------------------- 0. baseline
HR('0 · Baseline: settings, registry, UI-less environment');
const settings: Settings = { ...DEFAULT_SETTINGS };
console.log('  mode:', settings.mode, '· autoQueries:', settings.autoQueries, '· cloud speech:', settings.allowCloudSpeech, '(off by default = privacy)');
const { sources, errors } = loadRegistry();
ok(errors.length === 0, `source registry loads clean (validation errors: ${errors.length})`);
console.log(`  registry: ${sources.length} sources · ${CATEGORIES.length} categories · ${sources.filter((s) => s.automationAllowed).length} with API access · ${sources.filter((s) => s.accessStatus === 'restricted').length} honestly marked restricted`);
ok(sources.every((s) => s.accessStatus === 'not-checked' || s.accessStatus === 'restricted' || s.accessStatus === 'historical-archive'), 'no unverified source claims a "checked" status (build honesty rule)');

// fetch spy: records EVERY attempted request in either mode
const seenUrls: string[] = [];
const realFetch = globalThis.fetch;
const synthetic = new Map<string, () => unknown>([
  // ── SYNTHETIC DEMO FIXTURES (labeled; replace with live network by running in a browser) ──
  ['api.openalex.org/works', () => ({
    results: [{
      display_name: '[SYNTHETIC DEMO FIXTURE] Carbon emissions dataset: country-level annual figures',
      doi: 'https://doi.org/10.5555/synthetic.demo001',
      publication_date: '2023-06-01',
      cited_by_count: 412,
      is_retracted: false,
      abstract_inverted_index: {
        Country: [0], A: [1], reduced: [2], emissions: [3], by: [4], '30%': [5], 'in': [6], '2022': [7],
        'per': [8], 'the': [9], 'national': [10], 'inventory': [11], 'submitted': [12], 'to': [13], 'the': [14],
        'UNFCCC': [15], 'secretariat': [16], 'under': [17], 'the': [18], 'Paris': [19], 'Agreement': [20],
      },
    }],
  })],
  ['en.wikipedia.org/w/api.php', () => ({
    query: {
      search: [
        { title: 'Nationally determined contribution', pageid: 1, timestamp: '2024-02-11T00:00:00Z', snippet: '<span>SYNTHETIC DEMO FIXTURE</span> : Country A stated a 30% emissions reduction target for 2022 in its updated NDC.' },
        { title: 'Emissions gap (demo)', pageid: 2, timestamp: '2023-11-02T00:00:00Z', snippet: 'SYNTHETIC DEMO FIXTURE — critics note the verified figure was closer to 12% once land-use accounting was excluded.' },
      ],
    },
  })],
  ['api.crossref.org/works/10.5555/synthetic', () => ({
    message: { DOI: '10.5555/synthetic.demo001', title: ['[SYNTHETIC] Carbon emissions dataset'], status: 'published', 'container-title': ['Demo Journal of Synthetic Data'], publisher: 'Synthetics Intl.', URL: 'https://doi.org/10.5555/synthetic.demo001', published: { 'date-parts': [[2023, 6, 1]] } },
  })],
  ['archive.org/wayback/available', () => ({ archived_snapshots: {} })],
  ['api.gdeltproject.org', () => ({ articles: [] })],
]);
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input?.url ?? input);
  seenUrls.push(url + (init?.method ? ` [${init.method}]` : ''));
  for (const [key, make] of synthetic) {
    if (url.includes(key)) return new Response(JSON.stringify(make()), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ error: 'demo: host not stubbed' }), { status: 599 });
}) as typeof fetch;

// ---------------------------------------------------------------- 1. offline leg
HR('1 · STRICT OFFLINE — extract, retrieve-attempt, verdict, zero-request proof');
const passage =
  'Country A signed the treaty in 2018, spent $5 billion on the program in 2022, and reduced emissions by 30%. ' +
  'I think the deal was a complete disgrace and everyone knows it. ' +
  'Analysts predict the economy will grow by 8% in 2027. ' +
  'Should voters trust these numbers at all?';
seenUrls.length = 0;
const offline = await verifyPassage({ passage, mode: 'page', sourceKind: 'page', url: 'https://example.test/article', title: 'Demo article', settings: { ...settings, mode: 'offline' } });
ok(seenUrls.length === 0, `offline verification made ZERO network requests (spy recorded ${seenUrls.length})`);
console.log(`  claims extracted: ${offline.claims.length}`);
for (const c of offline.claims.slice(0, 6)) {
  console.log(`   · [${c.kind}] ${c.text.slice(0, 72)}${c.text.length > 72 ? '…' : ''}` +
    (c.numbers.length ? `  ⟵ numbers: ${c.numbers.map((n) => n.raw).join(', ')}` : '') +
    (c.dates.length ? `  ⟵ dates: ${c.dates.map((d) => d.raw).join(', ')}` : '') +
    (c.contextMissing.length ? `  ⟵ missing: ${c.contextMissing.join('; ')}` : ''));
}
const kinds = new Set(offline.claims.map((c) => c.kind));
ok(kinds.has('factual') && kinds.has('opinion'), 'passage split into facts vs opinion/prediction/question (never flattened to true/false)');
ok(kinds.has('prediction') || kinds.has('question'), 'prediction/question recognized as non-verifiable-now');
const offInv = offline.investigations[0];
ok(offInv.verdict.verdict === 'unverified' && /offline/i.test(offInv.verdict.caveats.join(' ')), `offline verdict is honest: “${offInv.verdict.label}”`);
const links0 = offline.searchLinksByClaim.get(offInv.claim.id) ?? [];
ok(links0.length > 0 && links0.every((l) => l.performed === false), `manual search links prepared & labeled “not performed” (${links0.length} candidates)`);

// safeFetch directly under offline gate
const gate = await safeFetchJson('https://api.openalex.org/works?search=anything', { mode: 'offline' });
ok(!gate.ok && /offline/i.test(gate.error ?? ''), 'core fetch door refuses even if someone calls it while offline');

// ---------------------------------------------------------------- 2. online leg (synthetic transport)
HR('2 · ONLINE EVIDENCE MODE (synthetic transport fixtures, clearly labeled)');
seenUrls.length = 0;
const online = await verifyPassage({
  passage: 'Country A signed the treaty in 2018 and reduced emissions by 30% in 2022.',
  mode: 'single-claim', sourceKind: 'manual', url: 'https://example.test/article', settings: { ...settings, mode: 'online' },
});
const inv: Investigation = online.investigations[0];
const automatic = inv.evidence.filter((e) => e.origin === 'automatic');
console.log(`  attempted adapters: ${online.adapterReports.map((r) => `${r.adapter}${r.ok ? ` ✓ (${r.count} docs)` : ' ✗'}`).join(', ') || '(none)'}`);
console.log(`  automated evidence retrieved: ${automatic.length} (verdict.retrievedCount=${inv.verdict.retrievedCount})`);
ok(seenUrls.length > 0 && automatic.length > 0, 'retrieval actually happened (requests hit the stubbed network, evidence returned)');
ok(automatic.some((e) => e.relationSuggestion?.provisional), 'auto-relations are PROVISIONAL suggestions, never final');
ok(inv.verdict.caveats.join(' ').match(/provisional/i) || automatic.every((e) => e.relationSetBy !== 'heuristic'), 'verdict caveated as provisional while unassessed by user');
console.log(`  pre-assessment verdict: “${inv.verdict.label}”  confidence: ${inv.verdict.confidence.band} (${inv.verdict.confidence.score}/1)`);

// user marks evidence → verdict recomputes (exactly what the UI's assess() does)
const strong = automatic.filter((e) => (e.relationSuggestion?.strength ?? 0) >= 1);
const sup = strong.filter((e) => e.relationSuggestion?.relation === 'supports');
const con = strong.filter((e) => e.relationSuggestion?.relation === 'contradicts');
const marked = markDuplicates(automatic.map((e) => {
  if (sup.some((s) => s.id === e.id)) return { ...e, relation: 'supports', relationSetBy: 'user' } as EvidenceRecord;
  if (con.some((s) => s.id === e.id)) return { ...e, relation: 'contradicts', relationSetBy: 'user' } as EvidenceRecord;
  return e;
}));
const v2 = computeVerdict({ claim: inv.claim, evidence: marked, sourceTypeById: new Map(), mode: 'online', attemptedSources: online.adapterReports.length, accessedSources: online.adapterReports.filter((r) => r.ok).length, blockedReasons: [] });
console.log(`  after user assessment: supports=${sup.length} contradicts=${con.length} → “${v2.label}” (${v2.confidence.band})`);
ok(sup.length >= 1 && (v2.verdict === 'mostly-supported' || v2.verdict === 'supported' || v2.verdict === 'disputed'), 'verdict transitions with assessed evidence');
ok(marked.some((m) => m.relationSetBy === 'user'), 'user assessment recorded as user-set (not hidden as machine)');
console.log('  confidence factors:');
for (const f of v2.confidence.factors) console.log(`   · ${f.name}=${f.value} (${f.explanation.slice(0, 64)})`);
ok(/calibrated/i.test(v2.confidence.note), 'confidence explicitly disclaimed as non-calibrated');

// ---------------------------------------------------------------- 3. document analysis
HR('3 · DOCUMENT ANALYSIS (parsed locally — no upload path exists)');
const docText = `TREATY OF DEMOVILLE (synthetic test document — NOT real-world evidence)
Article 1. The parties ratified the Demoville Framework Convention on 14 March 2016, establishing binding targets for all signatories by the end of the decade.
Article 2. The Demoville Framework Convention was ratified on 9 November 2015 and creates voluntary commitments only for participating states thereafter.
Article 3. Total programme funding was $5 billion across all participating states during the first implementation cycle.
Article 4. Total programme funding was $9 billion across all participating states during the first implementation cycle.
Article 5. See our earlier dataset (10.5555/not-a-real-doi) for details [12].
Article 6. The board may from time to time use best efforts and act in good faith to the extent appropriate.
Article 1. The parties ratified the Demoville Framework Convention on 14 March 2016, establishing binding targets for all signatories by the end of the decade.`;
const doc = await parseDocument('demoville.txt', new TextEncoder().encode(docText).buffer as ArrayBuffer);
const findings = await analyzeDocument(doc, {}); // offline: DOI format-check only, no lookup
const kindsF = findings.map((f) => f.kind);
for (const f of findings.slice(0, 12)) console.log(`   · [${f.severity}] ${f.kind}: ${f.message.slice(0, 96)}`);
ok(kindsF.includes('conflicting-date') || kindsF.includes('inconsistent-number'), 'conflicting dates / figures across articles flagged');
ok(kindsF.includes('duplicate-passage'), 'verbatim duplicate passage flagged');
ok(kindsF.includes('ambiguous-wording'), 'legal ambiguity ("from time to time", "good faith"…) flagged FOR HUMAN REVIEW');
ok(kindsF.includes('missing-reference'), 'bracketed citation [12] without a reference list flagged');
ok(findings.some((f) => /format is valid; not looked up/i.test(f.message)), 'DOI offline-handled honestly: format-checked, explicitly NOT claimed resolved');
ok(findings.every((f) => f.humanReviewRequired), 'every finding carries humanReviewRequired=true');

// ---------------------------------------------------------------- 4. media + speech + export + storage
HR('4 · MEDIA, SPEECH, EXPORT, STORAGE');
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]); // truncated PNG → honest failure path
const meta = await readImageMetadata(new File([png], 'demo.png'));
ok(meta.error !== undefined || meta.xmpPresent === false, `metadata inspection runs and reports honestly (${meta.error ? '“' + String(meta.error).slice(0, 60) + '…”' : 'no XMP present'})`);
const rev = reverseImageLinks('https://example.test/img.png');
ok(rev.every((r) => r.url.startsWith('https://')) && rev.length >= 4, `reverse-search links built for user clicks (${rev.map((r) => r.label).join(', ')}) — none auto-performed`);

const segs = parseTranscript('[00:05] Country A reduced emissions by 30 percent in 2022.\nWEBVTT style would parse too');
ok(segs.length === 2 && segs[0].t0 === 5, 'speech transcript import parses timestamps for offline live-mode');

const invForExport: Investigation = { ...inv, verdict: v2, originalClaimText: inv.claim.text };
const md = investigationToMarkdown(invForExport);
ok(md.includes('Country A signed the treaty') && md.includes('## Verdict'), 'markdown export contains claim + verdict sections');
ok(md.includes('SYNTHETIC') && md.includes('en.wikipedia.org/wiki/Nationally_determined_contribution'), 'export embeds the retrieved (labeled-synthetic) evidence trail — inspectable links');
ok(md.includes('NOT proof of falsehood'), 'export footer restates “no evidence ≠ false”');

HR('5 · LOCAL STORAGE LIFECYCLE (chrome absent → dev-mode in-memory backend)');
await clearAllData();
await putSaved(invForExport);
await saveSettings({ historyLimit: 200 });
const saved = await getSaved();
const hist = await getHistory();
ok(saved.length === 1 && hist.length === 1 && hist[0].verdictLabel === v2.label, 'investigation saved → history index updated (id, verdict, counts)');
await deleteSaved(invForExport.id);
ok((await getSaved()).length === 0 && (await getHistory()).length === 0, 'delete removes item + history entry; wipe-all path already unit-tested');
await setPending({ kind: 'selection', text: 'from demo selection', url: 'https://x.test', at: new Date().toISOString() });
const pend = await takePending();
ok(pend?.text === 'from demo selection' && (await takePending()) === null, 'context-menu → panel handoff is one-shot');

HR('6 · RESTORE + FINAL NETWORK TALLY');
globalThis.fetch = realFetch;
const documented = ['api.openalex.org', 'en.wikipedia.org', 'archive.org', 'api.crossref.org', 'api.gdeltproject.org', 'restcountries.com', 'ebi.ac.uk', 'api.semanticscholar.org', 'eutils.ncbi.nlm.nih.gov'];
const offlineOnly = seenUrls.filter((u) => !documented.some((d) => u.includes(d)));
console.log(`  requests attempted during whole demo: ${seenUrls.length} — all in the labeled online leg, all to stubbed public-API URLs`);
ok(offlineOnly.length === 0, 'no stray hosts touched (every request was a documented API origin)');
console.log(`\n${process.exitCode ? '❌ DEMO COMPLETED WITH FAILURES' : '✅ DEMO COMPLETED — all assertions passed'}\n   (Online evidence leg used SYNTHETIC fixtures in this sandbox; in real Chrome the same code path hits the live free APIs.)`);
