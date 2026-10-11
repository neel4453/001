import type { Claim, SourceEntry } from '../types';
import { isSafeHttpUrl } from './util';

/**
 * Honest manual retrieval: we BUILD search links, we never claim a search ran.
 * Every SearchLink is explicitly labeled 'not performed' until the user opens it.
 */
export interface SearchLink {
  sourceId: string;
  name: string;
  url: string;
  kind: 'search-page' | 'homepage';
  performed: false;
  verifiedTemplate: boolean;
  note?: string;
}

export function buildQuery(claim: Pick<Claim, 'text' | 'entities'>): string {
  let core = claim.text.replace(/^(the claim that|claim:)\s*/i, '').trim();
  const ent = claim.entities.filter((e) => e.length > 2).slice(0, 3).join(' ');
  // Keep entities; trim the sentence head so long claims still produce sane queries.
  const maxCore = ent ? Math.max(60, 215 - ent.length - 1) : 215;
  if (core.length > maxCore) core = `${core.slice(0, maxCore - 1)}…`;
  const q = ent ? `${core} ${ent}` : core;
  return q.length > 220 ? `${q.slice(0, 219)}…` : q;
}

export function buildSearchLinks(
  sources: SourceEntry[],
  claim: Pick<Claim, 'text' | 'entities'>,
  maxPerSource = 1,
): SearchLink[] {
  const q = buildQuery(claim);
  const links: SearchLink[] = [];
  for (const s of sources) {
    let url: string | null = null;
    let kind: SearchLink['kind'] = 'search-page';
    if (s.searchUrl && s.searchUrl.includes('{query}')) {
      url = s.searchUrl.replace('{query}', encodeURIComponent(q));
    } else if (s.searchUrl) {
      url = s.searchUrl;
    } else if (s.url && isSafeHttpUrl(s.url)) {
      url = s.url;
      kind = 'homepage';
    }
    if (!url || !isSafeHttpUrl(url)) continue;
    links.push({
      sourceId: s.id,
      name: s.name,
      url,
      kind,
      performed: false,
      verifiedTemplate: !!s.searchUrl && s.searchUrlVerified,
      note: kind === 'homepage' ? 'No search template; open the site and search manually.' : s.searchUrlVerified ? undefined : 'Search URL pattern follows common conventions but is not live-verified in this build.',
    });
  }
  void maxPerSource;
  return links;
}

/** Site-scoped fallback search via a public search engine (documented, user-clicked). */
export function siteScopedSearch(domain: string, q: string): string {
  return `https://duckduckgo.com/?q=${encodeURIComponent(`site:${domain} ${q}`.slice(0, 200))}`;
}
