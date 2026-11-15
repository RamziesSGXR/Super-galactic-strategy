// Draws the galaxy map: the three war fronts, the rings of systems and their lanes, and the fleets, which are the
// pieces of the game. The map can be zoomed and dragged.
import { C } from './config.js';

const SIZE = { capital: 11, home: 9, sys: 5.5 };
export const col = o => C.color[o] || C.color.fed;
export const TEXT = '#e6eadc', DIM = 'rgba(230,234,220,0.62)', GROUND = '#0b0d0c';
export const MONO = '"Share Tech Mono", ui-monospace, monospace', HEAD = '"Chakra Petch", ui-monospace, monospace';

// A battle's numbers in one place.
export function sum(b) { const f = b.fight; return { P: f.P, E: f.E, p: f.p, open: f.done ? 0 : 1, won: f.done && f.win && !f.evac ? 1 : 0, evac: !!f.evac }; }

function shield(c, x, y, s, stroke, fill) {
  c.beginPath(); c.moveTo(x - s, y - s); c.lineTo(x + s, y - s); c.lineTo(x + s, y + s * 0.2); c.lineTo(x, y + s * 1.25); c.lineTo(x - s, y + s * 0.2); c.closePath();
  c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.lineWidth = 1.6; c.stroke();
}

export class View {
  constructor(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); this.w = this.h = 1; this.zoom = 1; this.ox = 0; this.oy = 0; }
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
    const lim = this.R0 * (this.zoom - 1) + (this.zoom > 1 ? 20 : 0);
    this.ox = Math.max(-lim, Math.min(lim, this.ox)); this.oy = Math.max(-lim, Math.min(lim, this.oy));
    this.cx = this.cx0 + this.ox; this.cy = this.cy0 + this.oy;
    this.k = Math.max(0.7, Math.min(1.5, this.R0 / 260)) * Math.min(1.7, Math.sqrt(this.zoom));
  }
  // Zoom by a factor, keeping the point under (x, y) where it is.
  zoomAt(f, x = this.cx0, y = this.cy0) {
    const z = Math.max(1, Math.min(4.5, this.zoom * f)), r = z / this.zoom;
    this.ox = x - this.cx0 - (x - this.cx) * r; this.oy = y - this.cy0 - (y - this.cy) * r;
    this.zoom = z; this._apply();
  }
  pan(dx, dy) { this.ox += dx; this.oy += dy; this._apply(); }
  reset() { this.zoom = 1; this.ox = this.oy = 0; this._apply(); }
  xy(p) { return [this.cx + p.x * this.R, this.cy + p.y * this.R]; }
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
    const c = this.ctx, k = this.k, fl = g.fedLinked(), rad = p => SIZE[p.kind] * k, rd = Math.PI / 180;
    c.fillStyle = GROUND; c.fillRect(0, 0, this.w, this.h);
    // the three war fronts: the one being played is lit in its enemy's colour
    C.fronts.forEach((fr, fi) => {
      const a0 = (fr.deg - 60) * rd, a1 = (fr.deg + 60) * rd, on = g.fi === fi, war = g.atWar(fi);
      c.fillStyle = col(fr.f); c.globalAlpha = on ? 0.1 : war ? 0.03 : 0;
      c.beginPath(); c.moveTo(this.cx, this.cy); c.arc(this.cx, this.cy, this.R * 0.99, a0, a1); c.closePath(); c.fill();
      c.globalAlpha = 0.25; c.strokeStyle = TEXT; c.lineWidth = 1; c.setLineDash([2, 5]);
      c.beginPath(); c.moveTo(this.cx, this.cy); c.lineTo(this.cx + Math.cos(a0) * this.R, this.cy + Math.sin(a0) * this.R); c.stroke(); c.setLineDash([]);
      c.globalAlpha = on ? 1 : 0.5; c.fillStyle = on ? col(fr.f) : DIM; c.font = '600 10px ' + HEAD; c.textAlign = 'center'; c.textBaseline = 'middle';
      const [hx, hy] = this.xy(g.P[g.map.home[fi]]);   // the front's name sits by its enemy's home: above it, or below for the south
      c.fillText(fr.name, Math.max(52, Math.min(this.w - 52, hx)), hy + (fr.deg === 90 ? 34 : -22) * Math.max(1, k));
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
      if (p.relic) { c.fillStyle = C.color.amber; c.beginPath(); c.arc(x + r + 1.5, y + r + 1.5, 2 * k, 0, 7); c.fill(); }
      if (p.trap && !enemy) { c.strokeStyle = C.color.amber; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y - r - 9 * k); c.lineTo(x + 4 * k, y - r - 2 * k); c.lineTo(x - 4 * k, y - r - 2 * k); c.closePath(); c.stroke(); }   // a trap laid here
      if (ui.sel === p.id) { hot.add(p.id); c.strokeStyle = C.color.amber; c.lineWidth = 1.6; c.strokeRect(x - r - 6, y - r - 6, (r + 6) * 2, (r + 6) * 2); }
      if (ui.hint === p.id) {   // the tutorial is pointing at this system
        const q = r + 9 + 4 * Math.sin(t * 5); c.strokeStyle = C.color.amber; c.lineWidth = 2.4; c.beginPath(); c.arc(x, y, q, 0, 7); c.stroke();
        c.globalAlpha = 0.35; c.beginPath(); c.arc(x, y, q + 6, 0, 7); c.stroke(); c.globalAlpha = 1;
      }
    }
    // a shield on each of your systems an enemy fleet could strike next turn
    if (g.phase === 'plan') for (const p of g.P) {
      const th = g.threat(p.id); if (!th) continue;
      const [x, y] = this.xy(p), r = rad(p), D = g.defence(p.id, th.f, fl), state = D >= th.str * 1.08 ? 0 : D >= th.str * 0.93 ? 1 : 2;
      const colr = [col('fed'), C.color.amber, C.color.foundry][state];
      if (state === 2) { c.globalAlpha = 0.35 + 0.35 * Math.sin(t * 6); c.strokeStyle = colr; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r + 5, 0, 7); c.stroke(); c.globalAlpha = 1; }
      shield(c, x - r - 7, y - r - 5, 5 * Math.min(1.3, k + 0.3), colr, state === 2 ? 'rgba(255,106,77,0.35)' : 'rgba(12,16,14,0.95)');
    }
    // your orders: a cyan arrow is a move, an amber arrow is an attack
    if (g.phase === 'plan') for (const f of g.fleets) if (f.owner === 'fed' && f.order != null) {
      const a = g.P[f.at], b = g.P[f.order]; this.arrow(a, b, b.owner === 'fed' ? col('fed') : C.color.amber, [], rad(a), rad(b));
    }
    // the fleets, standing beside their systems
    const moving = new Set((ui.anims || []).map(a => a.owner + ':' + a.to));
    const inBattle = new Set(); for (const b of g.battles) for (const id of b.fleets) inBattle.add(id);
    const stacks = new Map();
    for (const f of g.fleets) {
      if (inBattle.has(f.id)) continue;
      const key = f.owner + ':' + f.at, s = stacks.get(key) || { owner: f.owner, at: f.at, ships: 0, sel: false, idle: false };
      s.ships += f.ships; if (ui.fleet === f.id) s.sel = true; if (f.owner === 'fed' && !f.moved && f.order == null && g.canAct(f.at)) s.idle = true;
      stacks.set(key, s);
    }
    for (const [key, s] of stacks) {
      if (moving.has(key)) continue;
      const p = g.P[s.at], [x, y] = this.post(p, s.owner), bob = s.idle && g.phase === 'plan' ? Math.sin(t * 3 + s.at) * 1.5 : 0;
      c.globalAlpha = s.owner === 'fed' && g.phase === 'plan' && !s.idle ? 0.6 : 1;
      this.fleet(x, y + bob, s.owner === 'fed' ? p.deg * rd : (p.deg + 180) * rd, Math.min(6, s.ships), col(s.owner), String(s.ships), s.sel);
      c.globalAlpha = 1;
    }
    // fleets on the move
    for (const a of ui.anims || []) {
      const u = Math.min(1, a.t / 0.6), [x1, y1] = this.post(g.P[a.from], a.owner), [x2, y2] = this.post(g.P[a.to], a.owner);
      this.fleet(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, Math.atan2(y2 - y1, x2 - x1), Math.min(6, a.ships), col(a.owner), String(a.ships));
    }
    // battles: the attacking fleet flies in along its lane, then both sides circle the system and fight
    for (const b of g.battles) {
      const p = g.P[b.pid], [x, y] = this.xy(p), r = rad(p) + 5, st = sum(b); hot.add(b.pid);
      c.lineWidth = 3.5; c.strokeStyle = col(b.f); c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
      c.strokeStyle = col('fed'); c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + st.p * Math.PI * 2); c.stroke();
      if (ui.selBattle === b.id) { c.strokeStyle = C.color.amber; c.lineWidth = 1.4; c.strokeRect(x - r - 9, y - r - 9, (r + 9) * 2, (r + 9) * 2); }
      if (!st.open) {
        const txt = st.evac ? 'RECALLED' : b.kind === 'op' ? (st.won ? 'TAKEN' : 'REPELLED') : (st.won ? 'HELD' : 'LOST');
        c.font = '600 11px ' + HEAD; c.textAlign = 'center'; c.textBaseline = 'middle';
        const tw = c.measureText(txt).width + 10; c.fillStyle = 'rgba(12,16,14,0.95)'; c.fillRect(x - tw / 2, y - r - 22, tw, 16);
        c.fillStyle = st.won || st.evac ? col('fed') : C.color.foundry; c.fillText(txt, x, y - r - 14);
        continue;
      }
      const ships = (n, rr, dir, color) => {
        c.fillStyle = color;
        for (let i = 0; i < n; i++) {
          const a = dir * t * 1.6 + i * (Math.PI * 2 / n), sx = x + Math.cos(a) * rr, sy = y + Math.sin(a) * rr, h = a + dir * Math.PI / 2;
          c.beginPath(); c.moveTo(sx + Math.cos(h) * 5, sy + Math.sin(h) * 5);
          c.lineTo(sx + Math.cos(h + 2.5) * 4, sy + Math.sin(h + 2.5) * 4); c.lineTo(sx + Math.cos(h - 2.5) * 4, sy + Math.sin(h - 2.5) * 4); c.fill();
        }
      };
      const u = Math.min(1, b.fight.t / 1.2), atk = b.kind === 'def' ? b.f : 'fed', nP = Math.max(1, Math.min(8, Math.round(st.P / 3))), nE = Math.max(1, Math.min(8, Math.round(st.E / 3)));
      if (u < 1) {
        const [fx, fy, a] = this.along(g.P[b.from], p, 0.15 + 0.75 * u);
        this.fleet(fx, fy, a, Math.min(6, b.kind === 'def' ? nE : nP), col(atk), '');
        ships(b.kind === 'def' ? nP : nE, r + 8, 1, col(b.kind === 'def' ? 'fed' : b.f));
      } else {
        ships(nP, r + 8, 1, col('fed')); ships(nE, r + 16, -1, col(b.f));
        if (Math.sin(t * 23 + b.id) > 0.2) { const a1 = t * 1.6 + b.id, a2 = -t * 1.6 + b.id * 2; c.strokeStyle = TEXT; c.globalAlpha = 0.6; c.lineWidth = 1; c.beginPath(); c.moveTo(x + Math.cos(a1) * (r + 8), y + Math.sin(a1) * (r + 8)); c.lineTo(x + Math.cos(a2) * (r + 16), y + Math.sin(a2) * (r + 16)); c.stroke(); c.globalAlpha = 1; }
      }
    }
    // names
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (const p of g.P) {
      const big = p.kind === 'capital' || p.kind === 'home';
      if (!(big || hot.has(p.id) || this.R > 420)) continue;
      const [x, y] = this.xy(p), r = rad(p);
      c.font = big ? '600 11px ' + HEAD : '10px ' + MONO;
      c.fillStyle = big || ui.sel === p.id ? TEXT : DIM;
      const txt = p.name.toUpperCase(), tw = c.measureText(txt).width, tx = Math.max(tw / 2 + 2, Math.min(this.w - tw / 2 - 2, x));
      c.fillText(txt, tx, y + r + (g.battles.some(b => b.pid === p.id) ? 26 : p.kind === 'sys' ? 18 : 6));
    }
  }
}
