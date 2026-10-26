'use strict';
// Read-only follow-up using the snapshot already validated by the real backend.
// Historical 0.2.1 failure reproducer; expects the original layout/renderer.
// For post-fix acceptance run canopy.e2e.cjs instead.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(require.resolve('playwright',{paths:[process.env.BU2_NODE_MODULES||'C:/Users/c4u42/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules']}));
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]||'');
if(!output.startsWith(path.join(root,'artifacts')+path.sep))throw Error('Pass an isolated artifacts/qa/real-data-* folder.');
const snapshot=JSON.parse(fs.readFileSync(path.join(output,'snapshot.json'),'utf8'));
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true}),report={errors:[],cases:[]};
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
    await page.exposeBinding('__snapshot',(_,m)=>({id:m.id,ok:true,data:m.type==='app.environment'?{mode:'production',data_root:output,config_path:'Read-only diagnostic'}:structuredClone(snapshot)}));
    await page.addInitScript(()=>{window.__MAHLE_FRACTAL_HOST__=true;const listeners=[];window.chrome.webview={addEventListener:(_,fn)=>listeners.push(fn),postMessage:async m=>{if(!['app.environment','workspace.get','workspace.validate'].includes(m.type))throw Error('Writes and document opening are forbidden in this test.');const response=await window.__snapshot(m);listeners.forEach(fn=>fn({data:response}));}};});
    await page.route('https://fractal-data.mahle.invalid/**',route=>route.fulfill({status:404,body:''}));
    await page.goto(pathToFileURL(path.join(root,'frontend/index.html')).href);await page.waitForFunction(()=>FractalWorkspace.ready);
    for(const id of [snapshot.subgroups[0].id,'__all__']){
      const geometry=await page.evaluate(id=>{
        const app=FractalWorkspace;app.state.product=id;app.state.families=['test','material','design'];app.state.depth=0;app.state.islands=true;app.state.selected=null;app.renderView();
        const r=app.renderer,nodes=r.nodes;let collisions=0;const overlapKinds={},samples=[];
        for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
          const a=nodes[i],b=nodes[j],gap=Math.hypot(a.x-b.x,a.y-b.y)-a.r-b.r;if(gap<-.1){collisions++;const key=a.island||b.island?'involving-island':a.family===b.family?'same-sector':'cross-sector';overlapKinds[key]=(overlapKinds[key]||0)+1;if(samples.length<8)samples.push({a:a.label,b:b.label,overlap:-gap});}
        }
        const hit=[];const fit=r.scale;
        for(const scale of [fit,1,2.8]){r.scale=scale;const wrong=nodes.filter(n=>n.standard_id&&r.pick(n.x*scale+r.tx,n.y*scale+r.ty)?.standard_id!==n.standard_id);hit.push({scale,wrongIdentity:wrong.length,cells:nodes.length-1});}
        r.scale=fit;return{id,collisions,overlapKinds,samples,hit};
      },id);
      const target=await page.evaluate(()=>{
        const r=FractalWorkspace.renderer,scale=1.2;
        const n=r.nodes.find(n=>n.standard_id&&n.depth>1&&!n.island&&r.nodes.slice().reverse().find(other=>Math.hypot(other.x-n.x,other.y-n.y)<=other.r+3/scale)?.standard_id!==n.standard_id);
        if(!n)return null;
        r.select(null);r.cameraTo({scale,tx:r.width*.5-n.x*scale,ty:r.height*.48-n.y*scale},false);r.render();
        return{wanted:n.label,predicted:r.pick(r.width*.5,r.height*.48)?.label,wantedId:n.standard_id,x:r.width*.5,y:r.height*.48};
      });
      if(target){
        const canvas=await page.locator('canvas').boundingBox();await page.mouse.click(canvas.x+target.x,canvas.y+target.y);
        const selected=await page.locator('.standard-code').textContent();
        assert.equal(selected,target.predicted);assert.notEqual(selected,target.wanted);
        geometry.actualMouseClick={...target,selected};
        await page.screenshot({path:path.join(output,(id==='__all__'?'39':'38')+'-wrong-selection-at-120-percent.png'),animations:'disabled'});
      }
      const star=await page.evaluate(()=>{
        const r=FractalWorkspace.renderer,n=r.nodes.find(n=>n.label==='MATL-568'&&!n.island);
        if(!n)return null;r.select(n);r.cameraTo({scale:1.2,tx:r.width*.5-n.x*1.2,ty:r.height*.48-n.y*1.2},false);r.render();
        return{code:n.label,children:n.children.length,family:n.family};
      });
      geometry.highDegree=star;if(star)await page.screenshot({path:path.join(output,(id==='__all__'?'41':'40')+'-matl-568-high-degree.png'),animations:'disabled'});
      const manual=await page.evaluate(()=>{
        const app=FractalWorkspace;app.state.selected=null;app.renderView();return {families:app.state.families};
      });
      await page.locator('[data-family-focus="material"]').click();
      assert.deepEqual(await page.evaluate(()=>FractalWorkspace.state.families),['material']);
      await page.locator('[data-family-all]').click();assert.equal(await page.evaluate(()=>FractalWorkspace.state.families.length),3);
      geometry.familyButtonsPassed=true;
      await page.locator('#view-options').click();await page.locator('[data-depth="2"]').click();await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(()=>FractalWorkspace.renderer.nodes.every(n=>n.depth<=2)));
      const before=await page.evaluate(()=>FractalWorkspace.renderer.tx),canvas=await page.locator('canvas').boundingBox();
      await page.mouse.move(canvas.x+70,canvas.y+180);await page.mouse.down();await page.mouse.move(canvas.x+140,canvas.y+180,{steps:5});await page.mouse.up();
      assert.ok(Math.abs(await page.evaluate(()=>FractalWorkspace.renderer.tx)-before-70)<1);
      geometry.panAndDepthPassed=true;
      // Restore full expansion and then use the actual search field to focus a reference.
      await page.locator('#view-options').click();await page.locator('[data-depth="0"]').click();await page.keyboard.press('Escape');
      await page.locator('#global-search').fill('MATL-568');await page.locator('#search-results [data-standard]').first().click();
      assert.equal(await page.locator('.standard-code').textContent(),'MATL-568');geometry.searchPassed=true;
      geometry.displayVariants=[];
      for(const islands of [true,false])for(const depth of [0,2,3]){
        const variant=await page.evaluate(({id,islands,depth})=>{const app=FractalWorkspace;app.state.product=id;app.state.families=['test','material','design'];app.state.depth=depth;app.state.islands=islands;app.state.selected=null;const start=performance.now();app.renderView();const r=app.renderer;return{islands,depth,renderMs:performance.now()-start,cells:r.nodes.length-1,unique:new Set(r.nodes.filter(n=>n.standard_id).map(n=>n.standard_id)).size,scale:r.scale,maxDepth:Math.max(...r.nodes.map(n=>n.depth)),finite:r.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y))};},{id,islands,depth});
        assert.ok(variant.finite);if(depth)assert.ok(variant.maxDepth<=depth);geometry.displayVariants.push(variant);
      }
      const island=await page.evaluate(id=>{const app=FractalWorkspace;app.state.product=id;app.state.families=['test','material','design'];app.state.depth=0;app.state.islands=true;app.state.selected=null;app.renderView();const r=app.renderer;const island=r.nodes.find(n=>n.island&&r.nodes.some(copy=>!copy.island&&copy.standard_id===n.standard_id));if(!island)return null;r.select(island);r.render();return{code:island.label,expected:r.nodes.filter(n=>!n.island&&n.standard_id===island.standard_id).length,highlighted:r.relatedSelections.size};},id);
      assert.ok(island&&island.expected>0&&island.expected===island.highlighted);geometry.islandHighlight=island;
      report.cases.push(geometry);console.log(JSON.stringify(geometry));
    }
    assert.deepEqual(report.errors,[]);
    fs.writeFileSync(path.join(output,'interaction.json'),JSON.stringify(report,null,2));
    console.log('INTERACTION REPORT '+path.join(output,'interaction.json'));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
