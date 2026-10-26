'use strict';
// Generates an isolated browser-only, read-only visual comparison. Never copies
// the real database directory or exposes a filesystem/write/open-document API.
const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { readVisualSnapshot } = require('./visual-snapshot.cjs');
const project = path.resolve(__dirname, '..');
const { snapshot } = readVisualSnapshot(process.argv[2], project);
// Images were not supplied with the fixture. Keep the preview fully offline.
snapshot.subgroups.forEach(s => { delete s.image_url; });
const output = process.argv[3] ? path.resolve(process.argv[3]) : path.join(project, 'artifacts/layout-preview-' + new Date().toISOString().replaceAll(':', '-'));
if (fs.existsSync(output)) throw Error('Choose a new output folder; existing preview files are never overwritten.');
fs.mkdirSync(output, { recursive: true }); fs.cpSync(path.join(project, 'frontend'), path.join(output, 'frontend'), { recursive: true });
fs.mkdirSync(path.join(output, 'data'));
fs.writeFileSync(path.join(output, 'data/workspace-snapshot.js'), '/* Read-only visual-test snapshot. Not an operational database. */\nwindow.FractalVisualSnapshot = ' + JSON.stringify(snapshot) + ';\n');
const js = path.join(output, 'frontend/js');
fs.copyFileSync(path.join(project, 'tests/fixtures/layout-legacy-0.2.1.js'), path.join(js, 'legacy-layout.js'));
fs.copyFileSync(path.join(project, 'tests/fixtures/layout-candidates.js'), path.join(js, 'layout-candidates.js'));
fs.writeFileSync(path.join(js, 'visual-test-data.js'), `(function(){
  'use strict';
  const snapshot = window.FractalVisualSnapshot;
  window.__MAHLE_FRACTAL_HOST__ = true;
  const listeners = []; window.chrome = window.chrome || {};
  window.chrome.webview = {
    addEventListener: (_, fn) => listeners.push(fn),
    postMessage: message => {
      let response;
      if (message.type === 'app.environment') response = { id: message.id, ok: true, data: { mode: 'production', data_root: 'Read-only layout comparison', config_path: 'Browser preview · no files are opened or saved' } };
      else if (message.type === 'workspace.get' || message.type === 'workspace.validate') response = { id: message.id, ok: true, data: structuredClone(snapshot) };
      else response = { id: message.id, ok: false, error: { code: 'visual_test', message: 'This preview is read-only. No standards files are needed, opened or changed.' } };
      queueMicrotask(() => listeners.forEach(fn => fn({data:response})));
    }
  };
  window.LayoutCanopy = window.FractalLayout;
})();\n`);
fs.writeFileSync(path.join(js, 'visual-test-controls.js'), `(function(){
  'use strict';
  const engines = { canopy: LayoutCanopy, legacy: LegacyFractalLayout, growth: LayoutCandidates['adaptive-growth'], envelope: LayoutCandidates['branch-envelope'] };
  let selected = 'canopy'; window.FractalLayout = class { build(root) { return new engines[selected]().build(root); } };
  const ready = () => {
    if (!window.FractalWorkspace?.ready) { setTimeout(ready, 60); return; }
    document.title = 'Fractal · Read-only layout comparison';
    const actions = document.querySelector('.header-actions'), controls = document.createElement('div'); controls.className = 'test-layout-controls';
    controls.innerHTML = '<span>LAYOUT TEST</span>' + Object.entries({canopy:'Canopy',legacy:'Original',growth:'Growth',envelope:'Envelope'}).map(([id,label]) => '<button class="button subtle" data-test-engine="'+id+'" aria-pressed="'+(id===selected)+'">'+label+'</button>').join(''); actions.prepend(controls);
    document.querySelector('.demo-badge').textContent = 'Read-only test';
    document.querySelector('.session-state small').textContent = 'Canopy · visual comparison';
    document.querySelector('.statusbar>span:last-child').textContent = 'HTML LAYOUT TEST';
    controls.addEventListener('click', e => { const button = e.target.closest('[data-test-engine]'); if (!button) return; selected=button.dataset.testEngine; controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed', b===button)); FractalWorkspace.state.selected=null; FractalWorkspace.renderView(); });
    FractalWorkspace.renderView();
  }; ready();
})();\n`);
let html = fs.readFileSync(path.join(output, 'frontend/index.html'), 'utf8');
html = html.replace('<script src="./js/workspace.js"></script>', '<script src="../data/workspace-snapshot.js"></script>\n  <script src="./js/visual-test-data.js"></script>\n  <script src="./js/legacy-layout.js"></script>\n  <script src="./js/layout-candidates.js"></script>\n  <script>window.FractalLayout = window.LayoutCanopy;</script>\n  <script src="./js/workspace.js"></script>\n  <script src="./js/visual-test-controls.js"></script>');
html = html.replace('</head>', `<style>
  .test-layout-controls { display:flex; align-items:center; gap:5px; }
  .test-layout-controls>span { font-size:10px; font-weight:700; letter-spacing:1px; color:#56708c; margin-right:4px; }
  .test-layout-controls .button { font-size:12px; min-height:35px; padding:8px 10px; }
  .test-layout-controls [aria-pressed=true] { background:#163e67; color:white; border-color:#163e67; }
  .header-actions>[data-new-standard],.header-actions>[data-preferences] { display:none; }
  [data-open-file],[data-open-link],[data-update-standard],[data-delete-standard],[data-subgroup-photo],[data-new-product],[data-new-relation],[data-edit-relation],[data-delete-relation] { pointer-events:none!important; opacity:.5; }
  @media(max-width:1400px) { .test-layout-controls>span,.header-actions>.demo-badge {display:none;} .test-layout-controls .button{padding:8px;} }
  </style></head>`);
fs.writeFileSync(path.join(output, 'frontend/index.html'), html);
fs.writeFileSync(path.join(output, 'Abrir teste.html'), '<!doctype html><html lang="pt-BR"><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=frontend/index.html"><title>Fractal — teste visual</title><body><a href="frontend/index.html">Abrir teste visual do Fractal</a></body></html>');
fs.writeFileSync(path.join(output, 'LEIA-ME.md'), `# Fractal — comparação visual de motores de layout

Extraia o ZIP inteiro e abra **Abrir teste.html** no Edge ou Chrome. Não requer executável próprio, Python, Node, .NET, servidor ou instalação. Não abra o HTML de dentro do ZIP sem extrair.

Esta é uma prévia de visualização, **somente leitura**, com o snapshot validado do banco enviado (${snapshot.standards.length} normas, ${snapshot.subgroups.length} subgrupos e ${snapshot.relations.standard_standard_relations.length} relações). Não é a versão operacional do aplicativo no navegador. Não contém PDFs, não lê a pasta real e não salva cadastros ou alterações.

O seletor superior compara **Canopy** (motor escolhido), **Original** (layout 0.2.1), **Growth** (crescimento célula a célula) e **Envelope** (primeira alternativa por silhuetas). Os quatro usam o mesmo renderer atualizado. Portanto a seleção e o tratamento de texto já estão corrigidos também ao visualizar o layout Original; somente o posicionamento volta ao original.

- Arraste para mover; use a roda para aproximar; duplo clique ou Fit enquadra tudo.
- Os subgrupos e as famílias podem ser trocados normalmente. Pesquisa destaca uma norma e aproxima a visualização.
- No enquadramento de centenas de células, o texto muito pequeno é ocultado; aproximar revela os códigos e passar o mouse mostra código/título completos.
- As normas flutuantes continuam sem ligações inventadas. Cópias visuais de uma norma em vários caminhos continuam preservadas.
- Uma foto referenciada não foi fornecida com o banco; seu placeholder é esperado.
- Fechar a página descarta a navegação. O banco original não é acessado por esta prévia.

Esta pasta é um teste isolado: não substitui sua configuração nem seu banco comercial. Pode ser copiada sozinha para outro computador, mantendo todos os seus arquivos.

O snapshot somente de leitura está em **data/workspace-snapshot.js**. Os backups e os arquivos operacionais da pasta original StandardsWorkspaceData1 não fazem parte da prévia.
`);
console.log('PREVIEW ' + output); console.log('OPEN ' + pathToFileURL(path.join(output, 'Abrir teste.html')).href);
