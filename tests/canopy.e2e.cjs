'use strict';
// Read-only acceptance of the actual frontend. Input is a backend-validated
// snapshot from real-data-audit.cjs; registered PDFs are never needed/opened.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto'), { pathToFileURL } = require('node:url');
const { readVisualSnapshot } = require('../tools/visual-snapshot.cjs');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.BU2_NODE_MODULES || 'C:/Users/c4u42/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const project = path.resolve(__dirname, '..'), qa = path.join(project, 'artifacts/qa');
const { input, snapshotText, snapshot } = readVisualSnapshot(process.argv[2], project);
const output = path.join(qa, 'canopy-' + new Date().toISOString().replaceAll(':', '-')); fs.mkdirSync(output, { recursive: true });
const report = { input, snapshotSha256: crypto.createHash('sha256').update(snapshotText).digest('hex'), errors: [], forbiddenRequests: [], dialogs: 0, scenarios: [] };
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }); page.on('pageerror', e => report.errors.push(e.message)); page.on('dialog', d => { report.dialogs++; d.dismiss(); });
    await page.exposeBinding('__snapshot', (_, m) => { if (!['app.environment', 'workspace.get', 'workspace.validate'].includes(m.type)) { report.forbiddenRequests.push(m.type); throw Error('Read-only test: no writes or document opening.'); } return { id: m.id, ok: true, data: m.type === 'app.environment' ? { mode: 'production', data_root: input, config_path: 'Read-only graph acceptance' } : structuredClone(snapshot) }; });
    await page.addInitScript(() => { window.__MAHLE_FRACTAL_HOST__ = true; const listeners = []; window.chrome.webview = { addEventListener: (_, fn) => listeners.push(fn), postMessage: async m => { const reply = await window.__snapshot(m); listeners.forEach(fn => fn({ data: reply })); } }; });
    await page.route('https://fractal-data.mahle.invalid/**', r => r.fulfill({ status: 404, body: '' }));
    await page.goto(pathToFileURL(path.join(project, 'frontend/index.html')).href); await page.waitForFunction(() => FractalWorkspace.ready);
    const contexts = [...snapshot.subgroups.map(s => [s.id, s.name]), ['__all__', 'All standards'], ['__general__', 'General standards']];
    for (const [id, name] of contexts) for (const family of ['all', 'test', 'material', 'design']) {
      const families = family === 'all' ? ['test', 'material', 'design'] : [family];
      const result = await page.evaluate(({ id, families }) => {
        const app = FractalWorkspace; Object.assign(app.state, { product: id, families, islands: true, depth: 0, selected: null });
        const t = performance.now(); app.renderView(); const renderMs = performance.now() - t, r = app.renderer;
        if (!r.root) throw Error('Layout failed: ' + document.getElementById('toast').textContent);
        const nodes = r.nodes, logical = new Set(nodes.filter(n => n.standard_id).map(n => n.standard_id)), graph = new GraphModel(app.data), scope = graph.scope(id).ids;
        const missing = families.length === 3 ? [...scope].filter(id => !logical.has(id)) : [];
        const nativeMissing = [];
        for (const f of families) { const shown = new Set(nodes.filter(n => n.family === f).map(n => n.standard_id)); for (const id of scope) { const standard = graph.standards.get(id); if ((standard.classification.internal_category || standard.tree_entry.family) === f && !shown.has(id)) nativeMissing.push(id); } }
        const shownEdges = new Set(nodes.filter(n => n.parent?.standard_id).map(n => n.parent.standard_id + '|' + n.standard_id));
        const missingEdges = families.length === 3 ? app.data.relations.standard_standard_relations.filter(e => scope.has(e.source_standard_id) && scope.has(e.target_standard_id) && !shownEdges.has(e.source_standard_id + '|' + e.target_standard_id)).length : 0;
        let collisions = 0, minClearance = Infinity, wrongIdentity = 0, radialBackwards = 0, reversals = 0, curveBackwards = 0, maxTurn = 0;
        const lengths = [];
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const a = nodes[i], b = nodes[j], clearance = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r; minClearance = Math.min(minClearance, clearance); if (clearance < -.1) collisions++; }
        for (const n of nodes) {
          if (r.pick(n.x * r.scale + r.tx, n.y * r.scale + r.ty)?.standard_id !== n.standard_id) wrongIdentity++;
          if (!n.parent || n.floating || n.island) continue;
          const p = n.parent; if (Math.hypot(n.x, n.y) <= Math.hypot(p.x, p.y)) radialBackwards++;
          if (p.depth) { lengths.push(Math.hypot(n.x - p.x, n.y - p.y)); const turn = Math.abs(Math.atan2(Math.sin(n.direction - p.direction), Math.cos(n.direction - p.direction))) * 180 / Math.PI; maxTurn = Math.max(maxTurn, turn); if (turn > 90) reversals++; }
          const c = r.edgeCurve(n); let previous = Math.hypot(c[0], c[1]);
          for (let j = 1; j <= 50; j++) { const t = j / 50, s = 1 - t, x = s*s*s*c[0] + 3*s*s*t*c[2] + 3*s*t*t*c[4] + t*t*t*c[6], y = s*s*s*c[1] + 3*s*s*t*c[3] + 3*s*t*t*c[5] + t*t*t*c[7], radius = Math.hypot(x,y); if (radius < previous - .001) { curveBackwards++; break; } previous = radius; }
        }
        lengths.sort((a,b)=>a-b); r.render();
        return { renderMs, cells: nodes.length - 1, unique: logical.size, missing, nativeMissing, missingEdges, collisions, minClearance, wrongIdentity, radialBackwards, reversals, curveBackwards, maxTurn, medianEdge: lengths[Math.floor(lengths.length*.5)], p95Edge: lengths[Math.floor(lengths.length*.95)], scale: r.scale, finite: nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)), documentOverflow: document.documentElement.scrollWidth>innerWidth };
      }, { id, families });
      for (const field of ['collisions', 'wrongIdentity', 'radialBackwards', 'reversals', 'curveBackwards', 'missingEdges']) assert.equal(result[field], 0, name + '/' + family + ': ' + field);
      assert.ok(result.minClearance > 6.8, name + '/' + family + ': circles touch'); assert.deepEqual(result.missing, []); assert.deepEqual(result.nativeMissing, []); assert.ok(result.finite); assert.equal(result.documentOverflow, false);
      report.scenarios.push({ id, name, family, ...result });
      if (family === 'all') { await page.screenshot({ path: path.join(output, String(report.scenarios.length).padStart(2,'0') + '-' + name.replaceAll(/[^a-z0-9]/gi, '-') + '.png'), animations: 'disabled' }); console.log(JSON.stringify({ name, ...result })); }
      fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    }
    report.interaction = [];
    for (const [id, code] of [[snapshot.subgroups[0].id, 'ISO 554'], ['__all__', 'DIN EN 20187']]) {
      const target = await page.evaluate(({ id, code }) => {
        const app = FractalWorkspace; Object.assign(app.state, { product: id, families: ['test','material','design'], islands: true, depth: 0, selected: null }); app.renderView();
        const r = app.renderer, n = r.nodes.find(n => n.label.replaceAll(' ','') === code.replaceAll(' ','')); if (!n) throw Error('Missing click fixture ' + code);
        r.cameraTo({ scale: 1.2, tx: r.width / 2 - n.x * 1.2, ty: r.height * .48 - n.y * 1.2 }, false); r.render(); return { id: n.standard_id, code: n.label, x: r.width / 2, y: r.height * .48 };
      }, { id, code });
      const canvas = await page.locator('canvas').boundingBox(); await page.mouse.click(canvas.x + target.x, canvas.y + target.y);
      assert.equal(await page.evaluate(() => FractalWorkspace.state.selected), target.id); assert.equal(await page.locator('.standard-code').textContent(), target.code);
      await page.screenshot({ path: path.join(output, 'click-' + (id === '__all__' ? 'all' : 'oil') + '.png'), animations: 'disabled' });
      const fit = await page.evaluate(() => { const r = FractalWorkspace.renderer; r.select(null); r.fitToScreen(); r.render(); return { tx: r.tx, scale: r.scale }; });
      await page.mouse.move(canvas.x + 65, canvas.y + 165); await page.mouse.down(); await page.mouse.move(canvas.x + 135, canvas.y + 165, { steps: 5 }); await page.mouse.up();
      assert.ok(Math.abs(await page.evaluate(() => FractalWorkspace.renderer.tx) - fit.tx - 70) < 1);
      await page.locator('[data-family-focus="material"]').click(); assert.deepEqual(await page.evaluate(() => FractalWorkspace.state.families), ['material']);
      await page.locator('[data-family-all]').click(); assert.equal(await page.evaluate(() => FractalWorkspace.state.families.length), 3);
      const variants = [];
      for (const islands of [false, true]) for (const depth of [0, 2, 3]) {
        const v = await page.evaluate(({ islands, depth }) => { const app = FractalWorkspace; app.state.islands = islands; app.state.depth = depth; app.renderView(); const r = app.renderer; if (!r.root) throw Error('Variant failed'); return { islands, depth, cells: r.nodes.length, maxDepth: Math.max(...r.nodes.map(n=>n.depth)), finite: r.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)) }; }, { islands, depth });
        assert.ok(v.finite); if (depth) assert.ok(v.maxDepth <= depth); variants.push(v);
      }
      const island = await page.evaluate(() => { const app = FractalWorkspace; app.state.depth = 0; app.renderView(); const r = app.renderer, n = r.nodes.find(n=>n.island&&r.nodes.some(copy=>!copy.island&&copy.standard_id===n.standard_id)); r.select(n); r.render(); return { expected: r.nodes.filter(copy=>!copy.island&&copy.standard_id===n.standard_id).length, highlighted: r.relatedSelections.size }; });
      assert.ok(island.expected > 0); assert.equal(island.highlighted, island.expected);
      report.interaction.push({ id, actualClick: target, variants, island });
    }
    await page.locator('#global-search').fill('MATL-568'); await page.locator('#search-results [data-standard]').first().click(); assert.equal(await page.locator('.standard-code').textContent(), 'MATL-568');
    await page.setViewportSize({ width: 1366, height: 768 }); await page.evaluate(()=>{const app=FractalWorkspace;app.state.selected=null;app.renderView();app.renderer.render();}); await page.screenshot({ path: path.join(output, 'all-1366.png'), animations: 'disabled' });
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), false);
    assert.deepEqual(report.errors, []); assert.deepEqual(report.forbiddenRequests, []); assert.equal(report.dialogs, 0);
    report.passed = true; fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log('PASS canopy: 36 real-data layouts, full/native/edge coverage, clearance, outward curves, click targets, pan, family/depth/island/search controls, 1366px.\nOUTPUT ' + output);
  } finally { await browser.close(); }
})().catch(error => { report.failure = error.stack; fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.error(error); process.exitCode = 1; });
