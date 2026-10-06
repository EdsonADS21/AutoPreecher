/* Alyrio AI: respostas revisáveis pelo operador; nenhuma ação nos chats dos clientes. */
const AI_SERVICE_URL = 'http://127.0.0.1:4318';
let aiBusy = false;
let aiRequestController = null;
let aiConversationVersion = 0;
let aiAttachmentVersion = 0;

function getTimeString() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function setAiFeedback(text) {
  const feedback = document.getElementById('ai-feedback');
  if (feedback) feedback.textContent = text;
}

function aiModelLabel(result) {
  const names = { 'openai/gpt-oss-120b': 'GPT-OSS 120B', 'qwen/qwen3.8-27b': 'Qwen 3.8 · Imagens', 'gpt-5.6-luna': 'Luna 5.6' };
  return `${result.provider || 'Groq'} · ${names[result.model] || result.model || 'IA'}`;
}

function setAiBusy(busy) {
  aiBusy = busy;
  for (const button of document.querySelectorAll('#ai-send-btn, [data-ai-preset], #ai-read-full-chat-btn, #ai-pull-context-btn')) button.disabled = busy;
  document.getElementById('ai-chat-container')?.setAttribute('aria-busy', String(busy));
}

async function aiServiceRequest(route, { messages, signal } = {}) {
  let response;
  try {
    response = await fetch(AI_SERVICE_URL + route, {
      method: messages ? 'POST' : 'GET', signal,
      headers: { 'X-Auto-Preencher-Client': chrome.runtime.id, ...(messages ? { 'Content-Type': 'application/json' } : {}) },
      ...(messages ? { body: JSON.stringify({ messages }) } : {})
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('A IA está desconectada. Abra Iniciar-IA.cmd na pasta da extensão e clique em Verificar conexão.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error?.message || 'Não foi possível consultar o serviço da IA.');
  if (!result) throw new Error('O serviço da IA retornou uma resposta inválida.');
  return result;
}

async function checkAIConnection() {
  const button = document.getElementById('ai-check-connection-btn');
  const status = document.getElementById('ai-connection-status');
  if (!status || button?.disabled) return;
  if (button) button.disabled = true;
  status.textContent = 'Groq · Verificando';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const result = await aiServiceRequest('/health', { signal: controller.signal });
    status.textContent = `${aiModelLabel(result)} · ${result.ready ? 'Serviço pronto' : 'Configurar chave'}`;
    if (!aiBusy) setAiFeedback(result.ready ? 'Gere sugestões para revisar e copiar.' : 'Abra Iniciar-IA.cmd para configurar sua chave da API.');
  } catch {
    status.textContent = 'Groq · Desconectada';
    setAiFeedback('Abra Iniciar-IA.cmd na pasta da extensão para conectar a IA.');
  } finally {
    clearTimeout(timer);
    if (button) button.disabled = false;
  }
}

function renderChatMessages() {
  const container = document.getElementById('ai-chat-container');
  if (!container) return;
  if (!chatHistory.length) {
    container.innerHTML = '<div class="ai-welcome">Olá! Sou Alyrio AI.<br>Posso revisar registros, explicar problemas técnicos e ajudar a escrever respostas.<br>Digite seu pedido ou anexe uma imagem para começar.</div>';
    return;
  }
  container.innerHTML = chatHistory.map((message, index) => {
    const isUser = message.role === 'user';
    return `<div class="chat-bubble ${isUser ? 'user' : 'assistant'}${message.error ? ' ai-error' : ''}">
      ${message.image ? `<img src="${escapeHtml(message.image)}" class="attached-img" alt="Imagem anexada à consulta" />` : ''}
      <div>${escapeHtml(message.content)}</div>
      <div class="chat-time">${escapeHtml(message.time || getTimeString())}</div>
      ${isUser ? '' : `<div class="chat-actions">${message.error
        ? '<button data-ai-retry>Tentar novamente</button>'
        : `<button data-copy-msg="${index}">Copiar resposta</button>`}</div>`}
    </div>`;
  }).join('');
  container.querySelectorAll('[data-copy-msg]').forEach(button => button.addEventListener('click', async () => {
    const text = chatHistory[Number(button.dataset.copyMsg)]?.content;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copiado!';
      setTimeout(() => { button.textContent = 'Copiar resposta'; }, 1200);
    } catch { setAiFeedback('Não foi possível copiar. Selecione o texto da resposta e copie manualmente.'); }
  }));
  container.querySelectorAll('[data-ai-retry]').forEach(button => button.addEventListener('click', () => sendChatMessage(undefined, true)));
  container.scrollTop = container.scrollHeight;
}

function clearPendingImageUI() {
  aiAttachmentVersion++;
  pendingChatImageBase64 = null;
  const preview = document.getElementById('ai-img-preview-card');
  if (preview) { preview.classList.remove('show'); preview.style.display = 'none'; }
  const thumb = document.getElementById('ai-img-preview-thumb');
  if (thumb) thumb.removeAttribute('src');
  const fileInput = document.getElementById('ai-img-file-input');
  if (fileInput) fileInput.value = '';
}

document.getElementById('ai-attach-img-btn')?.addEventListener('click', () => document.getElementById('ai-img-file-input')?.click());
document.getElementById('ai-img-file-input')?.addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  clearPendingImageUI();
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
    setAiFeedback('Use uma imagem PNG, JPEG ou WebP de até 4 MB.'); return;
  }
  const version = aiAttachmentVersion;
  const reader = new FileReader();
  reader.onload = () => {
    if (version !== aiAttachmentVersion) return;
    pendingChatImageBase64 = reader.result;
    document.getElementById('ai-img-preview-thumb').src = reader.result;
    document.getElementById('ai-img-preview-name').textContent = file.name;
    const preview = document.getElementById('ai-img-preview-card');
    preview.style.display = 'flex'; preview.classList.add('show');
    setAiFeedback('Imagem anexada. Revise seu pedido antes de gerar a resposta.');
  };
  reader.onerror = () => setAiFeedback('Não foi possível abrir a imagem. Selecione o arquivo novamente.');
  reader.readAsDataURL(file);
});
document.getElementById('ai-img-remove-btn')?.addEventListener('click', clearPendingImageUI);

function recentAiMessages() {
  const messages = chatHistory.filter(message => !message.error).slice(-20).map(({ role, content, image }) => ({ role, content, ...(image ? { image } : {}) }));
  let images = 0;
  // Preserve the three most recent attachments; older text remains in context.
  for (let index = messages.length - 1; index >= 0; index--) if (messages[index].image && ++images > 3) delete messages[index].image;
  return messages;
}

async function sendChatMessage(customText, retry = false) {
  if (aiBusy) return;
  const input = document.getElementById('ai-user-prompt');
  const text = (customText ?? input?.value ?? '').trim();
  const image = pendingChatImageBase64;
  if (retry) {
    if (!chatHistory.at(-1)?.error) return;
    chatHistory.pop();
  } else {
    if (!text && !image) { setAiFeedback('Digite seu pedido ou anexe uma imagem.'); return; }
    if (text.length > 12000) { setAiFeedback('Reduza seu pedido para até 12 mil caracteres.'); return; }
    chatHistory.push({ role: 'user', content: text || 'Analise a imagem enviada.', image, time: getTimeString() });
    if (input) input.value = '';
    clearPendingImageUI();
  }
  setAiBusy(true);
  setAiFeedback('Gerando uma sugestão para você revisar…');
  renderChatMessages();
  const container = document.getElementById('ai-chat-container');
  const typing = document.createElement('div');
  typing.className = 'chat-bubble assistant'; typing.id = 'ai-typing'; typing.textContent = 'Alyrio AI está analisando…';
  container.appendChild(typing); container.scrollTop = container.scrollHeight;
  const version = aiConversationVersion;
  const controller = new AbortController();
  aiRequestController = controller;
  const timer = setTimeout(() => controller.abort(), 67000);
  try {
    const result = await aiServiceRequest('/generate', { messages: recentAiMessages(), signal: controller.signal });
    if (version !== aiConversationVersion) return;
    if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('A IA retornou uma resposta vazia. Tente novamente.');
    chatHistory.push({ role: 'assistant', content: result.text.trim(), time: getTimeString() });
    const status = document.getElementById('ai-connection-status');
    if (status) status.textContent = `${aiModelLabel(result)} · Conectada`;
    setAiFeedback('Sugestão pronta. Revise antes de copiar.');
  } catch (error) {
    if (version !== aiConversationVersion) return;
    chatHistory.push({ role: 'assistant', error: true, time: getTimeString(), content: controller.signal.aborted
      ? 'A consulta demorou demais. Tente novamente ou reduza o pedido.' : error.message });
    setAiFeedback('Sua pergunta foi preservada. Você pode tentar novamente.');
  } finally {
    clearTimeout(timer);
    if (version === aiConversationVersion) {
      aiRequestController = null;
      setAiBusy(false);
      renderChatMessages();
    }
  }
}

document.getElementById('ai-send-btn')?.addEventListener('click', () => sendChatMessage());
document.getElementById('ai-user-prompt')?.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendChatMessage(); }
});
document.getElementById('ai-clear-chat-btn')?.addEventListener('click', () => {
  aiConversationVersion++;
  aiRequestController?.abort(); aiRequestController = null;
  chatHistory = []; clearPendingImageUI();
  const input = document.getElementById('ai-user-prompt');
  if (input) input.value = '';
  setAiBusy(false); setAiFeedback('Nova conversa pronta.'); renderChatMessages();
});
document.getElementById('ai-check-connection-btn')?.addEventListener('click', checkAIConnection);

function stageAiContext(text) {
  const input = document.getElementById('ai-user-prompt');
  if (!input || aiBusy) return;
  input.value = text; input.focus();
  setAiFeedback('Contexto carregado. Revise o texto e clique em Gerar resposta para consultar a IA.');
}

document.getElementById('ai-read-full-chat-btn')?.addEventListener('click', () => {
  if (aiBusy) return;
  const button = document.getElementById('ai-read-full-chat-btn');
  const version = aiConversationVersion;
  button.disabled = true;
  setAiFeedback('Lendo o histórico do atendimento…');
  chrome.runtime.sendMessage({ action: 'extract-full-chat' }, response => {
    button.disabled = aiBusy;
    if (version !== aiConversationVersion) return;
    if (chrome.runtime.lastError || !response?.chatText) {
      setAiFeedback('Nenhum histórico foi encontrado na página de atendimento aberta.'); return;
    }
    stageAiContext(`Resuma o atendimento abaixo e sugira os próximos passos, usando apenas os fatos informados.\n\n[HISTÓRICO DO CLIENTE]\n${response.chatText}`);
  });
});
document.getElementById('ai-pull-context-btn')?.addEventListener('click', () => {
  const atendimento = state.atendimento;
  const fields = [['Nome', atendimento.nome], ['Protocolo', atendimento.proto], ['Relato', atendimento.desc], ['Problema', atendimento.problema]];
  const context = fields.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n');
  if (!context) { setAiFeedback('Preencha os dados de atendimento para usar esse contexto.'); return; }
  stageAiContext(`Revise este registro e sugira os próximos passos, sem inventar procedimentos.\n\n${context}`);
});

const AI_PRESETS = {
  humanizar: 'Reescreva o texto de forma natural, cordial e empática para o cliente, mantendo o sentido e os fatos. Retorne apenas o texto revisado.',
  resumir: 'Resuma o atendimento em poucas frases objetivas. Preserve os fatos, procedimentos informados, resultado e pendências. Não acrescente informações.',
  tecnico: 'Explique o tema ou problema técnico em linguagem simples para o cliente. Separe causas possíveis de fatos confirmados e sugira o próximo teste quando necessário.',
  revisar: 'Revise este registro de atendimento, corrigindo a escrita e organizando relato, procedimentos informados, resultado e próximo passo. Não invente etapas realizadas.'
};
document.querySelectorAll('[data-ai-preset]').forEach(button => button.addEventListener('click', () => {
  const instruction = AI_PRESETS[button.dataset.aiPreset];
  const text = document.getElementById('ai-user-prompt')?.value?.trim();
  if (!instruction || (!text && !pendingChatImageBase64)) { setAiFeedback('Digite o texto que deseja trabalhar ou anexe uma imagem.'); return; }
  sendChatMessage(`${instruction}\n\n${text || 'Analise a imagem anexada.'}`);
}));
document.addEventListener('DOMContentLoaded', checkAIConnection);
