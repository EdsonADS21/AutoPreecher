// CHAVE DA API DO GEMINI CONFIGURADA

const STORAGE_KEY = "scriptPanelState";
const EXPANDER_KEY = "expanderTags";

const ATENDIMENTO_PRESETS = {
  "LENTIDÃO": {
    desc: "CLIENTE ENTROU EM CONTATO ALEGANDO LENTIDÃO E OCILAÇÃO NA SUA CONEXÃO (JA FOI FEITO TODAS AS CONFIGURAÇÕES MESMO ASSIM NÃO HOUVE MELHORA)",
    problema: "LENTIDÃO",
  },
  "DESCONEXÃO LOS": {
    desc: "CLIENTE ENTROU EM CONTATO ALEGANDO DESCONEXÃO COM LED VERMELHO NO LOS MESMO TENDO FEITO OS PROCEDIMENTOS PADRÕES NÃO FOI RECONECTADO",
    problema: "DESCONEXÃO LOS",
  },
  "DESCONEXÃO PON": {
    desc: "CLIENTE ENTROU EM CONTATO DESCONECTADO COM LUZ DA PON PISCANDO (JA FOI FEITO A TENTATIVA DE REATIVAÇÃO DA PON MAIS NAO FOI RECONECTADO)",
    problema: "DESCONEXÃO PON",
  },
  "SEM ACESSO AO WIFI": {
    desc: "CLIENTE ENTROU EM CONTATO SEM ACESSO A REDE WIFI 2.4 E 5 GHZ (JA FOI FEITO ALGUNS PROCEDIMENTOS MAIS NÃO REESTABELECEU)",
    problema: "SEM ACESSO AO WIFI",
  },
  "SINAL ALTO": {
    desc: "CLIENTE ENTRA EM CONTATO ALEGANDO ESTAR COM MUITA OCILAÇÃO NA SUA REDE QUE ESTA SENDO CAUSADA DEVIDO AO SINAL DA SUA FIBRA ESTAR ATENUADO",
    problema: "SINAL ALTO",
  },
  "DESCONECTADO RADIO": {
    desc: "CLIENTE ENTROU EM CONTATO INFORMANDO QUE SUA REDE ESTÁ APRESENTANDO DESCONEXÕES",
    problema: "DESCONECTADO RADIO",
  },
  "OUTROS": { desc: "", problema: "" },
};

const ROUTER_PORTS = [
  { protocol: "http", port: "80" },
  { protocol: "http", port: "9595" },
  { protocol: "http", port: "9596" },
  { protocol: "http", port: "9597" },
  { protocol: "http", port: "8080" },
  { protocol: "http", port: "3000" },
  { protocol: "https", port: "9595" },
  { protocol: "https", port: "9596" },
];

const defaultState = {
  theme: "light",
  autoOn: true,
  activeSection: "scripts",
  activeTab: "atendimento",
  routerIp: "",
  bloco: { nome: "", tel: "", proto: "", desc: "" },
  atendimento: { nome: "", tel: "", proto: "", descChip: "", desc: "", problema: "" },
  agendamento: { nome: "", tel: "", periodo: "", local: "", canal: "", proto: "", motivoChip: "", motivo: "" },
  solucionado: { solucionado: "", validou: "", proto: "", procChips: [], proc: "" },
};

let state = structuredClone(defaultState);
let chatHistory = [];
let currentAudioBase64 = null;
let currentAudioName = "";
let pendingChatImageBase64 = null;
let macSearchTimeout = null;

function save() {
  chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function load() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      const saved = res[STORAGE_KEY];
      if (saved) {
        state = {
          ...structuredClone(defaultState),
          ...saved,
          bloco: { ...structuredClone(defaultState.bloco), ...(saved.bloco || {}) },
          atendimento: { ...structuredClone(defaultState.atendimento), ...(saved.atendimento || {}) },
          agendamento: { ...structuredClone(defaultState.agendamento), ...(saved.agendamento || {}) },
          solucionado: { ...structuredClone(defaultState.solucionado), ...(saved.solucionado || {}) },
        };
        if (!Array.isArray(state.solucionado.procChips)) state.solucionado.procChips = [];
        if (typeof state.atendimento.desc !== "string") state.atendimento.desc = "";
        if (!state.activeSection) state.activeSection = "scripts";
      }
      resolve();
    });
  });
}

function mark(selected, value) {
  return selected === value ? "X" : " ";
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
}

function applyAutoToggleUI() {
  const el = document.getElementById("autoToggle");
  el.classList.toggle("on", state.autoOn);
}

/* ==================================================================
   CONSTRUTORES DOS SCRIPTS (CAIXA ALTA)
================================================================== */
function buildAtendimento() {
  const d = state.atendimento;
  return [
    `Com quem conversou: ${(d.nome || "").toUpperCase()}`,
    `Telefone de contato: ${(d.tel || "").toUpperCase()}`,
    `Protocolo OPA/ Native: ${(d.proto || "").toUpperCase()}`,
    `Descrição do Atendimento: ${(d.desc || "").toUpperCase()}`,
    `Problema Real do Cliente: ${(d.problema || "").toUpperCase()}`,
  ].join("\n");
}

function buildAgendamento() {
  const d = state.agendamento;
  return [
    `QUEM VAI ACOMPANHAR: ${(d.nome || "").toUpperCase()}`,
    `TELEFONE: ${(d.tel || "").toUpperCase()}`,
    `PERIODO: MANHA ( ${mark(d.periodo, "MANHA")} )  TARDE    ( ${mark(d.periodo, "TARDE")} )`,
    `LOCALIZAÇÃO OU REFERÊNCIA: ${d.local || ""}`,
    `CONVERSOU COM O CLIENTE POR : PRESENCIAL( ${mark(d.canal, "PRESENCIAL")} ) LIGAÇÃO ( ${mark(d.canal, "LIGACAO")} )   OPA ( ${mark(d.canal, "OPA")} )`,
    `PROTOCOLO : ${(d.proto || "").toUpperCase()}`,
    `MOTIVO DA VISITA: ${(d.motivo || "").toUpperCase()}`,
  ].join("\n");
}

function buildSolucionado() {
  const d = state.solucionado;
  return [
    `Problema Solucionado? SIM ( ${mark(d.solucionado, "SIM")} ) NÃO ( ${mark(d.solucionado, "NAO")} )`,
    `Cliente validou? SIM ( ${mark(d.validou, "SIM")} ) NÃO ( ${mark(d.validou, "NAO")} )`,
    `Protocolo OPA/ Native: ${(d.proto || "").toUpperCase()}`,
    `Procedimentos Realizados: ${(d.proc || "").toUpperCase()}`,
  ].join("\n");
}

const builders = {
  atendimento: buildAtendimento,
  agendamento: buildAgendamento,
  solucionado: buildSolucionado,
};

const tags = {
  atendimento: "ATENDIMENTO",
  agendamento: "AGENDAMENTO",
  solucionado: "SOLUCIONADO",
};

function renderInputs() {
  // Evitar que o cursor pule pro final se o usuário estiver digitando
  const activeEl = document.activeElement;
  
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && el !== activeEl) el.value = val;
  };

  setVal("at-nome", state.atendimento.nome);
  setVal("at-tel", state.atendimento.tel);
  setVal("at-proto", state.atendimento.proto);
  setVal("at-desc", state.atendimento.desc);
  setVal("at-problema", state.atendimento.problema);
  
  document.querySelectorAll("#at-chips .chip").forEach((chip) => {
    chip.classList.toggle("selected", state.atendimento.descChip === chip.dataset.value);
  });

  setVal("ag-nome", state.agendamento.nome);
  setVal("ag-tel", state.agendamento.tel);
  setVal("ag-local", state.agendamento.local);
  setVal("ag-proto", state.agendamento.proto);
  setVal("ag-motivo", state.agendamento.motivo);
  
  document.querySelectorAll("#ag-motivo-chips .chip").forEach((chip) => {
    chip.classList.toggle("selected", state.agendamento.motivoChip === chip.dataset.value);
  });
  document.querySelectorAll("#ag-periodo .choice").forEach((c) => {
    c.classList.toggle("selected", state.agendamento.periodo === c.dataset.value);
  });
  document.querySelectorAll("#ag-canal .choice").forEach((c) => {
    c.classList.toggle("selected", state.agendamento.canal === c.dataset.value);
  });

  setVal("so-proto", state.solucionado.proto);
  setVal("so-proc", state.solucionado.proc);
  
  document.querySelectorAll("#so-proc-chips .chip").forEach((chip) => {
    chip.classList.toggle("selected", state.solucionado.procChips.includes(chip.dataset.value));
  });
  document.querySelectorAll("#so-solucionado .choice").forEach((c) => {
    c.classList.toggle("selected", state.solucionado.solucionado === c.dataset.value);
  });
  document.querySelectorAll("#so-validou .choice").forEach((c) => {
    c.classList.toggle("selected", state.solucionado.validou === c.dataset.value);
  });

  if (state.bloco) {
    setVal("nb-nome", state.bloco.nome || "");
    setVal("nb-tel", state.bloco.tel || "");
    setVal("nb-proto", state.bloco.proto || "");
    setVal("nb-desc", state.bloco.desc || "");
  }

  setVal("router-ip-input", state.routerIp || "");
}

function renderTabs() {
  document.querySelectorAll(".chip-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === state.activeTab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${state.activeTab}`);
  });
}

function renderPreview() {
  const tab = state.activeTab;
  const text = builders[tab]();
  document.getElementById("ticket-tag").textContent = tags[tab];
  document.getElementById("ticket-stamp").textContent = new Date().toLocaleDateString("pt-BR");

  const body = document.getElementById("ticket-body");
  const hasContent = Object.values(state[tab]).some((v) =>
    Array.isArray(v) ? v.length > 0 : String(v).trim() !== ""
  );

  if (!hasContent) {
    body.innerHTML = `<span class="empty">Preencha o formulário ao lado…</span>`;
  } else {
    body.textContent = text;
  }
}

function renderSections() {
  document.querySelectorAll(".rail .tab-btn[data-section]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === state.activeSection);
  });
  document.querySelectorAll(".section-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `section-${state.activeSection}`);
  });
  const shell = document.getElementById("shell");
  shell.classList.toggle("no-preview", state.activeSection !== "scripts");
}

function renderAll() {
  applyTheme();
  applyAutoToggleUI();
  renderSections();
  renderTabs();
  renderInputs();
  renderPreview();
  renderRouterPorts();
  renderChatMessages();
}

document.querySelectorAll(".rail .tab-btn[data-section]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.activeSection = btn.dataset.section;
    save();
    renderSections();
  });
});

document.querySelectorAll(".chip-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.activeTab = btn.dataset.tab;
    save();
    renderTabs();
    renderPreview();
  });
});

// ==================================================================
// EVENTOS DE SINCRONIZAÇÃO ENTRE ABAS
// ==================================================================
document.getElementById("at-nome").addEventListener("input", (e) => {
  const val = e.target.value;
  state.atendimento.nome = val;
  state.agendamento.nome = val; // Sincroniza
  save();
  renderInputs();
  renderPreview();
});
document.getElementById("at-tel").addEventListener("input", (e) => {
  const val = e.target.value;
  state.atendimento.tel = val;
  state.agendamento.tel = val; // Sincroniza
  save();
  renderInputs();
  renderPreview();
});
document.getElementById("at-proto").addEventListener("input", (e) => {
  const val = e.target.value;
  state.atendimento.proto = val;
  state.agendamento.proto = val; // Sincroniza
  state.solucionado.proto = val; // Sincroniza
  chrome.storage.local.set({ currentProtocol: val });
  save();
  renderInputs();
  renderPreview();
});

document.getElementById("ag-nome").addEventListener("input", (e) => {
  const val = e.target.value;
  state.agendamento.nome = val;
  state.atendimento.nome = val; // Sincroniza
  save();
  renderInputs();
  renderPreview();
});
document.getElementById("ag-tel").addEventListener("input", (e) => {
  const val = e.target.value;
  state.agendamento.tel = val;
  state.atendimento.tel = val; // Sincroniza
  save();
  renderInputs();
  renderPreview();
});
document.getElementById("ag-proto").addEventListener("input", (e) => {
  const val = e.target.value;
  state.agendamento.proto = val;
  state.atendimento.proto = val; // Sincroniza
  state.solucionado.proto = val; // Sincroniza
  chrome.storage.local.set({ currentProtocol: val });
  save();
  renderInputs();
  renderPreview();
});

document.getElementById("so-proto").addEventListener("input", (e) => {
  const val = e.target.value;
  state.solucionado.proto = val;
  state.atendimento.proto = val; // Sincroniza
  state.agendamento.proto = val; // Sincroniza
  chrome.storage.local.set({ currentProtocol: val });
  save();
  renderInputs();
  renderPreview();
});

// ==================================================================

document.getElementById("at-desc").addEventListener("input", (e) => {
  state.atendimento.desc = e.target.value;
  save();
  renderPreview();
});
document.getElementById("at-problema").addEventListener("input", (e) => {
  state.atendimento.problema = e.target.value;
  save();
  renderPreview();
});
document.querySelectorAll("#at-chips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const val = chip.dataset.value;
    const alreadySelected = state.atendimento.descChip === val;
    state.atendimento.descChip = alreadySelected ? "" : val;

    if (!alreadySelected) {
      const preset = ATENDIMENTO_PRESETS[val];
      state.atendimento.desc = preset.desc;
      state.atendimento.problema = preset.problema;
    }
    save();
    renderInputs();
    renderPreview();
    if (val === "OUTROS" && !alreadySelected) {
      document.getElementById("at-desc").focus();
    }
  });
});

document.getElementById("ag-local").addEventListener("input", (e) => {
  state.agendamento.local = e.target.value;
  save();
  renderPreview();
});
document.getElementById("ag-motivo").addEventListener("input", (e) => {
  state.agendamento.motivo = e.target.value;
  save();
  renderPreview();
});
document.querySelectorAll("#ag-motivo-chips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const val = chip.dataset.value;
    const alreadySelected = state.agendamento.motivoChip === val;
    state.agendamento.motivoChip = alreadySelected ? "" : val;

    if (!alreadySelected) {
      state.agendamento.motivo = val.toUpperCase() === "OUTROS" ? "" : val.toUpperCase();
    }
    save();
    renderInputs();
    renderPreview();
    if (val.toUpperCase() === "OUTROS" && !alreadySelected) {
      document.getElementById("ag-motivo").focus();
    }
  });
});

document.querySelectorAll("#ag-periodo .choice").forEach((c) => {
  c.addEventListener("click", () => {
    state.agendamento.periodo = state.agendamento.periodo === c.dataset.value ? "" : c.dataset.value;
    save();
    renderInputs();
    renderPreview();
  });
});
document.querySelectorAll("#ag-canal .choice").forEach((c) => {
  c.addEventListener("click", () => {
    state.agendamento.canal = state.agendamento.canal === c.dataset.value ? "" : c.dataset.value;
    save();
    renderInputs();
    renderPreview();
  });
});

document.getElementById("so-proc").addEventListener("input", (e) => {
  state.solucionado.proc = e.target.value;
  save();
  renderPreview();
});

document.querySelectorAll("#so-proc-chips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const val = chip.dataset.value;
    const idx = state.solucionado.procChips.indexOf(val);
    const nowSelected = idx === -1;
    if (nowSelected) state.solucionado.procChips.push(val);
    else state.solucionado.procChips.splice(idx, 1);

    state.solucionado.proc = state.solucionado.procChips
      .filter((v) => v.toUpperCase() !== "OUTROS")
      .map((v) => v.toUpperCase())
      .join(", ");

    save();
    renderInputs();
    renderPreview();
    if (val.toUpperCase() === "OUTROS" && nowSelected) {
      const field = document.getElementById("so-proc");
      field.focus();
      field.selectionStart = field.selectionEnd = field.value.length;
    }
  });
});

document.querySelectorAll("#so-solucionado .choice").forEach((c) => {
  c.addEventListener("click", () => {
    state.solucionado.solucionado = state.solucionado.solucionado === c.dataset.value ? "" : c.dataset.value;
    save();
    renderInputs();
    renderPreview();
  });
});
document.querySelectorAll("#so-validou .choice").forEach((c) => {
  c.addEventListener("click", () => {
    state.solucionado.validou = state.solucionado.validou === c.dataset.value ? "" : c.dataset.value;
    save();
    renderInputs();
    renderPreview();
  });
});

document.querySelectorAll("[data-clear]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.clear;
    state[tab] = structuredClone(defaultState[tab]);
    save();
    renderInputs();
    renderPreview();
  });
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  const currentTab = state.activeTab;
  const text = builders[currentTab]();
  try {
    await navigator.clipboard.writeText(text);
    const flag = document.getElementById("copiedFlag");
    flag.textContent = "Copiado para a área de transferência!";

    state[currentTab] = structuredClone(defaultState[currentTab]);
    save();
    renderInputs();
    renderPreview();

    setTimeout(() => (flag.textContent = ""), 1800);
  } catch (e) {
    document.getElementById("copiedFlag").textContent = "Não foi possível copiar.";
  }
});

document.getElementById("themeToggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  save();
  applyTheme();
});

document.getElementById("autoToggle").addEventListener("click", () => {
  state.autoOn = !state.autoOn;
  save();
  applyAutoToggleUI();
});

function applyExtractedData(data) {
  if (!data) return;

  // Se a fonte for do native, FORÇA o RESET total dos campos de texto (para apagar dados anteriores do painel)
  if (data.source === "native") {
    state.atendimento = { nome: "", tel: "", proto: "", descChip: "", desc: "", problema: "" };
    state.agendamento = { nome: "", tel: "", periodo: "", local: "", canal: "", proto: "", motivoChip: "", motivo: "" };
    state.solucionado = { solucionado: "", validou: "", proto: "", procChips: [], proc: "" };
  }

  // Missing fields from a new Withub conversation must not retain another client's identity.
  if (data.source === "withub") {
    state.atendimento.nome = state.agendamento.nome = data.nome || "";
    state.atendimento.tel = state.agendamento.tel = data.telefone || "";
    state.atendimento.proto = state.agendamento.proto = state.solucionado.proto = data.protocolo || "";
    chrome.storage.local.set({ currentProtocol: data.protocolo || "" });
  }

  // Preenche com os novos dados 
  if (data.nome) {
    state.atendimento.nome = data.nome;
    state.agendamento.nome = data.nome;
  }
  if (data.telefone) {
    state.atendimento.tel = data.telefone;
    state.agendamento.tel = data.telefone;
  }
  if (data.protocolo) {
    state.atendimento.proto = data.protocolo;
    state.agendamento.proto = data.protocolo;
    state.solucionado.proto = data.protocolo;
    chrome.storage.local.set({ currentProtocol: data.protocolo });
  }

  save();
  renderInputs();
  renderPreview();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  // Drawers stay mounted in different tabs. Keep their saved fields in sync.
  const saved = changes[STORAGE_KEY]?.newValue;
  if (saved && JSON.stringify(saved) !== JSON.stringify(state)) {
    state = { ...state, ...saved };
    renderAll();
  }
  if (changes.pendingAutofill && window.autoPreencherSidebarVisible !== false) {
    if (changes.pendingAutofill.newValue) consumePendingAutofill();
  }
  if (changes[EXPANDER_KEY]) {
    expanderTags = Array.isArray(changes[EXPANDER_KEY].newValue) ? changes[EXPANDER_KEY].newValue : [];
    renderTagList();
  }
});

async function consumePendingAutofill() {
  if (window.autoPreencherSidebarVisible === false) return false;
  const res = await chrome.storage.local.get(["pendingAutofill", "pendingAutofillTabId"]);
  if (window.autoPreencherSidebarTabId && typeof res.pendingAutofillTabId === 'number') {
    const tabId = await window.autoPreencherSidebarTabId;
    if (tabId !== res.pendingAutofillTabId || window.autoPreencherSidebarVisible === false) return false;
  }
  if (res.pendingAutofill) {
    applyExtractedData(res.pendingAutofill);
    chrome.storage.local.remove(["pendingAutofill", "pendingAutofillTabId"]);
    return true; // Informa ao sistema que já puxou os dados do atalho
  }
  return false;
}

function requestExtractedData() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "extract-data" }, (res) => {
      resolve(res?.data || null);
    });
  });
}

async function fillFromSource() {
  const flag = document.getElementById("copiedFlag");
  flag.textContent = "Buscando dados...";
  const data = await requestExtractedData();
  if (!data) {
    flag.textContent = "Nenhuma aba de atendimento encontrada.";
    setTimeout(() => (flag.textContent = ""), 2200);
    return;
  }

  applyExtractedData(data);
  flag.textContent = "Dados preenchidos nas 3 abas!";
  setTimeout(() => (flag.textContent = ""), 1800);
}

document.querySelectorAll("[data-fill]").forEach((btn) => {
  btn.addEventListener("click", () => fillFromSource());
});

// Outros eventos do final (bloco de notas, etc...) continuam acima dessa linha.
// SUBSTITUA A INICIALIZAÇÃO FINAL POR ESTA:

/* ==================================================================
   INIT
================================================================== */
let panelInitialized = false;
document.addEventListener('auto-preencher-sidebar-open', () => {
  if (panelInitialized) consumePendingAutofill();
});
(async function init() {
  await load();
  await loadExpanderTags();
  renderAll();
  renderTagList();
  renderCredentials();
  renderLinks();
  
  // Consome a fila do atalho (caso tenha sido ativado pelo teclado)
  const usouAtalho = await consumePendingAutofill();
  
  // A busca automática "Auto" SÓ vai rodar se você abriu o painel pelo mouse,
  // impedindo ela de sobrescrever o dado do atalho.
  panelInitialized = true;
  if (state.autoOn && !usouAtalho && window.autoPreencherSidebarVisible !== false) {
    fillFromSource();
  }
})();

/* ==================================================================
   BLOCO DE NOTAS
================================================================== */
["nome", "tel", "proto", "desc"].forEach((key) => {
  document.getElementById(`nb-${key}`)?.addEventListener("input", (e) => {
    if (!state.bloco) state.bloco = {};
    state.bloco[key] = e.target.value;
    save();
  });
});

document.getElementById("nb-fill-btn")?.addEventListener("click", () => {
  const at = state.atendimento;
  if (!state.bloco) state.bloco = {};
  if (at.nome) state.bloco.nome = at.nome;
  if (at.tel) state.bloco.tel = at.tel;
  if (at.proto) state.bloco.proto = at.proto;
  save();
  renderInputs();
});

document.getElementById("nb-clear-btn")?.addEventListener("click", () => {
  state.bloco = { nome: "", tel: "", proto: "", desc: "" };
  save();
  renderInputs();
});

document.getElementById("nb-copy-btn")?.addEventListener("click", async () => {
  const b = state.bloco || {};
  const text = [
    `Nome: ${b.nome || ""}`,
    `Telefone: ${b.tel || ""}`,
    `Protocolo: ${b.proto || ""}`,
    `Descrição: ${b.desc || ""}`
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById("nb-copy-btn");
    const orig = btn.innerHTML;
    btn.textContent = "Copiado para a área de transferência!";
    setTimeout(() => (btn.innerHTML = orig), 1500);
  } catch (e) {}
});

// Alyrio AI is implemented in ai-panel.js.

/* ==================================================================
   PORTAS PARA ROTEADOR
================================================================== */
function cleanIP(raw) {
  if (!raw) return "";
  return raw.replace(/^https?:\/\//i, "").split(":")[0].split("/")[0].trim();
}

function getGeneratedPortUrls(ip) {
  const sanitized = cleanIP(ip);
  if (!sanitized) return [];
  return ROUTER_PORTS.map((item) => ({
    ...item,
    url: `${item.protocol}://${sanitized}:${item.port}`
  }));
}

function renderRouterPorts() {
  const input = document.getElementById("router-ip-input");
  if (!input) return;
  const urls = getGeneratedPortUrls(input.value);
  const grid = document.getElementById("routerPortsGrid");
  if (!grid) return;

  if (!urls.length) {
    grid.innerHTML = `<p style="color:var(--text-muted);font-size:13px;grid-column:1/-1;">Digite ou cole um IP acima para gerar os links e opções de acesso.</p>`;
    return;
  }

  grid.innerHTML = urls.map((item, index) => `
    <div class="cred-card" style="display:flex;flex-direction:column;justify-content:space-between;gap:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-family:var(--mono);font-size:10.5px;font-weight:700;color:${item.protocol === 'https' ? 'var(--amber)' : 'var(--accent)'};background:${item.protocol === 'https' ? 'var(--amber-dim)' : 'var(--accent-dim)'};padding:2px 6px;border-radius:4px;text-transform:uppercase;">
          ${item.protocol}
        </span>
        <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--text-muted);">Porta ${item.port}</span>
      </div>
      <div class="cred-item" style="margin-bottom:0;">
        <span class="val" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.url)}</span>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn" style="flex:1;padding:6px 10px;font-size:12px;" data-open-port="${index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Abrir
        </button>
        <button class="btn" style="padding:6px 10px;font-size:12px;" data-copy-port="${index}">
          Copiar
        </button>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll("[data-open-port]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.openPort);
      const targetUrl = urls[idx]?.url;
      if (targetUrl) {
        if (chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url: targetUrl });
        } else {
          window.open(targetUrl, "_blank");
        }
      }
    });
  });

  grid.querySelectorAll("[data-copy-port]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.copyPort);
      const targetUrl = urls[idx]?.url;
      if (targetUrl) {
        await navigator.clipboard.writeText(targetUrl);
        const orig = btn.textContent;
        btn.textContent = "Copiado!";
        setTimeout(() => (btn.textContent = orig), 1200);
      }
    });
  });
}

document.getElementById("router-ip-input")?.addEventListener("input", (e) => {
  state.routerIp = e.target.value;
  save();
  renderRouterPorts();
});

document.getElementById("open-all-ports-btn")?.addEventListener("click", () => {
  const input = document.getElementById("router-ip-input");
  const urls = getGeneratedPortUrls(input?.value);
  if (!urls.length) {
    alert("Digite ou cole um IP válido antes de abrir as abas.");
    return;
  }
  urls.forEach((item) => {
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: item.url, active: false });
    } else {
      window.open(item.url, "_blank");
    }
  });
});

/* ==================================================================
   CONSULTA MAC VENDORS (AUTO-PESQUISA)
================================================================== */
async function searchMacVendor() {
  const input = document.getElementById("mac-input");
  const resultCard = document.getElementById("mac-result-card");
  const vendorEl = document.getElementById("mac-vendor-name");
  const macSearchedEl = document.getElementById("mac-searched");
  const errorMsgEl = document.getElementById("mac-error-msg");
  const loadingEl = document.getElementById("mac-loading");

  const rawMac = input ? input.value.trim() : "";

  resultCard.style.display = "none";
  errorMsgEl.style.display = "none";
  if (loadingEl) loadingEl.style.display = "none";

  if (!rawMac) return;

  const cleanMac = rawMac.replace(/[^a-fA-F0-9]/g, "");

  if (cleanMac.length < 6) {
    errorMsgEl.textContent = "Endereço MAC muito curto. Digite pelo menos os 6 primeiros dígitos (OUI).";
    errorMsgEl.style.display = "block";
    return;
  }

  if (loadingEl) loadingEl.style.display = "block";

  try {
    const response = await fetch(`https://api.macvendors.com/${encodeURIComponent(cleanMac)}`);

    if (response.ok) {
      const vendorName = await response.text();
      vendorEl.textContent = vendorName;
      macSearchedEl.textContent = rawMac.toUpperCase();
      resultCard.style.display = "block";
    } else if (response.status === 404) {
      errorMsgEl.textContent = "Fabricante não encontrado para este endereço MAC.";
      errorMsgEl.style.display = "block";
    } else if (response.status === 429) {
      errorMsgEl.textContent = "Muitas requisições seguidas. Aguarde um momento...";
      errorMsgEl.style.display = "block";
    } else {
      errorMsgEl.textContent = "Erro ao consultar a API do Mac Vendors. Tente novamente em instantes.";
      errorMsgEl.style.display = "block";
    }
  } catch (err) {
    errorMsgEl.textContent = "Falha na conexão com o serviço Mac Vendors. Verifique sua internet.";
    errorMsgEl.style.display = "block";
  } finally {
    if (loadingEl) loadingEl.style.display = "none";
  }
}

document.getElementById("mac-input")?.addEventListener("input", () => {
  if (macSearchTimeout) clearTimeout(macSearchTimeout);
  macSearchTimeout = setTimeout(() => {
    searchMacVendor();
  }, 400);
});

/* ==================================================================
   TEXT EXPANDER COM SUPORTE A ÁUDIO MP3
================================================================== */
let expanderTags = [];
let editingTagId = null;

function uid() {
  return "tag-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadExpanderTags() {
  return new Promise((resolve) => {
    chrome.storage.local.get([EXPANDER_KEY], (res) => {
      expanderTags = Array.isArray(res[EXPANDER_KEY]) ? res[EXPANDER_KEY] : [];
      resolve();
    });
  });
}

function saveExpanderTags() {
  chrome.storage.local.set({ [EXPANDER_KEY]: expanderTags });
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function resetAudioUploadUI() {
  const card = document.getElementById("audio-upload-card");
  const title = document.getElementById("tf-audio-title");
  const sub = document.getElementById("tf-audio-sub");
  const input = document.getElementById("tf-audio");

  if (card) card.classList.remove("has-file");
  if (title) title.textContent = "Clique para selecionar um áudio MP3";
  if (sub) sub.textContent = "Será enviado automaticamente ao ativar o atalho";
  if (input) input.value = "";

  currentAudioBase64 = null;
  currentAudioName = "";
}

function setAudioUploadUI(fileName) {
  const card = document.getElementById("audio-upload-card");
  const title = document.getElementById("tf-audio-title");
  const sub = document.getElementById("tf-audio-sub");

  if (card) card.classList.add("has-file");
  if (title) title.textContent = fileName || "Áudio anexado";
  if (sub) sub.textContent = "Áudio MP3 vinculado à tag";
}

function renderTagList() {
  const list = document.getElementById("tagList");
  if (!expanderTags.length) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">Nenhuma tag criada ainda. Clique em "+ Nova tag" para começar.</p>`;
    return;
  }
  list.innerHTML = expanderTags
    .map(
      (t) => `
      <div class="tag-card" data-id="${t.id}">
        <div class="row">
          <span class="shortcut">${escapeHtml(t.shortcut)}</span>
          <span class="label">${escapeHtml(t.label || "")}</span>
          ${t.audioBase64 ? `<span style="font-size:11px; padding:2px 6px; border-radius:4px; background:var(--accent-dim); color:var(--accent); font-weight:700;">🎵 MP3</span>` : ''}
          <div class="card-actions">
            <button class="edit" title="Editar" data-edit="${t.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="del" title="Excluir" data-del="${t.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="preview">${escapeHtml(t.body || "")}</div>
      </div>
    `
    )
    .join("");

  list.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openTagForm(btn.dataset.edit));
  });
  list.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      expanderTags = expanderTags.filter((t) => t.id !== btn.dataset.del);
      saveExpanderTags();
      renderTagList();
    });
  });
}

function openTagForm(id) {
  const form = document.getElementById("tagForm");
  editingTagId = id || null;

  if (id) {
    const t = expanderTags.find((x) => x.id === id);
    document.getElementById("tf-shortcut").value = t?.shortcut || "";
    document.getElementById("tf-label").value = t?.label || "";
    document.getElementById("tf-body").value = t?.body || "";
    
    if (t?.audioBase64) {
      currentAudioBase64 = t.audioBase64;
      currentAudioName = t.audioName || "audio.mp3";
      setAudioUploadUI(currentAudioName);
    } else {
      resetAudioUploadUI();
    }
  } else {
    document.getElementById("tf-shortcut").value = "";
    document.getElementById("tf-label").value = "";
    document.getElementById("tf-body").value = "";
    resetAudioUploadUI();
  }

  form.classList.add("open");
  document.getElementById("tf-shortcut").focus();
}

function closeTagForm() {
  document.getElementById("tagForm").classList.remove("open");
  editingTagId = null;
  resetAudioUploadUI();
}

document.getElementById("tf-audio")?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    currentAudioBase64 = reader.result;
    currentAudioName = file.name;
    setAudioUploadUI(file.name);
  };
  reader.readAsDataURL(file);
});

document.getElementById("tf-audio-remove-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  resetAudioUploadUI();
});

document.getElementById("newTagBtn").addEventListener("click", () => openTagForm(null));
document.getElementById("cancelTagBtn").addEventListener("click", closeTagForm);

document.getElementById("saveTagBtn").addEventListener("click", () => {
  const shortcut = document.getElementById("tf-shortcut").value.trim();
  const label = document.getElementById("tf-label").value.trim();
  const body = document.getElementById("tf-body").value;

  if (!shortcut) {
    document.getElementById("tf-shortcut").focus();
    return;
  }

  if (editingTagId) {
    const t = expanderTags.find((x) => x.id === editingTagId);
    if (t) {
      t.shortcut = shortcut;
      t.label = label;
      t.body = body;
      t.audioBase64 = currentAudioBase64;
      t.audioName = currentAudioName;
    }
  } else {
    expanderTags.push({ 
      id: uid(), 
      shortcut, 
      label, 
      body,
      audioBase64: currentAudioBase64,
      audioName: currentAudioName
    });
  }
  saveExpanderTags();
  renderTagList();
  closeTagForm();
});

document.querySelectorAll("[data-insert]").forEach((btn) => {
  let feedbackTimeout;
  const originalLabel = btn.textContent;
  btn.title = `Copiar ${btn.dataset.insert}`;
  btn.setAttribute("aria-label", btn.title);
  btn.addEventListener("click", async () => {
    const token = btn.dataset.insert;
    clearTimeout(feedbackTimeout);
    try {
      await navigator.clipboard.writeText(token);
      btn.textContent = "Copiado!";
    } catch (error) {
      btn.textContent = "Falha ao copiar. Tente novamente.";
    }
    feedbackTimeout = setTimeout(() => { btn.textContent = originalLabel; }, 1800);
  });
});

document.getElementById("exportTagsBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(expanderTags, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "auto-preencher-tags.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById("importTagsBtn").addEventListener("click", () => {
  document.getElementById("fileImportInput").click();
});

document.getElementById("fileImportInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("formato inválido");

      const existingShortcuts = new Set(expanderTags.map((t) => t.shortcut));
      let added = 0;
      imported.forEach((t) => {
        if (!t || !t.shortcut) return;
        if (existingShortcuts.has(t.shortcut)) return;
        expanderTags.push({
          id: uid(),
          shortcut: t.shortcut,
          label: t.label || "",
          body: t.body || "",
          audioBase64: t.audioBase64 || null,
          audioName: t.audioName || ""
        });
        existingShortcuts.add(t.shortcut);
        added++;
      });
      saveExpanderTags();
      renderTagList();
      alert(`${added} tag(s) importada(s) com sucesso!`);
    } catch (err) {
      alert("Não foi possível importar o arquivo. Verifique se é um JSON exportado por esta extensão.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

/* ==================================================================
   SENHAS E DNS
================================================================== */
const CREDENTIALS = [
  {
    title: "Senhas Br Super",
    items: ["br@@remoto", "Br$uper01", "XPON#TDWLD"],
  },
  {
    title: "Senhas HBA",
    items: ["hba2021#", "Hba2021#"],
  },
  {
    title: "Senhas Phx",
    items: ["phoenix1010"],
  },
  {
    title: "Senhas Provernet",
    items: ["Prove$NET!@#3411", "Admin3411px@", "3411px"],
  },
  {
    title: "DNS Br Super",
    items: ["177.137.208.41", "177.137.208.42"],
  },
  {
    title: "DNS Provernet",
    items: ["177.128.24.118", "177.128.24.130"],
  },
  {
    title: "DNS Cloudflare",
    items: ["1.1.1.1", "1.0.0.1"],
  },
  {
    title: "DNS Google",
    items: ["8.8.8.8", "8.8.4.4"],
  },
];

function renderCredentials() {
  const grid = document.getElementById("credGrid");
  grid.innerHTML = CREDENTIALS.map(
    (group, gi) => `
    <div class="cred-card">
      <h4><span class="dot2"></span>${escapeHtml(group.title)}</h4>
      ${group.items
        .map(
          (val, ii) => `
        <div class="cred-item" data-copy="${gi}-${ii}" title="Clique para copiar">
          <span class="val">${escapeHtml(val)}</span>
          <span class="toast">Copiado!</span>
        </div>
      `
        )
        .join("")}
    </div>
  `
  ).join("");

  grid.querySelectorAll(".cred-item[data-copy]").forEach((item) => {
    item.addEventListener("click", async () => {
      const [gi, ii] = item.dataset.copy.split("-").map(Number);
      const val = CREDENTIALS[gi].items[ii];
      try {
        await navigator.clipboard.writeText(val);
        const toast = item.querySelector(".toast");
        if (toast) {
          toast.classList.remove("show");
          void toast.offsetWidth;
          toast.classList.add("show");
        }
      } catch (e) {}
    });
  });
}

/* ==================================================================
   LINKS
================================================================== */
const LINKS = [
  {
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    title: "Mac Vendors",
    url: "https://macvendors.com/"
  },
  {
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    title: "Teste de Velocidade",
    url: "https://fast.com/pt/"
  },
  {
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    title: "Ficha Técnica",
    url: "https://www.tudocelular.com/celulares/fichas-tecnicas.html"
  },
];

function renderLinks() {
  const grid = document.getElementById("linksGrid");
  grid.innerHTML = LINKS.map(
    (l, i) => `
    <div class="link-card" data-link="${i}">
      <div class="link-ico">${l.iconSvg}</div>
      <h4>${escapeHtml(l.title)}</h4>
      <div class="url">${escapeHtml(l.url)}</div>
      <button class="open-btn">Abrir link</button>
    </div>
  `
  ).join("");

  grid.querySelectorAll(".link-card").forEach((card) => {
    const openIt = () => window.open(LINKS[Number(card.dataset.link)].url, "_blank");
    card.addEventListener("click", openIt);
  });
}
