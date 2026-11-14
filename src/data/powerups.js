/**
 * powerups.js — the five power-ups. Numbers (durations, radii) live in balance.js (POWER).
 * `color` tints the duration ring around Bramble and the pickup; `desc` is shown in "How to play".
 */
export const POWER_ORDER = ['honey', 'hop', 'dash', 'burst', 'blanket'];

export const POWERUPS = {
  honey:   { id: 'honey',   name: 'Honey Magnet',   color: '#ffbf3f', desc: 'Pulls glow-seeds toward Bramble from far away.' },
  hop:     { id: 'hop',     name: 'Cloud Hop',      color: '#8fd0ff', desc: 'Three free mid-air jumps. Tap in the air!' },
  dash:    { id: 'dash',    name: 'Teapot Dash',    color: '#ff8f8f', desc: 'A short, invincible burst of speed with a steamy trail.' },
  burst:   { id: 'burst',   name: 'Lantern Burst',  color: '#ffe27a', desc: 'Lights up everything near you and turns hazards into seeds.' },
  blanket: { id: 'blanket', name: 'Cozy Blanket',   color: '#d6a5ff', desc: 'Absorbs the next bump (or fall) completely.' },
};
