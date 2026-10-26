'use strict';
// Read-only comparison. No file access is requested for registered standards.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { pathToFileURL } = require('node:url');
const { readVisualSnapshot } = require('../tools/visual-snapshot.cjs');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.BU2_NODE_MODULES || 'C:/Users/c4u42/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const project = path.resolve(__dirname, '..'), qa = path.join(project, 'artifacts/qa');
const { snapshot } = readVisualSnapshot(process.argv[2], project), output = path.join(project, 'artifacts/qa/layout-engines-' + new Date().toISOString().replaceAll(':', '-'));
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }), report = { errors: [], scenarios: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }); page.on('pageerror', e => report.errors.push(e.message));
    await page.exposeBinding('__snapshot', (_, m) => ({ id: m.id, ok: true, data: m.type === 'app.environment' ? { mode: 'production', data_root: 'Isolated experiment', config_path: 'Read-only' } : structuredClone(snapshot) }));
    await page.addInitScript(() => { window.__MAHLE_FRACTAL_HOST__ = true; const listeners = []; window.chrome.webview = { addEventListener: (_, fn) => listeners.push(fn), postMessage: async m => { if (!['workspace.get', 'workspace.validate', 'app.environment'].includes(m.type)) throw Error('Read-only test'); const response = await window.__snapshot(m); listeners.forEach(fn => fn({ data: response })); } }; });
    await page.route('https://fractal-data.mahle.invalid/**', r => r.fulfill({ status: 404, body: '' }));
    await page.goto(pathToFileURL(path.join(project, 'frontend/index.html')).href); await page.waitForFunction(() => FractalWorkspace.ready);
    await page.evaluate(() => { window.ProductionFractalLayout = FractalLayout; });
    await page.addScriptTag({ path: path.join(__dirname, 'fixtures/layout-legacy-0.2.1.js') });
    await page.addScriptTag({ path: path.join(__dirname, 'fixtures/layout-candidates.js') });
    await page.evaluate(() => { LayoutCandidates.legacy = LegacyFractalLayout; LayoutCandidates.canopy = ProductionFractalLayout; });
    const engines = (process.env.BU2_LAYOUTS || 'legacy,sector-growth,adaptive-growth,branch-envelope,canopy').split(',');
    for (const engine of engines) for (const id of [snapshot.subgroups[0].id, '__all__']) {
      const metrics = await page.evaluate(({ engine, id }) => {
        const app = FractalWorkspace; app.state.product = id; app.state.families = ['test', 'material', 'design']; app.state.depth = 0; app.state.islands = true; app.state.selected = null;
        const start = performance.now(), model = new GraphModel(app.data).expand(id), tree = new LayoutCandidates[engine]().build(model); window.FractalLayout = class { build() { return tree; } }; app.renderView(); const renderMs = performance.now() - start, r = app.renderer, nodes = r.nodes, edges = nodes.filter(n => n.parent && !n.island && !n.floating); let collisions = 0, wrongIdentity = 0, radialBackwards = 0, reversals = 0;
        const lengths = [], turns = []; let curvesBackwards = 0;
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < nodes[i].r + nodes[j].r - .1) collisions++;
        for (const n of edges) { const p = n.parent; if (Math.hypot(n.x, n.y) <= Math.hypot(p.x, p.y)) radialBackwards++; if (p.depth) { lengths.push(Math.hypot(n.x - p.x, n.y - p.y)); const turn = Math.abs(Math.atan2(Math.sin(n.direction - p.direction), Math.cos(n.direction - p.direction))); turns.push(turn * 180 / Math.PI); if (turn > Math.PI / 2) reversals++; } const c = r.edgeCurve(n); let previous = Math.hypot(c[0], c[1]); for (let j = 1; j <= 50; j++) { const t = j / 50, s = 1 - t, x = s*s*s*c[0] + 3*s*s*t*c[2] + 3*s*t*t*c[4] + t*t*t*c[6], y = s*s*s*c[1] + 3*s*s*t*c[3] + 3*s*t*t*c[5] + t*t*t*c[7], radius = Math.hypot(x,y); if (radius < previous - .001) { curvesBackwards++; break; } previous = radius; } }
        for (const n of nodes) if (r.pick(n.x * r.scale + r.tx, n.y * r.scale + r.ty)?.standard_id !== n.standard_id) wrongIdentity++;
        lengths.sort((a, b) => a - b); turns.sort((a, b) => a - b);
        return { engine, id, renderMs, cells: nodes.length - 1, unique: new Set(nodes.filter(n => n.standard_id).map(n => n.standard_id)).size, collisions, wrongIdentity, radialBackwards, reversals, curvesBackwards, edgeLength: { median: lengths[Math.floor(lengths.length * .5)], p95: lengths[Math.floor(lengths.length * .95)], max: lengths.at(-1) }, turnDegrees: { p95: turns[Math.floor(turns.length * .95)], max: turns.at(-1) }, scale: r.scale, extent: { width: Math.max(...nodes.map(n => n.x + n.r)) - Math.min(...nodes.map(n => n.x - n.r)), height: Math.max(...nodes.map(n => n.y + n.r)) - Math.min(...nodes.map(n => n.y - n.r)) } };
      }, { engine, id });
      const prefix = engine + (id === '__all__' ? '-all' : '-oil');
      await page.screenshot({ path: path.join(output, prefix + '.png'), animations: 'disabled' });
      const focus = await page.evaluate(() => { const r = FractalWorkspace.renderer, n = r.nodes.find(n => n.label === 'MATL-568' && !n.island); r.select(n); r.cameraTo({ scale: 1, tx: r.width / 2 - n.x, ty: r.height * .55 - n.y }, false); r.render(); return n.children.length; });
      await page.screenshot({ path: path.join(output, prefix + '-focus.png'), animations: 'disabled' });
      report.scenarios.push({ ...metrics, highDegree: focus }); console.log(JSON.stringify(metrics)); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    }
    assert.deepEqual(report.errors, []); console.log('OUTPUT ' + output);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
