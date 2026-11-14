/**
 * quests.js — the pool of quest templates. Three daily quests are drawn from here (seeded by the date),
 * plus one weekly challenge. Everything is plain data: add a template and it shows up.
 *
 *   metric    a key of the run summary (see Run.summary in world.js)
 *   scope     'max' = best value in a single run   |  'sum' = adds up across runs today
 *   targets   [easy, medium, hard]  chosen by the player's profile level
 *   reward    glow-seeds for the matching tier
 *   minBest   only offered once the player's best run is at least this many meters (so a quest about
 *             mushrooms never appears before anyone could have met a mushroom)
 */
export const QUESTS = [
  { id: 'seeds-run', metric: 'seeds', scope: 'max', targets: [40, 70, 110], reward: [30, 45, 70], text: 'Collect {n} glow-seeds in one run' },
  { id: 'dist-run', metric: 'distM', scope: 'max', targets: [250, 450, 700], reward: [30, 45, 70], text: 'Run {n} m in one run' },
  { id: 'combo', metric: 'bestMult', scope: 'max', targets: [3, 4, 5], reward: [30, 45, 70], text: 'Reach a x{n} combo' },
  { id: 'glide', metric: 'glideGaps', scope: 'sum', targets: [2, 4, 6], reward: [35, 50, 75], text: 'Glide across {n} gaps' },
  { id: 'near', metric: 'nearMisses', scope: 'sum', targets: [3, 6, 10], reward: [35, 50, 75], text: 'Make {n} near-misses' },
  { id: 'lantern', metric: 'lanterns', scope: 'sum', targets: [3, 6, 10], reward: [30, 45, 70], text: 'Light {n} lanterns' },
  { id: 'vine', metric: 'vinesSlid', scope: 'sum', targets: [3, 6, 10], reward: [30, 45, 70], text: 'Slide under {n} vines' },
  { id: 'power', metric: 'powerups', scope: 'sum', targets: [1, 2, 4], reward: [30, 45, 70], text: 'Use {n} power-ups' },
  { id: 'word', metric: 'words', scope: 'sum', targets: [1, 1, 2], reward: [40, 55, 80], text: 'Spell C-O-Z-Y {n} time(s)' },
  { id: 'firefly', metric: 'fireflies', scope: 'sum', targets: [1, 1, 2], reward: [40, 55, 80], text: 'Catch {n} golden firefl(ies)', minBest: 300 },
  { id: 'runs', metric: 'runs', scope: 'sum', targets: [2, 3, 5], reward: [25, 35, 55], text: 'Play {n} runs' },
  { id: 'biome', metric: 'biomes', scope: 'sum', targets: [1, 2, 3], reward: [35, 50, 75], text: 'Walk through {n} biome doorway(s)', minBest: 300 },
  { id: 'bounce', metric: 'bounces', scope: 'sum', targets: [2, 4, 6], reward: [35, 50, 75], text: 'Bounce on {n} mushrooms', minBest: 700 },
  { id: 'beat', metric: 'perfectBeats', scope: 'sum', targets: [2, 4, 6], reward: [40, 55, 80], text: 'Hit {n} festival beats on time', minBest: 900 },
];

export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

/** Weekly challenges: bigger, spread over the week, paid with a mystery acorn. */
export const WEEKLY = [
  { id: 'w-dist', metric: 'distM', target: 5000, reward: 120, text: 'Run {n} m this week' },
  { id: 'w-seeds', metric: 'seeds', target: 700, reward: 120, text: 'Collect {n} glow-seeds this week' },
  { id: 'w-runs', metric: 'runs', target: 18, reward: 120, text: 'Play {n} runs this week' },
  { id: 'w-lantern', metric: 'lanterns', target: 40, reward: 120, text: 'Light {n} lanterns this week' },
  { id: 'w-near', metric: 'nearMisses', target: 40, reward: 120, text: 'Make {n} near-misses this week' },
];
export const WEEKLY_BY_ID = Object.fromEntries(WEEKLY.map((q) => [q.id, q]));
