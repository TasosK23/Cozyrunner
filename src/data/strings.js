/**
 * strings.js — every word the player can read lives here, so translating the game
 * later means copying this object, translating the values, and swapping it in.
 * Use {name} placeholders for numbers: t('over.goal', { pct: 62, level: 3 }).
 */
export const STRINGS = {
  'game.name': 'Lanternfold Run',

  'title.name1': 'Lanternfold',
  'title.name2': 'Run',
  'title.tagline': 'Light the sleepy lanterns before nightfall',
  'title.play': 'Play',
  'title.best': 'Best run: {m} m',
  'title.first': 'Bramble is ready for the first run',

  'hud.pause': 'Pause',
  'hud.m': '{m} m',

  'hint.jump': 'Tap to jump!',
  'hint.jump.sub': 'Hold a little longer to jump higher',
  'hint.slide': 'Swipe down to slide!',
  'hint.slide.sub': 'Duck under the low vines',
  'hint.glide': 'Tap again in the air to glide!',
  'hint.glide.sub': 'Bramble’s leaf flutters across the gap',
  'tips.skip': 'Skip tips',

  'pause.title': 'Taking a breather',
  'pause.resume': 'Resume',
  'pause.restart': 'Restart',
  'pause.home': 'Home',

  'over.titles': [
    'Oops! Bramble got sleepy',
    'Whoopsie-daisy!',
    'A cozy little tumble',
    'Time for a tiny nap',
    'Bramble needs a blanket',
  ],
  'over.distance': 'Distance',
  'over.score': 'Score',
  'over.seeds': 'Glow-seeds',
  'over.best': 'Best',
  'over.newbest': 'New best!',
  'over.again': 'Run again',
  'over.home': 'Home',
  'over.goal': '{pct}% to Level {level}',
  'over.levelup': 'Level up! Welcome to Level {level}',
  'over.compare.first': 'First run on the books!',
  'over.compare.behind': '{m} m from your best',
  'over.compare.ahead': '{m} m past your old best',
  'over.xp': '+{xp} XP',
  'over.storage': 'Heads up: this browser isn’t saving progress.',

  'popup.close': 'Close!',
  'popup.phew': 'Phew!',
  'popup.newbest': 'New best!',
  'popup.word': 'C-O-Z-Y!',
  'popup.heart': '+1 heart',
  'popup.glow': 'Glow!',
  'popup.firefly': 'Golden firefly!',

  'rotate.msg': 'Bramble likes to run upright. Please turn your phone to portrait.',
};

/** Translate a key. Missing keys return the key itself so gaps are easy to spot. */
export function t(key, vars) {
  const raw = STRINGS[key];
  if (raw === undefined) return key;
  if (typeof raw !== 'string') return raw;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}
