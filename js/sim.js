// The whole game as rules. No DOM, so it runs the same in the browser and in `npm run sim`.
// A round: draw a hand -> PLAN (play cards, give orders through the ministries) -> BATTLE (live) -> the enemies'
// turn -> income -> discard and draw again.
//
// HANDOFF: a battle is one fight on the system's key world, shown as a single bar. This is the place where the
// other games would take over later (a space battle to reach the world, a ground battle on it), so it is kept
// simple on purpose. Everything a fight needs is in `_fight()` and `tick()`; its result is only `fight.win`.
import { C } from './config.js';
import { makeMap } from './map.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const N = C.names;
const when = c => c.when || (c.type === 'battle' ? 'battle' : 'plan');

export class Game {
  constructor(seed = 1, saved = null) {
    this.seed = seed;
    this.rs = (seed * 7919 + 13) | 0;
    this.map = makeMap(seed);
    this.P = this.map.planets;       // star systems
    this.round = 1; this.phase = 'plan'; this.over = null;
    this.res = { ...C.start.res }; this.morale = C.start.morale;
    this.F = {};
    C.factions.forEach((f, s) => {
      const a = C.arrive[f];
      this.F[f] = { id: f, sector: s, state: 'wait', at: a.round + Math.round((this.rnd() * 2 - 1) * a.vary), force: 0, cards: [], dig: 0, home: this.map.home[s] };
    });
    // the deck
    this.drawPile = []; this.hand = []; this.discard = []; this.offers = [];
    for (const id in C.cards) for (let i = 0; i < (C.cards[id].starter || 0); i++) this.drawPile.push(id);
    this._shuffle(this.drawPile);
    // orders
    this.ops = [null, null, null];   // one operation per front (a front is one enemy): { target, cards: [] }
    this.directive = null;           // { sector, mode: 'attack' | 'defend' }
    this.mob = null;                 // { s, at, until }: a front being mobilised for a major offensive
    this.prop = { rally: false, newsreel: false };
    this.policy = 'balanced';        // Ministry of Humanity
    this.route = null;               // Ministry of Employment: the priority route, 0 to 5
    this.used = { broadcast: false };
    this.secondary = true;
    this.threats = [];               // enemy attacks announced for the coming battle phase
    this.battles = []; this.bid = 0;
    this.retal = [false, false, false];
    this.noRecruit = false;
    this.log = [];
    this.stats = { taken: 0, fallen: 0, opsWon: 0, opsLost: 0, held: 0 };
    if (saved) return this._restore(saved);
    this.say('info', 'Ministry of Truth: every world on the map flies the ' + N.fed + ' flag. Long may it last.');
    this._arrivals(); this._drawHand();
  }

  rnd() {
    const a = this.rs = (this.rs + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  say(kind, text) { this.log.push({ r: this.round, kind, text }); }

  // ---------- saving ----------
  save() {
    const k = ['seed', 'rs', 'round', 'res', 'morale', 'F', 'drawPile', 'hand', 'discard', 'offers', 'mob', 'policy', 'route', 'used', 'threats', 'retal', 'noRecruit', 'stats', 'over'];
    const d = { v: 4, log: this.log.slice(-80), P: this.P.map(p => [p.owner, p.bonus, p.relicAt, p.dev, p.temp]) };
    for (const x of k) d[x] = this[x];
    // Orders in progress are not saved: their cards go back to the hand.
    d.hand = [...this.hand, ...this.ops.flatMap(o => (o ? o.cards : []))];
    return d;
  }
  _restore(d) {
    for (const k in d) if (k !== 'v' && k !== 'P') this[k] = d[k];
    d.P.forEach(([o, b, ra, dv, tp], i) => { const p = this.P[i]; p.owner = o; p.bonus = b; p.relicAt = ra; p.dev = dv; p.temp = tp || 0; });
    this.phase = this.over ? 'over' : 'plan';
    return this;
  }
  static load(d) { return d && d.v === 4 ? new Game(d.seed, d) : null; }

  // ---------- the board ----------
  linked(owner, root) {
    const seen = new Set();
    if (this.P[root].owner !== owner) return seen;
    seen.add(root); const q = [root];
    while (q.length) for (const n of this.P[q.pop()].adj) if (!seen.has(n) && this.P[n].owner === owner) { seen.add(n); q.push(n); }
    return seen;
  }
  fedLinked() { return this.linked('fed', 0); }
  facLinked(f) { return this.linked(f, this.F[f].home); }
  keyWorld(p) { return p.worlds[p.key]; }
  // An enemy system can be attacked if it is next to a system of yours that a lane reaches.
  canTarget(pid, fl = this.fedLinked()) {
    const p = this.P[pid]; return !!p && p.owner !== 'fed' && p.adj.some(n => fl.has(n));
  }
  targets(s) { const fl = this.fedLinked(), f = C.factions[s]; return this.P.filter(p => p.owner === f && this.canTarget(p.id, fl)).map(p => p.id); }
  frontOf(pid) { const p = this.P[pid]; return p && p.owner !== 'fed' ? C.factions.indexOf(p.owner) : -1; }
  // A system's own defence when the Federation holds it.
  fort(p) {
    let v = C.fort[p.kind] + p.bonus + p.temp + (p.trait === 'bastion' ? C.traits.bastion.fort : 0) + (this.route != null && p.spoke === this.route ? C.route.fort : 0);
    for (const w of p.worlds) v += C.worlds[w.type].fort || 0;
    return v;
  }
  // A linked Federation neighbour of this system with the given strategic trait.
  near(pid, trait, fl = this.fedLinked()) { return this.P[pid].adj.some(n => fl.has(n) && this.P[n].trait === trait); }
  garrison(pid) {
    const p = this.P[pid], f = p.owner; if (f === 'fed') return 0;
    const F = this.F[f];
    let g = C.garr.base + C.garr.ring * p.ring + F.force * C.garr.force + (p.trait === 'bastion' ? C.traits.bastion.fort : 0) + (F.dig >= this.round ? C.garr.dig : 0);
    if (this.keyWorld(p).type === 'fortress') g += C.garr.fortress;
    // The home is fed by every system the enemy holds: roll back the branches before going for the trunk.
    if (p.kind === 'home') g = (g + C.garr.perPlanet * this.P.filter(q => q.owner === f).length) * C.garr.home;
    if (!this.facLinked(f).has(pid)) g *= C.cut;
    return g;
  }
  // What an operation on this system faces: the garrison, plus part of any attack it would pin there.
  enemyAt(pid) {
    return this.garrison(pid) + this.threats.filter(t => t.from === pid).reduce((a, t) => a + t.str * C.pin, 0);
  }
  // Does one of your operations pin this announced attack? It must strike the system the attack launches from,
  // and be at least half as strong as the attack.
  pins(t) {
    const o = this.ops[t.s];
    return !!o && o.target === t.from && this.count(t.s) > 0 && this.opStrength(t.s) >= t.str * C.pinNeed;
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
  deckCount(id) { const n = a => a.filter(x => x === id).length; return n(this.drawPile) + n(this.hand) + n(this.discard) + this.ops.reduce((a, o) => a + (o ? n(o.cards) : 0), 0); }
  deckSize() { return this.drawPile.length + this.hand.length + this.discard.length + this.ops.reduce((a, o) => a + (o ? o.cards.length : 0), 0); }
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

  // ---------- operations ----------
  count(s) { const o = this.ops[s]; return o ? o.cards.length : 0; }
  major(s) { const d = this.directive; return !!(d && d.mode === 'attack' && d.sector === s); }
  opCap(s) { return this.major(s) ? C.op.major : C.op.general; }
  fuelFor(pid) {
    const p = this.P[pid]; let v = C.op.fuel + C.op.fuelRing * p.ring;
    if (this.near(pid, 'depot')) v -= C.traits.depot.fuel;
    if (this.route != null && p.spoke === this.route) v -= C.route.fuel;
    return Math.max(1, v);
  }
  cost(s) {
    const o = this.ops[s], c = { fuel: 0, drop: 0, army: 0 };
    if (!o || !o.cards.length || this.retal[s]) return c;
    c.fuel = this.fuelFor(o.target);
    for (const id of o.cards) for (const k in C.cards[id].cost) c[k] += C.cards[id].cost[k];
    return c;
  }
  totalCost() {
    const t = { fuel: 0, drop: 0, army: 0 };
    for (let s = 0; s < 3; s++) { const c = this.cost(s); for (const k in t) t[k] += c[k]; }
    return t;
  }
  canPay(extra = {}) { const t = this.totalCost(); for (const k in t) if (t[k] + (extra[k] || 0) > this.res[k] + 1e-9) return false; return true; }
  dirBoost() { return this.prop.rally ? C.dir.rallied : C.dir.boost; }
  // Everything that scales an operation on this front: supply reach, a shipyard next door, the directive.
  opMult(s) {
    const o = this.ops[s]; if (!o) return 1;
    let v = 1 - C.reach * (this.P[o.target].ring - 1);
    if (this.near(o.target, 'shipyard')) v *= C.traits.shipyard.mult;
    const d = this.directive;
    if (d) v *= d.mode === 'attack' ? (d.sector === s ? this.dirBoost() : 1) : C.dir.drain;
    return v;
  }
  // One mission card's strength on a system: more against the enemy's weak point, more if it suits the key world.
  cardStr(id, pid) {
    const c = C.cards[id], p = this.P[pid];
    return c.str * (1 + (C.weak[p.owner] === c.fam ? C.weakAdd : 0) + (C.worlds[this.keyWorld(p).type].fav === c.fam ? C.favAdd : 0));
  }
  opStrength(s) {
    const o = this.ops[s]; if (!o || !o.cards.length) return 0;
    let v = 0; for (const id of o.cards) v += this.cardStr(id, o.target);
    return v * this.opMult(s) + (this.retal[s] ? C.retal : 0);
  }
  opEnemy(s) {
    const o = this.ops[s]; if (!o) return 0;
    let e = this.enemyAt(o.target); for (const id of o.cards) if (C.cards[id].sap) e *= C.cards[id].sap;
    return e;
  }
  // Take an operation's cards back into your hand.
  recall(s) { const o = this.ops[s]; if (!o || this.phase !== 'plan') return false; this.hand.push(...o.cards); this.ops[s] = null; return true; }
  // Mobilisation: a major offensive (the attack directive) has to be prepared a round ahead.
  mobilise(s, free = false) {
    if (this.phase !== 'plan' || this.F[C.factions[s]].state !== 'active' || (this.mob && this.mob.s === s && !free)) return false;
    if (!free) { if (!this.canPay({ fuel: C.mob.fuel })) return false; this.res.fuel -= C.mob.fuel; }
    this.mob = { s, at: this.round + (free ? 0 : 1), until: this.round + C.mob.last - (free ? 1 : 0) };
    if (this.directive && this.directive.mode === 'attack' && this.directive.sector !== s) { this.directive = null; this._trim(); }
    return true;
  }
  mobReady(s) { return !!(this.mob && this.mob.s === s && this.round >= this.mob.at); }
  setDirective(sector, mode) {
    if (this.phase !== 'plan') return false;
    const d = this.directive;
    if (sector == null || (d && d.sector === sector && d.mode === mode)) { this.directive = null; this.prop.newsreel = false; }
    else {
      if (mode === 'attack' && !this.mobReady(sector)) return false;
      // A defence order needs something to defend: an attack announced on that front.
      if (mode === 'defend' && !this.threats.some(t => t.s === sector)) return false;
      this.directive = { sector, mode };
    }
    this._trim(); return true;
  }
  // Without the offensive, an operation falls back to the size of a general attack: the extra cards come back.
  _trim() { for (let s = 0; s < 3; s++) { const o = this.ops[s]; if (o) while (o.cards.length > this.opCap(s)) this.hand.push(o.cards.pop()); } }
  // The automatic defence of a threatened system: its own forts, plus Army sent if a lane still reaches it.
  defence(t, army = this.res.army, fl = this.fedLinked()) {
    const p = this.P[t.to]; let D = this.fort(p), n = 0;
    if (fl.has(t.to)) {
      n = clamp(Math.ceil((t.str * C.def.margin - D) / C.def.perArmy), 0, Math.min(Math.floor(army), C.def.max));
      D += n * C.def.perArmy;
    } else D *= C.cut;
    if (t.to === 0) D += C.capitalRally;
    const d = this.directive;
    if (d) D *= d.mode === 'defend' ? (d.sector === t.s ? this.dirBoost() : 1) : C.dir.drain;
    return { D, n };
  }

  // The defence each announced attack will really meet this round: the Army left after your operations is shared
  // out in the order the battles are fought (nearest the capital first). Returns a Map from threat to { D, n }.
  defPlan() {
    const fl = this.fedLinked(), out = new Map(); let army = this.res.army - this.totalCost().army;
    for (const t of [...this.threats].sort((a, b) => this.P[a.to].ring - this.P[b.to].ring)) {
      const d = this.defence(t, Math.max(0, army), fl); out.set(t, d); if (!this.pins(t)) army -= d.n;
    }
    return out;
  }

  // ---------- playing cards ----------
  // Can card i of the hand be played on this target? target is a system id, or a battle id during the fighting.
  // Returns { ok } or { ok: false, why }.
  canPlay(i, target) {
    const id = this.hand[i], c = C.cards[id], no = why => ({ ok: false, why });
    if (!c || this.over) return no('');
    if (c.type === 'dissent') return no('Dissent cannot be played. The Ministry of Truth can remove it.');
    if (when(c) !== this.phase) return no(when(c) === 'battle' ? 'Played during a battle.' : 'Played while planning.');
    if (this.phase === 'battle') {
      const b = this.battles.find(x => x.id === target);
      if (!b || b.fight.done) return no('Tap a battle still being fought.');
      if (id === 'evac' && b.kind !== 'op') return no('Only your own operations can be recalled.');
      return { ok: true };
    }
    const p = this.P[target];
    if (c.type === 'mission') {
      if (!p || p.owner === 'fed') return no('Tap an enemy system marked in amber.');
      if (!this.canTarget(target)) return no('Out of reach. Take a system next to it first.');
      const s = this.frontOf(target), o = this.ops[s];
      if (o && o.target !== target) return no(`One operation per front. Recall the one on ${this.P[o.target].name} first.`);
      if (this.count(s) >= this.opCap(s)) return no(this.major(s) ? 'A major offensive carries four missions.' : 'A general attack carries two missions. Mobilise for a major offensive.');
      const extra = { ...c.cost }; if (!this.count(s) && !this.retal[s]) extra.fuel = (extra.fuel || 0) + this.fuelFor(target);
      if (!this.retal[s] && !this.canPay(extra)) return no('Not enough to pay for it.');
      return { ok: true };
    }
    if (c.needs === 'planet' && !(p && p.owner === 'fed')) return no('Tap one of your own systems.');
    if (c.needs === 'directive' && (!this.directive || this.prop.rally)) return no('Needs a major offensive or a defence order this round.');
    if (c.needs === 'offensive' && (!this.major(this.directive ? this.directive.sector : -1) || this.prop.newsreel)) return no('Needs a major offensive this round.');
    if (c.needs === 'front') { const s = p ? this.frontOf(target) : -1; if (s < 0 || this.mobReady(s)) return no('Tap an enemy system on the front to mobilise.'); }
    if (c.cost && !this.canPay(c.cost)) return no('Not enough to pay for it.');
    return { ok: true };
  }
  play(i, target) {
    if (!this.canPlay(i, target).ok) return false;
    const id = this.hand[i], c = C.cards[id], r = this.res;
    const add = (k, n) => { r[k] = Math.min(C.resMax, r[k] + n); }, mor = n => { this.morale = clamp(this.morale + n, 0, 100); };
    this.hand.splice(i, 1);
    if (c.type === 'mission') {
      const s = this.frontOf(target);
      if (!this.ops[s]) this.ops[s] = { target, cards: [] };
      this.ops[s].cards.push(id); return true;
    }
    for (const k in c.cost || {}) r[k] -= c.cost[k];
    if (this.phase === 'battle') {
      const f = this.battles.find(x => x.id === target).fight;
      if (id === 'support') f.P += 5; else if (id === 'armada') f.P += 10; else if (id === 'blockade') f.E *= 0.7; else { f.done = true; f.evac = true; }
    } else switch (id) {
      case 'garrison': this.P[target].temp += 4; break;
      case 'fortify': this.P[target].bonus += 3; break;
      case 'bulwark': this.P[target].bonus += 8; break;
      case 'bonds': mor(10); break;
      case 'broadcast': add('drop', 4); break;
      case 'rally': this.prop.rally = true; break;
      case 'newsreel': this.prop.newsreel = true; break;
      case 'convoy': add('fuel', 5); break;
      case 'levy': add('army', 5); mor(-3); break;
      case 'cache': add('fuel', 10); break;
      case 'reserve': add('army', 8); break;
      case 'anthem': mor(20); add('drop', 3); break;
      case 'snap': this.mobilise(this.frontOf(target), true); break;
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
  // Prosperity: exchange three of one resource for two of another.
  trade(from, to) {
    if (this.phase !== 'plan' || from === to || !this.canPay({ [from]: C.trade.give })) return false;
    this.res[from] -= C.trade.give; this.res[to] = Math.min(C.resMax, this.res[to] + C.trade.get); return true;
  }
  // What each resource is expected to bring in next round.
  income() {
    const fl = this.fedLinked(), pol = C.policy[this.policy], mf = 0.5 + this.morale / 100, r = { fuel: C.capitalYield.fuel, army: C.capitalYield.army, drop: C.capitalYield.drop * mf };
    for (const p of this.P) {
      if (p.owner !== 'fed' || p.id === 0 || !fl.has(p.id)) continue;
      const m = (1 + C.develop.mult * p.dev) * (this.route != null && p.spoke === this.route ? C.route.yield : 1);
      for (const w of p.worlds) {
        const t = C.worlds[w.type]; if (!t.res) continue;
        r[t.res] += t.y * m * (t.res === 'drop' ? mf * pol.drop : t.res === 'army' ? pol.forge : 1);
        if (w.type === 'colony') r.army += pol.army * m;
      }
    }
    return r;
  }
  // Expansion: develop a system so its worlds pay more. The work is lost if the system falls.
  developCost(p) { return { fuel: C.develop.fuel * (p.dev + 1), army: C.develop.army * (p.dev + 1) }; }
  develop(pid) {
    const p = this.P[pid];
    if (this.phase !== 'plan' || !p || p.owner !== 'fed' || p.dev >= C.develop.max || !this.fedLinked().has(pid) || !p.worlds.some(w => C.worlds[w.type].res)) return false;
    const c = this.developCost(p); if (!this.canPay(c)) return false;
    for (const k in c) this.res[k] -= c[k];
    p.dev++; return true;
  }
  // Truth: one broadcast a round lifts morale; a purge removes one Dissent card from the deck for good.
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
  // Humanity: who the colonies send.
  setPolicy(k) { if (this.phase !== 'plan' || !C.policy[k]) return false; this.policy = k; return true; }
  // Employment: one route gets the work and the supply.
  setRoute(k) { if (this.phase !== 'plan') return false; this.route = this.route === k ? null : k; return true; }
  // Intelligence: what to do about the position, most pressing first.
  advice() {
    const out = [], say = (kind, text, pid) => out.push({ kind, text, pid }), fl = this.fedLinked();
    if (this.offers.length) say('good', 'A card is on offer for your deck.');
    const seen = this.threats.filter(t => !t.hidden), cap = seen.filter(t => t.to === 0 && !this.pins(t));
    if (new Set(cap.map(t => t.f)).size >= 2) say('bad', `Two enemies strike ${N.capital} this round. That is defeat unless one is pinned: attack ${cap.map(t => this.P[t.from].name).join(' or ')} with at least half its strength.`, cap[0].from);
    else for (const t of cap) say('bad', `${N.factions[t.f]} strikes ${N.capital} from ${this.P[t.from].name}. Pin it with an operation there, or give a Defence Order.`, t.from);
    if (this.threats.some(t => t.hidden)) say('bad', 'The Shroud hides the Veil\'s attacks this round. Keep Army in hand.');
    const dp = this.defPlan();
    for (const t of seen) {
      if (t.to === 0 || this.pins(t)) continue;
      const D = dp.get(t).D, p = this.P[t.to];
      if (D < t.str * 1.08) say('warn', `${p.name} is likely to fall (${Math.round(t.str)} against your ${Math.round(D)})${p.relic ? ', and it holds a relic' : p.kind === 'gate' || p.kind === 'junction' ? ', and it is a ' + p.kind : ''}. Reinforce it, give a Defence Order, or pin the attack at ${this.P[t.from].name}.`, t.to);
    }
    for (let s = 0; s < 3; s++) {
      const f = C.factions[s], F = this.F[f]; if (F.state !== 'active') continue;
      const ts = this.targets(s).sort((a, b) => this.enemyAt(a) - this.enemyAt(b));
      if (this.mobReady(s)) say('good', `The front against ${N.factions[f]} is mobilised. Launch the major offensive within ${this.mob.until - this.round + 1} round(s).`, ts[0]);
      if (ts.length && !this.count(s)) {
        const home = ts.find(id => this.P[id].kind === 'home');
        say('info', `${N.factions[f]} is weak to ${C.weak[f].toUpperCase()} cards. Softest system in reach: ${this.P[ts[0]].name} (${Math.round(this.enemyAt(ts[0]))})${home != null ? `. Its home is in reach (${Math.round(this.enemyAt(home))})` : ''}.`, ts[0]);
      }
      if (F.cards.length) say('warn', `${N.factions[f]} holds a card and will play it next turn.`);
    }
    if (!this.mob && C.factions.some(f => this.F[f].state === 'active')) say('info', 'No front is mobilised. A major offensive needs a round of preparation: Ministry of Defence.');
    const dis = this.deckCount('dissent'); if (dis) say('warn', `${dis} Dissent card${dis > 1 ? 's' : ''} in your deck. The Ministry of Truth can remove ${dis > 1 ? 'them' : 'it'}.`);
    if (this.morale < C.deck.low) say('warn', 'Morale is low: you draw one card fewer. Ministry of Truth.');
    if (this.res.fuel < 4) say('warn', 'Fuel is short. The Ministry of Prosperity can exchange Army or Vanguard for it.');
    for (const p of this.P) if (p.relic && p.owner !== 'fed' && this.canTarget(p.id, fl)) say('info', `${p.name} holds the relic ${C.cards[p.relic].name}. Retaking it gives you the card.`, p.id);
    const cut = this.P.filter(p => p.owner === 'fed' && !fl.has(p.id)).length; if (cut) say('warn', `${cut} of your systems ${cut > 1 ? 'are' : 'is'} cut off: no income, half defence.`);
    return out.slice(0, 8);
  }

  // ---------- the round ----------
  _fight(P, E) { return { P, E, p: 0.5, t: 0, done: false, win: null }; }
  endPlan() {
    if (this.phase !== 'plan' || this.over) return;
    const fl = this.fedLinked(); this.battles = []; this.offers = [];
    for (const t of this.threats) t.pinned = this.pins(t);
    for (let s = 0; s < 3; s++) {
      const o = this.ops[s]; if (!o || !o.cards.length) continue;
      const c = this.cost(s), p = this.P[o.target], f = p.owner;
      const b = { id: ++this.bid, kind: 'op', s, f, pid: p.id, fight: this._fight(this.opStrength(s), this.opEnemy(s)), paid: { drop: c.drop, army: c.army }, dir: this.major(s), news: this.major(s) && this.prop.newsreel };
      for (const k in c) this.res[k] -= c[k];
      this.discard.push(...o.cards);
      if (f === 'veil') this.morale = clamp(this.morale - C.veilCost, 0, 100);
      this.battles.push(b);
    }
    const live = this.threats.filter(t => !t.pinned);
    if (new Set(live.filter(t => t.to === 0).map(t => t.f)).size >= 2) {
      this.threats = []; return this._end('lost', `Two enemies reached ${N.capital} in the same hour.`);
    }
    live.sort((a, b) => this.P[a.to].ring - this.P[b.to].ring);
    for (const t of live) {
      if (this.P[t.to].owner !== 'fed') continue;   // only systems the Federation holds are ever defended
      const { D, n } = this.defence(t, this.res.army, fl);
      this.res.army -= n;
      this.battles.push({ id: ++this.bid, kind: 'def', s: t.s, f: t.f, pid: t.to, from: t.from, fight: this._fight(D, t.str), army: n, str: t.str });
    }
    if (this.directive && this.directive.mode === 'attack') this.mob = null;   // the offensive is spent
    this.ops = [null, null, null]; this.threats = []; this.phase = 'battle';
    if (!this.battles.length) this._resolve();
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
    if (!open && (this.hold = (this.hold || 0) + dt) >= C.battle.hold) { this.hold = 0; this._resolve(); }
  }

  _resolve() {
    const add = (k, n) => { this.res[k] = Math.min(C.resMax, this.res[k] + n); };
    for (const b of this.battles) {
      const p = this.P[b.pid], F = this.F[b.f], fn = N.factions[b.f], f = b.fight;
      if (F.state === 'dead') continue;
      if (b.kind === 'op') {
        if (f.evac) { add('drop', b.paid.drop); add('army', b.paid.army); this.say('info', `Operation on ${p.name} recalled.`); continue; }
        if (f.win) {
          add('drop', Math.floor(b.paid.drop / 2)); add('army', Math.floor(b.paid.army / 2));
          this.stats.opsWon++; this.stats.taken++; this.morale += C.mor.off;
          if (b.f === 'foundry') add('army', C.scrap);
          if (b.news) { this.morale += 10; add('drop', 4); this.say('good', 'The newsreel plays in every square: +10 morale, +4 Vanguard.'); }
          if (p.kind === 'home') { this._kill(b.f); continue; }
          p.owner = 'fed'; p.bonus = 0; p.dev = 0;
          this.say('good', `${p.name} retaken from ${fn}.`);
          if (p.relic) { this.give(p.relic, `${p.name} retaken`); p.relicAt = this.round + C.relic.every; }
          if (b.dir || p.kind === 'junction' || p.trait) this._offer(`${p.name} retaken`);
        } else {
          this.stats.opsLost++; this.morale -= C.mor.offLoss;
          this.say('bad', `Operation on ${p.name} failed.`);
          if (b.dir) this._enemyCard(b.f);
        }
      } else if (f.win) {
        add('army', Math.floor(b.army / 2)); this.stats.held++; this.morale += C.mor.def;
        this.say('good', `${p.name} held against ${fn}.`);
        if (b.pid === 0) { this.retal[b.s] = true; this._offer(`${N.capital} stands`); this.say('good', `${fn} is spent at the gates. Retaliation on that front is free this round.`); }
      } else {
        if (b.pid === 0) return this._end('lost', `${N.capital} fell to ${fn}.`);
        p.owner = b.f; p.bonus = 0; p.dev = 0; this.stats.fallen++; this.morale -= C.mor.defLoss; F.force += b.str * C.winBack;
        this.discard.push('dissent');
        this.say('bad', `${p.name} fell to ${fn}. Dissent spreads: a Dissent card joins your deck.`);
        if (p.kind === 'gate' || p.kind === 'junction' || p.relic) this._enemyCard(b.f);
      }
    }
    this.battles = []; this.directive = null; this.secondary = true;
    this.prop = { rally: false, newsreel: false }; this.used = { broadcast: false };
    for (const p of this.P) p.temp = 0;
    const hadRetal = this.retal; this.retal = [false, false, false];
    this.round++;
    if (this.mob && this.round > this.mob.until) { this.mob = null; this.say('warn', 'The mobilisation has stood down. The offensive was never launched.'); }
    this._arrivals();
    for (const f of C.factions) this._enemyTurn(f);
    this._income();
    this.retal = hadRetal.map((v, s) => v && this.F[C.factions[s]].state === 'active');
    this._drawHand();
    this.phase = 'plan';
    if (C.factions.every(f => this.F[f].state === 'dead')) this._end('won', 'All three enemies are gone from the map.');
  }

  _kill(f) {
    const F = this.F[f]; F.state = 'dead'; F.force = 0;
    for (const p of this.P) if (p.owner === f) { p.owner = 'fed'; p.bonus = 0; p.dev = 0; }
    if (this.mob && this.mob.s === F.sector) this.mob = null;
    this.threats = this.threats.filter(t => t.f !== f);
    this.morale += C.mor.kill;
    this.say('good', `${N.homes[F.sector]} is taken. ${N.factions[f]} is wiped from the map.`);
    this._offer(`${N.factions[f]} destroyed`);
  }
  // A major loss hands that enemy a card from its deck. It plays one at the start of each of its turns.
  _enemyCard(f) {
    const ids = Object.keys(C.enemyCards[f]), id = ids[Math.floor(this.rnd() * ids.length)];
    this.F[f].cards.push(id); this.say('bad', `${N.factions[f]} gains ${C.enemyCards[f][id].name}.`);
  }

  _arrivals() {
    for (const f of C.factions) {
      const F = this.F[f];
      if (F.state === 'wait' && this.round >= F.at - C.warn) {
        F.state = 'warn';
        this.say('warn', `Ministry of Intelligence: hostile signals near ${N.homes[F.sector]}. Expected in ${Math.max(1, F.at - this.round)} round(s).`);
      }
      if (F.state === 'warn' && this.round >= F.at) {
        F.state = 'active'; F.force = C.enemy[f].init;
        // They burst in: the home, the outer systems beside it and the systems beyond those fall at once.
        const take = [F.home];
        for (const n of this.P[F.home].adj) { take.push(n); for (const m of this.P[n].adj) if (this.P[m].kind === 'mid') take.push(m); }
        for (const id of take) { const p = this.P[id]; p.owner = f; p.bonus = 0; p.dev = 0; }
        this.say('bad', `${N.factions[f]} has taken ${N.homes[F.sector]} and four systems around it.`);
      }
    }
  }

  _enemyTurn(f) {
    const F = this.F[f], c = C.enemy[f]; F.played = null; if (F.state !== 'active') return;
    F.force += c.grow + this.P.filter(p => p.owner === f).length * c.per + this.round * c.ramp;
    let mult = 1, bonus = 0, deepOk = f === 'veil', hidden = false;
    const card = F.cards.shift();
    if (card) {
      F.played = card;   // shown when its turn is replayed on the map
      const cd = C.enemyCards[f][card];
      this.say('bad', `${N.factions[f]} plays ${cd.name}: ${cd.text}.`);
      if (card === 'frenzy') mult = C.frenzy;
      else if (card === 'brood') F.force += 8;
      else if (card === 'tunnel') deepOk = true;
      else if (card === 'surge') F.force += 9;
      else if (card === 'engines') bonus = 4;
      else if (card === 'dig') F.dig = this.round + 2;
      else if (card === 'conversion') { this.morale -= C.conversion.morale; this.res.drop = Math.max(0, this.res.drop - C.conversion.drop); }
      else if (card === 'shroud') hidden = true;
      else if (card === 'dread') { this.morale -= 5; this.noRecruit = true; }
    }
    // Where it can strike: your systems next to its linked territory.
    const link = this.facLinked(f), cand = new Map();
    for (const id of link) for (const n of this.P[id].adj) if (this.P[n].owner === 'fed' && !cand.has(n)) cand.set(n, id);
    if (!cand.size) return;
    let picks = [];
    const near = [...cand.keys()], deep = [];
    if (deepOk) for (const n of near) for (const m of this.P[n].adj) {   // one system past the front
      if (m !== 0 && this.P[m].owner === 'fed' && !cand.has(m)) { cand.set(m, cand.get(n)); deep.push(m); }
    }
    if (f === 'swarm') {            // spreads: several small attacks at once
      near.sort(() => this.rnd() - 0.5);
      let n = Math.min(c.targets, near.length);
      while (n > 1 && F.force * c.spend / n < c.minStr) n--;
      picks = near.slice(0, n);
      if (deep.length) picks[picks.length - 1] = deep[Math.floor(this.rnd() * deep.length)];
    } else if (f === 'foundry') {   // builds up, then one heavy blow at the weakest point
      if (F.force < c.hold) return;
      const fl = this.fedLinked();
      const soft = id => this.fort(this.P[id]) * (fl.has(id) ? 1 : C.cut) + this.P[id].ring * 0.1;
      near.sort((a, b) => soft(a) - soft(b));
      picks = near.slice(0, 1);
    } else {                        // slips behind the line
      let n = Math.min(c.targets, cand.size);
      while (n > 1 && F.force * c.spend / n < c.minStr) n--;
      const pool = [...near];
      for (let i = 0; i < n; i++) {
        const src = deep.length && this.rnd() < c.deep ? deep : pool.length ? pool : deep;
        if (!src.length) break;
        const pid = src.splice(Math.floor(this.rnd() * src.length), 1)[0];
        if (!picks.includes(pid)) picks.push(pid);
      }
    }
    if (!picks.length) return;
    const each = F.force * c.spend / picks.length;
    for (const to of picks) {
      this.threats.push({ f, s: F.sector, from: cand.get(to), to, str: each * mult + bonus, hidden });
      F.force -= each;
    }
  }

  _income() {
    const fl = this.fedLinked(), r = this.res, inc = this.income();
    r.fuel += inc.fuel; r.army += inc.army; if (!this.noRecruit) r.drop += inc.drop;
    let minRing = 9, veil = 0;
    for (const p of this.P) {
      if (p.owner !== 'fed') { minRing = Math.min(minRing, p.ring); if (p.owner === 'veil') veil++; continue; }
      // A relic system sends its card to your hand every few rounds.
      if (p.relic && fl.has(p.id) && this.round >= p.relicAt && !this.hand.includes(p.relic)) { this.give(p.relic, `relic of ${p.name}`); p.relicAt = this.round + C.relic.every; }
    }
    // Vanguard show up for a cause: more as the enemy nears the capital.
    if (!this.noRecruit) r.drop += Math.max(0, 3 - minRing) * C.rally + (this.rnd() - 0.5);
    this.noRecruit = false;
    this.morale -= veil * C.veilDrain;
    this.morale += C.policy[this.policy].morale;
    this.morale += Math.sign(50 - this.morale) * Math.min(C.mor.drift, Math.abs(50 - this.morale));
    this.morale = clamp(this.morale, 0, 100);
    if (this.morale < C.deck.low && this.rnd() < 0.5) { this.discard.push('dissent'); this.say('warn', 'Morale is low. Dissent spreads: a Dissent card joins your deck.'); }
    for (const k in r) r[k] = clamp(r[k], 0, C.resMax);
  }

  _end(result, why) {
    this.over = { result, why, round: this.round }; this.phase = 'over';
    this.say(result === 'won' ? 'good' : 'bad', why);
  }
}
