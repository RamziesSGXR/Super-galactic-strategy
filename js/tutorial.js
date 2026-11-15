// The guided first war. Each step says one thing, points at one part of the screen, and waits for the player to do it.
// A step has:
//   text(g, ui)   what the coach says
//   tab           the ministry to open when the step begins;  shut: close any open sheet
//   hi            CSS selector of the thing to outline
//   hint(g, ui)   a star system to ring on the map
//   done(g, ui)   true once the player has done it (the coach moves on by itself)
//   next          show a NEXT button instead of waiting
//   skipIf(g, ui) leave the step out when it cannot be done
//   help          label of a button that does the step for the player, with do(g, ui)
import { C } from './config.js';

const N = C.names;
const east = C.fronts.findIndex(fr => fr.f === 'swarm');   // the first front to open
const ready = (g, f) => f.owner === 'fed' && !f.moved && g.canAct(f.at);
// your fleet on the eastern front, and a system of yours one step further out for it to move to
const scout = g => g.fleets.find(f => f.owner === 'fed' && g.P[f.at].front === east);
const outward = g => { const f = scout(g); return f ? g.P[f.at].adj.filter(n => g.P[n].owner === 'fed' && g.P[n].ring > g.P[f.at].ring)[0] : null; };
const yard = g => (g.P.find(p => p.front === east && p.ring === 1 && g.canBuild(p.id)) || g.P.find(p => g.canBuild(p.id)) || {}).id;
const trapCard = g => g.hand.findIndex(id => C.cards[id].type === 'trap');
const trapSite = g => { const i = trapCard(g); if (i < 0) return null; const ps = g.P.filter(p => g.canPlay(i, { sys: p.id }).ok); return (ps.find(p => g.threat(p.id)) || ps.sort((a, b) => b.ring - a.ring)[0] || {}).id; };
// a fleet of yours that can beat an enemy system beside it
const strike = g => {
  for (const f of g.fleets) if (ready(g, f) && f.order == null) for (const n of g.P[f.at].adj) if (g.P[n].owner !== 'fed' && g.fleetStr(f, true) >= g.garrison(n) * 1.1) return { f, to: n };
  return null;
};
const attacking = g => g.fleets.some(f => f.owner === 'fed' && f.order != null && g.P[f.order].owner !== 'fed');

export const SEED = 7;
export const STEPS = [
  { next: true, shut: true, hint: () => 0,
    text: () => `You run the war from <b>${N.capital}</b>, the ringed system in the middle. Around it are three <b>war fronts</b>: west, east and south. An enemy will come down each one. Take all three of their homes, on the outer ring, and you win.` },
  { next: true, shut: true, hint: g => scout(g) && scout(g).at,
    text: () => 'The cyan arrowheads are your <b>fleets</b>, and the number is how many ships. Fleets are your pieces: a fleet moves <b>one system a turn</b>, along the lanes.' },
  { shut: true, hint: g => scout(g) && scout(g).at, skipIf: g => !scout(g) || !ready(g, scout(g)), done: (g, ui) => scout(g) && ui.fleet === scout(g).id,
    help: 'PICK IT UP FOR ME', do: (g, ui) => { const f = scout(g); ui.fleet = f.id; ui.sel = f.at; },
    text: () => 'Pick a fleet up: <b>tap the ringed system</b> on the eastern front.' },
  { shut: true, hint: outward, skipIf: g => !scout(g) || outward(g) == null, done: g => !scout(g) || scout(g).order != null,
    help: 'MOVE IT FOR ME', do: (g, ui) => { g.order(scout(g).id, outward(g)); ui.fleet = null; },
    text: () => 'The rings show where it can go. <b>Cyan</b> is a system of yours: the fleet moves there and defends it. <b>Amber</b> would be an enemy system: the fleet attacks. Tap the ringed system to send it <b>outward</b>.' },
  { shut: true, hint: yard, skipIf: g => yard(g) == null, done: g => g.P.some(p => p.built),
    help: 'BUILD ONE FOR ME', do: (g, ui) => { ui.sel = yard(g); g.build(ui.sel); },
    text: () => `Now build. Tap the ringed system, then <b>BUILD</b> in the bar above your cards. A ship costs fuel, Army and Vanguard, shown at the top. One ship per system each round; it can move from next round.` },
  { next: true, shut: true, hi: '#hand',
    text: () => 'Your <b>hand</b>: five cards a round. <b>BOOST</b> cards go on a fleet. <b>TRAP</b> cards are laid on your own systems and spring when the enemy attacks there. Tap a card, then tap where to play it.' },
  { shut: true, hi: '#commit', done: g => g.round >= 2,
    text: () => 'That is your turn. Press <b>END TURN</b>: your fleets move.' },
  { next: true, shut: true, hint: g => g.F.swarm.home,
    text: () => `<b>${N.factions.swarm}</b> has arrived in the east, in orange, with fleets of its own. From now on each round goes front by front: <b>you move, then that enemy moves</b>. The strip above the map shows which front is in play.` },
  { next: true, shut: true, skipIf: g => !g.P.some(p => g.threat(p.id)), hint: g => (g.P.find(p => g.threat(p.id)) || {}).id,
    text: () => 'A <b>shield</b> marks a system of yours that an enemy fleet could strike on its next turn: cyan will hold, amber is even, red will probably fall. Move a fleet in or build a ship there to hold it.' },
  { shut: true, hi: '#hand .card.t-trap', hint: trapSite, skipIf: g => trapCard(g) < 0 || trapSite(g) == null, done: g => g.P.some(p => p.trap),
    help: 'LAY IT FOR ME', do: g => g.play(trapCard(g), { sys: trapSite(g) }),
    text: () => 'Lay a trap. Tap the outlined <b>TRAP</b> card, then tap the ringed system. The enemy cannot see it. It springs the next time that system is attacked.' },
  { next: true, shut: true, hint: g => (strike(g) ? strike(g).f.at : null), done: attacking,
    text: g => { const s = strike(g); return s ? `Attack. Tap your fleet at <b>${g.P[s.f.at].name}</b> (the pulsing ring), then tap <b>${g.P[s.to].name}</b>, ringed in amber. Your ${Math.round(g.fleetStr(s.f, true))} against its ${Math.round(g.garrison(s.to))}: the higher number usually wins.`
      : 'To <b>attack</b>, pick a fleet up and tap an enemy system ringed in <b>amber</b> beside it. Your fleet\'s strength is set against the system\'s: the higher number usually wins, and the loser falls back with half its ships. Nothing is in reach yet, so move closer first.'; } },
  { shut: true, hi: '#commit', done: g => g.phase !== 'plan' || g.round >= 3,
    text: () => 'Press <b>END TURN</b>. Your attack is fought, then the enemy on this front takes its move.' },
  { shut: true, done: g => g.phase !== 'battle', skipIf: g => g.phase !== 'battle',
    text: () => 'A fight. The ring round the system fills <b>cyan</b> as you win it. To help, tap the fight on the map, then a <b>BATTLE</b> card in your hand. The loser falls back with half its ships.' },
  { next: true, shut: true, hi: '#mins',
    text: () => 'The <b>ministries</b> are this row. <b>Intel</b> tells you what needs doing. <b>Defence</b> lists your fleets. <b>Prosper</b> swaps one resource for another. <b>Expand</b> makes a system pay more. <b>Truth</b> lifts morale. <b>Employ</b> backs one front.' },
  { next: true, last: true, shut: true,
    text: () => `Each round: on each front, move your fleets, build, play cards, end the turn; then that enemy moves. Only you can take a fleet from one front to another. <b>Win</b> by taking all three enemy homes. <b>Lose</b> if ${N.capital} falls, or if two enemies strike it in the same round.` },
];
