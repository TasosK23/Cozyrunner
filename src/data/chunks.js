/**
 * chunks.js — the hand-authored obstacle patterns the generator stitches together.
 *
 * A chunk is a short stretch of course. Coordinates are in world units RELATIVE to the chunk's
 * left edge (x = 0). Bramble always enters a chunk standing on the ground.
 *
 *   id        unique name
 *   diff      0 = breather (no hazards, coin trails), 1..5 = difficulty
 *   len       total length in units
 *   hazards   [['snail', x], ['vine', x]]  x = left edge of the hazard
 *   gaps      [[x, width]]                 holes in the island
 *   pickups   [{t:'seed'|'slot'|'tea', x, y}]  y = height above ground.
 *             'slot' = a spot the generator may turn into a lantern / tea / letter / firefly
 *             (or a plain seed when nothing special rolls).
 *   w         pick weight (default 1)
 *   biomes    which biomes may use it (leave out = all biomes). Stage 2 adds biome-specific chunks.
 *
 * HOW TO ADD A CHUNK: copy one below, change the numbers, then run  `node tests/validate.mjs`.
 * The validator proves a perfect player can clear it at every speed it can appear at, from
 * "standing on the ground" back to "standing on the ground". If it prints FAIL, loosen spacing.
 */

// ---- tiny helpers to write pickup shapes quickly --------------------------------------------
const seed = (x, y) => ({ t: 'seed', x, y });
const slot = (x, y) => ({ t: 'slot', x, y });
/** a straight line of n seeds */
const row = (x, y, n, dx = 26) => Array.from({ length: n }, (_, i) => seed(x + i * dx, y));
/** an arc of n seeds, rising `h` above `base` */
const arc = (x, w, h, n = 7, base = 24) =>
  Array.from({ length: n }, (_, i) => seed(x + (w * i) / (n - 1), base + h * Math.sin((Math.PI * i) / (n - 1))));
/** a sine wave of seeds */
const wave = (x, y, n, dx, amp) =>
  Array.from({ length: n }, (_, i) => seed(x + i * dx, y + amp * Math.sin(i * 0.8)));

export const CHUNKS = [
  // ---------------------------------------------------------------- the opening
  { id: 'start', diff: 0, len: 760, start: true, hazards: [], gaps: [], pickups: [...row(320, 26, 9)] },

  // ---------------------------------------------------------------- breathers (diff 0)
  { id: 'breather-trail', diff: 0, len: 640, hazards: [], gaps: [],
    pickups: [...row(110, 26, 12), slot(590, 60)] },
  { id: 'breather-arcs', diff: 0, len: 720, hazards: [], gaps: [],
    pickups: [...arc(110, 220, 70), ...arc(400, 220, 70), slot(340, 40)] },
  { id: 'breather-wave', diff: 0, len: 760, hazards: [], gaps: [],
    pickups: [...wave(100, 70, 15, 38, 36), slot(680, 50)] },
  { id: 'breather-tea', diff: 0, len: 680, hazards: [], gaps: [], w: 0.6,
    pickups: [...row(110, 26, 8), { t: 'tea', x: 400, y: 60 }, ...row(450, 26, 6)] },

  // ---------------------------------------------------------------- difficulty 1: one thing at a time
  { id: 'lone-snail', diff: 1, len: 600, hazards: [['snail', 300]], gaps: [],
    pickups: [...arc(220, 220, 66), slot(100, 40), slot(540, 40)] },
  { id: 'lone-vine', diff: 1, len: 600, hazards: [['vine', 300]], gaps: [],
    pickups: [...row(250, 14, 6, 24), slot(120, 40)] },
  { id: 'small-gap', diff: 1, len: 640, hazards: [], gaps: [[300, 90]],
    pickups: [...arc(250, 190, 80), slot(560, 40)] },
  { id: 'two-snails', diff: 1, len: 800, hazards: [['snail', 270], ['snail', 560]], gaps: [],
    pickups: [...arc(190, 220, 62, 6), ...arc(480, 220, 62, 6), slot(120, 40)] },

  // ---------------------------------------------------------------- difficulty 2: pairs
  { id: 'snail-vine', diff: 2, len: 860, hazards: [['snail', 270], ['vine', 600]], gaps: [],
    pickups: [...arc(190, 220, 62, 6), ...row(570, 14, 5, 24)] },
  { id: 'vine-snail', diff: 2, len: 860, hazards: [['vine', 270], ['snail', 600]], gaps: [],
    pickups: [...row(240, 14, 5, 24), ...arc(520, 220, 62, 6), slot(780, 40)] },
  { id: 'medium-gap', diff: 2, len: 700, hazards: [], gaps: [[300, 140]],
    pickups: [...arc(250, 240, 90), slot(100, 40)] },
  { id: 'snail-pair', diff: 2, len: 740, hazards: [['snail', 260], ['snail', 350]], gaps: [],
    pickups: [...arc(230, 200, 90, 8), slot(110, 40)] },
  { id: 'double-vine', diff: 2, len: 800, hazards: [['vine', 260], ['vine', 480]], gaps: [],
    pickups: [...row(240, 14, 4, 24), ...row(460, 14, 4, 24)] },

  // ---------------------------------------------------------------- difficulty 3: mixed
  { id: 'gap-snail', diff: 3, len: 920, hazards: [['snail', 640]], gaps: [[280, 110]],
    pickups: [...arc(230, 210, 80), ...arc(560, 210, 62, 6)] },
  { id: 'snail-gap', diff: 3, len: 920, hazards: [['snail', 270]], gaps: [[580, 100]],
    pickups: [...arc(190, 220, 62, 6), ...arc(530, 200, 80)] },
  { id: 'vine-gap', diff: 3, len: 940, hazards: [['vine', 250]], gaps: [[600, 110]],
    pickups: [...row(230, 14, 5, 24), ...arc(550, 210, 80)] },
  { id: 'gap-vine', diff: 3, len: 940, hazards: [['vine', 640]], gaps: [[280, 100]],
    pickups: [...arc(230, 200, 80), ...row(620, 14, 5, 24)] },
  { id: 'triple-snail', diff: 3, len: 1040, hazards: [['snail', 260], ['snail', 480], ['snail', 700]], gaps: [],
    pickups: [...arc(190, 220, 62, 6), ...arc(410, 220, 62, 6), ...arc(630, 220, 62, 6)] },
  { id: 'long-gap', diff: 3, len: 820, hazards: [], gaps: [[300, 230]],
    pickups: [...row(290, 86, 9, 30), slot(110, 40)] },
  { id: 'slalom', diff: 3, len: 1080, hazards: [['snail', 260], ['vine', 520], ['snail', 790]], gaps: [],
    pickups: [...arc(180, 220, 62, 6), ...row(490, 14, 5, 24), ...arc(710, 220, 62, 6)] },

  // ---------------------------------------------------------------- difficulty 4: rhythm
  { id: 'gap-gap', diff: 4, len: 980, hazards: [], gaps: [[260, 110], [580, 110]],
    pickups: [...arc(210, 210, 80), ...arc(530, 210, 80)] },
  { id: 'vine-snail-vine', diff: 4, len: 1180, hazards: [['vine', 260], ['snail', 560], ['vine', 860]], gaps: [],
    pickups: [...row(240, 14, 4, 24), ...arc(480, 220, 62, 6), ...row(840, 14, 4, 24)] },
  { id: 'glide-snail', diff: 4, len: 1100, hazards: [['snail', 700]], gaps: [[260, 210]],
    pickups: [...row(250, 90, 8, 30), ...arc(630, 200, 62, 6)] },
  { id: 'snails-gap', diff: 4, len: 1100, hazards: [['snail', 250], ['snail', 410]], gaps: [[700, 100]],
    pickups: [...arc(210, 240, 76, 8), ...arc(650, 200, 80)] },
  { id: 'snail-vine-snail', diff: 4, len: 1200, hazards: [['snail', 260], ['vine', 540], ['snail', 820]], gaps: [],
    pickups: [...arc(180, 220, 62, 6), ...row(520, 14, 4, 24), ...arc(740, 220, 62, 6)] },

  // ---------------------------------------------------------------- difficulty 5: the gauntlets
  { id: 'gauntlet', diff: 5, len: 1380, hazards: [['vine', 250], ['snail', 860], ['vine', 1110]], gaps: [[560, 100]],
    pickups: [...row(230, 14, 4, 24), ...arc(500, 200, 80), ...arc(780, 220, 62, 6), ...row(1090, 14, 4, 24)] },
  { id: 'glide-chain', diff: 5, len: 1380, hazards: [], gaps: [[260, 190], [760, 190]],
    pickups: [...row(250, 86, 7, 30), ...row(750, 86, 7, 30), slot(580, 40)] },
  { id: 'zigzag', diff: 5, len: 1340, hazards: [['snail', 250], ['vine', 480], ['snail', 710], ['vine', 940]], gaps: [],
    pickups: [...arc(170, 220, 62, 6), ...row(460, 14, 4, 24), ...arc(630, 220, 62, 6), ...row(920, 14, 4, 24)] },
  { id: 'gap-snail-gap', diff: 5, len: 1280, hazards: [['snail', 640]], gaps: [[250, 110], [920, 110]],
    pickups: [...arc(200, 210, 80), ...arc(560, 210, 62, 6), ...arc(870, 210, 80)] },
  // ================================================================ Stage 2: biome chunks
  // Extra keys:  biomes:[...]  zones:[{kind:'fluff'|'gustTail'|'gustHead'|'fog', x0, x1}]
  //              pads:[x]  (bouncy mushrooms)   rain:[x0,x1]  (a grumble cloud floats over this span)
  //              ['drop', x, y]  a raindrop hazard centred at height y.
  // The validator proves every one of these beatable at every speed, zones and mushrooms included.

  // ---- Honeydew Meadow: dandelion fluff slows you down
  { id: 'fluff-drift', diff: 0, len: 760, biomes: ['meadow'], hazards: [], gaps: [],
    zones: [{ kind: 'fluff', x0: 120, x1: 520 }],
    pickups: [...row(150, 30, 12, 28), slot(600, 50)] },
  { id: 'fluff-snail', diff: 1, len: 800, biomes: ['meadow'], hazards: [['snail', 470]], gaps: [],
    zones: [{ kind: 'fluff', x0: 90, x1: 330 }],
    pickups: [...row(130, 30, 8, 26), ...arc(390, 220, 66, 6), slot(110, 80)] },
  { id: 'fluff-gap', diff: 2, len: 860, biomes: ['meadow'], hazards: [], gaps: [[520, 100]],
    zones: [{ kind: 'fluff', x0: 100, x1: 360 }],
    pickups: [...row(130, 30, 8, 26), ...arc(470, 200, 80), slot(740, 40)] },
  { id: 'fluff-vine-snail', diff: 3, len: 1060, biomes: ['meadow'], hazards: [['vine', 420], ['snail', 760]], gaps: [],
    zones: [{ kind: 'fluff', x0: 90, x1: 300 }],
    pickups: [...row(130, 30, 7, 26), ...row(400, 14, 4, 24), ...arc(680, 220, 62, 6)] },

  // ---- Teacup Village: grumble clouds drip raindrops you weave through
  { id: 'rain-low', diff: 1, len: 700, biomes: ['teacup'], hazards: [['drop', 330, 20]], gaps: [], rain: [250, 430],
    pickups: [...arc(240, 190, 70, 6), slot(110, 40), slot(600, 40)] },
  { id: 'rain-high', diff: 1, len: 700, biomes: ['teacup'], hazards: [['drop', 330, 64]], gaps: [], rain: [250, 430],
    pickups: [...row(240, 24, 8, 26), slot(110, 40), slot(600, 40)] },
  { id: 'rain-weave', diff: 2, len: 1020, biomes: ['teacup'],
    hazards: [['drop', 300, 20], ['drop', 560, 64], ['drop', 820, 20]], gaps: [], rain: [230, 900],
    pickups: [...arc(220, 220, 70, 6), ...row(500, 24, 6, 26), ...arc(740, 200, 70, 6)] },
  { id: 'rain-snail', diff: 3, len: 1080, biomes: ['teacup'],
    hazards: [['drop', 300, 64], ['snail', 600], ['drop', 860, 64]], gaps: [], rain: [230, 940],
    pickups: [...row(240, 24, 6, 26), ...arc(520, 220, 66, 6), ...row(790, 24, 6, 26)] },
  { id: 'rain-gap', diff: 3, len: 940, biomes: ['teacup'], hazards: [['drop', 290, 20]], gaps: [[560, 100]], rain: [220, 420],
    pickups: [...arc(230, 200, 70, 6), ...arc(510, 200, 80), slot(800, 40)] },
  { id: 'rain-vine-drop', diff: 4, len: 1180, biomes: ['teacup'],
    hazards: [['vine', 270], ['drop', 600, 20], ['drop', 880, 64]], gaps: [], rain: [540, 960],
    pickups: [...row(250, 14, 5, 24), ...arc(520, 230, 70, 6), ...row(800, 24, 6, 26)] },

  // ---- Mossy Mushroom Grove: bouncy mushrooms (jump over them, or ride them to the sky seeds)
  { id: 'shroom-hop', diff: 1, len: 1000, biomes: ['grove'], hazards: [], gaps: [], pads: [300],
    pickups: [...row(110, 26, 5, 26), ...row(380, 190, 11, 28), ...row(410, 236, 9, 28), ...row(700, 26, 6, 26)] },
  { id: 'shroom-snail', diff: 2, len: 1240, biomes: ['grove'], hazards: [['snail', 930]], gaps: [], pads: [260],
    pickups: [...row(330, 200, 11, 28), ...arc(850, 220, 66, 6), slot(110, 40)] },
  { id: 'shroom-gap', diff: 3, len: 1280, biomes: ['grove'], hazards: [], gaps: [[940, 110]], pads: [260],
    pickups: [...row(330, 210, 10, 28), ...arc(880, 210, 80), slot(110, 40)] },
  { id: 'shroom-vine', diff: 3, len: 1240, biomes: ['grove'], hazards: [['vine', 900]], gaps: [], pads: [260],
    pickups: [...row(330, 205, 10, 28), ...row(880, 14, 5, 24), slot(110, 40)] },
  { id: 'shroom-twins', diff: 4, len: 1500, biomes: ['grove'], hazards: [['snail', 1110]], gaps: [], pads: [250, 700],
    pickups: [...row(320, 200, 9, 28), ...row(770, 200, 9, 28), ...arc(1040, 200, 62, 6)] },

  // ---- Cloudberry Heights: wind gusts push you faster or slower
  { id: 'gust-run', diff: 0, len: 760, biomes: ['heights'], hazards: [], gaps: [],
    zones: [{ kind: 'gustTail', x0: 100, x1: 520 }],
    pickups: [...row(130, 30, 14, 28), slot(620, 50)] },
  { id: 'gust-snail', diff: 2, len: 860, biomes: ['heights'], hazards: [['snail', 440]], gaps: [],
    zones: [{ kind: 'gustTail', x0: 90, x1: 400 }],
    pickups: [...row(130, 30, 9, 28), ...arc(360, 220, 66, 6)] },
  { id: 'gust-gap-head', diff: 2, len: 860, biomes: ['heights'], hazards: [], gaps: [[380, 100]],
    zones: [{ kind: 'gustHead', x0: 200, x1: 600 }],
    pickups: [...row(150, 30, 6, 28), ...arc(330, 200, 80), slot(740, 40)] },
  { id: 'gust-gap-tail', diff: 3, len: 960, biomes: ['heights'], hazards: [], gaps: [[420, 190]],
    zones: [{ kind: 'gustTail', x0: 120, x1: 520 }],
    pickups: [...row(380, 90, 8, 30), slot(130, 40), slot(800, 40)] },
  { id: 'gust-vine-snail', diff: 4, len: 1180, biomes: ['heights'], hazards: [['vine', 330], ['snail', 700]], gaps: [],
    zones: [{ kind: 'gustHead', x0: 110, x1: 330 }, { kind: 'gustTail', x0: 450, x1: 760 }],
    pickups: [...row(310, 14, 4, 24), ...arc(610, 200, 62, 6)] },

  // ---- Moonlit Lantern Lake: fog patches soften the far path (the hazards are still there!)
  { id: 'fog-trail', diff: 0, len: 760, biomes: ['lake'], hazards: [], gaps: [],
    zones: [{ kind: 'fog', x0: 60, x1: 640 }],
    pickups: [...wave(110, 60, 15, 36, 30), slot(380, 40), slot(680, 40)] },
  { id: 'fog-snails', diff: 2, len: 900, biomes: ['lake'], hazards: [['snail', 320], ['snail', 600]], gaps: [],
    zones: [{ kind: 'fog', x0: 80, x1: 760 }],
    pickups: [...arc(240, 220, 62, 6), ...arc(520, 220, 62, 6)] },
  { id: 'fog-vine-snail', diff: 3, len: 1000, biomes: ['lake'], hazards: [['vine', 320], ['snail', 620]], gaps: [],
    zones: [{ kind: 'fog', x0: 80, x1: 820 }],
    pickups: [...row(300, 14, 5, 24), ...arc(540, 220, 62, 6)] },
  { id: 'fog-gap', diff: 3, len: 920, biomes: ['lake'], hazards: [], gaps: [[420, 190]],
    zones: [{ kind: 'fog', x0: 80, x1: 760 }],
    pickups: [...row(380, 90, 8, 30), slot(150, 40)] },
  { id: 'fog-lantern-lane', diff: 4, len: 1240, biomes: ['lake'], hazards: [['snail', 280], ['vine', 560], ['snail', 860]], gaps: [],
    zones: [{ kind: 'fog', x0: 60, x1: 1000 }],
    pickups: [...arc(200, 200, 62, 6), ...row(540, 14, 4, 24), ...arc(780, 200, 62, 6), slot(1080, 50)] },

  // ---- the Lantern Festival: a calm stretch with nothing to dodge. Tap on the beat for bonus seeds.
  { id: 'festival', diff: 0, len: 1500, special: true, festival: true, hazards: [], gaps: [],
    pickups: [...arc(200, 340, 56, 9), ...arc(640, 340, 56, 9), ...arc(1080, 260, 56, 7)] },
];

export const CHUNK_BY_ID = Object.fromEntries(CHUNKS.map((c) => [c.id, c]));
