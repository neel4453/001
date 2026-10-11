import React, { useEffect, useState } from 'react';
import { APP } from '../../config';
import { Logo, Btn, Spinner, useThemeApplier } from '../components/ui';
import { useSettings } from '../hooks';
import { setPending, getHistory } from '../../core/storage';
import type { HistoryEntry } from '../../types';
import { nowIso } from '../../core/util';

/**
 * Compact popup (§5 of the UI spec): fast actions, recent investigations, mode
 * indicator, and a handoff button into the full side-panel workspace. Every control
 * performs a real action; nothing decorative.
 */
export function PopupApp() {
  const [settings, update] = useSettings();
  const [text, setText] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useThemeApplier(settings?.theme ?? 'system');

  useEffect(() => { getHistory().then((h) => setHistory(h.slice(0, 5))); }, []);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t); } }, [msg]);

  if (!settings) return <div style={{ width: 380, padding: 20 }}><Spinner label="loading…" /></div>;

  const openPanel = async () => {
    try {
      const [tab] = await chrome.tabs.query({ currentWindow: true });
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id! });
      void tab;
    } catch {
      setMsg('Side panel could not open automatically — click the VeriScope toolbar icon → panel button.');
    }
  };

  const verifyText = async (t: string, kind: 'manual' | 'selection' | 'page' = 'manual', url?: string, title?: string) => {
    await setPending({ kind, text: t || undefined, url, pageTitle: title, at: nowIso() });
    await openPanel();
    window.close();
  };

  const grabSelection = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('no active tab');
      const res: any = await chrome.runtime.sendMessage({ type: 'vs:get-selection', tabId: tab.id });
      if (!res?.ok || !res.text) { setMsg('No text is selected on the page. Select text first (or paste it here).'); return; }
      await verifyText(res.text, 'selection', res.url, res.title);
    } catch (e) {
      setMsg(`Cannot read the selection here (${(e as Error).message}). This page may block access — paste the text instead.`);
    }
  };

  const scanPage = async () => {
    await setPending({ kind: 'page', at: nowIso() });
    await openPanel();
    window.close();
  };

  return (
    <div style={{ width: 390, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <header className="row between">
        <div className="row" style={{ gap: 8 }}>
          <Logo size={22} />
          <strong style={{ fontSize: 15 }}>{APP.name}</strong>
        </div>
        <span className="row" style={{ gap: 6 }}>
          <span className={`mode-indicator ${settings.mode}`} role="status">{settings.mode}</span>
          <Btn size="xs" variant="ghost" onClick={() => update({ mode: settings.mode === 'offline' ? 'online' : 'offline' })} aria-label="Toggle mode">⇄</Btn>
        </span>
      </header>

      <div className="glass card" style={{ marginBottom: 0 }}>
        <textarea
          rows={3}
          placeholder="Paste a claim to verify…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Claim to verify"
          style={{ background: 'transparent', boxShadow: 'none', border: '1px solid var(--surface-border)' }}
        />
        <div className="row" style={{ marginTop: 8 }}>
          <Btn variant="primary" onClick={() => verifyText(text.trim())} disabled={!text.trim()}>🔎 Verify claim</Btn>
          <Btn onClick={grabSelection}>Verify selected text</Btn>
        </div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <Btn size="sm" onClick={scanPage}>📄 Analyze this page</Btn>
        <Btn size="sm" onClick={() => { setPending({ kind: 'manual', text: '', at: nowIso() }).then(openPanel).finally(() => window.close()); }}>🗂 Documents</Btn>
        <Btn size="sm" onClick={() => { setPending({ kind: 'manual', text: '', at: nowIso() }).then(async () => { await openPanel(); }).finally(() => window.close()); }}>🎙 Live speech</Btn>
      </div>

      {msg && <p className="tiny" role="alert" style={{ color: 'var(--danger)' }}>{msg}</p>}

      <section>
        <div className="row between" style={{ marginBottom: 4 }}>
          <h4 style={{ margin: 0 }}>Recent investigations</h4>
          <Btn size="xs" variant="ghost" onClick={openPanel}>Open workspace →</Btn>
        </div>
        {history.length === 0 && <p className="tiny">Nothing saved yet.</p>}
        {history.map((h) => (
          <div key={h.id} className="row between" style={{ padding: '5px 8px', marginBottom: 4, borderRadius: 'var(--radius-s)', background: 'var(--surface)' }}>
            <span style={{ flex: 1, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.claimText}</span>
            <span className="verdict" data-verdict={h.verdict} style={{ fontSize: 11, padding: '1px 8px' }}>{h.verdictLabel}</span>
          </div>
        ))}
      </section>

      <footer className="row between tiny">
        <span>{settings.mode === 'offline' ? '🔒 offline: no requests leave your machine' : '🌐 online evidence: free public sources only'}</span>
        <a href="#" onClick={(e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); window.close(); }}>Settings & privacy</a>
      </footer>
    </div>
  );
}
