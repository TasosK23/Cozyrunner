/**
 * balance.js — every tunable number in the game lives here.
 *
 * Units: the world is measured in "units". Bramble is ~46 units tall, the screen
 * is always VIEW.width (520) units wide, whatever the phone. Time is in seconds.
 * Change a number, reload, feel the difference. The chunk validator (tests/validate.mjs)
 * re-proves that every obstacle pattern is still beatable with your new numbers.
 */

/** 18 world units = 1 "meter" on the score screen. */
export const UNITS_PER_METER = 18;

export const VIEW = {
  width: 520,       // logical units visible horizontally
  playerX: 0.25,    // where Bramble sits on screen (fraction of width)
  groundFrac: 0.68, // where the ground line sits (fraction of visible height)
  lookahead: 1300,  // how far ahead of Bramble the course is already built
};

/** Fixed-timestep simulation: always 60 updates/second, regardless of display refresh. */
export const SIM = { dt: 1 / 60, maxSteps: 6 };

/** Bramble's movement. These feed BOTH the game and the beatability solver. */
export const PLAYER = {
  gravity: 2300,        // u/s^2. Full jump apex = jumpV^2 / (2*gravity) = ~135 units
  jumpV: 790,           // launch speed of a jump
  jumpCutV: 420,        // letting go early caps upward speed to this -> tiny tap = ~50u hop
  coyote: 0.10,         // s you can still jump after running off a ledge
  jumpBuffer: 0.12,     // s a too-early tap is remembered and fires on landing
  glideDur: 0.55,       // s the leaf flutter lasts (one flutter per jump)
  glideFall: 85,        // u/s max fall speed while gliding
  glideGravity: 1500,
  glideLift: 90,        // little upward puff when the flutter starts
  glideMinY: 26,        // must be at least this high to glide (otherwise the tap is buffered as a jump)
  glideMinAir: 0.07,    // s of air time before a glide is allowed (anti-spam)
  glideMaxRise: 200,    // can't glide while still shooting upward faster than this
  fastFallV: 950,       // swipe down in the air
  slideDur: 0.55,       // s of a slide
  slideOnLand: 0.35,    // fast-fall -> automatic roll on landing
  standW: 28, standH: 46,   // hitbox standing
  slideW: 38, slideH: 24,   // hitbox sliding
  forgive: 3,           // game shrinks Bramble's hitbox by this much per side (the solver GROWS it by 5)
  edgePad: 8,           // ledges count 8u wider than drawn (kind to late jumps)
  ledgeSave: 22,        // brushing a ledge from slightly below still lands you
  fallY: -70,           // below this you've fallen into the clouds
  invuln: 1.5,          // s of blink-invulnerability after a bump
  hearts: 3,            // "warmth hearts" at the start of a run
  maxHearts: 6,
  bounceV: 1080,        // Bouncy Mushroom launch speed (apex ~250u, ~1 s of air)
};

/** Speed ramps smoothly from start toward max as meters accumulate. */
export const SPEED = { start: 250, max: 430, tauMeters: 1600 };
export function speedAt(meters) {
  return SPEED.start + (SPEED.max - SPEED.start) * (1 - Math.exp(-meters / SPEED.tauMeters));
}

/** Hazard geometry (hitboxes, in units). Art is a bit bigger than the hitbox on purpose. */
export const HAZARDS = {
  snail: { w: 38, h: 28 },
  vine: { w: 44, bottom: 36, top: 3000 },   // hangs from above; bottom edge is 36u above ground
  drop: { r: 9 },                            // a grumble-cloud raindrop is an 18x18 box
  pad: { w: 58, h: 22, pad: 6 },             // bouncy mushroom: bounce zone is 6u wider than drawn
  nearMiss: { snailClear: 12, vineSlideLeft: 0.09, gapLand: 26 },
};

/**
 * Speed zones. They change Bramble's forward speed while she is inside them (with a soft 40u ramp
 * at each edge). The beatability solver uses these exact same numbers, so every zone is proven fair.
 */
export const ZONES = { fluff: 0.72, gustTail: 1.22, gustHead: 0.80, fog: 1.0, ramp: 40 };

/** Biomes: each lasts this many meters, then Bramble walks through a glowing doorway into the next. */
export const BIOME = { lengthM: 500, blendU: 260 };

/** Festival Moment: a calm bonus stretch every ~1000 m. Tap on the beat for bonus seeds. */
export const FESTIVAL = { everyM: 1000, beats: 4, beatLen: 0.62, lead: 0.55, window: 0.15, perfectSeeds: 3, allBonus: 25 };

/** Surprise events (variable rewards). A separate seeded stream, so they never disturb the course. */
export const EVENTS = { chance: 0.13, cooldownChunks: 5, minM: 250 };

/** Power-ups. dur is seconds before upgrades/companions stretch it. */
export const POWER = {
  warn: 1.6,
  honey: { dur: 9, radius: 175 },
  hop: { dur: 14, jumps: 3 },
  dash: { dur: 4, mul: 1.38 },
  burst: { dur: 5, radius: 175 },
  blanket: { dur: 30 },
};

export const SCORE = {
  perMeter: 1, seed: 10, lantern: 40, firefly: 250, letter: 60, word: 400, nearMiss: 25, tea: 15,
  perfectBeat: 30, goldSeed: 30,
  glowDistanceBonus: 1.5,   // distance points are x1.5 while Bramble's lantern is glowing
};

/** Combo: chained pickups & near-misses raise the multiplier; it vanishes if you stop. */
export const COMBO = {
  timeout: 2.2, perLevel: 6, maxMult: 6,
  seedChain: 1, lanternChain: 2, fireflyChain: 5, letterChain: 2, teaChain: 2, nearMissChain: 4,
};

export const GLOW = { perLantern: 35, max: 100, drain: 6, magnet: 80 };

/** Time effects (juice). */
export const JUICE = { hitStopTicks: 3, slowMoScale: 0.45, zoomMin: 0.93, speedLinesFrom: 0.45 };

export const PICKUP = { seedR: 11, lanternR: 18, teaR: 15, fireflyR: 16, letterR: 15, powerR: 18, reach: 22 };

/** How the generator decorates "slots" in chunks with special pickups. */
export const SPAWN = {
  lanternChance: 0.22, teaChance: 0.07, letterChance: 0.3, letterMinGapM: 60,
  fireflyChance: 0.015, fireflyMinM: 300,
  powerChance: 0.07, powerMinM: 150, powerMinGapM: 120,
};

export const WORD = ['C', 'O', 'Z', 'Y'];

/** Difficulty director. */
export const DIRECTOR = {
  heatLimit: 7,                                   // sum of chunk difficulties before a breather is forced
  metersPerLevel: 400,                            // target difficulty +1 every this many meters
  minMeters: { 1: 0, 2: 100, 3: 300, 4: 600, 5: 1000 },
};

/** Profile XP: always earned, so every run is worth something. */
export const XP = { perMeter: 0.12, perSeed: 0.6, perRun: 8, level1: 100, perLevelGrowth: 50, daily: 40 };

/** Mystery acorn chests. A chest is guaranteed after this many chest-less runs (a gentle pity timer). */
export const CHEST = { pityRuns: 4, baseChance: 0.28, newBestBonus: 0.15, questBonus: 0.12, dailyGuaranteed: true,
  weights: { common: 62, uncommon: 25, rare: 11, legendary: 2 } };

/** Daily rhythm. */
export const DAILY = { bonusSeeds: 40, freezesPerWeek: 1 };

/** A soft "stretch your legs" note on the game-over card after this many minutes of play in a session. */
export const BREAK_AFTER_MIN = 40;

export const POOLS = { hazards: 40, pickups: 260 };

export const DYING_TIME = 0.95;   // seconds from the last heart to the game-over card
