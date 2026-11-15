// A simple player used by `npm run sim` to check that the war can be won and lost. Not used in the game itself.
import { C } from './config.js';

export function botPlan(g) {
  for (let i = g.hand.length - 1; i >= 0; i--) {
    const c = C.cards[g.hand[i]]; if (c.when !== 'plan') continue;
    if (c.planet) { const t = g.threats.find(x => x.to !== 0) || g.threats[0]; if (t) g.playCard(i, t.to); }
    else g.playCard(i);
  }
  // Keep some Army back for the automatic defences.
  const keep = Math.min(6, g.threats.length * 3);
  const spare = () => g.res.army - g.totalCost().army - keep;
  const picks = [];
  for (let s = 0; s < 3; s++) {
    const f = C.factions[s]; if (g.F[f].state !== 'active') continue;
    const ts = g.targets(s); if (!ts.length) continue;
    // First choice: the system an attack on the capital launches from. Then the home, then the softest target.
    const capFrom = g.threats.find(t => t.to === 0 && t.s === s);
    ts.sort((a, b) => g.enemyAt(a) - g.enemyAt(b));
    const home = ts.find(id => g.P[id].kind === 'home');
    const hard = capFrom && ts.includes(capFrom.from) ? capFrom.from : home != null ? home : ts[ts.length - 1];
    picks.push({ s, f, hard, soft: ts[0] });
  }
  // The directive: guard the capital first, then a front about to break, then launch a mobilised offensive.
  const cap = g.threats.find(t => t.to === 0);
  const heavy = g.threats.filter(t => t.str > g.defence(t).D * 1.05).sort((a, b) => g.P[a.to].ring - g.P[b.to].ring)[0];
  const ready = picks.find(p => g.mobReady(p.s));
  if (cap && !picks.some(p => p.hard === cap.from && g.mobReady(p.s))) g.setDirective(cap.s, 'defend');
  else if (heavy && g.P[heavy.to].ring <= 2 && !ready) g.setDirective(heavy.s, 'defend');
  else if (ready) g.setDirective(ready.s, 'attack');
  for (const pk of picks) {
    const { s, f } = pk, major = g.major(s);
    for (const pid of major && pk.hard !== pk.soft ? [pk.hard, pk.soft] : [pk.soft]) {
      if (g.count(s)) break;
      g.setTarget(s, pid);
      const need = g.enemyAt(pid) * (g.P[pid].kind === 'home' ? 1.08 : 1.2);
      // Give each world the mission that counts most there, strongest first.
      const opts = [];
      g.P[pid].worlds.forEach((w, wi) => { for (const k in C.missions) opts.push({ wi, k, v: g.missionStr(pid, wi, k) }); });
      opts.sort((a, b) => b.v - a.v);
      for (const o of opts) {
        if (g.opStrength(s) >= need) break;
        if (g.ops[s].m[o.wi]) continue;
        if (C.missions[o.k].army && spare() < C.missions[o.k].army) continue;
        g.setMission(s, o.wi, o.k);
      }
      if (g.opStrength(s) < g.enemyAt(pid) * 1.05) g.setTarget(s, null);
    }
  }
  // Mobilise for the next offensive: the front whose home is in reach, else the one holding the most systems.
  if (!g.mob && picks.length && g.res.fuel - g.totalCost().fuel >= C.mob.fuel + 3) {
    const size = p => g.P.filter(q => q.owner === p.f).length - (g.P[p.hard].kind === 'home' ? 100 : 0);
    g.mobilise([...picks].sort((a, b) => size(a) - size(b))[0].s);
  }
}

export function botBattle(g) {
  for (const b of g.battles) {
    if (b.done || b.p > 0.42 || b.t < 2) continue;
    const i = g.hand.findIndex(id => id === 'support' || id === 'blockade');
    if (i >= 0 && !b.carded) { g.playCard(i, b.id); b.carded = true; }
    else if (g.secondary) g.useSecondary(b.id);
  }
}
