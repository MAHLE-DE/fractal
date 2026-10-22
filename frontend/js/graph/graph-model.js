(function () {
  'use strict';
  class GraphModel {
    constructor(dataset) {
      this.dataset = dataset; this.standards = new Map(dataset.standards.map(s => [s.id, s])); this.outgoing = new Map();
      for (const relation of dataset.relations.standard_standard_relations) {
        if (!this.outgoing.has(relation.source_standard_id)) this.outgoing.set(relation.source_standard_id, []);
        this.outgoing.get(relation.source_standard_id).push(relation);
      }
    }
    expand(productId, options = {}) {
      const product = this.dataset.products.find(p => p.id === productId);
      if (!product) throw new Error('This product type is not available.');
      const maxDepth = options.depth > 0 ? options.depth : Infinity, families = options.families || ['test', 'material', 'design'];
      const root = { id: 'root:' + productId, standard_id: null, product, label: product.name, depth: 0, family: 'root', strength: 3, children: [], parent: null };
      let total = 0;
      const visit = (standardId, parent, family, strength, path, relationId) => {
        const standard = this.standards.get(standardId);
        if (!standard || standard.classification.origin === 'customer') return null;
        if (++total > 1800) throw new Error('Too many visual paths for this preview. Reduce the visible depth.');
        const node = { id: parent.id + '/' + relationId, standard_id: standardId, standard, label: standard.identification.document_no, family, depth: parent.depth + 1, strength, parent, children: [], cycle: path.has(standardId) };
        if (!node.cycle && node.depth < maxDepth) {
          const following = new Set(path); following.add(standardId);
          for (const r of this.outgoing.get(standardId) || []) { const child = visit(r.target_standard_id, node, family, r.strength_level, following, r.id); if (child) node.children.push(child); }
        }
        return node;
      };
      for (const relation of this.dataset.relations.product_standard_relations.filter(r => r.product_id === productId)) {
        if (relation.placement === 'island' && options.islands === false) continue;
        if (relation.placement === 'radial_branch' && !families.includes(relation.branch)) continue;
        const node = visit(relation.standard_id, root, relation.branch || relation.island, relation.strength_level, new Set(), relation.id);
        if (node) { node.island = relation.placement === 'island'; if (node.island) node.children = []; root.children.push(node); }
      }
      return root;
    }
  }
  window.GraphModel = GraphModel;
})();
