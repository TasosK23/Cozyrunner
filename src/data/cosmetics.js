/**
 * cosmetics.js — Cinder's wardrobe. Purely visual: nothing here changes how the game plays.
 *
 * Four slots, each a list of looks. A look is a bag of colour overrides that render/bramble.js merges over its
 * base palette (the keys are the palette's own names, so adding a look is just adding a row).
 *
 *   unlock : { default:true }  owned from the start
 *            { ach:'id' }      owned once that trophy is earned
 *            { level:n }       owned once the profile reaches rank n
 *            { egg:true }      can only be hatched from dragon eggs (rarity says how rare)
 *
 * Ids are stable for saves. Slot ids: scales | horns | eyes | flame.
 */
export const SLOTS = [
  { id: 'scales', name: 'Scales' },
  { id: 'horns', name: 'Horns' },
  { id: 'eyes', name: 'Eyes' },
  { id: 'flame', name: 'Flame' },
];

export const COSMETICS = [
  // ---------------------------------------------------------------- scales (body + wings + belly)
  { id: 'scales.cinder', slot: 'scales', name: 'Cinderscale', rarity: 'common', unlock: { default: true }, text: 'Where it all began.',
    pal: {} },
  { id: 'scales.obsidian', slot: 'scales', name: 'Obsidian', rarity: 'uncommon', unlock: { ach: 'keep_breaker' }, text: 'Glass-black hide that drinks the light.',
    pal: { scale: '#2b2b3a', scaleDark: '#12121b', scaleLight: '#5e5e82', wing: '#2f2a44', wingDark: '#15111f', wingLight: '#5c5380',
      belly: '#6f6d8c', bellyDark: '#393850', bellyLight: '#b9b7da', spine: '#0d0d15', outline: '#0a0a10' } },
  { id: 'scales.verdigris', slot: 'scales', name: 'Verdigris Wyrm', rarity: 'uncommon', unlock: { ach: 'gap_glider' }, text: 'Weathered copper-green, like a drowned bell.',
    pal: { scale: '#2f6a3a', scaleDark: '#14391f', scaleLight: '#5aa35c', wing: '#2b5b35', wingDark: '#10301a', wingLight: '#4f9250',
      belly: '#c2b24f', bellyDark: '#7a6e2a', bellyLight: '#eee08c', spine: '#0f2a16', outline: '#0b1a0f' } },
  { id: 'scales.frostbite', slot: 'scales', name: 'Frostbitten', rarity: 'rare', unlock: { ach: 'stormcaller' }, text: 'Hoarfrost from the Stormspire clings to every scale.',
    pal: { scale: '#3a6a92', scaleDark: '#1a3652', scaleLight: '#79b3da', wing: '#3a5f86', wingDark: '#16304c', wingLight: '#6ca6ce',
      belly: '#cfe4f0', bellyDark: '#7b9bb1', bellyLight: '#ffffff', spine: '#14283d', outline: '#0c1826' } },
  { id: 'scales.bone', slot: 'scales', name: 'Bonewyrm', rarity: 'rare', unlock: { egg: true }, text: 'Pale as a skeleton, belly red as an old wound.',
    pal: { scale: '#b9b19d', scaleDark: '#6b6351', scaleLight: '#e6decb', wing: '#8b8373', wingDark: '#4a4436', wingLight: '#c9c1ab',
      belly: '#7b2b25', bellyDark: '#4a1412', bellyLight: '#b24c3b', spine: '#3a352b', outline: '#1a1612' } },
  { id: 'scales.gilded', slot: 'scales', name: 'Gilded Tyrant', rarity: 'legendary', unlock: { ach: 'dragon_hoard' }, text: 'Black scales dusted with a hoard of gold.',
    pal: { scale: '#2d2319', scaleDark: '#130e08', scaleLight: '#c99a2c', wing: '#4b3311', wingDark: '#20160a', wingLight: '#b98921',
      belly: '#ffd262', bellyDark: '#b27a1a', bellyLight: '#fff1b4', spine: '#1a120a', outline: '#0e0a06' } },

  // ---------------------------------------------------------------- horns (horns, cheek spikes, claws)
  { id: 'horns.bone', slot: 'horns', name: 'Bone', rarity: 'common', unlock: { default: true }, text: 'Plain and cruel.',
    pal: {} },
  { id: 'horns.obsidian', slot: 'horns', name: 'Obsidian', rarity: 'uncommon', unlock: { level: 5 }, text: 'Volcanic glass, sharp enough to cut a shadow.',
    pal: { horn: '#2d2b38', hornDark: '#14121a', claw: '#a09eb6' } },
  { id: 'horns.gold', slot: 'horns', name: 'Gilded', rarity: 'rare', unlock: { ach: 'master_smith' }, text: 'Forged tips, a smith\'s pride.',
    pal: { horn: '#e8c352', hornDark: '#a37b20', claw: '#ffe9a6' } },
  { id: 'horns.ember', slot: 'horns', name: 'Emberhorn', rarity: 'rare', unlock: { egg: true }, text: 'Glowing from within, as if cooling slowly.',
    pal: { horn: '#ff8c3c', hornDark: '#b2461a', claw: '#ffd8a0' } },

  // ---------------------------------------------------------------- eyes
  { id: 'eyes.amber', slot: 'eyes', name: 'Amber', rarity: 'common', unlock: { default: true }, text: 'The eye of a patient hunter.',
    pal: {} },
  { id: 'eyes.crimson', slot: 'eyes', name: 'Crimson', rarity: 'uncommon', unlock: { ach: 'close_call' }, text: 'Anger, made visible.',
    pal: { eye: '#ff3b3b' } },
  { id: 'eyes.venom', slot: 'eyes', name: 'Venom', rarity: 'uncommon', unlock: { ach: 'portcullis' }, text: 'A sickly glow from the deep caverns.',
    pal: { eye: '#9cff4a' } },
  { id: 'eyes.frost', slot: 'eyes', name: 'Frostlight', rarity: 'rare', unlock: { egg: true }, text: 'Cold, pale and unblinking.',
    pal: { eye: '#8fe0ff' } },
  { id: 'eyes.white', slot: 'eyes', name: 'White-hot', rarity: 'legendary', unlock: { ach: 'untouched' }, text: 'Seen only by those who never flinch.',
    pal: { eye: '#ffffff' } },

  // ---------------------------------------------------------------- flame (breath, glows, spark trail)
  { id: 'flame.ember', slot: 'flame', name: 'Ember', rarity: 'common', unlock: { default: true }, text: 'Honest orange fire.',
    pal: {} },
  { id: 'flame.azure', slot: 'flame', name: 'Azure Fire', rarity: 'rare', unlock: { ach: 'daily_devotion' }, text: 'Hotter than orange, quieter than red.',
    pal: { ember: '#3a9cff', emberHot: '#c4ecff', fire: [58, 156, 255], fireHot: [196, 236, 255] } },
  { id: 'flame.hellgreen', slot: 'flame', name: 'Hellfire', rarity: 'rare', unlock: { egg: true }, text: 'Green flames from somewhere far below.',
    pal: { ember: '#4be05c', emberHot: '#dcffb4', fire: [75, 224, 92], fireHot: [220, 255, 180] } },
  { id: 'flame.void', slot: 'flame', name: 'Voidflame', rarity: 'legendary', unlock: { egg: true }, text: 'Fire that gives no light, only edges.',
    pal: { ember: '#a24bff', emberHot: '#ecd0ff', fire: [162, 75, 255], fireHot: [236, 208, 255] } },
  { id: 'flame.white', slot: 'flame', name: 'White-hot', rarity: 'legendary', unlock: { level: 15 }, text: 'Past orange, past blue: pure heat.',
    pal: { ember: '#fff0d0', emberHot: '#ffffff', fire: [255, 240, 208], fireHot: [255, 255, 255] } },
];

export const COSMETIC_BY_ID = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
export const DEFAULT_LOOK = { scales: 'scales.cinder', horns: 'horns.bone', eyes: 'eyes.amber', flame: 'flame.ember' };

/** Merge the four equipped looks' colour overrides into one palette patch. Unknown ids fall back to the default. */
export function resolveLook(equipped) {
  const out = {};
  for (const slot of SLOTS) {
    const c = COSMETIC_BY_ID[(equipped && equipped[slot.id]) || DEFAULT_LOOK[slot.id]] || COSMETIC_BY_ID[DEFAULT_LOOK[slot.id]];
    Object.assign(out, c.pal);
  }
  return out;
}
