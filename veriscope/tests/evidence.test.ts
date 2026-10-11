import { describe, expect, it, vi } from 'vitest';
import { markDuplicates, independentCount, suggestRelation, sourceQualityWeight, freshnessWeight } from '../src/core/evidence';
import type { Claim, EvidenceRecord } from '../src/types';

const rec = (over: Partial<EvidenceRecord>): EvidenceRecord => ({
  id: 'e' + Math.random(), claimId: 'c', publisher: 'p', domain: 'd', title: 't', url: 'https://d.example',
  accessedAt: '', origin: 'automatic', relation: 'unassessed', relationSetBy: null, independenceKey: 'd', ...over,
});

describe('duplicate-source detection (press-release syndication)', () => {
  it('does not count five sites repeating one release as five confirmations', () => {
    const rel = 'Global Carbon Project reports emissions rose 1.1% in 2023, a record driven by coal use in Asia.';
    const recs = [rel, rel, rel.replace('1.1%', '1.1 percent'), rel, rel].map((s, i) =>
      rec({ independenceKey: `site${i}.com`, url: `https://site${i}.com`, snippet: s, title: `Site ${i}` }),
    );
    const marked = markDuplicates(recs);
    expect(independentCount(marked)).toBeLessThanOrEqual(2);
    expect(marked.some((m) => m.duplicateOf)).toBe(true);
  });
  it('same-domain items cluster by independence key', () => {
    const marked = markDuplicates([
      rec({ independenceKey: 'x.com', snippet: 'A long identical sentence about the carbon budget rising sharply in 2023 indeed.' }),
      rec({ independenceKey: 'x.com', snippet: 'A long identical sentence about the carbon budget rising sharply in 2023 indeed?' }),
    ]);
    expect(independentCount(marked)).toBe(1);
  });
});

describe('relation suggestions', () => {
  const claim: Claim = {
    id: 'c', text: 'Country A reduced emissions by 30% in 2022.', kind: 'factual', isQuotation: false,
    numbers: [{ raw: '30%', value: 30, unit: 'percent', kind: 'percent' }], dates: [], entities: [], topics: [], spans: [], contextMissing: [],
  };
  it('matching number → strong supports', () => {
    const s = suggestRelation(claim, { title: 'Emissions report', snippet: 'Country A reduced emissions by 30% in 2022, per the registry.' });
    expect(s.relation).toBe('supports');
    expect(s.strength).toBe(2);
    expect(s.provisional).toBe(true);
  });
  it('different number on same topic → contradicts', () => {
    const s = suggestRelation(claim, { title: 'Emissions report', snippet: 'Country A reduced emissions by 12% in 2022 only.' });
    expect(s.relation).toBe('contradicts');
  });
  it('low overlap → weak context only', () => {
    const s = suggestRelation(claim, { title: 'Cooking oils', snippet: 'Olive oil contains monounsaturated fat.' });
    expect(s.relation).toBe('contextualizes');
    expect(s.strength).toBe(0);
  });
});

describe('weights', () => {
  it('primary > official > academic > fact-checker > news > social', () => {
    const w = (t: Parameters<typeof sourceQualityWeight>[0]) => sourceQualityWeight(t);
    expect(w('primary')).toBeGreaterThan(w('official-statistics'));
    expect(w('official-statistics')).toBeGreaterThan(w('academic'));
    expect(w('academic')).toBeGreaterThan(w('fact-checker'));
    expect(w('fact-checker')).toBeGreaterThan(w('news'));
    expect(w('news')).toBeGreaterThan(w('social'));
  });
  it('evidence predating the claim period is penalized', () => {
    expect(freshnessWeight('2010-01-01', [2023])).toBeLessThan(0.4);
    expect(freshnessWeight('2024-01-01', [2023])!).toBeGreaterThanOrEqual(0.8);
    expect(freshnessWeight(undefined, [2023])).toBe(null);
  });
});

describe('adapter response-shape resilience', () => {
  it('restcountries reports an unexpected-shape error instead of crashing on a non-array 200 body', async () => {
    const { runAdapter } = await import('../src/core/adapters/index');
    const { DEFAULT_SETTINGS } = await import('../src/types');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ unexpected: 'object' }), { status: 200 })));
    const r = await runAdapter('restcountries', 'Country Nowhere raised spending', { ...DEFAULT_SETTINGS, mode: 'online' });
    vi.unstubAllGlobals();
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Unexpected response shape');
  });
});
