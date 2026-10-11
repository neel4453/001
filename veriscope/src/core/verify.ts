import type { Claim, ClaimSourceKind, EvidenceRecord, Investigation, Settings, SourceEntry } from '../types';
import { LIMITS } from '../config';
import { loadRegistry } from './registry';
import { buildSearchLinks, type SearchLink } from './searchlinks';
import { runAdapter, type FetchedDoc, type AdapterResult } from './adapters';
import { independenceKey, markDuplicates, suggestRelation } from './evidence';
import { computeVerdict, type VerdictInput } from './verdicts';
import { nowIso, uid } from './util';
import { extractClaims } from './claims';


/**
 * The main verification workflow (§5 of the spec), as a real pipeline:
 * capture → atoms → context → retrieve → inspect → compare → verdict → trail.
 * Retrieval completeness is tracked so the UI can never claim more than happened.
 */

export interface VerifyRequest {
  passage: string;
  mode: 'single-claim' | 'page' | 'ai-answer';
  sourceKind: ClaimSourceKind;
  url?: string;
  title?: string;
  documentName?: string;
  context?: { speaker?: string; committee?: string; country?: string; period?: string; documentRef?: string };
  settings: Settings;
}

export interface VerifyOutcome {
  claims: Claim[];
  investigations: Investigation[];
  searchLinksByClaim: Map<string, SearchLink[]>;
  droppedClaims: number;
  adapterReports: { adapter: string; ok: boolean; error?: string; note?: string; count: number }[];
}

function pickSources(claim: Claim, settings: Settings): SourceEntry[] {
  const { sources } = loadRegistry();
  const disabled = new Set(settings.sourcesDisabled);
  const active = sources.filter((s) => !disabled.has(s.id));
  const wanted = new Set(claim.topics);
  const scored = active
    .map((s) => {
      let score = 0;
      for (const c of s.categories) if (wanted.has(c)) score += 2;
      if (s.sourceType === 'fact-checker') score += 3;
      if (s.sourceType === 'primary') score += 2;
      if (s.sourceType === 'official-statistics') score += 2;
      if (s.sourceType === 'news') score += 1;
      if (s.sourceType === 'reference') score -= 1;
      return { s, score };
    })
    .sort((a, b) => b.score - a.score);
  const out = new Map<string, SourceEntry>();
  // API-backed sources are always candidates (the topic rules in adaptersFor() keep the
  // actual queries narrow); manual sources round it out to a capped, ranked set.
  for (const s of active) if (s.adapter) out.set(s.id, s);
  for (const x of scored.slice(0, 14)) out.set(x.s.id, x.s);
  return [...out.values()];
}

function adaptersFor(claim: Claim, sources: SourceEntry[], settings: Settings): string[] {
  if (!settings.autoQueries || settings.mode !== 'online') return [];
  const ids = sources.map((s) => s.adapter).filter((a): a is string => !!a);
  const out = new Set<string>();
  for (const id of ids) {
    if (id === 'openalex' || id === 'crossref' || id === 'semanticscholar' || id === 'europepmc') {
      if (claim.topics.includes('academic') || claim.topics.includes('health')) out.add(id);
    } else if (id === 'pubmed') {
      if (claim.topics.includes('health')) out.add(id);
    } else if (id === 'wikipedia' || id === 'gdelt' || id === 'wayback' || id === 'restcountries') {
      out.add(id);
    }
  }
  // Cap concurrency/traffic.
  return [...out].slice(0, 4);
}

export async function verifyPassage(req: VerifyRequest, onProgress?: (p: { step: string; done: number; total: number }) => void): Promise<VerifyOutcome> {
  const { claims, dropped } = extractClaims(req.passage, { keepNonFactual: true });
  const capped = claims.slice(0, LIMITS.maxClaimsPerScan);
  const searchLinksByClaim = new Map<string, SearchLink[]>();
  const investigations: Investigation[] = [];
  const adapterReports: VerifyOutcome['adapterReports'] = [];
  let i = 0;

  for (const claim of capped) {
    i++;
    onProgress?.({ step: `Investigating claim ${i}/${capped.length}`, done: i, total: capped.length });
    const sources = pickSources(claim, req.settings);
    const links = buildSearchLinks(
      sources.filter((s) => !s.adapter || s.retrievalMode === 'open-search-page' || !s.automationAllowed),
      claim,
    );
    searchLinksByClaim.set(claim.id, links);

    // automated retrieval (only in online mode with autoQueries; each call is gated in net.ts)
    const adapterIds = adaptersFor(claim, sources, req.settings);
    const results: AdapterResult[] = [];
    let attempted = adapterIds.length;
    if (adapterIds.length) {
      const queue = adapterIds.map((a) => () => runAdapter(a, buildAdapterQuery(claim, req), req.settings));
      results.push(...(await runWithConcurrency(queue, LIMITS.autoQueryConcurrency)));
    }
    // Wayback works on the SOURCE URL (page context), not the claim text.
    if (req.settings.autoQueries && req.settings.mode === 'online' && req.url && adapterIds.length < 4) {
      attempted += 1;
      results.push(await runAdapter('wayback', req.url, req.settings));
    }

    const evidence = toEvidence(claim, results, sources);
    const accessed = results.filter((r) => r.ok).length;
    const blocked = results.filter((r) => !r.ok).map((r) => `${r.adapter}: ${r.error}`);
    const verdict = computeVerdict({
      claim, evidence, sourceTypeById: new Map(sources.map((s) => [s.id, s])),
      mode: req.settings.mode, attemptedSources: attempted, accessedSources: accessed, blockedReasons: blocked,
    } satisfies VerdictInput);

    for (const r of results) adapterReports.push({ adapter: r.adapter, ok: r.ok, error: r.error, note: r.note, count: r.docs.length });

    investigations.push({
      id: uid('inv'),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      mode: req.settings.mode,
      status: evidence.length ? 'evidence-gathered' : 'draft',
      source: {
        kind: req.sourceKind as Investigation['source']['kind'],
        url: req.url, title: req.title, documentName: req.documentName,
        passageRef: claim.spans[0],
        ...req.context,
      },
      claim,
      originalClaimText: claim.text,
      annotations: [],
      evidence,
      verdict,
      changeLog: [{ at: nowIso(), what: 'Investigation created' }],
    });
  }

  return { claims: capped, investigations, searchLinksByClaim, droppedClaims: dropped, adapterReports };
}

function buildAdapterQuery(claim: Claim, req: VerifyRequest): string {
  const parts = [claim.text];
  if (req.context?.period) parts.push(req.context.period);
  if (req.context?.country) parts.push(req.context.country);
  if (req.context?.documentRef) parts.push(req.context.documentRef);
  return parts.join(' ').slice(0, 240);
}

function toEvidence(claim: Claim, results: AdapterResult[], sources: SourceEntry[]): EvidenceRecord[] {
  const out: EvidenceRecord[] = [];
  const byAdapterSource = new Map<string, SourceEntry>();
  for (const s of sources) if (s.adapter) byAdapterSource.set(s.adapter, s);
  for (const r of results) {
    if (!r.ok) continue;
    for (const doc of r.docs) {
      out.push(evidenceFromDoc(claim, doc, byAdapterSource.get(r.adapter), r.note));
    }
  }
  return markDuplicates(out);
}

export function evidenceFromDoc(claim: Claim, doc: FetchedDoc, source?: SourceEntry, note?: string): EvidenceRecord {
  return {
    id: uid('ev'),
    claimId: claim.id,
    sourceId: source?.id,
    publisher: domainOf(doc.url),
    domain: domainOf(doc.url),
    title: doc.title,
    url: doc.url,
    snippet: doc.snippet ? doc.snippet.slice(0, LIMITS.evidenceSnippetChars) : undefined,
    publishedAt: doc.publishedAt,
    accessedAt: nowIso(),
    origin: 'automatic',
    relation: 'unassessed',
    relationSetBy: null,
    relationSuggestion: suggestRelation(claim, doc),
    independenceKey: independenceKey(doc.url, source),
    notes: [
      doc.extra?.is_retracted ? '⚠ This work is flagged as RETRACTED by the indexing service.' : undefined,
      typeof doc.extra?.update_possible === 'string' ? String(doc.extra.update_possible) : undefined,
      note,
      doc.extra?.snapshot ? String(doc.extra.snapshot) : undefined,
      doc.extra?.retracted && typeof doc.extra.retracted === 'string' ? String(doc.extra.retracted) : undefined,
    ].filter(Boolean).join(' ') || undefined,
  };
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let idx = 0;
  const runners = new Array(Math.min(n, tasks.length)).fill(0).map(async () => {
    while (idx < tasks.length) {
      const my = idx++;
      out[my] = await tasks[my]();
    }
  });
  await Promise.all(runners);
  return out;
}

/** Re-run verification for an existing investigation, keeping user assessments. */
export async function rerunInvestigation(inv: Investigation, settings: Settings): Promise<{ investigation: Investigation; links: SearchLink[] }> {
  const req: VerifyRequest = {
    passage: inv.claim.text, mode: 'single-claim', sourceKind: inv.source.kind,
    url: inv.source.url, title: inv.source.title, documentName: inv.source.documentName,
    context: { speaker: inv.source.speaker, committee: inv.source.committee, country: inv.source.country, period: inv.source.period, documentRef: inv.source.documentRef },
    settings,
  };
  const outcome = await verifyPassage(req);
  const next = outcome.investigations[0];
  // Preserve user-assessed evidence (spec: corrections must not be silently lost).
  const userEv = inv.evidence.filter((e) => e.relationSetBy === 'user');
  if (userEv.length) {
    next.evidence = markDuplicates([...next.evidence, ...userEv.map((e) => ({ ...e, claimId: next.claim.id }))]);
    next.changeLog.push({ at: nowIso(), what: `Re-run preserved ${userEv.length} user-assessed evidence item(s)` });
  }
  next.verdict = computeVerdict({
    claim: next.claim,
    evidence: next.evidence,
    sourceTypeById: new Map(loadRegistry().sources.map((s) => [s.id, s])),
    mode: settings.mode,
    attemptedSources: next.verdict.retrievedCount,
    accessedSources: next.verdict.retrievedCount,
    blockedReasons: [],
  });
  next.verdict.caveats.push('This investigation was re-run; the original verdict is in the change log.');
  next.changeLog.push({ at: nowIso(), what: `Verdict recomputed: ${next.verdict.label}` });
  return { investigation: next, links: outcome.searchLinksByClaim.get(next.claim.id) ?? [] };
}
