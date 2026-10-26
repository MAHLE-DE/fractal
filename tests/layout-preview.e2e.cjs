'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { pathToFileURL } = require('node:url');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.BU2_NODE_MODULES || 'C:/Users/c4u42/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const artifacts = path.resolve(__dirname, '../artifacts');
const folder = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../html-preview');
const entry = process.argv[3] ? path.resolve(process.argv[3]) : path.join(folder, 'Abrir teste.html');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }), errors = [], network = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.url().startsWith('http')) network.push(r.url()); });
    await page.goto(pathToFileURL(entry).href);
    await page.waitForFunction(() => window.FractalWorkspace?.ready && document.querySelectorAll('[data-test-engine]').length === 4);
    assert.equal(await page.evaluate(() => FractalWorkspace.data.standards.length), 692);
    assert.equal(await page.locator('[data-test-engine="canopy"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => FractalWorkspace.renderer.root.layoutDiagnostics.engine), 'silhouette-canopy');
    for (const engine of ['legacy', 'growth', 'envelope', 'canopy']) {
      await page.locator('[data-test-engine="' + engine + '"]').click();
      assert.equal(await page.locator('[data-test-engine="' + engine + '"]').getAttribute('aria-pressed'), 'true');
      assert.ok(await page.evaluate(() => FractalWorkspace.renderer.nodes.length > 500));
    }
    const blocked = await page.evaluate(() => new Promise(resolve => { chrome.webview.addEventListener('message', e => { if (e.data.id === 'forbidden-test') resolve(e.data); }); chrome.webview.postMessage({ id: 'forbidden-test', type: 'standard.save', payload: {} }); }));
    assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'visual_test');
    assert.equal(await page.evaluate(() => FractalWorkspace.data.standards.length), 692);
    const screenshots = path.join(artifacts, 'qa'); fs.mkdirSync(screenshots, { recursive: true });
    await page.screenshot({ path: path.join(screenshots, 'layout-preview.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 1366, height: 768 }); await page.evaluate(()=>FractalWorkspace.renderer.fitToScreen());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    console.log('PASS portable HTML: 692 real standards, 4 engines, offline assets, read-only transport, no external requests/errors, responsive.\nPREVIEW ' + folder);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
