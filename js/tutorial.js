// The guided first war. Each step says one thing, points at one part of the screen, and waits for the player to do it.
// A step has:
//   text(g, ui)   what the coach says
//   tab           the ministry tab to open when the step begins
//   hi            CSS selector of the thing to outline
//   hint(g)       a star system to ring on the map
//   done(g, ui)   true once the player has done it (the coach moves on by itself)
//   next          show a NEXT button instead of waiting
//   skipIf(g)     leave the step out when it cannot be done
//   help          label of a button that does the step for the player, with do(g, ui)
import { C } from './config.js';

const N = C.names;
const front = g => C.factions.findIndex(f => g.F[f].state === 'active');
const softest = g => { const s = front(g); return s < 0 ? null : g.targets(s).sort((a, b) => g.enemyAt(a) - g.enemyAt(b))[0]; };
const isMission = id => C.cards[id].type === 'mission';
const canAttack = (g, pid) => g.hand.some((id, i) => isMission(id) && g.canPlay(i, pid).ok);
const opOn = g => g.ops.findIndex(o => o && o.cards.length);

export const SEED = 7;
export const STEPS = [
  { next: true, hint: () => 0,
    text: () => `You run the war from <b>${N.capital}</b>, the ringed system in the middle. Every cyan dot is a star system you hold. Three enemies will come in from the edge, one after another. Take all three of their homes and you win.` },
  { next: true, hi: '#hand',
    text: () => 'Along the bottom is your <b>hand</b>: five cards drawn from your deck each round. Cards are how you act. Anything you do not play is discarded and comes back round later.' },
  { hi: '#commit', done: g => g.round >= 2,
    text: () => 'Nothing is happening yet. Press <b>END ROUND</b>.' },
  { next: true, tab: 'int', hi: '.tab[data-t=int]',
    text: g => `<b>${N.factions.swarm}</b> has arrived at the top of the map, in orange. The <b>Ministry of Intelligence</b> shows what just happened and what to do about it. When you are unsure, read SUGGESTED ACTIONS here.` },
  { next: true, tab: 'int', skipIf: g => !g.threats.length, hint: g => g.threats[0] && g.threats[0].to,
    text: () => 'Dashed orange arrows are attacks coming <b>this round</b>. A <b>shield</b> marks each system that needs defending: cyan will hold, amber is even, red will probably fall. Defence is automatic, so a cyan shield needs nothing from you.' },
  { hint: softest, done: (g, ui) => ui.sel != null && g.canTarget(ui.sel), skipIf: g => softest(g) == null,
    help: 'SELECT IT FOR ME', do: (g, ui) => { ui.sel = softest(g); ui.tab = 'sys'; },
    text: () => 'Now attack. Enemy systems you can reach have <b>amber corners</b>. Tap the one with the pulsing ring.' },
  { hi: '#hand .card.t-mission:not(.off)', done: g => opOn(g) >= 0, skipIf: (g, ui) => !(ui.sel != null && g.canTarget(ui.sel) && canAttack(g, ui.sel)),
    help: 'PLAY ONE FOR ME', do: (g, ui) => { const i = g.hand.map((id, k) => (isMission(id) && g.canPlay(k, ui.sel).ok ? g.cardStr(id, ui.sel) : -1)); g.play(i.indexOf(Math.max(...i)), ui.sel); },
    text: (g, ui) => `This is <b>${g.P[ui.sel].name}</b>. GARRISON is how strong the enemy is here. Tap a <b>MISSION</b> card in your hand, then <b>PLAY ON</b>. ${N.factions[g.P[ui.sel].owner]} is weak to ${C.weak[g.P[ui.sel].owner].toUpperCase()}, so those cards count for more: each card shows its strength HERE.` },
  { next: true, tab: 'sys', skipIf: g => opOn(g) < 0, done: g => opOn(g) >= 0 && g.count(opOn(g)) >= 2,
    text: g => { const s = opOn(g); return `Your operation: <b>${Math.round(g.opStrength(s))} against ${Math.round(g.opEnemy(s))}</b>. FAVOURED is good, EVEN is a coin toss, RISKY is not worth it. Add a second mission card if you have one; two is the most for a general attack. RECALL takes the cards back.`; } },
  { tab: 'def', hi: '[data-a=mob]', done: g => !!g.mob, skipIf: g => front(g) < 0 || !g.canPay({ fuel: C.mob.fuel }),
    text: () => 'Bigger attacks need preparing. This is the <b>Ministry of Defence</b>. Press <b>MOBILISE</b>: next round you can launch a major offensive on that front, with four cards at +50%.' },
  { hi: '#commit', done: g => g.phase !== 'plan' || g.round >= 3,
    text: () => 'Your orders are set. Press <b>COMMIT ORDERS</b>. Every battle runs at once.' },
  { hi: '.bat', done: g => g.phase !== 'battle', skipIf: g => g.phase !== 'battle',
    text: () => 'Each battle is a bar. <b>Cyan is you.</b> If the bar ends more than half cyan, you win it. To help one, tap it, then play a FIRE SUPPORT card or press SECONDARY ORDER. Or just watch. SPEED runs it faster.' },
  { next: true, tab: 'int',
    text: () => 'A new round, and a new hand. Intelligence shows the <b>report</b> of what you won and lost. Used cards sit in the DISCARD pile and come round again. If a system fell, a red <b>DISSENT</b> card joined your deck: it does nothing, and the Ministry of Truth removes it.' },
  { tab: 'def', hi: '[data-a=dir][data-m=attack]', done: g => [0, 1, 2].some(s => g.major(s)), skipIf: g => !(g.mob && g.mobReady(g.mob.s)),
    text: () => 'Your front is mobilised. Press <b>LAUNCH MAJOR OFFENSIVE</b>. Then pick a system with amber corners and play up to <b>four</b> mission cards on it.' },
  { next: true, hi: '#tabs',
    text: () => 'The other ministries, when you need them. <b>Prosperity</b>: swap one resource for another (go here when fuel runs short). <b>Expansion</b>: develop a system so it pays more. <b>Truth</b>: lift morale. <b>Humanity</b>: volunteers or conscripts. <b>Employment</b>: back one route. <b>Unity</b>: how the war stands.' },
  { next: true, last: true,
    text: () => `Every round: read Intelligence, play missions on systems with amber corners, mobilise before a big attack, commit. <b>Win</b> by taking all three enemy homes. <b>Lose</b> if ${N.capital} falls, or if two enemies strike it in the same round. The war is yours.` },
];
