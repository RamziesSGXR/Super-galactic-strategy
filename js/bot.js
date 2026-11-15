// A simple player used by `npm run sim` to check that the war can be won and lost. Not used in the game itself.
import { C } from './config.js';

const HP = C.ship.hp;

// Make the one decision on the front in play.
export function botDecide(g) {
  const mine = g.fleets.filter(f => f.owner === 'fed' && !f.moved);
  if (g.res.fuel < 2 && g.res.army > 8) g.trade('army', 'fuel');
  if (g.fi >= 0 && g.priority !== g.fi && g.P.some(p => p.front === g.fi && g.threat(p.id))) g.setPriority(g.fi);
  // building is extra: a special site as soon as one can be paid for, then ships where they are needed
  for (const k in C.sites) { const p = g.P.filter(q => g.canSite(q.id, k) && !g.threat(q.id)).sort((a, b) => a.ring - b.ring)[0]; if (p) g.site(p.id, k); }
  const want = g.P.filter(p => g.canBuild(p.id)).map(p => ({ p, t: g.threat(p.id) }))
    .sort((a, b) => (b.t ? 10 - a.p.ring : 0) - (a.t ? 10 - b.p.ring : 0) || (b.p.adj.some(n => g.P[n].owner !== 'fed') - a.p.adj.some(n => g.P[n].owner !== 'fed')) || g.shipsAt(b.p.id, 'fed') - g.shipsAt(a.p.id, 'fed'));
  for (const w of want.slice(0, 2)) if (w.t || w.p.adj.some(n => g.P[n].owner !== 'fed') || g.res.fuel > 12) g.build(w.p.id);
  const hot = g.P.filter(p => p.owner === 'fed' && g.onFront(p.id)).map(p => ({ p, t: g.threat(p.id) })).filter(h => h.t && g.strength(h.p.id) < h.t.hp * 1.15).sort((a, b) => a.p.ring - b.p.ring);
  const needed = f => { const t = g.threat(f.at); return t && g.strength(f.at) - f.ships * HP < t.hp * 1.1 && (g.P[f.at].ring <= 2 || f.at === 0); };
  // 1. the capital and the inner rings come first: reinforce what will fall
  for (const h of hot) {
    if (h.p.ring > 2 && h.p.id !== 0) continue;
    const f = mine.filter(x => g.posts(x).includes(h.p.id) && !needed(x)).sort((a, b) => b.ships - a.ships)[0];
    if (f) return g.moveTo(f.id, h.p.id);
  }
  // 2. attack where the odds are good, the home first
  let best = null;
  for (const f of mine) { if (needed(f)) continue; for (const t of g.targets(f)) { const r = f.ships * HP / g.strength(t) + (g.P[t].kind === 'home' ? 0.3 : 0); if (!best || r > best.r) best = { f, t, r }; } }
  if (best && best.r >= 1.4) return g.attack(best.f.id, best.t);
  // 3. otherwise mass fleets beside the softest target
  if (best) { const stage = g.P[best.t].adj.filter(n => g.P[n].owner === 'fed' && g.onFront(n)).sort((a, b) => g.shipsAt(b, 'fed') - g.shipsAt(a, 'fed'))[0]; const f = mine.filter(x => x.at !== stage && !needed(x) && g.posts(x).includes(stage)).sort((a, b) => b.ships - a.ships)[0]; if (f && stage != null) return g.moveTo(f.id, stage); }
  return g.hold();
}

// Choose a card for this round of a battle: block or heal when in danger, otherwise the hardest hit.
export function botCard(g) {
  const b = g.battle, h = b.you.hand; if (!h.length) return null;
  const danger = b.you.hp <= b.foe.fire + 4;
  const val = id => { const c = C.bcards[id]; return (c.atk || 0) * (c.pierce ? 1.3 : 1) + (c.block || 0) * (danger ? 1.6 : 0.5) + (c.heal || 0) * (b.you.hp < b.you.max - 2 ? 1 : 0.1) + (c.sap || 0) * 2 + (c.reflect || 0); };
  let bi = 0; for (let i = 1; i < h.length; i++) if (val(h[i]) > val(h[bi])) bi = i;
  return bi;
}
