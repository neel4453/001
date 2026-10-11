import type { NumericFact } from '../types';

/**
 * Numeric fact extraction with unit normalization.
 * Honest limitation: currencies are NEVER converted (no free FX rate is fetched in
 * offline mode); comparisons across currencies are reported as "different currency".
 */

const SCALE: Record<string, number> = {
  thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12,
  crore: 1e7, lakh: 1e5, lac: 1e5, crore1: 1e7,
};

const CURRENCY_NUM = new RegExp(
  String.raw`([$₹€£¥]|US\$|USD|INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)\s*(thousand|million|billion|trillion|crore|lakh|lac)?`,
  'gi',
);
const PERCENT = /([\d,]+(?:\.\d+)?)\s*%|([ ]|^)per\s+cent\b/gi;
const PLAIN =
  /\b([\d,]+(?:\.\d+)?)\s*(thousand|million|billion|trillion|crore|lakh|lac)?\s*(%|km|kms|meters?|metres?|tonnes?|tons?|kt|Mt|Gt|TWh|GWh|MW|GW|kWh|°C|deaths?|cases?|people|persons|inhabitants|barrels|bpd|hectares?|ha|km²|square kilometres?)?/gi;

function toNum(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function extractNumbers(text: string): NumericFact[] {
  const out: NumericFact[] = [];
  let m: RegExpExecArray | null;
  const consumed: boolean[] = [];
  const mark = (start: number, len: number) => {
    for (let i = start; i < start + len; i++) consumed[i] = true;
  };
  while ((m = CURRENCY_NUM.exec(text))) {
    const v = toNum(m[2]);
    if (v == null) continue;
    const scale = m[3] ? SCALE[m[3].toLowerCase()] : undefined;
    const sym = m[1].toUpperCase();
    const currency =
      sym.includes('$') ? 'USD' : sym.includes('₹') || sym.startsWith('RS') || sym === 'INR' ? 'INR'
      : sym.includes('€') ? 'EUR' : sym.includes('£') ? 'GBP' : sym.includes('¥') ? 'JPY' : 'USD';
    out.push({
      raw: m[0],
      value: v * (scale ?? 1),
      unit: currency,
      kind: 'currency',
      currency,
    });
    mark(m.index, m[0].length);
  }
  PERCENT.lastIndex = 0;
  while ((m = PERCENT.exec(text))) {
    if (!m[1]) continue;
    const v = toNum(m[1]);
    if (v == null) continue;
    out.push({ raw: m[0].trim(), value: v, unit: 'percent', kind: 'percent' });
    mark(m.index, m[0].length);
  }
  PLAIN.lastIndex = 0;
  while ((m = PLAIN.exec(text))) {
    if (m.index < text.length && consumed[m.index]) continue;
    const v = toNum(m[1]);
    if (v == null) continue;
    const scale = m[2] ? SCALE[m[2].toLowerCase()] : undefined;
    const unit = (m[3] ?? '').trim();
    // Skip bare years — dates.ts owns those.
    if (!unit && !scale && v >= 1500 && v <= 2100 && Number.isInteger(v)) continue;
    out.push({
      raw: m[0].trim(),
      value: v * (scale ?? 1),
      unit: unit || 'count',
      kind: unit ? 'other' : 'count',
    });
  }
  return out;
}

export function formatNum(v: number): string {
  if (Math.abs(v) >= 1e12) return (v / 1e12).toPrecision(4) + 'T';
  if (Math.abs(v) >= 1e9) return (v / 1e9).toPrecision(4) + 'B';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toPrecision(4) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toPrecision(4) + 'k';
  return String(+v.toPrecision(6));
}

/**
 * Numeric equality under unit normalization + rounding tolerance.
 * Returns 'equal' | 'differ' | 'incomparable' (different unit/currency).
 */
export function compareNumbers(a: NumericFact, b: NumericFact, relTol = 0.02):
  'equal' | 'differ' | 'incomparable' {
  if (a.value == null || b.value == null) return 'incomparable';
  if (a.kind !== b.kind) return 'incomparable';
  if (a.kind === 'currency') {
    if ((a.currency ?? 'USD') !== (b.currency ?? 'USD')) return 'incomparable';
  } else if (a.unit !== b.unit) {
    // Normalize a few known aliases.
    const norm = (u: string) =>
      ({ kms: 'km', km: 'km', tonnes: 'tonnes', tons: 'tonnes', mt: 'Mt', gt: 'Gt' }[
        u.toLowerCase()
      ] ?? u.toLowerCase());
    if (norm(a.unit) !== norm(b.unit)) return 'incomparable';
  }
  const scale = Math.max(Math.abs(a.value), Math.abs(b.value), 1);
  return Math.abs(a.value - b.value) / scale <= relTol ? 'equal' : 'differ';
}
