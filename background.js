if (typeof importScripts === 'function') importScripts('expander-revisions.js');

const WITHUB_URL_PART = "app.withub.ai/attendance/";
const NATIVE_URL_PART = "native-infinity.com.br";

function isWithubBetaUrl(value) {
  try {
    return new URL(value).hostname === 'app-beta.withub.ai';
  } catch { return false; }
}

function isWithubUrl(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && (url.hostname === 'app.withub.ai'
      || url.hostname.endsWith('.app.withub.ai') || url.hostname === 'app-beta.withub.ai');
  } catch { return false; }
}

function isModernWithubUrl(value) {
  try {
    const url = new URL(value);
    return isWithubBetaUrl(value) || (url.hostname === 'app.withub.ai'
      && (!/^\/attendance\/\d+/.test(url.pathname) || url.searchParams.has('idTicket')));
  } catch { return false; }
}

const DEFAULT_EXPANDER_TAGS = [
  {
    id: "tag-age-default",
    shortcut: "#age",
    label: "Agendamento confirmado",
    body:
      "Sua visita técnica está agendada! 😊\n\n" +
      "📅 Data: {{DATA}}\n" +
      "🕒 Turno: {{TURNO}}\n\n" +
      "Por gentileza, garanta que uma pessoa maior de 18 anos esteja no local para acompanhar o atendimento.\n\n" +
      "Se houver disponibilidade para antecipar a visita, nossa equipe de agendamento entrará em contato para verificar uma nova data com você.",
  },
];

async function ensureDefaultTags() {
  const res = await chrome.storage.local.get(["expanderTags", "expanderTagsBeforeRevisionV1"]);
  if (!res.expanderTags || !Array.isArray(res.expanderTags) || res.expanderTags.length === 0) {
    await chrome.storage.local.set({ expanderTags: DEFAULT_EXPANDER_TAGS });
    return;
  }
  if (typeof reviseExpanderTags === 'function') {
    const revision = reviseExpanderTags(res.expanderTags);
    if (revision.changed) {
      const values = { expanderTags: revision.tags };
      // Save the current library before the first revision, including its audio.
      if (!res.expanderTagsBeforeRevisionV1) values.expanderTagsBeforeRevisionV1 = res.expanderTags;
      await chrome.storage.local.set(values);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => ensureDefaultTags());
chrome.runtime.onStartup.addListener(() => ensureDefaultTags());

// ==========================================
// EXTRAÇÃO NATIVE INFINITY
// ==========================================
function extractNativeData() {
  const flexDivs = document.querySelectorAll("div.flex.items-center.space-x-1");
  let telefone = "";
  let protocolo = "";

  flexDivs.forEach(div => {
    const ps = div.querySelectorAll("p");
    if (ps.length === 2) {
      const text = ps[1].textContent.trim();
      if (/^\d{10,13}$/.test(text)) {
        telefone = text;
      } else if (/^\d{14,}$/.test(text)) {
        protocolo = text;
      }
    }
  });

  if (telefone) {
    let digits = telefone.replace(/\D/g, "");
    if (digits.startsWith("55")) digits = digits.slice(2);
    
    if (digits.length === 10) telefone = `${digits.slice(0, 2)} 9 ${digits.slice(2)}`;
    else if (digits.length === 11) telefone = `${digits.slice(0, 2)} ${digits.slice(2, 3)} ${digits.slice(3)}`;
  }

  return { nome: "", telefone, protocolo };
}

// ==========================================
// EXTRAÇÃO MUNDIALE / WITHUB
// ==========================================
async function extractDataFromPage() {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const profileTab = 
    document.querySelector("#mui-p-98812-T-Profile") || 
    document.querySelector("[aria-controls*='Profile']") ||
    Array.from(document.querySelectorAll("button, [role='tab']")).find((el) => el.textContent.trim().toLowerCase().includes("perfil"));

  if (profileTab) {
    profileTab.click();
    await sleep(400);
  }

  function getValueByLabel(labelKeywords) {
    const labelEls = document.querySelectorAll("h6, h5, h4, span, label, strong, b, p");
    for (const el of labelEls) {
      const t = el.textContent.trim().toLowerCase();
      const matches = labelKeywords.some((kw) => t.startsWith(kw) || t === kw);
      if (!matches) continue;

      let sib = el.nextElementSibling;
      if (sib && sib.textContent.trim()) return sib.textContent.trim();

      const parent = el.parentElement;
      if (parent) {
        for (const c of parent.children) {
          if (c !== el && c.textContent.trim()) return c.textContent.trim();
        }
      }
    }
    return "";
  }

  function findPhoneRawText() {
    const candidates = Array.from(document.querySelectorAll("p, span, b, strong, td, a"));
    for (const el of candidates) {
      const txt = el.textContent.trim();
      if (txt.length < 100 && (txt.includes("@meta-whatsapp") || txt.includes("@meta"))) return txt;
    }
    for (const el of candidates) {
      const txt = el.textContent.trim();
      if (txt.length < 100 && txt.includes("@")) {
        const clean = txt.split("@")[0].replace(/\D/g, "");
        if (clean.length >= 10 && clean.length <= 13) return txt;
      }
    }
    const byLabel = getValueByLabel(["telefone principal", "telefone", "celular"]);
    if (byLabel && byLabel.length < 50) return byLabel;
    return "";
  }

  function formatPhoneNumber(rawText) {
    if (!rawText) return "";
    const cleanText = rawText.split("@")[0];
    let digits = cleanText.replace(/\D/g, "");

    if (digits.startsWith("55")) digits = digits.slice(2);
    if (digits.length === 10) return `${digits.slice(0, 2)} 9 ${digits.slice(2)}`;
    if (digits.length === 11) return `${digits.slice(0, 2)} ${digits.slice(2, 3)} ${digits.slice(3)}`;
    if (digits.length > 2) return `${digits.slice(0, 2)} 9 ${digits.slice(2)}`;
    return digits;
  }

  function findProtocolNumber() {
    const urlMatch = window.location.pathname.match(/\/attendance\/(\d+)/);
    if (urlMatch && urlMatch[1]) return urlMatch[1];

    const spans = Array.from(document.querySelectorAll("span.css-12tehev, span.MuiTypography-caption, span, p"));
    for (const span of spans) {
      const match = span.textContent.match(/#(\d{4,15})/);
      if (match && match[1]) return match[1];
    }
    return "";
  }

  const nomeEl = document.querySelector("h3.css-4ze5yl") || document.querySelector("h3.MuiTypography-h3");
  const nomeCompleto = (nomeEl ? nomeEl.textContent.trim() : "") || getValueByLabel(["nome completo", "nome do cliente", "nome"]);
  const nome = nomeCompleto ? nomeCompleto.trim().split(/\s+/)[0] : "";

  const telefoneRaw = findPhoneRawText();
  const telefone = formatPhoneNumber(telefoneRaw);
  const protocolo = findProtocolNumber();

  if (!nome && !telefone && !protocolo) return null;
  return { nome, telefone, protocolo };
}

// Current Withub and beta share this layout. Keep this function self-contained for injection.
async function extractBetaDataFromPage(protocolOnly = false) {
  const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  function readProtocol() {
    return Array.from(document.querySelectorAll('[class~="bg-primary/15"] span.text-primary'))
      .find(el => visible(el) && /^\d{4,20}$/.test(el.textContent.trim()))?.textContent.trim() || '';
  }
  if (protocolOnly) return { protocolo: readProtocol() };

  function readPhone() {
    const labels = Array.from(document.querySelectorAll('span, strong, b, label'));
    // Prefer the main phone; idLead may contain a WhatsApp address instead of a plain number.
    for (const pattern of [/^telefone principal\s*:?$/i, /^idLead\s*:?$/i]) {
      for (const label of labels.filter(el => visible(el) && pattern.test(el.textContent.trim()))) {
        const sibling = label.nextElementSibling;
        if (sibling && !visible(sibling)) continue;
        const raw = sibling ? sibling.textContent.trim()
          : label.parentElement?.textContent.slice(label.textContent.length).trim() || '';
        const number = raw.split('@')[0].trim();
        if (/^\+?[\d\s().-]+$/.test(number)) {
          const digits = number.replace(/\D/g, '');
          if (/^\d{10,11}$/.test(digits) || /^55\d{10,11}$/.test(digits)) return number;
        }
      }
    }
    return '';
  }
  function readName() {
    return Array.from(document.querySelectorAll('h2[data-slot="tooltip-trigger"], h2.truncate'))
      .find(visible)?.textContent.trim().split(/\s+/)[0] || '';
  }

  if (!readPhone()) {
    const icon = Array.from(document.querySelectorAll('svg.lucide-app-window')).find(visible);
    const button = icon?.closest('button, [role="button"], [role="tab"]') || icon?.parentElement;
    if (button && button.getAttribute('aria-selected') !== 'true' && button.getAttribute('data-state') !== 'active') {
      // Tab controls may activate on mousedown rather than click (e.g. Radix).
      if (button.getAttribute('role') === 'tab' || button.getAttribute('data-slot') === 'tabs-trigger') {
        const options = { bubbles: true, cancelable: true, button: 0, buttons: 1, ctrlKey: false };
        button.dispatchEvent(new PointerEvent('pointerdown', { ...options, pointerType: 'mouse' }));
        button.dispatchEvent(new MouseEvent('mousedown', options));
        button.dispatchEvent(new PointerEvent('pointerup', { ...options, buttons: 0, pointerType: 'mouse' }));
        button.dispatchEvent(new MouseEvent('mouseup', { ...options, buttons: 0 }));
      }
      button.click();
      for (let attempt = 0; attempt < 50; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (readPhone() && readName() && readProtocol()) break;
      }
    }
  }

  const nome = readName();
  let digits = readPhone().replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  const telefone = digits.length === 10 ? `${digits.slice(0, 2)} 9 ${digits.slice(2)}`
    : digits.length === 11 ? `${digits.slice(0, 2)} ${digits.slice(2, 3)} ${digits.slice(3)}` : digits;
  const protocolo = readProtocol();
  return nome || telefone || protocolo ? { nome, telefone, protocolo } : null;
}

// Extração do histórico de Chat
function extractFullChatFromPage() {
  const msgEls = document.querySelectorAll("div.css-1fy0vq2");
  if (!msgEls || msgEls.length === 0) {
    const fallbackBox = document.querySelector(".css-124fws5");
    if (fallbackBox) return fallbackBox.innerText.trim();
    return null;
  }
  let chatHistoryText = [];
  msgEls.forEach((el, index) => {
    let rawText = el.innerText.trim().replace(/\s+/g, " ");
    if (rawText) chatHistoryText.push(`[Mensagem ${index + 1}]: ${rawText}`);
  });
  return chatHistoryText.join("\n\n");
}

function notify(message) {
  chrome.notifications?.create({
    type: "basic",
    iconUrl: "icon128.png",
    title: "Auto Preencher",
    message,
  });
}

// ==========================================
// FUNÇÃO CENTRALIZADA PARA BUSCAR DADOS
// ==========================================
async function extractSpecificTab(urlPart, funcToInject, preferredTabId) {
  const tabs = await chrome.tabs.query({});
  const sourceTabs = tabs.filter((t) => t.url && (urlPart === WITHUB_URL_PART
    ? isWithubUrl(t.url) : t.url.includes(urlPart)));

  sourceTabs.sort((a, b) => (b.id === preferredTabId ? 2 : b.active ? 1 : 0)
    - (a.id === preferredTabId ? 2 : a.active ? 1 : 0));

  for (const tab of sourceTabs) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: funcToInject === extractDataFromPage && isModernWithubUrl(tab.url) ? extractBetaDataFromPage : funcToInject,
      });
      if (result?.result) return result.result;
    } catch (e) {}
  }
  return null;
}

// Controla qual sistema será lido baseado no atalho acionado
async function runAutofill(targetSystem, tabId) {
  const panelTabId = tabId ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  let extracted = null;
  let sysName = "";

  if (targetSystem === "native") {
    // FORÇA a busca exclusivamente na URL do Native e usando o extrator do Native
    extracted = await extractSpecificTab(NATIVE_URL_PART, extractNativeData);
    sysName = "Native";
    if (extracted) extracted.source = "native"; // Marca a origem
  } else if (targetSystem === "withub") {
    // FORÇA a busca exclusivamente na URL do Withub
    extracted = await extractSpecificTab(WITHUB_URL_PART, extractDataFromPage, panelTabId);
    sysName = "Mundiale";
    if (extracted) extracted.source = "withub"; // Marca a origem
  } else {
    // Fallback genérico para o botão "Buscar Dados" da UI
    extracted = await extractSpecificTab(WITHUB_URL_PART, extractDataFromPage, panelTabId);
    sysName = "Mundiale";
    if (extracted) extracted.source = "withub";
    if (!extracted) {
      extracted = await extractSpecificTab(NATIVE_URL_PART, extractNativeData);
      sysName = "Native";
      if (extracted) extracted.source = "native";
    }
  }

  if (!extracted) {
    notify(`Não encontrei os dados. Verifique se a aba do ${sysName || "atendimento"} está aberta.`);
    return;
  }

  await chrome.storage.local.set({ 
    pendingAutofill: extracted,
    pendingAutofillTabId: panelTabId ?? null,
    currentProtocol: extracted.protocolo || "" 
  });
  await openPanel(panelTabId);
  notify(`[${sysName}] Painel preenchido: ${extracted.nome || "-"} / ${extracted.telefone || "-"} / ${extracted.protocolo || "-"}`);
}

async function extractFullChatFromTabs() {
  return await extractSpecificTab(WITHUB_URL_PART, extractFullChatFromPage);
}

async function autoUpdateProtocolFromTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && isWithubUrl(tab.url) && !isModernWithubUrl(tab.url)) {
      const urlMatch = tab.url.match(/\/attendance\/(\d+)/);
      if (urlMatch && urlMatch[1]) {
        await chrome.storage.local.set({ currentProtocol: urlMatch[1] });
      }
    } else if (tab && isModernWithubUrl(tab.url)) {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId }, func: extractBetaDataFromPage, args: [true]
      });
      if (result?.result?.protocolo) {
        await chrome.storage.local.set({ currentProtocol: result.result.protocolo });
      }
    }
  } catch (e) {}
}

chrome.tabs.onActivated.addListener((activeInfo) => autoUpdateProtocolFromTab(activeInfo.tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") autoUpdateProtocolFromTab(tabId);
});

// Open the drawer in the invoking tab. Restricted browser pages cannot host it.
async function openPanel(tabId) {
  const tab = typeof tabId === "number" ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.id || !/^(https?|file):/i.test(tab.url || "")) {
    notify("Abra uma página de um site para usar a barra lateral. O navegador bloqueia extensões nas páginas internas.");
    return { done: false };
  }
  try {
    const message = { action: "show-sidebar" };
    try {
      const response = await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 });
      if (response?.done) return response;
    } catch {}
    // Also supports pages opened before the extension was reloaded.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["sidebar.js"] });
    return await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 });
  } catch {
    notify("Não foi possível abrir a barra nesta página. Atualize a página ou abra outro site.");
    return { done: false };
  }
}

chrome.action?.onClicked.addListener(tab => openPanel(tab.id));

// Listener de Comandos do Manifest
chrome.commands.onCommand.addListener((command) => {
  if (command === "run-autofill-withub") runAutofill("withub");
  if (command === "run-autofill-native") runAutofill("native");
  if (command === "open-panel") openPanel();
});

// Listener de Mensagens (Separa as chamadas baseadas na trigger)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === "sidebar-tab-id") {
    sendResponse({ tabId: sender?.tab?.id });
    return;
  }
  if (msg?.action === "run-autofill-native") {
    runAutofill("native", sender?.tab?.id).then(() => sendResponse({ done: true }));
    return true;
  }
  if (msg?.action === "run-autofill-withub") {
    runAutofill("withub", sender?.tab?.id).then(() => sendResponse({ done: true }));
    return true;
  }
  if (msg?.action === "run-autofill") {
    runAutofill("generic", sender?.tab?.id).then(() => sendResponse({ done: true }));
    return true;
  }
  if (msg?.action === "open-panel") {
    openPanel(sender?.tab?.id).then(sendResponse);
    return true;
  }
  if (msg?.action === "extract-data") {
    extractSpecificTab(WITHUB_URL_PART, extractDataFromPage, sender?.tab?.id).then((data) => {
      if(data) { 
        data.source = "withub"; 
        sendResponse({ data }); 
        return; 
      }
      extractSpecificTab(NATIVE_URL_PART, extractNativeData).then(nd => {
        if(nd) nd.source = "native";
        sendResponse({ data: nd });
      });
    });
    return true;
  }
  if (msg?.action === "extract-full-chat") {
    extractFullChatFromTabs().then((chatText) => sendResponse({ chatText }));
    return true;
  }
});
