window.CanvasRenderer = class CanvasRenderer {
  constructor(canvas, tooltip, callbacks = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.tooltip = tooltip; this.callbacks = callbacks;
    this.nodes = []; this.scale = 1; this.tx = 0; this.ty = 0; this.minScale = .025; this.maxScale = 80; this.selected = null; this.hover = null; this.frameId = null; this.labels = true; this.labelCache = new Map();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas.parentElement); this.bind(); this.resize();
  }
  flatten(n) { this.nodes.push(n); n.children.forEach(c => this.flatten(c)); }
  setTree(root) { this.root = root; this.nodes = []; this.flatten(root); this.labelCache.clear(); this.selected = null; this.hover = null; this.fitToScreen(); }
  resize() {
    const box = this.canvas.getBoundingClientRect(), oldWidth = this.width || box.width, oldHeight = this.height || box.height;
    this.width = box.width; this.height = box.height; this.dpr = Math.min(devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
    this.tx += (this.width - oldWidth) / 2; this.ty += (this.height - oldHeight) / 2;
    this.invalidate();
  }
  bind() {
    const local = e => { const b = this.canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); const p = local(e); this.zoomAt(Math.exp(-e.deltaY * .0015), p.x, p.y); }, { passive: false });
    this.canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; this.stopAnimation(); const p = local(e); this.drag = { x: p.x, y: p.y, startX: p.x, startY: p.y, moved: false }; this.canvas.setPointerCapture(e.pointerId); this.canvas.classList.add('is-dragging'); this.tooltip.hidden = true; });
    this.canvas.addEventListener('pointermove', e => {
      const p = local(e);
      if (this.drag) { this.tx += p.x - this.drag.x; this.ty += p.y - this.drag.y; this.drag.x = p.x; this.drag.y = p.y; this.drag.moved ||= Math.hypot(p.x - this.drag.startX, p.y - this.drag.startY) > 4; this.invalidate(); return; }
      const node = this.pick(p.x, p.y); if (node !== this.hover) { this.hover = node; this.invalidate(); }
      this.canvas.style.cursor = node ? 'pointer' : 'grab';
      if (node?.standard) {
        this.tooltip.hidden = false; this.tooltip.replaceChildren();
        const code = document.createElement('strong'), title = document.createElement('span'), hint = document.createElement('small');
        code.textContent = node.label; title.textContent = node.standard.identification.title; hint.textContent = node.cycle ? 'Return reference · expansion stops here' : node.disconnected ? 'Unlinked standard · no citations in this tree' : node.collapsedReference ? 'Repeated path · full connections available in details' : node.island ? 'Independent peripheral reference' : 'Level ' + node.depth + ' · connection strength ' + node.strength;
        this.tooltip.append(code, title, hint);
        this.tooltip.style.left = Math.min(e.clientX + 18, innerWidth - 310) + 'px'; this.tooltip.style.top = Math.min(e.clientY + 18, innerHeight - 130) + 'px';
      } else this.tooltip.hidden = true;
    });
    const release = (e, cancel = false) => { if (!this.drag) return; const click = !this.drag.moved && !cancel; this.drag = null; this.canvas.classList.remove('is-dragging'); if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId); if (click) { const p = local(e); this.select(this.pick(p.x, p.y)); } };
    this.canvas.addEventListener('pointerup', e => release(e)); this.canvas.addEventListener('pointercancel', e => release(e, true));
    this.canvas.addEventListener('lostpointercapture', () => { this.drag = null; this.canvas.classList.remove('is-dragging'); });
    this.canvas.addEventListener('pointerleave', () => { this.hover = null; this.tooltip.hidden = true; this.invalidate(); });
    this.canvas.addEventListener('dblclick', () => this.fitToScreen(true));
    this.canvas.addEventListener('keydown', e => { if (e.key === 'Escape') this.select(null); if (e.key === 'Home') { e.preventDefault(); this.fitToScreen(true); } });
  }
  pick(x, y) {
    const wx = (x - this.tx) / this.scale, wy = (y - this.ty) / this.scale; let inside = null, nearby = null, bestInside = Infinity, bestNearby = Infinity;
    for (const n of this.nodes) {
      const distance = Math.hypot(n.x - wx, n.y - wy);
      if (distance <= n.r && distance / n.r < bestInside) { inside = n; bestInside = distance / n.r; }
      else if (distance - n.r <= Math.min(3 / this.scale, n.r * .25) && distance - n.r < bestNearby) { nearby = n; bestNearby = distance - n.r; }
    }
    return inside || nearby;
  }
  select(node) { this.selected = node; this.tooltip.hidden = true; this.invalidate(); this.callbacks.select?.(node); }
  selectStandard(id) { const node = this.nodes.find(n => n.standard_id === id); if (!node) return false; this.select(node); this.focus(node); return true; }
  stopAnimation() { this.motion = null; }
  zoomAt(factor, x = this.width / 2, y = this.height / 2) { this.stopAnimation(); const next = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor)), wx = (x - this.tx) / this.scale, wy = (y - this.ty) / this.scale; this.tx = x - wx * next; this.ty = y - wy * next; this.scale = next; this.invalidate(); }
  cameraTo(target, animate) { if (!animate || this.reduced) { Object.assign(this, target); this.motion = null; } else this.motion = { from: { scale: this.scale, tx: this.tx, ty: this.ty }, to: target, started: performance.now() }; this.invalidate(); }
  focus(node) { const scale = Math.max(this.scale, Math.min(2.8, 42 / node.r)); this.cameraTo({ scale, tx: this.width / 2 - node.x * scale, ty: this.height * .47 - node.y * scale }, true); }
  fitToScreen(animate = false) {
    if (!this.nodes.length || !this.width) return;
    const minX = Math.min(...this.nodes.map(n => n.x - n.r)), maxX = Math.max(...this.nodes.map(n => n.x + n.r)), minY = Math.min(...this.nodes.map(n => n.y - n.r)), maxY = Math.max(...this.nodes.map(n => n.y + n.r));
    const top = Math.min(132, this.height * .21), bottom = 80, available = Math.max(100, this.height - top - bottom);
    const scale = Math.max(this.minScale, Math.min((this.width - 92) / Math.max(1, maxX - minX), available / Math.max(1, maxY - minY), 1.8));
    this.cameraTo({ scale, tx: this.width / 2 - (minX + maxX) / 2 * scale, ty: top + available / 2 - (minY + maxY) / 2 * scale }, animate);
  }
  invalidate() { if (this.frameId === null) this.frameId = requestAnimationFrame(time => { this.frameId = null; this.render(time); }); }
  start() { this.invalidate(); }
  color(node) {
    const ownFamily = node.standard?.classification.internal_category, color = window.FractalDemo.categories[['measurement', 'manufacturing'].includes(ownFamily) ? ownFamily : node.family]?.color || '#d7e3f2';
    if (!node.disconnected) return color;
    const rgb = color.slice(1).match(/../g).map(v => parseInt(v, 16));
    return '#' + rgb.map((v, i) => Math.round(v * .7 + [157, 175, 195][i] * .3).toString(16).padStart(2, '0')).join('');
  }
  edgeCurve(node) {
    const parent = node.parent, start = parent.depth === 0 ? this.root.branchGuides?.[node.family] || parent : parent;
    const length = Math.hypot(node.x - start.x, node.y - start.y), axis = Math.atan2(node.y - start.y, node.x - start.x);
    const tangent = angle => axis + Math.max(-Math.PI / 3, Math.min(Math.PI / 3, Math.atan2(Math.sin(angle - axis), Math.cos(angle - axis))));
    const out = tangent(start.direction ?? axis), incoming = tangent(node.direction);
    return [start.x, start.y, start.x + Math.cos(out) * length * .30, start.y + Math.sin(out) * length * .30, node.x - Math.cos(incoming) * length * .30, node.y - Math.sin(incoming) * length * .30, node.x, node.y];
  }
  render(time = performance.now()) {
    if (!this.width || !this.height) return;
    if (this.motion) { const t = Math.min(1, (time - this.motion.started) / 420), eased = 1 - Math.pow(1 - t, 3); for (const k of ['scale', 'tx', 'ty']) this[k] = this.motion.from[k] + (this.motion.to[k] - this.motion.from[k]) * eased; if (t === 1) this.motion = null; }
    const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.width, this.height);
    const bg = c.createRadialGradient(this.width * .5, this.height * .39, 0, this.width * .5, this.height * .45, this.width * .8); bg.addColorStop(0, '#122339'); bg.addColorStop(.6, '#0c192b'); bg.addColorStop(1, '#081424'); c.fillStyle = bg; c.fillRect(0, 0, this.width, this.height);
    // Static, quiet reference points, not animated particle noise.
    for (let i = 0; i < 95; i++) { const x = ((i * 137.508) % 997) / 997 * this.width, y = ((i * 73.117) % 991) / 991 * this.height; c.fillStyle = i % 7 ? '#9cb7d315' : '#acc7e032'; c.beginPath(); c.arc(x, y, i % 7 ? .65 : 1, 0, Math.PI * 2); c.fill(); }
    if (this.root) {
      c.save(); c.translate(this.tx, this.ty); c.scale(this.scale, this.scale);
      const matches = this.selected?.island ? this.nodes.filter(n => !n.island && n.standard_id === this.selected.standard_id) : this.selected ? [this.selected] : [];
      const path = new Set(); for (const match of matches) for (let p = match; p; p = p.parent) path.add(p.id);
      this.relatedSelections = new Set(matches);
      const edges = this.nodes.filter(n => n.parent && !n.island && !n.floating).sort((a, b) => a.strength - b.strength);
      // Shared routing guides are visual bends, not extra standards/citations.
      // Draw each family stem once; roots no longer produce a straight starburst.
      for (const [family, guide] of Object.entries(this.root.branchGuides || {})) {
        const active = !!this.selected && edges.some(n => n.depth === 1 && n.family === family && path.has(n.id));
        c.globalAlpha = this.selected && !active ? .15 : active ? .92 : .65; c.strokeStyle = active ? '#edf5ff' : window.FractalDemo.categories[family].color; c.lineWidth = Math.max(active ? 2 : 1.7, .65 / this.scale); c.lineCap = 'round';
        c.beginPath(); c.moveTo(this.root.x, this.root.y); c.lineTo(guide.x, guide.y); c.stroke();
      }
      for (const node of edges) {
        const parent = node.parent, active = this.selected && (parent === this.selected || this.relatedSelections.has(parent) || path.has(node.id)), muted = this.selected && !active;
        const width = active ? 1.9 : node.strength === 3 ? 1.65 : node.strength === 2 ? 1.15 : .7;
        const p = this.edgeCurve(node), minX = Math.min(p[0], p[2], p[4], p[6]), maxX = Math.max(p[0], p[2], p[4], p[6]), minY = Math.min(p[1], p[3], p[5], p[7]), maxY = Math.max(p[1], p[3], p[5], p[7]);
        if (maxX * this.scale + this.tx < -10 || minX * this.scale + this.tx > this.width + 10 || maxY * this.scale + this.ty < -10 || minY * this.scale + this.ty > this.height + 10) continue;
        const edge = () => { c.beginPath(); c.moveTo(p[0], p[1]); c.bezierCurveTo(...p.slice(2)); };
        c.globalAlpha = muted ? .12 : active ? .95 : .28 + node.strength * .12; c.lineCap = 'round'; c.strokeStyle = '#081424'; c.lineWidth = width + 1.8; edge(); c.stroke();
        c.strokeStyle = active ? '#edf5ff' : this.color(node); c.lineWidth = Math.max(width, (active ? .9 : .45) / this.scale); edge(); c.stroke();
      }
      c.globalAlpha = 1;
      for (const node of this.nodes) this.drawNode(node, path);
      for (const [family, title] of [['measurement', 'MEAS · MEASUREMENT'], ['manufacturing', 'MNFG · MANUFACTURING']]) {
        const group = this.nodes.filter(n => n.island && n.family === family); if (!group.length) continue;
        const minX = Math.min(...group.map(n => n.x - n.r)) - 20, minY = Math.min(...group.map(n => n.y - n.r)) - 35, maxX = Math.max(...group.map(n => n.x + n.r)) + 20, maxY = Math.max(...group.map(n => n.y + n.r)) + 18;
        c.strokeStyle = '#6c809b38'; c.lineWidth = 1 / this.scale; c.setLineDash([3 / this.scale, 5 / this.scale]); c.beginPath(); c.roundRect(minX, minY, maxX - minX, maxY - minY, 14); c.stroke(); c.setLineDash([]);
        c.font = '500 11px Segoe UI'; c.fillStyle = '#b0c2d6'; c.textAlign = 'left'; c.fillText(title, minX + 12, minY + 15);
      }
      c.restore();
    }
    this.callbacks.camera?.(Math.round(this.scale * 100)); if (this.motion) this.invalidate();
  }
  drawNode(node, path) {
    const c = this.ctx, selected = node === this.selected || this.relatedSelections?.has(node), child = !!this.selected && (node.parent === this.selected || this.relatedSelections?.has(node.parent)), root = !node.standard_id, hovered = node === this.hover, faded = this.selected && !selected && !child && !path.has(node.id);
    const screenRadius = node.r * this.scale;
    if ((node.x + node.r) * this.scale + this.tx < -16 || (node.x - node.r) * this.scale + this.tx > this.width + 16 || (node.y + node.r) * this.scale + this.ty < -16 || (node.y - node.r) * this.scale + this.ty > this.height + 16) return;
    c.globalAlpha = faded ? .40 : 1; const r = node.r; c.beginPath(); c.arc(node.x, node.y, r, 0, Math.PI * 2);
    c.fillStyle = root ? '#e4edf7' : '#122338'; c.fill(); c.strokeStyle = selected ? '#fff' : this.color(node); c.lineWidth = Math.max(root ? 2 : selected ? 2.3 : node.depth === 1 ? 1.7 : 1.1, .65 / this.scale); c.stroke();
    if (hovered || selected) { c.strokeStyle = selected ? '#ffffff45' : '#ffffff22'; c.lineWidth = 4; c.beginPath(); c.arc(node.x, node.y, r + 3, 0, Math.PI * 2); c.stroke(); }
    if (child) { c.strokeStyle = '#d8bc7b'; c.lineWidth = 1.8; c.beginPath(); c.arc(node.x, node.y, r + 4, 0, Math.PI * 2); c.stroke(); }
    if (node.cycle) { c.fillStyle = '#d7b66e'; c.beginPath(); c.arc(node.x + r * .7, node.y - r * .7, 3.2, 0, Math.PI * 2); c.fill(); }
    if (node.standard?.classification.origin === 'international') { c.strokeStyle = this.color(node); c.lineWidth = .6; c.beginPath(); c.arc(node.x, node.y, r - 3, 0, Math.PI * 2); c.stroke(); }
    if (this.labels && screenRadius >= 10) {
      const key = node.label + ':' + r; let label = this.labelCache.get(key);
      if (!label) {
        let lines = [node.label], size = root ? 11 : Math.min(11, r * .52);
        if (node.label.length > 10) {
          const words = node.label.split(/(?<=[ -])/), breaks = words.slice(0, -1).map((_, i) => [words.slice(0, i + 1).join('').trim(), words.slice(i + 1).join('').trim()]);
          breaks.sort((a, b) => Math.max(...a.map(s => s.length)) - Math.max(...b.map(s => s.length))); if (breaks[0]) lines = breaks[0];
        }
        while (size > 5) { c.font = '600 ' + size + 'px Segoe UI'; if (lines.every(text => c.measureText(text).width <= r * 1.66)) break; size -= .3; }
        label = { lines, size }; this.labelCache.set(key, label);
      }
      // At overview scale show a clean canopy, rather than illegible 1px text.
      // Hover still shows the complete code/title; zoom reveals the cell label.
      if (label.size * this.scale >= 7) {
        c.font = '600 ' + label.size + 'px Segoe UI'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = root ? '#183653' : '#e8eef7';
        label.lines.forEach((text, i) => c.fillText(text, node.x, node.y + (i - (label.lines.length - 1) / 2) * label.size * 1.18, r * 1.73));
      }
    }
    c.globalAlpha = 1;
  }
};
