/**
 * biomes.js — the five regions of the floating garden.
 *
 * Bramble travels through them in order, BIOME.lengthM meters each (see balance.js), and then the
 * garden starts over with Honeydew Meadow (the Lake is the "finale" of each lap). Each biome has:
 *   - a palette (every color the renderer uses),
 *   - a `style` that picks which parallax art is painted,
 *   - a title card text, a music mood (see audio/music.js), a signature hazard, weather options.
 * To add a biome: copy one entry, change the colors, add it to BIOME_ORDER, add chunks that list it
 * in their `biomes` array, and give it a mood in audio/music.js.
 */
export const BIOMES = {
  meadow: {
    id: 'meadow', name: 'Honeydew Meadow', sub: 'Sunny, sleepy, full of butterflies',
    hazard: 'Drifting dandelion fluff slows you down',
    skyTop: '#8fd0ec', skyMid: '#d6f0f1', skyHorizon: '#fff1cf',
    sun: '#fff6c4', sunY: 0.26, night: 0,
    cloud: '#ffffff', cloudShade: '#d9e8f3',
    hillFar: ['#bfe3c6', '#a9d6b6'], hillNear: ['#a5d99b', '#86c57f'],
    treeA: '#7cbb6c', treeB: '#62a55b', trunk: '#9a7656',
    bush: ['#86c97a', '#6db566'], flowers: ['#ffffff', '#ffd1dc', '#ffe38a', '#cfe6ff'],
    sea: ['#e9f2fb', '#c3d9f1', '#a4c1ea'],
    grass: '#98d66f', grassLight: '#bbee8f', grassDark: '#68b055',
    soilTop: '#cfa475', soilBottom: '#92694a', soilDot: '#7d5a40', root: '#6e4c35',
    islet: '#9ad38d', isletSoil: '#b99067', accent: '#f6c453',
    style: { far: 'hills', near: 'trees', sea: 'clouds' },
    weather: ['petals', 'petals', 'none', 'rain'],
  },
  teacup: {
    id: 'teacup', name: 'Teacup Village', sub: 'Golden hour, chimney smoke, tiny houses',
    hazard: 'Grumble clouds drip raindrops you can weave through',
    skyTop: '#f7b58a', skyMid: '#fbd3a0', skyHorizon: '#ffeccb',
    sun: '#fff0c0', sunY: 0.42, night: 0,
    cloud: '#fff0dc', cloudShade: '#f2c9a6',
    hillFar: ['#e9c39b', '#d8a97f'], hillNear: ['#c9b27a', '#b09a63'],
    treeA: '#9db868', treeB: '#86a456', trunk: '#8a6446',
    bush: ['#a9c46e', '#8fae5a'], flowers: ['#ffd1c4', '#fff3b8', '#ffb3a6', '#ffffff'],
    sea: ['#fde3c6', '#f3c9a8', '#e0a98f'],
    grass: '#b3cc6a', grassLight: '#d2e48a', grassDark: '#8aa650',
    soilTop: '#d3a273', soilBottom: '#946446', soilDot: '#7b563c', root: '#6d4a35',
    islet: '#b9c978', isletSoil: '#c39a70', accent: '#ff9a6a',
    windows: '#ffd36a',
    style: { far: 'village', near: 'houses', sea: 'clouds' },
    weather: ['rain', 'none', 'rain', 'none'],
  },
  grove: {
    id: 'grove', name: 'Mossy Mushroom Grove', sub: 'Twilight, glowing fungi, bouncy caps',
    hazard: 'Bouncy mushrooms launch you skyward',
    skyTop: '#4a4f8f', skyMid: '#8d77b5', skyHorizon: '#e9b6c8',
    sun: '#f4e6ff', sunY: 0.3, night: 0.35,
    cloud: '#d9c9ee', cloudShade: '#a995cf',
    hillFar: ['#5d6f9a', '#4c5c88'], hillNear: ['#4f8f7c', '#3d7a69'],
    treeA: '#3f8a73', treeB: '#2f7566', trunk: '#5a4a62',
    bush: ['#47927a', '#357f6c'], flowers: ['#9ff0d5', '#f6b3ff', '#fff2a0', '#a9d2ff'],
    sea: ['#b7a6df', '#8a82c9', '#6b69b0'],
    grass: '#6fc08a', grassLight: '#92dca6', grassDark: '#4a9a6c',
    soilTop: '#8a6a7c', soilBottom: '#5a4560', soilDot: '#46334f', root: '#3f2f4a',
    islet: '#69b987', isletSoil: '#7a5f78', accent: '#9ff0d5', glow: '#9ff0d5',
    style: { far: 'grove', near: 'mushrooms', sea: 'mist' },
    weather: ['spores', 'spores', 'rain'],
  },
  heights: {
    id: 'heights', name: 'Cloudberry Heights', sub: 'Pastel sky, floating islands, big breezes',
    hazard: 'Wind gusts push you faster or slower',
    skyTop: '#9fc9f2', skyMid: '#e0d2f5', skyHorizon: '#ffe0ec',
    sun: '#fffbe0', sunY: 0.22, night: 0,
    cloud: '#ffffff', cloudShade: '#dccdf0',
    hillFar: ['#d4c5ee', '#bfaee3'], hillNear: ['#b6d7a8', '#9ac78f'],
    treeA: '#f2a0b8', treeB: '#e98fae', trunk: '#a1785a',
    bush: ['#e990ae', '#d97c9c'], flowers: ['#ffffff', '#ffc2d6', '#ffe38a', '#d8c6ff'],
    sea: ['#f3e9fb', '#d9c8f3', '#bda9e8'],
    grass: '#a6dc7c', grassLight: '#c6f198', grassDark: '#74b862',
    soilTop: '#d7ae88', soilBottom: '#9a7358', soilDot: '#80604a', root: '#70503c',
    islet: '#a9dc8e', isletSoil: '#c3a082', accent: '#ff9bbd',
    style: { far: 'peaks', near: 'berries', sea: 'clouds' },
    weather: ['wind', 'wind', 'none', 'snow'],
  },
  lake: {
    id: 'lake', name: 'Moonlit Lantern Lake', sub: 'Night, reflections, a thousand fireflies',
    hazard: 'Fog patches hide the far path',
    skyTop: '#14183f', skyMid: '#2b2f6b', skyHorizon: '#5a5aa0',
    sun: '#fffbe6', sunY: 0.2, night: 1, moon: true,
    cloud: '#6a6fb0', cloudShade: '#4b4f90',
    hillFar: ['#2c3a78', '#222e66'], hillNear: ['#2e4f7d', '#243f6c'],
    treeA: '#2f6a8a', treeB: '#265b7a', trunk: '#3a3f66',
    bush: ['#2d6f86', '#245f76'], flowers: ['#ffd98a', '#ffb3c8', '#a9d2ff', '#ffffff'],
    sea: ['#3a4f95', '#27397a', '#1b2a62'],
    grass: '#4fa58b', grassLight: '#76c9a8', grassDark: '#337d6c',
    soilTop: '#56507e', soilBottom: '#34305a', soilDot: '#2a2650', root: '#25214a',
    islet: '#43957f', isletSoil: '#4f4a78', accent: '#ffd98a', windows: '#ffd98a', glow: '#ffd98a',
    style: { far: 'mountains', near: 'reeds', sea: 'water' },
    weather: ['fireflies', 'fireflies', 'snow', 'none'],
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
