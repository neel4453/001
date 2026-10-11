/**
 * Sentence segmentation. Deliberately conservative: better to keep two sentences
 * joined than to split "Mr. Obama said in 1998" into fragments.
 */

const ABBREVS = new Set([
  'mr','mrs','ms','dr','prof','sr','jr','st','st.','vs','etc','e.g','i.e','cf','approx',
  'no','nos','fig','figs','vol','vols','jan','feb','mar','apr','jun','jul','aug','sep',
  'sept','oct','nov','dec','dept','univ','govt','sec','gen','lt','col','sgt','rep','sen',
  'inc','ltd','co','corp','ph.d','u.n','u.s','u.k','e.u','est','d.c','a.d','b.c','b.c.e',
  'c.e','no.','vice','pres','spp','al','etc.','fig.','pp','para','ch','ed','eds','trans',
]);

function isProbablyEnd(text: string, dotIdx: number): boolean {
  // Look at the char after the dot: uppercase-ish start => likely sentence end.
  const after = text.slice(dotIdx + 1, dotIdx + 40);
  if (!after || /^\s*$/.test(after)) return true;
  if (!/^\s/.test(text[dotIdx + 1] ?? ' ')) return false; // "end.Next" (rare) -> treat as no split unless space
  const before = text.slice(Math.max(0, dotIdx - 24), dotIdx);
  const lastWord = before.split(/[\s(]+/).pop() ?? '';
  const bare = lastWord.replace(/\.$/, '').toLowerCase();
  if (ABBREVS.has(bare) || ABBREVS.has(bare + '.')) return false;
  if (/^\d{1,2}$/.test(bare)) return false; // "No. 5" / "12." ordinals — stay attached
  // Four-digit years end sentences normally ("...in 2018. It cost...").
  if (/^(e|E)$/.test(lastWord)) return false; // "e.g."
  if (/[.!?]["'”’)\]]?\s+[A-Z0-9“"'‘([]/.test(text.slice(dotIdx, dotIdx + 40))) {
    return true;
  }
  return /[.!?]["'”’)\]]?\s+[A-Z]/.test(text.slice(dotIdx, Math.min(text.length, dotIdx + 60)));
}

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

export function splitSentences(input: string): Sentence[] {
  const text = input.replace(/\s+/g, ' ').trim();
  const out: Sentence[] = [];
  // Offset map: we collapsed whitespace, so recompute starts by searching forward.
  let cursor = 0;
  let bufStart = 0;
  let i = 0;
  const push = (endIdx: number) => {
    const raw = text.slice(bufStart, endIdx).trim();
    if (!raw) return;
    const found = input.indexOf(raw.slice(0, 60), cursor);
    const start = found >= 0 ? found : cursor;
    out.push({ text: raw, start, end: start + raw.length });
    cursor = start + raw.length;
  };
  while (i < text.length) {
    const ch = text[i];
    if ((ch === '.' || ch === '!' || ch === '?') && isProbablyEnd(text, i)) {
      let j = i + 1;
      while (j < text.length && /["'”’)\]]/.test(text[j])) j++;
      push(j);
      i = j;
      bufStart = i;
      continue;
    }
    i++;
  }
  if (bufStart < text.length) push(text.length);
  return out;
}
