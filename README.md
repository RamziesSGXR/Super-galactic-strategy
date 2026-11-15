# Super Galactic Strategy

**Prototype 0.1.0.** Working title of the design: *Four Fronts*.

You are Federation High Command at the capital, Aurelia. Three enemies arrive one after another, each down its own
lanes, and they never fight each other. Hold the centre, then take all three enemy homes.

This is the strategy layer only. It does not connect to the other games yet. Every name, picture and rule here is
original: other games are inspiration, and nothing is borrowed from them.

## Play

Open `index.html` through any web server (`npm start`, then http://localhost:8080). There is nothing to build.
On GitHub Pages, serve the repository root. Add `?seed=7` to replay the same war.

## How a round works

1. **Plan.** Tap a marked enemy world and choose the missions for an operation. One operation per front.
   Each enemy has one mission it cannot take: Siege for the Swarm, Sabotage for the Foundry, Assault for the Veil.
2. **Grand Directive.** One front gets your full weight, to attack or to defend. The other fronts pay for it.
3. **Defence is automatic.** Dashed arrows show where each enemy will strike. The Army answers if a lane still
   reaches the world.
4. **Battle, live.** Every fight runs at once on the map. Tap a battle, then play a card or your one Secondary Order.
5. **The enemies' turn.** They grow, announce their next attacks, and you collect from the worlds still linked to
   the capital.

Rules worth knowing:

- **A world is a gate.** Nobody passes it until it is taken. A world cut off from its capital or home fights at
  half strength and pays nothing.
- **Three resources.** Fuel (comes from the Swarm's sector), Army (from the Foundry's sector) and Vanguard (from
  the Veil's sector, and more when morale is high or the enemy is close).
- **Attacking the world an attack launches from pins that attack.** This is the answer to a strike on the capital.
- **The home is fed by every world its owner holds.** Roll back the branches before going for the trunk.
- **Win:** all three homes taken. **Lose:** the capital falls, or two enemies strike it in the same round.
- Surviving a strike on the capital makes that front's next operation free and stronger (retaliation).

## The three enemies

| Enemy | Arrives | Behaviour | Fighting it |
|---|---|---|---|
| The Swarm | round 2 | Several small attacks every round | Its sector is your fuel |
| The Foundry | about round 7 | Builds up, then one heavy blow at the weakest world | Each world retaken pays Army |
| The Veil | about round 12 | Strikes one world behind your line | Every operation costs morale |

## Code

| File | What it holds |
|---|---|
| `js/config.js` | Every number and every name. Retune or rename here. |
| `js/map.js` | The board: capital, three sectors, 34 worlds |
| `js/sim.js` | All rules, with no screen code (`Game`) |
| `js/view.js` | The map drawn on a canvas |
| `js/main.js` | The interface |
| `js/bot.js` | A simple player for testing |

## Checks

- `npm run sim [games]` plays whole wars with no screen: the test bot, then nobody at the controls.
  At 0.1.0 the bot wins about 7 wars in 10 in about 40 rounds, and an undefended Federation falls by about round 22.
- `python3 test/ui.py` (with `npm start` running) clicks through two rounds at phone and desktop size.

## Not built yet

Saving, sound, rare cards unlocked by particular worlds, enemy card decks beyond one card each, a reserve setting
for the automatic defences, and any link to the other games.
