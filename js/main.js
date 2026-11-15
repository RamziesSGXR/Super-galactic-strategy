// The interface: resources on top, the map with the camera on the front in play, the ministries in a row, the
// decision bar along the bottom, and the battle screen when fleets meet. All game rules are in sim.js.
import { C, VERSION } from './config.js';
import { Game } from './sim.js';
import { View, drawPlanet, drawBattle } from './view.js';
import { STEPS, SEED } from './tutorial.js';

const $ = id => document.getElementById(id), N = C.names, HP = C.ship.hp;
const RES = { fuel: N.fuel, drop: N.drop, army: N.army }, RS = { fuel: 'F', drop: 'V', army: 'A' };
const TABS = ['int', 'def', 'pro', 'exp', 'tru', 'hum', 'emp', 'uni'];
const SAVE = 'sgs.save7';
const f1 = v => (Math.round(v * 10) / 10).toString();
const esc = s => String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
const costTxt = (c, long) => Object.entries(c || {}).filter(([, v]) => v).map(([k, v]) => `${f1(v)}${long ? ' ' + RES[k] : RS[k]}`).join(long ? ' + ' : ' ') || 'FREE';
const ships = n => `${n} SHIP${n === 1 ? '' : 'S'}`;
const lootName = f => C.fronts[C.factions.indexOf(f)].loot;
const ICON = {
  fleet: '<path d="M4 5l8 8 8-8M4 12l8 8 8-8"/>', world: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
  site: '<path d="M12 3l9 9-9 9-9-9z"/>', truth: '<path d="M4 10v4h3l8 5V5L7 10zM18 9c1.5 1.5 1.5 4.5 0 6"/>', foe: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
};
const MICON = {
  int: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>', def: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
  pro: '<path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"/>', exp: '<path d="M4 20l6-6 4 4 6-9M14 9h6v6"/>', tru: ICON.truth,
  hum: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-4.5 3-7 7-7s7 2.5 7 7"/>', emp: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>', uni: '<path d="M6 21V4h12l-3 4 3 4H6"/>',
};
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square">${d}</svg>`;

let g, view = new View($('map'));
const ui = { sel: null, fleet: null, half: false, pend: null, tab: 'int', open: false, speed: 1, mark: 0, tut: null, hint: null, dest: null, anims: [], show: null, seen: null, fx: null, auto: 0, front: -2 };
window.sgs = { get g() { return g; }, ui, view, refresh: () => refresh() };   // for the browser checks

const front = () => (g.fi >= 0 ? C.fronts[g.fi] : null);
const myFleet = () => g.fleets.find(f => f.id === ui.fleet && f.owner === 'fed' && !f.moved);
const busy = () => !!ui.show || ui.anims.length > 0;            // something is being shown; wait
const fighting = () => !!g.battle && !busy();                   // the battle screen is up
function odds(mine, theirs) { const r = mine / Math.max(1, theirs); return r >= 1.4 ? ['STRONG', 'cy'] : r >= 1.1 ? ['EDGE', 'cy'] : r >= 0.9 ? ['EVEN', 'am'] : ['WEAK', 'rd2']; }

function start(seed, saved, tutorial) {
  g = (saved && Game.load(saved)) || new Game(seed || (Date.now() % 100000));
  Object.assign(ui, { sel: null, fleet: null, half: false, pend: null, tab: 'int', open: false, mark: Math.max(0, g.log.length - 6), tut: tutorial ? 0 : null, hint: null, dest: null, anims: [], show: null, seen: null, fx: null, auto: 0, front: -2 });
  tutStep = -1;
  if (view.R0) view.reset();
  step();
}
function store() { try { if (g.over) localStorage.removeItem(SAVE); else if (g.phase === 'plan') localStorage.setItem(SAVE, JSON.stringify(g.save())); } catch {} }

// After the rules have moved on: animate the fleets that moved, announce what the enemy did, turn the camera to
// the front in play, then redraw.
function step() {
  for (const m of g.moves.splice(0)) ui.anims.push({ ...m, t: 0 });
  if (g.last && g.last !== ui.seen) { ui.seen = g.last; ui.show = { ...g.last, t: 0 }; ui.sel = g.last.pid ?? null; ui.fleet = null; ui.pend = null; }
  if (g.fi !== ui.front) { ui.front = g.fi; view.focus(g.fi); }
  refresh();
}

// ---------- the top strip ----------
function top() {
  const cell = (k, cls) => `<div class="${cls}"><b>${Math.floor(g.res[k])}</b><span>${RES[k]}</span></div>`;
  const loot = C.fronts.map(fr => `<div style="--lc:${C.color[fr.f]}" class="lt"><b>${g.loot[fr.f]}</b><span>${fr.lootShort}</span></div>`).join('');
  $('top').innerHTML = `<div class="ttl">${N.game}<small>${VERSION}</small></div><div class="rd">ROUND ${g.round}</div>
    <div class="ro">${cell('fuel', 'a')}${cell('drop', '')}${cell('army', '')}${loot}</div>`;
  const last = g.log[g.log.length - 1], adv = g.phase === 'plan' && !busy() ? g.advice().find(a => a.kind === 'bad' || a.kind === 'warn') : null;
  $('bulletin').className = adv ? adv.kind : last.kind; $('bulletin').textContent = adv ? `INTELLIGENCE › ${adv.text}` : `R${last.r} › ${last.text}`;
}

// ---------- whose turn it is ----------
function turnbar() {
  const fr = front();
  const h = '<div class="trk">' + C.fronts.map((x, i) => `<span class="${g.fi === i ? 'on' : ''}${g.atWar(i) ? '' : ' off'}" style="--tc:${C.color[x.f]}">${x.short}</span>`).join('') +
    `<button class="plate btn sm" data-a="cam">${view.front != null && view.front >= 0 ? 'WHOLE MAP' : 'THIS FRONT'}</button></div>`;
  let sub;
  if (g.phase === 'over') sub = 'The war is over.';
  else if (ui.show) sub = `<b style="color:${C.color[ui.show.f]}">${N.factions[ui.show.f].toUpperCase()}</b> ${esc(ui.show.text)}`;
  else if (g.battle) sub = g.battle.kind === 'def' ? `<b style="color:${C.color[g.battle.f]}">${N.factions[g.battle.f].toUpperCase()}</b> attacks ${esc(g.P[g.battle.pid].name)}.` : `<b class="cy">YOUR ATTACK</b> on ${esc(g.P[g.battle.pid].name)}.`;
  else if (!fr) sub = '<b class="am">YOUR DECISION.</b> No front is at war. Move one fleet if you wish, then end the round.';
  else sub = `<b class="am">YOUR DECISION</b> on the ${fr.name.toLowerCase()}: attack, defend, or hold.`;
  $('turn').innerHTML = h + `<div class="tsub">${sub}</div>`;
}

// ---------- the ministries ----------
const head = k => `<div class="mh"><span>${C.ministries[k].does}</span></div>`;
const shieldSvg = cl => `<svg class="shd ${cl}" viewBox="0 0 14 16"><path d="M1 1h12v8l-6 6-6-6z"/></svg>`;
function threatLine(p, t) {
  const D = g.strength(p.id), [w, cl] = odds(D, t.hp);
  return `<button class="ln lk" data-a="sel" data-p="${p.id}">${shieldSvg(cl)} <b>${esc(p.name)}</b> · ${N.factions[t.f]} ${ships(t.ships)} beside it (${t.hp} hit points), yours ${D} <span class="${cl}">${w}</span></button>`;
}
const threats = () => g.P.map(p => ({ p, t: g.threat(p.id) })).filter(x => x.t).sort((a, b) => a.p.ring - b.p.ring);
function cardHtml(id, attrs = '', cls = '') {
  const c = C.bcards[id], stats = [c.atk && `+${c.atk} HIT`, c.block && `${c.block > 50 ? 'ALL' : c.block} BLOCK`, c.heal && `+${c.heal} REPAIR`].filter(Boolean).join(' · ');
  return `<button class="card t-${c.kind}${cls}" ${attrs}><span class="ct"><em>${{ fleet: 'FLEET', world: 'WORLD', site: 'SITE', truth: 'TRUTH', foe: 'ENEMY' }[c.kind]}</em></span>${svg(ICON[c.kind])}<b>${c.name}</b><span class="st">${stats}</span><span class="tx">${c.text}</span></button>`;
}
function deckList(owner) {
  const n = {}; for (const id of g.deck(owner)) n[id] = (n[id] || 0) + 1;
  return Object.keys(n).map(id => `<div class="sm2"><b class="${C.bcards[id].kind === 'truth' ? 'cy' : 'am'}">${n[id]} × ${C.bcards[id].name}</b> <span class="dim">${C.bcards[id].text}</span></div>`).join('');
}

function tabSys() {
  const p = g.P[ui.sel];
  if (!p) return '<div class="sm2 dim">Tap a star system on the map.</div>';
  const fed = p.owner === 'fed', fl = g.fedLinked(), th = g.threat(p.id), fr = p.front >= 0 ? C.fronts[p.front] : null, T = C.worlds[g.keyWorld(p).type], n = g.shipsAt(p.id, p.owner);
  let h = `<section class="plate"><div class="row"><span class="big grow">${esc(p.name)}</span><span class="sm2 dim">${p.kind === 'capital' ? 'THE CAPITAL' : p.kind === 'home' ? 'ENEMY HOME' : fr.name}</span></div>`;
  h += `<div class="sm2" style="color:${C.color[p.owner]}">${(fed ? N.fed : N.factions[p.owner]).toUpperCase()} · ${g.strength(p.id)} HIT POINTS (system ${g.fort(p)} + ${ships(n)})${fed && !fl.has(p.id) ? ' · <span class="rd2">CUT OFF</span>' : ''}${p.dev ? ` · DEVELOPED ${p.dev}` : ''}</div>`;
  if (p.site) h += `<div class="sm2 am">${C.sites[p.site].name}: ${C.sites[p.site].text}</div>`;
  if (th) h += threatLine(p, th);
  h += '<canvas id="sys"></canvas>';
  if (fed && T.yard) h += `<div class="sm2 am">${T.name}: ${T.yard}</div>`;
  p.worlds.forEach((w, i) => {
    const W = C.worlds[w.type];
    h += `<div class="mis"><div><b style="color:${W.col}">${esc(w.name)}</b> <span class="sm2 dim">${W.name}${W.res ? ` · +${W.y} ${RES[W.res]}` : W.fort ? ` · +${W.fort} DEFENCE` : ''}${W.card ? ` · feeds ${C.bcards[W.card].name}` : ''}</span>${i === p.key ? '<div class="sm2 dim">The key world, shown above.</div>' : ''}</div><span></span></div>`;
  });
  return h + '</section>';
}
function tabInt() {
  let h = head('int');
  const rep = g.log.slice(ui.mark);
  if (rep.length) h += '<section class="rep"><h3>Report</h3>' + rep.slice(-8).map(e => `<div class="${e.kind}">${esc(e.text)}</div>`).join('') + '</section>';
  const adv = g.advice();
  if (adv.length) h += '<section class="rep"><h3>Suggested actions</h3>' + adv.map(a => a.pid != null ? `<button class="adv lk ${a.kind}" data-a="sel" data-p="${a.pid}">${esc(a.text)}</button>` : `<div class="${a.kind}">${esc(a.text)}</div>`).join('') + '</section>';
  const ths = threats();
  if (ths.length) h += '<section><h3>Needs defending</h3>' + ths.slice(0, 6).map(x => threatLine(x.p, x.t)).join('') + '</section>';
  h += '<section><h3>The enemy</h3>';
  C.fronts.forEach(fr => {
    const F = g.F[fr.f], own = g.P.filter(p => p.owner === fr.f).length, n = g.fleets.filter(x => x.owner === fr.f).reduce((a, x) => a + x.ships, 0);
    h += `<div class="front" style="--fc:${C.color[fr.f]}"><div class="fh"><b>${fr.short} · ${F.state === 'wait' ? 'UNKNOWN' : N.factions[fr.f]}</b><span class="sm2 dim">${F.state === 'wait' ? 'QUIET' : F.state === 'warn' ? `EXPECTED ROUND ${F.at}` : F.state === 'dead' ? 'DESTROYED' : `${own} SYSTEMS · ${ships(n)} · HOME ${g.strength(F.home)}`}</span></div>` +
      (F.state === 'active' ? `<div class="ln dim">${C.enemy[fr.f].text}</div>` : '') + '</div>';
  });
  return h + '</section>';
}
function tabDef() {
  const mine = g.fleets.filter(f => f.owner === 'fed'), total = mine.reduce((a, f) => a + f.ships, 0);
  let h = head('def') + `<section><h3>Your fleets · ${ships(total)}</h3>`;
  for (const fi of [-1, 0, 1, 2]) {
    const fs = mine.filter(f => g.P[f.at].front === fi); if (!fs.length) continue;
    h += `<div class="front" style="--fc:${fi < 0 ? 'var(--cyan)' : C.color[C.fronts[fi].f]}"><div class="fh"><b>${fi < 0 ? 'AT THE CAPITAL' : C.fronts[fi].name}</b><span class="sm2 dim">${fi === g.fi ? 'IN PLAY' : ''}</span></div>` +
      fs.map(f => `<button class="ln lk" data-a="pick" data-f="${f.id}">${ships(f.ships)} at <b>${esc(g.P[f.at].name)}</b> · ${f.moved ? '<span class="dim">has moved this round</span>' : '<span class="cy">ready</span>'}</button>`).join('') + '</div>';
  }
  h += `</section><section><h3>Your battle deck · ${g.deck('fed').length} cards</h3><div class="sm2 dim" style="margin-bottom:4px">When fleets meet you draw ${C.battle.hand} of these at random. The deck is made of what you hold: worlds, special sites and propaganda.</div>${deckList('fed')}</section>`;
  return h + `<div class="sm2 dim">A ship costs ${costTxt(C.ship.cost, true)}, is ${HP} hit points and fires 1 a round. A fleet may travel any distance through systems you hold, once a round.</div>`;
}
function tabPro() {
  const inc = g.income();
  let h = head('pro') + '<section><h3>Stock</h3><table class="tb"><tr><th></th><th>HAVE</th><th>NEXT ROUND</th></tr>';
  for (const k of ['fuel', 'drop', 'army']) h += `<tr><td>${RES[k]}</td><td class="${k === 'fuel' ? 'am' : 'cy'}">${f1(g.res[k])}</td><td>+${f1(inc[k])}</td></tr>`;
  for (const fr of C.fronts) h += `<tr><td>${fr.loot}</td><td style="color:${C.color[fr.f]}">${g.loot[fr.f]}</td><td class="dim">won on the ${fr.short.toLowerCase()} front</td></tr>`;
  h += `</table><div class="sm2 dim">Nothing is kept above ${C.resMax}.</div></section><section><h3>Exchange · ${C.trade.give} for ${C.trade.get}</h3><div class="grid2">`;
  for (const [a, b] of [['army', 'fuel'], ['drop', 'fuel'], ['fuel', 'army'], ['drop', 'army'], ['fuel', 'drop'], ['army', 'drop']])
    h += `<button class="plate btn sm" data-a="trade" data-f="${a}" data-t="${b}" ${g.ready() && g.canPay({ [a]: C.trade.give }) ? '' : 'disabled'}>${C.trade.give} ${RES[a]} → ${C.trade.get} ${RES[b]}</button>`;
  return h + '</div></section>';
}
function tabExp() {
  let h = head('exp');
  const p = g.P[ui.sel], fl = g.fedLinked(), mine = p && p.owner === 'fed';
  h += `<section><h3>Special sites</h3><div class="sm2 dim" style="margin-bottom:6px">Each front has its own resource, won with every victory there. Spend it on a site and two cards nobody else has join your battle deck. ${mine ? `Building at <b class="cy">${esc(p.name)}</b>.` : 'Tap one of your systems on the front in play first.'}</div>`;
  for (const k in C.sites) {
    const s = C.sites[k], have = g.P.filter(q => q.site === k).length;
    h += `<button class="plate amber btn pol" data-a="site" data-k="${k}" ${mine && g.canSite(p.id, k) ? '' : 'disabled'}><b>${s.name} · ${s.cost} ${lootName(s.loot)}</b><span>${s.text} You have ${g.loot[s.loot]} ${lootName(s.loot).toLowerCase()} and ${have} of ${C.siteMax} built.</span></button>`;
  }
  h += '</section><section><h3>Develop a system</h3>';
  if (mine && p.id !== 0 && p.worlds.some(w => C.worlds[w.type].res)) {
    const c = g.developCost(p), max = p.dev >= C.develop.max;
    h += `<div class="sm2"><b>${esc(p.name)}</b> · level ${p.dev} of ${C.develop.max}</div><button class="plate amber btn" style="width:100%;margin-top:6px" data-a="dev" data-p="${p.id}" ${!max && fl.has(p.id) && g.ready() && g.canPay(c) ? '' : 'disabled'}>${max ? 'FULLY DEVELOPED' : `DEVELOP · ${costTxt(c, true)} · +${C.develop.mult * 100}% OUTPUT`}</button>`;
  } else h += '<div class="sm2 dim">Tap one of your systems with a refinery, forge or colony.</div>';
  return h + '</section>';
}
function tabTru() {
  const list = (o, none) => (g.truth[o].length ? g.truth[o].map(id => `<div class="sm2"><b class="cy">${C.bcards[id].name}</b> <span class="dim">${C.bcards[id].text}</span></div>`).join('') : `<div class="sm2 dim">${none}</div>`);
  let h = head('tru') + `<section><h3>Your propaganda · ${g.truth.fed.length} of ${C.truthMax}</h3>${list('fed', 'None yet.')}</section>
    <section><h3>How it works</h3><div class="sm2 dim">You do not manage this. Take a system and a VICTORY NEWSREEL joins your battle deck; hold one and you gain HEROES OF THE LINE; lose one and you gain NOT ONE STEP BACK. A propaganda card is used up when played. If both sides play propaganda in the same round, the stronger one takes the other's card.</div></section><section><h3>Enemy propaganda</h3>`;
  for (const f of C.factions) if (g.F[f].state === 'active') h += `<div class="front" style="--fc:${C.color[f]}"><div class="fh"><b>${N.factions[f]}</b></div>${list(f, 'None.')}</div>`;
  return h + '</section>';
}
function tabHum() {
  const inc = g.income();
  let h = head('hum') + '<section><h3>Who the colonies send</h3>';
  for (const k in C.policy) h += `<button class="plate amber btn pol${g.policy === k ? ' on' : ''}" data-a="pol" data-k="${k}" ${g.ready() ? '' : 'disabled'}><b>${C.policy[k].name}</b><span>${C.policy[k].text}</span></button>`;
  return h + `<div class="sm2 dim">Next round at this setting: +${f1(inc.drop)} ${N.drop}, +${f1(inc.army)} ${N.army}.</div></section>`;
}
function tabEmp() {
  const fl = g.fedLinked();
  let h = head('emp') + `<section><h3>Priority front</h3><div class="sm2 dim" style="margin-bottom:6px">One front gets the work and the supply: its systems have +${C.priority.fort} hit points, pay +${(C.priority.yield - 1) * 100}%, and ships built there cost ${C.priority.fuel} less fuel.</div>`;
  C.fronts.forEach((fr, k) => {
    const sys = g.P.filter(p => p.front === k), mine = sys.filter(p => p.owner === 'fed'), thr = mine.filter(p => g.threat(p.id)).length;
    const mineS = g.fleets.filter(f => f.owner === 'fed' && g.P[f.at].front === k).reduce((a, f) => a + f.ships, 0), foeS = g.fleets.filter(f => f.owner === fr.f).reduce((a, f) => a + f.ships, 0);
    h += `<button class="plate amber btn pol${g.priority === k ? ' on' : ''}" data-a="prio" data-k="${k}" ${g.ready() ? '' : 'disabled'}><b>${fr.name}${g.priority === k ? ' · PRIORITY' : ''}</b>
      <span>${mine.filter(p => fl.has(p.id)).length} of ${sys.length} systems · your ${ships(mineS)} against ${foeS}${thr ? ` · ${thr} threatened` : ''}</span></button>`;
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
    <section><div class="row"><button class="plate btn sm grow" data-a="log">WAR LOG</button><button class="plate btn sm grow" data-a="help">RULES</button></div>
    <div class="row" style="margin-top:6px"><button class="plate amber btn sm grow" data-a="asktut">TUTORIAL</button><button class="plate btn sm grow" data-a="ask">NEW WAR</button></div></section>`;
}
const TAB = { sys: tabSys, int: tabInt, def: tabDef, pro: tabPro, exp: tabExp, tru: tabTru, hum: tabHum, emp: tabEmp, uni: tabUni };
function side() {
  const adv = g.advice().filter(a => a.kind === 'bad' || a.kind === 'warn').length, sites = Object.keys(C.sites).some(k => g.P.some(p => g.canSite(p.id, k)));
  const dot = { int: adv, exp: sites ? 1 : 0 };
  $('mins').innerHTML = TABS.map(k => `<button class="min${ui.open && ui.tab === k ? ' on' : ''}" data-a="tab" data-t="${k}">${svg(MICON[k])}<span>${C.ministries[k].short}</span>${dot[k] ? `<i>${dot[k]}</i>` : ''}</button>`).join('');
  $('side').classList.toggle('open', ui.open);
  const p = g.P[ui.sel];
  $('panel').innerHTML = `<div class="sh"><b>${ui.tab === 'sys' ? (p ? esc(p.name.toUpperCase()) : 'SYSTEM') : 'MINISTRY OF ' + C.ministries[ui.tab].name}</b><button class="plate btn sm" data-a="shut" aria-label="Close">×</button></div>` + TAB[ui.tab]();
}

// ---------- the decision bar ----------
// What you can do right now, in one place: the fleet you picked up, the order waiting to be confirmed, what can be
// built at the system you tapped, and the button that holds the front.
function actbar() {
  const fr = front(), p = g.P[ui.sel], f = myFleet(), lock = busy() || !g.ready();
  let h = '';
  if (g.phase === 'over') h = '<div class="arow"><span class="sm2">The war is over.</span></div>';
  else if (lock) h = `<div class="arow"><span class="sm2 dim">${g.battle ? 'Battle stations.' : 'Watch the map.'}</span></div>`;
  else if (ui.pend) {
    const q = g.P[ui.pend.pid], n = ui.half ? Math.ceil(f.ships / 2) : f.ships;
    if (ui.pend.type === 'atk') { const [w, cl] = odds(n * HP, g.strength(q.id)); h = `<div class="arow"><span class="grow"><b class="am">ATTACK ${esc(q.name.toUpperCase())}</b><br><span class="sm2">Your ${ships(n)}: ${n * HP} hit points against ${g.strength(q.id)}. <b class="${cl}">${w}</b></span></span><button class="plate btn sm" data-a="pcancel">CANCEL</button></div><button class="plate btn go" data-a="confirm">ATTACK: THIS IS YOUR DECISION FOR THE FRONT</button>`; }
    else h = `<div class="arow"><span class="grow"><b class="cy">MOVE TO ${esc(q.name.toUpperCase())}</b><br><span class="sm2">${ships(n)} go there. It will have ${g.strength(q.id) + n * HP} hit points.</span></span><button class="plate btn sm" data-a="pcancel">CANCEL</button></div><button class="plate btn go" data-a="confirm">MOVE: THIS IS YOUR DECISION FOR THE FRONT</button>`;
  } else {
    let row = '';
    if (f) row = `<b class="cy">FLEET · ${ships(f.ships)}</b><span class="sm2 grow">at ${esc(g.P[f.at].name)}. Tap an <b class="am">amber</b> ring to attack, a <b class="cy">cyan</b> ring to move there.</span>` + (f.ships > 1 ? `<button class="plate btn sm${ui.half ? ' on' : ''}" data-a="half">${ui.half ? 'SEND HALF' : 'SEND ALL'}</button>` : '');
    else if (p) row = `<b class="${p.owner === 'fed' ? 'cy' : 'rd2'}">${esc(p.name.toUpperCase())}</b><span class="sm2 grow">${g.strength(p.id)} hit points${p.owner === 'fed' && g.fleetAt(p.id, 'fed') ? ' · its fleet has moved this round' : ''}</span>`;
    else row = `<span class="sm2 grow">${fr ? 'Tap one of your fleets to attack or defend with it. Tap one of your systems to build.' : 'Tap a fleet to move it, or a system to build.'}</span>`;
    let build = '';
    if (p && p.owner === 'fed' && g.onFront(p.id)) {
      build += `<button class="plate amber btn sm" data-a="build" data-p="${p.id}" ${g.canBuild(p.id) ? '' : 'disabled'}>${p.built ? 'BUILT THIS ROUND' : 'BUILD SHIP · ' + costTxt(g.shipCost(p))}</button>`;
      for (const k in C.sites) if (g.canSite(p.id, k)) build += `<button class="plate amber btn sm" data-a="site" data-k="${k}">${C.sites[k].name} · ${C.sites[k].cost}</button>`;
    }
    h = `<div class="arow">${row}${p ? '<button class="plate btn sm" data-a="info">INFO</button><button class="plate btn sm" data-a="unsel">×</button>' : ''}</div>` +
      `<div class="arow">${build}<button class="plate btn go hold" id="commit" data-a="hold">${fr ? `HOLD THE ${fr.short}` : 'END ROUND'}</button></div>`;
  }
  $('deck').innerHTML = h;
  // what is ringed on the map: where the picked-up fleet can attack (amber) or move to (cyan)
  ui.dest = null;
  if (f && !lock && !ui.pend) { ui.dest = new Map(); for (const id of g.posts(f)) ui.dest.set(id, 'move'); for (const id of g.targets(f)) ui.dest.set(id, 'attack'); }
  document.body.style.setProperty('--dh', $('deck').offsetHeight + $('mins').offsetHeight + $('coach').offsetHeight + 'px');
}

// ---------- the battle screen ----------
function fight() {
  const el = $('fight'), b = g.battle;
  if (!fighting()) { el.hidden = true; return; }
  el.hidden = false;
  const p = g.P[b.pid], you = b.you, foe = b.foe, bar = (s, color, name) => `<div class="hp"><div class="row"><b style="color:${color}">${name}</b><span class="grow"></span><b>${Math.max(0, Math.ceil(s.hp))}</b><span class="sm2 dim">/ ${s.max} · fires ${s.fire}</span></div><div class="bar big2"><i style="width:${Math.max(0, s.hp) / s.max * 100}%;background:${color}"></i></div></div>`;
  let h = `<div class="fh2"><b>${b.kind === 'atk' ? 'YOUR ATTACK ON' : 'DEFEND'} ${esc(p.name.toUpperCase())}</b><span class="sm2 dim">ROUND ${b.round + (b.done ? 0 : 1)}</span></div>
    <canvas id="fc"></canvas><div class="hps">${bar(you, 'var(--cyan)', 'YOU')}${bar(foe, C.color[b.f], N.factions[b.f].toUpperCase())}</div>
    <div class="flog">${b.lines.length ? b.lines.map(l => `<div>${esc(l)}</div>`).join('') : `<div class="dim">${b.kind === 'def' ? `${N.factions[b.f]} is attacking. ` : ''}Each round you play one card, then every ship fires. First to run out of hit points loses${b.kind === 'def' ? '' : '; a draw goes to the defender'}.</div>`}</div>`;
  if (b.done) h += `<div class="fres ${b.win ? 'cy' : 'rd2'}">${b.win ? 'VICTORY' : 'DEFEAT'} · ${esc(b.result || '')}</div><button class="plate btn go" data-a="bclose">CONTINUE</button>`;
  else if (ui.fx && ui.fx.t < 0.9) h += '<div class="fhand wait"><span class="sm2 dim">…</span></div>';
  else if (you.hand.length) h += `<div class="sm2 dim" style="padding:0 2px 4px">Your hand, drawn from your deck. Tap a card to play it this round.</div><div class="fhand">${you.hand.map((id, i) => cardHtml(id, `data-a="bplay" data-i="${i}"`)).join('')}</div><button class="plate btn sm" style="width:100%;margin-top:6px" data-a="bplay">PLAY NO CARD THIS ROUND</button>`;
  else h += '<div class="fhand wait"><b class="am">THE CARDS ARE SPENT. THE GUNS DECIDE.</b></div>';
  $('fbody').innerHTML = h;
}

function refresh() { tutorial(); top(); document.body.style.setProperty('--th', $('top').offsetHeight + 'px'); turnbar(); side(); coach(); actbar(); fight(); outline(); store(); if (g.over && !g.battle) gameOver(); }

// ---------- the tutorial coach ----------
let tutStep = -1;
function tutorial() {
  if (ui.tut == null) { ui.hint = null; return; }
  if (g.over) { ui.tut = null; ui.hint = null; return; }
  for (let guard = 0; guard < STEPS.length; guard++) {
    const st = STEPS[ui.tut]; if (!st) { ui.tut = null; ui.hint = null; return; }
    if (st.wait && st.wait(g, ui)) { ui.hint = null; return; }
    const fresh = tutStep !== ui.tut;
    if ((fresh && st.skipIf && st.skipIf(g, ui)) || (st.done && st.done(g, ui))) { ui.tut++; continue; }
    if (fresh) { tutStep = ui.tut; if (st.tab && g.ready()) { ui.tab = st.tab; ui.open = true; } else if (st.shut) ui.open = false; }
    ui.hint = st.hint ? st.hint(g, ui) : null;
    return;
  }
}
function coach() {
  const st = ui.tut == null ? null : STEPS[ui.tut], inFight = fighting(), show = st && (inFight || !busy());
  for (const el of [$('coach'), $('fcoach')]) el.hidden = true;
  if (!show) return;
  const el = inFight ? $('fcoach') : $('coach'); el.hidden = false;
  el.innerHTML = `<div class="ctx"><em>TUTORIAL · ${ui.tut + 1} OF ${STEPS.length}</em><p>${st.text(g, ui)}</p></div><div class="cbt">` +
    (st.next ? `<button class="plate btn go" data-a="tnext">${st.last ? 'FINISH' : 'NEXT'}</button>` : '') +
    (st.help ? `<button class="plate amber btn sm" data-a="thelp">${st.help}</button>` : '') +
    (st.next ? '' : '<button class="plate btn sm" data-a="tnext">SKIP STEP</button>') + '<button class="plate btn sm" data-a="tend">END TUTORIAL</button></div>';
}
function outline() {
  const st = ui.tut == null ? null : STEPS[ui.tut];
  document.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
  if (!st || !st.hi || (st.wait && st.wait(g, ui))) return;
  document.querySelectorAll(st.hi).forEach(x => x.classList.add('hl'));
}

// ---------- overlays ----------
function modal(html) { $('modal').innerHTML = `<div class="plate amber box">${html}</div>`; $('modal').hidden = false; }
function help() {
  modal(`<h2>${N.game}</h2>
    <p>You are ${N.fed} High Command at ${N.capital}. Three enemies come at you on three war fronts: east, west and south.</p>
    <ul>
      <li><b class="am">One front at a time.</b> Each round goes east, west, south. The map turns to the front in play. First the enemy there takes one action. Then you make one decision.</li>
      <li><b class="am">Your decision:</b> attack, defend, or hold. Tap one of your fleets, then an amber ring to attack that system or a cyan ring to move the fleet there. A fleet may travel any distance through systems you hold, once a round, so you can bring one across from another front.</li>
      <li><b class="am">Battles</b> are a card game. Each side has hit points (${HP} a ship, plus the system's own) and draws ${C.battle.hand} cards at random from its deck. Each round you play one card, then every ship fires. The first out of hit points loses and falls back with half its ships.</li>
      <li><b class="am">Your deck</b> is made of what you hold: worlds add cards, and so do special sites.</li>
      <li><b class="am">Building is extra.</b> On the front in play you can build a ship at each of your systems, and special sites with that front's own resource, without using up your decision.</li>
      <li><b class="am">Shields</b> mark systems of yours with an enemy fleet beside them: cyan is safe, amber is close, red is likely to fall.</li>
      <li><b class="cy">Win</b> by taking all three enemy homes. <b class="rd2">Lose</b> if ${N.capital} falls, or if two enemies strike it in the same round.</li>
    </ul>
    <button class="plate btn go" data-a="close">TO YOUR POST</button>`);
}
function logModal() {
  modal('<h2>War log</h2><div class="rep">' + g.log.slice(-60).reverse().map(e => `<div class="${e.kind}">R${e.r} · ${esc(e.text)}</div>`).join('') + '</div><button class="plate btn go" data-a="close" style="margin-top:10px">CLOSE</button>');
}
function gameOver() {
  if (!$('modal').hidden) return;
  const s = g.stats, won = g.over.result === 'won';
  modal(`<h2>${won ? 'Total victory' : 'The capital is lost'}</h2><p>${esc(g.over.why)}</p><p class="dim">Round ${g.over.round} · systems taken ${s.taken} · systems fallen ${s.fallen} · defences held ${s.held}</p><button class="plate btn go" data-a="new">NEW WAR</button>`);
}

// ---------- input ----------
// Tap a system: with a fleet picked up, a ringed system becomes an order to confirm. Otherwise the tap picks the
// system up, and its fleet with it if that fleet can still move.
function tapSystem(id) {
  if (busy() || !g.ready()) return;
  const f = myFleet();
  if (f && id != null && ui.dest && ui.dest.has(id)) { ui.pend = { type: ui.dest.get(id) === 'attack' ? 'atk' : 'move', pid: id }; ui.sel = id; return; }
  ui.pend = null;
  if (id == null) { ui.sel = null; ui.fleet = null; ui.open = false; return; }
  const here = g.fleetAt(id, 'fed');
  ui.sel = id; ui.fleet = here && !here.moved ? here.id : null; ui.half = false; ui.tab = 'sys';
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const d = el.dataset;
  switch (d.a) {
    case 'tab': if (ui.open && ui.tab === d.t) ui.open = false; else { ui.tab = d.t; ui.open = true; } break;
    case 'shut': ui.open = false; break;
    case 'info': ui.tab = 'sys'; ui.open = true; break;
    case 'sel': tapSystem(+d.p); ui.open = false; break;
    case 'pick': { const f = g.fleets.find(x => x.id === +d.f); if (f) { tapSystem(f.at); ui.open = false; } break; }
    case 'half': ui.half = !ui.half; break;
    case 'pcancel': ui.pend = null; ui.sel = myFleet() ? myFleet().at : null; break;
    case 'unsel': ui.sel = null; ui.fleet = null; ui.pend = null; break;
    case 'confirm': {
      const f = myFleet(), n = f && ui.half ? Math.ceil(f.ships / 2) : undefined, pd = ui.pend; if (!f || !pd) break;
      ui.mark = g.log.length; ui.fleet = null; ui.pend = null; ui.open = false; ui.sel = pd.pid; ui.fx = null;
      if (pd.type === 'atk') g.attack(f.id, pd.pid, n); else g.moveTo(f.id, pd.pid, n);
      return step();
    }
    case 'hold': ui.mark = g.log.length; ui.fleet = null; ui.pend = null; ui.sel = null; ui.open = false; g.hold(); return step();
    case 'build': g.build(+d.p); break;
    case 'site': g.site(ui.sel, d.k); break;
    case 'bplay': if (g.battle && !g.battle.done && !(ui.fx && ui.fx.t < 0.9)) { const ev = g.battlePlay(d.i == null ? null : +d.i); ui.fx = { ev, t: 0 }; ui.auto = 0; } break;
    case 'bclose': ui.fx = null; ui.mark = Math.min(ui.mark, g.log.length); g.battleClose(); return step();
    case 'cam': view.focus(view.front != null && view.front >= 0 ? -1 : g.fi); break;
    case 'trade': g.trade(d.f, d.t); break;
    case 'dev': g.develop(+d.p); break;
    case 'pol': g.setPolicy(d.k); break;
    case 'prio': g.setPriority(+d.k); break;
    case 'tnext': ui.tut++; break;
    case 'thelp': STEPS[ui.tut].do(g, ui); return step();
    case 'tend': ui.tut = null; break;
    case 'tut': $('modal').hidden = true; try { localStorage.removeItem(SAVE); } catch {} start(SEED, null, true); return;
    case 'zin': view.zoomAt(1.4); return;
    case 'zout': view.zoomAt(1 / 1.4); return;
    case 'help': return help();
    case 'log': return logModal();
    case 'asktut': return modal('<h2>Play the tutorial?</h2><p>It starts a new guided war. The war in progress will be lost.</p><button class="plate btn go" data-a="tut">START THE TUTORIAL</button><button class="plate btn" style="width:100%;margin-top:8px" data-a="close">KEEP PLAYING</button>');
    case 'ask': return modal('<h2>New war?</h2><p>The war in progress will be lost.</p><button class="plate btn go" data-a="new">START A NEW WAR</button><button class="plate btn" style="width:100%;margin-top:8px" data-a="close">KEEP PLAYING</button>');
    case 'close': $('modal').hidden = true; return;
    case 'new': $('modal').hidden = true; try { localStorage.removeItem(SAVE); } catch {} start(); return;
  }
  refresh();
});

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
new ResizeObserver(() => { view.resize(); if (view.front != null) view.focus(view.front); }).observe($('stage'));

// ---------- the clock ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000) * ui.speed; last = now;
  const was = busy(), wasFight = fighting();
  if (ui.anims.length) { for (const a of ui.anims) a.t += dt; ui.anims = ui.anims.filter(a => a.t < 0.6); }
  else if (ui.show) { ui.show.t += dt; if (ui.show.t > (ui.show.arrived ? 2.4 : 1.5)) ui.show = null; }
  if (was !== busy() || wasFight !== fighting()) refresh();
  // in a battle: let the round just played be seen, then let the guns decide once the cards are spent
  if (fighting()) {
    const b = g.battle;
    if (ui.fx) { const before = ui.fx.t < 0.9; ui.fx.t += dt; if (before && ui.fx.t >= 0.9) refresh(); }
    if (!b.done && !b.you.hand.length && (!ui.fx || ui.fx.t >= 0.9)) { ui.auto += dt; if (ui.auto > 0.35) { ui.auto = 0; ui.fx = { ev: g.battlePlay(null), t: 0 }; refresh(); } }
    const fc = $('fc'); if (fc) drawBattle(fc, g, b, ui.fx, now / 1000);
  }
  view.draw(g, ui, now / 1000);
  const sc = $('sys'), p = g.P[ui.sel];
  if (sc && p && sc.offsetParent) { const th = g.threat(p.id); drawPlanet(sc, g, p, { threat: th ? th.hp : 0, enemy: th ? th.f : p.owner, mine: g.shipsAt(p.id, 'fed'), foe: p.owner === 'fed' ? 0 : g.shipsAt(p.id, p.owner) }, now / 1000); }
  requestAnimationFrame(frame);
}

const qs = new URLSearchParams(location.search), seed = +qs.get('seed') || 0;
let saved = null; try { saved = seed || qs.has('tutorial') ? null : JSON.parse(localStorage.getItem(SAVE)); } catch {}
view.resize();
start(seed || (qs.has('tutorial') ? SEED : 0), saved, qs.has('tutorial'));
if (!localStorage.getItem('sgs.seen7') && !seed && !qs.has('tutorial')) {
  try { localStorage.setItem('sgs.seen7', '1'); } catch {}
  modal(`<h2>${N.game}</h2><p>A war of fleets on three fronts, settled by cards. You are ${N.fed} High Command, and three enemies are on their way.</p>
    <p>The tutorial walks you through your first rounds, one step at a time. It takes about three minutes.</p>
    <button class="plate btn go" data-a="tut">PLAY THE TUTORIAL</button><button class="plate btn" style="width:100%;margin-top:8px" data-a="close">SKIP IT, I KNOW HOW TO PLAY</button>`);
}
requestAnimationFrame(frame);
