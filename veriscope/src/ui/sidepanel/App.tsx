import React, { useEffect, useState } from 'react';
import { APP } from '../../config';
import { Logo, Btn, ToastProvider, useThemeApplier } from '../components/ui';
import { useSettings, usePendingAction } from '../hooks';
import { VerifyTab } from './VerifyTab';
import { PageTab } from './PageTab';
import { DocsTab } from './DocsTab';
import { MediaTab } from './MediaTab';
import { LiveTab } from './LiveTab';
import { SourcesTab } from './SourcesTab';
import { HistoryTab } from './HistoryTab';
import { SettingsTab } from './SettingsTab';

type TabId = 'verify' | 'page' | 'docs' | 'media' | 'live' | 'sources' | 'history' | 'settings';
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'verify', label: 'Verify', icon: '🔎' },
  { id: 'page', label: 'Page', icon: '📄' },
  { id: 'docs', label: 'Documents', icon: '🗂' },
  { id: 'media', label: 'Media', icon: '🖼' },
  { id: 'live', label: 'Live speech', icon: '🎙' },
  { id: 'sources', label: 'Sources', icon: '🗀' },
  { id: 'history', label: 'History', icon: '⌛' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export function SidePanelApp() {
  const [tab, setTab] = useState<TabId>('verify');
  const [settings, update] = useSettings();
  useThemeApplier(settings?.theme ?? 'system');
  const [pending] = usePendingAction((p) => p);

  useEffect(() => {
    if (!pending) return;
    if (pending.kind === 'page') setTab('page');
    else if (pending.kind === 'image') setTab('media');
    else setTab('verify');
  }, [pending]);

  if (!settings) {
    return <div style={{ padding: 24 }} className="glass"><Logo size={28} /> <strong>{APP.name}</strong> loading…</div>;
  }

  return (
    <div style={{ padding: '10px 12px 40px', maxWidth: 880, margin: '0 auto' }}>
      <header className="row between" style={{ padding: '6px 2px 10px' }}>
        <div className="row" style={{ gap: 10 }}>
          <Logo size={26} />
          <div>
            <strong style={{ fontSize: 16 }}>{APP.name}</strong>
            <div className="tiny">Extract · Evidence · Compare · Explain · Cite · Uncertainty</div>
          </div>
        </div>
        <div className="row">
          <span className={`mode-indicator ${settings.mode}`} role="status" title={settings.mode === 'offline' ? 'Strict offline: no external requests are possible' : 'Online evidence mode: key-free public lookups + user-clicked links'}>
            {settings.mode === 'offline' ? 'offline' : 'online evidence'}
          </span>
          <Btn size="sm" variant="ghost" onClick={() => update({ mode: settings.mode === 'offline' ? 'online' : 'offline' })} aria-label={`Switch to ${settings.mode === 'offline' ? 'online' : 'offline'} mode`}>
            ⇄ switch
          </Btn>
        </div>
      </header>

      <nav className="glass tabs" role="tablist" aria-label="VeriScope workspace sections" style={{ padding: 6, marginBottom: 12, position: 'sticky', top: 4, zIndex: 5, background: 'var(--glass-bg-strong)' }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} className="tab" onClick={() => setTab(t.id)}>
            <span aria-hidden>{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      <main role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'verify' && <VerifyTab settings={settings} />}
        {tab === 'page' && <PageTab settings={settings} />}
        {tab === 'docs' && <DocsTab settings={settings} />}
        {tab === 'media' && <MediaTab settings={settings} />}
        {tab === 'live' && <LiveTab settings={settings} onSettingsChange={update} />}
        {tab === 'sources' && <SourcesTab settings={settings} onSettingsChange={update} currentQuery={pending && 'text' in pending ? pending.text : undefined} />}
        {tab === 'history' && <HistoryTab currentInvestigations={[]} linksByClaim={new Map()} />}
        {tab === 'settings' && <SettingsTab settings={settings} onChange={update} />}
      </main>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
