/**
 * Central app configuration. The product name is injected at build time from
 * package.json ("productName"), so a rename touches one line — not the codebase.
 * Stored settings use a prefix derived from the name; legacy prefixes are migrated on load.
 */
const G = globalThis as any;

const NAME: string = G.__APP_NAME__ || 'VeriScope';

export const APP = {
  name: NAME,
  fullName: `${NAME} — evidence-first fact-checking`,
  version: G.__APP_VERSION__ || '1.0.0',
  storagePrefix: NAME.toLowerCase().replace(/[^a-z0-9]+/g, ''),
  /** Older storage namespaces to migrate from when the product is renamed. */
  legacyPrefixes: ['intruth'],
  localEngineDefaultUrl: 'http://127.0.0.1:8756',
  ollamaDefaultUrl: 'http://localhost:11434',
};

export const LIMITS = {
  maxClaimsPerScan: 60,
  maxPassageChars: 240000,
  historyDefaultLimit: 200,
  autoQueryTimeoutMs: 12000,
  autoQueryConcurrency: 3,
  evidenceSnippetChars: 640,
};
