'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const context = vm.createContext({ window: {} }); for (const f of ['graph-model.js','organic-layout.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../frontend/js/graph',f),'utf8'),context);
const { GraphModel, FractalLayout } = context.window;
const record = (id, family) => ({ id, identification:{ document_no:id }, classification:{ origin:'internal',internal_category:family }, applicability:{product_subgroup_ids:['p']}, tree_entry:{family,strength_level:3} });
const dataset = (records, edges) => ({ standards:records,subgroups:[{id:'p',name:'Stress subgroup'}],relations:{subgroup_standard_relations:[],standard_standard_relations:edges.map(([source,target],i)=>({id:'r'+i,source_standard_id:source,target_standard_id:target,strength_level:3}))} });
function check(root) {
  const nodes = new FractalLayout().flatten(root);
  for(const n of nodes){ assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y)&&Number.isFinite(n.direction));if(n.parent&&!n.floating&&!n.island){assert.ok(Math.hypot(n.x,n.y)>Math.hypot(n.parent.x,n.parent.y),'inward edge '+n.label);if(n.parent.depth)assert.ok(Math.abs(Math.atan2(Math.sin(n.direction-n.parent.direction),Math.cos(n.direction-n.parent.direction)))<Math.PI/2,'reverse '+n.label);}}
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)assert.ok(Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y)-nodes[i].r-nodes[j].r>6.8,'collision '+nodes[i].label+' / '+nodes[j].label);
  return nodes;
}
test('An empty scope and a single unlinked standard stay finite and never acquire a false citation',()=>{
  for(const records of [[],[record('Only','test')]]){const root=new FractalLayout().build(new GraphModel(dataset(records,[])).expand('p'));check(root);assert.equal(root.children.length,records.length);if(records.length)assert.ok(root.children[0].floating&&root.children[0].disconnected);}
});
test('A large asymmetric branch gets a broader stem sector while all native families survive',()=>{
  const records=[record('M','material'),record('T','test'),record('D','design')],edges=[];
  for(let i=0;i<72;i++){records.push(record('M-'+i,'material'));edges.push(['M','M-'+i]);}
  for(const f of ['T','D']){records.push(record(f+'-leaf',f==='T'?'test':'design'));edges.push([f,f+'-leaf']);}
  const root=new FractalLayout().build(new GraphModel(dataset(records,edges)).expand('p'));const nodes=check(root);
  for(const family of ['test','material','design'])assert.ok(root.children.some(n=>n.family===family&&!n.floating));
  const spread=family=>{const angles=nodes.filter(n=>n.family===family).map(n=>Math.atan2(n.y,n.x));return Math.max(...angles)-Math.min(...angles);};assert.ok(spread('material')>spread('test')+.2);
  assert.equal(nodes.find(n=>n.label==='M').children.length,72);assert.equal(new Set(nodes.filter(n=>n.standard_id).map(n=>n.standard_id)).size,records.length);
});
test('Many isolated standards and many peripheral references remain compact instead of forming a two-column tail',()=>{
  const records=Array.from({length:180},(_,i)=>record('F'+i,['test','material','design'][i%3])).concat(Array.from({length:80},(_,i)=>record('Island'+i,'manufacturing')));
  const root=new FractalLayout().build(new GraphModel(dataset(records,[])).expand('p')),nodes=check(root),islands=nodes.filter(n=>n.island);
  assert.equal(islands.length,80);assert.ok(nodes.filter(n=>n.standard_id).every(n=>n.island||n.disconnected&&n.floating));
  assert.ok(Math.max(...islands.map(n=>n.y))-Math.min(...islands.map(n=>n.y))<600);
});
test('Layout is reproducible after reordering JSON records and does not mutate their contents',()=>{
  const records=Array.from({length:24},(_,i)=>record('N'+i,['test','material','design'][i%3])),edges=[];for(let i=0;i<19;i++)edges.push(['N'+i,'N'+(i+1)]);
  const data=dataset(records,edges),before=JSON.stringify(data),first=new FractalLayout().build(new GraphModel(data).expand('p'));check(first);assert.equal(JSON.stringify(data),before);
  const coordinates=root=>new FractalLayout().flatten(root).map(n=>[n.id,n.x,n.y,n.r]).sort((a,b)=>a[0].localeCompare(b[0]));
  data.standards.reverse();data.relations.standard_standard_relations.reverse();const second=new FractalLayout().build(new GraphModel(data).expand('p'));assert.deepEqual(coordinates(first),coordinates(second));
});
