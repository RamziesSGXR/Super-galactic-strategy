// Draws the galaxy map (lanes, star systems, announced attacks, planned operations, live battles) and the inside
// of one star system. The map can be zoomed and dragged.
import { C } from './config.js';

const SIZE = { capital: 11, home: 9, junction: 8, gate: 7, frontier: 7, outer: 6, mid: 6 };
const col = o => C.color[o] || C.color.fed;
const TEXT = '#e6eadc', DIM = 'rgba(230,234,220,0.62)', GROUND = '#0b0d0c';
const MONO = '"Share Tech Mono", ui-monospace, monospace', HEAD = '"Chakra Petch", ui-monospace, monospace';

// A battle's numbers in one place.
export function sum(b) { const f = b.fight; return { P: f.P, E: f.E, p: f.p, open: f.done ? 0 : 1, won: f.done && f.win && !f.evac ? 1 : 0, evac: !!f.evac }; }

// Small map symbols. A shield marks a system that needs defending; a reticle marks one you are attacking.
function shield(c, x, y, s, stroke, fill) {
  c.beginPath(); c.moveTo(x - s, y - s); c.lineTo(x + s, y - s); c.lineTo(x + s, y + s * 0.2); c.lineTo(x, y + s * 1.25); c.lineTo(x - s, y + s * 0.2); c.closePath();
  c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.lineWidth = 1.6; c.stroke();
}
function reticle(c, x, y, r, color) {
  c.strokeStyle = color; c.lineWidth = 1.6; c.setLineDash([4, 3]); c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); c.setLineDash([]);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.beginPath(); c.moveTo(x + dx * (r - 3), y + dy * (r - 3)); c.lineTo(x + dx * (r + 5), y + dy * (r + 5)); c.stroke(); }
}

export class View {
  constructor(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); this.w = this.h = 1; this.zoom = 1; this.ox = 0; this.oy = 0; }
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * d); this.cv.height = Math.round(r.height * d);
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px';
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    // The map is a disc. Room is left for names at the top and the bulletin strip at the bottom.
    const topPad = 58, botPad = 44;
    this.R0 = Math.max(60, Math.min((this.w - 36) / 2, (this.h - topPad - botPad) / 2) / 0.97);
    this.cx0 = this.w / 2; this.cy0 = topPad + (this.h - topPad - botPad) / 2;
    this._apply();
  }
  _apply() {
    this.zoom = Math.max(1, Math.min(4.5, this.zoom));
    this.R = this.R0 * this.zoom;
    const lim = this.R0 * (this.zoom - 1) + 20 * (this.zoom > 1 ? 1 : 0);
    this.ox = Math.max(-lim, Math.min(lim, this.ox)); this.oy = Math.max(-lim, Math.min(lim, this.oy));
    this.cx = this.cx0 + this.ox; this.cy = this.cy0 + this.oy;
    this.k = Math.max(0.72, Math.min(1.5, this.R0 / 250)) * Math.min(1.7, Math.sqrt(this.zoom));
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
    let best = null, bd = 24 * 24;
    for (const p of g.P) { const [a, b] = this.xy(p), d = (a - x) ** 2 + (b - y) ** 2; if (d < bd) { bd = d; best = p.id; } }
    return best;
  }
  // A fleet: a small wedge of ships flying toward `ang`, with its strength under it. These are the pieces on the board.
  fleet(x, y, ang, n, color, label) {
    const c = this.ctx, k = Math.min(1.5, this.k + 0.25), ca = Math.cos(ang), sa = Math.sin(ang);
    const slots = [[0, 0], [-7, -5], [-7, 5], [-14, -10], [-14, 10], [-14, 0]];
    c.fillStyle = color; c.strokeStyle = '#0b0d0c'; c.lineWidth = 1;
    for (let i = 0; i < Math.min(n, slots.length); i++) {
      const [fx, fy] = slots[i], px = x + (fx * ca - fy * sa) * k, py = y + (fx * sa + fy * ca) * k;
      c.beginPath(); c.moveTo(px + ca * 6 * k, py + sa * 6 * k);
      c.lineTo(px + Math.cos(ang + 2.5) * 5 * k, py + Math.sin(ang + 2.5) * 5 * k); c.lineTo(px + Math.cos(ang - 2.5) * 5 * k, py + Math.sin(ang - 2.5) * 5 * k);
      c.closePath(); c.fill(); c.stroke();
    }
    if (label) {
      c.font = '600 10px ' + HEAD; const tw = c.measureText(label).width + 6, lx = x - ca * 4, ly = y + 15 * k;
      c.fillStyle = 'rgba(12,16,14,0.92)'; c.fillRect(lx - tw / 2, ly - 7, tw, 13);
      c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, lx, ly);
    }
  }
  // A point part of the way along the lane from system a to system b, and the heading.
  along(a, b, f) { const [x1, y1] = this.xy(a), [x2, y2] = this.xy(b); return [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, Math.atan2(y2 - y1, x2 - x1)]; }
  // Where a fleet is while it travels a path of systems and then pulls up short of the last lane.
  onPath(g, path, to, u) {
    const pts = path.map(id => this.xy(g.P[id])); const end = this.along(g.P[path[path.length - 1]], g.P[to], 0.34); pts.push([end[0], end[1]]);
    if (pts.length < 2) return end;
    const seg = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1))), f = u * (pts.length - 1) - seg, a = pts[seg], b = pts[seg + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0])];
  }
  arrow(a, b, color, dash, label, ra, rb) {
    const c = this.ctx, [x1, y1] = this.xy(a), [x2, y2] = this.xy(b), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, sx = x1 + ux * (ra + 3), sy = y1 + uy * (ra + 3), ex = x2 - ux * (rb + 5), ey = y2 - uy * (rb + 5);
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 2; c.setLineDash(dash);
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - ux * 8 - uy * 4.5, ey - uy * 8 + ux * 4.5); c.lineTo(ex - ux * 8 + uy * 4.5, ey - uy * 8 - ux * 4.5); c.fill();
    if (label) {
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      c.font = '10px ' + MONO; const tw = c.measureText(label).width + 8;
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
      for (const th of g.threats) {
        if (th.hidden || (ui.reveal && !ui.reveal.shown.has(th))) continue; hot.add(th.to);
        this.arrow(g.P[th.from], g.P[th.to], col(th.f), [5, 4], '', rad(g.P[th.from]), rad(g.P[th.to]));
      }
      for (let s = 0; s < 3; s++) {
        const o = g.ops[s]; if (!o) continue; hot.add(o.target);
        const from = g.P[o.target].adj.find(n => fl.has(n)); if (from == null) continue;
        this.arrow(g.P[from], g.P[o.target], C.color.amber, [], '', rad(g.P[from]), rad(g.P[o.target]));
      }
    }
    // star systems
    for (const p of g.P) {
      const [x, y] = this.xy(p), r = rad(p), enemy = p.owner !== 'fed', cut = !enemy && !fl.has(p.id);
      if (x < -40 || y < -40 || x > this.w + 40 || y > this.h + 40) continue;
      if (ui.valid && ui.valid.has(p.id)) { c.strokeStyle = C.color.amber; c.lineWidth = 2; c.globalAlpha = 0.45 + 0.45 * Math.sin(t * 6); c.beginPath(); c.arc(x, y, r + 8, 0, 7); c.stroke(); c.globalAlpha = 1; }
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
      // strategic locations: a second ring (bastion), a chevron (shipyard), a square (fuel depot), a dot (relic)
      c.strokeStyle = c.fillStyle = col(p.owner); c.lineWidth = 1.2;
      if (p.trait === 'bastion') { c.beginPath(); c.arc(x, y, r + 3, 0, 7); c.stroke(); }
      if (p.trait === 'shipyard') { c.beginPath(); c.moveTo(x - 4 * k, y - r - 3); c.lineTo(x, y - r - 8 * k); c.lineTo(x + 4 * k, y - r - 3); c.stroke(); }
      if (p.trait === 'depot') c.strokeRect(x - 3 * k, y - r - 9 * k, 6 * k, 6 * k);
      if (p.relic) { c.fillStyle = C.color.amber; c.beginPath(); c.arc(x + r + 2, y - r - 2, 2.2 * k, 0, 7); c.fill(); }
      // one pip for each world, coloured by its kind
      const n = p.worlds.length, pw = 3 * Math.min(1.5, k + 0.2);
      for (let i = 0; i < n; i++) { c.fillStyle = C.worlds[p.worlds[i].type].col; c.fillRect(x - (n * (pw + 1) - 1) / 2 + i * (pw + 1), y + r + 2.5, pw, pw); }
      if (g.phase === 'plan' && g.canTarget(p.id, fl)) {   // can be attacked this round
        c.strokeStyle = C.color.amber; c.lineWidth = 1.4; const q = r + 4;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.beginPath(); c.moveTo(x + sx * q, y + sy * (q - 4)); c.lineTo(x + sx * q, y + sy * q); c.lineTo(x + sx * (q - 4), y + sy * q); c.stroke(); }
      }
      if (ui.sel === p.id) { c.strokeStyle = C.color.amber; c.lineWidth = 1.6; c.strokeRect(x - r - 7, y - r - 7, (r + 7) * 2, (r + 7) * 2); }
      if (ui.hint === p.id) {   // the tutorial is pointing at this system
        const q = r + 9 + 4 * Math.sin(t * 5); c.strokeStyle = C.color.amber; c.lineWidth = 2.4; c.beginPath(); c.arc(x, y, q, 0, 7); c.stroke();
        c.globalAlpha = 0.35; c.beginPath(); c.arc(x, y, q + 6, 0, 7); c.stroke(); c.globalAlpha = 1;
      }
    }
    // what needs defending, and what you are attacking
    if (g.phase === 'plan') {
      const dp = g.defPlan();
      for (const th of g.threats) {
        if (th.hidden || (ui.reveal && !ui.reveal.shown.has(th))) continue;
        const p = g.P[th.to], [x, y] = this.xy(p), r = rad(p), D = dp.get(th).D, pin = g.pins(th);
        const state = pin ? 0 : D >= th.str * 1.08 ? 0 : D >= th.str * 0.93 ? 1 : 2;
        const colr = [col('fed'), C.color.amber, C.color.foundry][state];
        if (state === 2) { c.globalAlpha = 0.35 + 0.35 * Math.sin(t * 6); c.strokeStyle = colr; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r + 7, 0, 7); c.stroke(); c.globalAlpha = 1; }
        shield(c, x + r + 9, y - r - 5, 6 * Math.min(1.3, k + 0.3), colr, state === 2 ? 'rgba(255,106,77,0.35)' : 'rgba(12,16,14,0.95)');
        c.font = '10px ' + MONO; c.fillStyle = colr; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(pin ? 'PIN' : D.toFixed(0), x + r + 18, y - r - 4);
      }
      for (let s = 0; s < 3; s++) {
        const o = g.ops[s]; if (!o || !o.cards.length) continue;
        const p = g.P[o.target], [x, y] = this.xy(p), r = rad(p); reticle(c, x, y, r + 7, C.color.amber);
      }
    }
    // the fleets: enemy fleets on their way to what they attack, yours gathered beside what you attack
    if (g.phase === 'plan') {
      g.threats.forEach((th, i) => {
        if (th.hidden || (ui.reveal && !ui.reveal.shown.has(th))) return;
        const u = ui.reveal ? ui.reveal.anim.get(th) : null;
        const [x, y, a] = u != null && u < 1 ? this.onPath(g, ui.reveal.path.get(th), th.to, u) : this.along(g.P[th.from], g.P[th.to], 0.34 + 0.02 * Math.sin(t * 2 + i));
        this.fleet(x, y, a, Math.max(1, Math.round(th.str / 3)), col(th.f), th.str.toFixed(0));
      });
      for (let s = 0; s < 3; s++) {
        const o = g.ops[s]; if (!o || !o.cards.length) continue;
        const from = g.P[o.target].adj.find(n => fl.has(n)); if (from == null) continue;
        const [x, y, a] = this.along(g.P[from], g.P[o.target], 0.34 + 0.02 * Math.sin(t * 2 + s));
        this.fleet(x, y, a, o.cards.length + 1, col('fed'), g.opStrength(s).toFixed(0));
      }
    }
    // battles
    for (const b of g.battles) {
      const p = g.P[b.pid], [x, y] = this.xy(p), r = rad(p) + 5, st = sum(b); hot.add(b.pid);
      c.lineWidth = 3.5; c.strokeStyle = col(b.f); c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
      c.strokeStyle = col('fed'); c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + st.p * Math.PI * 2); c.stroke();
      if (ui.selBattle === b.id) { c.strokeStyle = C.color.amber; c.lineWidth = 1.4; c.strokeRect(x - r - 9, y - r - 9, (r + 9) * 2, (r + 9) * 2); }
      if (b.kind === 'def') shield(c, x + r + 8, y - r - 3, 6, col('fed'), 'rgba(12,16,14,0.95)'); else reticle(c, x, y, r + 5, C.color.amber);
      if (!st.open) {
        const txt = st.evac ? 'RECALLED' : b.kind === 'op' ? (st.won ? 'TAKEN' : 'FAILED') : (st.won ? 'HELD' : 'LOST');
        c.font = '600 11px ' + HEAD; c.textAlign = 'center'; c.textBaseline = 'middle';
        const tw = c.measureText(txt).width + 10; c.fillStyle = 'rgba(12,16,14,0.95)'; c.fillRect(x - tw / 2, y - r - 22, tw, 16);
        c.fillStyle = st.won || st.evac ? col('fed') : C.color.foundry; c.fillText(txt, x, y - r - 14);
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
      // The attacking fleet flies in along its lane, then the two sides circle and fight.
      const src = b.kind === 'def' ? b.from : p.adj.find(n => fl.has(n)), u = Math.min(1, b.fight.t / 1.4), atk = b.kind === 'def' ? b.f : 'fed';
      if (u < 1 && src != null) {
        const [fx, fy, a] = this.along(g.P[src], p, 0.34 + (0.92 - 0.34) * u);
        this.fleet(fx, fy, a, Math.max(1, Math.round((b.kind === 'def' ? st.E : st.P) / 3)), col(atk), '');
        ships(Math.max(1, Math.min(9, Math.round((b.kind === 'def' ? st.P : st.E) / 3))), r + 8, 1, col(b.kind === 'def' ? 'fed' : b.f));
      } else {
        ships(Math.max(1, Math.min(9, Math.round(st.P / 3))), r + 8, 1, col('fed'));
        ships(Math.max(1, Math.min(9, Math.round(st.E / 3))), r + 16, -1, col(b.f));
        // tracer fire between the two rings
        if (Math.sin(t * 23 + b.id) > 0.2) { const a1 = t * 1.6 + b.id, a2 = -t * 1.6 + b.id * 2; c.strokeStyle = TEXT; c.globalAlpha = 0.6; c.lineWidth = 1; c.beginPath(); c.moveTo(x + Math.cos(a1) * (r + 8), y + Math.sin(a1) * (r + 8)); c.lineTo(x + Math.cos(a2) * (r + 16), y + Math.sin(a2) * (r + 16)); c.stroke(); c.globalAlpha = 1; }
      }
    }
    // names
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (const p of g.P) {
      const big = p.kind === 'capital' || p.kind === 'home';
      if (!(big || ui.sel === p.id || hot.has(p.id) || this.R > 330)) continue;
      const [x, y] = this.xy(p), r = rad(p);
      c.font = (big ? '600 11px ' + HEAD : '10px ' + MONO);
      c.fillStyle = big || ui.sel === p.id ? TEXT : DIM;
      const up = p.kind === 'home' && p.y < -0.5;
      c.fillText(p.name.toUpperCase(), x, up ? y - r - 17 : y + r + (g.battles.some(b => b.pid === p.id) ? 26 : 8));
    }
  }
}

// One planet in full view: the system's key world, where any fight for the system happens. Fleets gather beside it
// when an attack is planned or announced, and fight around it during a battle. Flavour only: the war is on the map.
function world(c, wd, x, y, R) {
  const T = C.worlds[wd.type];
  c.save(); c.beginPath(); c.arc(x, y, R, 0, 7); c.clip();
  c.fillStyle = T.col; c.fillRect(x - R, y - R, R * 2, R * 2);
  if (wd.type === 'refinery') { c.fillStyle = 'rgba(255,240,200,0.28)'; for (const [a, b] of [[-0.7, 0.16], [-0.3, 0.2], [0.2, 0.14], [0.55, 0.2]]) c.fillRect(x - R, y + R * a, R * 2, R * b); c.fillStyle = 'rgba(90,50,20,0.35)'; c.fillRect(x - R, y - R * 0.08, R * 2, R * 0.22); }
  if (wd.type === 'forge') { c.fillStyle = '#3a2018'; c.fillRect(x - R, y - R, R * 2, R * 2); c.fillStyle = '#ff8a3d'; for (let q = 0; q < 26; q++) { const a = q * 2.4 + wd.tint * 6, d = (0.15 + ((q * 37) % 80) / 100) * R; c.fillRect(x + Math.cos(a) * d, y + Math.sin(a * 1.3) * d, 1 + R / 26, 1 + R / 26); } }
  if (wd.type === 'colony' || wd.type === 'capital') {
    c.fillStyle = wd.type === 'capital' ? '#2f8f84' : '#4f9a6a';
    for (const [a, b, r] of [[-0.35, -0.25, 0.42], [0.3, 0.35, 0.36], [0.05, -0.55, 0.2], [-0.5, 0.45, 0.22]]) { c.beginPath(); c.arc(x + R * a, y + R * b, R * r, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(x - R, y - R * 0.78, R * 2, R * 0.1); c.fillRect(x - R * 0.2, y + R * 0.1, R * 1.2, R * 0.07);
  }
  if (wd.type === 'fortress') { c.strokeStyle = 'rgba(20,26,24,0.7)'; c.lineWidth = Math.max(1.2, R / 22); c.beginPath(); for (const f of [-0.5, 0, 0.5]) { c.moveTo(x - R, y + R * f); c.lineTo(x + R, y + R * f); c.moveTo(x + R * f, y - R); c.lineTo(x + R * f, y + R); } c.stroke(); }
  if (wd.type === 'barren') { c.fillStyle = 'rgba(0,0,0,0.3)'; for (const [a, b, r] of [[-0.3, -0.25, 0.22], [0.3, 0.3, 0.28], [0.1, -0.5, 0.12], [-0.45, 0.4, 0.14]]) { c.beginPath(); c.arc(x + R * a, y + R * b, R * r, 0, 7); c.fill(); } }
  c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.arc(x + R * 0.8, y, R * 1.08, 0, 7); c.fill();   // the night side
  c.restore();
  if (wd.type === 'refinery') { c.strokeStyle = 'rgba(240,220,170,0.55)'; c.lineWidth = Math.max(1.4, R / 16); c.beginPath(); c.ellipse(x, y, R * 1.7, R * 0.4, -0.3, 0, 7); c.stroke(); }
}
function wing(c, x, y, ang, n, color, s = 1) {
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const px = x - Math.cos(ang) * 11 * s * Math.floor((i + 1) / 2) + Math.sin(ang) * 9 * s * (i % 2 ? 1 : -1) * Math.ceil(i / 2), py = y - Math.sin(ang) * 11 * s * Math.floor((i + 1) / 2) - Math.cos(ang) * 9 * s * (i % 2 ? 1 : -1) * Math.ceil(i / 2);
    c.beginPath(); c.moveTo(px + Math.cos(ang) * 8 * s, py + Math.sin(ang) * 8 * s); c.lineTo(px + Math.cos(ang + 2.5) * 6 * s, py + Math.sin(ang + 2.5) * 6 * s); c.lineTo(px + Math.cos(ang - 2.5) * 6 * s, py + Math.sin(ang - 2.5) * 6 * s); c.fill();
  }
}
// info: { threat: strength of an announced attack or 0, enemy: its owner, op: your planned strength or 0, battle }
export function drawPlanet(cv, g, p, info, t) {
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  const d = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
  const c = cv.getContext('2d'), w = r.width, h = r.height;
  c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = '#060807'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(230,234,220,0.5)'; for (let i = 0; i < 40; i++) c.fillRect((i * 97.3 + p.id * 31) % w, (i * 53.7 + p.id * 17) % h, 1, 1);   // stars
  const x = w / 2, y = h / 2, R = Math.min(h * 0.36, w * 0.2), kw = p.worlds[p.key];
  world(c, kw, x, y, R);
  c.strokeStyle = col(p.owner); c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, R + 5, 0, 7); c.stroke();
  // the system's other worlds, small, off to the side
  let mx = w - 22; c.font = '9px ' + MONO; c.textAlign = 'center'; c.textBaseline = 'top';
  p.worlds.forEach((wd, i) => { if (i === p.key) return; world(c, wd, mx, h - 26, 7 * wd.size); mx -= 30; });
  const b = info.battle, enemy = info.enemy;
  if (b) {
    const f = b.fight, np = Math.max(1, Math.min(7, Math.round(f.P / 3))), ne = Math.max(1, Math.min(7, Math.round(f.E / 3)));
    if (!f.done) {
      // both fleets circle the planet and trade fire
      for (let i = 0; i < np; i++) { const a = t * 0.9 + i * 6.283 / np; wing(c, x + Math.cos(a) * (R + 22), y + Math.sin(a) * (R + 22) * 0.55, a + 1.57, 1, col('fed')); }
      for (let i = 0; i < ne; i++) { const a = -t * 0.8 + i * 6.283 / ne + 1; wing(c, x + Math.cos(a) * (R + 40), y + Math.sin(a) * (R + 40) * 0.55, a - 1.57, 1, col(b.f)); }
      for (let i = 0; i < 3; i++) if (Math.sin(t * 19 + i * 2.1) > 0.1) {
        const a1 = t * 0.9 + i * 2, a2 = -t * 0.8 + i * 2.6 + 1, side = Math.sin(t * 7 + i) > 0;
        c.strokeStyle = side ? col('fed') : col(b.f); c.lineWidth = 1.2; c.globalAlpha = 0.8; c.beginPath();
        c.moveTo(x + Math.cos(a1) * (R + 22), y + Math.sin(a1) * (R + 22) * 0.55); c.lineTo(x + Math.cos(a2) * (R + 40), y + Math.sin(a2) * (R + 40) * 0.55); c.stroke(); c.globalAlpha = 1;
      }
      if (Math.sin(t * 11) > 0.6) { c.fillStyle = '#fff3c4'; const a = t * 3; c.beginPath(); c.arc(x + Math.cos(a) * R * 0.6, y + Math.sin(a) * R * 0.6, 2.5, 0, 7); c.fill(); }   // flashes on the surface
    }
    const bw = Math.min(180, w * 0.5); c.fillStyle = col(b.f); c.fillRect(x - bw / 2, h - 12, bw, 5); c.fillStyle = col('fed'); c.fillRect(x - bw / 2, h - 12, bw * f.p, 5);
    if (f.done) { const txt = f.evac ? 'RECALLED' : f.win ? (b.kind === 'op' ? 'TAKEN' : 'HELD') : (b.kind === 'op' ? 'REPELLED' : 'LOST'); c.font = '700 16px ' + HEAD; c.textBaseline = 'middle'; c.fillStyle = f.win || f.evac ? col('fed') : C.color.foundry; c.fillText(txt, x, 16); }
  } else {
    // fleets waiting: the enemy's on the right if an attack is announced, yours on the left if you plan one
    if (info.threat) { const bob = Math.sin(t * 1.5) * 3; wing(c, w - 46 + bob, y - 8, Math.PI, Math.max(1, Math.min(5, Math.round(info.threat / 3))), col(enemy), 1.1); c.font = '10px ' + MONO; c.fillStyle = col(enemy); c.textBaseline = 'top'; c.fillText('INBOUND ' + info.threat.toFixed(0), w - 52, y + 22); }
    if (info.op) { const bob = Math.sin(t * 1.5 + 1) * 3; wing(c, 46 + bob, y - 8, 0, Math.max(1, Math.min(5, Math.round(info.op / 3))), col('fed'), 1.1); c.font = '10px ' + MONO; c.fillStyle = col('fed'); c.textBaseline = 'top'; c.fillText('YOUR FLEET ' + info.op.toFixed(0), 56, y + 22); }
    if (p.owner !== 'fed' && !info.op) { const n = Math.max(1, Math.min(4, Math.round(g.garrison(p.id) / 5))); for (let i = 0; i < n; i++) { const a = t * 0.5 + i * 6.283 / n; wing(c, x + Math.cos(a) * (R + 24), y + Math.sin(a) * (R + 24) * 0.5, a + 1.57, 1, col(p.owner), 0.8); } }   // its garrison on patrol
  }
  c.font = '600 11px ' + HEAD; c.fillStyle = TEXT; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(kw.name.toUpperCase(), 8, 6);
  c.font = '9.5px ' + MONO; c.fillStyle = DIM; c.fillText(C.worlds[kw.type].name, 8, 20);
}
