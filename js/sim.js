// The whole game as rules. No DOM, so it runs the same in the browser and in `npm run sim`.
// A round: PLAN (you set operations, the directive and cards) -> BATTLE (live) -> the enemies' turn -> income.
import { C } from './config.js';
import { makeMap, rng32 } from './map.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const N = C.names;

export class Game {
  constructor(seed = 1) {
    this.seed = seed;
    this.rnd = rng32(seed * 7919 + 13);
    this.map = makeMap(seed);
    this.P = this.map.planets;
    this.round = 1; this.phase = 'plan'; this.over = null;
    this.res = { ...C.start.res }; this.morale = C.start.morale;
    this.hand = [...C.start.hand]; this.secondary = true;
    this.F = {};
    C.factions.forEach((f, s) => {
      const a = C.arrive[f];
      this.F[f] = { id: f, sector: s, state: 'wait', at: a.round + Math.round((this.rnd() * 2 - 1) * a.vary), force: 0, card: false, home: this.map.home[s] };
    });
    this.ops = [null, null, null];
    this.directive = null;          // { sector, mode: 'attack' | 'defend' }; sector is the front (enemy index)
    this.mob = null;                // { s, at, until }: a front being mobilised for a major offensive
    this.threats = [];              // enemy attacks announced for the coming battle phase
    this.battles = []; this.bid = 0;
    this.retal = [false, false, false];
    this.log = [];
    this.stats = { taken: 0, fallen: 0, opsWon: 0, opsLost: 0, held: 0 };
    this.say('info', `${N.ministry}: every world on the map flies the ${N.fed} flag. Long may it last.`);
    this._arrivals();
  }

  say(kind, text) { this.log.push({ r: this.round, kind, text }); }

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
  canTarget(pid) {
    const p = this.P[pid]; if (!p || p.owner === 'fed') return false;
    const fl = this.fedLinked(); return p.adj.some(n => fl.has(n));
  }
  targets(s) { return this.P.filter(p => p.owner === C.factions[s] && this.canTarget(p.id)).map(p => p.id); }
  // A system's own defence when the Federation holds it.
  fort(p) {
    let v = C.fort[p.kind] + p.bonus + (p.trait === 'bastion' ? C.traits.bastion.fort : 0);
    for (const w of p.worlds) v += C.worlds[w.type].fort || 0;
    return v;
  }
  // A linked Federation neighbour of this system with the given strategic trait.
  near(pid, trait, fl = this.fedLinked()) { return this.P[pid].adj.some(n => fl.has(n) && this.P[n].trait === trait); }
  garrison(pid) {
    const p = this.P[pid], f = p.owner; if (f === 'fed') return 0;
    let g = C.garr.base + C.garr.ring * p.ring + this.F[f].force * C.garr.force + (p.trait === 'bastion' ? C.traits.bastion.fort : 0);
    for (const w of p.worlds) if (w.type === 'fortress') g += C.garr.fortress;
    // The home is fed by every world the enemy holds: roll back the branches before going for the trunk.
    if (p.kind === 'home') g = (g + C.garr.perPlanet * this.P.filter(q => q.owner === f).length) * C.garr.home;
    if (!this.facLinked(f).has(pid)) g *= C.cut;
    return g;
  }
  // What an operation on this planet would face: the garrison, plus part of any attack it pins there.
  enemyAt(pid) {
    return this.garrison(pid) + this.threats.filter(t => t.from === pid).reduce((a, t) => a + t.str * C.pin, 0);
  }

  // ---------- your orders ----------
  // An operation is a list of missions, at most one per world in the target system.
  setTarget(s, pid) {
    if (this.phase !== 'plan') return false;
    if (pid == null) { this.ops[s] = null; return true; }
    if (!this.canTarget(pid) || this.P[pid].owner !== C.factions[s]) return false;
    this.ops[s] = { target: pid, m: {} };
    return true;
  }
  count(s) { const o = this.ops[s]; return o ? Object.keys(o.m).length : 0; }
  major(s) { const d = this.directive; return !!(d && d.mode === 'attack' && d.sector === s); }
  opCap(s) { const o = this.ops[s]; return o ? Math.min(this.P[o.target].worlds.length, this.major(s) ? C.op.major : C.op.general) : 0; }
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
    const o = this.ops[s]; if (!o || this.phase !== 'plan' || !this.P[o.target].worlds[wi]) return false;
    const prev = o.m[wi];
    if (k == null || prev === k) { delete o.m[wi]; return true; }
    o.m[wi] = k;
    if (this.count(s) > this.opCap(s) || !this.affordable()) { if (prev) o.m[wi] = prev; else delete o.m[wi]; return false; }
    return true;
  }
  missionStr(pid, wi, k) {
    const p = this.P[pid];
    return C.missions[k].str * (1 + (C.weak[p.owner] === k ? C.weakAdd : 0) + (C.worlds[p.worlds[wi].type].fav === k ? C.favAdd : 0));
  }
  opStrength(s) {
    const o = this.ops[s]; if (!o || !this.count(s)) return 0;
    let v = 0;
    for (const wi in o.m) v += this.missionStr(o.target, +wi, o.m[wi]);
    v *= 1 - C.reach * (this.P[o.target].ring - 1);
    if (this.near(o.target, 'shipyard')) v *= C.traits.shipyard.mult;
    const d = this.directive;
    if (d) v *= d.mode === 'attack' ? (d.sector === s ? C.dir.boost : 1) : C.dir.drain;
    if (this.retal[s]) v += C.retal;
    return v;
  }
  // Mobilisation: a major offensive (the attack directive) has to be prepared a round ahead.
  mobilise(s) {
    if (this.phase !== 'plan' || this.F[C.factions[s]].state !== 'active' || (this.mob && this.mob.s === s)) return false;
    if (this.res.fuel - this.totalCost().fuel < C.mob.fuel) return false;
    this.res.fuel -= C.mob.fuel;
    this.mob = { s, at: this.round + 1, until: this.round + C.mob.last };
    if (this.directive && this.directive.mode === 'attack') { this.directive = null; this._trim(); }
    return true;
  }
  mobReady(s) { return !!(this.mob && this.mob.s === s && this.round >= this.mob.at); }
  setDirective(sector, mode) {
    if (this.phase !== 'plan') return false;
    const d = this.directive;
    if (sector == null || (d && d.sector === sector && d.mode === mode)) this.directive = null;
    else {
      if (mode === 'attack' && !this.mobReady(sector)) return false;
      // A defence directive needs something to defend: an attack announced on that front.
      if (mode === 'defend' && !this.threats.some(t => t.s === sector)) return false;
      this.directive = { sector, mode };
    }
    this._trim(); return true;
  }
  // Without the offensive, an operation falls back to the size of a general attack.
  _trim() {
    for (let s = 0; s < 3; s++) { const o = this.ops[s]; if (!o) continue; const ks = Object.keys(o.m); while (ks.length > this.opCap(s)) delete o.m[ks.pop()]; }
  }
  // The automatic defence of a threatened planet: its own forts, plus Army sent if a lane still reaches it.
  defence(t, army = this.res.army, fl = this.fedLinked()) {
    const p = this.P[t.to]; let D = this.fort(p), n = 0;
    if (fl.has(t.to)) {
      n = clamp(Math.ceil((t.str * C.def.margin - D) / C.def.perArmy), 0, Math.min(Math.floor(army), C.def.max));
      D += n * C.def.perArmy;
    } else D *= C.cut;
    if (t.to === 0) D += C.capitalRally;
    const d = this.directive;
    if (d) D *= d.mode === 'defend' ? (d.sector === t.s ? C.dir.boost : 1) : C.dir.drain;
    return { D, n };
  }

  // ---------- cards ----------
  draw(why) {
    if (this.hand.length >= C.handMax) return;
    const ids = Object.keys(C.cards); let tot = 0; for (const k of ids) tot += C.cards[k].w;
    let r = this.rnd() * tot, pick = ids[0];
    for (const k of ids) { r -= C.cards[k].w; if (r <= 0) { pick = k; break; } }
    this.hand.push(pick);
    this.say('good', `Card gained (${why}): ${C.cards[pick].name}.`);
  }
  playCard(i, target) {
    const id = this.hand[i], c = C.cards[id]; if (!c || c.when !== this.phase || this.over) return false;
    if (c.when === 'battle') {
      const b = this.battles.find(x => x.id === target && !x.done); if (!b) return false;
      if (id === 'support') b.P += 5;
      else if (id === 'blockade') b.E *= 0.7;
      else if (id === 'evac') { if (b.kind !== 'op') return false; b.done = true; b.evac = true; }
    } else if (id === 'bonds') this.morale = clamp(this.morale + 12, 0, 100);
    else if (id === 'broadcast') this.res.drop = Math.min(C.resMax, this.res.drop + 4);
    else if (id === 'convoy') this.res.fuel = Math.min(C.resMax, this.res.fuel + 6);
    else if (id === 'fortify') { const p = this.P[target]; if (!p || p.owner !== 'fed') return false; p.bonus += 4; }
    this.hand.splice(i, 1);
    return true;
  }
  useSecondary(bid) {
    const b = this.battles.find(x => x.id === bid && !x.done);
    if (!b || !this.secondary || this.phase !== 'battle') return false;
    b.P += C.secondary; this.secondary = false; return true;
  }

  // ---------- the round ----------
  endPlan() {
    if (this.phase !== 'plan' || this.over) return;
    const fl = this.fedLinked(); this.battles = [];
    for (let s = 0; s < 3; s++) {
      const o = this.ops[s]; if (!o || !this.count(s)) continue;
      const c = this.cost(s), p = this.P[o.target], f = p.owner;
      const E = this.enemyAt(p.id), str = this.opStrength(s);
      for (const k in c) this.res[k] -= c[k];
      for (const t of this.threats) if (t.from === p.id) t.pinned = true;
      if (f === 'veil') this.morale = clamp(this.morale - C.veilCost, 0, 100);
      const d = this.directive;
      this.battles.push({ id: ++this.bid, kind: 'op', s, f, pid: p.id, P: str, E, p: 0.5, t: 0, done: false,
        paid: { drop: c.drop, army: c.army }, dir: !!(d && d.mode === 'attack' && d.sector === s) });
    }
    const live = this.threats.filter(t => !t.pinned);
    if (new Set(live.filter(t => t.to === 0).map(t => t.f)).size >= 2) {
      this.threats = []; return this._end('lost', `Two enemies reached ${N.capital} in the same hour.`);
    }
    live.sort((a, b) => this.P[a.to].ring - this.P[b.to].ring);
    for (const t of live) {
      if (this.P[t.to].owner !== 'fed') continue;   // only worlds the Federation holds are ever defended
      const { D, n } = this.defence(t, this.res.army, fl);
      this.res.army -= n;
      this.battles.push({ id: ++this.bid, kind: 'def', s: t.s, f: t.f, pid: t.to, from: t.from, P: D, E: t.str, p: 0.5, t: 0, done: false, paid: { drop: 0, army: n } });
    }
    if (this.directive && this.directive.mode === 'attack') this.mob = null;   // the offensive is spent
    this.threats = []; this.phase = 'battle';
    if (!this.battles.length) this._resolve();
  }

  // Battles run live: the bar drifts toward the stronger side, with some luck, until it fills or time runs out.
  tick(dt) {
    if (this.phase !== 'battle' || this.over) return;
    let open = 0;
    for (const b of this.battles) {
      if (b.done) continue;
      b.t += dt;
      b.p += (b.P - b.E) / (b.P + b.E) * C.battle.rate * dt + (this.rnd() * 2 - 1) * C.battle.noise * Math.sqrt(dt);
      if (b.p >= 1 || b.p <= 0 || b.t >= C.battle.dur) { b.done = true; b.win = b.p >= 0.5; b.p = clamp(b.p, 0, 1); } else open++;
    }
    // A short hold once every fight is settled, so the results can be read on the map.
    if (!open && (this.hold = (this.hold || 0) + dt) >= C.battle.hold) { this.hold = 0; this._resolve(); }
  }

  _resolve() {
    for (const b of this.battles) {
      const p = this.P[b.pid], F = this.F[b.f], fn = N.factions[b.f];
      if (F.state === 'dead') continue;
      if (b.evac) { this.res.drop += b.paid.drop; this.res.army += b.paid.army; this.say('info', `Operation on ${p.name} recalled.`); continue; }
      const back = k => { this.res[k] = Math.min(C.resMax, this.res[k] + Math.floor(b.paid[k] / 2)); };
      if (b.kind === 'op') {
        if (b.win) {
          back('drop'); back('army'); this.stats.opsWon++; this.stats.taken++;
          this.morale += C.mor.off;
          if (b.f === 'foundry') this.res.army = Math.min(C.resMax, this.res.army + C.scrap);
          if (p.kind === 'home') { this._kill(b.f); continue; }
          p.owner = 'fed'; p.bonus = 0;
          this.say('good', `${p.name} retaken from ${fn}.`);
          if (b.dir || p.kind === 'junction' || p.trait) this.draw('major victory');
        } else {
          this.stats.opsLost++; this.morale -= C.mor.offLoss;
          this.say('bad', `Operation on ${p.name} failed.`);
          if (b.dir) this._enemyCard(b.f);
        }
      } else if (b.win) {
        back('army'); this.stats.held++; this.morale += C.mor.def;
        this.say('good', `${p.name} held against ${fn}.`);
        if (b.pid === 0) { this.retal[b.s] = true; this.draw(`${N.capital} stands`); this.say('good', `${fn} is spent at the gates. Retaliation on that front is free this round.`); }
      } else {
        if (b.pid === 0) return this._end('lost', `${N.capital} fell to ${fn}.`);
        p.owner = b.f; this.stats.fallen++; this.morale -= C.mor.defLoss;
        F.force += b.E * C.winBack;
        this.say('bad', `${p.name} fell to ${fn}.`);
        p.bonus = 0;
        if (p.kind === 'gate' || p.kind === 'junction') this._enemyCard(b.f);
      }
    }
    this.battles = []; this.ops = [null, null, null]; this.directive = null; this.secondary = true;
    const hadRetal = this.retal; this.retal = [false, false, false];
    this.round++;
    if (this.mob && this.round > this.mob.until) { this.mob = null; this.say('warn', 'The mobilisation has stood down. The offensive was never launched.'); }
    this._arrivals();
    for (const f of C.factions) this._enemyTurn(f);
    this._income();
    this.retal = hadRetal.map((v, s) => v && this.F[C.factions[s]].state === 'active');
    hadRetal.fill(false);
    this.phase = 'plan';
    if (C.factions.every(f => this.F[f].state === 'dead')) this._end('won', 'All three enemies are gone from the map.');
  }

  _kill(f) {
    const F = this.F[f]; F.state = 'dead'; F.force = 0;
    for (const p of this.P) if (p.owner === f) { p.owner = 'fed'; p.bonus = 0; }
    if (this.mob && this.mob.s === F.sector) this.mob = null;
    this.threats = this.threats.filter(t => t.f !== f);
    this.morale += C.mor.kill;
    this.say('good', `${N.homes[F.sector]} is taken. ${N.factions[f]} is wiped from the map.`);
    this.draw('enemy destroyed');
  }
  _enemyCard(f) { this.F[f].card = true; this.say('bad', `${N.factions[f]} gains ${C.enemyCards[f]}.`); }

  _arrivals() {
    for (const f of C.factions) {
      const F = this.F[f];
      if (F.state === 'wait' && this.round >= F.at - C.warn) {
        F.state = 'warn';
        this.say('warn', `${N.ministry}: hostile signals near ${N.homes[F.sector]}. Nothing to worry about. Expected in ${Math.max(1, F.at - this.round)} round(s).`);
      }
      if (F.state === 'warn' && this.round >= F.at) {
        F.state = 'active'; F.force = C.enemy[f].init; this.P[F.home].owner = f;
        // They burst in: the home and the staging worlds beside it fall at once.
        for (const n of this.P[F.home].adj) {
          this.P[n].owner = f;
          for (const m of this.P[n].adj) if (this.P[m].kind === 'mid') this.P[m].owner = f;
        }
        this.say('bad', `${N.factions[f]} has taken ${N.homes[F.sector]} and four systems around it.`);
      }
    }
  }

  _enemyTurn(f) {
    const F = this.F[f], c = C.enemy[f]; if (F.state !== 'active') return;
    const own = this.P.filter(p => p.owner === f).length;
    F.force += c.grow + own * c.per + this.round * c.ramp;
    let mult = 1;
    if (F.card) {
      F.card = false;
      if (f === 'swarm') mult = C.frenzy;
      else if (f === 'foundry') F.force += C.surge;
      else { this.morale -= C.conversion.morale; this.res.drop = Math.max(0, this.res.drop - C.conversion.drop); }
    }
    const link = this.facLinked(f), cand = new Map();
    for (const id of link) for (const n of this.P[id].adj) if (this.P[n].owner === 'fed' && !cand.has(n)) cand.set(n, id);
    if (!cand.size) return;
    let picks = [];
    const near = [...cand.keys()];
    if (f === 'swarm') {            // spreads: several small attacks at once
      near.sort(() => this.rnd() - 0.5);
      let n = Math.min(c.targets, near.length);
      while (n > 1 && F.force * c.spend / n < c.minStr) n--;
      picks = near.slice(0, n);
    } else if (f === 'foundry') {   // builds up, then one heavy blow at the weakest point
      if (F.force < c.hold) return;
      const fl = this.fedLinked();
      const soft = id => this.fort(this.P[id]) * (fl.has(id) ? 1 : C.cut) + this.P[id].ring * 0.1;
      near.sort((a, b) => soft(a) - soft(b));
      picks = near.slice(0, 1);
    } else {                        // slips behind the line: may strike one planet past the front
      const deep = [];
      for (const n of near) for (const m of this.P[n].adj) {
        if (m !== 0 && this.P[m].owner === 'fed' && !cand.has(m)) { cand.set(m, cand.get(n)); deep.push(m); }
      }
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
      this.threats.push({ f, s: F.sector, from: cand.get(to), to, str: each * mult });
      F.force -= each;
    }
  }

  _income() {
    const fl = this.fedLinked(), r = this.res, mf = 0.5 + this.morale / 100;
    for (const k in C.capitalYield) r[k] += C.capitalYield[k] * (k === 'drop' ? mf : 1);
    let minRing = 9, veil = 0;
    for (const p of this.P) {
      if (p.owner !== 'fed') { minRing = Math.min(minRing, p.ring); if (p.owner === 'veil') veil++; continue; }
      if (p.id === 0 || !fl.has(p.id)) continue;
      for (const w of p.worlds) { const t = C.worlds[w.type]; if (t.res) r[t.res] += t.y * (t.res === 'drop' ? mf : 1); }
    }
    // Vanguard show up for a cause: more as the enemy nears the capital, more behind an attack directive.
    r.drop += Math.max(0, 3 - minRing) * C.rally + (this.rnd() - 0.5);
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
