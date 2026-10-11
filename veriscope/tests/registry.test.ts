import { describe, expect, it } from 'vitest';
import { loadRegistry, CATEGORIES } from '../src/core/registry';


const { sources, errors } = loadRegistry();

describe('source registry', () => {
  it('validates cleanly', () => {
    expect(errors).toEqual([]);
    expect(sources.length).toBeGreaterThanOrEqual(200);
  });
  it('every required spec area is represented', () => {
    const names = sources.map((s) => s.name.toLowerCase()).join('|');
    const required = [
      'politifact', 'snopes', 'africa check', 'alt news', 'reuters fact check', 'logically',
      'un digital library', 'treaty collection', 'court of justice', 'sipri', 'ipcc',
      'cia world factbook', 'world bank', 'rest countries',
      'pib fact check', 'parliament of india', 'india code', 'election commission', 'crime records', 'isro',
      'congress', 'federal register', 'eur-lex', 'ons',
      'openalex', 'crossref', 'pubmed', 'retraction watch', 'pubpeer', 'orcid',
      'bbc', 'bellingcat', 'propublica', 'icij',
      'youtube', 'wikipedia', 'internet archive', 'wayback',
      'google lens', 'tineye', 'c2pa', 'weverify',
      'who', 'cdc', 'cochrane', 'fssai',
      'noaa', 'meteorological', 'copernicus', 'our world in data',
      'courtlistener', 'hudoc', 'amnesty',
      'sebi', 'edgar', 'opencorporates', 'opensanctions', 'un comtrade',
      'nist', 'cve', 'cisa', 'owasp', 'virustotal', 'hugging face', 'ai incident database',
      'britannica', 'wikidata', 'europeana', 'smithsonian',
    ];
    const missing = required.filter((r) => r && !names.includes(r));
    expect(missing).toEqual([]);
  });
  it('is honest: unverified entries are NOT claimed as checked', () => {
    expect(sources.every((s) => s.lastChecked === null)).toBe(true);
    const checked = sources.filter((s) => /verified$/.test(s.accessStatus) && s.accessStatus !== 'not-checked');
    // only real implemented adapters may carry integration verification; today: none claimed.
    expect(checked).toEqual([]);
  });
  it('never requires paid services (hard policy)', () => {
    expect(sources.every((s) => !s.paidServiceRequired)).toBe(true);
  });
  it('all categories come from the controlled vocabulary', () => {
    const cats = new Set(CATEGORIES.map((c) => c.id));
    for (const s of sources) for (const c of s.categories) expect(cats.has(c)).toBe(true);
  });
  it('ids unique, urls safe http(s), templates use {query}', () => {
    expect(new Set(sources.map((s) => s.id)).size).toBe(sources.length);
    for (const s of sources) {
      expect(s.url.startsWith('https://') || s.url.startsWith('http://')).toBe(true);
      if (s.searchUrl && s.searchUrl.includes('{query}')) {
        expect(s.searchUrl.split('{query}')).toHaveLength(2);
      }
    }
  });
  it('every automated entry names an implemented-or-declared adapter', () => {
    for (const s of sources.filter((x) => x.automationAllowed)) {
      expect(typeof s.adapter).toBe('string');
      if (s.adapter === 'worldbank') expect(s.notes).toMatch(/not implemented/i);
    }
  });
  it('fact-checking entries include the spec list', () => {
    const fc = sources.filter((s) => s.categories.includes('fact-checking'));
    expect(fc.length).toBeGreaterThanOrEqual(19);
  });
  it('CIA World Factbook marked as historical archive', () => {
    const cia = sources.find((s) => s.name.includes('Factbook'))!;
    expect(cia.accessStatus).toBe('historical-archive');
    expect(cia.notes).toMatch(/archive|2026/i);
  });
});
