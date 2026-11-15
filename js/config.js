// Every number and every name in the game lives here, so the prototype can be retuned or renamed in one place.
export const VERSION = '0.3.0';

export const C = {
  // All names are original. Nothing here is taken from another game.
  names: {
    game: 'SUPER GALACTIC STRATEGY',
    fed: 'Federation',
    capital: 'Aurelia',
    drop: 'VANGUARD',   // elite volunteers: volatile, follow a cause
    army: 'ARMY',       // steady backbone
    fuel: 'FUEL',
    directive: 'GRAND DIRECTIVE',
    ministry: 'Ministry of Clarity',
    factions: { swarm: 'The Swarm', foundry: 'The Foundry', veil: 'The Veil' },
    homes: ['Nest Prime', 'Anvil', 'Lumen Null'],
    planets: ['Tarsen', 'Okoro', 'Vell', 'Duskar', 'Imrie', 'Pallas Reach', 'Korvan', 'Sable', 'Ythe', 'Marrow',
      'Calder', 'Nimbus Gate', 'Orrin', 'Brakk', 'Solen', 'Vantage', 'Kessrin', 'Halcyon', 'Dray', 'Umber',
      'Lyss', 'Penumbra', 'Garnet', 'Ostra', 'Javel', 'Quill', 'Rookfall', 'Stenn', 'Wend', 'Zorya',
      'Thane', 'Corvale', 'Isk', 'Meru', 'Aldous Drift', 'Brine'],
  },
  factions: ['swarm', 'foundry', 'veil'],   // the order of arrival; their homes sit on spokes 0, 2 and 4 of six
  color: { fed: '#7fe9e0', swarm: '#ff9a3d', foundry: '#ff6a4d', veil: '#b58cff', amber: '#f5d547' },

  start: { res: { fuel: 10, drop: 6, army: 10 }, morale: 60, hand: ['support', 'bonds', 'fortify'] },
  resMax: 30, handMax: 5,

  // The worlds inside each star system. A world pays its resource each round while its system is linked to the
  // capital, and each kind of world suits one kind of mission.
  worlds: {
    capital:  { name: 'CAPITAL WORLD',  col: '#7fe9e0', fav: null, text: 'The seat of the Federation.' },
    refinery: { name: 'GAS REFINERY',   col: '#d9a45b', res: 'fuel', y: 0.28, fav: 'sabotage', text: 'Pays fuel. Its platforms are fragile.' },
    forge:    { name: 'FORGE WORLD',    col: '#c8643c', res: 'army', y: 0.17, fav: 'sabotage', text: 'Raises the Army. Its factories are fragile.' },
    colony:   { name: 'COLONY',         col: '#5fa8d8', res: 'drop', y: 0.09, fav: 'assault',  text: 'Sends Vanguard volunteers. Best taken fast.' },
    fortress: { name: 'FORTRESS WORLD', col: '#9aa7a0', fort: 2,     fav: 'siege',    text: 'Adds to the system\'s defence. Only a siege cracks it.' },
    barren:   { name: 'BARREN WORLD',   col: '#6f6a62', fav: null, text: 'Rock. Nothing to gain but the ground.' },
  },
  capitalYield: { fuel: 1.5, army: 1.2, drop: 0.4 },
  // Strategic locations: a few systems that matter more than their neighbours.
  traits: {
    shipyard: { name: 'SHIPYARD', text: 'Operations on a neighbouring system are 15% stronger.', mult: 1.15 },
    depot:    { name: 'FUEL DEPOT', text: 'Operations on a neighbouring system cost 2 less fuel.', fuel: 2 },
    bastion:  { name: 'BASTION', text: '+3 defence for whoever holds it.', fort: 3 },
  },
  fort: { capital: 15, gate: 4, junction: 4, mid: 3, outer: 3, frontier: 3, home: 3, retaken: 0 },

  // Arrival: round, plus or minus `vary`. The warning comes `warn` rounds before.
  arrive: { swarm: { round: 2, vary: 0 }, foundry: { round: 7, vary: 1 }, veil: { round: 12, vary: 2 } },
  warn: 2,

  // Enemy behaviour. force grows each round by grow + per × planets + ramp × round.
  enemy: {
    swarm:   { init: 16, grow: 3.0, per: 0.35, ramp: 0.12, spend: 0.8, targets: 3, minStr: 2.5 },
    foundry: { init: 18, grow: 2.6, per: 0.20, ramp: 0.10, spend: 0.75, targets: 1, hold: 9 },
    veil:    { init: 18, grow: 3.0, per: 0.30, ramp: 0.12, spend: 0.8, targets: 2, deep: 0.6, minStr: 3 },
  },
  garr: { base: 4, ring: 1.3, force: 0.2, home: 1.5, perPlanet: 2, fortress: 1.5, dig: 3 },
  fortWeight: 1.6,   // a fortress world takes this share of a system's defence, against 1 for any other world
  footholdRounds: 2, // worlds you take in a system the enemy still controls are overrun after this many rounds   // strength of an enemy-held planet
  cut: 0.5,          // a planet cut off from its capital or home fights at half strength
  pinNeed: 0.5,      // an operation pins an attack only if it is at least this share of the attack's strength
  pin: 0.5,          // attacking the planet a threat launches from cancels the threat; this share of it joins the garrison
  winBack: 0.35,      // share of an attack's force the enemy keeps after winning

  // Operations: the missions you assign to a planet.
  missions: {
    assault:  { name: 'ASSAULT',  short: 'ASLT',  str: 4,   drop: 2, army: 0, text: 'Vanguard drop in force.' },
    siege:    { name: 'SIEGE',    short: 'SIEGE', str: 4,   drop: 0, army: 3, text: 'The Army grinds forward.' },
    sabotage: { name: 'SABOTAGE', short: 'SABO', str: 4, drop: 1, army: 2, text: 'Small teams hit what the enemy runs on.' },
  },
  weak: { swarm: 'siege', foundry: 'sabotage', veil: 'assault' },   // the mission each enemy's economy cannot take
  weakAdd: 0.5, favAdd: 0.25,   // strength added for hitting the enemy's weak point, and for suiting the world
  // A general attack carries at most `general` missions. A major offensive carries up to `major`, one per world.
  op: { general: 2, major: 4, fuel: 1, fuelRing: 1.2 },
  // A major offensive must be mobilised first: pay, wait a round, then launch within `last` rounds.
  mob: { fuel: 2, last: 3 },   // fuel = fuel + fuelRing × distance from the capital
  reach: 0.05,       // supply reach: an operation loses this share of its strength for each ring past the first
  dir: { boost: 1.5, drain: 0.85, rallied: 2 },
  retal: 6,          // free strength for an operation on a front that just failed to take the capital
  scrap: 2,          // Army gained for each Foundry planet taken
  veilCost: 2,       // morale lost for each operation against the Veil
  veilDrain: 0.25,    // morale lost per round for each planet the Veil holds

  def: { max: 5, perArmy: 1.3, margin: 1.25 },   // automatic defence: Army sent per battle
  capitalRally: 4,
  rally: 0.6,        // extra Vanguard per round for each ring the enemy is inside ring 3
  mor: { off: 4, offLoss: 3, def: 1, defLoss: 4, kill: 12, drift: 2, world: 1 },

  battle: { dur: 12, rate: 0.13, noise: 0.07, hold: 1.4 },
  secondary: 2,

  // Cards are used once. kind is only a label; `needs` says what must be selected or set for the card to be played.
  // w is the chance of drawing it after a major victory. Relic cards (w: 0) come only from the systems that hold them.
  cards: {
    support:  { name: 'FIRE SUPPORT GRANT', kind: 'BATTLE', when: 'battle', text: '+5 strength, spread over the fights still open in one battle.', w: 3 },
    blockade: { name: 'ORBITAL BLOCKADE',   kind: 'BATTLE', when: 'battle', text: 'Enemy strength in one battle −30%.', w: 2 },
    evac:     { name: 'RECALL',             kind: 'BATTLE', when: 'battle', text: 'Call off the open fights of one operation. Those troops come home.', w: 1 },
    convoy:   { name: 'FUEL CONVOY',        kind: 'MISSION', when: 'plan', text: '+6 fuel.', w: 2 },
    fortify:  { name: 'FORTIFY',            kind: 'MISSION', when: 'plan', text: '+4 defence on the selected system while you hold it.', w: 2, needs: 'planet' },
    bonds:    { name: 'WAR BONDS DRIVE',    kind: 'PROPAGANDA', when: 'plan', text: '+12 morale.', w: 3 },
    broadcast:{ name: 'RECRUITMENT REEL',   kind: 'PROPAGANDA', when: 'plan', text: '+4 Vanguard.', w: 2 },
    rally:    { name: 'TO THE FRONT!',      kind: 'PROPAGANDA', when: 'plan', text: 'This round your major offensive or defence order counts double instead of +50%.', w: 2, needs: 'directive' },
    newsreel: { name: 'VICTORY NEWSREEL',   kind: 'PROPAGANDA', when: 'plan', text: 'If this round\'s major offensive takes its system: +10 morale and +4 Vanguard.', w: 2, needs: 'offensive' },
    armada:   { name: 'THE HOME FLEET',     kind: 'RELIC', when: 'battle', text: '+10 strength in one battle.', w: 0 },
    levy:     { name: 'GENERAL LEVY',       kind: 'RELIC', when: 'plan', text: '+8 Army.', w: 0 },
    anthem:   { name: 'THE ANTHEM',         kind: 'RELIC', when: 'plan', text: '+20 morale and +3 Vanguard.', w: 0 },
    snap:     { name: 'SNAP MOBILISATION',  kind: 'RELIC', when: 'plan', text: 'The selected enemy\'s front is mobilised and ready now, free.', w: 0, needs: 'front' },
    cache:    { name: 'STRATEGIC RESERVE',  kind: 'RELIC', when: 'plan', text: '+10 fuel.', w: 0 },
    bulwark:  { name: 'PLANETARY SHIELD',   kind: 'RELIC', when: 'plan', text: '+8 defence on the selected system while you hold it.', w: 0, needs: 'planet' },
  },
  // Six systems each keep one relic card. While you hold a relic system and a lane reaches it, its card comes back
  // to your hand every `every` rounds; retaking the system gives the card at once.
  relic: { cards: ['armada', 'levy', 'anthem', 'snap', 'cache', 'bulwark'], first: 5, every: 9 },
  // Each enemy has a deck of three. It gains a card on a major win and plays one at the start of its turn.
  enemyCards: {
    swarm:   { frenzy: { name: 'FEEDING FRENZY', text: 'its attacks this round are 50% stronger' }, brood: { name: 'BROOD SURGE', text: '+8 force' },
               tunnel: { name: 'TUNNEL BREACH', text: 'it may strike one system behind your line' } },
    foundry: { surge: { name: 'PRODUCTION SURGE', text: '+9 force' }, engines: { name: 'SIEGE ENGINES', text: 'its blow this round is +4 stronger' },
               dig: { name: 'IRON LINE', text: 'its garrisons are +3 for three rounds' } },
    veil:    { conversion: { name: 'MASS CONVERSION', text: '−8 morale, −2 Vanguard' }, shroud: { name: 'THE SHROUD', text: 'its attacks this round are hidden' },
               dread: { name: 'DREAD', text: '−5 morale and no Vanguard volunteers this round' } },
  },
  retake: 2,         // force an enemy spends to overrun one of your stranded worlds
  frenzy: 1.5, conversion: { morale: 8, drop: 2 },
};
