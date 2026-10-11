import type { ClaimSpan, DocumentFinding, NumericFact, ParsedDocument } from '../../types';
import { splitSentences } from '../sentences';
import { extractDates } from '../dates';
import { extractNumbers, compareNumbers } from '../units';
import { normalizeText, similarity, uid } from '../util';
import { isSafeHttpUrl } from '../util';

/**
 * Document inspection heuristics (§11). Every finding is labeled
 * humanReviewRequired: a flagged contradiction is a CANDIDATE inconsistency found by
 * text analysis, not a legal or scientific judgment.
 */

export interface CheckOptions {
  /** When online & enabled, DOIs are checked against Crossref metadata. Offline: format-only. */
  doiLookup?: (doi: string) => Promise<{ ok: boolean; found: boolean; error?: string; title?: string }>;
}

export async function analyzeDocument(doc: ParsedDocument, opts: CheckOptions = {}): Promise<DocumentFinding[]> {
  const out: DocumentFinding[] = [];
  const text = doc.text;
  if (!text || text.length < 40) {
    if (text !== '') out.push(f('extraction-error', 'strong', 'The extracted text is nearly empty. Either the document has no text layer or extraction failed — findings below (if any) are unreliable.', { start: 0, end: Math.max(text.length, 1) }));
    return out;
  }

  // Paragraph-aware: newline boundaries end sentences, so a document title fused to
  // the first paragraph cannot mask verbatim-duplicate detection (offsets stay document-relative).
  const sentences: { text: string; start: number; end: number }[] = [];
  let paraOff = 0;
  for (const para of text.split(/\n+/)) {
    for (const sn of splitSentences(para)) sentences.push({ text: sn.text, start: sn.start + paraOff, end: sn.end + paraOff });
    paraOff += para.length + 1;
  }
  const pageFor = (pos: number): string | undefined => {
    if (!doc.pages) return undefined;
    const p = doc.pages.find((pg) => pos >= pg.start && pos <= pg.end);
    return p ? `page ${p.page}` : undefined;
  };

  // 1) Duplicate passages (≥40 normalized chars)
  const seen = new Map<string, number>();
  for (const s of sentences) {
    const n = normalizeText(s.text);
    if (n.length < 40) continue;
    if (seen.has(n)) {
      out.push(f('duplicate-passage', 'review', `This passage appears verbatim a second time (first at offset ${seen.get(n)}).`, s, pageFor(s.start)));
    } else seen.set(n, s.start);
  }

  // 2) Conflicting dates: high topical overlap, different explicit dates
  for (let i = 0; i < sentences.length; i++) {
    const a = sentences[i];
    const ad = extractDates(a.text).filter((d) => d.year != null);
    if (!ad.length) continue;
    for (let j = i + 1; j < sentences.length; j++) {
      if (j - i > 150) break;
      const b = sentences[j];
      const bd = extractDates(b.text).filter((d) => d.year != null);
      if (!bd.length) continue;
      const ov = similarity(a.text, b.text);
      if (ov >= 0.35) {
        const ay = ad[0].year!, by = bd[0].year!;
        if (ay !== by) {
          out.push(f(
            'conflicting-date', 'review',
            `Two similar statements give different dates (${ay} vs ${by}; overlap ${(ov * 100) | 0}%). One may be signing vs. effective/ratification — check the wording`,
            a, pageFor(a.start),
          ));
        }
      }
    }
  }

  // 3) Inconsistent numbers: similar context, different values, same unit/currency.
  //    Only compare at least one "meaningful" figure (currency/percent/units) so that
  //    incidental integers (Article 1 vs Article 14) don't produce noise findings.
  const meaningful = (n: NumericFact) =>
    n.kind === 'currency' || n.kind === 'percent' || (!!n.unit && n.unit !== 'count');
  for (let i = 0; i < sentences.length; i++) {
    const a = sentences[i];
    const an = extractNumbers(a.text);
    if (!an.length) continue;
    for (let j = i + 1; j < sentences.length; j++) {
      if (j - i > 150) break;
      const b = sentences[j];
      if (similarity(a.text, b.text) < 0.4) continue;
      for (const x of an) {
        for (const y of extractNumbers(b.text)) {
          const cmp = compareNumbers(x, y);
          if (cmp === 'differ' && (meaningful(x) || meaningful(y))) {
            out.push(f(
              'inconsistent-number', 'review',
              `The same topic is reported with different figures: "${x.raw}" vs "${y.raw}". Verify which measure/period each refers to.`,
              a, pageFor(a.start),
            ));
          } else if (cmp === 'incomparable' && x.value != null && y.value != null && x.kind === 'currency' && y.kind === 'currency' && x.currency !== y.currency) {
            out.push(f('unit-mismatch', 'info', `Figures "${x.raw}" and "${y.raw}" use different currencies. No exchange-rate conversion is applied; totals may silently differ.`, a, pageFor(a.start)));
          }
        }
      }
    }
  }

  // 4) Citations
  const refSection = /\b(References|Bibliography|Works cited|Citations|NOTES AND REFERENCES)\b/i.test(text);
  const doiSeen = new Set<string>();
  for (const m of text.matchAll(/\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/gi)) {
    const doi = m[1].replace(/[.,;)\]]+$/, '');
    if (doiSeen.has(doi)) continue;
    doiSeen.add(doi);
    const span = { start: m.index!, end: m.index! + m[0].length };
    if (opts.doiLookup) {
      const res = await opts.doiLookup(doi);
      if (!res.ok) out.push(f('citation-error', 'info', `DOI ${doi}: lookup failed (${res.error}). Format looks valid; content unverified.`, span));
      else if (!res.found) out.push(f('citation-error', 'strong', `DOI ${doi} did not resolve in Crossref. It may be fake, deprecated, or Crossref-unregistered (preprints often are).`, span));
    } else {
      out.push({
        ...f('citation-error', 'info', `DOI ${doi} format is valid; not looked up (offline mode or lookups disabled).`, span),
      });
    }
  }
  for (const m of text.matchAll(/\bhttps?:\/\/[^\s"'<>)\]]+/g)) {
    if (!isSafeHttpUrl(m[0])) {
      out.push(f('citation-error', 'review', `Citation-like URL uses a disallowed scheme: ${m[0].slice(0, 80)}`, { start: m.index!, end: m.index! + m[0].length }));
    }
  }
  const bracketRefs = [...text.matchAll(/\[(\d{1,3})\]/g)].map((m) => +m[1]);
  if (bracketRefs.length) {
    const maxRef = Math.max(...bracketRefs);
    if (!refSection) {
      out.push(f('missing-reference', 'review', `The text cites [1]..[${maxRef}] but no reference list was detected. Citations cannot be checked against a source list.`, { start: bracketRefs[0], end: bracketRefs[0] + 1 }));
    }
  }
  const authorYear = /\(([A-Z][a-zA-Z'-]+)(?: et al\.| and [A-Z][a-zA-Z'-]+)?,? (1[89]\d\d|20\d\d)\)/g;
  const ayCount = Math.min([...text.matchAll(authorYear)].length, 400);
  if (ayCount >= 3 && !refSection) {
    out.push(f('missing-reference', 'review', `Author-year citations were used ${ayCount}+ times but no References/Bibliography section was found.`, { start: 0, end: 40 }));
  }

  // 5) Terminology shifts: capitalized defined terms used with two different definitions
  const defs = new Map<string, { text: string; span: ClaimSpan }[]>();
  const defRe = /([A-Z][A-Za-z-]{2,28})\s+(?:means|shall mean|is defined as|refers to|hereinafter|"|“)([^."”\n]{10,160})/g;
  for (const m of text.matchAll(defRe)) {
    const term = m[1];
    const list = defs.get(term) ?? [];
    list.push({ text: m[2], span: { start: m.index!, end: m.index! + m[0].length } });
    defs.set(term, list);
  }
  for (const [term, list] of defs) {
    if (list.length >= 2 && similarity(list[0].text, list[1].text) < 0.35) {
      out.push(f('terminology-shift', 'review', `"${term}" is defined more than once with different wording. Unexplained definitional drift can change meaning between sections.`, list[1].span));
    }
  }

  // 6) Legal ambiguity wording (flag only — never a legality judgment)
  const amb = /\b(reasonable(?:ly)? to the extent|to the extent appropriate|from time to time|as (?:it|they|the (?:board|committee|party)) (?:may )?(?:deem|determine|consider) appropriate|material adverse|good faith|best efforts|without undue delay|substantially all)\b/gi;
  let ambN = 0;
  for (const m of text.matchAll(amb)) {
    ambN++;
    if (ambN > 25) break;
    out.push(f('ambiguous-wording', 'info', `Ambiguous legal phrasing “${m[0]}”. Such clauses need HUMAN legal review — unusual wording is not evidence of unlawfulness.`, { start: m.index!, end: m.index! + m[0].length }));
  }

  // 7) Outdated statistics: explicit "as of"/year claims older than 8 years relative to now
  const thisYear = new Date().getFullYear();
  for (const s of sentences.slice(0, 4000)) {
    if (!/\b(as of|according to|official|reported|data from|in)\b/i.test(s.text)) continue;
    const ds = extractDates(s.text).filter((d) => d.year);
    if (ds.length && thisYear - ds[0].year! >= 8 && /\b(\d|million|billion|%)\b/.test(s.text) && /\b(?:population|GDP|revenue|emissions|deaths|cases|rate|total)\b/i.test(s.text)) {
      out.push(f('outdated-statistic', 'review', `A statistic tied to ${ds[0].year} may be superseded; current official data was NOT fetched in this check. Re-verify before citing.`, s));
    }
  }

  return out;
}

function f(kind: DocumentFinding['kind'], severity: DocumentFinding['severity'], message: string, span: ClaimSpan, section?: string): DocumentFinding {
  return { id: uid('find'), kind, severity, message, span, section, humanReviewRequired: true };
}

/** Unsupported-assertion pass: strong universal claims without citation (kept separate: it needs doc-wide context). */
export function unsupportedAssertions(passage: string): { text: string; span: ClaimSpan; why: string }[] {
  const out: { text: string; span: ClaimSpan; why: string }[] = [];
  for (const s of splitSentences(passage)) {
    if (/\b(all|every|none|no one|nobody|always|never|100%|undoubtedly|without question)\b/i.test(s.text)
      && !/\b(?:according to|study|survey|data|census|report|source|said|stated)\b/i.test(s.text)
      && s.text.length > 30) {
      out.push({ text: s.text, span: { start: s.start, end: s.end }, why: 'Universal/absolute wording with no cited basis in the sentence itself' });
    }
  }
  return out;
}
