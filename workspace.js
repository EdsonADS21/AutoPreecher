/* Presentation, navigation and additive library storage. Legacy keys remain intact. */
const $ = id => document.getElementById(id);
const LIBRARY_KEY = 'workspaceLibraryV2';
let library = { notes: [], activeNote: null, templates: null, credentials: null };
let draftSnapshot = '';
let managerKind = 'templates';
let confirmResolve;
let returnFocus;
let toastTimer;
const basePresets = structuredClone(ATENDIMENTO_PRESETS);
const baseCredentials = structuredClone(CREDENTIALS);
const copyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h11v12H9z M15 5V3H3v13h2"/></svg>';
const deleteIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7"/></svg>';
function announce(text) { $('globalStatus').textContent = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('globalStatus').textContent = '', 3500); }
async function persistLibrary() {
  try { await chrome.storage.local.set({ [LIBRARY_KEY]: library }); }
  catch { announce('Não foi possível salvar. Tente novamente antes de fechar.'); }
}
function syncSectionAccessibility() {
  document.querySelectorAll('.section-panel').forEach(panel => {
    const active = panel.id === `section-${state.activeSection}`;
    panel.inert = !active;
    panel.setAttribute('aria-hidden', String(!active));
  });
  document.querySelectorAll('[data-section]').forEach(button => {
    button.setAttribute('aria-label', button.textContent.trim());
    if (button.dataset.section === state.activeSection) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
function syncTabAccessibility() {
  document.querySelectorAll('.chip-tab').forEach(button => {
    const active = button.dataset.tab === state.activeTab;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    button.id = `tab-${button.dataset.tab}`;
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    const active = panel.id === `panel-${state.activeTab}`;
    panel.inert = !active;
    panel.setAttribute('aria-hidden', String(!active));
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', panel.id.replace('panel-', 'tab-'));
  });
}
function updateCopyReadiness() {
  const required = {atendimento:['nome','tel','proto','desc','problema'],agendamento:['nome','tel','proto','periodo','local','canal','motivo'],solucionado:['proto','solucionado','validou','proc']};
  const ready = required[state.activeTab].every(key => String(state[state.activeTab][key] || '').trim());
  $('copyBtn').disabled = !ready;
  $('copyHint').textContent = ready ? 'Registro pronto. A cópia também limpa este formulário.' : 'Complete a identificação, o motivo e os detalhes para copiar.';
  $('copyBtn').setAttribute('aria-describedby', 'copyHint');
}
function tagDraft() { return JSON.stringify(['tf-shortcut','tf-label','tf-body'].map(id => $(id).value).concat([currentAudioBase64,currentAudioName])); }
function resetTagDraft() { draftSnapshot = tagDraft(); $('tagStatus').textContent = 'Sem alterações pendentes'; renderWorkspaceTags(); }
function tagDirty() { return $('tagForm').classList.contains('open') && draftSnapshot !== tagDraft(); }
function askConfirmation(title, text, accept='Descartar', cancel='Continuar editando') {
  $('confirmTitle').textContent = title; $('confirmText').textContent = text;
  $('confirmAccept').textContent = accept; $('confirmCancel').textContent = cancel;
  $('confirmDialog').showModal(); $('confirmCancel').focus();
  return new Promise(resolve => { confirmResolve = resolve; });
}
function resolveConfirmation(result) { $('confirmDialog').close(); confirmResolve?.(result); confirmResolve = null; }
$('confirmCancel').onclick = () => resolveConfirmation(false);
$('confirmAccept').onclick = () => resolveConfirmation(true);
$('confirmDialog').addEventListener('cancel', event => { event.preventDefault(); resolveConfirmation(false); });
let replayingNavigation = false;
document.addEventListener('click', async event => {
  const target = event.target.closest('[data-section], [data-edit], #newTagBtn, #cancelTagBtn, [data-del]');
  if (!target || replayingNavigation || !tagDirty()) return;
  if (target.dataset.section === state.activeSection) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const accepted = await askConfirmation('Há alterações não salvas', 'Você pode continuar editando ou descartar as alterações deste atalho.');
  if (!accepted) return;
  closeTagForm();
  replayingNavigation = true; target.click(); replayingNavigation = false;
}, true);
document.querySelectorAll('.rail [data-section]').forEach(button => button.addEventListener('click', () => {
  document.querySelector(`#section-${button.dataset.section} h1`).focus({preventScroll:true});
}));
document.querySelector('.subnav').addEventListener('keydown', event => {
  const buttons = [...document.querySelectorAll('.chip-tab')];
  const index = buttons.indexOf(document.activeElement);
  if (index < 0) return;
  let next;
  if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
  if (event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = buttons.length - 1;
  if (next !== undefined) { event.preventDefault(); buttons[next].click(); buttons[next].focus(); }
});
window.addEventListener('beforeunload', event => { if (tagDirty()) { event.preventDefault(); event.returnValue = ''; } });
$('tagForm').addEventListener('input', () => $('tagStatus').textContent = tagDirty() ? 'Alterações não salvas' : 'Sem alterações pendentes');
$('tagForm').addEventListener('change', () => { setTimeout(() => $('tagStatus').textContent = tagDirty() ? 'Alterações não salvas' : 'Sem alterações pendentes', 100); });
function renderWorkspaceTags() {
  if (!$('tagList')) return;
  const term = $('tagSearch').value.toLocaleLowerCase();
  const tags = expanderTags.filter(tag => `${tag.label} ${tag.shortcut}`.toLocaleLowerCase().includes(term));
  $('tagList').innerHTML = tags.length ? tags.map(tag => `<div class="record-row ${editingTagId === tag.id ? 'selected' : ''}"><button class="record-main" data-edit="${escapeHtml(tag.id)}" aria-pressed="${editingTagId === tag.id}"><strong>${escapeHtml(tag.label || 'Sem nome')}</strong><code>${escapeHtml(tag.shortcut)}</code><small>${tag.audioBase64 ? 'Áudio anexado · ' : ''}${escapeHtml(tag.body || 'Sem texto')}</small></button><button class="btn" data-del="${escapeHtml(tag.id)}" aria-label="Excluir ${escapeHtml(tag.label || tag.shortcut)}">${deleteIcon}</button></div>`).join('') : '<div class="empty-state"><h2>Nenhum atalho</h2><p>Crie um atalho ou ajuste a pesquisa.</p></div>';
  $('tagList').querySelectorAll('[data-edit]').forEach(button => button.onclick = () => openTagForm(button.dataset.edit));
  $('tagList').querySelectorAll('[data-del]').forEach(button => button.onclick = async () => {
    if (!await askConfirmation('Excluir atalho?', 'O texto e o áudio deste atalho serão removidos.', 'Excluir', 'Cancelar')) return;
    const id = button.dataset.del;
    expanderTags = expanderTags.filter(tag => tag.id !== id); saveExpanderTags();
    if (editingTagId === id) closeTagForm();
    renderWorkspaceTags(); announce('Atalho excluído.');
  });
}
$('tagSearch').oninput = renderWorkspaceTags;
// Add note collections without changing the existing bloco draft contract.
function currentNote() { return library.notes.find(note => note.id === library.activeNote); }
function saveCurrentNote() {
  const note = currentNote();
  if (note) { note.data = structuredClone(state.bloco); note.updatedAt = Date.now(); persistLibrary(); renderNotes(); }
}
function renderNotes() {
  const term = $('noteSearch').value.toLocaleLowerCase();
  const notes = [...library.notes].sort((a,b) => Number(b.pinned)-Number(a.pinned) || b.updatedAt-a.updatedAt).filter(note => Object.values(note.data).join(' ').toLocaleLowerCase().includes(term));
  $('noteList').innerHTML = notes.length ? notes.map(note => `<div class="record-row ${note.id === library.activeNote ? 'selected' : ''}"><button class="record-main" data-note="${escapeHtml(note.id)}" aria-pressed="${note.id === library.activeNote}"><strong>${note.pinned ? '• ' : ''}${escapeHtml(note.data.nome || 'Nova anotação')}</strong><small>${escapeHtml(note.data.desc || 'Sem conteúdo ainda')}</small><small>${new Date(note.updatedAt).toLocaleDateString('pt-BR')}</small></button></div>`).join('') : '<div class="empty-state"><h2>Nenhuma anotação</h2><p>Seu rascunho continua disponível no editor.</p></div>';
  $('noteCount').textContent = `${library.notes.length} anotaç${library.notes.length === 1 ? 'ão' : 'ões'}`;
  $('pinNote').disabled = !currentNote();
  $('pinNote').setAttribute('aria-pressed', String(!!currentNote()?.pinned));
  $('pinNote').textContent = currentNote()?.pinned ? 'Desafixar' : 'Fixar';
  $('noteHeading').textContent = currentNote() ? 'Anotação do atendimento' : 'Rascunho do atendimento';
  $('noteList').querySelectorAll('[data-note]').forEach(button => button.onclick = () => {
    saveCurrentNote(); library.activeNote = button.dataset.note;
    state.bloco = structuredClone(currentNote().data); save(); persistLibrary(); renderInputs(); renderNotes(); $('nb-desc').focus();
  });
}
function createNote() {
  saveCurrentNote();
  // Archive an uncollected legacy draft before starting a new note.
  if (!currentNote() && Object.values(state.bloco).some(Boolean)) library.notes.push({id:uid(),data:structuredClone(state.bloco),updatedAt:Date.now(),pinned:false});
  const note = {id:uid(),data:structuredClone(defaultState.bloco),updatedAt:Date.now(),pinned:false};
  library.notes.push(note); library.activeNote = note.id; state.bloco = structuredClone(note.data);
  persistLibrary(); save(); renderInputs(); renderNotes(); $('nb-nome').focus();
}
$('newNote').onclick = createNote;
$('noteSearch').oninput = renderNotes;
['nb-nome','nb-tel','nb-proto','nb-desc'].forEach(id => $(id).addEventListener('input', saveCurrentNote));
['nb-fill-btn','nb-clear-btn'].forEach(id => $(id).addEventListener('click', saveCurrentNote));
$('pinNote').onclick = () => { const note = currentNote(); if (note) { note.pinned = !note.pinned; persistLibrary(); renderNotes(); } };
async function deleteNote() {
  if (!currentNote()) { announce('Use Nova anotação para guardar o rascunho e criar um registro.'); return; }
  if (!await askConfirmation('Excluir anotação?', 'Esta anotação será removida deste dispositivo.', 'Excluir', 'Cancelar')) return;
  library.notes = library.notes.filter(note => note.id !== library.activeNote); library.activeNote = null;
  state.bloco = structuredClone(defaultState.bloco); save(); persistLibrary(); renderInputs(); renderNotes(); $('newNote').focus();
}
const noteActions=document.createElement('dialog');noteActions.id='noteActions';noteActions.setAttribute('aria-modal','true');noteActions.setAttribute('aria-labelledby','noteActionsTitle');
noteActions.innerHTML='<header class="dialog-head"><h2 id="noteActionsTitle">Ações da anotação</h2><button class="btn" id="closeNoteActions">Fechar</button></header><div class="dialog-body toolbar"><button class="btn" id="duplicateNote">Duplicar</button><button class="btn" id="exportNote">Exportar texto</button><button class="btn danger" id="deleteNote">Excluir anotação</button></div>';
document.body.append(noteActions);
$('noteMenu').setAttribute('aria-haspopup','dialog');$('noteMenu').setAttribute('aria-expanded','false');
$('noteMenu').onclick=()=>{noteActions.showModal();$('noteMenu').setAttribute('aria-expanded','true');$('closeNoteActions').focus();};
function closeNoteActions(){noteActions.close();$('noteMenu').setAttribute('aria-expanded','false');$('noteMenu').focus();}
$('closeNoteActions').onclick=closeNoteActions;
noteActions.addEventListener('cancel',event=>{event.preventDefault();closeNoteActions();});
$('deleteNote').onclick=()=>{closeNoteActions();deleteNote();};
$('duplicateNote').onclick=()=>{saveCurrentNote();const note={id:uid(),data:structuredClone(state.bloco),updatedAt:Date.now(),pinned:false};library.notes.push(note);library.activeNote=note.id;persistLibrary();renderNotes();closeNoteActions();announce('Anotação duplicada.');};
$('exportNote').onclick=()=>{const value=Object.entries(state.bloco).map(([key,value])=>`${key}: ${value}`).join('\n');const url=URL.createObjectURL(new Blob([value],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='anotacao.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function credentialGroups() { return library.credentials || CREDENTIALS; }
async function copyValue(value, message='Copiado para a área de transferência.') {
  try { await navigator.clipboard.writeText(value); announce(message); }
  catch { announce('Não foi possível copiar. Verifique a permissão da área de transferência.'); }
}
function renderWorkspaceCredentials() {
  const groups = credentialGroups();
  $('credGrid').innerHTML = groups.map((group,index) => `<section class="cred-card"><h3>${escapeHtml(group.title)}</h3>${group.items.map((value,item) => `<button class="cred-item" data-value-index="${index}-${item}" aria-label="Copiar ${escapeHtml(value)}"><span>${escapeHtml(value)}</span>${copyIcon}</button>`).join('')}</section>`).join('') || '<p class="muted">Nenhum acesso cadastrado. Abra Gerenciar acessos para adicionar.</p>';
  $('credGrid').querySelectorAll('[data-value-index]').forEach(button => button.onclick = () => { const [group,item]=button.dataset.valueIndex.split('-').map(Number); copyValue(groups[group].items[item]); });
}
function applyTemplateLibrary() {
  if (!library.templates) return;
  const available = library.templates;
  for (const key of Object.keys(ATENDIMENTO_PRESETS)) delete ATENDIMENTO_PRESETS[key];
  available.forEach(item => { ATENDIMENTO_PRESETS[item.name] = {desc:item.desc,problema:item.problema}; });
  const container = $('at-chips');
  container.innerHTML = available.map(item => `<button class="chip" data-value="${escapeHtml(item.name)}" aria-pressed="false">${escapeHtml(item.name)}</button>`).join('');
  container.querySelectorAll('.chip').forEach(button => button.onclick = () => {
    const val=button.dataset.value, selected=state.atendimento.descChip === val;
    state.atendimento.descChip = selected ? '' : val;
    if (!selected) { state.atendimento.desc=ATENDIMENTO_PRESETS[val].desc; state.atendimento.problema=ATENDIMENTO_PRESETS[val].problema; }
    save();renderInputs();renderPreview();
    if (val === 'OUTROS' && !selected) $('at-desc').focus();
  });
  renderInputs();
}
function templateItems() { return library.templates || Object.entries(basePresets).map(([name,value])=>({name,...value})); }
function openManager(kind) {
  managerKind = kind; returnFocus = $(kind === 'templates' ? 'manageTemplates' : 'manageAccess');
  $('managerTitle').textContent = kind === 'templates' ? 'Gerenciar templates' : 'Gerenciar acessos';
  renderManager(); $('managerDialog').showModal(); $('closeManager').focus();
}
function closeManager() { $('managerDialog').close(); returnFocus?.focus(); }
$('closeManager').onclick = closeManager;
$('managerDialog').addEventListener('cancel', event => { event.preventDefault(); closeManager(); });
$('manageTemplates').onclick = () => openManager('templates');
$('manageAccess').onclick = () => openManager('credentials');
function renderManager() {
  const templates = managerKind === 'templates';
  const items = templates ? templateItems() : credentialGroups();
  $('managerBody').innerHTML = `<div class="manager-intro"><p>${templates ? 'Motivos e textos do tipo Atendimento. Agendamento e Solucionado mantêm suas regras originais.' : 'Organize os valores copiáveis por provedor ou serviço.'}</p><button class="btn primary" id="managerNew">${templates ? 'Novo template' : 'Novo grupo'}</button></div><div id="managerRows">${items.map((item,index)=>`<div class="manager-row"><div><h3>${escapeHtml(templates ? item.name : item.title)}</h3><p>${escapeHtml(templates ? item.desc || 'Preenchimento livre' : item.items.join(' · '))}</p></div><button class="btn" data-manager-edit="${index}">Editar</button></div>`).join('') || '<div class="empty-state"><h2>Biblioteca vazia</h2><p>Adicione um item para começar.</p></div>'}</div><div id="managerEditor"></div>`;
  $('managerFooter').innerHTML='<button class="btn danger" id="managerDeleteAll">Excluir todos</button><div class="toolbar"><button class="btn" id="managerRestore">Restaurar padrão</button><button class="btn" id="managerExport">Exportar</button><button class="btn" id="managerImport">Importar</button><input id="managerImportFile" type="file" accept="application/json" hidden></div>';
  $('managerNew').onclick = () => editManagerItem(-1);
  $('managerBody').querySelectorAll('[data-manager-edit]').forEach(button => button.onclick = () => editManagerItem(Number(button.dataset.managerEdit)));
  $('managerDeleteAll').onclick = async () => {
    if (!await askConfirmation('Excluir todos?', 'Os itens desta biblioteca serão removidos. Você poderá restaurar os padrões.', 'Excluir todos', 'Cancelar')) return;
    library[managerKind] = []; await commitManager();
  };
  $('managerRestore').onclick = async () => {
    if (!await askConfirmation('Restaurar padrão?', 'As personalizações desta biblioteca serão substituídas pelos dados originais.', 'Restaurar', 'Cancelar')) return;
    library[managerKind] = templates ? Object.entries(basePresets).map(([name,value])=>({name,...value})) : structuredClone(baseCredentials); await commitManager();
  };
  $('managerExport').onclick = () => {
    const url=URL.createObjectURL(new Blob([JSON.stringify(items,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`auto-preencher-${managerKind}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('managerImport').onclick = () => $('managerImportFile').click();
  $('managerImportFile').onchange = async event => {
    const file=event.target.files[0]; if (!file) return;
    try {
      const imported=JSON.parse(await file.text());
      if (!Array.isArray(imported) || !imported.every(item => templates ? typeof item.name==='string' && item.name.trim() && typeof item.desc==='string' && typeof item.problema==='string' : typeof item.title==='string' && item.title.trim() && Array.isArray(item.items) && item.items.every(value=>typeof value==='string'))) throw new Error();
      if (!await askConfirmation('Importar biblioteca?', `${imported.length} itens substituirão a biblioteca atual.`, 'Importar', 'Cancelar')) return;
      library[managerKind]=imported; await commitManager(); announce('Biblioteca importada.');
    } catch { announce('Arquivo inválido. Use um JSON exportado desta biblioteca.'); }
  };
}
function editManagerItem(index) {
  const templates=managerKind==='templates';
  const item=(templates ? templateItems() : credentialGroups())[index];
  $('managerEditor').innerHTML=`<form class="manager-editor" id="managerForm"><h2>${index<0 ? 'Adicionar' : 'Editar'} ${templates ? 'template' : 'grupo'}</h2><div class="field"><label for="itemName">Nome</label><input id="itemName" required value="${escapeHtml(item?.name || item?.title || '')}"></div><div class="field"><label for="itemContent">${templates ? 'Descrição do atendimento' : 'Valores (um por linha)'}</label><textarea id="itemContent">${escapeHtml(templates ? item?.desc || '' : item?.items.join('\n') || '')}</textarea></div>${templates ? `<div class="field"><label for="itemProblem">Problema real do cliente</label><input id="itemProblem" value="${escapeHtml(item?.problema || '')}"></div>` : ''}<div class="toolbar"><button type="button" id="itemCancel" class="btn">Cancelar</button><button type="submit" class="btn primary">Salvar alterações</button>${index>=0 ? '<button type="button" id="itemDelete" class="btn danger">Excluir item</button>' : ''}</div><p id="itemError" role="alert"></p></form>`;
  $('itemName').focus();
  $('itemCancel').onclick=()=>{$('managerEditor').innerHTML='';$('managerNew').focus();};
  $('itemDelete')?.addEventListener('click',async()=>{
    if (!await askConfirmation('Excluir item?', 'Este item será removido da biblioteca.', 'Excluir', 'Cancelar')) return;
    const items=structuredClone(templates ? templateItems() : credentialGroups());items.splice(index,1);library[managerKind]=items;await commitManager();
  });
  $('managerForm').onsubmit=async event=>{
    event.preventDefault();
    const name=$('itemName').value.trim(); if (!name) return;
    const items=structuredClone(templates ? templateItems() : credentialGroups());
    if (templates && items.some((entry,i)=>i!==index && entry.name===name)) { $('itemError').textContent='Já existe um template com este nome.';return; }
    const value=templates ? {name,desc:$('itemContent').value,problema:$('itemProblem').value} : {title:name,items:$('itemContent').value.split('\n').map(value=>value.trim()).filter(Boolean)};
    if (index<0) items.push(value);else items[index]=value;
    library[managerKind]=items;await commitManager();announce('Alterações salvas.');
  };
}
async function commitManager() { await persistLibrary(); applyTemplateLibrary(); renderWorkspaceCredentials(); renderManager(); $('managerNew').focus(); }
$('fiberTemplates').onclick=()=>document.querySelector('[data-section="scripts"]').click();
$('filterUtility').onclick=()=>{
  const target = state.activeSection==='bloco' ? 'noteSearch' : 'tagSearch';
  if (target==='tagSearch') document.querySelector('[data-section="expander"]').click();
  if (state.activeSection==='expander' || state.activeSection==='bloco') $(target).focus();
};
$('audioUtility').onclick=()=>{ document.querySelector('[data-section="expander"]').click(); announce('Selecione ou crie um atalho para anexar áudio.'); };
$('statusUtility').onclick=()=>announce('Armazenamento local. Atendimento automático desabilitado; atalhos manuais disponíveis.');
$('convertMaps').onclick=()=>{
  const text=$('mapsInput').value.trim();
  const coordinates=text.match(/(?:@|[?&]q=|[?&]query=)?(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/);
  $('mapsResult').hidden=true;
  if (!coordinates || Math.abs(Number(coordinates[1]))>90 || Math.abs(Number(coordinates[2]))>180) { $('mapsStatus').textContent='Cole latitude, longitude ou um link completo que contenha coordenadas.';return; }
  const url=`https://www.google.com/maps?q=${coordinates[1]},${coordinates[2]}`;
  $('mapsResult').href=url;$('mapsResult').hidden=false;$('mapsStatus').textContent='Link convertido. Clique para abrir.';
};
async function initializeWorkspace() {
  const saved=await chrome.storage.local.get([LIBRARY_KEY]);
  if (saved[LIBRARY_KEY]) library={...library,...saved[LIBRARY_KEY]};
  if (!Array.isArray(library.notes)) library.notes=[];
  applyTemplateLibrary(); renderWorkspaceCredentials(); renderNotes(); renderWorkspaceTags();
  syncSectionAccessibility(); syncTabAccessibility(); updateCopyReadiness();
  document.querySelectorAll('svg').forEach(svg=>svg.setAttribute('aria-hidden','true'));
  $('bootState').hidden=true;
  $('main').setAttribute('aria-busy','false');
  document.documentElement.dataset.ready='true';
}

// Keep utilities reachable when the navigation collapses to an icon rail.
const compactTools=document.createElement('button');
compactTools.id='compactTools';compactTools.className='tab-btn';compactTools.setAttribute('aria-label','Utilidades e conversor do Maps');
compactTools.setAttribute('aria-haspopup','dialog');compactTools.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6"/></svg>';
document.querySelector('.rail').append(compactTools);
const utilitiesDialog=document.createElement('dialog');utilitiesDialog.id='utilitiesDialog';utilitiesDialog.setAttribute('aria-modal','true');utilitiesDialog.setAttribute('aria-labelledby','utilitiesTitle');
utilitiesDialog.innerHTML='<header class="dialog-head"><h2 id="utilitiesTitle">Utilidades</h2><button class="btn" id="closeUtilities">Fechar</button></header><div class="dialog-body"></div>';
document.body.append(utilitiesDialog);
const utilityPositions=[];
compactTools.onclick=()=>{
  for(const element of document.querySelectorAll('.rail .utilities,.rail .maps-tool')){const marker=document.createComment('utility-home');element.before(marker);utilityPositions.push([element,marker]);utilitiesDialog.querySelector('.dialog-body').append(element);}
  utilitiesDialog.showModal();$('closeUtilities').focus();
};
function closeUtilities(){utilitiesDialog.close();for(const [element,marker] of utilityPositions.splice(0)){marker.replaceWith(element);}compactTools.focus();}
$('closeUtilities').onclick=closeUtilities;
utilitiesDialog.addEventListener('cancel',event=>{event.preventDefault();closeUtilities();});
utilitiesDialog.querySelector('.dialog-body').addEventListener('click',event=>{if(event.target.closest('#audioUtility,#filterUtility')){closeUtilities();document.querySelector(`#section-${state.activeSection} h1`)?.focus();}});

// Explicit wrapping also prevents focus from escaping to browser chrome at dialog edges.
document.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const dialog=document.activeElement.closest('dialog[open]') || [...document.querySelectorAll('dialog[open]')].at(-1);
  if(!dialog)return;
  const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length && !el.closest('[hidden],[inert]'));
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey && (document.activeElement===first || !dialog.contains(document.activeElement))){event.preventDefault();last?.focus();}
  else if(!event.shiftKey && (document.activeElement===last || !dialog.contains(document.activeElement))){event.preventDefault();first?.focus();}
});
document.querySelectorAll('details').forEach(details=>{
  const summary=details.querySelector('summary');summary.setAttribute('aria-expanded',String(details.open));
  details.addEventListener('toggle',()=>summary.setAttribute('aria-expanded',String(details.open)));
});
