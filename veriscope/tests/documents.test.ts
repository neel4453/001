import { describe, expect, it } from 'vitest';
import { parseDocument, parseCsvRows, detectFormat } from '../src/core/documents/parse';
import { analyzeDocument, unsupportedAssertions } from '../src/core/documents/checks';
import { zipSync, strToU8 } from 'fflate';

const enc = (s: string) => new TextEncoder().encode(s).buffer;

describe('document parsing', () => {
  it('routes by extension and magic bytes', async () => {
    expect(detectFormat('a.md', enc('# t'))).toBe('md');
    expect(detectFormat('mystery', new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3, 4]).buffer)).toBe('pdf');
    expect(detectFormat('mystery', enc('hello world'))).toBe(null);
  });
  it('parses txt with no uploads', async () => {
    const doc = await parseDocument('note.txt', enc('The treaty was signed in 2018.'));
    expect(doc.text).toContain('2018');
  });
  it('flattens json', async () => {
    const doc = await parseDocument('d.json', enc(JSON.stringify({ a: { b: 5 }, c: [1, 2] })));
    expect(doc.text).toContain('a.b: 5');
    expect(doc.text).toContain('c[1]: 2');
  });
  it('parses csv rows with quotes/commas', () => {
    const rows = parseCsvRows('name,notes\n"Smith, J","said ""hi"""\n');
    expect(rows[1]).toEqual(['Smith, J', 'said "hi"']);
  });
  it('parses docx (OOXML) built with fflate', async () => {
    const xml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>First paragraph about emissions.</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph &amp; co.</w:t></w:r></w:p></w:body></w:document>';
    const zipped = zipSync({ 'word/document.xml': strToU8(xml), 'docProps/core.xml': strToU8('<cp:coreProperties><dc:creator>Tester</dc:creator></cp:coreProperties>') });
    const doc = await parseDocument('t.docx', zipped.buffer as ArrayBuffer);
    expect(doc.format).toBe('docx');
    expect(doc.text).toContain('First paragraph about emissions.');
    expect(doc.text).toContain('Second paragraph & co.');
    expect(doc.meta?.['dc:creator']).toBe('Tester');
  });
  it('flags scanned-looking pdfs without inventing text', async () => {
    const doc = await parseDocument('fake.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]).buffer as ArrayBuffer);
    expect(doc.text).toBe('');
    expect(doc.warnings.join(' ')).toMatch(/PDF parsing failed|SCANNED/i);
  });
});

describe('internal-consistency checks', () => {
  it('detects conflicting dates for the same agreement', async () => {
    const text = 'The Paris Accord was signed by 190 parties in 2016 at the UN headquarters. The Paris Accord was signed by 187 parties in 2015 at the UN headquarters.';
    const doc = await parseDocument('treaty.txt', enc(text));
    const findings = await analyzeDocument(doc);
    expect(findings.some((f) => f.kind === 'conflicting-date')).toBe(true);
  });
  it('detects inconsistent numbers with the same unit', async () => {
    const text = 'The ministry reported total spending of $5 billion for the rural program in 2021. The ministry reported total spending of $9 billion for the rural program in 2021.';
    const findings = await analyzeDocument({ name: 'a.txt', format: 'txt', text, warnings: [] });
    expect(findings.some((f) => f.kind === 'inconsistent-number')).toBe(true);
  });
  it('detects duplicate passages', async () => {
    const s = 'Emissions from the energy sector increased by 2.3% year over year in the full fiscal reporting cycle.';
    const findings = await analyzeDocument({ name: 'a.txt', format: 'txt', text: `${s} More here. ${s} More here.`, warnings: [] });
    expect(findings.some((f) => f.kind === 'duplicate-passage')).toBe(true);
  });
  it('DOIs: format-checked offline, resolved via Crossref when lookup provided', async () => {
    const text = 'As shown in recent research (10.1000/xyz123), results hold up under scrutiny for most cases today.';
    const doc = { name: 'p.txt', format: 'txt' as const, text, warnings: [] };
    const off = await analyzeDocument(doc);
    expect(off.some((f) => f.kind === 'citation-error' && /format is valid/.test(f.message))).toBe(true);
    const on = await analyzeDocument(doc, { doiLookup: async () => ({ ok: true, found: false }) });
    expect(on.some((f) => /did not resolve/i.test(f.message))).toBe(true);
  });
  it('legal ambiguity is flagged as review — not unlawfulness', async () => {
    const text = 'The board may, to the extent appropriate from time to time, use best efforts and act in good faith to remedy any material adverse change in the business of the company described in this schedule.';
    const findings = await analyzeDocument({ name: 'contract.txt', format: 'txt', text, warnings: [] });
    const amb = findings.filter((f) => f.kind === 'ambiguous-wording');
    expect(amb.length).toBeGreaterThan(0);
    expect(amb[0].message).toMatch(/human/i);
    expect(amb.every((f) => f.humanReviewRequired)).toBe(true);
  });
  it('unsupported assertions heuristic', () => {
    const u = unsupportedAssertions('Everybody knows that all vaccines cause autism and nothing is tested at all.');
    expect(u.length).toBeGreaterThan(0);
  });
  it('empty extraction yields an extraction-error finding, not a fake analysis', async () => {
    const findings = await analyzeDocument({ name: 'x.pdf', format: 'pdf', text: 'short', warnings: [] });
    expect(findings.some((f) => f.kind === 'extraction-error')).toBe(true);
  });
});
