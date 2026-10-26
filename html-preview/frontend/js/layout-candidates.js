/* Experimental, pure layouts. Loaded only by the comparison test. */
(function () {
  'use strict';
  const TAU = Math.PI * 2, clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const delta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const hash = text => { let v = 2166136261; for (const c of text) v = Math.imul(v ^ c.charCodeAt(0), 16777619); return (v >>> 0) / 4294967296; };
  class GrowthCanopy {
    constructor(options = {}) { this.options = options; }
    flatten(node, output = []) { output.push(node); node.children.forEach(c => this.flatten(c, output)); return output; }
    build(root) {
      const nodes = this.flatten(root), measurements = new Map(), grid = new Map(), placed = [], gap = 9, cell = 72;
      const measure = n => { const children = n.children.map(measure); const m = { mass: 1 + children.reduce((s, v) => s + v.mass, 0), height: children.length ? 1 + Math.max(...children.map(v => v.height)) : 0 }; measurements.set(n, m); return m; }; measure(root);
      const radius = n => n === root ? 47 : n.island ? 22 : Math.max(14, 25 * Math.pow(.88, n.depth - 1));
      const put = n => { const key = Math.floor(n.x / cell) + ':' + Math.floor(n.y / cell); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(n); placed.push(n); };
      const free = (x, y, r, extra = 0) => { const gx = Math.floor(x / cell), gy = Math.floor(y / cell), reach = Math.ceil((r + 47 + gap + extra) / cell); for (let ix = gx - reach; ix <= gx + reach; ix++) for (let iy = gy - reach; iy <= gy + reach; iy++) for (const other of grid.get(ix + ':' + iy) || []) if (Math.hypot(x - other.x, y - other.y) < r + other.r + gap + extra) return false; return true; };
      root.x = 0; root.y = 0; root.r = radius(root); root.direction = -Math.PI / 2; put(root);
      const families = ['test', 'material', 'design', 'measurement', 'manufacturing'].filter(f => root.children.some(n => n.family === f && !n.island));
      const weights = families.map(f => Math.pow(root.children.filter(n => n.family === f && !n.island).reduce((s, n) => s + measurements.get(n).mass, 0), .72));
      const sectors = new Map(); let cursor = -Math.PI + .10, total = weights.reduce((a, b) => a + b, 0);
      families.forEach((f, i) => { const span = (Math.PI - .20) * weights[i] / total; sectors.set(f, { start: cursor, end: cursor + span, center: cursor + span / 2 }); cursor += span; });
      const crown = Math.max(350, Math.sqrt(nodes.length) * 33);
      const inSector = (x, y, sector) => { const r = Math.hypot(x, y), angle = Math.atan2(y, x), spill = this.options.strict ? 0 : clamp((r - 280) / 950, 0, .68); return y < -20 && angle > Math.max(-Math.PI + .03, sector.start - spill) && angle < Math.min(-.03, sector.end + spill); };
      const place = (n, desired, distance, sector, entry = false) => {
        const p = n.parent, pr = Math.hypot(p.x, p.y), radial = p === root ? desired : Math.atan2(p.y, p.x), previous = p === root ? desired : p.direction;
        const base = p === root ? desired : radial + clamp(delta(desired, radial), -.88, .88);
        const r = radius(n), angleSteps = [0]; for (let j = 1; j <= 7; j++) angleSteps.push(j * .07, -j * .07);
        for (let ring = 0; ring < 180; ring++) {
          const length = distance + ring * 18;
          for (const angle of [...angleSteps.map(turn => base + turn), radial, sector.center]) {
            if (p !== root && (Math.abs(delta(angle, previous)) > 1.19 || Math.abs(delta(angle, radial)) > 1.12)) continue;
            const x = p.x + Math.cos(angle) * length, y = p.y + Math.sin(angle) * length;
            if (Math.hypot(x, y) < pr + 36 || !inSector(x, y, sector) || !free(x, y, r)) continue;
            Object.assign(n, { x, y, r, direction: angle }); put(n); return;
          }
        }
        throw Error('Canopy could not place ' + n.label);
      };
      const ordered = children => children.slice().sort((a, b) => measurements.get(b).mass - measurements.get(a).mass || b.strength - a.strength || a.label.localeCompare(b.label));
      const grow = n => {
        const sector = sectors.get(n.family), children = ordered(n.children), order = [];
        children.forEach((c, i) => i % 2 ? order.push(c) : order.unshift(c));
        const span = Math.min(1.8, .55 + Math.sqrt(children.length) * .22), weights = order.map(c => Math.pow(measurements.get(c).mass, .55)), sum = weights.reduce((a, b) => a + b, 0);
        let cursor = -.5 * span; const plans = [];
        order.forEach((child, i) => { const width = span * weights[i] / sum; plans.push({ child, angle: n.direction + cursor + width / 2 }); cursor += width; });
        for (const { child, angle } of plans.sort((a, b) => measurements.get(b.child).mass - measurements.get(a.child).mass)) place(child, angle, 66 + 14 * Math.sqrt(children.length) + 7 * Math.sqrt(measurements.get(child).mass), sector);
        children.forEach(grow);
      };
      const entries = ordered(root.children.filter(n => !n.island && !n.disconnected));
      for (const family of families) {
        const sector = sectors.get(family), rows = entries.filter(n => n.family === family), weights = rows.map(n => Math.pow(measurements.get(n).mass, .68)), sum = weights.reduce((a, b) => a + b, 0); let angle = sector.start;
        rows.forEach((n, i) => { const span = (sector.end - sector.start) * weights[i] / sum; n.plannedAngle = angle + span / 2; angle += span; });
      }
      for (const n of entries) { place(n, n.plannedAngle, 150 + crown * .35 / (1 + Math.log2(measurements.get(n).mass)) + hash(n.id) * 32, sectors.get(n.family), true); grow(n); }
      const maxRadius = Math.max(crown * .85, ...placed.map(n => Math.hypot(n.x, n.y)));
      const halton = (i, base) => { let f = 1, value = 0; while (i > 0) { f /= base; value += f * (i % base); i = Math.floor(i / base); } return value; };
      for (const family of families) {
        const sector = sectors.get(family), floating = root.children.filter(n => n.family === family && n.disconnected && !n.island).sort((a, b) => a.label.localeCompare(b.label)); let candidate = 1;
        for (const n of floating) {
          const r = radius(n); let found = false;
          let attempts = 0;
          while (!found && attempts++ < 20000) {
            const trial = candidate++, angle = sector.start + (sector.end - sector.start) * halton(trial, 2), reach = maxRadius * (1 + Math.floor(attempts / 1200) * .10) * Math.sqrt(.16 + .95 * halton(trial, 3));
            const x = Math.cos(angle) * reach, y = Math.sin(angle) * reach;
            if (free(x, y, r, 3)) { Object.assign(n, { x, y, r, direction: angle }); put(n); found = true; }
          }
          if (!found) throw Error('Cannot place floating reference ' + n.label);
        }
      }
      for (const family of ['measurement', 'manufacturing']) {
        const group = root.children.filter(n => n.family === family && n.island), columns = Math.max(1, Math.ceil(Math.sqrt(group.length * 1.4))), side = family === 'measurement' ? -1 : 1;
        group.forEach((n, i) => { n.r = radius(n); n.x = side * (100 + (i % columns) * 60); n.y = 90 + Math.floor(i / columns) * 60; n.direction = -Math.PI / 2; put(n); });
      }
      root.layoutDiagnostics = { engine: this.options.strict ? 'sector-growth' : 'adaptive-growth', cells: nodes.length, maxDepth: Math.max(...nodes.map(n => n.depth)) }; return root;
    }
  }
  // Reserve complete branch silhouettes instead of moving individual cells.
  // A collision can move a branch, but cannot turn it inside out.
  class BranchEnvelope {
    constructor(options = {}) { this.options = options; }
    flatten(n, a = []) { a.push(n); n.children.forEach(c => this.flatten(c, a)); return a; }
    build(root) {
      const nodes = this.flatten(root), mass = new Map();
      const measure = n => { const m = 1 + n.children.reduce((s, c) => s + measure(c), 0); mass.set(n, m); return m; }; measure(root);
      for (const n of nodes) { n.r = n === root ? 47 : n.island ? 22 : Math.max(14, 25 * Math.pow(.88, n.depth - 1)); n.x = 0; n.y = 0; }
      const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      const hull = points => { const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y), low = [], high = []; for (const v of p) { while (low.length > 1 && cross(low.at(-2), low.at(-1), v) <= 0) low.pop(); low.push(v); } for (const v of p.slice().reverse()) { while (high.length > 1 && cross(high.at(-2), high.at(-1), v) <= 0) high.pop(); high.push(v); } return low.slice(0, -1).concat(high.slice(0, -1)); };
      const circle = n => Array.from({ length: 12 }, (_, i) => ({ x: n.x + Math.cos(i * TAU / 12) * (n.r + 6), y: n.y + Math.sin(i * TAU / 12) * (n.r + 6) }));
      const bounds = poly => ({ minX: Math.min(...poly.map(p => p.x)), maxX: Math.max(...poly.map(p => p.x)), minY: Math.min(...poly.map(p => p.y)), maxY: Math.max(...poly.map(p => p.y)) });
      const overlap = (a, b, dx = 0, dy = 0) => {
        if (a.box.maxX + dx < b.box.minX || a.box.minX + dx > b.box.maxX || a.box.maxY + dy < b.box.minY || a.box.minY + dy > b.box.maxY) return false;
        for (const poly of [a.poly, b.poly]) for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], nx = q.y - p.y, ny = p.x - q.x; let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity; for (const v of a.poly) { const t = (v.x + dx) * nx + (v.y + dy) * ny; minA = Math.min(minA, t); maxA = Math.max(maxA, t); } for (const v of b.poly) { const t = v.x * nx + v.y * ny; minB = Math.min(minB, t); maxB = Math.max(maxB, t); } if (maxA < minB || maxB < minA) return false; }
        return true;
      };
      const shape = poly => ({ poly, box: bounds(poly) });
      // A convex branch translated along a ray has one forbidden interval per
      // obstacle. Solve those intervals directly instead of stepping a force sim.
      const firstFree = (a, obstacles, angle, minimum) => {
        const ux = Math.cos(angle), uy = Math.sin(angle), intervals = [];
        for (const b of obstacles) {
          let enter = -Infinity, exit = Infinity;
          for (const poly of [a.poly, b.poly]) {
            for (let i = 0; i < poly.length; i++) {
              const p = poly[i], q = poly[(i + 1) % poly.length], nx = q.y - p.y, ny = p.x - q.x;
              let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
              for (const p of a.poly) { const v = p.x * nx + p.y * ny; amin = Math.min(amin, v); amax = Math.max(amax, v); }
              for (const p of b.poly) { const v = p.x * nx + p.y * ny; bmin = Math.min(bmin, v); bmax = Math.max(bmax, v); }
              const speed = ux * nx + uy * ny;
              if (Math.abs(speed) < 1e-9) { if (amax < bmin || bmax < amin) { enter = Infinity; exit = -Infinity; break; } }
              else { const one = (bmin - amax) / speed, two = (bmax - amin) / speed; enter = Math.max(enter, Math.min(one, two)); exit = Math.min(exit, Math.max(one, two)); if (enter > exit) break; }
            }
            if (enter > exit) break;
          }
          if (enter <= exit && exit >= minimum) intervals.push([enter, exit]);
        }
        intervals.sort((a, b) => a[0] - b[0]); let length = minimum;
        for (const [start, end] of intervals) { if (start > length) break; if (end >= length) length = end + .05; }
        return length;
      };
      const move = (branch, x, y) => { branch.nodes.forEach(n => { n.x += x; n.y += y; }); branch.poly.forEach(p => { p.x += x; p.y += y; }); branch.box = bounds(branch.poly); };
      const pendulum = rows => { const a = []; rows.forEach((n, i) => i % 2 ? a.push(n) : a.unshift(n)); return a; };
      const order = rows => rows.slice().sort((a, b) => mass.get(b) - mass.get(a) || a.label.localeCompare(b.label));
      const branch = (n, heading = 0) => {
        n.direction = heading - Math.PI / 2;
        const children = order(n.children), plans = [], arranged = pendulum(children), total = arranged.reduce((s, c) => s + Math.pow(mass.get(c), .65), 0), span = this.options.compact ? Math.min(1.55, .65 + Math.sqrt(children.length) * .20) : Math.min(1.15, .45 + Math.sqrt(children.length) * .18); let cursor = heading * (this.options.compact ? .45 : 1) - span / 2;
        for (const c of arranged) { const width = span * Math.pow(mass.get(c), .65) / total, limit = this.options.compact ? .78 : .66; plans.push({ node: c, angle: clamp(cursor + width / 2, -limit, limit) }); cursor += width; }
        const placed = [shape(circle(n))], all = [n];
        for (const plan of plans.sort((a, b) => mass.get(b.node) - mass.get(a.node))) {
          const child = branch(plan.node, plan.angle), direction = plan.angle - Math.PI / 2; let length = (this.options.compact ? 62 : 75) + Math.sqrt(children.length) * 7, x, y, found = false;
          let finalDirection = direction;
          if (this.options.flex) {
            const headings = child.nodes.map(n => n.direction + Math.PI / 2), minHeading = Math.min(...headings), maxHeading = Math.max(...headings); let best;
            for (const turn of [0, .10, -.10, .20, -.20]) {
              if (minHeading + turn < -.78 || maxHeading + turn > .78) continue;
              const co = Math.cos(turn), si = Math.sin(turn), pose = shape(child.poly.map(p => ({ x: p.x * co - p.y * si, y: p.x * si + p.y * co }))), heading = direction + turn;
              const distance = firstFree(pose, placed, heading, length), score = distance + Math.abs(turn) * 80;
              if (!best || score < best.score) best = { turn, distance, heading, score };
            }
            rotate(child, best.turn); finalDirection = best.heading; length = best.distance; x = Math.cos(finalDirection) * length; y = Math.sin(finalDirection) * length; found = true;
          }
          else if (this.options.fast) { length = firstFree(child, placed, direction, length); x = Math.cos(direction) * length; y = Math.sin(direction) * length; found = true; }
          else for (let step = 0; step < 4000; step++) { x = Math.cos(direction) * length; y = Math.sin(direction) * length; if (!placed.some(other => overlap(child, other, x, y))) { found = true; break; } length += 10; }
          if (!found) throw Error('Branch envelope overflow');
          move(child, x, y); plan.node.direction = finalDirection; placed.push(child); all.push(...child.nodes);
        }
        const poly = hull(placed.flatMap(s => s.poly)); return { ...shape(poly), nodes: all };
      };
      const rotate = (b, angle) => { const co = Math.cos(angle), si = Math.sin(angle); for (const n of b.nodes) { const x = n.x, y = n.y; n.x = x * co - y * si; n.y = x * si + y * co; n.direction += angle; } for (const p of b.poly) { const x = p.x, y = p.y; p.x = x * co - y * si; p.y = x * si + y * co; } b.box = bounds(b.poly); };
      const families = ['test', 'material', 'design', 'measurement', 'manufacturing'].filter(f => root.children.some(n => n.family === f && !n.island));
      const weights = families.map(f => Math.pow(root.children.filter(n => n.family === f && !n.island).reduce((s, n) => s + mass.get(n), 0), .78));
      const sectors = new Map(), lower = this.options.fast ? -2.55 : this.options.compact ? -2.40 : -Math.PI + .12, upper = this.options.fast ? -.59 : this.options.compact ? -.74 : -.12; let cursor = lower, total = weights.reduce((a, b) => a + b, 0);
      families.forEach((f, i) => { const span = (upper - lower) * weights[i] / total; sectors.set(f, { start: cursor, end: cursor + span, center: cursor + span / 2 }); cursor += span; });
      root.direction = -Math.PI / 2; const occupied = [shape(circle(root))], entries = order(root.children.filter(n => !n.island && !n.disconnected));
      const planned = new Map();
      for (const family of families) { const rows = pendulum(entries.filter(n => n.family === family)), sector = sectors.get(family), sum = rows.reduce((s, n) => s + Math.pow(mass.get(n), .65), 0); let cursor = sector.start; for (const n of rows) { const width = (sector.end - sector.start) * Math.pow(mass.get(n), .65) / sum; planned.set(n, cursor + width / 2); cursor += width; } }
      const install = (b, angle, distance = 150) => {
        const turns = this.options.compact ? [0, .055, -.055, .11, -.11, .165, -.165, .22, -.22] : [0];
        const trials = turns.map(turn => { const direction = clamp(angle + turn, lower, upper), rotation = direction + Math.PI / 2, co = Math.cos(rotation), si = Math.sin(rotation), poly = b.poly.map(p => ({ x: p.x * co - p.y * si, y: p.x * si + p.y * co })); return { direction, shape: shape(poly) }; });
        if (this.options.fast) {
          const field = bounds(occupied.flatMap(s => s.poly)); let best;
          for (const trial of trials) {
            const minimum = Math.max(distance, (35 + trial.shape.box.maxY) / -Math.sin(trial.direction)), length = firstFree(trial.shape, occupied, trial.direction, minimum), x = Math.cos(trial.direction) * length, y = Math.sin(trial.direction) * length;
            const width = Math.max(field.maxX, trial.shape.box.maxX + x) - Math.min(field.minX, trial.shape.box.minX + x), height = Math.max(field.maxY, trial.shape.box.maxY + y) - Math.min(field.minY, trial.shape.box.minY + y);
            const score = Math.max(width / 1.6, height) + length * .13 + Math.abs(trial.direction - angle) * 180;
            if (!best || score < best.score) best = { ...trial, x, y, score };
          }
          rotate(b, best.direction + Math.PI / 2); move(b, best.x, best.y); occupied.push(b); return;
        }
        for (let i = 0; i < 5000; i++) for (const trial of trials) { const length = distance + i * 14, x = Math.cos(trial.direction) * length, y = Math.sin(trial.direction) * length; if (!occupied.some(other => overlap(trial.shape, other, x, y))) { rotate(b, trial.direction + Math.PI / 2); move(b, x, y); occupied.push(b); return; } }
        throw Error('Cannot install branch');
      };
      for (const n of entries) { n.direction = -Math.PI / 2; install(branch(n), planned.get(n)); }
      // Unlinked standards form small, quiet canopy patches, with no invented edges.
      for (const family of families) {
        const floating = root.children.filter(n => n.family === family && n.disconnected && !n.island).sort((a, b) => a.label.localeCompare(b.label)), sector = sectors.get(family), chunkSize = this.options.fast ? 12 : 18, chunks = Math.ceil(floating.length / chunkSize);
        for (let chunk = 0; chunk < chunks; chunk++) {
          const rows = floating.slice(chunk * chunkSize, (chunk + 1) * chunkSize), columns = Math.ceil(Math.sqrt(rows.length * 1.4));
          rows.forEach((n, i) => { n.x = ((i % columns) - (columns - 1) / 2) * 64 + (Math.floor(i / columns) % 2) * (this.options.fast ? 32 : 15); n.y = -Math.floor(i / columns) * (this.options.fast ? 57 : 61); if (this.options.fast) { n.x += (hash(n.id) - .5) * 4; n.y += (hash(n.id + 'y') - .5) * 4; } n.direction = -Math.PI / 2; });
          const b = { ...shape(hull(rows.flatMap(circle))), nodes: rows }, angle = sector.start + (sector.end - sector.start) * (chunk + .5) / chunks; install(b, angle, 260);
        }
      }
      for (const family of ['measurement', 'manufacturing']) {
        const group = root.children.filter(n => n.family === family && n.island), columns = Math.max(1, Math.ceil(Math.sqrt(group.length * 1.4))), side = family === 'measurement' ? -1 : 1;
        group.forEach((n, i) => { n.x = side * (100 + (i % columns) * 60); n.y = 90 + Math.floor(i / columns) * 60; n.direction = -Math.PI / 2; });
      }
      root.layoutDiagnostics = { engine: this.options.flex ? 'flexible-canopy' : this.options.fast ? 'silhouette-canopy' : this.options.compact ? 'compact-canopy' : 'branch-envelope', cells: nodes.length, maxDepth: Math.max(...nodes.map(n => n.depth)) }; return root;
    }
  }
  window.LayoutCandidates = { 'sector-growth': class extends GrowthCanopy { constructor() { super({ strict: true }); } }, 'adaptive-growth': GrowthCanopy, 'branch-envelope': BranchEnvelope, 'compact-canopy': class extends BranchEnvelope { constructor() { super({ compact: true }); } }, 'silhouette-canopy': class extends BranchEnvelope { constructor() { super({ compact: true, fast: true }); } }, 'flexible-canopy': class extends BranchEnvelope { constructor() { super({ compact: true, fast: true, flex: true }); } } };
})();
