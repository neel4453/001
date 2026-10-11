import type { Settings } from '../../types';
import { safeFetchJson } from '../net';

/**
 * Free, key-less public APIs actually implemented. Each returns normalized docs or an
 * honest error. Nothing here is required: with autoQueries off (or offline mode) the
 * extension still works via user-initiated search links.
 */

export interface FetchedDoc {
  adapter: string;
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: string;
  extra?: Record<string, string | boolean | number>;
}

export interface AdapterResult {
  adapter: string;
  ok: boolean;
  docs: FetchedDoc[];
  error?: string;
  note?: string;
}

export type AdapterId =
  | 'openalex' | 'crossref' | 'wikipedia' | 'pubmed' | 'europepmc' | 'wayback' | 'gdelt' | 'restcountries' | 'semanticscholar';

const UA = { 'User-Agent': 'VeriScope/1.0 (personal research browser extension; no server)' };

function withEmail(params: URLSearchParams, settings: Settings): URLSearchParams {
  if (settings.politePoolEmail.trim()) params.set('mailto', settings.politePoolEmail.trim());
  return params;
}

async function openalex(query: string, settings: Settings): Promise<AdapterResult> {
  const p = withEmail(new URLSearchParams({ search: query.slice(0, 190), per_page: '8' }), settings);
  const r = await safeFetchJson<any>(`https://api.openalex.org/works?${p}`, settings, { headers: UA });
  if (!r.ok) return { adapter: 'openalex', ok: false, docs: [], error: r.error };
  const docs: FetchedDoc[] = (r.data?.results ?? []).map((w: any) => ({
    adapter: 'openalex',
    title: w.display_name ?? '(untitled)',
    url: w.doi ? `https://doi.org/${w.doi.replace(/^https?:\/\/doi\.org\//, '')}` : w.id,
    snippet: (w.abstract_inverted_index ? abstractFromInverted(w.abstract_inverted_index) : w.primary_location?.landing_page_url) as string | undefined,
    publishedAt: w.publication_date,
    extra: {
      cited_by: w.cited_by_count ?? 0,
      is_retracted: !!w.is_retracted,
      retracted: w.is_retracted ? 'OpenAlex flags this work as RETRACTED.' : undefined,
      peer_reviewed: w.is_paratext?.has_reference_frames ?? undefined,
    } as any,
  }));
  return { adapter: 'openalex', ok: true, docs, note: 'OpenAlex: metadata index of scholarly works. Snippets are abstracts when available.' };
}

function abstractFromInverted(inv: Record<string, number[]>): string | undefined {
  try {
    const entries: { w: string; i: number }[] = [];
    for (const [w, idxs] of Object.entries(inv)) for (const i of idxs) entries.push({ w, i });
    entries.sort((a, b) => a.i - b.i);
    return entries.map((e) => e.w).join(' ').slice(0, 900);
  } catch {
    return undefined;
  }
}

async function crossref(query: string, settings: Settings): Promise<AdapterResult> {
  const doi = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i.exec(query);
  const url = doi
    ? `https://api.crossref.org/works/${encodeURIComponent(doi[0])}`
    : `https://api.crossref.org/works?${withEmail(new URLSearchParams({ query: query.slice(0, 190), rows: '8' }), settings)}`;
  const r = await safeFetchJson<any>(url, settings, { headers: UA });
  if (!r.ok) return { adapter: 'crossref', ok: false, docs: [], error: r.error };
  const items = doi ? [r.data?.message].filter(Boolean) : (r.data?.message?.items ?? []);
  const docs: FetchedDoc[] = items.map((w: any) => ({
    adapter: 'crossref',
    title: w.title?.[0] ?? '(untitled)',
    url: w.URL ?? `https://doi.org/${w.DOI}`,
    snippet: [w['container-title']?.[0], w.publisher, w.type].filter(Boolean).join(' · '),
    publishedAt: w.published?.['date-parts']?.[0] ? new Date(w.published['date-parts'][0][0], (w.published['date-parts'][0][1] ?? 1) - 1, w.published['date-parts'][0][2] ?? 1).toISOString().slice(0, 10) : undefined,
    extra: {
      status: w.status,
      is_retracted: w.status === 'retracted',
      update_possible: (w.relation?.['has-update']?.length ?? 0) > 0 ? 'A published correction/update exists — open the DOI page.' : undefined,
    } as any,
  }));
  return { adapter: 'crossref', ok: true, docs, note: 'Crossref records publishing metadata incl. retraction/correlation relationships.' };
}

async function wikipedia(query: string, settings: Settings): Promise<AdapterResult> {
  const p = new URLSearchParams({
    action: 'query', list: 'search', srsearch: query.slice(0, 190), format: 'json', origin: '*', srlimit: '6', srprop: 'snippet|timestamp',
  });
  const r = await safeFetchJson<any>('https://en.wikipedia.org/w/api.php?' + p, settings, { headers: UA });
  if (!r.ok) return { adapter: 'wikipedia', ok: false, docs: [], error: r.error };
  const docs: FetchedDoc[] = (r.data?.query?.search ?? []).map((s: any) => ({
    adapter: 'wikipedia',
    title: s.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`,
    snippet: String(s.snippet ?? '').replace(/<[^>]+>/g, ''),
    publishedAt: s.timestamp,
    extra: { id: s.pageid },
  }));
  return { adapter: 'wikipedia', ok: true, docs, note: 'Wikipedia is a starting point that cites primary sources — follow its references; treat the article text as tertiary context.' };
}

async function pubmed(query: string, settings: Settings): Promise<AdapterResult> {
  const base = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const p = new URLSearchParams({ db: 'pubmed', term: query.slice(0, 190), retmax: '8', retmode: 'json', sort: 'relevance' });
  if (settings.politePoolEmail.trim()) {
    p.set('tool', 'veriscope-ext');
    p.set('email', settings.politePoolEmail.trim());
  }
  const s = await safeFetchJson<any>(`${base}/esearch.fcgi?${p}`, settings, { headers: UA });
  if (!s.ok) return { adapter: 'pubmed', ok: false, docs: [], error: s.error };
  const ids: string[] = s.data?.esearchresult?.idlist ?? [];
  if (!ids.length) return { adapter: 'pubmed', ok: true, docs: [] };
  const d = await safeFetchJson<any>(`${base}/esummary.fcgi?${new URLSearchParams({ db: 'pubmed', id: ids.join(','), retmode: 'json' })}`, settings, { headers: UA });
  if (!d.ok) return { adapter: 'pubmed', ok: false, docs: [], error: d.error };
  const result = d.data?.result ?? {};
  const docs: FetchedDoc[] = ids.map((id: string) => {
    const it = result[id];
    return {
      adapter: 'pubmed',
      title: it?.title ?? '(untitled)',
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      snippet: (it?.authors ?? []).slice(0, 3).map((a: any) => a.name).join(', ') + (it?.source ? ` — ${it.source}, ${it.pubdate}` : ''),
      publishedAt: (it?.pubdate ?? '').match(/^\d{4}/)?.[0],
      extra: { pmid: id },
    };
  });
  return { adapter: 'pubmed', ok: true, docs, note: 'PubMed indexes abstracts; check the full text and whether findings were later corrected.' };
}

async function europepmc(query: string, settings: Settings): Promise<AdapterResult> {
  const p = new URLSearchParams({
    query: `TITLE_ABS:"${query.replace(/"/g, ' ').slice(0, 120)}" OR ABSTRACT:"${query.replace(/"/g, ' ').slice(0, 120)}"`,
    format: 'json', pageSize: '8',
  });
  const r = await safeFetchJson<any>(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${p}`, settings, { headers: UA });
  if (!r.ok) return { adapter: 'europepmc', ok: false, docs: [], error: r.error };
  const docs: FetchedDoc[] = (r.data?.resultList?.result ?? []).map((x: any) => ({
    adapter: 'europepmc',
    title: x.title ?? '(untitled)',
    url: x.doi ? `https://doi.org/${x.doi}` : `https://europepmc.org/article/${x.source}/${x.id}`,
    snippet: (x.abstractText ?? '').replace(/<[^>]+>/g, ' ').slice(0, 600) || undefined,
    publishedAt: x.pubDate,
    extra: { is_open_access: x.isOpenAccess === 'Y', has_full_text: x.hasTextMinedTerms === 'Y' } as any,
  }));
  return { adapter: 'europepmc', ok: true, docs };
}

async function wayback(query: string, settings: Settings): Promise<AdapterResult> {
  const urlMatch = /https?:\/\/\S+/.exec(query);
  if (!urlMatch) return { adapter: 'wayback', ok: true, docs: [], note: 'Wayback adapter needs a URL to look up (from the page context).' };
  const p = new URLSearchParams({ url: urlMatch[0] });
  const r = await safeFetchJson<any>(`https://archive.org/wayback/available?${p}`, settings, { headers: UA });
  if (!r.ok) return { adapter: 'wayback', ok: false, docs: [], error: r.error };
  const snap = r.data?.archived_snapshots?.closest;
  if (!snap) return { adapter: 'wayback', ok: true, docs: [], note: 'No archived snapshot found for this URL (a missing snapshot is not proof the page never existed).' };
  return {
    adapter: 'wayback', ok: true,
    docs: [{
      adapter: 'wayback', title: `Wayback snapshot ${snap.timestamp}`, url: snap.url,
      publishedAt: snap.timestamp ? `${snap.timestamp.slice(0, 4)}-${snap.timestamp.slice(4, 6)}-${snap.timestamp.slice(6, 8)}` : undefined,
      snippet: `Archived copy captured ${snap.timestamp}. Compare with the live page for silent edits.`,
    }],
  };
}

async function gdelt(query: string, settings: Settings): Promise<AdapterResult> {
  const p = new URLSearchParams({ query: `"${query.replace(/"/g, ' ').slice(0, 120)}"`, mode: 'ArtList', maxrecords: '6', format: 'json' });
  const r = await safeFetchJson<any>(`https://api.gdeltproject.org/api/v2/doc/doc?${p}`, settings, { headers: UA });
  if (!r.ok) return { adapter: 'gdelt', ok: false, docs: [], error: r.error };
  const arts = r.data?.articles ?? [];
  const docs: FetchedDoc[] = arts.map((a: any) => ({
    adapter: 'gdelt', title: a.title, url: a.url,
    snippet: `${a.domain} · ${a.seendate?.replace(/(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)/, '$1-$2-$3') ?? ''}`,
    publishedAt: a.seendate ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}` : undefined,
  }));
  return { adapter: 'gdelt', ok: true, docs, note: 'GDELT indexes global news coverage; useful for finding the ORIGINAL report, not for judging truth.' };
}

async function restcountries(query: string, settings: Settings): Promise<AdapterResult> {
  const name = /(?:^|\s)in\s+([A-Z][a-z]{2,})\b/.exec(query)?.[1] ?? query.split(/\s+/).find((w) => /^[A-Z][a-z]{3,}$/.test(w));
  if (!name) return { adapter: 'restcountries', ok: true, docs: [], note: 'No country name detected; skipping REST Countries lookup.' };
  const r = await safeFetchJson<any[]>(`https://restcountries.com/v3.1/name/${encodeURIComponent(name.toLowerCase())}?fields=name,capital,region,population,independent,subregion`, settings, { headers: UA });
  if (!r.ok) return { adapter: 'restcountries', ok: false, docs: [], error: r.error };
  if (!Array.isArray(r.data)) {
    return { adapter: 'restcountries', ok: false, docs: [], error: 'Unexpected response shape from restcountries.com (expected a JSON array) — the API may have changed; nothing was fabricated from it.' };
  }
  const docs: FetchedDoc[] = r.data.slice(0, 2).map((c: any) => ({
    adapter: 'restcountries',
    title: `Country data: ${c.name?.common}`,
    url: 'https://restcountries.com',
    snippet: Object.entries(c).filter(([k]) => k !== 'name').map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(', ') : v}`).join('; '),
    extra: { snapshot: 'REST Countries data is a community snapshot — cross-check the official statistical source.' },
  }));
  return { adapter: 'restcountries', ok: true, docs };
}

async function semanticscholar(query: string, settings: Settings): Promise<AdapterResult> {
  const p = new URLSearchParams({ query: query.slice(0, 180), limit: '6', fields: 'title,url,year,venue,abstract,is_retracted,externalIds' });
  const r = await safeFetchJson<any>(`https://api.semanticscholar.org/graph/v1/paper/search?${p}`, settings, { headers: UA });
  if (!r.ok) return { adapter: 'semanticscholar', ok: false, docs: [], error: r.error ?? 'Semantic Scholar public endpoint is rate-limited without a key; treat as optional.' };
  const docs: FetchedDoc[] = (r.data?.data ?? []).map((x: any) => ({
    adapter: 'semanticscholar', title: x.title ?? '(untitled)', url: x.url ?? `https://www.semanticscholar.org/search?q=${encodeURIComponent(x.title ?? '')}`,
    snippet: (x.abstract ?? '').slice(0, 600) || x.venue, publishedAt: x.year ? `${x.year}-01-01` : undefined,
    extra: { is_retracted: !!x.is_retracted } as any,
  }));
  return { adapter: 'semanticscholar', ok: true, docs, note: 'Unauthenticated endpoint; occasional rate limits are expected.' };
}

const ADAPTERS: Record<AdapterId, (q: string, s: Settings) => Promise<AdapterResult>> = {
  openalex, crossref, wikipedia, pubmed, europepmc, wayback, gdelt, restcountries, semanticscholar,
};

export function listAdapters(): AdapterId[] {
  return Object.keys(ADAPTERS) as AdapterId[];
}

export async function runAdapter(adapter: string, query: string, settings: Settings): Promise<AdapterResult> {
  const fn = ADAPTERS[adapter as AdapterId];
  if (!fn) {
    return { adapter, ok: false, docs: [], error: `Adapter '${adapter}' is registered in sources.json but not implemented in this build. The manual search link remains available — no results are fabricated.` };
  }
  try {
    return await fn(query, settings);
  } catch (e) {
    return { adapter, ok: false, docs: [], error: `Adapter crashed: ${(e as Error).message}` };
  }
}
