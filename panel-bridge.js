(() => {
  'use strict';
  if (window === window.top || new URLSearchParams(location.search).get('embedded') !== '1') return;
  document.documentElement.dataset.embedded = 'true';
  window.autoPreencherSidebarVisible = false;
  window.autoPreencherSidebarTabId = new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'sidebar-tab-id' }, response => resolve(response?.tabId));
  });
  const send = data => window.parent.postMessage(data, '*');
  const reportTheme = () => send({ type: 'auto-preencher-sidebar-theme', theme: document.documentElement.dataset.theme });
  new MutationObserver(reportTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.type !== 'auto-preencher-sidebar-visibility') return;
    const wasVisible = window.autoPreencherSidebarVisible;
    window.autoPreencherSidebarVisible = event.data.visible === true;
    if (!wasVisible && window.autoPreencherSidebarVisible) {
      document.dispatchEvent(new Event('auto-preencher-sidebar-open'));
    }
    if (!window.autoPreencherSidebarVisible) document.activeElement?.blur();
  });
  const isEditing = () => document.hasFocus() && !!document.activeElement?.matches('input,textarea,select,[contenteditable=true]');
  const reportEditing = () => send({ type: 'auto-preencher-sidebar-editing', editing: isEditing() });
  document.addEventListener('focusin', reportEditing);
  document.addEventListener('focusout', () => setTimeout(reportEditing, 0));
  window.addEventListener('blur', () => send({ type: 'auto-preencher-sidebar-editing', editing: false }));
  document.addEventListener('keydown', event => {
    // Let searches and dialogs consume their own Escape before closing the drawer.
    if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) {
      send({ type: 'auto-preencher-sidebar-close' });
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    const actions = document.createElement('div');
    actions.className = 'sidebar-script-actions';
    actions.append(document.querySelector('.preview-actions'), document.getElementById('copiedFlag'));
    document.getElementById('section-scripts').prepend(actions);
    send({ type: 'auto-preencher-sidebar-ready' });
    reportTheme();
  });
})();
