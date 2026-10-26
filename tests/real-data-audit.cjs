'use strict';
// Diagnostic only. Never points the application repository at the submitted data.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto'), readline = require('node:readline'), { spawn } = require('node:child_process'), { performance } = require('node:perf_hooks');
const project = path.resolve(__dirname, '..'), source = path.resolve(process.argv[2] || path.join(project, 'StandardsWorkspaceData1'));
const output = path.join(project, 'artifacts', 'qa', 'real-data-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(output, { recursive: true }); const copied = path.join(output, 'database');
if (!fs.existsSync(source) || copied === source || copied.startsWith(source + path.sep)) throw Error('Unsafe or missing source folder.');
function fingerprints(dir, prefix = '') { return Object.fromEntries(fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => { const file = path.join(dir,e.name), name = prefix + e.name; return e.isDirectory() ? Object.entries(fingerprints(file,name+'/')) : [[name,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]]; })); }
const before = fingerprints(source); fs.cpSync(source,copied,{recursive:true,errorOnExist:true});
const json = file => JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const raw = { schema_version:'2.0', preview_only:false, standards:fs.readdirSync(path.join(copied,'standards')).filter(f=>f.endsWith('.json')).sort().map(f=>json(path.join(copied,'standards',f))), subgroups:fs.readdirSync(path.join(copied,'subgroups')).filter(f=>f.endsWith('.json')).sort().map(f=>json(path.join(copied,'subgroups',f))), taxonomy:{product_groups:json(path.join(copied,'groups.json')).groups}, relations:json(path.join(copied,'relations.json')) };
const context = vm.createContext({window:{},console});
for(const name of ['demo-data.js','graph/graph-model.js','graph/organic-layout.js']) vm.runInContext(fs.readFileSync(path.join(project,'frontend','js',name),'utf8'),context);
const {GraphModel,FractalLayout} = context.window, flatten = node => [node,...node.children.flatMap(flatten)];
const counts = rows => rows.reduce((o,key)=>(o[key]=(o[key]||0)+1,o),{});
const round = value => Math.round(value*100)/100;
const standardById = new Map(raw.standards.map(s=>[s.id,s]));
const code = id => standardById.get(id)?.identification.document_no || id;
const edges = raw.relations.standard_standard_relations;
const groupsByPair = new Map(); for(const r of edges) {const key=r.source_standard_id+'|'+r.target_standard_id;if(!groupsByPair.has(key))groupsByPair.set(key,[]);groupsByPair.get(key).push(r.id);}
const no = new Map(); for(const s of raw.standards) {const key=s.identification.document_no.toLowerCase();if(!no.has(key))no.set(key,[]);no.get(key).push(s.id);}
const graph = new GraphModel(raw), incident = new Set(edges.flatMap(r=>[r.source_standard_id,r.target_standard_id]));
// Independent SCC analysis for an explanation of large return-reference regions.
let serial=0; const indices=new Map(),low=new Map(),active=new Set(),stack=[],components=[];
function connect(id) {indices.set(id,serial);low.set(id,serial++);stack.push(id);active.add(id);for(const r of graph.outgoing.get(id)||[]) {const to=r.target_standard_id;if(!indices.has(to)){connect(to);low.set(id,Math.min(low.get(id),low.get(to)));}else if(active.has(to))low.set(id,Math.min(low.get(id),indices.get(to)));}if(low.get(id)===indices.get(id)){const component=[];let to;do{to=stack.pop();active.delete(to);component.push(to);}while(to!==id);components.push(component);}}
for(const id of graph.standards.keys()) if(!indices.has(id))connect(id);
const report = { testedAt:new Date().toISOString(), sourceCommit:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8'}).trim(), source, output, database:copied,
  inventory:{standards:raw.standards.length,subgroups:raw.subgroups.length,relations:edges.length,rootHints:raw.relations.subgroup_standard_relations.length,generalStandards:raw.standards.filter(s=>s.applicability.is_general).length,byFamily:counts(raw.standards.map(s=>s.classification.internal_category||s.tree_entry?.family)),byOrigin:counts(raw.standards.map(s=>s.classification.origin)),unlinked:raw.standards.filter(s=>!incident.has(s.id)).length,documentReferences:raw.standards.filter(s=>s.document_location.file_path).length,missingSubgroupImages:raw.subgroups.filter(s=>s.image_path&&!fs.existsSync(path.join(copied,s.image_path))).map(s=>s.name)},
  integrity:{duplicateCodes:[...no].filter(([,ids])=>ids.length>1),duplicatePairs:[...groupsByPair].filter(([,ids])=>ids.length>1),selfEdges:edges.filter(r=>r.source_standard_id===r.target_standard_id),brokenEdges:edges.filter(r=>!standardById.has(r.source_standard_id)||!standardById.has(r.target_standard_id)),familyMetadataMismatch:raw.standards.filter(s=>s.classification.internal_category&&s.classification.internal_category!==s.tree_entry?.family).map(s=>s.identification.document_no)},
  cycles:components.filter(c=>c.length>1).sort((a,b)=>b.length-a.length).map(ids=>({size:ids.length,codes:ids.map(code).sort()})),
  highestOutdegree:[...graph.outgoing].sort((a,b)=>b[1].length-a[1].length).slice(0,15).map(([id,rows])=>({code:code(id),citations:rows.length})),scenarios:[] };
fs.writeFileSync(path.join(output,'source-fingerprints.json'),JSON.stringify(before,null,2));
const sdk = process.env.BU2_DOTNET || 'C:/PC/site/_app/.tools/dotnet/dotnet.exe';
const worker = spawn(sdk,[path.join(project,'tests/data/bin/Release/net10.0/Fractal.Data.Tests.dll'),'bridge',copied],{windowsHide:true});
const pending=new Map(); const lines=readline.createInterface({input:worker.stdout});
lines.on('line',line=>{try{const message=JSON.parse(line);const request=pending.get(message.id);if(request){clearTimeout(request.timer);request.resolve(message);pending.delete(message.id);}}catch(e){console.error('Test transport:',line);}});
worker.stderr.on('data',d=>process.stderr.write(d));
worker.on('exit',exit=>{for(const value of pending.values()){clearTimeout(value.timer);value.reject(Error('Test repository exited '+exit));}pending.clear();});
function request(type,payload={}){return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('Repository response timeout: '+type));},30000);pending.set(id,{resolve,reject,timer});worker.stdin.write(JSON.stringify({id,type,payload})+'\n');});}
function analyze(id,name,families,depth=0,islands=true) {
  const t0=performance.now(), root=graph.expand(id,{families,depth,islands}), t1=performance.now(); new FractalLayout().build(root); const t2=performance.now();
  const nodes=flatten(root), logical=new Set(nodes.filter(n=>n.standard_id).map(n=>n.standard_id)), scope=graph.scope(id), shownEdges=new Set(nodes.filter(n=>n.parent?.standard_id).map(n=>n.parent.standard_id+'|'+n.standard_id));
  const filtered=families.length!==3||depth!==0||!islands, missing=filtered?[]:[...scope.ids].filter(id=>!logical.has(id));
  const nativeMissing=[]; for(const family of families) {const visible=new Set(nodes.filter(n=>n.family===family).map(n=>n.standard_id));for(const id of scope.ids){const s=standardById.get(id);if((s.classification.internal_category||s.tree_entry?.family)===family&&!visible.has(id))nativeMissing.push(code(id));}}
  const overlaps=[], clearances=[];let collisionCount=0,bufferCollisionCount=0;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++) {const a=nodes[i],b=nodes[j],distance=Math.hypot(a.x-b.x,a.y-b.y),clearance=distance-a.r-b.r;if(clearance<6.8)bufferCollisionCount++;if(clearance<-.1){collisionCount++;if(overlaps.length<20)overlaps.push({a:a.label,b:b.label,depthA:a.depth,depthB:b.depth,overlap:round(-clearance),familyA:a.family,familyB:b.family});}}
  const extent={width:round(Math.max(...nodes.map(n=>n.x+n.r))-Math.min(...nodes.map(n=>n.x-n.r))),height:round(Math.max(...nodes.map(n=>n.y+n.r))-Math.min(...nodes.map(n=>n.y-n.r)))};
  const expectedEdges=edges.filter(r=>scope.ids.has(r.source_standard_id)&&scope.ids.has(r.target_standard_id));
  const applicable=s=>id==='__all__'||s.applicability.is_general||id!=='__general__'&&s.applicability.product_subgroup_ids.includes(id);
  const result={id,name,families:[...families],depth,islands,timing:{modelMs:round(t1-t0),layoutMs:round(t2-t1)},unique:logical.size,cells:nodes.length-1,repeatFactor:round((nodes.length-1)/logical.size),maxDepth:root.layoutDiagnostics.maxDepth,cycles:nodes.filter(n=>n.cycle).length,collapsed:nodes.filter(n=>n.collapsedReference).length,entries:root.children.filter(n=>!n.island&&!n.floating).length,floating:root.children.filter(n=>n.disconnected&&!n.island).length,islandAppearances:root.children.filter(n=>n.island).length,coverage:root.coverage,missing:missing.map(code),nativeMissing:depth===0?nativeMissing:[],missingEdges:filtered?[]:expectedEdges.filter(r=>!shownEdges.has(r.source_standard_id+'|'+r.target_standard_id)).map(r=>code(r.source_standard_id)+' → '+code(r.target_standard_id)),applicableSeeds:raw.standards.filter(applicable).length,outsideApplicability:[...scope.ids].filter(key=>!applicable(standardById.get(key))).length,collisions:collisionCount,bufferCollisions:bufferCollisionCount,overlaps,extent,highestRepeats:Object.entries(counts(nodes.filter(n=>n.standard_id).map(n=>n.standard_id))).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([id,appearances])=>({code:code(id),appearances})),rootCodes:root.children.filter(n=>!n.island).map(n=>({code:n.label,family:n.family,floating:n.floating}))};
  report.scenarios.push(result); return result;
}
(async()=>{
  try {
    const start=performance.now(), loaded=await request('workspace.get'); report.backend={ok:loaded.ok,loadMs:round(performance.now()-start),error:loaded.error};
    if(loaded.ok)fs.writeFileSync(path.join(output,'snapshot.json'),JSON.stringify(loaded.data));
    report.backend.warmLoadsMs=[];
    if(loaded.ok)for(let i=0;i<3;i++){const t=performance.now();await request('workspace.get');report.backend.warmLoadsMs.push(round(performance.now()-t));}
    console.log('Inventory',JSON.stringify(report.inventory)); console.log('Backend',JSON.stringify(report.backend));
    const selections=[...raw.subgroups.map(s=>[s.id,s.name]),['__all__','All standards'],['__general__','General standards']];
    if(process.env.BU2_REAL_BROWSER_ONLY!=='1')for(const [id,name] of selections) {
      for(const families of [['test','material','design'],['test'],['material'],['design']]) {
        const s=analyze(id,name,families); console.log(JSON.stringify({name,families,unique:s.unique,cells:s.cells,maxDepth:s.maxDepth,entries:s.entries,floating:s.floating,collapsed:s.collapsed,cycles:s.cycles,collisions:s.collisions,modelMs:s.timing.modelMs,layoutMs:s.timing.layoutMs,extent:s.extent,missing:s.missing.length,nativeMissing:s.nativeMissing.length,missingEdges:s.missingEdges.length}));
      }
    }
    if(process.env.BU2_REAL_BROWSER==='1' && loaded.ok) {
      const {chromium}=require(require.resolve('playwright',{paths:[process.env.BU2_NODE_MODULES||'C:/Users/c4u42/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules']}));
      const browser=await chromium.launch({channel:'msedge',headless:true});
      report.browser={errors:[],scenarios:[],forbiddenOperations:[],domDialogs:0};
      try {
        const page=await browser.newPage({viewport:{width:1600,height:1000}}); page.setDefaultTimeout(30000); page.on('pageerror',e=>report.browser.errors.push(e.message));page.on('dialog',d=>{report.browser.domDialogs++;d.dismiss();});
        await page.exposeBinding('__readOnlyRepository',async(_,message)=>{
          if(message.type==='app.environment')return{id:message.id,ok:true,data:{data_root:copied,config_path:'Isolated real-data test',mode:'production'}};
          if(!['workspace.get','workspace.validate'].includes(message.type)){report.browser.forbiddenOperations.push(message.type);return{id:message.id,ok:false,error:{message:'Read-only diagnostic: file opening and all writes are disabled.'}};}
          const result=await request(message.type,message.payload);return{...result,id:message.id};
        });
        await page.addInitScript(()=>{window.__MAHLE_FRACTAL_HOST__=true;const listeners=[];window.chrome.webview={addEventListener:(_,fn)=>listeners.push(fn),postMessage:async m=>{const response=await window.__readOnlyRepository(m);listeners.forEach(fn=>fn({data:response}));}};});
        await page.route('https://fractal-data.mahle.invalid/**',route=>route.fulfill({status:404,body:''}));
        await page.goto(require('node:url').pathToFileURL(path.join(project,'frontend/index.html')).href);
        await page.waitForFunction(()=>window.FractalWorkspace?.ready,{},{timeout:45000});
        for(const [id,name] of selections) {
          for(const family of ['all','test','material','design']) {
            const families=family==='all'?['test','material','design']:[family];
            const metrics=await page.evaluate(({id,families})=>{const app=FractalWorkspace;app.state.product=id;app.state.families=families;app.state.depth=0;app.state.islands=true;app.state.selected=null;const start=performance.now();app.renderView();const renderViewMs=performance.now()-start,r=app.renderer,c=r.ctx,nodes=r.nodes.filter(n=>n.standard_id);let wrongNode=0,wrongIdentity=0;const examples=[];const fonts=nodes.map(n=>{const fs=Math.min(11,n.r*.45);let size=fs;c.font='600 '+size+'px Segoe UI';while(c.measureText(n.label).width>n.r*1.73&&size>3){size-=.3;c.font='600 '+size+'px Segoe UI';}const hit=r.pick(n.x*r.scale+r.tx,n.y*r.scale+r.ty);if(hit!==n){wrongNode++;if(hit?.standard_id!==n.standard_id){wrongIdentity++;if(examples.length<12)examples.push({wanted:n.label,actual:hit?.label});}}return size*r.scale;}).sort((a,b)=>a-b);return{renderViewMs,scale:r.scale,cells:nodes.length,minFontPx:fonts[0],medianFontPx:fonts[Math.floor(fonts.length/2)],labelsBelow6:fonts.filter(v=>v<6).length,labelsBelow8:fonts.filter(v=>v<8).length,wrongNode,wrongIdentity,examples,canvas:{width:r.width,height:r.height},visible:nodes.filter(n=>{const x=n.x*r.scale+r.tx,y=n.y*r.scale+r.ty;return x>=0&&x<=r.width&&y>=0&&y<=r.height;}).length,summary:document.getElementById('map-summary').textContent};},{id,families});
            const index=report.browser.scenarios.length+1, filename=String(index).padStart(2,'0')+'-'+(id.startsWith('__')?id.replaceAll('_',''):id.slice(0,8))+'-'+family+'.png';
            await page.screenshot({path:path.join(output,filename),animations:'disabled'}); report.browser.scenarios.push({id,name,family,...metrics,screenshot:filename});
            fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
            if(family==='all')console.log('Browser',JSON.stringify({name,...metrics}));
          }
        }
        await page.setViewportSize({width:1366,height:768});
        const s=report.browser.scenarios.find(s=>s.id==='__all__'&&s.family==='all');
        await page.evaluate(()=>{FractalWorkspace.state.product='__all__';FractalWorkspace.state.families=['test','material','design'];FractalWorkspace.renderView();});
        await page.screenshot({path:path.join(output,'37-all-1366.png'),animations:'disabled'});
        const interaction=await page.evaluate(()=>{const r=FractalWorkspace.renderer;const start=performance.now();for(let i=0;i<10;i++){r.zoomAt(i%2?1/1.1:1.1,r.width/2,r.height/2);r.render();}return{tenZoomRendersMs:performance.now()-start,horizontalDocumentOverflow:document.documentElement.scrollWidth>innerWidth};});report.browser.interaction=interaction;
      } finally {await browser.close();}
    }
  } catch(error){report.fatal={message:error.message,stack:error.stack};console.error(error);process.exitCode=1;}
  finally {
    worker.stdin.end(); lines.close(); worker.kill(); report.sourceUnchanged=JSON.stringify(fingerprints(source))===JSON.stringify(before);
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    console.log('REPORT '+path.join(output,'report.json'));console.log('SOURCE UNCHANGED '+report.sourceUnchanged);
    if(!report.sourceUnchanged)process.exitCode=1;
  }
})();
