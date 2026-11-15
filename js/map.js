// The board: the capital in the centre and three sectors of lanes. Each sector is narrow at the capital (two gates),
// wide in the middle and narrow again at the enemy's home. No DOM here.
import { C } from './config.js';

export function rng32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function makeMap(seed = 1) {
  const rnd = rng32(seed * 2654435761 + 7);
  const names = [...C.names.planets];
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const planets = [], home = [];
  const add = (kind, sector, ring, r, deg, name) => {
    const a = (deg + (rnd() - 0.5) * 5) * Math.PI / 180, rr = r + (rnd() - 0.5) * 0.03;
    const p = { id: planets.length, name: name || names.pop(), kind, sector, ring, x: Math.cos(a) * rr, y: Math.sin(a) * rr,
      adj: [], owner: 'fed', fort: C.fort[kind] };
    planets.push(p); return p.id;
  };
  const link = (a, b) => { planets[a].adj.push(b); planets[b].adj.push(a); };
  const cap = add('capital', -1, 0, 0, 0, C.names.capital);
  planets[cap].x = 0; planets[cap].y = 0;
  for (let s = 0; s < 3; s++) {
    const th = -90 + s * 120;
    const g = [add('gate', s, 1, 0.21, th - 30), add('gate', s, 1, 0.21, th + 30)];
    const j = [add('junction', s, 2, 0.40, th - 31), add('junction', s, 2, 0.40, th + 31)];
    const m = [-45, -16, 16, 45].map(d => add('mid', s, 3, 0.60, th + d));
    const st = [add('staging', s, 4, 0.79, th - 20), add('staging', s, 4, 0.79, th + 20)];
    const h = add('home', s, 5, 0.96, th, C.names.homes[s]);
    home.push(h);
    for (let k = 0; k < 2; k++) {
      link(cap, g[k]); link(g[k], j[k]);
      link(j[k], m[k * 2]); link(j[k], m[k * 2 + 1]);
      link(m[k * 2], st[k]); link(m[k * 2 + 1], st[k]);
      link(st[k], h);
    }
    link(m[1], m[2]);   // the cross lane: the way round a held junction
  }
  return { planets, home, capital: cap };
}
