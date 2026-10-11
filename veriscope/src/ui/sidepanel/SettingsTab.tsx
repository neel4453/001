import { useEffect, useState } from 'react';
import type { Settings } from '../../types';
import { Btn, Chip, Glass, SectionTitle, SwitchRow } from '../components/ui';
import { checkOllama, type OllamaHealth } from '../../core/localai';
import { checkEngine, type EngineHealth } from '../../core/localengine';
import { storageUsageBytes } from '../../core/storage';
import { APP } from '../../config';

/**
 * Settings & privacy controls (§8.9, §15, §16). The mode selector is the heart of the
 * product promise: offline = provably zero requests (net.ts gate), online = key-free
 * public lookups with everything the user clicked clearly attributed.
 */
export function SettingsTab({ settings, onChange }: { settings: Settings; onChange: (p: Partial<Settings>) => void }) {
  const [health, setHealth] = useState<OllamaHealth | null>(null);
  const [engine, setEngine] = useState<EngineHealth | null>(null);
  const [usage, setUsage] = useState<number | null>(null);

  useEffect(() => { storageUsageBytes().then(setUsage); }, []);

  return (
    <div className="stack">
      <Glass className="card">
        <SectionTitle>Operating mode</SectionTitle>
        <div className="grid2">
          <button className={settings.mode === 'offline' ? 'btn btn-primary' : 'btn'} onClick={() => onChange({ mode: 'offline' })} aria-pressed={settings.mode === 'offline'} style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 12, height: 'auto' }}>
            <strong>🔒 Strict offline</strong>
            <span className="tiny" style={{ color: 'inherit', opacity: .85 }}>Zero network requests — enforced in code (tests prove it). Local analysis, user-supplied sources, exports.</span>
          </button>
          <button className={settings.mode === 'online' ? 'btn btn-primary' : 'btn'} onClick={() => onChange({ mode: 'online' })} aria-pressed={settings.mode === 'online'} style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 12, height: 'auto' }}>
            <strong>🌐 Free online evidence</strong>
            <span className="tiny" style={{ color: 'inherit', opacity: .85 }}>Key-free public APIs (OpenAlex, Crossref, Wikipedia…) + user-clicked search links. No paid services, no tracking.</span>
          </button>
        </div>
        <p className="tiny" style={{ marginTop: 6 }}>Mode names are literal descriptions, not marketing: online mode does make requests to the exact endpoints listed in docs/PRIVACY.md.</p>
      </Glass>

      <Glass className="card">
        <SectionTitle>Evidence retrieval</SectionTitle>
        <SwitchRow label="Automated key-free API lookups" hint="When on (and online mode), VeriScope queries OpenAlex/Crossref/Wikipedia/PubMed/Wayback/GDELT metadata directly. Failures are shown honestly — never faked."
          checked={settings.autoQueries} onChange={(v) => onChange({ autoQueries: v })} disabled={settings.mode === 'offline'} />
        <label style={{ marginTop: 8 }}>Polite-pool contact email (optional)
          <input type="email" value={settings.politePoolEmail} onChange={(e) => onChange({ politePoolEmail: e.target.value.trim() })} placeholder="you@example.org — OpenAlex/Crossref ask for a mailto for heavy users; empty = omitted" />
        </label>
        <div className="tiny">Some public APIs ask for an email to reach out about abuse (OpenAlex `mailto`, Crossref `mailto`). Optional; only sent with automated queries, never stored remotely by VeriScope.</div>
      </Glass>

      <Glass className="card">
        <SectionTitle right={<Chip>optional · your hardware</Chip>}>Local AI (Ollama)</SectionTitle>
        <SwitchRow label="Use a local language model for claim refinement" hint="Strictly optional. Claims and verdicts work without it. Model output is always labeled unverified and never sets verdicts alone."
          checked={settings.ollamaEnabled} onChange={(v) => onChange({ ollamaEnabled: v })} disabled={settings.mode === 'offline'} />
        <div className="grid2" style={{ marginTop: 8 }}>
          <label>Ollama URL (localhost)<input value={settings.ollamaUrl} onChange={(e) => onChange({ ollamaUrl: e.target.value })} disabled={settings.mode === 'offline'} /></label>
          <label>Model name<input value={settings.ollamaModel} onChange={(e) => onChange({ ollamaModel: e.target.value })} disabled={settings.mode === 'offline'} /></label>
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <Btn size="sm" disabled={settings.mode === 'offline'} onClick={async () => setHealth(await checkOllama(settings))}>Check local runtime</Btn>
          {health && (health.reachable
            ? <span className="tiny" style={{ color: 'var(--ok)' }}>reachable · {health.models?.length ?? 0} model(s) installed{health.models?.length ? `: ${health.models.slice(0, 4).join(', ')}` : ''}</span>
            : <span className="tiny" style={{ color: 'var(--danger)' }}>{health.error}</span>)}
        </div>
        <p className="tiny">Setup: install Ollama (free, local). Expect ≥4 GB RAM for a 7–8B model. If CORS refuses the extension origin, start it with <code>OLLAMA_ORIGINS=chrome-extension://*</code>. No large models are bundled with the extension — that's deliberate.</p>
      </Glass>

      <Glass className="card">
        <SectionTitle right={<Chip>optional · local OCR & speech</Chip>}>Local companion engine</SectionTitle>
        <SwitchRow label="Enable localhost companion service" hint="Provides scanned-PDF OCR (Tesseract) and offline transcription. Bind is localhost-only, token-authenticated. See local-engine/README.md."
          checked={settings.localEngineEnabled} onChange={(v) => onChange({ localEngineEnabled: v })} disabled={settings.mode === 'offline'} />
        <label style={{ marginTop: 8 }}>Engine URL<input value={settings.localEngineUrl} onChange={(e) => onChange({ localEngineUrl: e.target.value })} disabled={settings.mode === 'offline'} /></label>
        <div className="row" style={{ marginTop: 6 }}>
          <Btn size="sm" disabled={settings.mode === 'offline'} onClick={async () => setEngine(await checkEngine(settings))}>Check engine</Btn>
          {engine && (engine.reachable ? <span className="tiny" style={{ color: 'var(--ok)' }}>healthy (features: {engine.features?.join(', ') || 'n/a'})</span> : <span className="tiny" style={{ color: 'var(--danger)' }}>{engine.error}</span>)}
        </div>
      </Glass>

      <Glass className="card">
        <SectionTitle>Appearance</SectionTitle>
        <div className="row">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <Btn key={t} size="sm" variant={settings.theme === t ? 'primary' : 'default'} onClick={() => onChange({ theme: t })} aria-pressed={settings.theme === t}>{t}</Btn>
          ))}
        </div>
      </Glass>

      <Glass className="card">
        <SectionTitle>Data & privacy</SectionTitle>
        <label>History limit (saved investigations kept)<input type="number" min={20} max={1000} value={settings.historyLimit} onChange={(e) => onChange({ historyLimit: Math.max(20, Math.min(1000, +e.target.value || 200)) })} /></label>
        <p className="tiny">Storage used by this extension: {usage == null ? 'unavailable' : `${(usage / 1024).toFixed(1)} KB`} (browser quota shared). Delete individual items in History; wipe everything there too.</p>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer' }}>Privacy summary — the whole data story</summary>
          <ul className="tiny" style={{ paddingLeft: 16 }}>
            <li>Offline mode: <strong>zero</strong> network requests (a single gated fetch path in src/core/net.ts; proven by unit tests).</li>
            <li>Online mode: metadata queries to OpenAlex, Crossref, Wikipedia, PubMed, Europe PMC, Wayback, GDELT (public, key-free) — claim text is sent as the search term to these services, so do not paste confidential claims while online.</li>
            <li>Every search link you open is YOUR browser navigating, after an explicit click.</li>
            <li>Documents & images: parsed locally; never uploaded. The optional local engine is localhost-only.</li>
            <li>Web Speech (off by default) uses Google's service; strict-offline and import-transcript avoid it.</li>
            <li>No telemetry, no analytics, no ads, no accounts. History lives only in chrome.storage.local of this browser profile.</li>
          </ul>
        </details>
      </Glass>

      <Glass className="card">
        <SectionTitle>About</SectionTitle>
        <p className="tiny">{APP.name} v{APP.version} · open source (MIT) · no telemetry, no ads, no accounts. The name is build-time configurable — see README “Renaming”.
        Built to be honest about what it cannot do: see docs/LIMITATIONS.md (not shipped in the dist ZIP, present in the repository).</p>
      </Glass>
    </div>
  );
}
