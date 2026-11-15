// Draws the galaxy map: the three war fronts, the rings of systems and their lanes, and the fleets, which are the
// pieces of the game. The map can be zoomed and dragged.
import { C } from './config.js';

const SIZE = { capital: 11, home: 9, sys: 5.5 };
export const col = o => C.color[o] || C.color.fed;
export const TEXT = '#e6eadc', DIM = 'rgba(230,234,220,0.62)', GROUND = '#0b0d0c';
export const MONO = '"Share Tech Mono", ui-monospace, monospace', HEAD = '"Chakra Petch", ui-monospace, monospace';


function shield(c, x, y, s, stroke, fill) {
  c.beginPath(); c.moveTo(x - s, y - s); c.lineTo(x + s, y - s); c.lineTo(x + s, y + s * 0.2); c.lineTo(x, y + s * 1.25); c.lineTo(x - s, y + s * 0.2); c.closePath();
  c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.lineWidth = 1.6; c.stroke();
}

export class View {
  constructor(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); this.w = this.h = 1; this.zoom = 1; this.ox = 0; this.oy = 0; this.rot = 0; this.goal = null; }
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * d); this.cv.height = Math.round(r.height * d);
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px';
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    // The map is a disc. Room is left for the turn strip at the top and the bulletin strip at the bottom.
    const topPad = 62, botPad = 40;
    this.R0 = Math.max(60, Math.min((this.w - 30) / 2, (this.h - topPad - botPad) / 2) / 0.98);
    this.cx0 = this.w / 2; this.cy0 = topPad + (this.h - topPad - botPad) / 2;
    this._apply();
  }
  _apply() {
    this.zoom = Math.max(1, Math.min(4.5, this.zoom));
    this.R = this.R0 * this.zoom;
    const lim = this.R0 * this.zoom * 0.75;
    this.ox = Math.max(-lim, Math.min(lim, this.ox)); this.oy = Math.max(-lim, Math.min(lim, this.oy));
    this.cx = this.cx0 + this.ox; this.cy = this.cy0 + this.oy;
    this.k = Math.max(0.7, Math.min(1.5, this.R0 / 260)) * Math.min(1.7, Math.sqrt(this.zoom));
  }
  // Zoom by a factor, keeping the point under (x, y) where it is.
  zoomAt(f, x = this.cx0, y = this.cy0) {
    this.goal = null;
    const z = Math.max(1, Math.min(4.5, this.zoom * f)), r = z / this.zoom;
    this.ox = x - this.cx0 - (x - this.cx) * r; this.oy = y - this.cy0 - (y - this.cy) * r;
    this.zoom = z; this._apply();
  }
  pan(dx, dy) { this.goal = null; this.ox += dx; this.oy += dy; this._apply(); }
  reset() { this.zoom = 1; this.ox = this.oy = 0; this.rot = 0; this.goal = null; this._apply(); }
  // Turn and close in on one war front, so that it fills the view with its enemy's home at the top.
  // With no front, pull back to the whole map. The camera glides there over the next frames.
  focus(fi) {
    this.front = fi;
    if (fi == null || fi < 0) { this.goal = { rot: 0, zoom: 1, ox: 0, oy: 0 }; return; }
    const z = Math.max(1.5, Math.min(2.1, (this.w / this.R0) * 0.95));
    this.goal = { rot: -Math.PI / 2 - C.fronts[fi].deg * Math.PI / 180, zoom: z, ox: 0, oy: this.R0 * z * 0.5 };
  }
  _glide() {
    const g = this.goal; if (!g) return;
    let dr = g.rot - this.rot; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI;
    const k = 0.13; this.rot += dr * k; this.zoom += (g.zoom - this.zoom) * k; this.ox += (g.ox - this.ox) * k; this.oy += (g.oy - this.oy) * k;
    if (Math.abs(dr) < 0.004 && Math.abs(g.zoom - this.zoom) < 0.004 && Math.abs(g.oy - this.oy) < 0.6 && Math.abs(g.ox - this.ox) < 0.6) { this.rot = g.rot; this.zoom = g.zoom; this.ox = g.ox; this.oy = g.oy; this.goal = null; }
    this._apply();
  }
  xy(p) { const c = Math.cos(this.rot), s = Math.sin(this.rot); return [this.cx + (p.x * c - p.y * s) * this.R, this.cy + (p.x * s + p.y * c) * this.R]; }
  pick(g, x, y) {
    let best = null, bd = 22 * 22;
    for (const p of g.P) { const [a, b] = this.xy(p), d = (a - x) ** 2 + (b - y) ** 2; if (d < bd) { bd = d; best = p.id; } }
    return best;
  }
  // A fleet: a small wedge of ships flying toward `ang`, with a number under it. These are the pieces on the board.
  fleet(x, y, ang, n, color, label, ring) {
    const c = this.ctx, k = Math.min(1.4, this.k + 0.2), ca = Math.cos(ang), sa = Math.sin(ang);
    const slots = [[0, 0], [-7, -5], [-7, 5], [-14, -10], [-14, 10], [-14, 0]];
    if (ring) { c.strokeStyle = C.color.amber; c.lineWidth = 1.6; c.beginPath(); c.arc(x - ca * 5 * k, y - sa * 5 * k, 13 * k, 0, 7); c.stroke(); }
    c.fillStyle = color; c.strokeStyle = GROUND; c.lineWidth = 1;
    for (let i = 0; i < Math.min(n, slots.length); i++) {
      const [fx, fy] = slots[i], px = x + (fx * ca - fy * sa) * k, py = y + (fx * sa + fy * ca) * k;
      c.beginPath(); c.moveTo(px + ca * 6 * k, py + sa * 6 * k);
      c.lineTo(px + Math.cos(ang + 2.5) * 5 * k, py + Math.sin(ang + 2.5) * 5 * k); c.lineTo(px + Math.cos(ang - 2.5) * 5 * k, py + Math.sin(ang - 2.5) * 5 * k);
      c.closePath(); c.fill(); c.stroke();
    }
    if (label) {
      c.font = '600 10px ' + HEAD; const tw = c.measureText(label).width + 6, lx = x - ca * 5 * k, ly = y + 14 * k;
      c.fillStyle = 'rgba(12,16,14,0.92)'; c.fillRect(lx - tw / 2, ly - 7, tw, 13);
      c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, lx, ly);
    }
  }
  along(a, b, f) { const [x1, y1] = this.xy(a), [x2, y2] = this.xy(b); return [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, Math.atan2(y2 - y1, x2 - x1)]; }
  arrow(a, b, color, dash, ra, rb) {
    const c = this.ctx, [x1, y1] = this.xy(a), [x2, y2] = this.xy(b), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, sx = x1 + ux * (ra + 3), sy = y1 + uy * (ra + 3), ex = x2 - ux * (rb + 5), ey = y2 - uy * (rb + 5);
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 2.2; c.setLineDash(dash);
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - ux * 8 - uy * 4.5, ey - uy * 8 + ux * 4.5); c.lineTo(ex - ux * 8 + uy * 4.5, ey - uy * 8 - ux * 4.5); c.fill();
  }
  // Where a side's fleet sits beside its system: yours below left, the enemy's above right.
  post(p, owner) { const [x, y] = this.xy(p), d = (SIZE[p.kind] + 9) * this.k; return owner === 'fed' ? [x - d, y + d * 0.75] : [x + d, y - d * 0.75]; }

  draw(g, ui, t) {
    this._glide();
    const c = this.ctx, k = this.k, fl = g.fedLinked(), rad = p => SIZE[p.kind] * k, rd = Math.PI / 180, rot = this.rot;
    c.fillStyle = GROUND; c.fillRect(0, 0, this.w, this.h);
    // the three war fronts: the one being played is lit in its enemy's colour
    C.fronts.forEach((fr, fi) => {
      const a0 = (fr.deg - 60) * rd + rot, a1 = (fr.deg + 60) * rd + rot, on = g.fi === fi, war = g.atWar(fi);
      c.fillStyle = col(fr.f); c.globalAlpha = on ? 0.1 : war ? 0.03 : 0;
      c.beginPath(); c.moveTo(this.cx, this.cy); c.arc(this.cx, this.cy, this.R * 0.99, a0, a1); c.closePath(); c.fill();
      c.globalAlpha = 0.25; c.strokeStyle = TEXT; c.lineWidth = 1; c.setLineDash([2, 5]);
      c.beginPath(); c.moveTo(this.cx, this.cy); c.lineTo(this.cx + Math.cos(a0) * this.R, this.cy + Math.sin(a0) * this.R); c.stroke(); c.setLineDash([]);
      c.globalAlpha = on ? 1 : 0.5; c.fillStyle = on ? col(fr.f) : DIM; c.font = '600 10px ' + HEAD; c.textAlign = 'center'; c.textBaseline = 'middle';
      const [hx, hy] = this.xy(g.P[g.map.home[fi]]);   // the front's name sits by its enemy's home: above it, or below for the south
      c.fillText(fr.name, Math.max(52, Math.min(this.w - 52, hx)), Math.max(72, hy + (hy > this.cy ? 34 : -22) * Math.max(1, k)));
      c.globalAlpha = 1;
    });
    c.strokeStyle = 'rgba(127,233,224,0.07)'; c.lineWidth = 1;
    for (const r of C.map.radius) { c.beginPath(); c.arc(this.cx, this.cy, r * this.R, 0, 7); c.stroke(); }
    // lanes
    for (const p of g.P) for (const n of p.adj) {
      if (n < p.id) continue; const q = g.P[n], [x1, y1] = this.xy(p), [x2, y2] = this.xy(q);
      c.globalAlpha = p.owner === q.owner ? 0.55 : 0.28;
      c.strokeStyle = p.owner === q.owner ? col(p.owner) : TEXT; c.lineWidth = p.owner === q.owner ? 1.4 : 1;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    c.globalAlpha = 1;
    const hot = new Set();
    // star systems
    for (const p of g.P) {
      const [x, y] = this.xy(p), r = rad(p), enemy = p.owner !== 'fed', cut = !enemy && !fl.has(p.id);
      if (x < -40 || y < -40 || x > this.w + 40 || y > this.h + 40) continue;
      const dest = ui.dest && ui.dest.get(p.id);
      if (dest) { hot.add(p.id); c.strokeStyle = dest === 'attack' ? C.color.amber : col('fed'); c.lineWidth = 2; c.globalAlpha = 0.5 + 0.45 * Math.sin(t * 6); c.beginPath(); c.arc(x, y, r + 7, 0, 7); c.stroke(); c.globalAlpha = 1; }
      if (ui.valid && ui.valid.has(p.id)) { c.strokeStyle = C.color.amber; c.lineWidth = 2; c.globalAlpha = 0.45 + 0.45 * Math.sin(t * 6); c.beginPath(); c.arc(x, y, r + 8, 0, 7); c.stroke(); c.globalAlpha = 1; }
      c.fillStyle = GROUND; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      if (enemy) { c.globalAlpha = 0.35; c.fillStyle = col(p.owner); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.globalAlpha = 1; }
      c.strokeStyle = col(p.owner); c.lineWidth = 1.8; c.globalAlpha = cut ? 0.45 : 1; c.setLineDash(cut ? [3, 3] : []);
      c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      if (p.kind === 'capital') { c.beginPath(); c.arc(x, y, r + 4, 0, 7); c.lineWidth = 1; c.stroke(); c.fillStyle = col('fed'); c.beginPath(); c.arc(x, y, 3 * k, 0, 7); c.fill(); }
      if (p.kind === 'home') {
        const F = g.F[g.facOf(p)];
        c.fillStyle = col(p.owner); c.fillRect(x - 2.5 * k, y - 2.5 * k, 5 * k, 5 * k);
        if (F.state === 'warn') { c.strokeStyle = C.color.foundry; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5); c.setLineDash([4, 4]); c.beginPath(); c.arc(x, y, r + 6, 0, 7); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
      }
      if (p.site && !enemy) { c.strokeStyle = C.color.amber; c.lineWidth = 1.4; c.strokeRect(x + r + 1, y + r - 1, 5 * k, 5 * k); }   // a special site
      if (ui.sel === p.id) { hot.add(p.id); c.strokeStyle = C.color.amber; c.lineWidth = 1.6; c.strokeRect(x - r - 6, y - r - 6, (r + 6) * 2, (r + 6) * 2); }
      if (ui.hint === p.id) {   // the tutorial is pointing at this system
        const q = r + 9 + 4 * Math.sin(t * 5); c.strokeStyle = C.color.amber; c.lineWidth = 2.4; c.beginPath(); c.arc(x, y, q, 0, 7); c.stroke();
        c.globalAlpha = 0.35; c.beginPath(); c.arc(x, y, q + 6, 0, 7); c.stroke(); c.globalAlpha = 1;
      }
    }
    // a shield on each of your systems an enemy fleet could strike next turn
    if (g.phase === 'plan') for (const p of g.P) {
      const th = g.threat(p.id); if (!th) continue;
      const [x, y] = this.xy(p), r = rad(p), D = g.strength(p.id), state = D >= th.hp * 1.15 ? 0 : D >= th.hp * 0.9 ? 1 : 2;
      const colr = [col('fed'), C.color.amber, C.color.foundry][state];
      if (state === 2) { c.globalAlpha = 0.35 + 0.35 * Math.sin(t * 6); c.strokeStyle = colr; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r + 5, 0, 7); c.stroke(); c.globalAlpha = 1; }
      shield(c, x - r - 7, y - r - 5, 5 * Math.min(1.3, k + 0.3), colr, state === 2 ? 'rgba(255,106,77,0.35)' : 'rgba(12,16,14,0.95)');
    }
    // the fleets, standing beside their systems
    const moving = new Set((ui.anims || []).map(a => a.owner + ':' + a.to));
    const stacks = new Map();
    for (const f of g.fleets) stacks.set(f.owner + ':' + f.at, { owner: f.owner, at: f.at, ships: f.ships, sel: ui.fleet === f.id, idle: f.owner === 'fed' && !f.moved });
    for (const [key, s] of stacks) {
      if (moving.has(key)) continue;
      const p = g.P[s.at], [x, y] = this.post(p, s.owner), bob = s.idle && g.phase === 'plan' ? Math.sin(t * 3 + s.at) * 1.5 : 0;
      c.globalAlpha = s.owner === 'fed' && !s.idle ? 0.55 : 1;
      this.fleet(x, y + bob, (s.owner === 'fed' ? p.deg * rd : (p.deg + 180) * rd) + rot, Math.min(6, s.ships), col(s.owner), String(s.ships), s.sel);
      c.globalAlpha = 1;
    }
    // fleets on the move
    for (const a of ui.anims || []) {
      const u = Math.min(1, a.t / 0.6), [x1, y1] = this.post(g.P[a.from], a.owner), [x2, y2] = this.post(g.P[a.to], a.owner);
      this.fleet(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, Math.atan2(y2 - y1, x2 - x1), Math.min(6, a.ships), col(a.owner), String(a.ships));
    }
    // the system a battle is being fought for
    if (g.battle) { const p = g.P[g.battle.pid], [x, y] = this.xy(p), r = rad(p) + 6; hot.add(p.id); c.strokeStyle = C.color.amber; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.arc(x, y, r + 2 * Math.sin(t * 6), 0, 7); c.stroke(); c.setLineDash([]); }
    // names
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (const p of g.P) {
      const big = p.kind === 'capital' || p.kind === 'home';
      if (!(big || hot.has(p.id) || this.R > 380)) continue;
      const [x, y] = this.xy(p), r = rad(p);
      c.font = big ? '600 11px ' + HEAD : '10px ' + MONO;
      c.fillStyle = big || ui.sel === p.id ? TEXT : DIM;
      const txt = p.name.toUpperCase(), tw = c.measureText(txt).width, tx = Math.max(tw / 2 + 2, Math.min(this.w - tw / 2 - 2, x));
      c.fillText(txt, tx, y + r + (p.kind === 'sys' ? 18 : 6));
    }
  }
}
