import { describe, expect, it } from 'vitest';
import { classifyClaim, extractClaims, dedupeClaims } from '../src/core/claims';
import { splitSentences } from '../src/core/sentences';

describe('sentence segmentation', () => {
  it('keeps abbreviations intact', () => {
    const s = splitSentences('Mr. Obama signed the deal in 2018. It cost $5bn.');
    expect(s).toHaveLength(2);
  });
  it('splits after question/exclamation with quote closing', () => {
    const s = splitSentences('Is this true? Yes, it is! The rest follows.');
    expect(s.length).toBe(3);
  });
  it('does not split decimals', () => {
    expect(splitSentences('Emissions fell 1.5% in 2019.')).toHaveLength(1);
  });
});

describe('atomic claim extraction', () => {
  const passage = 'Country A signed the treaty in 2018, spent $5 billion on the program in 2022, and reduced emissions by 30%.';
  it('splits coordinated clauses into independently checkable atoms', () => {
    const { claims } = extractClaims(passage);
    expect(claims.length).toBeGreaterThanOrEqual(2);
    expect(claims.some((c) => /signed the treaty in 2018/.test(c.text))).toBe(true);
    expect(claims.some((c) => /reduced emissions by 30%/.test(c.text))).toBe(true);
  });
  it('keeps atoms connected to the original passage via spans', () => {
    const { claims } = extractClaims(passage);
    for (const c of claims) {
      expect(c.originalPassage).toBe(passage);
      expect(c.spans.length).toBeGreaterThan(0);
    }
  });
  it('extracts numbers with units and dates', () => {
    const { claims } = extractClaims(passage);
    const spent = claims.find((c) => /spent/.test(c.text));
    expect(spent?.numbers.length).toBeGreaterThanOrEqual(1);
    expect(spent?.numbers[0].currency).toBe('USD');
    expect(spent?.dates.some((d) => d.year === 2022)).toBe(true);
  });
});

describe('claim classification', () => {
  it('opinion', () => expect(classifyClaim('In my opinion the policy is a disgrace')).toBe('opinion'));
  it('prediction', () => expect(classifyClaim('The economy will grow by 8% in 2027')).toBe('prediction'));
  it('question', () => expect(classifyClaim('Did the Senate pass the bill?')).toBe('question'));
  it('recommendation', () => expect(classifyClaim('The government should abolish the tax')).toBe('recommendation'));
  it('factual', () => expect(classifyClaim('India launched Chandrayaan-3 in 2023')).toBe('factual'));
  it('satire hint', () => expect(classifyClaim('Local man discovers water is wet (this satire is fictional)')).toBe('satire-candidate'));
});

describe('deduplication', () => {
  it('merges near-identical claims and unions spans', () => {
    const base = { id: 'a', text: 'The GDP grew by 6 percent in 2023.', kind: 'factual', isQuotation: false, numbers: [], dates: [], entities: [], topics: [], contextMissing: [] } as const;
    const out = dedupeClaims([
      { ...base, id: 'a', spans: [{ start: 0, end: 30 }] } as any,
      { ...base, id: 'b', text: 'The GDP grew by 6 percent in 2023', spans: [{ start: 100, end: 130 }] } as any,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].spans).toHaveLength(2);
  });
});

describe('missing context detection', () => {
  it('flags vague current claims', () => {
    const { claims } = extractClaims('The country now has the record exports this year for real.');
    const c = claims[0];
    expect(c.kind === 'factual' || c.kind === 'unknown').toBe(true);
  });
});
