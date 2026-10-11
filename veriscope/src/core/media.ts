import { isSafeHttpUrl } from './util';

/**
 * Image & video verification (§14) — manual-first by design.
 * Local metadata inspection is real; reverse-image matching is opened by the USER
 * (we never fake results and never upload without a click).
 */

export interface ImageMeta {
  maker?: string;
  model?: string;
  software?: string;
  dateTimeOriginal?: string;
  modifyDate?: string;
  gps?: { lat: number; lon: number };
  width?: number;
  height?: number;
  orientation?: number;
  xmpPresent: boolean;
  c2paHints: string[];
  raw: Record<string, string | number>;
  error?: string;
}

export async function readImageMetadata(file: File): Promise<ImageMeta> {
  const out: ImageMeta = { xmpPresent: false, c2paHints: [], raw: {} };
  try {
    const exifr = (await import('exifr')).default;
    const buf = await file.arrayBuffer();
    const meta = (await exifr.parse(buf, { xmp: true, tiff: true, gps: true })) as any;
    if (!meta) {
      out.error = 'No EXIF/XMP metadata found (common for social-media re-uploads — absence proves nothing).';
      return out;
    }
    out.maker = meta.Make; out.model = meta.Model; out.software = meta.Software;
    out.dateTimeOriginal = meta.DateTimeOriginal ? new Date(meta.DateTimeOriginal).toISOString() : undefined;
    out.modifyDate = meta.ModifyDate ? new Date(meta.ModifyDate).toISOString() : undefined;
    if (meta.latitude != null && meta.longitude != null) out.gps = { lat: meta.latitude, lon: meta.longitude };
    out.width = meta.ImageWidth ?? meta.ExifImageWidth; out.height = meta.ImageHeight ?? meta.ExifImageHeight;
    out.orientation = meta.Orientation;
    for (const [k, v] of Object.entries(meta)) {
      if (v == null) continue;
      out.raw[k] = typeof v === 'object' && v instanceof Date ? v.toISOString() : String(v).slice(0, 160);
    }
    const xmpKeys = Object.keys(meta).filter((k) => /XMP|dc:|Iptc4xmp|photoshop|crs|tiff:Software/i.test(k));
    out.xmpPresent = xmpKeys.length > 0;
    const software = String(meta.Software ?? '');
    if (/generative|stable diffusion|midjourney|dall|firefly|adobe.?stock|leonardo/i.test(software)) out.c2paHints.push(`Software field mentions a generative tool: "${software}" (weak signal; easily stripped)`);
    if (/firefly|content ?authenticity/i.test(Object.keys(meta).join(' '))) out.c2paHints.push('Adobe Content Authenticity/XMP fields present — open contentcredentials.org/verify for the full manifest.');
    if (!out.c2paHints.length) out.c2paHints.push('C2PA manifest was not checked in depth: full Content Credentials validation needs the c2pa-tools CLI (free, local). VeriScope only inspects basic XMP hints.');
  } catch (e) {
    out.error = `Metadata read failed: ${(e as Error).message}. Supported: JPEG, PNG, TIFF, HEIC, some WebP. Nothing was uploaded.`;
  }
  return out;
}

export interface ReverseSearchLink { label: string; url: string; needs: 'image-url'; note: string }

/** Links for images ALREADY public (URLs). For local files the user drags them to the tool. */
export function reverseImageLinks(imageUrl: string | undefined): ReverseSearchLink[] {
  const links: ReverseSearchLink[] = [
    { label: 'Google Lens', needs: 'image-url', note: 'Opens upload-by-URL. For local files, save the frame and drag it onto lens.google.com.', url: imageUrl ? `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}` : 'https://lens.google.com/' },
    { label: 'TinEye', needs: 'image-url', note: 'Free web search (API is paid; not used).', url: imageUrl ? `https://tineye.com/search?url=${encodeURIComponent(imageUrl)}` : 'https://tineye.com/' },
    { label: 'Bing Visual Search', needs: 'image-url', url: imageUrl ? `https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIVSP&sbisrc=UrlPaste&q=imgurl:${encodeURIComponent(imageUrl)}` : 'https://www.bing.com/visualsearch', note: '' },
    { label: 'Wayback: find older appearances of a page', needs: 'image-url', url: 'https://web.archive.org/', note: 'Search the HOSTING PAGE url to see how it changed over time.' },
    { label: 'Content Credentials verifier', needs: 'image-url', url: 'https://contentcredentials.org/verify', note: 'Paste the image URL; reads C2PA manifests when present.' },
    { label: 'InVID-WeVerify plugin tools', needs: 'image-url', url: 'https://weverify.eu/verification/', note: 'Keyframe/OCR/geo tools run in your browser.' },
  ];
  return links;
}

/** First-appearance helpers for a claim source URL. */
export function videoEvidenceLinks(url: string | undefined) {
  const base = [
    { label: 'Wayback Machine (page snapshots)', url: url ? `https://web.archive.org/web/*/${url}` : 'https://web.archive.org/', note: 'Older captures may show earlier captions/views.' },
    { label: 'YouTube Data (free key required — optional)', url: 'https://developers.google.com/youtube/v3/getting-started', note: 'No key-free API; open the upload date on the platform directly.' },
  ];
  return base;
}

export function safeImageUrl(u: string | undefined): string | undefined {
  return u && isSafeHttpUrl(u) ? u : undefined;
}

/** Frame capture: crops the visible-tab screenshot to a video element rect, locally. */
export async function cropFrame(dataUrl: string, rect: { x: number; y: number; width: number; height: number }, vw: number, vh: number): Promise<string> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('frame decode failed'));
    img.src = dataUrl;
  });
  const sx = img.width / vw;
  const sy = img.height / vh;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(rect.width * sx));
  canvas.height = Math.max(2, Math.round(rect.height * sy));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, Math.round(rect.x * sx), Math.round(rect.y * sy), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
