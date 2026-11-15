# Super Galactic Strategy

**Prototype 0.3.0.** Working title of the design: *Four Fronts*.

You are Federation High Command at the capital, Aurelia. Three enemies arrive one after another, each down its own
lanes, and they never fight each other. Hold the centre, then take all three enemy homes.

This is the strategy layer only. It does not connect to the other games yet. Every name, picture and rule here is
original: other games are inspiration, and nothing is borrowed from them.

## Play

Open `index.html` through any web server (`npm start`, then http://localhost:8080). There is nothing to build.
On GitHub Pages, serve the repository root. Add `?seed=7` to replay the same war.

## The map

- Each point is a **star system** holding two to four **worlds**. Tap a system to see them. Pinch, scroll or use the
  + and − buttons to zoom, and drag to move.
- Worlds have kinds: gas refineries pay fuel, forge worlds raise the Army, colonies send Vanguard, fortress worlds
  add defence, barren worlds give nothing.
- **Each world has its own holder.** Whoever holds more than half the worlds controls the system. On a tie, control
  stays where it was.
- **Six routes** lead out of the capital. Three end at an enemy home; the three between are quiet. Two ring lanes
  join the routes further out, so an enemy can go around a route you hold.
- **Strategic locations:** shipyards (operations next door +15%), fuel depots (operations next door cost 2 less
  fuel), bastions (+3 defence), and six **relic systems** that each return one rare card to your hand every 9 rounds.

## How a round works

1. **Plan.** Tap a marked system and give its enemy worlds missions, one per world. One operation per front.
   Each enemy has one mission it cannot take (Siege for the Swarm, Sabotage for the Foundry, Assault for the Veil),
   and each kind of world suits one mission.
2. **General attack or major offensive.** A general attack carries two missions. A major offensive carries up to
   four at +50%, but the front must be **mobilised** first: pay 2 fuel this round, launch in one of the next two.
3. **Defence is automatic**, and only for systems you control. Dashed arrows show where each enemy will strike. The
   Army answers if a lane still reaches the system. A Defence Order adds +50% on one front under attack.
4. **Battle, live.** Every world is its own fight, and all of them run at once. Tap a battle, then play a card or
   your one Secondary Order.
5. **The enemies' turn.** Each plays a card if it holds one, grows, announces its next attacks, and you collect
   from the worlds you hold in systems still linked to the capital.

Rules worth knowing:

- **A system is a gate.** Nobody passes it until it is taken. A system cut off from its capital or home fights at
  half strength and pays nothing.
- **Footholds.** Worlds you take without winning the system are overrun after 2 rounds. Follow up or lose them.
  Enemy worlds inside a system you still control stay until you clear them.
- **Pinning.** An operation on the system an attack launches from, at least half as strong as that attack, cancels
  it. This is the answer to a strike on the capital.
- **The home is fed by every system its owner controls.** Roll back the branches before going for the trunk.
- **Win:** all three homes taken. **Lose:** the capital falls, or two enemies strike it in the same round.
- Surviving a strike on the capital makes that front's next operation free and stronger (retaliation).
- The war is saved in the browser at the start of every round.

## Cards

Used once. A major victory draws one; a relic system gives its own.

| Kind | Cards |
|---|---|
| Battle | Fire Support Grant, Orbital Blockade, Recall |
| Mission | Fuel Convoy, Fortify |
| Propaganda | War Bonds Drive, Recruitment Reel, To the Front! (your offensive or defence order counts double), Victory Newsreel (a bonus if the offensive takes its system) |
| Relic | The Home Fleet, General Levy, The Anthem, Snap Mobilisation, Strategic Reserve, Planetary Shield |

A major loss (a gate, a junction, a relic system, or a failed major offensive) gives that enemy a card from its own
deck of three, which it plays on its next turn.

## The three enemies

| Enemy | Arrives | Behaviour | Fighting it | Its deck |
|---|---|---|---|---|
| The Swarm | round 2 | Several small attacks every round | Its route is rich in fuel | Feeding Frenzy, Brood Surge, Tunnel Breach |
| The Foundry | about round 7 | Builds up, then one heavy blow at the weakest system | Each system retaken pays Army | Production Surge, Siege Engines, Iron Line |
| The Veil | about round 12 | Strikes one system behind your line | Every operation costs morale | Mass Conversion, The Shroud, Dread |

## Marked for change later

The fight on each world is a single bar on purpose. It is where the other games would take over: a space battle to
reach a world, a ground battle on it. The hand-off point is marked `HANDOFF` at the top of `js/sim.js`; a fight
needs only its two strengths going in and `win` coming out.

## Code

| File | What it holds |
|---|---|
| `js/config.js` | Every number and every name. Retune or rename here. |
| `js/map.js` | The board: capital, six routes, 37 systems, about 100 worlds |
| `js/sim.js` | All rules, with no screen code (`Game`) |
| `js/view.js` | The galaxy map and the star-system view, drawn on canvases |
| `js/main.js` | The interface |
| `js/bot.js` | A simple player for testing |

## Checks

- `npm run sim [games]` plays whole wars with no screen: the test bot, then nobody at the controls.
  At 0.3.0, of 100 wars the simple bot wins 43 and loses 21, and 36 are still undecided at round 120.
  An undefended Federation falls by about round 40.
- `python3 test/ui.py` (with `npm start` running) clicks through two rounds at phone and desktop size, and checks
  zoom, dragging, the per-world bars and that a saved war loads.

## Not built yet

Sound, a reserve setting for the automatic defences, other languages, and any link to the other games.
