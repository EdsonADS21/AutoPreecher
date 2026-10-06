(() => {
  'use strict';
  // Text Expander still runs in every frame; the drawer belongs only to the page.
  if (window !== window.top || document.getElementById('auto-preencher-sidebar')) return;

  const host = document.createElement('div');
  host.id = 'auto-preencher-sidebar';
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0 0 0 auto!important;width:min(480px,100vw)!important;z-index:2147483646!important;pointer-events:none!important;display:block!important;';
  host.dataset.theme = 'dark';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      :host{color-scheme:dark;--drawer-bg:#101a2e;--drawer-text:#f0f5ff;--drawer-muted:#a9bdd7;--drawer-border:#334866;--drawer-button:#1c2d46;--drawer-accent:#93b9ff}
      :host([data-theme=light]){color-scheme:light;--drawer-bg:#f0f4fa;--drawer-text:#172a46;--drawer-muted:#5d708b;--drawer-border:#d9e2f0;--drawer-button:#e5edf9;--drawer-accent:#245ce0}*{box-sizing:border-box;font-family:"Segoe UI",system-ui,sans-serif}
      button{cursor:pointer;color:inherit;font-size:12px;border:1px solid var(--drawer-border);background:var(--drawer-button);border-radius:5px}button:focus-visible{outline:2px solid var(--drawer-accent);outline-offset:3px}
      .launcher{position:absolute;right:0;top:50%;width:42px;height:48px;transform:translate(26px,-50%);pointer-events:auto;display:grid;place-items:center;background:#245ce0;color:#fff;border:1px solid #194bc4;box-shadow:0 5px 20px #14253f30;border-radius:10px 0 0 10px;transition:right 160ms ease,transform 160ms ease}.launcher:hover,.launcher:focus-visible{transform:translate(0,-50%)}.launcher svg{width:24px;height:24px}
      .drawer{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;pointer-events:none;background:var(--drawer-bg);color:var(--drawer-text);border:0;border-radius:0;box-shadow:none;transform:translateX(calc(100% + 24px));visibility:hidden;transition:transform 160ms ease,visibility 160ms}.drawer.open{transform:translateX(0);visibility:visible;pointer-events:auto}
      .toolbar{display:flex;align-items:center;gap:10px;padding:14px 12px;border-bottom:1px solid var(--drawer-border);flex-shrink:0;background:var(--drawer-bg)}.brand-symbol{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:#245ce0;color:#fff;flex-shrink:0}.brand-symbol svg{width:21px;height:21px}.title{flex:1;font-family:Bahnschrift,"Segoe UI",sans-serif;font-size:15px;font-weight:600;letter-spacing:-.3px}.title small{display:block;font:10px "Segoe UI",sans-serif;color:var(--drawer-muted);margin-top:3px;letter-spacing:0}
      .toolbar button{padding:8px 10px}.pin[aria-pressed=true]{background:#245ce0;color:#fff;border-color:#245ce0}.close{font-size:20px;line-height:18px}.body{position:relative;flex:1;min-height:0}iframe{display:block;width:100%;height:100%;border:0;background:var(--drawer-bg)}.loading{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;background:var(--drawer-bg);font-size:13px;color:var(--drawer-muted)}.loading[hidden]{display:none}
      @media(min-width:600px){.launcher[aria-expanded=true]{right:calc(100% + 8px);transform:translate(0,-50%);border-radius:10px}}@media(max-width:599px){.launcher[aria-expanded=true]{visibility:hidden}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
    </style>
    <button class="launcher" aria-label="Abrir Auto Preencher" aria-expanded="false" aria-controls="drawer" title="Auto Preencher — clique para abrir">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h6M5 12h11M5 19h6m10-7-5-5m5 5-5 5"/></svg>
    </button>
    <section class="drawer" id="drawer" role="region" aria-label="Ferramentas Auto Preencher" aria-hidden="true" inert>
      <div class="toolbar"><span class="brand-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h6M5 12h11M5 19h6m10-7-5-5m5 5-5 5"/></svg></span><div class="title">Auto Preencher<small>Menos etapas. Mais foco.</small></div><button class="pin" aria-pressed="false" title="Manter a barra aberta ao sair com o mouse">Fixar</button><button class="close" aria-label="Recolher barra lateral" title="Recolher (Esc)">×</button></div>
      <div class="body"><div class="loading" role="status">Carregando ferramentas…</div></div>
    </section>`;
  document.documentElement.appendChild(host);
  function applyDrawerTheme(theme) {
    if (theme === 'dark' || theme === 'light') host.dataset.theme = theme;
  }
  // Match the saved theme while the embedded panel is still loading.
  try {
    chrome.storage.local.get(['scriptPanelState'], result => applyDrawerTheme(result.scriptPanelState?.theme || 'light'));
  } catch {}

  const launcher = root.querySelector('.launcher');
  const drawer = root.querySelector('.drawer');
  const pin = root.querySelector('.pin');
  const loading = root.querySelector('.loading');
  let frame, ready = false, opened = false, pinned = false, editing = false;
  let closeTimer, loadingTimer, pointerInside = false;
  const frameUrl = chrome.runtime.getURL('panel.html');
  const parsed = new URL(frameUrl);
  const frameOrigin = `${parsed.protocol}//${parsed.host}`;

  function sendVisibility() {
    if (ready) frame.contentWindow.postMessage({ type: 'auto-preencher-sidebar-visibility', visible: opened }, frameOrigin);
  }
  function mountPanel() {
    if (frame) return;
    frame = document.createElement('iframe');
    frame.title = 'Painel Auto Preencher';
    frame.allow = 'clipboard-write';
    frame.src = `${frameUrl}?embedded=1`;
    root.querySelector('.body').appendChild(frame);
    loadingTimer = setTimeout(() => {
      if (!ready) loading.textContent = 'Não foi possível carregar. Recarregue a extensão e atualize esta página.';
    }, 10000);
  }
  function open() {
    clearTimeout(closeTimer);
    opened = true;
    drawer.inert = false;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    launcher.setAttribute('aria-expanded', 'true');
    mountPanel();
    sendVisibility();
  }
  function close(restoreFocus = true) {
    clearTimeout(closeTimer);
    opened = false;
    editing = false;
    pinned = false;
    pin.setAttribute('aria-pressed', 'false');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    launcher.setAttribute('aria-expanded', 'false');
    sendVisibility();
    if (restoreFocus) launcher.focus({ preventScroll: true });
  }
  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (opened && !pinned && !editing && !pointerInside) close(false);
    }, 450);
  }
  for (const element of [launcher, drawer]) {
    element.addEventListener('pointerenter', () => { pointerInside = true; clearTimeout(closeTimer); });
    element.addEventListener('pointerleave', () => { pointerInside = false; scheduleClose(); });
  }
  launcher.addEventListener('click', () => { open(); });
  launcher.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  root.querySelector('.close').addEventListener('click', () => close());
  pin.addEventListener('click', () => {
    pinned = !pinned;
    pin.setAttribute('aria-pressed', String(pinned));
    if (!pinned && !pointerInside) scheduleClose();
  });
  root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } });
  window.addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== frameOrigin) return;
    if (event.data?.type === 'auto-preencher-sidebar-ready') {
      ready = true;
      clearTimeout(loadingTimer);
      loading.hidden = true;
      sendVisibility();
    } else if (event.data?.type === 'auto-preencher-sidebar-theme') {
      applyDrawerTheme(event.data.theme);
    } else if (event.data?.type === 'auto-preencher-sidebar-editing') {
      editing = event.data.editing === true;
      if (!editing && !pointerInside) scheduleClose();
    } else if (event.data?.type === 'auto-preencher-sidebar-close') close();
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.action !== 'show-sidebar') return;
    open();
    respond({ done: true });
  });
})();
