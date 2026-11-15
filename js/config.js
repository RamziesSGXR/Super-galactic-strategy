// Every number and every name in the game lives here, so the prototype can be retuned or renamed in one place.
export const VERSION = '0.6.1';

export const C = {
  names: {
    game: 'SUPER GALACTIC STRATEGY',
    fed: 'Federation',
    capital: 'Aurelia',
    drop: 'VANGUARD',   // elite volunteers: volatile, follow a cause
    army: 'ARMY',       // steady backbone
    fuel: 'FUEL',
    factions: { swarm: 'The Swarm', foundry: 'The Foundry', veil: 'The Veil' },
    homes: { swarm: 'Nest Prime', foundry: 'Anvil', veil: 'Lumen Null' },
    planets: ['Tarsen', 'Okoro', 'Vell', 'Duskar', 'Imrie', 'Pallas', 'Korvan', 'Sable', 'Ythe', 'Marrow', 'Calder', 'Nimbus', 'Orrin', 'Brakk', 'Solen',
      'Vantage', 'Kessrin', 'Halcyon', 'Dray', 'Umber', 'Lyss', 'Penumbra', 'Garnet', 'Ostra', 'Javel', 'Quill', 'Rookfall', 'Stenn', 'Wend', 'Zorya',
      'Thane', 'Corvale', 'Isk', 'Meru', 'Aldous', 'Brine', 'Cassel', 'Dunmore', 'Eris Gap', 'Fenwick', 'Galt', 'Hollin', 'Ixion', 'Jorvik', 'Kael',
      'Lorne', 'Mirel', 'Noss', 'Orlan', 'Pryce', 'Quenby', 'Rhys', 'Sorrel', 'Tamsin', 'Ulric', 'Varda', 'Wythe', 'Xanthe', 'Yarrow', 'Zephyr',
      'Ashby', 'Bexley', 'Corin', 'Dace', 'Elsin'],
  },
  // The ministries, as in FOB Super Commander. Each is a button; `does` is the one line shown under its name.
  ministries: {
    int: { short: 'INTEL',    name: 'INTELLIGENCE', does: 'Reports, warnings and suggested actions.' },
    def: { short: 'DEFENCE',  name: 'DEFENCE',      does: 'Your fleets: build them, combine them, see where they stand.' },
    pro: { short: 'PROSPER',  name: 'PROSPERITY',   does: 'Manages what you have: stock, income, exchange.' },
    exp: { short: 'EXPAND',   name: 'EXPANSION',    does: 'Grows what you have: develops your systems.' },
    tru: { short: 'TRUTH',    name: 'TRUTH',        does: 'Keeps morale up and deals with dissidents.' },
    hum: { short: 'HUMANITY', name: 'HUMANITY',     does: 'Regulates the population: volunteers or conscripts.' },
    emp: { short: 'EMPLOY',   name: 'EMPLOYMENT',   does: 'Decides which war front the work and supply flow to.' },
    uni: { short: 'UNITY',    name: 'UNITY',        does: 'The standing of the war.' },
  },
  // The three war fronts, in the order you play them each round. `deg` is where the front lies on the map
  // (screen degrees: 0 is east, 90 is south). Each front is one enemy, and each is its own game of moves.
  fronts: [
    { f: 'foundry', name: 'WESTERN FRONT', short: 'WEST', deg: 210 },
    { f: 'swarm',   name: 'EASTERN FRONT', short: 'EAST', deg: 330 },
    { f: 'veil',    name: 'SOUTHERN FRONT', short: 'SOUTH', deg: 90 },
  ],
  color: { fed: '#7fe9e0', swarm: '#ff9a3d', foundry: '#ff6a4d', veil: '#b58cff', amber: '#f5d547' },

  // The map: rings of systems round the capital, more on each ring going out. `ring[i]` is systems per front on ring i+1.
  // Lanes are left out on purpose, so there are dead ends and gaps.
  map: { ring: [2, 3, 4, 5, 7], radius: [0.17, 0.33, 0.5, 0.68, 0.88], second: 0.12, around: 0.32, across: 0.6 },

  start: { res: { fuel: 8, drop: 6, army: 8 }, morale: 60, fleets: [3, 2, 2, 2] },   // ships: at the capital, then one fleet on each front
  resMax: 30,

  // The worlds inside each star system. A world pays its resource each round while its system is linked to the
  // capital. One world per system is the key world: the one fought over, and its kind gives a boost to shipbuilding there.
  worlds: {
    capital:  { name: 'CAPITAL WORLD',  col: '#7fe9e0', text: 'The seat of the Federation.' },
    refinery: { name: 'GAS REFINERY',   col: '#d9a45b', res: 'fuel', y: 0.24, yard: 'Ships built here cost no fuel.', text: 'Pays fuel.' },
    forge:    { name: 'FORGE WORLD',    col: '#c8643c', res: 'army', y: 0.16, yard: 'Ships built here cost no Army.', text: 'Raises the Army.' },
    colony:   { name: 'COLONY',         col: '#5fa8d8', res: 'drop', y: 0.09, yard: 'Ships built here cost no Vanguard.', text: 'Sends Vanguard volunteers.' },
    fortress: { name: 'FORTRESS WORLD', col: '#9aa7a0', fort: 2, yard: 'Each ship built here adds +1 to the system\'s defence (up to +3).', text: 'Adds to the system\'s defence.' },
    barren:   { name: 'BARREN WORLD',   col: '#6f6a62', text: 'Rock. Nothing to gain but the ground.' },
  },
  capitalYield: { fuel: 1.5, army: 1.2, drop: 0.5 },
  fort: { capital: 12, home: 0, sys: 2 },      // a system's own defence, with no fleet there

  // ---------- fleets ----------
  ship: { str: 3, cost: { fuel: 3, army: 3, drop: 2 } },   // one ship; a fleet is any number of ships that move together
  loss: { winner: 0.35, loser: 0.5 },           // share of the other side's ships the winner loses; share of its own the loser loses
  cut: 0.5,                                      // a system cut off from the capital defends at half and pays nothing

  // Arrival: round, plus or minus `vary`. The warning comes `warn` rounds before.
  arrive: { swarm: { round: 2, vary: 0 }, foundry: { round: 5, vary: 1 }, veil: { round: 9, vary: 1 } },
  warn: 2,
  // Enemy behaviour. Each turn it builds ships at its home: build + per × systems held + ramp × round (fractions carry over).
  // `fleet` is the size it sends out; `aggr` is how much stronger than the defence it wants to be before it attacks.
  enemy: {
    swarm:   { init: [2, 2, 2], build: 1.3, per: 0.1, ramp: 0.05, fleet: 2, aggr: 0.9, text: 'Many small fleets. Attacks at even odds.' },
    foundry: { init: [5, 3],    build: 1.4, per: 0.1, ramp: 0.05, fleet: 5, aggr: 1.25, text: 'A few heavy fleets. Waits until it is sure.' },
    veil:    { init: [3, 3],    build: 1.3, per: 0.1, ramp: 0.05, fleet: 3, aggr: 1.05, sneak: 0.5, text: 'Slips past defences: a system\'s own defence counts half against it.' },
  },
  garr: { sys: 2, home: 10, fortress: 1.5, dig: 3 },   // an enemy-held system's own defence, with no fleet there
  patience: 2,       // turns an enemy fleet will sit beside a target before it attacks anyway
  scrap: 2,          // Army gained for each Foundry system taken
  veilCost: 1,       // morale lost for each attack on the Veil
  veilDrain: 0.2,    // morale lost per round for each system the Veil holds
  rally: 0.6,        // extra Vanguard per round for each ring the enemy is inside ring 3
  mor: { off: 3, offLoss: 3, def: 1, defLoss: 4, kill: 12, drift: 2 },
  battle: { dur: 9, rate: 0.16, noise: 0.07, hold: 1.2 },
  secondary: 2,

  // ---------- the deck ----------
  // You draw `hand` cards each round (+1 at high morale, −1 at low) and may play them on any of your three turns.
  // A used card goes to the discard pile and comes round again when the draw pile runs out.
  deck: { hand: 5, high: 70, low: 30 },
  // type: boost (on one of your fleets), trap (hidden on one of your systems until it is attacked), order (on a system
  //       of yours), battle (during the fighting), propaganda, logistics, dissent (dead weight), relic (rare, spent on use).
  // starter: copies in the opening deck. w: chance of being offered after a major victory.
  cards: {
    strike:   { name: 'ALPHA STRIKE',   type: 'boost', text: 'One fleet: +4 strength when it attacks this turn.', starter: 2, w: 2 },
    veteran:  { name: 'VETERAN CREWS',  type: 'boost', text: 'One fleet: +3 strength in every fight this round.', starter: 2, w: 2 },
    forced:   { name: 'FORCED MARCH',   type: 'boost', text: 'One fleet that has moved may move again this round.', starter: 1, w: 2 },
    flank:    { name: 'FLANKING ORDERS', type: 'boost', text: 'One fleet: +2 strength for each other fleet attacking the same system.', w: 2 },
    mines:    { name: 'MINEFIELD',      type: 'trap', text: 'Hidden. The next attack on this system loses 40% of its strength.', starter: 1, w: 2 },
    ambush:   { name: 'AMBUSH',         type: 'trap', text: 'Hidden. +5 defence against the next attack on this system.', starter: 1, w: 2 },
    decoy:    { name: 'DECOY',          type: 'trap', text: 'Hidden. The next attack on this system is called off: the enemy fleet turns back.', w: 1 },
    shipyard: { name: 'EMERGENCY YARD', type: 'order', text: 'One free ship at a system of yours.', starter: 1, w: 2 },
    fortify:  { name: 'FORTIFY',        type: 'order', cost: { fuel: 2 }, text: '+3 defence on a system of yours while you hold it.', w: 2 },
    support:  { name: 'FIRE SUPPORT',   type: 'battle', text: '+5 strength in one battle.', starter: 1, w: 3 },
    blockade: { name: 'ORBITAL BLOCKADE', type: 'battle', text: 'Enemy strength in one battle −30%.', w: 2 },
    evac:     { name: 'RECALL',         type: 'battle', text: 'Call off one of your attacks. The fleet pulls back without loss.', w: 1 },
    bonds:    { name: 'WAR BONDS DRIVE', type: 'propaganda', text: '+10 morale.', starter: 1, w: 2 },
    broadcast:{ name: 'RECRUITMENT REEL', type: 'propaganda', text: '+4 Vanguard.', w: 2 },
    convoy:   { name: 'FUEL CONVOY',    type: 'logistics', text: '+5 fuel.', starter: 1, w: 2 },
    levy:     { name: 'CONSCRIPT LEVY', type: 'logistics', text: '+5 Army, −3 morale.', w: 2 },
    dissent:  { name: 'DISSENT',        type: 'dissent', text: 'Does nothing. Takes a place in your hand until the Ministry of Truth removes it.' },
    armada:   { name: 'THE HOME FLEET', type: 'relic', when: 'battle', text: '+10 strength in one battle.' },
    flagship: { name: 'THE FLAGSHIP',   type: 'relic', target: 'fleet', text: 'One fleet gains 3 ships.' },
    reserve:  { name: 'GENERAL RESERVE', type: 'relic', text: '+8 Army.' },
    anthem:   { name: 'THE ANTHEM',     type: 'relic', text: '+20 morale and +3 Vanguard.' },
    cache:    { name: 'STRATEGIC RESERVE', type: 'relic', text: '+10 fuel.' },
    bulwark:  { name: 'PLANETARY SHIELD', type: 'relic', target: 'system', text: '+8 defence on a system of yours while you hold it.' },
  },
  // Six systems each keep one relic card. While you hold a relic system and a lane reaches it, its card comes to
  // your hand every `every` rounds; retaking the system gives the card at once.
  relic: { cards: ['armada', 'flagship', 'reserve', 'anthem', 'cache', 'bulwark'], first: 4, every: 9 },

  // ---------- what the ministries can do ----------
  trade: { give: 3, get: 2 },                         // Prosperity: exchange one resource for another
  develop: { max: 2, fuel: 3, army: 2, mult: 0.5 },   // Expansion: cost × (level + 1); each level adds 50% to the system's output
  truth: { broadcast: { fuel: 2, morale: 6 }, purge: { army: 2 } },   // Truth: one broadcast a round; purge removes one Dissent
  // Humanity: who the colonies send. Multipliers on Vanguard from colonies; Army gained per colony; morale per round.
  policy: {
    volunteer: { name: 'VOLUNTEERS', text: 'Colonies send more Vanguard. Forge output falls a little.', drop: 1.4, forge: 0.85, army: 0, morale: 0 },
    balanced:  { name: 'BALANCED',   text: 'No change.', drop: 1, forge: 1, army: 0, morale: 0 },
    conscript: { name: 'CONSCRIPTION', text: 'Each colony also raises Army. Fewer volunteers, and morale falls 1 a round.', drop: 0.6, forge: 1, army: 0.1, morale: -1 },
  },
  priority: { fort: 1.5, yield: 1.25, fuel: 1 },      // Employment: the priority front defends better, pays more, and builds ships for 1 less fuel

  // Each enemy has a deck of three. It gains a card on a major win and plays one at the start of its turn.
  enemyCards: {
    swarm:   { frenzy: { name: 'FEEDING FRENZY', text: 'its attacks this turn are 50% stronger' }, brood: { name: 'BROOD SURGE', text: '3 more ships hatch at its home' },
               tunnel: { name: 'TUNNEL BREACH', text: 'its fleets move twice this turn' } },
    foundry: { surge: { name: 'PRODUCTION SURGE', text: '3 more ships roll out at its home' }, engines: { name: 'SIEGE ENGINES', text: 'its attacks this turn are +4 stronger' },
               dig: { name: 'IRON LINE', text: 'its systems are +3 defence for three rounds' } },
    veil:    { conversion: { name: 'MASS CONVERSION', text: '−8 morale, −2 Vanguard' }, shroud: { name: 'THE SHROUD', text: 'your traps on its front are revealed and removed' },
               dread: { name: 'DREAD', text: '−5 morale and no Vanguard volunteers this round' } },
  },
};
// The three enemies, in the order their fronts are played.
C.factions = C.fronts.map(fr => fr.f);
