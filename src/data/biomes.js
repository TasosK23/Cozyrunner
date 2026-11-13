/**
 * biomes.js — palettes and names for each region of the floating garden.
 * Stage 1 ships Honeydew Meadow; Stage 2 adds the other four (the renderer already takes a palette).
 */
export const BIOMES = {
  meadow: {
    id: 'meadow',
    name: 'Honeydew Meadow',
    skyTop: '#8fd0ec', skyMid: '#d6f0f1', skyHorizon: '#fff1cf',
    sun: '#fff6c4',
    cloud: '#ffffff', cloudShade: '#d9e8f3',
    hillFar: ['#bfe3c6', '#a9d6b6'],
    hillNear: ['#a5d99b', '#86c57f'],
    treeA: '#7cbb6c', treeB: '#62a55b', trunk: '#9a7656',
    bush: ['#86c97a', '#6db566'], flowers: ['#ffffff', '#ffd1dc', '#ffe38a', '#cfe6ff'],
    sea: ['#f1f5fa', '#d9e6f2', '#c2d3ea'],
    grass: '#98d66f', grassLight: '#bbee8f', grassDark: '#68b055',
    soilTop: '#cfa475', soilBottom: '#92694a', soilDot: '#7d5a40', root: '#6e4c35',
    islet: '#9ad38d', isletSoil: '#b99067',
  },
};
