/* Pure layout: no DOM, file access or metadata mutation. Original MVP layout is retained separately. */
window.FractalLayout = class FractalLayout {
  flatten(node, output = []) { output.push(node); node.children.forEach(n => this.flatten(n, output)); return output; }
  build(root) {
    root.x = 0; root.y = 0; root.r = 47; root.direction = -Math.PI / 2;
    const corridors = { test: [-2.95, -1.99], material: [-1.99, -1.15], design: [-1.15, -.19] };
    const count = {}, leaves = n => n.children.length ? n.children.reduce((sum, c) => sum + leaves(c), 0) : 1;
    for (const node of this.flatten(root)) { const key = node.family + node.depth; count[key] = (count[key] || 0) + 1; }
    const place = (node, start, end, inherited) => {
      const center = (start + end) / 2;
      // Aim toward the canopy, accounting for the parent's position. Simply
      // inheriting an absolute sector angle compresses the graph into 3 columns.
      const reach = 550, desired = Math.atan2(Math.sin(center) * reach - node.parent.y, Math.cos(center) * reach - node.parent.x);
      const delta = Math.atan2(Math.sin(desired - inherited), Math.cos(desired - inherited));
      const angle = node.depth === 1 ? center : inherited + delta * .78;
      const length = 181 * Math.pow(.77, node.depth - 1);
      node.direction = angle; node.r = Math.max(9.4, 27 * Math.pow(.82, node.depth - 1) * Math.pow(Math.max(1, count[node.family + node.depth] / 10), -.10));
      node.x = node.parent.x + Math.cos(angle) * length; node.y = node.parent.y + Math.sin(angle) * length;
      node.anchorX = node.x; node.anchorY = node.y;
      const children = [...node.children].sort((a, b) => b.strength - a.strength || a.label.localeCompare(b.label));
      const order = []; children.forEach((child, i) => i % 2 ? order.push(child) : order.unshift(child));
      let cursor = start; const total = order.reduce((sum, c) => sum + leaves(c), 0);
      for (const child of order) { const width = (end - start) * leaves(child) / total; place(child, cursor, cursor + width, angle); cursor += width; }
    };
    for (const family of Object.keys(corridors)) {
      const entries = root.children.filter(n => n.family === family && !n.island), [start, end] = corridors[family];
      entries.forEach((entry, i) => place(entry, start + (end - start) * i / entries.length, start + (end - start) * (i + 1) / entries.length, (start + end) / 2));
    }
    for (const family of ['measurement', 'manufacturing']) {
      const entries = root.children.filter(n => n.island && n.family === family), side = family === 'measurement' ? -1 : 1;
      entries.forEach((node, i) => { node.x = side * (270 + i % 2 * 64); node.y = 34 + Math.floor(i / 2) * 65; node.r = 20; node.direction = 0; node.anchorX = node.x; node.anchorY = node.y; });
    }
    const nodes = this.flatten(root);
    for (let step = 0; step < 180; step++) {
      let collisions = 0;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy), required = a.r + b.r + 7;
        if (distance >= required - .01) continue;
        collisions++;
        const angle = distance < .001 ? (i + j) * 2.39996 : Math.atan2(dy, dx), force = (required - distance) * .52;
        const mobility = n => n === root ? 0 : n.island ? .05 : (1 + n.depth * .15) / n.strength;
        const ma = mobility(a), mb = mobility(b), sum = ma + mb || 1;
        a.x -= Math.cos(angle) * force * ma / sum; a.y -= Math.sin(angle) * force * ma / sum;
        b.x += Math.cos(angle) * force * mb / sum; b.y += Math.sin(angle) * force * mb / sum;
      }
      if (step < 65) for (const node of nodes) { if (node === root || node.island) continue; node.x += (node.anchorX - node.x) * .008; node.y += (node.anchorY - node.y) * .008; }
      if (!collisions && step > 65) break;
    }
    for (const node of nodes) if (node.parent) node.direction = Math.atan2(node.y - node.parent.y, node.x - node.parent.x);
    root.layoutDiagnostics = { cells: nodes.length, maxDepth: Math.max(...nodes.map(n => n.depth)) }; return root;
  }
};
