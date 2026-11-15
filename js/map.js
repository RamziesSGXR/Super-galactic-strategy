// The board: the capital in the centre and five rings of star systems round it, more on each ring going out.
// The map is cut into three war fronts, one per enemy, with that enemy's home on the outer ring.
// Lanes join each system inward and some of its neighbours on the same ring. Many lanes are left out on purpose,
// so there are dead ends. Where two fronts meet, most rings are joined, so fleets can be passed between fronts. No DOM here.
import { C } from './config.js';

export function rng32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const THEME = { swarm: 'refinery', foundry: 'forge', veil: 'colony' };   // what is common on each front

export function makeMap(seed = 1) {
  const rnd = rng32(seed * 2654435761 + 7), M = C.map;
  const names = [...C.names.planets];
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const planets = [], home = [];
  const worldsFor = (kind, front, name) => {
    const n = kind === 'home' ? 4 : kind === 'capital' ? 3 : 2 + (rnd() < 0.4 ? 1 : 0);
    const w = { refinery: 2, forge: 2, colony: 2, fortress: 1, barren: 2 };
    if (front >= 0) w[THEME[C.fronts[front].f]] += 4;
    const out = [];
    for (let i = 0; i < n; i++) {
      let type;
      if (kind === 'capital' && i === 0) type = 'capital';
      else if (kind === 'home' && i === 0) type = 'fortress';
      else { let tot = 0; for (const k in w) tot += w[k]; let r = rnd() * tot; for (const k in w) { r -= w[k]; if (r <= 0) { type = k; break; } } }
      out.push({ name: kind === 'capital' && i === 0 ? name : `${name} ${ROMAN[i]}`, type, size: type === 'refinery' ? 1.5 : 0.8 + rnd() * 0.5, phase: rnd() * 6.283, tint: rnd() });
    }
    return out;
  };
  const add = (kind, front, ring, r, deg, name) => {
    const a = deg * Math.PI / 180; name = name || names.pop();
    const p = { id: planets.length, name, kind, front, ring, deg, x: Math.cos(a) * r, y: Math.sin(a) * r, adj: [], owner: 'fed',
      dev: 0, site: null, worlds: worldsFor(kind, front, name) };
    // The key world: the one shown when a battle is fought for the system, and whose kind helps shipbuilding there.
    p.key = kind === 'capital' || kind === 'home' ? 0 : Math.floor(rnd() * p.worlds.length);
    planets.push(p); return p.id;
  };
  const link = (a, b) => { if (a === b || planets[a].adj.includes(b)) return; planets[a].adj.push(b); planets[b].adj.push(a); };
  add('capital', -1, 0, 0, 0, C.names.capital);
  const rings = M.ring.map(() => []);   // ids on each ring, going round the map in order
  for (let k = 0; k < M.ring.length; k++) for (let fi = 0; fi < 3; fi++) {
    const n = M.ring[k], c = C.fronts[fi].deg, outer = k === M.ring.length - 1;
    for (let j = 0; j < n; j++) {
      const isHome = outer && j === (n - 1) / 2;
      const deg = c - 60 + (j + 0.5) * 120 / n + (isHome ? 0 : (rnd() - 0.5) * 40 / n);
      const id = add(isHome ? 'home' : 'sys', fi, k + 1, M.radius[k] + (isHome ? 0.04 : (rnd() - 0.5) * 0.03), deg, isHome ? C.names.homes[C.fronts[fi].f] : null);
      rings[k].push(id); if (isHome) home[fi] = id;
    }
  }
  // Order each ring by angle so that "next on the ring" means the next one round the circle.
  const ang = id => ((planets[id].deg % 360) + 360) % 360;
  for (const r of rings) r.sort((a, b) => ang(a) - ang(b));
  const gap = (a, b) => { const d = Math.abs(ang(a) - ang(b)); return Math.min(d, 360 - d); };
  for (let k = 0; k < rings.length; k++) {
    // inward: every system has a lane to the nearest system one ring in, so every system can be reached
    for (const id of rings[k]) {
      if (k === 0) { link(0, id); continue; }
      const near = rings[k - 1].filter(q => planets[q].front === planets[id].front).sort((a, b) => gap(id, a) - gap(id, b));   // lanes inward stay on their own front
      link(id, near[0]);
      if (rnd() < M.second && gap(id, near[1]) < 45) link(id, near[1]);
    }
    // around: only some neighbours on the same ring are joined, and fewer where one front meets the next
    for (let i = 0; i < rings[k].length; i++) {
      const a = rings[k][i], b = rings[k][(i + 1) % rings[k].length], same = planets[a].front === planets[b].front;
      const must = same && (planets[a].kind === 'home' || planets[b].kind === 'home');   // a home is never a dead end
      const cross = !same && (k === 1 || k === 3);   // rings 2 and 4 always join where two fronts meet, so every pair of fronts is linked twice at least
      if (must || cross || rnd() < (same ? M.around : M.across)) link(a, b);
    }
  }
  // Hops to the capital, for the enemy's sense of direction.
  const dist = planets.map(() => 99); dist[0] = 0; const q = [0];
  while (q.length) { const a = q.shift(); for (const b of planets[a].adj) if (dist[b] > dist[a] + 1) { dist[b] = dist[a] + 1; q.push(b); } }
  planets.forEach((p, i) => { p.dist = dist[i]; });
  return { planets, home, capital: 0 };
}
