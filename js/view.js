// Everything drawn on a canvas: the galaxy map (view_map.js) and one planet in full view (below).
import { C } from './config.js';
import { View, col, TEXT, DIM, MONO, HEAD } from './view_map.js';
export { View };

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
// info: { battle, threat: strength of the enemy fleets beside the system or 0, enemy: whose they are, mine: your ships here, foe: enemy ships here }
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
  const b = null, enemy = info.enemy;
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
    // fleets in orbit: yours on the left, the enemy's on the right; an enemy fleet in a neighbouring system shows as a warning
    c.font = '10px ' + MONO; c.textBaseline = 'top';
    if (info.mine) { const bob = Math.sin(t * 1.5 + 1) * 3; wing(c, 50 + bob, y - 8, 0, Math.min(5, info.mine), col('fed'), 1.1); c.fillStyle = col('fed'); c.textAlign = 'left'; c.fillText(`YOUR FLEET · ${info.mine} SHIP${info.mine > 1 ? 'S' : ''}`, 10, y + 26); }
    if (info.foe) { const bob = Math.sin(t * 1.5) * 3; wing(c, w - 50 + bob, y - 8, Math.PI, Math.min(5, info.foe), col(p.owner), 1.1); c.fillStyle = col(p.owner); c.textAlign = 'right'; c.fillText(`ENEMY FLEET · ${info.foe} SHIP${info.foe > 1 ? 'S' : ''}`, w - 10, y + 26); }
    else if (info.threat) { c.fillStyle = col(enemy); c.textAlign = 'right'; c.fillText(`ENEMY NEXT DOOR · ${info.threat.toFixed(0)}`, w - 10, y + 26); if (Math.sin(t * 4) > 0) wing(c, w - 30, y - 8, Math.PI, 1, col(enemy), 0.9); }
  }
  c.font = '600 11px ' + HEAD; c.fillStyle = TEXT; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(kw.name.toUpperCase(), 8, 6);
  c.font = '9.5px ' + MONO; c.fillStyle = DIM; c.fillText(C.worlds[kw.type].name, 8, 20);
}

// The battle for a planet, shown while the card game is played. The planet sits in the middle in its holder's
// colour; your ships are on the left and the enemy's on the right, one for every three hit points left.
// `fx` is the round just played ({ ev, t }): beams for hits, an arc for a block, a glow for repairs.
export function drawBattle(cv, g, b, fx, t) {
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  const d = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
  const c = cv.getContext('2d'), w = r.width, h = r.height, p = g.P[b.pid];
  c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = '#060807'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(230,234,220,0.5)'; for (let i = 0; i < 60; i++) c.fillRect((i * 97.3 + p.id * 31) % w, (i * 53.7 + p.id * 17) % h, 1, 1);
  const x = w / 2, y = h / 2, R = Math.min(h * 0.3, w * 0.17), foeCol = col(b.f), holder = b.kind === 'atk' ? b.f : 'fed';
  world(c, p.worlds[p.key], x, y, R);
  c.strokeStyle = col(holder); c.lineWidth = 2; c.beginPath(); c.arc(x, y, R + 5, 0, 7); c.stroke();
  const ev = fx && fx.ev, u = fx ? Math.min(1, fx.t / 0.9) : 1, live = ev && u < 1;
  // the two lines of ships
  const slots = (n, left) => { const out = []; for (let i = 0; i < n; i++) { const col2 = Math.floor(i / 4), row = i % 4; out.push([left ? w * 0.16 - col2 * 20 : w * 0.84 + col2 * 20, y + (row - 1.5) * 24 + Math.sin(t * 2 + i) * 2]); } return out; };
  const mine = slots(Math.min(8, Math.max(b.you.hp > 0 ? 1 : 0, Math.ceil(b.you.hp / 3))), true), theirs = slots(Math.min(8, Math.max(b.foe.hp > 0 ? 1 : 0, Math.ceil(b.foe.hp / 3))), false);
  for (const [sx, sy] of mine) wing(c, sx, sy, 0, 1, col('fed'), 1.2);
  for (const [sx, sy] of theirs) wing(c, sx, sy, Math.PI, 1, foeCol, 1.2);
  if (live) {
    const beam = (from, to, color, n) => {
      c.strokeStyle = color; c.lineWidth = 1.6; c.globalAlpha = 0.9 * (1 - u);
      for (let i = 0; i < Math.min(from.length, Math.max(1, n)); i++) {
        const a = from[i % from.length], bq = to.length ? to[(i * 3) % to.length] : [x + (a[0] < x ? -R : R), y + (i - 1) * 10], f = Math.min(1, u * 2.2);
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[0] + (bq[0] - a[0]) * f, a[1] + (bq[1] - a[1]) * f); c.stroke();
        if (f >= 1) { c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(bq[0], bq[1], 3 + 5 * (u - 0.45), 0, 7); c.fill(); }
      }
      c.globalAlpha = 1;
    };
    if (ev.hitFoe > 0) beam(mine, theirs, col('fed'), Math.ceil(ev.hitFoe / 2));
    if (ev.hitYou > 0) beam(theirs, mine, foeCol, Math.ceil(ev.hitYou / 2));
    const arc = (cx2, color, left) => { c.strokeStyle = color; c.lineWidth = 3; c.globalAlpha = 1 - u; c.beginPath(); c.arc(cx2, y, 64, left ? -1.1 : Math.PI - 1.1, left ? 1.1 : Math.PI + 1.1); c.stroke(); c.globalAlpha = 1; };
    if (ev.blockYou) arc(w * 0.16 - 20, col('fed'), true);
    if (ev.blockFoe) arc(w * 0.84 + 20, foeCol, false);
    const num = (txt, nx, color, up) => { c.font = '700 18px ' + HEAD; c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 1 - u * 0.7; c.fillText(txt, nx, y - 62 - (up ? 18 : 0) - u * 14); c.globalAlpha = 1; };
    if (ev.hitFoe) num('−' + ev.hitFoe, w * 0.84, '#fff3c4'); if (ev.hitYou) num('−' + ev.hitYou, w * 0.16, '#fff3c4');
    if (ev.healYou) num('+' + ev.healYou, w * 0.16, col('fed'), true); if (ev.healFoe) num('+' + ev.healFoe, w * 0.84, foeCol, true);
  }
  c.font = '600 11px ' + HEAD; c.fillStyle = TEXT; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(p.worlds[p.key].name.toUpperCase(), x, 6);
  c.font = '9.5px ' + MONO; c.fillStyle = DIM; c.fillText(C.worlds[p.worlds[p.key].type].name, x, 20);
}
