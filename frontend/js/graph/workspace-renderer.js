window.CanvasRenderer = class CanvasRenderer {
  constructor(canvas, tooltip, callbacks = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.tooltip = tooltip; this.callbacks = callbacks;
    this.nodes = []; this.scale = 1; this.tx = 0; this.ty = 0; this.minScale = .10; this.maxScale = 80; this.selected = null; this.hover = null; this.frameId = null; this.labels = true;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas.parentElement); this.bind(); this.resize();
  }
  flatten(n) { this.nodes.push(n); n.children.forEach(c => this.flatten(c)); }
  setTree(root) { this.root = root; this.nodes = []; this.flatten(root); this.selected = null; this.hover = null; this.fitToScreen(); }
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
  pick(x, y) { const wx = (x - this.tx) / this.scale, wy = (y - this.ty) / this.scale; return [...this.nodes].reverse().find(n => Math.hypot(n.x - wx, n.y - wy) <= n.r + 3 / this.scale) || null; }
  select(node) { this.selected = node; this.tooltip.hidden = true; this.invalidate(); this.callbacks.select?.(node); }
  selectStandard(id) { const node = this.nodes.find(n => n.standard_id === id); if (!node) return false; this.select(node); this.focus(node); return true; }
  stopAnimation() { this.motion = null; }
  zoomAt(factor, x = this.width / 2, y = this.height / 2) { this.stopAnimation(); const next = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor)), wx = (x - this.tx) / this.scale, wy = (y - this.ty) / this.scale; this.tx = x - wx * next; this.ty = y - wy * next; this.scale = next; this.invalidate(); }
  cameraTo(target, animate) { if (!animate || this.reduced) { Object.assign(this, target); this.motion = null; } else this.motion = { from: { scale: this.scale, tx: this.tx, ty: this.ty }, to: target, started: performance.now() }; this.invalidate(); }
  focus(node) { const scale = Math.max(this.scale, Math.min(2.8, 42 / node.r)); this.cameraTo({ scale, tx: this.width / 2 - node.x * scale, ty: this.height * .47 - node.y * scale }, true); }
  fitToScreen(animate = false) {
    if (!this.nodes.length || !this.width) return;
    const minX = Math.min(...this.nodes.map(n => n.x - n.r)), maxX = Math.max(...this.nodes.map(n => n.x + n.r)), minY = Math.min(...this.nodes.map(n => n.y - n.r)), maxY = Math.max(...this.nodes.map(n => n.y + n.r));
    const scale = Math.max(this.minScale, Math.min((this.width - 92) / Math.max(1, maxX - minX), (this.height - 162) / Math.max(1, maxY - minY), 1.8));
    this.cameraTo({ scale, tx: this.width / 2 - (minX + maxX) / 2 * scale, ty: this.height / 2 - (minY + maxY) / 2 * scale + 4 }, animate);
  }
  invalidate() { if (this.frameId === null) this.frameId = requestAnimationFrame(time => { this.frameId = null; this.render(time); }); }
  start() { this.invalidate(); }
  color(node) {
    const ownFamily = node.standard?.classification.internal_category, color = window.FractalDemo.categories[['measurement', 'manufacturing'].includes(ownFamily) ? ownFamily : node.family]?.color || '#d7e3f2';
    if (!node.disconnected) return color;
    const rgb = color.slice(1).match(/../g).map(v => parseInt(v, 16));
    return '#' + rgb.map((v, i) => Math.round(v * .7 + [157, 175, 195][i] * .3).toString(16).padStart(2, '0')).join('');
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
      for (const node of edges) {
        const parent = node.parent, active = this.selected && (parent === this.selected || this.relatedSelections.has(parent) || path.has(node.id)), muted = this.selected && !active;
        const width = active ? 1.9 : node.strength === 3 ? 1.65 : node.strength === 2 ? 1.15 : .7;
        const d = Math.hypot(node.x - parent.x, node.y - parent.y), out = parent.depth === 0 ? node.direction : parent.direction;
        const edge = () => { c.beginPath(); c.moveTo(parent.x, parent.y); c.bezierCurveTo(parent.x + Math.cos(out) * d * .36, parent.y + Math.sin(out) * d * .36, node.x - Math.cos(node.direction) * d * .33, node.y - Math.sin(node.direction) * d * .33, node.x, node.y); };
        c.globalAlpha = muted ? .15 : active ? .92 : .28 + node.strength * .12; c.lineCap = 'round'; c.strokeStyle = '#081424'; c.lineWidth = width + 2.5; edge(); c.stroke();
        c.strokeStyle = active ? '#edf5ff' : this.color(node); c.lineWidth = width; edge(); c.stroke();
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
    c.globalAlpha = faded ? .48 : 1; const r = node.r; c.beginPath(); c.arc(node.x, node.y, r, 0, Math.PI * 2);
    c.fillStyle = root ? '#e4edf7' : '#122338'; c.fill(); c.strokeStyle = selected ? '#fff' : this.color(node); c.lineWidth = root ? 2 : selected ? 2.3 : node.depth === 1 ? 1.7 : 1.1; c.stroke();
    if (hovered || selected) { c.strokeStyle = selected ? '#ffffff45' : '#ffffff22'; c.lineWidth = 4; c.beginPath(); c.arc(node.x, node.y, r + 3, 0, Math.PI * 2); c.stroke(); }
    if (child) { c.strokeStyle = '#d8bc7b'; c.lineWidth = 1.8; c.beginPath(); c.arc(node.x, node.y, r + 4, 0, Math.PI * 2); c.stroke(); }
    if (node.cycle) { c.fillStyle = '#d7b66e'; c.beginPath(); c.arc(node.x + r * .7, node.y - r * .7, 3.2, 0, Math.PI * 2); c.fill(); }
    if (node.standard?.classification.origin === 'international') { c.strokeStyle = this.color(node); c.lineWidth = .6; c.beginPath(); c.arc(node.x, node.y, r - 3, 0, Math.PI * 2); c.stroke(); }
    let fs = root ? 11 : Math.min(11, r * .45); const labels = root ? node.product.name.replace(' elements', '\nelements').replace(' modules', '\nmodules').replace(' separators', '\nseparators').split('\n') : [node.label];
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = root ? '#183653' : '#e8eef7';
    for (let i = 0; i < labels.length; i++) { let size = fs; c.font = '600 ' + size + 'px Segoe UI'; while (c.measureText(labels[i]).width > r * 1.73 && size > 3) { size -= .3; c.font = '600 ' + size + 'px Segoe UI'; } c.fillText(labels[i], node.x, node.y + (i - (labels.length - 1) / 2) * 13, r * 1.76); }
    c.globalAlpha = 1;
  }
};
