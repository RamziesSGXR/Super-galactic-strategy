// Plays whole wars with no screen. `npm run sim [games] [maxRounds]`
// Two players: the test bot, and nobody at all (who holds on every front and plays no cards).
import { Game } from '../js/sim.js';
import { C } from '../js/config.js';
import { botDecide, botCard } from '../js/bot.js';

const games = +process.argv[2] || 40, maxR = +process.argv[3] || 120;

export function play(seed, mode, rounds = maxR) {
  const g = new Game(seed);
  let guard = 0;
  while (!g.over && g.round <= rounds && guard++ < 200000) {
    if (g.battle) { if (g.battle.done) g.battleClose(); else g.battlePlay(mode === 'bot' ? botCard(g) : null); }
    else if (mode === 'bot') botDecide(g); else g.hold();
  }
  return g;
}

if ((process.argv[1] || '').endsWith('sim.mjs')) for (const mode of ['bot', 'idle']) {
  let won = 0, lost = 0, rounds = 0, dead = [0, 0, 0], st = { taken: 0, fallen: 0, held: 0, repelled: 0 }, why = {}, ships = 0, sites = 0;
  for (let s = 1; s <= games; s++) {
    const g = play(s, mode);
    if (g.over?.result === 'won') won++; else if (g.over) { lost++; const k = g.over.why.slice(0, 24); why[k] = (why[k] || 0) + 1; }
    rounds += g.over ? g.over.round : g.round;
    C.factions.forEach((f, i) => { if (g.F[f].state === 'dead') dead[i]++; });
    for (const k in st) st[k] += g.stats[k];
    ships += g.fleets.filter(f => f.owner === 'fed').reduce((a, f) => a + f.ships, 0); sites += g.P.filter(p => p.site).length;
  }
  const avg = k => (st[k] / games).toFixed(1);
  console.log(`${mode.padEnd(5)} won ${won}/${games}  lost ${lost}  undecided ${games - won - lost}  avg rounds ${(rounds / games).toFixed(1)}`);
  console.log(`      enemies destroyed: ${C.factions.map((f, i) => f + ' ' + dead[i]).join(' ')} | per game: systems taken ${avg('taken')}, attacks beaten off ${avg('repelled')}, defences held ${avg('held')}, systems fallen ${avg('fallen')}, ships at the end ${(ships / games).toFixed(1)}, sites ${(sites / games).toFixed(1)}`);
  if (lost) console.log('      losses:', JSON.stringify(why));
}
