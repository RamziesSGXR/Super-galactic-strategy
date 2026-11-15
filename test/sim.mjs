// Plays whole wars with no screen. `npm run sim [games] [maxRounds]`
// Three players: the bot, a bot that never attacks, and nobody at all.
import { Game } from '../js/sim.js';
import { C } from '../js/config.js';
import { botPlan, botBattle } from '../js/bot.js';

const games = +process.argv[2] || 40, maxR = +process.argv[3] || 120;

function play(seed, mode) {
  const g = new Game(seed);
  while (!g.over && g.round <= maxR) {
    if (mode === 'bot') botPlan(g);
    g.endPlan();
    let n = 0;
    while (g.phase === 'battle' && n++ < 2000) { if (mode === 'bot') botBattle(g); g.tick(0.1); }
  }
  return g;
}

for (const mode of ['bot', 'idle']) {
  let won = 0, lost = 0, rounds = 0, dead = [0, 0, 0], st = { taken: 0, fallen: 0, opsWon: 0, opsLost: 0, held: 0 }, why = {};
  for (let s = 1; s <= games; s++) {
    const g = play(s, mode);
    if (g.over?.result === 'won') won++; else if (g.over) { lost++; why[g.over.why.slice(0, 22)] = (why[g.over.why.slice(0, 22)] || 0) + 1; }
    rounds += g.over ? g.over.round : g.round;
    C.factions.forEach((f, i) => { if (g.F[f].state === 'dead') dead[i]++; });
    for (const k in st) st[k] += g.stats[k];
  }
  const avg = k => (st[k] / games).toFixed(1);
  console.log(`${mode.padEnd(5)} won ${won}/${games}  lost ${lost}  unfinished ${games - won - lost}  avg rounds ${(rounds / games).toFixed(1)}`);
  console.log(`      enemies destroyed: swarm ${dead[0]} foundry ${dead[1]} veil ${dead[2]} | per game: ops won ${avg('opsWon')} lost ${avg('opsLost')}, defences held ${avg('held')}, planets fallen ${avg('fallen')}`);
  if (lost) console.log('      losses:', JSON.stringify(why));
}
