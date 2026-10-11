/* Minimal chrome.* mock sufficient for unit tests. Not a browser emulator. */
const asMap = () => {
  const data: Record<string, unknown> = {};
  return {
    async get(keys: string | string[] | Record<string, unknown>) {
      const out: Record<string, unknown> = {};
      const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys as object);
      for (const k of list) if (k in data) out[k] = structuredClone(data[k]);
      return out;
    },
    async set(items: Record<string, unknown>) { Object.assign(data, structuredClone(items)); },
    async remove(keys: string[]) { for (const k of keys) delete data[k]; },
    __data: data,
  };
};

const chromeMock = {
  runtime: {
    id: 'test-extension',
    lastError: undefined,
    sendMessage: () => Promise.resolve({ ok: true }),
    getURL: (p: string) => `chrome-extension://test/${p}`,
    openOptionsPage: () => undefined,
    onInstalled: { addListener: () => undefined },
    onStartup: { addListener: () => undefined },
    onMessage: { addListener: () => undefined, removeListener: () => undefined },
  },
  storage: { local: asMap(), session: asMap(), onChanged: { addListener: () => undefined, removeListener: () => undefined } },
  tabs: { query: () => Promise.resolve([{ id: 1, url: 'https://example.com/article', title: 'Article' }]), create: () => undefined, captureVisibleTab: () => Promise.resolve('data:image/png;base64,') },
  scripting: { executeScript: () => Promise.resolve([{ result: { ok: true, text: '', url: 'https://example.com', title: 'x' } }]) },
  contextMenus: { create: () => undefined, removeAll: (cb?: () => void) => cb?.(), onClicked: { addListener: () => undefined } },
  sidePanel: { setOptions: () => Promise.resolve(), setPanelBehavior: () => Promise.resolve(), open: () => Promise.resolve() },
  permissions: { contains: () => Promise.resolve(true), request: () => Promise.resolve(true) },
  windows: { WINDOW_ID_CURRENT: -2, getCurrent: () => Promise.resolve({ id: 1 }) },
  action: { openPopup: () => Promise.resolve() },
};

(globalThis as any).chrome = chromeMock;
export { chromeMock };
