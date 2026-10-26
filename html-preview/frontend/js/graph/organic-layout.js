/* Pure, deterministic canopy layout. No metadata, files or graph edges change. */
(function () {
  'use strict';
  const TAU = Math.PI * 2, clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const bounds = points => ({ minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) });
  const shape = poly => ({ poly, box: bounds(poly) });
  const hash = text => { let v = 2166136261; for (const c of text) v = Math.imul(v ^ c.charCodeAt(0), 16777619); return (v >>> 0) / 4294967296; };
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  function hull(points) {
    const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y), lower = [], upper = [];
    for (const p of sorted) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
    for (const p of sorted.slice().reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }
  const circle = n => Array.from({ length: 12 }, (_, i) => ({ x: n.x + Math.cos(i * TAU / 12) * (n.r + 6), y: n.y + Math.sin(i * TAU / 12) * (n.r + 6) }));
  function rotated(poly, angle) {
    const co = Math.cos(angle), si = Math.sin(angle);
    return poly.map(p => ({ x: p.x * co - p.y * si, y: p.x * si + p.y * co }));
  }
  function rotate(branch, angle) {
    const co = Math.cos(angle), si = Math.sin(angle);
    for (const n of branch.nodes) { const x = n.x, y = n.y; n.x = x * co - y * si; n.y = x * si + y * co; n.direction += angle; }
    branch.poly = rotated(branch.poly, angle); branch.box = bounds(branch.poly);
  }
  function move(branch, x, y) {
    branch.nodes.forEach(n => { n.x += x; n.y += y; });
    branch.poly.forEach(p => { p.x += x; p.y += y; }); branch.box = bounds(branch.poly);
  }
  // Swept separating-axis test: each convex silhouette blocks one interval on
  // the candidate ray. Jump over their union, instead of pushing cells apart.
  function firstFree(branch, obstacles, angle, minimum) {
    const ux = Math.cos(angle), uy = Math.sin(angle), intervals = [];
    for (const other of obstacles) {
      let enter = -Infinity, exit = Infinity;
      for (const poly of [branch.poly, other.poly]) {
        for (let i = 0; i < poly.length; i++) {
          const p = poly[i], q = poly[(i + 1) % poly.length], nx = q.y - p.y, ny = p.x - q.x;
          let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
          for (const p of branch.poly) { const v = p.x * nx + p.y * ny; amin = Math.min(amin, v); amax = Math.max(amax, v); }
          for (const p of other.poly) { const v = p.x * nx + p.y * ny; bmin = Math.min(bmin, v); bmax = Math.max(bmax, v); }
          const speed = ux * nx + uy * ny;
          if (Math.abs(speed) < 1e-9) {
            if (amax < bmin || bmax < amin) { enter = Infinity; exit = -Infinity; break; }
          } else {
            const one = (bmin - amax) / speed, two = (bmax - amin) / speed;
            enter = Math.max(enter, Math.min(one, two)); exit = Math.min(exit, Math.max(one, two));
            if (enter > exit) break;
          }
        }
        if (enter > exit) break;
      }
      if (enter <= exit && exit >= minimum) intervals.push([enter, exit]);
    }
    intervals.sort((a, b) => a[0] - b[0]); let distance = minimum;
    for (const [start, end] of intervals) { if (start > distance) break; if (end >= distance) distance = end + .05; }
    return distance;
  }
  const pendulum = rows => { const result = []; rows.forEach((n, i) => i % 2 ? result.push(n) : result.unshift(n)); return result; };

  window.FractalLayout = class FractalLayout {
    flatten(node, output = []) { output.push(node); node.children.forEach(n => this.flatten(n, output)); return output; }
    build(root) {
      const nodes = this.flatten(root), mass = new Map();
      const measure = n => { const count = 1 + n.children.reduce((sum, c) => sum + measure(c), 0); mass.set(n, count); return count; }; measure(root);
      for (const n of nodes) { n.r = n === root ? 47 : n.island ? 22 : Math.max(14, 25 * Math.pow(.88, n.depth - 1)); n.x = 0; n.y = 0; }
      const order = rows => rows.slice().sort((a, b) => mass.get(b) - mass.get(a) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
      const grow = (n, heading = 0) => {
        n.direction = heading - Math.PI / 2;
        const children = order(n.children), arranged = pendulum(children), plans = [];
        const total = arranged.reduce((sum, c) => sum + Math.pow(mass.get(c), .65), 0), span = Math.min(1.55, .65 + Math.sqrt(children.length) * .20);
        let cursor = heading * .45 - span / 2;
        for (const child of arranged) {
          const width = span * Math.pow(mass.get(child), .65) / total;
          plans.push({ node: child, angle: clamp(cursor + width / 2, -.78, .78) }); cursor += width;
        }
        const occupied = [shape(circle(n))], all = [n];
        for (const plan of plans.sort((a, b) => mass.get(b.node) - mass.get(a.node))) {
          const child = grow(plan.node, plan.angle), headings = child.nodes.map(n => n.direction + Math.PI / 2);
          const minHeading = Math.min(...headings), maxHeading = Math.max(...headings); let best;
          for (const turn of [0, .10, -.10, .20, -.20]) {
            // Less than 45 degrees to either side of the outward axis. Summed
            // path vectors cannot fold back toward the root or reverse a branch.
            if (minHeading + turn < -.78 - 1e-9 || maxHeading + turn > .78 + 1e-9) continue;
            const candidate = shape(rotated(child.poly, turn)), direction = plan.angle + turn - Math.PI / 2;
            const distance = firstFree(candidate, occupied, direction, 62 + Math.sqrt(children.length) * 7), score = distance + Math.abs(turn) * 80;
            if (!best || score < best.score) best = { turn, direction, distance, score };
          }
          rotate(child, best.turn); move(child, Math.cos(best.direction) * best.distance, Math.sin(best.direction) * best.distance);
          plan.node.direction = best.direction; occupied.push(child); all.push(...child.nodes);
        }
        return { ...shape(hull(occupied.flatMap(s => s.poly))), nodes: all };
      };
      const families = ['test', 'material', 'design', 'measurement', 'manufacturing'].filter(f => root.children.some(n => n.family === f && !n.island));
      const weights = families.map(f => Math.pow(root.children.filter(n => n.family === f && !n.island).reduce((sum, n) => sum + mass.get(n), 0), .78));
      const sectors = new Map(), lower = -2.55, upper = -.59, total = weights.reduce((a, b) => a + b, 0); let cursor = lower;
      families.forEach((family, i) => { const span = (upper - lower) * weights[i] / total; sectors.set(family, { start: cursor, end: cursor + span, center: cursor + span / 2 }); cursor += span; });
      root.direction = -Math.PI / 2; const occupied = [shape(circle(root))], entries = order(root.children.filter(n => !n.island && !n.disconnected)), planned = new Map();
      for (const family of families) {
        const rows = pendulum(entries.filter(n => n.family === family)), sector = sectors.get(family), sum = rows.reduce((s, n) => s + Math.pow(mass.get(n), .65), 0); let cursor = sector.start;
        for (const n of rows) { const width = (sector.end - sector.start) * Math.pow(mass.get(n), .65) / sum; planned.set(n, cursor + width / 2); cursor += width; }
      }
      const install = (branch, angle, minimum = 150) => {
        const field = bounds(occupied.flatMap(s => s.poly)); let best;
        // Soft stem sectors: an outward silhouette can extend across its
        // neighbour's sector, but never overlaps another reserved silhouette.
        for (const turn of [0, .055, -.055, .11, -.11, .165, -.165, .22, -.22]) {
          const direction = clamp(angle + turn, lower, upper), rotation = direction + Math.PI / 2, candidate = shape(rotated(branch.poly, rotation));
          const start = Math.max(minimum, (35 + candidate.box.maxY) / -Math.sin(direction));
          const distance = firstFree(candidate, occupied, direction, start), x = Math.cos(direction) * distance, y = Math.sin(direction) * distance;
          const width = Math.max(field.maxX, candidate.box.maxX + x) - Math.min(field.minX, candidate.box.minX + x), height = Math.max(field.maxY, candidate.box.maxY + y) - Math.min(field.minY, candidate.box.minY + y);
          const score = Math.max(width / 1.6, height) + distance * .13 + Math.abs(direction - angle) * 180;
          if (!best || score < best.score) best = { direction, rotation, x, y, score };
        }
        rotate(branch, best.rotation); move(branch, best.x, best.y); occupied.push(branch);
      };
      for (const n of entries) install(grow(n), planned.get(n));
      // Compact unlinked patches belong to the canopy, without invented edges.
      // Reserving their silhouettes keeps them out of connected branches.
      for (const family of families) {
        const rows = root.children.filter(n => n.family === family && n.disconnected && !n.island).sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
        const sector = sectors.get(family), chunks = Math.ceil(rows.length / 12);
        for (let chunk = 0; chunk < chunks; chunk++) {
          const patch = rows.slice(chunk * 12, (chunk + 1) * 12), columns = Math.ceil(Math.sqrt(patch.length * 1.4));
          patch.forEach((n, i) => { n.x = ((i % columns) - (columns - 1) / 2) * 64 + (Math.floor(i / columns) % 2) * 32 + (hash(n.id) - .5) * 4; n.y = -Math.floor(i / columns) * 57 + (hash(n.id + 'y') - .5) * 4; n.direction = -Math.PI / 2; });
          install({ ...shape(hull(patch.flatMap(circle))), nodes: patch }, sector.start + (sector.end - sector.start) * (chunk + .5) / chunks, 260);
        }
      }
      for (const family of ['measurement', 'manufacturing']) {
        const rows = root.children.filter(n => n.island && n.family === family), columns = Math.max(1, Math.ceil(Math.sqrt(rows.length * 1.4))), side = family === 'measurement' ? -1 : 1;
        rows.forEach((n, i) => { n.x = side * (100 + (i % columns) * 60); n.y = 90 + Math.floor(i / columns) * 60; n.direction = -Math.PI / 2; });
      }
      root.branchGuides = {};
      for (const family of families) {
        const rows = entries.filter(n => n.family === family && !n.floating); if (!rows.length) continue;
        const direction = sectors.get(family).center, distance = Math.min(110, ...rows.map(n => Math.hypot(n.x, n.y) * .40));
        root.branchGuides[family] = { x: Math.cos(direction) * distance, y: Math.sin(direction) * distance, direction };
      }
      root.layoutDiagnostics = { engine: 'silhouette-canopy', cells: nodes.length, maxDepth: Math.max(...nodes.map(n => n.depth)) }; return root;
    }
  };
})();
