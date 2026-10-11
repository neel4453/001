import type { CategoryId, RegistryLoadResult, SourceEntry } from '../types';
import raw from '../data/sources.json';
import { isSafeHttpUrl } from './util';

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'fact-checking', label: 'Fact-checking' },
  { id: 'un-mun', label: 'UN & MUN' },
  { id: 'government', label: 'Government' },
  { id: 'politics', label: 'Politics' },
  { id: 'country-statistics', label: 'Country statistics' },
  { id: 'academic', label: 'Academic research' },
  { id: 'news', label: 'News' },
  { id: 'social-media', label: 'Social media' },
  { id: 'images-video', label: 'Images & video' },
  { id: 'health', label: 'Health' },
  { id: 'environment', label: 'Environment' },
  { id: 'law', label: 'Law' },
  { id: 'finance', label: 'Finance' },
  { id: 'cybersecurity', label: 'Cybersecurity' },
  { id: 'reference', label: 'Reference' },
];

const CAT_IDS = new Set<string>(CATEGORIES.map((c) => c.id));
const STATUSES = new Set([
  'not-checked', 'website-verified', 'search-page-verified', 'public-document-access-verified',
  'api-integration-verified', 'restricted', 'unavailable', 'historical-archive',
]);
const TYPES = new Set(['primary', 'official-statistics', 'academic', 'fact-checker', 'news', 'reference', 'social', 'user-supplied']);
const RETRIEVAL = new Set(['open-search-page', 'navigate-document', 'fetch-public-page', 'parse-dataset', 'local-index', 'user-supplied', 'public-api-optional']);

/** Loads + validates the registry. Invalid entries are reported, not silently dropped. */
export function loadRegistry(): RegistryLoadResult {
  const errors: string[] = [];
  const sources: SourceEntry[] = [];
  const ids = new Set<string>();
  const arr = raw as unknown as SourceEntry[];
  arr.forEach((e, i) => {
    const at = `sources[${i}] (${e?.name ?? '?'})`;
    if (!e || typeof e !== 'object') return void errors.push(`${at}: not an object`);
    if (!e.id || typeof e.id !== 'string') errors.push(`${at}: missing id`);
    if (ids.has(e.id)) errors.push(`${at}: duplicate id ${e.id}`);
    ids.add(e.id);
    if (!e.name) errors.push(`${at}: missing name`);
    if (!e.url || !isSafeHttpUrl(e.url)) errors.push(`${at}: url missing or unsafe (${e.url})`);
    if (e.searchUrl !== null && e.searchUrl !== undefined && !isSafeHttpUrl(e.searchUrl)) {
      errors.push(`${at}: searchUrl unsafe`);
    }
    if (!Array.isArray(e.categories) || !e.categories.length) errors.push(`${at}: categories required`);
    else for (const c of e.categories) if (!CAT_IDS.has(c)) errors.push(`${at}: unknown category ${c}`);
    if (!STATUSES.has(e.accessStatus)) errors.push(`${at}: bad accessStatus ${e.accessStatus}`);
    if (!TYPES.has(e.sourceType)) errors.push(`${at}: bad sourceType ${e.sourceType}`);
    if (!RETRIEVAL.has(e.retrievalMode)) errors.push(`${at}: bad retrievalMode ${e.retrievalMode}`);
    for (const b of ['apiKeyRequired', 'paidServiceRequired', 'automationAllowed', 'searchUrlVerified'] as const) {
      if (typeof e[b] !== 'boolean') errors.push(`${at}.${b} must be boolean`);
    }
    if (e.paidServiceRequired) errors.push(`${at}: paidServiceRequired=true violates the zero-cost policy`);
    sources.push(e);
  });
  return { sources, errors };
}

export function registryById(): Map<string, SourceEntry> {
  return new Map(loadRegistry().sources.map((s) => [s.id, s]));
}
