// Every number and every name in the game lives here, so the prototype can be retuned or renamed in one place.
export const VERSION = '0.7.0';

export const C = {
  names: {
    game: 'SUPER GALACTIC STRATEGY',
    fed: 'Federation',
    capital: 'Aurelia',
    drop: 'VANGUARD', army: 'ARMY', fuel: 'FUEL',
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
    def: { short: 'DEFENCE',  name: 'DEFENCE',      does: 'Your fleets, and the battle deck they fight with.' },
    pro: { short: 'PROSPER',  name: 'PROSPERITY',   does: 'Manages what you have: stock, income, exchange.' },
    exp: { short: 'EXPAND',   name: 'EXPANSION',    does: 'Grows what you have: develops systems and builds special sites.' },
    tru: { short: 'TRUTH',    name: 'TRUTH',        does: 'Propaganda cards. They come from what happens in the war, not from you.' },
    hum: { short: 'HUMANITY', name: 'HUMANITY',     does: 'Regulates the population: volunteers or conscripts.' },
    emp: { short: 'EMPLOY',   name: 'EMPLOYMENT',   does: 'Decides which war front the work and supply flow to.' },
    uni: { short: 'UNITY',    name: 'UNITY',        does: 'The standing of the war.' },
  },
  // The three war fronts, in the order they are played each round. On each front the enemy acts first, then you.
  // `deg` is where the front lies on the map (screen degrees: 0 is east, 90 is south).
  // `loot` is the front's own resource: you win some with every victory there, and spend it on special sites.
  fronts: [
    { f: 'swarm',   name: 'EASTERN FRONT',  short: 'EAST',  deg: 330, loot: 'ICHOR', lootShort: 'ICHOR' },
    { f: 'foundry', name: 'WESTERN FRONT',  short: 'WEST',  deg: 210, loot: 'SCRAP PARTS', lootShort: 'SCRAP' },
    { f: 'veil',    name: 'SOUTHERN FRONT', short: 'SOUTH', deg: 90,  loot: 'CARBON PEARLS', lootShort: 'PEARLS' },
  ],
  color: { fed: '#7fe9e0', swarm: '#ff9a3d', foundry: '#ff6a4d', veil: '#b58cff', amber: '#f5d547' },

  // The map: rings of systems round the capital, more on each ring going out. `ring[i]` is systems per front on ring i+1.
  // Lanes are left out on purpose, so there are dead ends; where two fronts meet most rings are joined.
  map: { ring: [2, 3, 4, 5, 7], radius: [0.17, 0.33, 0.5, 0.68, 0.88], second: 0.12, around: 0.32, across: 0.6 },

  start: { res: { fuel: 9, drop: 6, army: 9 }, fleets: [3, 2, 2, 2] },   // ships: at the capital, then one fleet on each front
  resMax: 30,

  // The worlds inside each star system. A world pays its resource each round while its system is linked to the
  // capital, and every few worlds of a kind put a card of that kind in your battle deck.
  worlds: {
    capital:  { name: 'CAPITAL WORLD',  col: '#7fe9e0', text: 'The seat of the Federation.' },
    refinery: { name: 'GAS REFINERY',   col: '#d9a45b', res: 'fuel', y: 0.24, card: 'burn',    yard: 'Ships built here cost no fuel.' },
    forge:    { name: 'FORGE WORLD',    col: '#c8643c', res: 'army', y: 0.16, card: 'armour',  yard: 'Ships built here cost no Army.' },
    colony:   { name: 'COLONY',         col: '#5fa8d8', res: 'drop', y: 0.09, card: 'drop',    yard: 'Ships built here cost no Vanguard.' },
    fortress: { name: 'FORTRESS WORLD', col: '#9aa7a0', fort: 2,     card: 'bulwark', yard: 'Adds 2 to the system\'s defence.' },
    barren:   { name: 'BARREN WORLD',   col: '#6f6a62' },
  },
  capitalYield: { fuel: 1.5, army: 1.2, drop: 0.5 },
  fort: { capital: 10, sys: 2 },      // hit points a system of yours has by itself, with no fleet there
  garr: { sys: 2, home: 9, fortress: 2 },   // the same for an enemy system

  // ---------- fleets ----------
  // One ship is 3 hit points and 1 point of fire each round of a battle. A fleet may travel any distance through
  // systems you hold that are joined by lanes, once a round.
  ship: { hp: 3, cost: { fuel: 3, army: 3, drop: 2 } },
  cut: 0.5,                 // a system cut off from the capital defends at half and pays nothing

  // Arrival: round, plus or minus `vary`. The warning comes `warn` rounds before.
  arrive: { swarm: { round: 2, vary: 0 }, foundry: { round: 4, vary: 1 }, veil: { round: 7, vary: 1 } },
  warn: 2,
  // Enemy behaviour. Ships gather at its home by themselves: build + per × systems held + ramp × round each turn.
  // Its one action a turn is to attack with a fleet, or to bring a fleet up to the line. `aggr` is how much more
  // than the defence it wants before it attacks; after `patience` turns of waiting it attacks anyway.
  enemy: {
    swarm:   { init: [3, 2], build: 0.75, per: 0.055, ramp: 0.03, send: 2, aggr: 0.9,  text: 'Attacks often, with small fleets.' },
    foundry: { init: [5],    build: 0.75, per: 0.055, ramp: 0.03, send: 4, aggr: 1.3,  text: 'Gathers a heavy fleet before it strikes.' },
    veil:    { init: [3, 2], build: 0.75, per: 0.055, ramp: 0.03, send: 3, aggr: 1.05, text: 'Its cards slip past your defences.' },
  },
  patience: 2,
  loot: { attack: 2, defend: 1, home: 4 },   // front resource won with each victory

  // ---------- battles: the card game ----------
  // When fleets meet, each side draws `hand` cards at random from its battle deck. Each round both sides play one
  // card, then every ship fires. Hit points fall until one side has none. When the cards run out, the guns decide.
  // atk: damage added to your ships' fire. block: damage stopped this round. heal: hit points restored.
  // pierce: ignores the other side's block. sap: the other side's ships fire this much less for the rest of the battle.
  // Truth cards are propaganda: used up when played. If both sides play propaganda in the same round, the stronger
  // (`power`) takes the other's card for its own deck and cancels it.
  battle: { hand: 3, maxRounds: 12 },
  bcards: {
    // every fleet carries these
    volley:  { name: 'FULL VOLLEY',     kind: 'fleet', atk: 2, text: '+2 damage.' },
    brace:   { name: 'BRACE',           kind: 'fleet', block: 3, text: 'Stops 3 damage this round.' },
    // from the worlds you hold
    burn:    { name: 'AFTERBURN RUN',   kind: 'world', atk: 4, text: '+4 damage. From your refineries.' },
    armour:  { name: 'ARMOURED PUSH',   kind: 'world', atk: 2, block: 2, text: '+2 damage and stops 2. From your forge worlds.' },
    drop:    { name: 'VANGUARD DROP',   kind: 'world', atk: 1, heal: 3, text: '+1 damage and restores 3. From your colonies.' },
    bulwark: { name: 'BULWARK',         kind: 'world', block: 5, text: 'Stops 5 damage this round. From your fortress worlds.' },
    // from special sites
    railgun: { name: 'PROTOTYPE RAILGUN', kind: 'site', atk: 6, pierce: true, text: '+6 damage that cannot be stopped.' },
    acid:    { name: 'ICHOR WARHEADS',  kind: 'site', atk: 3, sap: 1, text: '+3 damage, and the enemy fires 1 less each round after.' },
    mirror:  { name: 'PEARL MIRROR',    kind: 'site', block: 99, reflect: 3, text: 'Stops all damage this round and turns 3 back.' },
    // Ministry of Truth
    newsreel:{ name: 'VICTORY NEWSREEL', kind: 'truth', power: 2, heal: 4, atk: 1, text: 'Restores 4, +1 damage. Earned by taking a system.' },
    heroes:  { name: 'HEROES OF THE LINE', kind: 'truth', power: 3, block: 3, atk: 2, text: 'Stops 3, +2 damage. Earned by holding a system.' },
    lastStand: { name: 'NOT ONE STEP BACK', kind: 'truth', power: 4, block: 4, heal: 3, text: 'Stops 4 and restores 3. Earned when a system of yours falls.' },
    // the enemies
    rush:    { name: 'SWARM RUSH',      kind: 'foe', atk: 3, text: '+3 damage.' },
    frenzy:  { name: 'FEEDING FRENZY',  kind: 'foe', atk: 2, heal: 2, text: '+2 damage and restores 2.' },
    siege:   { name: 'SIEGE GUNS',      kind: 'foe', atk: 5, text: '+5 damage.' },
    plating: { name: 'IRON PLATING',    kind: 'foe', block: 4, text: 'Stops 4 damage.' },
    phase:   { name: 'PHASE STRIKE',    kind: 'foe', atk: 3, pierce: true, text: '+3 damage that cannot be stopped.' },
    fog:     { name: 'MIND FOG',        kind: 'foe', block: 2, sap: 1, text: 'Stops 2, and you fire 1 less each round after.' },
    dread:   { name: 'DREAD BROADCAST', kind: 'truth', power: 3, atk: 2, sap: 1, text: '+2 damage, and you fire 1 less. Earned when it takes a system.' },
    triumph: { name: 'HIVE TRIUMPHANT', kind: 'truth', power: 2, heal: 4, text: 'Restores 4. Earned when it repels you.' },
  },
  // What every side's deck starts from, before worlds, sites and propaganda are added.
  baseDeck: { fed: ['volley', 'volley', 'volley', 'brace', 'brace'], swarm: ['volley', 'volley', 'rush', 'rush', 'frenzy'],
    foundry: ['volley', 'volley', 'siege', 'plating', 'plating'], veil: ['volley', 'volley', 'phase', 'phase', 'fog'] },
  // An enemy adds one of its own card for every `per` systems it holds, up to `max`.
  foeGrow: { swarm: 'rush', foundry: 'siege', veil: 'phase', per: 3, max: 4 },
  worldCard: { per: 8, max: 3 },      // you add one world card for every `per` worlds of that kind you hold, up to `max`
  siteMax: 2,                         // sites of one kind you can have
  truthMax: 4,                        // propaganda cards a side can hold

  // Special sites: built on a system of yours with a front's own resource. Each puts two copies of a card nobody
  // else has into your battle deck. A site is lost with its system.
  sites: {
    testing: { name: 'TESTING CENTRE', loot: 'foundry', cost: 6, card: 'railgun', text: 'Two PROTOTYPE RAILGUN cards.' },
    biolab:  { name: 'ICHOR LAB',      loot: 'swarm',   cost: 6, card: 'acid',    text: 'Two ICHOR WARHEADS cards.' },
    array:   { name: 'PEARL ARRAY',    loot: 'veil',    cost: 6, card: 'mirror',  text: 'Two PEARL MIRROR cards.' },
  },

  // ---------- what the ministries can do (none of these use up your decision) ----------
  trade: { give: 3, get: 2 },                         // Prosperity: exchange one resource for another
  develop: { max: 2, fuel: 3, army: 2, mult: 0.5 },   // Expansion: cost × (level + 1); each level adds 50% to the system's output
  policy: {                                           // Humanity: who the colonies send
    volunteer: { name: 'VOLUNTEERS', text: 'Colonies send more Vanguard. Forge output falls a little.', drop: 1.4, forge: 0.85, army: 0 },
    balanced:  { name: 'BALANCED',   text: 'No change.', drop: 1, forge: 1, army: 0 },
    conscript: { name: 'CONSCRIPTION', text: 'Each colony also raises Army, and sends fewer volunteers.', drop: 0.5, forge: 1, army: 0.1 },
  },
  priority: { fort: 2, yield: 1.25, fuel: 1 },        // Employment: the priority front defends better, pays more, and builds ships for 1 less fuel
};
// The three enemies, in the order their fronts are played.
C.factions = C.fronts.map(fr => fr.f);
