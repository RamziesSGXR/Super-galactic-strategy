# Super Galactic Strategy

**Prototype 0.2.0.** Working title of the design: *Four Fronts*.

You are Federation High Command at the capital, Aurelia. Three enemies arrive one after another, each down its own
lanes, and they never fight each other. Hold the centre, then take all three enemy homes.

This is the strategy layer only. It does not connect to the other games yet. Every name, picture and rule here is
original: other games are inspiration, and nothing is borrowed from them.

## Play

Open `index.html` through any web server (`npm start`, then http://localhost:8080). There is nothing to build.
On GitHub Pages, serve the repository root. Add `?seed=7` to replay the same war.

## The map

- Each point is a **star system** holding two to four **worlds**. Tap a system to see them.
- Worlds have kinds: gas refineries pay fuel, forge worlds raise the Army, colonies send Vanguard, fortress worlds
  add defence, barren worlds give nothing.
- **Six routes** lead out of the capital. Three end at an enemy home; the three between are quiet. Two ring lanes
  join the routes further out, so an enemy can go around a route you hold.
- **Strategic locations:** shipyards (operations next door +15%), fuel depots (operations next door cost 2 less
  fuel) and bastions (+3 defence), nine in all.

## How a round works

1. **Plan.** Tap a marked enemy system and give its worlds missions, one per world. One operation per front.
   Each enemy has one mission it cannot take (Siege for the Swarm, Sabotage for the Foundry, Assault for the Veil),
   and each kind of world suits one mission.
2. **General attack or major offensive.** A general attack carries two missions. A major offensive carries up to
   four at +50%, but the front must be **mobilised** first: pay 2 fuel this round, launch in one of the next two.
3. **Defence is automatic**, and only for systems you hold. Dashed arrows show where each enemy will strike. The
   Army answers if a lane still reaches the system. A Defence Order adds +50% on one front under attack.
4. **Battle, live.** Every fight runs at once on the map. Tap a battle, then play a card or your one Secondary Order.
5. **The enemies' turn.** They grow, announce their next attacks, and you collect from the systems still linked
   to the capital.

Rules worth knowing:

- **A system is a gate.** Nobody passes it until it is taken. A system cut off from its capital or home fights at
  half strength and pays nothing.
- **Attacking the system an attack launches from pins that attack.** This is the answer to a strike on the capital.
- **The home is fed by every system its owner holds.** Roll back the branches before going for the trunk.
- **Win:** all three homes taken. **Lose:** the capital falls, or two enemies strike it in the same round.
- Surviving a strike on the capital makes that front's next operation free and stronger (retaliation).

## The three enemies

| Enemy | Arrives | Behaviour | Fighting it |
|---|---|---|---|
| The Swarm | round 2 | Several small attacks every round | Its route is rich in fuel |
| The Foundry | about round 7 | Builds up, then one heavy blow at the weakest system | Each system retaken pays Army |
| The Veil | about round 12 | Strikes one system behind your line | Every operation costs morale |

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
  At 0.2.0 the simple bot wins about 3 wars in 10 in about 55 rounds, and an undefended Federation falls by about round 30.
- `python3 test/ui.py` (with `npm start` running) clicks through two rounds at phone and desktop size.

## Not built yet

Saving, sound, rare cards unlocked by particular worlds, enemy card decks beyond one card each, a reserve setting
for the automatic defences, and any link to the other games.
