import type { PendingAction } from '../types';

export type VsMessage =
  | { type: 'vs:ready' }
  | { type: 'vs:pending-action'; action: PendingAction }
  | { type: 'vs:scan-page'; tabId: number }
  | { type: 'vs:scan-page-result'; ok: boolean; text?: string; url?: string; title?: string; error?: string }
  | { type: 'vs:capture-frame'; tabId: number; rect: { x: number; y: number; width: number; height: number } }
  | { type: 'vs:capture-frame-result'; ok: boolean; dataUrl?: string; error?: string; vw?: number; vh?: number };

export const MSG = {
  OPEN_SIDE_PANEL: 'vs:open-side-panel',
} as const;
