/**
 * companions.js — Cinder's war-beasts. Original designs, one passive each.
 *
 * Only ONE companion follows Cinder at a time (pick it on the Companions screen). Ids are stable for saves.
 * `effect` keys are read by game/loadout.js:
 *   hearts +n | glideMul x | magnetR +units | slowAfterHit (seconds of slow-motion after a hit)
 *   comboBonus +s | revealBonus (hidden gold shards appear) | glowStart/glowKeep | chestLuck |
 *   startBlanket (starts with a Scale Shield) | powerMul
 * `unlock` says how the companion is earned by playing; `metric` names a number tracked in the save
 * (see companionProgress in game/loadout.js). The game-over screen shows progress toward the nearest one.
 */
export const RARITIES = {
  common:    { id: 'common',    name: 'Common',    color: '#a7a0b0' },
  uncommon:  { id: 'uncommon',  name: 'Uncommon',  color: '#5fb0e0' },
  rare:      { id: 'rare',      name: 'Rare',      color: '#c06af0' },
  legendary: { id: 'legendary', name: 'Legendary', color: '#ff9a2a' },
};

export const COMPANIONS = [
  { id: 'bumbly', name: 'Ember', kind: 'a living flame wisp', rarity: 'common',
    desc: 'Hunts nearby ember shards and drags them to you.',
    effect: { magnetR: 70 }, unlock: { metric: 'totalSeeds', target: 100, text: 'Collect {n} embers in total' } },
  { id: 'dot', name: 'Scorch', kind: 'a lava salamander', rarity: 'common',
    desc: 'Tough hide: one extra heart every run.',
    effect: { hearts: 1 }, unlock: { metric: 'totalDistance', target: 1500, text: 'Fly {n} m in total' } },
  { id: 'puff', name: 'Gale', kind: 'a storm wyvern hatchling', rarity: 'uncommon',
    desc: 'Rides the wind: your wing glide lasts a third longer.',
    effect: { glideMul: 1.35 }, unlock: { metric: 'glideGaps', target: 12, text: 'Glide across {n} gaps in total' } },
  { id: 'dozy', name: 'Basalt', kind: 'a stone-shelled golem', rarity: 'uncommon',
    desc: 'After a hit, time slows so you can claw back control.',
    effect: { slowAfterHit: 2.6 }, unlock: { metric: 'nearMisses', target: 25, text: 'Make {n} near-misses in total' } },
  { id: 'thimble', name: 'Fang', kind: 'a dire-wolf pup', rarity: 'uncommon',
    desc: 'Keeps your combo burning about one second longer.',
    effect: { comboBonus: 1.0 }, unlock: { metric: 'bestCombo', target: 4, text: 'Reach a x{n} combo' } },
  { id: 'lumi', name: 'Shade', kind: 'a raven with ember eyes', rarity: 'rare',
    desc: 'Spots hidden gold shards that only ravens can see.',
    effect: { revealBonus: true }, unlock: { metric: 'lanterns', target: 20, text: 'Light {n} braziers in total' } },
  { id: 'glimmer', name: 'Blaze', kind: 'a fire imp', rarity: 'rare',
    desc: 'Starts each run with your flame already roaring, and it burns longer.',
    effect: { glowStart: 40, glowKeep: 0.6 }, unlock: { metric: 'fireflies', target: 3, text: 'Catch {n} phoenix wisps' } },
  { id: 'poppy', name: 'Grub', kind: 'a goblin scavenger', rarity: 'rare',
    desc: 'Sniffs out better loot in your dragon eggs after each run.',
    effect: { chestLuck: 1 }, unlock: { metric: 'chestsOpened', target: 3, text: 'Open {n} dragon eggs' } },
  { id: 'pip', name: 'Vorath', kind: 'an elder drake', rarity: 'legendary',
    desc: 'Starts every run behind a Scale Shield, and power-ups last longer.',
    effect: { startBlanket: true, powerMul: 1.25 }, unlock: { metric: 'level', target: 10, text: 'Reach rank {n}' } },
];

export const COMPANION_BY_ID = Object.fromEntries(COMPANIONS.map((c) => [c.id, c]));
