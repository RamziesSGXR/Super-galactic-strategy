// The board: the capital in the centre and six routes out of it. Three routes end at an enemy home; the three
// between them are quiet, but ring lanes join the routes further out, so an enemy can go around. No DOM here.
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
// Which kind of world is common on each route: fuel near the Swarm, forges near the Foundry, colonies near the Veil.
const THEME = ['refinery', null, 'forge', null, 'colony', null];

export function makeMap(seed = 1) {
  const rnd = rng32(seed * 2654435761 + 7);
  const names = [...C.names.planets];
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const planets = [], home = [];
  const worldsFor = (kind, spoke, name) => {
    const n = kind === 'home' ? 4 : kind === 'capital' || kind === 'junction' || kind === 'frontier' ? 3 : 2 + (rnd() < 0.45 ? 1 : 0);
    const themes = spoke < 0 ? [] : THEME[spoke] ? [THEME[spoke]] : [THEME[(spoke + 5) % 6], THEME[(spoke + 1) % 6]];
    const w = { refinery: 2, forge: 2, colony: 2, fortress: 1, barren: 2 };
    for (const t of themes) w[t] += themes.length === 1 ? 5 : 2;
    const out = [];
    for (let i = 0; i < n; i++) {
      let type;
      if (kind === 'capital' && i === 0) type = 'capital';
      else if ((kind === 'gate' || kind === 'home') && i === 0) type = 'fortress';
      else { let tot = 0; for (const k in w) tot += w[k]; let r = rnd() * tot; for (const k in w) { r -= w[k]; if (r <= 0) { type = k; break; } } }
      out.push({ name: kind === 'capital' && i === 0 ? name : `${name} ${ROMAN[i]}`, type, size: type === 'refinery' ? 1.5 : 0.8 + rnd() * 0.5, phase: rnd() * 6.283, tint: rnd() });
    }
    return out;
  };
  const add = (kind, spoke, ring, r, deg, name, trait = null) => {
    const a = (deg + (rnd() - 0.5) * 4) * Math.PI / 180, rr = r + (rnd() - 0.5) * 0.025;
    name = name || names.pop();
    const p = { id: planets.length, name, kind, spoke, ring, x: Math.cos(a) * rr, y: Math.sin(a) * rr, adj: [], owner: 'fed',
      bonus: 0, temp: 0, dev: 0, trait, relic: null, relicAt: 0, worlds: worldsFor(kind, spoke, name) };
    // The key world: the one world in the system that is fought over.
    p.key = kind === 'capital' || kind === 'gate' || kind === 'home' ? 0 : Math.floor(rnd() * p.worlds.length);
    planets.push(p); return p.id;
  };
  const link = (a, b) => { planets[a].adj.push(b); planets[b].adj.push(a); };
  const cap = add('capital', -1, 0, 0, 0, C.names.capital);
  planets[cap].x = 0; planets[cap].y = 0;
  const S = [];
  for (let k = 0; k < 6; k++) {
    const th = -90 + k * 60, enemy = k % 2 === 0, o = {};
    o.gate = add('gate', k, 1, 0.17, th);
    o.junc = add('junction', k, 2, 0.34, th, null, enemy ? 'shipyard' : 'bastion');
    o.mid = [add('mid', k, 3, 0.53, th - 13), add('mid', k, 3, 0.53, th + 13)];
    if (enemy) {
      o.out = [add('outer', k, 4, 0.73, th - 11), add('outer', k, 4, 0.73, th + 11)];
      o.home = add('home', k, 5, 0.94, th, C.names.homes[k / 2]); home.push(o.home);
      link(o.mid[0], o.out[0]); link(o.mid[1], o.out[1]); link(o.out[0], o.home); link(o.out[1], o.home);
    } else {
      o.front = add('frontier', k, 4, 0.72, th, null, 'depot');
      link(o.mid[0], o.front); link(o.mid[1], o.front);
    }
    link(cap, o.gate); link(o.gate, o.junc); link(o.junc, o.mid[0]); link(o.junc, o.mid[1]);
    S.push(o);
  }
  for (let k = 0; k < 6; k++) {
    const a = S[k], b = S[(k + 1) % 6];
    link(a.mid[1], b.mid[0]);                                 // the inner ring road
    if (a.out) link(a.out[1], b.front); else link(a.front, b.out[0]);   // the outer ring road
  }
  // Relic systems: one mid system on each route keeps a rare card.
  const relics = [...C.relic.cards];
  for (let k = 0; k < 6; k++) {
    const p = planets[S[k].mid[Math.floor(rnd() * 2)]];
    p.relic = relics.splice(Math.floor(rnd() * relics.length), 1)[0]; p.relicAt = C.relic.first + k;
  }
  return { planets, home, capital: cap };
}
