// Every number and every name in the game lives here, so the prototype can be retuned or renamed in one place.
export const VERSION = '0.2.0';

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
    refinery: { name: 'GAS REFINERY',   col: '#d9a45b', res: 'fuel', y: 0.15, fav: 'sabotage', text: 'Pays fuel. Its platforms are fragile.' },
    forge:    { name: 'FORGE WORLD',    col: '#c8643c', res: 'army', y: 0.17, fav: 'sabotage', text: 'Raises the Army. Its factories are fragile.' },
    colony:   { name: 'COLONY',         col: '#5fa8d8', res: 'drop', y: 0.11, fav: 'assault',  text: 'Sends Vanguard volunteers. Best taken fast.' },
    fortress: { name: 'FORTRESS WORLD', col: '#9aa7a0', fort: 2,     fav: 'siege',    text: 'Adds to the system\'s defence. Only a siege cracks it.' },
    barren:   { name: 'BARREN WORLD',   col: '#6f6a62', fav: null, text: 'Rock. Nothing to gain but the ground.' },
  },
  capitalYield: { fuel: 0.5, army: 1.2, drop: 0.4 },
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
    swarm:   { init: 16, grow: 3.0, per: 0.35, ramp: 0.09, spend: 0.8, targets: 3, minStr: 2.5 },
    foundry: { init: 18, grow: 2.6, per: 0.20, ramp: 0.08, spend: 0.75, targets: 1, hold: 9 },
    veil:    { init: 18, grow: 3.0, per: 0.30, ramp: 0.09, spend: 0.8, targets: 2, deep: 0.6, minStr: 3 },
  },
  garr: { base: 4, ring: 1.3, force: 0.2, home: 1.5, perPlanet: 2, fortress: 1.5 },   // strength of an enemy-held planet
  cut: 0.5,          // a planet cut off from its capital or home fights at half strength
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
  op: { general: 2, major: 4, fuel: 1, fuelRing: 1.5 },
  // A major offensive must be mobilised first: pay, wait a round, then launch within `last` rounds.
  mob: { fuel: 2, last: 3 },   // fuel = fuel + fuelRing × distance from the capital
  reach: 0.05,       // supply reach: an operation loses this share of its strength for each ring past the first
  dir: { boost: 1.5, drain: 0.85 },
  retal: 6,          // free strength for an operation on a front that just failed to take the capital
  scrap: 2,          // Army gained for each Foundry planet taken
  veilCost: 2,       // morale lost for each operation against the Veil
  veilDrain: 0.25,    // morale lost per round for each planet the Veil holds

  def: { max: 5, perArmy: 1.3, margin: 1.25 },   // automatic defence: Army sent per battle
  capitalRally: 4,
  rally: 0.6,        // extra Vanguard per round for each ring the enemy is inside ring 3
  mor: { off: 4, offLoss: 3, def: 1, defLoss: 4, kill: 12, drift: 2 },

  battle: { dur: 12, rate: 0.13, noise: 0.07, hold: 1.4 },
  secondary: 2,

  cards: {
    support:  { name: 'FIRE SUPPORT GRANT', when: 'battle', text: '+5 strength in one battle.', w: 3 },
    blockade: { name: 'ORBITAL BLOCKADE',   when: 'battle', text: 'Enemy strength in one battle −30%.', w: 2 },
    evac:     { name: 'RECALL',             when: 'battle', text: 'Call off one operation. Everything sent comes home.', w: 1 },
    bonds:    { name: 'WAR BONDS DRIVE',    when: 'plan',   text: '+12 morale.', w: 3 },
    broadcast:{ name: 'RECRUITMENT REEL',   when: 'plan',   text: '+4 Vanguard.', w: 2 },
    convoy:   { name: 'FUEL CONVOY',        when: 'plan',   text: '+6 fuel.', w: 2 },
    fortify:  { name: 'FORTIFY',            when: 'plan',   text: '+4 defence on the selected planet, for good.', w: 2, planet: true },
  },
  enemyCards: { swarm: 'FEEDING FRENZY', foundry: 'PRODUCTION SURGE', veil: 'MASS CONVERSION' },
  frenzy: 1.5, surge: 6, conversion: { morale: 8, drop: 2 },
};
