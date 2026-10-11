import React, { useEffect, useState } from 'react';
import type { Settings, Investigation } from '../../types';
import { Btn, Chip, Glass, Modal, SectionTitle, Empty, ProgressBar, Spinner, openTab, useToast } from '../components/ui';
import { ClaimInvestigationCard, AddEvidenceModal } from '../components/investigation';
import { useWorkbench } from './useWorkbench';
import { usePendingAction } from '../hooks';
import { investigationToMarkdown, investigationToJson, downloadText } from '../../core/export';


export function VerifyTab({ settings }: { settings: Settings }) {
  const [text, setText] = useState('');
  const [munMode, setMunMode] = useState(false);
  const [ctx, setCtx] = useState({ speaker: '', country: '', committee: '', period: '', documentRef: '' });
  const [showAdd, setShowAdd] = useState<string | null>(null);
  const [annotateFor, setAnnotateFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [flagFor, setFlagFor] = useState<string | null>(null);
  const wb = useWorkbench(settings);
  const toast = useToast();
  const [pending] = usePendingAction((p) => (p.kind === 'selection' || p.kind === 'manual') && p.text ? { text: p.text, url: p.url, title: p.pageTitle } : null);

  useEffect(() => {
    if (pending) setText(pending.text);
  }, [pending]);

  const start = async () => {
    if (!text.trim()) return void toast({ kind: 'error', text: 'Enter or select a claim first.' });
    await wb.verify(text.trim(), {
      url: (pending as any)?.url, title: (pending as any)?.title,
      sourceKind: (pending as any)?.url ? 'selection' : 'manual',
      context: munMode ? ctx : undefined,
    });
  };

  return (
    <div className="stack">
      <Glass className="card">
        <SectionTitle
          right={
            <span className="row">
              {pending && <Chip tone="accent">loaded from {pending.url ? 'your selection' : 'clipboard'}</Chip>}
              <Btn size="sm" variant={munMode ? 'primary' : 'ghost'} onClick={() => setMunMode((m) => !m)} aria-pressed={munMode}>
                🌐 MUN / politician mode
              </Btn>
            </span>
          }
        >
          Verify a claim
        </SectionTitle>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Paste a statement, quote, statistic, or AI answer here. Long text is split into individual claims automatically."
          aria-label="Claim text to verify"
        />
        {munMode && (
          <div className="grid2" style={{ marginTop: 8 }}>
            <label>Speaker / delegate<input value={ctx.speaker} onChange={(e) => setCtx({ ...ctx, speaker: e.target.value })} placeholder="e.g. Delegate of Brazil" /></label>
            <label>Country bloc<input value={ctx.country} onChange={(e) => setCtx({ ...ctx, country: e.target.value })} placeholder="e.g. Brazil" /></label>
            <label>Committee / forum<input value={ctx.committee} onChange={(e) => setCtx({ ...ctx, committee: e.target.value })} placeholder="e.g. UNEP" /></label>
            <label>Period<input value={ctx.period} onChange={(e) => setCtx({ ...ctx, period: e.target.value })} placeholder="e.g. 2015–2020" /></label>
            <label style={{ gridColumn: '1 / -1' }}>Resolution / treaty / bill reference
              <input value={ctx.documentRef} onChange={(e) => setCtx({ ...ctx, documentRef: e.target.value })} placeholder="e.g. UNGA Resolution ES-10/21; Paris Agreement Art. 4" />
            </label>
          </div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          {wb.busy ? (
            <>
              <Spinner label={wb.progress?.step ?? 'Working…'} />
              <Btn size="sm" variant="danger" onClick={wb.cancel}>Cancel</Btn>
            </>
          ) : (
            <Btn variant="primary" onClick={start}>🔎 Verify claim(s)</Btn>
          )}
          {wb.busy && wb.progress && (
            <div style={{ flex: 1 }}><ProgressBar value={wb.progress.done} total={wb.progress.total} /></div>
          )}
          <span style={{ marginLeft: 'auto' }} className="row">
            <Btn size="sm" variant="ghost" onClick={() => openTab('https://toolbox.google.com/factcheck/explorer')} title="Opens Google Fact Check Explorer in a new tab">Fact Check Explorer ↗</Btn>
          </span>
        </div>
        {wb.error && <p className="tiny" role="alert" style={{ color: 'var(--danger)' }}>{wb.error}</p>}
        {settings.mode === 'online' && wb.reports.filter((r) => !r.ok).length > 0 && (
          <p className="tiny">Automated lookups attempted: {wb.reports.map((r) => `${r.adapter}${r.ok ? ` ✓${r.count}` : ' ✗'}`).join(' · ')}</p>
        )}
      </Glass>

      {wb.items.length === 0 && !wb.busy && (
        <Glass className="card">
          <Empty>
            No investigation yet.<br />
            <small>Paste text above, right-click any page selection and choose “Verify selection”, or drop a document in the Documents tab.</small>
          </Empty>
        </Glass>
      )}

      {wb.items.map((inv: Investigation) => (
        <ClaimInvestigationCard
          key={inv.id}
          inv={inv}
          links={wb.links.get(inv.claim.id) ?? []}
          onAssess={(evId, rel) => wb.assess(inv.id, evId, rel)}
          onRemoveEvidence={(evId) => wb.removeEvidence(inv.id, evId)}
          onAddEvidence={() => setShowAdd(inv.id)}
          onAnnotate={() => { setAnnotateFor(inv.id); setNote(''); }}
          onRecheck={() => wb.recheck(inv.id)}
          onFlag={() => setFlagFor(inv.id)}
          onSave={async () => { await wb.save(inv.id); toast({ kind: 'ok', text: 'Investigation saved to local storage.' }); }}
        />
      ))}

      {wb.items.length > 0 && (
        <div className="row">
          <Btn size="sm" onClick={() => downloadText(`${wb.items[0].id}.md`, wb.items.map((i) => investigationToMarkdown(i)).join('\n\n---\n\n'), 'text/markdown')}>⬇ Export report (.md)</Btn>
          <Btn size="sm" variant="ghost" onClick={() => downloadText(`${wb.items[0].id}.json`, investigationToJson(wb.items), 'application/json')}>Export .json</Btn>
          <Btn size="sm" variant="ghost" onClick={() => { wb.setItems([]); }}>Clear workspace</Btn>
        </div>
      )}

      {showAdd && (
        <Modal title="Add a source you found" onClose={() => setShowAdd(null)}>
          <AddEvidenceModal
            onSubmit={(v) => { wb.addEvidence(showAdd, v); setShowAdd(null); toast({ kind: 'ok', text: 'Source added as unassessed evidence.' }); }}
            onClose={() => setShowAdd(null)}
          />
        </Modal>
      )}
      {annotateFor && (
        <Modal title="Annotate this investigation" onClose={() => setAnnotateFor(null)}>
          <div className="stack">
            <p className="tiny">Annotations never alter the original claim or evidence history — they are appended.</p>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Annotation note" />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Btn onClick={() => { if (note.trim()) { wb.annotate(annotateFor, note.trim()); setAnnotateFor(null); } }}>Add annotation</Btn>
            </div>
          </div>
        </Modal>
      )}
      {flagFor && (
        <Modal title="Flag this verdict for review" onClose={() => setFlagFor(null)}>
          <FlagForm onSubmit={(r) => { wb.flag(flagFor, r || 'No reason given (user flag)'); setFlagFor(null); toast({ kind: 'ok', text: 'Flag recorded and included in exports.' }); }} />
        </Modal>
      )}
    </div>
  );
}

function FlagForm({ onSubmit }: { onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="stack">
      <p className="tiny">Tell us (your future self / your export reader) why this verdict looks wrong — missing context, biased source, misread number. Stored in the change log.</p>
      <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for flag" />
      <div className="row" style={{ justifyContent: 'flex-end' }}><Btn variant="primary" onClick={() => onSubmit(reason.trim())}>Record flag</Btn></div>
    </div>
  );
}

