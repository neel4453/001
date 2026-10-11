const x = globalThis, f = x.__APP_NAME__ || "VeriScope", c = {
  name: f,
  storagePrefix: f.toLowerCase().replace(/[^a-z0-9]+/g, "")
}, b = {
  OPEN_SIDE_PANEL: "vs:open-side-panel"
};
function w() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
new Set(
  "a an the of in on at to for and or is are was were be been being by with from as that this these those it its he she they we you i not no than then there here what which who whom whose when where why how do does did done have has had having will would can could may might must shall should".split(
    " "
  )
);
function k(e) {
  try {
    const r = new URL(e);
    return r.protocol === "https:" || r.protocol === "http:";
  } catch {
    return !1;
  }
}
const I = c.storagePrefix, g = {
  pending: `${I}/pending`
}, v = /* @__PURE__ */ new Map();
async function m(e) {
  typeof chrome < "u" && chrome.storage?.session ? await chrome.storage.session.set({ [g.pending]: { ...e, at: w() } }) : v.set(g.pending, e);
}
function S() {
  const e = { ok: !1, title: document.title, url: location.href, blocks: [], text: "", truncated: !1 };
  try {
    const r = ["article", "main", '[role="main"]', ".post-content", "#content", "body"];
    let t = null;
    for (const n of r) {
      const a = document.querySelector(n);
      if (a && (a.textContent ?? "").trim().length > 400) {
        t = a;
        break;
      }
    }
    t || (t = document.body);
    const u = t.querySelectorAll('script,style,noscript,iframe,nav,header,footer,aside,form,button,[aria-hidden="true"]'), o = [];
    u.forEach((n) => {
      o.push({ node: n, next: n.nextSibling, parent: n.parentNode }), n.remove();
    });
    const i = t.querySelectorAll("p,li,blockquote,h1,h2,h3,h4,pre,td,th"), s = [];
    let h = 0;
    const d = 24e4;
    if (i.length > 40)
      for (const n of Array.from(i)) {
        const a = (n.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!(a.length < 25)) {
          if (h + a.length > d) {
            e.truncated = !0;
            break;
          }
          s.push({ text: a, start: h, end: h + a.length, selector: "p" }), h += a.length + 2;
        }
      }
    let p = s.length ? s.map((n) => n.text).join(`

`) : (t.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, d);
    if (!s.length) {
      const n = (t.textContent ?? "").replace(/\s+/g, " ").trim();
      n.length > d && (p = n.slice(0, d), e.truncated = !0);
    }
    for (let n = o.length - 1; n >= 0; n--) {
      const a = o[n];
      a.parent && a.parent.insertBefore(a.node, a.next);
    }
    e.blocks = s, e.text = p, e.ok = p.length > 80, e.ok || (e.error = 'Could not extract readable text (page may render content in frames/shadow DOM). Select text manually and use "Verify selection".');
  } catch (r) {
    e.error = r.message;
  }
  return e;
}
function P() {
  return { text: (document.getSelection()?.toString() ?? "").trim(), url: location.href, title: document.title };
}
function E() {
  const e = document.querySelector("video");
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { rect: { x: r.x, y: r.y, width: r.width, height: r.height }, src: e.currentSrc || e.src || "", time: e.currentTime, title: document.title, poster: e.poster || "" };
}
const l = {
  selection: `${c.storagePrefix}-verify-selection`,
  page: `${c.storagePrefix}-scan-page`,
  image: `${c.storagePrefix}-image-tools`,
  link: `${c.storagePrefix}-save-link`
};
function y() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: l.selection, title: `Verify selection with ${c.name}`, contexts: ["selection"] }), chrome.contextMenus.create({ id: l.page, title: `Analyze this page (${c.name})`, contexts: ["page", "frame"] }), chrome.contextMenus.create({ id: l.image, title: `Image & provenance tools (${c.name})`, contexts: ["image"] }), chrome.contextMenus.create({ id: l.link, title: `Open link evidence tools (${c.name})`, contexts: ["link"] });
  });
}
chrome.runtime.onInstalled.addListener(async (e) => {
  y();
  try {
    await chrome.sidePanel.setOptions({ path: "sidepanel.html", enabled: !0 }), await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: !1 });
  } catch {
  }
  e?.reason === "install" && chrome.tabs.create({ url: chrome.runtime.getURL("options.html") + "?welcome=1" });
});
chrome.runtime.onStartup.addListener(() => y());
chrome.contextMenus.onClicked.addListener(async (e, r) => {
  const t = { url: e.pageUrl ?? r?.url, pageTitle: r?.title, at: w() };
  e.menuItemId === l.selection && e.selectionText ? await m({ kind: "selection", text: e.selectionText.slice(0, 2e5), ...t }) : e.menuItemId === l.page ? await m({ kind: "page", ...t }) : e.menuItemId === l.image && e.srcUrl ? await m({ kind: "image", imageUrl: e.srcUrl, ...t }) : e.menuItemId === l.link && e.linkUrl && await m({ kind: "manual", text: e.linkUrl, ...t });
  try {
    await chrome.sidePanel.open({ windowId: r?.windowId ?? chrome.windows.WINDOW_ID_CURRENT });
  } catch {
  }
});
chrome.runtime.onMessage.addListener(
  (e, r, t) => {
    if (e.type === b.OPEN_SIDE_PANEL)
      return chrome.sidePanel.open({ windowId: r.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT }).catch(() => {
      }), t({ ok: !0 }), !1;
    if (e.type === "vs:scan-page" && typeof e.tabId == "number") {
      const u = e.tabId;
      return (async () => {
        try {
          const [o] = await chrome.scripting.executeScript({
            target: { tabId: u },
            func: S
          }), i = o?.result ?? null;
          !i || !i.ok ? t({ type: "vs:scan-page-result", ok: !1, error: i?.error ?? "Extraction returned no text." }) : t({ type: "vs:scan-page-result", ok: !0, text: i.text, url: i.url, title: i.title });
        } catch (o) {
          t({
            type: "vs:scan-page-result",
            ok: !1,
            error: `This page does not allow script access (${o.message}). chrome:// pages, the Chrome Web Store and some secure pages are protected — select text and use "Verify selection" instead.`
          });
        }
      })(), !0;
    }
    if (e.type === "vs:get-selection" && typeof e.tabId == "number") {
      const u = e.tabId;
      return (async () => {
        try {
          const [o] = await chrome.scripting.executeScript({ target: { tabId: u }, func: P });
          t({ ok: !0, ...o?.result ?? {} });
        } catch (o) {
          t({ ok: !1, error: o.message });
        }
      })(), !0;
    }
    if (e.type === "vs:capture-frame" && typeof e.tabId == "number") {
      const u = e.tabId, o = e.windowId;
      return (async () => {
        try {
          const [i] = await chrome.scripting.executeScript({ target: { tabId: u }, func: E }), s = i?.result;
          if (!s) throw new Error("No <video> element found on this page.");
          const h = await chrome.tabs.captureVisibleTab(typeof o == "number" ? o : chrome.windows.WINDOW_ID_CURRENT, { format: "png" });
          t({ ok: !0, dataUrl: h, rect: s.rect });
        } catch (i) {
          t({ ok: !1, error: i.message });
        }
      })(), !0;
    }
    return e.type === "vs:open-tab" && typeof e.url == "string" ? k(e.url) ? (chrome.tabs.create({ url: e.url }), t({ ok: !0 }), !1) : (t({ ok: !1, error: "Blocked navigation to a non-http(s) URL." }), !1) : !1;
  }
);
