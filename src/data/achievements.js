/**
 * achievements.js — the Trophy Hall. Every trophy is one row of data; the engine (game/achievements.js) reads a
 * number named by `metric` and compares it with `target`. To add one: append a row. Ids are stable for saves.
 *
 *   tier   : bronze | silver | gold  (decides the ember reward, see TIER)
 *   metric : which number to read (see readMetric in game/achievements.js)
 *   live   : true = a "best in a single run" number, so it can also unlock WHILE you fly (a toast pops up)
 */
import { COMPANIONS } from './companions.js';

export const TIER = {
  bronze: { name: 'Bronze', color: '#c58a54', embers: 30 },
  silver: { name: 'Silver', color: '#c4cad6', embers: 80 },
  gold: { name: 'Gold', color: '#ffc13a', embers: 200 },
};

export const ACHIEVEMENTS = [
  // ---- flights (single run)
  { id: 'first_flame', name: 'First Flame', desc: 'Finish your first flight.', tier: 'bronze', metric: 'runs', target: 1 },
  { id: 'ashen_wings', name: 'Ashen Wings', desc: 'Fly 500 m in a single run.', tier: 'bronze', metric: 'bestDistance', target: 500, live: true },
  { id: 'keep_breaker', name: 'Keep Breaker', desc: 'Fly 1,000 m in a single run.', tier: 'silver', metric: 'bestDistance', target: 1000, live: true },
  { id: 'deep_diver', name: 'Deep Diver', desc: 'Fly 2,000 m in a single run.', tier: 'silver', metric: 'bestDistance', target: 2000, live: true },
  { id: 'sky_tyrant', name: 'Sky Tyrant', desc: 'Fly 3,500 m in a single run.', tier: 'gold', metric: 'bestDistance', target: 3500, live: true },
  { id: 'long_night', name: 'The Long Night', desc: 'Stay airborne for 4 minutes in one run.', tier: 'silver', metric: 'bestSeconds', target: 240, live: true },
  { id: 'untouched', name: 'Untouched', desc: 'Fly 800 m without taking a single hit.', tier: 'gold', metric: 'cleanBest', target: 800, live: true },
  // ---- the realm
  { id: 'beyond_ashes', name: 'Beyond the Ashes', desc: 'Reach the Ruined Keep.', tier: 'bronze', metric: 'biomesSeen', target: 2, live: true },
  { id: 'stormcaller', name: 'Stormcaller', desc: 'Reach the Stormspire Peaks.', tier: 'silver', metric: 'biomesSeen', target: 4, live: true },
  { id: 'realm_walker', name: 'Realm Walker', desc: 'Reach the Obsidian Lava Lake.', tier: 'gold', metric: 'biomesSeen', target: 5, live: true },
  { id: 'long_haul', name: 'Long Haul', desc: 'Fly 25 km in total.', tier: 'silver', metric: 'totalDistance', target: 25000 },
  { id: 'world_eater', name: 'World Eater', desc: 'Fly 100 km in total.', tier: 'gold', metric: 'totalDistance', target: 100000 },
  // ---- skill
  { id: 'kindling', name: 'Kindling', desc: 'Reach a x3 combo.', tier: 'bronze', metric: 'bestCombo', target: 3, live: true },
  { id: 'wildfire', name: 'Wildfire', desc: 'Reach a x6 combo.', tier: 'gold', metric: 'bestCombo', target: 6, live: true },
  { id: 'close_call', name: 'Close Call', desc: 'Make 25 near-misses in total.', tier: 'bronze', metric: 'nearMisses', target: 25 },
  { id: 'razors_edge', name: "Razor's Edge", desc: 'Make 150 near-misses in total.', tier: 'silver', metric: 'nearMisses', target: 150 },
  { id: 'gap_glider', name: 'Gap Glider', desc: 'Glide across 25 chasms in total.', tier: 'silver', metric: 'glideGaps', target: 25 },
  { id: 'portcullis', name: 'Under the Portcullis', desc: 'Slide beneath 30 iron portcullises.', tier: 'silver', metric: 'vinesSlid', target: 30 },
  // ---- plunder
  { id: 'ember_hoard', name: 'Ember Hoard', desc: 'Collect 500 embers in total.', tier: 'bronze', metric: 'totalSeeds', target: 500 },
  { id: 'dragon_hoard', name: "Dragon's Hoard", desc: 'Collect 5,000 embers in total.', tier: 'gold', metric: 'totalSeeds', target: 5000 },
  { id: 'lightbringer', name: 'Lightbringer', desc: 'Light 50 braziers in total.', tier: 'silver', metric: 'lanterns', target: 50 },
  { id: 'wisp_chaser', name: 'Wisp Chaser', desc: 'Catch 10 phoenix wisps in total.', tier: 'silver', metric: 'fireflies', target: 10 },
  { id: 'rune_reader', name: 'Rune Reader', desc: 'Spell F-I-R-E five times.', tier: 'silver', metric: 'words', target: 5 },
  { id: 'power_surge', name: 'Power Surge', desc: 'Use 25 power-ups in total.', tier: 'bronze', metric: 'powerups', target: 25 },
  // ---- the war-camp
  { id: 'clutch', name: 'Clutch', desc: 'Hatch 5 dragon eggs.', tier: 'silver', metric: 'eggs', target: 5 },
  { id: 'beastmaster', name: 'Beastmaster', desc: 'Call 3 war-beasts to your side.', tier: 'silver', metric: 'companions', target: 3 },
  { id: 'menagerie', name: 'Menagerie', desc: 'Call every war-beast.', tier: 'gold', metric: 'companions', target: COMPANIONS.length },
  { id: 'forged', name: 'Forged in Fire', desc: 'Buy 10 forge upgrades.', tier: 'bronze', metric: 'upgradeLevels', target: 10 },
  { id: 'master_smith', name: 'Master Smith', desc: 'Max out any forge upgrade.', tier: 'silver', metric: 'upgradesMaxed', target: 1 },
  { id: 'daily_devotion', name: 'Daily Devotion', desc: 'Fly 3 Daily Runs.', tier: 'bronze', metric: 'dailyRuns', target: 3 },
  { id: 'unbroken', name: 'Unbroken', desc: 'Keep a 7-day Daily streak.', tier: 'gold', metric: 'bestStreak', target: 7 },
  { id: 'persistent', name: 'Persistent', desc: 'Complete 25 runs.', tier: 'bronze', metric: 'runs', target: 25 },
  { id: 'veteran', name: 'Veteran of the Ash', desc: 'Complete 100 runs.', tier: 'gold', metric: 'runs', target: 100 },
  { id: 'rising_wyrm', name: 'Rising Wyrm', desc: 'Reach rank 5.', tier: 'bronze', metric: 'level', target: 5 },
  { id: 'elder_wyrm', name: 'Elder Wyrm', desc: 'Reach rank 15.', tier: 'gold', metric: 'level', target: 15 },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
