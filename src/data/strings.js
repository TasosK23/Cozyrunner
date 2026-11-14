/**
 * strings.js — every word the player can read lives here, so translating the game
 * later means copying this object, translating the values, and swapping it in.
 * Use {name} placeholders for numbers: t('over.goal', { pct: 62, level: 3 }).
 */
export const STRINGS = {
  'game.name': 'Emberwing Run',

  'title.name1': 'Emberwing',
  'title.name2': 'RUN',
  'title.tagline': 'Outfly the ashfall. Burn your name into the sky.',
  'title.play': 'Fly',
  'title.best': 'Best run: {m} m',
  'title.first': 'Cinder is hungry for the first flight',

  'hud.pause': 'Pause',
  'hud.m': '{m} m',

  'hint.jump': 'Tap to leap!',
  'hint.jump.sub': 'Hold longer to leap higher',
  'hint.slide': 'Swipe down to dive!',
  'hint.slide.sub': 'Dive under the iron portcullis',
  'hint.glide': 'Tap again in the air to spread your wings!',
  'hint.glide.sub': 'Cinder glides across the gap',
  'tips.skip': 'Skip tips',

  'pause.title': 'Paused',
  'pause.resume': 'Resume',
  'pause.restart': 'Restart',
  'pause.home': 'Home',

  'over.titles': [
    'Cinder falls',
    'Scorched',
    'The ashes claim another',
    'Wings clipped',
    'Cinder is down',
    'Not today, dragon',
  ],
  'over.distance': 'Distance',
  'over.score': 'Score',
  'over.seeds': 'Embers',
  'over.best': 'Best',
  'over.newbest': 'New best!',
  'over.again': 'Fly again',
  'over.home': 'Home',
  'over.goal': '{pct}% to Rank {level}',
  'over.levelup': 'Rank up! You are now Rank {level}',
  'over.compare.first': 'First flight on the record!',
  'over.compare.behind': '{m} m short of your best',
  'over.compare.ahead': '{m} m past your old best',
  'over.xp': '+{xp} XP',
  'over.storage': 'Heads up: this browser isn’t saving progress.',

  'popup.blanket': 'Shield held!',
  'popup.perfect': 'On the beat!',
  'popup.festival': 'War drums - strike on the beat!',
  'popup.festivalall': 'Flawless!',
  'power.honey': 'Gold Magnet!',
  'power.hop': 'Wing Gust!',
  'power.dash': 'Inferno Dash!',
  'power.burst': 'Firestorm!',
  'power.blanket': 'Scale Shield!',
  'surprise.rainbow': 'An arc of molten gold!',
  'surprise.swarm': 'A phoenix swarm!',
  'surprise.lanterns': 'A line of braziers!',
  'popup.close': 'Close!',
  'popup.phew': 'Phew!',
  'popup.newbest': 'New best!',
  'popup.word': 'F-I-R-E!',
  'popup.heart': '+1 heart',
  'popup.glow': 'Blaze!',
  'popup.firefly': 'Phoenix wisp!',

  'rotate.msg': 'Cinder flies upright. Please turn your phone to portrait.',
};

/** Translate a key. Missing keys return the key itself so gaps are easy to spot. */
export function t(key, vars) {
  const raw = STRINGS[key];
  if (raw === undefined) return key;
  if (typeof raw !== 'string') return raw;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}
