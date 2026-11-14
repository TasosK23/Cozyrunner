/**
 * biomes.js — the five regions of the dragon's volcanic realm.
 *
 * The dragon flies through them in order, BIOME.lengthM meters each (see balance.js), and then the
 * realm starts over with the Ashen Highlands (the Lake is the "finale" of each lap). Each biome has:
 *   - a palette (every color the renderer uses),
 *   - a `style` that picks which parallax art is painted,
 *   - a title card text, a music mood (see audio/music.js), a signature hazard, weather options.
 * To add a biome: copy one entry, change the colors, add it to BIOME_ORDER, add chunks that list it
 * in their `biomes` array, and give it a mood in audio/music.js.
 */
export const BIOMES = {
  // ids are kept from the first version of the game (chunks and music refer to them); the names, colors and art are the dragon world.
  meadow: {
    id: 'meadow', name: 'Ashen Highlands', sub: 'Dusk, drifting ash, distant fires',
    hazard: 'Drifting ash clouds drag you down to half pace',
    skyTop: '#2f2340', skyMid: '#9a4638', skyHorizon: '#f0a05a',
    sun: '#ffd7a0', sunY: 0.3, sunVis: 1, night: 0.12, moonVis: 0,
    cloud: '#7a5060', cloudShade: '#4f3544',
    hillFar: ['#6a4352', '#4d3340'], hillNear: ['#4a3a40', '#33292f'],
    treeA: '#4d3a38', treeB: '#3b2d2e', trunk: '#241a1c',
    bush: ['#54463c', '#43372f'], flowers: ['#ff8a3a', '#ffb347', '#ff5a2a', '#ffd36a'],
    sea: ['#7c4350', '#5a2f3b', '#3b2029'],
    grass: '#7b6a48', grassLight: '#a99361', grassDark: '#4a3b28',
    soilTop: '#4d3b3b', soilBottom: '#271d21', soilDot: '#1a1216', root: '#2a1c1e',
    islet: '#6b5a45', isletSoil: '#382a2b', accent: '#ff8a3a', glow: '#ff8a3a',
    style: { far: 'hills', near: 'trees', sea: 'clouds' },
    weather: ['ash', 'ash', 'embers', 'none'],
  },
  teacup: {
    id: 'teacup', name: 'Ruined Keep', sub: 'Torchlit walls, falling cinders, old battle',
    hazard: 'Smoke clouds rain down glowing cinders',
    skyTop: '#241f38', skyMid: '#6a3f52', skyHorizon: '#e08755',
    sun: '#ffc88a', sunY: 0.42, sunVis: 0.8, night: 0.3, moonVis: 0,
    cloud: '#7a5868', cloudShade: '#4d3646',
    hillFar: ['#4c4660', '#3a3550'], hillNear: ['#57535f', '#403d48'],
    treeA: '#4f4640', treeB: '#3e3733', trunk: '#2a2220',
    bush: ['#4c453d', '#3d3730'], flowers: ['#ff9a4a', '#ffd36a', '#ff6a3a', '#ffe8b0'],
    sea: ['#7a4852', '#563340', '#3a2330'],
    grass: '#6f6a55', grassLight: '#948c70', grassDark: '#47412f',
    soilTop: '#55494d', soilBottom: '#2b2328', soilDot: '#1d171c', root: '#2c2024',
    islet: '#6c6552', isletSoil: '#3c3034', accent: '#ff9a4a', glow: '#ffa040',
    windows: '#ffb347',
    style: { far: 'village', near: 'houses', sea: 'clouds' },
    weather: ['rain', 'embers', 'ash', 'embers'],
  },
  grove: {
    id: 'grove', name: 'Emberdeep Caverns', sub: 'Lava veins, glowing crystal, steam vents',
    hazard: 'Steam vents blast you skyward',
    skyTop: '#12081a', skyMid: '#2c1330', skyHorizon: '#7a2a2c',
    sun: '#ffb070', sunY: 0.3, sunVis: 0, night: 0.75, moonVis: 0,
    cloud: '#5a3548', cloudShade: '#3a2132',
    hillFar: ['#3d2238', '#2b1829'], hillNear: ['#4a2c38', '#331f2b'],
    treeA: '#3e2a3a', treeB: '#2f1f2d', trunk: '#241520',
    bush: ['#4a2e36', '#3a2229'], flowers: ['#ff6a3a', '#ffb347', '#3fd0c0', '#ff4a6a'],
    sea: ['#5a2230', '#7a2c28', '#a8401e'],
    grass: '#5a4650', grassLight: '#7d636b', grassDark: '#3a2a34',
    soilTop: '#4a3340', soilBottom: '#241821', soilDot: '#180f17', root: '#2a1a24',
    islet: '#5d4a52', isletSoil: '#33222b', accent: '#ff6a3a', glow: '#ff7a3a',
    style: { far: 'grove', near: 'mushrooms', sea: 'mist' },
    weather: ['embers', 'embers', 'sparks'],
  },
  heights: {
    id: 'heights', name: 'Stormspire Peaks', sub: 'Thunderheads, jagged stone, howling gales',
    hazard: 'Gales shove you faster or slower',
    skyTop: '#161d2e', skyMid: '#38435e', skyHorizon: '#8795b0',
    sun: '#e6efff', sunY: 0.22, sunVis: 0, night: 0.25, moonVis: 0,
    cloud: '#5f6b88', cloudShade: '#3d465e',
    hillFar: ['#4b5675', '#38425f'], hillNear: ['#4b4d58', '#363842'],
    treeA: '#3b4150', treeB: '#2f3441', trunk: '#222733',
    bush: ['#454956', '#383c48'], flowers: ['#9fd0ff', '#e6f0ff', '#ffe08a', '#b0b8ff'],
    sea: ['#59658a', '#414c6e', '#2c3552'],
    grass: '#59606a', grassLight: '#7f8793', grassDark: '#3b4049',
    soilTop: '#4a4d5b', soilBottom: '#262833', soilDot: '#1a1c26', root: '#262836',
    islet: '#6a7080', isletSoil: '#383b4a', accent: '#9fd0ff', glow: '#9fd0ff',
    style: { far: 'peaks', near: 'berries', sea: 'clouds' },
    weather: ['rain', 'wind', 'wind', 'snow'],
  },
  lake: {
    id: 'lake', name: 'Obsidian Lava Lake', sub: 'Night, molten glow, a blood-red moon',
    hazard: 'Choking smoke hides the far path',
    skyTop: '#0b0710', skyMid: '#26111f', skyHorizon: '#7d2a1c',
    sun: '#ffe0c0', sunY: 0.2, sunVis: 0, night: 1, moon: true, moonVis: 1,
    cloud: '#5a2f3c', cloudShade: '#3a1f2b',
    hillFar: ['#33192a', '#26101f'], hillNear: ['#2e1c2a', '#221320'],
    treeA: '#2c1a28', treeB: '#22131f', trunk: '#1a0f18',
    bush: ['#321e2c', '#27161f'], flowers: ['#ff7a2a', '#ffb347', '#ff4a3a', '#ffe08a'],
    sea: ['#5c1c12', '#a8321a', '#ff7a2a'],
    grass: '#4a3a40', grassLight: '#6d5a5f', grassDark: '#2f2227',
    soilTop: '#3d2c36', soilBottom: '#1c1218', soilDot: '#120a10', root: '#1f1219',
    islet: '#4b3a40', isletSoil: '#291b23', accent: '#ff7a2a', windows: '#ffb347', glow: '#ff7a2a',
    style: { far: 'mountains', near: 'reeds', sea: 'water' },
    weather: ['sparks', 'embers', 'embers', 'ash'],
  },
};

export const BIOME_ORDER = ['meadow', 'teacup', 'grove', 'heights', 'lake'];

/** Which biome index (0..4) a distance in meters belongs to. The garden loops after the Lake. */
export function biomeIndexAt(meters, lengthM) {
  return Math.floor(Math.max(0, meters) / lengthM) % BIOME_ORDER.length;
}

/** How many full laps of the garden the distance has completed (0 on the first lap). */
export function lapAt(meters, lengthM) {
  return Math.floor(Math.max(0, meters) / (lengthM * BIOME_ORDER.length));
}

// ---------------------------------------------------------------- palette mixing (for biome blends)
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a, b, u) {
  const A = hexToRgb(a); const B = hexToRgb(b);
  const r = Math.round(A[0] + (B[0] - A[0]) * u);
  const g = Math.round(A[1] + (B[1] - A[1]) * u);
  const bl = Math.round(A[2] + (B[2] - A[2]) * u);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Blend two palettes. Non-color fields (style, ids) come from whichever side is closer. */
export function mixPalette(a, b, u) {
  const out = {};
  for (const k of Object.keys(a)) {
    const va = a[k]; const vb = b[k];
    if (typeof va === 'string' && typeof vb === 'string' && va[0] === '#' && vb[0] === '#') out[k] = mixHex(va, vb, u);
    else if (Array.isArray(va) && Array.isArray(vb) && typeof va[0] === 'string' && va[0][0] === '#') {
      out[k] = va.map((c, i) => mixHex(c, vb[i % vb.length], u));
    } else if (typeof va === 'number' && typeof vb === 'number') out[k] = va + (vb - va) * u;
    else out[k] = u < 0.5 ? va : vb;
  }
  return out;
}
