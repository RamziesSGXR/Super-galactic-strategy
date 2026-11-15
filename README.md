# Super Galactic Strategy

**Prototype 0.4.1.** Working title of the design: *Four Fronts*.

You are Federation High Command at the capital, Aurelia. Three enemies arrive one after another, each down its own
lanes, and they never fight each other. Hold the centre, then take all three enemy homes.

This is the strategy layer only. It does not connect to the other games yet. Every name, picture and rule here is
original: other games are inspiration, and nothing is borrowed from them.

## Play

Open `index.html` through any web server (`npm start`, then http://localhost:8080). There is nothing to build.
On GitHub Pages, serve the repository root. Add `?seed=7` to replay the same war.

## The idea

A strategic deck-builder. Each round you draw a hand of cards, play missions onto the map, and give the rest of your
orders through the ministries. Then every battle runs at once, the enemies take their turn, and you draw again.

## Tutorial

A first visit offers the tutorial; after that it is under **Unity → TUTORIAL**, or add `?tutorial` to the address.
It is a guided war of about three rounds. A coach above the ministry tabs says one thing at a time, outlines the
button or rings the system it means, and moves on when you have done it. Each step can be done for you or skipped.
The steps are in `js/tutorial.js`.

## Your deck

- You start with 12 cards: 3 Assault, 3 Siege, 2 Sabotage, Reinforce, Fire Support, War Bonds Drive, Fuel Convoy.
- You draw 5 a round (6 at morale 70 or more, 4 under 30). What you do not play is discarded. When the draw pile
  runs out, the discard pile is shuffled and becomes the new draw pile.
- **Tap a card, then tap where to play it.** Mission cards go onto an enemy system in reach. Two make a general
  attack; a mobilised major offensive carries four at +50%.
- **A major victory offers three cards**; you may add one to your deck. (A junction, a strategic location, a major
  offensive that takes its system, holding the capital, destroying an enemy.)
- **A system lost adds a Dissent card.** It does nothing and takes a place in your hand until the Ministry of Truth
  removes it.
- **Relic cards** come from six relic systems, go straight to your hand, and are spent when used.

| Kind | Cards |
|---|---|
| Mission | Assault, Siege, Sabotage, Vanguard Spearhead, Armoured Column, Infiltrators, Orbital Bombardment |
| Order | Reinforce, Fortify |
| Battle | Fire Support, Orbital Blockade, Recall |
| Propaganda | War Bonds Drive, Recruitment Reel, To the Front!, Victory Newsreel |
| Logistics | Fuel Convoy, Conscript Levy |
| Relic | The Home Fleet, General Reserve, The Anthem, Snap Mobilisation, Strategic Reserve, Planetary Shield |

## The ministries

The same ministries as FOB Super Commander. Each is a tab.

| Ministry | What you do there |
|---|---|
| Intelligence | Read the round's report, the suggested actions and what needs defending |
| Defence | Mobilise a front, launch the major offensive, give a Defence Order, recall an operation, use the Secondary Order |
| Prosperity | See stock, orders and next round's income; exchange 3 of one resource for 2 of another |
| Expansion | Develop a system so its worlds pay +50% a level (two levels; lost if the system falls) |
| Truth | Broadcast once a round for morale; remove Dissent cards from the deck |
| Humanity | Volunteers, balanced or conscription: more Vanguard, or Army from every colony at a cost in morale |
| Employment | Pick the priority route: +1.5 defence, +25% output, operations along it cost 1 less fuel |
| Unity | The standing of the war, your deck, the log |

## The map

- Each point is a **star system** of two to four worlds. The worlds pay resources by kind: gas refineries pay fuel,
  forge worlds raise the Army, colonies send Vanguard, fortress worlds add defence.
- **One world per system is the key world**, and it is the only one fought over. Its kind suits one kind of mission.
- **Six routes** lead out of the capital. Three end at an enemy home; the three between are quiet. Two ring lanes
  join the routes further out, so an enemy can go around.
- **Symbols:** a shield marks a system that needs defending (cyan holds, amber is even, red is likely to fall). A
  dashed ring marks a system you are attacking. Dashed arrows are announced enemy attacks.
- **Strategic locations:** shipyards (chevron), fuel depots (square), bastions (double ring), relic systems (amber dot).
- Pinch, scroll or use + and − to zoom, and drag to move.

Rules worth knowing:

- **A system is a gate.** Nobody passes it until it is taken. A system cut off from its capital or home fights at
  half strength and pays nothing.
- **Defence is automatic**, and only for systems you hold. The Army answers if a lane still reaches the system.
- **Pinning.** An operation on the system an attack launches from, at least half as strong as that attack, cancels it.
- **The home is fed by every system its owner holds.** Roll back the branches before going for the trunk.
- **Win:** all three homes taken. **Lose:** the capital falls, or two enemies strike it in the same round.
- The war is saved in the browser at the start of every round.

## The three enemies

| Enemy | Arrives | Behaviour | Weak to | Its deck |
|---|---|---|---|---|
| The Swarm | round 2 | Several small attacks every round | Siege | Feeding Frenzy, Brood Surge, Tunnel Breach |
| The Foundry | about round 7 | Builds up, then one heavy blow at the weakest system | Sabotage | Production Surge, Siege Engines, Iron Line |
| The Veil | about round 12 | Strikes one system behind your line; fighting it costs morale | Assault | Mass Conversion, The Shroud, Dread |

## Marked for change later

The fight for a system is a single bar on its key world, on purpose. It is where the other games would take over: a
space battle to reach the world, a ground battle on it. The hand-off point is marked `HANDOFF` at the top of
`js/sim.js`; a fight needs only its two strengths going in and `win` coming out.

## Code

| File | What it holds |
|---|---|
| `js/config.js` | Every number and every name. Retune or rename here. |
| `js/map.js` | The board: capital, six routes, 37 systems, about 100 worlds |
| `js/sim.js` | All rules, with no screen code (`Game`) |
| `js/view.js` | The galaxy map and the star-system view, drawn on canvases |
| `js/main.js` | The interface |
| `js/tutorial.js` | The tutorial's steps |
| `js/bot.js` | A simple player for testing |

## Checks

- `npm run sim [games]` plays whole wars with no screen: the test bot, then nobody at the controls.
  At 0.4.0, of 100 wars the simple bot wins 68 and loses 28 in about 38 rounds. An undefended Federation falls by
  about round 22.
- `python3 test/tutorial.py` (with `npm start` running) follows the tutorial from the first step to the last.
- `python3 test/ui.py` (with `npm start` running) clicks through two rounds at phone and desktop size: the hand,
  every ministry tab, playing cards onto a system, the battle, zoom, dragging, and that a saved war loads.

## Not built yet

Sound, a reserve setting for the automatic defences, other languages, and any link to the other games.
