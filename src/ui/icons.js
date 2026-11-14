/** icons.js — small inline SVG icons shared by the menu panels and toasts. */
import { TIER } from '../data/achievements.js';

export const ICON = {
  seed: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c4 5 6 8 0 17-6-9-4-12 0-17z" fill="#ff8a2a" stroke="#8a2a10" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 2c2 3 3 5 3 7l-3 3z" fill="#ffd36a"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#7fe06a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/** A shield-shaped medal in the tier's metal; `locked` draws a grey padlock-ish version. */
export function medal(tier, locked = false) {
  const col = locked ? '#5a5163' : TIER[tier].color;
  const rim = locked ? '#2a2430' : '#2a1008';
  const mark = locked
    ? '<rect x="9" y="12" width="10" height="8" rx="1.5" fill="#2a2430"/><path d="M11 12v-2.2a3 3 0 0 1 6 0V12" fill="none" stroke="#2a2430" stroke-width="2"/>'
    : '<path d="M8.5 14.5l3.6 3.6 7-7.6" fill="none" stroke="#2a1008" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  return `<svg class="medal" viewBox="0 0 28 32" aria-hidden="true"><path d="M14 1.5l11 4v9.5c0 7.2-4.8 12.6-11 15.5C7.8 27.6 3 22.2 3 15V5.5z" fill="${col}" stroke="${rim}" stroke-width="2" stroke-linejoin="round"/><path d="M14 4.5l8 2.9v7.4c0 5.4-3.4 9.5-8 12" fill="none" stroke="#fff" stroke-opacity="${locked ? 0.08 : 0.28}" stroke-width="2"/>${mark}</svg>`;
}
