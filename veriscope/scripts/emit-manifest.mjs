/** Writes dist/manifest.json from package.json metadata (branding stays configurable). */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const name = pkg.productName ?? pkg.name;

const manifest = {
  manifest_version: 3,
  name: `${name} — evidence-first fact-checking`,
  short_name: name,
  version: pkg.version,
  description: 'Free, privacy-first claim verification: extract claims, gather key-free public evidence, compare sources, explain verdicts, and admit uncertainty. No paid APIs, no tracking, strict offline mode.',
  default_locale: undefined,
  icons: { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' },
  action: {
    default_popup: 'popup.html',
    default_title: `${name} — verify a claim`,
    default_icon: { 16: 'icons/icon16.png', 48: 'icons/icon48.png' },
  },
  background: { service_worker: 'background.js', type: 'module' },
  side_panel: { default_path: 'sidepanel.html' },
  options_page: 'options.html',
  permissions: ['storage', 'unlimitedStorage', 'contextMenus', 'activeTab', 'scripting', 'sidePanel'],
  // Optional origins the user can grant for key-free online lookups (Settings → online mode).
  // Requested lazily; nothing is fetched without a user gesture. Strict offline never requests these.
  optional_permissions: [],
  optional_host_permissions: [
    'https://api.openalex.org/*',
    'https://api.crossref.org/*',
    'https://en.wikipedia.org/*',
    'https://eutils.ncbi.nlm.nih.gov/*',
    'https://www.ebi.ac.uk/*',
    'https://archive.org/*',
    'https://api.gdeltproject.org/*',
    'https://restcountries.com/*',
    'https://api.semanticscholar.org/*',
    'http://localhost:11434/*',
    'http://127.0.0.1:8756/*',
  ],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'",
  },
  minimum_chrome_version: '120',
  incognito: 'spanning',
};
delete manifest.default_locale;
writeFileSync(join(root, 'dist', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('manifest.json written for', name);
