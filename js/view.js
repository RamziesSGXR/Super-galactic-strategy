// Draws the galactic map on a canvas: lanes, planets, announced attacks, planned operations and live battles.
import { C } from './config.js';

const SIZE = { capital: 12, home: 10, junction: 8, gate: 7, staging: 7, mid: 6 };
const col = o => C.color[o] || C.color.fed;
const TEXT = '#e6eadc', DIM = 'rgba(230,234,220,0.62)', GROUND = '#0b0d0c';

export class View {
  constructor(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); this.w = this.h = 1; }
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * d); this.cv.height = Math.round(r.height * d);
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px';
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    // The map is a three-pointed shape: about 1.72 R wide and 1.62 R tall, with the capital above the middle.
    // Room is left for names at the top and the bulletin strip at the bottom.
    const topPad = 30, botPad = 48;
    this.R = Math.max(60, Math.min((this.w - 44) / 1.72, (this.h - topPad - botPad) / 1.62));
    this.cx = this.w / 2; this.cy = topPad + (this.h - topPad - botPad - 1.62 * this.R) / 2 + this.R * 0.98;
    this.k = Math.max(0.8, Math.min(1.5, this.R / 230));
  }
  xy(p) { return [this.cx + p.x * this.R, this.cy + p.y * this.R]; }
  pick(g, x, y) {
    let best = null, bd = 30 * 30;
    for (const p of g.P) { const [a, b] = this.xy(p), d = (a - x) ** 2 + (b - y) ** 2; if (d < bd) { bd = d; best = p.id; } }
    return best;
  }
  arrow(a, b, color, dash, label, ra, rb) {
    const c = this.ctx, [x1, y1] = this.xy(a), [x2, y2] = this.xy(b), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, sx = x1 + ux * (ra + 3), sy = y1 + uy * (ra + 3), ex = x2 - ux * (rb + 5), ey = y2 - uy * (rb + 5);
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 2; c.setLineDash(dash);
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - ux * 8 - uy * 4.5, ey - uy * 8 + ux * 4.5); c.lineTo(ex - ux * 8 + uy * 4.5, ey - uy * 8 - ux * 4.5); c.fill();
    if (label) {
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      c.font = '10px "Share Tech Mono", ui-monospace, monospace'; const tw = c.measureText(label).width + 8;
      c.fillStyle = 'rgba(12,16,14,0.92)'; c.fillRect(mx - tw / 2, my - 7, tw, 14);
      c.strokeStyle = color; c.lineWidth = 1; c.strokeRect(mx - tw / 2 + 0.5, my - 6.5, tw - 1, 13);
      c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, mx, my + 0.5);
    }
  }
  draw(g, ui, t) {
    const c = this.ctx, k = this.k, fl = g.fedLinked(), rad = p => SIZE[p.kind] * k;
    c.fillStyle = GROUND; c.fillRect(0, 0, this.w, this.h);
    c.strokeStyle = 'rgba(127,233,224,0.07)'; c.lineWidth = 1;
    for (const r of [0.21, 0.4, 0.6, 0.79, 0.96]) { c.beginPath(); c.arc(this.cx, this.cy, r * this.R, 0, 7); c.stroke(); }
    // lanes
    for (const p of g.P) for (const n of p.adj) {
      if (n < p.id) continue; const q = g.P[n], [x1, y1] = this.xy(p), [x2, y2] = this.xy(q);
      c.globalAlpha = p.owner === q.owner ? 0.5 : 0.22;
      c.strokeStyle = p.owner === q.owner ? col(p.owner) : TEXT; c.lineWidth = p.owner === q.owner ? 1.4 : 1;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    c.globalAlpha = 1;
    const hot = new Set();
    if (g.phase === 'plan') {
      for (const th of g.threats) { hot.add(th.to); this.arrow(g.P[th.from], g.P[th.to], col(th.f), [5, 4], th.str.toFixed(0), rad(g.P[th.from]), rad(g.P[th.to])); }
      for (let s = 0; s < 3; s++) {
        const o = g.ops[s]; if (!o) continue; hot.add(o.target);
        const from = g.P[o.target].adj.find(n => fl.has(n)); if (from == null) continue;
        this.arrow(g.P[from], g.P[o.target], C.color.amber, [], g.count(s) ? g.opStrength(s).toFixed(0) : '', rad(g.P[from]), rad(g.P[o.target]));
      }
    }
    // planets
    for (const p of g.P) {
      const [x, y] = this.xy(p), r = rad(p), enemy = p.owner !== 'fed', cut = !enemy && !fl.has(p.id);
      c.fillStyle = GROUND; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      if (enemy) { c.globalAlpha = 0.3; c.fillStyle = col(p.owner); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.globalAlpha = 1; }
      c.strokeStyle = col(p.owner); c.lineWidth = 1.8; c.globalAlpha = cut ? 0.45 : 1; c.setLineDash(cut ? [3, 3] : []);
      c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      if (p.kind === 'capital') { c.beginPath(); c.arc(x, y, r + 4, 0, 7); c.lineWidth = 1; c.stroke(); c.fillStyle = col('fed'); c.beginPath(); c.arc(x, y, 3 * k, 0, 7); c.fill(); }
      if (p.kind === 'junction') { c.fillStyle = col(p.owner); c.fillRect(x - 2 * k, y - 2 * k, 4 * k, 4 * k); }
      if (p.kind === 'home') {
        const F = g.F[C.factions[p.sector]];
        if (F.state === 'warn') { c.strokeStyle = C.color.foundry; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5); c.setLineDash([4, 4]); c.beginPath(); c.arc(x, y, r + 6, 0, 7); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
      }
      if (g.phase === 'plan' && enemy && g.canTarget(p.id)) {   // can be attacked this round
        c.strokeStyle = C.color.amber; c.lineWidth = 1.4; const q = r + 4;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.beginPath(); c.moveTo(x + sx * q, y + sy * (q - 4)); c.lineTo(x + sx * q, y + sy * q); c.lineTo(x + sx * (q - 4), y + sy * q); c.stroke(); }
      }
      if (ui.sel === p.id) { c.strokeStyle = C.color.amber; c.lineWidth = 1.6; c.strokeRect(x - r - 7, y - r - 7, (r + 7) * 2, (r + 7) * 2); }
    }
    // battles
    for (const b of g.battles) {
      const p = g.P[b.pid], [x, y] = this.xy(p), r = rad(p) + 5; hot.add(b.pid);
      c.lineWidth = 3.5; c.strokeStyle = col(b.f); c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
      c.strokeStyle = col('fed'); c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + b.p * Math.PI * 2); c.stroke();
      if (ui.selBattle === b.id) { c.strokeStyle = C.color.amber; c.lineWidth = 1.4; c.strokeRect(x - r - 9, y - r - 9, (r + 9) * 2, (r + 9) * 2); }
      if (b.done) {
        const txt = b.evac ? 'RECALLED' : b.kind === 'op' ? (b.win ? 'TAKEN' : 'FAILED') : (b.win ? 'HELD' : 'LOST');
        c.font = '600 11px "Chakra Petch", ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
        const tw = c.measureText(txt).width + 10; c.fillStyle = 'rgba(12,16,14,0.95)'; c.fillRect(x - tw / 2, y - r - 22, tw, 16);
        c.fillStyle = b.win || b.evac ? col('fed') : C.color.foundry; c.fillText(txt, x, y - r - 14);
        continue;
      }
      // Fleet ships: the count shows each side's strength.
      const ships = (n, rr, dir, color) => {
        c.fillStyle = color;
        for (let i = 0; i < n; i++) {
          const a = dir * t * 1.6 + i * (Math.PI * 2 / n), sx = x + Math.cos(a) * rr, sy = y + Math.sin(a) * rr, h = a + dir * Math.PI / 2;
          c.beginPath(); c.moveTo(sx + Math.cos(h) * 5, sy + Math.sin(h) * 5);
          c.lineTo(sx + Math.cos(h + 2.5) * 4, sy + Math.sin(h + 2.5) * 4); c.lineTo(sx + Math.cos(h - 2.5) * 4, sy + Math.sin(h - 2.5) * 4); c.fill();
        }
      };
      ships(Math.max(1, Math.min(9, Math.round(b.P / 3))), r + 8, 1, col('fed'));
      ships(Math.max(1, Math.min(9, Math.round(b.E / 3))), r + 16, -1, col(b.f));
    }
    // names
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (const p of g.P) {
      const big = p.kind === 'capital' || p.kind === 'home';
      if (!(big || ui.sel === p.id || hot.has(p.id) || this.R > 300)) continue;
      const [x, y] = this.xy(p), r = rad(p);
      c.font = (big ? '600 11px "Chakra Petch"' : '10px "Share Tech Mono"') + ', ui-monospace, monospace';
      c.fillStyle = big || ui.sel === p.id ? TEXT : DIM;
      const up = p.kind === 'home' && p.sector === 0;
      c.fillText(p.name.toUpperCase(), x, up ? y - r - 17 : y + r + (g.battles.some(b => b.pid === p.id) ? 24 : 6));
    }
  }
}
