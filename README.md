# Super Galactic Strategy

**Prototype 0.7.1.** Working title of the design: *Four Fronts*.

You are Federation High Command at the capital, Aurelia. Three enemies come at you on three war fronts: the Swarm
in the east, the Foundry in the west, the Veil in the south. Each round you make one decision on each front, and
when fleets meet the fight is a card battle. Take all three enemy homes to win.

This is the strategy layer only. It does not connect to the other games yet. Every name, picture and rule here is
original: other games are inspiration, and nothing is borrowed from them.

## Play

Open `index.html` through any web server (`npm start`, then http://localhost:8080). There is nothing to build.
Add `?seed=7` to replay the same war, or `?tutorial` for the guided first rounds (also under **Unity → TUTORIAL**).

## Show, not tell

The game explains itself once, in the tutorial. During play the screen carries no instructions: the turn strip shows
only which front is in play and what the enemy has just done, the bottom bar shows only what is selected and what
can be pressed, and the battle screen shows only what each round did. The rules are behind the **?** button on the
map, and the tutorial can be replayed from **Unity**.

## A round

The round goes east, west, south. On each front that is at war:

1. **The map turns to that front** and closes in on it, with the enemy's home at the top. WHOLE MAP pulls back.
2. **The enemy acts first**, once: it attacks one of your systems with a fleet, or brings a fleet up to the line.
   An attack is a battle straight away.
3. **You make one decision:** attack, defend, or hold.
   - Tap one of your fleets. Amber rings are enemy systems on this front it can attack; cyan rings are systems of
     yours on this front it can move to. Tap a ring, then confirm.
   - A fleet may travel any distance through systems you hold that are joined by lanes, once a round. So a fleet
     from another front can be brought across: pull back to the whole map, or pick it from the Defence list.
4. **Building is extra** and does not use up the decision: one ship at each of your systems on that front, and
   special sites.

After the south: income, and the next round.

## Battles

- Each side has **hit points**: 3 for every ship, plus the system's own (2, more with fortress worlds; the capital 10).
- Each side draws **3 cards at random from its deck**.
- Each round you tap one card, the enemy plays one, then **every ship fires** 1. Cards add damage, stop damage,
  repair, or weaken the other side's fire.
- When the cards are spent, the guns decide. The first side out of hit points loses; if both are, the defender holds.
- The loser falls back to a neighbouring system of its own with half its ships, or is lost. The winner keeps the
  ships its remaining hit points pay for.

## Your deck

The deck is made of what you hold. Nothing is managed by hand.

| From | Cards |
|---|---|
| Every fleet | Full Volley ×3, Brace ×2 |
| Worlds: one card for every 8 worlds of a kind, up to 3 | Afterburn Run (refineries), Armoured Push (forges), Vanguard Drop (colonies), Bulwark (fortress worlds) |
| Special sites: two cards each | Prototype Railgun (Testing Centre), Ichor Warheads (Ichor Lab), Pearl Mirror (Pearl Array) |
| The Ministry of Truth | Victory Newsreel (you take a system), Heroes of the Line (you hold one), Not One Step Back (you lose one) |

Enemy decks grow the same way, with the systems they hold. Propaganda cards are used up when played. If both sides
play propaganda in the same round, the stronger takes the other's card and cancels it.

## Front resources and special sites

Each front has its own resource, won with every victory there: **ichor** in the east, **scrap parts** in the west,
**carbon pearls** in the south (2 for taking a system, 1 for holding one, 4 for the home). Six of one buys a special
site on a system of yours, up to two of each kind. A site is lost with its system.

## The map

Five rings of systems round the capital, 64 in all, with more on each ring going out. Every system has a lane inward;
only some neighbours on a ring are joined, so there are dead ends. Where two fronts meet, most rings are joined
across. Each system has two to four worlds that pay fuel, Army or Vanguard, which is what ships cost (3, 3 and 2;
less where the key world is a refinery, forge or colony). A system cut off from the capital pays nothing and has
half its hit points.

A **shield** marks a system of yours with an enemy fleet beside it: cyan is safe, amber is close, red is likely to fall.

## The ministries

| Ministry | What it shows or does |
|---|---|
| Intelligence | The report, suggested actions for the front in play, what needs defending |
| Defence | Your fleets by front (tap one to pick it up), and your battle deck |
| Prosperity | Stock, next round's income, front resources; exchange 3 of one resource for 2 of another |
| Expansion | Build special sites; develop a system so it pays more |
| Truth | Your propaganda cards and the enemy's. Nothing to manage |
| Humanity | Volunteers, balanced or conscription |
| Employment | The priority front: +2 hit points, +25% output, ships cost 1 less fuel there |
| Unity | The standing of the war, the log, the rules, the tutorial |

## The three enemies

| Enemy | Front | Arrives | How it plays |
|---|---|---|---|
| The Swarm | East | round 2 | Attacks often, with small fleets. Swarm Rush, Feeding Frenzy. |
| The Foundry | West | about round 4 | Gathers a heavy fleet before it strikes. Siege Guns, Iron Plating. |
| The Veil | South | about round 7 | Its cards slip past your defences. Phase Strike, Mind Fog. |

Win by taking all three homes. Lose if the capital falls, or if two enemies strike it in the same round.

## Code

| File | What it holds |
|---|---|
| `js/config.js` | Every number and every name. Retune or rename here. |
| `js/map.js` | The board: rings, fronts, lanes |
| `js/sim.js` | All rules, with no screen code (`Game`): the turn, decks, battles |
| `js/view_map.js`, `js/view.js` | The galaxy map and its camera; one planet in full view; the battle picture |
| `js/main.js` | The interface |
| `js/tutorial.js` | The tutorial's steps |
| `js/bot.js` | A simple player for testing |

## Checks

- `npm run sim [games]` plays whole wars with no screen: the test bot, then nobody at the controls.
  At 0.7.0, of 100 wars the simple bot wins 69 in about 45 rounds. An undefended Federation falls by about round 19.
- `python3 test/ui.py` and `python3 test/tutorial.py` (with `npm start` running) play the opening and follow the
  tutorial by tapping the map and the buttons, at phone and desktop size.

## Not built yet

Sound, other languages, and any link to the other games. A battle is the natural place for those games to plug in:
it needs only two fleets and a system going in, and a winner coming out.
