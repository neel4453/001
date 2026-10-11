import type { ParsedDocument } from '../../types';

/**
 * Local document parsing. Files are read with the browser FileReader in the extension
 * page — they are NEVER uploaded anywhere. PDF text extraction uses pdfjs-dist locally.
 */

const TEXT_EXT = new Set(['txt', 'md', 'markdown', 'html', 'htm', 'csv', 'json', 'log']);

export function detectFormat(name: string, buf: ArrayBuffer): ParsedDocument['format'] | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'csv') return 'csv';
  if (ext === 'json') return 'json';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (TEXT_EXT.has(ext)) return 'txt';
  const head = new Uint8Array(buf.slice(0, 8));
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf'; // %PDF
  if (head[0] === 0x50 && head[1] === 0x4b) return 'docx'; // ZIP container → treat as docx attempt
  return null;
}

export async function parseDocument(name: string, buf: ArrayBuffer): Promise<ParsedDocument> {
  const format = detectFormat(name, buf);
  if (!format) {
    return {
      name, format: 'txt', text: '',
      warnings: [`Unsupported file type. Supported: PDF, TXT, Markdown, HTML, DOCX (text layer), CSV, JSON. Other formats need conversion first.`],
    };
  }
  switch (format) {
    case 'pdf': return parsePdf(name, buf);
    case 'docx': return parseDocx(name, buf);
    case 'csv': return parseCsv(name, buf);
    case 'json': return parseJson(name, buf);
    case 'html': return parseHtml(name, buf);
    default: return { name, format, text: decode(buf), warnings: [] };
  }
}

function decode(buf: ArrayBuffer): string {
  const dec = new TextDecoder('utf-8', { fatal: false });
  return dec.decode(buf).replace(/\r\n/g, '\n');
}

async function parsePdf(name: string, buf: ArrayBuffer): Promise<ParsedDocument> {
  const warnings: string[] = [];
  try {
    const pdfjs = await import('pdfjs-dist');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url' as any)).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise;
    let text = '';
    const pages: { page: number; start: number; end: number }[] = [];
    const meta: Record<string, string> = {};
    const info = await doc.getMetadata().catch(() => null);
    const anyInfo = (info as any)?.info;
    if (anyInfo) for (const k of ['Title', 'Author', 'CreationDate', 'ModDate', 'Producer', 'Creator']) {
      if (anyInfo[k]) meta[k] = String(anyInfo[k]);
    }
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const start = text.length;
      const chunks: string[] = [];
      let lastY: number | null = null;
      for (const item of content.items as any[]) {
        if (!('str' in item)) continue;
        const y = item.transform?.[5] ?? 0;
        if (lastY != null && Math.abs(y - lastY) > 6) chunks.push('\n');
        chunks.push(item.str);
        lastY = y;
      }
      const pageText = chunks.join(' ').replace(/\s+/g, ' ').replace(/\n /g, '\n');
      text += `\n\n[Page ${p}]\n${pageText}`;
      pages.push({ page: p, start, end: text.length });
    }
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (trimmed.length < 40 && doc.numPages > 0) {
      warnings.push('Very little text was extracted from this PDF. It is likely a SCANNED image-only document: OCR is required first (enable the optional local engine — local OCR — see docs). No text was invented to compensate.');
    }
    if (/^[0-9a-f]{40,}$/im.test(trimmed)) warnings.push('Document contains long hex blobs — possible corruption or extraction artifact.');
    return { name, format: 'pdf', text, pages, warnings, meta };
  } catch (e) {
    return {
      name, format: 'pdf', text: '', warnings: [
        `PDF parsing failed locally: ${(e as Error).message}. The file was NOT sent anywhere. If this is a malformed/encrypted PDF, decrypt it first.`,
      ],
    };
  }
}

async function parseDocx(name: string, buf: ArrayBuffer): Promise<ParsedDocument> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const warnings: string[] = [];
  try {
    const files = unzipSync(new Uint8Array(buf), {
      filter: (f) => f.name === 'word/document.xml' || f.name === 'docProps/core.xml',
    });
    const xml = strFromU8(files['word/document.xml']);
    if (!xml) throw new Error('word/document.xml missing — not a valid DOCX (legacy .doc is NOT supported; convert to .docx or PDF).');
    // crude but reliable: paragraphs then strip tags
    let text = xml
      .replace(/<w:tab[^>]*\/>/g, '\t')
      .replace(/<\/w:p>/g, '\n\n')
      .replace(/<w:instrText[^>]*>[\s\S]*?<\/w:instrText>/g, '')
      .replace(/<[^>]+>/g, '');
    text = decodeEntities(text);
    let meta: Record<string, string> | undefined;
    try {
      const core = strFromU8(files['docProps/core.xml'] ?? new Uint8Array());
      meta = {};
      for (const m of core.matchAll(/<(dc:creator|cp:lastModifiedBy|dcterms:created|dcterms:modified)[^>]*>([^<]*)</g)) {
        meta[m[1]] = m[2];
      }
    } catch {}
    return { name, format: 'docx', text: text.replace(/\n{3,}/g, '\n\n').trim(), warnings, meta };
  } catch (e) {
    return { name, format: 'docx', text: '', warnings: [`DOCX parsing failed: ${(e as Error).message}. Nothing was uploaded.`] };
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&');
}

function parseHtml(name: string, buf: ArrayBuffer): ParsedDocument {
  const raw = decode(buf);
  const text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const title = /<title[^>]*>([^<]{3,120})/i.exec(raw)?.[1]?.trim();
  return { name, format: 'html', text, warnings: ['HTML tags were stripped; embedded scripts/styles were ignored (never executed).'], meta: title ? { Title: decodeEntities(title) } : undefined };
}

function parseCsv(name: string, buf: ArrayBuffer): ParsedDocument {
  const raw = decode(buf);
  const rows = parseCsvRows(raw);
  if (!rows.length) return { name, format: 'csv', text: raw, warnings: ['No CSV rows parsed.'] };
  const header = rows[0];
  const lines = rows.map((r, i) => (i === 0 ? r.join(' | ') : header.map((h, j) => `${h}=${r[j] ?? ''}`).join('; ')));
  return {
    name, format: 'csv', text: lines.join('\n'),
    warnings: [`Parsed ${rows.length - 1} data row(s), ${header.length} column(s). Numeric claims from tables are extracted from the flattened text.`],
    meta: { columns: header.slice(0, 12).join(', ') },
  };
}

export function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQuotes) {
      if (c === '"') {
        if (raw[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function parseJson(name: string, buf: ArrayBuffer): ParsedDocument {
  const raw = decode(buf);
  try {
    const data = JSON.parse(raw);
    const flat: string[] = [];
    flatten(data, '', flat, 4000);
    return { name, format: 'json', text: flat.join('\n'), warnings: [`JSON flattened to ${flat.length} key-value line(s) for claim extraction.`] };
  } catch (e) {
    return { name, format: 'json', text: raw, warnings: [`JSON is malformed (${(e as Error).message}); analyzed as plain text.`] };
  }
}

function flatten(v: unknown, path: string, out: string[], depth = 6): void {
  if (depth < 0 || out.length > 20000) return;
  if (v === null || v === undefined) return;
  if (typeof v !== 'object') { out.push(`${path}: ${String(v)}`); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => flatten(x, `${path}[${i}]`, out, depth - 1)); return; }
  for (const [k, x] of Object.entries(v as object)) flatten(x, path ? `${path}.${k}` : k, out, depth - 1);
}
