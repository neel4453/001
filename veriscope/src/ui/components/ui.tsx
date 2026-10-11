import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/* ---------- primitives ---------- */

export function Glass({ className = '', children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`glass ${className}`} {...rest}>{children}</div>;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'default' | 'ghost' | 'danger'; size?: 'md' | 'sm' | 'xs' };
export function Btn({ variant = 'default', size = 'md', className = '', ...rest }: BtnProps) {
  const cls = ['btn', variant === 'primary' && 'btn-primary', variant === 'ghost' && 'btn-ghost', variant === 'danger' && 'btn-danger', size === 'sm' && 'btn-sm', size === 'xs' && 'btn-xs'].filter(Boolean).join(' ');
  return <button type="button" className={`${cls} ${className}`} {...rest} />;
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="switch" title={label}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="track" />
      <span className="thumb" />
    </label>
  );
}

export function SwitchRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="switch-row">
      <span>
        <strong style={{ fontWeight: 600 }}>{label}</strong>
        {hint && <div className="tiny">{hint}</div>}
      </span>
      <Toggle checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

export function Chip({ tone = '', children }: { tone?: '' | 'accent' | 'warn'; children: React.ReactNode }) {
  return <span className={`chip ${tone === 'accent' ? 'chip-accent' : tone === 'warn' ? 'chip-warn' : ''}`}>{children}</span>;
}

export function VerdictBadge({ verdict, label }: { verdict: string; label: string }) {
  return <span className="verdict" data-verdict={verdict} role="status">{label}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="row" style={{ gap: 8 }}>
      <span className="spinner" role="progressbar" aria-label={label ?? 'Loading'} />
      {label && <span className="muted">{label}</span>}
    </span>
  );
}

export function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="row between" style={{ margin: '2px 0 8px' }}>
      <h3>{children}</h3>
      <div className="row">{right}</div>
    </div>
  );
}

/* ---------- modal ---------- */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal glass glass-strong" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="row between">
          <h3>{title}</h3>
          <Btn size="sm" variant="ghost" onClick={onClose} aria-label="Close dialog">✕</Btn>
        </div>
        <div className="divider" />
        {children}
      </div>
    </div>
  );
}

/* ---------- toasts ---------- */
interface Toast { id: number; kind: 'info' | 'error' | 'ok'; text: string }
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => undefined);
export function useToast() { return useContext(ToastCtx); }
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-3), { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 6000);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-host" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast glass ${t.kind === 'error' ? 'error' : ''}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <span>{t.kind === 'error' ? '⚠' : t.kind === 'ok' ? '✓' : 'ℹ'}</span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- logo ---------- */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="vs-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#vs-g)" opacity="0.16" />
      <circle cx="28" cy="28" r="14" fill="none" stroke="url(#vs-g)" strokeWidth="5" />
      <line x1="39" y1="39" x2="52" y2="52" stroke="url(#vs-g)" strokeWidth="6" strokeLinecap="round" />
      <path d="M21 28.5l5 5 10-11" fill="none" stroke="url(#vs-g)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- theme host ---------- */
export function useThemeApplier(theme: 'light' | 'dark' | 'system') {
  useEffect(() => {
    const apply = () => {
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const eff = theme === 'system' ? sys : theme;
      document.documentElement.setAttribute('data-theme', eff);
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

/** Open external tabs through the background's URL-validated path. */
export function openTab(url: string) {
  if (typeof chrome !== 'undefined' && chrome?.runtime?.id) {
    chrome.runtime.sendMessage({ type: 'vs:open-tab', url }, (r: any) => {
      if (chrome.runtime.lastError || !r?.ok) window.open(url, '_blank', 'noopener');
    });
  } else {
    window.open(url, '_blank', 'noopener');
  }
}
