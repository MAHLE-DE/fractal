'use strict';
// Actual JSON repository through an isolated test transport. Native file pickers
// and shell launching are stubs; persistence, schema, transactions and conflicts are real.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { spawn } = require('node:child_process'), readline = require('node:readline'), { pathToFileURL } = require('node:url');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.BU2_NODE_MODULES || 'C:/Users/c4u42/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'Fractal-UI-Tests-'));
  const sdk = process.env.BU2_DOTNET || 'C:/PC/site/_app/.tools/dotnet/dotnet.exe';
  const worker = spawn(sdk, [path.resolve(__dirname, 'data/bin/Release/net10.0/Fractal.Data.Tests.dll'), 'bridge',root], { windowsHide: true });
  const pending = new Map(), lines = readline.createInterface({ input: worker.stdout });
  lines.on('line', line => { const message = JSON.parse(line); pending.get(message.id)?.(message); pending.delete(message.id); });
  worker.stderr.on('data', data => process.stderr.write(data));
  const request = message => new Promise(resolve => { pending.set(message.id,resolve); worker.stdin.write(JSON.stringify(message)+'\n'); });
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const errors = []; let dialogs=0;
    const page = await browser.newPage({viewport:{width:1600,height:1000}});
    page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>{dialogs++;d.dismiss();});
    await page.exposeBinding('__repositoryRequest', async (_,message)=>request(message));
    await page.addInitScript(() => {
      window.__MAHLE_FRACTAL_HOST__=true; const listeners=[];
      window.chrome.webview={addEventListener:(_,fn)=>listeners.push(fn),postMessage:async message=>{const response=await window.__repositoryRequest(message);listeners.forEach(fn=>fn({data:response}));}};
      window.testRequest=message=>new Promise(resolve=>{const id=crypto.randomUUID(); const listener=e=>{if(e.data.id===id)resolve(e.data);};window.chrome.webview.addEventListener('message',listener);window.chrome.webview.postMessage({...message,id});});
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../frontend/index.html')).href); await page.waitForFunction(()=>FractalWorkspace.ready);
    assert.equal(await page.evaluate(()=>FractalWorkspace.data.standards.length),0);
    await page.locator('[data-view="products"]').click(); await page.locator('[data-new-product]').click();
    await page.locator('[name=name]').fill('Functional oil filter subgroup'); await page.locator('[name=group]').first().check(); await page.locator('[name=description]').fill('Real persistent subgroup');
    await page.locator('dialog [type=submit]').click(); await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
    assert.equal(fs.readdirSync(path.join(root,'subgroups')).length,1);
    await page.locator('[data-subgroup-photo]').click(); await page.waitForFunction(()=>!!FractalWorkspace.data.subgroups[0].image_url);
    assert.equal(fs.readdirSync(path.join(root,'images',await page.evaluate(()=>FractalWorkspace.data.subgroups[0].id))).length,1);
    await page.locator('[data-new-standard]').click(); await page.locator('[name=document_no]').fill('TEST-REAL'); await page.locator('[name=revision_no]').fill('01.0'); await page.locator('[name=title]').fill('Real registered document');
    await page.locator('[name=subgroup]').first().check(); await page.locator('#pick-standard-file').click(); await page.waitForFunction(()=>document.querySelector('#picked-file-name').textContent==='test-document.pdf');
    await page.locator('[name=online_url]').fill('https://example.org/standard'); await page.locator('dialog [type=submit]').click(); await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
    assert.equal(fs.readdirSync(path.join(root,'standards')).length,1);
    await page.reload(); await page.waitForFunction(()=>FractalWorkspace.ready && FractalWorkspace.data.standards.length===1);
    const id=await page.evaluate(()=>FractalWorkspace.data.standards[0].id);
    await page.evaluate(id=>FractalWorkspace.renderer.selectStandard(id),id);
    assert.equal(await page.locator('[data-open-file]').isEnabled(),true); assert.equal(await page.locator('[data-open-link]').isEnabled(),true);
    await page.locator('[data-update-standard]').click();
    assert.equal(await page.locator('dialog').evaluate(d=>getComputedStyle(d,'::backdrop').backdropFilter),'none');
    await page.locator('[name=title]').fill('Unsaved local edit');
    const external=await page.evaluate(async id=>{const original=structuredClone(FractalWorkspace.data.standards.find(s=>s.id===id)); original.identification.title='Saved by another editor';return await testRequest({type:'standard.save',payload:{record:original,expected_etag:original._etag}});},id);
    assert.equal(external.ok,true); await page.locator('dialog [type=submit]').click(); await page.waitForFunction(()=>document.querySelector('.form-error')?.textContent.includes('Another user'));
    assert.equal(await page.locator('[name=title]').inputValue(),'Unsaved local edit');
    assert.ok(JSON.parse(fs.readFileSync(path.join(root,'standards',id+'.json'),'utf8')).identification.title==='Saved by another editor');
    await page.locator('.conflict-actions button').click(); assert.equal(await page.locator('dialog[open]').count(),2);
    await page.locator('dialog[open]').last().locator('[data-close]').click(); await page.locator('dialog[open] [data-close]').click();
    await page.locator('[data-preferences]').click(); await page.locator('#begin-maintenance').click(); await page.waitForFunction(()=>FractalWorkspace.data.maintenance?.active);
    const blocked=await page.evaluate(id=>testRequest({type:'standard.save',payload:{record:FractalWorkspace.data.standards.find(s=>s.id===id),expected_etag:FractalWorkspace.data.standards[0]._etag}}),id); assert.equal(blocked.error.code,'maintenance');
    await page.locator('#end-maintenance').click(); await page.waitForFunction(()=>!FractalWorkspace.data.maintenance.active); await page.locator('dialog[open] [data-close]').click();
    await page.locator('[data-new-standard]').click(); await page.locator('[name=document_no]').fill('GLOBAL-ONE'); await page.locator('[name=revision_no]').fill('2'); await page.locator('[name=title]').fill('General cross-subgroup reference');
    await page.locator('[name=is_general]').check(); await page.locator('#pick-standard-file').click(); await page.waitForFunction(()=>document.querySelector('#picked-file-name').textContent==='test-document.pdf');
    await page.locator('dialog [type=submit]').click(); await page.waitForFunction(()=>FractalWorkspace.data.standards.length===2);
    await page.locator('[data-new-relation]').click(); await page.locator('dialog [type=submit]').click(); await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
    assert.equal(await page.evaluate(()=>FractalWorkspace.data.relations.standard_standard_relations.length),1);
    await page.locator('[data-view="explorer"]').click(); await page.locator('#product-picker').click(); await page.locator('[data-product="__all__"]').click();
    assert.equal(await page.evaluate(()=>new Set(FractalWorkspace.renderer.nodes.filter(n=>n.standard_id).map(n=>n.standard_id)).size),2);
    await page.screenshot({path:path.resolve(__dirname,'../artifacts/qa/09-production-shared-json.png')});
    assert.equal(dialogs,0); assert.deepEqual(errors,[]);
    console.log('PASS real repository + UI: empty production, subgroup, photo, native document reference, persistence after reload, online action, conflict form preservation, maintenance and automatic roots.');
    console.log('Isolated data: '+root);
  } finally { await browser.close(); worker.stdin.end(); lines.close(); worker.kill(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
