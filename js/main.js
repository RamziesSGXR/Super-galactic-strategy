// The interface: top strip, the map, and the side panel. All game rules are in sim.js.
import { C, VERSION } from './config.js';
import { Game } from './sim.js';
import { View } from './view.js';

const $ = id => document.getElementById(id), N = C.names;
const KIND = { capital: 'CAPITAL', gate: 'GATE WORLD', junction: 'JUNCTION', mid: 'WORLD', staging: 'STAGING WORLD', home: 'ENEMY HOME' };
const RES = { fuel: N.fuel, drop: N.drop, army: N.army };
const f1 = v => (Math.round(v * 10) / 10).toString();
const esc = s => String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));

let g, view = new View($('map'));
const ui = { sel: null, selBattle: null, speed: 1, mark: 0 };
window.sgs = { get g() { return g; }, ui };   // for the browser checks

function odds(P, E) {
  const r = P / Math.max(0.01, E);
  return r >= 1.25 ? ['FAVOURED', 'cy'] : r >= 1.08 ? ['EDGE', 'cy'] : r >= 0.93 ? ['EVEN', 'am'] : r >= 0.8 ? ['RISKY', 'rd2'] : ['OUTMATCHED', 'rd2'];
}

function start(seed) {
  g = new Game(seed || (Date.now() % 100000));
  ui.sel = null; ui.selBattle = null; ui.mark = 0;
  refresh();
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
  const st = F.state === 'wait' ? 'QUIET' : F.state === 'warn' ? `SIGNALS · ROUND ${F.at}?` : F.state === 'dead' ? 'DESTROYED' : `${own} WORLDS · FORCE ${Math.round(F.force)}`;
  let h = `<div class="front" style="--fc:${C.color[f]}"><div class="fh"><b>${F.state === 'wait' ? 'SECTOR ' + (s + 1) : N.factions[f]}</b><span class="sm2 dim">${st}</span></div>`;
  if (F.state !== 'active') return h + '</div>';
  for (const t of g.threats.filter(x => x.s === s)) {
    const pinned = g.ops.some((o, i) => o && o.target === t.from && g.count(i));
    const D = g.defence(t).D, [w, cl] = odds(D, t.str);
    h += `<div class="ln">INBOUND › <b>${esc(g.P[t.to].name)}</b> · ${f1(t.str)} vs your ${f1(D)} ` +
      (pinned ? '<span class="am">PINNED</span>' : `<span class="${cl}">${w}</span>`) + '</div>';
  }
  const o = g.ops[s];
  if (o && g.count(s)) { const [w, cl] = odds(g.opStrength(s), g.enemyAt(o.target)); h += `<div class="ln am">OPERATION › <b>${esc(g.P[o.target].name)}</b> · ${f1(g.opStrength(s))} vs ${f1(g.enemyAt(o.target))} <span class="${cl}">${w}</span></div>`; }
  else h += `<div class="ln dim">${g.targets(s).length ? 'No operation. Tap a marked world to plan one.' : 'Nothing in reach.'}</div>`;
  if (g.retal[s]) h += '<div class="ln cy">RETALIATION: this front\'s operation is free and stronger this round.</div>';
  const d = g.directive, on = m => d && d.sector === s && d.mode === m ? ' on' : '';
  h += `<div class="row"><button class="plate amber btn sm grow${on('attack')}" data-a="dir" data-s="${s}" data-m="attack">DIRECTIVE: ATTACK</button>
    <button class="plate amber btn sm grow${on('defend')}" data-a="dir" data-s="${s}" data-m="defend">DIRECTIVE: DEFEND</button></div></div>`;
  return h;
}

function planetHtml() {
  const p = g.P[ui.sel]; if (!p) return '';
  const fed = p.owner === 'fed', linked = fed && g.fedLinked().has(p.id);
  let h = `<section class="plate"><div class="row"><span class="big grow">${esc(p.name)}</span><span class="sm2 dim">${KIND[p.kind]}</span></div>`;
  if (fed) {
    const y = p.id === 0 ? Object.entries(C.capitalYield).map(([k, v]) => `+${v} ${RES[k]}`).join(' · ') : `+${C.yield[p.kind]} ${RES[C.sectorRes[p.sector]]}`;
    h += `<div class="sm2 cy">${N.fed.toUpperCase()} · DEFENCE ${f1(p.fort)}</div><div class="sm2 dim">${linked ? y + ' each round' : 'CUT OFF: pays nothing and defends at half strength'}</div>`;
    for (const t of g.threats.filter(x => x.to === p.id)) { const D = g.defence(t).D; h += `<div class="sm2 rd2">Under attack by ${N.factions[t.f]}: ${f1(t.str)} vs your ${f1(D)} (${odds(D, t.str)[0]})</div>`; }
    return h + '</section>';
  }
  const f = p.owner, s = p.sector, o = g.ops[s], mine = o && o.target === p.id, can = g.canTarget(p.id);
  h += `<div class="sm2" style="color:${C.color[f]}">${N.factions[f].toUpperCase()} · GARRISON ${f1(g.garrison(p.id))}</div>`;
  const pins = g.threats.filter(t => t.from === p.id).length;
  if (pins) h += `<div class="sm2 am">${pins} attack${pins > 1 ? 's launch' : ' launches'} from here. An operation here pins ${pins > 1 ? 'them' : 'it'} in place.</div>`;
  if (g.phase !== 'plan') return h + '</section>';
  if (!can) return h + '<div class="sm2 dim">Out of reach. Take a world next to it first.</div></section>';
  if (!mine) return h + `<div class="row" style="margin-top:8px"><button class="plate amber btn grow" data-a="op" data-s="${s}" data-p="${p.id}">PLAN OPERATION HERE</button></div></section>`;
  h += `<div class="sm2 dim" style="margin:6px 0 2px">Choose the missions. ${N.factions[f]} cannot take <span class="am">${C.missions[C.weak[f]].name}</span>.</div>`;
  for (const k in C.missions) {
    const m = C.missions[k], weak = C.weak[f] === k, cost = [m.drop && `${m.drop} ${N.drop}`, m.army && `${m.army} ${N.army}`].filter(Boolean).join(' + ');
    h += `<div class="mis"><div><b class="${weak ? 'am' : ''}">${m.name}</b> <span class="sm2 dim">+${f1(m.str * (weak ? C.weakMult : 1))}${weak ? ' WEAK POINT' : ''} · ${cost}</span></div>
      <div class="row"><button class="plate amber btn sm" data-a="m" data-s="${s}" data-k="${k}" data-d="-1">−</button><span class="n">${o.m[k]}</span>
      <button class="plate amber btn sm" data-a="m" data-s="${s}" data-k="${k}" data-d="1">+</button></div></div>`;
  }
  const P = g.opStrength(s), E = g.enemyAt(p.id), c = g.cost(s), [w, cl] = odds(P, E);
  h += `<div class="mis"><div><b>STRENGTH ${f1(P)} vs ${f1(E)}</b> <span class="${cl}">${g.count(s) ? w : ''}</span><div class="sm2 dim">${g.retal[s] ? 'Free: retaliation' : `Fuel ${f1(c.fuel || C.op.fuel + C.op.fuelRing * p.ring)} · reach ×${f1(1 - C.reach * (p.ring - 1))}`}</div></div>
    <button class="plate btn sm" data-a="op" data-s="${s}">CANCEL</button></div></section>`;
  return h;
}

function handHtml() {
  if (!g.hand.length) return '';
  let h = '<section><h3>Cards</h3><div class="hand">';
  g.hand.forEach((id, i) => {
    const c = C.cards[id]; let ok = c.when === g.phase;
    if (ok && c.planet) ok = ui.sel != null && g.P[ui.sel].owner === 'fed';
    if (ok && c.when === 'battle') ok = g.battles.some(b => b.id === ui.selBattle && !b.done && (id !== 'evac' || b.kind === 'op'));
    h += `<button class="plate amber card" data-a="card" data-i="${i}" ${ok ? '' : 'disabled'}><b>${c.name}</b><span>${c.text} ${c.when === 'battle' ? '(in battle)' : ''}</span></button>`;
  });
  return h + '</div></section>';
}

function panel() {
  let h = '';
  if (g.phase === 'plan') {
    const rep = g.log.slice(ui.mark);
    if (rep.length) h += '<section class="rep"><h3>Report</h3>' + rep.slice(-7).map(e => `<div class="${e.kind}">${esc(e.text)}</div>`).join('') + '</section>';
    h += planetHtml();
    h += '<section><h3>Fronts</h3>' + [0, 1, 2].map(frontHtml).join('') + '</section>';
    h += handHtml();
    const n = [0, 1, 2].filter(s => g.count(s)).length;
    h += `<button class="plate btn go" data-a="commit">${n || g.threats.length ? 'COMMIT ORDERS' : 'END ROUND'}</button>
      <div class="row"><button class="plate btn sm grow" data-a="help">HOW TO PLAY</button><button class="plate btn sm grow" data-a="log">WAR LOG</button><button class="plate btn sm grow" data-a="new">NEW WAR</button></div>`;
  } else if (g.phase === 'battle') {
    h += '<section><h3>Battles · tap one, then play a card</h3>';
    for (const b of g.battles) {
      const p = g.P[b.pid], st = b.done ? (b.evac ? 'RECALLED' : b.win ? 'WON' : 'LOST') : `${f1(b.P)} vs ${f1(b.E)}`;
      h += `<button class="plate btn bat${ui.selBattle === b.id ? ' on' : ''}" data-a="bsel" data-b="${b.id}" style="--fc:${C.color[b.f]}">
        <div class="row"><span class="grow">${b.kind === 'op' ? 'ATTACK' : 'DEFEND'} ${esc(p.name)}</span><span class="sm2 dim" data-st="${b.id}">${st}</span></div>
        <div class="bar"><i data-bar="${b.id}" style="width:${b.p * 100}%"></i></div></button>`;
    }
    h += `</section><div class="row"><button class="plate amber btn grow" data-a="sec" ${g.secondary && g.battles.some(b => b.id === ui.selBattle && !b.done) ? '' : 'disabled'}>SECONDARY ORDER +${C.secondary}</button>
      <button class="plate btn" data-a="speed">SPEED ×${ui.speed}</button></div>`;
    h += handHtml();
  }
  $('panel').innerHTML = h;
}

function refresh() { top(); panel(); if (g.over) gameOver(); }

function modal(html) { $('modal').innerHTML = `<div class="plate amber box">${html}</div>`; $('modal').hidden = false; }
function help() {
  modal(`<h2>${N.game}</h2>
    <p>You are ${N.fed} High Command at ${N.capital}. Three enemies are coming, one after another, each down its own lanes. They never fight each other.</p>
    <ul>
      <li><b class="am">Plan.</b> Tap a marked enemy world and choose the missions for an operation: one per front. Each enemy has one mission it cannot take.</li>
      <li><b class="am">Directive.</b> One front gets your full weight, to attack or to defend. The other fronts pay for it.</li>
      <li><b class="am">Defence is automatic.</b> Dashed arrows show where the enemy strikes next. The Army answers if a lane still reaches the world.</li>
      <li><b class="am">Battles are live.</b> Tap a battle, then spend a card or your one Secondary Order.</li>
      <li><b class="am">A world is a gate.</b> Nobody passes it until it is taken. A world cut off from home fights at half strength.</li>
      <li><b class="cy">Win</b> by taking all three enemy homes. <b class="rd2">Lose</b> if ${N.capital} falls, or if two enemies strike it in the same round.</li>
    </ul>
    <button class="plate btn go" data-a="close">TO YOUR POST</button>`);
}
function logModal() {
  modal('<h2>War log</h2><div class="rep">' + g.log.slice(-60).reverse().map(e => `<div class="${e.kind}">R${e.r} · ${esc(e.text)}</div>`).join('') +
    '</div><button class="plate btn go" data-a="close" style="margin-top:10px">CLOSE</button>');
}
function gameOver() {
  const s = g.stats, won = g.over.result === 'won';
  modal(`<h2>${won ? 'Total victory' : 'The capital is lost'}</h2><p>${esc(g.over.why)}</p>
    <p class="dim">Round ${g.over.round} · worlds retaken ${s.taken} · worlds fallen ${s.fallen} · defences held ${s.held}</p>
    <button class="plate btn go" data-a="new">NEW WAR</button>`);
}

// ---------- input ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const d = el.dataset, s = +d.s;
  switch (d.a) {
    case 'op': g.setTarget(s, d.p == null ? null : +d.p); break;
    case 'm': g.addMission(s, d.k, +d.d); break;
    case 'dir': g.setDirective(s, d.m); break;
    case 'card': { const c = C.cards[g.hand[+d.i]]; g.playCard(+d.i, c.when === 'battle' ? ui.selBattle : ui.sel); break; }
    case 'sec': g.useSecondary(ui.selBattle); break;
    case 'bsel': ui.selBattle = +d.b; ui.sel = g.battles.find(b => b.id === ui.selBattle)?.pid ?? ui.sel; break;
    case 'speed': ui.speed = ui.speed === 1 ? 3 : 1; break;
    case 'commit':
      ui.mark = g.log.length; g.endPlan();
      ui.selBattle = g.battles.length ? [...g.battles].sort((a, b) => a.P / a.E - b.P / b.E)[0].id : null;
      break;
    case 'help': return help();
    case 'log': return logModal();
    case 'close': $('modal').hidden = true; return;
    case 'new': $('modal').hidden = true; start(); return;
  }
  refresh();
});
$('map').addEventListener('pointerdown', e => {
  const r = $('map').getBoundingClientRect(), id = view.pick(g, e.clientX - r.left, e.clientY - r.top);
  ui.sel = id;
  const b = id != null && g.battles.find(x => x.pid === id); if (b) ui.selBattle = b.id;
  refresh();
});
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
      for (const b of g.battles) {
        const bar = document.querySelector(`[data-bar="${b.id}"]`); if (bar) bar.style.width = b.p * 100 + '%';
      }
      if ((slow += dt) > 0.4) { slow = 0; panel(); }
    }
  }
  view.draw(g, ui, now / 1000);
  requestAnimationFrame(frame);
}

start(+new URLSearchParams(location.search).get('seed') || 0);
view.resize();
if (!localStorage.getItem('sgs.seen')) { help(); try { localStorage.setItem('sgs.seen', '1'); } catch {} }
requestAnimationFrame(frame);
