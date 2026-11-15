// A simple player used by `npm run sim` to check that the war can be won and lost. Not used in the game itself.
import { C } from './config.js';

export function botPlan(g) {
  // Cards that need nothing selected go first; the rest are tried again once the orders are set.
  const cards = sel => {
    for (let i = g.hand.length - 1; i >= 0; i--) {
      const c = C.cards[g.hand[i]]; if (c.when !== 'plan') continue;
      const t = g.threats.find(x => x.to !== 0) || g.threats[0];
      g.playCard(i, c.needs === 'planet' ? (t ? t.to : 0) : sel);
    }
  };
  cards(null);
  // Keep some Army back for the automatic defences.
  const keep = Math.min(6, g.threats.length * 3);
  const spare = () => g.res.army - g.totalCost().army - keep;
  const picks = [];
  for (let s = 0; s < 3; s++) {
    const f = C.factions[s]; if (g.F[f].state !== 'active') continue;
    const ts = g.targets(s); if (!ts.length) continue;
    // Softest first; a system where a foothold already stands, or one of ours with enemy worlds in it, comes before that.
    const score = id => g.enemyAt(id, f) - (g.P[id].owner === 'fed' ? 50 : g.held(g.P[id], 'fed').length * 20);
    ts.sort((a, b) => score(a) - score(b));
    const capFrom = g.threats.find(t => t.to === 0 && t.s === s);
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
    const capT = g.threats.find(t => t.to === 0 && t.s === s && t.from === pk.hard);
    for (const pid of (major || capT) && pk.hard !== pk.soft ? [pk.hard, pk.soft] : [pk.soft]) {
      if (g.count(s)) break;
      g.setTarget(s, pid);
      const p = g.P[pid];
      // Easiest worlds first, each with the mission that counts most there. Keep only the fights worth having.
      const worlds = g.held(p, f).sort((a, b) => g.enemyOn(pid, a, f) - g.enemyOn(pid, b, f));
      for (const wi of worlds) {
        const ks = Object.keys(C.missions).sort((a, b) => g.missionStr(pid, wi, b) - g.missionStr(pid, wi, a));
        for (const k of ks) {
          if (C.missions[k].army && spare() < C.missions[k].army) continue;
          if (g.setMission(s, wi, k)) break;
        }
      }
      // An attack on the capital is pinned by any operation half its strength, win or lose: keep every mission.
      if (capT && pid === capT.from && g.pins(capT)) break;
      for (const ft of g.opFights(s)) if (ft.P < ft.E * 1.12) g.setMission(s, ft.wi, null);
      // No point landing on worlds that cannot add up to the system within the life of a foothold.
      if (p.owner !== 'fed' && g.count(s) + (major ? 0 : C.op.general) < g.need(p)) g.setTarget(s, null);
      if (!g.count(s)) g.setTarget(s, null);
    }
  }
  cards(picks.length ? picks[0].hard : null);
  // Mobilise for the next offensive: the front whose home is in reach, else the one holding the fewest systems.
  if (!g.mob && picks.length && g.res.fuel - g.totalCost().fuel >= C.mob.fuel + 3) {
    const size = p => g.P.filter(q => q.owner === p.f).length - (g.P[p.hard].kind === 'home' ? 100 : 0);
    g.mobilise([...picks].sort((a, b) => size(a) - size(b))[0].s);
  }
}

export function botBattle(g) {
  for (const b of g.battles) {
    const open = b.fights.filter(f => !f.done); if (!open.length) continue;
    const worst = Math.min(...open.map(f => f.p));
    if (worst > 0.42 || open[0].t < 2) continue;
    const i = g.hand.findIndex(id => id === 'support' || id === 'blockade' || id === 'armada');
    if (i >= 0 && !b.carded) { g.playCard(i, b.id); b.carded = true; }
    else if (g.secondary) g.useSecondary(b.id);
  }
}
