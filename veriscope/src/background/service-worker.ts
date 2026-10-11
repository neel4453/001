import { APP } from '../config';
import { MSG } from '../core/messaging';
import { setPending } from '../core/storage';
import { vsExtractReadable, vsGetSelection, vsGetVideoInfo, type VsPageExtract } from '../content/pageFunctions';
import { nowIso, isSafeHttpUrl } from '../core/util';

/**
 * MV3 service worker: context menus, on-demand page access (activeTab + scripting),
 * frame capture, side panel plumbing, URL-safe tab opening. No remote code,
 * no telemetry, no polling — it wakes only on user actions.
 */

const MENU_IDS = {
  selection: `${APP.storagePrefix}-verify-selection`,
  page: `${APP.storagePrefix}-scan-page`,
  image: `${APP.storagePrefix}-image-tools`,
  link: `${APP.storagePrefix}-save-link`,
} as const;

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_IDS.selection, title: `Verify selection with ${APP.name}`, contexts: ['selection'] });
    chrome.contextMenus.create({ id: MENU_IDS.page, title: `Analyze this page (${APP.name})`, contexts: ['page', 'frame'] });
    chrome.contextMenus.create({ id: MENU_IDS.image, title: `Image & provenance tools (${APP.name})`, contexts: ['image'] });
    chrome.contextMenus.create({ id: MENU_IDS.link, title: `Open link evidence tools (${APP.name})`, contexts: ['link'] });
  });
}

chrome.runtime.onInstalled.addListener(async (details: chrome.runtime.InstalledDetails) => {
  createMenus();
  try {
    await chrome.sidePanel.setOptions({ path: 'sidepanel.html', enabled: true });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  } catch { /* sidePanel unavailable on old Chrome — popup still works */ }
  if (details?.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') + '?welcome=1' });
  }
});

chrome.runtime.onStartup.addListener(() => createMenus());

chrome.contextMenus.onClicked.addListener(async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
  const base = { url: info.pageUrl ?? tab?.url, pageTitle: tab?.title, at: nowIso() };
  if (info.menuItemId === MENU_IDS.selection && info.selectionText) {
    await setPending({ kind: 'selection', text: info.selectionText.slice(0, 200000), ...base });
  } else if (info.menuItemId === MENU_IDS.page) {
    await setPending({ kind: 'page', ...base });
  } else if (info.menuItemId === MENU_IDS.image && info.srcUrl) {
    await setPending({ kind: 'image', imageUrl: info.srcUrl, ...base });
  } else if (info.menuItemId === MENU_IDS.link && info.linkUrl) {
    await setPending({ kind: 'manual', text: info.linkUrl, ...base });
  }
  // openPanel requires a user gesture — the context-menu click qualifies.
  try {
    await chrome.sidePanel.open({ windowId: tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT });
  } catch {
    // Older Chrome without sidePanel.open(): user opens the panel from the toolbar.
  }
});

interface SwInMessage {
  type: string;
  tabId?: number;
  windowId?: number;
  url?: string;
  action?: unknown;
}

chrome.runtime.onMessage.addListener(
  (msg: SwInMessage, sender: chrome.runtime.MessageSender, sendResponse: (r?: unknown) => void) => {
    if (msg.type === MSG.OPEN_SIDE_PANEL) {
      chrome.sidePanel.open({ windowId: sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT }).catch(() => undefined);
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'vs:scan-page' && typeof msg.tabId === 'number') {
      const tabId = msg.tabId;
      (async () => {
        try {
          const [inj] = await chrome.scripting.executeScript({
            target: { tabId },
            func: vsExtractReadable,
          });
          const result = (inj?.result ?? null) as VsPageExtract | null;
          if (!result || !result.ok) {
            sendResponse({ type: 'vs:scan-page-result', ok: false, error: result?.error ?? 'Extraction returned no text.' });
          } else {
            sendResponse({ type: 'vs:scan-page-result', ok: true, text: result.text, url: result.url, title: result.title });
          }
        } catch (e) {
          sendResponse({
            type: 'vs:scan-page-result',
            ok: false,
            error: `This page does not allow script access (${(e as Error).message}). chrome:// pages, the Chrome Web Store and some secure pages are protected — select text and use "Verify selection" instead.`,
          });
        }
      })();
      return true; // async response
    }
    if (msg.type === 'vs:get-selection' && typeof msg.tabId === 'number') {
      const tabId = msg.tabId;
      (async () => {
        try {
          const [inj] = await chrome.scripting.executeScript({ target: { tabId }, func: vsGetSelection });
          sendResponse({ ok: true, ...(inj?.result ?? {}) });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
      })();
      return true;
    }
    if (msg.type === 'vs:capture-frame' && typeof msg.tabId === 'number') {
      const tabId = msg.tabId;
      const windowId = msg.windowId;
      (async () => {
        try {
          const [vidRes] = await chrome.scripting.executeScript({ target: { tabId }, func: vsGetVideoInfo });
          const vid = vidRes?.result as { rect: { x: number; y: number; width: number; height: number } } | null;
          if (!vid) throw new Error('No <video> element found on this page.');
          const dataUrl = await chrome.tabs.captureVisibleTab(typeof windowId === 'number' ? windowId : chrome.windows.WINDOW_ID_CURRENT, { format: 'png' });
          sendResponse({ ok: true, dataUrl, rect: vid.rect });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
      })();
      return true;
    }
    if (msg.type === 'vs:open-tab' && typeof msg.url === 'string') {
      if (!isSafeHttpUrl(msg.url)) {
        sendResponse({ ok: false, error: 'Blocked navigation to a non-http(s) URL.' });
        return false;
      }
      chrome.tabs.create({ url: msg.url });
      sendResponse({ ok: true });
      return false;
    }
    return false;
  },
);
