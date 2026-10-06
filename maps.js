/* My Maps directory: source descriptions are displayed as text, never executed. */
(() => {
  'use strict';
  const sources = window.TECHNICIAN_MAP_SOURCES;
  const byId = id => document.getElementById(id);
  const section = byId('section-mapas');
  const select = byId('technicianMapSelect');
  const search = byId('technicianSearch');
  const results = byId('technicianResults');
  const frame = byId('technicianMapFrame');
  const status = byId('technicianMapStatus');
  const cacheKey = 'technicianMapsV1';
  const directory = new Map();
  let cache = {};
  let initialized = false;
  let busy = false;
  let selectedId = sources[0].id;
  let coordinate = null;
  let mapView = null;
  let searchTimer;
  let coordinateTimer;
  const refreshInterval = 60000;
  const lastAttempt = new Map();
  const mapRevisions = new Map();
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const direct = (node, name) => [...node.children].find(child => child.localName === name)?.textContent.trim() || '';
  const descendants = (node, name) => [...node.getElementsByTagNameNS('*', name)];

  function readRing(node) {
    return descendants(node, 'coordinates').flatMap(item => item.textContent.trim().split(/\s+/).map(value => value.split(',').slice(0, 2).map(Number)))
      .filter(point => point.length === 2 && point.every(Number.isFinite));
  }

  // Returns 0 outside, 1 inside, 2 on the boundary. KML uses longitude first.
  function inRing([x, y], ring) {
    let inside = false;
    if (ring.length < 3) return 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j], [bx, by] = ring[i];
      const dx = bx - ax, dy = by - ay;
      if (dx === 0 && dy === 0) continue;
      if (Math.abs((x - ax) * dy - (y - ay) * dx) <= 1e-10 * Math.hypot(dx, dy)
          && x >= Math.min(ax, bx) - 1e-10 && x <= Math.max(ax, bx) + 1e-10
          && y >= Math.min(ay, by) - 1e-10 && y <= Math.max(ay, by) + 1e-10) return 2;
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    }
    return inside ? 1 : 0;
  }

  function containsCoordinate(entry) {
    return entry.polygons.some(polygon => inRing(coordinate, polygon.outer)
      && !polygon.holes.some(hole => inRing(coordinate, hole) === 1));
  }

  function applyCoordinate(event, silent = false) {
    event?.preventDefault();
    clearTimeout(coordinateTimer);
    clearTimeout(searchTimer);
    const input = byId('technicianCoordinates');
    const value = input.value.trim().replace(/^\(\s*|\s*\)$/g, '');
    const pair = value.match(/^([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)$/)
      || value.match(/^([+-]?\d+(?:,\d+)?)\s*;\s*([+-]?\d+(?:,\d+)?)$/);
    const lat = pair ? Number(pair[1].replace(',', '.')) : NaN;
    const lng = pair ? Number(pair[2].replace(',', '.')) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      if (silent) return;
      input.setAttribute('aria-invalid', 'true');
      byId('coordinateStatus').textContent = 'Coordenada inválida. Use latitude, longitude, por exemplo: -19.506267, -43.898814.';
      return;
    }
    input.removeAttribute('aria-invalid');
    coordinate = [lng, lat]; search.value = '';
    byId('clearTechnicianCoordinates').hidden = false;
    showMap(`${lat},${lng}`, 18); render();
  }

  function descriptionText(value) {
    // Detached HTML document; nothing is attached to the live page.
    const doc = new DOMParser().parseFromString(value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n'), 'text/html');
    doc.querySelectorAll('script,style,iframe,object').forEach(node => node.remove());
    return doc.body.textContent.replace(/\u00a0/g, ' ').trim();
  }

  function parseKml(kml) {
    if (typeof kml !== 'string' || kml.length > 10 * 1024 * 1024) throw new Error('Use um arquivo KML de até 10 MB.');
    if (/<!DOCTYPE|<!ENTITY/i.test(kml)) throw new Error('Este KML contém uma declaração não suportada.');
    const doc = new DOMParser().parseFromString(kml, 'application/xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'kml') throw new Error('Arquivo inválido. Exporte o mapa no formato KML, sem compactação KMZ.');
    const entries = descendants(doc, 'Placemark').map(mark => {
      const coords = descendants(mark, 'coordinates').flatMap(node => node.textContent.trim().split(/\s+/).map(item => item.split(',').slice(0, 2).map(Number)))
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90);
      let center = null;
      if (coords.length) {
        const bounds = coords.reduce((b, [lng, lat]) => [Math.min(b[0], lat), Math.max(b[1], lat), Math.min(b[2], lng), Math.max(b[3], lng)], [90, -90, 180, -180]);
        center = `${(bounds[0] + bounds[1]) / 2},${(bounds[2] + bounds[3]) / 2}`;
      }
      const layers = [];
      for (let parent = mark.parentElement; parent; parent = parent.parentElement) {
        if (parent.localName === 'Folder') layers.unshift(direct(parent, 'name'));
      }
      const extended = descendants(mark, 'Data').map(node => `${node.getAttribute('name') || ''}: ${direct(node, 'value')}`);
      const polygons = descendants(mark, 'Polygon').map(polygon => ({
        outer: descendants(polygon, 'outerBoundaryIs').flatMap(readRing),
        holes: descendants(polygon, 'innerBoundaryIs').map(readRing)
      })).filter(polygon => polygon.outer.length >= 3);
      return { name: direct(mark, 'name') || 'Região sem nome', layer: layers.filter(Boolean).join(' / '), description: [descriptionText(direct(mark, 'description')), ...extended].filter(Boolean).join('\n'), center, polygons };
    });
    if (!entries.length) throw new Error('O KML não contém regiões. Exporte o mapa completo, sem usar um link de rede.');
    return { title: direct(descendants(doc, 'Document')[0] || doc.documentElement, 'name'), entries };
  }

  function selectedSource() { return sources.find(source => source.id === selectedId); }
  function mapUrl(source, embed = false, center = source.center, zoom = source.zoom) {
    const url = new URL(`https://www.google.com/maps/d/${embed ? 'embed' : 'viewer'}`);
    url.search = new URLSearchParams({ mid: source.id, ll: center, z: String(zoom) }).toString();
    return url.href;
  }

  function showMap(center, zoom) {
    if (center !== undefined) mapView = { center, zoom };
    if (mapView) ({ center, zoom } = mapView);
    const source = selectedSource();
    const data = directory.get(source.id);
    byId('technicianMapLink').href = mapUrl(source, false, center, zoom);
    frame.title = `Mapa de regiões — ${data?.title || source.title}`;
    frame.hidden = Boolean(source.restricted);
    byId('technicianRestricted').hidden = !source.restricted;
    if (source.restricted) frame.removeAttribute('src');
    else if (section.classList.contains('active')) {
      const url = mapUrl(source, true, center, zoom);
      const refreshedUrl = new URL(url);
      if (mapRevisions.has(source.id)) refreshedUrl.searchParams.set('_refresh', mapRevisions.get(source.id));
      if (frame.getAttribute('src') !== refreshedUrl.href) frame.src = refreshedUrl.href;
    }
  }

  function render() {
    const source = selectedSource();
    const data = directory.get(source.id);
    const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    const matches = (data?.entries || []).filter(entry => {
      const text = normalize(`${entry.name} ${entry.layer} ${entry.description}`);
      return (!coordinate || containsCoordinate(entry)) && terms.every(term => text.includes(term));
    });
    if (coordinate) {
      const count = (data?.entries || []).filter(containsCoordinate).length;
      byId('coordinateStatus').textContent = `Ponto: ${coordinate[1]}, ${coordinate[0]}. ` + (count
        ? `${count} região(ões) encontrada(s) no mapa selecionado. Confira os responsáveis abaixo; áreas sobrepostas ou limites podem ter mais de um resultado.`
        : 'Nenhuma região da lista local contém esse ponto neste mapa. O mapa foi centralizado na coordenada. Tente outro mapa ou atualize a lista; isso não confirma ausência de cobertura.');
    }
    byId('technicianCount').textContent = `${matches.length} de ${data?.entries.length || 0} regiões`;
    byId('technicianSourceDate').textContent = data ? `Lista ${data.origin === 'import' ? 'importada' : 'obtida do mapa'} em ${new Date(data.capturedAt).toLocaleString('pt-BR')}. Consulta automática a cada minuto enquanto esta seção estiver visível.` : 'Este mapa ainda não tem dados locais. Abra o original e importe um KML para habilitar a busca.';
    results.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'map-empty';
      empty.textContent = coordinate ? 'Nenhuma região corresponde à coordenada e aos filtros neste mapa.' : data ? 'Nenhuma região ou técnico encontrado. Tente outro nome ou selecione outro mapa.' : 'Dados indisponíveis para busca. O acesso ao mapa original depende da sua conta Google.';
      results.append(empty);
    }
    for (const entry of matches) {
      const card = document.createElement('article');
      card.className = 'technician-card';
      const layer = document.createElement('small'); layer.textContent = entry.layer;
      const title = document.createElement('h3'); title.textContent = entry.name;
      const description = document.createElement('p'); description.textContent = entry.description || 'Técnico não informado no mapa.';
      const actions = document.createElement('div'); actions.className = 'map-actions';
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'mini-btn'; copy.textContent = 'Copiar informações';
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(`${entry.name}\n${entry.layer}\n${entry.description || 'Técnico não informado no mapa.'}\nFonte: ${data.title || source.title}`);
          status.textContent = `Informações de ${entry.name} copiadas.`;
        } catch { status.textContent = 'Não foi possível copiar. Tente novamente.'; }
      });
      actions.append(copy);
      if (entry.center) {
        const locate = document.createElement('button'); locate.type = 'button'; locate.className = 'mini-btn'; locate.textContent = 'Ver região no mapa';
        locate.addEventListener('click', () => {
          showMap(entry.center, 13);
          byId('technicianMapArea').scrollIntoView({ behavior: 'auto', block: 'nearest' });
          status.textContent = `Mapa centralizado na área de ${entry.name}. Consulte os limites desenhados no mapa.`;
        });
        if (!source.restricted) actions.append(locate);
      }
      card.append(layer, title, description, actions); results.append(card);
    }
    return matches;
  }

  function updateMapFromSearch() {
    clearTimeout(searchTimer);
    const matches = render();
    if (coordinate) { showMap(`${coordinate[1]},${coordinate[0]}`, 18); return; }
    if (!search.value.trim()) { mapView = null; status.textContent = ''; showMap(); return; }
    const first = matches.find(entry => entry.center);
    if (first) {
      showMap(first.center, 13);
      status.textContent = matches.length > 1
        ? `${matches.length} regiões encontradas. Mapa centralizado na primeira: ${first.name}. Use “Ver região no mapa” para consultar outra.`
        : `Mapa atualizado para ${first.name}.`;
    } else {
      mapView = null; showMap();
      status.textContent = 'Nenhuma região com localização encontrada. Exibindo a visão inicial do mapa selecionado.';
    }
  }

  function setBusy(value) {
    busy = value;
    byId('refreshTechnicianMap').disabled = value;
    byId('importTechnicianMap').disabled = value;
    select.disabled = value;
    byId('findTechnicianCoordinates').disabled = value;
  }

  async function saveKml(source, kml, origin) {
    const parsed = parseKml(kml);
    const saved = { kml, capturedAt: new Date().toISOString(), origin };
    const nextCache = { ...cache, [source.id]: saved };
    await chrome.storage.local.set({ [cacheKey]: nextCache });
    cache = nextCache;
    directory.set(source.id, { ...parsed, ...saved });
    select.querySelector(`option[value="${source.id}"]`).textContent = parsed.title || source.title;
    render();
  }

  async function refreshMap(automatic = false) {
    if (!initialized || busy) return;
    const source = selectedSource();
    if (automatic && (document.hidden || !section.classList.contains('active')
        || Date.now() - (lastAttempt.get(source.id) || 0) < refreshInterval)) return;
    lastAttempt.set(source.id, Date.now());
    setBusy(true); status.textContent = 'Consultando os dados publicados no Google My Maps…';
    try {
      const url = `https://www.google.com/maps/d/kml?mid=${encodeURIComponent(source.id)}&forcekml=1`;
      const response = await fetch(url, { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('Mapa não disponível para leitura pública.');
      const kml = await response.text();
      const changed = kml !== (cache[source.id]?.kml || source.kml);
      await saveKml(source, kml, 'download');
      if (changed) mapRevisions.set(source.id, String(Date.now()));
      showMap();
      status.textContent = 'Lista atualizada com os dados do mapa.';
    } catch {
      status.textContent = 'Não foi possível atualizar. A lista anterior foi mantida. Verifique a conexão ou abra o mapa original e importe um KML se ele exigir login.';
    } finally { setBusy(false); }
  }
  byId('refreshTechnicianMap').addEventListener('click', () => refreshMap());
  window.setInterval(() => refreshMap(true), refreshInterval);
  window.addEventListener('focus', () => refreshMap(true));
  window.addEventListener('online', () => { lastAttempt.delete(selectedId); refreshMap(true); });
  document.addEventListener('visibilitychange', () => refreshMap(true));

  byId('importTechnicianMap').addEventListener('click', () => byId('technicianKmlFile').click());
  byId('technicianKmlFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file || busy) return;
    const source = selectedSource();
    setBusy(true);
    try {
      if (!/\.kml$/i.test(file.name) || file.size > 10 * 1024 * 1024) throw new Error('Selecione um arquivo .kml de até 10 MB. No Google My Maps, exporte em KML, sem compactação KMZ.');
      await saveKml(source, await file.text(), 'import');
      status.textContent = 'KML importado para o mapa selecionado. Os dados estão salvos nesta extensão.';
    } catch (error) { status.textContent = `Não foi possível importar. ${error.message}`; }
    finally { event.target.value = ''; setBusy(false); }
  });

  search.addEventListener('input', () => {
    render(); clearTimeout(searchTimer);
    searchTimer = setTimeout(updateMapFromSearch, 500);
  });
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); updateMapFromSearch(); }
  });
  byId('technicianCoordinates').addEventListener('input', () => {
    clearTimeout(coordinateTimer);
    byId('technicianCoordinates').removeAttribute('aria-invalid');
    if (!byId('technicianCoordinates').value.trim()) {
      byId('clearTechnicianCoordinates').click(); return;
    }
    coordinateTimer = setTimeout(() => applyCoordinate(null, true), 600);
  });
  byId('technicianCoordinateForm').addEventListener('submit', applyCoordinate);
  byId('clearTechnicianCoordinates').addEventListener('click', () => {
    clearTimeout(coordinateTimer); clearTimeout(searchTimer);
    coordinate = null; mapView = null; byId('technicianCoordinates').value = '';
    byId('technicianCoordinates').removeAttribute('aria-invalid');
    byId('coordinateStatus').textContent = ''; byId('clearTechnicianCoordinates').hidden = true;
    updateMapFromSearch();
  });
  select.addEventListener('change', () => {
    clearTimeout(coordinateTimer); clearTimeout(searchTimer);
    selectedId = select.value; mapView = null; search.value = ''; status.textContent = ''; render();
    if (coordinate) showMap(`${coordinate[1]},${coordinate[0]}`, 18); else showMap();
    refreshMap(true);
  });
  new MutationObserver(() => { if (initialized && section.classList.contains('active')) { showMap(); refreshMap(true); } }).observe(section, { attributes: true, attributeFilter: ['class'] });

  async function init() {
    setBusy(true);
    try { cache = (await chrome.storage.local.get(cacheKey))[cacheKey] || {}; }
    catch { status.textContent = 'Não foi possível ler as atualizações salvas. Exibindo a cópia incluída na extensão.'; }
    for (const source of sources) {
      for (const saved of [cache[source.id], source]) {
        if (!saved?.kml) continue;
        try { directory.set(source.id, { ...parseKml(saved.kml), capturedAt: saved.capturedAt, origin: saved.origin || 'download' }); break; }
        catch { status.textContent = 'Alguns dados locais não puderam ser lidos. Atualize ou importe o mapa correspondente.'; }
      }
      const option = document.createElement('option'); option.value = source.id; option.textContent = directory.get(source.id)?.title || source.title; select.append(option);
    }
    initialized = true; setBusy(false); render(); showMap();
    refreshMap(true);
  }
  init();
})();
