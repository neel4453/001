import React, { useEffect, useState } from 'react';
import { APP } from '../../config';
import { Logo, Btn, useThemeApplier } from '../components/ui';
import { useSettings } from '../hooks';
import { SettingsTab } from '../sidepanel/SettingsTab';

/** Options page: settings + onboarding (opened on first install) + honest capability summary. */
export function OptionsApp() {
  const [settings, update] = useSettings();
  useThemeApplier(settings?.theme ?? 'system');
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    const first = new URLSearchParams(location.search).get('welcome') === '1';
    if (first) setWelcome(true);
  }, []);
  if (!settings) return <div style={{ padding: 30 }}>loading…</div>;

  const finishWelcome = async () => {
    await update({ firstRunDone: true });
    setWelcome(false);
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '26px 18px 60px' }}>
      <header className="row" style={{ gap: 10, marginBottom: 16 }}>
        <Logo size={30} />
        <h2 style={{ margin: 0 }}>{APP.name} — Settings & Privacy</h2>
      </header>

      {welcome && (
        <section className="glass card">
          <h3>Welcome — read this before your first check</h3>
          <ul className="tiny" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
            <li><strong>What this is:</strong> an evidence-first investigation assistant. It extracts claims, prepares sources, and organizes what evidence you and its free public lookups find — then explains its uncertainty.</li>
            <li><strong>What it is NOT:</strong> an oracle. It never fabricates evidence; “Unverified” means the available evidence didn’t settle it — not that the claim is false.</li>
            <li><strong>Privacy:</strong> start in <em>strict offline</em> mode if you want zero network requests. <em>Online evidence</em> mode queries key-free public research APIs with your claim text — see the privacy summary in Settings.</li>
            <li><strong>Sources:</strong> every site in the registry is labeled “not-checked” until you (or a maintainer) verifies its live URLs; restricted ones say so. Manual search links are always available.</li>
            <li><strong>Optional power-ups (all free, all local):</strong> Ollama for a local model; the companion engine for local OCR/speech; both off by default.</li>
          </ul>
          <div className="row" style={{ marginTop: 8 }}>
            <Btn variant="primary" onClick={finishWelcome}>Got it — take me to settings</Btn>
            <Btn variant="ghost" onClick={() => { update({ mode: 'offline' }).then(finishWelcome); }}>Prefer strict offline, start there</Btn>
          </div>
        </section>
      )}

      <SettingsTab settings={settings} onChange={update} />

      <p className="tiny" style={{ marginTop: 20 }}>
        {APP.name} v{APP.version} · MIT-licensed · every request in online mode is documented in docs/PRIVACY.md.
        Chrome Web Store publication would need a one-time developer registration fee; loading unpacked is free and fully functional.
      </p>
    </div>
  );
}
