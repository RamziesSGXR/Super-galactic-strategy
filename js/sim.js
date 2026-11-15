// The whole game as rules. No DOM, so it runs the same in the browser and in `npm run sim`.
// A round: PLAN (operations, mobilisation, the directive, cards) -> BATTLE (live) -> the enemies' turn -> income.
//
// HANDOFF: a battle is a set of fights, one per world. Each fight is a single bar here. This is the place where the
// other games would take over later (a space battle to reach the world, a ground battle on it), so it is kept simple
// on purpose. Everything a fight needs is in `_fight()` and `tick()`; its result is only `fight.win`.
import { C } from './config.js';
import { makeMap } from './map.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const N = C.names;

export class Game {
  constructor(seed = 1, saved = null) {
    this.seed = seed;
    this.rs = (seed * 7919 + 13) | 0;
    this.map = makeMap(seed);
    this.P = this.map.planets;       // star systems; p.owner is who controls the system, each world has its own owner
    this.round = 1; this.phase = 'plan'; this.over = null;
    this.res = { ...C.start.res }; this.morale = C.start.morale;
    this.hand = [...C.start.hand]; this.secondary = true;
    this.F = {};
    C.factions.forEach((f, s) => {
      const a = C.arrive[f];
      this.F[f] = { id: f, sector: s, state: 'wait', at: a.round + Math.round((this.rnd() * 2 - 1) * a.vary), force: 0, cards: [], dig: 0, home: this.map.home[s] };
    });
    this.ops = [null, null, null];   // one operation per front; a front is one enemy
    this.directive = null;           // { sector, mode: 'attack' | 'defend' }
    this.mob = null;                 // { s, at, until }: a front being mobilised for a major offensive
    this.prop = { rally: false, newsreel: false };   // propaganda in force this round
    this.threats = [];               // enemy attacks announced for the coming battle phase
    this.battles = []; this.bid = 0;
    this.retal = [false, false, false];
    this.noRecruit = false;
    this.log = [];
    this.stats = { taken: 0, fallen: 0, opsWon: 0, opsLost: 0, held: 0 };
    if (saved) return this._restore(saved);
    this.say('info', `${N.ministry}: every world on the map flies the ${N.fed} flag. Long may it last.`);
    this._arrivals();
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
    const { seed, rs, round, res, morale, hand, F, mob, threats, retal, noRecruit, stats, over } = this;
    return { v: 3, seed, rs, round, res, morale, hand, F, mob, threats, retal, noRecruit, stats, over, log: this.log.slice(-80),
      P: this.P.map(p => [p.owner, p.bonus, p.relicAt, p.worlds.map(w => [w.owner, w.since])]) };
  }
  _restore(d) {
    for (const k of ['rs', 'round', 'res', 'morale', 'hand', 'F', 'mob', 'threats', 'retal', 'noRecruit', 'stats', 'over', 'log']) this[k] = d[k];
    d.P.forEach(([o, b, ra, ws], i) => { const p = this.P[i]; p.owner = o; p.bonus = b; p.relicAt = ra; ws.forEach(([wo, si], j) => { p.worlds[j].owner = wo; p.worlds[j].since = si; }); });
    this.phase = this.over ? 'over' : 'plan';
    return this;
  }
  static load(d) { return d && d.v === 3 ? new Game(d.seed, d) : null; }

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
  // The worlds of a system held by one side, as indexes.
  held(p, owner) { const out = []; p.worlds.forEach((w, i) => { if (w.owner === owner) out.push(i); }); return out; }
  // Whoever holds more than half the worlds controls the system. On a tie nothing changes. True if control changed.
  _control(p) {
    const c = {}; for (const w of p.worlds) c[w.owner] = (c[w.owner] || 0) + 1;
    for (const o in c) if (c[o] * 2 > p.worlds.length && o !== p.owner) { p.owner = o; p.bonus = 0; return true; }
    return false;
  }
  // Worlds the Federation still needs here to control the system.
  need(p) { return Math.max(0, Math.floor(p.worlds.length / 2) + 1 - this.held(p, 'fed').length); }
  // Can an operation be sent against this enemy's worlds in this system? Your own system if a lane reaches it,
  // otherwise any system next to one of yours.
  canTarget(pid, f, fl = this.fedLinked()) {
    const p = this.P[pid]; if (!p) return false;
    if (!p.worlds.some(w => (f ? w.owner === f : w.owner !== 'fed'))) return false;
    return fl.has(pid) || p.adj.some(n => fl.has(n));
  }
  targets(s) { const fl = this.fedLinked(), f = C.factions[s]; return this.P.filter(p => this.canTarget(p.id, f, fl)).map(p => p.id); }
  // The front (enemy index) an operation on this system would belong to.
  frontOf(pid) {
    const p = this.P[pid], f = p.owner !== 'fed' ? p.owner : (p.worlds.find(w => w.owner !== 'fed') || {}).owner;
    return f ? C.factions.indexOf(f) : -1;
  }
  // A system's own defence when the Federation controls it.
  fort(p) {
    let v = C.fort[p.kind] + p.bonus + (p.trait === 'bastion' ? C.traits.bastion.fort : 0);
    for (const w of p.worlds) if (w.owner === 'fed') v += C.worlds[w.type].fort || 0;
    return v;
  }
  // A linked Federation neighbour of this system with the given strategic trait.
  near(pid, trait, fl = this.fedLinked()) { return this.P[pid].adj.some(n => fl.has(n) && this.P[n].trait === trait); }
  garrison(pid) {
    const p = this.P[pid], f = p.owner; if (f === 'fed') return 0;
    const F = this.F[f];
    let g = C.garr.base + C.garr.ring * p.ring + F.force * C.garr.force + (p.trait === 'bastion' ? C.traits.bastion.fort : 0) + (F.dig >= this.round ? C.garr.dig : 0);
    for (const w of p.worlds) if (w.owner === f && w.type === 'fortress') g += C.garr.fortress;
    // The home is fed by every system the enemy controls: roll back the branches before going for the trunk.
    if (p.kind === 'home') g = (g + C.garr.perPlanet * this.P.filter(q => q.owner === f).length) * C.garr.home;
    if (!this.facLinked(f).has(pid)) g *= C.cut;
    return g;
  }
  // The strength an operation against enemy f in this system faces: the garrison if f controls the system (plus
  // part of any attack it pins there), or a thin foothold force if f only holds some worlds in a system of yours.
  enemyAt(pid, f) {
    const p = this.P[pid]; f = f || C.factions[this.frontOf(pid)]; if (!f) return 0;
    if (p.owner !== f) return (C.garr.base + this.F[f].force * C.garr.force) * C.cut;
    return this.garrison(pid) + this.threats.filter(t => t.from === pid && t.f === f).reduce((a, t) => a + t.str * C.pin, 0);
  }
  // How that strength is spread over the enemy's worlds: a fortress world takes a bigger share.
  enemyOn(pid, wi, f) {
    const p = this.P[pid]; f = f || p.worlds[wi].owner;
    const wt = i => (p.worlds[i].type === 'fortress' ? C.fortWeight : 1);
    let tot = 0; for (const i of this.held(p, f)) tot += wt(i);
    return tot ? this.enemyAt(pid, f) * wt(wi) / tot : 0;
  }

  // Does one of your operations pin this announced attack? It must strike the system the attack launches from,
  // and be at least half as strong as the attack.
  pins(t) {
    const o = this.ops[t.s];
    return !!o && o.target === t.from && this.P[t.from].owner === t.f && this.count(t.s) > 0 && this.opStrength(t.s) >= t.str * C.pinNeed;
  }

  // ---------- your orders ----------
  // An operation is a list of missions, at most one per enemy world in the target system.
  setTarget(s, pid) {
    if (this.phase !== 'plan') return false;
    if (pid == null) { this.ops[s] = null; return true; }
    if (!this.canTarget(pid, C.factions[s])) return false;
    this.ops[s] = { target: pid, m: {} };
    return true;
  }
  count(s) { const o = this.ops[s]; return o ? Object.keys(o.m).length : 0; }
  major(s) { const d = this.directive; return !!(d && d.mode === 'attack' && d.sector === s); }
  opCap(s) { const o = this.ops[s]; return o ? Math.min(this.held(this.P[o.target], C.factions[s]).length, this.major(s) ? C.op.major : C.op.general) : 0; }
  fuelFor(pid) {
    const v = C.op.fuel + C.op.fuelRing * this.P[pid].ring;
    return this.near(pid, 'depot') ? Math.max(1, v - C.traits.depot.fuel) : v;
  }
  cost(s) {
    const o = this.ops[s], c = { fuel: 0, drop: 0, army: 0 };
    if (!o || !this.count(s) || this.retal[s]) return c;
    c.fuel = this.fuelFor(o.target);
    for (const k of Object.values(o.m)) { c.drop += C.missions[k].drop; c.army += C.missions[k].army; }
    return c;
  }
  totalCost() {
    const t = { fuel: 0, drop: 0, army: 0 };
    for (let s = 0; s < 3; s++) { const c = this.cost(s); for (const k in t) t[k] += c[k]; }
    return t;
  }
  affordable() { const t = this.totalCost(); return t.fuel <= this.res.fuel && t.drop <= this.res.drop && t.army <= this.res.army; }
  // Put mission k on world wi of the target system. The same mission again, or null, takes it off.
  setMission(s, wi, k) {
    const o = this.ops[s]; if (!o || this.phase !== 'plan') return false;
    const w = this.P[o.target].worlds[wi]; if (!w || w.owner !== C.factions[s]) return false;
    const prev = o.m[wi];
    if (k == null || prev === k) { delete o.m[wi]; return true; }
    o.m[wi] = k;
    if (this.count(s) > this.opCap(s) || !this.affordable()) { if (prev) o.m[wi] = prev; else delete o.m[wi]; return false; }
    return true;
  }
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
  // One mission's strength on one world, before the operation's multipliers.
  missionStr(pid, wi, k) {
    const w = this.P[pid].worlds[wi];
    return C.missions[k].str * (1 + (C.weak[w.owner] === k ? C.weakAdd : 0) + (C.worlds[w.type].fav === k ? C.favAdd : 0));
  }
  // The fights an operation would open: one per mission, your strength against the enemy's share on that world.
  opFights(s) {
    const o = this.ops[s]; if (!o) return [];
    const mult = this.opMult(s), n = this.count(s), extra = this.retal[s] && n ? C.retal / n : 0;
    return Object.keys(o.m).map(wi => ({ wi: +wi, k: o.m[wi], P: this.missionStr(o.target, +wi, o.m[wi]) * mult + extra, E: this.enemyOn(o.target, +wi, C.factions[s]) }));
  }
  opStrength(s) { return this.opFights(s).reduce((a, f) => a + f.P, 0); }
  opEnemy(s) { return this.opFights(s).reduce((a, f) => a + f.E, 0); }
  // Mobilisation: a major offensive (the attack directive) has to be prepared a round ahead.
  mobilise(s, free = false) {
    if (this.phase !== 'plan' || this.F[C.factions[s]].state !== 'active' || (this.mob && this.mob.s === s && !free)) return false;
    if (!free) { if (this.res.fuel - this.totalCost().fuel < C.mob.fuel) return false; this.res.fuel -= C.mob.fuel; }
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
  // Without the offensive, an operation falls back to the size of a general attack.
  _trim() {
    for (let s = 0; s < 3; s++) { const o = this.ops[s]; if (!o) continue; const ks = Object.keys(o.m); while (ks.length > this.opCap(s)) delete o.m[ks.pop()]; }
  }
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

  // ---------- cards ----------
  give(id, why) {
    if (this.hand.length >= C.handMax) return false;
    this.hand.push(id); this.say('good', `Card gained (${why}): ${C.cards[id].name}.`); return true;
  }
  draw(why) {
    const ids = Object.keys(C.cards); let tot = 0; for (const k of ids) tot += C.cards[k].w;
    let r = this.rnd() * tot, pick = ids[0];
    for (const k of ids) { r -= C.cards[k].w; if (r <= 0) { pick = k; break; } }
    this.give(pick, why);
  }
  // Can this card be played now? target is a battle id in battle, otherwise the selected system.
  cardOk(id, target) {
    const c = C.cards[id]; if (!c || c.when !== this.phase || this.over) return false;
    if (c.when === 'battle') { const b = this.battles.find(x => x.id === target); return !!b && b.fights.some(f => !f.done) && (id !== 'evac' || b.kind === 'op'); }
    const p = this.P[target];
    if (c.needs === 'planet') return !!p && p.owner === 'fed';
    if (c.needs === 'directive') return !!this.directive && !this.prop.rally;
    if (c.needs === 'offensive') return !!this.directive && this.directive.mode === 'attack' && !this.prop.newsreel;
    if (c.needs === 'front') { const s = p ? this.frontOf(p.id) : -1; return s >= 0 && this.F[C.factions[s]].state === 'active' && !this.mobReady(s); }
    return true;
  }
  playCard(i, target) {
    const id = this.hand[i]; if (!this.cardOk(id, target)) return false;
    const r = this.res, add = (k, n) => { r[k] = Math.min(C.resMax, r[k] + n); }, mor = n => { this.morale = clamp(this.morale + n, 0, 100); };
    if (C.cards[id].when === 'battle') {
      const open = this.battles.find(x => x.id === target).fights.filter(f => !f.done);
      if (id === 'support' || id === 'armada') for (const f of open) f.P += (id === 'support' ? 5 : 10) / open.length;
      else if (id === 'blockade') for (const f of open) f.E *= 0.7;
      else for (const f of open) { f.done = true; f.evac = true; }
    } else switch (id) {
      case 'bonds': mor(12); break;
      case 'broadcast': add('drop', 4); break;
      case 'convoy': add('fuel', 6); break;
      case 'cache': add('fuel', 10); break;
      case 'levy': add('army', 8); break;
      case 'anthem': mor(20); add('drop', 3); break;
      case 'fortify': this.P[target].bonus += 4; break;
      case 'bulwark': this.P[target].bonus += 8; break;
      case 'rally': this.prop.rally = true; break;
      case 'newsreel': this.prop.newsreel = true; break;
      case 'snap': this.mobilise(this.frontOf(target), true); break;
    }
    this.hand.splice(i, 1);
    return true;
  }
  // The one free Secondary Order of the round: it goes to the fight that is going worst in the chosen battle.
  useSecondary(bid) {
    const b = this.battles.find(x => x.id === bid);
    if (!b || !this.secondary || this.phase !== 'battle') return false;
    const open = b.fights.filter(f => !f.done).sort((x, y) => x.p - y.p); if (!open.length) return false;
    open[0].P += C.secondary; this.secondary = false; return true;
  }

  // ---------- the round ----------
  _fight(wi, P, E, cost) { return { wi, P, E, p: 0.5, t: 0, done: false, win: null, cost }; }
  endPlan() {
    if (this.phase !== 'plan' || this.over) return;
    const fl = this.fedLinked(); this.battles = [];
    for (const t of this.threats) t.pinned = this.pins(t);
    for (let s = 0; s < 3; s++) {
      const o = this.ops[s]; if (!o || !this.count(s)) continue;
      const c = this.cost(s), p = this.P[o.target], f = C.factions[s], free = this.retal[s];
      const fights = this.opFights(s).map(x => this._fight(x.wi, x.P, x.E, free ? { drop: 0, army: 0 } : { drop: C.missions[x.k].drop, army: C.missions[x.k].army }));
      for (const k in c) this.res[k] -= c[k];
      if (f === 'veil') this.morale = clamp(this.morale - C.veilCost, 0, 100);
      this.battles.push({ id: ++this.bid, kind: 'op', s, f, pid: p.id, fights, dir: this.major(s), news: this.major(s) && this.prop.newsreel });
    }
    const live = this.threats.filter(t => !t.pinned);
    if (new Set(live.filter(t => t.to === 0).map(t => t.f)).size >= 2) {
      this.threats = []; return this._end('lost', `Two enemies reached ${N.capital} in the same hour.`);
    }
    live.sort((a, b) => this.P[a.to].ring - this.P[b.to].ring);
    for (const t of live) {
      const p = this.P[t.to], mine = this.held(p, 'fed');
      if (p.owner !== 'fed' || !mine.length) continue;   // only systems the Federation controls are ever defended
      const { D, n } = this.defence(t, this.res.army, fl);
      this.res.army -= n;
      const wt = i => (p.worlds[i].type === 'fortress' ? C.fortWeight : 1); let tot = 0; for (const i of mine) tot += wt(i);
      const fights = mine.map(i => this._fight(i, D * wt(i) / tot, t.str / mine.length, null));
      this.battles.push({ id: ++this.bid, kind: 'def', s: t.s, f: t.f, pid: t.to, from: t.from, fights, army: n, str: t.str });
    }
    if (this.directive && this.directive.mode === 'attack') this.mob = null;   // the offensive is spent
    this.threats = []; this.phase = 'battle';
    if (!this.battles.length) this._resolve();
  }

  // Fights run live: each bar drifts toward the stronger side, with some luck, until it fills or time runs out.
  tick(dt) {
    if (this.phase !== 'battle' || this.over) return;
    let open = 0;
    for (const b of this.battles) for (const f of b.fights) {
      if (f.done) continue;
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
      const p = this.P[b.pid], F = this.F[b.f], fn = N.factions[b.f];
      if (F.state === 'dead') continue;
      if (b.kind === 'op') {
        const was = p.owner; let won = 0, fought = 0;
        for (const f of b.fights) {
          if (f.evac) { add('drop', f.cost.drop); add('army', f.cost.army); continue; }
          fought++;
          if (!f.win) continue;
          won++; add('drop', Math.floor(f.cost.drop / 2 + 0.5)); add('army', Math.floor(f.cost.army / 2));
          p.worlds[f.wi].owner = 'fed'; p.worlds[f.wi].since = this.round;
        }
        if (!fought) { this.say('info', `Operation on ${p.name} recalled.`); continue; }
        this._control(p);
        if (was !== 'fed' && p.owner === 'fed') {            // the system changes hands
          this.stats.opsWon++; this.stats.taken++; this.morale += C.mor.off;
          if (b.f === 'foundry') add('army', C.scrap);
          if (b.news) { this.morale += 10; add('drop', 4); this.say('good', 'The newsreel plays in every square: +10 morale, +4 Vanguard.'); }
          if (p.kind === 'home') { this._kill(b.f); continue; }
          this.say('good', `${p.name} retaken from ${fn}.`);
          if (p.relic) { this.give(p.relic, `${p.name} retaken`); p.relicAt = this.round + C.relic.every; }
          if (b.dir || p.kind === 'junction' || p.trait) this.draw('major victory');
        } else if (won) {
          this.morale += C.mor.world * won; this.stats.opsWon++;
          this.say('good', p.owner === 'fed' ? `${won} world${won > 1 ? 's' : ''} cleared of ${fn} in ${p.name}.`
            : `Foothold in ${p.name}: ${won} world${won > 1 ? 's' : ''} taken, ${this.need(p)} more for the system. It will not hold long.`);
        } else {
          this.stats.opsLost++; this.morale -= C.mor.offLoss;
          this.say('bad', `Operation on ${p.name} failed.`);
          if (b.dir) this._enemyCard(b.f);
        }
      } else {
        let lost = 0;
        for (const f of b.fights) if (!f.win) { lost++; p.worlds[f.wi].owner = b.f; p.worlds[f.wi].since = this.round; }
        this._control(p);
        if (p.owner !== 'fed') {                              // the system falls
          if (b.pid === 0) return this._end('lost', `${N.capital} fell to ${fn}.`);
          this.stats.fallen++; this.morale -= C.mor.defLoss; F.force += b.str * C.winBack;
          for (const w of p.worlds) if (w.owner === 'fed') w.since = this.round;   // worlds that held out are now stranded
          this.say('bad', `${p.name} fell to ${fn}.`);
          if (p.kind === 'gate' || p.kind === 'junction' || p.relic) this._enemyCard(b.f);
        } else {
          add('army', Math.floor(b.army / 2)); this.stats.held++;
          if (lost) { this.morale -= C.mor.world * lost; this.say('warn', `${p.name} holds, but ${fn} took ${lost} world${lost > 1 ? 's' : ''} there.`); }
          else { this.morale += C.mor.def; this.say('good', `${p.name} held against ${fn}.`); }
          if (b.pid === 0) { this.retal[b.s] = true; this.draw(`${N.capital} stands`); this.say('good', `${fn} is spent at the gates. Retaliation on that front is free this round.`); }
        }
      }
    }
    this.battles = []; this.ops = [null, null, null]; this.directive = null; this.secondary = true;
    this.prop = { rally: false, newsreel: false };
    const hadRetal = this.retal; this.retal = [false, false, false];
    this.round++;
    if (this.mob && this.round > this.mob.until) { this.mob = null; this.say('warn', 'The mobilisation has stood down. The offensive was never launched.'); }
    this._arrivals();
    for (const f of C.factions) this._enemyTurn(f);
    this._income();
    this.retal = hadRetal.map((v, s) => v && this.F[C.factions[s]].state === 'active');
    this.phase = 'plan';
    if (C.factions.every(f => this.F[f].state === 'dead')) this._end('won', 'All three enemies are gone from the map.');
  }

  _kill(f) {
    const F = this.F[f]; F.state = 'dead'; F.force = 0;
    for (const p of this.P) { for (const w of p.worlds) if (w.owner === f) w.owner = 'fed'; if (p.owner === f) { p.owner = 'fed'; p.bonus = 0; } }
    if (this.mob && this.mob.s === F.sector) this.mob = null;
    this.threats = this.threats.filter(t => t.f !== f);
    this.morale += C.mor.kill;
    this.say('good', `${N.homes[F.sector]} is taken. ${N.factions[f]} is wiped from the map.`);
    this.draw('enemy destroyed');
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
        this.say('warn', `${N.ministry}: hostile signals near ${N.homes[F.sector]}. Nothing to worry about. Expected in ${Math.max(1, F.at - this.round)} round(s).`);
      }
      if (F.state === 'warn' && this.round >= F.at) {
        F.state = 'active'; F.force = C.enemy[f].init;
        // They burst in: the home, the outer systems beside it and the systems beyond those fall at once.
        const take = [F.home];
        for (const n of this.P[F.home].adj) { take.push(n); for (const m of this.P[n].adj) if (this.P[m].kind === 'mid') take.push(m); }
        for (const id of take) { const p = this.P[id]; p.owner = f; p.bonus = 0; for (const w of p.worlds) w.owner = f; }
        this.say('bad', `${N.factions[f]} has taken ${N.homes[F.sector]} and four systems around it.`);
      }
    }
  }

  _enemyTurn(f) {
    const F = this.F[f], c = C.enemy[f]; if (F.state !== 'active') return;
    F.force += c.grow + this.P.filter(p => p.owner === f).length * c.per + this.round * c.ramp;
    let mult = 1, bonus = 0, deepOk = f === 'veil', hidden = false;
    const card = F.cards.shift();
    if (card) {
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
    // Worlds you took in a system it still controls are overrun once they have stood alone too long.
    for (const p of this.P) {
      if (p.owner !== f) continue;
      for (const w of p.worlds) if (w.owner === 'fed' && this.round - w.since >= C.footholdRounds && F.force >= C.retake) {
        w.owner = f; F.force -= C.retake; this.say('warn', `${w.name} is overrun: the Federation holds one world fewer in ${p.name}.`);
      }
    }
    // Where it can strike: systems you control next to its linked territory.
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
    const fl = this.fedLinked(), r = this.res, mf = this.noRecruit ? 0 : 0.5 + this.morale / 100;
    for (const k in C.capitalYield) r[k] += C.capitalYield[k] * (k === 'drop' ? mf : 1);
    let minRing = 9, veil = 0;
    for (const p of this.P) {
      if (p.owner !== 'fed') { minRing = Math.min(minRing, p.ring); if (p.owner === 'veil') veil++; continue; }
      if (p.id === 0 || !fl.has(p.id)) continue;
      for (const w of p.worlds) { const t = C.worlds[w.type]; if (t.res && w.owner === 'fed') r[t.res] += t.y * (t.res === 'drop' ? mf : 1); }
      // A relic system gives its card back to your hand every few rounds.
      if (p.relic && this.round >= p.relicAt && !this.hand.includes(p.relic) && this.give(p.relic, `relic of ${p.name}`)) p.relicAt = this.round + C.relic.every;
    }
    // Vanguard show up for a cause: more as the enemy nears the capital.
    if (!this.noRecruit) r.drop += Math.max(0, 3 - minRing) * C.rally + (this.rnd() - 0.5);
    this.noRecruit = false;
    this.morale -= veil * C.veilDrain;
    this.morale += Math.sign(50 - this.morale) * Math.min(C.mor.drift, Math.abs(50 - this.morale));
    this.morale = clamp(this.morale, 0, 100);
    for (const k in r) r[k] = clamp(r[k], 0, C.resMax);
  }

  _end(result, why) {
    this.over = { result, why, round: this.round }; this.phase = 'over';
    this.say(result === 'won' ? 'good' : 'bad', why);
  }
}
