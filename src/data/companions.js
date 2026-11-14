/**
 * companions.js — Bramble's little helpers. Original designs, one passive each.
 *
 * Only ONE companion follows Bramble at a time (pick it on the Companions screen).
 * `effect` keys are read by game/loadout.js:
 *   hearts +n | glideMul x | magnetR +units | slowAfterHit (seconds of gentle slow-mo after a bump)
 *   comboBonus +s | revealBonus (hidden golden seeds appear) | glowStart/glowKeep | chestLuck |
 *   startBlanket | powerMul
 * `unlock` says how the companion is earned by playing; `metric` names a number tracked in the save
 * (see companionProgress in game/loadout.js). The game-over screen shows progress toward the nearest one.
 */
export const RARITIES = {
  common:    { id: 'common',    name: 'Common',    color: '#9bb98a' },
  uncommon:  { id: 'uncommon',  name: 'Uncommon',  color: '#6fb0d6' },
  rare:      { id: 'rare',      name: 'Rare',      color: '#b784e0' },
  legendary: { id: 'legendary', name: 'Legendary', color: '#f0b32f' },
};

export const COMPANIONS = [
  { id: 'bumbly', name: 'Bumbly', kind: 'a bumblebee', rarity: 'common',
    desc: 'Buzzes after nearby glow-seeds and collects them for you.',
    effect: { magnetR: 70 }, unlock: { metric: 'totalSeeds', target: 100, text: 'Collect {n} glow-seeds in total' } },
  { id: 'dot', name: 'Dot', kind: 'a ladybug', rarity: 'common',
    desc: 'Brings a little extra warmth: one more heart every run.',
    effect: { hearts: 1 }, unlock: { metric: 'totalDistance', target: 1500, text: 'Run {n} m in total' } },
  { id: 'puff', name: 'Puff', kind: 'a tiny cloud', rarity: 'uncommon',
    desc: 'Lengthens Bramble’s leaf glide by a third.',
    effect: { glideMul: 1.35 }, unlock: { metric: 'glideGaps', target: 12, text: 'Glide across {n} gaps in total' } },
  { id: 'dozy', name: 'Dozy', kind: 'a snail buddy', rarity: 'uncommon',
    desc: 'After a bump, time slows down a little so you can recover.',
    effect: { slowAfterHit: 2.6 }, unlock: { metric: 'nearMisses', target: 25, text: 'Make {n} near-misses in total' } },
  { id: 'thimble', name: 'Thimble', kind: 'a hedgehog', rarity: 'uncommon',
    desc: 'Keeps combos alive about one second longer.',
    effect: { comboBonus: 1.0 }, unlock: { metric: 'bestCombo', target: 4, text: 'Reach a x{n} combo' } },
  { id: 'lumi', name: 'Lumi', kind: 'a moth', rarity: 'rare',
    desc: 'Reveals hidden golden seeds that only moths can see.',
    effect: { revealBonus: true }, unlock: { metric: 'lanterns', target: 20, text: 'Light {n} lanterns in total' } },
  { id: 'glimmer', name: 'Glimmer', kind: 'a firefly', rarity: 'rare',
    desc: 'Starts each run with a glowing lantern that burns longer.',
    effect: { glowStart: 40, glowKeep: 0.6 }, unlock: { metric: 'fireflies', target: 3, text: 'Catch {n} golden fireflies' } },
  { id: 'poppy', name: 'Poppy', kind: 'an acorn mouse', rarity: 'rare',
    desc: 'Sniffs out better mystery acorns after your runs.',
    effect: { chestLuck: 1 }, unlock: { metric: 'chestsOpened', target: 3, text: 'Open {n} mystery acorns' } },
  { id: 'pip', name: 'Pip', kind: 'a kettle dragon', rarity: 'legendary',
    desc: 'Starts every run wrapped in a Cozy Blanket, and power-ups last longer.',
    effect: { startBlanket: true, powerMul: 1.25 }, unlock: { metric: 'level', target: 10, text: 'Reach profile level {n}' } },
];

export const COMPANION_BY_ID = Object.fromEntries(COMPANIONS.map((c) => [c.id, c]));
