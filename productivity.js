/* Additive UI behavior. Existing extension storage and business logic stay in panel.js. */
(() => {
  const byId = id => document.getElementById(id);
  const nav = [...document.querySelectorAll('.rail [data-section]')];
  const dialog = byId('commandDialog');
  const search = byId('commandSearch');
  const titles = {scripts:'Atendimento em foco',copiloto:'Seu assistente de trabalho',bloco:'Ideias e registros',expander:'Escreva menos. Resolva mais.',senhas:'Acessos e parâmetros',portas:'Conexões em um clique',mac:'Identifique o equipamento',links:'Seus destinos favoritos',mapas:'Encontre quem atende cada região'};
  function syncNavigation() {
    nav.forEach(button => {
      button.title = button.textContent.trim();
      button.setAttribute('aria-label', button.textContent.trim());
      button.setAttribute('aria-current',button.classList.contains('active') ? 'page' : 'false');
      if(button.classList.contains('active')) byId('workspaceTitle').textContent = titles[button.dataset.section];
    });
  }
  new MutationObserver(syncNavigation).observe(document.querySelector('.rail'),{subtree:true,attributes:true,attributeFilter:['class']});
  syncNavigation();
  function showResults() {
    const term = search.value.toLocaleLowerCase('pt-BR');
    const results = nav.filter(button => button.textContent.toLocaleLowerCase('pt-BR').includes(term));
    byId('commandResults').replaceChildren(...results.map(button => {
      const result=document.createElement('button'); result.className='command-result'; result.textContent=button.textContent.trim();
      result.onclick=()=>{button.click();dialog.close();document.querySelector('main').scrollTop=0;button.focus();};return result;
    }));
    if(!results.length) byId('commandResults').textContent='Nenhuma ferramenta encontrada.';
  }
  function openSearch(){if(dialog.open)return;search.value='';showResults();dialog.showModal();search.focus();}
  byId('commandTrigger').onclick=openSearch;
  byId('closeCommand').onclick=()=>dialog.close();
  search.oninput=showResults;
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();dialog.close();byId('commandTrigger').focus();return;}
    const results=[...byId('commandResults').querySelectorAll('button')];
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const current=results.indexOf(document.activeElement);results[(current+(e.key==='ArrowDown'?1:-1)+results.length)%results.length]?.focus();}
    if(e.key==='Enter'&&e.target===search){e.preventDefault();results[0]?.click();}
  });
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();}});
  function filterTags(){
    const term=byId('tagSearch').value.toLocaleLowerCase('pt-BR');let count=0;
    byId('tagList').querySelectorAll('.tag-card').forEach(item=>{item.hidden=!item.textContent.toLocaleLowerCase('pt-BR').includes(term);if(!item.hidden)count++;});
    byId('tagSearchStatus').textContent=term ? `${count} atalho(s) encontrado(s)` : '';
  }
  byId('tagSearch').oninput=filterTags;
  new MutationObserver(filterTags).observe(byId('tagList'),{childList:true});
  function draft(){byId('draftShortcut').textContent=byId('tf-shortcut').value||'#atalho';byId('draftPreview').textContent=byId('tf-body').value||'Seu texto aparece aqui enquanto você escreve.';}
  byId('tagForm').addEventListener('input',draft);
  document.addEventListener('click',()=>queueMicrotask(draft));
  document.querySelectorAll('.chip,.choice').forEach(control=>{control.tabIndex=0;control.setAttribute('role','button');const update=()=>control.setAttribute('aria-pressed',String(control.classList.contains('selected')));update();new MutationObserver(update).observe(control,{attributes:true,attributeFilter:['class']});control.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();control.click();}});});
  const auto=byId('autoToggle');auto.tabIndex=0;auto.setAttribute('role','switch');const syncAuto=()=>auto.setAttribute('aria-checked',String(auto.classList.contains('on')));new MutationObserver(syncAuto).observe(auto,{attributes:true,attributeFilter:['class']});syncAuto();auto.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();auto.click();}});
})();

