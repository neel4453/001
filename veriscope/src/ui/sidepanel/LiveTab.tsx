import { useCallback, useEffect, useRef, useState } from 'react';
import type { Settings } from '../../types';
import { Btn, Chip, Glass, SectionTitle, SwitchRow, useToast } from '../components/ui';
import { speechApiAvailable, startCloudTranscription, parseTranscript, type TranscriptSegment } from '../../core/speech';
import { extractClaims } from '../../core/claims';
import { verifyPassage } from '../../core/verify';
import type { Investigation } from '../../types';
import { transcriptReportToMarkdown, downloadText } from '../../core/export';
import { ClaimInvestigationCard } from '../components/investigation';
import { useNow } from '../hooks';

/**
 * Live speech mode (§12). Transcript: cloud Web Speech (only if the user opted in —
 * Chrome routes recognition through Google) OR pasted/imported transcript (works
 * offline). Claims are queued and verified in the background while transcription
 * continues. Results stay non-final until evidence is complete.
 */
export function LiveTab({ settings, onSettingsChange }: { settings: Settings; onSettingsChange: (p: Partial<Settings>) => void }) {
  const [state, setState] = useState<'idle' | 'listening' | 'error' | 'stopped'>('idle');
  const [seg, setSeg] = useState<TranscriptSegment[]>([]);
  const [interim, setInterim] = useState('');
  const [queued, setQueued] = useState<{ claim: string; status: string }[]>([]);
  const [findings, setFindings] = useState<Investigation[]>([]);
  const [imported, setImported] = useState('');
  const stopRef = useRef<{ stop: () => void } | null>(null);
  const queueRef = useRef<string[]>([]);
  const processing = useRef(false);
  const startedAt = useRef(0);
  const now = useNow(1000, state === 'listening');
  const toast = useToast();
  const api = speechApiAvailable();

  const processQueue = useCallback(async () => {
    if (processing.current) return;
    processing.current = true;
    try {
      while (queueRef.current.length) {
        const text = queueRef.current.shift()!;
        setQueued((q) => q.map((x) => (x.claim === text ? { ...x, status: 'searching evidence…' } : x)));
        try {
          const out = await verifyPassage({
            passage: text, mode: 'single-claim', sourceKind: 'speech',
            title: 'Live speech', settings,
          });
          const inv = out.investigations[0];
          if (inv) {
            setFindings((f) => [inv, ...f]);
            setQueued((q) => q.map((x) => (x.claim === text ? { ...x, status: inv.verdict.label } : x)));
            void import('../../core/storage').then((m) => m.putSaved(inv));
          }
        } catch {
          setQueued((q) => q.map((x) => (x.claim === text ? { ...x, status: 'check failed — rerun later' } : x)));
        }
      }
    } finally {
      processing.current = false;
    }
  }, [settings]);

  const onSegment = useCallback((s: TranscriptSegment) => {
    if (!s.final) { setInterim(s.text); return; }
    setInterim('');
    setSeg((old) => [...old, s]);
    const { claims } = extractClaims(s.text, { keepNonFactual: true });
    for (const c of claims.slice(0, 3)) {
      if (c.kind !== 'factual' || c.text.length < 25) continue;
      queueRef.current.push(c.text);
      setQueued((q) => [...q, { claim: c.text, status: 'queued' }].slice(-40));
    }
    void processQueue();
  }, [processQueue]);

  const start = () => {
    if (!api) return void toast({ kind: 'error', text: 'This browser has no SpeechRecognition API. Paste or import a transcript below — it works identically.' });
    const r = startCloudTranscription({
      onSegment,
      onState: (st, msg) => { setState(st); if (msg) toast({ kind: st === 'error' ? 'error' : 'info', text: msg }); },
    });
    if ('error' in r) return void toast({ kind: 'error', text: r.error });
    stopRef.current = r;
    startedAt.current = Date.now();
    setState('listening');
  };

  const stop = () => { stopRef.current?.stop(); stopRef.current = null; setState('stopped'); };

  useEffect(() => () => { stopRef.current?.stop(); }, []);

  const parseImport = () => {
    if (!imported.trim()) return;
    const segs = parseTranscript(imported);
    setSeg((x) => [...x, ...segs]);
    for (const s of segs) {
      const { claims } = extractClaims(s.text, { keepNonFactual: true });
      for (const c of claims.slice(0, 3)) {
        if (c.kind !== 'factual' || c.text.length < 25) continue;
        queueRef.current.push(c.text);
        setQueued((q) => [...q, { claim: c.text, status: 'queued' }]);
      }
    }
    void processQueue();
    toast({ kind: 'ok', text: `Imported ${segs.length} segment(s); queued claims are being checked.` });
  };

  const exportReport = () => {
    downloadText(
      'veriscope-live-session.md',
      transcriptReportToMarkdown(
        `Session ${new Date(startedAt.current || Date.now()).toLocaleString()} · ${settings.mode} mode`,
        seg,
        findings.map((f) => ({ claim: f.claim.text, note: f.verdict.label })),
      ),
      'text/markdown',
    );
  };

  const elapsed = state === 'listening' ? Math.floor((now - startedAt.current) / 1000) : 0;

  return (
    <div className="stack">
      <Glass className="card">
        <SectionTitle
          right={
            <span className="row">
              {state === 'listening' && <span className="row" style={{ gap: 6 }}><span className="rec-dot" aria-hidden /> REC {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>}
              <Chip>{api ? (settings.allowCloudSpeech ? 'mic available · cloud STT allowed' : 'mic available · cloud STT off') : 'no browser STT — import transcripts'}</Chip>
            </span>
          }
        >
          Live speech & debate mode
        </SectionTitle>
        <SwitchRow
          label="Allow browser speech recognition (uses Google’s cloud service)"
          hint={settings.mode === 'offline'
            ? 'Disabled in strict offline mode. Import transcripts instead — analysis runs locally.'
            : 'Chrome implements SpeechRecognition via Google servers. Keep off for full local privacy; you can still paste/import transcripts (works offline).'}
          checked={settings.allowCloudSpeech && settings.mode === 'online'}
          disabled={settings.mode === 'offline'}
          onChange={(v) => onSettingsChange({ allowCloudSpeech: v })}
        />
        <div className="row" style={{ marginTop: 8 }}>
          {state === 'listening' ? <Btn variant="danger" onClick={stop}>■ Stop recording</Btn> : <Btn variant="primary" onClick={start} disabled={!api || !(settings.allowCloudSpeech && settings.mode === 'online')}>🎙 Start microphone</Btn>}
          <Btn size="sm" onClick={exportReport}>⬇ Export session report</Btn>
        </div>
        {state === 'listening' && <p className="tiny">Listening. Do not cover the microphone; a visible REC dot stays on while capturing. Real-time claims remain provisional until evidence completes — never interrupt a speaker with a mid-sentence “verdict”.</p>}
        {state === 'error' && <p className="tiny" style={{ color: 'var(--danger)' }}>Recording error — mic permission may not be granted to the extension. Grant it in Chrome settings → this site, or import a transcript.</p>}
      </Glass>

      <div className="grid2">
        <Glass className="card">
          <SectionTitle>Live transcript</SectionTitle>
          <div className="mono" style={{ maxHeight: 240, overflow: 'auto', background: 'var(--surface-2)', padding: 10, borderRadius: 'var(--radius-s)', fontSize: 12.5 }}>
            {seg.length === 0 && !interim && <span className="tiny">Nothing transcribed yet.</span>}
            {seg.map((s, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <span className="tiny" style={{ color: 'var(--accent)' }}>[{String(Math.floor(s.t0 / 60)).padStart(2, '0')}:{String(Math.floor(s.t0 % 60)).padStart(2, '0')}]</span> {s.text}
              </div>
            ))}
            {interim && <div className="tiny" style={{ fontStyle: 'italic' }}>… {interim}</div>}
          </div>
          <label style={{ marginTop: 8 }}>Or import a transcript (paste .vtt/.srt or plain text with [mm:ss] markers)
            <textarea rows={3} value={imported} onChange={(e) => setImported(e.target.value)} placeholder="Paste transcript here, then 'Analyze transcript'." />
          </label>
          <Btn size="sm" onClick={parseImport}>Analyze transcript</Btn>
        </Glass>
        <Glass className="card">
          <SectionTitle>Claim queue ({queued.length})</SectionTitle>
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {queued.length === 0 && <p className="tiny">Factual claims detected in speech appear here and are checked in the background automatically.</p>}
            {queued.map((q, i) => (
              <div key={i} className="row between" style={{ padding: '4px 0', borderBottom: '1px solid var(--surface-border)', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 12.5 }}>{q.claim.length > 110 ? q.claim.slice(0, 107) + '…' : q.claim}</span>
                <Chip tone={q.status === 'queued' || q.status.includes('searching') ? 'accent' : ''}>{q.status}</Chip>
              </div>
            ))}
          </div>
        </Glass>
      </div>

      {findings.length > 0 && (
        <div>
          <SectionTitle>Findings from this session</SectionTitle>
          {findings.map((inv) => (
            <ClaimInvestigationCard key={inv.id} inv={inv} links={[]} expandedDefault={false} />
          ))}
        </div>
      )}
    </div>
  );
}
