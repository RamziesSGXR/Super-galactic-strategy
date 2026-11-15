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
// your fleet on the first front to open, and a system of yours further out for it to move to
const scout = g => g.fleets.find(f => f.owner === 'fed' && g.P[f.at].front === 0);
const outward = g => { const f = scout(g); return f ? g.posts(f).filter(n => g.P[n].front === 0 && g.P[n].ring === 3)[0] : null; };
const yard = g => (g.P.filter(p => g.canBuild(p.id) && p.id).sort((a, b) => (g.fleetAt(b.id, 'fed') ? 1 : 0) - (g.fleetAt(a.id, 'fed') ? 1 : 0) || b.ring - a.ring)[0] || {}).id;

export const SEED = 7;
export const STEPS = [
  { next: true, shut: true, hint: () => 0,
    text: () => `You run the war from <b>${N.capital}</b>, the ringed system in the middle. Around it are three <b>war fronts</b>: east, west and south. An enemy will come down each one. Take all three of their homes, on the outer ring, and you win.` },
  { next: true, shut: true, hint: g => scout(g) && scout(g).at,
    text: () => 'The cyan arrowheads are your <b>fleets</b>, and the number is how many ships. A fleet can travel <b>any distance</b> through systems you hold, along the lanes, once a round.' },
  { shut: true, hint: g => scout(g) && scout(g).at, skipIf: g => !scout(g) || scout(g).moved, done: (g, ui) => scout(g) && ui.fleet === scout(g).id,
    help: 'PICK IT UP FOR ME', do: (g, ui) => { const f = scout(g); ui.fleet = f.id; ui.sel = f.at; },
    text: () => 'Pick a fleet up: <b>tap the ringed system</b> on the eastern front.' },
  { shut: true, hint: outward, skipIf: g => !scout(g) || outward(g) == null, done: (g, ui) => !!ui.pend || g.round >= 2,
    help: 'CHOOSE IT FOR ME', do: (g, ui) => { ui.pend = { type: 'move', pid: outward(g) }; ui.sel = ui.pend.pid; },
    text: () => 'Every ring is somewhere it can go. <b>Cyan</b> is a system of yours: the fleet moves there to defend it. <b>Amber</b> will be an enemy system: the fleet attacks it. Tap the pulsing system to send the fleet <b>outward</b>.' },
  { shut: true, hi: '[data-a=confirm]', skipIf: (g, ui) => !ui.pend, done: g => g.round >= 2,
    text: () => 'Nothing happens until you confirm. Moving a fleet is <b>your one decision</b> for this turn. Press <b>MOVE</b>.' },
  { next: true, shut: true, hint: g => g.F.swarm.home,
    text: () => `<b>${N.factions.swarm}</b> has arrived, in orange, and the map has turned to the <b>eastern front</b>. From now on each round goes front by front. On each front <b>the enemy acts first</b>: it attacks, or brings a fleet closer. Then you make <b>one decision</b>.` },
  { shut: true, hint: yard, skipIf: g => yard(g) == null, done: g => g.P.some(p => p.built),
    help: 'BUILD ONE FOR ME', do: (g, ui) => { ui.sel = yard(g); g.build(ui.sel); },
    text: () => 'Building is <b>extra</b>: it does not use up your decision. Tap the ringed system, then <b>BUILD SHIP</b> in the bar at the bottom. The cost is at the top of the screen.' },
  { shut: true, hi: '#commit', done: g => g.round >= 3 || !!g.battle,
    text: () => 'Now your decision here: <b>attack, defend, or hold</b>. To attack or defend, tap a fleet and then a ring. Nothing is in reach yet, so press <b>HOLD THE EAST</b>.' },
  { next: true, shut: true,
    text: g => (g.battle ? 'This is a <b>battle</b>. ' : 'When fleets meet there is a <b>battle</b>. ') + 'Each side has <b>hit points</b>: 3 for every ship, plus the system\'s own. You draw three cards at random from your deck. Each round you <b>tap one card</b>, then every ship fires. The first side with no hit points loses and falls back with half its ships.' },
  { next: true, shut: true, hi: '#mins',
    text: () => 'The <b>ministries</b> are this row. <b>Intel</b> tells you what needs doing on the front in play. <b>Defence</b> shows your fleets and your battle deck. <b>Expand</b> builds special sites, which add cards nobody else has. <b>Prosper</b> swaps one resource for another.' },
  { next: true, last: true, shut: true,
    text: () => `Each round, front by front: the enemy acts, then you decide. Your deck grows with the worlds you hold. <b>Win</b> by taking all three enemy homes. <b>Lose</b> if ${N.capital} falls, or if two enemies strike it in the same round.` },
];
