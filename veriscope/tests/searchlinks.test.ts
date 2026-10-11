import { describe, expect, it } from 'vitest';
import { buildSearchLinks, buildQuery, siteScopedSearch } from '../src/core/searchlinks';
import type { SourceEntry } from '../src/types';

const mk = (o: Partial<SourceEntry>): SourceEntry => ({
  id: 'x', name: 'X', url: 'https://x.org', searchUrl: null, searchUrlVerified: false,
  categories: ['news'], countries: ['world'], sourceType: 'news', retrievalMode: 'open-search-page',
  accessStatus: 'not-checked', apiKeyRequired: false, paidServiceRequired: false, automationAllowed: false, lastChecked: null, ...o,
});

describe('manual search link builder', () => {
  const claim = { text: 'India launched Chandrayaan-3 in 2023.', entities: ['India'] };
  it('fills {query} and URL-encodes', () => {
    const links = buildSearchLinks([mk({ searchUrl: 'https://x.org/?s={query}', searchUrlVerified: true })], claim);
    expect(links[0].url).toContain('https://x.org/?s=India%20launched');
    expect(links[0].performed).toBe(false);
  });
  it('falls back to homepage with explicit kind, never fabricates a search', () => {
    const links = buildSearchLinks([mk({})], claim);
    expect(links[0].kind).toBe('homepage');
    expect(links[0].note).toMatch(/manually/);
  });
  it('drops unsafe urls', () => {
    const links = buildSearchLinks([mk({ url: 'javascript:alert(1)', searchUrl: null as any })], claim);
    expect(links).toHaveLength(0);
  });
  it('query includes entities, is length-capped', () => {
    const long = { text: 'a'.repeat(500), entities: ['United Nations', 'WHO'] };
    const q = buildQuery(long);
    expect(q.length).toBeLessThanOrEqual(220);
    expect(q).toContain('United Nations');
  });
  it('site-scoped fallback encodes site: operator', () => {
    expect(siteScopedSearch('reuters.com', 'claim text')).toContain('site%3Areuters.com');
  });
});
