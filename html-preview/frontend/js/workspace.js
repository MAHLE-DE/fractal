(function () {
  'use strict';
  const paths = {
    tree: '<path d="M12 21v-8M12 13 5 7M12 13l7-6M5 7V3M19 7V3"/><circle cx="12" cy="13" r="2"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"/>',
    box: '<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5l10 6"/>',
    link: '<path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 9l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0) scale(.9)"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="m6 6 12 12M6 18 18 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>', down: '<path d="m6 9 6 6 6-6"/>', back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    settings: '<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
    filter: '<path d="M4 7h16M7 12h10M10 17h4"/><circle cx="8" cy="7" r="2"/><circle cx="15" cy="12" r="2"/>',
    fit: '<path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6"/>', minus: '<path d="M5 12h14"/>',
    focus: '<circle cx="12" cy="12" r="6"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>', check: '<path d="m5 12 4 4L19 6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
    flask: '<path d="M9 3h6M10 3v7L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>', ruler: '<path d="m3 16 13-13 5 5L8 21zM7 12l3 3M11 8l3 3M15 4l3 3"/>',
    tool: '<path d="M14 6a5 5 0 0 0-6 6l-5 5a2 2 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4z"/>',
    edit: '<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14z"/>', folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11H3zM3 10h18"/>',
    external: '<path d="M14 3h7v7M21 3l-11 11M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>', shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>'
  };
  const icon = name => '<svg aria-hidden="true" viewBox="0 0 24 24">' + (paths[name] || paths.file) + '</svg>';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const live = !!window.__MAHLE_FRACTAL_HOST__ && !window.__MAHLE_FRACTAL_DEMO__, categories = FractalDemo.categories;
  const data = live ? { preview_only: false, standards: [], subgroups: [], taxonomy: { product_groups: [] }, relations: { subgroup_standard_relations: [], standard_standard_relations: [] } } : FractalDemo.create();
  let environment = {}, ready = false, refreshing = false;
  const state = { view: 'explorer', product: data.subgroups[0]?.id || '__all__', query: '', families: ['test', 'material', 'design'], islands: true, depth: 0, selected: null, tab: 'overview', origin: '', category: '', page: 0 };
  let renderer = null, popover = null, toastTimer;
  const byId = id => data.standards.find(s => s.id === id);
  const product = () => data.subgroups.find(p => p.id === state.product) || { id: state.product, name: state.product === '__general__' ? 'General standards' : 'All standards', description: state.product === '__general__' ? 'Shared standards applied to every product subgroup, plus their cited references.' : 'All registered standards across every subgroup, including general references.', group: 'Combined library', code: 'ALL', virtual: true };
  const meta = s => categories[s.classification.internal_category] || { code: s.classification.organization, label: 'International', color: '#91a1b9', icon: 'globe' };
  const chip = s => '<span class="category-chip" style="--category:' + meta(s).color + '"><i></i>' + esc(meta(s).code) + '</span>';
  const strength = n => '<span class="strength" aria-label="Strength ' + n + '">' + [1, 2, 3].map(i => '<i class="' + (i <= n ? 'on' : '') + '"></i>').join('') + '<small>' + n + '</small></span>';
  const previewNote = '<span class="preview-note">' + icon(live ? 'shield' : 'info') + (live ? 'Shared JSON · protected against conflicting edits' : 'Demo mode · changes stay in this session only') + '</span>';
  function notify(text) { const surface = Array.from(document.querySelectorAll('dialog[open]')).at(-1); if (surface) { let notice = surface.querySelector('.modal-notice'); if (!notice) { notice = document.createElement('div'); notice.className = 'modal-notice'; notice.setAttribute('role', 'status'); surface.querySelector('.modal-body').prepend(notice); } notice.textContent = text; return; } const box = document.getElementById('toast'); box.textContent = text; box.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => box.hidden = true, 4800); }
  function closePopover() { if (popover) { popover.trigger?.setAttribute('aria-expanded', 'false'); popover.box.remove(); popover = null; } }
  function popup(trigger, html, className = '') {
    closePopover(); const box = document.createElement('div'); box.className = 'popover ' + className; box.innerHTML = html;
    (trigger.closest('dialog') || document.body).append(box); const b = trigger.getBoundingClientRect();
    const width = Math.min(className === 'product-menu' ? 370 : className === 'select-menu' ? Math.max(b.width, 260) : 290, innerWidth - 24);
    box.style.width = width + 'px'; box.style.left = Math.max(12, Math.min(b.left, innerWidth - width - 12)) + 'px';
    const space = innerHeight - b.bottom - 14;
    if (space < 200 && b.top > space) { box.style.bottom = (innerHeight - b.top + 7) + 'px'; box.style.maxHeight = Math.min(390, b.top - 22) + 'px'; }
    else { box.style.top = b.bottom + 7 + 'px'; box.style.maxHeight = Math.min(440, space) + 'px'; }
    trigger.setAttribute('aria-expanded', 'true'); popover = { box, trigger }; return box;
  }
  function modal(title, subtitle, body, wide = false) {
    closePopover(); const d = document.createElement('dialog'); d.className = 'modal' + (wide ? ' wide' : '');
    d.innerHTML = '<header><div><span class="eyebrow">STANDARDS WORKSPACE</span><h2>' + esc(title) + '</h2><p>' + esc(subtitle) + '</p></div><button class="icon-button" data-close aria-label="Close dialog">' + icon('x') + '</button></header><div class="modal-body">' + body + '</div>';
    document.body.append(d); d.querySelector('[data-close]').onclick = () => d.close(); d.addEventListener('close', () => { closePopover(); d.remove(); }); d.showModal(); return d;
  }
  function fieldSelect(name, label, items, value = '', extra = '') {
    const normalized = items.map(i => typeof i === 'string' ? { value: i, label: i } : i), choice = normalized.find(i => i.value === value) || normalized[0];
    return '<label class="field ' + extra + '"><span>' + esc(label) + '</span><span class="select-wrap"><input type="hidden" name="' + esc(name) + '" value="' + esc(choice?.value || '') + '"><button type="button" class="select-button" data-select="' + esc(JSON.stringify(normalized)) + '" aria-haspopup="listbox" aria-expanded="false"><span>' + esc(choice?.label || 'Select an option') + '</span>' + icon('down') + '</button></span></label>';
  }
  function shell() {
    document.getElementById('app').innerHTML = '<aside class="sidebar"><div class="brand"><img src="./assets/logo.png" alt="MAHLE"><span>BU2 WORKSPACE</span></div><div class="module-brand"><span>' + icon('tree') + '</span><div><strong>Standards</strong><small>Engineering intelligence</small></div></div><div class="nav-heading">WORKSPACE</div><nav><button data-view="explorer">' + icon('tree') + '<span>Standards explorer</span></button><div class="nav-heading">LIBRARY</div><button data-view="catalog">' + icon('file') + '<span>Standards catalog</span><small>' + data.standards.length + '</small></button><button data-view="products">' + icon('box') + '<span>Product subgroups</span><small>' + data.subgroups.length + '</small></button><button data-view="connections">' + icon('link') + '<span>Connections</span></button></nav><div class="sidebar-bottom"><button data-about>' + icon('info') + '<span>About this workspace</span></button><div class="session-state"><i></i><span>' + (live ? 'Shared standards library' : 'Local demonstration') + '<small>0.2.1 · ' + (live ? 'revision-protected editing' : 'fictional records') + '</small></span></div></div></aside><main><header class="app-header"><div><div class="breadcrumb">Engineering <span>/</span> Standards workspace</div><h1 id="page-title">Standards explorer</h1></div><div class="header-actions"><span class="demo-badge"><i></i>' + (live ? 'Shared library' : 'Fictional dataset') + '</span><button class="icon-button" data-refresh title="Refresh shared data" aria-label="Refresh shared data">' + icon('clock') + '</button><button class="icon-button" data-preferences title="View preferences" aria-label="View preferences">' + icon('settings') + '</button><button class="button primary" data-new-standard>' + icon('plus') + '<span>New standard</span></button></div></header><div class="toolbar"><div id="product-control"></div><div class="search-box">' + icon('search') + '<input id="global-search" aria-label="Search standards" placeholder="Search code, title or previous number…" autocomplete="off"><kbd>Ctrl K</kbd><div id="search-results" class="search-results" hidden></div></div><button class="button subtle" id="view-options" aria-expanded="false">' + icon('filter') + '<span>View options</span></button></div><div id="stage"></div><footer class="statusbar"><span>' + icon('shield') + '' + (live ? 'Shared editing · conflict checks enabled' : 'No shared data modified') + '</span><span id="library-count"></span><span>' + (live ? 'STANDARDS WORKSPACE 0.2.1' : 'DEMO MODE 0.2.1') + '</span></footer></main>';
    document.getElementById('global-search').addEventListener('input', e => { state.query = e.target.value; state.page = 0; if (state.view === 'explorer') searchResults(); else renderCollection(); });
    renderView();
  }
  function renderView() {
    closePopover(); document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    document.getElementById('view-options').hidden = state.view !== 'explorer';
    document.getElementById('page-title').textContent = { explorer: 'Standards explorer', catalog: 'Standards catalog', products: 'Product subgroups', connections: 'Connections' }[state.view];
    document.getElementById('global-search').value = state.query; document.getElementById('search-results').hidden = true;
    document.querySelectorAll('[data-view="catalog"] small').forEach(n => n.textContent = data.standards.length);
    document.querySelectorAll('[data-view="products"] small').forEach(n => n.textContent = data.subgroups.length);
    let banner = document.querySelector('.maintenance-banner'); if (data.maintenance?.active) { if (!banner) { banner = document.createElement('div'); banner.className = 'maintenance-banner'; document.querySelector('.app-header').after(banner); } banner.textContent = 'JSON maintenance in progress by ' + data.maintenance.by + '. Reading is available; saving is paused.'; } else banner?.remove();
    document.getElementById('library-count').textContent = data.standards.length + ' standards · ' + data.relations.standard_standard_relations.length + ' standard connections';
    document.getElementById('product-control').innerHTML = state.view === 'explorer' ? '<button class="product-button" id="product-picker" aria-haspopup="listbox" aria-expanded="false"><span class="product-icon">' + icon('box') + '</span><span><small>PRODUCT SUBGROUP</small><strong>' + esc(product().name) + '</strong></span>' + icon('down') + '</button>' : '<span class="library-label">' + icon(state.view === 'catalog' ? 'file' : state.view === 'products' ? 'box' : 'link') + '<span>Engineering library<small>' + (live ? 'Persistent shared records' : 'Session-only demonstration') + '</small></span></span>';
    if (renderer) { renderer.observer.disconnect(); renderer.stopAnimation(); if (renderer.frameId !== null) cancelAnimationFrame(renderer.frameId); renderer = null; }
    if (state.view === 'explorer') {
      document.getElementById('stage').innerHTML = '<section class="explorer-layout"><div class="map-panel"><canvas id="graphCanvas" tabindex="0" aria-label="Interactive standards tree. Drag to pan, scroll to zoom. Home fits the map."></canvas><div class="map-heading"><span class="eyebrow">CONNECTED KNOWLEDGE</span><h2>Every standard. In context.</h2><p id="map-summary"></p></div><div class="family-legend">' + ['test', 'material', 'design'].map(key => '<button data-family="' + key + '" style="--category:' + categories[key].color + '"><i></i>' + categories[key].code + '<span>' + categories[key].label + '</span></button>').join('') + '</div><div class="camera-controls"><button data-camera="minus" aria-label="Zoom out">' + icon('minus') + '</button><span id="zoom-value">100%</span><button data-camera="plus" aria-label="Zoom in">' + icon('plus') + '</button><i></i><button data-camera="fit" aria-label="Fit tree" title="Fit tree · double-click the map">' + icon('fit') + '</button><button data-camera="focus" aria-label="Focus selection" title="Focus selected standard">' + icon('focus') + '</button></div><div class="map-help">Drag to pan <i>·</i> Scroll to zoom <i>·</i> Double-click to fit</div><button class="map-expand" data-fullscreen title="Expand map" aria-label="Expand map">' + icon('fit') + '</button></div><aside class="detail-panel" id="detail-panel" aria-label="Standard and product details"></aside></section>';
      renderer = new CanvasRenderer(document.getElementById('graphCanvas'), document.getElementById('tooltip'), { select: n => { state.selected = n?.standard_id || null; state.tab = 'overview'; renderDetails(); }, camera: zoom => { const el = document.getElementById('zoom-value'); if (el) el.textContent = zoom + '%'; } });
      window.normasGraphRenderer = renderer; rebuildGraph(); renderDetails();
    } else renderCollection();
  }
  function rebuildGraph() {
    try {
      const root = new GraphModel(data).expand(state.product, { families: state.families, depth: state.depth, islands: state.islands }); renderer.setTree(new FractalLayout().build(root));
      const unique = new Set(renderer.nodes.filter(n => n.standard_id).map(n => n.standard_id)).size;
      const entries = root.children.filter(n => !n.floating && !n.island).length, unlinked = new Set(root.children.filter(n => n.disconnected).map(n => n.standard_id)).size;
      document.getElementById('map-summary').textContent = unique + ' standards · ' + entries + ' tree entries · ' + unlinked + ' unlinked';
      syncFamilyControls();
    } catch (error) { notify(error.message); }
  }
  function syncFamilyControls() {
    const all = state.families.length === 3, single = state.families.length === 1;
    document.querySelectorAll('[data-family]').forEach(b => { const on = state.families.includes(b.dataset.family); b.classList.toggle('is-muted', !on); b.setAttribute('aria-pressed', on); });
    document.querySelectorAll('[data-family-focus]').forEach(b => {
      const on = state.families.includes(b.dataset.familyFocus), selected = single && on;
      b.classList.toggle('is-active', selected); b.setAttribute('aria-pressed', on);
      b.querySelector('small').textContent = selected ? 'Selected · this family only' : all ? 'Included in overview' : on ? 'Included in current view' : 'Click to show this family';
      b.querySelector('.family-choice-indicator').innerHTML = icon(selected ? 'check' : 'chevron');
    });
    const summary = document.getElementById('family-filter-summary');
    if (summary) summary.textContent = all ? 'All families shown' : state.families.length ? 'Showing ' + state.families.map(key => categories[key].code).join(' + ') + (single ? ' only' : '') : 'No tree family selected';
    document.querySelectorAll('[data-family-all]').forEach(b => { b.classList.toggle('is-active', all); b.setAttribute('aria-pressed', all); });
  }
  function documentButtons(s) {
    const location = s.document_location;
    return '<div class="document-buttons"><button class="document-reference" data-open-file="' + s.id + '"' + (!location.file_path ? ' disabled' : '') + '>' + icon('file') + '<span><strong>' + esc(location.file_name || 'No local document') + '</strong><small>' + (live ? 'Open PDF / Word from the registered folder' : 'Illustrative document · demo mode') + '</small></span>' + icon('external') + '</button><button class="document-reference online" data-open-link="' + s.id + '"' + (!location.online_url ? ' disabled' : '') + '>' + icon('globe') + '<span><strong>Open online reference</strong><small>' + esc(location.online_url || 'No online link registered') + '</small></span>' + icon('external') + '</button></div>';
  }
  function renderDetails() {
    const panel = document.getElementById('detail-panel'); if (!panel) return;
    const standard = byId(state.selected), p = product();
    if (!standard) {
      panel.innerHTML = '<div class="panel-label">PRODUCT CONTEXT</div>' + (!p.virtual ? '<button class="subgroup-photo-button" data-subgroup-photo="' + p.id + '" aria-label="' + esc('Choose photo for ' + p.name) + '" title="Click to choose a subgroup photo">' + (p.image_url ? '<img class="subgroup-photo" src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '">' : '<span class="photo-placeholder">' + icon('box') + '<small>Add subgroup photo</small></span>') + '</button>' : '<div class="product-detail-icon">' + icon('layers') + '</div>') + '<span class="small-label">' + (p.virtual ? 'LIBRARY VIEW' : 'PRODUCT SUBGROUP') + '</span><h2>' + esc(p.name) + '</h2><p class="detail-description">' + esc(p.description) + '</p><div class="meta-section"><div><span>Product group</span><strong>' + esc(p.group) + '</strong></div></div><section class="detail-section family-section"><div class="family-section-heading"><h3>Reference families</h3><button class="text-button" data-family-all aria-label="Show all reference families">All</button></div><p id="family-filter-summary" class="family-filter-summary" role="status"></p>' + ['test', 'material', 'design'].map(key => '<button class="family-row" data-family-focus="' + key + '" aria-label="' + esc('Show ' + categories[key].label + ' family only') + '" style="--category:' + categories[key].color + '"><span class="category-square">' + icon(categories[key].icon) + '</span><span><strong>' + categories[key].label + '</strong><small></small></span><span class="family-choice-indicator"></span></button>').join('') + '</section><div class="insight"><span>' + icon('tree') + '</span><strong>Fewer roots. Complete coverage.</strong><p>Each family keeps its own tree. Citation chains minimize its entries; cross-family references create additional appearances, not a replacement.</p></div><div class="panel-footer"><button class="button" data-product-references="' + state.product + '">' + icon('tree') + 'Tree coverage</button></div>';
      syncFamilyControls(); return;
    }
    panel.innerHTML = '<div class="panel-label">STANDARD DETAILS<button class="icon-button" data-clear-selection aria-label="Clear selection">' + icon('x') + '</button></div><div class="detail-tags">' + chip(standard) + '<span class="revision">Rev. ' + esc(standard.identification.revision_no) + '</span></div><h2 class="standard-code">' + esc(standard.identification.document_no) + '</h2><p class="standard-title">' + esc(standard.identification.title) + '</p><div class="record-state"><i></i>Active reference<span>' + esc(standard.classification.organization) + '</span></div><div class="detail-tabs"><button data-detail-tab="overview" class="' + (state.tab === 'overview' ? 'active' : '') + '">Overview</button><button data-detail-tab="connections" class="' + (state.tab === 'connections' ? 'active' : '') + '">Connections <small>' + data.relations.standard_standard_relations.filter(r => r.source_standard_id === standard.id).length + '</small></button></div>' + (state.tab === 'overview' ? '<div class="meta-section"><div><span>Origin</span><strong>' + (standard.classification.origin === 'international' ? 'International standard' : 'Internal · MAHLE') + '</strong></div><div><span>Product applicability</span><strong>' + (standard.applicability.is_general ? 'General · all subgroups' : standard.applicability.product_subgroup_ids.map(id => esc(data.subgroups.find(g => g.id === id)?.name || id)).join('<br>') || 'Referenced through citation') + '</strong></div><div><span>Previous document numbers</span><strong>' + (standard.identification.previous_document_numbers.map(esc).join(', ') || '<span class="muted">None recorded</span>') + '</strong></div></div><section class="detail-section"><h3>Current document</h3>' + documentButtons(standard) + '</section><div class="detail-actions"><button class="button" data-update-standard="' + standard.id + '">' + icon('edit') + 'Update standard</button><button class="button" data-relocate="' + standard.id + '">' + icon('folder') + 'Relocate file</button></div><div class="audit-line">' + icon('clock') + '<span>' + esc(standard.record_control?.updated_by || 'Demo record') + '<br>' + esc(standard.record_control?.updated_at ? new Date(standard.record_control.updated_at).toLocaleString() : 'Session only') + '</span></div>' : connectionsHtml(standard)) + '<div class="panel-footer"><button class="button primary" data-new-relation="' + standard.id + '">' + icon('link') + 'Add connection</button><span class="quiet-badge">' + (live ? 'Permanent standard identity' : 'Session-only demo') + '</span></div>';
  }
  function connectionsHtml(s) {
    const outgoing = data.relations.standard_standard_relations.filter(r => r.source_standard_id === s.id), incoming = data.relations.standard_standard_relations.filter(r => r.target_standard_id === s.id);
    const list = (rows, field) => rows.map(r => { const target = byId(r[field]); return '<button class="reference-row" data-standard="' + target.id + '"><span><strong>' + esc(target.identification.document_no) + '</strong><small>' + esc(target.identification.title) + '</small></span>' + strength(r.strength_level) + '</button>'; }).join('') || '<p class="empty-note">No connections in this direction.</p>';
    return '<section class="detail-section"><h3>Calls / references <small>' + outgoing.length + '</small></h3>' + list(outgoing, 'target_standard_id') + '<h3>Referenced by <small>' + incoming.length + '</small></h3>' + list(incoming, 'source_standard_id') + '</section>';
  }
  function showStandard(id) {
    state.selected = id; state.tab = 'overview';
    if (state.view === 'explorer') { if (!renderer.selectStandard(id)) { state.families = ['test', 'material', 'design']; state.depth = 0; state.islands = true; rebuildGraph(); if (!renderer.selectStandard(id)) { state.product = '__all__'; renderView(); renderer.selectStandard(id); } } renderDetails(); }
    else { const s = byId(id); const d = modal(s.identification.document_no, s.identification.title, '<div class="record-preview">' + documentButtons(s) + chip(s) + '<span class="revision">Revision ' + esc(s.identification.revision_no) + '</span><div class="meta-section"><div><span>Organization</span><strong>' + esc(s.classification.organization) + '</strong></div><div><span>Current file</span><strong>' + esc(s.document_location.file_name || 'No local file') + '</strong></div><div><span>Previous document numbers</span><strong>' + (s.identification.previous_document_numbers.map(esc).join(', ') || 'None') + '</strong></div></div>' + connectionsHtml(s) + '</div><footer>' + previewNote + '<button class="button primary" data-update-standard="' + s.id + '">Update standard</button></footer>'); d.querySelector('[data-update-standard]').onclick = e => { e.stopPropagation(); d.close(); standardForm(id); }; }
  }
  function matches(s) { return [s.identification.document_no, s.identification.title, ...s.identification.previous_document_numbers].join(' ').toLowerCase().includes(state.query.trim().toLowerCase()); }
  function searchResults() {
    const el = document.getElementById('search-results'); if (!state.query.trim()) { el.hidden = true; return; }
    const rows = data.standards.filter(matches).slice(0, 8); el.innerHTML = '<div class="menu-label">SEARCH THE LIBRARY</div>' + rows.map(s => '<button data-standard="' + s.id + '"><span class="search-code">' + esc(s.identification.document_no) + '</span><span>' + esc(s.identification.title) + '</span>' + icon('chevron') + '</button>').join('') + (!rows.length ? '<p class="empty-note">No standards match your search.</p>' : ''); el.hidden = false;
  }
  function renderCollection() {
    const stage = document.getElementById('stage');
    if (state.view === 'products') { const rows = data.subgroups.filter(p => (p.name + ' ' + p.group).toLowerCase().includes(state.query.toLowerCase())); stage.innerHTML = '<section class="collection"><div class="collection-heading"><div><span class="eyebrow">PRODUCT TAXONOMY</span><h2>A context for every reference.</h2><p>Product subgroups define the root of each standards tree.</p></div><button class="button" data-new-product>' + icon('plus') + 'New product subgroup</button></div><div class="products-grid">' + rows.map(p => '<article class="product-card"><button type="button" class="product-card-art subgroup-photo-target" data-subgroup-photo="' + p.id + '" aria-label="' + esc('Choose photo for ' + p.name) + '" title="Click to choose a subgroup photo">' + (p.image_url ? '<img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '">' : '<span class="photo-placeholder">' + icon('tree') + '<small>Add subgroup photo</small></span>') + '</button><div class="product-card-body"><span class="small-label">' + esc(p.group) + '</span><h3>' + esc(p.name) + '</h3><p>' + esc(p.description) + '</p><div class="product-card-families"><i style="--category:#d88d9e"></i>TEST<i style="--category:#65b9a5"></i>MATL<i style="--category:#89a3dd"></i>DSGN</div><footer><button class="text-button" data-product-edit="' + p.id + '">Edit details</button><button class="button" data-product="' + p.id + '">Explore ' + icon('arrow') + '</button></footer></div></article>').join('') + '</div></section>'; return; }
    const rows = data.standards.filter(s => matches(s) && (!state.origin || s.classification.origin === state.origin) && (!state.category || s.classification.internal_category === state.category));
    if (state.view === 'catalog') {
      const page = rows.slice(state.page * 12, state.page * 12 + 12);
      stage.innerHTML = '<section class="collection"><div class="collection-heading"><div><span class="eyebrow">CURRENT REFERENCES</span><h2>Standards catalog <small>' + rows.length + '</small></h2><p>One permanent identity for every standard. Only the current revision.</p></div></div><div class="catalog-filters">' + fieldSelect('origin-filter', 'Origin', [{ value: '', label: 'All origins' }, { value: 'internal', label: 'Internal · MAHLE' }, { value: 'international', label: 'International' }], state.origin) + fieldSelect('category-filter', 'Category', [{ value: '', label: 'All categories' }, ...Object.entries(categories).map(([value, m]) => ({ value, label: m.code + ' · ' + m.label }))], state.category) + '<span>' + rows.length + ' references</span></div><div class="table-scroll"><table><thead><tr><th>Document</th><th>Title</th><th>Revision</th><th>Category</th><th>Organization</th><th></th></tr></thead><tbody>' + page.map(s => '<tr><td><button class="document-cell" data-standard="' + s.id + '"><span class="document-icon" style="--category:' + meta(s).color + '">' + icon(meta(s).icon) + '</span><span><strong>' + esc(s.identification.document_no) + '</strong><small>' + (s.identification.previous_document_numbers[0] ? 'Formerly ' + esc(s.identification.previous_document_numbers[0]) : 'Current reference') + '</small></span></button></td><td>' + esc(s.identification.title) + '</td><td><span class="revision">' + esc(s.identification.revision_no) + '</span></td><td>' + chip(s) + '</td><td>' + esc(s.classification.organization) + '</td><td><button class="icon-button" data-update-standard="' + s.id + '" aria-label="Update ' + esc(s.identification.document_no) + '">' + icon('edit') + '</button></td></tr>').join('') + '</tbody></table>' + (!rows.length ? '<div class="empty-state">' + icon('search') + '<h3>No matching standards</h3><p>Try another code, title or previous document number.</p></div>' : '') + '</div><div class="pagination"><span>Showing ' + (rows.length ? state.page * 12 + 1 : 0) + '–' + Math.min(rows.length, state.page * 12 + 12) + ' of ' + rows.length + '</span><div><button class="button" data-page="-1"' + (!state.page ? ' disabled' : '') + '>Previous</button><button class="button" data-page="1"' + (state.page * 12 + 12 >= rows.length ? ' disabled' : '') + '>Next</button></div></div></section>';
    } else {
      const relations = data.relations.standard_standard_relations.filter(r => { const a = byId(r.source_standard_id), b = byId(r.target_standard_id); return matches(a) || matches(b); });
      stage.innerHTML = '<section class="collection"><div class="collection-heading"><div><span class="eyebrow">STRUCTURAL REFERENCES</span><h2>Connections <small>' + relations.length + '</small></h2><p>Direction defines the reference. Strength defines its local visual priority.</p></div><button class="button primary" data-new-relation="">' + icon('plus') + 'New connection</button></div><div class="connection-guide">' + [3, 2, 1].map(n => '<span>' + strength(n) + ['Peripheral branch', 'Intermediate branch', 'Primary branch'][n - 1] + '</span>').join('') + '</div><div class="table-scroll"><table><thead><tr><th>Source standard</th><th></th><th>Referenced standard</th><th>Strength</th><th></th></tr></thead><tbody>' + relations.slice(state.page * 12, state.page * 12 + 12).map(r => '<tr><td><button class="table-reference" data-standard="' + r.source_standard_id + '"><strong>' + esc(byId(r.source_standard_id).identification.document_no) + '</strong><small>' + esc(byId(r.source_standard_id).identification.title) + '</small></button></td><td class="arrow-cell">' + icon('arrow') + '</td><td><button class="table-reference" data-standard="' + r.target_standard_id + '"><strong>' + esc(byId(r.target_standard_id).identification.document_no) + '</strong><small>' + esc(byId(r.target_standard_id).identification.title) + '</small></button></td><td>' + strength(r.strength_level) + '</td><td><button class="icon-button" data-edit-relation="' + r.id + '" aria-label="Edit connection">' + icon('edit') + '</button></td></tr>').join('') + '</tbody></table></div><div class="pagination"><span>' + relations.length + ' connections · repeat appearances share the same logical record</span><div><button class="button" data-page="-1"' + (!state.page ? ' disabled' : '') + '>Previous</button><button class="button" data-page="1"' + (state.page * 12 + 12 >= relations.length ? ' disabled' : '') + '>Next</button></div></div></section>';
    }
  }
  function formError(d, text) { let el = d.querySelector('.form-error'); if (!el) { el = document.createElement('div'); el.className = 'form-error'; el.setAttribute('role', 'alert'); d.querySelector('.modal-body').prepend(el); } el.textContent = text; el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  function productReferencesDialog(productId) {
    const graph = new GraphModel(data), { roots, ids } = graph.entries(productId);
    modal('Tree coverage', product().name + ' · automatic entries within each family', '<div class="inline-info">' + icon('tree') + '<span>Each family has its own minimum entry set. References can cross families, but never remove the native tree. Cycles stop at the return cell; unlinked standards float without a root edge.</span></div><section class="root-reference-list">' + roots.map(r => '<div class="root-reference-row"><span>' + chip(byId(r.standard_id)) + '<strong>' + esc(byId(r.standard_id).identification.document_no) + '</strong><small>' + (r.floating ? 'Unlinked · floating' : 'Citation-chain entry') + '</small></span></div>').join('') + '</section><p class="empty-note">' + ids.size + ' standards covered. Entries are recalculated whenever applicability or citations change.</p>');
  }
  async function commitOperation(type, payload, dialog, demoApply) {
    const form = dialog?.querySelector('form'); if (form) form.inert = true;
    try {
      if (live) acceptSnapshot(await nativeRequest(type, payload));
      else demoApply?.();
      return true;
    } catch (error) {
      if (dialog?.isConnected) {
        formError(dialog, error.message);
        if (error.code === 'conflict' && error.details) {
          let actions = dialog.querySelector('.conflict-actions');
          if (!actions) { actions = document.createElement('div'); actions.className = 'conflict-actions'; dialog.querySelector('.form-error').append(actions); }
          actions.replaceChildren(); const button = document.createElement('button'); button.type = 'button'; button.className = 'button'; button.textContent = 'View the saved record';
          button.onclick = () => { const d = modal('Saved version · read only', 'Your unsaved entries remain in the previous form. Close it and reopen the record to edit the latest version.', '<pre class="storage-path"></pre>'); d.querySelector('pre').textContent = JSON.stringify(error.details, null, 2); }; actions.append(button);
        }
      } else notify(error.message);
      return false;
    } finally { if (form) form.inert = false; }
  }
  const applyRecord = (rows, record) => { const index = rows.findIndex(r => r.id === record.id); if (index < 0) rows.push(record); else rows[index] = record; };
  function subgroupChoices(selected = []) { return data.subgroups.map(g => '<label><input name="subgroup" type="checkbox" value="' + g.id + '"' + (selected.includes(g.id) ? ' checked' : '') + '>' + esc(g.name) + '</label>').join(''); }
  function standardForm(id) {
    const original = byId(id), s = original || { identification: { document_no: '', revision_no: '', title: '', previous_document_numbers: [] }, classification: { origin: 'internal', internal_category: 'test', organization: 'MAHLE' }, applicability: { product_group_ids: [], product_subgroup_ids: [], is_general: false }, tree_entry: { family: 'test', strength_level: 3 }, document_location: { online_url: '', file_name: null, file_path: null } };
    const d = modal(original ? 'Update standard' : 'Register a standard', 'Permanent identity. Current revision. One record shared across every tree.', '<form id="standard-form" novalidate><div class="form-section-heading"><span>01</span><div><h3>Identification</h3><p>Code and revision can change without breaking citations.</p></div></div><div class="form-grid"><label class="field"><span>Document No *</span><input name="document_no" placeholder="e.g. DSGN-372" value="' + esc(s.identification.document_no) + '"></label><label class="field"><span>Revision No *</span><input name="revision_no" placeholder="e.g. 12.0" value="' + esc(s.identification.revision_no) + '"></label><label class="field full"><span>Title *</span><textarea name="title" rows="2" placeholder="Full official title">' + esc(s.identification.title) + '</textarea></label><label class="field full"><span>Previous document numbers <small>Optional · separate with semicolons</small></span><input name="previous" value="' + esc(s.identification.previous_document_numbers.join('; ')) + '"></label>' + (original ? '<label class="checkbox-label full" id="preserve-code" hidden><input type="checkbox" name="preserve" checked>Add the current code to previous numbers</label>' : '') + '</div><div class="form-section-heading"><span>02</span><div><h3>Classification & applicability</h3><p>References determine the smallest tree entry set automatically.</p></div></div><div class="form-grid">' + fieldSelect('origin', 'Origin *', [{ value: 'internal', label: 'Internal standard' }, { value: 'international', label: 'International standard' }], s.classification.origin) + fieldSelect('category', 'Family / sector *', Object.entries(categories).map(([value, m]) => ({ value, label: m.code + ' · ' + m.label })), s.tree_entry?.family || s.classification.internal_category || 'design') + '<label class="field full"><span>Organization *</span><input name="organization" value="' + esc(s.classification.organization) + '" placeholder="MAHLE, ISO, ASTM, DIN…"></label><label class="scope-check full"><input type="checkbox" name="is_general"' + (s.applicability.is_general ? ' checked' : '') + '><span><strong>General standard</strong><small>Include this standard in every subgroup tree, including future subgroups.</small></span></label><fieldset class="field full"><legend>Product groups</legend><div class="choice-chips">' + data.taxonomy.product_groups.map(g => '<label><input name="group" type="checkbox" value="' + esc(g.id) + '"' + (s.applicability.product_group_ids.includes(g.id) ? ' checked' : '') + '>' + esc(g.name) + '</label>').join('') + '</div></fieldset><fieldset class="field full" id="subgroup-field"><legend>Product subgroups</legend><div class="choice-chips" id="subgroup-choices">' + subgroupChoices(s.applicability.product_subgroup_ids) + '</div><button type="button" class="text-button" id="inline-subgroup">' + icon('plus') + 'Create a subgroup</button></fieldset></div><div class="form-section-heading"><span>03</span><div><h3>Current document</h3><p>PDF, DOC or DOCX. Required for internal standards; optional for international.</p></div></div><button class="file-picker" type="button" id="pick-standard-file">' + icon('folder') + '<span><strong id="picked-file-name">' + esc(s.document_location.file_name || 'Choose a document') + '</strong><small id="picked-file-path">' + esc(s.document_location.file_path || 'The original file is referenced, not copied.') + '</small></span><span class="button small">Browse</span></button><label class="field"><span>Online link <small>Optional · opens in your browser</small></span><input name="online_url" placeholder="https://…" value="' + esc(s.document_location.online_url) + '"></label><footer>' + previewNote + '<button class="button primary" type="submit">' + (live ? 'Save standard' : 'Apply to demo') + ' ' + icon('check') + '</button></footer></form>', true);
    const form = d.querySelector('form'); let file = { ...s.document_location };
    d.querySelector('#pick-standard-file').onclick = async () => { const selected = await pickFile(); if (selected) { file.file_name = selected.name; file.file_path = selected.path || 'demo-only/' + selected.name; d.querySelector('#picked-file-name').textContent = selected.name; d.querySelector('#picked-file-path').textContent = file.file_path; } };
    d.querySelector('#inline-subgroup').onclick = () => productForm(null, added => { const selected = Array.from(form.querySelectorAll('[name=subgroup]:checked')).map(c => c.value); selected.push(added.id); d.querySelector('#subgroup-choices').innerHTML = subgroupChoices(selected); });
    const scopeChange = () => { d.querySelector('#subgroup-field').hidden = form.elements.is_general.checked; };
    form.elements.is_general.onchange = scopeChange; scopeChange();
    form.elements.document_no.oninput = () => { if (original) d.querySelector('#preserve-code').hidden = form.elements.document_no.value.trim() === original.identification.document_no; };
    form.onsubmit = async e => {
      e.preventDefault(); const f = new FormData(form), no = f.get('document_no').trim(), revision = f.get('revision_no').trim(), title = f.get('title').trim(), org = f.get('organization').trim(), internal = f.get('origin') === 'internal', general = f.has('is_general');
      if (!no || !revision || !title || !org) return formError(d, 'Complete Document No, Revision No, Title and Organization.');
      if (internal && !file.file_path) return formError(d, 'Choose a PDF, DOC or DOCX for this internal standard.');
      if (!general && !f.getAll('subgroup').length) return formError(d, 'Select at least one subgroup, or choose General standard.');
      const url = f.get('online_url').trim(); if (url && !/^https?:\/\//i.test(url)) return formError(d, 'The online link must start with http:// or https://.');
      if (data.standards.some(r => r.id !== id && r.identification.document_no.toLowerCase() === no.toLowerCase())) return formError(d, 'This Document No already exists in the library.');
      const previous = f.get('previous').split(';').map(v => v.trim()).filter(Boolean); if (original && no !== original.identification.document_no && f.get('preserve')) previous.push(original.identification.document_no);
      const record = { ...(original ? { id: original.id } : live ? {} : { id: crypto.randomUUID() }), identification: { document_no: no, revision_no: revision, title, previous_document_numbers: [...new Set(previous)] }, classification: { origin: f.get('origin'), internal_category: internal ? f.get('category') : null, organization: org, customer_id: null }, applicability: { product_group_ids: f.getAll('group'), product_subgroup_ids: f.getAll('subgroup'), is_general: general }, tree_entry: { family: f.get('category'), strength_level: s.tree_entry?.strength_level || 3 }, document_location: { ...file, online_url: url }, record_control: { status: 'active', updated_at: new Date().toISOString() } };
      if (!await commitOperation('standard.save', { record, expected_etag: original?._etag || '' }, d, () => applyRecord(data.standards, record))) return;
      d.close(); state.selected = data.standards.find(r => r.identification.document_no === no)?.id; renderView(); notify(live ? 'Standard saved to the shared library.' : 'Demo updated. Nothing was saved to disk.');
    };
  }
  async function pickFile() {
    if (window.__MAHLE_FRACTAL_HOST__ && window.chrome?.webview) { try { const result = await nativeRequest('standard.selectFile'); return result.canceled ? null : result; } catch (error) { notify(error.message); return null; } }
    return new Promise(resolve => { const input = document.getElementById('browser-file'); input.value = ''; input.onchange = () => { const file = input.files[0]; if (file && !/\.(pdf|docx?)$/i.test(file.name)) { notify('Choose a PDF, DOC or DOCX.'); resolve(null); } else resolve(file ? { name: file.name, path: null } : null); }; input.oncancel = () => resolve(null); input.click(); });
  }
  function productForm(id, onSaved) {
    const p = data.subgroups.find(p => p.id === id), d = modal(p ? 'Edit product subgroup' : 'Create a product subgroup', 'Each subgroup has its own tree. General standards apply automatically.', '<form novalidate><label class="field"><span>Subgroup name *</span><input name="name" placeholder="e.g. Oil filter elements" value="' + esc(p?.name || '') + '"></label><fieldset class="field"><legend>Product groups *</legend><div class="choice-chips">' + data.taxonomy.product_groups.map(g => '<label><input type="checkbox" name="group" value="' + esc(g.id) + '"' + (p?.product_group_ids?.includes(g.id) ? ' checked' : '') + '>' + esc(g.name) + '</label>').join('') + '</div><button type="button" class="text-button" id="inline-group">' + icon('plus') + 'Create a product group</button></fieldset><label class="field"><span>Description</span><textarea name="description" rows="3">' + esc(p?.description || '') + '</textarea></label><div class="inline-info">' + icon('info') + '<span>Save the subgroup first, then choose its photo from the subgroup card or tree details.</span></div><footer>' + previewNote + '<button class="button primary" type="submit">' + (live ? 'Save subgroup' : 'Apply to demo') + '</button></footer></form>');
    const form = d.querySelector('form');
    d.querySelector('#inline-group').onclick = () => groupForm(g => { const label = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.name = 'group'; input.value = g.id; input.checked = true; label.append(input, document.createTextNode(g.name)); form.querySelector('.choice-chips').append(label); });
    form.onsubmit = async e => { e.preventDefault(); const f = new FormData(form), name = f.get('name').trim(); if (!name || !f.getAll('group').length) return formError(d, 'Enter a subgroup name and choose at least one product group.');
      const record = { ...(p ? { id: p.id } : live ? {} : { id: crypto.randomUUID() }), name, product_group_ids: f.getAll('group'), description: f.get('description').trim(), image_path: p?.image_path || '' };
      if (!await commitOperation('subgroup.save', { record, expected_etag: p?._etag || '' }, d, () => { record.group = record.product_group_ids.map(id => data.taxonomy.product_groups.find(g => g.id === id).name).join(', '); applyRecord(data.subgroups, record); })) return;
      const added = data.subgroups.find(g => g.name === name); d.close(); if (onSaved) onSaved(added); else renderView(); notify(live ? 'Subgroup saved.' : 'Subgroup added to this demo session.');
    };
  }
  function groupForm(onSaved) {
    const d = modal('Create a product group', 'Organize subgroups without adding another tree level.', '<form><label class="field"><span>Group name *</span><input name="name" required></label><footer>' + previewNote + '<button class="button primary" type="submit">Save group</button></footer></form>');
    d.querySelector('form').onsubmit = async e => { e.preventDefault(); const name = new FormData(e.target).get('name').trim(); if (!name) return formError(d, 'Enter a group name.'); const record = { ...(live ? {} : { id: crypto.randomUUID() }), name }; if (!await commitOperation('group.save', { record }, d, () => data.taxonomy.product_groups.push(record))) return; d.close(); onSaved(data.taxonomy.product_groups.find(g => g.name === name)); };
  }
  async function chooseSubgroupPhoto(id) {
    const p = data.subgroups.find(g => g.id === id); if (!p) return;
    try {
      if (live) { const snapshot = await nativeRequest('subgroup.selectImage', { id, expected_etag: p._etag }); if (snapshot.canceled) return; acceptSnapshot(snapshot); renderView(); notify('Subgroup image saved to the shared library.'); }
      else { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg'; input.onchange = () => { const file = input.files[0]; if (!file) return; if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 12 * 1024 * 1024) return notify('Choose a PNG or JPG smaller than 12 MB.'); p.image_url = URL.createObjectURL(file); renderView(); }; input.click(); }
    } catch (error) { notify(error.message); }
  }
  function relationForm(sourceId, relationId) {
    if (data.standards.length < 2) return notify('Register at least two standards before connecting them.');
    const r = data.relations.standard_standard_relations.find(r => r.id === relationId), choices = data.standards.map(s => ({ value: s.id, label: s.identification.document_no + ' · ' + s.identification.title }));
    const sourceChoice = r?.source_standard_id || sourceId || choices[0].value, targetChoice = r?.target_standard_id || choices.find(c => c.value !== sourceChoice).value;
    const d = modal(r ? 'Edit a connection' : 'Connect two standards', 'The source standard calls or cites the destination. Saved citations recalculate the tree automatically.', '<form novalidate><div class="connection-form-visual">' + icon('file') + '<span></span>' + icon('arrow') + '<span></span>' + icon('file') + '</div>' + fieldSelect('source', 'Source standard', choices, sourceChoice) + fieldSelect('target', 'Referenced standard', choices, targetChoice) + '<label class="field"><span>Connection strength</span><small>Local visual priority, not a normative relationship type.</small></label><div class="strength-options">' + [1, 2, 3].map(n => '<label><input type="radio" name="strength" value="' + n + '"' + ((r?.strength_level || 3) === n ? ' checked' : '') + '>' + strength(n) + '<strong>' + ['Peripheral', 'Intermediate', 'Primary'][n - 1] + '</strong></label>').join('') + '</div><footer>' + (r ? '<button class="text-button danger" type="button" id="remove-connection">Remove connection</button>' : previewNote) + '<button class="button primary" type="submit">' + (live ? 'Save connection' : 'Apply to demo') + '</button></footer></form>');
    const form = d.querySelector('form'); let cycleAccepted = false;
    form.onsubmit = async e => {
      e.preventDefault(); const f = new FormData(form), source = f.get('source'), target = f.get('target'); if (source === target) return formError(d, 'A standard cannot reference itself.');
      if (data.relations.standard_standard_relations.some(x => x.id !== r?.id && x.source_standard_id === source && x.target_standard_id === target)) return formError(d, 'This source and destination are already connected.');
      const seen = new Set(), reaches = id => { if (id === source) return true; if (seen.has(id)) return false; seen.add(id); return data.relations.standard_standard_relations.filter(x => x.source_standard_id === id && x.id !== r?.id).some(x => reaches(x.target_standard_id)); };
      if (reaches(target) && !cycleAccepted) { cycleAccepted = true; return formError(d, 'This connection creates a cycle. Expansion stops at the return cell. Save again to confirm this intentional reference.'); }
      const record = { ...(r ? { id: r.id } : live ? {} : { id: crypto.randomUUID() }), source_standard_id: source, target_standard_id: target, strength_level: Number(f.get('strength')) };
      if (!await commitOperation('relation.save', { record, expected_etag: r?._etag || '', allow_cycle: cycleAccepted }, d, () => applyRecord(data.relations.standard_standard_relations, record))) return;
      d.close(); renderView(); notify('Connection saved.');
    };
    form.addEventListener('change', () => cycleAccepted = false);
    d.querySelector('#remove-connection')?.addEventListener('click', () => { const confirm = modal('Remove this connection?', 'The standards and their documents will not be deleted.', '<footer><button class="button" id="cancel-remove">Cancel</button><button class="button danger-button" id="confirm-remove">Remove connection</button></footer>'); confirm.querySelector('#cancel-remove').onclick = () => confirm.close(); confirm.querySelector('#confirm-remove').onclick = async () => { const button = confirm.querySelector('#confirm-remove'); button.disabled = true; if (await commitOperation('relation.delete', { id: r.id, expected_etag: r._etag }, confirm, () => data.relations.standard_standard_relations.splice(data.relations.standard_standard_relations.indexOf(r), 1))) { confirm.close(); d.close(); renderView(); notify('Connection removed.'); } button.disabled = false; }; });
  }
  function viewOptions(trigger) {
    const box = popup(trigger, '<div class="menu-label">MAP PRESENTATION</div><label class="option-check"><input type="checkbox" id="show-islands"' + (state.islands ? ' checked' : '') + '><span><strong>Peripheral islands</strong><small>MEAS and MNFG references</small></span></label><div class="menu-divider"></div><div class="menu-label">VISIBLE DEPTH</div><div class="depth-options">' + [0, 3, 2].map(v => '<button data-depth="' + v + '" class="' + (state.depth === v ? 'active' : '') + '">' + (v ? v + ' levels' : 'All levels') + '</button>').join('') + '</div><p class="popover-note">Families can also be toggled directly on the map. All labels remain available when zooming.</p>');
    box.querySelector('#show-islands').onchange = e => { state.islands = e.target.checked; if (renderer) { rebuildGraph(); renderDetails(); } };
    box.querySelectorAll('[data-depth]').forEach(b => b.onclick = () => { state.depth = Number(b.dataset.depth); if (renderer) { rebuildGraph(); renderDetails(); } box.querySelectorAll('[data-depth]').forEach(x => x.classList.toggle('active', x === b)); });
  }
  function acceptSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.standards) || !Array.isArray(snapshot.subgroups)) throw new Error('Invalid data received. The local view was kept.');
    Object.assign(data, snapshot);
    if (!['__all__', '__general__'].includes(state.product) && !data.subgroups.some(g => g.id === state.product)) state.product = data.subgroups[0]?.id || '__all__';
  }
  const pending = new Map();
  function nativeRequest(type, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID(), timer = setTimeout(() => { pending.delete(id); reject(new Error('No response from the shared folder. A submitted save may have completed; refresh and check before retrying.')); }, 45000);
      pending.set(id, { resolve, reject, timer }); window.chrome.webview.postMessage({ id, type, payload });
    });
  }
  window.chrome?.webview?.addEventListener('message', e => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); clearTimeout(p.timer); if (e.data.ok) p.resolve(e.data.data); else { const value = e.data.error, error = new Error(value?.message || String(value)); error.code = value?.code; error.details = value?.details; p.reject(error); } });
  async function refreshData(manual = false) {
    if (!live) { if (manual) notify('Demo mode · this session is not connected to a database.'); return; }
    if (refreshing) return; refreshing = true;
    try {
      const snapshot = await nativeRequest('workspace.get'), changed = snapshot.data_etag !== data.data_etag;
      acceptSnapshot(snapshot); ready = true;
      document.querySelector('[data-new-standard]').disabled = false;
      if (changed && !document.querySelector('dialog[open]')) renderView();
      if (manual) { if (!changed || document.querySelector('dialog[open]')) notify('Shared data refreshed. Open forms keep their original revision checks.'); }
    } catch (error) { if (manual) notify(error.message); }
    finally { refreshing = false; }
  }
  function preferences() {
    const d = modal('Workspace settings', 'Data location, safe JSON maintenance and presentation.', '<section class="settings-section"><h3>Shared data folder</h3><p>' + (live ? 'Every computer must use the same UNC folder for simultaneous editing. Change dataRoot in the configuration below, then restart the app.' : 'Demo mode is isolated. To use real documents and save records, set mode to production in config/appsettings.json and open the Windows application.') + '</p><code class="storage-path">' + esc(environment.data_root || 'No database · browser demo') + '</code><p>Configuration</p><code class="storage-path">' + esc(environment.config_path || 'config/appsettings.json') + '</code>' + (live ? '<div class="settings-actions"><button class="button" id="open-data-folder">' + icon('folder') + 'Open data folder</button><button class="button" id="validate-data">' + icon('shield') + 'Validate JSON</button></div>' : '') + '</section>' + (live ? '<section class="settings-section"><h3>External JSON / AI editing</h3><p>Before changing files directly, pause saves for everyone. Make a backup of the full data folder, edit, then validate and resume. Invalid JSON is never replaced with empty data.</p><div class="settings-actions"><button class="button" id="begin-maintenance">Pause saves for JSON editing</button><button class="button primary" id="end-maintenance">Validate & resume saves</button></div></section>' : '') + '<label class="preference-row"><span><strong>Reduced motion</strong><small>Use immediate camera transitions.</small></span><input type="checkbox" id="reduced-motion"' + (renderer?.reduced ? ' checked' : '') + '></label>');
    d.querySelector('#reduced-motion').onchange = e => { if (renderer) renderer.reduced = e.target.checked; };
    for (const [id, operation, message] of [['open-data-folder', 'storage.openFolder', 'Data folder opened.'], ['validate-data', 'workspace.validate', 'JSON and references are valid.'], ['begin-maintenance', 'maintenance.begin', 'Saving paused for everyone. You can now edit JSON directly.'], ['end-maintenance', 'maintenance.end', 'Validation passed. Shared saving has resumed.']]) {
      const button = d.querySelector('#' + id); if (button) button.onclick = async () => { button.disabled = true; try { const result = await nativeRequest(operation); if (result.standards) acceptSnapshot(result); notify(message); } catch (error) { formError(d, error.message); } finally { button.disabled = false; } };
    }
    d.addEventListener('close', () => { if (ready) renderView(); });
  }
  async function relocate(id) {
    const s = byId(id), d = modal('Relocate current document', 'Change only the file path. Identity, code, revision and connections stay unchanged.', '<div class="relocate-path">' + icon('file') + '<div><strong>' + esc(s.identification.document_no) + '</strong><code>' + esc(s.document_location.file_path || 'No file selected') + '</code></div></div><footer>' + previewNote + '<button class="button primary" id="locate-file">' + icon('folder') + 'Locate file</button></footer>');
    d.querySelector('#locate-file').onclick = async () => { const file = await pickFile(); if (!file) return; const record = structuredClone(s); record.document_location.file_name = file.name; record.document_location.file_path = file.path || 'demo-only/' + file.name; if (!await commitOperation('standard.save', { record, expected_etag: s._etag }, d, () => applyRecord(data.standards, record))) return; d.close(); renderView(); notify('Document location updated.'); };
  }
  async function openDocument(id, online) {
    const s = byId(id); if (!s) return;
    if (!live) { if (online && s.document_location.online_url) window.open(s.document_location.online_url, '_blank', 'noopener,noreferrer'); else notify('Demo documents are illustrative. Use production mode to register a real local or UNC file.'); return; }
    try { await nativeRequest(online ? 'standard.openLink' : 'standard.openFile', { id }); } catch (error) { notify(error.message); }
  }
  document.addEventListener('click', e => {
    const target = e.target.closest('button'); if (!target) return;
    if (target.matches('[data-view]')) { state.view = target.dataset.view; state.query = ''; state.page = 0; renderView(); }
    else if (target.id === 'product-picker') { const box = popup(target, '<div class="menu-label">SELECT PRODUCT SUBGROUP</div>' + [{ id: '__all__', name: 'All standards', group: 'Combined view · every registered standard' }, { id: '__general__', name: 'General standards', group: 'Shared applicability · every subgroup' }, ...data.subgroups].map(p => '<button class="product-option" data-product="' + p.id + '">' + icon('box') + '<span><strong>' + esc(p.name) + '</strong><small>' + esc(p.group) + '</small></span>' + (p.id === state.product ? icon('check') : '') + '</button>').join(''), 'product-menu'); box.setAttribute('role', 'listbox'); }
    else if (target.matches('[data-product]')) { state.product = target.dataset.product; state.view = 'explorer'; state.selected = null; state.query = ''; renderView(); }
    else if (target.matches('[data-standard]')) { document.getElementById('search-results').hidden = true; closePopover(); showStandard(target.dataset.standard); }
    else if (target.matches('[data-new-standard]')) standardForm();
    else if (target.matches('[data-update-standard]')) { if (target.closest('dialog')?.querySelector('.record-preview')) { target.closest('dialog').close(); e.stopImmediatePropagation(); } standardForm(target.dataset.updateStandard); }
    else if (target.matches('[data-product-references]')) productReferencesDialog(target.dataset.productReferences);
    else if (target.matches('[data-new-product]')) productForm();
    else if (target.matches('[data-product-edit]')) productForm(target.dataset.productEdit);
    else if (target.matches('[data-new-relation]')) relationForm(target.dataset.newRelation);
    else if (target.matches('[data-edit-relation]')) relationForm(null, target.dataset.editRelation);
    else if (target.matches('[data-clear-selection]')) { state.selected = null; renderer.select(null); renderDetails(); }
    else if (target.matches('[data-detail-tab]')) { state.tab = target.dataset.detailTab; renderDetails(); }
    else if (target.matches('[data-family-focus]')) { state.families = [target.dataset.familyFocus]; state.selected = null; rebuildGraph(); renderDetails(); }
    else if (target.matches('[data-family-all]')) { state.families = ['test', 'material', 'design']; state.selected = null; rebuildGraph(); renderDetails(); }
    else if (target.matches('[data-family]')) { const f = target.dataset.family; state.families = state.families.includes(f) ? state.families.filter(x => x !== f) : [...state.families, f]; state.selected = null; rebuildGraph(); renderDetails(); }
    else if (target.id === 'view-options') { if (state.view === 'explorer') viewOptions(target); else notify('Use the catalog filters or the search field to narrow this view.'); }
    else if (target.matches('[data-camera]')) { if (target.dataset.camera === 'fit') renderer.fitToScreen(true); else if (target.dataset.camera === 'focus') renderer.selected ? renderer.focus(renderer.selected) : notify('Select a standard on the map first.'); else renderer.zoomAt(target.dataset.camera === 'plus' ? 1.35 : 1 / 1.35); }
    else if (target.matches('[data-fullscreen]')) { document.querySelector('.map-panel').classList.toggle('expanded'); setTimeout(() => renderer.fitToScreen(true), 40); }
    else if (target.matches('[data-page]')) { state.page = Math.max(0, state.page + Number(target.dataset.page)); renderCollection(); }
    else if (target.matches('[data-subgroup-photo]')) chooseSubgroupPhoto(target.dataset.subgroupPhoto);
    else if (target.matches('[data-open-file]')) openDocument(target.dataset.openFile, false);
    else if (target.matches('[data-open-link]')) openDocument(target.dataset.openLink, true);
    else if (target.matches('[data-relocate]')) relocate(target.dataset.relocate);
    else if (target.matches('[data-refresh]')) refreshData(true);
    else if (target.matches('[data-about]')) modal('A connected standards workspace', 'Independent today. Compatible with the MAHLE WebView2 app for future integration.', '<div class="about-grid"><div>' + icon('tree') + '<h3>Complete coverage. Fewer roots.</h3><p>Directed citation paths, automatic entry selection and floating unlinked references.</p></div><div>' + icon('shield') + '<h3>Shared JSON records</h3><p>Real documents stay in their original folders. Permanent UUIDs preserve relationships when a code or file changes.</p></div><div>' + icon('link') + '<h3>Simultaneous editing</h3><p>Short shared write locks, record fingerprints, transaction recovery and visible conflict handling. Direct file editing requires maintenance mode.</p></div></div>');
    else if (target.matches('[data-preferences]')) preferences();
    else if (target.matches('[data-select]')) {
      const items = JSON.parse(target.dataset.select), input = target.parentElement.querySelector('input'), box = popup(target, (items.length > 8 ? '<input class="option-search" type="search" placeholder="Search options…" aria-label="Search options">' : '') + '<div class="select-options" role="listbox"></div>', 'select-menu');
      const draw = query => { box.querySelector('.select-options').innerHTML = items.filter(i => i.label.toLowerCase().includes(query.toLowerCase())).map(i => '<button type="button" data-choice="' + esc(i.value) + '" role="option" aria-selected="' + (i.value === input.value) + '"><span>' + esc(i.label) + '</span>' + (i.value === input.value ? icon('check') : '') + '</button>').join('') || '<p class="empty-note">No matching options</p>'; box.querySelectorAll('[data-choice]').forEach(b => b.onclick = ev => { ev.stopPropagation(); input.value = b.dataset.choice; target.querySelector('span').textContent = items.find(i => i.value === input.value).label; closePopover(); input.dispatchEvent(new Event('change', { bubbles: true })); target.focus(); }); };
      draw(''); box.querySelector('.option-search')?.addEventListener('input', ev => draw(ev.target.value)); box.querySelector('.option-search')?.focus();
    }
  });
  document.addEventListener('change', e => { if (e.target.name === 'origin-filter') { state.origin = e.target.value; state.page = 0; renderCollection(); } if (e.target.name === 'category-filter') { state.category = e.target.value; state.page = 0; renderCollection(); } });
  document.addEventListener('pointerdown', e => { if (popover && !popover.box.contains(e.target) && !popover.trigger.contains(e.target)) closePopover(); const results = document.getElementById('search-results'); if (!e.target.closest('.search-box') && results) results.hidden = true; });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.getElementById('global-search').focus(); } if (e.key === 'Escape') { if (popover) { e.preventDefault(); e.stopPropagation(); closePopover(); } document.getElementById('search-results').hidden = true; document.querySelector('.map-panel.expanded')?.classList.remove('expanded'); } }, true);
  window.addEventListener('resize', closePopover);
  window.FractalWorkspace = { state, data, renderView, get ready() { return ready; }, get renderer() { return renderer; } };
  async function bootstrap() {
    shell();
    if (!live) { ready = true; return; }
    document.querySelector('[data-new-standard]').disabled = true;
    document.getElementById('stage').innerHTML = '<section class="startup-error"><h2>Opening the shared library…</h2><p>Reading configuration and validating JSON references.</p></section>';
    try {
      environment = await nativeRequest('app.environment');
      acceptSnapshot(await nativeRequest('workspace.get')); ready = true;
      if (data.subgroups.length) state.product = data.subgroups[0].id;
      document.querySelector('[data-new-standard]').disabled = false; renderView();
    } catch (error) {
      document.getElementById('stage').innerHTML = '<section class="startup-error"><h2>The standards library could not be opened</h2><p>' + esc(error.message) + '</p><code class="storage-path">' + esc(environment.config_path || 'config/appsettings.json') + '</code><button class="button primary" data-refresh>Try again</button><button class="button" data-preferences>Data settings</button></section>';
    }
  }
  bootstrap();
  setInterval(() => { if (ready && live && !document.hidden && !document.querySelector('dialog[open]')) refreshData(); }, 8000);
})();
