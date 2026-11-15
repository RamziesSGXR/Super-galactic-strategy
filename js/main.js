// The interface: resources on top, the map, the ministries beside it, and your hand of cards along the bottom.
// All game rules are in sim.js.
import { C, VERSION } from './config.js';
import { Game } from './sim.js';
import { View, drawPlanet, sum } from './view.js';
import { STEPS, SEED } from './tutorial.js';

const $ = id => document.getElementById(id), N = C.names;
const KIND = { capital: 'CAPITAL SYSTEM', gate: 'GATE SYSTEM', junction: 'JUNCTION', mid: 'SYSTEM', outer: 'OUTER SYSTEM', frontier: 'FRONTIER SYSTEM', home: 'ENEMY HOME' };
const RES = { fuel: N.fuel, drop: N.drop, army: N.army }, RS = { fuel: 'F', drop: 'V', army: 'A' };
const TABS = ['int', 'def', 'pro', 'exp', 'tru', 'hum', 'emp', 'uni'];
const SAVE = 'sgs.save4';
const f1 = v => (Math.round(v * 10) / 10).toString();
const esc = s => String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
const costTxt = (c, long) => Object.entries(c || {}).filter(([, v]) => v).map(([k, v]) => `${f1(v)}${long ? ' ' + RES[k] : RS[k]}`).join(long ? ' + ' : ' ');
// Thin line icons, one per kind of card.
const ICON = {
  assault: '<path d="M4 5l8 8 8-8M4 12l8 8 8-8"/>', siege: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>',
  sabotage: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>', order: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
  battle: '<circle cx="12" cy="12" r="6"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>', propaganda: '<path d="M4 10v4h3l8 5V5L7 10zM18 9c1.5 1.5 1.5 4.5 0 6"/>',
  logistics: '<path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"/>', dissent: '<path d="M5 5l14 14M19 5L5 19"/>', relic: '<path d="M12 3l9 9-9 9-9-9z"/>',
};
// One icon per ministry.
const MICON = {
  int: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>', def: ICON.order, pro: ICON.logistics,
  exp: '<path d="M4 20l6-6 4 4 6-9M14 9h6v6"/>', tru: ICON.propaganda, hum: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-4.5 3-7 7-7s7 2.5 7 7"/>',
  emp: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>', uni: '<path d="M6 21V4h12l-3 4 3 4H6"/>',
};
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square">${d}</svg>`;
const icon = c => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square">${ICON[c.type === 'mission' ? c.fam : c.type]}</svg>`;

let g, view = new View($('map'));
const ui = { sel: null, selBattle: null, card: null, tab: 'int', open: false, speed: 1, mark: 0, tut: null, hint: null, reveal: null, valid: null };
window.sgs = { get g() { return g; }, ui, view, refresh: () => refresh() };   // for the browser checks

function odds(P, E) {
  const r = P / Math.max(0.01, E);
  return r >= 1.25 ? ['FAVOURED', 'cy'] : r >= 1.08 ? ['EDGE', 'cy'] : r >= 0.93 ? ['EVEN', 'am'] : r >= 0.8 ? ['RISKY', 'rd2'] : ['OUTMATCHED', 'rd2'];
}
const routeName = k => { const end = g.P.find(p => p.spoke === k && (p.kind === 'home' || p.kind === 'frontier')); return `${end.name.toUpperCase()} ROUTE`; };

function start(seed, saved, tutorial) {
  g = (saved && Game.load(saved)) || new Game(seed || (Date.now() % 100000));
  Object.assign(ui, { sel: null, selBattle: null, card: null, tab: 'int', mark: Math.max(0, g.log.length - 6), tut: tutorial ? 0 : null, hint: null, open: false, reveal: null, valid: null });
  tutStep = -1;
  if (view.R0) view.reset();
  refresh();
}
function store() {
  try { if (g.over) localStorage.removeItem(SAVE); else if (g.phase === 'plan') localStorage.setItem(SAVE, JSON.stringify(g.save())); } catch {}
}

// ---------- the top strip ----------
function top() {
  const t = g.totalCost(), plan = g.phase === 'plan';
  const cell = (k, cls) => `<div class="${cls}"><b>${Math.floor(g.res[k])}${plan && t[k] ? `<i>−${f1(t[k])}</i>` : ''}</b><span>${RES[k]}</span></div>`;
  $('top').innerHTML = `<div class="ttl">${N.game}<small>${VERSION}</small></div>
    <div class="rd">ROUND ${g.round} · ${g.phase === 'plan' ? 'PLANNING' : g.phase === 'battle' ? 'BATTLE' : 'WAR OVER'}</div>
    <div class="ro">${cell('fuel', 'a')}${cell('drop', '')}${cell('army', '')}<div><b>${Math.round(g.morale)}</b><span>MORALE</span></div></div>`;
  // The strip under the map: the most pressing advice while planning, otherwise the latest news.
  const last = g.log[g.log.length - 1], adv = g.phase === 'plan' ? g.advice().find(a => a.kind === 'bad' || a.kind === 'warn') : null;
  $('bulletin').className = adv ? adv.kind : last.kind; $('bulletin').textContent = adv ? `INTELLIGENCE › ${adv.text}` : `R${last.r} › ${last.text}`;
}

// ---------- the ministries ----------
const head = k => `<div class="mh"><span>${C.ministries[k].does}</span></div>`;
const shield = cl => `<svg class="shd ${cl}" viewBox="0 0 14 16"><path d="M1 1h12v8l-6 6-6-6z"/></svg>`;

function threatLine(t) {
  const D = g.defPlan().get(t).D, [w, cl] = odds(D, t.str), pin = g.pins(t);
  return `<button class="ln lk" data-a="sel" data-p="${t.to}">${shield(pin ? 'cy' : cl)} <b>${esc(g.P[t.to].name)}</b> needs defending · ${N.factions[t.f]} ${f1(t.str)} vs your ${f1(D)} ` +
    (pin ? '<span class="am">PINNED</span>' : `<span class="${cl}">${w}</span>`) + '</button>';
}

function tabSys() {
  const p = g.P[ui.sel];
  if (!p) return '<div class="sm2 dim">Tap a star system on the map to see its worlds.</div>';
  const fed = p.owner === 'fed', fl = g.fedLinked(), linked = fed && fl.has(p.id), plan = g.phase === 'plan';
  const s = g.frontOf(p.id), o = s >= 0 && g.ops[s], mine = o && o.target === p.id, battle = g.battles.find(b => b.pid === p.id);
  let h = `<section class="plate"><div class="row"><span class="big grow">${esc(p.name)}</span><span class="sm2 dim">${KIND[p.kind]}</span></div>`;
  h += fed ? `<div class="sm2 cy">${N.fed.toUpperCase()} · DEFENCE ${f1(g.fort(p))}${p.dev ? ` · DEVELOPED ${p.dev}` : ''}${linked ? '' : ' · <span class="rd2">CUT OFF: pays nothing, defends at half</span>'}</div>`
    : `<div class="sm2" style="color:${C.color[p.owner]}">${N.factions[p.owner].toUpperCase()} · GARRISON ${f1(g.garrison(p.id))}</div>`;
  if (p.trait) h += `<div class="sm2 am">${C.traits[p.trait].name}: ${C.traits[p.trait].text}</div>`;
  if (p.relic) h += `<div class="sm2 am">RELIC: ${C.cards[p.relic].name}. ${fed && linked ? (g.hand.includes(p.relic) ? 'In your hand.' : `Comes to your hand in round ${Math.max(g.round + 1, p.relicAt)}.`) : 'Retake the system to gain it.'}</div>`;
  for (const t of g.threats.filter(x => x.to === p.id && !x.hidden)) h += threatLine(t);
  const pins = g.threats.filter(t => t.from === p.id && !t.hidden);
  if (pins.length) h += `<div class="sm2 am">${pins.length} attack${pins.length > 1 ? 's launch' : ' launches'} from here. An operation here at least half as strong pins ${pins.length > 1 ? 'them' : 'it'} in place.</div>`;
  h += '<canvas id="sys"></canvas>';
  if (battle) { const st = sum(battle); h += `<div class="sm2">${battle.kind === 'op' ? 'YOUR OPERATION' : 'DEFENCE'} · ${st.open ? `${f1(st.P)} vs ${f1(st.E)}` : st.evac ? 'RECALLED' : st.won ? 'WON' : 'LOST'}</div>`; }
  if (!fed && plan) {
    if (!g.canTarget(p.id, fl)) h += '<div class="sm2 dim">Out of reach. Take a system next to it first.</div>';
    else if (mine && o.cards.length) {
      const P = g.opStrength(s), E = g.opEnemy(s), [w, cl] = odds(P, E);
      const notes = [`reach ×${f1(1 - C.reach * (p.ring - 1))}`, g.near(p.id, 'shipyard', fl) && 'shipyard ×1.15', g.near(p.id, 'depot', fl) && 'depot −2 fuel', g.major(s) && `offensive ×${g.dirBoost()}`].filter(Boolean).join(' · ');
      h += `<div class="opb"><div><b class="am">${g.major(s) ? 'MAJOR OFFENSIVE' : 'OPERATION'} · ${f1(P)} vs ${f1(E)}</b> <span class="${cl}">${w}</span>
        <div class="sm2">${o.cards.map(id => C.cards[id].name).join(' · ')}</div><div class="sm2 dim">${g.retal[s] ? 'Free: retaliation' : costTxt(g.cost(s), true)} · ${notes}</div></div>
        <button class="plate btn sm" data-a="recall" data-s="${s}">RECALL</button></div>`;
    } else h += `<div class="sm2 am">In reach. Play mission cards from your hand onto it. ${N.factions[p.owner]} is weak to ${C.weak[p.owner].toUpperCase()} cards.</div>`;
  }
  p.worlds.forEach((w, i) => {
    const T = C.worlds[w.type], key = i === p.key;
    h += `<div class="mis"><div><b style="color:${T.col}">${esc(w.name)}</b> <span class="sm2 dim">${T.name}${T.res ? ` · +${T.y} ${RES[T.res]}` : T.fort ? ` · +${T.fort} DEFENCE` : ''}</span>` +
      (key ? `<div class="sm2 am">KEY WORLD, shown above: the fight for the system happens here${T.fav ? `. Suits ${T.fav.toUpperCase()} missions` : ''}.</div>` : '') + '</div><span></span></div>';
  });
  return h + '</section>';
}

function tabInt() {
  let h = head('int');
  const rep = g.log.slice(ui.mark);
  if (rep.length) h += '<section class="rep"><h3>Report</h3>' + rep.slice(-8).map(e => `<div class="${e.kind}">${esc(e.text)}</div>`).join('') + '</section>';
  const adv = g.phase === 'plan' ? g.advice() : [];
  if (adv.length) h += '<section class="rep"><h3>Suggested actions</h3>' + adv.map(a => a.pid != null ? `<button class="adv lk ${a.kind}" data-a="sel" data-p="${a.pid}">${esc(a.text)}</button>` : `<div class="${a.kind}">${esc(a.text)}</div>`).join('') + '</section>';
  const ths = g.threats.filter(t => !t.hidden);
  if (ths.length) h += '<section><h3>Needs defending</h3>' + ths.map(threatLine).join('') + '</section>';
  h += '<section><h3>Enemy strength</h3>';
  C.factions.forEach((f, s) => {
    const F = g.F[f], own = g.P.filter(p => p.owner === f).length;
    h += `<div class="front" style="--fc:${C.color[f]}"><div class="fh"><b>${F.state === 'wait' ? 'UNKNOWN SIGNAL ' + (s + 1) : N.factions[f]}</b><span class="sm2 dim">${F.state === 'wait' ? 'QUIET' : F.state === 'warn' ? `EXPECTED ROUND ${F.at}` : F.state === 'dead' ? 'DESTROYED' : `${own} SYSTEMS · FORCE ${Math.round(F.force)} · HOME ${Math.round(g.garrison(F.home))}`}</span></div>` +
      (F.state === 'active' ? `<div class="ln dim">Weak to ${C.weak[f].toUpperCase()}.${F.cards.length ? ` <span class="rd2">Holds ${F.cards.length} card${F.cards.length > 1 ? 's' : ''}.</span>` : ''}</div>` : '') + '</div>';
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
  h += '<section><h3>Fronts</h3>';
  for (let s = 0; s < 3; s++) {
    const f = C.factions[s], F = g.F[f]; if (F.state !== 'active') continue;
    h += `<div class="front" style="--fc:${C.color[f]}"><div class="fh"><b>${N.factions[f]}</b><span class="sm2 dim">WEAK TO ${C.weak[f].toUpperCase()}</span></div>`;
    const ths = g.threats.filter(x => x.s === s);
    if (ths.some(t => t.hidden)) h += '<div class="ln rd2">THE SHROUD: its attacks this round cannot be seen.</div>';
    for (const t of ths) if (!t.hidden) h += threatLine(t);
    const o = g.ops[s];
    if (o && o.cards.length) {
      const [w, cl] = odds(g.opStrength(s), g.opEnemy(s));
      h += `<div class="opb"><button class="ln lk am" data-a="sel" data-p="${o.target}">${g.major(s) ? 'MAJOR OFFENSIVE' : 'OPERATION'} › <b>${esc(g.P[o.target].name)}</b> · ${o.cards.length} card${o.cards.length > 1 ? 's' : ''} · ${f1(g.opStrength(s))} vs ${f1(g.opEnemy(s))} <span class="${cl}">${w}</span></button>
        <button class="plate btn sm" data-a="recall" data-s="${s}">RECALL</button></div>`;
    } else h += `<div class="ln dim">${g.targets(s).length ? 'No operation. Play a mission card onto a system marked in amber.' : 'Nothing in reach.'}</div>`;
    if (g.retal[s]) h += '<div class="ln cy">RETALIATION: this front\'s operation is free and stronger this round.</div>';
    const d = g.directive, on = m => d && d.sector === s && d.mode === m ? ' on' : '', mob = g.mob && g.mob.s === s ? g.mob : null;
    h += '<div class="row">';
    if (!mob) h += `<button class="plate amber btn sm grow" data-a="mob" data-s="${s}" ${g.canPay({ fuel: C.mob.fuel }) ? '' : 'disabled'}>MOBILISE · ${C.mob.fuel} FUEL</button>`;
    else if (!g.mobReady(s)) h += '<span class="ln am grow">MOBILISING · offensive ready next round</span>';
    else h += `<button class="plate amber btn sm grow${on('attack')}" data-a="dir" data-s="${s}" data-m="attack">${on('attack') ? 'MAJOR OFFENSIVE: ON' : `LAUNCH MAJOR OFFENSIVE · ${g.mob.until - g.round + 1} ROUND${g.mob.until > g.round ? 'S' : ''} LEFT`}</button>`;
    if (ths.length) h += `<button class="plate amber btn sm grow${on('defend')}" data-a="dir" data-s="${s}" data-m="defend">DEFENCE ORDER</button>`;
    if (d && d.sector === s && g.prop.rally) h += '<span class="ln am">TO THE FRONT! ×2</span>';
    h += '</div></div>';
  }
  if (!C.factions.some(f => g.F[f].state === 'active')) h += '<div class="sm2 dim">No enemy on the map. Yet.</div>';
  return h + `</section><div class="sm2 dim">A general attack carries ${C.op.general} mission cards. A mobilised major offensive carries ${C.op.major} at +50%. A Defence Order adds +50% to every defence on that front. Defence itself is automatic.</div>`;
}

function tabPro() {
  const t = g.totalCost(), inc = g.income();
  let h = head('pro') + '<section><h3>Stock</h3><table class="tb"><tr><th></th><th>HAVE</th><th>ORDERED</th><th>NEXT ROUND</th></tr>';
  for (const k of ['fuel', 'drop', 'army']) h += `<tr><td>${RES[k]}</td><td class="${k === 'fuel' ? 'am' : 'cy'}">${f1(g.res[k])}</td><td>${t[k] ? '−' + f1(t[k]) : '·'}</td><td>+${f1(inc[k])}</td></tr>`;
  h += `</table><div class="sm2 dim">Nothing is kept above ${C.resMax}.</div></section><section><h3>Exchange · ${C.trade.give} for ${C.trade.get}</h3><div class="grid2">`;
  for (const [a, b] of [['army', 'fuel'], ['drop', 'fuel'], ['fuel', 'army'], ['drop', 'army']])
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
  let h = head('emp') + `<section><h3>Priority route</h3><div class="sm2 dim" style="margin-bottom:6px">One route gets the work and the supply: its systems defend at +${C.route.fort}, pay +${(C.route.yield - 1) * 100}%, and operations along it cost ${C.route.fuel} less fuel.</div>`;
  for (let k = 0; k < 6; k++) {
    const sys = g.P.filter(p => p.spoke === k), mine = sys.filter(p => p.owner === 'fed'), out = { fuel: 0, army: 0, drop: 0 };
    for (const p of mine) if (fl.has(p.id)) for (const w of p.worlds) { const T = C.worlds[w.type]; if (T.res) out[T.res] += T.y * (1 + C.develop.mult * p.dev); }
    const thr = g.threats.filter(t => !t.hidden && g.P[t.to].spoke === k).length, ops = g.ops.filter(o => o && g.P[o.target].spoke === k).length;
    const note = thr ? `<span class="rd2">${thr} attack${thr > 1 ? 's' : ''} inbound: supply should go here</span>` : ops ? '<span class="am">your operation runs here</span>' : mine.length < sys.length ? 'contested' : 'quiet';
    h += `<button class="plate amber btn pol${g.route === k ? ' on' : ''}" data-a="route" data-k="${k}" ${g.phase === 'plan' ? '' : 'disabled'}><b>${routeName(k)}${g.route === k ? ' · PRIORITY' : ''}</b>
      <span>${mine.length} of ${sys.length} systems · pays ${f1(out.fuel)}F ${f1(out.drop)}V ${f1(out.army)}A · ${note}</span></button>`;
  }
  return h + '</section>';
}

function tabUni() {
  const fed = g.P.filter(p => p.owner === 'fed').length, gates = new Set(g.P[0].adj.filter(n => g.P[n].owner !== 'fed').map(n => g.P[n].owner)).size;
  let h = head('uni') + `<section><h3>The standing of the war</h3><div class="sm2">${fed} of ${g.P.length} systems fly the ${N.fed} flag.</div>
    <div class="bar big2"><i style="width:${fed / g.P.length * 100}%"></i></div>
    <div class="sm2 ${gates >= 2 ? 'rd2' : gates ? 'am' : 'dim'}" style="margin-top:6px">${gates} ${gates === 1 ? 'enemy holds' : 'enemies hold'} a gate beside ${N.capital}. Two striking it in the same round is defeat.</div>
    <div class="sm2 dim">Victory: take all three enemy homes. Destroyed so far: ${C.factions.filter(f => g.F[f].state === 'dead').length} of 3.</div>
    <div class="sm2 dim">Systems retaken ${g.stats.taken} · fallen ${g.stats.fallen} · defences held ${g.stats.held}</div></section>
    <section><h3>Your deck · ${g.deckSize()} cards</h3><div class="row"><button class="plate btn sm grow" data-a="deck">VIEW DECK</button><button class="plate btn sm grow" data-a="log">WAR LOG</button></div>
    <div class="row" style="margin-top:6px"><button class="plate amber btn sm grow" data-a="asktut">TUTORIAL</button><button class="plate btn sm grow" data-a="help">RULES</button><button class="plate btn sm grow" data-a="ask">NEW WAR</button></div></section>`;
  return h;
}

const TAB = { sys: tabSys, int: tabInt, def: tabDef, pro: tabPro, exp: tabExp, tru: tabTru, hum: tabHum, emp: tabEmp, uni: tabUni };
function side() {
  const adv = g.phase === 'plan' ? g.advice().filter(a => a.kind === 'bad' || a.kind === 'warn').length : 0, dis = g.deckCount('dissent');
  const dot = { int: adv, tru: dis, def: g.mob && g.mobReady(g.mob.s) && !g.directive ? 1 : 0 };
  // The eight ministries: always on screen, never scrolled.
  $('mins').innerHTML = TABS.map(k => `<button class="min${ui.open && ui.tab === k ? ' on' : ''}" data-a="tab" data-t="${k}">${svg(MICON[k])}<span>${C.ministries[k].short}</span>${dot[k] ? `<i>${dot[k]}</i>` : ''}</button>`).join('');
  $('side').classList.toggle('open', ui.open);
  const p = g.P[ui.sel];
  $('panel').innerHTML = `<div class="sh"><b>${ui.tab === 'sys' ? (p ? esc(p.name.toUpperCase()) : 'SYSTEM') : 'MINISTRY OF ' + C.ministries[ui.tab].name}</b><button class="plate btn sm" data-a="shut" aria-label="Close">×</button></div>` + TAB[ui.tab]();
}

// ---------- whose turn it is ----------
// The strip across the top of the map: you, the battles, then each enemy in turn. The one in play is lit.
function turnbar() {
  const act = C.factions.filter(f => g.F[f].state === 'active'), rv = ui.reveal, cur = rv ? rv.q[rv.i] : null;
  const step = (label, on, color) => `<span class="${on ? 'on' : ''}"${color ? ` style="--tc:${color}"` : ''}>${label}</span>`;
  let h = '<div class="trk">' + step('YOUR TURN', !rv && g.phase === 'plan') + step('BATTLE', g.phase === 'battle') +
    act.map(f => step(N.factions[f].replace('The ', '').toUpperCase(), cur && cur.f === f, C.color[f])).join('') + '</div>';
  let sub = '';
  if (g.phase === 'over') sub = 'The war is over.';
  else if (cur) sub = `<b style="color:${C.color[cur.f]}">${N.factions[cur.f].toUpperCase()}'S TURN.</b> ${cur.text}`;
  else if (g.phase === 'battle') sub = '<b class="cy">THE FLEETS MEET.</b> Tap a fight, then a battle card, to help it.';
  else sub = ui.card != null ? '<b class="am">YOUR TURN.</b> Tap a ringed system to play the card there.' : `<b class="am">YOUR TURN.</b> Play cards onto the map, then ${[0, 1, 2].some(s => g.count(s)) || g.threats.length ? 'COMMIT ORDERS' : 'END ROUND'}.`;
  $('turn').innerHTML = h + `<div class="tsub">${sub}${rv ? ' <button class="plate btn sm" data-a="skip">SKIP</button>' : ''}</div>`;
}
// After the battles each enemy takes its turn in front of you: it plays its card, and its fleets move out.
function startReveal() {
  const q = [], path = new Map();
  for (const f of C.factions) {
    const F = g.F[f]; if (F.state !== 'active') continue;
    const ths = g.threats.filter(t => t.f === f), seen = ths.filter(t => !t.hidden), cd = F.played ? C.enemyCards[f][F.played] : null;
    const moves = ths.length && !seen.length ? 'Its fleets move unseen.' : seen.length ? `${seen.length} fleet${seen.length > 1 ? 's set' : ' sets'} out for ${seen.map(t => g.P[t.to].name).join(', ')}.` : 'It holds its fleets back and builds up.';
    q.push({ f, ths: seen, text: (cd ? `Plays <b>${cd.name}</b>: ${cd.text}. ` : '') + moves });
    // each fleet's route from the home to where it launches
    const link = g.facLinked(f);
    for (const t of seen) {
      const prev = new Map([[F.home, null]]), queue = [F.home];
      while (queue.length) { const a = queue.shift(); if (a === t.from) break; for (const n of g.P[a].adj) if (link.has(n) && !prev.has(n)) { prev.set(n, a); queue.push(n); } }
      const way = []; for (let a = t.from; a != null && prev.has(a); a = prev.get(a)) way.unshift(a);
      path.set(t, way.length ? way.slice(-3) : [t.from]);
    }
  }
  ui.reveal = q.length ? { q, i: 0, t: 0, shown: new Set(), anim: new Map(), path } : null;
}
function stepReveal(dt) {
  const rv = ui.reveal, cur = rv.q[rv.i]; rv.t += dt;
  cur.ths.forEach((th, k) => { const u = (rv.t - 0.8 - k * 0.45) / 1.1; if (u >= 0) { rv.shown.add(th); rv.anim.set(th, Math.min(1, u)); } });
  if (rv.t > 0.8 + cur.ths.length * 0.45 + 1.6) { rv.i++; rv.t = 0; if (rv.i >= rv.q.length) ui.reveal = null; return true; }
  return false;
}

// ---------- the hand ----------
function cardHtml(id, attrs, extra = '', cls = '') {
  const c = C.cards[id];
  return `<button class="card t-${c.type}${cls}" ${attrs}><span class="ct"><em>${c.type.toUpperCase()}</em><i>${costTxt(c.cost)}</i></span>${icon(c)}<b>${c.name}</b>` +
    (c.str ? `<span class="st">STRENGTH ${extra || c.str}</span>` : '') + `<span class="tx">${c.text}</span></button>`;
}
function needsTarget(c) { return c.type === 'mission' || c.type === 'battle' || c.when === 'battle' || c.needs === 'planet' || c.needs === 'front'; }
function deckbar() {
  const target = g.phase === 'battle' ? ui.selBattle : ui.sel;
  if (ui.card != null && ui.card >= g.hand.length) ui.card = null;
  let play = '';
  if (ui.card != null) {
    const id = g.hand[ui.card], c = C.cards[id], chk = g.canPlay(ui.card, target);
    const where = g.phase === 'battle' ? (g.battles.find(b => b.id === target) ? g.P[g.battles.find(b => b.id === target).pid].name : '') : (g.P[target] ? g.P[target].name : '');
    play = `<div id="play"><b class="am">${c.name}</b> ` + (chk.ok ? `<button class="plate btn go sm2go" data-a="play">${needsTarget(c) ? 'PLAY ON ' + esc(where.toUpperCase()) : 'PLAY'}</button>`
      : `<span class="sm2">${esc(chk.why || (needsTarget(c) ? 'Tap a target.' : ''))}</span>`) + '<button class="plate btn sm" data-a="unsel">×</button></div>';
  }
  const p = g.P[ui.sel], here = p && p.owner !== 'fed' && g.phase === 'plan';
  const cards = g.hand.map((id, i) => {
    const c = C.cards[id], ok = c.type !== 'dissent' && (c.when || (c.type === 'battle' ? 'battle' : 'plan')) === g.phase;
    return cardHtml(id, `data-a="card" data-i="${i}"`, c.str && here ? f1(g.cardStr(id, p.id)) + ' HERE' : '', (ui.card === i ? ' sel' : '') + (ok ? '' : ' off'));
  }).join('');
  const n = [0, 1, 2].filter(s => g.count(s)).length;
  const go = g.phase === 'plan' ? `<button class="plate btn go" id="commit" data-a="commit" ${ui.reveal ? 'disabled' : ''}>${n || g.threats.length ? 'COMMIT<br>ORDERS' : 'END<br>ROUND'}</button>`
    : `<button class="plate btn" id="commit" data-a="speed">SPEED<br>×${ui.speed}</button>`;
  $('deck').innerHTML = play + `<div id="dk"><div class="piles"><button class="plate pile" data-a="deck"><b>${g.drawPile.length}</b><span>DRAW</span></button><button class="plate pile" data-a="deck"><b>${g.discard.length}</b><span>DISCARD</span></button></div>
    <div id="hand">${cards || '<div class="sm2 dim" style="padding:20px">No cards in hand.</div>'}</div>${go}</div>`;
  // With a card in hand, the systems it can be played on are ringed on the map.
  ui.valid = null;
  if (ui.card != null && g.phase === 'plan') { const c = C.cards[g.hand[ui.card]]; if (c.type === 'mission' || c.needs === 'planet' || c.needs === 'front') ui.valid = new Set(g.P.filter(q => g.canPlay(ui.card, q.id).ok).map(q => q.id)); }
  document.body.style.setProperty('--dh', $('deck').offsetHeight + $('mins').offsetHeight + $('coach').offsetHeight + 'px');
}

function refresh() { tutorial(); top(); turnbar(); side(); coach(); deckbar(); outline(); store(); if (g.over) gameOver(); else if (g.phase === 'plan' && !ui.reveal && g.offers.length && $('modal').hidden) offer(); }

// ---------- the tutorial coach ----------
// Moves past finished steps and steps that cannot be done, and opens the right tab when a step begins.
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
  const el = $('coach'), st = ui.tut == null || ui.reveal ? null : STEPS[ui.tut];
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
  const st = ui.tut == null || ui.reveal ? null : STEPS[ui.tut];
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
    o.cards.map((id, i) => cardHtml(id, `data-a="take" data-i="${i}"`)).join('') +
    '</div><button class="plate btn" style="width:100%;margin-top:10px" data-a="take">TAKE NONE</button>');
}
function deckModal() {
  const row = (title, pile) => {
    const n = {}; for (const id of pile) n[id] = (n[id] || 0) + 1;
    return `<h3 style="margin-top:10px">${title} · ${pile.length}</h3>` + (Object.keys(n).sort().map(id => `<div class="sm2"><b class="${C.cards[id].type === 'dissent' ? 'rd2' : 'am'}">${n[id]} × ${C.cards[id].name}</b> <span class="dim">${C.cards[id].text}</span></div>`).join('') || '<div class="sm2 dim">Empty.</div>');
  };
  modal('<h2>Your deck</h2><p class="dim">Used cards go to the discard pile. When the draw pile runs out, the discard pile is shuffled and becomes the new draw pile.</p>' +
    row('In hand', g.hand) + row('Draw pile', g.drawPile) + row('Discard pile', g.discard) + '<button class="plate btn go" data-a="close" style="margin-top:12px">CLOSE</button>');
}
function help() {
  modal(`<h2>${N.game}</h2>
    <p>You are ${N.fed} High Command at ${N.capital}. Three enemies are coming, one after another. They never fight each other.</p>
    <ul>
      <li><b class="am">Your deck.</b> Each round you draw a hand. Tap a card, then tap where to play it. Mission cards go onto an enemy system marked in amber; two make a general attack. What you do not play is discarded and comes round again.</li>
      <li><b class="am">Build the deck.</b> A major victory offers you a new card. A system lost adds a Dissent card, which does nothing until the Ministry of Truth removes it.</li>
      <li><b class="am">The ministries.</b> Intelligence tells you what needs doing. Defence mobilises a front for a major offensive (four cards, +50%) and gives Defence Orders. Prosperity exchanges resources, Expansion develops systems, Truth lifts morale, Humanity sets volunteers against conscripts, Employment picks the priority route, Unity shows the standing of the war.</li>
      <li><b class="am">On the map.</b> A shield marks a system that needs defending: cyan holds, amber is even, red is likely to fall. A dashed ring marks a system you are attacking. Defence is automatic, and the Army answers if a lane still reaches the system.</li>
      <li><b class="am">Systems.</b> Each star system has several worlds that pay resources, and one key world where the fight happens. A system is a gate: nobody passes it until it is taken.</li>
      <li><b class="cy">Win</b> by taking all three enemy homes. <b class="rd2">Lose</b> if ${N.capital} falls, or if two enemies strike it in the same round.</li>
    </ul>
    <p class="dim">Pinch, scroll or use + and − to zoom the map; drag to move it. The war is saved in this browser every round.</p>
    <button class="plate btn go" data-a="close">TO YOUR POST</button>`);
}
function logModal() {
  modal('<h2>War log</h2><div class="rep">' + g.log.slice(-60).reverse().map(e => `<div class="${e.kind}">R${e.r} · ${esc(e.text)}</div>`).join('') +
    '</div><button class="plate btn go" data-a="close" style="margin-top:10px">CLOSE</button>');
}
function gameOver() {
  const s = g.stats, won = g.over.result === 'won';
  modal(`<h2>${won ? 'Total victory' : 'The capital is lost'}</h2><p>${esc(g.over.why)}</p>
    <p class="dim">Round ${g.over.round} · systems retaken ${s.taken} · systems fallen ${s.fallen} · defences held ${s.held}</p>
    <button class="plate btn go" data-a="new">NEW WAR</button>`);
}

// ---------- input ----------
function playCard(target) {
  if (ui.card == null) return false;
  const ok = g.play(ui.card, target); if (ok) ui.card = null; return ok;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const d = el.dataset, s = +d.s;
  switch (d.a) {
    case 'tab': if (ui.open && ui.tab === d.t) ui.open = false; else { ui.tab = d.t; ui.open = true; } break;
    case 'shut': ui.open = false; break;
    case 'skip': ui.reveal = null; break;
    case 'sel': ui.sel = +d.p; ui.tab = 'sys'; ui.open = true; break;
    case 'card': {
      const i = +d.i, c = C.cards[g.hand[i]];
      if (ui.card === i) { if (!needsTarget(c)) playCard(null); else ui.card = null; }   // a second tap plays a card that needs no target
      else ui.card = i;
      break;
    }
    case 'unsel': ui.card = null; break;
    case 'play': playCard(g.phase === 'battle' ? ui.selBattle : ui.sel); break;
    case 'recall': g.recall(s); break;
    case 'mob': g.mobilise(s); break;
    case 'dir': g.setDirective(s, d.m); break;
    case 'trade': g.trade(d.f, d.t); break;
    case 'dev': g.develop(+d.p); break;
    case 'bcast': g.broadcast(); break;
    case 'purge': g.purge(); break;
    case 'pol': g.setPolicy(d.k); break;
    case 'route': g.setRoute(+d.k); break;
    case 'sec': g.useSecondary(ui.selBattle); break;
    case 'bsel': ui.selBattle = +d.b; ui.sel = g.battles.find(b => b.id === ui.selBattle)?.pid ?? ui.sel; if (ui.card != null) playCard(ui.selBattle); break;
    case 'speed': ui.speed = ui.speed === 1 ? 3 : 1; break;
    case 'commit': {
      ui.mark = g.log.length; ui.card = null; g.endPlan();
      const worst = [...g.battles].sort((a, b) => { const x = sum(a), y = sum(b); return x.P / x.E - y.P / y.E; })[0];
      ui.selBattle = worst ? worst.id : null; if (worst) ui.sel = worst.pid;
      ui.tab = g.phase === 'battle' ? 'def' : 'int'; ui.open = g.phase === 'battle';
      if (g.phase === 'plan') startReveal();   // a round with no battles goes straight to the enemies' turns
      break;
    }
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

// The map: tap to select (or to play the card in hand), drag to move, pinch or scroll to zoom.
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
  const id = view.pick(g, x, y); ui.sel = id;
  const b = id != null && g.battles.find(q => q.pid === id); if (b) ui.selBattle = b.id;
  // With a card in hand, a tap on a valid target plays it there. Otherwise the tap opens the system.
  if (ui.reveal) ui.reveal = null;   // a tap ends the replay of the enemies' turns
  else if (ui.card != null && id != null && needsTarget(C.cards[g.hand[ui.card]])) playCard(g.phase === 'battle' ? (b ? b.id : null) : id);
  else if (id != null) { ui.tab = 'sys'; ui.open = true; }
  else ui.open = false;
  refresh();
};
map.addEventListener('pointerup', up); map.addEventListener('pointercancel', up);
map.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = at(e); view.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, x, y); }, { passive: false });
new ResizeObserver(() => view.resize()).observe($('stage'));

// ---------- the clock ----------
let last = performance.now(), slow = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (g.phase === 'battle') {
    const ph = g.phase; let left = dt * ui.speed;
    while (left > 0 && g.phase === 'battle') { const st = Math.min(0.05, left); g.tick(st); left -= st; }
    if (g.phase !== ph) { ui.selBattle = null; ui.card = null; ui.tab = 'int'; ui.open = false; if (g.phase === 'plan') startReveal(); refresh(); }
    else {
      for (const b of g.battles) { const bar = document.querySelector(`[data-bar="${b.id}"]`); if (bar) bar.style.width = b.fight.p * 100 + '%'; }
      if ((slow += dt) > 0.5) { slow = 0; side(); coach(); outline(); }
    }
  }
  if (ui.reveal) { const was = ui.reveal.i; if (stepReveal(dt) || !ui.reveal || ui.reveal.i !== was) refresh(); }
  view.draw(g, ui, now / 1000);
  const sc = $('sys'), p = g.P[ui.sel];
  if (sc && p && sc.offsetParent) {
    const s = g.frontOf(p.id), o = s >= 0 && g.ops[s], th = g.threats.find(t => t.to === p.id && !t.hidden && !(ui.reveal && !ui.reveal.shown.has(t)));
    drawPlanet(sc, g, p, { battle: g.battles.find(b => b.pid === p.id), threat: th ? th.str : 0, enemy: th ? th.f : p.owner, op: o && o.target === p.id && o.cards.length ? g.opStrength(s) : 0 }, now / 1000);
  }
  requestAnimationFrame(frame);
}

const seed = +new URLSearchParams(location.search).get('seed') || 0;
let saved = null; try { saved = seed ? null : JSON.parse(localStorage.getItem(SAVE)); } catch {}
start(seed, saved, new URLSearchParams(location.search).has('tutorial'));
view.resize();
if (!localStorage.getItem('sgs.seen5') && !seed) {
  try { localStorage.setItem('sgs.seen5', '1'); } catch {}
  modal(`<h2>${N.game}</h2><p>A strategic deck-building war. You are ${N.fed} High Command, and three enemies are on their way.</p>
    <p>The tutorial walks you through your first three rounds, one step at a time. It takes about three minutes.</p>
    <button class="plate btn go" data-a="tut">PLAY THE TUTORIAL</button><button class="plate btn" style="width:100%;margin-top:8px" data-a="close">SKIP IT, I KNOW HOW TO PLAY</button>`);
}
requestAnimationFrame(frame);
