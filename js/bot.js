// A simple player used by `npm run sim` to check that the war can be won and lost. Not used in the game itself.
import { C } from './config.js';

const S = C.ship.str;

// Play one turn (one front, or the whole map while no front is at war), then end it.
export function botPlan(g) {
  while (g.offers.length) g.takeOffer(0);
  const fl = g.fedLinked(), mine = () => g.fleets.filter(f => f.owner === 'fed' && g.canAct(f.at));
  // cards that need no target, and the ministries
  for (let i = g.hand.length - 1; i >= 0; i--) { const c = C.cards[g.hand[i]]; if (['propaganda', 'logistics'].includes(c.type) || ['reserve', 'anthem', 'cache'].includes(g.hand[i])) g.play(i); }
  while (g.deckCount('dissent') && g.res.army > 8) if (!g.purge()) break;
  if (g.morale < 45) g.broadcast();
  if (g.res.fuel < 2 && g.res.army > 8) g.trade('army', 'fuel');
  if (g.fi >= 0 && g.priority !== g.fi && g.P.some(p => p.front === g.fi && g.threat(p.id))) g.setPriority(g.fi);
  // where the danger is: your systems an enemy could take next turn
  const hot = g.P.filter(p => p.owner === 'fed' && g.canAct(p.id)).map(p => ({ p, t: g.threat(p.id) })).filter(h => h.t)
    .map(h => ({ ...h, d: g.defence(h.p.id, h.t.f, fl) })).sort((a, b) => a.p.ring - b.p.ring);
  // traps and system cards go on the most pressing threatened system
  for (let i = g.hand.length - 1; i >= 0; i--) {
    const c = C.cards[g.hand[i]]; if (!(c.type === 'trap' || c.type === 'order' || c.target === 'system')) continue;
    const h = hot.find(x => x.d < x.t.str * 1.2 && (c.type !== 'trap' || !x.p.trap)) || hot[0];
    if (h) g.play(i, { sys: h.p.id }); else if (c.type === 'order') { const f = mine()[0]; if (f) g.play(i, { sys: f.at }); }
  }
  // build where it is needed most: a threatened system first, else a system beside the enemy
  const sites = [...hot.filter(h => h.d < h.t.str * 1.3).map(h => h.p), ...g.P.filter(p => p.owner === 'fed' && g.canAct(p.id) && p.adj.some(n => g.P[n].owner !== 'fed'))];
  let built = 0; for (const p of sites) if (built < 3 && g.build(p.id)) built++;
  if (!built && g.res.fuel > 14 && g.res.army > 14) { const p = g.P.find(q => q.owner === 'fed' && q.ring === 1 && g.canBuild(q.id)); if (p) g.build(p.id); }
  for (const p of g.P) if (p.owner === 'fed') g.combine(p.id);
  // hops to the nearest enemy system, for fleets with nothing to do
  const ed = g.P.map(() => 99), q = [];
  for (const p of g.P) if (p.owner !== 'fed') { ed[p.id] = 0; q.push(p.id); }
  while (q.length) { const a = q.shift(); for (const b of g.P[a].adj) if (ed[b] > ed[a] + 1) { ed[b] = ed[a] + 1; q.push(b); } }
  const boost = (f, need) => { for (let i = g.hand.length - 1; i >= 0 && g.fleetStr(f, true) < need; i--) if (['strike', 'veteran', 'flagship'].includes(g.hand[i])) g.play(i, { fleet: f.id }); };
  const guard = new Map();   // strength already sent to each threatened system
  for (const f of mine().sort((a, b) => b.ships - a.ships)) {
    if (f.moved) { const i = g.hand.indexOf('forced'); if (i < 0 || !g.play(i, { fleet: f.id })) continue; }
    const here = g.P[f.at], s = g.fleetStr(f, true), th = g.threat(f.at);
    // 1. hold a threatened system that would fall without this fleet
    if (th && g.defence(f.at, th.f, fl) - g.fleetStr(f) < th.str * 1.15 && (here.ring <= 2 || here.relic || f.at === 0)) continue;
    // 2. go to the aid of a neighbour that will fall
    const help = here.adj.map(n => hot.find(h => h.p.id === n)).filter(h => h && h.d + (guard.get(h.p.id) || 0) < h.t.str * 1.15).sort((a, b) => a.p.ring - b.p.ring)[0];
    if (help && (help.p.ring <= here.ring || help.p.id === 0)) { g.order(f.id, help.p.id); guard.set(help.p.id, (guard.get(help.p.id) || 0) + g.fleetStr(f)); continue; }
    // 3. attack the softest enemy system beside it that it can beat, the home first
    const ts = here.adj.filter(n => g.P[n].owner !== 'fed').sort((a, b) => (g.P[b].kind === 'home') - (g.P[a].kind === 'home') || g.garrison(a) - g.garrison(b));
    let done = false;
    for (const t of ts) {
      const need = g.garrison(t) * 1.2; if (s < need) boost(f, need);
      if (g.fleetStr(f, true) >= need) { g.order(f.id, t); done = true; break; }
    }
    if (done || th) continue;
    // 4. otherwise move toward the fighting, without stepping somewhere it would be overrun
    const next = here.adj.filter(n => g.P[n].owner === 'fed' && ed[n] < ed[f.at] && g.canAct(n)).sort((a, b) => ed[a] - ed[b])[0];
    if (next != null && ed[f.at] > 1) { const t2 = g.threat(next); if (!t2 || g.defence(next, t2.f, fl) + g.fleetStr(f) >= t2.str) g.order(f.id, next); }
  }
  g.endTurn();
}

export function botBattle(g) {
  for (const b of g.battles) {
    const f = b.fight; if (f.done || f.p > 0.42 || f.t < 1.5) continue;
    const i = g.hand.findIndex(id => id === 'support' || id === 'blockade' || id === 'armada');
    if (i >= 0 && !b.carded) { g.play(i, { battle: b.id }); b.carded = true; }
    else if (g.secondary) g.useSecondary(b.id);
  }
}
