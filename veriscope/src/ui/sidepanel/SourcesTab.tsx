import { useMemo, useState } from 'react';
import type { Settings, SourceEntry } from '../../types';
import { Btn, Chip, Glass, SectionTitle, openTab, useToast } from '../components/ui';
import { CATEGORIES, loadRegistry } from '../../core/registry';
import { buildQuery } from '../../core/searchlinks';

/**
 * Source browser: the registry is searchable/filterable and every entry states
 * honestly what VeriScope can and cannot do with it (checked status, key needs,
 * whether automation is allowed at all). Disabling a source excludes it from
 * candidate search links.
 */
export function SourcesTab({ settings, onSettingsChange, currentQuery }: { settings: Settings; onSettingsChange: (p: Partial<Settings>) => void; currentQuery?: string }) {
  const { sources, errors } = useMemo(() => loadRegistry(), []);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const toast = useToast();
  const disabled = new Set(settings.sourcesDisabled);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return sources.filter((s) => {
      if (cat && !s.categories.includes(cat as any)) return false;
      if (status && s.accessStatus !== status) return false;
      if (needle && !(`${s.name} ${s.url} ${s.notes ?? ''}`.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [sources, q, cat, status]);

  const toggle = (id: string) => {
    const next = disabled.has(id) ? settings.sourcesDisabled.filter((x) => x !== id) : [...settings.sourcesDisabled, id];
    onSettingsChange({ sourcesDisabled: next });
  };

  const openWith = (s: SourceEntry) => {
    const query = (currentQuery || q || '').trim();
    let url: string | null = null;
    if (s.searchUrl?.includes('{query}')) url = s.searchUrl.replace('{query}', encodeURIComponent(query || 'example claim'));
    else url = s.url;
    openTab(url);
    toast({ kind: 'info', text: 'Link opened in a new tab — the extension did not fetch or read it.' });
  };

  return (
    <div className="stack">
      <Glass className="card">
        <SectionTitle right={<Chip>{sources.length} registered · {sources.filter((s) => s.automationAllowed).length} with API access</Chip>}>
          Source registry
        </SectionTitle>
        {errors.length > 0 && <p className="tiny" role="alert">Registry validation issues: {errors.slice(0, 3).join(' · ')}{errors.length > 3 ? ` (+${errors.length - 3} more)` : ''}</p>}
        <div className="row">
          <input style={{ flex: 2 }} placeholder="Search sources (name, url, notes)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search source registry" />
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category" style={{ flex: 1 }}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by access status" style={{ flex: 1 }}>
            <option value="">Any status</option>
            {['not-checked', 'website-verified', 'search-page-verified', 'public-document-access-verified', 'api-integration-verified', 'restricted', 'unavailable', 'historical-archive'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <p className="tiny" style={{ marginTop: 6 }}>
          Status “not-checked” means exactly that: this build ships from an environment with restricted network access, so live URL verification could NOT be performed
          (and the project refuses to claim otherwise). Sources marked <Chip tone="warn">restricted</Chip> need logins/keys — the manual path still works.
        </p>
        {currentQuery && <p className="tiny">Search links below are prefilled with: <em>“{buildQuery({ text: currentQuery, entities: [] })}”</em> — opening them is YOUR action, not a performed search.</p>}
      </Glass>

      <div style={{ maxHeight: '58vh', overflow: 'auto' }}>
        {filtered.map((s) => (
          <div key={s.id} className={`glass card claim-card ${disabled.has(s.id) ? '' : ''}`} style={{ opacity: disabled.has(s.id) ? 0.55 : 1 }}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <strong>{s.name}</strong>
                <div className="tiny mono">{s.url}</div>
                <div className="row" style={{ gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                  {s.categories.slice(0, 4).map((c) => <Chip key={c}>{c}</Chip>)}
                  <Chip tone={s.accessStatus === 'restricted' ? 'warn' : ''}>{s.accessStatus}</Chip>
                  {s.apiKeyRequired && <Chip tone="warn">key required</Chip>}
                  <Chip>{s.automationAllowed ? 'public API integration' : s.searchUrl ? 'manual search page' : 'manual navigation'}</Chip>
                  <Chip>{s.sourceType}</Chip>
                </div>
                {s.notes && <p className="tiny" style={{ marginTop: 4 }}>{s.notes}</p>}
              </div>
              <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
                <Btn size="sm" onClick={() => openWith(s)}>Open {s.searchUrl?.includes('{query}') ? 'search' : 'site'}</Btn>
                <Btn size="xs" variant={disabled.has(s.id) ? 'ghost' : 'default'} onClick={() => toggle(s.id)} aria-pressed={!disabled.has(s.id)}>
                  {disabled.has(s.id) ? 'Re-enable' : 'Disable'}
                </Btn>
              </div>
            </div>
          </div>
        ))}
        {!filtered.length && <Glass className="card"><p className="tiny">No sources match those filters.</p></Glass>}
      </div>
    </div>
  );
}
