import type { CategoryId, Claim, ClaimKind, ClaimSpan } from '../types';
import { splitSentences } from './sentences';
import { extractDates } from './dates';
import { extractNumbers } from './units';
import { extractEntities } from './entities';
import { normalizeText, similarity, uid } from './util';
import { LIMITS } from '../config';

/**
 * Deterministic claim extraction pipeline:
 *   sentences -> clause/list atomization -> classification -> context enrichment
 *   -> dedupe/merge.
 * No model, no network: the same rules run offline and online, and the unit tests
 * pin the behavior. A local LLM (optional) can post-refine; it never replaces this.
 */

// ---------------------------------------------------------------- classification

const OPINION_MARKERS =
  /\b(I think|I believe|in my opinion|my view|arguably|clearly the best|worst|the best|the worst|beautiful|ugly|terrible|wonderful|disgraceful|shameful|impressive|remarkable|disappointing|morally wrong|morally right|should be illegal|obviously|frankly|honestly|unfortunately|fortunately|sadly|joyful)\b/i;
const SHOULD = /\b(should|ought to|must|need(s)? to|has to|it is time)\b/i;
const PREDICT =
  /\b(will|won't|shall|going to|predicts?|forecast(s|ing)?|projects?|expects? to|likely to|expected to|may reach|could rise|could fall|is set to|on track to|by 20\d\d (?:the|it|they))\b/i;
const HYPOTHETICAL = /\b(if\b.*\b(would|could|might)\b|imagine|suppose|hypothetically|in a world where)\b/i;
const SATIRE_HINTS = /\b(satire|satirical|parody|not a real|for entertainment purposes|The Onion|Beaversat|fnord)\b/i;
const QUEST_START = /^(who|what|when|where|why|how|is|are|was|were|do|does|did|can|could|would|should|will)\b/i;
export const NUM_WORDS = /\b(all|every|none|no one|nobody|always|never|100%|zero)\b/i;


export function classifyClaim(text: string): ClaimKind {
  const t = text.trim();
  if (/[?]$/.test(t) || QUEST_START.test(t)) return 'question';
  if (SATIRE_HINTS.test(t)) return 'satire-candidate';
  if (HYPOTHETICAL.test(t) && !/\b(said|states?|announced)\b/i.test(t)) return 'hypothetical';
  const hasQuote = /^["'“‘]/.test(t) || /\bsaid\b/i.test(t);
  if (!hasQuote && SHOULD.test(t) && !OPINION_MARKERS.test(t) && /\bwe\b|\byou\b|government|should\b/i.test(t)) {
    return 'recommendation';
  }
  if (OPINION_MARKERS.test(t) && !/\d/.test(t)) return 'opinion';
  // Predictions about the future without verifiable-now anchor.
  if (PREDICT.test(t) && !/\b(said|stated|according to)\b/i.test(t)) {
    const dates = extractDates(t);
    const thisYear = new Date().getFullYear();
    if (dates.every((d) => d.year == null || d.year > thisYear) && !/\b(was|were|did|happened|took place|occurred|last year)\b/i.test(t)) {
      return 'prediction';
    }
    if (dates.length === 0 && PREDICT.test(t)) return 'prediction';
  }
  if (!/\b(is|are|was|were|has|have|had|signed|spent|reduced|increased|created|won|lost|died|born|passed|voted|said|states?|reported|produced|built|launched|elected|approved|rejected|granted|paid|reached|fell|rose)\b/i.test(t) &&
      !/\d/.test(t)) {
    // Fragment with no verb and no number: not a self-standing claim.
    if (t.split(/\s+/).length < 6) return 'unknown';
  }
  if (!/\d|\bis\b|\bare\b|\bwas\b|\bwere\b|\bsaid\b|\bhas\b|\bnot\b/i.test(t) && OPINION_MARKERS.test(t)) {
    return 'opinion';
  }
  if (/\b(opinion|believe|feel)\b/i.test(t) && !/\d/.test(t)) return 'opinion';
  return 'factual';
}

// ---------------------------------------------------------------- atomization

const VERBISH =
  /\b(signed|spent|reduced|increased|raised|cut|grew|declined|approved|rejected|passed|adopted|voted|won|lost|elected|announced|launched|created|built|granted|paid|reported|said|stated|claimed|produced|issued|reached|fell|rose|doubled|tripled|banned|imposed|extended|ratified|withdrew|left|joined|funded|allocated|recorded|hit|reached)\b/i;

/**
 * Split "A signed X in 2018, spent $5bn in 2022, and reduced emissions by 30%"
 * into three coordinated clauses sharing the subject. Only applied when the parts
 * look like independent assertions (each with a verbish token or a number), so we
 * never shred ordinary lists of nouns.
 */
export function splitAtoms(sentence: string): string[] {
  let parts: string[] = [sentence.trim()];
  const splitBy = (sep: RegExp, min = 2) => {
    const next: string[] = [];
    for (const p of parts) {
      const pieces = p.split(sep).map((s) => s.trim()).filter(Boolean);
      if (pieces.length >= min && pieces.every((q) => q.length > 18 && (VERBISH.test(q) || /\d/.test(q)))) {
        next.push(...pieces);
      } else {
        next.push(p);
      }
    }
    parts = next;
  };
  splitBy(/;\s*/);
  // ", and <verb>" / ", but <verb>" / ", while <verb>"
  for (let guard = 0; guard < 4; guard++) {
    const before = parts.length;
    parts = parts.flatMap((p) => {
      const m = p.match(/,\s+(and|but|while|whereas|although)\s+/i);
      if (!m || m.index == null) return [p];
      const left = p.slice(0, m.index).trim();
      const right = p.slice(m.index + m[0].length).trim();
      if (
        left.length > 18 && right.length > 18 &&
        (VERBISH.test(right) || /\d/.test(right)) &&
        (VERBISH.test(left) || /\d/.test(left))
      ) {
        // Re-attach subject when right half dropped it ("...and reduced emissions").
        const subj = left.match(/^((?:[A-Z][\w'.-]*\s?){1,3}|(?:The|A|An)\s+[^,]{2,40}?)\s/);
        const rightFull = subj && !/^[A-Z0-9"']/.test(right) ? `${subj[1]} ${right}` : right;
        return [left, rightFull];
      }
      return [p];
    });
    if (parts.length === before) break;
  }
  // If the sentence begins with a quoting clause "X said: '...' '": keep attached.
  return parts.filter((p) => p.length > 10);
}

// ---------------------------------------------------------------- topics

const TOPIC_RULES: { topic: CategoryId; re: RegExp }[] = [
  { topic: 'un-mun', re: /\b(UN|United Nations|Security Council|General Assembly|resolution|treaty|convention|protocol|Geneva|veto|peacekeeping|SDG|refugee|UNSC|UNGA|ICC|ICJ|NATO|EU|ASEAN|African Union|parliamentary|diplomatic|sanctions|ceasefire|disarmament)\b/i },
  { topic: 'health', re: /\b(vaccine|virus|disease|cancer|diabetes|mortality|life expectancy|HIV|H1N1|pandemic|epidemic|outbreak|hospital|drug|medic|clinical trial|WHO|health)\w*/i },
  { topic: 'environment', re: /\b(emissions?|climate|warming|carbon|deforestation|recycl|ocean|glacier|temperature|drought|flood|cyclone|renewable|solar|wind power|biodiversity|ozone|sea level)\b/i },
  { topic: 'finance', re: /\b(GDP|inflation|interest rate|budget|deficit|fiscal|stock|market|bank|tax|bonds?|reserve|investment|trade deficit|exports?|imports?|currency|rupee|dollar|euro)\b/i },
  { topic: 'law', re: /\b(law|act\b|section \d|supreme court|judgment|verdict|constitution|amendment|bill\b|court|legal|rights? under|article \d|penal|IPC|BNSS|BNN|Bharatiya)\b/i },
  { topic: 'country-statistics', re: /\b(census|population|literacy|birth rate|death rate|per capita|median age|urban population|demographic|poverty rate|unemployment rate)\b/i },
  { topic: 'politics', re: /\b(election|vote[ds]?|ballot|president|prime minister|minister|governor|senator|congress|MP\b|Lok Sabha|Rajya Sabha|campaign|party|oposition|opposition|impeach)\b/i },
  { topic: 'cybersecurity', re: /\b(CVE|vulnerabilit|malware|breach|ransomware|phishing|exploit|cyberattack|patch|CISA|CERT)\b/i },
  { topic: 'academic', re: /\b(study|research paper|journal|DOI|peer[- ]reviewed|meta[- ]analysis|retract|preprint|arXiv|PubMed|citation)\b/i },
];

export function detectTopics(text: string): CategoryId[] {
  const found = new Set<CategoryId>(['news', 'government']);
  for (const r of TOPIC_RULES) if (r.re.test(text)) found.add(r.topic);
  return [...found];
}

// ---------------------------------------------------------------- missing context

export function detectMissingContext(claim: Pick<Claim, 'text' | 'numbers' | 'dates'>): string[] {
  const missing: string[] = [];
  const t = claim.text;
  const hasTimeAnchor = claim.dates.length > 0 || /\b(today|yesterday|this week|last (year|month|week)|current|recent)\b/i.test(t);
  if (/\b(current(ly)?|now|today|this year|latest|recent(ly)?|record)\b/i.test(t) && !hasTimeAnchor) {
    missing.push('time anchor (claim says "current/latest" without a date)');
  }
  if (!extractEntities(t).countries.length && /\b(?:he|she|they|it|this country|the country|the president|the minister)\b/i.test(t)) {
    missing.push('who/which country the pronouns refer to');
  }
  const pct = claim.numbers.filter((n) => n.kind === 'percent');
  if (pct.length && !/\b(?:of|from|among|out of|increase[d]? (?:from|to)|share of)\b/i.test(t)) {
    missing.push('base/baseline of the percentage');
  }
  if (/\b(?:doubled|tripled|halved|cut in half|increased \d+ times)\b/i.test(t) && !claim.dates.length) {
    missing.push('period the change refers to');
  }
  return missing;
}

// ---------------------------------------------------------------- main

export interface ExtractOptions {
  /** Cap after which remaining sentences are dropped with a warning. */
  maxClaims?: number;
  /** If true, keep non-factual kinds (opinions...) — they still get their own verdict labels. */
  keepNonFactual?: boolean;
}

export function extractClaims(passage: string, opts: ExtractOptions = {}): { claims: Claim[]; dropped: number } {
  const max = opts.maxClaims ?? LIMITS.maxClaimsPerScan;
  const limited = passage.length > LIMITS.maxPassageChars;
  const text = limited ? passage.slice(0, LIMITS.maxPassageChars) : passage;
  const sentences = splitSentences(text);
  const claims: Claim[] = [];

  for (const s of sentences) {
    const atoms = splitAtoms(s.text);
    for (const atom of atoms) {
      const kind = classifyClaim(atom);
      const factualish = kind === 'factual' || kind === 'prediction' || kind === 'unknown';
      if (!opts.keepNonFactual && !factualish && kind !== 'opinion' && kind !== 'question') {
        // satire/hypothetical/recommendation are surfaced too (they get explicit verdicts)
        if (kind !== 'satire-candidate' && kind !== 'hypothetical' && kind !== 'recommendation') continue;
      }
      const span = locateSpan(text, atom, s.start);
      const ent = extractEntities(atom);
      const claim: Claim = {
        id: uid('claim'),
        text: atom,
        originalPassage: passage,
        kind,
        isQuotation: /^["'“‘]|said\b|\bstated\b|\baccording to\b/i.test(atom),
        numbers: extractNumbers(atom),
        dates: extractDates(atom),
        entities: [...new Set([...ent.countries, ...ent.orgs, ...ent.resolutions, ...ent.treaties, ...ent.people])],
        topics: detectTopics(atom),
        spans: [span],
        contextMissing: [],
      };
      claim.contextMissing = detectMissingContext(claim);
      claims.push(claim);
      if (claims.length >= max) return { claims: dedupeClaims(claims), dropped: sentences.length };
    }
  }
  const deduped = dedupeClaims(claims);
  return { claims: deduped, dropped: limited ? 1 : 0 };
}

function locateSpan(text: string, atom: string, hint: number): ClaimSpan {
  const head = atom.slice(0, 48);
  let idx = text.indexOf(head, Math.max(0, hint - 8));
  if (idx < 0) idx = text.indexOf(head);
  if (idx < 0) return { start: hint, end: Math.min(text.length, hint + atom.length) };
  return { start: idx, end: idx + atom.length };
}

/**
 * Dedupe near-identical claims (same sentence scanned twice, overlapping atoms).
 * Merges spans, keeps first occurrence as canonical text.
 */
export function dedupeClaims(claims: Claim[]): Claim[] {
  const out: Claim[] = [];
  for (const c of claims) {
    const norm = normalizeText(c.text);
    const dup = out.find(
      (o) =>
        normalizeText(o.text) === norm ||
        (o.kind === c.kind && similarity(o.text, c.text) >= 0.85),
    );
    if (dup) {
      for (const sp of c.spans) if (!dup.spans.some((d) => d.start === sp.start)) dup.spans.push(sp);
      dup.contextMissing = [...new Set([...dup.contextMissing, ...c.contextMissing])];
      continue;
    }
    out.push(c);
  }
  return out;
}
