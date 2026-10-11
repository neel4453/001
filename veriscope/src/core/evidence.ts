import type { Claim, EvidenceRecord, RelationSuggestion, SourceEntry } from '../types';
import { registrableDomain, similarity, normalizeText } from './util';
import { compareNumbers, extractNumbers } from './units';

/**
 * Evidence analysis. Everything here is transparent and deterministic so tests can
 * pin it. Auto-relations are ALWAYS provisional suggestions; a verdict computed from
 * suggestions alone carries an explicit caveat. User assessments override suggestions.
 */

export function independenceKey(url: string, source?: SourceEntry): string {
  if (source) return `src:${source.id}`;
  try {
    return registrableDomain(url);
  } catch {
    return 'unknown';
  }
}

/**
 * Duplicate-source detection: five sites repeating one press release must not count
 * as five confirmations. We cluster by identical/near-identical snippet OR by the
 * same aggregator domain; `duplicateOf` marks non-canonical members.
 */
export function markDuplicates(records: EvidenceRecord[]): EvidenceRecord[] {
  const byKey = new Map<string, EvidenceRecord[]>();
  for (const r of records) {
    if (!r.snippet) continue;
    const k = r.independenceKey;
    const list = byKey.get(k) ?? [];
    list.push(r);
    byKey.set(k, list);
  }
  for (const [, list] of byKey) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (similarity(list[i].snippet!, list[j].snippet!) >= 0.72) {
          list[j].duplicateOf = list[i].duplicateOf ?? list[i].id;
        }
      }
    }
  }
  // Cross-domain text duplication (syndication / press-release repetition).
  const withSnip = records.filter((r) => r.snippet && !r.duplicateOf);
  for (let i = 0; i < withSnip.length; i++) {
    for (let j = i + 1; j < withSnip.length; j++) {
      const a = withSnip[i];
      const b = withSnip[j];
      if (a.independenceKey !== b.independenceKey && similarity(a.snippet!, b.snippet!) >= 0.8) {
        b.duplicateOf = a.duplicateOf ?? a.id;
      }
    }
  }
  return records;
}

export function independentCount(records: EvidenceRecord[]): number {
  const canonical = records.filter((r) => !r.duplicateOf);
  const keys = new Set(canonical.map((r) => r.independenceKey));
  return keys.size;
}

function numbersAligned(claim: Claim, text: string): { equal: number; differ: number; incomparable: number } {
  const out = { equal: 0, differ: 0, incomparable: 0 };
  if (!claim.numbers.length) return out;
  const docNums = extractNumbers(text);
  for (const cn of claim.numbers) {
    let best = null as null | 'equal' | 'differ' | 'incomparable';
    for (const dn of docNums) {
      const cmp = compareNumbers(cn, dn);
      if (cmp === 'equal') { best = 'equal'; break; }
      if (cmp === 'differ' && best !== 'equal') best = best ?? 'differ';
    }
    if (best === 'equal') out.equal++;
    else if (best === 'differ') out.differ++;
    else out.incomparable++;
  }
  return out;
}

const NEG_WORDS = /\b(not|no|never|denied|rejects?|false|incorrect|debunk|misleading|withdraw|contradic|refute|did not)\b/i;

/**
 * Heuristic relation suggestion between a claim and a retrieved passage.
 * Signals: numeric alignment (strong), keyword overlap (weak), negation presence (weak contra).
 * NEVER produces a final verdict; only a suggestion with an explanation.
 */
export function suggestRelation(claim: Claim, doc: { title: string; snippet?: string; publishedAt?: string }): RelationSuggestion {
  const text = `${doc.title}. ${doc.snippet ?? ''}`;
  const ov = similarity(claim.text, text);
  const nums = numbersAligned(claim, text);
  const neg = NEG_WORDS.test(text);

  if (claim.numbers.length && nums.equal >= 1 && nums.differ === 0 && ov >= 0.12) {
    return {
      relation: 'supports', strength: 2, provisional: true,
      reason: `Numbers in the claim match the retrieved passage (${nums.equal} matching figure(s)); keyword overlap ${(ov * 100).toFixed(0)}%.`,
    };
  }
  if (claim.numbers.length && nums.differ >= 1 && nums.equal === 0 && ov >= 0.12) {
    return {
      relation: 'contradicts', strength: 2, provisional: true,
      reason: `The passage discusses the same topic but reports different numbers (${nums.differ} mismatching figure(s)).`,
    };
  }
  if (ov >= 0.22) {
    return {
      relation: neg ? 'contradicts' : 'supports',
      strength: 1,
      provisional: true,
      reason: `Topical overlap ${(ov * 100).toFixed(0)}%${neg ? ' with negation language present' : ''}. Lexical overlap is a WEAK signal — verify the wording yourself.`,
    };
  }
  if (ov >= 0.1) {
    return { relation: 'contextualizes', strength: 0, provisional: true, reason: `Only partial topical overlap (${(ov * 100).toFixed(0)}%). Treat as background, not confirmation.` };
  }
  return { relation: 'contextualizes', strength: 0, provisional: true, reason: 'No meaningful overlap detected; likely not about this claim.' };
}

export function relationFromUser(
  rec: EvidenceRecord,
  relation: EvidenceRecord['relation'],
): EvidenceRecord {
  return { ...rec, relation, relationSetBy: 'user' };
}

/** Quality weight by source type, used in confidence scoring. Explainable, not statistical. */
export function sourceQualityWeight(type: SourceEntry['sourceType'] | 'user-supplied'): number {
  switch (type) {
    case 'primary': return 1;
    case 'official-statistics': return 0.9;
    case 'academic': return 0.85;
    case 'fact-checker': return 0.75;
    case 'news': return 0.55;
    case 'reference': return 0.45;
    case 'user-supplied': return 0.6;
    case 'social': return 0.2;
    default: return 0.4;
  }
}

export function freshnessWeight(publishedAt: string | undefined, claimYears: number[], ref = new Date()): number | null {
  if (!publishedAt) return null;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return null;
  const claimYear = claimYears.length ? Math.max(...claimYears) : ref.getFullYear();
  const pubYear = new Date(t).getFullYear();
  if (pubYear < claimYear) return 0.25; // published before the events it would confirm
  const age = ref.getFullYear() - pubYear;
  if (age <= 1) return 1;
  if (age <= 3) return 0.8;
  if (age <= 6) return 0.6;
  return 0.4;
}

export { normalizeText };
