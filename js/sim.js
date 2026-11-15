// The whole game as rules. No DOM, so it runs the same in the browser and in `npm run sim`.
//
// The war is three games of moves played side by side, one per war front. A round goes front by front:
//   YOUR TURN on the front (move fleets one system, build ships, play cards) -> your attacks are fought
//   -> THE ENEMY'S TURN on that front (it builds, moves, attacks) -> its attacks are fought -> the next front.
// After the last front: income, a new hand, the next round.
//
// HANDOFF: a battle is one fight for one system, shown as a single bar. This is the place where the other games
// would take over later (a space battle between the fleets, a ground battle on the key world), so it is kept simple
// on purpose. Everything a fight needs is in `_fight()` and `tick()`; its result is only `fight.win`.
import { C } from './config.js';
import { makeMap } from './map.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const N = C.names, S = C.ship.str;
const when = c => c.when || (c.type === 'battle' ? 'battle' : 'plan');

export class Game {
  constructor(seed = 1, saved = null) {
    this.seed = seed;
    this.rs = (seed * 7919 + 13) | 0;
    this.map = makeMap(seed);
    this.P = this.map.planets;       // star systems
    this.round = 1; this.phase = 'plan'; this.stage = 'you'; this.fi = -1; this.over = null;
    this.res = { ...C.start.res }; this.morale = C.start.morale;
    this.F = {};
    C.fronts.forEach((fr, fi) => {
      const a = C.arrive[fr.f];
      this.F[fr.f] = { id: fr.f, front: fi, state: 'wait', at: a.round + Math.round((this.rnd() * 2 - 1) * a.vary), pool: 0, cards: [], dig: 0, home: this.map.home[fi], played: null };
    });
    // fleets: the pieces. { id, owner, at, ships, moved, order, wait, strike, vet, flank }
    this.fleets = []; this.fid = 0;
    this._spawn('fed', 0, C.start.fleets[0]);
    C.fronts.forEach((fr, fi) => { const p = this.P.filter(q => q.front === fi && q.ring === 2).sort((a, b) => a.id - b.id)[1]; this._spawn('fed', p.id, C.start.fleets[fi + 1]); });
    // the deck
    this.drawPile = []; this.hand = []; this.discard = []; this.offers = [];
    for (const id in C.cards) for (let i = 0; i < (C.cards[id].starter || 0); i++) this.drawPile.push(id);
    this._shuffle(this.drawPile);
    this.policy = 'balanced';        // Ministry of Humanity
    this.priority = null;            // Ministry of Employment: the priority front, 0 to 2
    this.used = { broadcast: false };
    this.secondary = true;
    this.capHit = [];                // enemies that have struck the capital this round
    this.battles = []; this.bid = 0;
    this.moves = [];                 // fleet moves just made, for the screen to animate: { owner, from, to, ships }
    this.noRecruit = false;
    this.log = [];
    this.stats = { taken: 0, fallen: 0, opsWon: 0, opsLost: 0, held: 0 };
    if (saved) return this._restore(saved);
    this.say('info', 'Ministry of Truth: every world on the map flies the ' + N.fed + ' flag. Long may it last.');
    this._arrivals(); this._drawHand(); this._firstFront();
  }

  rnd() {
    const a = this.rs = (this.rs + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  say(kind, text) { this.log.push({ r: this.round, kind, text }); }

  // ---------- saving (only while you are planning) ----------
  save() {
    const k = ['seed', 'rs', 'round', 'fi', 'res', 'morale', 'F', 'fleets', 'fid', 'drawPile', 'hand', 'discard', 'offers', 'policy', 'priority', 'used', 'capHit', 'noRecruit', 'stats', 'over'];
    const d = { v: 6, log: this.log.slice(-80), P: this.P.map(p => [p.owner, p.bonus, p.relicAt, p.dev, p.temp, p.built, p.trap, p.yard || 0]) };
    for (const x of k) d[x] = this[x];
    return d;
  }
  _restore(d) {
    for (const k in d) if (k !== 'v' && k !== 'P') this[k] = d[k];
    d.P.forEach(([o, b, ra, dv, tp, bu, tr, yd], i) => Object.assign(this.P[i], { owner: o, bonus: b, relicAt: ra, dev: dv, temp: tp, built: bu, trap: tr, yard: yd }));
    this.phase = this.over ? 'over' : 'plan'; this.stage = 'you';
    return this;
  }
  static load(d) { return d && d.v === 6 ? new Game(d.seed, d) : null; }

  // ---------- the board ----------
  linked(owner, root) {
    const seen = new Set();
    if (this.P[root].owner !== owner) return seen;
    seen.add(root); const q = [root];
    while (q.length) for (const n of this.P[q.pop()].adj) if (!seen.has(n) && this.P[n].owner === owner) { seen.add(n); q.push(n); }
    return seen;
  }
  fedLinked() { return this.linked('fed', 0); }
  keyWorld(p) { return p.worlds[p.key]; }
  facOf(p) { return p.front < 0 ? null : C.fronts[p.front].f; }
  atWar(fi) { return fi >= 0 && this.F[C.fronts[fi].f].state === 'active'; }
  // Which systems you may act on this turn: the front being played, the capital, and any front not yet at war.
  canAct(pid) { const p = this.P[pid]; return this.phase === 'plan' && (this.fi < 0 || p.id === 0 || p.front === this.fi || !this.atWar(p.front)); }
  fleetsAt(pid, owner) { return this.fleets.filter(f => f.at === pid && f.owner === owner); }
  shipsAt(pid, owner) { return this.fleetsAt(pid, owner).reduce((a, f) => a + f.ships, 0); }
  _spawn(owner, at, ships, moved = false) { const f = { id: ++this.fid, owner, at, ships, moved, order: null, wait: 0, strike: false, vet: false, flank: false }; this.fleets.push(f); return f; }
  // A fleet's strength. Attacking, it may carry an Alpha Strike, and Flanking Orders count the other fleets with it.
  fleetStr(f, attacking = false, others = 0) { return f.ships * S + (f.vet ? 3 : 0) + (attacking && f.strike ? 4 : 0) + (attacking && f.flank ? 2 * others : 0); }
  // A system's own defence when the Federation holds it, with no fleet there.
  fort(p) {
    let v = (p.id === 0 ? C.fort.capital : C.fort.sys) + p.bonus + p.temp + (this.priority != null && p.front === this.priority ? C.priority.fort : 0);
    for (const w of p.worlds) v += C.worlds[w.type].fort || 0;
    return v;
  }
  // What an attack by enemy f on your system would meet: its own defence, plus every fleet you have there.
  defence(pid, f, fl = this.fedLinked()) {
    const p = this.P[pid];
    let v = this.fort(p) * (fl.has(pid) ? 1 : C.cut) * (f === 'veil' && pid !== 0 ? C.enemy.veil.sneak : 1);   // the Veil slips past defences, but not the capital's
    for (const x of this.fleetsAt(pid, 'fed')) v += this.fleetStr(x);
    return v;
  }
  // What an attack by you on an enemy system would meet: its own defence, plus every enemy fleet there.
  garrison(pid) {
    const p = this.P[pid], f = p.owner; if (f === 'fed') return 0;
    let v = (p.kind === 'home' ? C.garr.home : C.garr.sys) + (this.keyWorld(p).type === 'fortress' ? C.garr.fortress : 0) + (this.F[f].dig >= this.round ? C.garr.dig : 0);
    for (const x of this.fleetsAt(pid, f)) v += x.ships * S;
    return v;
  }
  // The enemy fleets beside one of your systems that could strike it on their next turn, and their combined strength.
  threat(pid) {
    const p = this.P[pid]; if (p.owner !== 'fed') return null;
    const by = {};
    for (const n of p.adj) for (const x of this.fleets) if (x.at === n && x.owner !== 'fed' && (p.id === 0 || p.front === this.F[x.owner].front)) by[x.owner] = (by[x.owner] || 0) + x.ships * S;
    let best = null; for (const f in by) if (!best || by[f] > best.str) best = { f, str: by[f] };
    return best;
  }

  // ---------- the deck ----------
  _shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  handSize() { return C.deck.hand + (this.morale >= C.deck.high ? 1 : 0) - (this.morale < C.deck.low ? 1 : 0); }
  // Discard what is left of the hand (relic cards stay) and draw a new one. An empty draw pile is the discard pile reshuffled.
  _drawHand() {
    const keep = this.hand.filter(id => C.cards[id].type === 'relic');
    for (const id of this.hand) if (C.cards[id].type !== 'relic') this.discard.push(id);
    this.hand = keep;
    for (let i = 0, n = this.handSize(); i < n; i++) {
      if (!this.drawPile.length) { if (!this.discard.length) break; this.drawPile = this._shuffle(this.discard); this.discard = []; }
      this.hand.push(this.drawPile.pop());
    }
  }
  traps() { return this.P.filter(p => p.trap).map(p => p.trap); }
  deckCount(id) { const n = a => a.filter(x => x === id).length; return n(this.drawPile) + n(this.hand) + n(this.discard) + n(this.traps()); }
  deckSize() { return this.drawPile.length + this.hand.length + this.discard.length + this.traps().length; }
  // After a major victory you are offered three cards and may add one to your deck.
  _offer(why) {
    const ids = Object.keys(C.cards).filter(k => C.cards[k].w), pick = [];
    while (pick.length < 3) {
      let tot = 0; for (const k of ids) if (!pick.includes(k)) tot += C.cards[k].w;
      let r = this.rnd() * tot;
      for (const k of ids) { if (pick.includes(k)) continue; r -= C.cards[k].w; if (r <= 0) { pick.push(k); break; } }
    }
    this.offers.push({ why, cards: pick });
  }
  takeOffer(i) {
    const o = this.offers.shift(); if (!o) return false;
    if (i != null && o.cards[i]) { this.discard.push(o.cards[i]); this.say('good', `${C.cards[o.cards[i]].name} joins your deck.`); }
    return true;
  }
  give(id, why) { this.hand.push(id); this.say('good', `Relic card (${why}): ${C.cards[id].name}.`); }
  canPay(c = {}) { for (const k in c) if (c[k] > this.res[k] + 1e-9) return false; return true; }
  _pay(c = {}) { for (const k in c) this.res[k] -= c[k]; }

  // ---------- fleets: your orders ----------
  // Order a fleet to an adjacent system: it moves there if the system is yours, and attacks if it is not.
  // Ordering it to where it already is cancels the order. Orders are carried out when you end the turn.
  order(fid, to) {
    const f = this.fleets.find(x => x.id === fid);
    if (!f || f.owner !== 'fed' || f.moved || !this.canAct(f.at)) return false;
    if (to === f.at || to == null) { f.order = null; return true; }
    if (!this.P[f.at].adj.includes(to)) return false;
    f.order = to; return true;
  }
  // Join every fleet of yours at a system that has no order into one.
  combine(pid) {
    if (!this.canAct(pid)) return false;
    const fs = this.fleetsAt(pid, 'fed').filter(f => f.order == null); if (fs.length < 2) return false;
    const a = fs[0];
    for (const b of fs.slice(1)) { a.ships += b.ships; a.moved = a.moved || b.moved; a.vet = a.vet || b.vet; a.strike = a.strike || b.strike; a.flank = a.flank || b.flank; this.fleets.splice(this.fleets.indexOf(b), 1); }
    return true;
  }
  // Break a fleet in two.
  split(fid) {
    const f = this.fleets.find(x => x.id === fid);
    if (!f || f.owner !== 'fed' || f.ships < 2 || !this.canAct(f.at)) return false;
    const n = Math.floor(f.ships / 2); f.ships -= n; const g = this._spawn('fed', f.at, n, f.moved); g.vet = f.vet; return true;
  }
  // What one ship costs at this system. The key world's kind and the priority front make it cheaper.
  shipCost(p) {
    const c = { ...C.ship.cost }, t = this.keyWorld(p).type;
    if (t === 'refinery') c.fuel = 0; if (t === 'forge') c.army = 0; if (t === 'colony') c.drop = 0;
    if (this.priority != null && p.front === this.priority) c.fuel = Math.max(0, c.fuel - C.priority.fuel);
    return c;
  }
  canBuild(pid) { const p = this.P[pid]; return !!p && p.owner === 'fed' && !p.built && this.canAct(pid) && this.fedLinked().has(pid) && this.canPay(this.shipCost(p)); }
  // Build one ship at a system of yours: one per system per round. It can move from next round.
  build(pid) {
    if (!this.canBuild(pid)) return false;
    const p = this.P[pid]; this._pay(this.shipCost(p)); p.built = true;
    if (this.keyWorld(p).type === 'fortress' && (p.yard || 0) < 3) { p.yard = (p.yard || 0) + 1; p.bonus++; }
    this._spawn('fed', pid, 1, true); return true;
  }

  // ---------- playing cards ----------
  // t is what the card is played on: { fleet } for a boost, { sys } for a trap or an order, { battle } in a fight.
  canPlay(i, t = {}) {
    const id = this.hand[i], c = C.cards[id], no = why => ({ ok: false, why });
    if (!c || this.over) return no('');
    if (c.type === 'dissent') return no('Dissent cannot be played. The Ministry of Truth can remove it.');
    if (when(c) !== this.phase) return no(when(c) === 'battle' ? 'Played during a battle.' : 'Played on your turn.');
    if (this.phase === 'battle') {
      const b = this.battles.find(x => x.id === t.battle);
      if (!b || b.fight.done) return no('Tap a battle still being fought.');
      if (id === 'evac' && b.kind !== 'op') return no('Only your own attacks can be recalled.');
      return { ok: true };
    }
    if (c.type === 'boost' || c.target === 'fleet') {
      const f = this.fleets.find(x => x.id === t.fleet);
      if (!f || f.owner !== 'fed') return no('Tap one of your fleets.');
      if (!this.canAct(f.at)) return no('That fleet is on another front. Its turn comes later this round.');
      if (id === 'forced' && !f.moved) return no('That fleet has not moved yet.');
      return { ok: true };
    }
    if (c.type === 'trap' || c.type === 'order' || c.target === 'system') {
      const p = this.P[t.sys];
      if (!p || p.owner !== 'fed') return no('Tap one of your own systems.');
      if (!this.canAct(p.id)) return no('That system is on another front. Its turn comes later this round.');
      if (c.type === 'trap' && p.trap) return no('That system already has a trap.');
      if (id === 'shipyard' && !this.fedLinked().has(p.id)) return no('No lane reaches that system.');
    }
    if (c.cost && !this.canPay(c.cost)) return no('Not enough to pay for it.');
    return { ok: true };
  }
  play(i, t = {}) {
    if (!this.canPlay(i, t).ok) return false;
    const id = this.hand[i], c = C.cards[id], r = this.res;
    const add = (k, n) => { r[k] = Math.min(C.resMax, r[k] + n); }, mor = n => { this.morale = clamp(this.morale + n, 0, 100); };
    this.hand.splice(i, 1); this._pay(c.cost);
    const f = this.fleets.find(x => x.id === t.fleet), p = this.P[t.sys];
    if (this.phase === 'battle') {
      const ft = this.battles.find(x => x.id === t.battle).fight;
      if (id === 'support') ft.P += 5; else if (id === 'armada') ft.P += 10; else if (id === 'blockade') ft.E *= 0.7; else { ft.done = true; ft.evac = true; }
    } else switch (id) {
      case 'strike': f.strike = true; break;
      case 'veteran': f.vet = true; break;
      case 'flank': f.flank = true; break;
      case 'forced': f.moved = false; break;
      case 'flagship': f.ships += 3; break;
      case 'mines': case 'ambush': case 'decoy': p.trap = id; return true;   // a trap stays on the map, not in the discard pile
      case 'shipyard': this._spawn('fed', p.id, 1, true); break;
      case 'fortify': p.bonus += 3; break;
      case 'bulwark': p.bonus += 8; break;
      case 'bonds': mor(10); break;
      case 'broadcast': add('drop', 4); break;
      case 'convoy': add('fuel', 5); break;
      case 'levy': add('army', 5); mor(-3); break;
      case 'cache': add('fuel', 10); break;
      case 'reserve': add('army', 8); break;
      case 'anthem': mor(20); add('drop', 3); break;
    }
    if (c.type !== 'relic') this.discard.push(id);   // a relic is spent; everything else comes round again
    return true;
  }
  // The one free Secondary Order of the round.
  useSecondary(bid) {
    const b = this.battles.find(x => x.id === bid);
    if (!b || b.fight.done || !this.secondary || this.phase !== 'battle') return false;
    b.fight.P += C.secondary; this.secondary = false; return true;
  }

  // ---------- the ministries ----------
  trade(from, to) {
    if (this.phase !== 'plan' || from === to || !this.canPay({ [from]: C.trade.give })) return false;
    this.res[from] -= C.trade.give; this.res[to] = Math.min(C.resMax, this.res[to] + C.trade.get); return true;
  }
  // What each resource is expected to bring in next round.
  income() {
    const fl = this.fedLinked(), pol = C.policy[this.policy], mf = 0.5 + this.morale / 100, r = { fuel: C.capitalYield.fuel, army: C.capitalYield.army, drop: C.capitalYield.drop * mf };
    for (const p of this.P) {
      if (p.owner !== 'fed' || p.id === 0 || !fl.has(p.id)) continue;
      const m = (1 + C.develop.mult * p.dev) * (this.priority != null && p.front === this.priority ? C.priority.yield : 1);
      for (const w of p.worlds) {
        const t = C.worlds[w.type]; if (!t.res) continue;
        r[t.res] += t.y * m * (t.res === 'drop' ? mf * pol.drop : t.res === 'army' ? pol.forge : 1);
        if (w.type === 'colony') r.army += pol.army * m;
      }
    }
    return r;
  }
  developCost(p) { return { fuel: C.develop.fuel * (p.dev + 1), army: C.develop.army * (p.dev + 1) }; }
  develop(pid) {
    const p = this.P[pid];
    if (this.phase !== 'plan' || !p || p.owner !== 'fed' || p.dev >= C.develop.max || !this.fedLinked().has(pid) || !p.worlds.some(w => C.worlds[w.type].res)) return false;
    const c = this.developCost(p); if (!this.canPay(c)) return false;
    this._pay(c); p.dev++; return true;
  }
  broadcast() {
    const c = C.truth.broadcast; if (this.phase !== 'plan' || this.used.broadcast || !this.canPay({ fuel: c.fuel })) return false;
    this.res.fuel -= c.fuel; this.morale = clamp(this.morale + c.morale, 0, 100); this.used.broadcast = true; return true;
  }
  purge() {
    if (this.phase !== 'plan' || !this.canPay({ army: C.truth.purge.army })) return false;
    for (const pile of [this.hand, this.discard, this.drawPile]) {
      const i = pile.indexOf('dissent'); if (i < 0) continue;
      pile.splice(i, 1); this.res.army -= C.truth.purge.army; return true;
    }
    return false;
  }
  setPolicy(k) { if (this.phase !== 'plan' || !C.policy[k]) return false; this.policy = k; return true; }
  setPriority(k) { if (this.phase !== 'plan') return false; this.priority = this.priority === k ? null : k; return true; }
  // Intelligence: what to do about the position, most pressing first.
  advice() {
    const out = [], say = (kind, text, pid) => out.push({ kind, text, pid }), fl = this.fedLinked();
    if (this.offers.length) say('good', 'A card is on offer for your deck.');
    const hot = [];
    for (const p of this.P) { const t = this.threat(p.id); if (t) hot.push({ p, t, d: this.defence(p.id, t.f, fl) }); }
    hot.sort((a, b) => a.p.ring - b.p.ring);
    const cap = hot.find(h => h.p.id === 0);
    if (cap) say('bad', `${N.factions[cap.t.f]} can strike ${N.capital} next turn: ${Math.round(cap.t.str)} against your ${Math.round(cap.d)}.${this.capHit.length ? ' A second enemy striking it in the same round is defeat.' : ''} Bring a fleet home.`, 0);
    let n = 0;
    for (const h of hot) if (h.p.id && h.d < h.t.str * 1.08 && n++ < 3) say(this.canAct(h.p.id) ? 'warn' : 'info', `${h.p.name} is likely to fall: ${N.factions[h.t.f]} has ${Math.round(h.t.str)} beside it against your ${Math.round(h.d)}.${this.canAct(h.p.id) ? ' Move a fleet in, build a ship there, or lay a trap.' : ' Its front comes later this round.'}`, h.p.id);
    if (this.phase === 'plan') {
      const mine = this.fleets.filter(f => f.owner === 'fed' && !f.moved && f.order == null && this.canAct(f.at));
      let k = 0;
      for (const f of mine) for (const t of this.P[f.at].adj) {
        const q = this.P[t]; if (q.owner === 'fed' || k >= 2) continue;
        const g = this.garrison(t), s = this.fleetStr(f, true);
        if (s >= g * 1.15) { k++; say('good', `Your fleet at ${this.P[f.at].name} (${Math.round(s)}) can take ${q.name} (${Math.round(g)})${q.kind === 'home' ? ', the enemy home' : q.relic ? ', a relic system' : ''}.`, f.at); break; }
      }
      if (mine.length) say('info', `${mine.length} of your fleet${mine.length > 1 ? 's have' : ' has'} no order this turn. Tap a system with a fleet, then tap where it should go.`, mine[0].at);
      if (this.canPay(C.ship.cost) && this.P.some(p => this.canBuild(p.id))) say('info', 'You can afford a ship. Tap a system of yours near the fighting and build one.');
    }
    for (const f of C.factions) { const F = this.F[f]; if (F.state === 'active' && F.cards.length) say('warn', `${N.factions[f]} holds a card and will play it on its turn.`); }
    const dis = this.deckCount('dissent'); if (dis) say('warn', `${dis} Dissent card${dis > 1 ? 's' : ''} in your deck. The Ministry of Truth can remove ${dis > 1 ? 'them' : 'it'}.`);
    if (this.morale < C.deck.low) say('warn', 'Morale is low: you draw one card fewer. Ministry of Truth.');
    if (this.res.fuel < 2) say('warn', 'Fuel is short. The Ministry of Prosperity can exchange Army or Vanguard for it.');
    const cut = this.P.filter(p => p.owner === 'fed' && !fl.has(p.id)).length; if (cut) say('warn', `${cut} of your systems ${cut > 1 ? 'are' : 'is'} cut off: no income, half defence.`);
    return out.slice(0, 8);
  }

  // ---------- the turn ----------
  _fight(P, E) { return { P, E, p: 0.5, t: 0, done: false, win: null }; }
  _firstFront() { this.fi = C.fronts.findIndex((_, i) => this.atWar(i)); this.phase = 'plan'; this.stage = 'you'; }
  // End your turn on this front: fleets ordered to your own systems move, and fleets ordered onto enemy systems attack.
  endTurn() {
    if (this.phase !== 'plan' || this.over) return;
    this.battles = []; this.offers = [];
    const atk = new Map();
    for (const f of this.fleets) {
      if (f.owner !== 'fed' || f.order == null) continue;
      const to = f.order; f.order = null;
      if (this.P[to].owner === 'fed') { this.moves.push({ owner: 'fed', from: f.at, to, ships: f.ships }); f.at = to; f.moved = true; }
      else { if (!atk.has(to)) atk.set(to, []); atk.get(to).push(f); }
    }
    for (const [pid, fs] of atk) {
      const p = this.P[pid]; let P = 0; for (const f of fs) { P += this.fleetStr(f, true, fs.length - 1); f.moved = true; }
      if (p.owner === 'veil') this.morale = clamp(this.morale - C.veilCost, 0, 100);
      this.battles.push({ id: ++this.bid, kind: 'op', f: p.owner, pid, from: fs[0].at, fleets: fs.map(f => f.id), fight: this._fight(P, this.garrison(pid)) });
    }
    this.stage = 'yourBattle';
    if (this.battles.length) this.phase = 'battle'; else this._afterYours();
  }
  _afterYours() {
    this.battles = [];
    if (this.fi < 0) return this._endRound();
    const n = this._enemyTurn(C.fronts[this.fi].f);
    if (this.over) return;
    this.stage = 'enemyBattle';
    if (n) this.phase = 'battle'; else this._nextFront();
  }
  _nextFront() {
    this.battles = [];
    let i = this.fi + 1; while (i < 3 && !this.atWar(i)) i++;
    if (i >= 3) return this._endRound();
    this.fi = i; this.phase = 'plan'; this.stage = 'you';
  }

  // Fights run live: the bar drifts toward the stronger side, with some luck, until it fills or time runs out.
  tick(dt) {
    if (this.phase !== 'battle' || this.over) return;
    let open = 0;
    for (const b of this.battles) {
      const f = b.fight; if (f.done) continue;
      f.t += dt;
      f.p += (f.P - f.E) / (f.P + f.E) * C.battle.rate * dt + (this.rnd() * 2 - 1) * C.battle.noise * Math.sqrt(dt);
      if (f.p >= 1 || f.p <= 0 || f.t >= C.battle.dur) { f.done = true; f.win = f.p >= 0.5; f.p = clamp(f.p, 0, 1); } else open++;
    }
    // A short hold once every fight is settled, so the results can be read on the map.
    if (!open && (this.hold = (this.hold || 0) + dt) >= C.battle.hold) {
      this.hold = 0; this._resolve(); if (this.over) return;
      if (this.stage === 'yourBattle') this._afterYours(); else this._nextFront();
    }
  }

  // Take `n` ships off a group of fleets, biggest first; empty fleets are removed. `keep` ships always survive.
  _losses(fs, n, keep = 0) {
    let total = fs.reduce((a, f) => a + f.ships, 0); n = Math.min(n, Math.max(0, total - keep));
    while (n-- > 0) { const f = fs.filter(x => x.ships > 0).sort((a, b) => b.ships - a.ships)[0]; if (!f) break; f.ships--; }
    for (const f of fs) if (f.ships <= 0) this.fleets.splice(this.fleets.indexOf(f), 1);
  }
  // A beaten fleet falls back to a neighbouring system of its own side, or is lost if there is none.
  _retreat(fs, pid, owner) {
    const fl = owner === 'fed' ? this.fedLinked() : null;
    const outs = this.P[pid].adj.filter(n => this.P[n].owner === owner).sort((a, b) => (owner === 'fed' ? (fl.has(b) - fl.has(a)) || this.P[a].dist - this.P[b].dist : this.P[b].dist - this.P[a].dist));
    for (const f of fs) {
      if (!this.fleets.includes(f)) continue;
      if (!outs.length) { this.fleets.splice(this.fleets.indexOf(f), 1); continue; }
      this.moves.push({ owner, from: pid, to: outs[0], ships: f.ships }); f.at = outs[0]; f.order = null;
    }
  }
  _capture(p, owner) { p.owner = owner; p.bonus = 0; p.dev = 0; p.yard = 0; if (p.trap) { this.discard.push(p.trap); p.trap = null; } }

  _resolve() {
    const add = (k, n) => { this.res[k] = Math.min(C.resMax, this.res[k] + n); };
    for (const b of this.battles) {
      const p = this.P[b.pid], F = this.F[b.f], fn = N.factions[b.f], f = b.fight;
      if (F.state === 'dead') continue;
      const ours = b.kind === 'op' ? this.fleets.filter(x => b.fleets.includes(x.id)) : this.fleetsAt(b.pid, 'fed');
      const theirs = b.kind === 'op' ? this.fleetsAt(b.pid, b.f) : this.fleets.filter(x => b.fleets.includes(x.id));
      if (b.kind === 'op') {
        if (f.evac) { this.say('info', `The attack on ${p.name} is recalled.`); continue; }
        if (f.win) {
          for (const x of theirs) x.ships -= Math.ceil(x.ships * C.loss.loser);
          this._losses(theirs, 0); this._retreat(theirs, b.pid, b.f);
          this._losses(ours, Math.round(f.E / S * C.loss.winner), 1);
          for (const x of ours) if (this.fleets.includes(x)) x.at = b.pid;
          this.stats.opsWon++; this.stats.taken++; this.morale += C.mor.off;
          if (b.f === 'foundry') add('army', C.scrap);
          if (p.kind === 'home') { this._capture(p, 'fed'); this._kill(b.f); continue; }
          this._capture(p, 'fed');
          this.say('good', `${p.name} taken from ${fn}.`);
          if (p.relic) { this.give(p.relic, `${p.name} retaken`); p.relicAt = this.round + C.relic.every; }
          if (p.relic || p.ring <= 2 || f.E >= 5 * S) this._offer(`${p.name} taken`);
        } else {
          for (const x of ours) x.ships -= Math.ceil(x.ships * C.loss.loser);
          this._losses(ours, 0);
          this._losses(theirs, Math.round(f.P / S * C.loss.winner), theirs.length ? 1 : 0);
          this.stats.opsLost++; this.morale -= C.mor.offLoss;
          this.say('bad', `The attack on ${p.name} failed. The fleet pulls back with half its ships.`);
        }
      } else if (f.win) {
        for (const x of theirs) { x.ships -= Math.ceil(x.ships * C.loss.loser); x.wait = 0; }
        this._losses(theirs, 0);
        this._losses(ours, Math.round(f.E / S * C.loss.winner), ours.length ? 1 : 0);
        this.stats.held++; this.morale += C.mor.def;
        this.say('good', `${p.name} held against ${fn}.`);
        if (b.pid === 0) this._offer(`${N.capital} stands`);
      } else {
        if (b.pid === 0) return this._end('lost', `${N.capital} fell to ${fn}.`);
        for (const x of ours) x.ships -= Math.ceil(x.ships * C.loss.loser);
        this._losses(ours, 0); this._capture(p, b.f); this._retreat(ours, b.pid, 'fed');
        this._losses(theirs, Math.round(f.P / S * C.loss.winner), 1);
        for (const x of theirs) if (this.fleets.includes(x)) { x.at = b.pid; x.wait = 0; }
        this.stats.fallen++; this.morale -= C.mor.defLoss;
        this.discard.push('dissent');
        this.say('bad', `${p.name} fell to ${fn}. Dissent spreads: a Dissent card joins your deck.`);
        if (p.ring <= 2 || p.relic) this._enemyCard(b.f);
      }
    }
    this._merge();
  }
  // Enemy fleets that end up in the same system join up. The Swarm stays in small packs.
  _merge() {
    for (const f of C.factions) {
      if (f === 'swarm') continue;
      const at = new Map();
      for (const x of [...this.fleets]) { if (x.owner !== f) continue; const a = at.get(x.at); if (a) { a.ships += x.ships; a.wait = Math.max(a.wait, x.wait); this.fleets.splice(this.fleets.indexOf(x), 1); } else at.set(x.at, x); }
    }
  }

  _kill(f) {
    const F = this.F[f]; F.state = 'dead';
    for (const p of this.P) if (p.owner === f) this._capture(p, 'fed');
    this.fleets = this.fleets.filter(x => x.owner !== f);
    this.morale += C.mor.kill;
    this.say('good', `${N.homes[f]} is taken. ${N.factions[f]} is wiped from the map.`);
    this._offer(`${N.factions[f]} destroyed`);
    if (C.factions.every(k => this.F[k].state === 'dead')) this._end('won', 'All three enemies are gone from the map.');
  }
  // A major loss hands that enemy a card from its deck. It plays one at the start of each of its turns.
  _enemyCard(f) {
    const ids = Object.keys(C.enemyCards[f]), id = ids[Math.floor(this.rnd() * ids.length)];
    this.F[f].cards.push(id); this.say('bad', `${N.factions[f]} gains ${C.enemyCards[f][id].name}.`);
  }

  _arrivals() {
    for (const f of C.factions) {
      const F = this.F[f], c = C.enemy[f];
      if (F.state === 'wait' && this.round >= F.at - C.warn) {
        F.state = 'warn';
        this.say('warn', `Ministry of Intelligence: hostile signals near ${N.homes[f]}, on the ${C.fronts[F.front].name.toLowerCase()}. Expected in ${Math.max(1, F.at - this.round)} round(s).`);
      }
      if (F.state === 'warn' && this.round >= F.at) {
        F.state = 'active';
        // They burst in: the home and the systems beside it on its front fall at once.
        const take = [F.home, ...this.P[F.home].adj.filter(n => this.P[n].front === F.front)];
        for (const id of take) { this._capture(this.P[id], f); this._retreat(this.fleetsAt(id, 'fed'), id, 'fed'); }
        c.init.forEach((n, i) => this._spawn(f, take[i % take.length], n));
        this.say('bad', `${N.factions[f]} has taken ${N.homes[f]} and ${take.length - 1} systems beside it. The ${C.fronts[F.front].name.toLowerCase()} is open.`);
      }
    }
  }

  // The enemy's turn on its front: it plays a card if it holds one, builds at its home, then every fleet moves one
  // system toward your territory or attacks a system beside it. Returns the number of battles to fight.
  _enemyTurn(f) {
    const F = this.F[f], c = C.enemy[f]; F.played = null; if (F.state !== 'active') return 0;
    let mult = 1, bonus = 0, steps = 1;
    const card = F.cards.shift();
    if (card) {
      const cd = C.enemyCards[f][card]; F.played = card;
      this.say('bad', `${N.factions[f]} plays ${cd.name}: ${cd.text}.`);
      if (card === 'frenzy') mult = 1.5;
      else if (card === 'brood' || card === 'surge') this._spawn(f, F.home, 3);
      else if (card === 'tunnel') steps = 2;
      else if (card === 'engines') bonus = 4;
      else if (card === 'dig') F.dig = this.round + 2;
      else if (card === 'conversion') { this.morale -= 8; this.res.drop = Math.max(0, this.res.drop - 2); }
      else if (card === 'shroud') { for (const p of this.P) if (p.front === F.front && p.trap) { this.discard.push(p.trap); p.trap = null; } }
      else if (card === 'dread') { this.morale -= 5; this.noRecruit = true; }
    }
    F.pool += c.build + this.P.filter(p => p.owner === f).length * c.per + this.round * c.ramp;
    while (F.pool >= c.fleet && this.P[F.home].owner === f) { F.pool -= c.fleet; this._spawn(f, F.home, c.fleet); }
    this._merge();
    const ok = id => id === 0 || this.P[id].front === F.front;   // it keeps to its own front and the capital
    const attacks = new Map();
    for (let step = 0; step < steps; step++) {
      // hops to your nearest system, through its own territory
      const fd = this.P.map(() => 99), q = [];
      for (const p of this.P) if (p.owner === 'fed' && ok(p.id)) { fd[p.id] = 0; q.push(p.id); }
      while (q.length) { const a = q.shift(); for (const b of this.P[a].adj) if (ok(b) && fd[b] > fd[a] + 1) { fd[b] = fd[a] + 1; q.push(b); } }
      const fl = this.fedLinked(), mine = this.fleets.filter(x => x.owner === f && !x.going).sort((a, b) => fd[a.at] - fd[b.at]);
      // each fleet beside one of your systems picks the softest; fleets with the same target strike together
      const want = new Map();
      for (const x of mine) {
        const ts = this.P[x.at].adj.filter(n => ok(n) && this.P[n].owner === 'fed'); if (!ts.length) continue;
        ts.sort((a, b) => this.defence(a, f, fl) - this.defence(b, f, fl) || this.P[a].dist - this.P[b].dist);
        if (!want.has(ts[0])) want.set(ts[0], []); want.get(ts[0]).push(x);
      }
      for (const [pid, fs] of want) {
        const str = fs.reduce((a, x) => a + x.ships * S, 0) * mult + bonus;
        if (str >= this.defence(pid, f, fl) * c.aggr || fs.some(x => x.wait >= C.patience)) { for (const x of fs) x.going = pid; if (!attacks.has(pid)) attacks.set(pid, []); attacks.get(pid).push(...fs); }
        else for (const x of fs) x.wait++;
      }
      // the rest move one system closer
      for (const x of mine) {
        if (x.going != null || fd[x.at] <= 1) continue;
        const next = this.P[x.at].adj.filter(n => ok(n) && this.P[n].owner === f && fd[n] < fd[x.at]).sort((a, b) => fd[a] - fd[b] || this.rnd() - 0.5)[0];
        if (next != null) { this.moves.push({ owner: f, from: x.at, to: next, ships: x.ships }); x.at = next; }
      }
      this._merge();
    }
    let n = 0;
    for (const [pid, fs] of attacks) {
      const p = this.P[pid]; for (const x of fs) delete x.going;
      if (p.trap === 'decoy') { this.discard.push('decoy'); p.trap = null; for (const x of fs) x.wait = 0; this.say('good', `DECOY: ${N.factions[f]} turns back from ${p.name}.`); continue; }
      let E = fs.reduce((a, x) => a + x.ships * S, 0) * mult + bonus, P = this.defence(pid, f);
      if (p.trap === 'mines') { E *= 0.6; this.say('good', `MINEFIELD: the attack on ${p.name} loses 40% of its strength.`); }
      if (p.trap === 'ambush') { P += 5; this.say('good', `AMBUSH: +5 defence at ${p.name}.`); }
      if (p.trap) { this.discard.push(p.trap); p.trap = null; }
      if (pid === 0) {
        if (this.capHit.length && !this.capHit.includes(f)) { this._end('lost', `Two enemies struck ${N.capital} in the same round.`); return 0; }
        this.capHit.push(f);
      }
      this.battles.push({ id: ++this.bid, kind: 'def', f, pid, from: fs[0].at, fleets: fs.map(x => x.id), fight: this._fight(P, E) }); n++;
    }
    for (const x of this.fleets) delete x.going;
    return n;
  }

  _endRound() {
    const fl = this.fedLinked(), r = this.res, inc = this.income();
    r.fuel += inc.fuel; r.army += inc.army; if (!this.noRecruit) r.drop += inc.drop;
    let minRing = 9, veil = 0;
    for (const p of this.P) {
      p.temp = 0; p.built = false;
      if (p.owner !== 'fed') { minRing = Math.min(minRing, p.ring); if (p.owner === 'veil') veil++; continue; }
      // A relic system sends its card to your hand every few rounds.
      if (p.relic && fl.has(p.id) && this.round >= p.relicAt && !this.hand.includes(p.relic)) { this.give(p.relic, `relic of ${p.name}`); p.relicAt = this.round + C.relic.every; }
    }
    if (!this.noRecruit) r.drop += Math.max(0, 3 - minRing) * C.rally + (this.rnd() - 0.5);
    this.noRecruit = false;
    this.morale -= veil * C.veilDrain;
    this.morale += C.policy[this.policy].morale;
    this.morale += Math.sign(50 - this.morale) * Math.min(C.mor.drift, Math.abs(50 - this.morale));
    this.morale = clamp(this.morale, 0, 100);
    if (this.morale < C.deck.low && this.rnd() < 0.5) { this.discard.push('dissent'); this.say('warn', 'Morale is low. Dissent spreads: a Dissent card joins your deck.'); }
    for (const k in r) r[k] = clamp(r[k], 0, C.resMax);
    for (const f of this.fleets) { f.moved = false; f.order = null; f.strike = f.vet = f.flank = false; }
    this.used = { broadcast: false }; this.secondary = true; this.capHit = []; this.battles = [];
    this.round++;
    this._arrivals();
    this._drawHand();
    this._firstFront();
  }

  _end(result, why) {
    this.over = { result, why, round: this.round }; this.phase = 'over'; this.battles = [];
    this.say(result === 'won' ? 'good' : 'bad', why);
  }
}
