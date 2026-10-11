import { describe, expect, it } from 'vitest';
import { computeVerdict, VERDICT_LABELS } from '../src/core/verdicts';
import type { Claim, EvidenceRecord } from '../src/types';

const baseClaim = (over: Partial<Claim> = {}): Claim => ({
  id: 'c1', text: 'India launched Chandrayaan-3 in 2023.', kind: 'factual', isQuotation: false,
  numbers: [], dates: [], entities: ['India'], topics: [], spans: [{ start: 0, end: 39 }], contextMissing: [], ...over,
});

const ev = (over: Partial<EvidenceRecord> = {}): EvidenceRecord => ({
  id: 'e' + Math.random(), claimId: 'c1', publisher: 'isro.gov.in', domain: 'isro.gov.in',
  title: 'ISRO press release', url: 'https://isro.gov.in/pr', accessedAt: new Date().toISOString(),
  origin: 'automatic', relation: 'unassessed', relationSetBy: null, independenceKey: 'isro.gov.in', ...over,
});

const input = (over: Partial<Parameters<typeof computeVerdict>[0]> = {}) => ({
  claim: baseClaim(), evidence: [], sourceTypeById: new Map(), mode: 'online', attemptedSources: 0, accessedSources: 0, blockedReasons: [], ...over,
} as Parameters<typeof computeVerdict>[0]);

describe('verdict mapping', () => {
  it('has all twelve verdict labels', () => {
    expect(Object.keys(VERDICT_LABELS)).toHaveLength(12);
  });
  it('opinion claims are not forced true/false', () => {
    const r = computeVerdict(input({ claim: baseClaim({ kind: 'opinion' }) }));
    expect(r.verdict).toBe('opinion');
    expect(VERDICT_LABELS[r.verdict]).toMatch(/opinion/i);
  });
  it('no evidence → unverified, never false', () => {
    const r = computeVerdict(input());
    expect(r.verdict).toBe('unverified');
    expect(r.explanation).toMatch(/not.*false|does not settle/i);
  });
  it('user-assessed supports ×2 independent → supported; ×1 → mostly', () => {
    const two = computeVerdict(input({
      evidence: [ev({ independenceKey: 'a.gov' }), ev({ independenceKey: 'b.org', url: 'https://b.org' })].map((e) => ({ ...e, relation: 'supports', relationSetBy: 'user' })) as EvidenceRecord[],
      attemptedSources: 2, accessedSources: 2,
    }));
    expect(two.verdict).toBe('supported');
    const one = computeVerdict(input({
      evidence: [ev()].map((e) => ({ ...e, relation: 'supports', relationSetBy: 'user' })) as EvidenceRecord[],
      attemptedSources: 2, accessedSources: 2,
    }));
    expect(one.verdict).toBe('mostly-supported');
  });
  it('conflicting independent evidence → disputed (explained, not resolved)', () => {
    const r = computeVerdict(input({
      evidence: [
        { ...ev(), relation: 'supports', relationSetBy: 'user' },
        { ...ev({ independenceKey: 'x.news', url: 'https://x.news' }), relation: 'contradicts', relationSetBy: 'user' },
      ] as EvidenceRecord[],
      attemptedSources: 2, accessedSources: 2,
    }));
    expect(r.verdict).toBe('disputed');
    expect(r.explanation).toMatch(/disagree/i);
  });
  it('duplicates do not inflate independence', () => {
    const a = { ...ev(), relation: 'supports', relationSetBy: 'user' } as EvidenceRecord;
    const b = { ...ev(), relation: 'supports', relationSetBy: 'user', duplicateOf: a.id } as EvidenceRecord;
    const r = computeVerdict(input({ evidence: [a, b], attemptedSources: 2, accessedSources: 2 }));
    expect(r.verdict).toBe('mostly-supported');
    expect(r.caveats.join(' ')).toMatch(/duplicate/i);
  });
  it('heuristic-only verdicts are labeled provisional', () => {
    const r = computeVerdict(input({
      evidence: [ev({ relationSuggestion: { relation: 'supports', reason: 'numbers match', strength: 2, provisional: true } })],
      attemptedSources: 1, accessedSources: 1,
    }));
    expect(r.verdict).toBe('mostly-supported');
    expect(r.caveats.join(' ')).toMatch(/provisional/i);
  });
  it('confidence is explainable and explicitly not calibrated', () => {
    const r = computeVerdict(input({
      evidence: [ev({ relation: 'supports', relationSetBy: 'user', publishedAt: '2023-07-14' })] as EvidenceRecord[],
      attemptedSources: 1, accessedSources: 1,
    }));
    expect(r.confidence.note).toMatch(/not.*calibrated/i);
    for (const f of r.confidence.factors) {
      expect(f.value).toBeGreaterThanOrEqual(0);
      expect(f.value).toBeLessThanOrEqual(1);
    }
  });
});
