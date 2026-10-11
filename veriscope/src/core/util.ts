/** Small shared utilities. Deterministic and side-effect free. */

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}_${Date.now().toString(36)}_${counter}_${rnd}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Lowercase, strip punctuation/diacritics-ish noise, collapse whitespace. For comparison only. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}%$₹€£°]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set(
  'a an the of in on at to for and or is are was were be been being by with from as that this these those it its he she they we you i not no than then there here what which who whom whose when where why how do does did done have has had having will would can could may might must shall should'.split(
    ' ',
  ),
);

export function tokenSet(s: string): Set<string> {
  return new Set(normalizeText(s).split(' ').filter((t) => t.length > 1 && !STOP.has(t)));
}

/** Jaccard similarity over content tokens (stopwords removed). */
export function similarity(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

/** Registrable-domain approximation. NOT a full public-suffix list: documented limitation. */
const TWO_LEVEL = new Set([
  'co.uk','org.uk','ac.uk','gov.uk','me.uk','com.au','net.au','org.au','gov.au','edu.au',
  'co.in','gov.in','ac.in','edu.in','net.in','org.in','co.nz','govt.nz','org.nz','com.br',
  'net.br','org.br','gov.br','co.jp','or.jp','ne.jp','ac.jp','go.jp','co.kr','go.kr','or.kr',
  'co.za','org.za','web.za','com.cn','net.cn','org.cn','gov.cn','com.mx','org.mx','gob.mx',
  'com.tr','org.tr','gov.tr','com.ar','gob.ar','edu.ar','com.sg','edu.sg','gov.sg','com.my',
  'gov.my','com.ng','gov.ng','com.pk','gov.pk','com.ua','ru','eu','us','ca','de','fr','es',
  'it','nl','pl','se','no','fi','dk','ch','at','be','pt','gr','cz','hu','il','ae','sa','eg',
  'ke','nigeria','id','th','vn','my','sg','jp','kr','in','cn','br','mx','ar','cl','co','pe',
]);

export function registrableDomain(input: string): string {
  let host = input;
  try {
    host = new URL(input).hostname.toLowerCase();
  } catch {
    host = host.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  }
  host = host.replace(/^www\./, '');
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  if (TWO_LEVEL.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Only http(s) navigation is permitted anywhere in the app. */
export function isSafeHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
