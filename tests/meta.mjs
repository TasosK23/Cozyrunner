// Data + engine checks for Stage 3 (no browser):  node tests/meta.mjs
import { ACHIEVEMENTS, TIER } from '../src/data/achievements.js';
import { COSMETICS, COSMETIC_BY_ID, DEFAULT_LOOK, SLOTS, resolveLook } from '../src/data/cosmetics.js';
import { COMPANIONS } from '../src/data/companions.js';
import { defaultSave, parseSave, SaveStore, VERSION } from '../src/core/save.js';
import { readMetric, achievementProgress, evaluateAchievements, syncCosmetics, equipLook, lookUnlocked } from '../src/game/achievements.js';
import { openChest } from '../src/game/chests.js';
import { buildLoadout } from '../src/game/loadout.js';

let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? `  [${extra}]` : '')); };

// ---- data integrity
ok('trophy ids unique', new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length, `${ACHIEVEMENTS.length} trophies`);
ok('every trophy has a known tier and a positive target', ACHIEVEMENTS.every((a) => TIER[a.tier] && a.target > 0));
const d0 = defaultSave();
ok('every trophy metric resolves to a finite number', ACHIEVEMENTS.every((a) => Number.isFinite(readMetric(d0, a.metric))), ACHIEVEMENTS.filter((a) => !Number.isFinite(readMetric(d0, a.metric))).map((a) => a.metric).join(','));
ok('no trophy is complete on a fresh save', ACHIEVEMENTS.every((a) => !achievementProgress(d0, a).done && readMetric(d0, a.metric) < a.target));
ok('look ids unique + slot-prefixed', new Set(COSMETICS.map((c) => c.id)).size === COSMETICS.length && COSMETICS.every((c) => c.id.startsWith(c.slot + '.')));
ok('every slot has exactly one default look', SLOTS.every((s) => COSMETICS.filter((c) => c.slot === s.id && c.unlock.default).length === 1) && SLOTS.every((s) => COSMETIC_BY_ID[DEFAULT_LOOK[s.id]]));
ok('look unlock trophies exist', COSMETICS.every((c) => !c.unlock.ach || ACHIEVEMENTS.some((a) => a.id === c.unlock.ach)));
ok('colours are valid hex / rgb triples', COSMETICS.every((c) => Object.entries(c.pal).every(([k, v]) => (k === 'fire' || k === 'fireHot') ? Array.isArray(v) && v.length === 3 && v.every((n) => n >= 0 && n <= 255) : /^#[0-9a-f]{6}$/i.test(v))));
ok('flame looks give both fire arrays (breath + glow need them)', COSMETICS.filter((c) => c.slot === 'flame' && !c.unlock.default).every((c) => c.pal.fire && c.pal.fireHot));
ok('resolveLook merges four slots', (() => { const r = resolveLook({ scales: 'scales.obsidian', horns: 'horns.gold', eyes: 'eyes.crimson', flame: 'flame.azure' }); return r.scale && r.horn && r.eye === '#ff3b3b' && r.fire[2] === 255; })());
ok('resolveLook survives junk ids', (() => { const r = resolveLook({ scales: 'nope', horns: null }); return typeof r === 'object'; })());
ok('menagerie target = number of companions', ACHIEVEMENTS.find((a) => a.id === 'menagerie').target === COMPANIONS.length);

// ---- earning trophies
{
  const d = defaultSave();
  d.stats.runs = 1;
  const got = evaluateAchievements(d, 1000);
  ok('first run unlocks First Flame and pays embers', got.length === 1 && got[0].id === 'first_flame' && d.seedsBank === TIER.bronze.embers && d.achievements.first_flame === 1000);
  ok('a trophy never unlocks twice', evaluateAchievements(d, 2000).length === 0 && d.seedsBank === TIER.bronze.embers);
  const live = { distM: 520, bestMult: 1, seconds: 10, seeds: 0, hits: 0, biomeCount: 2 };
  const l = evaluateAchievements(d, 3000, live).map((a) => a.id).sort();
  ok('live (mid-run) check unlocks single-run trophies only', l.join() === 'ashen_wings,beyond_ashes', l.join());
  d.stats.totalDistance = 99999; d.stats.nearMisses = 30;
  const live2 = evaluateAchievements(d, 4000, { distM: 1, bestMult: 1, seconds: 1, seeds: 0, hits: 0, biomeCount: 1 }).map((a) => a.id);
  ok('live check ignores cumulative totals (those wait for the game-over)', live2.length === 0, live2.join());
  ok('...but the game-over check picks them up', evaluateAchievements(d, 5000).map((a) => a.id).sort().join() === 'close_call,long_haul');
}
{
  const d = defaultSave();
  d.best.distance = 1000;
  const live = { distM: 0, bestMult: 1, seconds: 0, seeds: 0, hits: 0, biomeCount: 1 };
  ok('flawless-run trophy needs hits === 0 live', evaluateAchievements(d, 1, { ...live, distM: 800, hits: 1 }).every((a) => a.id !== 'untouched'));
  ok('flawless-run trophy unlocks at 800 m with no hits', evaluateAchievements(d, 1, { ...live, distM: 800, hits: 0 }).some((a) => a.id === 'untouched'));
}
{
  const d = defaultSave();
  for (const c of COMPANIONS) d.companions.owned[c.id] = true;
  ok('menagerie trophy: all war-beasts', evaluateAchievements(d, 1).some((a) => a.id === 'menagerie') && readMetric(d, 'companions') === COMPANIONS.length);
}

// ---- looks
{
  const d = defaultSave();
  ok('defaults are owned + equipped at the start', SLOTS.every((s) => d.cosmetics.owned[DEFAULT_LOOK[s.id]] && d.cosmetics.equipped[s.id] === DEFAULT_LOOK[s.id]));
  ok('a locked look cannot be equipped', equipLook(d, 'scales.obsidian') === false && d.cosmetics.equipped.scales === 'scales.cinder');
  d.achievements.keep_breaker = 5;
  const fresh = syncCosmetics(d);
  ok('earning the trophy owns its look (NEW badge)', fresh.length === 1 && fresh[0].id === 'scales.obsidian' && d.cosmetics.owned['scales.obsidian'] && d.cosmetics.seen['scales.obsidian'] === false);
  ok('...and it can then be equipped', equipLook(d, 'scales.obsidian') && d.cosmetics.equipped.scales === 'scales.obsidian');
  ok('equipping the same look twice reports no change', equipLook(d, 'scales.obsidian') === false);
  d.xp = 100000;
  ok('rank-gated looks unlock by level', syncCosmetics(d).some((c) => c.id === 'horns.obsidian') && lookUnlocked(d, COSMETIC_BY_ID['flame.white']));
  ok('egg-only looks never unlock by themselves', !lookUnlocked(d, COSMETIC_BY_ID['eyes.frost']));
}

// ---- eggs
{
  let r = 12345; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const d = defaultSave();
  d.chests.pending = 4000;
  const seen = new Set();
  for (let i = 0; i < 4000; i++) { const x = openChest(d, 1, rnd); if (x.look) seen.add(x.look.id); }
  const eggLooks = COSMETICS.filter((c) => c.unlock.egg).map((c) => c.id);
  ok('every egg-only look can drop from eggs', eggLooks.every((id) => seen.has(id)), `${seen.size}/${eggLooks.length}`);
  ok('eggs never give a look twice (owned ones leave the pool)', eggLooks.every((id) => d.cosmetics.owned[id]));
  ok('eggs never drop looks that belong to trophies', [...seen].every((id) => COSMETIC_BY_ID[id].unlock.egg));
}

// ---- save v3
{
  const old = { v: 2, seedsBank: 777, xp: 321, best: { distance: 1234 }, upgrades: { magnet: 2 }, companions: { owned: { bumbly: true }, equipped: 'bumbly' }, settings: { music: false, musicVol: 0.2 }, stats: { runs: 9, totalDistance: 5000 } };
  const s = parseSave(JSON.stringify(old));
  ok('v2 save migrates to v3 keeping progress', s.v === VERSION && s.seedsBank === 777 && s.xp === 321 && s.best.distance === 1234 && s.upgrades.magnet === 2 && s.companions.equipped === 'bumbly' && s.stats.runs === 9);
  ok('...and keeps old settings while adding the new ones', s.settings.music === false && s.settings.musicVol === 0.2 && s.settings.gentle === false && s.settings.quality === 'auto' && s.settings.flashes === true);
  ok('...and adds empty trophies + default wardrobe', Object.values(s.achievements).every((v) => v === 0) && s.cosmetics.equipped.eyes === 'eyes.amber');
  const bad = parseSave(JSON.stringify({ v: 3, cosmetics: { owned: {}, equipped: { scales: 'scales.gilded', horns: 'x', eyes: 5 } }, settings: { quality: 'ultra', musicVol: 'loud' } }));
  ok('unowned/unknown equipped looks fall back to defaults', bad.cosmetics.equipped.scales === 'scales.cinder' && bad.cosmetics.equipped.horns === 'horns.bone' && bad.cosmetics.equipped.eyes === 'eyes.amber');
  ok('junk settings are repaired', bad.settings.quality === 'auto' && bad.settings.musicVol === 0.7);
  ok('garbage never throws', ['', 'null', '[]', '{{', '"x"', '123', '{"v":"3","stats":7}'].every((t) => { try { return parseSave(t).v === VERSION; } catch (_) { return false; } }));
  const st = new SaveStore(); st.data = s; st.data.achievements.first_flame = 55;
  const code = st.exportCode();
  const st2 = new SaveStore();
  ok('export code round-trips', code.startsWith('EW3.') && st2.importCode(code) && st2.data.achievements.first_flame === 55 && st2.data.seedsBank === 777);
  ok('a damaged code is refused and changes nothing', (() => { const before = JSON.stringify(st2.data); return st2.importCode(code.slice(0, -2) + 'zz') === false && st2.importCode('hello') === false && JSON.stringify(st2.data) === before; })());
  ok('old LF-prefixed codes still import', (() => { const parts = code.split('.'); return new SaveStore().importCode('LF2.' + parts[1] + '.' + parts[2]); })());
}

// ---- gentle mode
{
  const d = defaultSave();
  const base = buildLoadout(d).hearts;
  d.settings.gentle = true;
  ok('gentle mode: +1 heart on normal runs, not on the Daily Run', buildLoadout(d).hearts === base + 1 && buildLoadout(d, { daily: true }).hearts === base);
}

console.log(fails ? `\n${fails} FAILED` : '\nall meta checks passed');
process.exit(fails ? 1 : 0);
