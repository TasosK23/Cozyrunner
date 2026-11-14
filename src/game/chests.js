/**
 * chests.js — Mystery Acorns. The surprise at the end of a good run (or a Daily Run, or a weekly challenge).
 *
 * Kind rules: a chest is GUARANTEED after CHEST.pityRuns runs without one, you can never lose one, and
 * everything inside is something nice. (Cosmetics join the loot table in Stage 3.)
 */
import { CHEST } from '../data/balance.js';
import { COMPANIONS } from '../data/companions.js';

/** After a run: maybe a chest is earned. Returns true if one was added. */
export function rollChest(data, ctx, rand = Math.random) {
  const c = data.chests;
  c.pity++;
  let chance = CHEST.baseChance;
  if (ctx.newBest) chance += CHEST.newBestBonus;
  if (ctx.questDone) chance += CHEST.questBonus;
  chance += 0.03 * (ctx.luck || 0);
  if (c.pity >= CHEST.pityRuns || rand() < chance) { c.pity = 0; c.pending++; return true; }
  return false;
}

function pickRarity(luck, rand) {
  const w = { ...CHEST.weights };
  if (luck > 0) { w.common = Math.max(20, w.common - 10 * luck); w.uncommon += 4 * luck; w.rare += 5 * luck; w.legendary += 1 * luck; }
  let total = 0;
  for (const k of Object.keys(w)) total += w[k];
  let r = rand() * total;
  for (const k of Object.keys(w)) { r -= w[k]; if (r <= 0) return k; }
  return 'common';
}

/** Open one pending chest. Mutates the save and returns what was inside. */
export function openChest(data, luck = 0, rand = Math.random) {
  if (data.chests.pending <= 0) return null;
  data.chests.pending--;
  data.chests.opened++;
  const rarity = pickRarity(luck, rand);
  const reward = { rarity, seeds: 0, xp: 0, companion: null };
  const range = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const locked = COMPANIONS.filter((c) => !data.companions.owned[c.id]);
  if (rarity === 'common') reward.seeds = range(40, 70);
  else if (rarity === 'uncommon') { reward.seeds = range(90, 140); reward.xp = 30; }
  else if (rarity === 'rare') {
    const pool = locked.filter((c) => c.rarity !== 'legendary');
    if (pool.length) reward.companion = pool[Math.floor(rand() * pool.length)];
    else reward.seeds = range(200, 300);
  } else {
    const leg = locked.filter((c) => c.rarity === 'legendary');
    if (leg.length) reward.companion = leg[0];
    reward.seeds = range(400, 600); reward.xp = 100;
  }
  data.seedsBank += reward.seeds;
  data.xp += reward.xp;
  if (reward.companion) {
    data.companions.owned[reward.companion.id] = true;
    if (!data.companions.equipped) data.companions.equipped = reward.companion.id;
  }
  return reward;
}
