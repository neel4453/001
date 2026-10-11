import { describe, expect, it } from 'vitest';
import { extractDates, compareDateFacts, yearsSince } from '../src/core/dates';
import { compareNumbers, extractNumbers } from '../src/core/units';

describe('date extraction', () => {
  it('parses years, full dates, ISO and month-year', () => {
    const d = extractDates('Signed 12 March 2018, effective 2019-06-01; ratified in January 2020.');
    expect(d.some((x) => x.year === 2018 && x.day === 12 && x.month === 3)).toBe(true);
    expect(d.some((x) => x.year === 2019 && x.precision === 'day')).toBe(true);
    expect(d.some((x) => x.year === 2020 && x.month === 1)).toBe(true);
  });
  it('marks relative dates as unresolvable', () => {
    const d = extractDates('Last year inflation fell.');
    expect(d.some((x) => x.precision === 'relative')).toBe(true);
  });
  it('compares dates', () => {
    const [a] = extractDates('in 2018');
    const [b] = extractDates('in 2020');
    expect(compareDateFacts(a, b)).toBe(-1);
    expect(yearsSince('2018-06-01', new Date('2024-06-01'))).toBeCloseTo(6, 0);
  });
});

describe('numeric facts and units', () => {
  it('handles Indian numbering', () => {
    const n = extractNumbers('The fund was ₹50 crore in 2021 and ₹12 lakh per person.');
    const crore = n.find((x) => x.raw.includes('crore'))!;
    const lakh = n.find((x) => x.raw.includes('lakh'))!;
    expect(crore.value).toBe(50e7);
    expect(lakh.value).toBe(12e5);
    expect(crore.currency).toBe('INR');
  });
  it('normalizes billions and percent', () => {
    const n = extractNumbers('They spent $1.2 billion and cut 30%.');
    expect(n.find((x) => x.kind === 'currency')!.value).toBeCloseTo(1.2e9, 0);
    expect(n.find((x) => x.kind === 'percent')!.value).toBe(30);
  });
  it('compares with tolerance and incomparable currencies', () => {
    const [a] = extractNumbers('spent $5 billion');
    const [b] = extractNumbers('spent $5.04 billion');
    const [c] = extractNumbers('spent ₹5 billion');
    expect(compareNumbers(a, b)).toBe('equal');
    expect(compareNumbers(a, c)).toBe('incomparable');
  });
  it('does not treat bare years as counts', () => {
    expect(extractNumbers('The treaty of 1919 ended it').some((n) => n.value === 1919 && n.kind === 'count')).toBe(false);
  });
});
