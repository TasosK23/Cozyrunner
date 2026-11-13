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
 *   biomes    which biomes may use it ('*' = all). Stage 2 adds more biome-specific chunks.
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
];

export const CHUNK_BY_ID = Object.fromEntries(CHUNKS.map((c) => [c.id, c]));
