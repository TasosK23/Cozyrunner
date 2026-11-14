/**
 * powerups.js — the five power-ups. Numbers (durations, radii) live in balance.js (POWER).
 * `color` tints the duration ring around Cinder and the pickup; `desc` is shown in "How to play".
 */
export const POWER_ORDER = ['honey', 'hop', 'dash', 'burst', 'blanket'];

export const POWERUPS = {
  honey:   { id: 'honey',   name: 'Gold Magnet',    color: '#ffbf3f', desc: 'Drags embers toward Cinder from far away.' },
  hop:     { id: 'hop',     name: 'Wing Gust',      color: '#9fd8ff', desc: 'Three free mid-air wing-beats. Tap in the air!' },
  dash:    { id: 'dash',    name: 'Inferno Dash',   color: '#ff6a3a', desc: 'A short, invincible charge wrapped in flame.' },
  burst:   { id: 'burst',   name: 'Firestorm',      color: '#ffd36a', desc: 'Torches everything near you and turns hazards into embers.' },
  blanket: { id: 'blanket', name: 'Scale Shield',   color: '#ff8a5a', desc: 'Absorbs the next hit (or fall) completely.' },
};
