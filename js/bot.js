// A simple player used by `npm run sim` to check that the war can be won and lost. Not used in the game itself.
import { C } from './config.js';

const isMission = id => C.cards[id].type === 'mission';

export function botPlan(g) {
  // Take the first mission card on offer, else the first card.
  while (g.offers.length) { const o = g.offers[0], i = o.cards.findIndex(isMission); g.takeOffer(i >= 0 ? i : 0); }
  const playAll = sel => {
    for (let i = g.hand.length - 1; i >= 0; i--) {
      const c = C.cards[g.hand[i]]; if (c.type === 'mission' || c.type === 'battle' || c.type === 'dissent' || c.when === 'battle') continue;
      const t = g.threats.filter(x => !x.hidden).sort((a, b) => g.defence(a).D / a.str - g.defence(b).D / b.str)[0];
      g.play(i, c.needs === 'planet' ? (t ? t.to : 0) : sel);
    }
  };
  playAll(null);
  // The ministries: clear dissent, lift low morale, turn spare troops into fuel, back the hardest-pressed route.
  while (g.deckCount('dissent') && g.res.army > 9) if (!g.purge()) break;
  if (g.morale < 45) g.broadcast();
  if (g.res.fuel < 5 && g.res.drop > 12) g.trade('drop', 'fuel');
  if (g.res.fuel < 5 && g.res.army > 14) g.trade('army', 'fuel');
  const worst = g.threats.filter(t => !t.hidden).sort((a, b) => g.P[a.to].ring - g.P[b.to].ring)[0];
  if (worst && g.P[worst.to].spoke >= 0 && g.route !== g.P[worst.to].spoke) g.setRoute(g.P[worst.to].spoke);
  if (g.res.fuel > 22 && g.res.army > 18) { const p = g.P.find(q => q.owner === 'fed' && q.dev < C.develop.max && q.ring <= 2 && q.id); if (p) g.develop(p.id); }

  const keep = Math.min(6, g.threats.length * 3);   // Army kept back for the automatic defences
  const picks = [];
  for (let s = 0; s < 3; s++) {
    const f = C.factions[s]; if (g.F[f].state !== 'active') continue;
    const ts = g.targets(s); if (!ts.length) continue;
    ts.sort((a, b) => g.enemyAt(a) - g.enemyAt(b));
    const capFrom = g.threats.find(t => t.to === 0 && t.s === s);
    const home = ts.find(id => g.P[id].kind === 'home');
    const hard = capFrom && ts.includes(capFrom.from) ? capFrom.from : home != null ? home : ts[ts.length - 1];
    picks.push({ s, f, hard, soft: ts[0], capFrom });
  }
  // The directive: guard the capital first, then a front about to break, then launch a mobilised offensive.
  const cap = g.threats.find(t => t.to === 0);
  const heavy = g.threats.filter(t => t.str > g.defence(t).D * 1.05).sort((a, b) => g.P[a.to].ring - g.P[b.to].ring)[0];
  const ready = picks.find(p => g.mobReady(p.s));
  if (cap && !picks.some(p => p.hard === cap.from && g.mobReady(p.s))) g.setDirective(cap.s, 'defend');
  else if (heavy && g.P[heavy.to].ring <= 2 && !ready) g.setDirective(heavy.s, 'defend');
  else if (ready) g.setDirective(ready.s, 'attack');
  // Fronts with an attack on the capital to pin go first, then the mobilised one.
  picks.sort((a, b) => (b.capFrom ? 2 : 0) + (g.major(b.s) ? 1 : 0) - (a.capFrom ? 2 : 0) - (g.major(a.s) ? 1 : 0));
  for (const pk of picks) {
    const { s } = pk, major = g.major(s);
    for (const pid of (major || pk.capFrom) && pk.hard !== pk.soft ? [pk.hard, pk.soft] : [pk.soft]) {
      if (g.count(s)) break;
      const need = g.enemyAt(pid) * (g.P[pid].kind === 'home' ? 1.08 : 1.2);
      // Strongest mission cards first, as long as the Army reserve holds.
      for (;;) {
        if (g.count(s) && g.opStrength(s) >= need) break;
        let best = -1, bv = 0;
        g.hand.forEach((id, i) => {
          if (!isMission(id) || !g.canPlay(i, pid).ok) return;
          if ((C.cards[id].cost.army || 0) > g.res.army - g.totalCost().army - keep) return;
          const v = g.cardStr(id, pid); if (v > bv) { bv = v; best = i; }
        });
        if (best < 0) break;
        g.play(best, pid);
      }
      const pinOk = pk.capFrom && pid === pk.capFrom.from && g.pins(pk.capFrom);
      if (g.count(s) && !pinOk && g.opStrength(s) < g.opEnemy(s) * 1.05) g.recall(s);
    }
  }
  playAll(picks.length ? picks[0].hard : null);
  // Mobilise for the next offensive: the front whose home is in reach, else the one holding the fewest systems.
  if (!g.mob && picks.length && g.res.fuel - g.totalCost().fuel >= C.mob.fuel + 3) {
    const size = p => g.P.filter(q => q.owner === p.f).length - (g.P[p.hard].kind === 'home' ? 100 : 0);
    g.mobilise([...picks].sort((a, b) => size(a) - size(b))[0].s);
  }
}

export function botBattle(g) {
  for (const b of g.battles) {
    const f = b.fight; if (f.done || f.p > 0.42 || f.t < 2) continue;
    const i = g.hand.findIndex(id => id === 'support' || id === 'blockade' || id === 'armada');
    if (i >= 0 && !b.carded) { g.play(i, b.id); b.carded = true; }
    else if (g.secondary) g.useSecondary(b.id);
  }
}
