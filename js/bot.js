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
    // First choice: the planet an attack on the capital launches from. Then the home, then the softest target.
    const capFrom = g.threats.find(t => t.to === 0 && t.s === s);
    ts.sort((a, b) => g.enemyAt(a) - g.enemyAt(b));
    const home = ts.find(id => g.P[id].kind === 'home');
    const pid = capFrom && ts.includes(capFrom.from) ? capFrom.from : home != null ? home : ts[0];
    picks.push({ s, f, pid, e: g.enemyAt(pid), soft: ts[0] });
  }
  // The directive: guard the capital first, then a front about to break, then the hardest attack.
  const cap = g.threats.find(t => t.to === 0);
  const heavy = g.threats.filter(t => t.str > g.defence(t).D * 1.05).sort((a, b) => g.P[a.to].ring - g.P[b.to].ring)[0];
  picks.sort((a, b) => b.e - a.e);
  if (cap && !picks.some(p => p.pid === cap.from)) g.setDirective(cap.s, 'defend');
  else if (heavy && g.P[heavy.to].ring <= 2) g.setDirective(heavy.s, 'defend');
  else if (picks.length) g.setDirective(picks[0].s, 'attack');
  for (const pk of picks) for (const pid of pk.pid === pk.soft ? [pk.pid] : [pk.pid, pk.soft]) {
    const { s, f } = pk;
    if (g.count(s)) break;
    g.setTarget(s, pid);
    const need = g.enemyAt(pid) * (g.P[pid].kind === 'home' ? 1.08 : 1.2), order = [C.weak[f], 'assault', 'siege', 'sabotage'];
    let guard = 0;
    while (g.opStrength(s) < need && guard++ < 12) {
      let ok = false;
      for (const k of order) {
        if (C.missions[k].army && spare() < C.missions[k].army) continue;
        if (g.addMission(s, k)) { ok = true; break; }
      }
      if (!ok) break;
    }
    if (g.opStrength(s) < g.enemyAt(pid) * 1.05) g.setTarget(s, null);
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
