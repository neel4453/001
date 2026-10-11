import { useMemo, useState } from 'react';
import type { Investigation } from '../../types';
import { Btn, Chip, Glass, SectionTitle, Empty, useToast } from '../components/ui';
import { useInvestigationStore } from '../hooks';
import { investigationToMarkdown, investigationToJson, downloadText } from '../../core/export';
import { clearAllData } from '../../core/storage';
import { VerdictBadge } from '../components/ui';
import { ClaimInvestigationCard } from '../components/investigation';

/** History & saved investigations (§8.8) with per-item delete, export, and wipe-all. */
export function HistoryTab({ currentInvestigations, linksByClaim }: { currentInvestigations: Investigation[]; linksByClaim: Map<string, any[]> }) {
  const store = useInvestigationStore();
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const merged = useMemo(() => {
    const byId = new Map<string, Investigation>();
    for (const i of currentInvestigations) byId.set(i.id, i);
    for (const i of store.list) if (!byId.has(i.id)) byId.set(i.id, i);
    return [...byId.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [store.list, currentInvestigations]);

  return (
    <div className="stack">
      <Glass className="card">
        <SectionTitle right={<span className="row">
          <Btn size="sm" onClick={() => downloadText('veriscope-export.json', investigationToJson(store.list), 'application/json')}>Export all (.json)</Btn>
          <Btn size="sm" variant="danger" onClick={() => setConfirmWipe(true)}>Delete all…</Btn>
        </span>}>
          Saved investigations ({merged.length})
        </SectionTitle>
        <p className="tiny">Stored only in this browser (chrome.storage.local). Nothing is synced or uploaded. Deleting removes it permanently for this profile.</p>
      </Glass>

      {merged.length === 0 && <Glass className="card"><Empty>Nothing saved yet. “Save” on any investigation card to keep it here.</Empty></Glass>}

      {merged.map((inv) => (
        <div key={inv.id}>
          {openId === inv.id ? (
            <div>
              <ClaimInvestigationCard inv={inv} links={linksByClaim.get(inv.claim.id) ?? []} />
              <div className="row" style={{ marginBottom: 10 }}>
                <Btn size="sm" onClick={() => setOpenId(null)}>Close</Btn>
                <Btn size="sm" variant="ghost" onClick={() => downloadText(`${inv.id}.md`, investigationToMarkdown(inv), 'text/markdown')}>⬇ Export .md</Btn>
              </div>
            </div>
          ) : (
            <Glass className="card claim-card">
              <div className="row between" style={{ gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 6, marginBottom: 3 }}><VerdictBadge verdict={inv.verdict.verdict} label={inv.verdict.label} /><Chip>{inv.mode}</Chip>{inv.userFlag && <Chip tone="warn">flagged</Chip>}</div>
                  <div className="claim-text" style={{ fontSize: 13.5 }}>{inv.claim.text.length > 160 ? inv.claim.text.slice(0, 157) + '…' : inv.claim.text}</div>
                  <div className="tiny">{new Date(inv.updatedAt || inv.createdAt).toLocaleString()} · {inv.evidence.length} evidence · {inv.source.kind}{inv.source.documentName ? ` · ${inv.source.documentName}` : ''}</div>
                </div>
                <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
                  <Btn size="xs" onClick={() => setOpenId(inv.id)}>Open</Btn>
                  <Btn size="xs" variant="ghost" onClick={async () => { await store.remove(inv.id); toast({ kind: 'ok', text: 'Investigation deleted.' }); }}>Delete</Btn>
                </div>
              </div>
            </Glass>
          )}
        </div>
      ))}

      {confirmWipe && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm delete all">
          <div className="glass glass-strong modal">
            <h3>Delete ALL saved investigations?</h3>
            <p>This removes every saved investigation, evidence record and history entry from this browser. Type <code>DELETE</code> to confirm.</p>
            <WipeForm onOk={async () => { await clearAllData(); await store.refresh(); setConfirmWipe(false); toast({ kind: 'ok', text: 'All stored data deleted.' }); }} onCancel={() => setConfirmWipe(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function WipeForm({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  const [txt, setTxt] = useState('');
  return (
    <div className="stack">
      <input value={txt} onChange={(e) => setTxt(e.target.value)} aria-label="Type DELETE to confirm" placeholder="Type DELETE" />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" disabled={txt !== 'DELETE'} onClick={onOk}>Delete everything</Btn>
      </div>
    </div>
  );
}
