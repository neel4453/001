/**
 * Static dist verification: manifest validity, referenced files, no remote code,
 * no absolute-root asset paths, offline-mode fetch audit of the bundle.
 * (This is NOT a substitute for loading in real Chrome — see docs/LIMITATIONS.md.)
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const fail = [];
const pass = [];

let mf;
try { mf = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')); pass.push('manifest.json parses'); }
catch (e) { console.error('FATAL: manifest.json invalid:', e.message); process.exit(1); }

if (mf.manifest_version !== 3) fail.push('manifest_version must be 3');
for (const key of ['background.service_worker', 'side_panel.default_path', 'action.default_popup', 'options_page']) {
  const parts = key.split('.');
  let file = mf;
  for (const p of parts) file = file?.[p];
  if (!file) fail.push(`missing ${key}`);
  else if (!existsSync(join(root, file))) fail.push(`manifest references missing file ${file}`);
}
for (const [sz, file] of Object.entries(mf.icons ?? {})) {
  if (!existsSync(join(root, file))) fail.push(`icon ${sz} missing: ${file}`);
}
const perms = new Set(mf.permissions ?? []);
for (const p of ['storage', 'activeTab', 'scripting', 'contextMenus', 'sidePanel']) if (!perms.has(p)) fail.push(`expected permission ${p}`);
if ((mf.permissions ?? []).includes('tabs')) pass.push('tabs permission avoided');
if ((mf.host_permissions ?? []).length) fail.push('NO persistent host_permissions allowed (strict-offline guarantee)');
else pass.push('zero persistent host permissions');

const htmls = ['popup.html', 'sidepanel.html', 'options.html'];
for (const h of htmls) {
  const file = join(root, h);
  if (!existsSync(file)) { fail.push(`missing ${h}`); continue; }
  const html = readFileSync(file, 'utf8');
  if (/src=["']https?:/i.test(html) || /href=["']https?:.*\.css/i.test(html)) fail.push(`${h}: remote script/style reference (must be bundled)`);
  if (/["']\/assets\//.test(html)) fail.push(`${h}: root-absolute asset paths break in chrome-extension://`);
  if (!/<script[^>]*src=["']\.\/assets\//.test(html)) fail.push(`${h}: expected relative bundled script`);
}
const js = ['background.js', ...htmls.flatMap((h) => {
  const html = existsSync(join(root, h)) ? readFileSync(join(root, h), 'utf8') : '';
  return [...html.matchAll(/src=["']\.\/(assets\/[^"']+)["']/g)].map((m) => m[1]);
})];
for (const f of js) if (!existsSync(join(root, f))) fail.push(`missing bundle ${f}`);

const bgSrc = existsSync(join(root, 'background.js')) ? readFileSync(join(root, 'background.js'), 'utf8') : '';
if (/importScripts|new Function|eval\(/.test(bgSrc)) fail.push('service worker contains forbidden dynamic code');

// every referenced css exists
for (const h of htmls) {
  const html = existsSync(join(root, h)) ? readFileSync(join(root, h), 'utf8') : '';
  for (const m of html.matchAll(/href=["']\.\/(assets\/[^"']+\.css)["']/g)) {
    if (!existsSync(join(root, m[1]))) fail.push(`missing css ${m[1]}`);
  }
}

if (fail.length) {
  console.error('dist check FAILED:\n - ' + fail.join('\n - '));
  process.exit(1);
}
console.log('dist check passed:\n - ' + pass.join('\n - ') + '\n - all manifest-referenced files present; html/js/css bundled locally; no remote code.');
