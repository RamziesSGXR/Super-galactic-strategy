// The interface: resources and the turn strip on top, the map with its fleets, the ministries in a row, and your
// hand of cards along the bottom. All game rules are in sim.js.
import { C, VERSION } from './config.js';
import { Game } from './sim.js';
import { View, drawPlanet, sum } from './view.js';
import { STEPS, SEED } from './tutorial.js';

const $ = id => document.getElementById(id), N = C.names, S = C.ship.str;
const RES = { fuel: N.fuel, drop: N.drop, army: N.army }, RS = { fuel: 'F', drop: 'V', army: 'A' };
const TABS = ['int', 'def', 'pro', 'exp', 'tru', 'hum', 'emp', 'uni'];
const SAVE = 'sgs.save6';
const f1 = v => (Math.round(v * 10) / 10).toString();
const esc = s => String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
const costTxt = (c, long) => Object.entries(c || {}).filter(([, v]) => v).map(([k, v]) => `${f1(v)}${long ? ' ' + RES[k] : RS[k]}`).join(long ? ' + ' : ' ') || (long ? 'FREE' : '');
const ships = n => `${n} SHIP${n === 1 ? '' : 'S'}`;
// Thin line icons: one per kind of card, one per ministry.
const ICON = {
  boost: '<path d="M4 5l8 8 8-8M4 12l8 8 8-8"/>', trap: '<path d="M12 3l9 17H3zM12 10v5M12 17.5v.5"/>',
  order: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>', battle: '<circle cx="12" cy="12" r="6"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>',
  propaganda: '<path d="M4 10v4h3l8 5V5L7 10zM18 9c1.5 1.5 1.5 4.5 0 6"/>', logistics: '<path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"/>',
  dissent: '<path d="M5 5l14 14M19 5L5 19"/>', relic: '<path d="M12 3l9 9-9 9-9-9z"/>',
};
const MICON = {
  int: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>', def: ICON.order, pro: ICON.logistics,
  exp: '<path d="M4 20l6-6 4 4 6-9M14 9h6v6"/>', tru: ICON.propaganda, hum: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-4.5 3-7 7-7s7 2.5 7 7"/>',
  emp: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>', uni: '<path d="M6 21V4h12l-3 4 3 4H6"/>',
};
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square">${d}</svg>`;

let g, view = new View($('map'));
const ui = { sel: null, fleet: null, selBattle: null, card: null, tab: 'int', open: false, speed: 1, mark: 0, tut: null, hint: null, valid: null, dest: null, anims: [], show: null };
window.sgs = { get g() { return g; }, ui, view, refresh: () => refresh() };   // for the browser checks

function odds(P, E) {
  const r = P / Math.max(0.01, E);
  return r >= 1.25 ? ['FAVOURED', 'cy'] : r >= 1.08 ? ['EDGE', 'cy'] : r >= 0.93 ? ['EVEN', 'am'] : r >= 0.8 ? ['RISKY', 'rd2'] : ['OUTMATCHED', 'rd2'];
}
const front = () => (g.fi >= 0 ? C.fronts[g.fi] : null);
const myFleet = () => g.fleets.find(f => f.id === ui.fleet && f.owner === 'fed');
const canOrder = f => f && f.owner === 'fed' && !f.moved && g.canAct(f.at);

function start(seed, saved, tutorial) {
  g = (saved && Game.load(saved)) || new Game(seed || (Date.now() % 100000));
  Object.assign(ui, { sel: null, fleet: null, selBattle: null, card: null, tab: 'int', open: false, mark: Math.max(0, g.log.length - 6), tut: tutorial ? 0 : null, hint: null, valid: null, dest: null, anims: [], show: null });
  tutStep = -1;
  if (view.R0) view.reset();
  refresh();
}
function store() {
  try { if (g.over) localStorage.removeItem(SAVE); else if (g.phase === 'plan') localStorage.setItem(SAVE, JSON.stringify(g.save())); } catch {}
}
// After anything that may have moved fleets: start their animations, and note whose move is being shown.
function sync() {
  const mv = g.moves.splice(0); if (!mv.length) return;
  for (const m of mv) ui.anims.push({ ...m, t: -0.12 * ui.anims.filter(a => a.owner === m.owner).length });
  const foe = mv.find(m => m.owner !== 'fed'); if (foe) ui.show = { f: foe.owner, t: 0 };
}

// ---------- the top strip ----------
function top() {
  const cell = (k, cls) => `<div class="${cls}"><b>${Math.floor(g.res[k])}</b><span>${RES[k]}</span></div>`;
  $('top').innerHTML = `<div class="ttl">${N.game}<small>${VERSION}</small></div><div class="rd">ROUND ${g.round}</div>
    <div class="ro">${cell('fuel', 'a')}${cell('drop', '')}${cell('army', '')}<div><b>${Math.round(g.morale)}</b><span>MORALE</span></div></div>`;
  // The strip under the map: the most pressing advice on your turn, otherwise the latest news.
  const last = g.log[g.log.length - 1], adv = g.phase === 'plan' ? g.advice().find(a => a.kind === 'bad' || a.kind === 'warn') : null;
  $('bulletin').className = adv ? adv.kind : last.kind; $('bulletin').textContent = adv ? `INTELLIGENCE › ${adv.text}` : `R${last.r} › ${last.text}`;
}

// ---------- whose turn it is ----------
// The three fronts across the top of the map, the one in play lit, and a line saying who is moving.
function turnbar() {
  const fr = front(), busy = ui.show || ui.anims.some(a => a.owner !== 'fed');
  let h = '<div class="trk">' + C.fronts.map((x, i) => `<span class="${g.fi === i ? 'on' : ''}${g.atWar(i) ? '' : ' off'}" style="--tc:${C.color[x.f]}">${x.short}</span>`).join('') + '</div>', sub;
  const foe = fr ? `<b style="color:${C.color[fr.f]}">${N.factions[fr.f].toUpperCase()}</b>` : '';
  if (g.phase === 'over') sub = 'The war is over.';
  else if (ui.show) sub = `<b style="color:${C.color[ui.show.f]}">${N.factions[ui.show.f].toUpperCase()} MOVES.</b> Its fleets advance one system.`;
  else if (g.phase === 'battle') sub = g.stage === 'yourBattle' ? '<b class="cy">YOUR ATTACK.</b> Tap a fight, then a battle card, to help it.' : `${foe} <b>ATTACKS.</b> Tap a fight, then a battle card, to help it.`;
  else if (!fr) sub = '<b class="am">YOUR MOVE.</b> No front is at war yet. Place your fleets, then END TURN.';
  else sub = `<b class="am">YOUR MOVE</b> on the ${fr.name.toLowerCase()}, against ${foe}. ${ui.card != null ? 'Tap a ringed system to play the card.' : myFleet() ? 'Tap a ringed system: cyan moves there, amber attacks.' : 'Tap a fleet, then where it should go.'}`;
  $('turn').innerHTML = h + `<div class="tsub">${sub}</div>`;
  void busy;
}

// ---------- the ministries ----------
const head = k => `<div class="mh"><span>${C.ministries[k].does}</span></div>`;
const shieldSvg = cl => `<svg class="shd ${cl}" viewBox="0 0 14 16"><path d="M1 1h12v8l-6 6-6-6z"/></svg>`;
function threatLine(p, t) {
  const D = g.defence(p.id, t.f), [w, cl] = odds(D, t.str);
  return `<button class="ln lk" data-a="sel" data-p="${p.id}">${shieldSvg(cl)} <b>${esc(p.name)}</b> · ${N.factions[t.f]} ${f1(t.str)} beside it, your defence ${f1(D)} <span class="${cl}">${w}</span></button>`;
}
const threats = () => g.P.map(p => ({ p, t: g.threat(p.id) })).filter(x => x.t).sort((a, b) => a.p.ring - b.p.ring);

function tabSys() {
  const p = g.P[ui.sel];
  if (!p) return '<div class="sm2 dim">Tap a star system on the map.</div>';
  const fed = p.owner === 'fed', fl = g.fedLinked(), battle = g.battles.find(b => b.pid === p.id), th = g.threat(p.id);
  const fr = p.front >= 0 ? C.fronts[p.front] : null, kw = g.keyWorld(p), T = C.worlds[kw.type];
  let h = `<section class="plate"><div class="row"><span class="big grow">${esc(p.name)}</span><span class="sm2 dim">${p.kind === 'capital' ? 'THE CAPITAL' : p.kind === 'home' ? 'ENEMY HOME' : fr.name}</span></div>`;
  h += fed ? `<div class="sm2 cy">${N.fed.toUpperCase()} · DEFENCE ${f1(g.fort(p))} + FLEETS ${g.shipsAt(p.id, 'fed') * S}${p.dev ? ` · DEVELOPED ${p.dev}` : ''}${fl.has(p.id) ? '' : ' · <span class="rd2">CUT OFF: pays nothing, defends at half</span>'}</div>`
    : `<div class="sm2" style="color:${C.color[p.owner]}">${N.factions[p.owner].toUpperCase()} · STRENGTH ${f1(g.garrison(p.id))} (${ships(g.shipsAt(p.id, p.owner))})</div>`;
  if (p.trap && fed) h += `<div class="sm2 am">TRAP LAID: ${C.cards[p.trap].name}. ${C.cards[p.trap].text}</div>`;
  if (p.relic) h += `<div class="sm2 am">RELIC: ${C.cards[p.relic].name}. ${fed && fl.has(p.id) ? (g.hand.includes(p.relic) ? 'In your hand.' : `Comes to your hand in round ${Math.max(g.round + 1, p.relicAt)}.`) : 'Take the system to gain it.'}</div>`;
  if (th) h += threatLine(p, th);
  h += '<canvas id="sys"></canvas>';
  if (battle) { const st = sum(battle); h += `<div class="sm2">${battle.kind === 'op' ? 'YOUR ATTACK' : 'DEFENCE'} · ${st.open ? `${f1(st.P)} vs ${f1(st.E)}` : st.evac ? 'RECALLED' : st.won ? 'WON' : 'LOST'}</div>`; }
  if (fed) {
    const c = g.shipCost(p);
    h += `<button class="plate amber btn" style="width:100%;margin-bottom:6px" data-a="build" data-p="${p.id}" ${g.canBuild(p.id) ? '' : 'disabled'}>${p.built ? 'A SHIP WAS BUILT HERE THIS ROUND' : `BUILD A SHIP · ${costTxt(c, true)}`}</button>`;
    if (T.yard) h += `<div class="sm2 am">${T.name}: ${T.yard}</div>`;
  }
  for (const f of g.fleetsAt(p.id, 'fed')) h += `<div class="mis"><div><b class="cy">YOUR FLEET · ${ships(f.ships)}</b> <span class="sm2 dim">strength ${f1(g.fleetStr(f, true))}${f.vet ? ' · veteran' : ''}${f.strike ? ' · alpha strike' : ''}${f.flank ? ' · flanking' : ''}</span>
    <div class="sm2 dim">${f.order != null ? `Ordered to ${esc(g.P[f.order].name)}.` : f.moved ? 'Has moved this round.' : g.canAct(f.at) ? 'Ready. Tap a neighbouring system on the map to send it.' : 'Its front comes later this round.'}</div></div><span></span></div>`;
  p.worlds.forEach((w, i) => {
    const W = C.worlds[w.type];
    h += `<div class="mis"><div><b style="color:${W.col}">${esc(w.name)}</b> <span class="sm2 dim">${W.name}${W.res ? ` · +${W.y} ${RES[W.res]}` : W.fort ? ` · +${W.fort} DEFENCE` : ''}</span>${i === p.key ? '<div class="sm2 dim">The key world, shown above.</div>' : ''}</div><span></span></div>`;
  });
  return h + '</section>';
}

function tabInt() {
  let h = head('int');
  const rep = g.log.slice(ui.mark);
  if (rep.length) h += '<section class="rep"><h3>Report</h3>' + rep.slice(-8).map(e => `<div class="${e.kind}">${esc(e.text)}</div>`).join('') + '</section>';
  const adv = g.phase === 'plan' ? g.advice() : [];
  if (adv.length) h += '<section class="rep"><h3>Suggested actions</h3>' + adv.map(a => a.pid != null ? `<button class="adv lk ${a.kind}" data-a="sel" data-p="${a.pid}">${esc(a.text)}</button>` : `<div class="${a.kind}">${esc(a.text)}</div>`).join('') + '</section>';
  const ths = threats();
  if (ths.length) h += '<section><h3>Needs defending</h3>' + ths.slice(0, 6).map(x => threatLine(x.p, x.t)).join('') + '</section>';
  h += '<section><h3>The enemy</h3>';
  C.fronts.forEach(fr => {
    const F = g.F[fr.f], own = g.P.filter(p => p.owner === fr.f).length, n = g.fleets.filter(x => x.owner === fr.f).reduce((a, x) => a + x.ships, 0);
    h += `<div class="front" style="--fc:${C.color[fr.f]}"><div class="fh"><b>${fr.short} · ${F.state === 'wait' ? 'UNKNOWN' : N.factions[fr.f]}</b><span class="sm2 dim">${F.state === 'wait' ? 'QUIET' : F.state === 'warn' ? `EXPECTED ROUND ${F.at}` : F.state === 'dead' ? 'DESTROYED' : `${own} SYSTEMS · ${ships(n)} · HOME ${Math.round(g.garrison(F.home))}`}</span></div>` +
      (F.state === 'active' ? `<div class="ln dim">${C.enemy[fr.f].text}${F.cards.length ? ` <span class="rd2">Holds ${F.cards.length} card${F.cards.length > 1 ? 's' : ''}.</span>` : ''}</div>` : '') + '</div>';
  });
  return h + '</section>';
}

function tabDef() {
  let h = head('def');
  if (g.phase === 'battle') {
    h += '<section><h3>Battles · tap one, then play a battle card</h3>';
    for (const b of g.battles) {
      const p = g.P[b.pid], st = sum(b);
      h += `<button class="plate btn bat${ui.selBattle === b.id ? ' on' : ''}" data-a="bsel" data-b="${b.id}" style="--fc:${C.color[b.f]}">
        <div class="row"><span class="grow">${b.kind === 'op' ? 'ATTACK' : 'DEFEND'} ${esc(p.name)}</span><span class="sm2 dim">${st.open ? `${f1(st.P)} vs ${f1(st.E)}` : st.evac ? 'RECALLED' : st.won ? 'WON' : 'LOST'}</span></div>
        <div class="bar"><i data-bar="${b.id}" style="width:${st.p * 100}%"></i></div></button>`;
    }
    return h + `</section><button class="plate amber btn" style="width:100%" data-a="sec" ${g.secondary && g.battles.some(b => b.id === ui.selBattle && sum(b).open) ? '' : 'disabled'}>SECONDARY ORDER · +${C.secondary} TO THE SELECTED BATTLE</button>`;
  }
  const mine = g.fleets.filter(f => f.owner === 'fed'), total = mine.reduce((a, f) => a + f.ships, 0);
  h += `<section><h3>Your fleets · ${ships(total)}</h3>`;
  for (const fi of [-1, 0, 1, 2]) {
    const fs = mine.filter(f => g.P[f.at].front === fi); if (!fs.length) continue;
    h += `<div class="front" style="--fc:${fi < 0 ? 'var(--cyan)' : C.color[C.fronts[fi].f]}"><div class="fh"><b>${fi < 0 ? 'AT THE CAPITAL' : C.fronts[fi].name}</b><span class="sm2 dim">${fi === g.fi ? 'YOUR MOVE NOW' : ''}</span></div>` +
      fs.map(f => `<button class="ln lk" data-a="pick" data-f="${f.id}">${ships(f.ships)} at <b>${esc(g.P[f.at].name)}</b> · ${f.order != null ? `<span class="am">ordered to ${esc(g.P[f.order].name)}</span>` : f.moved ? '<span class="dim">moved</span>' : g.canAct(f.at) ? '<span class="cy">ready</span>' : '<span class="dim">waits its front</span>'}</button>`).join('') + '</div>';
  }
  return h + `</section><div class="sm2 dim">A ship costs ${costTxt(C.ship.cost, true)} and has strength ${S}. Tap one of your systems to build there: one ship per system each round, and it can move from the next round. A fleet moves one system a turn. Fleets in the same system fight together.</div>`;
}

function tabPro() {
  const inc = g.income();
  let h = head('pro') + '<section><h3>Stock</h3><table class="tb"><tr><th></th><th>HAVE</th><th>NEXT ROUND</th></tr>';
  for (const k of ['fuel', 'drop', 'army']) h += `<tr><td>${RES[k]}</td><td class="${k === 'fuel' ? 'am' : 'cy'}">${f1(g.res[k])}</td><td>+${f1(inc[k])}</td></tr>`;
  h += `</table><div class="sm2 dim">Nothing is kept above ${C.resMax}.</div></section><section><h3>Exchange · ${C.trade.give} for ${C.trade.get}</h3><div class="grid2">`;
  for (const [a, b] of [['army', 'fuel'], ['drop', 'fuel'], ['fuel', 'army'], ['drop', 'army'], ['fuel', 'drop'], ['army', 'drop']])
    h += `<button class="plate btn sm" data-a="trade" data-f="${a}" data-t="${b}" ${g.phase === 'plan' && g.canPay({ [a]: C.trade.give }) ? '' : 'disabled'}>${C.trade.give} ${RES[a]} → ${C.trade.get} ${RES[b]}</button>`;
  return h + '</div></section>';
}

function tabExp() {
  let h = head('exp');
  const p = g.P[ui.sel], fl = g.fedLinked();
  h += '<section><h3>Develop a system</h3>';
  if (p && p.owner === 'fed' && p.id !== 0 && p.worlds.some(w => C.worlds[w.type].res)) {
    const c = g.developCost(p), max = p.dev >= C.develop.max;
    h += `<div class="sm2"><b>${esc(p.name)}</b> · level ${p.dev} of ${C.develop.max} · its worlds pay +${p.dev * C.develop.mult * 100}%</div>
      <button class="plate amber btn" style="width:100%;margin-top:6px" data-a="dev" data-p="${p.id}" ${!max && fl.has(p.id) && g.phase === 'plan' && g.canPay(c) ? '' : 'disabled'}>${max ? 'FULLY DEVELOPED' : `DEVELOP · ${costTxt(c, true)} · +${C.develop.mult * 100}% OUTPUT`}</button>`;
  } else h += '<div class="sm2 dim">Tap one of your systems with a refinery, forge or colony, then come back here.</div>';
  h += '<div class="sm2 dim" style="margin-top:6px">The work is lost if the system falls, so develop behind the line.</div></section>';
  const dev = g.P.filter(q => q.dev && q.owner === 'fed');
  if (dev.length) h += '<section><h3>Developed</h3>' + dev.map(q => `<button class="ln lk" data-a="sel" data-p="${q.id}">${esc(q.name)} · level ${q.dev}</button>`).join('') + '</section>';
  return h;
}

function tabTru() {
  const dis = g.deckCount('dissent'), b = C.truth.broadcast, hs = g.handSize();
  return head('tru') + `<section><h3>Morale ${Math.round(g.morale)}</h3><div class="bar big2"><i style="width:${g.morale}%"></i></div>
    <div class="sm2 dim" style="margin-top:4px">You draw ${hs} cards a round. ${C.deck.high} or more: one extra. Under ${C.deck.low}: one fewer, and dissent spreads. High morale also brings more Vanguard.</div>
    <button class="plate amber btn" style="width:100%;margin-top:6px" data-a="bcast" ${g.phase === 'plan' && !g.used.broadcast && g.canPay({ fuel: b.fuel }) ? '' : 'disabled'}>${g.used.broadcast ? 'BROADCAST SENT THIS ROUND' : `BROADCAST · ${b.fuel} FUEL · +${b.morale} MORALE`}</button></section>
    <section><h3>Dissidents</h3><div class="sm2">${dis ? `<span class="rd2">${dis} Dissent card${dis > 1 ? 's' : ''}</span> in your deck of ${g.deckSize()}. Each one takes a place in your hand and does nothing.` : 'No Dissent in your deck.'}</div>
    <button class="plate amber btn" style="width:100%;margin-top:6px" data-a="purge" ${dis && g.phase === 'plan' && g.canPay({ army: C.truth.purge.army }) ? '' : 'disabled'}>REMOVE ONE DISSENT · ${C.truth.purge.army} ARMY</button>
    <div class="sm2 dim" style="margin-top:6px">A Dissent card joins your deck each time a system falls, and when morale is low.</div></section>`;
}

function tabHum() {
  const inc = g.income();
  let h = head('hum') + '<section><h3>Who the colonies send</h3>';
  for (const k in C.policy) h += `<button class="plate amber btn pol${g.policy === k ? ' on' : ''}" data-a="pol" data-k="${k}" ${g.phase === 'plan' ? '' : 'disabled'}><b>${C.policy[k].name}</b><span>${C.policy[k].text}</span></button>`;
  return h + `<div class="sm2 dim">Next round at this setting: +${f1(inc.drop)} ${N.drop}, +${f1(inc.army)} ${N.army}.</div></section>`;
}

function tabEmp() {
  const fl = g.fedLinked();
  let h = head('emp') + `<section><h3>Priority front</h3><div class="sm2 dim" style="margin-bottom:6px">One front gets the work and the supply: its systems defend at +${C.priority.fort}, pay +${(C.priority.yield - 1) * 100}%, and ships built there cost ${C.priority.fuel} less fuel.</div>`;
  C.fronts.forEach((fr, k) => {
    const sys = g.P.filter(p => p.front === k), mine = sys.filter(p => p.owner === 'fed'), out = { fuel: 0, army: 0, drop: 0 };
    for (const p of mine) if (fl.has(p.id)) for (const w of p.worlds) { const T = C.worlds[w.type]; if (T.res) out[T.res] += T.y * (1 + C.develop.mult * p.dev); }
    const thr = mine.filter(p => g.threat(p.id)).length, mineS = g.fleets.filter(f => f.owner === 'fed' && g.P[f.at].front === k).reduce((a, f) => a + f.ships, 0), foeS = g.fleets.filter(f => f.owner === fr.f).reduce((a, f) => a + f.ships, 0);
    h += `<button class="plate amber btn pol${g.priority === k ? ' on' : ''}" data-a="prio" data-k="${k}" ${g.phase === 'plan' ? '' : 'disabled'}><b>${fr.name}${g.priority === k ? ' · PRIORITY' : ''}</b>
      <span>${mine.length} of ${sys.length} systems · pays ${f1(out.fuel)}F ${f1(out.drop)}V ${f1(out.army)}A · your ${ships(mineS)} against ${foeS}${thr ? ` · <i class="rd2">${thr} threatened</i>` : ''}</span></button>`;
  });
  return h + '</section>';
}

function tabUni() {
  const fed = g.P.filter(p => p.owner === 'fed').length, near = new Set(g.fleets.filter(f => f.owner !== 'fed' && g.P[0].adj.includes(f.at)).map(f => f.owner)).size;
  return head('uni') + `<section><h3>The standing of the war</h3><div class="sm2">${fed} of ${g.P.length} systems fly the ${N.fed} flag.</div>
    <div class="bar big2"><i style="width:${fed / g.P.length * 100}%"></i></div>
    <div class="sm2 ${near >= 2 ? 'rd2' : near ? 'am' : 'dim'}" style="margin-top:6px">${near} ${near === 1 ? 'enemy has' : 'enemies have'} a fleet beside ${N.capital}. Two striking it in the same round is defeat.</div>
    <div class="sm2 dim">Victory: take all three enemy homes. Destroyed so far: ${C.factions.filter(f => g.F[f].state === 'dead').length} of 3.</div>
    <div class="sm2 dim">Systems taken ${g.stats.taken} · fallen ${g.stats.fallen} · defences held ${g.stats.held}</div></section>
    <section><h3>Your deck · ${g.deckSize()} cards</h3><div class="row"><button class="plate btn sm grow" data-a="deck">VIEW DECK</button><button class="plate btn sm grow" data-a="log">WAR LOG</button></div>
    <div class="row" style="margin-top:6px"><button class="plate amber btn sm grow" data-a="asktut">TUTORIAL</button><button class="plate btn sm grow" data-a="help">RULES</button><button class="plate btn sm grow" data-a="ask">NEW WAR</button></div></section>`;
}

const TAB = { sys: tabSys, int: tabInt, def: tabDef, pro: tabPro, exp: tabExp, tru: tabTru, hum: tabHum, emp: tabEmp, uni: tabUni };
function side() {
  const adv = g.phase === 'plan' ? g.advice().filter(a => a.kind === 'bad' || a.kind === 'warn').length : 0, dis = g.deckCount('dissent');
  const dot = { int: adv, tru: dis };
  // The eight ministries: always on screen, never scrolled.
  $('mins').innerHTML = TABS.map(k => `<button class="min${ui.open && ui.tab === k ? ' on' : ''}" data-a="tab" data-t="${k}">${svg(MICON[k])}<span>${C.ministries[k].short}</span>${dot[k] ? `<i>${dot[k]}</i>` : ''}</button>`).join('');
  $('side').classList.toggle('open', ui.open);
  const p = g.P[ui.sel];
  $('panel').innerHTML = `<div class="sh"><b>${ui.tab === 'sys' ? (p ? esc(p.name.toUpperCase()) : 'SYSTEM') : 'MINISTRY OF ' + C.ministries[ui.tab].name}</b><button class="plate btn sm" data-a="shut" aria-label="Close">×</button></div>` + TAB[ui.tab]();
}

// ---------- the hand, and the bar for the piece you have picked up ----------
function cardHtml(id, attrs, cls = '') {
  const c = C.cards[id];
  return `<button class="card t-${c.type}${cls}" ${attrs}><span class="ct"><em>${c.type.toUpperCase()}</em><i>${costTxt(c.cost)}</i></span>${svg(ICON[c.type])}<b>${c.name}</b><span class="tx">${c.text}</span></button>`;
}
const cardWhen = c => c.when || (c.type === 'battle' ? 'battle' : 'plan');
const wants = c => (cardWhen(c) === 'battle' ? 'battle' : c.type === 'boost' || c.target === 'fleet' ? 'fleet' : c.type === 'trap' || c.type === 'order' || c.target === 'system' ? 'sys' : null);
// What a card would be played on right now, given what is selected.
function targetFor(c, pid = ui.sel) {
  const w = wants(c);
  if (w === 'battle') return { battle: ui.selBattle };
  if (w === 'sys') return { sys: pid };
  if (w === 'fleet') { const here = g.fleetsAt(pid, 'fed'), f = here.find(x => x.id === ui.fleet) || here.sort((a, b) => b.ships - a.ships)[0]; return { fleet: f ? f.id : null }; }
  return {};
}
function deckbar() {
  if (ui.card != null && ui.card >= g.hand.length) ui.card = null;
  let bar = '';
  const p = g.P[ui.sel], f = myFleet();
  if (ui.card != null) {
    const c = C.cards[g.hand[ui.card]], w = wants(c), chk = g.canPlay(ui.card, targetFor(c));
    const where = w === 'battle' ? (g.battles.find(b => b.id === ui.selBattle) ? g.P[g.battles.find(b => b.id === ui.selBattle).pid].name : '') : p ? p.name : '';
    bar = `<div id="play"><b class="am">${c.name}</b> ` + (chk.ok ? `<button class="plate btn go sm2go" data-a="play">${w ? 'PLAY ON ' + esc(where.toUpperCase()) : 'PLAY'}</button>`
      : `<span class="sm2">${esc(w && !where ? { fleet: 'Tap a system where you have a fleet.', sys: 'Tap one of your systems.', battle: 'Tap a battle.' }[w] : chk.why)}</span>`) + '<button class="plate btn sm" data-a="unsel">×</button></div>';
  } else if (p && g.phase === 'plan') {
    // the system you tapped: its fleets as pieces you can pick up, and what you can do there
    const here = g.fleetsAt(p.id, 'fed'), fed = p.owner === 'fed';
    let b = `<b class="${fed ? 'cy' : 'rd2'}">${esc(p.name.toUpperCase())}</b>`;
    b += here.map(x => `<button class="plate btn sm chip${ui.fleet === x.id ? ' on' : ''}" data-a="pick" data-f="${x.id}" ${canOrder(x) ? '' : 'disabled'}>${x.ships}▲${x.order != null ? '→' : ''}</button>`).join('');
    if (f && f.at === p.id && f.order != null) b += '<button class="plate btn sm" data-a="cancel">CANCEL ORDER</button>';
    if (f && f.at === p.id && f.ships >= 2 && f.order == null) b += '<button class="plate btn sm" data-a="split">SPLIT</button>';
    if (here.filter(x => x.order == null).length >= 2 && g.canAct(p.id)) b += '<button class="plate btn sm" data-a="combine">COMBINE</button>';
    if (fed && g.canAct(p.id) && !p.built) b += `<button class="plate amber btn sm" data-a="build" data-p="${p.id}" ${g.canBuild(p.id) ? '' : 'disabled'}>BUILD ${costTxt(g.shipCost(p)) || 'FREE'}</button>`;
    if (!fed) b += `<span class="sm2">strength ${f1(g.garrison(p.id))}</span>`;
    else if (!here.length) b += `<span class="sm2">defence ${f1(g.fort(p))}</span>`;
    bar = `<div id="play" class="pc">${b}<button class="plate btn sm" data-a="info">INFO</button><button class="plate btn sm" data-a="unsel">×</button></div>`;
  }
  const cards = g.hand.map((id, i) => {
    const c = C.cards[id], ok = c.type !== 'dissent' && cardWhen(c) === g.phase;
    return cardHtml(id, `data-a="card" data-i="${i}"`, (ui.card === i ? ' sel' : '') + (ok ? '' : ' off'));
  }).join('');
  const fr = front(), lock = !!ui.show || ui.anims.length > 0;
  const go = g.phase === 'plan' ? `<button class="plate btn go" id="commit" data-a="commit" ${lock ? 'disabled' : ''}>END${fr ? '<br>' + fr.short : ''}<br>TURN</button>`
    : `<button class="plate btn" id="commit" data-a="speed">SPEED<br>×${ui.speed}</button>`;
  $('deck').innerHTML = bar + `<div id="dk"><div class="piles"><button class="plate pile" data-a="deck"><b>${g.drawPile.length}</b><span>DRAW</span></button><button class="plate pile" data-a="deck"><b>${g.discard.length}</b><span>DISCARD</span></button></div>
    <div id="hand">${cards || '<div class="sm2 dim" style="padding:20px">No cards in hand.</div>'}</div>${go}</div>`;
  // What is ringed on the map: where the picked-up fleet can go, or where the card in hand can be played.
  ui.valid = null; ui.dest = null;
  if (g.phase === 'plan' && ui.card != null) {
    const c = C.cards[g.hand[ui.card]], w = wants(c);
    if (w === 'sys' || w === 'fleet') ui.valid = new Set(g.P.filter(q => g.canPlay(ui.card, targetFor(c, q.id)).ok).map(q => q.id));
  } else if (g.phase === 'plan' && canOrder(f)) {
    ui.dest = new Map(g.P[f.at].adj.map(n => [n, g.P[n].owner === 'fed' ? 'move' : 'attack']));
  }
  document.body.style.setProperty('--dh', $('deck').offsetHeight + $('mins').offsetHeight + $('coach').offsetHeight + 'px');
}

function refresh() { sync(); tutorial(); top(); turnbar(); side(); coach(); deckbar(); outline(); store(); if (g.over) gameOver(); else if (g.phase === 'plan' && !ui.show && g.offers.length && $('modal').hidden) offer(); }

// ---------- the tutorial coach ----------
// Moves past finished steps and steps that cannot be done, and opens the right ministry when a step begins.
let tutStep = -1;
function tutorial() {
  if (ui.tut == null) { ui.hint = null; return; }
  if (g.over) { ui.tut = null; ui.hint = null; return; }
  for (let guard = 0; guard < STEPS.length; guard++) {
    const st = STEPS[ui.tut]; if (!st) { ui.tut = null; ui.hint = null; return; }
    const fresh = tutStep !== ui.tut;
    if ((fresh && st.skipIf && st.skipIf(g, ui)) || (st.done && st.done(g, ui))) { ui.tut++; continue; }
    if (fresh) { tutStep = ui.tut; if (st.tab && g.phase === 'plan') { ui.tab = st.tab; ui.open = true; } else if (st.shut) ui.open = false; }
    ui.hint = st.hint ? st.hint(g, ui) : null;
    return;
  }
}
function coach() {
  const el = $('coach'), st = ui.tut == null ? null : STEPS[ui.tut];
  if (!st) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<div class="ctx"><em>TUTORIAL · ${ui.tut + 1} OF ${STEPS.length}</em><p>${st.text(g, ui)}</p></div><div class="cbt">` +
    (st.next ? `<button class="plate btn go" data-a="tnext">${st.last ? 'FINISH' : 'NEXT'}</button>` : '') +
    (st.help ? `<button class="plate amber btn sm" data-a="thelp">${st.help}</button>` : '') +
    (st.next ? '' : '<button class="plate btn sm" data-a="tnext">SKIP STEP</button>') +
    '<button class="plate btn sm" data-a="tend">END TUTORIAL</button></div>';
}
// Outline what the coach is pointing at. Runs after everything is drawn, since drawing replaces the elements.
function outline() {
  const st = ui.tut == null ? null : STEPS[ui.tut];
  document.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
  if (!st || !st.hi) return;
  document.querySelectorAll(st.hi).forEach(x => x.classList.add('hl'));
  if (outline.shown !== ui.tut) { outline.shown = ui.tut; const x = document.querySelector('#panel .hl, #hand .hl'); if (x) x.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}

// ---------- overlays ----------
function modal(html) { $('modal').innerHTML = `<div class="plate amber box">${html}</div>`; $('modal').hidden = false; }
function offer() {
  const o = g.offers[0];
  modal(`<h2>A card for your deck</h2><p>${esc(o.why)}. Choose one card to add to your deck, or none.</p><div class="offer">` +
    o.cards.map((id, i) => cardHtml(id, `data-a="take" data-i="${i}"`)).join('') + '</div><button class="plate btn" style="width:100%;margin-top:10px" data-a="take">TAKE NONE</button>');
}
function deckModal() {
  const row = (title, pile) => {
    const n = {}; for (const id of pile) n[id] = (n[id] || 0) + 1;
    return `<h3 style="margin-top:10px">${title} · ${pile.length}</h3>` + (Object.keys(n).sort().map(id => `<div class="sm2"><b class="${C.cards[id].type === 'dissent' ? 'rd2' : 'am'}">${n[id]} × ${C.cards[id].name}</b> <span class="dim">${C.cards[id].text}</span></div>`).join('') || '<div class="sm2 dim">Empty.</div>');
  };
  modal('<h2>Your deck</h2><p class="dim">Used cards go to the discard pile. When the draw pile runs out, the discard pile is shuffled and becomes the new draw pile.</p>' +
    row('In hand', g.hand) + row('Laid as traps', g.traps()) + row('Draw pile', g.drawPile) + row('Discard pile', g.discard) + '<button class="plate btn go" data-a="close" style="margin-top:12px">CLOSE</button>');
}
function help() {
  modal(`<h2>${N.game}</h2>
    <p>You are ${N.fed} High Command at ${N.capital}. Three enemies come at you on three war fronts: one in the west, one in the east, one in the south.</p>
    <ul>
      <li><b class="am">Fleets are your pieces.</b> Tap a system where you have a fleet, then tap a neighbouring system. A cyan ring moves the fleet there. An amber ring attacks. A fleet moves one system a turn.</li>
      <li><b class="am">One front at a time.</b> Each round you move on the west, then that enemy moves; then the east; then the south. Only you can take a fleet from one front to another.</li>
      <li><b class="am">Fights.</b> Your fleet's strength (${S} a ship) against the system's own defence plus any fleet there. The loser falls back with half its ships. Fleets in the same system fight together.</li>
      <li><b class="am">Build.</b> Tap one of your systems and build a ship: one per system each round. Refineries, forges and colonies make ships cheaper.</li>
      <li><b class="am">Cards.</b> Boosts go on a fleet. Traps are laid on your own systems and spring when the enemy attacks. Battle cards are played during a fight. A big win offers a new card; a lost system adds a Dissent card.</li>
      <li><b class="am">Shields</b> mark your systems an enemy fleet could strike next turn: cyan holds, amber is even, red is likely to fall.</li>
      <li><b class="cy">Win</b> by taking all three enemy homes. <b class="rd2">Lose</b> if ${N.capital} falls, or if two enemies strike it in the same round.</li>
    </ul>
    <p class="dim">Pinch, scroll or use + and − to zoom the map; drag to move it. The war is saved in this browser.</p>
    <button class="plate btn go" data-a="close">TO YOUR POST</button>`);
}
function logModal() {
  modal('<h2>War log</h2><div class="rep">' + g.log.slice(-60).reverse().map(e => `<div class="${e.kind}">R${e.r} · ${esc(e.text)}</div>`).join('') +
    '</div><button class="plate btn go" data-a="close" style="margin-top:10px">CLOSE</button>');
}
function gameOver() {
  const s = g.stats, won = g.over.result === 'won';
  modal(`<h2>${won ? 'Total victory' : 'The capital is lost'}</h2><p>${esc(g.over.why)}</p>
    <p class="dim">Round ${g.over.round} · systems taken ${s.taken} · systems fallen ${s.fallen} · defences held ${s.held}</p>
    <button class="plate btn go" data-a="new">NEW WAR</button>`);
}

// ---------- input ----------
function playCard(t) {
  if (ui.card == null) return false;
  const ok = g.play(ui.card, t); if (ok) ui.card = null; return ok;
}
// Tap a system: play the card in hand there, or send the picked-up fleet there, or pick the system (and a fleet in it) up.
function tapSystem(id) {
  if (g.phase === 'battle') { const b = id != null && g.battles.find(q => q.pid === id); if (b) { ui.selBattle = b.id; ui.sel = id; if (ui.card != null) playCard({ battle: b.id }); } return; }
  if (ui.card != null && id != null && wants(C.cards[g.hand[ui.card]])) { ui.sel = id; playCard(targetFor(C.cards[g.hand[ui.card]], id)); return; }
  const f = myFleet();
  if (f && id != null && id !== f.at && canOrder(f) && g.P[f.at].adj.includes(id)) { g.order(f.id, id); ui.fleet = (g.fleetsAt(f.at, 'fed').find(x => canOrder(x) && x.order == null) || {}).id ?? null; ui.sel = f.at; if (ui.fleet == null) ui.sel = id; return; }
  if (id == null) { ui.sel = null; ui.fleet = null; ui.open = false; return; }
  // pick the system up; tapping it again steps through its fleets
  const here = g.fleetsAt(id, 'fed').filter(canOrder);
  if (ui.sel === id && here.length > 1) ui.fleet = here[(here.findIndex(x => x.id === ui.fleet) + 1) % here.length].id;
  else ui.fleet = here.length ? (here.find(x => x.order == null) || here[0]).id : null;
  ui.sel = id; ui.tab = 'sys';
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const d = el.dataset;
  switch (d.a) {
    case 'tab': if (ui.open && ui.tab === d.t) ui.open = false; else { ui.tab = d.t; ui.open = true; } break;
    case 'shut': ui.open = false; break;
    case 'info': ui.tab = 'sys'; ui.open = true; break;
    case 'sel': ui.sel = +d.p; ui.fleet = (g.fleetsAt(ui.sel, 'fed').find(canOrder) || {}).id ?? null; ui.tab = 'sys'; ui.open = false; break;
    case 'pick': { const f = g.fleets.find(x => x.id === +d.f); if (f) { ui.fleet = f.id; ui.sel = f.at; ui.open = false; } break; }
    case 'cancel': { const f = myFleet(); if (f) g.order(f.id, f.at); break; }
    case 'split': { const f = myFleet(); if (f) g.split(f.id); break; }
    case 'combine': g.combine(ui.sel); ui.fleet = (g.fleetsAt(ui.sel, 'fed').find(canOrder) || {}).id ?? null; break;
    case 'build': g.build(+d.p); break;
    case 'card': {
      const i = +d.i, c = C.cards[g.hand[i]];
      if (ui.card === i) { if (!wants(c)) playCard({}); else ui.card = null; }   // a second tap plays a card that needs no target
      else ui.card = i;
      break;
    }
    case 'unsel': if (ui.card != null) ui.card = null; else { ui.sel = null; ui.fleet = null; } break;
    case 'play': playCard(targetFor(C.cards[g.hand[ui.card]])); break;
    case 'trade': g.trade(d.f, d.t); break;
    case 'dev': g.develop(+d.p); break;
    case 'bcast': g.broadcast(); break;
    case 'purge': g.purge(); break;
    case 'pol': g.setPolicy(d.k); break;
    case 'prio': g.setPriority(+d.k); break;
    case 'sec': g.useSecondary(ui.selBattle); break;
    case 'bsel': ui.selBattle = +d.b; ui.sel = g.battles.find(b => b.id === ui.selBattle)?.pid ?? ui.sel; if (ui.card != null) playCard({ battle: ui.selBattle }); break;
    case 'speed': ui.speed = ui.speed === 1 ? 3 : 1; break;
    case 'commit': ui.mark = g.log.length; ui.card = null; ui.fleet = null; ui.sel = null; ui.open = false; g.endTurn(); afterStep(); break;
    case 'take': g.takeOffer(d.i == null ? null : +d.i); $('modal').hidden = true; break;
    case 'tnext': ui.tut++; break;
    case 'thelp': STEPS[ui.tut].do(g, ui); break;
    case 'tend': ui.tut = null; break;
    case 'tut': $('modal').hidden = true; try { localStorage.removeItem(SAVE); } catch {} start(SEED, null, true); return;
    case 'zin': view.zoomAt(1.5); return;
    case 'zout': view.zoomAt(1 / 1.5); return;
    case 'help': return help();
    case 'log': return logModal();
    case 'deck': return deckModal();
    case 'asktut': return modal('<h2>Play the tutorial?</h2><p>It starts a new guided war. The war in progress will be lost.</p><button class="plate btn go" data-a="tut">START THE TUTORIAL</button><button class="plate btn" style="width:100%;margin-top:8px" data-a="close">KEEP PLAYING</button>');
    case 'ask': return modal('<h2>New war?</h2><p>The war in progress will be lost.</p><button class="plate btn go" data-a="new">START A NEW WAR</button><button class="plate btn" style="width:100%;margin-top:8px" data-a="close">KEEP PLAYING</button>');
    case 'close': $('modal').hidden = true; return;
    case 'new': $('modal').hidden = true; try { localStorage.removeItem(SAVE); } catch {} start(); return;
  }
  refresh();
});
// After the rules have moved on a step: pick the battle most in need, and open the battle list on a desktop.
function afterStep() {
  sync();
  if (g.phase === 'battle') {
    const worst = [...g.battles].sort((a, b) => { const x = sum(a), y = sum(b); return x.P / x.E - y.P / y.E; })[0];
    ui.selBattle = worst ? worst.id : null; ui.sel = worst ? worst.pid : null; ui.tab = 'def';
  } else { ui.selBattle = null; ui.tab = 'int'; }
}

// The map: tap to pick up and place, drag to move the map, pinch or scroll to zoom.
const map = $('map'), ptr = new Map(); let moved = 0, pinch = 0;
const at = e => { const r = map.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
map.addEventListener('pointerdown', e => { map.setPointerCapture(e.pointerId); ptr.set(e.pointerId, at(e)); if (ptr.size === 1) moved = 0; pinch = 0; });
map.addEventListener('pointermove', e => {
  if (!ptr.has(e.pointerId)) return;
  const [x, y] = at(e), [px, py] = ptr.get(e.pointerId); ptr.set(e.pointerId, [x, y]);
  if (ptr.size === 1) { moved += Math.abs(x - px) + Math.abs(y - py); if (moved > 8) view.pan(x - px, y - py); }
  else if (ptr.size === 2) {
    const [a, b] = [...ptr.values()], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinch) view.zoomAt(dist / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    pinch = dist; moved = 99;
  }
});
const up = e => {
  if (!ptr.has(e.pointerId)) return;
  const [x, y] = ptr.get(e.pointerId); ptr.delete(e.pointerId); pinch = 0;
  if (ptr.size || moved > 8 || e.type === 'pointercancel') return;
  tapSystem(view.pick(g, x, y)); refresh();
};
map.addEventListener('pointerup', up); map.addEventListener('pointercancel', up);
map.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = at(e); view.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, x, y); }, { passive: false });
new ResizeObserver(() => view.resize()).observe($('stage'));

// ---------- the clock ----------
let last = performance.now(), slow = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // fleets on the move; the rules wait for them, so each side's move can be seen
  if (ui.anims.length) { for (const a of ui.anims) a.t += dt * ui.speed; const n = ui.anims.length; ui.anims = ui.anims.filter(a => a.t < 0.6); if (!ui.anims.length && n) refresh(); }
  if (ui.show && !ui.anims.length) { ui.show.t += dt * ui.speed; if (ui.show.t > 0.7) { ui.show = null; refresh(); } }
  if (g.phase === 'battle' && !ui.anims.length && !ui.show) {
    const ph = g.phase, stg = g.stage, fi = g.fi; let left = dt * ui.speed;
    while (left > 0 && g.phase === 'battle' && g.stage === stg) { const st = Math.min(0.05, left); g.tick(st); left -= st; }
    if (g.phase !== ph || g.stage !== stg || g.fi !== fi) { afterStep(); refresh(); }
    else {
      for (const b of g.battles) { const bar = document.querySelector(`[data-bar="${b.id}"]`); if (bar) bar.style.width = b.fight.p * 100 + '%'; }
      if ((slow += dt) > 0.5) { slow = 0; side(); outline(); }
    }
  }
  view.draw(g, ui, now / 1000);
  const sc = $('sys'), p = g.P[ui.sel];
  if (sc && p && sc.offsetParent) {
    const th = g.threat(p.id);
    drawPlanet(sc, g, p, { battle: g.battles.find(b => b.pid === p.id), threat: th ? th.str : 0, enemy: th ? th.f : p.owner, mine: g.shipsAt(p.id, 'fed'), foe: p.owner === 'fed' ? 0 : g.shipsAt(p.id, p.owner) }, now / 1000);
  }
  requestAnimationFrame(frame);
}

const qs = new URLSearchParams(location.search), seed = +qs.get('seed') || 0;
let saved = null; try { saved = seed || qs.has('tutorial') ? null : JSON.parse(localStorage.getItem(SAVE)); } catch {}
start(seed || (qs.has('tutorial') ? SEED : 0), saved, qs.has('tutorial'));
view.resize();
if (!localStorage.getItem('sgs.seen6') && !seed && !qs.has('tutorial')) {
  try { localStorage.setItem('sgs.seen6', '1'); } catch {}
  modal(`<h2>${N.game}</h2><p>A war of fleets on three fronts, with a deck of cards to tip it. You are ${N.fed} High Command, and three enemies are on their way.</p>
    <p>The tutorial walks you through your first rounds, one step at a time. It takes about three minutes.</p>
    <button class="plate btn go" data-a="tut">PLAY THE TUTORIAL</button><button class="plate btn" style="width:100%;margin-top:8px" data-a="close">SKIP IT, I KNOW HOW TO PLAY</button>`);
}
requestAnimationFrame(frame);
