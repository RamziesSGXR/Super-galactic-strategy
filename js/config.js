// Every number and every name in the game lives here, so the prototype can be retuned or renamed in one place.
export const VERSION = '0.4.0';

export const C = {
  names: {
    game: 'SUPER GALACTIC STRATEGY',
    fed: 'Federation',
    capital: 'Aurelia',
    drop: 'VANGUARD',   // elite volunteers: volatile, follow a cause
    army: 'ARMY',       // steady backbone
    fuel: 'FUEL',
    factions: { swarm: 'The Swarm', foundry: 'The Foundry', veil: 'The Veil' },
    homes: ['Nest Prime', 'Anvil', 'Lumen Null'],
    planets: ['Tarsen', 'Okoro', 'Vell', 'Duskar', 'Imrie', 'Pallas Reach', 'Korvan', 'Sable', 'Ythe', 'Marrow',
      'Calder', 'Nimbus Gate', 'Orrin', 'Brakk', 'Solen', 'Vantage', 'Kessrin', 'Halcyon', 'Dray', 'Umber',
      'Lyss', 'Penumbra', 'Garnet', 'Ostra', 'Javel', 'Quill', 'Rookfall', 'Stenn', 'Wend', 'Zorya',
      'Thane', 'Corvale', 'Isk', 'Meru', 'Aldous Drift', 'Brine'],
  },
  // The ministries, as in FOB Super Commander. Each is a tab; `does` is the one line shown under its name.
  ministries: {
    int: { name: 'INTELLIGENCE', does: 'Reports, warnings and suggested actions.' },
    def: { name: 'DEFENCE',      does: 'Orders: operations, mobilisation, defence.' },
    pro: { name: 'PROSPERITY',   does: 'Manages what you have: stock, income, exchange.' },
    exp: { name: 'EXPANSION',    does: 'Grows what you have: develops your systems.' },
    tru: { name: 'TRUTH',        does: 'Keeps morale up and deals with dissidents.' },
    hum: { name: 'HUMANITY',     does: 'Regulates the population: volunteers or conscripts.' },
    emp: { name: 'EMPLOYMENT',   does: 'Decides which route the work and supply flow to.' },
    uni: { name: 'UNITY',        does: 'The standing of the war.' },
  },
  factions: ['swarm', 'foundry', 'veil'],   // the order of arrival; their homes sit on routes 0, 2 and 4 of six
  color: { fed: '#7fe9e0', swarm: '#ff9a3d', foundry: '#ff6a4d', veil: '#b58cff', amber: '#f5d547' },

  start: { res: { fuel: 10, drop: 6, army: 10 }, morale: 60 },
  resMax: 30,

  // The worlds inside each star system. A world pays its resource each round while its system is linked to the
  // capital. One world per system is the key world: the only one fought over, and its kind suits one kind of mission.
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
  fort: { capital: 15, gate: 4, junction: 4, mid: 3, outer: 3, frontier: 3, home: 3 },

  // Arrival: round, plus or minus `vary`. The warning comes `warn` rounds before.
  arrive: { swarm: { round: 2, vary: 0 }, foundry: { round: 7, vary: 1 }, veil: { round: 12, vary: 2 } },
  warn: 2,

  // Enemy behaviour. force grows each round by grow + per × systems + ramp × round.
  enemy: {
    swarm:   { init: 16, grow: 3.0, per: 0.35, ramp: 0.16, spend: 0.8, targets: 3, minStr: 2.5 },
    foundry: { init: 18, grow: 2.6, per: 0.20, ramp: 0.14, spend: 0.75, targets: 1, hold: 9 },
    veil:    { init: 18, grow: 3.0, per: 0.30, ramp: 0.16, spend: 0.8, targets: 2, deep: 0.6, minStr: 3 },
  },
  garr: { base: 4, ring: 1.3, force: 0.2, home: 1.5, perPlanet: 2, fortress: 1.5, dig: 3 },   // strength of an enemy-held system
  cut: 0.5,          // a system cut off from its capital or home fights at half strength
  pinNeed: 0.5,      // an operation pins an attack only if it is at least this share of the attack's strength
  pin: 0.5,          // the share of a pinned attack that joins the garrison
  winBack: 0.35,     // share of an attack's force the enemy keeps after winning

  weak: { swarm: 'siege', foundry: 'sabotage', veil: 'assault' },   // the kind of mission each enemy cannot take
  weakAdd: 0.5, favAdd: 0.25,   // strength added for hitting the enemy's weak point, and for suiting the key world
  // A general attack carries at most `general` mission cards. A major offensive carries up to `major`.
  op: { general: 2, major: 4, fuel: 1, fuelRing: 1.2 },
  // A major offensive must be mobilised first: pay, wait a round, then launch within `last` rounds.
  mob: { fuel: 2, last: 3 },
  reach: 0.05,       // supply reach: an operation loses this share of its strength for each ring past the first
  dir: { boost: 1.5, drain: 0.85, rallied: 2 },
  retal: 6,          // free strength for an operation on a front that just failed to take the capital
  scrap: 2,          // Army gained for each Foundry system taken
  veilCost: 2,       // morale lost for each operation against the Veil
  veilDrain: 0.25,   // morale lost per round for each system the Veil holds

  def: { max: 5, perArmy: 1.3, margin: 1.25 },   // automatic defence: Army sent per battle
  capitalRally: 4,
  rally: 0.6,        // extra Vanguard per round for each ring the enemy is inside ring 3
  mor: { off: 4, offLoss: 3, def: 1, defLoss: 4, kill: 12, drift: 2 },

  battle: { dur: 12, rate: 0.13, noise: 0.07, hold: 1.4 },
  secondary: 2,

  // ---------- the deck ----------
  // You draw `hand` cards each round (+1 at high morale, −1 at low) and discard what is left after the battles.
  // A used card goes to the discard pile and comes round again when the draw pile runs out.
  deck: { hand: 5, high: 70, low: 30 },
  // type: mission (played on an enemy system), order (on a system of yours), battle (during the fighting),
  //       propaganda, logistics, dissent (dead weight), relic (rare, removed after use).
  // fam: which kind of mission it counts as, for enemy weak points and key worlds.
  // starter: copies in the opening deck. w: chance of being offered after a major victory.
  cards: {
    assault:   { name: 'ASSAULT',   type: 'mission', fam: 'assault',  str: 4, cost: { drop: 2 }, text: 'Vanguard drop in force.', starter: 3, w: 2 },
    siege:     { name: 'SIEGE',     type: 'mission', fam: 'siege',    str: 4, cost: { army: 3 }, text: 'The Army grinds forward.', starter: 3, w: 2 },
    sabotage:  { name: 'SABOTAGE',  type: 'mission', fam: 'sabotage', str: 4, cost: { drop: 1, army: 2 }, text: 'Small teams hit what the enemy runs on.', starter: 2, w: 2 },
    spearhead: { name: 'VANGUARD SPEARHEAD', type: 'mission', fam: 'assault', str: 7, cost: { drop: 3 }, text: 'The best of the volunteers, all at once.', w: 2 },
    armour:    { name: 'ARMOURED COLUMN', type: 'mission', fam: 'siege', str: 7, cost: { army: 4 }, text: 'Heavy and slow, and it does not stop.', w: 2 },
    infiltrate:{ name: 'INFILTRATORS', type: 'mission', fam: 'sabotage', str: 2, cost: { drop: 1 }, text: 'Enemy strength in this operation −20%.', sap: 0.8, w: 2 },
    bombard:   { name: 'ORBITAL BOMBARDMENT', type: 'mission', fam: 'siege', str: 3, cost: { fuel: 2 }, text: 'No troops risked. Fuel only.', w: 2 },
    garrison:  { name: 'REINFORCE', type: 'order', needs: 'planet', cost: { army: 2 }, text: '+4 defence on one of your systems this round.', starter: 1, w: 2 },
    fortify:   { name: 'FORTIFY',   type: 'order', needs: 'planet', cost: { fuel: 2 }, text: '+3 defence on one of your systems while you hold it.', w: 2 },
    support:   { name: 'FIRE SUPPORT', type: 'battle', text: '+5 strength in one battle.', starter: 1, w: 3 },
    blockade:  { name: 'ORBITAL BLOCKADE', type: 'battle', text: 'Enemy strength in one battle −30%.', w: 2 },
    evac:      { name: 'RECALL', type: 'battle', text: 'Call off one operation. Its troops come home.', w: 1 },
    bonds:     { name: 'WAR BONDS DRIVE', type: 'propaganda', text: '+10 morale.', starter: 1, w: 2 },
    broadcast: { name: 'RECRUITMENT REEL', type: 'propaganda', text: '+4 Vanguard.', w: 2 },
    rally:     { name: 'TO THE FRONT!', type: 'propaganda', needs: 'directive', text: 'Your offensive or defence order counts double this round.', w: 2 },
    newsreel:  { name: 'VICTORY NEWSREEL', type: 'propaganda', needs: 'offensive', text: 'If the offensive takes its system: +10 morale, +4 Vanguard.', w: 1 },
    convoy:    { name: 'FUEL CONVOY', type: 'logistics', text: '+5 fuel.', starter: 1, w: 2 },
    levy:      { name: 'CONSCRIPT LEVY', type: 'logistics', text: '+5 Army, −3 morale.', w: 2 },
    dissent:   { name: 'DISSENT', type: 'dissent', text: 'Does nothing. Takes a place in your hand until the Ministry of Truth removes it.' },
    armada:    { name: 'THE HOME FLEET', type: 'relic', when: 'battle', text: '+10 strength in one battle.' },
    reserve:   { name: 'GENERAL RESERVE', type: 'relic', text: '+8 Army.' },
    anthem:    { name: 'THE ANTHEM', type: 'relic', text: '+20 morale and +3 Vanguard.' },
    snap:      { name: 'SNAP MOBILISATION', type: 'relic', needs: 'front', text: 'The selected enemy\'s front is mobilised and ready now, free.' },
    cache:     { name: 'STRATEGIC RESERVE', type: 'relic', text: '+10 fuel.' },
    bulwark:   { name: 'PLANETARY SHIELD', type: 'relic', needs: 'planet', text: '+8 defence on one of your systems while you hold it.' },
  },
  // Six systems each keep one relic card. While you hold a relic system and a lane reaches it, its card comes to
  // your hand every `every` rounds; retaking the system gives the card at once.
  relic: { cards: ['armada', 'reserve', 'anthem', 'snap', 'cache', 'bulwark'], first: 5, every: 9 },

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
  route: { fort: 1.5, yield: 1.25, fuel: 1 },         // Employment: the priority route defends better, pays more, and is cheaper to operate on

  // Each enemy has a deck of three. It gains a card on a major win and plays one at the start of its turn.
  enemyCards: {
    swarm:   { frenzy: { name: 'FEEDING FRENZY', text: 'its attacks this round are 50% stronger' }, brood: { name: 'BROOD SURGE', text: '+8 force' },
               tunnel: { name: 'TUNNEL BREACH', text: 'it may strike one system behind your line' } },
    foundry: { surge: { name: 'PRODUCTION SURGE', text: '+9 force' }, engines: { name: 'SIEGE ENGINES', text: 'its blow this round is +4 stronger' },
               dig: { name: 'IRON LINE', text: 'its garrisons are +3 for three rounds' } },
    veil:    { conversion: { name: 'MASS CONVERSION', text: '−8 morale, −2 Vanguard' }, shroud: { name: 'THE SHROUD', text: 'its attacks this round are hidden' },
               dread: { name: 'DREAD', text: '−5 morale and no Vanguard volunteers this round' } },
  },
  frenzy: 1.5, conversion: { morale: 8, drop: 2 },
};
