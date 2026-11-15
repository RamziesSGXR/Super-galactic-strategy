// The interface: top strip, the map, and the side panel. All game rules are in sim.js.
import { C, VERSION } from './config.js';
import { Game } from './sim.js';
import { View, drawSystem, sum } from './view.js';

const $ = id => document.getElementById(id), N = C.names;
const KIND = { capital: 'CAPITAL SYSTEM', gate: 'GATE SYSTEM', junction: 'JUNCTION', mid: 'SYSTEM', outer: 'OUTER SYSTEM', frontier: 'FRONTIER SYSTEM', home: 'ENEMY HOME' };
const RES = { fuel: N.fuel, drop: N.drop, army: N.army };
const SAVE = 'sgs.save';
const f1 = v => (Math.round(v * 10) / 10).toString();
const esc = s => String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
const who = o => (o === 'fed' ? N.fed : N.factions[o]);

let g, view = new View($('map'));
const ui = { sel: null, selBattle: null, speed: 1, mark: 0 };
window.sgs = { get g() { return g; }, ui, view };   // for the browser checks

function odds(P, E) {
  const r = P / Math.max(0.01, E);
  return r >= 1.25 ? ['FAVOURED', 'cy'] : r >= 1.08 ? ['EDGE', 'cy'] : r >= 0.93 ? ['EVEN', 'am'] : r >= 0.8 ? ['RISKY', 'rd2'] : ['OUTMATCHED', 'rd2'];
}

function start(seed, saved) {
  g = (saved && Game.load(saved)) || new Game(seed || (Date.now() % 100000));
  ui.sel = null; ui.selBattle = null; ui.mark = Math.max(0, g.log.length - 6);
  view.reset && view.R0 && view.reset();
  refresh();
}
function store() {
  try { if (g.over) localStorage.removeItem(SAVE); else if (g.phase === 'plan') localStorage.setItem(SAVE, JSON.stringify(g.save())); } catch {}
}

// ---------- drawing the DOM ----------
function top() {
  const t = g.totalCost(), plan = g.phase === 'plan';
  const cell = (k, cls) => `<div class="${cls}"><b>${Math.floor(g.res[k])}${plan && t[k] ? `<i>−${f1(t[k])}</i>` : ''}</b><span>${RES[k]}</span></div>`;
  $('top').innerHTML = `<div class="ttl">${N.game}<small>${VERSION}</small></div>
    <div class="rd">ROUND ${g.round} · ${g.phase === 'plan' ? 'PLANNING' : g.phase === 'battle' ? 'BATTLE' : 'WAR OVER'}</div>
    <div class="ro">${cell('fuel', 'a')}${cell('drop', '')}${cell('army', '')}<div><b>${Math.round(g.morale)}</b><span>MORALE</span></div></div>`;
  const last = g.log[g.log.length - 1];
  $('bulletin').className = last.kind; $('bulletin').textContent = `R${last.r} › ${last.text}`;
}

function frontHtml(s) {
  const f = C.factions[s], F = g.F[f], own = g.P.filter(p => p.owner === f).length;
  const st = F.state === 'wait' ? 'QUIET' : F.state === 'warn' ? `SIGNALS · ROUND ${F.at}?` : F.state === 'dead' ? 'DESTROYED' : `${own} SYSTEMS · FORCE ${Math.round(F.force)}`;
  let h = `<div class="front" style="--fc:${C.color[f]}"><div class="fh"><b>${F.state === 'wait' ? 'UNKNOWN SIGNAL ' + (s + 1) : N.factions[f]}</b><span class="sm2 dim">${st}</span></div>`;
  if (F.state !== 'active') return h + '</div>';
  if (F.cards.length) h += `<div class="ln rd2">Holds ${F.cards.length} card${F.cards.length > 1 ? 's' : ''}: plays one next turn.</div>`;
  const ths = g.threats.filter(x => x.s === s);
  if (ths.some(t => t.hidden)) h += '<div class="ln rd2">THE SHROUD: its attacks this round cannot be seen.</div>';
  for (const t of ths) {
    if (t.hidden) continue;
    const D = g.defence(t).D, [w, cl] = odds(D, t.str);
    h += `<button class="ln lk" data-a="sel" data-p="${t.to}">INBOUND › <b>${esc(g.P[t.to].name)}</b> · ${f1(t.str)} vs your ${f1(D)} ` +
      (g.pins(t) ? '<span class="am">PINNED</span>' : `<span class="${cl}">${w}</span>`) + '</button>';
  }
  const o = g.ops[s];
  if (o && g.count(s)) {
    const p = g.P[o.target], fs = g.opFights(s), ok = fs.filter(x => x.P >= x.E * 1.08).length, need = g.need(p);
    h += `<button class="ln lk am" data-a="sel" data-p="${o.target}">${g.major(s) ? 'MAJOR OFFENSIVE' : 'OPERATION'} › <b>${esc(p.name)}</b> · ${fs.length} mission${fs.length > 1 ? 's' : ''}, ${ok} with the edge` +
      (p.owner === 'fed' ? '' : ` · needs ${need} world${need === 1 ? '' : 's'}`) + '</button>';
  } else h += `<div class="ln dim">${g.targets(s).length ? 'No operation. Tap a marked system to plan one.' : 'Nothing in reach.'}</div>`;
  if (g.retal[s]) h += '<div class="ln cy">RETALIATION: this front\'s operation is free and stronger this round.</div>';
  // A major offensive is mobilised first, then launched a round later.
  const d = g.directive, on = m => d && d.sector === s && d.mode === m ? ' on' : '', mob = g.mob && g.mob.s === s ? g.mob : null;
  h += '<div class="row">';
  if (!mob) h += `<button class="plate amber btn sm grow" data-a="mob" data-s="${s}" ${g.res.fuel - g.totalCost().fuel >= C.mob.fuel ? '' : 'disabled'}>MOBILISE · ${C.mob.fuel} FUEL</button>`;
  else if (!g.mobReady(s)) h += '<span class="ln am grow">MOBILISING · offensive ready next round</span>';
  else h += `<button class="plate amber btn sm grow${on('attack')}" data-a="dir" data-s="${s}" data-m="attack">${on('attack') ? 'MAJOR OFFENSIVE: ON' : `LAUNCH MAJOR OFFENSIVE · ${g.mob.until - g.round + 1} ROUND${g.mob.until > g.round ? 'S' : ''} LEFT`}</button>`;
  if (ths.length) h += `<button class="plate amber btn sm grow${on('defend')}" data-a="dir" data-s="${s}" data-m="defend">DEFENCE ORDER</button>`;
  if (d && d.sector === s && g.prop.rally) h += '<span class="ln am">TO THE FRONT! ×2</span>';
  return h + '</div></div>';
}

function systemHtml() {
  const p = g.P[ui.sel]; if (!p) return '';
  const fed = p.owner === 'fed', fl = g.fedLinked(), linked = fed && fl.has(p.id), plan = g.phase === 'plan';
  const s = g.frontOf(p.id), f = s >= 0 ? C.factions[s] : null, o = f && g.ops[s], mine = o && o.target === p.id, can = f && g.canTarget(p.id, f, fl);
  const battle = g.battles.find(b => b.pid === p.id);
  let h = `<section class="plate"><div class="row"><span class="big grow">${esc(p.name)}</span><span class="sm2 dim">${KIND[p.kind]} · ${p.worlds.length} WORLDS</span></div>`;
  h += fed ? `<div class="sm2 cy">${N.fed.toUpperCase()} CONTROLS · DEFENCE ${f1(g.fort(p))}${linked ? '' : ' · <span class="rd2">CUT OFF: pays nothing, defends at half</span>'}</div>`
    : `<div class="sm2" style="color:${C.color[p.owner]}">${N.factions[p.owner].toUpperCase()} CONTROLS · GARRISON ${f1(g.garrison(p.id))}</div>`;
  if (p.trait) h += `<div class="sm2 am">${C.traits[p.trait].name}: ${C.traits[p.trait].text}</div>`;
  if (p.relic) h += `<div class="sm2 am">RELIC: ${C.cards[p.relic].name}. ${fed && linked ? (g.hand.includes(p.relic) ? 'In your hand.' : `Returns to your hand in round ${Math.max(g.round + 1, p.relicAt)}.`) : 'Retake the system to gain it.'}</div>`;
  for (const t of g.threats.filter(x => x.to === p.id && !x.hidden)) { const D = g.defence(t).D; h += `<div class="sm2 rd2">Under attack by ${N.factions[t.f]}: ${f1(t.str)} vs your ${f1(D)} (${odds(D, t.str)[0]}), fought world by world</div>`; }
  const pins = g.threats.filter(t => t.from === p.id && !t.hidden);
  if (pins.length) h += `<div class="sm2 am">${pins.length} attack${pins.length > 1 ? 's launch' : ' launches'} from here. An operation here at least half as strong pins ${pins.length > 1 ? 'them' : 'it'} in place.</div>`;
  h += '<canvas id="sys"></canvas>';
  if (f && plan && !can) h += '<div class="sm2 dim">Out of reach. Take a system next to it first.</div>';
  if (can && plan && !mine) h += `<button class="plate amber btn" style="width:100%;margin-bottom:6px" data-a="op" data-s="${s}" data-p="${p.id}">PLAN OPERATION HERE</button>`;
  if (mine) h += `<div class="sm2 dim" style="margin-bottom:2px">One mission per enemy world, ${g.opCap(s)} at most${g.major(s) ? ' (major offensive)' : ' (general attack)'}. Each world is its own fight. ${N.factions[f]} cannot take <span class="am">${C.missions[C.weak[f]].name}</span>.</div>`;
  const fights = mine ? g.opFights(s) : [], mult = mine ? g.opMult(s) : 1;
  p.worlds.forEach((w, i) => {
    const T = C.worlds[w.type], ft = battle && battle.fights.find(x => x.wi === i), pf = fights.find(x => x.wi === i);
    let sub = `${T.name}${T.res ? ` · +${T.y} ${RES[T.res]}` : T.fort ? ` · +${T.fort} DEFENCE` : ''}`;
    let line = `<span style="color:${C.color[w.owner]}">${who(w.owner).toUpperCase()}</span>`;
    if (ft) line += ` · ${ft.done ? (ft.evac ? 'RECALLED' : ft.win ? 'WON' : 'LOST') : `${f1(ft.P)} vs ${f1(ft.E)}`}`;
    else if (pf) { const [wd, cl] = odds(pf.P, pf.E); line += ` · ${f1(pf.P)} vs ${f1(pf.E)} <span class="${cl}">${wd}</span>`; }
    else if (mine && w.owner === f) line += ` · holds with ${f1(g.enemyOn(p.id, i, f))}`;
    h += `<div class="mis"><div><b style="color:${T.col}">${esc(w.name)}</b> <span class="sm2 dim">${sub}</span><div class="sm2">${line}</div>${ft ? `<div class="bar wb" style="--fc:${C.color[battle.f]}"><i data-bar="${battle.id}-${i}" style="width:${ft.p * 100}%"></i></div>` : ''}</div>`;
    if (mine && w.owner === f) {
      h += '<div class="row">';
      for (const k in C.missions) h += `<button class="plate amber btn sm${o.m[i] === k ? ' on' : ''}" data-a="m" data-s="${s}" data-w="${i}" data-k="${k}" title="${C.missions[k].name}">${C.missions[k].short} ${f1(g.missionStr(p.id, i, k) * mult)}</button>`;
      h += '</div>';
    } else h += '<span></span>';
    h += '</div>';
  });
  if (mine) {
    const need = g.need(p), ok = fights.filter(x => x.P >= x.E * 1.08).length;
    const notes = [`reach ×${f1(1 - C.reach * (p.ring - 1))}`, g.near(p.id, 'shipyard', fl) && 'shipyard ×1.15', g.near(p.id, 'depot', fl) && 'depot −2 fuel', g.major(s) && `offensive ×${g.dirBoost()}`].filter(Boolean).join(' · ');
    const goal = p.owner === 'fed' ? 'Clears the enemy out of your system.' : fights.length >= need ? `Win ${need} of these ${fights.length} and the system is yours.` : `The system needs ${need} worlds. Fewer leaves a foothold that is overrun in ${C.footholdRounds} rounds.`;
    h += `<div class="sm2 dim" style="padding-top:4px">ASLT ${C.missions.assault.drop} ${N.drop} · SIEGE ${C.missions.siege.army} ${N.army} · SABO ${C.missions.sabotage.drop} ${N.drop} + ${C.missions.sabotage.army} ${N.army}</div>
      <div class="mis"><div><b>${fights.length} MISSION${fights.length === 1 ? '' : 'S'} · ${ok} WITH THE EDGE</b><div class="sm2 ${fights.length >= need && ok >= need ? 'cy' : 'am'}">${goal}</div><div class="sm2 dim">${g.retal[s] ? 'Free: retaliation' : `Fuel ${f1(g.fuelFor(p.id))}`} · ${notes}</div></div>
      <button class="plate btn sm" data-a="op" data-s="${s}">CANCEL</button></div>`;
  }
  return h + '</section>';
}

function handHtml() {
  if (!g.hand.length) return '';
  let h = '<section><h3>Cards</h3><div class="hand">';
  const target = g.phase === 'battle' ? ui.selBattle : ui.sel;
  g.hand.forEach((id, i) => {
    const c = C.cards[id], ok = g.cardOk(id, target);
    const hint = c.when !== g.phase ? (c.when === 'battle' ? ' (in battle)' : ' (when planning)') : ok ? '' : c.needs === 'planet' ? ' Select a system you control.' : c.needs === 'front' ? ' Select an enemy system.' : c.needs ? ' Set the order first.' : '';
    h += `<button class="plate amber card" data-a="card" data-i="${i}" ${ok ? '' : 'disabled'}><em>${c.kind}</em><b>${c.name}</b><span>${c.text}${hint}</span></button>`;
  });
  return h + '</div></section>';
}

function panel() {
  let h = '';
  if (g.phase === 'plan') {
    const rep = g.log.slice(ui.mark);
    if (rep.length) h += '<section class="rep"><h3>Report</h3>' + rep.slice(-8).map(e => `<div class="${e.kind}">${esc(e.text)}</div>`).join('') + '</section>';
    h += systemHtml();
    h += '<section><h3>Fronts</h3>' + [0, 1, 2].map(frontHtml).join('') + '</section>';
    h += handHtml();
    const n = [0, 1, 2].filter(s => g.count(s)).length;
    h += `<button class="plate btn go" data-a="commit">${n || g.threats.length ? 'COMMIT ORDERS' : 'END ROUND'}</button>
      <div class="row"><button class="plate btn sm grow" data-a="help">HOW TO PLAY</button><button class="plate btn sm grow" data-a="log">WAR LOG</button><button class="plate btn sm grow" data-a="ask">NEW WAR</button></div>`;
  } else if (g.phase === 'battle') {
    h += '<section><h3>Battles · tap one, then play a card</h3>';
    for (const b of g.battles) {
      const p = g.P[b.pid], st = sum(b);
      h += `<button class="plate btn bat${ui.selBattle === b.id ? ' on' : ''}" data-a="bsel" data-b="${b.id}" style="--fc:${C.color[b.f]}">
        <div class="row"><span class="grow">${b.kind === 'op' ? 'ATTACK' : 'DEFEND'} ${esc(p.name)}</span><span class="sm2 dim">${st.open ? `${f1(st.P)} vs ${f1(st.E)}` : `${st.won}/${st.n} ${b.kind === 'op' ? 'WON' : 'HELD'}`}</span></div>
        <div class="row fts">${b.fights.map(ft => `<div class="bar"><i data-bar="${b.id}-${ft.wi}" style="width:${ft.p * 100}%"></i></div>`).join('')}</div></button>`;
    }
    h += `</section><div class="row"><button class="plate amber btn grow" data-a="sec" ${g.secondary && g.battles.some(b => b.id === ui.selBattle && sum(b).open) ? '' : 'disabled'}>SECONDARY ORDER +${C.secondary}</button>
      <button class="plate btn" data-a="speed">SPEED ×${ui.speed}</button></div>`;
    h += handHtml();
    h += systemHtml();
  }
  $('panel').innerHTML = h;
}

function refresh() { top(); panel(); store(); if (g.over) gameOver(); }

function modal(html) { $('modal').innerHTML = `<div class="plate amber box">${html}</div>`; $('modal').hidden = false; }
function help() {
  modal(`<h2>${N.game}</h2>
    <p>You are ${N.fed} High Command at ${N.capital}. Three enemies are coming, one after another. They never fight each other.</p>
    <ul>
      <li><b class="am">Systems and worlds.</b> Each point on the map is a star system. Tap one to see its worlds: refineries pay fuel, forges raise the Army, colonies send Vanguard, fortress worlds defend. Whoever holds more than half the worlds controls the system. Pinch, scroll or use + and − to zoom; drag to move.</li>
      <li><b class="am">Plan.</b> Tap a marked system and give its enemy worlds missions. Each world is its own fight. A general attack carries two missions. Each enemy has one mission it cannot take, and each kind of world suits one.</li>
      <li><b class="am">Mobilise.</b> A major offensive carries up to four missions at +50%. Mobilise a front this round, launch next round. Or give a Defence Order where an attack is coming.</li>
      <li><b class="am">Footholds.</b> Worlds you take without winning the system are overrun after ${C.footholdRounds} rounds. Follow up or lose them.</li>
      <li><b class="am">Strategic locations.</b> Shipyards (chevron), fuel depots (square), bastions (double ring) and relic systems (amber dot, a rare card every ${C.relic.every} rounds) help whoever holds them.</li>
      <li><b class="am">Defence is automatic.</b> Dashed arrows show where the enemy strikes next. The Army answers if a lane still reaches the system.</li>
      <li><b class="am">Battles are live.</b> Tap a battle, then spend a card or your one Secondary Order.</li>
      <li><b class="cy">Win</b> by taking all three enemy homes. <b class="rd2">Lose</b> if ${N.capital} falls, or if two enemies strike it in the same round.</li>
    </ul>
    <p class="dim">The war is saved in this browser at the start of every round.</p>
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
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const d = el.dataset, s = +d.s;
  switch (d.a) {
    case 'op': g.setTarget(s, d.p == null ? null : +d.p); break;
    case 'm': g.setMission(s, +d.w, d.k); break;
    case 'mob': g.mobilise(s); break;
    case 'dir': g.setDirective(s, d.m); break;
    case 'sel': ui.sel = +d.p; break;
    case 'card': g.playCard(+d.i, g.phase === 'battle' ? ui.selBattle : ui.sel); break;
    case 'sec': g.useSecondary(ui.selBattle); break;
    case 'bsel': ui.selBattle = +d.b; ui.sel = g.battles.find(b => b.id === ui.selBattle)?.pid ?? ui.sel; break;
    case 'speed': ui.speed = ui.speed === 1 ? 3 : 1; break;
    case 'commit': {
      ui.mark = g.log.length; g.endPlan();
      const worst = [...g.battles].sort((a, b) => { const x = sum(a), y = sum(b); return x.P / x.E - y.P / y.E; })[0];
      ui.selBattle = worst ? worst.id : null; if (worst) ui.sel = worst.pid;
      break;
    }
    case 'zin': view.zoomAt(1.5); return;
    case 'zout': view.zoomAt(1 / 1.5); return;
    case 'help': return help();
    case 'log': return logModal();
    case 'ask': return modal('<h2>New war?</h2><p>The war in progress will be lost.</p><button class="plate btn go" data-a="new">START A NEW WAR</button><button class="plate btn" style="width:100%;margin-top:8px" data-a="close">KEEP PLAYING</button>');
    case 'close': $('modal').hidden = true; return;
    case 'new': $('modal').hidden = true; try { localStorage.removeItem(SAVE); } catch {} start(); return;
  }
  refresh();
});

// The map: tap to select, drag to move, pinch or scroll to zoom.
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
  ui.sel = view.pick(g, x, y);
  const b = ui.sel != null && g.battles.find(q => q.pid === ui.sel); if (b) ui.selBattle = b.id;
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
    if (g.phase !== ph) { ui.selBattle = null; refresh(); }
    else {
      for (const b of g.battles) for (const ft of b.fights) for (const bar of document.querySelectorAll(`[data-bar="${b.id}-${ft.wi}"]`)) bar.style.width = ft.p * 100 + '%';
      if ((slow += dt) > 0.5) { slow = 0; panel(); }
    }
  }
  view.draw(g, ui, now / 1000);
  const sc = $('sys'), p = g.P[ui.sel];
  if (sc && p) { const s = g.frontOf(p.id), o = s >= 0 && g.ops[s]; drawSystem(sc, g, p, o && o.target === p.id ? o.m : null, g.battles.find(b => b.pid === p.id), now / 1000); }
  requestAnimationFrame(frame);
}

const seed = +new URLSearchParams(location.search).get('seed') || 0;
let saved = null; try { saved = seed ? null : JSON.parse(localStorage.getItem(SAVE)); } catch {}
start(seed, saved);
view.resize();
if (!localStorage.getItem('sgs.seen')) { help(); try { localStorage.setItem('sgs.seen', '1'); } catch {} }
requestAnimationFrame(frame);
