import { useEffect, useMemo, useState } from 'react';
import type { Settings } from '../../types';
import { Btn, Chip, Glass, SectionTitle, Spinner, useToast } from '../components/ui';
import { ClaimInvestigationCard } from '../components/investigation';
import { useWorkbench } from './useWorkbench';
import { usePendingAction } from '../hooks';
import { extractClaims } from '../../core/claims';
import { vsFindAiAnswers, type VsAiAnswer } from '../../content/pageFunctions';

/**
 * Page scan (§9): injects the read-only extractor via activeTab (on-demand
 * permission, no persistent host access), splits to atomic claims, dedupes,
 * links each claim back to its passage, and offers per-claim verification.
 */
export function PageTab({ settings }: { settings: Settings }) {
  const [page, setPage] = useState<{ ok: boolean; text: string; url: string; title: string; error?: string } | null>(null);
  const [answers, setAnswers] = useState<VsAiAnswer[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number[]>([]);
  const wb = useWorkbench(settings);
  const toast = useToast();
  const [pending] = usePendingAction((p) => (p.kind === 'page' ? { url: p.url, title: p.pageTitle, at: p.at } : null));

  const scan = async () => {
    setScanning(true);
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs) { toast({ kind: 'error', text: 'Page scanning needs the extension runtime (load unpacked).' }); return; }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return void toast({ kind: 'error', text: 'No active tab found.' });
      const res: any = await chrome.runtime.sendMessage({ type: 'vs:scan-page', tabId: tab.id });
      if (!res?.ok) { setPage({ ok: false, text: '', url: '', title: '', error: res?.error ?? 'Scan failed.' }); return; }
      setPage({ ok: true, text: res.text, url: res.url, title: res.title });
      setAnswers(null);
    } finally {
      setScanning(false);
    }
  };

  const findAi = async () => {
    if (typeof chrome === 'undefined' || !chrome.scripting) return void toast({ kind: 'error', text: 'Requires the extension runtime.' });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      const [inj] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: vsFindAiAnswers });
      const found = (inj?.result as VsAiAnswer[]) ?? [];
      setAnswers(found);
      if (!found.length) toast({ kind: 'info', text: 'No AI answer container detected on this page. Select the answer text and use “Verify selection” — the manual path always works.' });
    } catch (e) {
      toast({ kind: 'error', text: `Cannot inspect this page: ${(e as Error).message}. Use the manual selection flow.` });
    }
  };

  const claims = useMemo(() => {
    if (!page?.ok) return [];
    return extractClaims(page.text, { keepNonFactual: true }).claims;
  }, [page]);

  useEffect(() => {
    if (pending && !page) scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const toggle = (id: string) => setSelectedIdx((x) => {
    const inv = claims.find((c) => c.id === id);
    void inv;
    const idx = claims.findIndex((c) => c.id === id);
    return x.includes(idx) ? x.filter((i) => i !== idx) : [...x, idx];
  });

  const verifySelected = async () => {
    const chosen = selectedIdx.length ? selectedIdx.map((i) => claims[i]) : claims;
    if (!chosen.length) return void toast({ kind: 'error', text: 'No claims selected.' });
    // Verify each claim as a single-claim investigation so passage refs survive.
    const passage = chosen.map((c) => c.text).join(' ');
    await wb.verify(passage, { url: page?.url, title: page?.title, sourceKind: 'page' }, 'page');
  };

  return (
    <div className="stack">
      <Glass className="card">
        <SectionTitle right={<Chip>{settings.mode === 'online' ? 'online' : 'offline'} · activeTab only</Chip>}>
          Analyze the current page
        </SectionTitle>
        <p className="tiny">
          VeriScope reads the visible text of THIS tab only, when you press the button (permission is granted per click, nothing is sent anywhere automatically).
          Frames, shadow-DOM readers and protected pages may refuse — then use “Verify selection”.
        </p>
        <div className="row">
          {scanning ? <Spinner label="Extracting…" /> : <Btn variant="primary" onClick={scan}>📄 Scan page for claims</Btn>}
          <Btn onClick={findAi}>🤖 Find AI answers</Btn>
        </div>
        {page?.error && <p className="tiny" role="alert" style={{ color: 'var(--danger)' }}>{page.error}</p>}
        {page?.ok && (
          <p className="tiny">
            Scanned <strong>{page.title}</strong> — {claims.length} atomic claim(s) extracted{page.text.length > 230000 ? ' (page truncated at the character cap)' : ''}.
            <a href={page.url} target="_blank" rel="noreferrer"> source ↗</a>
          </p>
        )}
        {answers && (
          <div className="stack" style={{ marginTop: 8 }}>
            <h4>AI answers detected ({answers.length})</h4>
            {answers.map((a, i) => (
              <div key={i} className="neo-inset" style={{ padding: 10 }}>
                <div className="row between"><Chip tone="accent">{a.provider}</Chip>
                  <Btn size="xs" onClick={async () => { await wb.verify(a.text, { url: page?.url ?? location.href, title: `AI answer (${a.provider})`, sourceKind: 'ai-answer' }, 'ai-answer'); }}>Verify this answer</Btn>
                </div>
                <div className="quote" style={{ maxHeight: 120, overflow: 'auto' }}>{a.text.slice(0, 800)}{a.text.length > 800 ? '…' : ''}</div>
              </div>
            ))}
            {!answers.length && <p className="tiny">No answer containers matched. DOM selectors break as sites change — manual “Verify selection” is the reliable fallback.</p>}
          </div>
        )}
      </Glass>

      {page?.ok && claims.length > 0 && (
        <Glass className="card">
          <SectionTitle right={<span className="row"><Btn size="sm" variant="ghost" onClick={() => setSelectedIdx(claims.map((_, i) => i))}>Select all</Btn><Btn size="sm" variant="ghost" onClick={() => setSelectedIdx([])}>None</Btn></span>}>
            Extracted claims ({claims.length})
          </SectionTitle>
          <div style={{ maxHeight: 260, overflow: 'auto' }}>
            {claims.slice(0, 60).map((c, i) => (
              <label key={c.id} className="row" style={{ justifyContent: 'flex-start', gap: 8, padding: '4px 2px', cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedIdx.includes(i)} onChange={() => toggle(c.id)} style={{ width: 'auto' }} />
                <span style={{ flex: 1 }}>{c.text.length > 180 ? c.text.slice(0, 177) + '…' : c.text}</span>
                <Chip>{c.kind}</Chip>
              </label>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <Btn variant="primary" onClick={verifySelected} disabled={wb.busy}>
              {wb.busy ? 'Verifying…' : `🔎 Verify ${selectedIdx.length || claims.length} selected claim(s)`}
            </Btn>
            {wb.busy && <Btn onClick={wb.cancel} variant="danger" size="sm">Cancel</Btn>}
            {wb.progress && <span className="tiny">{wb.progress.step}</span>}
          </div>
        </Glass>
      )}
      {wb.error && <p className="tiny" style={{ color: 'var(--danger)' }} role="alert">{wb.error}</p>}
      {wb.items.map((inv) => (
        <ClaimInvestigationCard
          key={inv.id}
          inv={inv}
          links={wb.links.get(inv.claim.id) ?? []}
          onAssess={(evId, rel) => wb.assess(inv.id, evId, rel)}
          onRemoveEvidence={(evId) => wb.removeEvidence(inv.id, evId)}
          onSave={async () => { await wb.save(inv.id); toast({ kind: 'ok', text: 'Saved.' }); }}
          expandedDefault={wb.items.length === 1}
        />
      ))}
    </div>
  );
}
