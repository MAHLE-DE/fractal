(function () {
  'use strict';
  class GraphModel {
    constructor(dataset) {
      this.dataset = dataset;
      this.standards = new Map(dataset.standards.filter(s => s.classification.origin !== 'customer').map(s => [s.id, s]));
      this.outgoing = new Map();
      for (const relation of dataset.relations.standard_standard_relations) {
        if (!this.standards.has(relation.source_standard_id) || !this.standards.has(relation.target_standard_id)) continue;
        if (!this.outgoing.has(relation.source_standard_id)) this.outgoing.set(relation.source_standard_id, []);
        this.outgoing.get(relation.source_standard_id).push(relation);
      }
      for (const rows of this.outgoing.values()) rows.sort((a, b) => b.strength_level - a.strength_level || this.compare(a.target_standard_id, b.target_standard_id));
    }
    compare(a, b) { return this.standards.get(a).identification.document_no.localeCompare(this.standards.get(b).identification.document_no) || a.localeCompare(b); }
    scope(subgroupId) {
      const hints = this.dataset.relations.subgroup_standard_relations.filter(r => subgroupId === '__all__' || r.subgroup_id === subgroupId);
      const seeds = [...this.standards.values()].filter(s => subgroupId === '__all__' || s.applicability?.is_general || subgroupId !== '__general__' && (s.applicability?.product_subgroup_ids || []).includes(subgroupId)).map(s => s.id);
      seeds.push(...hints.map(r => r.standard_id));
      // A cited reference remains visible even if its applicability metadata is different.
      const ids = new Set(), stack = seeds.slice();
      while (stack.length) { const id = stack.pop(); if (ids.has(id) || !this.standards.has(id)) continue; ids.add(id); stack.push(...(this.outgoing.get(id) || []).map(r => r.target_standard_id)); }
      return { ids, hints };
    }
    entries(subgroupId) {
      const { ids, hints } = this.scope(subgroupId);
      // Condense cycles once, then minimize entries independently for each native
      // family. A path in MATL must never replace the native TEST/DSGN appearance.
      let index = 0; const indices = new Map(), low = new Map(), stack = [], active = new Set(), components = [];
      const connect = id => {
        indices.set(id, index); low.set(id, index++); stack.push(id); active.add(id);
        for (const r of this.outgoing.get(id) || []) {
          const to = r.target_standard_id; if (!ids.has(to)) continue;
          if (!indices.has(to)) { connect(to); low.set(id, Math.min(low.get(id), low.get(to))); }
          else if (active.has(to)) low.set(id, Math.min(low.get(id), indices.get(to)));
        }
        if (low.get(id) === indices.get(id)) { const component = []; let to; do { to = stack.pop(); active.delete(to); component.push(to); } while (to !== id); components.push(component); }
      };
      [...ids].sort((a, b) => this.compare(a, b)).forEach(id => { if (!indices.has(id)) connect(id); });
      const componentOf = new Map(), incident = new Set(), following = new Map();
      components.forEach((group, i) => group.forEach(id => componentOf.set(id, i)));
      for (const id of ids) for (const r of this.outgoing.get(id) || []) if (ids.has(r.target_standard_id)) {
        incident.add(id); incident.add(r.target_standard_id);
        const from = componentOf.get(id), to = componentOf.get(r.target_standard_id);
        if (from !== to) { if (!following.has(from)) following.set(from, new Set()); following.get(from).add(to); }
      }
      const familyOf = id => { const s = this.standards.get(id); return s.classification.internal_category || s.tree_entry?.family || 'design'; };
      const roots = [], familyCoverage = {};
      for (const family of ['test', 'material', 'design', 'measurement', 'manufacturing']) {
        const members = [...ids].filter(id => familyOf(id) === family), candidates = new Set(members.map(id => componentOf.get(id))), covered = new Set();
        // A same-family ancestor can cover a candidate via any citation path,
        // including paths through other families. Cross-family ancestors alone
        // cannot remove that family's entry. Each remaining component needs one.
        for (const component of candidates) {
          const seen = new Set(), queue = [...(following.get(component) || [])];
          while (queue.length) { const next = queue.pop(); if (seen.has(next)) continue; seen.add(next); if (candidates.has(next)) covered.add(next); queue.push(...(following.get(next) || [])); }
        }
        const entries = [...candidates].filter(c => !covered.has(c)).map(component => {
          const id = components[component].filter(id => familyOf(id) === family).sort((a, b) => (this.outgoing.get(b)?.length || 0) - (this.outgoing.get(a)?.length || 0) || this.compare(a, b))[0];
          const s = this.standards.get(id), hint = hints.find(r => r.standard_id === id);
          return { id: 'entry-' + family + '-' + id, standard_id: id, family, strength_level: hint?.strength_level || s.tree_entry?.strength_level || 3, floating: !incident.has(id) };
        }).sort((a, b) => this.compare(a.standard_id, b.standard_id));
        roots.push(...entries); familyCoverage[family] = { standards: members.length, entries: entries.filter(r => !r.floating).length, unlinked: entries.filter(r => r.floating).length };
      }
      return { roots, ids, hints, familyCoverage };
    }
    expand(subgroupId, options = {}) {
      const product = subgroupId === '__all__' ? { id: subgroupId, name: 'All standards', virtual: true } : subgroupId === '__general__' ? { id: subgroupId, name: 'General standards', virtual: true } : this.dataset.subgroups.find(p => p.id === subgroupId);
      if (!product) throw new Error('This product subgroup is not available.');
      const maxDepth = options.depth > 0 ? options.depth : Infinity, families = options.families || ['test', 'material', 'design'];
      const root = { id: 'root:' + subgroupId, standard_id: null, product, label: product.name, depth: 0, family: 'root', strength: 3, children: [], parent: null };
      const { roots, ids, hints, familyCoverage } = this.entries(subgroupId), expanded = new Set(); let total = 0;
      const visit = (id, parent, family, strength, path, relationId) => {
        const standard = this.standards.get(id); if (!standard) return null;
        const node = { id: parent.id + '/' + relationId, standard_id: id, standard, label: standard.identification.document_no, family, depth: parent.depth + 1, strength, parent, children: [], cycle: path.has(id) };
        total++;
        // Bound repeated expansion, never first-time coverage in large directed graphs.
        const expansionKey = family + ':' + id;
        node.collapsedReference = total > 1500 && expanded.has(expansionKey) && !node.cycle;
        if (!node.cycle && !node.collapsedReference && node.depth < maxDepth) {
          expanded.add(expansionKey); const following = new Set(path); following.add(id);
          for (const r of this.outgoing.get(id) || []) { const child = visit(r.target_standard_id, node, family, r.strength_level, following, r.id); if (child) node.children.push(child); }
        }
        return node;
      };
      for (const entry of roots) {
        const peripheral = ['measurement', 'manufacturing'].includes(entry.family);
        if (peripheral ? options.islands === false : !families.includes(entry.family)) continue;
        const node = visit(entry.standard_id, root, entry.family, entry.strength_level, new Set(), entry.id);
        node.floating = entry.floating || peripheral; node.disconnected = entry.floating; root.children.push(node);
      }
      // Independent island appearances remain when MEAS/MNFG are also cited in a branch.
      if (options.islands !== false) for (const id of [...ids].sort((a, b) => this.compare(a, b))) {
        const s = this.standards.get(id), hint = hints.find(r => r.standard_id === id), family = s.classification.internal_category || s.tree_entry?.family;
        if (!['measurement', 'manufacturing'].includes(family)) continue;
        const node = { id: root.id + '/island-' + id, standard_id: id, standard: s, label: s.identification.document_no, family, depth: 1, strength: hint?.strength_level || s.tree_entry?.strength_level || 3, parent: root, children: [], island: true };
        const isolated = root.children.find(n => n.standard_id === id && n.floating && !n.children.length);
        if (isolated) isolated.island = true; else root.children.push(node);
      }
      root.coverage = { standards: ids.size, minimumEntries: roots.filter(r => !r.floating).length, disconnected: roots.filter(r => r.floating).length, families: familyCoverage };
      return root;
    }
  }
  window.GraphModel = GraphModel;
})();
