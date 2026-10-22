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
  const data = FractalDemo.create(), before = JSON.stringify(data), nodes = flatten(new GraphModel(data).expand(data.products[0].id));
  assert.ok(nodes.some(n => n.cycle)); assert.ok(nodes.filter(n => n.cycle).every(n => n.children.length === 0));
  const iso = data.standards.find(s => s.identification.document_no === 'ISO 9227'); assert.ok(nodes.filter(n => n.standard_id === iso.id).length > 1);
  assert.equal(new Set(nodes.map(n => n.id)).size, nodes.length); assert.equal(JSON.stringify(data), before);
});
test('Islands are independent even when the same standard also appears in a branch', () => {
  const data = FractalDemo.create(), nodes = flatten(new GraphModel(data).expand(data.products[0].id)), island = nodes.find(n => n.island && n.family === 'measurement');
  assert.ok(island); assert.equal(island.parent.depth, 0); assert.equal(island.children.length, 0);
  assert.ok(nodes.some(n => !n.island && n.standard_id === island.standard_id));
});
test('Every product layout has finite positions, no touching cells and consistent radii by family/depth', () => {
  const data = FractalDemo.create();
  for (const product of data.products) {
    const nodes = flatten(new FractalLayout().build(new GraphModel(data).expand(product.id))), radii = new Map();
    for (const n of nodes) { assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y) && n.r > 0); const key = n.family + ':' + n.depth + ':' + !!n.island; if (radii.has(key)) assert.equal(n.r, radii.get(key)); else radii.set(key, n.r); }
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) assert.ok(Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) > nodes[i].r + nodes[j].r + 6.8);
  }
});
test('Family, depth and island filters compose without changing records', () => {
  const data = FractalDemo.create(), graph = new GraphModel(data), root = graph.expand(data.products[0].id, { families: ['test'], islands: false, depth: 3 });
  assert.ok(flatten(root).every(n => n.depth === 0 || n.family === 'test' && n.depth <= 3 && !n.island));
  assert.equal(flatten(graph.expand(data.products[0].id, { families: [], islands: false })).length, 1);
});
