import { useRef, useState } from 'react';
import type { Settings } from '../../types';
import { Btn, Chip, Glass, SectionTitle, Spinner, openTab, useToast } from '../components/ui';
import { readImageMetadata, reverseImageLinks, videoEvidenceLinks, cropFrame, type ImageMeta } from '../../core/media';
import { downloadText } from '../../core/export';

/**
 * Image & video verification (§14) — manual-first. Local EXIF/XMP inspection is real
 * and offline-capable; reverse search happens in the USER's browser tab after an
 * explicit click. We never fake results and never call paid detectors.
 */
export function MediaTab({ settings }: { settings: Settings }) {
  const [meta, setMeta] = useState<ImageMeta | null>(null);
  const [fileName, setFileName] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [frameDataUrl, setFrameDataUrl] = useState<string | null>(null);
  const [frameMsg, setFrameMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const links = reverseImageLinks(imgUrl || undefined);

  const handleFile = async (f: File) => {
    setBusy(true); setFileName(f.name);
    try { setMeta(await readImageMetadata(f)); } finally { setBusy(false); }
  };

  const captureFrame = async () => {
    setFrameMsg(null);
    if (typeof chrome === 'undefined' || !chrome.tabs) return void toast({ kind: 'error', text: 'Frame capture requires the extension runtime (loaded unpacked).' });
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const res: any = await chrome.runtime.sendMessage({ type: 'vs:capture-frame', tabId: tab.id, windowId: tab.windowId });
      if (!res?.ok) throw new Error(res?.error ?? 'capture failed');
      const cropped = await cropFrame(res.dataUrl, res.rect, tab.width ?? 1280, (window as any).innerHeight ?? 800);
      setFrameDataUrl(cropped);
      setFrameMsg('Frame captured from the visible tab. Save it, then drag it into Lens/TinEye (their upload flows reject programmatic use by design).');
    } catch (e) {
      setFrameMsg((e as Error).message);
    }
  };

  const report = () => {
    const L: string[] = ['# Image/video evidence report', '', `File: ${fileName || '(none)'}`, `Image URL: ${imgUrl || '(none)'}`, ''];
    if (meta) {
      L.push('## Metadata (read locally)', '');
      for (const [k, v] of Object.entries(meta.raw).slice(0, 60)) L.push(`- ${k}: ${String(v).slice(0, 120)}`);
      if (meta.gps) L.push(`- GPS: ${meta.gps.lat.toFixed(5)}, ${meta.gps.lon.toFixed(5)} — verify against visible landmarks/weather/sun angle before trusting`);
      L.push('', '## Provenance hints', '');
      for (const h of meta.c2paHints) L.push(`- ${h}`);
      if (meta.error) L.push('', `> ${meta.error}`);
    }
    L.push('', '## Manual checks performed by the user (fill in)', '');
    for (const l of links) L.push(`- [ ] ${l.label}: ${l.url}`);
    L.push('', '## Limits', '', 'No detector here can prove authenticity; absence of metadata does not prove manipulation. Old images get new captions more often than images get edited.');
    downloadText('veriscope-image-report.md', L.join('\n'), 'text/markdown');
  };

  return (
    <div className="stack">
      <Glass className="card">
        <SectionTitle right={<Chip>local metadata + user-clicked tools</Chip>}>Image & video evidence</SectionTitle>
        <div className="row">
          <Btn onClick={() => fileRef.current?.click()}>Choose image…</Btn>
          <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/tiff,image/webp,image/heic" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <input style={{ flex: 1 }} placeholder="…or paste a public image URL" value={imgUrl} onChange={(e) => setImgUrl(e.target.value.trim())} aria-label="Public image URL" />
          <Btn size="sm" onClick={captureFrame}>📹 Capture frame from active tab</Btn>
        </div>
        {busy && <Spinner label="Reading metadata locally…" />}
        {frameDataUrl && (
          <div className="neo-inset" style={{ padding: 10, marginTop: 8 }}>
            <img src={frameDataUrl} alt="Captured video frame preview" style={{ maxWidth: '100%', borderRadius: 8 }} />
            <div className="row" style={{ marginTop: 6 }}>
              <a href={frameDataUrl} download="veriscope-frame.png" className="btn btn-sm" style={{ textDecoration: 'none' }}>⬇ Save frame (PNG)</a>
              <span className="tiny">or right-click the image → “Save image as…”</span>
            </div>
            {frameMsg && <p className="tiny">{frameMsg}</p>}
          </div>
        )}
        {frameMsg && !frameDataUrl && <p className="tiny" style={{ color: 'var(--danger)' }}>{frameMsg}</p>}
      </Glass>

      {meta && (
        <Glass className="card">
          <SectionTitle>Metadata — {fileName}</SectionTitle>
          {meta.error && <p className="tiny" role="status">{meta.error}</p>}
          <div className="grid2">
            {meta.maker && <div><span className="tiny">Camera</span><br />{meta.maker} {meta.model}</div>}
            {meta.software && <div><span className="tiny">Software field</span><br /><span className="mono">{meta.software}</span></div>}
            {meta.dateTimeOriginal && <div><span className="tiny">Capture time (claimed)</span><br />{new Date(meta.dateTimeOriginal).toLocaleString()}</div>}
            {meta.modifyDate && <div><span className="tiny">Modify time</span><br />{new Date(meta.modifyDate).toLocaleString()}</div>}
            {(meta.width && meta.height) ? <div><span className="tiny">Pixels</span><br />{meta.width}×{meta.height}</div> : null}
            {meta.gps && <div><span className="tiny">GPS</span><br /><a href={`https://www.openstreetmap.org/?mlat=${meta.gps.lat}&mlon=${meta.gps.lon}#map=14/${meta.gps.lat}/${meta.gps.lon}`} target="_blank" rel="noreferrer">{meta.gps.lat.toFixed(4)}, {meta.gps.lon.toFixed(4)} ↗</a></div>}
          </div>
          <ul className="tiny" style={{ paddingLeft: 16 }}>{meta.c2paHints.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </Glass>
      )}

      <Glass className="card">
        <SectionTitle>Guided verification steps</SectionTitle>
        {links.map((l) => (
          <div key={l.label} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--surface-border)' }}>
            <span><strong>{l.label}</strong>{l.note && <div className="tiny">{l.note}</div>}</span>
            <Btn size="sm" onClick={() => openTab(l.url)}>Open {imgUrl ? 'with this image' : 'tool'} ↗</Btn>
          </div>
        ))}
        {settings.mode === 'offline' && <p className="tiny">Strict offline mode: the extension made NO requests. These links open YOUR browser when clicked — that is a deliberate, visible user action.</p>}
        <div className="row" style={{ marginTop: 8 }}>
          <Btn size="sm" onClick={report}>⬇ Export evidence report (.md)</Btn>
        </div>
      </Glass>

      <Glass className="card">
        <SectionTitle>Video / long-footage checks</SectionTitle>
        {videoEvidenceLinks(undefined).map((v) => (
          <div key={v.label} className="row between" style={{ padding: '6px 0' }}>
            <span><strong>{v.label}</strong>{v.note && <div className="tiny">{v.note}</div>}</span>
            <Btn size="sm" onClick={() => openTab(v.url)}>Open ↗</Btn>
          </div>
        ))}
      </Glass>
    </div>
  );
}
