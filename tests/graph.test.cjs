'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const context = vm.createContext({ window: {}, console });
for (const name of ['demo-data.js', 'graph/graph-model.js', 'graph/organic-layout.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../frontend/js', name), 'utf8'), context);
const { FractalDemo, GraphModel, FractalLayout } = context.window;
const flatten = root => [root, ...root.children.flatMap(flatten)];
test('Fictional records have stable unique UUIDs, strings for revisions and valid references', () => {
  const data = FractalDemo.create(), ids = new Set(data.standards.map(s => s.id)); assert.equal(ids.size, 104);
  assert.ok(data.standards.every(s => s.preview_only && /^[a-f0-9-]{36}$/.test(s.id) && typeof s.identification.revision_no === 'string'));
  for (const r of data.relations.standard_standard_relations) { assert.ok(ids.has(r.source_standard_id) && ids.has(r.target_standard_id)); assert.notEqual(r.source_standard_id, r.target_standard_id); assert.ok([1, 2, 3].includes(r.strength_level)); }
});
test('Expansion separates logical identity from instances and terminates a cycle by path', () => {
  const data = FractalDemo.create(), before = JSON.stringify(data), nodes = flatten(new GraphModel(data).expand(data.subgroups[0].id));
  assert.ok(nodes.some(n => n.cycle)); assert.ok(nodes.filter(n => n.cycle).every(n => n.children.length === 0));
  const iso = data.standards.find(s => s.identification.document_no === 'ISO 9227'); assert.ok(nodes.filter(n => n.standard_id === iso.id).length > 1);
  assert.equal(new Set(nodes.map(n => n.id)).size, nodes.length); assert.equal(JSON.stringify(data), before);
});
test('Islands are independent even when the same standard also appears in a branch', () => {
  const data = FractalDemo.create(), nodes = flatten(new GraphModel(data).expand(data.subgroups[0].id)), island = nodes.find(n => n.island && n.family === 'measurement' && nodes.some(copy => !copy.island && copy.standard_id === n.standard_id));
  assert.ok(island); assert.equal(island.parent.depth, 0); assert.equal(island.children.length, 0);
  assert.ok(nodes.some(n => !n.island && n.standard_id === island.standard_id));
});
test('Every product layout has finite positions, no touching cells and consistent radii by family/depth', () => {
  const data = FractalDemo.create();
  for (const product of data.subgroups) {
    const nodes = flatten(new FractalLayout().build(new GraphModel(data).expand(product.id))), radii = new Map();
    for (const n of nodes) { assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y) && n.r > 0); const key = n.family + ':' + n.depth + ':' + !!n.island; if (radii.has(key)) assert.equal(n.r, radii.get(key)); else radii.set(key, n.r); }
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) assert.ok(Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) > nodes[i].r + nodes[j].r + 6.8);
  }
});
test('Family, depth and island filters compose without changing records', () => {
  const data = FractalDemo.create(), graph = new GraphModel(data), root = graph.expand(data.subgroups[0].id, { families: ['test'], islands: false, depth: 3 });
  assert.ok(flatten(root).every(n => n.depth === 0 || n.family === 'test' && n.depth <= 3 && !n.island));
  assert.equal(flatten(graph.expand(data.subgroups[0].id, { families: [], islands: false })).length, 1);
});
const standard = (id, family = 'test', subgroup = 'p', general = false) => ({ id, identification: { document_no: id }, classification: { origin: 'internal', internal_category: family }, applicability: { product_subgroup_ids: [subgroup], is_general: general }, tree_entry: { family, strength_level: 3 } });
const dataset = (standards, edges) => ({ standards, subgroups: [{ id: 'p', name: 'Primary' }, { id: 'q', name: 'Secondary' }], relations: { subgroup_standard_relations: [], standard_standard_relations: edges.map(([a, b], i) => ({ id: 'e' + i, source_standard_id: a, target_standard_id: b, strength_level: 3 })) } });
test('Transitive citations minimize roots; a high incoming count does not promote a leaf', () => {
  const data = dataset(['A','B','C','D'].map(id => standard(id)), [['A','B'],['B','C'],['A','D'],['D','C']]);
  const root = new GraphModel(data).expand('p');
  assert.deepEqual(Array.from(root.children.map(n => n.standard_id)), ['A']);
  assert.equal(new Set(flatten(root).filter(n => n.standard_id).map(n => n.standard_id)).size, 4);
});
test('Cycles need one entry per source component; isolated standards float without root edges', () => {
  const data = dataset(['A','B','C','D','E','F'].map(id => standard(id)), [['A','B'],['B','A'],['B','C'],['D','C'],['D','E']]);
  const root = new GraphModel(data).expand('p'), entries = root.children.filter(n => !n.floating);
  assert.equal(entries.length, 2); assert.equal(root.coverage.minimumEntries, 2);
  assert.ok(entries.some(n => n.standard_id === 'B')); // same reachability, more direct citations
  assert.equal(root.children.find(n => n.standard_id === 'F').disconnected, true);
  assert.equal(new Set(flatten(root).filter(n => n.standard_id).map(n => n.standard_id)).size, 6);
});
test('All subgroup standards, general standards and cited references are covered, without unrelated standards', () => {
  const data = dataset([standard('A'), standard('B'), standard('GLOBAL','design','q',true), standard('OTHER','design','q'), standard('CITED','material','q')], [['A','B'],['B','CITED']]);
  const ids = new Set(flatten(new GraphModel(data).expand('p')).map(n => n.standard_id));
  for (const id of ['A','B','GLOBAL','CITED']) assert.ok(ids.has(id)); assert.ok(!ids.has('OTHER'));
  assert.equal(new Set(flatten(new GraphModel(data).expand('__all__')).filter(n => n.standard_id).map(n => n.standard_id)).size, 5);
  assert.deepEqual(Array.from(new GraphModel(data).scope('__general__').ids), ['GLOBAL']);
});
test('Root selection is independent of input order, and layout keeps unlinked nodes finite and unconnected', () => {
  const data = dataset(Array.from({length:90}, (_,i) => standard('S'+i)), [['S0','S1']]);
  const graph = new GraphModel(data), first = graph.entries('p').roots.map(r => r.standard_id).join(',');
  data.standards.reverse(); data.relations.standard_standard_relations.reverse();
  assert.equal(new GraphModel(data).entries('p').roots.map(r=>r.standard_id).join(','), first);
  const nodes = flatten(new FractalLayout().build(graph.expand('p')));
  assert.ok(nodes.filter(n => n.disconnected).every(n => n.floating && n.children.length === 0));
  assert.ok(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y)));
});
test('Dense DAGs limit repeated expansion but retain complete unique coverage', () => {
  const standards = Array.from({length:70}, (_,i) => standard('D'+i)), edges=[];
  for(let i=0;i<68;i++) {edges.push(['D'+i,'D'+(i+1)]); edges.push(['D'+i,'D'+(i+2)]);}
  const nodes = flatten(new GraphModel(dataset(standards,edges)).expand('p'));
  assert.equal(new Set(nodes.filter(n=>n.standard_id).map(n=>n.standard_id)).size, 70);
  assert.ok(nodes.some(n=>n.collapsedReference)); assert.ok(nodes.length < 5000);
});
test('A MATL → TEST citation preserves both native trees and adds a cross-family appearance', () => {
  const data = dataset([standard('TEST-A','test'), standard('MATL-A','material')], []);
  assert.ok(new GraphModel(data).expand('p').children.every(n => n.floating));
  data.relations.standard_standard_relations.push({id:'cross',source_standard_id:'MATL-A',target_standard_id:'TEST-A',strength_level:3});
  const graph = new GraphModel(data), root = graph.expand('p'), material = root.children.find(n => n.family === 'material'), testEntry = root.children.find(n => n.family === 'test');
  assert.ok(material && testEntry); assert.equal(material.standard_id,'MATL-A'); assert.equal(testEntry.standard_id,'TEST-A');
  assert.ok(!material.floating && !testEntry.floating);
  assert.equal(material.children[0].standard_id,'TEST-A'); assert.equal(material.children[0].family,'material');
  assert.equal(root.coverage.minimumEntries,2);
  const onlyTest = flatten(graph.expand('p',{families:['test'],islands:false}));
  assert.ok(onlyTest.some(n=>n.standard_id==='TEST-A')); assert.ok(!onlyTest.some(n=>n.standard_id==='MATL-A'));
});
test('Cycles spanning all three families never collapse the three native sectors into one', () => {
  const data = dataset([standard('T','test'),standard('M','material'),standard('D','design')],[['T','M'],['M','D'],['D','T']]), root = new GraphModel(data).expand('p');
  assert.deepEqual(Array.from(root.children.map(n=>n.family)),['test','material','design']);
  assert.equal(root.children.length,3);
  for(const family of ['test','material','design']) {
    const sector = root.children.find(n=>n.family===family), nodes = flatten(sector);
    assert.equal(new Set(nodes.map(n=>n.standard_id)).size,3); assert.ok(nodes.some(n=>n.cycle));
  }
});
test('Entries are still minimal within each family, including indirect paths through a different family', () => {
  const data = dataset([standard('T1','test'),standard('T2','test'),standard('M','material'),standard('D','design')],[['T1','M'],['M','T2'],['M','D']]), graph = new GraphModel(data), root = graph.expand('p');
  assert.deepEqual(Array.from(root.children.filter(n=>n.family==='test').map(n=>n.standard_id)),['T1']);
  assert.equal(root.children.filter(n=>n.family==='material').length,1); assert.equal(root.children.filter(n=>n.family==='design').length,1);
  const testSector = root.children.find(n=>n.family==='test'); assert.ok(flatten(testSector).some(n=>n.standard_id==='T2'));
  assert.equal(root.coverage.families.test.standards,2); assert.equal(root.coverage.families.test.entries,1);
});
test('Dense cross-family references retain coverage independently in every family', () => {
  const standards = Array.from({length:60},(_,i)=>standard('N'+i,['test','material','design'][i%3])), edges=[];
  for(let i=0;i<58;i++){edges.push(['N'+i,'N'+(i+1)]);edges.push(['N'+i,'N'+(i+2)]);}
  const root = new GraphModel(dataset(standards,edges)).expand('p');
  for(const family of ['test','material','design']) {
    const ids = new Set(root.children.filter(n=>n.family===family).flatMap(flatten).map(n=>n.standard_id));
    for(const record of standards.filter(s=>s.tree_entry.family===family)) assert.ok(ids.has(record.id),family+' lost '+record.id);
  }
});
test('Per-family entry count agrees with exhaustive minimum coverage on small mixed graphs', () => {
  let random = 4271; const next = () => (random = (random * 1664525 + 1013904223) >>> 0) / 4294967296;
  for(let sample=0;sample<40;sample++) {
    const standards = Array.from({length:6},(_,i)=>standard('R'+i,['test','material','design'][i%3])), edges=[];
    for(let i=0;i<6;i++) for(let j=0;j<6;j++) if(i!==j && next()<.23) edges.push(['R'+i,'R'+j]);
    const graph = new GraphModel(dataset(standards,edges)), entries = graph.entries('p').roots;
    const reach = seeds => {const seen=new Set(),queue=seeds.slice();while(queue.length){const id=queue.pop();if(seen.has(id))continue;seen.add(id);queue.push(...(graph.outgoing.get(id)||[]).map(r=>r.target_standard_id));}return seen;};
    for(const family of ['test','material','design']) {
      const required=standards.filter(s=>s.tree_entry.family===family).map(s=>s.id), chosen=entries.filter(r=>r.family===family).map(r=>r.standard_id);
      assert.ok(required.every(id=>reach(chosen).has(id)));
      let minimum=required.length;
      for(let mask=0;mask<(1<<required.length);mask++) {const seeds=required.filter((_,i)=>mask&(1<<i));if(required.every(id=>reach(seeds).has(id)))minimum=Math.min(minimum,seeds.length);}
      assert.equal(chosen.length,minimum, family+' sample '+sample);
    }
  }
});
