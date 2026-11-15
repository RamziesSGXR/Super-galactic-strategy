# Super Galactic Strategy

**Prototype 0.6.0.** Working title of the design: *Four Fronts*.

You are Federation High Command at the capital, Aurelia. Three enemies come at you on three war fronts: the Foundry
in the west, the Swarm in the east, the Veil in the south. You fight each front like its own board game, moving
fleets one system a turn, with a deck of cards to tip the fights. Take all three enemy homes to win.

This is the strategy layer only. It does not connect to the other games yet. Every name, picture and rule here is
original: other games are inspiration, and nothing is borrowed from them.

## Play

Open `index.html` through any web server (`npm start`, then http://localhost:8080). There is nothing to build.
Add `?seed=7` to replay the same war, or `?tutorial` for the guided first rounds (also under **Unity → TUTORIAL**).

## How it plays

- **Fleets are your pieces.** Tap a system where you have a fleet, then tap a neighbouring system. A cyan ring
  moves the fleet there; an amber ring attacks. A fleet moves one system a turn. Fleets in the same system fight
  together, and can be combined or split.
- **One front at a time.** Each round goes west, east, south. On each front you move, your attacks are fought,
  then that enemy moves and its attacks are fought. The strip above the map shows which front is in play.
- **Only you cross fronts.** Enemies keep to their own front and the capital. You can take a fleet from one front
  to the next along the few lanes that cross, or through the capital, one system a turn.
- **Fights.** A ship has strength 3. Your fleets against the system's own defence (2, or more with fortress
  worlds, cards and the priority front) plus any fleet there. The loser falls back to a neighbouring system of its
  own with half its ships, or is lost if it has nowhere to go. The winner loses a few.
- **Build.** Tap one of your systems and build a ship (3 fuel, 3 Army, 2 Vanguard): one per system each round, and
  it can move from the next round. A system whose key world is a refinery, forge or colony builds without fuel,
  Army or Vanguard; a fortress world gains +1 defence per ship built, up to +3.
- **Shields** mark your systems an enemy fleet could strike on its next turn: cyan holds, amber is even, red is
  likely to fall.
- **Win:** all three enemy homes taken. **Lose:** the capital falls, or two enemies strike it in the same round.

## The map

Five rings of systems round the capital, 64 in all, with more systems on each ring going out. Every system has a
lane inward; only some neighbours on a ring are joined, so there are dead ends and gaps, and only a few lanes join
one front to the next. Each system has two to four worlds that pay fuel, Army or Vanguard, and one key world, shown
in full when you open the system. A system cut off from the capital pays nothing and defends at half.

## The deck

You draw 5 cards a round (6 at morale 70 or more, 4 under 30) and may play them on any of your turns that round.
Used cards go to the discard pile and come round again. A major victory offers three cards and you may add one. A
system lost adds a Dissent card, which does nothing until the Ministry of Truth removes it.

| Kind | Played on | Cards |
|---|---|---|
| Boost | one of your fleets | Alpha Strike, Veteran Crews, Forced March, Flanking Orders |
| Trap | one of your systems, hidden until it is attacked | Minefield, Ambush, Decoy |
| Order | one of your systems | Emergency Yard, Fortify |
| Battle | a fight in progress | Fire Support, Orbital Blockade, Recall |
| Propaganda, logistics | nothing | War Bonds Drive, Recruitment Reel, Fuel Convoy, Conscript Levy |
| Relic | varies; spent on use | The Home Fleet, The Flagship, General Reserve, The Anthem, Strategic Reserve, Planetary Shield |

## The ministries

The same ministries as FOB Super Commander, as a fixed row of buttons.

| Ministry | What you do there |
|---|---|
| Intelligence | The round's report, suggested actions, what needs defending, enemy strength |
| Defence | Your fleets by front; the battle list and Secondary Order during a fight |
| Prosperity | Stock and next round's income; exchange 3 of one resource for 2 of another |
| Expansion | Develop a system so its worlds pay +50% a level |
| Truth | Broadcast for morale; remove Dissent cards |
| Humanity | Volunteers, balanced or conscription |
| Employment | The priority front: +1.5 defence, +25% output, ships cost 1 less fuel there |
| Unity | The standing of the war, your deck, the log, the tutorial |

## The three enemies

| Enemy | Front | Arrives | How it plays |
|---|---|---|---|
| The Foundry | West | about round 5 | A few heavy fleets. Waits until it is sure. |
| The Swarm | East | round 2 | Many small fleets. Attacks at even odds. |
| The Veil | South | about round 9 | A system's own defence counts half against it (not the capital's). |

Each builds ships at its home every turn, moves every fleet one system toward you, and holds a deck of three cards.

## Marked for change later

A fight is a single bar on purpose. It is where the other games would take over: a space battle between the fleets,
a ground battle on the key world. The hand-off point is marked `HANDOFF` at the top of `js/sim.js`; a fight needs
only its two strengths going in and `win` coming out.

## Code

| File | What it holds |
|---|---|
| `js/config.js` | Every number and every name. Retune or rename here. |
| `js/map.js` | The board: rings, fronts, lanes |
| `js/sim.js` | All rules, with no screen code (`Game`) |
| `js/view_map.js`, `js/view.js` | The galaxy map with its fleets; one planet in full view |
| `js/main.js` | The interface |
| `js/tutorial.js` | The tutorial's steps |
| `js/bot.js` | A simple player for testing |

## Checks

- `npm run sim [games]` plays whole wars with no screen: the test bot, then nobody at the controls.
  At 0.6.0, of 100 wars the simple bot wins about 6 in 10 in about 30 rounds; every loss is to the Veil.
  An undefended Federation falls by about round 9.
- `python3 test/ui.py` and `python3 test/tutorial.py` (with `npm start` running) play the opening and follow the
  tutorial by tapping the map and the buttons, at phone and desktop size.

## Not built yet

Sound, other languages, and any link to the other games.
