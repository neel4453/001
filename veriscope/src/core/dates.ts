import type { DateFact } from '../types';

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Extract date facts from a sentence. Deliberately conservative: only unambiguous
 * formats. Relative dates ("last year") are captured with precision 'relative' and a
 * note; they cannot be resolved without a reference date, which is surfaced to the user.
 */
export function extractDates(text: string): DateFact[] {
  const out: DateFact[] = [];
  const seen = new Set<number>();

  // ISO yyyy-mm-dd or yyyy-mm
  const iso = /\b(\d{4})-(\d{2})(?:-(\d{2}))?\b/g;
  let m: RegExpExecArray | null;
  while ((m = iso.exec(text))) {
    const y = +m[1];
    if (y < 1000 || y > 2100) continue;
    const f: DateFact = {
      raw: m[0],
      year: y,
      precision: m[3] ? 'day' : 'month',
    };
    if (m[2]) f.month = +m[2];
    if (m[3]) f.day = +m[3];
    out.push(f);
    for (let i = m.index; i < m.index + m[0].length; i++) seen.add(i);
  }

  // 31 January 2020 / January 31, 2020 / Jan 2020
  const md = new RegExp(
    String.raw`\b(\d{1,2})(?:st|nd|rd|th)? (?:of )?([A-Za-z]{3,9})\.? (\d{4})\b`, 'gi',
  );
  while ((m = md.exec(text))) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (!mo) continue;
    out.push({ raw: m[0], year: +m[3], month: mo, day: +m[1], precision: 'day' });
  }
  const dm = new RegExp(
    String.raw`\b([A-Za-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})\b`, 'gi',
  );
  while ((m = dm.exec(text))) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (!mo) continue;
    out.push({ raw: m[0], year: +m[3], month: mo, day: +m[2], precision: 'day' });
  }
  // Month Year
  const my = /\b([A-Za-z]{3,9}) (\d{4})\b/g;
  while ((m = my.exec(text))) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (!mo) continue;
    const yy = +m[2];
    if (out.some((d) => d.year === yy && d.month === mo)) continue;
    out.push({ raw: m[0], year: yy, month: mo, precision: 'month' });
  }
  // Bare years 1500..current+5 — only if not already inside a bigger date
  const yr = /\b(1[5-9]\d{2}|20\d{2}|2100)\b/g;
  while ((m = yr.exec(text))) {
    if ([...seen].some((i) => i === m!.index)) continue;
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (/[-/.]\s*$/.test(before) || /^[-/.]\d/.test(after)) continue; // part of other format
    out.push({ raw: m[0], year: +m[1], precision: 'year' });
  }
  // Relative markers (unresolvable without a publication date)
  const rel = /\b(last|next|this|previous|coming)\s+(year|month|week|decade|quarter)\b/gi;
  while ((m = rel.exec(text))) {
    out.push({ raw: m[0], year: null, precision: 'relative' });
  }
  return out;
}

export function dateFactToIso(d: DateFact): string | null {
  if (d.year == null) return null;
  const mm = String(d.month ?? 1).padStart(2, '0');
  const dd = String(d.day ?? 1).padStart(2, '0');
  return `${d.year}-${mm}-${dd}`;
}

/** Compare two date facts. Returns -1/0/1 or null when not comparable. */
export function compareDateFacts(a: DateFact, b: DateFact): -1 | 0 | 1 | null {
  if (a.year == null || b.year == null) return null;
  if (a.precision === 'relative' || b.precision === 'relative') return null;
  const key = (d: DateFact) =>
    d.year! * 10000 + (d.month ?? 1) * 100 + (d.day ?? 1);
  const ka = key(a);
  const kb = key(b);
  // Different precision: compare coarse bounds first.
  if (a.precision === 'year' && ka !== kb) {
    return a.year! + 1 <= Math.floor(kb / 10000) ? -1 : b.year! + 1 <= a.year! ? 1 : 0;
  }
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return 0;
}

/**
 * A claim is "historical vs current mismatch" when it asserts the present but the only
 * evidence is older than `maxAgeYears`, or it asserts a past year while being compared
 * against data explicitly labeled for a different year.
 */
export function yearsSince(iso: string | undefined, ref = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (ref.getTime() - t) / (365.25 * 24 * 3600 * 1000);
}
