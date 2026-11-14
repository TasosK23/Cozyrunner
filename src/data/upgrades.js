/**
 * upgrades.js — permanent upgrades bought with glow-seeds. Small, clearly explained, never a grind wall.
 *
 *   costs[i] = price of level i+1.  per = how much each level adds.  Everything is tuned here.
 * The whole shop costs about 6,300 seeds; a normal run earns 100-250 (plus quests, dailies and acorns).
 */
export const UPGRADES = [
  { id: 'magnet', name: 'Seed Magnet', icon: 'magnet', max: 5, per: 22, unit: 'u',
    costs: [60, 120, 200, 320, 500],
    desc: 'Glow-seeds drift toward Bramble from {v} units away, always.' },
  { id: 'duration', name: 'Power-up Time', icon: 'clock', max: 5, per: 0.12, unit: '%',
    costs: [80, 160, 260, 400, 600],
    desc: 'Power-ups last {v}% longer.' },
  { id: 'hearts', name: 'Warmth Hearts', icon: 'heart', max: 2, per: 1, unit: '',
    costs: [300, 900],
    desc: 'Start every run with {v} extra heart(s).' },
  { id: 'glide', name: 'Leaf Glide', icon: 'leaf', max: 5, per: 0.08, unit: '%',
    costs: [70, 140, 230, 350, 520],
    desc: 'Bramble’s leaf flutter lasts {v}% longer.' },
  { id: 'combo', name: 'Combo Patience', icon: 'timer', max: 5, per: 0.3, unit: 's',
    costs: [60, 120, 200, 300, 450],
    desc: 'Combos wait {v} s longer before fading.' },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

/** The value an upgrade gives at a level, ready to show ("+44", "+24"). */
export function upgradeValue(u, level) {
  const v = u.per * level;
  if (u.unit === '%') return Math.round(v * 100);
  if (u.unit === 's') return Math.round(v * 10) / 10;
  return v;
}
