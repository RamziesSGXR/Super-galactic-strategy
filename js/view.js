// Draws the galactic map on a canvas: lanes, planets, announced attacks, planned operations and live battles.
import { C } from './config.js';

const SIZE = { capital: 11, home: 9, junction: 8, gate: 7, frontier: 7, outer: 6, mid: 6 };
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
    // The map is a disc. Room is left for names at the top and the bulletin strip at the bottom.
    const topPad = 26, botPad = 44;
    this.R = Math.max(60, Math.min((this.w - 36) / 2, (this.h - topPad - botPad) / 2) / 0.97);
    this.cx = this.w / 2; this.cy = topPad + (this.h - topPad - botPad) / 2;
    this.k = Math.max(0.72, Math.min(1.5, this.R / 250));
  }
  xy(p) { return [this.cx + p.x * this.R, this.cy + p.y * this.R]; }
  pick(g, x, y) {
    let best = null, bd = 24 * 24;
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
    for (const r of [0.17, 0.34, 0.53, 0.73, 0.94]) { c.beginPath(); c.arc(this.cx, this.cy, r * this.R, 0, 7); c.stroke(); }
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
        const F = g.F[C.factions[g.map.home.indexOf(p.id)]];
        if (F.state === 'warn') { c.strokeStyle = C.color.foundry; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5); c.setLineDash([4, 4]); c.beginPath(); c.arc(x, y, r + 6, 0, 7); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
      }
      // strategic locations: a second ring (bastion), a chevron (shipyard) or a square (fuel depot)
      c.strokeStyle = c.fillStyle = col(p.owner); c.lineWidth = 1.2;
      if (p.trait === 'bastion') { c.beginPath(); c.arc(x, y, r + 3, 0, 7); c.stroke(); }
      if (p.trait === 'shipyard') { c.beginPath(); c.moveTo(x - 4 * k, y - r - 3); c.lineTo(x, y - r - 8 * k); c.lineTo(x + 4 * k, y - r - 3); c.stroke(); }
      if (p.trait === 'depot') c.strokeRect(x - 3 * k, y - r - 9 * k, 6 * k, 6 * k);
      // one pip for each world in the system
      const n = p.worlds.length;
      for (let i = 0; i < n; i++) { c.fillStyle = C.worlds[p.worlds[i].type].col; c.fillRect(x - (n * 4 - 1) / 2 + i * 4, y + r + 2.5, 3, 3); }
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
      if (!(big || ui.sel === p.id || hot.has(p.id) || this.R > 330)) continue;
      const [x, y] = this.xy(p), r = rad(p);
      c.font = (big ? '600 11px "Chakra Petch"' : '10px "Share Tech Mono"') + ', ui-monospace, monospace';
      c.fillStyle = big || ui.sel === p.id ? TEXT : DIM;
      const up = p.kind === 'home' && p.y < -0.5;
      c.fillText(p.name.toUpperCase(), x, up ? y - r - 17 : y + r + (g.battles.some(b => b.pid === p.id) ? 26 : 8));
    }
  }
}

// The inside of one star system: its star and its worlds, each drawn by kind, with the missions planned on them.
export function drawSystem(cv, g, p, missions, t) {
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  const d = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
  const c = cv.getContext('2d'), w = r.width, h = r.height, n = p.worlds.length;
  c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = '#070908'; c.fillRect(0, 0, w, h);
  const sx = -18, sy = h * 0.5, oc = col(p.owner);
  c.fillStyle = '#f2e3a8'; c.beginPath(); c.arc(sx, sy, 44, 0, 7); c.fill();
  c.fillStyle = '#fff6d6'; c.beginPath(); c.arc(sx, sy, 34, 0, 7); c.fill();
  c.textAlign = 'center';
  p.worlds.forEach((wd, i) => {
    const orb = n === 1 ? 78 + (w - 118) / 2 : 78 + i * (w - 118) / (n - 1);
    c.strokeStyle = 'rgba(230,234,220,0.13)'; c.lineWidth = 1; c.beginPath(); c.arc(sx, sy, orb, -1.2, 1.2); c.stroke();
    const a = Math.sin(t * 0.12 + wd.phase) * Math.min(0.4, (h * 0.13) / orb), x = sx + Math.cos(a) * orb, y = sy + 4 + Math.sin(a) * orb;
    const R = 9 * wd.size, T = C.worlds[wd.type];
    c.save(); c.beginPath(); c.arc(x, y, R, 0, 7); c.clip();
    c.fillStyle = T.col; c.fillRect(x - R, y - R, R * 2, R * 2);
    if (wd.type === 'refinery') { c.fillStyle = 'rgba(255,240,200,0.28)'; c.fillRect(x - R, y - R * 0.55, R * 2, R * 0.3); c.fillRect(x - R, y + R * 0.15, R * 2, R * 0.22); c.fillStyle = 'rgba(90,50,20,0.35)'; c.fillRect(x - R, y - R * 0.15, R * 2, R * 0.2); }
    if (wd.type === 'forge') { c.fillStyle = '#3a2018'; c.fillRect(x - R, y - R, R * 2, R * 2); c.fillStyle = '#ff8a3d'; for (let q = 0; q < 6; q++) c.fillRect(x + Math.cos(q * 2.4 + wd.tint * 6) * R * 0.55 - 1, y + Math.sin(q * 1.7 + wd.tint * 6) * R * 0.55 - 1, 2.2, 2.2); }
    if (wd.type === 'colony' || wd.type === 'capital') { c.fillStyle = wd.type === 'capital' ? '#2f8f84' : '#4f9a6a'; c.beginPath(); c.arc(x - R * 0.3, y - R * 0.2, R * 0.5, 0, 7); c.arc(x + R * 0.35, y + R * 0.4, R * 0.35, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x - R, y - R * 0.75, R * 2, R * 0.14); }
    if (wd.type === 'fortress') { c.strokeStyle = 'rgba(20,26,24,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - R, y - R * 0.3); c.lineTo(x + R, y - R * 0.3); c.moveTo(x - R, y + R * 0.3); c.lineTo(x + R, y + R * 0.3); c.moveTo(x, y - R); c.lineTo(x, y + R); c.stroke(); }
    if (wd.type === 'barren') { c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.arc(x - R * 0.3, y - R * 0.25, R * 0.24, 0, 7); c.arc(x + R * 0.3, y + R * 0.3, R * 0.3, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.arc(x + R * 0.75, y, R * 1.05, 0, 7); c.fill();   // the night side, away from the star
    c.restore();
    if (wd.type === 'refinery') { c.strokeStyle = 'rgba(240,220,170,0.55)'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(x, y, R * 1.7, R * 0.42, -0.3, 0, 7); c.stroke(); }
    c.strokeStyle = oc; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, R + 3.5, 0, 7); c.stroke();
    c.font = '10px "Share Tech Mono", ui-monospace, monospace'; c.fillStyle = DIM; c.textBaseline = 'top';
    c.fillText(wd.name.split(' ').pop().toUpperCase(), x, y + R + 8);
    const m = missions && missions[i];
    if (m) {
      const txt = C.missions[m].name; c.font = '600 10px "Chakra Petch", ui-monospace, monospace';
      const tw = c.measureText(txt).width + 8; c.fillStyle = C.color.amber; c.fillRect(x - tw / 2, y - R - 22, tw, 14);
      c.fillStyle = '#141204'; c.textBaseline = 'middle'; c.fillText(txt, x, y - R - 14.5);
    }
  });
}
